import type { NextRequest } from "next/server";
import { AnalyzeError, analyzeClient, type AnalyzeInput } from "@/lib/ai";

/**
 * POST /api/analyze — turns the name-search results into a short Arabic client
 * brief for a business meeting. Auth is enforced by the proxy.
 */
export const maxDuration = 120;

const STATUS: Record<AnalyzeError["code"], number> = {
  not_configured: 503,
  bad_key: 503,
  refused: 422,
  empty: 502,
  rate_limited: 429,
  provider_error: 502,
};

export async function POST(request: NextRequest) {
  let body: AnalyzeInput;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.person && !body.company) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  try {
    return Response.json({ analysis: await analyzeClient(body) });
  } catch (err) {
    const code = err instanceof AnalyzeError ? err.code : "provider_error";
    return Response.json({ error: code }, { status: STATUS[code] });
  }
}
