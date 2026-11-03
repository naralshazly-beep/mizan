import type { NextRequest } from "next/server";
import { searchConfigured, searchWeb } from "@/lib/search";

export type { SearchResult } from "@/lib/search";

/**
 * GET /api/search?q=…&type=web|news — used by the /name page.
 * SEARCH_PASSWORD (optional) must be sent in `x-search-password` when set.
 */
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
  if (!searchConfigured()) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  try {
    return Response.json({ results: await searchWeb(q, type) });
  } catch (err) {
    return Response.json(
      { error: "provider_error", detail: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}
