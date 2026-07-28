type Option = { value: string; label: string };

type SegmentedControlProps = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function SegmentedControl({
  options,
  value,
  onChange,
  className = "",
}: SegmentedControlProps) {
  return (
    <div className={`flex rounded-pill border border-border bg-bg p-1 ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-pill py-2 text-body font-semibold transition-colors duration-150 ease-out ${
            value === option.value ? "bg-surface text-text shadow-card" : "text-text-muted"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
