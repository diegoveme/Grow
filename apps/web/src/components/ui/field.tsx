import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider opacity-50">{label}</span>
        {hint && <span className="text-xs opacity-40">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export function TextInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-[2px] border border-luz/10 bg-tierra px-3 py-2.5 text-sm outline-none transition-colors placeholder:opacity-30 focus:border-agua ${className}`}
    />
  );
}
