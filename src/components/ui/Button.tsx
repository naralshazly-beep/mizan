import { type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover active:bg-accent-hover",
  secondary: "border border-border bg-surface text-text hover:bg-bg active:bg-bg",
  ghost: "text-text-muted hover:text-text active:text-text",
  destructive: "border border-negative text-negative hover:bg-negative/5 active:bg-negative/10",
  danger: "border border-negative text-negative hover:bg-negative/5 active:bg-negative/10",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-control px-4 py-3 text-body font-semibold transition-colors duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
