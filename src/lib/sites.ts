/**
 * Sites checked by the username search.
 *
 * Each site has:
 *  - url:    the public profile page shown to the user ({} = username)
 *  - probe:  optional different URL actually requested (e.g. a public JSON API)
 *  - check:  how to decide whether the account exists
 *      "status"    → HTTP 200 = found, 404/410/3xx = not found
 *      "notFound"  → found unless the body contains `text`
 *      "found"     → found only if the body contains `text`
 *  ({} inside `text` is replaced with the username, too.)
 *
 * Anything else (403, 429, 5xx, timeouts, captchas) is reported as "unknown"
 * rather than guessed.
 */

export type Check =
  | { type: "status" }
  | { type: "notFound"; text: string }
  | { type: "found"; text: string };

export type Category =
  | "social"
  | "dev"
  | "gaming"
  | "creative"
  | "music"
  | "other";

export type Site = {
  id: string;
  name: string;
  category: Category;
  url: string;
  probe?: string;
  /** Extra request headers, e.g. a consent cookie so we skip cookie banners. */
  headers?: Record<string, string>;
  check: Check;
};

const status: Check = { type: "status" };

export const SITES: Site[] = [
  // ── Social / community ──────────────────────────────────────────────
  // Candidates under test (big platforms that block most automated checks).
  { id: "tiktok", name: "TikTok", category: "social", url: "https://www.tiktok.com/@{}", probe: "https://www.tiktok.com/oembed?url=https://www.tiktok.com/@{}", check: status },
  { id: "tiktok2", name: "TikTok (page)", category: "social", url: "https://www.tiktok.com/@{}", check: { type: "found", text: "\"uniqueId\":\"{}\"" } },
  { id: "instagram", name: "Instagram", category: "social", url: "https://www.instagram.com/{}/", probe: "https://www.instagram.com/api/v1/users/web_profile_info/?username={}", headers: { "X-IG-App-ID": "936619743392459" }, check: status },
  { id: "instagram2", name: "Instagram (page)", category: "social", url: "https://www.instagram.com/{}/", check: { type: "found", text: "\"@{}\"" } },
  { id: "facebook", name: "Facebook", category: "social", url: "https://www.facebook.com/{}", check: status },
  { id: "facebook2", name: "Facebook (page)", category: "social", url: "https://www.facebook.com/{}", check: { type: "notFound", text: "isn't available" } },
  { id: "reddit", name: "Reddit", category: "social", url: "https://www.reddit.com/user/{}", probe: "https://www.reddit.com/user/{}/about.json", check: status },
  { id: "telegram", name: "Telegram", category: "social", url: "https://t.me/{}", check: { type: "found", text: "tgme_page_title" } },
  { id: "snapchat", name: "Snapchat", category: "social", url: "https://www.snapchat.com/add/{}", check: status },
  { id: "youtube", name: "YouTube", category: "social", url: "https://www.youtube.com/@{}", headers: { Cookie: "SOCS=CAI; CONSENT=YES+1" }, check: status },
  { id: "mastodon", name: "Mastodon (mastodon.social)", category: "social", url: "https://mastodon.social/@{}", probe: "https://mastodon.social/api/v1/accounts/lookup?acct={}", check: status },
  { id: "bluesky", name: "Bluesky", category: "social", url: "https://bsky.app/profile/{}.bsky.social", probe: "https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle={}.bsky.social", check: status },
  { id: "tumblr", name: "Tumblr", category: "social", url: "https://{}.tumblr.com", check: status },
  { id: "medium", name: "Medium", category: "social", url: "https://medium.com/@{}", check: status },
  { id: "substack", name: "Substack", category: "social", url: "https://{}.substack.com", check: status },
  { id: "blogger", name: "Blogger", category: "social", url: "https://{}.blogspot.com", check: status },
  { id: "wordpress", name: "WordPress.com", category: "social", url: "https://{}.wordpress.com", check: status },
  { id: "disqus", name: "Disqus", category: "social", url: "https://disqus.com/by/{}/", check: status },
  { id: "aboutme", name: "About.me", category: "social", url: "https://about.me/{}", check: status },
  { id: "linktree", name: "Linktree", category: "social", url: "https://linktr.ee/{}", check: status },
  { id: "gravatar", name: "Gravatar", category: "social", url: "https://gravatar.com/{}", probe: "https://en.gravatar.com/{}.json", check: status },
  { id: "wikipedia", name: "Wikipedia", category: "social", url: "https://en.wikipedia.org/wiki/User:{}", probe: "https://en.wikipedia.org/w/api.php?action=query&list=users&ususers={}&format=json", check: { type: "notFound", text: "\"missing\"" } },
  { id: "hackernews", name: "Hacker News", category: "social", url: "https://news.ycombinator.com/user?id={}", probe: "https://hacker-news.firebaseio.com/v0/user/{}.json", check: { type: "found", text: "\"id\"" } },
  { id: "wattpad", name: "Wattpad", category: "social", url: "https://www.wattpad.com/user/{}", probe: "https://www.wattpad.com/api/v3/users/{}", check: status },
  { id: "duolingo", name: "Duolingo", category: "social", url: "https://www.duolingo.com/profile/{}", probe: "https://www.duolingo.com/2017-06-30/users?username={}", check: { type: "found", text: "\"users\":[{" } },
  { id: "patreon", name: "Patreon", category: "social", url: "https://www.patreon.com/{}", check: status },
  { id: "kofi", name: "Ko-fi", category: "social", url: "https://ko-fi.com/{}", check: status },
  { id: "bmac", name: "Buy Me a Coffee", category: "social", url: "https://www.buymeacoffee.com/{}", check: status },
  { id: "cashapp", name: "Cash App", category: "social", url: "https://cash.app/${}", check: status },

  // ── Developers ──────────────────────────────────────────────────────
  { id: "github", name: "GitHub", category: "dev", url: "https://github.com/{}", check: status },
  { id: "gitlab", name: "GitLab", category: "dev", url: "https://gitlab.com/{}", probe: "https://gitlab.com/api/v4/users?username={}", check: { type: "found", text: "\"username\"" } },
  { id: "gitee", name: "Gitee", category: "dev", url: "https://gitee.com/{}", check: status },
  { id: "devto", name: "DEV Community", category: "dev", url: "https://dev.to/{}", check: status },
  { id: "pypi", name: "PyPI", category: "dev", url: "https://pypi.org/user/{}/", check: status },
  { id: "dockerhub", name: "Docker Hub", category: "dev", url: "https://hub.docker.com/u/{}", probe: "https://hub.docker.com/v2/users/{}/", check: status },
  { id: "huggingface", name: "Hugging Face", category: "dev", url: "https://huggingface.co/{}", check: status },
  { id: "kaggle", name: "Kaggle", category: "dev", url: "https://www.kaggle.com/{}", check: status },
  { id: "replit", name: "Replit", category: "dev", url: "https://replit.com/@{}", check: status },
  { id: "codepen", name: "CodePen", category: "dev", url: "https://codepen.io/{}", check: status },
  { id: "keybase", name: "Keybase", category: "dev", url: "https://keybase.io/{}", probe: "https://keybase.io/_/api/1.0/user/lookup.json?usernames={}", check: { type: "notFound", text: "\"them\":[null]" } },
  { id: "codeforces", name: "Codeforces", category: "dev", url: "https://codeforces.com/profile/{}", probe: "https://codeforces.com/api/user.info?handles={}", check: { type: "found", text: "\"status\":\"OK\"" } },
  { id: "codewars", name: "Codewars", category: "dev", url: "https://www.codewars.com/users/{}", probe: "https://www.codewars.com/api/v1/users/{}", check: status },
  { id: "exercism", name: "Exercism", category: "dev", url: "https://exercism.org/profiles/{}", check: status },
  { id: "tryhackme", name: "TryHackMe", category: "dev", url: "https://tryhackme.com/p/{}", probe: "https://tryhackme.com/api/user/exist/{}", check: { type: "found", text: "\"success\":true" } },
  { id: "sourceforge", name: "SourceForge", category: "dev", url: "https://sourceforge.net/u/{}/profile", check: status },
  { id: "launchpad", name: "Launchpad", category: "dev", url: "https://launchpad.net/~{}", check: status },
  { id: "pastebin", name: "Pastebin", category: "dev", url: "https://pastebin.com/u/{}", check: status },

  // ── Gaming ──────────────────────────────────────────────────────────
  { id: "steam", name: "Steam", category: "gaming", url: "https://steamcommunity.com/id/{}", check: { type: "notFound", text: "The specified profile could not be found" } },
  { id: "chesscom", name: "Chess.com", category: "gaming", url: "https://www.chess.com/member/{}", probe: "https://api.chess.com/pub/player/{}", check: status },
  { id: "lichess", name: "Lichess", category: "gaming", url: "https://lichess.org/@/{}", probe: "https://lichess.org/api/user/{}", check: status },
  { id: "minecraft", name: "Minecraft", category: "gaming", url: "https://namemc.com/profile/{}", probe: "https://api.mojang.com/users/profiles/minecraft/{}", check: status },
  { id: "speedrun", name: "Speedrun.com", category: "gaming", url: "https://www.speedrun.com/users/{}", probe: "https://www.speedrun.com/api/v1/users/{}", check: status },
  { id: "itchio", name: "itch.io", category: "gaming", url: "https://{}.itch.io", check: status },
  { id: "scratch", name: "Scratch", category: "gaming", url: "https://scratch.mit.edu/users/{}", probe: "https://api.scratch.mit.edu/users/{}", check: status },
  { id: "osu", name: "osu!", category: "gaming", url: "https://osu.ppy.sh/users/{}", check: status },

  // ── Creative ────────────────────────────────────────────────────────
  { id: "behance", name: "Behance", category: "creative", url: "https://www.behance.net/{}", check: status },
  { id: "dribbble", name: "Dribbble", category: "creative", url: "https://dribbble.com/{}", check: status },
  { id: "deviantart", name: "DeviantArt", category: "creative", url: "https://www.deviantart.com/{}", check: status },
  { id: "artstation", name: "ArtStation", category: "creative", url: "https://www.artstation.com/{}", check: status },
  { id: "flickr", name: "Flickr", category: "creative", url: "https://www.flickr.com/people/{}", check: status },
  { id: "unsplash", name: "Unsplash", category: "creative", url: "https://unsplash.com/@{}", check: status },
  { id: "vimeo", name: "Vimeo", category: "creative", url: "https://vimeo.com/{}", check: status },
  { id: "letterboxd", name: "Letterboxd", category: "creative", url: "https://letterboxd.com/{}/", check: status },
  { id: "myanimelist", name: "MyAnimeList", category: "creative", url: "https://myanimelist.net/profile/{}", check: status },
  { id: "gumroad", name: "Gumroad", category: "creative", url: "https://gumroad.com/{}", check: status },

  // ── Music ───────────────────────────────────────────────────────────
  { id: "soundcloud", name: "SoundCloud", category: "music", url: "https://soundcloud.com/{}", check: status },
  { id: "lastfm", name: "Last.fm", category: "music", url: "https://www.last.fm/user/{}", check: status },
  { id: "mixcloud", name: "Mixcloud", category: "music", url: "https://www.mixcloud.com/{}/", probe: "https://api.mixcloud.com/{}/", check: status },
  { id: "bandcamp", name: "Bandcamp", category: "music", url: "https://bandcamp.com/{}", check: status },
];

export const CATEGORY_LABELS: Record<Category, string> = {
  social: "تواصل ومحتوى",
  dev: "برمجة",
  gaming: "ألعاب",
  creative: "تصميم وفن",
  music: "موسيقى",
  other: "أخرى",
};

/** Usernames we accept: letters, digits, dot, dash, underscore. */
export const USERNAME_RE = /^[A-Za-z0-9._-]{1,40}$/;

export function fill(template: string, username: string): string {
  return template.replaceAll("{}", encodeURIComponent(username));
}
