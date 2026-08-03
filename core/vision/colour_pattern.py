"""Colour-cluster matching ("像素圖" / Pixel Map): rotation-tolerant detection.

Unlike template matching (which only tolerates translation, not rotation)
and single-pixel matching (which only checks one fixed point), this strategy
records a handful of key colours from the target and, at detection time,
looks for a spot where several of them show up close together -- regardless
of the target's current rotation, since relative angle between the colour
points is never checked, only "are these colours near each other".

See PixelPulse_Document/03 - 開發管理/17 - 顏色群集觸發（旋轉不變偵測）.md for the
design rationale and the false-positive tradeoff this accepts.

顏色群集比對（「像素圖」）：容忍旋轉的偵測策略。跟樣板匹配（只容忍平移，不容忍
旋轉）、單點像素比對（只認一個固定座標）不同，這個策略記錄目標身上幾個關鍵顏色，
偵測時尋找「這些顏色在某處群聚在一起」的位置——不管目標現在轉到哪個角度，因為
從來不檢查顏色點之間的相對角度，只檢查「這些顏色是否彼此靠近」。

設計理由與可接受的誤判風險，詳見上述規劃筆記。
"""

from __future__ import annotations

import cv2
import numpy as np

from core.capture.screen import Region
from core.vision.match_result import Match

DEFAULT_TOLERANCE = 20
DEFAULT_MIN_MATCHES = 2
DEFAULT_CLUSTER_RADIUS = 15


def find_colour_cluster(
    frame: np.ndarray,
    region: Region,
    colours: list[tuple[int, int, int]],
    tolerance: int = DEFAULT_TOLERANCE,
    min_matches: int = DEFAULT_MIN_MATCHES,
    cluster_radius: int = DEFAULT_CLUSTER_RADIUS,
) -> Match | None:
    """Find the best spot where >= `min_matches` of `colours` cluster together.

    `frame` is BGR (as returned by ScreenCapture.grab); `colours` are RGB
    tuples. Returns the centroid of the best-scoring cluster in absolute
    screen coordinates, or None if no spot reaches `min_matches`.

    找出 >= `min_matches` 個 `colours` 群聚在一起的最佳位置。`frame` 為 BGR
    格式（如 ScreenCapture.grab 的回傳值），`colours` 為 RGB tuple 清單。
    回傳最佳群聚位置的中心點（螢幕絕對座標），若沒有位置達到 `min_matches`
    則回傳 None。
    """
    if not colours:
        return None

    kernel_size = max(1, 2 * cluster_radius + 1)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))

    vote_map = np.zeros(frame.shape[:2], dtype=np.uint8)
    for r, g, b in colours:
        target_bgr = np.array([b, g, r], dtype=np.int16)
        diff = np.abs(frame.astype(np.int16) - target_bgr)
        mask = np.all(diff <= tolerance, axis=2).astype(np.uint8)
        # "Nearby" (within cluster_radius), not just an exact-pixel hit --
        # dilating turns "this colour exists somewhere in this neighbourhood"
        # into a per-pixel indicator we can sum across colours.
        # 「附近」（cluster_radius 範圍內），而不只是精確命中該像素——用膨脹運算把
        # 「這個顏色出現在這個鄰域裡」變成每個像素都能加總的指標。
        nearby = cv2.dilate(mask, kernel)
        vote_map += nearby

    best_votes = int(vote_map.max())
    if best_votes < min_matches:
        return None

    hits = (vote_map == best_votes).astype(np.uint8)
    num_labels, _labels, _stats, centroids = cv2.connectedComponentsWithStats(hits, connectivity=8)
    if num_labels <= 1:
        return None

    # Label 0 is the background; pick the largest foreground blob at peak votes.
    # 標籤 0 是背景；在票數最高的區域裡取最大的一塊。
    areas = _stats[1:, cv2.CC_STAT_AREA]
    best_label = 1 + int(np.argmax(areas))
    cx, cy = centroids[best_label]

    return Match(
        x=region.left + int(round(cx)),
        y=region.top + int(round(cy)),
        confidence=best_votes / len(colours),
    )
