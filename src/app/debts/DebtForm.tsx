"use client";

import { useEffect, useRef, useState, useTransition, useActionState } from "react";
import { addDebt, updateDebt, deleteDebt } from "./actions";
import { DEBT_INITIAL_STATE } from "./debt-state";
import type { Debt } from "./types";
import { CURRENCIES, formatMoney } from "@/lib/currency";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { FormError } from "@/components/ui/FormMessage";

type DebtFormProps = {
  workspaceId: string;
  baseCurrency: string;
  rates: Record<string, number>;
  debt?: Debt;
  onSaved: () => void;
  onDeleted: () => void;
  onCancel: () => void;
};

export function DebtForm({
  workspaceId,
  baseCurrency,
  rates,
  debt,
  onSaved,
  onDeleted,
  onCancel,
}: DebtFormProps) {
  const isEdit = Boolean(debt);
  const action = isEdit ? updateDebt.bind(null, debt!.id) : addDebt;
  const [state, formAction, pending] = useActionState(action, DEBT_INITIAL_STATE);
  const wasPending = useRef(false);

  const [direction, setDirection] = useState<"owed_by_me" | "owed_to_me">(
    debt?.direction ?? "owed_by_me",
  );
  const [currency, setCurrency] = useState(debt?.currency ?? baseCurrency);
  const [amount, setAmount] = useState(debt ? String(debt.amount) : "");
  const [status, setStatus] = useState<"unpaid" | "paid">(debt?.status ?? "unpaid");

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

  const canSave = amountNumber > 0 && !pending;

  return (
    <form action={formAction} className="flex flex-col gap-4 py-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />

      <SegmentedControl
        options={[
          { value: "owed_by_me", label: "I owe" },
          { value: "owed_to_me", label: "Owed to me" },
        ]}
        value={direction}
        onChange={(value) => setDirection(value as "owed_by_me" | "owed_to_me")}
      />
      <input type="hidden" name="direction" value={direction} />

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
              direction === "owed_to_me" ? "text-positive" : "text-negative"
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
        id="personName"
        name="personName"
        type="text"
        label="Person"
        required
        defaultValue={debt?.person_name ?? ""}
      />

      <Input
        id="dueDate"
        name="dueDate"
        type="date"
        label="Due date (optional)"
        defaultValue={debt?.due_date ?? ""}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-caption font-medium text-text-muted">Status</span>
        <SegmentedControl
          options={[
            { value: "unpaid", label: "Unpaid" },
            { value: "paid", label: "Paid" },
          ]}
          value={status}
          onChange={(value) => setStatus(value as "unpaid" | "paid")}
        />
      </div>
      <input type="hidden" name="status" value={status} />

      {state.error && <FormError>{state.error}</FormError>}

      {isEdit && (
        <Button
          type="button"
          variant="destructive"
          disabled={isDeleting}
          onClick={() => {
            if (!confirm("Delete this debt?")) return;
            startDeleteTransition(async () => {
              await deleteDebt(debt!.id);
              onDeleted();
            });
          }}
        >
          {isDeleting ? "Deleting…" : "Delete debt"}
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
