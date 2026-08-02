import numpy as np

from core.vision.pixel_match import match_pixel


def _frame_with_pixel(bgr: tuple[int, int, int]) -> np.ndarray:
    frame = np.zeros((10, 10, 3), dtype=np.uint8)
    frame[5, 5] = bgr
    return frame


def test_match_pixel_exact_hit():
    frame = _frame_with_pixel((0, 128, 255))  # BGR -> RGB (255, 128, 0)
    assert match_pixel(frame, x=5, y=5, target_rgb=(255, 128, 0)) is True


def test_match_pixel_within_tolerance():
    frame = _frame_with_pixel((0, 130, 250))
    assert match_pixel(frame, x=5, y=5, target_rgb=(255, 128, 0), tolerance=10) is True


def test_match_pixel_outside_tolerance():
    frame = _frame_with_pixel((0, 0, 0))
    assert match_pixel(frame, x=5, y=5, target_rgb=(255, 128, 0), tolerance=10) is False
