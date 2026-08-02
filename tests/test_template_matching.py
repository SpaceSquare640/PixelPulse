import numpy as np

from core.capture.screen import Region
from core.vision.template_matching import find_all_targets, find_target

# TM_CCOEFF_NORMED is undefined (0/0) over perfectly flat (zero-variance)
# regions, so fixtures use noisy/textured pixels rather than solid colours to
# stay in the well-defined case real screenshots fall into.
_RNG = np.random.default_rng(42)


def _make_background(size=(200, 200)) -> np.ndarray:
    return _RNG.integers(0, 255, size=(*size, 3), dtype=np.uint8)


def _make_template(size=(20, 20)) -> np.ndarray:
    return _RNG.integers(0, 255, size=(*size, 3), dtype=np.uint8)


def _paste(frame: np.ndarray, template: np.ndarray, position: tuple[int, int]) -> np.ndarray:
    frame = frame.copy()
    x, y = position
    th, tw = template.shape[:2]
    frame[y : y + th, x : x + tw] = template
    return frame


def test_find_target_returns_absolute_coordinates():
    template = _make_template()
    frame = _paste(_make_background(), template, position=(50, 30))
    region = Region(left=1000, top=500, width=200, height=200)

    match = find_target(frame, template, region, threshold=0.9)

    assert match is not None
    # template top-left is (50, 30), size 20x20 -> center is (60, 40), offset by region origin
    assert match.x == 1000 + 60
    assert match.y == 500 + 40
    assert match.confidence > 0.99


def test_find_target_returns_none_below_threshold():
    template = _make_template()
    frame = _make_background()  # template never pasted in
    region = Region(left=0, top=0, width=200, height=200)

    assert find_target(frame, template, region, threshold=0.9) is None


def test_find_all_targets_deduplicates_and_finds_multiple_instances():
    template = _make_template()
    frame = _make_background()
    for x, y in [(10, 10), (100, 100)]:
        frame = _paste(frame, template, (x, y))
    region = Region(left=0, top=0, width=200, height=200)

    matches = find_all_targets(frame, template, region, threshold=0.9, min_distance=15)

    assert len(matches) == 2
    coords = sorted((m.x, m.y) for m in matches)
    assert coords == [(20, 20), (110, 110)]
