"""Default input backend, backed by PyAutoGUI.

PyAutoGUI's built-in FAILSAFE (moving the mouse to a screen corner aborts
the program) is left enabled as a secondary safety net alongside
KillSwitch. See PixelPulse_Document/02 - 技術規劃/03 - 自動點擊與按鍵模擬.md.

預設的輸入後端，底層使用 PyAutoGUI。PyAutoGUI 內建的 FAILSAFE
（把滑鼠移到螢幕角落會強制中止程式）維持開啟，作為 KillSwitch 之外的
第二道安全機制。
"""

from __future__ import annotations

import pyautogui

pyautogui.FAILSAFE = True


class PyAutoGUIBackend:
    """`InputBackend` 的預設實作，直接呼叫 PyAutoGUI。"""

    def click(self, x: int, y: int, button: str = "left") -> None:
        pyautogui.click(x=x, y=y, button=button)

    def double_click(self, x: int, y: int, button: str = "left") -> None:
        pyautogui.doubleClick(x=x, y=y, button=button)

    def key_press(self, key: str) -> None:
        pyautogui.press(key)

    def type_text(self, text: str) -> None:
        pyautogui.typewrite(text, interval=0.03)
