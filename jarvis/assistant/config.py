"""Settings, read from environment variables and an optional .env file."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("JARVIS_DATA_DIR", Path.home() / ".jarvis"))


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader so we don't need python-dotenv. Real env vars win."""
    if not path.is_file():
        return
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key:
            values[key] = value  # a later line overrides an earlier one
    for key, value in values.items():
        if value and key not in os.environ:
            os.environ[key] = value


@dataclass(frozen=True)
class Config:
    brain: str
    claude_model: str
    claude_effort: str
    ollama_model: str
    ollama_url: str
    ollama_keep_alive: str
    whisper_model: str
    tts: bool
    port: int

    @property
    def has_claude_key(self) -> bool:
        return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))

    @property
    def resolved_brain(self) -> str:
        if self.brain in ("claude", "ollama"):
            return self.brain
        return "claude" if self.has_claude_key else "ollama"


def load_config() -> Config:
    _load_dotenv(ROOT / ".env")
    env = os.environ.get
    return Config(
        brain=env("JARVIS_BRAIN", "auto").lower(),
        claude_model=env("JARVIS_CLAUDE_MODEL", "claude-opus-5-5"),
        claude_effort=env("JARVIS_CLAUDE_EFFORT", "low"),
        ollama_model=env("JARVIS_OLLAMA_MODEL", "qwen2.5:7b"),
        ollama_url=env("JARVIS_OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/"),
        ollama_keep_alive=env("JARVIS_OLLAMA_KEEP_ALIVE", "5m"),
        whisper_model=env("JARVIS_WHISPER_MODEL", "small"),
        tts=env("JARVIS_TTS", "1") not in ("0", "false", "no", ""),
        port=int(env("JARVIS_PORT", "8765")),
    )
