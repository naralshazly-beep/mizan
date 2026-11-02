"""The actions Jarvis can take on the Mac, described once for both brains."""

from __future__ import annotations

import json
import subprocess
import urllib.parse
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from . import mac, youtube
from .settings import get_profile, save_profile
from .config import DATA_DIR

# --------------------------------------------------------------- results


@dataclass
class ToolResult:
    text: str
    ok: bool = True
    image: Path | None = None  # attached for brains that can see (Claude)


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict[str, Any]
    run: Callable[..., ToolResult]
    required: list[str] = field(default_factory=list)

    def schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": self.parameters,
            "required": self.required,
            "additionalProperties": False,
        }


# --------------------------------------------------------------- apps & windows


def open_app(name: str) -> ToolResult:
    mac.run(["open", "-a", name])
    return ToolResult(f"Opened {name}.")


def quit_app(name: str) -> ToolResult:
    mac.applescript("on run argv\ntell application (item 1 of argv) to quit\nend run", name)
    return ToolResult(f"Quit {name}.")


_LAYOUTS = {
    # fractions of the usable screen: x, y, width, height
    "left": (0, 0, 0.5, 1),
    "right": (0.5, 0, 0.5, 1),
    "top": (0, 0, 1, 0.5),
    "bottom": (0, 0.5, 1, 0.5),
    "full": (0, 0, 1, 1),
    "center": (0.15, 0.1, 0.7, 0.8),
}

_ARRANGE = """
on run argv
  set appName to item 1 of argv
  tell application "System Events"
    if appName is "" then set appName to name of first application process whose frontmost is true
    tell process appName
      set frontmost to true
      set w to front window
      if item 2 of argv is "minimize" then
        set value of attribute "AXMinimized" of w to true
      else
        set position of w to {(item 2 of argv) as integer, (item 3 of argv) as integer}
        set size of w to {(item 4 of argv) as integer, (item 5 of argv) as integer}
      end if
    end tell
  end tell
  return appName
end run
"""


def arrange_window(position: str, app: str = "") -> ToolResult:
    if position == "minimize":
        target = mac.applescript(_ARRANGE, app, "minimize")
        return ToolResult(f"Minimized {target}.")
    if position not in _LAYOUTS:
        return ToolResult(f"Unknown position {position!r}.", ok=False)
    if app:
        mac.run(["open", "-a", app])  # make sure it is running and has a window
    left, top, right, bottom = mac.screen_bounds()
    width, height = right - left, bottom - top
    fx, fy, fw, fh = _LAYOUTS[position]
    target = mac.applescript(
        _ARRANGE,
        app,
        int(left + fx * width),
        int(top + fy * height),
        int(fw * width),
        int(fh * height),
    )
    return ToolResult(f"Moved {target} to the {position}.")


# --------------------------------------------------------------- files & web

_KINDS = {
    "folder": "kind:folder",
    "document": "kind:document",
    "image": "kind:image",
    "pdf": "kind:pdf",
    "presentation": "kind:presentation",
    "spreadsheet": "kind:spreadsheet",
}


def find_files(query: str, kind: str = "any", limit: int = 10) -> ToolResult:
    limit = max(1, min(int(limit), 30))
    if kind in _KINDS:
        cmd = ["mdfind", "-onlyin", str(Path.home()), f"{query} {_KINDS[kind]}"]
    else:
        cmd = ["mdfind", "-onlyin", str(Path.home()), "-name", query]
    hits = [h for h in mac.run(cmd, timeout=15).splitlines() if "/Library/" not in h]
    if not hits:
        return ToolResult(f"No files found for {query!r}.")
    return ToolResult("\n".join(hits[:limit]))


def open_path(path: str) -> ToolResult:
    target = Path(path).expanduser()
    if not target.exists():
        return ToolResult(f"{target} does not exist.", ok=False)
    mac.run(["open", str(target)])
    return ToolResult(f"Opened {target}.")


def open_url(url: str) -> ToolResult:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    mac.run(["open", url])
    return ToolResult(f"Opened {url}.")


def web_search(query: str) -> ToolResult:
    mac.run(["open", "https://www.google.com/search?q=" + urllib.parse.quote(query)])
    return ToolResult(f"Searched the web for {query!r}.")


# --------------------------------------------------------------- screen


def read_screen() -> ToolResult:
    image = mac.screenshot()
    text = mac.ocr(image).strip()
    if len(text) > 6000:
        text = text[:6000] + "\n…(truncated)"
    return ToolResult(text or "(No readable text on screen.)", image=image)


# --------------------------------------------------------------- music & volume

_MUSIC_SIMPLE = {
    "play": "play",
    "pause": "pause",
    "next": "next track",
    "previous": "previous track",
}

_PLAY_SONG = """
on run argv
  set q to item 1 of argv
  tell application "Music"
    set hits to (every track of library playlist 1 whose name contains q or artist contains q or album contains q)
    if (count of hits) is 0 then return ""
    set t to item 1 of hits
    play t
    return (name of t) & " - " & (artist of t)
  end tell
end run
"""


def music(action: str, query: str = "", player: str = "Music") -> ToolResult:
    player = "Spotify" if player.lower() == "spotify" else "Music"
    if action == "play_song":
        if not query:
            return ToolResult("Tell me which song or artist to play.", ok=False)
        if player == "Spotify":
            mac.run(["open", "spotify:search:" + urllib.parse.quote(query)])
            return ToolResult(f"Opened a Spotify search for {query!r}; press play on the result.")
        found = mac.applescript(_PLAY_SONG, query, timeout=30)
        if not found:
            return ToolResult(f"Nothing in the Music library matches {query!r}.", ok=False)
        return ToolResult(f"Playing {found}.")
    if action not in _MUSIC_SIMPLE:
        return ToolResult(f"Unknown music action {action!r}.", ok=False)
    mac.applescript(f'tell application "{player}" to {_MUSIC_SIMPLE[action]}')
    return ToolResult(f"{player}: {action}.")


def set_volume(level: int) -> ToolResult:
    level = max(0, min(int(level), 100))
    mac.applescript("on run argv\nset volume output volume ((item 1 of argv) as integer)\nend run", level)
    return ToolResult(f"Volume set to {level}%.")


# --------------------------------------------------------------- YouTube

_REUSE_TAB = """
on run argv
  set u to item 1 of argv
  tell application "System Events" to set isRunning to (exists process "Google Chrome")
  if not isRunning then return "no"
  tell application "Google Chrome"
    repeat with w in windows
      set i to 0
      repeat with t in tabs of w
        set i to i + 1
        if (URL of t) contains "youtube.com/watch" then
          set URL of t to u
          set active tab index of w to i
          set index of w to 1
          activate
          return "ok"
        end if
      end repeat
    end repeat
  end tell
  return "no"
end run
"""


def _open_youtube(url: str) -> None:
    """Reuse an open YouTube tab in Chrome when there is one, so tabs don't pile up."""
    try:
        if mac.applescript(_REUSE_TAB, url) == "ok":
            return
    except mac.MacError:
        pass
    mac.run(["open", url])


def play_youtube(query: str, mix: bool = False) -> ToolResult:
    mac.require_mac()
    try:
        video = youtube.search_video(query)
    except youtube.YouTubeError as exc:
        return ToolResult(str(exc), ok=False)
    _open_youtube(video.url(mix=mix))
    return ToolResult(f"Playing on YouTube{' (mix)' if mix else ''}: {video.title}")


def play_latest_from_channel(channel: str, which: int = 1) -> ToolResult:
    mac.require_mac()
    profile = get_profile()
    key = channel.strip().lower()
    try:
        cached = profile["channels"].get(key)
        if cached:
            channel_id, title = cached["id"], cached["title"]
        else:
            found = youtube.find_channel(channel)
            channel_id, title = found.id, found.title
            profile["channels"][key] = {"id": channel_id, "title": title}
            save_profile(profile)
        videos = youtube.latest_videos(channel_id)
    except youtube.YouTubeError as exc:
        return ToolResult(str(exc), ok=False)
    index = max(1, min(int(which), len(videos))) - 1
    video = videos[index]
    _open_youtube(video.url())
    return ToolResult(f"Playing the {'latest' if index == 0 else f'#{index + 1} newest'} video from {title}: {video.title}")


# --------------------------------------------------------------- memory about the user


def remember(fact: str) -> ToolResult:
    fact = fact.strip()
    if not fact:
        return ToolResult("Nothing to remember.", ok=False)
    profile = get_profile()
    if fact not in profile["facts"]:
        profile["facts"].append(fact)
        save_profile(profile)
    return ToolResult(f"Remembered: {fact}")


def forget(fact: str) -> ToolResult:
    profile = get_profile()
    needle = fact.strip().lower()
    kept = [f for f in profile["facts"] if needle not in f.lower()]
    if len(kept) == len(profile["facts"]):
        return ToolResult(f"I don't have anything saved about {fact!r}.", ok=False)
    profile["facts"] = kept
    save_profile(profile)
    return ToolResult(f"Forgot what I knew about {fact!r}.")


# --------------------------------------------------------------- email (Mail.app)

_LIST_MAIL = """
on run argv
  set wanted to (item 1 of argv) as integer
  set unreadOnly to (item 2 of argv) is "1"
  set RS to character id 30
  set US to character id 31
  set out to ""
  set n to 0
  tell application "Mail"
    repeat with m in (messages of inbox)
      if (not unreadOnly) or (read status of m is false) then
        set body to content of m
        if length of body > 400 then set body to text 1 thru 400 of body
        set out to out & (id of m) & US & (sender of m) & US & (subject of m) & US & ((date received of m) as string) & US & body & RS
        set n to n + 1
        if n ≥ wanted then exit repeat
      end if
    end repeat
  end tell
  return out
end run
"""

_DRAFT_REPLY = """
on run argv
  set wantedId to (item 1 of argv) as integer
  tell application "Mail"
    set m to first message of inbox whose id is wantedId
    set r to reply m with opening window
    set content of r to (item 2 of argv)
    activate
  end tell
end run
"""


def list_emails(count: int = 5, unread_only: bool = True) -> ToolResult:
    count = max(1, min(int(count), 15))
    raw = mac.applescript(_LIST_MAIL, count, "1" if unread_only else "0", timeout=60)
    rows = [r for r in raw.split("\x1e") if r.strip()]
    if not rows:
        return ToolResult("No matching emails in the inbox.")
    out = []
    for row in rows:
        msg_id, sender, subject, date, body = (row.split("\x1f") + [""] * 5)[:5]
        snippet = " ".join(body.split())[:300]
        out.append(f"id={msg_id} | from: {sender} | subject: {subject} | {date}\n  {snippet}")
    return ToolResult("\n".join(out))


def draft_email_reply(message_id: int, body: str) -> ToolResult:
    mac.applescript(_DRAFT_REPLY, int(message_id), body, timeout=30)
    return ToolResult("Reply drafted and opened in Mail. It has NOT been sent; the user reviews and sends it.")


# --------------------------------------------------------------- keyboard & Shortcuts app

_MODIFIERS = {
    "cmd": "command down", "command": "command down",
    "shift": "shift down",
    "alt": "option down", "option": "option down", "opt": "option down",
    "ctrl": "control down", "control": "control down",
}
_KEY_CODES = {
    "return": 36, "enter": 36, "tab": 48, "space": 49, "delete": 51, "backspace": 51,
    "escape": 53, "esc": 53, "left": 123, "right": 124, "down": 125, "up": 126,
    "f1": 122, "f2": 120, "f3": 99, "f4": 118, "f5": 96, "f6": 97,
    "f7": 98, "f8": 100, "f9": 101, "f10": 109, "f11": 103, "f12": 111,
}


def press_keys(keys: str) -> ToolResult:
    parts = [p.strip().lower() for p in keys.replace(" ", "").split("+") if p.strip()]
    if not parts:
        return ToolResult("No keys given.", ok=False)
    *mods, key = parts
    unknown = [m for m in mods if m not in _MODIFIERS]
    if unknown:
        return ToolResult(f"Unknown modifier(s): {', '.join(unknown)}.", ok=False)
    using = ""
    if mods:
        using = " using {" + ", ".join(dict.fromkeys(_MODIFIERS[m] for m in mods)) + "}"
    if key in _KEY_CODES:
        script = f'tell application "System Events" to key code {_KEY_CODES[key]}{using}'
        mac.applescript(script)
    elif len(key) == 1:
        script = f'on run argv\ntell application "System Events" to keystroke (item 1 of argv){using}\nend run'
        mac.applescript(script, key)
    else:
        return ToolResult(f"Unknown key {key!r}.", ok=False)
    return ToolResult(f"Pressed {keys}.")


def run_shortcut(name: str) -> ToolResult:
    out = mac.run(["shortcuts", "run", name], timeout=120)
    return ToolResult(f"Ran the Shortcut {name!r}." + (f" Output: {out}" if out else ""))


# --------------------------------------------------------------- learned shortcuts (memory)

SHORTCUTS_FILE = DATA_DIR / "shortcuts.json"


def load_shortcuts() -> dict[str, str]:
    try:
        return json.loads(SHORTCUTS_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_shortcuts(data: dict[str, str]) -> None:
    SHORTCUTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SHORTCUTS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def learn_shortcut(phrase: str, instructions: str) -> ToolResult:
    data = load_shortcuts()
    data[phrase.strip()] = instructions.strip()
    _save_shortcuts(data)
    return ToolResult(f"Learned: when the user says {phrase!r}, do: {instructions}")


def forget_shortcut(phrase: str) -> ToolResult:
    data = load_shortcuts()
    if data.pop(phrase.strip(), None) is None:
        return ToolResult(f"No shortcut called {phrase!r}.", ok=False)
    _save_shortcuts(data)
    return ToolResult(f"Forgot {phrase!r}.")


# --------------------------------------------------------------- registry

_STR = {"type": "string"}

TOOLS: list[Tool] = [
    Tool("open_app", "Open (or switch to) a Mac application by its name, e.g. Safari, Notes, Visual Studio Code.",
         {"name": {**_STR, "description": "Application name as shown in /Applications."}}, open_app, ["name"]),
    Tool("quit_app", "Quit a running Mac application.",
         {"name": {**_STR, "description": "Application name."}}, quit_app, ["name"]),
    Tool("arrange_window", "Move or resize the front window of an app (or of the frontmost app if app is empty).",
         {"position": {"type": "string", "enum": [*_LAYOUTS, "minimize"]},
          "app": {**_STR, "description": "Application name; empty string means the frontmost app."}},
         arrange_window, ["position", "app"]),
    Tool("find_files", "Search the user's files with Spotlight. Returns full paths.",
         {"query": {**_STR, "description": "Words from the file name (or content when kind is set)."},
          "kind": {"type": "string", "enum": ["any", *_KINDS]},
          "limit": {"type": "integer", "description": "Max results, 1-30."}},
         find_files, ["query", "kind", "limit"]),
    Tool("open_path", "Open a file or folder with its default app.",
         {"path": {**_STR, "description": "Absolute path, ~ allowed."}}, open_path, ["path"]),
    Tool("open_url", "Open a website in the default browser.",
         {"url": _STR}, open_url, ["url"]),
    Tool("web_search", "Search the web in the default browser.",
         {"query": _STR}, web_search, ["query"]),
    Tool("read_screen", "Take a screenshot and read the text on screen. Use when the user asks about what is on their screen.",
         {}, read_screen),
    Tool("music", "Control music playback in Apple Music or Spotify.",
         {"action": {"type": "string", "enum": [*_MUSIC_SIMPLE, "play_song"]},
          "query": {**_STR, "description": "Song, artist or album for play_song; otherwise empty."},
          "player": {"type": "string", "enum": ["Music", "Spotify"]}},
         music, ["action", "query", "player"]),
    Tool("play_youtube", "Search YouTube and play the top video in the browser. Use for songs, artists, "
         "mahraganat, clips, anything to watch or listen to. Set mix=true for a continuous mix of similar songs.",
         {"query": {**_STR, "description": "What to search for, e.g. 'Wegz' or 'رامي صبري'."},
          "mix": {"type": "boolean", "description": "true = play a YouTube mix based on the top result."}},
         play_youtube, ["query", "mix"]),
    Tool("play_latest_from_channel", "Play the newest video (or the Nth newest) uploaded by a YouTube channel.",
         {"channel": {**_STR, "description": "Channel name or @handle."},
          "which": {"type": "integer", "description": "1 = newest, 2 = the one before, ..."}},
         play_latest_from_channel, ["channel", "which"]),
    Tool("set_volume", "Set the Mac's output volume.",
         {"level": {"type": "integer", "description": "0-100"}}, set_volume, ["level"]),
    Tool("list_emails", "List recent emails from the Mail app inbox with an id, sender, subject and snippet.",
         {"count": {"type": "integer", "description": "1-15"}, "unread_only": {"type": "boolean"}},
         list_emails, ["count", "unread_only"]),
    Tool("draft_email_reply", "Open a reply to an email in Mail with the given text. Never sends; the user sends it.",
         {"message_id": {"type": "integer", "description": "id from list_emails."}, "body": _STR},
         draft_email_reply, ["message_id", "body"]),
    Tool("press_keys", "Press a keyboard shortcut in the frontmost app, e.g. 'cmd+t', 'cmd+shift+4', 'space'.",
         {"keys": _STR}, press_keys, ["keys"]),
    Tool("run_shortcut", "Run a shortcut from the macOS Shortcuts app by name.",
         {"name": _STR}, run_shortcut, ["name"]),
    Tool("learn_shortcut", "Remember a personal voice command: when the user says `phrase`, carry out `instructions`.",
         {"phrase": _STR, "instructions": {**_STR, "description": "What to do, in plain words."}},
         learn_shortcut, ["phrase", "instructions"]),
    Tool("remember", "Save a lasting fact about the user (tastes, favorite artists, channels, habits) to use later.",
         {"fact": _STR}, remember, ["fact"]),
    Tool("forget", "Delete saved facts about the user that contain these words.",
         {"fact": _STR}, forget, ["fact"]),
    Tool("forget_shortcut", "Forget a personal voice command.",
         {"phrase": _STR}, forget_shortcut, ["phrase"]),
]

BY_NAME = {t.name: t for t in TOOLS}


def execute(name: str, args: dict[str, Any] | None) -> ToolResult:
    tool = BY_NAME.get(name)
    if tool is None:
        return ToolResult(f"Unknown tool {name!r}.", ok=False)
    args = dict(args or {})
    allowed = set(tool.parameters)
    args = {k: v for k, v in args.items() if k in allowed}
    missing = [r for r in tool.required if r not in args and r not in _OPTIONAL_DEFAULTS.get(name, {})]
    if missing:
        return ToolResult(f"Missing argument(s): {', '.join(missing)}.", ok=False)
    try:
        return tool.run(**args)
    except mac.MacError as exc:
        return ToolResult(str(exc), ok=False)
    except (TypeError, ValueError, subprocess.SubprocessError, OSError) as exc:
        return ToolResult(f"{name} failed: {exc}", ok=False)


# Arguments that are "required" in the schema (so strict JSON schemas stay simple) but have
# sensible defaults when a smaller local model leaves them out.
_OPTIONAL_DEFAULTS = {
    "arrange_window": {"app"},
    "find_files": {"kind", "limit"},
    "music": {"query", "player"},
    "play_youtube": {"mix"},
    "play_latest_from_channel": {"which"},
    "list_emails": {"count", "unread_only"},
}
