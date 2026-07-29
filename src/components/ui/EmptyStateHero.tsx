import { type ReactNode } from "react";
import { Button } from "./Button";
import { Badge } from "./Badge";

type EmptyStateHeroProps = {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  children?: ReactNode;
};

export function EmptyStateHero({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  children,
}: EmptyStateHeroProps) {
  return (
    <div className="flex flex-col items-center gap-6 px-5 py-10 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-pill bg-accent/10">{icon}</div>
      <div className="flex max-w-sm flex-col gap-2">
        <h2 className="text-header font-semibold text-text">{title}</h2>
        <p className="text-body text-text-muted">{description}</p>
      </div>
      <Button type="button" onClick={onAction}>
        {actionLabel}
      </Button>

      {children && (
        <div className="flex w-full max-w-md flex-col items-center gap-3 pt-4">
          <Badge>Example preview</Badge>
          <div
            aria-hidden="true"
            className="pointer-events-none w-full select-none opacity-45 grayscale-[15%]"
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
