import json
import time
from pathlib import Path

import cv2
import numpy as np
import pytest

from core.rules.models import RuleConfig, TriggerConfig
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


@pytest.fixture
def service(rules_path, tmp_path):
    svc = EngineService(rules_path=rules_path, targets_dir=tmp_path / "targets")
    yield svc
    svc.close()


def test_add_rule_persists_to_disk(service, rules_path):
    service.add_rule(_RULE)

    assert [r.name for r in service.list_rules()] == ["Click confirm"]
    on_disk = json.loads(rules_path.read_text(encoding="utf-8"))
    assert on_disk[0]["name"] == "Click confirm"


def test_delete_missing_rule_raises(service):
    with pytest.raises(RuleNotFoundError):
        service.delete_rule("nope")


def test_delete_all_rules_clears_everything(service):
    service.add_rule(_RULE.model_copy(update={"name": "A"}))
    service.add_rule(_RULE.model_copy(update={"name": "B"}))

    service.delete_all_rules()

    assert service.list_rules() == []


def test_update_rule_replaces_in_place(service):
    a = _RULE.model_copy(update={"name": "A", "cooldown_ms": 1000})
    b = _RULE.model_copy(update={"name": "B"})
    service.add_rule(a)
    service.add_rule(b)

    updated = a.model_copy(update={"cooldown_ms": 5000})
    service.update_rule("A", updated)

    names = [r.name for r in service.list_rules()]
    assert names == ["A", "B"]  # position preserved
    assert service.list_rules()[0].cooldown_ms == 5000


def test_update_rule_allows_rename(service):
    service.add_rule(_RULE.model_copy(update={"name": "A"}))

    renamed = _RULE.model_copy(update={"name": "A (renamed)"})
    service.update_rule("A", renamed)

    assert [r.name for r in service.list_rules()] == ["A (renamed)"]


def test_update_rule_missing_raises(service):
    with pytest.raises(RuleNotFoundError):
        service.update_rule("nope", _RULE)


def test_update_rule_rejects_rename_colliding_with_another_rule(service):
    a = _RULE.model_copy(update={"name": "A"})
    b = _RULE.model_copy(update={"name": "B"})
    service.add_rule(a)
    service.add_rule(b)

    with pytest.raises(ValueError, match="already exists"):
        service.update_rule("A", a.model_copy(update={"name": "B"}))


def test_toggle_rule_updates_enabled_flag(service):
    service.add_rule(_RULE)

    service.toggle_rule("Click confirm", enabled=False)

    assert service.list_rules()[0].enabled is False


def test_reorder_rules_changes_order(service):
    a = _RULE.model_copy(update={"name": "A"})
    b = _RULE.model_copy(update={"name": "B"})
    service.add_rule(a)
    service.add_rule(b)

    service.reorder_rules(["B", "A"])

    assert [r.name for r in service.list_rules()] == ["B", "A"]


def test_reorder_rules_rejects_mismatched_names(service):
    service.add_rule(_RULE)

    with pytest.raises(ValueError, match="reorder must list every rule exactly once"):
        service.reorder_rules(["Click confirm", "Ghost Rule"])


def test_capture_crop_saves_file_and_returns_preview(service):
    image_path, preview_b64 = service.capture_crop((0, 0, 20, 20), "My Rule!")

    assert Path(image_path).exists()
    assert Path(image_path).suffix == ".png"
    assert len(preview_b64) > 0


def test_import_image_copies_file_and_returns_preview(service, tmp_path):
    src = tmp_path / "source.png"
    cv2.imwrite(str(src), np.zeros((10, 10, 3), dtype=np.uint8))

    image_path, preview_b64 = service.import_image(str(src), "My Icon!")

    assert Path(image_path).exists()
    assert Path(image_path).suffix == ".png"
    assert len(preview_b64) > 0


def test_import_image_missing_file_raises(service, tmp_path):
    with pytest.raises(FileNotFoundError):
        service.import_image(str(tmp_path / "nope.png"), "x")


def test_capture_pixel_returns_rgb_triplet(service):
    r, g, b = service.capture_pixel(0, 0)

    assert all(0 <= channel <= 255 for channel in (r, g, b))


def test_preview_trigger_pixel_match(service):
    r, g, b = service.capture_pixel(0, 0)
    trigger = TriggerConfig(kind="pixel", roi=(0, 0, 10, 10), pixel_x=0, pixel_y=0, target_rgb=(r, g, b), tolerance=5)

    match = service.preview_trigger(trigger)

    assert match is not None
    assert match.x == 0 and match.y == 0


def test_preview_trigger_pixel_no_match(service):
    trigger = TriggerConfig(
        kind="pixel",
        roi=(0, 0, 10, 10),
        pixel_x=0,
        pixel_y=0,
        target_rgb=(1, 2, 3),  # extremely unlikely to be the real pixel colour
        tolerance=0,
    )

    match = service.preview_trigger(trigger)

    assert match is None


def test_start_stop_with_no_rules_is_safe(rules_path, tmp_path):
    # No rules means the engine loop never touches the screen or input
    # backend -- safe to actually start/stop in a test.
    service = EngineService(rules_path=rules_path, targets_dir=tmp_path / "targets", scan_interval_s=0.02)
    try:
        assert service.is_running is False
        service.start()
        time.sleep(0.1)
        assert service.is_running is True

        service.stop()
        assert service.is_running is False
    finally:
        service.close()
