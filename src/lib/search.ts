/**
 * Server-side web search shared by /api/search, the daily watch job and the
 * WhatsApp bot. Provider is picked from env vars:
 *   SERPER_API_KEY → Google results via serper.dev
 *   BRAVE_API_KEY  → Brave Search API (fallback)
 */

export type SearchResult = {
  title: string;
  link: string;
  snippet: string;
  date?: string;
  source?: string;
};

const TIMEOUT_MS = 12_000;

async function serper(q: string, type: "web" | "news", key: string): Promise<SearchResult[]> {
  const res = await fetch(`https://google.serper.dev/${type === "news" ? "news" : "search"}`, {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q, num: 10 }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`serper ${res.status}`);
  const data = await res.json();
  const items: Array<Record<string, string>> = (type === "news" ? data.news : data.organic) ?? [];
  return items.map((r) => ({
    title: r.title ?? "",
    link: r.link ?? "",
    snippet: r.snippet ?? "",
    date: r.date,
    source: r.source,
  }));
}

async function brave(q: string, type: "web" | "news", key: string): Promise<SearchResult[]> {
  const base = type === "news" ? "news/search" : "web/search";
  const res = await fetch(
    `https://api.search.brave.com/res/v1/${base}?q=${encodeURIComponent(q)}&count=10`,
    {
      headers: { "X-Subscription-Token": key, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`brave ${res.status}`);
  const data = await res.json();
  const items: Array<Record<string, string>> = (type === "news" ? data.results : data.web?.results) ?? [];
  return items.map((r) => ({
    title: r.title ?? "",
    link: r.url ?? "",
    snippet: (r.description ?? "").replace(/<[^>]+>/g, ""),
    date: r.age,
  }));
}

export function searchConfigured() {
  return !!(process.env.SERPER_API_KEY || process.env.BRAVE_API_KEY);
}

export async function searchWeb(q: string, type: "web" | "news" = "web"): Promise<SearchResult[]> {
  const serperKey = process.env.SERPER_API_KEY;
  const braveKey = process.env.BRAVE_API_KEY;
  if (!serperKey && !braveKey) throw new Error("not_configured");
  const results = serperKey ? await serper(q, type, serperKey) : await brave(q, type, braveKey!);
  return results.filter((r) => r.link);
}
