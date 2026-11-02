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


class YouTubeParseTest(unittest.TestCase):
    def test_search_and_channel_and_feed(self):
        from assistant import youtube

        page = ('{"adSlotRenderer":{"videoId":"AAAAAAAAAAA"}}'
                '{"videoRenderer":{"videoId":"abc123DEF45","thumbnail":{},'
                '"title":{"runs":[{"text":"\\u0648\\u064a\\u062c\\u0632 - Wegz"}]}}}'
                '{"videoRenderer":{"videoId":"zzz123DEF45","title":{"runs":[{"text":"second"}]}}}')
        videos = youtube.parse_search_videos(page)
        self.assertEqual(videos[0].id, "abc123DEF45")
        self.assertEqual(videos[0].title, "ويجز - Wegz")
        self.assertEqual(videos[0].url(mix=True), "https://www.youtube.com/watch?v=abc123DEF45&list=RDabc123DEF45")

        chan = '{"channelRenderer":{"channelId":"UCabcdefghijklmnopqrstuv","title":{"simpleText":"فيلم في الخمسينة"}}}'
        self.assertEqual(youtube.parse_search_channels(chan)[0].title, "فيلم في الخمسينة")

        feed = """<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"
            xmlns:yt="http://www.youtube.com/xml/schemas/2015">
            <entry><yt:videoId>NEWEST00001</yt:videoId><title>ملخص فيلم جديد</title></entry>
            <entry><yt:videoId>OLDER000002</yt:videoId><title>older</title></entry></feed>"""
        self.assertEqual([v.id for v in youtube.parse_feed(feed)], ["NEWEST00001", "OLDER000002"])

    def test_latest_from_channel_caches_channel(self):
        from assistant import youtube

        with mock.patch.object(mac, "require_mac"), \
                mock.patch.object(youtube, "find_channel", return_value=youtube.Channel("UCx", "Film")) as find, \
                mock.patch.object(youtube, "latest_videos", return_value=[youtube.Video("v1xxxxxxxxx", "Newest")]), \
                mock.patch.object(tools, "_open_youtube") as opened:
            self.assertTrue(tools.execute("play_latest_from_channel", {"channel": "فيلم في الخمسينة"}).ok)
            self.assertTrue(tools.execute("play_latest_from_channel", {"channel": "فيلم في الخمسينة"}).ok)
        self.assertEqual(find.call_count, 1)  # second time comes from the saved profile
        opened.assert_called_with("https://www.youtube.com/watch?v=v1xxxxxxxxx")


class MemoryTest(unittest.TestCase):
    def test_remember_and_forget(self):
        from assistant.settings import get_profile

        tools.execute("remember", {"fact": "Likes Wegz, Lege-Cy and Ramy Sabry"})
        self.assertIn("Likes Wegz, Lege-Cy and Ramy Sabry", get_profile()["facts"])
        self.assertIn("Likes Wegz", brain._context_note())
        tools.execute("forget", {"fact": "wegz"})
        self.assertEqual(get_profile()["facts"], [])


class VoiceTest(unittest.TestCase):
    def test_voice_style_in_context(self):
        from assistant.settings import update_settings

        update_settings(voice="libyan")
        self.assertIn("Libyan", brain._context_note())
        update_settings(voice="dark")

    def test_echo_effect(self):
        try:
            import av
            import numpy as np
        except ImportError:
            self.skipTest("PyAV not installed")
        from assistant.speech import add_echo

        d = Path(tempfile.mkdtemp())
        with av.open(str(d / "in.mp3"), "w") as out:
            stream = out.add_stream("mp3", rate=24000, layout="mono")
            tone = (np.sin(2 * np.pi * 200 * np.arange(24000) / 24000) * 9000).astype(np.int16).reshape(1, -1)
            frame = av.AudioFrame.from_ndarray(tone, format="s16", layout="mono")
            frame.sample_rate = 24000
            for packet in stream.encode(frame):
                out.mux(packet)
            for packet in stream.encode(None):
                out.mux(packet)
        add_echo(d / "in.mp3", d / "out.wav")
        with av.open(str(d / "out.wav")) as c:
            self.assertGreater(c.duration / 1e6, 1.0)

    def test_neural_failure_falls_back_to_say(self):
        from assistant import speech

        spk = speech.Speaker(enabled=False, voice="egyptian")
        spk.enabled = True
        spk._mac_voices = {"Majed"}
        with mock.patch.object(speech.Speaker, "_neural", side_effect=OSError("offline")), \
                mock.patch.object(speech.subprocess, "Popen") as popen:
            spk._speak("أهلا", spk._generation)
        self.assertEqual(popen.call_args.args[0], ["say", "-v", "Majed", "أهلا"])


class DotenvTest(unittest.TestCase):
    def test_later_line_wins(self):
        from assistant import config

        path = Path(tempfile.mkdtemp()) / ".env"
        path.write_text("JARVIS_T_MODEL=claude-opus-5-5\nJARVIS_T_MODEL=claude-haiku-5-5\n", encoding="utf-8")
        os.environ.pop("JARVIS_T_MODEL", None)
        try:
            config._load_dotenv(path)
            self.assertEqual(os.environ["JARVIS_T_MODEL"], "claude-haiku-5-5")
        finally:
            os.environ.pop("JARVIS_T_MODEL", None)


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

    def test_change_voice(self):
        hdr = {"X-Jarvis-Token": server.TOKEN, "Content-Type": "application/json"}
        status, _ = self.req("/api/settings", json.dumps({"voice": "egyptian"}).encode(), hdr)
        self.assertEqual(status, 200)
        status, data = self.req("/api/status", headers={"X-Jarvis-Token": server.TOKEN})
        self.assertEqual(json.loads(data)["voice"], "egyptian")
        self.assertEqual(self.req("/api/settings", json.dumps({"voice": "robot"}).encode(), hdr)[0], 400)
        self.req("/api/settings", json.dumps({"voice": "dark"}).encode(), hdr)

    def test_rejects_foreign_host(self):
        status, _ = self.req("/", headers={"Host": "evil.example:80"})
        self.assertEqual(status, 403)


if __name__ == "__main__":
    unittest.main()
