import { formatMoney } from "@/lib/currency";

type CategoryBreakdownProps = {
  items: { category: string; amount: number }[];
  currency: string;
};

export function CategoryBreakdown({ items, currency }: CategoryBreakdownProps) {
  if (items.length === 0) {
    return <p className="text-body text-text-muted">No expenses yet this month.</p>;
  }

  const max = Math.max(...items.map((item) => item.amount));

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.category} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium text-text">{item.category}</span>
            <span className="text-caption text-text-muted">
              {formatMoney(item.amount, currency)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-pill bg-bg">
            <div
              className="h-full rounded-pill bg-accent"
              style={{ width: `${max === 0 ? 0 : (item.amount / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
