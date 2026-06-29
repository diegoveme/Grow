import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "gold";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-agua text-tierra hover:bg-agua-palo",
  gold: "bg-oro text-tierra hover:brightness-110",
  ghost: "border border-luz/15 text-luz hover:border-agua hover:text-agua",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-[2px] px-4 py-2.5 text-sm font-medium uppercase tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    />
  );
}
