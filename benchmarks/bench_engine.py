"""Phase 5 step 3: confirm the speedup holds through RuleEngine's actual
production code path (_detect_only via a real ThreadPoolExecutor + per-thread
_CapturePool), not just the raw cv2 calls bench_matching.py/bench_parallel.py
already measured. Drives RuleEngine's internals directly for one scan pass
rather than looping run_forever(), so there's no need to fake out time.sleep.

Usage:
    python -m benchmarks.bench_engine
"""

from __future__ import annotations

import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import cv2
import numpy as np

from core.capture.screen import Region
from core.rules.engine import RuleEngine
from core.rules.models import RuleConfig

RNG = np.random.default_rng(11)


class _NoopBackend:
    def click(self, *a, **k):
        pass

    def double_click(self, *a, **k):
        pass

    def key_press(self, *a, **k):
        pass

    def type_text(self, *a, **k):
        pass


class _PerRuleFakeCapture:
    """Returns a fixed synthetic frame per ROI -- avoids real screen
    dependence while exercising the exact same cv2 calls as production.
    """

    def __init__(self, roi_to_frame: dict[tuple[int, int, int, int], np.ndarray]) -> None:
        self._roi_to_frame = roi_to_frame

    def grab(self, region: Region) -> np.ndarray:
        return self._roi_to_frame[(region.left, region.top, region.width, region.height)]


def _make_rules(rule_count: int, tmp_dir: Path) -> tuple[list[RuleConfig], dict[tuple[int, int, int, int], np.ndarray]]:
    rules = []
    roi_to_frame: dict[tuple[int, int, int, int], np.ndarray] = {}
    for i in range(rule_count):
        template = RNG.integers(0, 255, size=(64, 64, 3), dtype=np.uint8)
        template_path = tmp_dir / f"t{i}.png"
        cv2.imwrite(str(template_path), template)

        roi = (i * 500, 0, 400, 300)  # distinct ROI per rule so frames don't collide
        roi_to_frame[roi] = RNG.integers(0, 255, size=(300, 400, 3), dtype=np.uint8)  # never matches -> full scan

        rules.append(
            RuleConfig.model_validate(
                {
                    "name": f"rule-{i}",
                    "trigger": {"kind": "template", "roi": list(roi), "image": str(template_path), "threshold": 0.99},
                    "action": {"kind": "click"},
                    "dryRun": True,
                }
            )
        )
    return rules, roi_to_frame


def _time_sequential(engine: RuleEngine, capture, repeats: int) -> float:
    engine._scan_rule(engine._states[0])  # warmup (template load, etc.)
    start = time.perf_counter()
    for _ in range(repeats):
        for state in engine._states:
            engine._detect_only(state, capture)
    return time.perf_counter() - start


def _time_parallel(engine: RuleEngine, capture_factory, max_workers: int, repeats: int) -> float:
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        capture_pool_get = _make_capture_pool_get(capture_factory)
        # warmup
        list(pool.map(lambda s: engine._detect_only(s, capture_pool_get()), engine._states))

        start = time.perf_counter()
        for _ in range(repeats):
            list(pool.map(lambda s: engine._detect_only(s, capture_pool_get()), engine._states))
        return time.perf_counter() - start


def _make_capture_pool_get(capture_factory):
    import threading

    local = threading.local()

    def get():
        capture = getattr(local, "capture", None)
        if capture is None:
            capture = capture_factory()
            local.capture = capture
        return capture

    return get


def main() -> None:
    rule_count = 30
    repeats = 10
    print(f"RuleEngine._detect_only, real production path: {rule_count} template rules (64x64 template, 400x300 ROI each), {repeats} scan passes\n")

    with tempfile.TemporaryDirectory() as tmp:
        rules, roi_to_frame = _make_rules(rule_count, Path(tmp))
        capture = _PerRuleFakeCapture(roi_to_frame)
        engine = RuleEngine(rules=rules, capture=capture, input_backend=_NoopBackend())

        seq = _time_sequential(engine, capture, repeats)
        print(f"{'sequential':<24} {seq * 1000:>10.1f} ms total  ({seq / repeats * 1000:>6.1f} ms/pass)")

        for workers in (2, 4, 8):
            parallel = _time_parallel(engine, lambda: _PerRuleFakeCapture(roi_to_frame), workers, repeats)
            print(
                f"{f'parallel ({workers} workers)':<24} {parallel * 1000:>10.1f} ms total  "
                f"({parallel / repeats * 1000:>6.1f} ms/pass)  {seq / parallel:.2f}x"
            )


if __name__ == "__main__":
    main()
