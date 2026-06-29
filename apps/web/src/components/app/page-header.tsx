import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="text-xs uppercase tracking-[0.16em] text-agua/80">{eyebrow}</div>
        )}
        <h1 className="mt-1.5 font-display text-3xl font-bold md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-sm opacity-55">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
