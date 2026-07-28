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

  const { data: transactions } = await supabase
    .from("transactions")
    .select("date, type, category, amount_base")
    .eq("workspace_id", activeWorkspace.id);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        workspaces={workspaces}
        currentWorkspaceId={activeWorkspace.id}
        userId={user.id}
        active="dashboard"
      />
      <DashboardClient
        baseCurrency={activeWorkspace.base_currency}
        transactions={transactions ?? []}
      />
    </div>
  );
}
