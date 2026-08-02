"""Main scan loop: capture -> match -> cooldown check -> act.

This is the Phase 1 MVP loop described in
PixelPulse_Document/03 - 開發管理/01 - 開發階段規劃.md: no GUI yet, just a
rules.json file driving the engine from the command line.

主掃描迴圈：擷取畫面 -> 比對 -> 檢查冷卻 -> 執行動作。這是
PixelPulse_Document/03 - 開發管理/01 - 開發階段規劃.md 描述的 Phase 1 MVP 迴圈：
還沒有 GUI，純粹由 rules.json 檔案從命令列驅動引擎。
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

from core.automation.backend import InputBackend
from core.automation.killswitch import KillSwitch
from core.capture.screen import Region, ScreenCapture
from core.rules.models import RuleConfig
from core.vision.match_result import Match
from core.vision.pixel_match import match_pixel
from core.vision.template_matching import find_target, load_template

logger = logging.getLogger("pixelpulse.engine")


@dataclass
class _RuleState:
    """Runtime state for one rule: last trigger time, trigger count, cached template.

    單條規則的執行期狀態：上次觸發時間、已觸發次數、快取的樣板圖片。
    """

    config: RuleConfig
    last_triggered_at: float = 0.0
    trigger_count: int = 0
    template_cache: object | None = field(default=None, repr=False)

    def region(self) -> Region:
        left, top, width, height = self.config.trigger.roi
        return Region(left, top, width, height)

    def is_on_cooldown(self, now: float) -> bool:
        elapsed_ms = (now - self.last_triggered_at) * 1000
        return elapsed_ms < self.config.cooldown_ms

    def has_reached_max_triggers(self) -> bool:
        limit = self.config.max_triggers
        return limit is not None and self.trigger_count >= limit


class RuleEngine:
    """Loads a set of rules and repeatedly scans/triggers them until stopped.

    載入一組規則，並重複掃描、觸發，直到被停止為止。
    """

    def __init__(
        self,
        rules: list[RuleConfig],
        capture: ScreenCapture,
        input_backend: InputBackend,
        kill_switch: KillSwitch | None = None,
        scan_interval_s: float = 0.2,
    ) -> None:
        self._states = [_RuleState(config=r) for r in rules if r.enabled]
        self._capture = capture
        self._input = input_backend
        self._kill_switch = kill_switch
        self._scan_interval_s = scan_interval_s

    def run_forever(self) -> None:
        logger.info("Engine started with %d active rule(s).", len(self._states))
        if self._kill_switch:
            self._kill_switch.start()

        try:
            while True:
                # Checked every tick so Ctrl+Alt+Q stops the engine immediately.
                # 每次迴圈都檢查，確保按下 Ctrl+Alt+Q 能立即停止引擎。
                if self._kill_switch and self._kill_switch.is_triggered():
                    logger.warning("Kill switch triggered. Stopping engine.")
                    break

                for state in self._states:
                    self._scan_rule(state)

                time.sleep(self._scan_interval_s)
        finally:
            if self._kill_switch:
                self._kill_switch.stop()

    def _scan_rule(self, state: _RuleState) -> None:
        now = time.time()
        # 冷卻中或已達觸發上限就跳過，避免同一規則被連續狂觸發。
        if state.is_on_cooldown(now) or state.has_reached_max_triggers():
            return

        match = self._detect(state)
        if match is None:
            return

        logger.info(
            "Rule '%s' matched at (%d, %d) confidence=%.3f",
            state.config.name,
            match.x,
            match.y,
            match.confidence,
        )

        if state.config.dry_run:
            # Dry run: log the hit but don't actually click/type anything.
            # Dry run 模式：只記錄命中，不真正執行點擊/輸入。
            logger.info("Dry run mode: skipping action for rule '%s'.", state.config.name)
        else:
            self._act(state, match)

        state.last_triggered_at = now
        state.trigger_count += 1

    def _detect(self, state: _RuleState) -> Match | None:
        """Run the trigger's detection strategy against a fresh capture of its ROI.

        針對規則的 ROI 重新擷取畫面，並執行對應的偵測策略（樣板匹配或像素比對）。
        """
        trigger = state.config.trigger
        region = state.region()
        frame = self._capture.grab(region)

        if trigger.kind == "template":
            # Load once per rule, not once per scan -- disk I/O is the bottleneck here.
            # 每條規則只載入一次樣板圖片，而非每次掃描都讀，避免磁碟 I/O 成為瓶頸。
            if state.template_cache is None:
                state.template_cache = load_template(trigger.image)
            return find_target(frame, state.template_cache, region, threshold=trigger.threshold)

        if trigger.kind == "pixel":
            hit = match_pixel(
                frame,
                trigger.pixel_x or 0,
                trigger.pixel_y or 0,
                trigger.target_rgb or (0, 0, 0),
                tolerance=trigger.tolerance,
            )
            if hit:
                return Match(x=region.left + (trigger.pixel_x or 0), y=region.top + (trigger.pixel_y or 0), confidence=1.0)
            return None

        raise ValueError(f"Unknown trigger kind: {trigger.kind}")

    def _act(self, state: _RuleState, match: Match) -> None:
        """Dispatch the rule's action at the matched screen coordinates.

        在匹配到的螢幕座標上，執行規則設定的動作。
        """
        action = state.config.action
        x, y = match.x, match.y

        if action.kind == "click":
            self._input.click(x, y, button=action.button)
        elif action.kind == "double_click":
            self._input.double_click(x, y, button=action.button)
        elif action.kind == "key":
            self._input.key_press(action.key or "")
        elif action.kind == "type":
            self._input.type_text(action.text or "")
        else:
            raise ValueError(f"Unknown action kind: {action.kind}")
