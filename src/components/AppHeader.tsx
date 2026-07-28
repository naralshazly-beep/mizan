import Link from "next/link";
import { logout } from "@/app/login/actions";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import type { WorkspaceSummary } from "@/lib/workspace";

type AppHeaderProps = {
  workspaces: WorkspaceSummary[];
  currentWorkspaceId: string;
  userId: string;
  active: "dashboard" | "transactions" | "debts";
};

const LINK_BASE = "text-body transition-colors duration-150 ease-out";

export function AppHeader({ workspaces, currentWorkspaceId, userId, active }: AppHeaderProps) {
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);
  const isPersonal = currentWorkspace?.type === "personal";

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border bg-surface px-5 py-4">
      <WorkspaceSwitcher
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspaceId}
        userId={userId}
      />
      <nav className="flex items-center gap-4">
        <Link
          href="/"
          className={`${LINK_BASE} ${active === "dashboard" ? "font-semibold text-text" : "text-text-muted hover:text-text"}`}
        >
          Dashboard
        </Link>
        <Link
          href="/transactions"
          className={`${LINK_BASE} ${active === "transactions" ? "font-semibold text-text" : "text-text-muted hover:text-text"}`}
        >
          Transactions
        </Link>
        {isPersonal && (
          <Link
            href="/debts"
            className={`${LINK_BASE} ${active === "debts" ? "font-semibold text-text" : "text-text-muted hover:text-text"}`}
          >
            Debts
          </Link>
        )}
      </nav>
      <form action={logout}>
        <button
          type="submit"
          className="text-caption text-text-muted transition-colors duration-150 ease-out hover:text-text"
        >
          Log out
        </button>
      </form>
    </div>
  );
}
