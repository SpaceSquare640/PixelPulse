import json
import time

import pytest

from core.rules.models import RuleConfig
from core.server.service import EngineService, RuleNotFoundError

_RULE = RuleConfig.model_validate(
    {
        "name": "Click confirm",
        "trigger": {"kind": "template", "roi": [0, 0, 100, 100], "image": "targets/x.png"},
        "action": {"kind": "click"},
    }
)


@pytest.fixture
def rules_path(tmp_path):
    path = tmp_path / "rules.json"
    path.write_text("[]", encoding="utf-8")
    return path


def test_add_rule_persists_to_disk(rules_path):
    service = EngineService(rules_path=rules_path)
    service.add_rule(_RULE)

    assert [r.name for r in service.list_rules()] == ["Click confirm"]
    on_disk = json.loads(rules_path.read_text(encoding="utf-8"))
    assert on_disk[0]["name"] == "Click confirm"


def test_delete_missing_rule_raises(rules_path):
    service = EngineService(rules_path=rules_path)
    with pytest.raises(RuleNotFoundError):
        service.delete_rule("nope")


def test_toggle_rule_updates_enabled_flag(rules_path):
    service = EngineService(rules_path=rules_path)
    service.add_rule(_RULE)

    service.toggle_rule("Click confirm", enabled=False)

    assert service.list_rules()[0].enabled is False


def test_start_stop_with_no_rules_is_safe(rules_path):
    # No rules means the engine loop never touches the screen or input
    # backend -- safe to actually start/stop in a test.
    service = EngineService(rules_path=rules_path, scan_interval_s=0.02)

    assert service.is_running is False
    service.start()
    time.sleep(0.1)
    assert service.is_running is True

    service.stop()
    assert service.is_running is False
