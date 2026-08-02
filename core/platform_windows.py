"""Windows-specific setup.

Declaring the process as DPI-aware keeps the coordinate system used by
screen capture consistent with the one used by mouse/keyboard simulation.
Without this, a monitor scaled to 125%/150% causes matched coordinates to
drift from the real click target.
See PixelPulse_Document/02 - 技術規劃/03 - 自動點擊與按鍵模擬.md.

Windows 專屬設定。把行程宣告為 DPI-aware，能讓螢幕擷取所用的座標系統
與滑鼠/鍵盤模擬所用的座標系統一致。若不這麼做，顯示器縮放為 125%/150% 時，
匹配到的座標會跟實際點擊位置產生偏差。
"""

from __future__ import annotations

import ctypes
import logging
import sys

logger = logging.getLogger("pixelpulse.platform")

PROCESS_PER_MONITOR_DPI_AWARE = 2


def enable_dpi_awareness() -> None:
    """No-op outside Windows. On Windows, opts into Per-Monitor V2 DPI awareness.

    非 Windows 平台不做任何事。在 Windows 上，啟用 Per-Monitor V2 DPI 感知模式。
    """
    if sys.platform != "win32":
        return
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(PROCESS_PER_MONITOR_DPI_AWARE)
    except (AttributeError, OSError):
        logger.warning("Could not set per-monitor DPI awareness; falling back to system default.")
