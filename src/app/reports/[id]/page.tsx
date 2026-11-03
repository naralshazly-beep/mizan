"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SECTION_TITLES, STATUS, type ReportStatus } from "@/lib/report";
import type { Analysis } from "@/lib/analysis";
import type { SearchResult } from "@/app/api/search/route";
import type { Profile } from "@/lib/footprint";
import AnalysisCard from "@/components/AnalysisCard";

type Report = {
  id: string;
  person: string;
  company: string;
  status: ReportStatus;
  notes: string;
  created_at: string;
  results: Record<string, SearchResult[]>;
  profiles: Profile[];
  analysis: string | null;
};

function host(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [r, setR] = useState<Report | null | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [savedNote, setSavedNote] = useState(true);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    createClient()
      .from("basma_reports")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setR((data as Report) ?? null);
        if (data) {
          setNotes(data.notes ?? "");
          try {
            if (data.analysis) setAnalysis(JSON.parse(data.analysis));
          } catch {}
        }
      });
  }, [id]);

  async function update(fields: Partial<Report>) {
    setR((prev) => (prev ? { ...prev, ...fields } : prev));
    await createClient().from("basma_reports").update(fields).eq("id", id);
  }

  async function analyze() {
    if (!r) return;
    setAnalyzing(true);
    setErr("");
    const sections = Object.entries(r.results ?? {})
      .filter(([, list]) => list?.length)
      .map(([k, list]) => ({ title: SECTION_TITLES[k]?.title ?? k, results: list }));
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: r.person, company: r.company, sections, profiles: r.profiles }),
      });
      const data = await res.json();
      if (res.ok) {
        setAnalysis(data.analysis);
        await update({ analysis: JSON.stringify(data.analysis) });
      } else if (data.error === "not_configured" || data.error === "bad_key") {
        setErr("الذكاء الاصطناعي لسه مش متوصل. لازم يتحط مفتاح ANTHROPIC_API_KEY في Vercel.");
      } else {
        setErr("التحليل مكملش. جرب تاني.");
      }
    } catch {
      setErr("مشكلة في الاتصال. جرب تاني.");
    }
    setAnalyzing(false);
  }

  async function remove() {
    if (!confirm("تمسح ملف العميل ده؟")) return;
    await createClient().from("basma_reports").delete().eq("id", id);
    router.push("/dashboard");
  }

  if (r === undefined) return <main className="mx-auto max-w-5xl px-4 py-10"><div className="card loading-dot h-48" /></main>;
  if (r === null)
    return (
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">الملف ده مش موجود</h1>
        <Link href="/dashboard" className="btn-primary mt-6 inline-block">ارجع للعملاء</Link>
      </main>
    );

  const total = Object.values(r.results ?? {}).reduce((n, l) => n + (l?.length ?? 0), 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <Link href="/dashboard" className="no-print text-sm text-muted hover:text-text">→ العملاء</Link>

      <div className="mt-3 flex flex-wrap items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/30 to-accent-2/30 text-2xl font-bold">
          {(r.person || r.company || "?")[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-bold">{r.person || r.company}</h1>
          {r.person && r.company && <p className="text-muted">{r.company}</p>}
          <p className="mt-1 text-xs text-muted">
            اتعمل {new Date(r.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })} ·{" "}
            {total} نتيجة · {(r.profiles ?? []).length} حساب
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <select
            value={r.status}
            onChange={(e) => update({ status: e.target.value as ReportStatus })}
            className={`rounded-full border border-border-strong bg-surface-solid px-3 py-2 text-sm font-semibold ${STATUS[r.status].cls}`}
          >
            {(Object.keys(STATUS) as ReportStatus[]).map((k) => (
              <option key={k} value={k}>{STATUS[k].label}</option>
            ))}
          </select>
          <button onClick={() => window.print()} className="chip">PDF</button>
          <button onClick={remove} className="chip hover:!text-red-400">مسح</button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {analysis && !analyzing ? (
            <AnalysisCard a={analysis} />
          ) : (
            <div className="card p-5 text-center">
              <div className="text-3xl">✨</div>
              <p className="mt-2 text-muted">خلّي الذكاء الاصطناعي يقرالك النتايج ويطلعلك ملخص ونصايح للاجتماع.</p>
              <button onClick={analyze} disabled={analyzing} className="no-print btn-primary mt-4">
                {analyzing ? "بيحلل… (ممكن ياخد دقيقة)" : "حلل بالذكاء الاصطناعي"}
              </button>
              {err && <p className="mt-3 text-sm text-unknown">{err}</p>}
            </div>
          )}
          {analysis && !analyzing && (
            <button onClick={analyze} className="no-print chip">✨ حلل تاني</button>
          )}

          {Object.entries(r.results ?? {})
            .filter(([, list]) => list?.length)
            .map(([k, list]) => (
              <section key={k} className="card p-4">
                <h2 className="mb-2 font-semibold">
                  {SECTION_TITLES[k]?.icon} {SECTION_TITLES[k]?.title ?? k}{" "}
                  <span className="text-xs text-muted">({list.length})</span>
                </h2>
                <ul className="space-y-1">
                  {list.map((res) => (
                    <li key={res.link}>
                      <a href={res.link} target="_blank" rel="noopener noreferrer" className="block rounded-lg p-2 hover:bg-surface-2">
                        <div className="text-xs text-muted" dir="ltr" style={{ textAlign: "right" }}>{host(res.link)}</div>
                        <div className="line-clamp-1 font-medium">{res.title}</div>
                        {res.snippet && <p className="line-clamp-2 text-sm text-muted">{res.snippet}</p>}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>

        <aside className="space-y-4">
          <section className="card p-4">
            <h2 className="mb-2 font-semibold">📝 ملاحظاتك</h2>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setSavedNote(false);
              }}
              onBlur={async () => {
                await update({ notes });
                setSavedNote(true);
              }}
              rows={6}
              placeholder="اكتب أي حاجة عن العميل: اتقابلتوا فين، طلب إيه، السعر اللي اتفقتوا عليه…"
              className="field resize-y text-sm"
            />
            <p className="mt-1 text-xs text-muted">{savedNote ? "محفوظ" : "هيتحفظ لما تخرج من الخانة"}</p>
          </section>

          <section className="card p-4">
            <h2 className="mb-2 font-semibold">🫆 الحسابات ({(r.profiles ?? []).length})</h2>
            {(r.profiles ?? []).length === 0 && <p className="text-sm text-muted">مفيش حسابات اتجمعت.</p>}
            <ul className="space-y-1.5">
              {(r.profiles ?? []).map((p) => (
                <li key={p.platform + p.handle}>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-surface-2">
                    <span className="w-20 shrink-0 text-xs text-muted">{p.platform}</span>
                    <span className="truncate" dir="ltr">{p.handle}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
