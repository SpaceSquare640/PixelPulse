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
    app = create_app(rules_path=str(rules_path), targets_dir=str(tmp_path / "targets"))
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
        updated = _receive_until(ws, "rule.list")

        assert [r["name"] for r in updated["rules"]] == ["Click confirm"]


def test_rule_create_also_refreshes_rule_count_in_status(client):
    # Regression test: rule.create used to only broadcast rule.list, leaving
    # engine.status's ruleCount (shown in the GUI as "N rule(s) loaded")
    # stale until the next engine start/stop. Found via manual browser
    # testing of the rule editor.
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()
        ws.receive_json()

        ws.send_json({"type": "rule.create", "payload": _RULE_PAYLOAD})
        status = _receive_until(ws, "engine.status")

        assert status["ruleCount"] == 1


def test_rule_update_replaces_in_place(client):
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()
        ws.receive_json()

        ws.send_json({"type": "rule.create", "payload": _RULE_PAYLOAD})
        _receive_until(ws, "rule.list")

        updated_payload = {**_RULE_PAYLOAD, "cooldownMs": 9999}
        ws.send_json({"type": "rule.update", "originalName": "Click confirm", "payload": updated_payload})
        updated = _receive_until(ws, "rule.list")

        assert len(updated["rules"]) == 1
        assert updated["rules"][0]["cooldownMs"] == 9999


def test_rule_update_missing_returns_error(client):
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()
        ws.receive_json()

        ws.send_json({"type": "rule.update", "originalName": "nope", "payload": _RULE_PAYLOAD})
        error = ws.receive_json()

        assert error["type"] == "error"


def test_rule_delete_all_clears_list(client):
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()
        ws.receive_json()

        ws.send_json({"type": "rule.create", "payload": _RULE_PAYLOAD})
        _receive_until(ws, "rule.list")

        ws.send_json({"type": "rule.deleteAll"})
        cleared = _receive_until(ws, "rule.list")

        assert cleared["rules"] == []


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


def test_capture_pixel_returns_rgb(client):
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()
        ws.receive_json()

        ws.send_json({"type": "capture.pixel", "x": 0, "y": 0})
        response = ws.receive_json()

        assert response["type"] == "capture.pixel"
        assert response["x"] == 0 and response["y"] == 0
        assert len(response["targetRgb"]) == 3


def test_capture_crop_saves_image_and_returns_preview(client):
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()
        ws.receive_json()

        ws.send_json({"type": "capture.crop", "roi": [0, 0, 20, 20], "name": "My Rule"})
        response = ws.receive_json()

        assert response["type"] == "capture.crop"
        assert response["imagePath"].endswith(".png")
        assert len(response["previewPngBase64"]) > 0


def test_capture_import_copies_file_and_returns_preview(client, tmp_path):
    import cv2
    import numpy as np

    src = tmp_path / "existing-icon.png"
    cv2.imwrite(str(src), np.zeros((10, 10, 3), dtype=np.uint8))

    with client.websocket_connect("/ws") as ws:
        ws.receive_json()
        ws.receive_json()

        ws.send_json({"type": "capture.import", "path": str(src), "name": "My Icon"})
        response = ws.receive_json()

        assert response["type"] == "capture.import"
        assert response["imagePath"].endswith(".png")
        assert len(response["previewPngBase64"]) > 0


def test_capture_import_missing_file_returns_error(client, tmp_path):
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()
        ws.receive_json()

        ws.send_json({"type": "capture.import", "path": str(tmp_path / "nope.png"), "name": "x"})
        error = ws.receive_json()

        assert error["type"] == "error"


def test_rule_preview_reports_match(client):
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()
        ws.receive_json()

        ws.send_json({"type": "capture.pixel", "x": 0, "y": 0})
        rgb = ws.receive_json()["targetRgb"]

        ws.send_json(
            {
                "type": "rule.preview",
                "trigger": {
                    "kind": "pixel",
                    "roi": [0, 0, 10, 10],
                    "pixelX": 0,
                    "pixelY": 0,
                    "targetRgb": rgb,
                    "tolerance": 5,
                },
            }
        )
        response = ws.receive_json()

        assert response == {"type": "rule.preview", "matched": True, "x": 0, "y": 0, "confidence": 1.0}


def test_rule_reorder_round_trip(client):
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()
        ws.receive_json()

        ws.send_json({"type": "rule.create", "payload": {**_RULE_PAYLOAD, "name": "A"}})
        _receive_until(ws, "rule.list")
        ws.send_json({"type": "rule.create", "payload": {**_RULE_PAYLOAD, "name": "B"}})
        _receive_until(ws, "rule.list")

        ws.send_json({"type": "rule.reorder", "names": ["B", "A"]})
        response = _receive_until(ws, "rule.list")

        assert [r["name"] for r in response["rules"]] == ["B", "A"]


def test_rule_reorder_mismatch_returns_error(client):
    with client.websocket_connect("/ws") as ws:
        ws.receive_json()
        ws.receive_json()

        ws.send_json({"type": "rule.reorder", "names": ["Ghost"]})
        error = ws.receive_json()

        assert error["type"] == "error"
