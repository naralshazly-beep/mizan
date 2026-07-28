import { type HTMLAttributes } from "react";

export function Badge({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center rounded-pill bg-accent/10 px-2.5 py-1 text-caption font-medium text-accent ${className}`}
      {...props}
    />
  );
}
