"""Small JSON stores in ~/.jarvis: user settings and what Jarvis knows about the user."""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

from .config import DATA_DIR

_lock = threading.Lock()


def _read(path: Path, default: dict[str, Any]) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else dict(default)
    except (FileNotFoundError, json.JSONDecodeError):
        return dict(default)


def _write(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


# ---------------------------------------------------------------- settings

SETTINGS_FILE = DATA_DIR / "settings.json"
DEFAULT_SETTINGS = {"voice": "dark"}


def get_settings() -> dict[str, Any]:
    with _lock:
        return {**DEFAULT_SETTINGS, **_read(SETTINGS_FILE, {})}


def update_settings(**changes: Any) -> dict[str, Any]:
    with _lock:
        data = {**DEFAULT_SETTINGS, **_read(SETTINGS_FILE, {}), **changes}
        _write(SETTINGS_FILE, data)
        return data


# ---------------------------------------------------------------- profile (memory about the user)

PROFILE_FILE = DATA_DIR / "profile.json"


def get_profile() -> dict[str, Any]:
    with _lock:
        data = _read(PROFILE_FILE, {})
    data.setdefault("facts", [])
    data.setdefault("channels", {})
    return data


def save_profile(data: dict[str, Any]) -> None:
    with _lock:
        _write(PROFILE_FILE, data)
