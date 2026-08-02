"""Screen capture backed by mss.

Only grabs the requested region (ROI) instead of the full screen, since
scanning a smaller area is both faster and less prone to false positives.
See PixelPulse_Document/02 - 技術規劃/04 - 圖像辨識與座標定位.md.

以 mss 實作的螢幕擷取。只擷取指定的 ROI（感興趣區域）而非整個螢幕，
因為掃描較小範圍既更快、也更不容易誤判。
"""

from __future__ import annotations

from dataclasses import dataclass

import mss
import numpy as np


@dataclass(frozen=True)
class Region:
    """A rectangular region in absolute screen coordinates.

    以螢幕絕對座標表示的矩形區域。
    """

    left: int
    top: int
    width: int
    height: int

    def to_mss_dict(self) -> dict:
        return {"left": self.left, "top": self.top, "width": self.width, "height": self.height}


class ScreenCapture:
    """Thin wrapper around mss for grabbing a region as a BGR NumPy array.

    包裝 mss，將指定區域擷取為 BGR NumPy 陣列的輕量類別。
    """

    def __init__(self) -> None:
        self._sct = mss.MSS()

    def grab(self, region: Region) -> np.ndarray:
        """Return the region as a BGR (no alpha) NumPy array, ready for OpenCV.

        將指定區域回傳為 BGR（不含 alpha 通道）NumPy 陣列，可直接交給 OpenCV 使用。
        """
        raw = self._sct.grab(region.to_mss_dict())
        # mss returns BGRA; drop the alpha channel for OpenCV compatibility.
        # mss 回傳的是 BGRA，這裡去掉 alpha 通道以相容 OpenCV。
        frame = np.array(raw)
        return frame[:, :, :3]

    def full_screen_region(self, monitor_index: int = 1) -> Region:
        """Region covering an entire monitor. Index 0 is "all monitors combined".

        涵蓋整個顯示器的區域。索引 0 代表「所有顯示器合併」。
        """
        monitor = self._sct.monitors[monitor_index]
        return Region(monitor["left"], monitor["top"], monitor["width"], monitor["height"])

    def close(self) -> None:
        self._sct.close()

    def __enter__(self) -> "ScreenCapture":
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()
