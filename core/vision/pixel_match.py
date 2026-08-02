"""Single-pixel colour matching: the lightest-weight detection strategy.

Useful for fixed-position indicators (e.g. a status light) where checking
one coordinate's RGB value is enough, instead of a full template match.

單點像素顏色比對：最輕量的偵測策略。適用於固定位置的指示器（例如狀態燈），
只需檢查單一座標的 RGB 值，不需要整張圖的樣板匹配。
"""

from __future__ import annotations

import numpy as np

DEFAULT_TOLERANCE = 10  # per-channel tolerance, to absorb anti-aliasing/compression noise


def match_pixel(
    frame: np.ndarray,
    x: int,
    y: int,
    target_rgb: tuple[int, int, int],
    tolerance: int = DEFAULT_TOLERANCE,
) -> bool:
    """Check whether the pixel at (x, y) is within `tolerance` of `target_rgb`.

    `frame` is expected to be BGR (as returned by ScreenCapture.grab), and
    (x, y) are coordinates relative to that frame, not absolute screen
    coordinates.

    檢查座標 (x, y) 上的像素是否與 `target_rgb` 相差在 `tolerance` 容許範圍內。
    `frame` 應為 BGR 格式（如 ScreenCapture.grab 的回傳值），且 (x, y) 是相對於
    該畫面的座標，不是螢幕絕對座標。
    """
    b, g, r = frame[y, x][:3]
    pixel_rgb = np.array([r, g, b], dtype=int)
    target = np.array(target_rgb, dtype=int)
    return bool(np.all(np.abs(pixel_rgb - target) <= tolerance))
