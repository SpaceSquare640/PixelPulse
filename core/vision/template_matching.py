"""Template matching: find a user-supplied image inside a captured frame.

This is the primary detection strategy described in
PixelPulse_Document/02 - 技術規劃/04 - 圖像辨識與座標定位.md.

Note: TM_CCOEFF_NORMED is undefined (0/0) over a flat, zero-variance
template or frame region -- OpenCV resolves this by returning a confidence
of 1.0, which can look like a false "perfect match". Warn users away from
solid-colour/low-detail target images in the rule editor (Phase 3).

樣板匹配：在擷取的畫面中尋找使用者提供的圖片。這是
PixelPulse_Document/02 - 技術規劃/04 - 圖像辨識與座標定位.md 中描述的主要偵測策略。

注意：當樣板或畫面區塊是「零變異數（純色）」時，TM_CCOEFF_NORMED 的計算式會是
0/0（未定義），OpenCV 會把這種情況的信心值設為 1.0，看起來像是「完美命中」但其實
是誤判。之後規則編輯器（Phase 3）應該對純色/低細節的目標圖片提出警告。
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from core.capture.screen import Region
from core.vision.match_result import Match

DEFAULT_THRESHOLD = 0.85
DEFAULT_MIN_DISTANCE = 10  # pixels, used to de-duplicate overlapping matches


def load_template(image_path: str | Path) -> np.ndarray:
    """Load a template image as a BGR array. Raises if the file doesn't exist.

    將樣板圖片載入為 BGR 陣列。若檔案不存在則拋出例外。
    """
    path = Path(image_path)
    template = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if template is None:
        raise FileNotFoundError(f"Could not read template image: {path}")
    return template


def find_target(
    frame: np.ndarray,
    template: np.ndarray,
    region: Region,
    threshold: float = DEFAULT_THRESHOLD,
) -> Match | None:
    """Return the best match above `threshold`, or None if nothing matched.

    `frame` must be the BGR image captured for `region` (frame.shape matches
    region.width/height), so the returned coordinates are absolute screen
    coordinates.

    回傳高於 `threshold` 的最佳匹配結果，若沒有匹配則回傳 None。
    `frame` 必須是針對 `region` 擷取的 BGR 影像（frame.shape 對應
    region.width/height），因此回傳的座標即為螢幕絕對座標。
    """
    th, tw = template.shape[:2]
    result = cv2.matchTemplate(frame, template, cv2.TM_CCOEFF_NORMED)
    _, max_val, _, max_loc = cv2.minMaxLoc(result)

    if max_val < threshold:
        return None

    center_x = region.left + max_loc[0] + tw // 2
    center_y = region.top + max_loc[1] + th // 2
    return Match(x=center_x, y=center_y, confidence=float(max_val))


def find_all_targets(
    frame: np.ndarray,
    template: np.ndarray,
    region: Region,
    threshold: float = DEFAULT_THRESHOLD,
    min_distance: int = DEFAULT_MIN_DISTANCE,
) -> list[Match]:
    """Return every non-overlapping match above `threshold`.

    Useful when the same target can appear multiple times on screen (e.g. a
    repeated button in a list). Overlapping detections of the same instance
    are collapsed with a simple non-max suppression pass.

    回傳所有互不重疊、且高於 `threshold` 的匹配結果。適用於同一個目標可能在
    畫面上出現多次的情境（例如列表裡重複的按鈕）。同一個目標的重疊偵測結果，
    會用簡單的非極大值抑制 (NMS) 去重。
    """
    th, tw = template.shape[:2]
    result = cv2.matchTemplate(frame, template, cv2.TM_CCOEFF_NORMED)
    ys, xs = np.where(result >= threshold)
    candidates = sorted(zip(xs, ys, result[ys, xs]), key=lambda c: -c[2])

    kept: list[tuple[int, int, float]] = []
    for x, y, score in candidates:
        # Skip candidates too close to an already-kept match (same instance).
        # 跳過離已保留匹配太近的候選點（視為同一個目標的重複偵測）。
        if all(abs(x - kx) > min_distance or abs(y - ky) > min_distance for kx, ky, _ in kept):
            kept.append((x, y, float(score)))

    return [
        Match(x=region.left + x + tw // 2, y=region.top + y + th // 2, confidence=score)
        for x, y, score in kept
    ]
