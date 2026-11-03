"use client";

import { useEffect, useRef, useState } from "react";
import { Hero } from "@/components/Nav";
import type { SearchResult } from "../api/search/route";

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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PW_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setPassword(saved);
    } catch {}
  }, []);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const p = person.trim();
    const c = company.trim();
    if (!p && !c) return;
    const id = ++runId.current;
    setRan({ p, c });
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

      <form onSubmit={run} className="card mx-auto max-w-3xl p-4 sm:p-5">
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

      {notConfigured && (
        <div className="card mx-auto mt-6 max-w-3xl border-unknown/40 p-4 text-sm text-unknown">
          خدمة البحث لسه مش متوصلة. لازم يتحط مفتاح <span dir="ltr">SERPER_API_KEY</span> في إعدادات
          Vercel. لحد ما ده يتعمل، استخدم زرار «افتح في جوجل» اللي في كل قسم.
        </div>
      )}

      {ran && (
        <>
          {!loading && total > 0 && (
            <p className="mt-8 text-center text-sm text-muted">
              لقينا <span className="font-bold text-text">{total}</span> نتيجة
            </p>
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
