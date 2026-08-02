"""Owns the rule set and the RuleEngine's lifecycle for the server layer.

Runs the (blocking, synchronous) RuleEngine.run_forever() loop in a
background thread so it doesn't block the FastAPI/asyncio event loop, and
forwards its events through a caller-supplied thread-safe sink.

在伺服器層擁有規則清單與 RuleEngine 的生命週期。RuleEngine.run_forever()
是阻塞式的同步迴圈，因此放到背景執行緒執行，才不會卡住 FastAPI/asyncio
事件迴圈；引擎事件則透過呼叫端提供的 thread-safe sink 轉發出去。
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Callable

from core.automation.killswitch import KillSwitch
from core.automation.pyautogui_backend import PyAutoGUIBackend
from core.capture.screen import ScreenCapture
from core.rules.engine import RuleEngine
from core.rules.events import EngineEvent
from core.rules.loader import load_rules, save_rules
from core.rules.models import RuleConfig

logger = logging.getLogger("pixelpulse.server.service")


class RuleNotFoundError(KeyError):
    pass


class EngineService:
    """Thread-safe-enough (single writer via WS handler) façade the server uses.

    伺服器層使用的門面類別，管理規則清單與引擎的啟動/停止。
    """

    def __init__(
        self,
        rules_path: str | Path,
        event_sink: Callable[[EngineEvent], None] | None = None,
        scan_interval_s: float = 0.2,
    ) -> None:
        self._rules_path = Path(rules_path)
        self._rules: list[RuleConfig] = load_rules(self._rules_path) if self._rules_path.exists() else []
        self._event_sink = event_sink
        self._scan_interval_s = scan_interval_s

        self._engine: RuleEngine | None = None
        self._capture: ScreenCapture | None = None
        self._thread: threading.Thread | None = None

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

    def _persist(self) -> None:
        save_rules(self._rules_path, self._rules)

    # --- engine lifecycle --------------------------------------------------

    @property
    def is_running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def start(self) -> None:
        if self.is_running:
            logger.info("Engine already running; ignoring start request.")
            return

        self._capture = ScreenCapture()
        self._engine = RuleEngine(
            rules=self._rules,
            capture=self._capture,
            input_backend=PyAutoGUIBackend(),
            kill_switch=KillSwitch(),
            scan_interval_s=self._scan_interval_s,
            on_event=self._event_sink,
        )
        self._thread = threading.Thread(target=self._engine.run_forever, daemon=True)
        self._thread.start()

    def stop(self, timeout_s: float = 5.0) -> None:
        if not self.is_running or self._engine is None:
            return
        self._engine.stop()
        self._thread.join(timeout=timeout_s)
        if self._capture is not None:
            self._capture.close()
        self._engine = None
        self._capture = None
        self._thread = None
