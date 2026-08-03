"""Phase 5 step 2: given bench_matching.py showed cv2.matchTemplate itself
(already native OpenCV/SIMD code) dominates all cost -- with the pure-Python
NMS loop measurably negligible -- a hand-written pybind11 reimplementation of
matchTemplate is very unlikely to beat OpenCV's own optimized routine. The
more promising angle: OpenCV-Python releases the GIL during the actual
matchTemplate call, so scanning independent rules across a thread pool
*might* get real multi-core speedup for free, with zero custom C++.

This script checks whether that's actually true, and by how much, and
whether OpenCV's own internal threading (cv2.setNumThreads) helps or fights
with it -- again: measure, don't assume.

Usage:
    python -m benchmarks.bench_parallel

Phase 5 第二步：bench_matching.py 已經顯示 cv2.matchTemplate 本身
（已經是原生 OpenCV/SIMD 程式碼）主宰了幾乎全部耗時，純 Python 的 NMS 迴圈
成本可以量測到但微不足道——手寫 pybind11 重新實作 matchTemplate，非常不可能
贏過 OpenCV 自己已經最佳化過的實作。比較有機會的方向是：OpenCV-Python 在
執行 matchTemplate 期間會釋放 GIL，所以把獨立的規則掃描分散到執行緒池裡，
*有可能*不用寫任何 C++ 就拿到真正的多核心加速。

這支程式驗證這個假設是否成立、能加速多少，以及 OpenCV 自己內建的執行緒
（cv2.setNumThreads）會不會反而互相打架——一樣：先量測，不要用猜的。

用法：
    python -m benchmarks.bench_parallel
"""

from __future__ import annotations

import os
import time
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np

from core.capture.screen import Region
from core.vision.template_matching import find_target

RNG = np.random.default_rng(42)


def _noisy_frame(width: int, height: int) -> np.ndarray:
    return RNG.integers(0, 255, size=(height, width, 3), dtype=np.uint8)


def _run_sequential(frames, templates, region) -> float:
    start = time.perf_counter()
    for frame, template in zip(frames, templates):
        find_target(frame, template, region, threshold=0.99)
    return time.perf_counter() - start


def _run_threaded(frames, templates, region, max_workers: int) -> float:
    start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        list(pool.map(lambda ft: find_target(ft[0], ft[1], region, threshold=0.99), zip(frames, templates)))
    return time.perf_counter() - start


def compare(rule_count: int, roi_size: tuple[int, int], template_size: tuple[int, int], worker_counts: list[int], repeats: int = 5) -> None:
    rw, rh = roi_size
    tw, th = template_size
    frames = [_noisy_frame(rw, rh) for _ in range(rule_count)]
    templates = [_noisy_frame(tw, th) for _ in range(rule_count)]
    region = Region(0, 0, rw, rh)

    seq_times = [_run_sequential(frames, templates, region) for _ in range(repeats)]
    seq_best = min(seq_times)
    print(f"\n--- {rule_count} rules, roi={rw}x{rh}, template={tw}x{th} (best of {repeats}) ---")
    print(f"{'mode':<24} {'time (ms)':>10} {'speedup':>10}")
    print(f"{'sequential':<24} {seq_best * 1000:>10.1f} {'1.00x':>10}")

    for workers in worker_counts:
        best = min(_run_threaded(frames, templates, region, workers) for _ in range(repeats))
        print(f"{f'threaded ({workers} workers)':<24} {best * 1000:>10.1f} {seq_best / best:>9.2f}x")


def main() -> None:
    cpu_count = os.cpu_count() or 4
    print(f"os.cpu_count() = {cpu_count}, cv2.getNumThreads() = {cv2.getNumThreads()}")
    worker_counts = sorted({2, 4, cpu_count})

    print("\n############ With OpenCV's own internal threading LEFT ON (default) ############")
    compare(50, (400, 300), (64, 64), worker_counts)

    print("\n############ With OpenCV's own internal threading DISABLED (cv2.setNumThreads(1)) ############")
    cv2.setNumThreads(1)
    compare(50, (400, 300), (64, 64), worker_counts)


if __name__ == "__main__":
    main()
