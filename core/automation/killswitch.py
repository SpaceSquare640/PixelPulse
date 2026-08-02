"""Global emergency-stop hotkey.

This is a required safety mechanism, not an optional add-on -- see
PixelPulse_Document/03 - 開發管理/02 - 風險與挑戰.md. Listens for a hotkey
combo in the background and flips a flag the main loop checks every scan.

全域緊急停止熱鍵。這是必要的安全機制，不是可有可無的附加功能
（見 PixelPulse_Document/03 - 開發管理/02 - 風險與挑戰.md）。在背景監聽熱鍵組合，
主迴圈每次掃描都會檢查這個旗標。
"""

from __future__ import annotations

import threading

from pynput import keyboard

DEFAULT_HOTKEY = "<ctrl>+<alt>+q"


class KillSwitch:
    """監聽全域熱鍵，觸發後可用 `is_triggered()` 查詢是否該停止引擎。"""

    def __init__(self, hotkey: str = DEFAULT_HOTKEY) -> None:
        self._triggered = threading.Event()
        self._listener = keyboard.GlobalHotKeys({hotkey: self._trigger})

    def _trigger(self) -> None:
        self._triggered.set()

    def start(self) -> None:
        self._listener.start()

    def stop(self) -> None:
        self._listener.stop()

    def is_triggered(self) -> bool:
        return self._triggered.is_set()

    def reset(self) -> None:
        self._triggered.clear()
