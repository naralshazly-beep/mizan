"""Hold a key anywhere on the Mac to talk to Jarvis. No browser needed.

Listens only to modifier-key changes through a Quartz event tap (listen-only, it never
blocks or changes your typing) and records from the default microphone with sounddevice.
"""

from __future__ import annotations

import subprocess
import threading
from typing import Callable

# key name -> (virtual keycode, the modifier flag that key sets)
KEYS = {
    "right_option": (61, "kCGEventFlagMaskAlternate"),
    "right_command": (54, "kCGEventFlagMaskCommand"),
    "right_shift": (60, "kCGEventFlagMaskShift"),
    "right_control": (62, "kCGEventFlagMaskControl"),
    "fn": (63, "kCGEventFlagMaskSecondaryFn"),
}

SAMPLE_RATE = 16000
_START_SOUND = "/System/Library/Sounds/Tink.aiff"
_STOP_SOUND = "/System/Library/Sounds/Pop.aiff"


def _chime(path: str) -> None:
    try:
        subprocess.Popen(["afplay", path])
    except OSError:
        pass


class PushToTalk:
    def __init__(self, key: str, on_audio: Callable[[object], None], on_start: Callable[[], None] | None = None) -> None:
        if key not in KEYS:
            raise ValueError(f"Unknown hotkey {key!r}. Choose one of: {', '.join(KEYS)}")
        self.key = key
        self.on_audio = on_audio
        self.on_start = on_start
        self._stream = None
        self._chunks: list = []
        self._down = False
        self._tap = None

    def start(self) -> bool:
        """Start listening in a background thread. Returns False if it can't on this machine."""
        try:
            import Quartz  # noqa: F401
            import sounddevice  # noqa: F401
        except ImportError as exc:
            print(f"  Push-to-talk is off ({exc.name} not installed: pip install -r requirements.txt).")
            return False
        ready = threading.Event()
        ok: list[bool] = []
        threading.Thread(target=self._run, args=(ready, ok), daemon=True, name="jarvis-hotkey").start()
        ready.wait(5)
        return bool(ok and ok[0])

    # ------------------------------------------------------------ event tap
    def _run(self, ready: threading.Event, ok: list[bool]) -> None:
        import Quartz

        keycode, flag_name = KEYS[self.key]
        flag = getattr(Quartz, flag_name)

        def callback(_proxy, event_type, event, _refcon):
            if event_type in (Quartz.kCGEventTapDisabledByTimeout, Quartz.kCGEventTapDisabledByUserInput):
                Quartz.CGEventTapEnable(self._tap, True)
                return event
            if Quartz.CGEventGetIntegerValueField(event, Quartz.kCGKeyboardEventKeycode) == keycode:
                pressed = bool(Quartz.CGEventGetFlags(event) & flag)
                if pressed and not self._down:
                    self._down = True
                    self._begin()
                elif not pressed and self._down:
                    self._down = False
                    self._end()
            return event

        self._tap = Quartz.CGEventTapCreate(
            Quartz.kCGSessionEventTap,
            Quartz.kCGHeadInsertEventTap,
            Quartz.kCGEventTapOptionListenOnly,
            Quartz.CGEventMaskBit(Quartz.kCGEventFlagsChanged),
            callback,
            None,
        )
        if self._tap is None:
            print(
                "  Push-to-talk needs permission: System Settings > Privacy & Security > "
                "Input Monitoring (and Accessibility) > allow Terminal or Python, then restart Jarvis."
            )
            ok.append(False)
            ready.set()
            return
        source = Quartz.CFMachPortCreateRunLoopSource(None, self._tap, 0)
        Quartz.CFRunLoopAddSource(Quartz.CFRunLoopGetCurrent(), source, Quartz.kCFRunLoopCommonModes)
        Quartz.CGEventTapEnable(self._tap, True)
        ok.append(True)
        ready.set()
        Quartz.CFRunLoopRun()

    # ------------------------------------------------------------ recording
    def _begin(self) -> None:
        import sounddevice as sd

        if self._stream is not None:
            return
        self._chunks = []
        try:
            self._stream = sd.InputStream(
                samplerate=SAMPLE_RATE, channels=1, dtype="float32",
                callback=lambda data, frames, time, status: self._chunks.append(data.copy()),
            )
            self._stream.start()
        except Exception as exc:  # noqa: BLE001 - no mic, or mic permission denied
            print(f"  Microphone error: {exc}. Allow the microphone in Privacy & Security.")
            self._stream = None
            return
        _chime(_START_SOUND)
        if self.on_start:
            self.on_start()

    def _end(self) -> None:
        import numpy as np

        stream, self._stream = self._stream, None
        if stream is None:
            return
        stream.stop()
        stream.close()
        _chime(_STOP_SOUND)
        if not self._chunks:
            return
        audio = np.concatenate(self._chunks).reshape(-1)
        threading.Thread(target=self.on_audio, args=(audio,), daemon=True).start()
