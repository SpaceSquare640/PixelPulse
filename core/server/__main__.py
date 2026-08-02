"""Start the FastAPI/WebSocket server the Electron GUI talks to.

Usage:
    python -m core.server

啟動供 Electron GUI 使用的 FastAPI/WebSocket 伺服器。

用法：
    python -m core.server
"""

from __future__ import annotations

import argparse
import logging

import uvicorn

from core.platform_windows import enable_dpi_awareness
from core.server.app import DEFAULT_RULES_PATH, create_app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the PixelPulse GUI server. (啟動 PixelPulse GUI 伺服器)"
    )
    parser.add_argument(
        "--rules-path",
        default=DEFAULT_RULES_PATH,
        help="Path to the rules.json this server reads/writes. (此伺服器讀寫的 rules.json 路徑)",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Bind address. (綁定位址，預設僅限本機)")
    parser.add_argument("--port", type=int, default=8765, help="Bind port. (綁定埠號)")
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=args.log_level, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    enable_dpi_awareness()

    app = create_app(rules_path=args.rules_path)
    uvicorn.run(app, host=args.host, port=args.port, log_level=args.log_level.lower())


if __name__ == "__main__":
    main()
