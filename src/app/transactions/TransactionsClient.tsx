"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Transaction } from "./types";
import { TransactionForm } from "./TransactionForm";
import { CATEGORIES } from "@/lib/categories";
import { formatMoney } from "@/lib/currency";
import { Sheet } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { CurrencyText } from "@/components/ui/CurrencyText";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

type TransactionsClientProps = {
  workspaceId: string;
  baseCurrency: string;
  rates: Record<string, number>;
  transactions: Transaction[];
};

type SheetState = { mode: "add" } | { mode: "edit"; transaction: Transaction } | null;

function monthKey(date: string) {
  return date.slice(0, 7);
}

function groupByDate(transactions: Transaction[]) {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const list = groups.get(t.date) ?? [];
    list.push(t);
    groups.set(t.date, list);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => (a < b ? 1 : -1));
}

function formatDateHeader(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export function TransactionsClient({
  workspaceId,
  baseCurrency,
  rates,
  transactions,
}: TransactionsClientProps) {
  const router = useRouter();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (monthKey(t.date) !== month) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      return true;
    });
  }, [transactions, month, typeFilter, categoryFilter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  function closeSheet() {
    setSheet(null);
  }

  function afterMutation() {
    closeSheet();
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-border bg-bg px-5 py-3 sm:flex-row">
        <input
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          className="rounded-control border border-border bg-surface px-3 py-2 text-body text-text outline-none focus:border-accent"
        />
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
          className="rounded-control border border-border bg-surface px-3 py-2 text-body text-text outline-none focus:border-accent"
        >
          <option value="all">All</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="rounded-control border border-border bg-surface px-3 py-2 text-body text-text outline-none focus:border-accent"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 px-5 py-4">
        {grouped.length === 0 ? (
          <EmptyState
            title="No transactions this month yet."
            action={
              <Button onClick={() => setSheet({ mode: "add" })}>Add your first transaction</Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-6">
            {grouped.map(([date, rows]) => (
              <div key={date} className="flex flex-col gap-2">
                <h3 className="text-caption font-semibold text-text-muted">
                  {formatDateHeader(date)}
                </h3>
                <div className="flex flex-col gap-2">
                  {rows.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSheet({ mode: "edit", transaction: t })}
                      className="flex items-center justify-between gap-3 rounded-card bg-surface p-4 text-left shadow-card transition-colors duration-150 ease-out hover:bg-bg"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <Badge>{t.category}</Badge>
                        <span className="truncate text-body text-text">
                          {t.description || "—"}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        <CurrencyText amount={t.amount} currency={t.currency} type={t.type} />
                        <span className="text-caption text-text-muted">
                          ≈ {formatMoney(t.amount_base, baseCurrency)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setSheet({ mode: "add" })}
        aria-label="Add transaction"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-pill bg-accent text-2xl font-bold text-white shadow-sheet transition-colors duration-150 ease-out hover:bg-accent-hover"
      >
        +
      </button>

      <Sheet
        open={sheet !== null}
        onClose={closeSheet}
        title={sheet?.mode === "edit" ? "Edit transaction" : "New transaction"}
      >
        {sheet && (
          <TransactionForm
            workspaceId={workspaceId}
            baseCurrency={baseCurrency}
            rates={rates}
            transaction={sheet.mode === "edit" ? sheet.transaction : undefined}
            onSaved={afterMutation}
            onDeleted={afterMutation}
            onCancel={closeSheet}
          />
        )}
      </Sheet>
    </div>
  );
}
