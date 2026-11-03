/**
 * Helpers for building a person's public footprint from a name:
 *  - extractProfiles: pull social-profile links out of web search results
 *  - usernameCandidates: common username patterns derived from a latin name
 */

export type Profile = {
  platform: string;
  handle: string;
  url: string;
};

type Rule = { platform: string; re: RegExp; skip?: string[] };

// Each regex captures the handle from a profile URL (not posts, groups, etc).
const RULES: Rule[] = [
  { platform: "LinkedIn", re: /linkedin\.com\/in\/([A-Za-z0-9\-_%.]+)/i },
  { platform: "Instagram", re: /instagram\.com\/([A-Za-z0-9._]+)\/?(?:$|\?)/i, skip: ["p", "reel", "reels", "explore", "stories", "accounts", "tv"] },
  { platform: "Facebook", re: /facebook\.com\/([A-Za-z0-9.\-]+)\/?(?:$|\?)/i, skip: ["groups", "pages", "events", "watch", "share", "photo.php", "profile.php", "story.php", "people", "public", "login", "marketplace"] },
  { platform: "X", re: /(?:twitter|x)\.com\/([A-Za-z0-9_]{1,15})\/?(?:$|\?)/i, skip: ["home", "search", "i", "intent", "share", "hashtag", "explore"] },
  { platform: "TikTok", re: /tiktok\.com\/@([A-Za-z0-9._]+)/i },
  { platform: "YouTube", re: /youtube\.com\/@([A-Za-z0-9._\-]+)/i },
  { platform: "GitHub", re: /github\.com\/([A-Za-z0-9\-]+)\/?(?:$|\?)/i, skip: ["topics", "orgs", "features", "about", "pricing", "login", "marketplace", "sponsors"] },
  { platform: "Telegram", re: /t\.me\/([A-Za-z0-9_]{5,})\/?(?:$|\?)/i, skip: ["joinchat", "share", "s"] },
  { platform: "Snapchat", re: /snapchat\.com\/add\/([A-Za-z0-9._\-]+)/i },
  { platform: "Threads", re: /threads\.(?:net|com)\/@([A-Za-z0-9._]+)/i },
  { platform: "Pinterest", re: /pinterest\.[a-z.]+\/([A-Za-z0-9_]+)\/?(?:$|\?)/i, skip: ["pin", "search", "ideas"] },
  { platform: "Medium", re: /medium\.com\/@([A-Za-z0-9._\-]+)/i },
  { platform: "Behance", re: /behance\.net\/([A-Za-z0-9_\-]+)\/?(?:$|\?)/i, skip: ["gallery", "search"] },
];

export function extractProfiles(links: string[]): Profile[] {
  const seen = new Set<string>();
  const out: Profile[] = [];
  for (const link of links) {
    for (const rule of RULES) {
      const m = link.match(rule.re);
      if (!m) continue;
      const handle = decodeURIComponent(m[1]).replace(/\/$/, "");
      if (!handle || rule.skip?.includes(handle.toLowerCase())) continue;
      const key = `${rule.platform}:${handle.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ platform: rule.platform, handle, url: link.split("?")[0] });
    }
  }
  return out;
}

/** "Ahmed Mohamed Hassan" → ahmedhassan, ahmed.hassan, ahmed_hassan, ahassan, hassanahmed … */
export function usernameCandidates(fullName: string): string[] {
  const parts = fullName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .map((p) => p.replace(/['-]/g, ""))
    .filter(Boolean);
  if (parts.length === 0) return [];
  if (parts.length === 1) return [parts[0]];

  const first = parts[0];
  const last = parts[parts.length - 1];
  const set = new Set<string>([
    `${first}${last}`,
    `${first}.${last}`,
    `${first}_${last}`,
    `${first[0]}${last}`,
    `${last}${first}`,
    `${first}${last[0]}`,
  ]);
  if (parts.length > 2) set.add(parts.join(""));
  return [...set].filter((u) => u.length >= 3 && u.length <= 30);
}

/** Platforms that matter most for people (checked for each username guess). */
export const PERSON_PLATFORMS = [
  "tiktok",
  "youtube",
  "telegram",
  "snapchat",
  "github",
  "medium",
  "linktree",
  "soundcloud",
  "patreon",
  "reddit",
];
