import Link from "next/link";
import { logout } from "@/app/login/actions";

type AppHeaderProps = {
  workspaceName: string;
  active: "dashboard" | "transactions";
};

const LINK_BASE = "text-body transition-colors duration-150 ease-out";

export function AppHeader({ workspaceName, active }: AppHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border bg-surface px-5 py-4">
      <span className="truncate text-header font-semibold text-text">{workspaceName}</span>
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
