type Tone = "positive" | "negative" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  positive: "text-positive",
  negative: "text-negative",
  neutral: "text-text",
};

type Trend = {
  direction: "up" | "down" | "flat";
  label: string;
};

const TREND_ARROW: Record<Trend["direction"], string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

const TREND_CLASSES: Record<Trend["direction"], string> = {
  up: "text-positive",
  down: "text-negative",
  flat: "text-text-muted",
};

type StatCardProps = {
  label: string;
  value: string;
  currency?: string;
  tone?: Tone;
  valueClassName?: string;
  trend?: Trend;
  helperText?: string;
  emphasized?: boolean;
  className?: string;
};

export function StatCard({
  label,
  value,
  currency,
  tone,
  valueClassName,
  trend,
  helperText,
  emphasized = false,
  className = "",
}: StatCardProps) {
  const toneClass = valueClassName ?? (tone ? TONE_CLASSES[tone] : "text-text");

  return (
    <div
      className={`flex flex-1 flex-col gap-1 rounded-card border border-border bg-surface p-5 shadow-card ${
        emphasized ? "border-t-4 border-t-accent" : ""
      } ${className}`}
    >
      <span className="text-card-label text-text-secondary">{label}</span>
      <span className={`text-financial-value tabular-nums font-bold ${toneClass}`}>
        {value}
        {currency && <span className="ml-1 text-card-label font-medium text-text-secondary">{currency}</span>}
      </span>
      {trend && (
        <span className={`text-helper font-medium ${TREND_CLASSES[trend.direction]}`}>
          {TREND_ARROW[trend.direction]} {trend.label}
        </span>
      )}
      {helperText && <span className="text-helper text-text-secondary">{helperText}</span>}
    </div>
  );
}
