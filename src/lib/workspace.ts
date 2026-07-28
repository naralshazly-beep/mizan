import type { createClient } from "@/lib/supabase/server";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";

export type WorkspaceSummary = {
  id: string;
  name: string;
  type: "personal" | "company";
  base_currency: string;
  owner_id: string;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function getUserWorkspaces(
  supabase: SupabaseServerClient,
): Promise<WorkspaceSummary[]> {
  const { data } = await supabase
    .from("workspaces")
    .select("id, name, type, base_currency, owner_id")
    .order("created_at", { ascending: true });

  const workspaces = data ?? [];
  return workspaces.sort((a, b) => {
    if (a.type === b.type) return 0;
    return a.type === "personal" ? -1 : 1;
  });
}

export function resolveActiveWorkspace(
  workspaces: WorkspaceSummary[],
  activeId?: string,
): WorkspaceSummary | null {
  return (
    workspaces.find((w) => w.id === activeId) ??
    workspaces.find((w) => w.type === "personal") ??
    workspaces[0] ??
    null
  );
}
