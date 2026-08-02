"""WebSocket message protocol between the Electron/React GUI and the Python
core. Sketched in PixelPulse_Document/01 - 技術架構與語言選型.md.

Electron/React GUI 與 Python 核心之間的 WebSocket 訊息協定，對應
PixelPulse_Document/01 - 技術架構與語言選型.md 裡草擬的格式。
"""

from __future__ import annotations

from typing import Literal, Union

from pydantic import BaseModel, ConfigDict, Field

from core.rules.models import RuleConfig

# --- Client -> server -------------------------------------------------------


class RuleCreateMessage(BaseModel):
    type: Literal["rule.create"] = "rule.create"
    payload: RuleConfig


class RuleListRequest(BaseModel):
    type: Literal["rule.list"] = "rule.list"


class RuleDeleteMessage(BaseModel):
    type: Literal["rule.delete"] = "rule.delete"
    name: str


class RuleToggleMessage(BaseModel):
    type: Literal["rule.toggle"] = "rule.toggle"
    name: str
    enabled: bool


class EngineStartMessage(BaseModel):
    type: Literal["engine.start"] = "engine.start"


class EngineStopMessage(BaseModel):
    type: Literal["engine.stop"] = "engine.stop"


class EngineStatusRequest(BaseModel):
    type: Literal["engine.status"] = "engine.status"


ClientMessage = Union[
    RuleCreateMessage,
    RuleListRequest,
    RuleDeleteMessage,
    RuleToggleMessage,
    EngineStartMessage,
    EngineStopMessage,
    EngineStatusRequest,
]

_CLIENT_MESSAGE_TYPES: dict[str, type[BaseModel]] = {
    "rule.create": RuleCreateMessage,
    "rule.list": RuleListRequest,
    "rule.delete": RuleDeleteMessage,
    "rule.toggle": RuleToggleMessage,
    "engine.start": EngineStartMessage,
    "engine.stop": EngineStopMessage,
    "engine.status": EngineStatusRequest,
}


def parse_client_message(raw: dict) -> ClientMessage:
    """Validate a raw JSON dict into the matching ClientMessage type.

    把原始 JSON dict 驗證並轉成對應的 ClientMessage 型別。
    """
    msg_type = raw.get("type")
    model = _CLIENT_MESSAGE_TYPES.get(msg_type)  # type: ignore[arg-type]
    if model is None:
        raise ValueError(f"Unknown message type: {msg_type!r}")
    return model.model_validate(raw)


# --- Server -> client --------------------------------------------------------


class RuleListResponse(BaseModel):
    type: Literal["rule.list"] = "rule.list"
    rules: list[RuleConfig]


class EngineStatusResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    type: Literal["engine.status"] = "engine.status"
    running: bool
    rule_count: int = Field(alias="ruleCount")


class EngineEventMessage(BaseModel):
    type: Literal["engine.event"] = "engine.event"
    event: dict


class ErrorMessage(BaseModel):
    type: Literal["error"] = "error"
    message: str
