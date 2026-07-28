"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CURRENCIES } from "@/lib/currency";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace";
import type { WorkspaceActionState } from "@/lib/workspace-action-state";

const COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
  httpOnly: true,
};

// Reasonable v1 defaults, per spec §5 — expressed relative to USD so a
// workspace based in any of the three currencies still gets sensible
// starting rates. The owner can edit these later in Settings.
const USD_RATES: Record<string, number> = { USD: 1, AED: 0.2723, EGP: 0.0203 };

function defaultRatesFor(baseCurrency: string) {
  const baseUsd = USD_RATES[baseCurrency] ?? 1;
  return CURRENCIES.map((currency) => ({
    currency,
    rate_to_base: USD_RATES[currency] / baseUsd,
  }));
}

export async function setActiveWorkspace(workspaceId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function createCompanyWorkspace(
  _prevState: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const baseCurrency = String(formData.get("baseCurrency") ?? "USD");

  if (!name) {
    return { error: "Enter a workspace name." };
  }
  if (!CURRENCIES.includes(baseCurrency as (typeof CURRENCIES)[number])) {
    return { error: "Choose a valid base currency." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  // Generated client-side and inserted explicitly (rather than reading the
  // id back via `.select()`) because requesting the row back would require
  // it to satisfy workspaces' SELECT policy in the same statement — and
  // that policy checks ownership by re-querying `workspaces` by id, which
  // Postgres's MVCC rules don't let a statement see for rows it just wrote
  // itself. Skipping the round-trip sidesteps that entirely.
  const workspaceId = crypto.randomUUID();

  const { error } = await supabase.from("workspaces").insert({
    id: workspaceId,
    name,
    type: "company",
    owner_id: user.id,
    base_currency: baseCurrency,
  });

  if (error) {
    return { error: error.message };
  }

  const { error: ratesError } = await supabase
    .from("exchange_rates")
    .insert(defaultRatesFor(baseCurrency).map((rate) => ({ ...rate, workspace_id: workspaceId })));

  if (ratesError) {
    return { error: ratesError.message };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, COOKIE_OPTIONS);

  revalidatePath("/", "layout");
  redirect("/");
}
