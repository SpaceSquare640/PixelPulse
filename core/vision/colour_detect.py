"""Auto-detect a handful of representative key colours from an image, for
the "像素圖" (Pixel Map / colour_pattern) trigger's setup flow.

Uses k-means colour quantization (already available via OpenCV, no new
dependency) to find the `max_colours` most prominent colours, then reports
each one's centroid offset from the image's own center -- purely to size a
sensible default cluster-search radius later, never checked at detection
time (see core/vision/colour_pattern.py for why).

自動從一張圖片偵測幾個代表性的關鍵顏色，供「像素圖」（colour_pattern）觸發條件
的設定流程使用。用 OpenCV 內建的 k-means 色彩量化（不需要新套件）找出
`max_colours` 個最主要的顏色，並回報每個顏色像素相對於圖片中心的重心偏移量
——這只用來估計預設的群聚搜尋半徑，偵測時不會拿來比對（原因見
core/vision/colour_pattern.py）。
"""

from __future__ import annotations

import cv2
import numpy as np

DEFAULT_MAX_COLOURS = 5


def detect_key_colours(
    image: np.ndarray, max_colours: int = DEFAULT_MAX_COLOURS
) -> list[tuple[tuple[int, int, int], int, int]]:
    """Return up to `max_colours` (rgb, offset_x, offset_y) tuples, sorted by
    how much of the image each colour covers (largest first).

    `image` is BGR (as read by cv2.imread / ScreenCapture.grab).

    回傳最多 `max_colours` 個 (rgb, offset_x, offset_y) tuple，依該顏色在
    圖片中佔比由大到小排序。`image` 為 BGR 格式。
    """
    h, w = image.shape[:2]
    if h == 0 or w == 0:
        return []

    pixels = image.reshape(-1, 3).astype(np.float32)
    k = max(1, min(max_colours, len(np.unique(pixels, axis=0))))

    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _compactness, labels, centers = cv2.kmeans(pixels, k, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
    labels = labels.flatten()

    ys, xs = np.mgrid[0:h, 0:w]
    xs = xs.flatten()
    ys = ys.flatten()
    cx, cy = w / 2, h / 2

    results: list[tuple[tuple[int, int, int], int, int, int]] = []
    for cluster_id in range(k):
        mask = labels == cluster_id
        count = int(mask.sum())
        if count == 0:
            continue
        b, g, r = centers[cluster_id]
        offset_x = int(round(xs[mask].mean() - cx))
        offset_y = int(round(ys[mask].mean() - cy))
        results.append(((int(r), int(g), int(b)), offset_x, offset_y, count))

    results.sort(key=lambda item: -item[3])
    return [(rgb, ox, oy) for rgb, ox, oy, _count in results[:max_colours]]
