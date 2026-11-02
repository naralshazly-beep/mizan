"""Start Jarvis automatically at login, in the background (macOS LaunchAgent).

    python -m assistant install     # start now and at every login
    python -m assistant uninstall   # stop and remove
    python -m assistant logs        # show the latest log lines
"""

from __future__ import annotations

import os
import plistlib
import subprocess
import sys
from pathlib import Path

from .config import DATA_DIR, ROOT
from .mac import IS_MAC

LABEL = "com.jarvis.assistant"
PLIST = Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"
LOG = DATA_DIR / "jarvis.log"


def _launchctl(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["launchctl", *args], capture_output=True, text=True)


def install() -> None:
    if not IS_MAC:
        sys.exit("Autostart only works on macOS.")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PLIST.parent.mkdir(parents=True, exist_ok=True)
    plist = {
        "Label": LABEL,
        # The venv's python, so all the installed packages are there.
        "ProgramArguments": [sys.executable, "-m", "assistant", "--no-browser"],
        "WorkingDirectory": str(ROOT),
        "RunAtLoad": True,
        "KeepAlive": {"SuccessfulExit": False},  # restart if it crashes, not if you quit it
        "ThrottleInterval": 10,
        "ProcessType": "Interactive",
        "StandardOutPath": str(LOG),
        "StandardErrorPath": str(LOG),
        "EnvironmentVariables": {
            "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
            "PYTHONUNBUFFERED": "1",
            "LANG": "en_US.UTF-8",
        },
    }
    domain = f"gui/{os.getuid()}"
    _launchctl("bootout", f"{domain}/{LABEL}")  # replace an older install
    PLIST.write_bytes(plistlib.dumps(plist))
    result = _launchctl("bootstrap", domain, str(PLIST))
    if result.returncode != 0:
        sys.exit(f"launchctl failed: {result.stderr.strip()}")
    print(
        "\n  ✅ Jarvis now runs in the background and starts by itself when you log in.\n"
        "     Hold Right Option anywhere to talk. Web panel: http://localhost:8765\n"
        f"     Logs: {LOG}\n\n"
        "  The first time, macOS asks to allow 'Python' for the Microphone, Input Monitoring,\n"
        "  Accessibility and Screen Recording. Allow them, then run this once more:\n"
        "     python -m assistant install\n"
    )


def uninstall() -> None:
    _launchctl("bootout", f"gui/{os.getuid()}/{LABEL}")
    PLIST.unlink(missing_ok=True)
    print("  Jarvis no longer starts at login, and the background copy is stopped.")


def logs() -> None:
    if not LOG.exists():
        print("  No log yet.")
        return
    lines = LOG.read_text(encoding="utf-8", errors="replace").splitlines()
    print("\n".join(lines[-40:]))
