"use client";

import { useState } from "react";
import Link from "next/link";

type Search = { name: string; group: string; build: (p: string, c: string) => string | null };

const q = (s: string) => encodeURIComponent(s);
const quoted = (s: string) => (s ? `"${s}"` : "");
const both = (p: string, c: string) => [quoted(p), quoted(c)].filter(Boolean).join(" ");

const SEARCHES: Search[] = [
  // People
  { group: "الشخص", name: "Google", build: (p, c) => (p ? `https://www.google.com/search?q=${q(both(p, c))}` : null) },
  { group: "الشخص", name: "LinkedIn", build: (p, c) => (p ? `https://www.linkedin.com/search/results/people/?keywords=${q([p, c].filter(Boolean).join(" "))}` : null) },
  { group: "الشخص", name: "LinkedIn عبر Google", build: (p, c) => (p ? `https://www.google.com/search?q=${q(`site:linkedin.com/in ${both(p, c)}`)}` : null) },
  { group: "الشخص", name: "X (Twitter)", build: (p) => (p ? `https://x.com/search?q=${q(quoted(p))}&f=user` : null) },
  { group: "الشخص", name: "Instagram عبر Google", build: (p, c) => (p ? `https://www.google.com/search?q=${q(`site:instagram.com ${both(p, c)}`)}` : null) },
  { group: "الشخص", name: "Facebook عبر Google", build: (p, c) => (p ? `https://www.google.com/search?q=${q(`site:facebook.com ${both(p, c)}`)}` : null) },
  { group: "الشخص", name: "YouTube", build: (p) => (p ? `https://www.youtube.com/results?search_query=${q(quoted(p))}` : null) },

  // Company
  { group: "الشركة", name: "Google", build: (_, c) => (c ? `https://www.google.com/search?q=${q(quoted(c))}` : null) },
  { group: "الشركة", name: "LinkedIn (شركات)", build: (_, c) => (c ? `https://www.linkedin.com/search/results/companies/?keywords=${q(c)}` : null) },
  { group: "الشركة", name: "موظفين الشركة على LinkedIn", build: (_, c) => (c ? `https://www.google.com/search?q=${q(`site:linkedin.com/in ${quoted(c)}`)}` : null) },
  { group: "الشركة", name: "OpenCorporates (سجل الشركات)", build: (_, c) => (c ? `https://opencorporates.com/companies?q=${q(c)}` : null) },
  { group: "الشركة", name: "تقييمات Google Maps", build: (_, c) => (c ? `https://www.google.com/maps/search/${q(c)}` : null) },
  { group: "الشركة", name: "Trustpilot", build: (_, c) => (c ? `https://www.trustpilot.com/search?query=${q(c)}` : null) },

  // News & reputation
  { group: "أخبار وسمعة", name: "Google News", build: (p, c) => (p || c ? `https://news.google.com/search?q=${q(both(p, c))}` : null) },
  { group: "أخبار وسمعة", name: "نصب / احتيال / قضايا", build: (p, c) => (p || c ? `https://www.google.com/search?q=${q(`${both(p, c)} (scam OR fraud OR lawsuit OR نصب OR احتيال OR قضية)`)}` : null) },
  { group: "أخبار وسمعة", name: "ملفات PDF وعروض", build: (p, c) => (p || c ? `https://www.google.com/search?q=${q(`${both(p, c)} filetype:pdf`)}` : null) },
];

const GROUPS = ["الشخص", "الشركة", "أخبار وسمعة"];

export default function NameSearch() {
  const [person, setPerson] = useState("");
  const [company, setCompany] = useState("");
  const p = person.trim();
  const c = company.trim();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <header className="mb-8 text-center">
        <div className="mb-3 text-5xl">🔎</div>
        <h1 className="text-3xl font-bold sm:text-4xl">البحث بالاسم والشركة</h1>
        <p className="mt-3 text-muted">
          اكتب اسم العميل أو شركته، وافتح كل البحوث الجاهزة عنه في المصادر العامة.
        </p>
        <div className="mt-3 flex justify-center gap-4 text-sm">
          <Link href="/" className="text-accent hover:underline">البحث باليوزرنيم</Link>
          <Link href="/image" className="text-accent hover:underline">البحث بالصورة</Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          placeholder="اسم الشخص (مثلًا: Ahmed Hassan)"
          className="rounded-xl border border-border bg-surface px-4 py-3 outline-none focus:border-accent"
        />
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="اسم الشركة (اختياري)"
          className="rounded-xl border border-border bg-surface px-4 py-3 outline-none focus:border-accent"
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        نصيحة: اكتب الاسم بالإنجليزي زي ما بيكتبه على لينكدإن، وجرب كمان بالعربي.
      </p>

      {GROUPS.map((group) => {
        const items = SEARCHES.filter((s) => s.group === group);
        return (
          <section key={group} className="mt-8">
            <h2 className="mb-3 font-semibold">{group}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((s) => {
                const href = s.build(p, c);
                return (
                  <a
                    key={s.name}
                    href={href ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!href}
                    className={`flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 ${
                      href ? "hover:border-accent" : "pointer-events-none opacity-40"
                    }`}
                  >
                    <span>{s.name}</span>
                    <span className="text-accent">↗</span>
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
