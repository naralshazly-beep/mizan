import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/Card";
import { DashboardClient } from "./DashboardClient";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, base_currency")
    .eq("owner_id", user.id)
    .eq("type", "personal")
    .single();

  if (!workspace) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center bg-bg px-5 py-16">
        <Card className="flex w-full max-w-sm flex-col gap-2">
          <span className="text-body text-negative">
            No personal workspace found yet. Make sure the database migration has been run.
          </span>
        </Card>
      </main>
    );
  }

  const { data: transactions } = await supabase
    .from("transactions")
    .select("date, type, category, amount_base")
    .eq("workspace_id", workspace.id);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader workspaceName={workspace.name} active="dashboard" />
      <DashboardClient baseCurrency={workspace.base_currency} transactions={transactions ?? []} />
    </div>
  );
}
