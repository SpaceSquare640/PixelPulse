"""Main scan loop: capture -> match -> cooldown check -> act.

This is the Phase 1 MVP loop described in
PixelPulse_Document/03 - 開發管理/01 - 開發階段規劃.md: no GUI yet, just a
rules.json file driving the engine from the command line.

Phase 5 added optional parallel *detection*: benchmarking (see
Source_Code/benchmarks/) showed cv2.matchTemplate already dominates all cost
as native OpenCV code, but it releases the GIL while running, so scanning
independent rules across a thread pool gives real multi-core speedup with no
custom C++. Detection runs on worker threads (each with its own
ScreenCapture, since mss.MSS() is not thread-safe to share); everything
after a match (events, actions, macros) always runs back on the single
calling thread, so the action/capture/macro-executor objects are never
touched from more than one thread.

主掃描迴圈：擷取畫面 -> 比對 -> 檢查冷卻 -> 執行動作。這是
PixelPulse_Document/03 - 開發管理/01 - 開發階段規劃.md 描述的 Phase 1 MVP 迴圈：
還沒有 GUI，純粹由 rules.json 檔案從命令列驅動引擎。

Phase 5 新增了可選的平行「偵測」：效能測試（見 Source_Code/benchmarks/）顯示
cv2.matchTemplate 本身（已經是原生 OpenCV 程式碼）主宰了幾乎全部耗時，但它
執行時會釋放 GIL，所以把獨立規則的掃描分散到執行緒池，不用寫任何 C++
就能拿到真正的多核心加速。偵測工作在背景執行緒上跑（每個執行緒各自擁有自己
的 ScreenCapture，因為 mss.MSS() 不能跨執行緒共用）；命中之後的所有事
（事件、動作、巨集）一律回到原本呼叫的那個執行緒執行，因此動作/擷取/巨集
執行器物件永遠不會被超過一個執行緒同時碰觸。
"""

from __future__ import annotations

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Callable

from core.automation.backend import InputBackend
from core.automation.killswitch import KillSwitch
from core.capture.screen import Region, ScreenCapture
from core.rules.events import EngineEvent
from core.rules.macro import MacroExecutor
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
    # Set once detection raises (e.g. a missing template image) so a single
    # bad rule can't crash the whole scan loop or spam retries every tick.
    # 一旦偵測拋出例外（例如樣板圖片不存在）就設為 True，避免單一壞掉的規則
    # 讓整個掃描迴圈崩潰，或每次掃描都重複失敗。
    is_broken: bool = False

    def region(self) -> Region:
        left, top, width, height = self.config.trigger.roi
        return Region(left, top, width, height)

    def is_on_cooldown(self, now: float) -> bool:
        elapsed_ms = (now - self.last_triggered_at) * 1000
        return elapsed_ms < self.config.cooldown_ms

    def has_reached_max_triggers(self) -> bool:
        limit = self.config.max_triggers
        return limit is not None and self.trigger_count >= limit


@dataclass
class _ScanOutcome:
    """Result of detection for one rule, handed from a worker thread back to
    the main thread for everything that follows (events, actions).

    單條規則的偵測結果，從背景執行緒交還給主執行緒處理後續的一切（事件、動作）。
    """

    match: Match | None = None
    error: Exception | None = None


class _CapturePool:
    """Lazily creates one ScreenCapture per thread that calls `get()`, and
    reuses it for that thread's lifetime -- mss.MSS() instances are not safe
    to share across threads. On Windows this isn't just a race-condition
    concern: the GDI device context mss opens is thread-affine, and calling
    ReleaseDC from a different thread than the one that created it fails
    outright (found by actually running this, not by inspection -- see
    Source_Code/benchmarks/ and the Phase 5 progress report). So closing
    must happen from each owning thread too, not just opening.

    每個呼叫 `get()` 的執行緒，第一次呼叫時才建立專屬的 ScreenCapture，之後
    在該執行緒的生命週期內重複使用 —— mss.MSS() 實例不能跨執行緒共用。在
    Windows 上這不只是競速風險：mss 開啟的 GDI device context 是跟執行緒綁定
    的，從建立它以外的執行緒呼叫 ReleaseDC 會直接失敗（這是實際跑過才發現的，
    不是光看程式碼能看出來的 —— 見 Source_Code/benchmarks/ 與 Phase 5 進度報告）。
    所以不只建立要在對的執行緒上做，關閉也是。
    """

    def __init__(self, factory: Callable[[], ScreenCapture]) -> None:
        self._factory = factory
        self._local = threading.local()
        self._instances: list[ScreenCapture] = []
        self._instances_lock = threading.Lock()

    def get(self) -> ScreenCapture:
        capture = getattr(self._local, "capture", None)
        if capture is None:
            capture = self._factory()
            self._local.capture = capture
            with self._instances_lock:
                self._instances.append(capture)
        return capture

    def close_current_thread_capture(self) -> None:
        """Close *this* thread's capture, if it has one. Must be called from
        each worker thread individually (see class docstring) -- RuleEngine
        does this via a barrier so every pool thread gets a turn.

        關閉「目前這個執行緒」自己的 capture（如果有的話）。必須從每個工作
        執行緒各自呼叫（原因見 class docstring）—— RuleEngine 用 barrier
        確保執行緒池裡每個執行緒都會輪到。
        """
        capture = getattr(self._local, "capture", None)
        if capture is not None:
            capture.close()
            self._local.capture = None


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
        on_event: Callable[[EngineEvent], None] | None = None,
        max_workers: int = 1,
        capture_factory: Callable[[], ScreenCapture] | None = None,
    ) -> None:
        self._states = [_RuleState(config=r) for r in rules if r.enabled]
        self._capture = capture
        self._input = input_backend
        self._kill_switch = kill_switch
        self._scan_interval_s = scan_interval_s
        self._on_event = on_event
        self._macro_executor = MacroExecutor(capture, input_backend)
        # Set from a different thread than run_forever() runs on when the
        # engine is driven by the server layer -- Event is thread-safe.
        # 引擎由伺服器層驅動時，stop() 可能從別的執行緒呼叫，Event 本身是 thread-safe。
        self._stop_event = threading.Event()

        # max_workers <= 1 (the default) keeps the exact single-threaded
        # behaviour of Phase 1-4 -- see the module docstring for why parallel
        # detection is safe (only _detect runs on worker threads).
        # max_workers <= 1（預設值）維持 Phase 1-4 完全相同的單執行緒行為 ——
        # 平行偵測為何安全，見本檔案最上方的說明（只有 _detect 會在背景執行緒跑）。
        if max_workers > 1 and capture_factory is None:
            raise ValueError("max_workers > 1 requires capture_factory (ScreenCapture instances can't be shared across threads).")
        self._max_workers = max_workers
        self._capture_factory = capture_factory

    def stop(self) -> None:
        """Ask a running `run_forever()` loop to stop at its next tick.

        請求正在執行的 `run_forever()` 迴圈在下一次迭代時停止。
        """
        self._stop_event.set()

    def run_forever(self) -> None:
        self._stop_event.clear()
        logger.info("Engine started with %d active rule(s), max_workers=%d.", len(self._states), self._max_workers)
        self._emit(EngineEvent(type="engine_started", rule_count=len(self._states)))
        if self._kill_switch:
            self._kill_switch.start()

        executor: ThreadPoolExecutor | None = None
        capture_pool: _CapturePool | None = None
        if self._max_workers > 1:
            executor = ThreadPoolExecutor(max_workers=self._max_workers, thread_name_prefix="pixelpulse-scan")
            capture_pool = _CapturePool(self._capture_factory)  # type: ignore[arg-type]

        try:
            while not self._stop_event.is_set():
                # Checked every tick so Ctrl+Alt+Q stops the engine immediately.
                # 每次迴圈都檢查，確保按下 Ctrl+Alt+Q 能立即停止引擎。
                if self._kill_switch and self._kill_switch.is_triggered():
                    logger.warning("Kill switch triggered. Stopping engine.")
                    break

                if executor is not None and capture_pool is not None:
                    # Detection fans out across worker threads; list() blocks
                    # until this tick's scans all finish before we react to
                    # any of them, so no rule state is ever touched by two
                    # threads at once across ticks either.
                    # 偵測分散到多個背景執行緒；list() 會等這一次掃描全部完成
                    # 才繼續處理結果，因此同一個規則狀態不會被兩個執行緒同時
                    # 存取，跨 tick 之間也是如此。
                    outcomes = list(executor.map(lambda s: self._detect_only(s, capture_pool.get()), self._states))
                    for state, outcome in zip(self._states, outcomes):
                        self._handle_outcome(state, outcome)
                else:
                    for state in self._states:
                        self._scan_rule(state)

                time.sleep(self._scan_interval_s)
        finally:
            if executor is not None and capture_pool is not None:
                self._close_capture_pool(executor, capture_pool)
            if executor is not None:
                executor.shutdown(wait=True)
            if self._kill_switch:
                self._kill_switch.stop()
            logger.info("Engine stopped.")
            self._emit(EngineEvent(type="engine_stopped"))

    def _close_capture_pool(self, executor: ThreadPoolExecutor, capture_pool: _CapturePool) -> None:
        """Make every worker thread close its own ScreenCapture, from that
        thread (see _CapturePool's docstring for why). A Barrier forces the
        pool to actually run max_workers tasks concurrently -- one per
        thread -- rather than letting one fast thread pick up several.

        讓執行緒池裡每個工作執行緒都從自己身上關閉自己的 ScreenCapture
        （原因見 _CapturePool 的 docstring）。用 Barrier 強迫執行緒池同時
        真的跑 max_workers 個工作——每個執行緒一個——而不是讓某個較快的
        執行緒一次領走好幾個。
        """
        barrier = threading.Barrier(self._max_workers)

        def _close_on_this_thread() -> None:
            barrier.wait()
            capture_pool.close_current_thread_capture()

        futures = [executor.submit(_close_on_this_thread) for _ in range(self._max_workers)]
        for future in futures:
            future.result()

    def _emit(self, event: EngineEvent) -> None:
        if self._on_event:
            self._on_event(event)

    def _scan_rule(self, state: _RuleState) -> None:
        """Sequential path (max_workers <= 1): detect and react on this same thread.

        單執行緒路徑（max_workers <= 1）：偵測與處理結果都在同一個執行緒上完成。
        """
        outcome = self._detect_only(state, self._capture)
        self._handle_outcome(state, outcome)

    def _detect_only(self, state: _RuleState, capture: ScreenCapture) -> _ScanOutcome:
        """Runs on whichever thread calls it (main thread, or a scan worker
        thread in parallel mode) -- must not touch anything other threads
        might also be touching, i.e. only `capture` and `state`'s read-only
        config.

        在呼叫它的那個執行緒上執行（主執行緒，或平行模式下的某個掃描工作
        執行緒）—— 不能碰到其他執行緒可能也在用的東西，只能用 `capture`
        跟 `state` 唯讀的設定內容。
        """
        now = time.time()
        # 冷卻中、已達觸發上限、或這條規則先前偵測時已出錯，就跳過。
        if state.is_broken or state.is_on_cooldown(now) or state.has_reached_max_triggers():
            return _ScanOutcome()

        try:
            match = self._detect(state, capture)
        except Exception as exc:  # noqa: BLE001 -- one bad rule must not take down the loop
            return _ScanOutcome(error=exc)
        return _ScanOutcome(match=match)

    def _handle_outcome(self, state: _RuleState, outcome: _ScanOutcome) -> None:
        """Always runs on the single calling thread of run_forever() -- safe
        to touch self._capture / self._macro_executor / self._input here.

        永遠只在 run_forever() 呼叫端所在的那一個執行緒上執行 —— 在這裡碰
        self._capture / self._macro_executor / self._input 是安全的。
        """
        if outcome.error is not None:
            logger.error("Rule '%s' failed during detection; disabling it for this run: %s", state.config.name, outcome.error)
            state.is_broken = True
            self._emit(EngineEvent(type="rule_error", rule_name=state.config.name, message=str(outcome.error)))
            return

        match = outcome.match
        if match is None:
            return

        now = time.time()
        logger.info(
            "Rule '%s' matched at (%d, %d) confidence=%.3f",
            state.config.name,
            match.x,
            match.y,
            match.confidence,
        )
        self._emit(
            EngineEvent(
                type="rule_matched",
                rule_name=state.config.name,
                x=match.x,
                y=match.y,
                confidence=match.confidence,
            )
        )

        if state.config.dry_run:
            # Dry run: log the hit but don't actually click/type anything.
            # Dry run 模式：只記錄命中，不真正執行點擊/輸入。
            logger.info("Dry run mode: skipping action for rule '%s'.", state.config.name)
            self._emit(EngineEvent(type="rule_dry_run", rule_name=state.config.name, x=match.x, y=match.y))
        else:
            try:
                self._act(state, match)
            except Exception as exc:  # noqa: BLE001 -- a failed action (e.g. a macro step timeout) must not crash the loop
                # Unlike a detection failure, this is not marked is_broken: a
                # macro step timing out once (e.g. the next screen hadn't
                # loaded yet) doesn't mean it will fail every time, so the
                # rule is allowed to try again after its normal cooldown.
                # 跟偵測失敗不同，這裡不會設定 is_broken：巨集某一步這次逾時
                # （例如下一個畫面還沒載入完成），不代表下次一定還會失敗，
                # 所以規則在正常冷卻時間過後仍會再嘗試一次。
                logger.exception("Rule '%s' failed while executing its action.", state.config.name)
                self._emit(EngineEvent(type="rule_error", rule_name=state.config.name, message=str(exc)))
            else:
                self._emit(EngineEvent(type="rule_triggered", rule_name=state.config.name, x=match.x, y=match.y))

        state.last_triggered_at = now
        state.trigger_count += 1

    def _detect(self, state: _RuleState, capture: ScreenCapture) -> Match | None:
        """Run the trigger's detection strategy against a fresh capture of its ROI.

        針對規則的 ROI 重新擷取畫面，並執行對應的偵測策略（樣板匹配或像素比對）。
        """
        trigger = state.config.trigger
        region = state.region()
        frame = capture.grab(region)

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
        elif action.kind == "macro":
            self._macro_executor.run(action.steps or [])
        else:
            raise ValueError(f"Unknown action kind: {action.kind}")
