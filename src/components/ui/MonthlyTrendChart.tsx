export type TrendPoint = { month: string; income: number; expense: number };

type MonthlyTrendChartProps = {
  data: TrendPoint[];
};

const WIDTH = 320;
const HEIGHT = 140;
const PADDING = 8;

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(year, month - 1, 1));
}

function points(values: number[], max: number) {
  const stepX = (WIDTH - PADDING * 2) / (values.length - 1 || 1);
  return values.map((v, i) => {
    const x = PADDING + i * stepX;
    const y = HEIGHT - PADDING - (max === 0 ? 0 : (v / max) * (HEIGHT - PADDING * 2));
    return [x, y] as const;
  });
}

function linePath(coords: readonly (readonly [number, number])[]) {
  return coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
}

function areaPath(coords: readonly (readonly [number, number])[]) {
  if (coords.length === 0) return "";
  const first = coords[0];
  const last = coords[coords.length - 1];
  return `${linePath(coords)} L${last[0]},${HEIGHT - PADDING} L${first[0]},${HEIGHT - PADDING} Z`;
}

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  const max = Math.max(...data.flatMap((d) => [d.income, d.expense]), 0) || 1;
  const incomePoints = points(
    data.map((d) => d.income),
    max,
  );
  const expensePoints = points(
    data.map((d) => d.expense),
    max,
  );

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Income vs expense over the last 6 months"
      >
        <line
          x1={PADDING}
          y1={HEIGHT - PADDING}
          x2={WIDTH - PADDING}
          y2={HEIGHT - PADDING}
          className="stroke-border"
          strokeWidth="1"
        />
        <path d={areaPath(incomePoints)} className="fill-positive/10" stroke="none" />
        <path d={areaPath(expensePoints)} className="fill-negative/10" stroke="none" />
        <path d={linePath(incomePoints)} fill="none" className="stroke-positive" strokeWidth="2" />
        <path d={linePath(expensePoints)} fill="none" className="stroke-negative" strokeWidth="2" />
      </svg>
      <div className="flex justify-between text-caption text-text-muted">
        {data.map((d) => (
          <span key={d.month}>{formatMonthLabel(d.month)}</span>
        ))}
      </div>
      <div className="flex gap-4 text-caption text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-pill bg-positive" /> Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-pill bg-negative" /> Expense
        </span>
      </div>
    </div>
  );
}
