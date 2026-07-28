"use client";

import { useActionState, useState } from "react";
import type { WorkspaceSummary } from "@/lib/workspace";
import { setActiveWorkspace, createCompanyWorkspace } from "@/lib/workspace-actions";
import { WORKSPACE_INITIAL_STATE } from "@/lib/workspace-action-state";
import { CURRENCIES } from "@/lib/currency";
import { Sheet } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormError } from "@/components/ui/FormMessage";

type WorkspaceSwitcherProps = {
  workspaces: WorkspaceSummary[];
  currentWorkspaceId: string;
  userId: string;
};

export function WorkspaceSwitcher({
  workspaces,
  currentWorkspaceId,
  userId,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "create">("list");
  const [state, formAction, pending] = useActionState(
    createCompanyWorkspace,
    WORKSPACE_INITIAL_STATE,
  );

  const current = workspaces.find((w) => w.id === currentWorkspaceId);

  function close() {
    setOpen(false);
    setView("list");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-w-0 items-center gap-1 text-header font-semibold text-text"
      >
        <span className="truncate">{current?.name ?? "Workspace"}</span>
        <span className="text-text-muted">▾</span>
      </button>

      <Sheet
        open={open}
        onClose={close}
        title={view === "list" ? "Switch workspace" : "Create company workspace"}
      >
        {view === "list" ? (
          <div className="flex flex-col gap-3 py-2">
            {workspaces.map((ws) => (
              <form key={ws.id} action={setActiveWorkspace.bind(null, ws.id)}>
                <button
                  type="submit"
                  className="flex w-full items-center justify-between gap-3 rounded-control border border-border bg-surface p-3 text-left transition-colors duration-150 ease-out hover:bg-bg"
                >
                  <div className="flex flex-col gap-1.5">
                    <span className="text-body font-medium text-text">{ws.name}</span>
                    <div className="flex gap-2">
                      <Badge>{ws.type === "personal" ? "Personal" : "Company"}</Badge>
                      <Badge>{ws.owner_id === userId ? "Owner" : "Member"}</Badge>
                    </div>
                  </div>
                  {ws.id === currentWorkspaceId && (
                    <span className="text-body font-semibold text-accent">✓</span>
                  )}
                </button>
              </form>
            ))}

            <Button type="button" variant="secondary" onClick={() => setView("create")}>
              + Create company workspace
            </Button>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-4 py-4">
            <Input id="name" name="name" type="text" label="Workspace name" required />

            <label className="flex flex-col gap-1.5">
              <span className="text-caption font-medium text-text-muted">Base currency</span>
              <select
                name="baseCurrency"
                defaultValue="USD"
                className="rounded-control border border-border bg-surface px-4 py-3 text-body text-text outline-none focus:border-accent"
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>

            {state.error && <FormError>{state.error}</FormError>}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setView("list")}
                className="flex-1"
              >
                Back
              </Button>
              <Button type="submit" disabled={pending} className="flex-1">
                {pending ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}
