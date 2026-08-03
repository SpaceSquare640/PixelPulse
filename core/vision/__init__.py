from .colour_pattern import find_colour_cluster
from .match_result import Match
from .pixel_match import match_pixel, read_pixel_rgb
from .template_matching import find_all_targets, find_target, load_template

__all__ = [
    "Match",
    "find_target",
    "find_all_targets",
    "find_colour_cluster",
    "load_template",
    "match_pixel",
    "read_pixel_rgb",
]
