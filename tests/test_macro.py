import cv2
import numpy as np
import pytest

from core.capture.screen import Region
from core.rules.macro import MacroExecutor, MacroStepTimeout
from core.rules.models import MacroStep


class _RecordingBackend:
    def __init__(self):
        self.calls = []

    def click(self, x, y, button="left"):
        self.calls.append(("click", x, y, button))

    def double_click(self, x, y, button="left"):
        self.calls.append(("double_click", x, y, button))

    def key_press(self, key):
        self.calls.append(("key", key))

    def type_text(self, text):
        self.calls.append(("type", text))


class _StaticCapture:
    """Always returns the same frame regardless of region -- deterministic
    stand-in for a real screen that contains a known template at a known spot.
    """

    def __init__(self, frame: np.ndarray):
        self._frame = frame

    def grab(self, region):
        return self._frame

    def full_screen_region(self, monitor_index=0):
        return Region(0, 0, self._frame.shape[1], self._frame.shape[0])


class _EmptyCapture:
    """A screen that never contains anything -- for testing the not-found path."""

    def __init__(self):
        self.grab_calls = 0

    def grab(self, region):
        self.grab_calls += 1
        return np.zeros((region.height, region.width, 3), dtype=np.uint8)

    def full_screen_region(self, monitor_index=0):
        return Region(0, 0, 100, 100)


def _make_template_and_frame(tmp_path):
    rng = np.random.default_rng(7)
    template = rng.integers(0, 255, size=(20, 20, 3), dtype=np.uint8)
    frame = rng.integers(0, 255, size=(100, 100, 3), dtype=np.uint8)
    frame[30:50, 40:60] = template  # paste the template at (40, 30)
    template_path = tmp_path / "template.png"
    cv2.imwrite(str(template_path), template)
    return str(template_path), frame


def test_key_and_type_steps_execute_in_order():
    backend = _RecordingBackend()
    executor = MacroExecutor(_EmptyCapture(), backend)

    executor.run([MacroStep(kind="key", key="tab"), MacroStep(kind="type", text="hi")])

    assert backend.calls == [("key", "tab"), ("type", "hi")]


def test_click_with_fixed_coordinates():
    backend = _RecordingBackend()
    executor = MacroExecutor(_EmptyCapture(), backend)

    executor.run([MacroStep(kind="click", x=5, y=6, button="right")])

    assert backend.calls == [("click", 5, 6, "right")]


def test_click_requires_target_or_coordinates():
    executor = MacroExecutor(_EmptyCapture(), _RecordingBackend())

    with pytest.raises(ValueError, match="needs either"):
        executor.run([MacroStep(kind="click")])


def test_wait_for_locates_target_on_screen(tmp_path):
    template_path, frame = _make_template_and_frame(tmp_path)
    executor = MacroExecutor(_StaticCapture(frame), _RecordingBackend())

    executor.run([MacroStep(kind="wait_for", target=template_path, roi=(0, 0, 100, 100), threshold=0.9)])
    # No exception raised = target was found.


def test_click_with_target_clicks_located_coordinates(tmp_path):
    template_path, frame = _make_template_and_frame(tmp_path)
    backend = _RecordingBackend()
    executor = MacroExecutor(_StaticCapture(frame), backend)

    executor.run([MacroStep(kind="click", target=template_path, roi=(0, 0, 100, 100), threshold=0.9)])

    # Template pasted at (40, 30), size 20x20 -> centre (50, 40).
    assert backend.calls == [("click", 50, 40, "left")]


def test_wait_for_times_out_and_raises(tmp_path):
    template_path, _ = _make_template_and_frame(tmp_path)
    executor = MacroExecutor(_EmptyCapture(), _RecordingBackend())
    step = MacroStep(kind="wait_for", target=template_path, roi=(0, 0, 100, 100), timeout_ms=50, retry_count=0)

    with pytest.raises(MacroStepTimeout):
        executor.run([step])


def test_wait_for_on_timeout_skip_continues_to_next_step(tmp_path):
    template_path, _ = _make_template_and_frame(tmp_path)
    backend = _RecordingBackend()
    executor = MacroExecutor(_EmptyCapture(), backend)
    steps = [
        MacroStep(kind="wait_for", target=template_path, roi=(0, 0, 100, 100), timeout_ms=50, onTimeout="skip"),
        MacroStep(kind="key", key="esc"),
    ]

    executor.run(steps)  # must not raise

    assert backend.calls == [("key", "esc")]


def test_retry_count_increases_number_of_capture_attempts(tmp_path):
    template_path, _ = _make_template_and_frame(tmp_path)

    no_retry_capture = _EmptyCapture()
    with pytest.raises(MacroStepTimeout):
        MacroExecutor(no_retry_capture, _RecordingBackend()).run(
            [MacroStep(kind="wait_for", target=template_path, roi=(0, 0, 100, 100), timeout_ms=50, retry_count=0)]
        )

    with_retry_capture = _EmptyCapture()
    with pytest.raises(MacroStepTimeout):
        MacroExecutor(with_retry_capture, _RecordingBackend()).run(
            [
                MacroStep(
                    kind="wait_for",
                    target=template_path,
                    roi=(0, 0, 100, 100),
                    timeout_ms=50,
                    retryCount=2,
                    retryDelayMs=10,
                )
            ]
        )

    assert with_retry_capture.grab_calls > no_retry_capture.grab_calls
