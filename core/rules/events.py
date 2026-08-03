"""Structured events emitted by RuleEngine, for anything that wants to observe
it (the CLI just logs; the server layer forwards these to GUI clients over
WebSocket).

RuleEngine 發出的結構化事件。給任何想觀察引擎狀態的地方使用
（CLI 只是拿去記錄；伺服器層會把這些事件轉發給 GUI 用戶端）。
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Literal

EventType = Literal[
    "engine_started",
    "engine_stopped",
    "rule_matched",
    "rule_triggered",
    "rule_dry_run",
    "rule_error",
]


@dataclass(frozen=True)
class EngineEvent:
    type: EventType
    timestamp: float = field(default_factory=time.time)
    rule_name: str | None = None
    x: int | None = None
    y: int | None = None
    confidence: float | None = None
    message: str | None = None
    # Structured count for `engine_started`, so GUI clients can render it in
    # their own language instead of parsing an English sentence out of
    # `message`. (`message` stays free-text for cases like `rule_error` where
    # the content -- an exception string -- can't be translated anyway.)
    #
    # `engine_started` 事件的規則數量，讓 GUI 端能用自己的語言組句，而不必
    # 從 `message` 這個英文句子裡解析數字。（`message` 仍保留給像
    # `rule_error` 這種內容本來就無法翻譯的情況，例如例外訊息文字。）
    rule_count: int | None = None
