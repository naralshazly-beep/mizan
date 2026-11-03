import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkReport } from "@/lib/watch";
import { searchConfigured } from "@/lib/search";

/**
 * Daily job (see vercel.json): checks every watched client for new news.
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. Needs
 * SUPABASE_SERVICE_ROLE_KEY because no user is signed in.
 */
export const maxDuration = 300;

const MAX_PER_RUN = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = createAdminClient();
  if (!sb || !searchConfigured()) return Response.json({ error: "not_configured" }, { status: 503 });

  const { data: reports } = await sb
    .from("basma_reports")
    .select("id, user_id, person, company, results")
    .eq("watch", true)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(MAX_PER_RUN);

  let checked = 0;
  let added = 0;
  const started = Date.now();
  for (const r of reports ?? []) {
    if (Date.now() - started > 250_000) break; // stay inside the function time limit
    try {
      added += await checkReport(sb, r);
      checked++;
    } catch {
      // one failing client shouldn't stop the rest
    }
  }
  return Response.json({ checked, added });
}
