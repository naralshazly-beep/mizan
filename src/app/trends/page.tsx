import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { ACTIVE_WORKSPACE_COOKIE, getUserWorkspaces, resolveActiveWorkspace } from "@/lib/workspace";
import type { TrendItem, TrendReport } from "@/lib/trends/types";
import { TrendsClient } from "./TrendsClient";

// "Generate now" runs the full research job inside a server action.
export const maxDuration = 800;

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const workspaces = await getUserWorkspaces(supabase);
  const cookieStore = await cookies();
  const activeWorkspace = resolveActiveWorkspace(
    workspaces,
    cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value,
  );

  if (!activeWorkspace) {
    redirect("/");
  }

  const { date } = await searchParams;

  const { data: reports } = await supabase
    .from("trend_reports")
    .select("id, report_date, overview, created_at")
    .order("report_date", { ascending: false })
    .limit(30);

  const allReports = (reports ?? []) as TrendReport[];
  const report = allReports.find((r) => r.report_date === date) ?? allReports[0] ?? null;

  let items: TrendItem[] = [];
  if (report) {
    const { data } = await supabase
      .from("trend_items")
      .select(
        "id, position, category, title, summary, why_trending, analysis, audience_interest, sentiment, content_angle, hook, slides, hashtags, sources, status",
      )
      .eq("report_id", report.id)
      .order("position", { ascending: true });
    items = (data ?? []) as TrendItem[];
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        workspaces={workspaces}
        currentWorkspaceId={activeWorkspace.id}
        userId={user.id}
        active="trends"
      />
      <TrendsClient
        report={report}
        reportDates={allReports.map((r) => r.report_date)}
        items={items}
      />
    </div>
  );
}
