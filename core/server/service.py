"""Owns the rule set and the RuleEngine's lifecycle for the server layer.

Runs the (blocking, synchronous) RuleEngine.run_forever() loop in a
background thread so it doesn't block the FastAPI/asyncio event loop, and
forwards its events through a caller-supplied thread-safe sink.

Also owns a second, always-open ScreenCapture used by the rule editor's
region/point picker and "test match" preview -- those need to work while
the engine itself is stopped (the normal state while building a rule).

在伺服器層擁有規則清單與 RuleEngine 的生命週期。RuleEngine.run_forever()
是阻塞式的同步迴圈，因此放到背景執行緒執行，才不會卡住 FastAPI/asyncio
事件迴圈；引擎事件則透過呼叫端提供的 thread-safe sink 轉發出去。

另外維護一個獨立、常駐開啟的 ScreenCapture，供規則編輯器的框選/點選工具與
「測試比對」預覽使用 —— 這些功能在引擎停止時（建立規則時的正常狀態）也要能用。
"""

from __future__ import annotations

import base64
import logging
import os
import re
import threading
import uuid
from pathlib import Path
from typing import Callable

import cv2

from core.automation.killswitch import KillSwitch
from core.automation.pyautogui_backend import PyAutoGUIBackend
from core.capture.screen import Region, ScreenCapture
from core.rules.engine import RuleEngine
from core.rules.events import EngineEvent
from core.rules.loader import load_rules, save_rules
from core.rules.models import RuleConfig, TriggerConfig
from core.vision.match_result import Match
from core.vision.pixel_match import match_pixel, read_pixel_rgb
from core.vision.template_matching import find_target, load_template

logger = logging.getLogger("pixelpulse.server.service")


class RuleNotFoundError(KeyError):
    pass


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", name.strip()).strip("-").lower()
    return slug or "target"


# Phase 5 benchmarking (see Source_Code/benchmarks/) found real ~3x wall-clock
# speedup at 4 workers scanning 30 rules, with diminishing returns beyond
# that -- a reasonable default without over-provisioning threads/OS capture
# handles on machines with few rules.
# Phase 5 效能測試（見 Source_Code/benchmarks/）發現在 4 個工作執行緒、30 條
# 規則的情境下，實測約有 3 倍的實際加速，超過這個數字後報酬遞減——在規則數
# 不多的機器上，這是一個不會過度配置執行緒/OS 擷取控制代碼的合理預設值。
DEFAULT_MAX_WORKERS = min(4, os.cpu_count() or 1)


class EngineService:
    """Thread-safe-enough (single writer via WS handler) façade the server uses.

    伺服器層使用的門面類別，管理規則清單與引擎的啟動/停止。
    """

    def __init__(
        self,
        rules_path: str | Path,
        event_sink: Callable[[EngineEvent], None] | None = None,
        scan_interval_s: float = 0.2,
        targets_dir: str | Path = "targets",
        max_workers: int = DEFAULT_MAX_WORKERS,
    ) -> None:
        self._rules_path = Path(rules_path)
        self._rules: list[RuleConfig] = load_rules(self._rules_path) if self._rules_path.exists() else []
        self._event_sink = event_sink
        self._scan_interval_s = scan_interval_s
        self._targets_dir = Path(targets_dir)
        self._max_workers = max_workers

        self._engine: RuleEngine | None = None
        self._engine_capture: ScreenCapture | None = None
        self._thread: threading.Thread | None = None

        # Independent of the engine's own capture -- stays open for the
        # service's whole lifetime so the picker/preview work regardless of
        # whether the engine is running.
        self._tools_capture = ScreenCapture()

    # --- rules -----------------------------------------------------------

    def list_rules(self) -> list[RuleConfig]:
        return list(self._rules)

    def add_rule(self, rule: RuleConfig) -> list[RuleConfig]:
        self._rules.append(rule)
        self._persist()
        return self.list_rules()

    def delete_rule(self, name: str) -> list[RuleConfig]:
        before = len(self._rules)
        self._rules = [r for r in self._rules if r.name != name]
        if len(self._rules) == before:
            raise RuleNotFoundError(name)
        self._persist()
        return self.list_rules()

    def toggle_rule(self, name: str, enabled: bool) -> list[RuleConfig]:
        for i, rule in enumerate(self._rules):
            if rule.name == name:
                self._rules[i] = rule.model_copy(update={"enabled": enabled})
                self._persist()
                return self.list_rules()
        raise RuleNotFoundError(name)

    def reorder_rules(self, names: list[str]) -> list[RuleConfig]:
        """Reorder rules to match `names` exactly (used for drag-to-reorder in the GUI).

        依 `names` 的順序重新排列規則（供 GUI 拖曳排序使用），`names` 必須恰好
        涵蓋目前所有規則一次。
        """
        by_name = {r.name: r for r in self._rules}
        if set(names) != set(by_name):
            missing = set(by_name) - set(names)
            extra = set(names) - set(by_name)
            raise ValueError(f"reorder must list every rule exactly once (missing={missing}, extra={extra})")
        self._rules = [by_name[n] for n in names]
        self._persist()
        return self.list_rules()

    def _persist(self) -> None:
        save_rules(self._rules_path, self._rules)

    # --- picker / preview (engine need not be running) ---------------------

    def capture_crop(self, roi: tuple[int, int, int, int], name: str) -> tuple[str, str]:
        """Crop+save a fresh capture of `roi` as a template image.

        Returns (image_path relative to the working directory, base64-encoded
        PNG preview for the GUI to show a thumbnail without a second request).

        重新擷取並裁切 `roi`、存成樣板圖片。回傳（相對於工作目錄的圖片路徑，
        base64 編碼的 PNG 預覽圖，讓 GUI 不用再發一次請求就能顯示縮圖）。
        """
        left, top, width, height = roi
        frame = self._tools_capture.grab(Region(left, top, width, height))

        self._targets_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{_slugify(name)}-{uuid.uuid4().hex[:8]}.png"
        path = self._targets_dir / filename
        cv2.imwrite(str(path), frame)

        ok, buf = cv2.imencode(".png", frame)
        preview_b64 = base64.b64encode(buf.tobytes()).decode("ascii") if ok else ""
        return path.as_posix(), preview_b64

    def capture_pixel(self, x: int, y: int) -> tuple[int, int, int]:
        """Read the RGB colour at absolute screen coordinate (x, y).

        讀取螢幕絕對座標 (x, y) 上的 RGB 顏色。
        """
        frame = self._tools_capture.grab(Region(x, y, 1, 1))
        return read_pixel_rgb(frame, 0, 0)

    def preview_trigger(self, trigger: TriggerConfig) -> Match | None:
        """Run a single detection pass for a trigger that isn't saved as a rule yet.

        對還沒存成規則的觸發條件，跑一次性的偵測測試。
        """
        region = Region(*trigger.roi)
        frame = self._tools_capture.grab(region)

        if trigger.kind == "template":
            if not trigger.image:
                return None
            template = load_template(trigger.image)
            return find_target(frame, template, region, threshold=trigger.threshold)

        if trigger.kind == "pixel":
            hit = match_pixel(
                frame,
                trigger.pixel_x or 0,
                trigger.pixel_y or 0,
                trigger.target_rgb or (0, 0, 0),
                tolerance=trigger.tolerance,
            )
            if hit:
                x = region.left + (trigger.pixel_x or 0)
                y = region.top + (trigger.pixel_y or 0)
                return Match(x=x, y=y, confidence=1.0)
            return None

        raise ValueError(f"Unknown trigger kind: {trigger.kind}")

    # --- engine lifecycle --------------------------------------------------

    @property
    def is_running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def start(self) -> None:
        if self.is_running:
            logger.info("Engine already running; ignoring start request.")
            return

        self._engine_capture = ScreenCapture()
        self._engine = RuleEngine(
            rules=self._rules,
            capture=self._engine_capture,
            input_backend=PyAutoGUIBackend(),
            kill_switch=KillSwitch(),
            scan_interval_s=self._scan_interval_s,
            on_event=self._event_sink,
            max_workers=self._max_workers,
            capture_factory=ScreenCapture if self._max_workers > 1 else None,
        )
        self._thread = threading.Thread(target=self._engine.run_forever, daemon=True)
        self._thread.start()

    def stop(self, timeout_s: float = 5.0) -> None:
        if not self.is_running or self._engine is None:
            return
        self._engine.stop()
        self._thread.join(timeout=timeout_s)
        if self._engine_capture is not None:
            self._engine_capture.close()
        self._engine = None
        self._engine_capture = None
        self._thread = None

    def close(self) -> None:
        """Release the always-open picker/preview capture. Call on server shutdown."""
        self._tools_capture.close()
