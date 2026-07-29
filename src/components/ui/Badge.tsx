import { type HTMLAttributes } from "react";

type Tone = "default" | "success" | "danger" | "warning" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  default: "bg-accent/10 text-accent",
  success: "bg-positive/10 text-positive",
  danger: "bg-negative/10 text-negative",
  warning: "bg-warning/10 text-warning",
  neutral: "bg-text-muted/10 text-text-muted",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
};

export function Badge({ tone = "default", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-1 text-caption font-medium ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    />
  );
}
