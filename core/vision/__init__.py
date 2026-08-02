from .match_result import Match
from .pixel_match import match_pixel
from .template_matching import find_all_targets, find_target, load_template

__all__ = [
    "Match",
    "find_target",
    "find_all_targets",
    "load_template",
    "match_pixel",
]
