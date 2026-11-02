"""Find YouTube videos and channels without an API key.

Search results are read from the public results page; a channel's latest uploads come
from its public RSS feed.
"""

from __future__ import annotations

import html
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    "Accept-Language": "ar,en;q=0.8",
    "Cookie": "CONSENT=YES+1; SOCS=CAI",
}
_CHANNEL_FILTER = "EgIQAg%3D%3D"  # YouTube's "channels only" search filter
_ATOM = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}


class YouTubeError(RuntimeError):
    pass


@dataclass
class Video:
    id: str
    title: str

    def url(self, mix: bool = False) -> str:
        base = f"https://www.youtube.com/watch?v={self.id}"
        # "RD" + video id is YouTube's auto-generated mix (radio) based on that song.
        return base + (f"&list=RD{self.id}" if mix else "")


@dataclass
class Channel:
    id: str
    title: str


def _get(url: str, timeout: float = 15) -> str:
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except OSError as exc:
        raise YouTubeError(f"Couldn't reach YouTube: {exc}") from exc


def parse_search_videos(page: str) -> list[Video]:
    videos = []
    for match in re.finditer(r'"videoRenderer":\{"videoId":"([\w-]{11})"', page):
        vid = match.group(1)
        tail = page[match.end(): match.end() + 3000]
        title = re.search(r'"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"', tail)
        videos.append(Video(vid, _unescape(title.group(1)) if title else vid))
    return videos


def parse_search_channels(page: str) -> list[Channel]:
    channels = []
    for match in re.finditer(r'"channelRenderer":\{"channelId":"(UC[\w-]{22})"', page):
        tail = page[match.end(): match.end() + 1500]
        title = re.search(r'"title":\{"simpleText":"((?:[^"\\]|\\.)*)"', tail)
        channels.append(Channel(match.group(1), _unescape(title.group(1)) if title else match.group(1)))
    return channels


def parse_feed(xml_text: str) -> list[Video]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        raise YouTubeError("YouTube sent an unreadable channel feed.") from exc
    out = []
    for entry in root.findall("a:entry", _ATOM):
        vid = entry.findtext("yt:videoId", default="", namespaces=_ATOM)
        if vid:
            out.append(Video(vid, entry.findtext("a:title", default=vid, namespaces=_ATOM)))
    return out


def _unescape(text: str) -> str:
    try:
        text = json.loads(f'"{text}"')
    except json.JSONDecodeError:
        pass
    return html.unescape(text)


def search_video(query: str) -> Video:
    page = _get("https://www.youtube.com/results?search_query=" + urllib.parse.quote(query))
    videos = parse_search_videos(page)
    if not videos:
        raise YouTubeError(f"No YouTube results for {query!r}.")
    return videos[0]


def find_channel(name: str) -> Channel:
    name = name.strip()
    if name.startswith("@") or "youtube.com/" in name:
        handle = name if name.startswith("http") else "https://www.youtube.com/" + name
        page = _get(handle)
        match = re.search(r'"externalId":"(UC[\w-]{22})"', page) or re.search(r'"channelId":"(UC[\w-]{22})"', page)
        if not match:
            raise YouTubeError(f"Couldn't find the channel {name!r}.")
        title = re.search(r'<meta property="og:title" content="([^"]*)"', page)
        return Channel(match.group(1), html.unescape(title.group(1)) if title else name)
    page = _get(
        "https://www.youtube.com/results?search_query=" + urllib.parse.quote(name) + "&sp=" + _CHANNEL_FILTER
    )
    channels = parse_search_channels(page)
    if not channels:
        raise YouTubeError(f"Couldn't find a YouTube channel called {name!r}.")
    return channels[0]


def latest_videos(channel_id: str) -> list[Video]:
    videos = parse_feed(_get(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"))
    if not videos:
        raise YouTubeError("That channel has no videos.")
    return videos
