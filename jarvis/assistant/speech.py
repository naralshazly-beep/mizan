"""Speech in (local Whisper) and speech out (neural voices, or macOS `say` offline)."""

from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
import threading
import urllib.error
import urllib.request
from pathlib import Path

from .mac import IS_MAC

_ARABIC = re.compile(r"[؀-ۿ]")


def is_arabic(text: str) -> bool:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    return sum(1 for c in letters if _ARABIC.match(c)) / len(letters) > 0.3


def decode_audio(path: Path, sampling_rate: int = 16000):
    """Decode any browser recording to 16 kHz mono float32.

    We do this ourselves instead of letting faster-whisper do it, because its
    decoder passes an argument that newer PyAV releases removed.
    """
    import av
    import numpy as np

    resampler = av.AudioResampler(format="s16", layout="mono", rate=sampling_rate)
    chunks = []
    with av.open(str(path)) as container:
        stream = container.streams.audio[0]
        for frame in container.decode(stream):
            chunks.extend(f.to_ndarray() for f in resampler.resample(frame))
        chunks.extend(f.to_ndarray() for f in resampler.resample(None))
    if not chunks:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(chunks, axis=1).reshape(-1).astype(np.float32) / 32768.0


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
        """Transcribe a browser recording. Returns (text, language code)."""
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio)
            path = Path(tmp.name)
        try:
            return self.transcribe_array(decode_audio(path))
        finally:
            path.unlink(missing_ok=True)

    def transcribe_array(self, audio_array) -> tuple[str, str]:
        """Transcribe 16 kHz mono float32 samples. Returns (text, language code)."""
        if audio_array.size < 4800:  # under 0.3 s: nothing was said
            return "", ""
        with self._lock:
            model = self._load()
            segments, info = model.transcribe(
                audio_array,
                beam_size=5,
                vad_filter=True,
                # Nudges recognition toward the languages and words we expect.
                initial_prompt="Jarvis. افتح سفاري. شغل ويجز على يوتيوب. Open Safari.",
            )
            text = " ".join(s.text.strip() for s in segments).strip()
        return text, info.language


# --------------------------------------------------------------- voices

VOICES: dict[str, dict] = {
    "dark": {
        "label": "Dark · غامض ومرعب",
        "ar": "ar-EG-ShakirNeural", "en": "en-US-ChristopherNeural",
        "rate": "-12%", "pitch": "-30Hz", "echo": True,
        "style": "Persona: a calm, deep, slightly ominous AI from a thriller film. Few words, a little "
                 "mysterious, never silly, always helpful. In Arabic speak Egyptian dialect.",
    },
    "egyptian": {
        "label": "Egyptian · مصري",
        "ar": "ar-EG-ShakirNeural", "en": "en-US-GuyNeural", "rate": "+5%", "pitch": "+0Hz",
        "style": "In Arabic speak casual Egyptian dialect, like a friend.",
    },
    "egyptian_female": {
        "label": "Egyptian female · مصري بنت",
        "ar": "ar-EG-SalmaNeural", "en": "en-US-JennyNeural", "rate": "+5%", "pitch": "+0Hz",
        "style": "In Arabic speak casual Egyptian dialect, like a friend.",
    },
    "libyan": {
        "label": "Libyan · ليبي",
        "ar": "ar-LY-OmarNeural", "en": "en-US-GuyNeural", "rate": "+0%", "pitch": "+0Hz",
        "style": "In Arabic speak Libyan dialect (اللهجة الليبية) naturally.",
    },
    # ElevenLabs: the most human-sounding voices. Needs ELEVENLABS_API_KEY in .env.
    # Default voice ids are ElevenLabs' built-in voices; put any Voice Library id
    # (for example an Egyptian voice) in JARVIS_ELEVENLABS_VOICE / _DARK_VOICE.
    "eleven_dark": {
        "label": "ElevenLabs · Dark غامض",
        "engine": "elevenlabs", "voice_env": "JARVIS_ELEVENLABS_DARK_VOICE",
        "voice_id": "N2lVS1w4EtoT3dr4eOWO",  # "Callum": husky, intense
        "settings": {"stability": 0.55, "similarity_boost": 0.8, "style": 0.25, "use_speaker_boost": True, "speed": 0.9},
        "echo": True, "fallback": "dark",
        "style": "Persona: a calm, deep, slightly ominous AI from a thriller film. Few words, a little "
                 "mysterious, never silly, always helpful. In Arabic speak Egyptian dialect.",
    },
    "eleven": {
        "label": "ElevenLabs · مصري",
        "engine": "elevenlabs", "voice_env": "JARVIS_ELEVENLABS_VOICE",
        "voice_id": "pNInz6obpgDQGcFmaJgB",  # "Adam"; swap for an Egyptian voice from the Voice Library
        "settings": {"stability": 0.4, "similarity_boost": 0.8, "style": 0.35, "use_speaker_boost": True},
        "fallback": "egyptian",
        "style": "In Arabic speak casual Egyptian dialect, like a friend.",
    },
    "mac": {
        "label": "Mac voice (offline)",
        "style": "In Arabic speak Egyptian dialect.",
    },
}


def voice_style(name: str) -> str:
    return VOICES.get(name, VOICES["dark"])["style"]


def has_elevenlabs() -> bool:
    return bool(os.environ.get("ELEVENLABS_API_KEY"))


def available_voices() -> dict[str, str]:
    """Voices to offer in the HUD (ElevenLabs ones only once a key is set)."""
    return {k: v["label"] for k, v in VOICES.items() if v.get("engine") != "elevenlabs" or has_elevenlabs()}


def elevenlabs_tts(text: str, preset: dict, out: Path) -> Path:
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        raise RuntimeError("ELEVENLABS_API_KEY isn't set in .env")
    voice_id = os.environ.get(preset["voice_env"]) or preset["voice_id"]
    model = os.environ.get("JARVIS_ELEVENLABS_MODEL", "eleven_multilingual_v2")
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128",
        data=json.dumps({"text": text, "model_id": model, "voice_settings": preset["settings"]}).encode(),
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            out.write_bytes(resp.read())
    except urllib.error.HTTPError as exc:
        try:
            detail = json.loads(exc.read()).get("detail")
            message = detail.get("message") if isinstance(detail, dict) else str(detail)
        except (ValueError, AttributeError):
            message = exc.reason
        raise RuntimeError(f"ElevenLabs error {exc.code}: {message}") from exc
    return out


def add_echo(src: Path, dst: Path) -> None:
    """Deep hall echo for the dark voice, done with PyAV's ffmpeg filters."""
    import av

    with av.open(str(src)) as inp, av.open(str(dst), mode="w", format="wav") as out:
        ist = inp.streams.audio[0]
        ost = out.add_stream("pcm_s16le", rate=ist.rate, layout="mono")
        graph = av.filter.Graph()
        source = graph.add_abuffer(template=ist)
        echo = graph.add("aecho", "0.8:0.7:90|180:0.35|0.2")
        fmt = graph.add("aformat", "sample_fmts=s16:channel_layouts=mono")
        sink = graph.add("abuffersink")
        source.link_to(echo)
        echo.link_to(fmt)
        fmt.link_to(sink)
        graph.configure()

        def drain() -> None:
            while True:
                try:
                    frame = sink.pull()
                except (av.BlockingIOError, av.EOFError):
                    return
                frame.pts = None
                for packet in ost.encode(frame):
                    out.mux(packet)

        for frame in inp.decode(ist):
            source.push(frame)
            drain()
        source.push(None)
        drain()
        for packet in ost.encode(None):
            out.mux(packet)


class Speaker:
    """Speaks replies.

    Neural voices (Egyptian, Libyan, the dark preset) come from Microsoft's free online
    text-to-speech via `edge-tts` and need internet; the reply text is sent to Microsoft.
    If that fails, or the "mac" voice is chosen, it falls back to the built-in `say`.
    """

    def __init__(self, enabled: bool, voice: str = "dark") -> None:
        self.enabled = enabled and IS_MAC
        self.voice = voice if voice in VOICES else "dark"
        self._proc: subprocess.Popen | None = None
        self._generation = 0
        self._lock = threading.Lock()
        self._mac_voices: set[str] | None = None

    def set_voice(self, voice: str) -> None:
        if voice in VOICES:
            self.voice = voice

    def say(self, text: str) -> None:
        if not self.enabled or not text.strip():
            return
        self.stop()
        with self._lock:
            self._generation += 1
            generation = self._generation
        threading.Thread(target=self._speak, args=(text, generation), daemon=True).start()

    def stop(self) -> None:
        with self._lock:
            self._generation += 1
            if self._proc and self._proc.poll() is None:
                self._proc.terminate()
            self._proc = None

    # ------------------------------------------------------------ internals
    def _play(self, cmd: list[str], generation: int) -> None:
        with self._lock:
            if generation != self._generation:
                return  # a newer reply (or stop) came in while we were preparing audio
            self._proc = subprocess.Popen(cmd)

    def _speak(self, text: str, generation: int) -> None:
        preset = VOICES[self.voice]
        # Try the chosen voice, then its fallback (ElevenLabs -> free Microsoft voice), then `say`.
        chain = [preset]
        if preset.get("fallback"):
            chain.append(VOICES[preset["fallback"]])
        for candidate in chain:
            if "ar" not in candidate and candidate.get("engine") != "elevenlabs":
                continue
            try:
                audio = self._neural(text, candidate)
                self._play(["afplay", str(audio)], generation)
                return
            except Exception as exc:  # noqa: BLE001 - no internet, quota used up, package missing, ...
                print(f"  ({candidate['label']} voice failed: {exc})")
        self._play(self._say_cmd(text), generation)

    @staticmethod
    def _neural(text: str, preset: dict) -> Path:
        out = Path(tempfile.gettempdir()) / "jarvis-voice.mp3"
        if preset.get("engine") == "elevenlabs":
            elevenlabs_tts(text, preset, out)
        else:
            import edge_tts

            voice = preset["ar"] if is_arabic(text) else preset["en"]
            edge_tts.Communicate(text, voice, rate=preset["rate"], pitch=preset["pitch"]).save_sync(str(out))
        if preset.get("echo"):
            wet = out.with_suffix(".wav")
            add_echo(out, wet)
            return wet
        return out

    def _say_cmd(self, text: str) -> list[str]:
        cmd = ["say"]
        if is_arabic(text):
            if self._mac_voices is None:
                try:
                    out = subprocess.run(["say", "-v", "?"], capture_output=True, text=True, timeout=10).stdout
                    self._mac_voices = {line.split()[0] for line in out.splitlines() if line.strip()}
                except (OSError, subprocess.SubprocessError):
                    self._mac_voices = set()
            for voice in ("Majed", "Tarik", "Maged"):
                if voice in self._mac_voices:
                    cmd += ["-v", voice]
                    break
        return [*cmd, text]
