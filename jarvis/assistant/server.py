"""Local web server for the HUD. Listens on 127.0.0.1 only.

Every API call must carry a secret token that is only embedded in the page this server
serves, so other websites open in your browser can't drive your Mac through it.
"""

from __future__ import annotations

import json
import secrets
import sys
import threading
import traceback
import webbrowser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from . import __version__
from . import tools as T
from .brain import Action, BrainError, make_brain
from .config import load_config
from .mac import IS_MAC
from .speech import Speaker, Transcriber

WEB = Path(__file__).resolve().parent / "web"
TOKEN = secrets.token_urlsafe(24)
MAX_UPLOAD = 25 * 1024 * 1024
AUDIO_SUFFIX = {"audio/webm": ".webm", "audio/ogg": ".ogg", "audio/mp4": ".m4a", "audio/wav": ".wav", "audio/x-wav": ".wav"}


class Jarvis:
    def __init__(self) -> None:
        self.config = load_config()
        self.brain = make_brain(self.config)
        self.ears = Transcriber(self.config.whisper_model)
        self.voice = Speaker(self.config.tts)
        self.lock = threading.Lock()

    def handle_text(self, text: str, transcript: str | None = None) -> dict[str, Any]:
        text = text.strip()
        if not text:
            return {"transcript": transcript or "", "reply": "", "actions": []}
        with self.lock:
            self.voice.stop()
            actions: list[Action] = []
            try:
                turn = self.brain.ask(text, on_action=actions.append)
                reply = turn.reply
            except BrainError as exc:
                reply = str(exc)
            self.voice.say(reply)
        return {
            "transcript": transcript if transcript is not None else text,
            "reply": reply,
            "actions": [a.__dict__ for a in actions],
        }

    def handle_audio(self, audio: bytes, content_type: str) -> dict[str, Any]:
        suffix = AUDIO_SUFFIX.get(content_type.split(";")[0].strip(), ".webm")
        try:
            text, _lang = self.ears.transcribe(audio, suffix)
        except ImportError:
            return {"transcript": "", "reply": "Speech recognition isn't installed. Run: pip install faster-whisper", "actions": []}
        if not text:
            return {"transcript": "", "reply": "", "actions": []}
        return self.handle_text(text, transcript=text)

    def status(self) -> dict[str, Any]:
        stats: dict[str, Any] = {}
        try:
            import psutil

            stats = {
                "cpu": psutil.cpu_percent(interval=None),
                "memory": psutil.virtual_memory().percent,
                "battery": getattr(psutil.sensors_battery(), "percent", None),
            }
        except ImportError:
            pass
        return {
            "version": __version__,
            "brain": self.brain.name,
            "model": self.brain.label,
            "mac": IS_MAC,
            "tts": self.voice.enabled,
            "shortcuts": T.load_shortcuts(),
            **stats,
        }


def make_handler(app: Jarvis, port: int):
    allowed_hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}

    class Handler(BaseHTTPRequestHandler):
        server_version = "Jarvis"

        def log_message(self, fmt: str, *args: Any) -> None:  # quieter console
            if "/api/status" not in (args[0] if args else ""):
                sys.stderr.write("  " + fmt % args + "\n")

        # ---------------------------------------------------- helpers
        def _send(self, status: int, body: bytes, content_type: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, data: Any, status: int = 200) -> None:
            self._send(status, json.dumps(data, ensure_ascii=False).encode(), "application/json; charset=utf-8")

        def _host_ok(self) -> bool:  # blocks DNS-rebinding attacks
            return self.headers.get("Host", "") in allowed_hosts

        def _authorized(self) -> bool:
            return self._host_ok() and secrets.compare_digest(self.headers.get("X-Jarvis-Token", ""), TOKEN)

        def _body(self) -> bytes | None:
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_UPLOAD:
                self._json({"error": "Upload too large."}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
                return None
            return self.rfile.read(length)

        # ---------------------------------------------------- routes
        def do_GET(self) -> None:
            if not self._host_ok():
                return self._json({"error": "Bad host."}, HTTPStatus.FORBIDDEN)
            if self.path in ("/", "/index.html"):
                html = (WEB / "index.html").read_text(encoding="utf-8").replace("__JARVIS_TOKEN__", TOKEN)
                return self._send(200, html.encode(), "text/html; charset=utf-8")
            if self.path == "/api/status":
                if not self._authorized():
                    return self._json({"error": "Unauthorized."}, HTTPStatus.UNAUTHORIZED)
                return self._json(app.status())
            self._json({"error": "Not found."}, HTTPStatus.NOT_FOUND)

        def do_POST(self) -> None:
            try:
                self._post()
            except Exception as exc:  # noqa: BLE001 - always answer, never drop the connection
                traceback.print_exc()
                self._json({"error": f"{type(exc).__name__}: {exc}"}, HTTPStatus.INTERNAL_SERVER_ERROR)

        def _post(self) -> None:
            if not self._authorized():
                return self._json({"error": "Unauthorized."}, HTTPStatus.UNAUTHORIZED)
            body = self._body()
            if body is None:
                return None
            if self.path == "/api/text":
                try:
                    text = json.loads(body or b"{}").get("text", "")
                except json.JSONDecodeError:
                    return self._json({"error": "Bad JSON."}, HTTPStatus.BAD_REQUEST)
                return self._json(app.handle_text(str(text)))
            if self.path == "/api/audio":
                return self._json(app.handle_audio(body, self.headers.get("Content-Type", "")))
            if self.path == "/api/reset":
                with app.lock:
                    app.brain.reset()
                app.voice.stop()
                return self._json({"ok": True})
            if self.path == "/api/stop":
                app.voice.stop()
                return self._json({"ok": True})
            self._json({"error": "Not found."}, HTTPStatus.NOT_FOUND)

    return Handler


def main() -> None:
    app = Jarvis()
    port = app.config.port
    try:
        server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(app, port))
    except OSError as exc:
        if exc.errno in (48, 98):  # address already in use (macOS, Linux)
            print(f"\n  Jarvis is already running on port {port} (maybe in another Terminal tab).")
            print(f"  Stop it and start again with:\n\n    lsof -ti:{port} | xargs kill; sleep 1; python -m assistant\n")
            sys.exit(1)
        raise
    url = f"http://localhost:{port}/"
    print(f"\n  JARVIS {__version__}  ·  brain: {app.brain.name} ({app.brain.label})")
    if not IS_MAC:
        print("  Note: not running on macOS, so Mac actions will report an error.")
    print(f"  Open {url}  (Ctrl+C to quit)\n")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Bye.")
    finally:
        app.voice.stop()
        server.server_close()
