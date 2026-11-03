"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { STATUS, type ReportStatus } from "@/lib/report";

type Row = {
  id: string;
  person: string;
  company: string;
  status: ReportStatus;
  created_at: string;
  profiles: unknown[];
  analysis: string | null;
};


type FollowUp = { id: string; title: string; follow_up_at: string; report_id: string; basma_reports: { person: string; company: string } | null };
type AlertRow = { id: string; title: string; link: string; source: string | null; published: string | null; report_id: string; basma_reports: { person: string; company: string } | null };

function redFlags(analysis: string | null) {
  if (!analysis) return 0;
  try {
    return (JSON.parse(analysis).signals ?? []).filter((s: { level: string }) => s.level === "red").length;
  } catch {
    return 0;
  }
}

export default function Dashboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Row["status"]>("all");
  const [loadedAt, setLoadedAt] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => setName((data.user?.user_metadata?.full_name as string) ?? ""));
    sb.from("basma_reports")
      .select("id, person, company, status, created_at, profiles, analysis")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setLoadedAt(Date.now());
        setRows((data as Row[]) ?? []);
      });
    sb.from("basma_interactions")
      .select("id, title, follow_up_at, report_id, basma_reports(person, company)")
      .not("follow_up_at", "is", null)
      .eq("follow_up_done", false)
      .order("follow_up_at")
      .limit(8)
      .then(({ data }) => setFollowUps((data as unknown as FollowUp[]) ?? []));
    sb.from("basma_alerts")
      .select("id, title, link, source, published, report_id, basma_reports(person, company)")
      .eq("seen", false)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setAlerts((data as unknown as AlertRow[]) ?? []));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id]));
  }

  async function markSeen(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    await createClient().from("basma_alerts").update({ seen: true }).eq("id", id);
  }

  async function doneFollowUp(id: string) {
    setFollowUps((prev) => prev.filter((f) => f.id !== id));
    await createClient().from("basma_interactions").update({ follow_up_done: true }).eq("id", id);
  }

  const shown = useMemo(
    () =>
      (rows ?? []).filter(
        (r) =>
          (filter === "all" || r.status === filter) &&
          `${r.person} ${r.company}`.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [rows, q, filter],
  );

  const stats = useMemo(() => {
    const all = rows ?? [];
    const week = loadedAt - 7 * 864e5;
    return {
      total: all.length,
      week: all.filter((r) => new Date(r.created_at).getTime() > week).length,
      active: all.filter((r) => r.status === "in_progress").length,
      won: all.filter((r) => r.status === "won").length,
      flags: all.filter((r) => redFlags(r.analysis) > 0).length,
    };
  }, [rows, loadedAt]);

  async function remove(id: string) {
    if (!confirm("تمسح ملف العميل ده؟")) return;
    await createClient().from("basma_reports").delete().eq("id", id);
    setRows((prev) => (prev ?? []).filter((r) => r.id !== id));
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <p className="text-sm text-muted">أهلًا{name ? ` ${name}` : ""} 👋</p>
          <h1 className="text-3xl font-bold">العملاء</h1>
        </div>
        <Link href="/name" className="btn-primary">+ ابحث عن عميل جديد</Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["إجمالي العملاء", stats.total, "text-text"],
          ["الأسبوع ده", stats.week, "text-accent"],
          ["شغالين عليهم", stats.active, "text-unknown"],
          ["صفقات اتقفلت", stats.won, "text-found"],
          ["عندهم مؤشر خطر", stats.flags, "text-red-400"],
        ].map(([label, n, cls]) => (
          <div key={label as string} className="card p-4">
            <div className={`text-3xl font-bold ${cls}`}>{rows ? n : "–"}</div>
            <div className="mt-1 text-xs text-muted">{label}</div>
          </div>
        ))}
      </div>

      {(followUps.length > 0 || alerts.length > 0) && (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {followUps.length > 0 && (
            <section className="card p-4">
              <h2 className="mb-2 font-semibold">⏰ متابعات جاية</h2>
              <ul className="space-y-1.5">
                {followUps.map((f) => {
                  const late = f.follow_up_at < new Date(loadedAt || 0).toISOString().slice(0, 10);
                  return (
                    <li key={f.id} className="flex items-center gap-2 text-sm">
                      <button onClick={() => doneFollowUp(f.id)} title="خلصت" className="h-4 w-4 shrink-0 rounded border border-border-strong hover:border-found" />
                      <Link href={`/reports/${f.report_id}`} className="min-w-0 flex-1 truncate hover:underline">
                        <span className="font-medium">{f.basma_reports?.person || f.basma_reports?.company}</span>
                        <span className="text-muted"> · {f.title}</span>
                      </Link>
                      <span className={`shrink-0 text-xs ${late ? "text-red-400" : "text-unknown"}`}>
                        {new Date(f.follow_up_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {alerts.length > 0 && (
            <section className="card border-accent/30 p-4">
              <h2 className="mb-2 font-semibold">🔔 أخبار جديدة عن عملائك <span className="text-xs text-accent">{alerts.length}</span></h2>
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 text-sm">
                    <a href={a.link} target="_blank" rel="noopener noreferrer" onClick={() => markSeen(a.id)} className="min-w-0 flex-1 hover:underline">
                      <div className="text-xs text-accent">{a.basma_reports?.person || a.basma_reports?.company}</div>
                      <div className="line-clamp-2">{a.title}</div>
                      <div className="text-xs text-muted">{[a.source, a.published].filter(Boolean).join(" · ")}</div>
                    </a>
                    <button onClick={() => markSeen(a.id)} title="شفته" className="text-xs text-muted hover:text-text">✕</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="دور على عميل…" className="field max-w-xs flex-1" />
        {(["all", "new", "in_progress", "won", "lost"] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)} data-active={filter === k} className="chip">
            {k === "all" ? "الكل" : STATUS[k].label}
          </button>
        ))}
      </div>

      {rows === null && <div className="card loading-dot h-40" />}

      {rows && rows.length === 0 && (
        <div className="card p-10 text-center">
          <div className="text-5xl">🗂️</div>
          <h2 className="mt-3 text-xl font-bold">لسه مفيش عملاء</h2>
          <p className="mt-2 text-muted">ابحث عن أول عميل، وبعد البحث دوس «احفظ في العملاء» عشان يظهر هنا.</p>
          <Link href="/name" className="btn-primary mt-5 inline-block">ابدأ أول بحث</Link>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => {
            const flags = redFlags(r.analysis);
            return (
              <div key={r.id} data-active={selected.includes(r.id)} className="card group relative flex flex-col p-4 transition hover:border-accent data-[active=true]:border-accent">
                <button
                  onClick={() => toggle(r.id)}
                  title="اختار للمقارنة"
                  className={`absolute end-3 top-3 flex h-5 w-5 items-center justify-center rounded border text-xs ${
                    selected.includes(r.id) ? "border-accent bg-accent text-bg" : "border-border-strong text-transparent opacity-60 group-hover:opacity-100"
                  }`}
                >
                  ✓
                </button>
                <Link href={`/reports/${r.id}`} className="flex-1">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/30 to-accent-2/30 text-lg font-bold">
                      {(r.person || r.company || "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{r.person || r.company}</div>
                      {r.person && r.company && <div className="truncate text-sm text-muted">{r.company}</div>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                    <span className="text-muted">{(r.profiles ?? []).length} حساب</span>
                    {r.analysis && <span className="text-accent">✨ متحلل</span>}
                    {flags > 0 && <span className="text-red-400">⚠️ {flags} خطر</span>}
                  </div>
                </Link>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs text-muted">
                  <span>{new Date(r.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" })}</span>
                  <button onClick={() => remove(r.id)} className="opacity-60 hover:text-red-400 hover:opacity-100">مسح</button>
                </div>
              </div>
            );
          })}
          {shown.length === 0 && <p className="text-sm text-muted">مفيش نتايج للبحث ده.</p>}
        </div>
      )}

      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-30 mx-auto flex w-fit items-center gap-3 rounded-full border border-accent bg-surface-solid px-4 py-2 shadow-2xl">
          <span className="text-sm">اخترت {selected.length}</span>
          {selected.length >= 2 ? (
            <Link href={`/compare?ids=${selected.join(",")}`} className="btn-primary !px-4 !py-1.5 text-sm">قارن</Link>
          ) : (
            <span className="text-xs text-muted">اختار عميل كمان عشان تقارن</span>
          )}
          <button onClick={() => setSelected([])} className="text-xs text-muted hover:text-text">إلغاء</button>
        </div>
      )}
    </main>
  );
}
