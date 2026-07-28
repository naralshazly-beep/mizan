"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Transaction } from "@/app/transactions/types";
import { formatMoney } from "@/lib/currency";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { CategoryBreakdown } from "@/components/ui/CategoryBreakdown";
import { MonthlyTrendChart, type TrendPoint } from "@/components/ui/MonthlyTrendChart";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

type DashboardTransaction = Pick<Transaction, "date" | "type" | "category" | "amount_base">;

type DashboardClientProps = {
  baseCurrency: string;
  transactions: DashboardTransaction[];
};

function monthKey(date: string) {
  return date.slice(0, 7);
}

function last6MonthKeys(selectedMonth: string) {
  const [year, month] = selectedMonth.split("-").map(Number);
  const keys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function sumByType(rows: DashboardTransaction[], type: "income" | "expense") {
  return rows.filter((t) => t.type === type).reduce((sum, t) => sum + t.amount_base, 0);
}

export function DashboardClient({ baseCurrency, transactions }: DashboardClientProps) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const monthTransactions = useMemo(
    () => transactions.filter((t) => monthKey(t.date) === month),
    [transactions, month],
  );

  const totalIncome = useMemo(() => sumByType(monthTransactions, "income"), [monthTransactions]);
  const totalExpenses = useMemo(() => sumByType(monthTransactions, "expense"), [monthTransactions]);
  const net = totalIncome - totalExpenses;

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of monthTransactions) {
      if (t.type !== "expense") continue;
      totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount_base);
    }
    return Array.from(totals.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthTransactions]);

  const trend: TrendPoint[] = useMemo(() => {
    return last6MonthKeys(month).map((key) => {
      const rows = transactions.filter((t) => monthKey(t.date) === key);
      return { month: key, income: sumByType(rows, "income"), expense: sumByType(rows, "expense") };
    });
  }, [transactions, month]);

  const hasAnyData = transactions.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-6 bg-bg px-5 py-6">
      <input
        type="month"
        value={month}
        onChange={(event) => setMonth(event.target.value)}
        className="w-fit rounded-control border border-border bg-surface px-3 py-2 text-body text-text outline-none focus:border-accent"
      />

      {!hasAnyData ? (
        <EmptyState
          title="No transactions yet."
          action={
            <Link href="/transactions">
              <Button>Add your first transaction</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row">
            <StatCard
              label="Total Income"
              value={formatMoney(totalIncome, baseCurrency)}
              valueClassName="text-positive"
            />
            <StatCard
              label="Total Expenses"
              value={formatMoney(totalExpenses, baseCurrency)}
              valueClassName="text-negative"
            />
            <StatCard
              label="Net Profit/Loss"
              value={formatMoney(net, baseCurrency)}
              valueClassName={net >= 0 ? "text-positive" : "text-negative"}
              emphasized
            />
          </div>

          <Card className="flex flex-col gap-4">
            <h2 className="text-header font-semibold text-text">Expenses by category</h2>
            <CategoryBreakdown items={categoryTotals} currency={baseCurrency} />
          </Card>

          <Card className="flex flex-col gap-4">
            <h2 className="text-header font-semibold text-text">Monthly trend</h2>
            <MonthlyTrendChart data={trend} />
          </Card>
        </>
      )}
    </div>
  );
}
