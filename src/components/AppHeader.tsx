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

const LINK_BASE =
  "shrink-0 border-b-2 pb-1 text-body font-medium transition-colors duration-150 ease-out";

export function AppHeader({ workspaces, currentWorkspaceId, userId, active }: AppHeaderProps) {
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);
  const isPersonal = currentWorkspace?.type === "personal";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:flex-nowrap sm:gap-4 sm:px-5 sm:py-4">
      <WorkspaceSwitcher
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspaceId}
        userId={userId}
      />
      <nav className="order-3 flex w-full items-center justify-center gap-4 sm:order-none sm:w-auto sm:flex-1 sm:gap-6">
        <Link
          href="/"
          className={`${LINK_BASE} ${active === "dashboard" ? "border-accent text-text" : "border-transparent text-text-muted hover:text-text"}`}
        >
          Dashboard
        </Link>
        <Link
          href="/transactions"
          className={`${LINK_BASE} ${active === "transactions" ? "border-accent text-text" : "border-transparent text-text-muted hover:text-text"}`}
        >
          Transactions
        </Link>
        {isPersonal && (
          <Link
            href="/debts"
            className={`${LINK_BASE} ${active === "debts" ? "border-accent text-text" : "border-transparent text-text-muted hover:text-text"}`}
          >
            Debts
          </Link>
        )}
      </nav>
      <form action={logout} className="shrink-0">
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
