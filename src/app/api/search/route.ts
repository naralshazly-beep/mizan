import type { NextRequest } from "next/server";

/**
 * Server-side web search used by the /name page.
 *
 * Provider is picked from env vars (set them in Vercel → Settings → Environment Variables):
 *   SERPER_API_KEY   → Google results via serper.dev (2,500 free searches)
 *   BRAVE_API_KEY    → Brave Search API (fallback if Serper isn't set)
 *   SEARCH_PASSWORD  → optional; when set, requests must send it in `x-search-password`
 *                      so strangers who find the link can't use up your quota.
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

export async function GET(request: NextRequest) {
  const password = process.env.SEARCH_PASSWORD;
  if (password && request.headers.get("x-search-password") !== password) {
    return Response.json({ error: "wrong_password" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim();
  const type = params.get("type") === "news" ? "news" : "web";
  if (!q || q.length > 400) {
    return Response.json({ error: "bad_query" }, { status: 400 });
  }

  const serperKey = process.env.SERPER_API_KEY;
  const braveKey = process.env.BRAVE_API_KEY;
  if (!serperKey && !braveKey) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  try {
    const results = serperKey ? await serper(q, type, serperKey) : await brave(q, type, braveKey!);
    return Response.json({ results: results.filter((r) => r.link) });
  } catch (err) {
    return Response.json(
      { error: "provider_error", detail: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}
