import { type SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
};

export function Select({ label, id, error, className = "", children, ...props }: SelectProps) {
  const select = (
    <select
      id={id}
      aria-invalid={Boolean(error) || undefined}
      className={`rounded-control border bg-surface px-3 py-3 text-body text-text outline-none transition-colors duration-150 ease-out focus:border-accent disabled:cursor-not-allowed disabled:opacity-50 ${
        error ? "border-negative focus:border-negative" : "border-border"
      } ${className}`}
      {...props}
    >
      {children}
    </select>
  );

  if (!label) return select;

  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-caption font-medium text-text-muted">{label}</span>
      {select}
      {error && <span className="text-caption text-negative">{error}</span>}
    </label>
  );
}
