"use client";

import { config } from "@/lib/config";
import { formatUsd } from "@/lib/format";
import { useSplitterConfig } from "@/lib/hooks";
import { useT } from "@/lib/i18n";

/** Mainnet-only reminder that the beta moves real money, with the savings cap. */
export function BetaBanner() {
  return config.network === "PUBLIC" ? <MainnetNote /> : null;
}

function MainnetNote() {
  const t = useT();
  const splitter = useSplitterConfig();
  return (
    <div
      role="note"
      className="border-b border-oro/20 bg-oro/10 px-5 py-2 text-center text-xs text-oro md:px-8"
    >
      {t.shell.betaBanner(splitter ? formatUsd(splitter.userCap) : null)}
    </div>
  );
}
