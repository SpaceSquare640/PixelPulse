import pytest
from fastapi.testclient import TestClient

from core.server.app import create_app

_RULE_PAYLOAD = {
    "name": "Click confirm",
    "trigger": {"kind": "template", "roi": [0, 0, 100, 100], "image": "targets/x.png"},
    "action": {"kind": "click"},
}


def _receive_until(ws, message_type: str, max_messages: int = 10) -> dict:
    """Consume messages until one of `message_type` arrives.

    Engine events (`engine.event`) can be broadcast from the background
    engine thread at any time, so they may legitimately interleave with the
    direct reply to a request. Real clients need to handle that too.
    """
    for _ in range(max_messages):
        message = ws.receive_json()
        if message["type"] == message_type:
            return message
    raise AssertionError(f"Did not see a {message_type!r} message within {max_messages} messages")


@pytest.fixture
def client(tmp_path):
    rules_path = tmp_path / "rules.json"
    rules_path.write_text("[]", encoding="utf-8")
    app = create_app(rules_path=str(rules_path))
    with TestClient(app) as test_client:
        yield test_client


def test_connect_sends_initial_snapshot(client):
    with client.websocket_connect("/ws") as ws:
        rules_msg = ws.receive_json()
        status_msg = ws.receive_json()

        assert rules_msg == {"type": "rule.list", "rules": []}
        assert status_msg == {"type": "engine.status", "running": False, "ruleCount": 0}


def test_rule_create_broadcasts_updated_list(client):
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()  # initial rule.list
        ws.receive_json()  # initial engine.status

        ws.send_json({"type": "rule.create", "payload": _RULE_PAYLOAD})
        updated = ws.receive_json()

        assert updated["type"] == "rule.list"
        assert [r["name"] for r in updated["rules"]] == ["Click confirm"]


def test_engine_start_stop_round_trip(client):
    # No rules exist, so starting the engine never touches the screen or
    # input backend -- safe to exercise for real here.
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()
        ws.receive_json()

        ws.send_json({"type": "engine.start"})
        started = _receive_until(ws, "engine.status")
        assert started == {"type": "engine.status", "running": True, "ruleCount": 0}

        ws.send_json({"type": "engine.stop"})
        stopped = _receive_until(ws, "engine.status")
        assert stopped == {"type": "engine.status", "running": False, "ruleCount": 0}


def test_unknown_message_type_returns_error(client):
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()
        ws.receive_json()

        ws.send_json({"type": "rule.explode"})
        error = ws.receive_json()

        assert error["type"] == "error"


def test_delete_missing_rule_returns_error(client):
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()
        ws.receive_json()

        ws.send_json({"type": "rule.delete", "name": "nope"})
        error = ws.receive_json()

        assert error["type"] == "error"
