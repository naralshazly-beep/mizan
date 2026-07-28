import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TransactionsClient } from "./TransactionsClient";

export default async function TransactionsPage() {
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
    redirect("/");
  }

  const [{ data: rateRows }, { data: transactions }] = await Promise.all([
    supabase
      .from("exchange_rates")
      .select("currency, rate_to_base")
      .eq("workspace_id", workspace.id),
    supabase
      .from("transactions")
      .select("id, date, type, category, description, currency, amount, rate_to_base, amount_base")
      .eq("workspace_id", workspace.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const rates = Object.fromEntries((rateRows ?? []).map((r) => [r.currency, r.rate_to_base]));

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-4">
        <Link href="/" className="text-caption text-text-muted hover:text-text">
          ← {workspace.name}
        </Link>
        <h1 className="text-header font-semibold text-text">Transactions</h1>
        <span className="w-10" />
      </div>
      <TransactionsClient
        workspaceId={workspace.id}
        baseCurrency={workspace.base_currency}
        rates={rates}
        transactions={transactions ?? []}
      />
    </div>
  );
}
