"""Rule configuration schema.

Mirrors the JSON shape sketched in
PixelPulse_Document/02 - 技術規劃/01 - 技術架構與語言選型.md, validated with
Pydantic so a malformed rules.json fails fast with a clear error instead of
crashing deep inside the scan loop.

規則設定檔的結構定義。對應
PixelPulse_Document/02 - 技術規劃/01 - 技術架構與語言選型.md 中草擬的 JSON 格式，
用 Pydantic 驗證，讓格式錯誤的 rules.json 可以及早失敗並給出清楚錯誤訊息，
而不是在掃描迴圈深處才出錯。
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

RoiTuple = tuple[int, int, int, int]  # (left, top, width, height) / 左、上、寬、高


class TriggerConfig(BaseModel):
    """觸發條件設定：可以是樣板匹配 (template) 或像素比對 (pixel)。"""

    model_config = ConfigDict(populate_by_name=True)

    kind: Literal["template", "pixel"]
    roi: RoiTuple

    # template trigger / 樣板匹配用
    image: str | None = None
    threshold: float = 0.85

    # pixel trigger: (x, y) relative to roi's top-left corner
    # 像素比對用：(x, y) 為相對於 roi 左上角的座標
    pixel_x: int | None = Field(default=None, alias="pixelX")
    pixel_y: int | None = Field(default=None, alias="pixelY")
    target_rgb: tuple[int, int, int] | None = Field(default=None, alias="targetRgb")
    tolerance: int = 10


class MacroStep(BaseModel):
    """One step of a multi-step action (Phase 4). See core/rules/macro.py for
    execution semantics.

    多步驟動作（巨集，Phase 4）裡的其中一步。執行邏輯見 core/rules/macro.py。
    """

    model_config = ConfigDict(populate_by_name=True)

    kind: Literal["click", "double_click", "key", "type", "wait_for"]

    # click / double_click / wait_for: locate `target` via template match
    # within `roi` (defaults to the whole virtual desktop if omitted).
    # click / double_click / wait_for：在 `roi` 範圍內（未指定則預設整個虛擬桌面）
    # 用樣板匹配找出 `target` 的位置。
    target: str | None = None
    roi: RoiTuple | None = None
    threshold: float = 0.85

    # click / double_click fallback when `target` is not set: click a fixed
    # absolute screen coordinate instead of finding one.
    # click / double_click 在沒有設定 `target` 時的備援：直接點擊固定的絕對座標。
    x: int | None = None
    y: int | None = None
    button: str = "left"

    # key / type
    key: str | None = None
    text: str | None = None

    # timing / retry -- 時間與重試設定
    delay_before_ms: int = Field(default=0, alias="delayBeforeMs")
    timeout_ms: int = Field(default=5000, alias="timeoutMs")
    on_timeout: Literal["abort", "skip"] = Field(default="abort", alias="onTimeout")
    retry_count: int = Field(default=0, alias="retryCount")
    retry_delay_ms: int = Field(default=500, alias="retryDelayMs")


class ActionConfig(BaseModel):
    """命中觸發條件後要執行的動作。"""

    model_config = ConfigDict(populate_by_name=True)

    kind: Literal["click", "double_click", "key", "type", "macro"]
    button: str = "left"
    key: str | None = None
    text: str | None = None
    # Only set when kind == "macro" -- see MacroStep / core/rules/macro.py.
    # 只有 kind == "macro" 時才會用到 —— 見 MacroStep / core/rules/macro.py。
    steps: list[MacroStep] | None = None


class RuleConfig(BaseModel):
    """一條完整規則：觸發條件 + 動作 + 冷卻/安全參數。"""

    model_config = ConfigDict(populate_by_name=True)

    name: str
    trigger: TriggerConfig
    action: ActionConfig
    cooldown_ms: int = Field(default=1000, alias="cooldownMs")
    max_triggers: int | None = Field(default=None, alias="maxTriggers")
    # New rules default to dry-run (log only, no action) until confirmed stable.
    # 新規則預設為 dry-run（只記錄不執行動作），確認辨識穩定後再手動關閉。
    dry_run: bool = Field(default=True, alias="dryRun")
    enabled: bool = True
