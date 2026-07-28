"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Debt } from "./types";
import { DebtForm } from "./DebtForm";
import { formatMoney } from "@/lib/currency";
import { Sheet } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { CurrencyText } from "@/components/ui/CurrencyText";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";

type DebtsClientProps = {
  workspaceId: string;
  baseCurrency: string;
  rates: Record<string, number>;
  debts: Debt[];
};

type SheetState = { mode: "add" } | { mode: "edit"; debt: Debt } | null;

function formatDueDate(date: string | null) {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${date}T00:00:00`),
  );
}

function sortByDueDate(debts: Debt[]) {
  return [...debts].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  });
}

export function DebtsClient({ workspaceId, baseCurrency, rates, debts }: DebtsClientProps) {
  const router = useRouter();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [directionFilter, setDirectionFilter] = useState<"all" | "owed_by_me" | "owed_to_me">(
    "all",
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "paid">("all");

  const totalOwedByMe = useMemo(
    () =>
      debts
        .filter((d) => d.direction === "owed_by_me" && d.status === "unpaid")
        .reduce((sum, d) => sum + d.amount_base, 0),
    [debts],
  );
  const totalOwedToMe = useMemo(
    () =>
      debts
        .filter((d) => d.direction === "owed_to_me" && d.status === "unpaid")
        .reduce((sum, d) => sum + d.amount_base, 0),
    [debts],
  );
  const net = totalOwedToMe - totalOwedByMe;

  const filtered = useMemo(() => {
    return debts.filter((d) => {
      if (directionFilter !== "all" && d.direction !== directionFilter) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      return true;
    });
  }, [debts, directionFilter, statusFilter]);

  const unpaid = useMemo(() => sortByDueDate(filtered.filter((d) => d.status === "unpaid")), [
    filtered,
  ]);
  const paid = useMemo(() => sortByDueDate(filtered.filter((d) => d.status === "paid")), [
    filtered,
  ]);

  function closeSheet() {
    setSheet(null);
  }

  function afterMutation() {
    closeSheet();
    router.refresh();
  }

  function renderRow(debt: Debt) {
    const dueLabel = formatDueDate(debt.due_date);
    return (
      <button
        key={debt.id}
        type="button"
        onClick={() => setSheet({ mode: "edit", debt })}
        className="flex items-center justify-between gap-3 rounded-card bg-surface p-4 text-left shadow-card transition-colors duration-150 ease-out hover:bg-bg"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <Badge>{debt.direction === "owed_by_me" ? "I owe" : "Owed to me"}</Badge>
          <span className="truncate text-body text-text">{debt.person_name}</span>
          {dueLabel && <span className="text-caption text-text-muted">Due {dueLabel}</span>}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <CurrencyText
            amount={debt.amount}
            currency={debt.currency}
            type={debt.direction === "owed_to_me" ? "income" : "expense"}
          />
          <span className="text-caption text-text-muted">
            ≈ {formatMoney(debt.amount_base, baseCurrency)}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 bg-bg px-5 py-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        <StatCard
          label="Total I Owe"
          value={formatMoney(totalOwedByMe, baseCurrency)}
          valueClassName="text-negative"
        />
        <StatCard
          label="Total Owed to Me"
          value={formatMoney(totalOwedToMe, baseCurrency)}
          valueClassName="text-positive"
        />
        <StatCard
          label="Net"
          value={formatMoney(net, baseCurrency)}
          valueClassName={net >= 0 ? "text-positive" : "text-negative"}
          emphasized
        />
      </div>

      <div className="flex gap-2">
        <select
          value={directionFilter}
          onChange={(event) => setDirectionFilter(event.target.value as typeof directionFilter)}
          className="rounded-control border border-border bg-surface px-3 py-2 text-body text-text outline-none focus:border-accent"
        >
          <option value="all">All</option>
          <option value="owed_by_me">I owe</option>
          <option value="owed_to_me">Owed to me</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          className="rounded-control border border-border bg-surface px-3 py-2 text-body text-text outline-none focus:border-accent"
        >
          <option value="all">All statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {unpaid.length === 0 && paid.length === 0 ? (
        <EmptyState
          title="No debts tracked yet."
          action={<Button onClick={() => setSheet({ mode: "add" })}>Add your first debt</Button>}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {unpaid.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-caption font-semibold text-text-muted">Unpaid</h3>
              <div className="flex flex-col gap-2">{unpaid.map(renderRow)}</div>
            </div>
          )}
          {paid.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-caption font-semibold text-text-muted">Paid</h3>
              <div className="flex flex-col gap-2">{paid.map(renderRow)}</div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setSheet({ mode: "add" })}
        aria-label="Add debt"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-pill bg-accent text-2xl font-bold text-white shadow-sheet transition-colors duration-150 ease-out hover:bg-accent-hover"
      >
        +
      </button>

      <Sheet
        open={sheet !== null}
        onClose={closeSheet}
        title={sheet?.mode === "edit" ? "Edit debt" : "New debt"}
      >
        {sheet && (
          <DebtForm
            workspaceId={workspaceId}
            baseCurrency={baseCurrency}
            rates={rates}
            debt={sheet.mode === "edit" ? sheet.debt : undefined}
            onSaved={afterMutation}
            onDeleted={afterMutation}
            onCancel={closeSheet}
          />
        )}
      </Sheet>
    </div>
  );
}
