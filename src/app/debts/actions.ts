"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CURRENCIES } from "@/lib/currency";
import type { DebtActionState } from "./debt-state";

type ParsedForm = {
  workspaceId: string;
  direction: "owed_by_me" | "owed_to_me";
  personName: string;
  currency: string;
  amount: number;
  dueDate: string | null;
  status: "unpaid" | "paid";
};

function parseForm(formData: FormData): ParsedForm | { error: string } {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const personName = String(formData.get("personName") ?? "").trim();
  const currency = String(formData.get("currency") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  const amount = Number(amountRaw);
  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();
  const status = String(formData.get("status") ?? "unpaid");

  if (!workspaceId) {
    return { error: "Missing workspace." };
  }
  if (direction !== "owed_by_me" && direction !== "owed_to_me") {
    return { error: "Choose a direction." };
  }
  if (!personName) {
    return { error: "Enter a person's name." };
  }
  if (!CURRENCIES.includes(currency as (typeof CURRENCIES)[number])) {
    return { error: "Choose a valid currency." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter an amount greater than zero." };
  }
  if (status !== "unpaid" && status !== "paid") {
    return { error: "Invalid status." };
  }

  return {
    workspaceId,
    direction,
    personName,
    currency,
    amount,
    dueDate: dueDateRaw || null,
    status,
  };
}

export async function addDebt(
  _prevState: DebtActionState,
  formData: FormData,
): Promise<DebtActionState> {
  const parsed = parseForm(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const { data: rate, error: rateError } = await supabase
    .from("exchange_rates")
    .select("rate_to_base")
    .eq("workspace_id", parsed.workspaceId)
    .eq("currency", parsed.currency)
    .single();

  if (rateError || !rate) {
    return { error: "Could not find an exchange rate for that currency." };
  }

  const { error } = await supabase.from("debts").insert({
    workspace_id: parsed.workspaceId,
    created_by: user.id,
    direction: parsed.direction,
    person_name: parsed.personName,
    currency: parsed.currency,
    amount: parsed.amount,
    rate_to_base: rate.rate_to_base,
    due_date: parsed.dueDate,
    status: parsed.status,
  });

  if (error) return { error: error.message };

  revalidatePath("/debts");
  return { error: null };
}

export async function updateDebt(
  id: string,
  _prevState: DebtActionState,
  formData: FormData,
): Promise<DebtActionState> {
  const parsed = parseForm(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();

  const { data: rate, error: rateError } = await supabase
    .from("exchange_rates")
    .select("rate_to_base")
    .eq("workspace_id", parsed.workspaceId)
    .eq("currency", parsed.currency)
    .single();

  if (rateError || !rate) {
    return { error: "Could not find an exchange rate for that currency." };
  }

  const { error } = await supabase
    .from("debts")
    .update({
      direction: parsed.direction,
      person_name: parsed.personName,
      currency: parsed.currency,
      amount: parsed.amount,
      rate_to_base: rate.rate_to_base,
      due_date: parsed.dueDate,
      status: parsed.status,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/debts");
  return { error: null };
}

export async function deleteDebt(id: string) {
  const supabase = await createClient();
  await supabase.from("debts").delete().eq("id", id);
  revalidatePath("/debts");
}
