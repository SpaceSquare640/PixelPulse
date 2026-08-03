import numpy as np

from core.vision.colour_detect import detect_key_colours


def test_detects_two_distinct_halves():
    image = np.zeros((20, 20, 3), dtype=np.uint8)
    image[:10] = (0, 0, 255)  # BGR red on top half
    image[10:] = (0, 255, 0)  # BGR green on bottom half

    colours = detect_key_colours(image, max_colours=5)

    assert len(colours) == 2
    rgbs = {rgb for rgb, _ox, _oy in colours}
    assert rgbs == {(255, 0, 0), (0, 255, 0)}


def test_offsets_reflect_position_relative_to_image_center():
    image = np.zeros((20, 20, 3), dtype=np.uint8)
    image[:10] = (0, 0, 255)  # top half -> should have negative offset_y
    image[10:] = (0, 255, 0)  # bottom half -> should have positive offset_y

    colours = detect_key_colours(image, max_colours=5)
    by_rgb = {rgb: (ox, oy) for rgb, ox, oy in colours}

    assert by_rgb[(255, 0, 0)][1] < 0
    assert by_rgb[(0, 255, 0)][1] > 0


def test_respects_max_colours_limit():
    rng = np.random.default_rng(0)
    image = rng.integers(0, 255, size=(30, 30, 3), dtype=np.uint8)

    colours = detect_key_colours(image, max_colours=3)

    assert len(colours) <= 3


def test_empty_image_returns_no_colours():
    image = np.zeros((0, 0, 3), dtype=np.uint8)
    assert detect_key_colours(image) == []


def test_sorted_by_prominence_largest_first():
    image = np.zeros((20, 20, 3), dtype=np.uint8)
    image[:15] = (0, 0, 255)  # 75% of the image -- red should come first
    image[15:] = (0, 255, 0)  # 25% -- green second

    colours = detect_key_colours(image, max_colours=5)

    assert colours[0][0] == (255, 0, 0)
