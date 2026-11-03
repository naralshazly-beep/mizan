import type { Analysis } from "@/lib/analysis";

const LEVEL = {
  red: { dot: "bg-red-500", text: "text-red-400", label: "خطر" },
  yellow: { dot: "bg-unknown", text: "text-unknown", label: "اتأكد" },
  green: { dot: "bg-found", text: "text-found", label: "مطمّن" },
} as const;

const CERT = {
  confirmed: { label: "مؤكد", cls: "text-found" },
  likely: { label: "غالبًا", cls: "text-unknown" },
  unclear: { label: "مش واضح", cls: "text-muted" },
} as const;

const CONF = { high: "عالية", medium: "متوسطة", low: "ضعيفة" } as const;

export default function AnalysisCard({ a }: { a: Analysis }) {
  return (
    <section className="card border-accent/30 p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xl">✨</span>
        <h2 className="text-lg font-semibold">تحليل الذكاء الاصطناعي</h2>
        <span className="ms-auto rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">
          الثقة في النتايج: {CONF[a.confidence]}
        </span>
      </div>

      <p className="leading-relaxed">{a.summary}</p>
      {a.identity_note && (
        <p className="mt-3 rounded-xl border border-unknown/30 bg-unknown/10 p-3 text-sm text-unknown">{a.identity_note}</p>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-surface-2/60 p-3">
          <h3 className="mb-1 text-sm font-semibold text-muted">👤 الشخص</h3>
          <p className="text-sm leading-relaxed">{a.person}</p>
        </div>
        <div className="rounded-xl bg-surface-2/60 p-3">
          <h3 className="mb-1 text-sm font-semibold text-muted">🏢 الشركة</h3>
          <p className="text-sm leading-relaxed">{a.company}</p>
        </div>
      </div>

      {(a.affiliations?.length ?? 0) > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-muted">🏛️ الشركات اللي مرتبط بيها</h3>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <tbody>
                {a.affiliations.map((f, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="p-2.5 font-medium">{f.company}</td>
                    <td className="p-2.5 text-muted">{f.role}</td>
                    <td className="p-2.5 text-xs">
                      <span className={CERT[f.certainty].cls}>{CERT[f.certainty].label}</span>
                    </td>
                    <td className="p-2.5 text-xs">
                      {/^https?:\/\//.test(f.source) ? (
                        <a href={f.source} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">المصدر ↗</a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {a.business_scale && (
        <div className="mt-3 rounded-xl bg-surface-2/60 p-3">
          <h3 className="mb-1 text-sm font-semibold text-muted">📊 حجم شغله</h3>
          <p className="text-sm leading-relaxed">{a.business_scale}</p>
        </div>
      )}

      {a.signals.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-muted">🚦 المؤشرات</h3>
          <ul className="space-y-1.5">
            {a.signals.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${LEVEL[s.level].dot}`} />
                <span className={`shrink-0 font-semibold ${LEVEL[s.level].text}`}>{LEVEL[s.level].label}:</span>
                <span>{s.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {a.talking_points.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted">💬 ابدأ الكلام بـ</h3>
            <ul className="list-disc space-y-1 ps-5 text-sm">
              {a.talking_points.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        )}
        {a.questions.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-muted">❓ اسأله</h3>
            <ul className="list-disc space-y-1 ps-5 text-sm">
              {a.questions.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-muted">التحليل مبني على نتايج البحث العامة بس. راجع المصادر قبل ما تعتمد على أي معلومة.</p>
    </section>
  );
}
