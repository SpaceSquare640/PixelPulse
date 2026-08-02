import pytest

from core.server.protocol import (
    EngineStartMessage,
    EngineStatusRequest,
    EngineStopMessage,
    RuleCreateMessage,
    RuleDeleteMessage,
    RuleListRequest,
    RuleToggleMessage,
    parse_client_message,
)

_RULE_PAYLOAD = {
    "name": "Click confirm",
    "trigger": {"kind": "template", "roi": [0, 0, 100, 100], "image": "targets/x.png"},
    "action": {"kind": "click"},
}


def test_parse_rule_create():
    message = parse_client_message({"type": "rule.create", "payload": _RULE_PAYLOAD})
    assert isinstance(message, RuleCreateMessage)
    assert message.payload.name == "Click confirm"


def test_parse_rule_list():
    assert isinstance(parse_client_message({"type": "rule.list"}), RuleListRequest)


def test_parse_rule_delete():
    message = parse_client_message({"type": "rule.delete", "name": "Click confirm"})
    assert isinstance(message, RuleDeleteMessage)
    assert message.name == "Click confirm"


def test_parse_rule_toggle():
    message = parse_client_message({"type": "rule.toggle", "name": "Click confirm", "enabled": False})
    assert isinstance(message, RuleToggleMessage)
    assert message.enabled is False


def test_parse_engine_messages():
    assert isinstance(parse_client_message({"type": "engine.start"}), EngineStartMessage)
    assert isinstance(parse_client_message({"type": "engine.stop"}), EngineStopMessage)
    assert isinstance(parse_client_message({"type": "engine.status"}), EngineStatusRequest)


def test_parse_unknown_type_raises():
    with pytest.raises(ValueError, match="Unknown message type"):
        parse_client_message({"type": "rule.explode"})
