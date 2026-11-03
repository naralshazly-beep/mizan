"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { STATUS, type ReportStatus } from "@/lib/report";
import type { Analysis } from "@/lib/analysis";
import { fmtMoney, type Interaction } from "@/components/Interactions";

type Row = {
  id: string;
  person: string;
  company: string;
  status: ReportStatus;
  profiles: unknown[];
  analysis: string | null;
};

type Col = Row & { a: Analysis | null; ints: Interaction[] };

const CONF = { high: "عالية", medium: "متوسطة", low: "ضعيفة" } as const;

function parse(s: string | null): Analysis | null {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

function count(a: Analysis | null, level: "red" | "yellow" | "green") {
  return a?.signals?.filter((s) => s.level === level).length ?? 0;
}

function risk(c: Col) {
  // Lower is safer. Unanalysed clients are pushed to the middle.
  if (!c.a) return 5;
  const conf = c.a.confidence === "high" ? 0 : c.a.confidence === "medium" ? 1 : 2;
  return count(c.a, "red") * 3 + count(c.a, "yellow") - count(c.a, "green") + conf;
}

export default function Compare() {
  const [cols, setCols] = useState<Col[] | null>(null);

  useEffect(() => {
    const ids = (new URLSearchParams(window.location.search).get("ids") ?? "").split(",").filter(Boolean).slice(0, 4);
    if (!ids.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCols([]);
      return;
    }
    const sb = createClient();
    Promise.all([
      sb.from("basma_reports").select("id, person, company, status, profiles, analysis").in("id", ids),
      sb.from("basma_interactions").select("*").in("report_id", ids).order("happened_at", { ascending: false }),
    ]).then(([reps, ints]) => {
      const list = ((reps.data as Row[]) ?? []).map((r) => ({
        ...r,
        a: parse(r.analysis),
        ints: ((ints.data as Interaction[]) ?? []).filter((i) => i.report_id === r.id),
      }));
      setCols(ids.map((id) => list.find((c) => c.id === id)).filter(Boolean) as Col[]);
    });
  }, []);

  if (cols === null) return <main className="mx-auto max-w-6xl px-4 py-10"><div className="card loading-dot h-64" /></main>;
  if (cols.length < 2)
    return (
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">اختار عميلين على الأقل</h1>
        <p className="mt-2 text-muted">من صفحة العملاء، علّم على العملاء اللي عايز تقارنهم ودوس «قارن».</p>
        <Link href="/dashboard" className="btn-primary mt-6 inline-block">ارجع للعملاء</Link>
      </main>
    );

  const safest = [...cols].sort((x, y) => risk(x) - risk(y))[0];
  const biggest = [...cols].sort((x, y) => (y.a?.affiliations?.length ?? 0) - (x.a?.affiliations?.length ?? 0))[0];

  const rows: { label: string; render: (c: Col) => React.ReactNode }[] = [
    { label: "الحالة", render: (c) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span> },
    { label: "الملخص", render: (c) => <span className="text-sm text-muted">{c.a?.summary ?? "لسه متحللش"}</span> },
    { label: "الثقة في النتايج", render: (c) => (c.a ? CONF[c.a.confidence] : "–") },
    {
      label: "المؤشرات",
      render: (c) =>
        c.a ? (
          <span className="flex gap-3 text-sm">
            <span className="text-red-400">⛔ {count(c.a, "red")}</span>
            <span className="text-unknown">⚠️ {count(c.a, "yellow")}</span>
            <span className="text-found">✓ {count(c.a, "green")}</span>
          </span>
        ) : "–",
    },
    {
      label: "الشركات المرتبط بيها",
      render: (c) =>
        c.a?.affiliations?.length ? (
          <ul className="space-y-0.5 text-sm">
            {c.a.affiliations.slice(0, 5).map((f, i) => <li key={i}>{f.company} <span className="text-muted">({f.role})</span></li>)}
          </ul>
        ) : "–",
    },
    { label: "حجم الشغل", render: (c) => <span className="text-sm text-muted">{c.a?.business_scale || "–"}</span> },
    { label: "الحسابات", render: (c) => (c.profiles ?? []).length },
    { label: "مرات التواصل", render: (c) => c.ints.length },
    {
      label: "آخر تواصل",
      render: (c) => (c.ints[0] ? new Date(c.ints[0].happened_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" }) : "–"),
    },
    {
      label: "آخر عرض سعر",
      render: (c) => {
        const o = c.ints.find((i) => i.kind === "offer" && i.amount);
        return o ? <span className="font-semibold text-found">{fmtMoney(o.amount!, o.currency)}</span> : "–";
      },
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <Link href="/dashboard" className="text-sm text-muted hover:text-text">→ العملاء</Link>
      <h1 className="mt-2 text-3xl font-bold">مقارنة العملاء</h1>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-found/15 px-3 py-1 text-found">🛡️ الأقل خطر: <b>{safest.person || safest.company}</b></span>
        {(biggest.a?.affiliations?.length ?? 0) > 0 && (
          <span className="rounded-full bg-accent/15 px-3 py-1 text-accent">🏛️ الأكبر نشاط: <b>{biggest.person || biggest.company}</b></span>
        )}
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-start">
          <thead>
            <tr className="border-b border-border">
              <th className="w-36 p-3" />
              {cols.map((c) => (
                <th key={c.id} className="p-3 text-start align-top">
                  <Link href={`/reports/${c.id}`} className="hover:underline">
                    <div className="font-bold">{c.person || c.company}</div>
                    {c.person && c.company && <div className="text-xs font-normal text-muted">{c.company}</div>}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-0">
                <td className="p-3 align-top text-xs font-semibold text-muted">{row.label}</td>
                {cols.map((c) => <td key={c.id} className="p-3 align-top">{row.render(c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">«الأقل خطر» محسوبة من المؤشرات ودرجة الثقة في تحليل الذكاء الاصطناعي. العملاء اللي متحللوش بياخدوا درجة متوسطة.</p>
    </main>
  );
}
