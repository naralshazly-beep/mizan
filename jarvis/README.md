# Jarvis: free, open-source voice assistant for macOS

Talk to your Mac in Egyptian Arabic or English. Jarvis opens apps, arranges windows, finds files, reads your screen, plays music, drafts email replies, presses keyboard shortcuts, and learns your own voice commands.

**Free by default.** Speech recognition (Whisper), the brain (Ollama), screen reading (Apple Vision), and the voice (macOS `say`) all run on your Mac. If you add an Anthropic API key, it switches to Claude, which handles multi-step commands much better.

> Lives in this repo for now (`jarvis/`). It's self-contained, so you can move it to its own repo later by copying the folder.

---

## بالعربي: التشغيل في ٥ خطوات

١. **نزّل Ollama** من [ollama.com](https://ollama.com) وشغّله، وبعدين من التيرمنال:
```bash
ollama pull qwen2.5:7b
```
٢. **جهّز المشروع:**
```bash
cd jarvis
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```
٣. **شغّله:**
```bash
python -m assistant
```
هيفتح صفحة Jarvis في المتصفح. أول مرة هيحمّل موديل الصوت (حوالي ٥٠٠ ميجا).

٤. **اسمح بالصلاحيات** لما الماك يسألك (أو من System Settings ← Privacy & Security):
   - **Microphone**: للمتصفح
   - **Accessibility**: للتيرمنال (عشان يحرّك الشبابيك ويدوس الشورتكاتس)
   - **Screen Recording**: للتيرمنال (عشان يقرا الشاشة)
   - **Automation**: هيطلبها لوحده أول مرة يكلّم Music أو Mail

٥. **اتكلم:** دوس على زرار المايك أو اضغط مطوّل على **Space**، وقول مثلاً:
   - «افتح سفاري وحطه على الشمال»
   - «دوّر على ملف الفاتورة وافتحه»
   - «إيه اللي على الشاشة؟»
   - «شغّل عمرو دياب»
   - «اقرا الإيميلات الجديدة واكتب رد على آخر واحد»
   - «لما أقول وضع الشغل افتح Slack و VS Code جنب بعض»

**عايز تستخدم Claude بدل الموديل المحلي؟** انسخ `.env.example` لملف اسمه `.env` وحط فيه `ANTHROPIC_API_KEY`. هيبقى أذكى بكتير، بس بيتحسب على حسب الاستخدام.

---

## English: setup

```bash
# 1. Free local brain
brew install ollama        # or download the app from ollama.com
ollama serve &             # skip if the Ollama app is running
ollama pull qwen2.5:7b

# 2. Install
cd jarvis
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 3. Run (opens http://localhost:8765)
python -m assistant
```

Grant **Microphone** (browser), **Accessibility** and **Screen Recording** (your terminal app) in System Settings → Privacy & Security. macOS asks for **Automation** the first time Jarvis talks to Music or Mail.

### Voices

Pick one from the **VOICE** menu in the web panel. Saved in `~/.jarvis/settings.json`.

| Voice | Sound |
|---|---|
| **Dark** (default) | Deep, slow Egyptian voice with a hall echo, and a mysterious persona |
| Egyptian / Egyptian female | Natural Egyptian Arabic (Microsoft neural voices Shakir / Salma) |
| Libyan | Libyan Arabic (Omar), and Jarvis writes its replies in Libyan dialect |
| Mac voice | Built-in `say`, works offline |

The neural voices are free through `edge-tts` but need internet, and the reply text is sent to Microsoft's speech service. Without internet Jarvis falls back to the Mac voice.

### Talk from anywhere, no browser

Hold **Right Option** anywhere on the Mac, talk, and let go. You hear a "tink" when it starts listening and a "pop" when it stops. Change the key with `JARVIS_HOTKEY` (`right_command`, `right_shift`, `right_control`, `fn`, or `off`). macOS asks to allow **Input Monitoring** and the **Microphone** the first time.

### Start automatically at login

```bash
python -m assistant install     # runs in the background now and at every login
python -m assistant uninstall   # stop it
python -m assistant logs        # see what it's doing
```

In the background Jarvis runs as "Python", so macOS asks again to allow Python for the Microphone, Input Monitoring, Accessibility and Screen Recording. Allow them, then run `python -m assistant install` once more. The web panel stays at http://localhost:8765 whenever you want it.

### Memory

Jarvis remembers your tastes (artists, channels, which Quran recitation you like) in `~/.jarvis/profile.json`. Tell it ("remember I like Wegz") or add facts from the terminal:

```bash
python -m assistant remember "I love Wegz, Lege-Cy and Ramy Sabry"
python -m assistant memory      # list what it knows
```

### Settings (`.env`)

Copy `.env.example` to `.env`. Every value is optional.

| Variable | Default | What it does |
|---|---|---|
| `JARVIS_BRAIN` | `auto` | `auto` uses Claude when an API key is set, otherwise Ollama. Can force `claude` or `ollama`. |
| `ANTHROPIC_API_KEY` | – | Turns on the Claude brain. |
| `JARVIS_CLAUDE_MODEL` | `claude-opus-5-5` | Claude model. `claude-haiku-5-5` is much cheaper and faster, and fine for simple commands. |
| `JARVIS_CLAUDE_EFFORT` | `low` | `low` is fastest; `medium` or `high` think harder. |
| `JARVIS_OLLAMA_MODEL` | `qwen2.5:7b` | Any Ollama model that supports tool calling (good at Arabic: `qwen2.5`). |
| `JARVIS_OLLAMA_KEEP_ALIVE` | `5m` | How long the Ollama model stays in RAM after a command. Use `1m` on 8 GB Macs. |
| `JARVIS_WHISPER_MODEL` | `small` | `medium` or `large-v3` recognize Arabic better but are slower. |
| `JARVIS_TTS` | `1` | Speak replies out loud. Choose the voice in the web panel. |
| `JARVIS_HOTKEY` | `right_option` | Hold this key anywhere to talk. `off` disables it. |
| `JARVIS_PORT` | `8765` | Port for the local UI. |

For a better Arabic voice, open System Settings → Accessibility → Spoken Content → System Voice → Manage Voices and download an Arabic voice.

### What it can do

| Command | Tool | How |
|---|---|---|
| Open or quit apps | `open_app`, `quit_app` | `open -a`, AppleScript |
| Move windows (left, right, top, bottom, full, center, minimize) | `arrange_window` | System Events |
| Find and open files | `find_files`, `open_path` | Spotlight (`mdfind`) |
| Read the screen | `read_screen` | `screencapture` + Apple Vision OCR (Claude also sees the screenshot) |
| Play music, next/previous, volume | `music`, `set_volume` | Apple Music / Spotify |
| Read email, draft replies | `list_emails`, `draft_email_reply` | Mail.app. **Only drafts, never sends.** |
| Keyboard shortcuts, Shortcuts app | `press_keys`, `run_shortcut` | System Events, `shortcuts run` |
| Learn your own commands | `learn_shortcut`, `forget_shortcut` | Saved in `~/.jarvis/shortcuts.json` |
| Open websites, search the web | `open_url`, `web_search` | Default browser |
| Play anything from YouTube, or a mix | `play_youtube` | Top search result in Chrome (reuses the open YouTube tab) |
| Latest video from a channel | `play_latest_from_channel` | The channel's public RSS feed |
| Remember things about you | `remember`, `forget` | `~/.jarvis/profile.json` |

### Safety

- The server listens on `127.0.0.1` only. Every request needs a random token that exists only in the page Jarvis serves, and it rejects unfamiliar `Host` headers, so other websites can't send it commands.
- There is no "run any shell command" tool. Jarvis can only take the actions listed above.
- Values such as song names and email text reach AppleScript as arguments, never pasted into the script.

### How it works

```
browser mic ─► /api/audio ─► Whisper (local) ─► brain (Ollama or Claude) ⇄ Mac tools
                                                        │
                       HUD ◄── reply + actions ◄────────┴──► macOS `say`
```

```
assistant/
  server.py   local web server + HUD API
  brain.py    agent loop for Claude and Ollama
  tools.py    every Mac action + its schema
  mac.py      osascript / screencapture / Vision helpers
  speech.py   Whisper speech-to-text, `say` text-to-speech
  web/        the HUD (one HTML file)
tests/        python -m unittest discover -s tests   (runs on any OS)
```

Adding a new action: write a function in `tools.py` that returns a `ToolResult`, and add a `Tool(...)` entry to `TOOLS`. Both brains pick it up automatically.
