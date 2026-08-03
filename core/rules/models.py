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


class ColourPoint(BaseModel):
    """One key colour in a `colour_pattern` trigger's colour set.

    `offsetX`/`offsetY` only describe the rough size of the original capture
    (used to size the default cluster search radius) -- they are NOT checked
    against each other at detection time, since the whole point of this
    trigger is to tolerate the target rotating.

    「像素圖」觸發條件裡的其中一個關鍵顏色。`offsetX`/`offsetY` 只用來描述原始
    截圖的大致範圍（決定預設的群聚搜尋半徑），偵測時**不會**拿來互相比較——
    因為這個觸發條件的重點就是要容忍目標旋轉。
    """

    model_config = ConfigDict(populate_by_name=True)

    rgb: tuple[int, int, int]
    offset_x: int = Field(default=0, alias="offsetX")
    offset_y: int = Field(default=0, alias="offsetY")


class TriggerConfig(BaseModel):
    """觸發條件設定：樣板匹配 (template)、像素比對 (pixel) 或像素圖 (colour_pattern)。"""

    model_config = ConfigDict(populate_by_name=True)

    kind: Literal["template", "pixel", "colour_pattern"]
    # None means "scan the whole (virtual) screen" instead of a fixed region --
    # slower per scan, but the target can appear anywhere rather than just in
    # a region picked in advance.
    # None 代表「掃描整個（虛擬）螢幕」而非固定區域 —— 每次掃描較慢，但目標可以
    # 出現在畫面任何地方，而不只是事先框選好的區域。
    roi: RoiTuple | None = None

    # template trigger / 樣板匹配用
    image: str | None = None
    threshold: float = 0.85

    # pixel trigger: (x, y) relative to roi's top-left corner
    # 像素比對用：(x, y) 為相對於 roi 左上角的座標
    pixel_x: int | None = Field(default=None, alias="pixelX")
    pixel_y: int | None = Field(default=None, alias="pixelY")
    target_rgb: tuple[int, int, int] | None = Field(default=None, alias="targetRgb")
    tolerance: int = 10

    # colour_pattern trigger ("像素圖"): a handful of key colours that must
    # appear clustered together somewhere in the scanned region, regardless
    # of the target's rotation. See
    # PixelPulse_Document/03 - 開發管理/17 - 顏色群集觸發（旋轉不變偵測）.md
    # 「像素圖」觸發：幾個關鍵顏色必須在掃描範圍內的某處群聚出現，不管目標
    # 旋轉到哪個角度。詳見上述規劃筆記。
    colours: list[ColourPoint] | None = None
    min_matches: int = Field(default=2, alias="minMatches")
    cluster_radius: int = Field(default=15, alias="clusterRadius")


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
    # When true, cooldown_ms is ignored and the rule instead fires once on
    # each false->true transition (target appears), then stays silent until
    # the target disappears and reappears -- rather than repeatedly firing
    # on every scan tick the target stays visible. See RuleEngine._handle_outcome.
    # 為 true 時忽略 cooldown_ms，改成只在「未命中 -> 命中」的那一刻觸發一次
    # （目標剛出現時），之後保持沉默，直到目標先消失、再重新出現才會再觸發一次
    # ——而不是目標持續可見時每次掃描都重複觸發。詳見 RuleEngine._handle_outcome。
    once_per_appearance: bool = Field(default=False, alias="oncePerAppearance")
    # New rules default to dry-run (log only, no action) until confirmed stable.
    # 新規則預設為 dry-run（只記錄不執行動作），確認辨識穩定後再手動關閉。
    dry_run: bool = Field(default=True, alias="dryRun")
    enabled: bool = True
