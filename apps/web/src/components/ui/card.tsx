import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border border-luz/5 bg-tierra-mid/60 p-6 backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 text-xs uppercase tracking-[0.14em] text-agua/80">{children}</div>
  );
}

export function Stat({
  value,
  label,
  accent = "luz",
}: {
  value: ReactNode;
  label: string;
  accent?: "agua" | "oro" | "brote" | "luz";
}) {
  const color = {
    agua: "text-agua",
    oro: "text-oro",
    brote: "text-brote",
    luz: "text-luz",
  }[accent];
  return (
    <div>
      <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider opacity-50">{label}</div>
    </div>
  );
}
