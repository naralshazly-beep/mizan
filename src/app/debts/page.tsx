import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { ACTIVE_WORKSPACE_COOKIE, getUserWorkspaces, resolveActiveWorkspace } from "@/lib/workspace";
import { DebtsClient } from "./DebtsClient";

export default async function DebtsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const workspaces = await getUserWorkspaces(supabase);
  const cookieStore = await cookies();
  const activeWorkspace = resolveActiveWorkspace(
    workspaces,
    cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value,
  );

  if (!activeWorkspace) {
    redirect("/");
  }

  // Debts are a personal-workspace-only feature (also enforced by RLS).
  if (activeWorkspace.type !== "personal") {
    redirect("/");
  }

  const [{ data: rateRows }, { data: debts }] = await Promise.all([
    supabase
      .from("exchange_rates")
      .select("currency, rate_to_base")
      .eq("workspace_id", activeWorkspace.id),
    supabase
      .from("debts")
      .select("id, direction, person_name, currency, amount, rate_to_base, amount_base, due_date, status")
      .eq("workspace_id", activeWorkspace.id)
      .order("created_at", { ascending: false }),
  ]);

  const rates = Object.fromEntries((rateRows ?? []).map((r) => [r.currency, r.rate_to_base]));

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        workspaces={workspaces}
        currentWorkspaceId={activeWorkspace.id}
        userId={user.id}
        active="debts"
      />
      <DebtsClient
        workspaceId={activeWorkspace.id}
        baseCurrency={activeWorkspace.base_currency}
        rates={rates}
        debts={debts ?? []}
      />
    </div>
  );
}
