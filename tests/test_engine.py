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
