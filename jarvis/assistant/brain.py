"""The agent loop: understand the request, call tools, answer briefly.

Two interchangeable backends:
  * OllamaBrain - free, runs on the Mac (default when no API key is set)
  * ClaudeBrain - Claude API, much better at multi-step commands
"""

from __future__ import annotations

import base64
import json
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable

from . import tools as T
from .config import Config

SYSTEM_PROMPT = """You are Jarvis, a voice assistant that controls the user's Mac through tools.

How to behave:
- Your reply is spoken aloud. Keep it to one or two short sentences, plain text, no markdown, no lists, no emoji.
- Reply in the user's language. If they speak Arabic, answer in friendly Egyptian Arabic.
- When the user asks you to do something on the Mac, do it with the tools and then confirm briefly. Don't ask for permission for harmless actions such as opening apps, moving windows, playing music, or searching.
- Chain tools when needed (for example find_files then open_path, or list_emails then draft_email_reply).
- Emails are only ever drafted, never sent. Tell the user the draft is open for them to review.
- Use read_screen when the user asks about what is on their screen, then answer from what you read.
- If a tool fails because of a macOS permission, tell the user which setting to allow.
- If the user's words match one of their personal shortcuts, carry out that shortcut's instructions.
- Follow the voice style given with each message (dialect and persona).
- For songs, artists, mahraganat and anything to watch, use play_youtube. When the user asks for "something I like" or "a mix", pick from what you know about their taste and set mix=true.
- When the user tells you a lasting preference (favorite artists, channels, habits), save it with remember.
- If a request is ambiguous and the user has saved options for it (for example which Quran recitation or surah they like), ask one short question offering those options, then play their answer. Treat the Quran with respect: no jokes or persona tricks around it.
- If no tool can do what was asked, say so plainly instead of pretending."""

MAX_STEPS = 8

# Models that accept server-side refusal fallbacks (Haiku doesn't).
FALLBACK_MODELS = {"claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"}


@dataclass
class Action:
    tool: str
    input: dict[str, Any]
    ok: bool
    result: str


@dataclass
class Turn:
    reply: str
    actions: list[Action] = field(default_factory=list)


OnAction = Callable[[Action], None]


def _context_note() -> str:
    """Per-turn context, sent inside the user message so the cached prefix never changes."""
    from .settings import get_profile, get_settings
    from .speech import voice_style

    lines = [f"[Local time: {datetime.now().strftime('%A %d %B %Y, %H:%M')}]"]
    lines.append(f"[Voice style: {voice_style(get_settings().get('voice', 'dark'))}]")
    facts = get_profile()["facts"]
    if facts:
        lines.append("[What you know about the user: " + " | ".join(facts) + "]")
    shortcuts = T.load_shortcuts()
    if shortcuts:
        lines.append("[User's personal shortcuts: " + "; ".join(f'"{k}" -> {v}' for k, v in shortcuts.items()) + "]")
    return "\n".join(lines)


def _clip(text: str, limit: int = 300) -> str:
    return text if len(text) <= limit else text[:limit] + "…"


# ====================================================================== Claude


class ClaudeBrain:
    name = "Claude"

    def __init__(self, config: Config) -> None:
        import anthropic

        self._anthropic = anthropic
        self.client = anthropic.Anthropic()
        self.model = config.claude_model
        self.effort = config.claude_effort
        self.tools = [
            {"name": t.name, "description": t.description, "input_schema": t.schema()} for t in T.TOOLS
        ]
        self.messages: list[dict[str, Any]] = []

    @property
    def label(self) -> str:
        return self.model

    def reset(self) -> None:
        self.messages = []

    def ask(self, text: str, on_action: OnAction | None = None) -> Turn:
        # Start a fresh conversation instead of trimming old turns: history stays append-only.
        if len(self.messages) > 60:
            self.reset()
        self.messages.append({"role": "user", "content": f"{_context_note()}\n\n{text}"})
        actions: list[Action] = []
        for _ in range(MAX_STEPS):
            response = self._call()
            self.messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason == "refusal":
                return Turn("Sorry, I can't help with that one.", actions)
            if response.stop_reason == "pause_turn":
                continue
            tool_uses = [b for b in response.content if b.type == "tool_use"]
            if response.stop_reason != "tool_use" or not tool_uses:
                reply = " ".join(b.text for b in response.content if b.type == "text").strip()
                return Turn(reply or "Done.", actions)

            results = []
            for block in tool_uses:
                outcome = T.execute(block.name, block.input)
                action = Action(block.name, dict(block.input or {}), outcome.ok, _clip(outcome.text))
                actions.append(action)
                if on_action:
                    on_action(action)
                results.append(self._tool_result(block.id, outcome))
            self.messages.append({"role": "user", "content": results})
        return Turn("I stopped after too many steps. Try asking in smaller pieces.", actions)

    def _call(self):
        try:
            extra: dict[str, Any] = {}
            if self.model in FALLBACK_MODELS:
                # If a safety classifier declines, retry on Anthropic's recommended fallback model.
                extra = {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default"}
            return self.client.beta.messages.create(
                model=self.model,
                max_tokens=16000,
                system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
                tools=self.tools,
                messages=self.messages,
                output_config={"effort": self.effort},
                **extra,
            )
        except self._anthropic.AuthenticationError as exc:
            raise BrainError("The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.") from exc
        except self._anthropic.RateLimitError as exc:
            raise BrainError("Claude is rate limited right now. Try again in a moment.") from exc
        except self._anthropic.APIStatusError as exc:
            raise BrainError(f"Claude API error {exc.status_code}: {exc.message}") from exc
        except self._anthropic.APIConnectionError as exc:
            raise BrainError("Couldn't reach the Claude API. Check your internet connection.") from exc

    @staticmethod
    def _tool_result(tool_use_id: str, outcome: T.ToolResult) -> dict[str, Any]:
        content: list[dict[str, Any]] = [{"type": "text", "text": outcome.text}]
        if outcome.image is not None:
            data = base64.standard_b64encode(outcome.image.read_bytes()).decode()
            content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}})
        return {"type": "tool_result", "tool_use_id": tool_use_id, "content": content, "is_error": not outcome.ok}


# ====================================================================== Ollama


class OllamaBrain:
    name = "Ollama"

    def __init__(self, config: Config) -> None:
        self.url = config.ollama_url
        self.model = config.ollama_model
        self.keep_alive = config.ollama_keep_alive
        self.tools = [
            {"type": "function", "function": {"name": t.name, "description": t.description, "parameters": t.schema()}}
            for t in T.TOOLS
        ]
        self.messages: list[dict[str, Any]] = []

    @property
    def label(self) -> str:
        return self.model

    def reset(self) -> None:
        self.messages = []

    def ask(self, text: str, on_action: OnAction | None = None) -> Turn:
        if len(self.messages) > 40:
            self.reset()
        self.messages.append({"role": "user", "content": f"{_context_note()}\n\n{text}"})
        actions: list[Action] = []
        for _ in range(MAX_STEPS):
            message = self._call()
            self.messages.append(message)
            calls = message.get("tool_calls") or []
            if not calls:
                return Turn((message.get("content") or "").strip() or "Done.", actions)
            for call in calls:
                fn = call.get("function", {})
                args = fn.get("arguments") or {}
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except json.JSONDecodeError:
                        args = {}
                outcome = T.execute(fn.get("name", ""), args)
                action = Action(fn.get("name", "?"), args, outcome.ok, _clip(outcome.text))
                actions.append(action)
                if on_action:
                    on_action(action)
                prefix = "" if outcome.ok else "ERROR: "
                self.messages.append({"role": "tool", "tool_name": fn.get("name", ""), "content": prefix + outcome.text})
        return Turn("I stopped after too many steps. Try asking in smaller pieces.", actions)

    def _call(self) -> dict[str, Any]:
        body = json.dumps(
            {
                "model": self.model,
                "messages": [{"role": "system", "content": SYSTEM_PROMPT}, *self.messages],
                "tools": self.tools,
                "stream": False,
                "keep_alive": self.keep_alive,
            }
        ).encode()
        req = urllib.request.Request(f"{self.url}/api/chat", data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = json.loads(resp.read())
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")
            if "not found" in detail:
                raise BrainError(f"Ollama doesn't have {self.model}. Run: ollama pull {self.model}") from exc
            raise BrainError(f"Ollama error {exc.code}: {detail[:200]}") from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            raise BrainError("Ollama isn't running. Open the Ollama app or run `ollama serve`.") from exc
        message = data.get("message") or {}
        return {k: v for k, v in message.items() if k in ("role", "content", "tool_calls")}


# ====================================================================== factory


class BrainError(RuntimeError):
    pass


def make_brain(config: Config) -> ClaudeBrain | OllamaBrain:
    if config.resolved_brain == "claude":
        return ClaudeBrain(config)
    return OllamaBrain(config)
