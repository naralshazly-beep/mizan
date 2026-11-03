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
  }, []);

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
              <div key={r.id} className="card group flex flex-col p-4 transition hover:border-accent">
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
    </main>
  );
}
