import threading
import time

import cv2
import numpy as np

from core.rules.engine import RuleEngine
from core.rules.models import RuleConfig


class _FakeCapture:
    """Duck-typed stand-in for ScreenCapture that never touches the real screen."""

    def grab(self, region):
        return np.zeros((region.height, region.width, 3), dtype=np.uint8)


class _NoopBackend:
    def click(self, *a, **k):
        pass

    def double_click(self, *a, **k):
        pass

    def key_press(self, *a, **k):
        pass

    def type_text(self, *a, **k):
        pass


def _template_rule(name: str, image_path: str) -> RuleConfig:
    return RuleConfig.model_validate(
        {
            "name": name,
            "trigger": {"kind": "template", "roi": [0, 0, 10, 10], "image": image_path},
            "action": {"kind": "click"},
            "cooldownMs": 10,
        }
    )


def test_broken_rule_does_not_crash_engine_and_only_reports_once(tmp_path):
    # Regression test: a rule whose template image is missing used to raise
    # inside the scan loop and silently kill the whole engine thread, with
    # no error surfaced anywhere the GUI could see (found via manual E2E
    # testing of the Phase 2 GUI).
    good_template_path = tmp_path / "good.png"
    cv2.imwrite(str(good_template_path), np.zeros((4, 4, 3), dtype=np.uint8))

    events = []
    rules = [
        _template_rule("broken", str(tmp_path / "does-not-exist.png")),
        _template_rule("good", str(good_template_path)),
    ]
    engine = RuleEngine(
        rules=rules,
        capture=_FakeCapture(),
        input_backend=_NoopBackend(),
        on_event=events.append,
        scan_interval_s=0.02,
    )

    thread = threading.Thread(target=engine.run_forever, daemon=True)
    thread.start()
    time.sleep(0.15)  # let it scan several times
    engine.stop()
    thread.join(timeout=2)

    # The loop only stopped because we called stop(), not because it crashed.
    assert thread.is_alive() is False

    error_events = [e for e in events if e.type == "rule_error" and e.rule_name == "broken"]
    assert len(error_events) == 1


def test_macro_action_failure_does_not_crash_engine(tmp_path):
    # Phase 4 equivalent of the missing-template bug above: a macro step
    # that never finds its target on screen must not crash the engine
    # thread, and should surface as a rule_error event instead of silently
    # stopping. Unlike a detection failure this is NOT permanent (no
    # is_broken), since a step timing out once doesn't mean it always will.
    #
    # Uses a noisy (not flat/solid-colour) template -- see
    # core/vision/template_matching.py's module docstring: TM_CCOEFF_NORMED
    # is undefined (0/0) over zero-variance images and OpenCV resolves that
    # as a false 1.0 "perfect match", which would make wait_for succeed
    # immediately against the all-zero _FakeCapture frame instead of timing
    # out like this test needs.
    template_path = tmp_path / "target.png"
    rng = np.random.default_rng(3)
    cv2.imwrite(str(template_path), rng.integers(0, 255, size=(10, 10, 3), dtype=np.uint8))

    rule = RuleConfig.model_validate(
        {
            "name": "macro-rule",
            "trigger": {
                "kind": "pixel",
                "roi": [0, 0, 10, 10],
                "pixelX": 0,
                "pixelY": 0,
                "targetRgb": [0, 0, 0],
                "tolerance": 5,
            },
            "action": {
                "kind": "macro",
                "steps": [
                    {
                        "kind": "wait_for",
                        "target": str(template_path),
                        "roi": [0, 0, 10, 10],
                        "timeoutMs": 20,
                        "retryCount": 0,
                    }
                ],
            },
            "cooldownMs": 50,
            "dryRun": False,
        }
    )

    events = []
    engine = RuleEngine(
        rules=[rule],
        capture=_FakeCapture(),
        input_backend=_NoopBackend(),
        on_event=events.append,
        scan_interval_s=0.02,
    )

    thread = threading.Thread(target=engine.run_forever, daemon=True)
    thread.start()
    time.sleep(0.15)
    engine.stop()
    thread.join(timeout=2)

    assert thread.is_alive() is False
    error_events = [e for e in events if e.type == "rule_error" and e.rule_name == "macro-rule"]
    assert len(error_events) >= 1


# --- Phase 5: parallel detection --------------------------------------------


class _RoiCapture:
    """Returns a fixed frame per (left, top, width, height) ROI -- lets several
    rules with distinct ROIs be scanned against distinct synthetic frames.
    """

    def __init__(self, roi_to_frame: dict):
        self._roi_to_frame = roi_to_frame

    def grab(self, region):
        return self._roi_to_frame[(region.left, region.top, region.width, region.height)]

    def close(self) -> None:
        pass


def _make_matching_template_rules(tmp_path, count: int):
    rules = []
    roi_to_frame = {}
    for i in range(count):
        rng = np.random.default_rng(100 + i)
        template = rng.integers(0, 255, size=(20, 20, 3), dtype=np.uint8)
        template_path = tmp_path / f"t{i}.png"
        cv2.imwrite(str(template_path), template)

        roi = (i * 100, 0, 60, 60)
        frame = np.zeros((60, 60, 3), dtype=np.uint8)
        frame[10:30, 10:30] = template  # pasted at local (10, 10) -> centre (20, 20)
        roi_to_frame[roi] = frame

        rules.append(
            RuleConfig.model_validate(
                {
                    "name": f"match-rule-{i}",
                    "trigger": {"kind": "template", "roi": list(roi), "image": str(template_path), "threshold": 0.9},
                    "action": {"kind": "click"},
                    "cooldownMs": 100_000,  # only need the first hit per rule
                    "dryRun": True,
                }
            )
        )
    return rules, roi_to_frame


def _run_briefly(engine: RuleEngine, duration_s: float = 0.15) -> None:
    thread = threading.Thread(target=engine.run_forever, daemon=True)
    thread.start()
    time.sleep(duration_s)
    engine.stop()
    thread.join(timeout=2)
    assert thread.is_alive() is False


def test_parallel_detection_matches_sequential_results(tmp_path):
    rules, roi_to_frame = _make_matching_template_rules(tmp_path, 6)
    expected_names = {r.name for r in rules}

    sequential_events = []
    sequential_engine = RuleEngine(
        rules=rules,
        capture=_RoiCapture(roi_to_frame),
        input_backend=_NoopBackend(),
        on_event=sequential_events.append,
        scan_interval_s=0.02,
    )
    _run_briefly(sequential_engine)

    parallel_events = []
    parallel_engine = RuleEngine(
        rules=rules,
        capture=_RoiCapture(roi_to_frame),
        input_backend=_NoopBackend(),
        on_event=parallel_events.append,
        scan_interval_s=0.02,
        max_workers=3,
        capture_factory=lambda: _RoiCapture(roi_to_frame),
    )
    _run_briefly(parallel_engine)

    sequential_matched = {e.rule_name for e in sequential_events if e.type == "rule_matched"}
    parallel_matched = {e.rule_name for e in parallel_events if e.type == "rule_matched"}
    assert sequential_matched == expected_names
    assert parallel_matched == expected_names


def test_max_workers_without_capture_factory_raises():
    import pytest

    with pytest.raises(ValueError, match="capture_factory"):
        RuleEngine(rules=[], capture=_FakeCapture(), input_backend=_NoopBackend(), max_workers=2)


def test_parallel_mode_creates_and_closes_captures_on_their_own_thread():
    # Regression test: closing a worker thread's capture from the *main*
    # thread failed on Windows (mss's GDI device context is thread-affine --
    # ReleaseDC from a different thread than the one that opened it errors
    # outright). Found by actually running the parallel path, not by
    # inspection. Each capture must be closed by the exact thread that
    # created it.
    log: list[tuple] = []
    log_lock = threading.Lock()

    class _LoggingCapture:
        def __init__(self) -> None:
            self._owner_thread_id = threading.get_ident()
            with log_lock:
                log.append(("create", self._owner_thread_id))

        def grab(self, region):
            return np.zeros((region.height, region.width, 3), dtype=np.uint8)

        def close(self) -> None:
            with log_lock:
                log.append(("close", threading.get_ident(), self._owner_thread_id))

    rules = [
        RuleConfig.model_validate(
            {
                "name": f"pixel-{i}",
                "trigger": {
                    "kind": "pixel",
                    "roi": [0, 0, 5, 5],
                    "pixelX": 0,
                    "pixelY": 0,
                    "targetRgb": [255, 255, 255],
                    "tolerance": 0,
                },
                "action": {"kind": "click"},
                "dryRun": True,
            }
        )
        for i in range(6)
    ]

    engine = RuleEngine(
        rules=rules,
        capture=_FakeCapture(),
        input_backend=_NoopBackend(),
        scan_interval_s=0.02,
        max_workers=3,
        capture_factory=_LoggingCapture,
    )
    _run_briefly(engine)

    creates = [entry for entry in log if entry[0] == "create"]
    closes = [entry for entry in log if entry[0] == "close"]

    assert 1 <= len(creates) <= 3  # at most max_workers distinct captures
    assert len(closes) == len(creates)  # every created capture got closed

    for _, closing_thread_id, owner_thread_id in closes:
        assert closing_thread_id == owner_thread_id  # closed by its own creator thread
