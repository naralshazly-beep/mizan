import { type ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title font-bold text-text">{title}</h1>
        {description && <p className="text-body text-text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}
