"""Phase 1 MVP entry point: run the engine from a rules.json file, no GUI.

Usage:
    python -m core.run rules.example.json

Phase 1 MVP 進入點：從 rules.json 檔案執行引擎，尚無 GUI。

用法：
    python -m core.run rules.example.json
"""

from __future__ import annotations

import argparse
import logging
import sys

from core.automation.killswitch import KillSwitch
from core.automation.pyautogui_backend import PyAutoGUIBackend
from core.capture.screen import ScreenCapture
from core.platform_windows import enable_dpi_awareness
from core.rules.engine import RuleEngine
from core.rules.loader import load_rules


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run PixelPulse rules from a JSON file. (從 JSON 檔案執行 PixelPulse 規則)"
    )
    parser.add_argument("rules_path", help="Path to a rules.json file. (rules.json 檔案路徑)")
    parser.add_argument(
        "--interval",
        type=float,
        default=0.2,
        help="Seconds between scans, default 0.2 = 5 scans/sec. (每次掃描間隔秒數，預設 0.2 秒，即每秒 5 次)",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging verbosity. (記錄詳細程度)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Load rules, start the engine, and run until Ctrl+C or the kill switch fires.

    載入規則、啟動引擎，直到 Ctrl+C 或緊急停止熱鍵觸發為止。
    """
    args = parse_args(argv if argv is not None else sys.argv[1:])
    logging.basicConfig(level=args.log_level, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    enable_dpi_awareness()

    rules = load_rules(args.rules_path)
    kill_switch = KillSwitch()

    with ScreenCapture() as capture:
        engine = RuleEngine(
            rules=rules,
            capture=capture,
            input_backend=PyAutoGUIBackend(),
            kill_switch=kill_switch,
            scan_interval_s=args.interval,
        )
        try:
            engine.run_forever()
        except KeyboardInterrupt:
            logging.getLogger("pixelpulse.run").info("Stopped by user (Ctrl+C).")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
