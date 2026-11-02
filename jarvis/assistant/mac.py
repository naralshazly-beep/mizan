"""Thin wrappers around macOS command-line tools (osascript, open, mdfind, screencapture).

Every AppleScript receives user-controlled values through `argv`, never by string
interpolation, so a song title or email body can't inject script code.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

IS_MAC = sys.platform == "darwin"


class MacError(RuntimeError):
    pass


def require_mac() -> None:
    if not IS_MAC:
        raise MacError("This action only works on macOS.")


def run(cmd: list[str], timeout: float = 20) -> str:
    require_mac()
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        raise MacError(f"{cmd[0]} timed out") from exc
    if proc.returncode != 0:
        msg = (proc.stderr or proc.stdout).strip() or f"{cmd[0]} failed"
        raise MacError(_explain(msg))
    return proc.stdout.strip()


def applescript(script: str, *args: str | int, timeout: float = 20) -> str:
    return run(["osascript", "-e", script, *[str(a) for a in args]], timeout=timeout)


def _explain(msg: str) -> str:
    """Turn the most common macOS permission errors into an actionable hint."""
    if "-1743" in msg or "Not authorized to send Apple events" in msg:
        return msg + " (Allow it in System Settings > Privacy & Security > Automation.)"
    if "-1719" in msg or "-25211" in msg or "assistive access" in msg:
        return msg + " (Allow your terminal in System Settings > Privacy & Security > Accessibility.)"
    return msg


# ---------------------------------------------------------------- screen

def screen_bounds() -> tuple[int, int, int, int]:
    """Usable desktop rectangle (left, top, right, bottom) of the main display."""
    out = applescript('tell application "Finder" to get bounds of window of desktop')
    left, top, right, bottom = (int(x.strip()) for x in out.split(","))
    return left, top + 25, right, bottom  # leave room for the menu bar


def screenshot(max_side: int = 1600) -> Path:
    """Capture the whole screen silently and shrink it to a JPEG."""
    require_mac()
    path = Path(tempfile.gettempdir()) / "jarvis-screen.png"
    run(["screencapture", "-x", "-C", str(path)])
    jpg = path.with_suffix(".jpg")
    run(["sips", "-Z", str(max_side), "-s", "format", "jpeg", str(path), "--out", str(jpg)])
    if jpg.stat().st_size < 2048:
        raise MacError(
            "The screenshot came back empty. Allow your terminal in System Settings > "
            "Privacy & Security > Screen Recording, then restart it."
        )
    return jpg


def ocr(image: Path) -> str:
    """On-device text recognition with Apple's Vision framework (Arabic + English)."""
    require_mac()
    try:
        import Vision  # type: ignore[import-not-found]
        from Foundation import NSURL  # type: ignore[import-not-found]
    except ImportError as exc:
        raise MacError("Install pyobjc-framework-Vision to read the screen.") from exc

    def recognize(languages: list[str]) -> list[str]:
        request = Vision.VNRecognizeTextRequest.alloc().init()
        request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
        request.setRecognitionLanguages_(languages)
        request.setUsesLanguageCorrection_(True)
        handler = Vision.VNImageRequestHandler.alloc().initWithURL_options_(
            NSURL.fileURLWithPath_(str(image)), None
        )
        ok, error = handler.performRequests_error_([request], None)
        if not ok:
            raise MacError(f"Text recognition failed: {error}")
        return [obs.topCandidates_(1)[0].string() for obs in (request.results() or [])]

    try:
        lines = recognize(["ar-SA", "en-US"])  # Arabic needs macOS 14+
    except Exception:  # noqa: BLE001 - older macOS rejects Arabic; fall back to English
        lines = recognize(["en-US"])
    return "\n".join(lines)
