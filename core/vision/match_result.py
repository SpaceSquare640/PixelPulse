from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Match:
    """A single detection result, in absolute screen coordinates.

    單次偵測結果，座標為螢幕絕對座標。
    """

    x: int
    y: int
    confidence: float
