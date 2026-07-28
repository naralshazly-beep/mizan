import { formatMoney } from "@/lib/currency";

type CurrencyTextProps = {
  amount: number;
  currency: string;
  type: "income" | "expense";
  className?: string;
};

export function CurrencyText({ amount, currency, type, className = "" }: CurrencyTextProps) {
  const sign = type === "expense" ? "-" : "+";
  const colorClass = type === "expense" ? "text-negative" : "text-positive";

  return (
    <span className={`${colorClass} ${className}`}>
      {sign}
      {formatMoney(amount, currency)}
    </span>
  );
}
