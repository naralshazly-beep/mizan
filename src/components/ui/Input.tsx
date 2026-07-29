import { type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, id, error, className = "", ...props }: InputProps) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-caption font-medium text-text-muted">{label}</span>
      <input
        id={id}
        aria-invalid={Boolean(error) || undefined}
        className={`rounded-control border bg-surface px-4 py-3 text-body text-text outline-none transition-colors duration-150 ease-out focus:border-accent disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? "border-negative focus:border-negative" : "border-border"
        } ${className}`}
        {...props}
      />
      {error && <span className="text-caption text-negative">{error}</span>}
    </label>
  );
}
