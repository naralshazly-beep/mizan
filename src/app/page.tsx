"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Hero } from "@/components/Nav";
import { CATEGORY_LABELS, SITES, USERNAME_RE, type Site } from "@/lib/sites";
import type { CheckResult, CheckStatus } from "./api/check/route";

type Row = { site: Site; result?: CheckResult };
type Filter = "all" | CheckStatus;

const CONCURRENCY = 8;

const STATUS_LABEL: Record<CheckStatus, string> = {
  found: "موجود",
  not_found: "مش موجود",
  unknown: "غير مؤكد",
};

const STATUS_STYLE: Record<CheckStatus, string> = {
  found: "bg-found/15 text-found",
  not_found: "bg-missing/15 text-missing",
  unknown: "bg-unknown/15 text-unknown",
};

export default function Home() {
  const [username, setUsername] = useState("");
  const [searched, setSearched] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const runId = useRef(0);

  const done = rows.filter((r) => r.result).length;
  const counts = useMemo(() => {
    const c = { found: 0, not_found: 0, unknown: 0 };
    for (const r of rows) if (r.result) c[r.result.status]++;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const order: Record<string, number> = { found: 0, unknown: 1, not_found: 2, pending: 3 };
    return rows
      .filter((r) => filter === "all" || r.result?.status === filter)
      .sort(
        (a, b) =>
          order[a.result?.status ?? "pending"] - order[b.result?.status ?? "pending"] ||
          a.site.name.localeCompare(b.site.name),
      );
  }, [rows, filter]);

  function search(e: React.FormEvent) {
    e.preventDefault();
    run(username);
  }

  async function run(input: string) {
    const name = input.trim().replace(/^@/, "");
    if (/^\+?[\d\s()-]{7,}$/.test(name)) {
      setError(
        "ده شكله رقم تليفون. الأداة بتدور باليوزرنيم بس (زي ahmed_99)، لأن مفيش طريقة عامة تعرف بيها الرقم مربوط بأنهي حسابات.",
      );
      return;
    }
    if (name.includes("@")) {
      setError("ده شكله إيميل. اكتب اليوزرنيم بس (الجزء اللي بيظهر في لينك حسابك).");
      return;
    }
    if (!USERNAME_RE.test(name)) {
      setError("اليوزرنيم لازم يكون حروف إنجليزي أو أرقام أو . _ - بس (لحد 40 حرف).");
      return;
    }
    setError("");
    const id = ++runId.current;
    setSearched(name);
    setFilter("all");
    setRunning(true);
    setRows(SITES.map((site) => ({ site })));

    const queue = [...SITES];
    const worker = async () => {
      while (queue.length && runId.current === id) {
        const site = queue.shift()!;
        let result: CheckResult;
        try {
          const res = await fetch(
            `/api/check?site=${site.id}&username=${encodeURIComponent(name)}`,
          );
          result = await res.json();
        } catch {
          result = { site: site.id, status: "unknown", url: "", reason: "network error" };
        }
        if (runId.current !== id) return;
        setRows((prev) => prev.map((r) => (r.site.id === site.id ? { ...r, result } : r)));
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (runId.current === id) setRunning(false);
  }

  function stop() {
    runId.current++;
    setRunning(false);
  }

  function exportCsv() {
    const lines = [
      "platform,category,status,url",
      ...rows
        .filter((r) => r.result)
        .map((r) =>
          [r.site.name, r.site.category, r.result!.status, r.result!.url]
            .map((v) => `"${String(v).replaceAll('"', '""')}"`)
            .join(","),
        ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `basma-${searched}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  useEffect(() => {
    // Allow deep links like /?u=ahmedhassan from the name page.
    const u = new URLSearchParams(window.location.search).get("u");
    if (u) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUsername(u);
      run(u);
    }
  }, []);

  const found = visible.filter((r) => r.result?.status === "found");
  const rest = visible.filter((r) => r.result?.status !== "found");

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <Hero
        title="ابحث باليوزرنيم"
        subtitle={`اكتب يوزرنيم وبصمة تفحصه على ${SITES.length} منصة في نفس الوقت: تواصل، برمجة، ألعاب، تصميم، وموسيقى.`}
      />

      <form onSubmit={search} className="card mx-auto flex max-w-3xl flex-col gap-3 p-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg text-muted">@</span>
          <input
            dir="ltr"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoComplete="off"
            spellCheck={false}
            className="field pl-10 text-lg"
          />
        </div>
        {running ? (
          <button type="button" onClick={stop} className="rounded-[0.9rem] border border-border-strong bg-surface-2 px-6 py-3 font-semibold">
            إيقاف
          </button>
        ) : (
          <button type="submit" className="btn-primary">افحص</button>
        )}
      </form>
      {error && <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-unknown">{error}</p>}

      {rows.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 grid grid-cols-3 gap-3">
            {(
              [
                ["found", "حساب موجود", "text-found", counts.found],
                ["unknown", "غير مؤكد", "text-unknown", counts.unknown],
                ["not_found", "مش موجود", "text-missing", counts.not_found],
              ] as const
            ).map(([key, label, color, n]) => (
              <button
                key={key}
                onClick={() => setFilter(filter === key ? "all" : key)}
                data-active={filter === key}
                className="card p-4 text-start transition data-[active=true]:border-accent"
              >
                <div className={`text-3xl font-bold ${color}`}>{n}</div>
                <div className="mt-1 text-sm text-muted">{label}</div>
              </button>
            ))}
          </div>

          <div className="mb-6 flex items-center gap-3 text-sm text-muted">
            <span>
              <span dir="ltr" className="font-semibold text-text">@{searched}</span>
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full bg-gradient-to-l from-accent to-accent-2 transition-all"
                style={{ width: `${(done / rows.length) * 100}%` }}
              />
            </div>
            <span>{done} / {rows.length}</span>
            {done > 0 && (
              <button onClick={exportCsv} className="chip">تنزيل CSV</button>
            )}
          </div>

          {found.length > 0 && (
            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {found.map(({ site, result }) => (
                <a
                  key={site.id}
                  href={result!.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card group flex items-center gap-3 border-found/30 p-4 transition hover:border-found"
                >
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 font-bold text-found">
                    {site.name[0]}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${new URL(result!.url).hostname}&sz=64`}
                      alt=""
                      onError={(e) => (e.currentTarget.style.display = "none")}
                      className="absolute inset-0 h-10 w-10 rounded-lg bg-surface-2 p-1.5"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold" dir="ltr" style={{ textAlign: "right" }}>{site.name}</div>
                    <div className="truncate text-xs text-muted" dir="ltr" style={{ textAlign: "right" }}>
                      {result!.url.replace(/^https?:\/\/(www\.)?/, "")}
                    </div>
                  </div>
                  <span className="text-found transition group-hover:-translate-x-0.5">↗</span>
                </a>
              ))}
            </div>
          )}

          {rest.length > 0 && (
            <div className="card divide-y divide-border overflow-hidden">
              {rest.map(({ site, result }) => (
                <div key={site.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="flex-1 font-medium" dir="ltr" style={{ textAlign: "right" }}>{site.name}</span>
                  <span className="hidden text-xs text-muted sm:inline">{CATEGORY_LABELS[site.category]}</span>
                  {result ? (
                    <span title={result.reason} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[result.status]}`}>
                      {STATUS_LABEL[result.status]}
                    </span>
                  ) : (
                    <span className="loading-dot text-xs text-muted">جاري الفحص…</span>
                  )}
                  {result?.status === "unknown" && result.url ? (
                    <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
                      افتح ↗
                    </a>
                  ) : (
                    <span className="w-8" />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <footer className="mx-auto mt-12 max-w-2xl space-y-1 text-center text-xs leading-relaxed text-muted">
        <p>بصمة بتدور في الصفحات العامة بس، ومش بتحفظ أي حاجة.</p>
        <p>«موجود» معناها إن فيه حساب بنفس الاسم، مش شرط يكون نفس الشخص. «غير مؤكد» معناها إن الموقع رفض الفحص، افتحه بنفسك.</p>
      </footer>
    </main>
  );
}
