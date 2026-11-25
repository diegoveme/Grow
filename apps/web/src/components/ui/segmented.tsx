import type { ReactNode } from "react";

type Accent = "agua" | "oro";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Overrides the control's accent for this option (e.g. USDC is gold). */
  accent?: Accent;
  disabled?: boolean;
}

const ACTIVE: Record<Accent, string> = {
  agua: "border-agua bg-agua/10 text-agua",
  oro: "border-oro bg-oro/10 text-oro",
};

// Spelled out so Tailwind keeps the classes.
const COLUMNS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

/** A row of mutually exclusive buttons (asset, mode, etc.). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accent = "agua",
  className = "",
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accent?: Accent;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 ${COLUMNS[options.length] ?? "grid-cols-2"} ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          disabled={o.disabled}
          className={`rounded-[2px] border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-30 ${
            value === o.value
              ? ACTIVE[o.accent ?? accent]
              : "border-luz/10 text-luz-tenue/60 hover:border-luz/25"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
