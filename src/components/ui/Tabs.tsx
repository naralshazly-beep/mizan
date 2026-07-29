type TabOption<T extends string> = {
  value: T;
  label: string;
};

type TabsProps<T extends string> = {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function Tabs<T extends string>({ options, value, onChange }: TabsProps<T>) {
  return (
    <div role="tablist" className="flex items-center gap-6 border-b border-border">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`-mb-px border-b-2 pb-3 text-body font-medium transition-colors duration-150 ease-out ${
              active
                ? "border-accent text-text"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
