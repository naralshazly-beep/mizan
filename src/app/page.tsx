"use client";

import { useMemo, useRef, useState } from "react";
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

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const name = username.trim().replace(/^@/, "");
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

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <header className="mb-8 text-center">
        <div className="mb-3 text-5xl">🫆</div>
        <h1 className="text-3xl font-bold sm:text-4xl">بصمة</h1>
        <p className="mt-3 text-muted">
          اكتب اليوزرنيم بتاعك وشوف هو ظاهر على أنهي منصات من {SITES.length} منصة.
        </p>
      </header>

      <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
        <input
          dir="ltr"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-lg outline-none focus:border-accent"
        />
        {running ? (
          <button
            type="button"
            onClick={stop}
            className="rounded-xl border border-border bg-surface-2 px-6 py-3 font-semibold"
          >
            إيقاف
          </button>
        ) : (
          <button
            type="submit"
            className="rounded-xl bg-accent px-6 py-3 font-semibold text-bg hover:opacity-90"
          >
            افحص
          </button>
        )}
      </form>
      {error && <p className="mt-2 text-sm text-unknown">{error}</p>}

      {rows.length > 0 && (
        <section className="mt-8">
          <div className="mb-2 flex items-center justify-between text-sm text-muted">
            <span>
              نتايج <span dir="ltr" className="font-semibold text-text">@{searched}</span>
            </span>
            <span>
              {done} / {rows.length}
            </span>
          </div>
          <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${(done / rows.length) * 100}%` }}
            />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            {(
              [
                ["all", `الكل (${rows.length})`],
                ["found", `موجود (${counts.found})`],
                ["unknown", `غير مؤكد (${counts.unknown})`],
                ["not_found", `مش موجود (${counts.not_found})`],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-full border px-4 py-1.5 text-sm ${
                  filter === key
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted hover:text-text"
                }`}
              >
                {label}
              </button>
            ))}
            {done > 0 && (
              <button
                onClick={exportCsv}
                className="ms-auto rounded-full border border-border px-4 py-1.5 text-sm text-muted hover:text-text"
              >
                تنزيل CSV
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">المنصة</th>
                  <th className="hidden px-4 py-3 text-start font-medium sm:table-cell">النوع</th>
                  <th className="px-4 py-3 text-start font-medium">الحالة</th>
                  <th className="px-4 py-3 text-start font-medium">اللينك</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ site, result }) => (
                  <tr key={site.id} className="border-t border-border bg-surface">
                    <td className="px-4 py-3 font-medium" dir="ltr" style={{ textAlign: "right" }}>
                      {site.name}
                    </td>
                    <td className="hidden px-4 py-3 text-muted sm:table-cell">
                      {CATEGORY_LABELS[site.category]}
                    </td>
                    <td className="px-4 py-3">
                      {result ? (
                        <span
                          title={result.reason}
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[result.status]}`}
                        >
                          {STATUS_LABEL[result.status]}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">جاري الفحص…</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {result && result.status !== "not_found" && result.url ? (
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline"
                        >
                          فتح ↗
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="mt-12 space-y-2 text-center text-xs leading-relaxed text-muted">
        <p>
          الأداة دي معمولة عشان تفحص بصمتك أنت. بتدور في الصفحات العامة بس، ومش بتسجل دخول ولا
          بتحفظ أي حاجة.
        </p>
        <p>
          «موجود» معناها إن فيه حساب بنفس الاسم، مش شرط يكون بتاعك. «غير مؤكد» معناها إن الموقع
          رفض الطلب أو اتأخر في الرد.
        </p>
      </footer>
    </main>
  );
}
