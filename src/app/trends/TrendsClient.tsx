"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  STATUS_LABELS,
  TREND_STATUSES,
  type TrendItem,
  type TrendReport,
  type TrendStatus,
} from "@/lib/trends/types";
import { generateNow, setTrendStatus } from "./actions";

type Props = {
  report: TrendReport | null;
  reportDates: string[];
  items: TrendItem[];
};

const STATUS_TONE: Record<TrendStatus, "default" | "success" | "danger" | "warning" | "neutral"> = {
  review: "warning",
  approved: "success",
  scheduled: "default",
  published: "success",
  rejected: "neutral",
};

const SENTIMENT_LABELS: Record<TrendItem["sentiment"], string> = {
  positive: "إيجابي",
  negative: "سلبي",
  mixed: "منقسم",
  neutral: "محايد",
};

const CHIP =
  "shrink-0 rounded-pill border px-3 py-1.5 text-caption font-semibold transition-colors duration-150";

export function TrendsClient({ report, reportDates, items }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<TrendStatus | "all">("all");
  const [category, setCategory] = useState<string>("all");
  const [generating, startGenerating] = useTransition();
  const [generateError, setGenerateError] = useState<string | null>(null);

  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category))), [items]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const s of TREND_STATUSES) c[s] = items.filter((i) => i.status === s).length;
    return c;
  }, [items]);

  const visible = items.filter(
    (i) =>
      (statusFilter === "all" || i.status === statusFilter) &&
      (category === "all" || i.category === category),
  );

  function onGenerate() {
    setGenerateError(null);
    startGenerating(async () => {
      const result = await generateNow();
      if (result.error) setGenerateError(result.error);
      else router.refresh();
    });
  }

  return (
    <main dir="rtl" lang="ar" className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 font-arabic sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title font-bold text-text">غرفة الأخبار والترندات</h1>
          <p className="text-body text-text-muted">
            تحليل يومي تلقائي لأهم ما يتفاعل معه الناس ويبحثون عنه، مع أفكار محتوى جاهزة.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {reportDates.length > 0 && (
            <select
              aria-label="تاريخ التقرير"
              value={report?.report_date ?? ""}
              onChange={(e) => router.push(`/trends?date=${e.target.value}`)}
              className="rounded-control border border-border bg-surface px-3 py-3 text-body text-text"
            >
              {reportDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
          <Button onClick={onGenerate} loading={generating}>
            {generating ? "جاري التحليل..." : "حدّث الآن"}
          </Button>
        </div>
      </div>

      {generating && (
        <p className="text-caption text-text-muted">
          يبحث Claude في الويب ويحلل الترندات — قد يستغرق ذلك بضع دقائق.
        </p>
      )}
      {generateError && <p className="text-caption text-negative">{generateError}</p>}

      {!report ? (
        <Card className="flex flex-col items-center gap-3 text-center">
          <h2 className="text-section-title font-bold">لا يوجد تقرير بعد</h2>
          <p className="text-body text-text-muted">
            التقرير يتولد تلقائيًا كل صباح. اضغط «حدّث الآن» لتوليد تقرير اليوم.
          </p>
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-2 border-accent/30 bg-accent/5">
            <div className="flex items-center gap-2">
              <Badge>ملخص الصباح</Badge>
              <span className="text-caption text-text-muted">{report.report_date}</span>
            </div>
            <p className="text-body leading-relaxed text-text">{report.overview}</p>
          </Card>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {(["all", ...TREND_STATUSES] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`${CHIP} ${statusFilter === s ? "border-accent bg-accent text-white" : "border-border bg-surface text-text-muted hover:text-text"}`}
              >
                {s === "all" ? "الجميع" : STATUS_LABELS[s]} {counts[s]}
              </button>
            ))}
          </div>

          {categories.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {["all", ...categories].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`${CHIP} ${category === c ? "border-text bg-text text-bg" : "border-border bg-surface text-text-muted hover:text-text"}`}
                >
                  {c === "all" ? "كل المجالات" : c}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {visible.map((item) => (
              <TrendCard key={item.id} item={item} />
            ))}
            {visible.length === 0 && (
              <p className="py-8 text-center text-body text-text-muted">لا توجد مواضيع بهذا الفلتر.</p>
            )}
          </div>
        </>
      )}
    </main>
  );
}

function TrendCard({ item }: { item: TrendItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function move(status: TrendStatus) {
    startTransition(async () => {
      await setTrendStatus(item.id, status);
      router.refresh();
    });
  }

  async function copyCaption() {
    const caption = [
      item.hook,
      "",
      ...item.slides.map((s, i) => `${i + 1}. ${s.title} — ${s.body}`),
      "",
      item.hashtags.map((h) => `#${h}`).join(" "),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — nothing to do.
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-section-title font-bold text-text">{item.title}</h2>
        <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABELS[item.status]}</Badge>
        <Badge tone="neutral">{item.category}</Badge>
        <Badge tone="neutral">المزاج: {SENTIMENT_LABELS[item.sentiment]}</Badge>
        <InterestMeter value={item.audience_interest} />
      </div>

      <p className="text-body text-text">{item.summary}</p>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {item.slides.map((slide, i) => (
          <div
            key={i}
            className={`flex aspect-[4/5] w-40 shrink-0 flex-col justify-between rounded-control border p-3 ${i === 0 ? "border-accent bg-accent text-white" : "border-border bg-bg text-text"}`}
          >
            <span className={`text-caption ${i === 0 ? "text-white/80" : "text-text-muted"}`}>
              {i + 1}/{item.slides.length}
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-body font-bold leading-snug">{slide.title}</p>
              <p className={`text-caption leading-snug ${i === 0 ? "text-white/90" : "text-text-muted"}`}>
                {slide.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {item.status !== "scheduled" && item.status !== "published" && (
          <Button onClick={() => move("scheduled")} loading={pending} className="py-2">
            ✓ اعتمد وأرسل للجدولة
          </Button>
        )}
        {item.status === "scheduled" && (
          <Button onClick={() => move("published")} loading={pending} className="py-2">
            تم النشر
          </Button>
        )}
        <Button variant="secondary" onClick={copyCaption} className="py-2">
          {copied ? "تم النسخ ✓" : "انسخ الكابشن"}
        </Button>
        <Button variant="secondary" onClick={() => setOpen((o) => !o)} className="py-2">
          {open ? "إخفاء التحليل" : "التحليل الكامل"}
        </Button>
        {item.status !== "rejected" ? (
          <Button variant="ghost" onClick={() => move("rejected")} disabled={pending} className="py-2">
            تجاهل
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => move("review")} disabled={pending} className="py-2">
            أرجع للمراجعة
          </Button>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t border-border pt-4 text-body">
          <Section title="ليش ترند الآن؟">{item.why_trending}</Section>
          <Section title="التحليل">{item.analysis}</Section>
          <Section title="زاوية المحتوى">{item.content_angle}</Section>
          <Section title="الهوك">{item.hook}</Section>
          {item.hashtags.length > 0 && (
            <p className="text-caption text-accent" dir="auto">
              {item.hashtags.map((h) => `#${h}`).join(" ")}
            </p>
          )}
          {item.sources.length > 0 && (
            <div className="flex flex-col gap-1">
              <h3 className="text-caption font-semibold text-text-muted">المصادر</h3>
              <ul className="flex flex-col gap-1">
                {item.sources.map((s, i) => (
                  <li key={i}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-caption text-accent underline-offset-2 hover:underline"
                    >
                      {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-caption font-semibold text-text-muted">{title}</h3>
      <p className="leading-relaxed text-text">{children}</p>
    </div>
  );
}

function InterestMeter({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-1.5 text-caption text-text-muted" title="اهتمام الجمهور">
      <span className="flex h-1.5 w-16 overflow-hidden rounded-pill bg-border" dir="ltr">
        <span className="bg-accent" style={{ width: `${value * 10}%` }} />
      </span>
      {value}/10
    </span>
  );
}
