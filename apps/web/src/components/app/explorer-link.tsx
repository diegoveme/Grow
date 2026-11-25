import type { ReactNode } from "react";
import { ExternalIcon } from "@/components/app/icons";

/** External link to StellarView (a tx, account or contract page). */
export function ExplorerLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1.5 hover:underline ${className}`}
    >
      {children} <ExternalIcon width={12} height={12} />
    </a>
  );
}
