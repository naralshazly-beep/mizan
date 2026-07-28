import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { APP_NAME } from "@/lib/constants";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-bg px-5 py-16">
      <Card className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-title font-bold text-text">{APP_NAME}</h1>
          <p className="text-body text-text-muted">Signed in as {user.email}</p>
        </div>

        {workspace ? (
          <>
            <div className="flex flex-col gap-2 rounded-control border border-border bg-bg p-4">
              <span className="text-caption text-text-muted">Your workspace</span>
              <span className="text-header font-semibold text-text">{workspace.name}</span>
              <span className="text-caption text-text-muted">
                Base currency: {workspace.base_currency}
              </span>
            </div>
            <Link href="/transactions">
              <Button type="button" className="w-full">
                View transactions
              </Button>
            </Link>
          </>
        ) : (
          <div className="flex flex-col gap-2 rounded-control border border-border bg-bg p-4">
            <span className="text-body text-negative">
              No personal workspace found yet. Make sure the database migration has been run.
            </span>
          </div>
        )}

        <form action={logout}>
          <Button type="submit" variant="secondary" className="w-full">
            Log out
          </Button>
        </form>
      </Card>
    </main>
  );
}
