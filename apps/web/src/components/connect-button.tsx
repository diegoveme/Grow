"use client";

import { useWallet } from "@/lib/wallet";
import { shortAddress } from "@/lib/format";

export function ConnectButton({ className = "" }: { className?: string }) {
  const { address, connecting, connect, disconnect } = useWallet();

  if (address) {
    return (
      <button
        onClick={disconnect}
        title="Disconnect"
        className={`group inline-flex items-center gap-2 rounded-[2px] border border-agua/30 px-4 py-2 text-sm tracking-wide text-luz transition-colors hover:border-agua hover:text-agua ${className}`}
      >
        <span className="h-2 w-2 rounded-full bg-brote" />
        {shortAddress(address)}
        <span className="text-luz-tenue/40 group-hover:text-agua">·</span>
        <span className="text-xs opacity-50 group-hover:opacity-100">disconnect</span>
      </button>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={connecting}
      className={`inline-flex items-center gap-2 rounded-[2px] bg-agua px-5 py-2 text-sm font-medium uppercase tracking-wide text-tierra transition-colors hover:bg-agua-palo disabled:opacity-60 ${className}`}
    >
      {connecting ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
