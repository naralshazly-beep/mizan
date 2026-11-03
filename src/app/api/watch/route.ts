import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkReport } from "@/lib/watch";
import { searchConfigured } from "@/lib/search";

/** POST /api/watch { id } — check one of the signed-in user's clients for new news now. */
export async function POST(request: NextRequest) {
  if (!searchConfigured()) return Response.json({ error: "not_configured" }, { status: 503 });
  const { id } = await request.json().catch(() => ({ id: null }));
  if (!id) return Response.json({ error: "bad_request" }, { status: 400 });

  const sb = await createClient();
  const { data: r } = await sb
    .from("basma_reports")
    .select("id, user_id, person, company, results")
    .eq("id", id)
    .maybeSingle();
  if (!r) return Response.json({ error: "not_found" }, { status: 404 });

  try {
    const added = await checkReport(sb, r);
    return Response.json({ added });
  } catch {
    return Response.json({ error: "provider_error" }, { status: 502 });
  }
}
