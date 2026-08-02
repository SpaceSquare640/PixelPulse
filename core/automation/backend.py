"""Pluggable input backend interface.

Kept as a Protocol so the concrete implementation can be swapped per rule
(e.g. plain PyAutoGUI for regular apps vs. a SendInput-based backend for
games/DirectInput targets) without touching the rule engine.
See PixelPulse_Document/02 - 技術規劃/03 - 自動點擊與按鍵模擬.md.

可抽換的輸入後端介面。用 Protocol 定義是為了讓實際實作可以依規則抽換
（例如一般應用程式用 PyAutoGUI、遊戲/DirectInput 目標改用 SendInput 後端），
而不需要更動規則引擎本身。
"""

from __future__ import annotations

from typing import Protocol


class InputBackend(Protocol):
    """輸入後端須實作的動作介面：點擊、雙擊、按鍵、輸入文字。"""

    def click(self, x: int, y: int, button: str = "left") -> None: ...

    def double_click(self, x: int, y: int, button: str = "left") -> None: ...

    def key_press(self, key: str) -> None: ...

    def type_text(self, text: str) -> None: ...
