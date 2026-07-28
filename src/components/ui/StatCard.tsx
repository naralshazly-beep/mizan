type StatCardProps = {
  label: string;
  value: string;
  valueClassName?: string;
  emphasized?: boolean;
  className?: string;
};

export function StatCard({
  label,
  value,
  valueClassName = "text-text",
  emphasized = false,
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`flex flex-1 flex-col gap-1 rounded-card bg-surface p-5 shadow-card ${
        emphasized ? "border-t-4 border-accent" : ""
      } ${className}`}
    >
      <span className="text-caption text-text-muted">{label}</span>
      <span className={`text-big-number font-bold ${valueClassName}`}>{value}</span>
    </div>
  );
}
