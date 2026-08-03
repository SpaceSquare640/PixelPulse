"""FastAPI + WebSocket server wrapping the Phase 1 core for the Electron GUI.

Binds to 127.0.0.1 only (see core/server/__main__.py) -- this is a local
control channel for the GUI on the same machine, not a network service.
See PixelPulse_Document/01 - 技術架構與語言選型.md.

包裝 Phase 1 核心、供 Electron GUI 使用的 FastAPI + WebSocket 伺服器。
只綁定 127.0.0.1（見 core/server/__main__.py）—— 這是給同一台機器上的 GUI
用的本機控制通道，不是對外的網路服務。
"""

from __future__ import annotations

import asyncio
import dataclasses
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from core.rules.events import EngineEvent
from core.server.protocol import (
    CaptureCropMessage,
    CaptureCropResponse,
    CaptureImportMessage,
    CaptureImportResponse,
    CapturePixelMessage,
    CapturePixelResponse,
    ClientMessage,
    EngineEventMessage,
    EngineStartMessage,
    EngineStatusRequest,
    EngineStatusResponse,
    EngineStopMessage,
    ErrorMessage,
    RuleCreateMessage,
    RuleDeleteMessage,
    RuleListRequest,
    RuleListResponse,
    RulePreviewMessage,
    RulePreviewResponse,
    RuleReorderMessage,
    RuleToggleMessage,
    parse_client_message,
)
from core.server.service import DEFAULT_MAX_WORKERS, EngineService, RuleNotFoundError

logger = logging.getLogger("pixelpulse.server.app")

DEFAULT_RULES_PATH = "rules.json"


class ConnectionManager:
    """Tracks connected GUI clients so engine events can be broadcast to all of them.

    追蹤已連線的 GUI 用戶端，讓引擎事件可以廣播給所有人。
    """

    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def broadcast(self, message: dict) -> None:
        dead: list[WebSocket] = []
        for websocket in self._connections:
            try:
                await websocket.send_json(message)
            except Exception:
                dead.append(websocket)
        for websocket in dead:
            self.disconnect(websocket)


def create_app(
    rules_path: str = DEFAULT_RULES_PATH,
    targets_dir: str = "targets",
    max_workers: int = DEFAULT_MAX_WORKERS,
) -> FastAPI:
    manager = ConnectionManager()
    # Populated on startup; lets the engine's background thread schedule a
    # broadcast onto the asyncio loop via call_soon_threadsafe.
    # 在 startup 時填入；讓引擎的背景執行緒能透過 call_soon_threadsafe
    # 把廣播工作排進 asyncio 事件迴圈。
    state: dict[str, asyncio.AbstractEventLoop] = {}

    def on_engine_event(event: EngineEvent) -> None:
        message = EngineEventMessage(event=dataclasses.asdict(event)).model_dump()
        loop = state.get("loop")
        if loop is not None:
            loop.call_soon_threadsafe(lambda: asyncio.create_task(manager.broadcast(message)))

    service = EngineService(
        rules_path=rules_path, event_sink=on_engine_event, targets_dir=targets_dir, max_workers=max_workers
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        state["loop"] = asyncio.get_running_loop()
        yield
        service.stop()
        service.close()

    app = FastAPI(title="PixelPulse Core Server", lifespan=lifespan)

    # Serves captured template images to the GUI (rule list thumbnails) at a
    # fixed "/targets" URL prefix regardless of the real targets_dir name.
    # 讓 GUI 能透過固定的 "/targets" URL 前綴取得已擷取的樣板圖片（規則清單縮圖），
    # 跟實際 targets_dir 的資料夾名稱無關。
    Path(targets_dir).mkdir(parents=True, exist_ok=True)
    app.mount("/targets", StaticFiles(directory=targets_dir), name="targets")

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "running": service.is_running, "ruleCount": len(service.list_rules())}

    @app.websocket("/ws")
    async def ws_endpoint(websocket: WebSocket) -> None:
        await manager.connect(websocket)
        await websocket.send_json(RuleListResponse(rules=service.list_rules()).model_dump(by_alias=True))
        await websocket.send_json(_status_response().model_dump(by_alias=True))

        try:
            while True:
                raw = await websocket.receive_json()
                await _dispatch(websocket, raw)
        except WebSocketDisconnect:
            manager.disconnect(websocket)

    def _status_response() -> EngineStatusResponse:
        return EngineStatusResponse(running=service.is_running, ruleCount=len(service.list_rules()))

    async def _broadcast_rules_and_status() -> None:
        # ruleCount lives in engine.status, so any rule mutation needs to
        # re-broadcast both messages -- otherwise "N rule(s) loaded" in the
        # GUI goes stale after creating/deleting/reordering rules (caught via
        # manual browser testing of the rule editor).
        # ruleCount 放在 engine.status 裡，所以規則異動時兩個訊息都要重新廣播，
        # 否則 GUI 上的「已載入 N 條規則」在新增/刪除/排序規則後會顯示過期資訊
        # （在瀏覽器手動測試規則編輯器時發現）。
        await manager.broadcast(RuleListResponse(rules=service.list_rules()).model_dump(by_alias=True))
        await manager.broadcast(_status_response().model_dump(by_alias=True))

    async def _dispatch(websocket: WebSocket, raw: dict) -> None:
        try:
            message: ClientMessage = parse_client_message(raw)
        except Exception as exc:
            await websocket.send_json(ErrorMessage(message=str(exc)).model_dump())
            return

        try:
            if isinstance(message, RuleCreateMessage):
                service.add_rule(message.payload)
                await _broadcast_rules_and_status()
            elif isinstance(message, RuleListRequest):
                await websocket.send_json(RuleListResponse(rules=service.list_rules()).model_dump(by_alias=True))
            elif isinstance(message, RuleDeleteMessage):
                service.delete_rule(message.name)
                await _broadcast_rules_and_status()
            elif isinstance(message, RuleToggleMessage):
                service.toggle_rule(message.name, message.enabled)
                await _broadcast_rules_and_status()
            elif isinstance(message, RuleReorderMessage):
                service.reorder_rules(message.names)
                await _broadcast_rules_and_status()
            elif isinstance(message, RulePreviewMessage):
                match = await asyncio.to_thread(service.preview_trigger, message.trigger)
                response = (
                    RulePreviewResponse(matched=True, x=match.x, y=match.y, confidence=match.confidence)
                    if match is not None
                    else RulePreviewResponse(matched=False)
                )
                await websocket.send_json(response.model_dump(by_alias=True))
            elif isinstance(message, CaptureCropMessage):
                image_path, preview_b64 = await asyncio.to_thread(service.capture_crop, message.roi, message.name)
                await websocket.send_json(
                    CaptureCropResponse(imagePath=image_path, previewPngBase64=preview_b64, roi=message.roi).model_dump(
                        by_alias=True
                    )
                )
            elif isinstance(message, CapturePixelMessage):
                rgb = await asyncio.to_thread(service.capture_pixel, message.x, message.y)
                await websocket.send_json(
                    CapturePixelResponse(x=message.x, y=message.y, targetRgb=rgb).model_dump(by_alias=True)
                )
            elif isinstance(message, CaptureImportMessage):
                image_path, preview_b64 = await asyncio.to_thread(service.import_image, message.path, message.name)
                await websocket.send_json(
                    CaptureImportResponse(imagePath=image_path, previewPngBase64=preview_b64).model_dump(by_alias=True)
                )
            elif isinstance(message, EngineStartMessage):
                service.start()
                await manager.broadcast(_status_response().model_dump(by_alias=True))
            elif isinstance(message, EngineStopMessage):
                service.stop()
                await manager.broadcast(_status_response().model_dump(by_alias=True))
            elif isinstance(message, EngineStatusRequest):
                await websocket.send_json(_status_response().model_dump(by_alias=True))
        except RuleNotFoundError as exc:
            await websocket.send_json(ErrorMessage(message=f"No such rule: {exc}").model_dump())
        except Exception as exc:  # noqa: BLE001 -- surface any failure to the client instead of dropping the connection
            logger.exception("Error handling message: %s", raw)
            await websocket.send_json(ErrorMessage(message=str(exc)).model_dump())

    return app
