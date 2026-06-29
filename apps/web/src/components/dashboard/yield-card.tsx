"use client";

import { useEffect, useState } from "react";
import { Card, CardLabel } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatApy } from "@/lib/format";

/** Live APY of the yield vault (DeFindex → Blend). */
export function YieldCard() {
  const [apy, setApy] = useState<number | null>(null);
  const [source, setSource] = useState<string>("");
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    api
      .vaultApy()
      .then((r) => {
        setApy(r.apy);
        setSource(r.source);
      })
      .catch(() => setUnavailable(true));
  }, []);

  return (
    <Card>
      <CardLabel>Vault yield</CardLabel>
      {unavailable ? (
        <p className="text-sm opacity-60">
          Configure a Blend pool or DeFindex vault to see the live APY.
        </p>
      ) : (
        <>
          <div className="font-display text-4xl font-bold text-oro">
            {apy === null ? "…" : formatApy(apy)}
          </div>
          <p className="mt-2 text-sm opacity-60">
            Annual yield on the vaulted portion{source ? ` · via ${source}` : ""}.
          </p>
        </>
      )}
      <div className="mt-4 inline-block rounded-[1px] bg-oro/10 px-2.5 py-1 text-[0.68rem] uppercase tracking-wider text-oro">
        DeFindex · Blend
      </div>
    </Card>
  );
}
