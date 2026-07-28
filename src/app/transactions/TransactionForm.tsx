"use client";

import { useEffect, useRef, useState, useTransition, useActionState } from "react";
import { addTransaction, updateTransaction, deleteTransaction } from "./actions";
import { TRANSACTION_INITIAL_STATE } from "./transaction-state";
import type { Transaction } from "./types";
import { CURRENCIES } from "@/lib/currency";
import { CATEGORIES } from "@/lib/categories";
import { formatMoney } from "@/lib/currency";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { FormError } from "@/components/ui/FormMessage";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

type TransactionFormProps = {
  workspaceId: string;
  baseCurrency: string;
  rates: Record<string, number>;
  transaction?: Transaction;
  onSaved: () => void;
  onDeleted: () => void;
  onCancel: () => void;
};

export function TransactionForm({
  workspaceId,
  baseCurrency,
  rates,
  transaction,
  onSaved,
  onDeleted,
  onCancel,
}: TransactionFormProps) {
  const isEdit = Boolean(transaction);
  const action = isEdit ? updateTransaction.bind(null, transaction!.id) : addTransaction;
  const [state, formAction, pending] = useActionState(action, TRANSACTION_INITIAL_STATE);
  const wasPending = useRef(false);

  const [type, setType] = useState<"income" | "expense">(transaction?.type ?? "expense");
  const [currency, setCurrency] = useState(transaction?.currency ?? baseCurrency);
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [category, setCategory] = useState(transaction?.category ?? "");

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      onSaved();
    }
    wasPending.current = pending;
  }, [pending, state, onSaved]);

  const [isDeleting, startDeleteTransition] = useTransition();

  const amountNumber = Number(amount);
  const rate = rates[currency] ?? 0;
  const baseAmountPreview =
    Number.isFinite(amountNumber) && amountNumber > 0 && rate > 0
      ? formatMoney(amountNumber * rate, baseCurrency)
      : null;

  const canSave = amountNumber > 0 && Boolean(category) && !pending;

  return (
    <form action={formAction} className="flex flex-col gap-4 py-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />

      <SegmentedControl
        options={[
          { value: "expense", label: "Expense" },
          { value: "income", label: "Income" },
        ]}
        value={type}
        onChange={(value) => setType(value as "income" | "expense")}
      />
      <input type="hidden" name="type" value={type} />

      <div className="flex flex-col gap-1.5">
        <span className="text-caption font-medium text-text-muted">Amount</span>
        <div className="flex gap-2">
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            className={`w-full rounded-control border border-border bg-surface px-4 py-3 text-big-number font-bold outline-none transition-colors duration-150 ease-out focus:border-accent ${
              type === "income" ? "text-positive" : "text-negative"
            }`}
          />
          <select
            name="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="rounded-control border border-border bg-surface px-3 text-body text-text outline-none focus:border-accent"
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
        {baseAmountPreview && (
          <span className="text-caption text-text-muted">≈ {baseAmountPreview}</span>
        )}
      </div>

      <Input
        id="date"
        name="date"
        type="date"
        label="Date"
        required
        defaultValue={transaction?.date ?? todayIsoDate()}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-caption font-medium text-text-muted">Category</span>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-pill px-3 py-1.5 text-caption font-medium transition-colors duration-150 ease-out ${
                category === c ? "bg-accent text-white" : "bg-accent/10 text-accent"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <input type="hidden" name="category" value={category} />
      </div>

      <Input
        id="description"
        name="description"
        type="text"
        label="Description"
        defaultValue={transaction?.description ?? ""}
      />

      {state.error && <FormError>{state.error}</FormError>}

      {isEdit && (
        <Button
          type="button"
          variant="destructive"
          disabled={isDeleting}
          onClick={() => {
            if (!confirm("Delete this transaction?")) return;
            startDeleteTransition(async () => {
              await deleteTransaction(transaction!.id);
              onDeleted();
            });
          }}
        >
          {isDeleting ? "Deleting…" : "Delete transaction"}
        </Button>
      )}

      <div className="sticky bottom-0 -mx-6 flex gap-3 border-t border-border bg-surface px-6 pb-4 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={!canSave} className="flex-1">
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
