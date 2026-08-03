"""Phase 5 step 1: measure where time actually goes before writing any C++.

`cv2.matchTemplate` is already a native, SIMD-optimized OpenCV routine --
it is NOT pure Python. So "should we write a pybind11 module for template
matching" is an empirical question, not an assumption. This script measures:

1. `cv2.matchTemplate` itself, at realistic ROI/template sizes.
2. `find_target` (matchTemplate + minMaxLoc) -- should track (1) closely.
3. `find_all_targets`'s non-max-suppression loop, which IS pure Python and
   scales with candidate count -- the most plausible thing worth
   accelerating.
4. A simulated multi-rule scan tick, to see how many rules the engine can
   scan within a target interval (default 0.2s / 5Hz) before falling behind.

Usage:
    python -m benchmarks.bench_matching

Phase 5 第一步：先量測時間實際花在哪裡，再決定要不要寫 C++。

`cv2.matchTemplate`本身就是原生、有 SIMD 最佳化的 OpenCV 函式，不是純
Python——所以「要不要為樣板匹配寫 pybind11 模組」是一個要用數據回答的問題，
不是預設立場。這支程式會量測：

1. `cv2.matchTemplate` 本身，用貼近真實情境的 ROI/樣板尺寸。
2. `find_target`（matchTemplate + minMaxLoc）—— 應該跟 (1) 差不多。
3. `find_all_targets` 裡的非極大值抑制迴圈，這段**才是**純 Python，
   會隨候選數量增加而變慢——是最有可能值得加速的部分。
4. 模擬多規則同時掃描一次的耗時，看在預設掃描間隔（0.2 秒 / 5Hz）內
   最多能撐幾條規則而不落後。

用法：
    python -m benchmarks.bench_matching
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import cv2
import numpy as np

from core.capture.screen import Region
from core.vision.template_matching import find_all_targets, find_target

RNG = np.random.default_rng(42)


@dataclass
class Timing:
    label: str
    iterations: int
    total_s: float

    @property
    def per_call_ms(self) -> float:
        return (self.total_s / self.iterations) * 1000

    @property
    def calls_per_sec(self) -> float:
        return self.iterations / self.total_s


def _time_it(label: str, iterations: int, fn) -> Timing:
    # One untimed warmup call so first-call overhead (e.g. numpy/OpenCV
    # lazy init) doesn't skew the measurement.
    fn()
    start = time.perf_counter()
    for _ in range(iterations):
        fn()
    return Timing(label, iterations, time.perf_counter() - start)


def _noisy_frame(width: int, height: int) -> np.ndarray:
    return RNG.integers(0, 255, size=(height, width, 3), dtype=np.uint8)


def bench_match_template(roi_size: tuple[int, int], template_size: tuple[int, int], iterations: int) -> Timing:
    rw, rh = roi_size
    tw, th = template_size
    frame = _noisy_frame(rw, rh)
    template = _noisy_frame(tw, th)

    return _time_it(
        f"cv2.matchTemplate  roi={rw}x{rh} template={tw}x{th}",
        iterations,
        lambda: cv2.matchTemplate(frame, template, cv2.TM_CCOEFF_NORMED),
    )


def bench_find_target(roi_size: tuple[int, int], template_size: tuple[int, int], iterations: int) -> Timing:
    rw, rh = roi_size
    tw, th = template_size
    frame = _noisy_frame(rw, rh)
    template = _noisy_frame(tw, th)
    region = Region(0, 0, rw, rh)

    return _time_it(
        f"find_target()      roi={rw}x{rh} template={tw}x{th}",
        iterations,
        lambda: find_target(frame, template, region, threshold=0.99),  # 0.99 so it never "finds" -> always full scan
    )


def bench_find_all_targets_nms(
    roi_size: tuple[int, int], template_size: tuple[int, int], instance_count: int, iterations: int
) -> Timing:
    """Isolates the NMS loop by making a frame with many plausible matches."""
    rw, rh = roi_size
    tw, th = template_size
    template = _noisy_frame(tw, th)
    frame = _noisy_frame(rw, rh)

    # Paste the same template at `instance_count` non-overlapping spots so
    # find_all_targets has real candidates to de-duplicate, not just noise.
    cols = max(1, (rw - tw) // (tw + 4))
    for i in range(instance_count):
        x = (i % cols) * (tw + 4)
        y = (i // cols) * (th + 4)
        if y + th > rh:
            break
        frame[y : y + th, x : x + tw] = template

    region = Region(0, 0, rw, rh)
    return _time_it(
        f"find_all_targets() roi={rw}x{rh} template={tw}x{th} ~{instance_count} instances",
        iterations,
        lambda: find_all_targets(frame, template, region, threshold=0.9),
    )


def bench_simulated_scan_tick(rule_count: int, roi_size: tuple[int, int], template_size: tuple[int, int], iterations: int) -> Timing:
    """Simulates one engine tick scanning `rule_count` independent template rules."""
    rw, rh = roi_size
    tw, th = template_size
    frames = [_noisy_frame(rw, rh) for _ in range(rule_count)]
    templates = [_noisy_frame(tw, th) for _ in range(rule_count)]
    region = Region(0, 0, rw, rh)

    def tick():
        for frame, template in zip(frames, templates):
            find_target(frame, template, region, threshold=0.99)

    return _time_it(f"scan tick, {rule_count} rule(s)  roi={rw}x{rh}", iterations, tick)


def report(timings: list[Timing]) -> None:
    print(f"{'benchmark':<55} {'ms/call':>10} {'calls/s':>10}")
    print("-" * 78)
    for t in timings:
        print(f"{t.label:<55} {t.per_call_ms:>10.3f} {t.calls_per_sec:>10.1f}")


def main() -> None:
    print("=== 1. cv2.matchTemplate (raw OpenCV) ===")
    report(
        [
            bench_match_template((400, 300), (20, 20), 200),
            bench_match_template((400, 300), (64, 64), 200),
            bench_match_template((1920, 1080), (64, 64), 50),
        ]
    )

    print("\n=== 2. find_target() (matchTemplate + minMaxLoc) ===")
    report(
        [
            bench_find_target((400, 300), (20, 20), 200),
            bench_find_target((400, 300), (64, 64), 200),
            bench_find_target((1920, 1080), (64, 64), 50),
        ]
    )

    print("\n=== 3. find_all_targets() NMS loop (pure Python part) ===")
    report(
        [
            bench_find_all_targets_nms((800, 600), (30, 30), 5, 50),
            bench_find_all_targets_nms((800, 600), (30, 30), 20, 50),
            bench_find_all_targets_nms((800, 600), (30, 30), 100, 20),
        ]
    )

    print("\n=== 4. Simulated engine tick (N template rules, one scan) ===")
    report(
        [
            bench_simulated_scan_tick(1, (400, 300), (64, 64), 50),
            bench_simulated_scan_tick(10, (400, 300), (64, 64), 50),
            bench_simulated_scan_tick(50, (400, 300), (64, 64), 20),
        ]
    )


if __name__ == "__main__":
    main()
