from __future__ import annotations

import argparse
import os
import sys
from multiprocessing import freeze_support
from pathlib import Path

import uvicorn

import app.main  # noqa: F401 - make PyInstaller collect the FastAPI application graph.


def configure_packaged_paths() -> None:
    if not getattr(sys, "frozen", False):
        return
    executable_dir = Path(sys.executable).resolve().parent
    candidates = [
        executable_dir / "frontend",
        executable_dir.parent / "frontend",
        executable_dir.parent.parent / "frontend",
    ]
    for candidate in candidates:
        if candidate.exists() and not os.environ.get("DAYORDER_FRONTEND_DIR"):
            os.environ["DAYORDER_FRONTEND_DIR"] = str(candidate)
            break


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the DayOrder desktop backend.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--log-level", default="info")
    args = parser.parse_args()
    configure_packaged_paths()
    uvicorn.run("app.main:app", host=args.host, port=args.port, log_level=args.log_level)


if __name__ == "__main__":
    freeze_support()
    main()
