import { type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Input({ label, id, className = "", ...props }: InputProps) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-caption font-medium text-text-muted">{label}</span>
      <input
        id={id}
        className={`rounded-control border border-border bg-surface px-4 py-3 text-body text-text outline-none transition-colors duration-150 ease-out focus:border-accent ${className}`}
        {...props}
      />
    </label>
  );
}
