"""WebSocket message protocol between the Electron/React GUI and the Python
core. Sketched in PixelPulse_Document/01 - 技術架構與語言選型.md.

Electron/React GUI 與 Python 核心之間的 WebSocket 訊息協定，對應
PixelPulse_Document/01 - 技術架構與語言選型.md 裡草擬的格式。
"""

from __future__ import annotations

from typing import Literal, Union

from pydantic import BaseModel, ConfigDict, Field

from core.rules.models import RuleConfig, TriggerConfig

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


class RuleReorderMessage(BaseModel):
    type: Literal["rule.reorder"] = "rule.reorder"
    names: list[str]


class RulePreviewMessage(BaseModel):
    """One-shot detection test against a not-yet-saved trigger, for the rule
    editor's "test match" button.

    針對還沒儲存的觸發條件做一次性偵測測試，供規則編輯器的「測試比對」按鈕使用。
    """

    type: Literal["rule.preview"] = "rule.preview"
    trigger: TriggerConfig


class CaptureCropMessage(BaseModel):
    """Crop and save a fresh capture of `roi` as a template image, for the
    region picker's result.

    針對 `roi` 重新擷取並裁切、存成樣板圖片 —— 供框選工具的結果使用。
    """

    type: Literal["capture.crop"] = "capture.crop"
    roi: tuple[int, int, int, int]
    name: str


class CapturePixelMessage(BaseModel):
    """Read the colour at a single screen point, for the point picker's result.

    讀取螢幕上單一座標點的顏色 —— 供點選工具的結果使用。
    """

    type: Literal["capture.pixel"] = "capture.pixel"
    x: int
    y: int


class CaptureImportMessage(BaseModel):
    """Copy an existing image file on disk into the targets folder as a
    template image -- the "browse for a file" alternative to the region
    picker, for when the user already has a reference image instead of
    wanting to crop one from the live screen.

    把磁碟上既有的圖片檔案複製進 targets 資料夾，當作樣板圖片 —— 這是框選工具
    以外的另一種做法，給已經有現成參考圖片、不需要從即時畫面裁切的使用者用。
    """

    type: Literal["capture.import"] = "capture.import"
    path: str
    name: str


ClientMessage = Union[
    RuleCreateMessage,
    RuleListRequest,
    RuleDeleteMessage,
    RuleToggleMessage,
    RuleReorderMessage,
    RulePreviewMessage,
    CaptureCropMessage,
    CapturePixelMessage,
    CaptureImportMessage,
    EngineStartMessage,
    EngineStopMessage,
    EngineStatusRequest,
]

_CLIENT_MESSAGE_TYPES: dict[str, type[BaseModel]] = {
    "rule.create": RuleCreateMessage,
    "rule.list": RuleListRequest,
    "rule.delete": RuleDeleteMessage,
    "rule.toggle": RuleToggleMessage,
    "rule.reorder": RuleReorderMessage,
    "rule.preview": RulePreviewMessage,
    "capture.crop": CaptureCropMessage,
    "capture.pixel": CapturePixelMessage,
    "capture.import": CaptureImportMessage,
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


class RulePreviewResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    type: Literal["rule.preview"] = "rule.preview"
    matched: bool
    x: int | None = None
    y: int | None = None
    confidence: float | None = None


class CaptureCropResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    type: Literal["capture.crop"] = "capture.crop"
    image_path: str = Field(alias="imagePath")
    preview_png_base64: str = Field(alias="previewPngBase64")
    roi: tuple[int, int, int, int]


class CapturePixelResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    type: Literal["capture.pixel"] = "capture.pixel"
    x: int
    y: int
    target_rgb: tuple[int, int, int] = Field(alias="targetRgb")


class CaptureImportResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    type: Literal["capture.import"] = "capture.import"
    image_path: str = Field(alias="imagePath")
    preview_png_base64: str = Field(alias="previewPngBase64")


class ErrorMessage(BaseModel):
    type: Literal["error"] = "error"
    message: str
