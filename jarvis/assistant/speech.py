"""Speech in (local Whisper) and speech out (macOS `say`)."""

from __future__ import annotations

import re
import subprocess
import tempfile
import threading
from pathlib import Path

from .mac import IS_MAC

_ARABIC = re.compile(r"[؀-ۿ]")


def is_arabic(text: str) -> bool:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    return sum(1 for c in letters if _ARABIC.match(c)) / len(letters) > 0.3


class Transcriber:
    """Lazy-loads faster-whisper on first use (the model downloads once, ~500 MB for `small`)."""

    def __init__(self, model_size: str) -> None:
        self.model_size = model_size
        self._model = None
        self._lock = threading.Lock()

    def _load(self):
        if self._model is None:
            from faster_whisper import WhisperModel

            self._model = WhisperModel(self.model_size, device="auto", compute_type="int8")
        return self._model

    def transcribe(self, audio: bytes, suffix: str = ".webm") -> tuple[str, str]:
        """Returns (text, language code)."""
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio)
            path = Path(tmp.name)
        try:
            with self._lock:
                model = self._load()
                segments, info = model.transcribe(
                    str(path),
                    beam_size=5,
                    vad_filter=True,
                    # Nudges recognition toward the languages and words we expect.
                    initial_prompt="Jarvis. افتح سفاري. شغل مزيكا. Open Safari.",
                )
                text = " ".join(s.text.strip() for s in segments).strip()
            return text, info.language
        finally:
            path.unlink(missing_ok=True)


class Speaker:
    """Speaks replies with the built-in macOS voices; Arabic uses the 'Majed' voice."""

    def __init__(self, enabled: bool) -> None:
        self.enabled = enabled and IS_MAC
        self._proc: subprocess.Popen | None = None
        self._voices: set[str] | None = None

    def _available_voices(self) -> set[str]:
        if self._voices is None:
            try:
                out = subprocess.run(["say", "-v", "?"], capture_output=True, text=True, timeout=10).stdout
                self._voices = {line.split()[0] for line in out.splitlines() if line.strip()}
            except (OSError, subprocess.SubprocessError):
                self._voices = set()
        return self._voices

    def say(self, text: str) -> None:
        if not self.enabled or not text.strip():
            return
        self.stop()
        cmd = ["say"]
        if is_arabic(text):
            voices = self._available_voices()
            for voice in ("Majed", "Tarik", "Maged"):
                if voice in voices:
                    cmd += ["-v", voice]
                    break
        self._proc = subprocess.Popen([*cmd, text])

    def stop(self) -> None:
        if self._proc and self._proc.poll() is None:
            self._proc.terminate()
        self._proc = None
