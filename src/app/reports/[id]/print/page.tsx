"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SECTION_TITLES, STATUS, type ReportStatus } from "@/lib/report";
import type { Analysis } from "@/lib/analysis";
import type { SearchResult } from "@/lib/search";
import type { Profile } from "@/lib/footprint";
import { KINDS, fmtMoney, type Interaction } from "@/components/Interactions";

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
type Settings = { company_name: string; prepared_by: string; logo_data_url: string | null };

const LEVEL = { red: ["⛔", "خطر", "#dc2626"], yellow: ["⚠️", "اتأكد", "#d97706"], green: ["✓", "مطمّن", "#16a34a"] } as const;
const CERT = { confirmed: "مؤكد", likely: "غالبًا", unclear: "مش واضح" } as const;
const CONF = { high: "عالية", medium: "متوسطة", low: "ضعيفة" } as const;

function host(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

export default function PrintReport() {
  const { id } = useParams<{ id: string }>();
  const [r, setR] = useState<Report | null>(null);
  const [st, setSt] = useState<Settings | null>(null);
  const [ints, setInts] = useState<Interaction[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sb = createClient();
    Promise.all([
      sb.from("basma_reports").select("*").eq("id", id).maybeSingle(),
      sb.from("basma_settings").select("company_name, prepared_by, logo_data_url").maybeSingle(),
      sb.from("basma_interactions").select("*").eq("report_id", id).order("happened_at", { ascending: false }),
    ]).then(([rep, set, it]) => {
      setR(rep.data as Report);
      setSt((set.data as Settings) ?? null);
      setInts((it.data as Interaction[]) ?? []);
      setReady(true);
    });
  }, [id]);

  useEffect(() => {
    if (ready && r) setTimeout(() => window.print(), 600);
  }, [ready, r]);

  if (!ready) return <p className="p-10 text-center text-muted">بيجهز التقرير…</p>;
  if (!r) return <p className="p-10 text-center">التقرير مش موجود.</p>;

  let a: Analysis | null = null;
  try {
    a = r.analysis ? JSON.parse(r.analysis) : null;
  } catch {}

  const today = new Date().toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-neutral-200 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-between px-2">
        <button onClick={() => history.back()} className="chip !text-neutral-700">→ رجوع</button>
        <button onClick={() => window.print()} className="btn-primary !py-2">اطبع / احفظ PDF</button>
      </div>

      <article className="report-paper mx-auto max-w-[210mm] bg-white p-[14mm] text-[13px] leading-relaxed text-neutral-900 shadow-xl print:shadow-none">
        <header className="flex items-center gap-4 border-b-4 border-cyan-500 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {st?.logo_data_url && <img src={st.logo_data_url} alt="" className="h-14 max-w-[120px] object-contain" />}
          <div className="flex-1">
            <div className="text-lg font-bold">{st?.company_name || "تقرير عميل"}</div>
            <div className="text-xs text-neutral-500">تقرير معرفة العميل · سري</div>
          </div>
          <div className="text-left text-xs text-neutral-500">
            <div>{today}</div>
            {st?.prepared_by && <div>إعداد: {st.prepared_by}</div>}
          </div>
        </header>

        <section className="mt-6">
          <h1 className="text-3xl font-bold">{r.person || r.company}</h1>
          {r.person && r.company && <p className="text-base text-neutral-600">{r.company}</p>}
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-600">
            <span>الحالة: <b>{STATUS[r.status].label}</b></span>
            {a && <span>الثقة في النتايج: <b>{CONF[a.confidence]}</b></span>}
            <span>الحسابات: <b>{(r.profiles ?? []).length}</b></span>
            <span>مرات التواصل: <b>{ints.length}</b></span>
          </div>
        </section>

        {a ? (
          <>
            <section className="mt-5 rounded-lg bg-cyan-50 p-4">
              <h2 className="mb-1 font-bold text-cyan-800">الملخص</h2>
              <p>{a.summary}</p>
              {a.identity_note && <p className="mt-2 text-xs text-amber-700">⚠️ {a.identity_note}</p>}
            </section>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <section>
                <h2 className="mb-1 font-bold">الشخص</h2>
                <p className="text-neutral-700">{a.person}</p>
              </section>
              <section>
                <h2 className="mb-1 font-bold">الشركة</h2>
                <p className="text-neutral-700">{a.company}</p>
              </section>
            </div>

            {(a.affiliations?.length ?? 0) > 0 && (
              <section className="mt-5 break-inside-avoid">
                <h2 className="mb-2 font-bold">الشركات المرتبط بيها</h2>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-100">
                      <th className="border border-neutral-200 p-2 text-start">الشركة</th>
                      <th className="border border-neutral-200 p-2 text-start">الدور</th>
                      <th className="border border-neutral-200 p-2 text-start">التأكد</th>
                      <th className="border border-neutral-200 p-2 text-start">المصدر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.affiliations.map((f, i) => (
                      <tr key={i}>
                        <td className="border border-neutral-200 p-2 font-semibold">{f.company}</td>
                        <td className="border border-neutral-200 p-2">{f.role}</td>
                        <td className="border border-neutral-200 p-2">{CERT[f.certainty]}</td>
                        <td className="border border-neutral-200 p-2" dir="ltr">{host(f.source)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {a.business_scale && <p className="mt-2 text-neutral-700"><b>حجم الشغل:</b> {a.business_scale}</p>}
              </section>
            )}

            {a.signals.length > 0 && (
              <section className="mt-5 break-inside-avoid">
                <h2 className="mb-2 font-bold">المؤشرات</h2>
                <ul className="space-y-1">
                  {a.signals.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <b style={{ color: LEVEL[s.level][2] }} className="shrink-0">{LEVEL[s.level][0]} {LEVEL[s.level][1]}:</b>
                      <span>{s.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="mt-5 grid grid-cols-2 gap-4 break-inside-avoid">
              <section>
                <h2 className="mb-1 font-bold">ابدأ الكلام بـ</h2>
                <ul className="list-disc ps-5">{a.talking_points.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </section>
              <section>
                <h2 className="mb-1 font-bold">أسئلة للاجتماع</h2>
                <ul className="list-disc ps-5">{a.questions.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </section>
            </div>
          </>
        ) : (
          <p className="mt-5 rounded-lg bg-amber-50 p-3 text-amber-800">العميل ده لسه متحللش بالذكاء الاصطناعي. حلله من صفحة العميل عشان يظهر الملخص والمؤشرات هنا.</p>
        )}

        {ints.length > 0 && (
          <section className="mt-6 break-inside-avoid">
            <h2 className="mb-2 font-bold">سجل التواصل</h2>
            <table className="w-full border-collapse text-xs">
              <tbody>
                {ints.slice(0, 12).map((i) => (
                  <tr key={i.id}>
                    <td className="w-20 border-b border-neutral-200 p-1.5 text-neutral-500">{new Date(i.happened_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}</td>
                    <td className="w-24 border-b border-neutral-200 p-1.5">{KINDS[i.kind].icon} {KINDS[i.kind].label}</td>
                    <td className="border-b border-neutral-200 p-1.5">
                      <b>{i.title}</b>
                      {i.amount ? ` · ${fmtMoney(i.amount, i.currency)}` : ""}
                      {i.body && <div className="text-neutral-600">{i.body}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {r.notes && (
          <section className="mt-5 break-inside-avoid">
            <h2 className="mb-1 font-bold">ملاحظات</h2>
            <p className="whitespace-pre-wrap text-neutral-700">{r.notes}</p>
          </section>
        )}

        {(r.profiles ?? []).length > 0 && (
          <section className="mt-5 break-inside-avoid">
            <h2 className="mb-1 font-bold">الحسابات العامة</h2>
            <div className="grid grid-cols-2 gap-x-4 text-xs">
              {r.profiles.map((p) => (
                <div key={p.platform + p.handle} className="truncate border-b border-neutral-100 py-1" dir="ltr" style={{ textAlign: "right" }}>
                  <b>{p.platform}</b> · {p.handle}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-5">
          <h2 className="mb-1 font-bold">أهم المصادر</h2>
          {Object.entries(r.results ?? {})
            .filter(([, l]) => l?.length)
            .map(([k, l]) => (
              <div key={k} className="mb-2 break-inside-avoid">
                <div className="text-xs font-semibold text-neutral-500">{SECTION_TITLES[k]?.title ?? k}</div>
                <ul className="text-xs">
                  {l.slice(0, 3).map((x) => (
                    <li key={x.link} className="truncate">• {x.title} <span className="text-neutral-400" dir="ltr">({host(x.link)})</span></li>
                  ))}
                </ul>
              </div>
            ))}
        </section>

        <footer className="mt-8 border-t border-neutral-200 pt-3 text-[10px] text-neutral-400">
          التقرير ده مبني على معلومات منشورة للعامة وقت إعداده، وممكن تكون ناقصة أو قديمة. اتأكد من أي معلومة مهمة من مصدرها قبل ما تاخد قرار.
        </footer>
      </article>
    </div>
  );
}
