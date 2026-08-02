from __future__ import annotations

import json
from pathlib import Path

from pydantic import TypeAdapter

from core.rules.models import RuleConfig

_rules_adapter = TypeAdapter(list[RuleConfig])


def load_rules(path: str | Path) -> list[RuleConfig]:
    """Load and validate a rules JSON file into a list of RuleConfig.

    讀取並驗證 rules JSON 檔案，回傳一組 RuleConfig。
    """
    raw = Path(path).read_text(encoding="utf-8")
    data = json.loads(raw)
    return _rules_adapter.validate_python(data)


def save_rules(path: str | Path, rules: list[RuleConfig]) -> None:
    """Write a list of RuleConfig back to a rules JSON file (camelCase, pretty-printed).

    把一組 RuleConfig 寫回 rules JSON 檔案（camelCase 命名、格式化排版）。
    """
    data = _rules_adapter.dump_python(rules, by_alias=True, mode="json")
    Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
