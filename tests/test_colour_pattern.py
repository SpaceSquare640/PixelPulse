import numpy as np

from core.capture.screen import Region
from core.vision.colour_pattern import find_colour_cluster


def _blank_frame(size: int = 100) -> np.ndarray:
    return np.zeros((size, size, 3), dtype=np.uint8)


def _paint_bgr(frame: np.ndarray, x: int, y: int, rgb: tuple[int, int, int]) -> None:
    r, g, b = rgb
    frame[y, x] = (b, g, r)


def test_finds_cluster_of_all_key_colours():
    frame = _blank_frame()
    colours = [(255, 0, 0), (0, 255, 0), (0, 0, 255)]
    # All three colours placed within a few pixels of (50, 50).
    _paint_bgr(frame, 48, 50, colours[0])
    _paint_bgr(frame, 50, 50, colours[1])
    _paint_bgr(frame, 52, 50, colours[2])

    region = Region(0, 0, 100, 100)
    match = find_colour_cluster(frame, region, colours, tolerance=5, min_matches=3, cluster_radius=10)

    assert match is not None
    assert abs(match.x - 50) <= 5
    assert abs(match.y - 50) <= 5
    assert match.confidence == 1.0


def test_tolerates_target_rotation_since_relative_layout_is_never_checked():
    # Same three colours as above, but arranged in a totally different
    # relative layout (as if the target had rotated) -- should still match,
    # because the algorithm never checks angle/relative position, only
    # "are these colours near each other".
    frame = _blank_frame()
    colours = [(255, 0, 0), (0, 255, 0), (0, 0, 255)]
    _paint_bgr(frame, 50, 45, colours[0])  # rotated layout: stacked vertically instead
    _paint_bgr(frame, 50, 50, colours[1])
    _paint_bgr(frame, 50, 55, colours[2])

    region = Region(0, 0, 100, 100)
    match = find_colour_cluster(frame, region, colours, tolerance=5, min_matches=3, cluster_radius=10)

    assert match is not None


def test_no_match_when_colours_are_too_far_apart():
    frame = _blank_frame()
    colours = [(255, 0, 0), (0, 255, 0), (0, 0, 255)]
    _paint_bgr(frame, 10, 10, colours[0])
    _paint_bgr(frame, 90, 90, colours[1])
    _paint_bgr(frame, 50, 10, colours[2])

    region = Region(0, 0, 100, 100)
    match = find_colour_cluster(frame, region, colours, tolerance=5, min_matches=3, cluster_radius=5)

    assert match is None


def test_min_matches_allows_partial_hits():
    # Only 2 of 3 key colours present -- min_matches=2 should still succeed,
    # tolerating the target being partially obscured.
    frame = _blank_frame()
    colours = [(255, 0, 0), (0, 255, 0), (0, 0, 255)]
    _paint_bgr(frame, 49, 50, colours[0])
    _paint_bgr(frame, 51, 50, colours[1])
    # third colour absent from the frame entirely

    region = Region(0, 0, 100, 100)
    match = find_colour_cluster(frame, region, colours, tolerance=5, min_matches=2, cluster_radius=10)

    assert match is not None
    assert match.confidence == 2 / 3


def test_no_colours_returns_none():
    frame = _blank_frame()
    region = Region(0, 0, 100, 100)
    assert find_colour_cluster(frame, region, [], min_matches=1) is None


def test_match_coordinates_are_offset_by_region_origin():
    frame = _blank_frame()
    colours = [(255, 0, 0), (0, 255, 0)]
    _paint_bgr(frame, 20, 20, colours[0])
    _paint_bgr(frame, 22, 20, colours[1])

    region = Region(200, 300, 100, 100)  # non-zero origin, as if this were a cropped ROI
    match = find_colour_cluster(frame, region, colours, tolerance=5, min_matches=2, cluster_radius=10)

    assert match is not None
    assert match.x >= 200 + 15  # absolute coords, offset by region.left
    assert match.y >= 300 + 15
