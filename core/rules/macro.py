"""Executes a MacroStep sequence (Phase 4): a rule's action can now be a
multi-step macro instead of a single click/key/type.

Steps that locate a target (`click`/`double_click` with `target` set, and
`wait_for`) poll the screen until the target appears or `timeout_ms` elapses,
then optionally retry, then either abort the whole macro or skip to the next
step depending on `on_timeout`.

執行 MacroStep 序列（Phase 4）：規則的動作現在可以是多步驟巨集，而不只是
單一次的點擊/按鍵/輸入文字。

需要定位目標的步驟（設定了 `target` 的 `click`/`double_click`，以及
`wait_for`）會持續輪詢畫面，直到目標出現或 `timeout_ms` 逾時，逾時後依
`retry_count` 重試，最後依 `on_timeout` 決定中止整個巨集還是跳到下一步。
"""

from __future__ import annotations

import logging
import time

from core.automation.backend import InputBackend
from core.capture.screen import Region, ScreenCapture
from core.rules.models import MacroStep
from core.vision.template_matching import find_target, load_template

logger = logging.getLogger("pixelpulse.macro")

POLL_INTERVAL_S = 0.1


class MacroStepTimeout(Exception):
    """A `target`-locating step didn't find its target within timeout_ms (after retries)."""


class MacroExecutor:
    """Runs a macro's steps in order against a shared capture/input backend.

    依序執行一個巨集的所有步驟，共用同一組畫面擷取/輸入後端。
    """

    def __init__(self, capture: ScreenCapture, input_backend: InputBackend) -> None:
        self._capture = capture
        self._input = input_backend

    def run(self, steps: list[MacroStep]) -> None:
        for index, step in enumerate(steps):
            if step.delay_before_ms:
                time.sleep(step.delay_before_ms / 1000)
            try:
                self._run_step_with_retry(step)
            except MacroStepTimeout:
                if step.on_timeout == "skip":
                    logger.warning("Macro step %d (%s) timed out; skipping.", index, step.kind)
                    continue
                raise

    def _run_step_with_retry(self, step: MacroStep) -> None:
        attempts = step.retry_count + 1
        for attempt in range(attempts):
            try:
                self._execute_once(step)
                return
            except MacroStepTimeout:
                if attempt < attempts - 1:
                    time.sleep(step.retry_delay_ms / 1000)
                    continue
                raise

    def _execute_once(self, step: MacroStep) -> None:
        if step.kind == "key":
            self._input.key_press(step.key or "")
            return
        if step.kind == "type":
            self._input.type_text(step.text or "")
            return
        if step.kind == "wait_for":
            self._locate(step)  # raises MacroStepTimeout if not found in time
            return
        if step.kind in ("click", "double_click"):
            x, y = self._resolve_coords(step)
            if step.kind == "click":
                self._input.click(x, y, button=step.button)
            else:
                self._input.double_click(x, y, button=step.button)
            return
        raise ValueError(f"Unknown macro step kind: {step.kind}")

    def _resolve_coords(self, step: MacroStep) -> tuple[int, int]:
        if step.target is None:
            if step.x is None or step.y is None:
                raise ValueError(f"Step '{step.kind}' needs either `target` or explicit x/y.")
            return step.x, step.y
        return self._locate(step)

    def _locate(self, step: MacroStep) -> tuple[int, int]:
        """Poll the screen for `step.target` until it appears or timeout_ms elapses.

        持續輪詢畫面尋找 `step.target`，直到出現或 `timeout_ms` 逾時。
        """
        region = Region(*step.roi) if step.roi else self._capture.full_screen_region(monitor_index=0)
        template = load_template(step.target)

        deadline = time.time() + step.timeout_ms / 1000
        while True:
            frame = self._capture.grab(region)
            match = find_target(frame, template, region, threshold=step.threshold)
            if match is not None:
                return match.x, match.y
            if time.time() >= deadline:
                raise MacroStepTimeout(f"Target not found within {step.timeout_ms}ms: {step.target}")
            time.sleep(POLL_INTERVAL_S)
