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
from typing import AsyncIterator

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from core.rules.events import EngineEvent
from core.server.protocol import (
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
    RuleToggleMessage,
    parse_client_message,
)
from core.server.service import EngineService, RuleNotFoundError

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


def create_app(rules_path: str = DEFAULT_RULES_PATH) -> FastAPI:
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

    service = EngineService(rules_path=rules_path, event_sink=on_engine_event)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        state["loop"] = asyncio.get_running_loop()
        yield
        service.stop()

    app = FastAPI(title="PixelPulse Core Server", lifespan=lifespan)

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

    async def _dispatch(websocket: WebSocket, raw: dict) -> None:
        try:
            message: ClientMessage = parse_client_message(raw)
        except Exception as exc:
            await websocket.send_json(ErrorMessage(message=str(exc)).model_dump())
            return

        try:
            if isinstance(message, RuleCreateMessage):
                service.add_rule(message.payload)
                await manager.broadcast(RuleListResponse(rules=service.list_rules()).model_dump(by_alias=True))
            elif isinstance(message, RuleListRequest):
                await websocket.send_json(RuleListResponse(rules=service.list_rules()).model_dump(by_alias=True))
            elif isinstance(message, RuleDeleteMessage):
                service.delete_rule(message.name)
                await manager.broadcast(RuleListResponse(rules=service.list_rules()).model_dump(by_alias=True))
            elif isinstance(message, RuleToggleMessage):
                service.toggle_rule(message.name, message.enabled)
                await manager.broadcast(RuleListResponse(rules=service.list_rules()).model_dump(by_alias=True))
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

    return app
