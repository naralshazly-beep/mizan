import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/Card";
import { DashboardClient } from "./DashboardClient";
import { ACTIVE_WORKSPACE_COOKIE, getUserWorkspaces, resolveActiveWorkspace } from "@/lib/workspace";

export default async function Home() {
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
    return (
      <main className="flex flex-1 flex-col items-center justify-center bg-bg px-5 py-16">
        <Card className="flex w-full max-w-sm flex-col gap-2">
          <span className="text-body text-negative">
            No workspace found yet. Make sure the database migration has been run.
          </span>
        </Card>
      </main>
    );
  }

  const [{ data: transactions }, { data: rateRows }] = await Promise.all([
    supabase
      .from("transactions")
      .select("date, type, category, amount_base")
      .eq("workspace_id", activeWorkspace.id),
    supabase
      .from("exchange_rates")
      .select("currency, rate_to_base")
      .eq("workspace_id", activeWorkspace.id),
  ]);

  const rates = Object.fromEntries((rateRows ?? []).map((r) => [r.currency, r.rate_to_base]));

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        workspaces={workspaces}
        currentWorkspaceId={activeWorkspace.id}
        userId={user.id}
        active="dashboard"
      />
      <DashboardClient
        workspaceId={activeWorkspace.id}
        baseCurrency={activeWorkspace.base_currency}
        rates={rates}
        transactions={transactions ?? []}
      />
    </div>
  );
}
