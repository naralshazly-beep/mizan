import type { SupabaseClient } from "@supabase/supabase-js";
import { searchWeb, type SearchResult } from "@/lib/search";

type WatchedReport = {
  id: string;
  user_id: string;
  person: string;
  company: string;
  results: Record<string, SearchResult[]> | null;
};

const q = (s: string) => (s ? `"${s}"` : "");

/**
 * Looks for fresh news about one saved client and stores anything we haven't
 * seen before as an alert. Returns how many new alerts were added.
 */
export async function checkReport(sb: SupabaseClient, r: WatchedReport): Promise<number> {
  const query = [q(r.person), q(r.company)].filter(Boolean).join(" ");
  if (!query) return 0;

  const news = await searchWeb(query, "news");

  const known = new Set<string>((r.results?.news ?? []).map((x) => x.link));
  const { data: existing } = await sb.from("basma_alerts").select("link").eq("report_id", r.id);
  for (const e of existing ?? []) known.add(e.link);

  const fresh = news.filter((n) => !known.has(n.link)).slice(0, 10);
  if (fresh.length) {
    await sb.from("basma_alerts").upsert(
      fresh.map((n) => ({
        report_id: r.id,
        user_id: r.user_id,
        title: n.title,
        link: n.link,
        snippet: n.snippet,
        source: n.source ?? null,
        published: n.date ?? null,
      })),
      { onConflict: "report_id,link", ignoreDuplicates: true },
    );
  }
  await sb.from("basma_reports").update({ last_checked_at: new Date().toISOString() }).eq("id", r.id);
  return fresh.length;
}
