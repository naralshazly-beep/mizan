import { type ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  action?: ReactNode;
};

export function EmptyState({ title, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-body text-text-muted">{title}</p>
      {action}
    </div>
  );
}
