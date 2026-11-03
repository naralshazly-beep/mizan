"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Hero } from "@/components/Nav";
import { SITES } from "@/lib/sites";
import { PERSON_PLATFORMS, extractProfiles, usernameCandidates } from "@/lib/footprint";
import type { SearchResult } from "../api/search/route";
import type { CheckResult } from "../api/check/route";
import type { Analysis } from "@/lib/analysis";
import AnalysisCard from "@/components/AnalysisCard";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Section = {
  id: string;
  title: string;
  icon: string;
  type: "web" | "news";
  query: (p: string, c: string) => string | null;
  google: (p: string, c: string) => string | null;
};

const quoted = (s: string) => (s ? `"${s}"` : "");
const both = (p: string, c: string) => [quoted(p), quoted(c)].filter(Boolean).join(" ");
const g = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

const SECTIONS: Section[] = [
  {
    id: "person", title: "عن الشخص", icon: "👤", type: "web",
    query: (p, c) => (p ? both(p, c) : null),
    google: (p, c) => (p ? g(both(p, c)) : null),
  },
  {
    id: "linkedin", title: "لينكدإن", icon: "💼", type: "web",
    query: (p, c) => (p ? `site:linkedin.com/in ${both(p, c)}` : null),
    google: (p, c) => (p ? g(`site:linkedin.com/in ${both(p, c)}`) : null),
  },
  {
    id: "social", title: "السوشيال ميديا", icon: "📱", type: "web",
    query: (p, c) =>
      p ? `${both(p, c)} (site:instagram.com OR site:facebook.com OR site:x.com OR site:tiktok.com)` : null,
    google: (p, c) =>
      p ? g(`${both(p, c)} (site:instagram.com OR site:facebook.com OR site:x.com OR site:tiktok.com)`) : null,
  },
  {
    id: "company", title: "عن الشركة", icon: "🏢", type: "web",
    query: (_, c) => (c ? quoted(c) : null),
    google: (_, c) => (c ? g(quoted(c)) : null),
  },
  {
    id: "registry", title: "السجل التجاري والتراخيص", icon: "📜", type: "web",
    query: (_, c) =>
      c ? `${quoted(c)} (trade license OR "commercial registration" OR LLC OR سجل تجاري OR رخصة)` : null,
    google: (_, c) =>
      c ? g(`${quoted(c)} (trade license OR "commercial registration" OR LLC OR سجل تجاري OR رخصة)`) : null,
  },
  {
    id: "news", title: "الأخبار", icon: "📰", type: "news",
    query: (p, c) => (p || c ? both(p, c) : null),
    google: (p, c) => (p || c ? `https://news.google.com/search?q=${encodeURIComponent(both(p, c))}` : null),
  },
  {
    id: "reputation", title: "السمعة والشكاوى", icon: "⚠️", type: "web",
    query: (p, c) =>
      p || c ? `${both(p, c)} (scam OR fraud OR lawsuit OR complaint OR نصب OR احتيال OR قضية OR شكوى)` : null,
    google: (p, c) =>
      p || c ? g(`${both(p, c)} (scam OR fraud OR lawsuit OR complaint OR نصب OR احتيال OR قضية OR شكوى)`) : null,
  },
];

type State = { status: "idle" | "loading" | "done" | "error"; results: SearchResult[]; error?: string };

const PW_KEY = "basma-search-password";
const HISTORY_KEY = "basma-name-history";

type HistoryItem = { p: string; c: string; at: number };
type Guess = { done: number; total: number; found: { site: string; name: string; url: string }[] };

function favicon(link: string) {
  return `https://www.google.com/s2/favicons?domain=${host(link)}&sz=32`;
}

function host(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

export default function NameSearch() {
  const [person, setPerson] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [needPassword, setNeedPassword] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [state, setState] = useState<Record<string, State>>({});
  const [ran, setRan] = useState<{ p: string; c: string } | null>(null);
  const runId = useRef(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [guesses, setGuesses] = useState<Record<string, Guess>>({});
  const [guessing, setGuessing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PW_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setPassword(saved);
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) setHistory(JSON.parse(h));
    } catch {}
  }, []);

  const profiles = useMemo(
    () => extractProfiles(Object.values(state).flatMap((s) => s.results.map((r) => r.link))),
    [state],
  );

  function remember(p: string, c: string) {
    const next = [{ p, c, at: Date.now() }, ...history.filter((h) => h.p !== p || h.c !== c)].slice(0, 8);
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {}
  }

  async function guessUsernames() {
    const cands = usernameCandidates(ran?.p ?? "");
    if (!cands.length) return;
    const sites = SITES.filter((s) => PERSON_PLATFORMS.includes(s.id));
    setGuessing(true);
    setGuesses(Object.fromEntries(cands.map((u) => [u, { done: 0, total: sites.length, found: [] }])));
    const jobs = cands.flatMap((u) => sites.map((site) => ({ u, site })));
    const worker = async () => {
      while (jobs.length) {
        const { u, site } = jobs.shift()!;
        let r: CheckResult | null = null;
        try {
          r = await (await fetch(`/api/check?site=${site.id}&username=${encodeURIComponent(u)}`)).json();
        } catch {}
        setGuesses((prev) => {
          const g = prev[u];
          if (!g) return prev;
          const found = r?.status === "found" ? [...g.found, { site: site.id, name: site.name, url: r.url }] : g.found;
          return { ...prev, [u]: { ...g, done: g.done + 1, found } };
        });
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    setGuessing(false);
  }

  function sectionsPayload() {
    return SECTIONS.filter((s) => state[s.id]?.results.length).map((s) => ({
      title: s.title,
      results: state[s.id].results.map(({ title, link, snippet, date }) => ({ title, link, snippet, date })),
    }));
  }

  async function analyze() {
    if (!ran) return;
    setAnalyzing(true);
    setAnalysisError("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: ran.p, company: ran.c, sections: sectionsPayload(), profiles }),
      });
      const data = await res.json();
      if (res.ok) {
        setAnalysis(data.analysis);
        if (savedId) {
          await createClient().from("basma_reports").update({ analysis: JSON.stringify(data.analysis) }).eq("id", savedId);
        }
      } else if (data.error === "not_configured" || data.error === "bad_key") {
        setAnalysisError("الذكاء الاصطناعي لسه مش متوصل. لازم يتحط مفتاح ANTHROPIC_API_KEY في Vercel.");
      } else if (data.error === "rate_limited") {
        setAnalysisError("طلبات كتير ورا بعض. استنى دقيقة وجرب تاني.");
      } else {
        setAnalysisError("التحليل مكملش. جرب تاني.");
      }
    } catch {
      setAnalysisError("مشكلة في الاتصال. جرب تاني.");
    }
    setAnalyzing(false);
  }

  async function save() {
    if (!ran) return;
    setSaving(true);
    const row = {
      person: ran.p,
      company: ran.c,
      results: Object.fromEntries(SECTIONS.filter((s) => state[s.id]).map((s) => [s.id, state[s.id].results])),
      profiles,
      analysis: analysis ? JSON.stringify(analysis) : null,
    };
    const { data, error } = await createClient().from("basma_reports").insert(row).select("id").single();
    setSaving(false);
    if (!error && data) setSavedId(data.id);
    else alert("الحفظ مكملش. جرب تاني.");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(person.trim(), company.trim());
  }

  async function run(p: string, c: string) {
    if (!p && !c) return;
    const id = ++runId.current;
    setRan({ p, c });
    setGuesses({});
    setAnalysis(null);
    setAnalysisError("");
    setSavedId(null);
    remember(p, c);
    setNotConfigured(false);
    try {
      if (password) localStorage.setItem(PW_KEY, password);
    } catch {}

    const active = SECTIONS.filter((s) => s.query(p, c));
    setState(Object.fromEntries(active.map((s) => [s.id, { status: "loading", results: [] }])));

    await Promise.all(
      active.map(async (s) => {
        let next: State;
        try {
          const res = await fetch(
            `/api/search?type=${s.type}&q=${encodeURIComponent(s.query(p, c)!)}`,
            { headers: password ? { "x-search-password": password } : {} },
          );
          const data = await res.json();
          if (res.status === 401) {
            setNeedPassword(true);
            next = { status: "error", results: [], error: "كلمة السر غلط" };
          } else if (res.status === 503) {
            setNotConfigured(true);
            next = { status: "error", results: [], error: "خدمة البحث مش متفعّلة" };
          } else if (!res.ok) {
            next = { status: "error", results: [], error: "خدمة البحث مردتش" };
          } else {
            next = { status: "done", results: data.results ?? [] };
          }
        } catch {
          next = { status: "error", results: [], error: "مشكلة في الاتصال" };
        }
        if (runId.current === id) setState((prev) => ({ ...prev, [s.id]: next }));
      }),
    );
  }

  const total = Object.values(state).reduce((n, s) => n + s.results.length, 0);
  const loading = Object.values(state).some((s) => s.status === "loading");

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <Hero
        title="البحث بالاسم والشركة"
        subtitle="اكتب اسم العميل وشركته، وبصمة تجمعلك اللي منشور عنهم: لينكدإن، السوشيال، السجل التجاري، الأخبار، والسمعة، كله في صفحة واحدة."
      />

      <form onSubmit={submit} className="no-print card mx-auto max-w-3xl p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            placeholder="اسم الشخص (مثلًا: Ahmed Hassan)"
            className="field"
          />
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="اسم الشركة (اختياري)"
            className="field"
          />
        </div>
        {needPassword && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة سر البحث"
            className="field mt-3"
          />
        )}
        <div className="mt-3 flex items-center gap-3">
          <p className="flex-1 text-xs text-muted">
            اكتب الاسم بالإنجليزي زي ما بيكتبه على لينكدإن، وجرب بعدها بالعربي.
          </p>
          <button type="submit" disabled={loading || (!person.trim() && !company.trim())} className="btn-primary">
            {loading ? "بيدور…" : "ابحث"}
          </button>
        </div>
      </form>

      {history.length > 0 && !ran && (
        <div className="no-print mx-auto mt-5 max-w-3xl">
          <p className="mb-2 text-xs text-muted">آخر البحوث</p>
          <div className="flex flex-wrap gap-2">
            {history.map((h) => (
              <button
                key={`${h.p}|${h.c}|${h.at}`}
                onClick={() => {
                  setPerson(h.p);
                  setCompany(h.c);
                  run(h.p, h.c);
                }}
                className="chip"
              >
                {[h.p, h.c].filter(Boolean).join(" · ")}
              </button>
            ))}
          </div>
        </div>
      )}

      {notConfigured && (
        <div className="card mx-auto mt-6 max-w-3xl border-unknown/40 p-4 text-sm text-unknown">
          خدمة البحث لسه مش متوصلة. لازم يتحط مفتاح <span dir="ltr">SERPER_API_KEY</span> في إعدادات
          Vercel. لحد ما ده يتعمل، استخدم زرار «افتح في جوجل» اللي في كل قسم.
        </div>
      )}

      {ran && (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted">تقرير عن</div>
              <div className="truncate text-xl font-bold">{[ran.p, ran.c].filter(Boolean).join(" · ")}</div>
            </div>
            {!loading && total > 0 && (
              <span className="text-sm text-muted">
                <span className="font-bold text-text">{total}</span> نتيجة ·{" "}
                <span className="font-bold text-text">{profiles.length}</span> حساب
              </span>
            )}
            <button onClick={() => window.print()} className="no-print chip">
              تنزيل PDF
            </button>
          </div>

          {!loading && total > 0 && (
            <div className="no-print mt-4 flex flex-wrap gap-2">
              <button onClick={analyze} disabled={analyzing} className="btn-primary flex-1 sm:flex-none">
                {analyzing ? "بيحلل… (ممكن ياخد دقيقة)" : analysis ? "✨ حلل تاني" : "✨ حلل بالذكاء الاصطناعي"}
              </button>
              {savedId ? (
                <Link href={`/reports/${savedId}`} className="card flex items-center gap-2 border-found/40 px-5 py-3 font-semibold text-found">
                  ✓ اتحفظ · افتح ملف العميل
                </Link>
              ) : (
                <button onClick={save} disabled={saving} className="card px-5 py-3 font-semibold transition hover:border-accent">
                  {saving ? "بيحفظ…" : "💾 احفظ في العملاء"}
                </button>
              )}
            </div>
          )}
          {analysisError && <p className="no-print mt-3 text-sm text-unknown">{analysisError}</p>}
          {analyzing && (
            <div className="card mt-4 p-5">
              <div className="loading-dot h-4 w-1/3 rounded bg-surface-2" />
              <div className="loading-dot mt-3 h-3 w-full rounded bg-surface-2" />
              <div className="loading-dot mt-2 h-3 w-5/6 rounded bg-surface-2" />
            </div>
          )}
          {analysis && !analyzing && (
            <div className="mt-4">
              <AnalysisCard a={analysis} />
            </div>
          )}

          {(profiles.length > 0 || ran.p) && (
            <section className="card mt-4 p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xl">🫆</span>
                <h2 className="text-lg font-semibold">البصمة الرقمية</h2>
                <span className="text-xs text-muted">الحسابات اللي ظهرت في نتايج البحث</span>
              </div>

              {loading && profiles.length === 0 && <p className="loading-dot text-sm text-muted">بيجمع الحسابات…</p>}
              {!loading && profiles.length === 0 && (
                <p className="text-sm text-muted">مظهرش حسابات في النتايج. جرب الاسم بطريقة كتابة تانية.</p>
              )}

              {profiles.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {profiles.map((pr) => (
                    <div key={pr.platform + pr.handle} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/60 p-3">
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-solid text-sm font-bold text-accent">
                        {pr.platform[0]}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={favicon(pr.url)}
                          alt=""
                          onError={(e) => (e.currentTarget.style.display = "none")}
                          className="absolute inset-0 h-9 w-9 rounded-lg bg-surface-solid p-2"
                        />
                      </div>
                      <a href={pr.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 hover:underline">
                        <div className="text-xs text-muted">{pr.platform}</div>
                        <div className="truncate font-medium" dir="ltr" style={{ textAlign: "right" }}>{pr.handle}</div>
                      </a>
                      {/^[A-Za-z0-9._-]{1,40}$/.test(pr.handle) && (
                        <a
                          href={`/?u=${encodeURIComponent(pr.handle)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="افحص اليوزرنيم ده على كل المنصات"
                          className="no-print shrink-0 rounded-lg border border-border-strong px-2 py-1 text-xs text-accent hover:border-accent"
                        >
                          افحص ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {usernameCandidates(ran.p).length > 0 && (
                <div className="mt-5 border-t border-border pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">يوزرنيمات محتملة من الاسم</h3>
                    <span className="text-xs text-muted">
                      {usernameCandidates(ran.p).length} احتمالات × {PERSON_PLATFORMS.length} منصات
                    </span>
                    {Object.keys(guesses).length === 0 && (
                      <button onClick={guessUsernames} className="no-print chip ms-auto" data-active="true">
                        افحصهم
                      </button>
                    )}
                  </div>
                  {Object.keys(guesses).length === 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2" dir="ltr">
                      {usernameCandidates(ran.p).map((u) => (
                        <span key={u} className="rounded-md bg-surface-2 px-2 py-1 text-xs text-muted">{u}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {Object.entries(guesses).map(([u, g]) => (
                        <div key={u} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2/60 p-2.5">
                          <a
                            href={`/?u=${encodeURIComponent(u)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-36 shrink-0 truncate font-medium text-accent hover:underline"
                            dir="ltr"
                            style={{ textAlign: "right" }}
                          >
                            @{u}
                          </a>
                          {g.found.map((f) => (
                            <a
                              key={f.site}
                              href={f.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-full bg-found/15 px-2.5 py-0.5 text-xs font-semibold text-found hover:underline"
                            >
                              {f.name}
                            </a>
                          ))}
                          {g.done < g.total ? (
                            <span className="loading-dot text-xs text-muted">{g.done}/{g.total}</span>
                          ) : (
                            g.found.length === 0 && <span className="text-xs text-muted">مفيش</span>
                          )}
                        </div>
                      ))}
                      {!guessing && (
                        <p className="text-xs text-muted">
                          الحساب اللي بنفس اليوزرنيم مش شرط يكون نفس الشخص. افتحه واتأكد من الصورة والبيانات.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {SECTIONS.filter((s) => state[s.id]).map((s) => {
              const st = state[s.id];
              const link = s.google(ran.p, ran.c);
              return (
                <section key={s.id} className="card flex flex-col p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xl">{s.icon}</span>
                    <h2 className="font-semibold">{s.title}</h2>
                    {st.status === "done" && (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                        {st.results.length}
                      </span>
                    )}
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="ms-auto text-xs text-accent hover:underline">
                        افتح في جوجل ↗
                      </a>
                    )}
                  </div>

                  {st.status === "loading" && (
                    <div className="space-y-2">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="loading-dot h-14 rounded-xl bg-surface-2" style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                  )}
                  {st.status === "error" && <p className="text-sm text-unknown">{st.error}</p>}
                  {st.status === "done" && st.results.length === 0 && (
                    <p className="text-sm text-muted">مفيش نتايج.</p>
                  )}
                  {st.status === "done" && st.results.length > 0 && (
                    <ul className="space-y-2">
                      {st.results.map((r) => (
                        <li key={r.link}>
                          <a
                            href={r.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-xl border border-transparent p-2.5 transition hover:border-border-strong hover:bg-surface-2"
                          >
                            <div className="flex items-center gap-2 text-xs text-muted" dir="ltr">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`https://www.google.com/s2/favicons?domain=${host(r.link)}&sz=32`}
                                alt=""
                                onError={(e) => (e.currentTarget.style.display = "none")}
                                className="h-4 w-4 rounded"
                              />
                              <span className="truncate">{r.source ?? host(r.link)}</span>
                              {r.date && <span className="ms-auto shrink-0">{r.date}</span>}
                            </div>
                            <div className="mt-1 line-clamp-2 font-medium text-text">{r.title}</div>
                            {r.snippet && <p className="mt-1 line-clamp-2 text-sm text-muted">{r.snippet}</p>}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
