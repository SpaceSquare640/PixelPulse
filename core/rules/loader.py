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
