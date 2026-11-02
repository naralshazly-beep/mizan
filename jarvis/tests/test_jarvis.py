"""Runs anywhere (no Mac needed): python -m unittest discover -s tests"""

from __future__ import annotations

import json
import os
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest import mock

os.environ["JARVIS_DATA_DIR"] = tempfile.mkdtemp()
os.environ["JARVIS_TTS"] = "0"
os.environ.pop("ANTHROPIC_API_KEY", None)

from assistant import brain, mac, server, tools  # noqa: E402
from assistant.config import load_config  # noqa: E402
from assistant.speech import is_arabic  # noqa: E402


class ToolTests(unittest.TestCase):
    def test_press_keys_builds_safe_script(self):
        with mock.patch.object(mac, "applescript", return_value="") as osa:
            self.assertTrue(tools.execute("press_keys", {"keys": "cmd+shift+4"}).ok)
            script, key = osa.call_args.args
            self.assertIn("{command down, shift down}", script)
            self.assertEqual(key, "4")  # the key travels as argv, not inside the script

            tools.execute("press_keys", {"keys": "cmd+space"})
            self.assertIn("key code 49 using {command down}", osa.call_args.args[0])

    def test_press_keys_rejects_unknown(self):
        self.assertFalse(tools.execute("press_keys", {"keys": "hyper+x"}).ok)
        self.assertFalse(tools.execute("press_keys", {"keys": "cmd+banana"}).ok)

    def test_unknown_tool_and_missing_args(self):
        self.assertFalse(tools.execute("rm_rf", {}).ok)
        self.assertFalse(tools.execute("open_app", {}).ok)

    def test_extra_args_are_dropped_and_defaults_apply(self):
        with mock.patch.object(mac, "run", return_value="/Users/me/a.pdf\n/Users/me/Library/x.pdf") as run:
            res = tools.execute("find_files", {"query": "invoice", "bogus": 1})
            self.assertTrue(res.ok)
            self.assertEqual(res.text, "/Users/me/a.pdf")  # ~/Library noise filtered
            self.assertIn("-name", run.call_args.args[0])

    def test_mac_errors_become_failed_results(self):
        with mock.patch.object(mac, "run", side_effect=mac.MacError("nope")):
            res = tools.execute("open_app", {"name": "Safari"})
            self.assertFalse(res.ok)
            self.assertEqual(res.text, "nope")

    def test_shortcut_memory_roundtrip(self):
        self.assertTrue(tools.execute("learn_shortcut", {"phrase": "وضع الشغل", "instructions": "open Slack"}).ok)
        self.assertEqual(tools.load_shortcuts()["وضع الشغل"], "open Slack")
        self.assertTrue(tools.execute("forget_shortcut", {"phrase": "وضع الشغل"}).ok)
        self.assertNotIn("وضع الشغل", tools.load_shortcuts())

    def test_schemas_are_valid(self):
        for t in tools.TOOLS:
            schema = t.schema()
            self.assertEqual(schema["type"], "object")
            self.assertTrue(set(schema["required"]) <= set(schema["properties"]), t.name)

    def test_arabic_detection(self):
        self.assertTrue(is_arabic("تمام، فتحت سفاري"))
        self.assertFalse(is_arabic("Opened Safari."))


class DecodeAudioTest(unittest.TestCase):
    def test_decodes_browser_webm_opus(self):
        try:
            import av
            import numpy as np
        except ImportError:
            self.skipTest("PyAV not installed")
        from assistant.speech import decode_audio

        path = Path(tempfile.mkdtemp()) / "rec.webm"
        with av.open(str(path), mode="w") as out:  # what Chrome's MediaRecorder produces
            stream = out.add_stream("libopus", rate=48000, layout="mono")
            t = np.arange(48000) / 48000
            tone = (np.sin(2 * np.pi * 440 * t) * 12000).astype(np.int16).reshape(1, -1)
            frame = av.AudioFrame.from_ndarray(tone, format="s16", layout="mono")
            frame.sample_rate = 48000
            for packet in stream.encode(frame):
                out.mux(packet)
            for packet in stream.encode(None):
                out.mux(packet)
        audio = decode_audio(path)
        self.assertEqual(audio.dtype, np.float32)
        self.assertAlmostEqual(audio.size / 16000, 1.0, delta=0.1)  # 1 s at 16 kHz
        self.assertGreater(float(np.abs(audio).max()), 0.2)


class FakeOllama(BaseHTTPRequestHandler):
    """First call asks for open_app, second call answers."""

    calls: list[dict] = []

    def log_message(self, *a):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        FakeOllama.calls.append(body)
        if len(FakeOllama.calls) == 1:
            msg = {"role": "assistant", "content": "", "tool_calls": [
                {"function": {"name": "open_app", "arguments": {"name": "Safari"}}}]}
        else:
            msg = {"role": "assistant", "content": "تمام، فتحت سفاري."}
        data = json.dumps({"message": msg}).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


class OllamaLoopTest(unittest.TestCase):
    def test_tool_loop(self):
        srv = ThreadingHTTPServer(("127.0.0.1", 0), FakeOllama)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        os.environ["JARVIS_OLLAMA_URL"] = f"http://127.0.0.1:{srv.server_port}"
        try:
            b = brain.make_brain(load_config())
            self.assertIsInstance(b, brain.OllamaBrain)
            with mock.patch.object(mac, "run", return_value="") as run:
                turn = b.ask("افتح سفاري")
            run.assert_called_once_with(["open", "-a", "Safari"])
            self.assertEqual(turn.reply, "تمام، فتحت سفاري.")
            self.assertEqual([a.tool for a in turn.actions], ["open_app"])
            second = FakeOllama.calls[1]["messages"]
            self.assertEqual(second[0]["role"], "system")
            self.assertEqual(second[-1]["role"], "tool")
            self.assertIn("[Local time:", second[1]["content"])
        finally:
            srv.shutdown()

    def test_ollama_down_gives_friendly_error(self):
        os.environ["JARVIS_OLLAMA_URL"] = "http://127.0.0.1:9"
        b = brain.make_brain(load_config())
        with self.assertRaises(brain.BrainError) as ctx:
            b.ask("hi")
        self.assertIn("Ollama isn't running", str(ctx.exception))


class ClaudeLoopTest(unittest.TestCase):
    def test_tool_loop_with_mocked_api(self):
        from types import SimpleNamespace as NS

        os.environ["ANTHROPIC_API_KEY"] = "test-key"
        try:
            b = brain.make_brain(load_config())
        finally:
            os.environ.pop("ANTHROPIC_API_KEY")
        self.assertIsInstance(b, brain.ClaudeBrain)
        first = NS(stop_reason="tool_use", content=[
            NS(type="text", text="On it."),
            NS(type="tool_use", id="tu_1", name="set_volume", input={"level": 30})])
        second = NS(stop_reason="end_turn", content=[NS(type="text", text="Volume is at 30.")])
        with mock.patch.object(b.client.beta.messages, "create", side_effect=[first, second]) as create, \
                mock.patch.object(mac, "applescript", return_value=""):
            turn = b.ask("volume 30")
        self.assertEqual(turn.reply, "Volume is at 30.")
        kwargs = create.call_args.kwargs
        self.assertEqual(kwargs["model"], "claude-opus-5-5")
        self.assertEqual(kwargs["fallbacks"], "default")
        results = kwargs["messages"][2]["content"]
        self.assertEqual(results[0]["tool_use_id"], "tu_1")
        self.assertFalse(results[0]["is_error"])

    def test_haiku_skips_fallbacks(self):
        from types import SimpleNamespace as NS

        os.environ.update(ANTHROPIC_API_KEY="test-key", JARVIS_CLAUDE_MODEL="claude-haiku-5-5")
        try:
            b = brain.make_brain(load_config())
        finally:
            os.environ.pop("ANTHROPIC_API_KEY")
            os.environ.pop("JARVIS_CLAUDE_MODEL")
        done = NS(stop_reason="end_turn", content=[NS(type="text", text="Hi.")])
        with mock.patch.object(b.client.beta.messages, "create", return_value=done) as create:
            b.ask("hi")
        self.assertNotIn("fallbacks", create.call_args.kwargs)


class ServerAuthTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ["JARVIS_OLLAMA_URL"] = "http://127.0.0.1:9"
        cls.app = server.Jarvis()
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), server.make_handler(cls.app, 0))
        port = cls.srv.server_port
        cls.srv.RequestHandlerClass = server.make_handler(cls.app, port)
        cls.base = f"http://localhost:{port}"
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def req(self, path, data=None, headers=None):
        r = urllib.request.Request(self.base + path, data=data, headers=headers or {})
        try:
            with urllib.request.urlopen(r, timeout=10) as resp:
                return resp.status, resp.read().decode()
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode()

    def test_page_embeds_token(self):
        status, html = self.req("/")
        self.assertEqual(status, 200)
        self.assertIn(server.TOKEN, html)
        self.assertNotIn("__JARVIS_TOKEN__", html)

    def test_api_requires_token(self):
        body = json.dumps({"text": "open safari"}).encode()
        self.assertEqual(self.req("/api/text", body, {"Content-Type": "application/json"})[0], 401)
        self.assertEqual(self.req("/api/status")[0], 401)

    def test_api_with_token(self):
        status, data = self.req("/api/status", headers={"X-Jarvis-Token": server.TOKEN})
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(data)["brain"], "Ollama")
        status, data = self.req("/api/text", json.dumps({"text": "hi"}).encode(),
                                {"X-Jarvis-Token": server.TOKEN, "Content-Type": "application/json"})
        self.assertEqual(status, 200)
        self.assertIn("Ollama isn't running", json.loads(data)["reply"])

    def test_crash_returns_json_error(self):
        with mock.patch.object(self.app.ears, "transcribe", side_effect=RuntimeError("model download failed")):
            status, data = self.req("/api/audio", b"x" * 3000,
                                    {"X-Jarvis-Token": server.TOKEN, "Content-Type": "audio/webm"})
        self.assertEqual(status, 500)
        self.assertIn("model download failed", json.loads(data)["error"])

    def test_rejects_foreign_host(self):
        status, _ = self.req("/", headers={"Host": "evil.example:80"})
        self.assertEqual(status, 403)


if __name__ == "__main__":
    unittest.main()
