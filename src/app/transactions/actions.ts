"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CURRENCIES } from "@/lib/currency";
import type { TransactionActionState } from "./transaction-state";

type ParsedForm = {
  workspaceId: string;
  date: string;
  type: "income" | "expense";
  category: string;
  description: string;
  currency: string;
  amount: number;
};

function parseForm(formData: FormData): ParsedForm | { error: string } {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const date = String(formData.get("date") ?? "");
  const type = String(formData.get("type") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const currency = String(formData.get("currency") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  const amount = Number(amountRaw);

  if (!workspaceId || !date) {
    return { error: "Missing workspace or date." };
  }
  if (type !== "income" && type !== "expense") {
    return { error: "Choose income or expense." };
  }
  if (!category) {
    return { error: "Choose a category." };
  }
  if (!CURRENCIES.includes(currency as (typeof CURRENCIES)[number])) {
    return { error: "Choose a valid currency." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter an amount greater than zero." };
  }

  return { workspaceId, date, type, category, description, currency, amount };
}

export async function addTransaction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
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

  const { error } = await supabase.from("transactions").insert({
    workspace_id: parsed.workspaceId,
    created_by: user.id,
    date: parsed.date,
    type: parsed.type,
    category: parsed.category,
    description: parsed.description,
    currency: parsed.currency,
    amount: parsed.amount,
    rate_to_base: rate.rate_to_base,
  });

  if (error) return { error: error.message };

  revalidatePath("/transactions");
  return { error: null };
}

export async function updateTransaction(
  id: string,
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
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
    .from("transactions")
    .update({
      date: parsed.date,
      type: parsed.type,
      category: parsed.category,
      description: parsed.description,
      currency: parsed.currency,
      amount: parsed.amount,
      rate_to_base: rate.rate_to_base,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/transactions");
  return { error: null };
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient();
  await supabase.from("transactions").delete().eq("id", id);
  revalidatePath("/transactions");
}
