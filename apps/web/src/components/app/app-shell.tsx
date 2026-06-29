"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { MobileNav, Sidebar } from "./sidebar";
import { CursorMolecules } from "@/components/cursor-molecules";
import { ConnectButton } from "@/components/connect-button";
import { useWallet } from "@/lib/wallet";

export function AppShell({ children }: { children: ReactNode }) {
  const { address, ready } = useWallet();

  // While the kit is still checking for a stored wallet, show a neutral splash
  // so a reload never flashes the connect modal before reconnecting.
  if (!ready) return <BootSplash />;

  // Until a wallet is connected, the whole app is replaced by a modal so the
  // dashboard chrome is never visible to a disconnected user.
  if (!address) return <ConnectModal />;

  return (
    <div className="flex min-h-screen w-full bg-tierra">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-luz/5 bg-tierra/80 px-5 py-3.5 backdrop-blur md:px-8">
          <Link href="/" className="flex items-center gap-2 md:hidden">
            <span className="h-2 w-2 rounded-full bg-agua" />
            <span className="font-display text-lg font-bold tracking-wide">Grow</span>
          </Link>
          <Link
            href="/"
            className="hidden text-xs uppercase tracking-[0.14em] text-luz-tenue/50 transition-colors hover:text-agua md:block"
          >
            ← Back to site
          </Link>
          <ConnectButton />
        </header>

        <main className="flex-1 px-5 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">{children}</main>
      </div>

      <MobileNav />
    </div>
  );
}

/** Neutral splash shown while the wallet kit checks for a stored session. */
function BootSplash() {
  return (
    <div className="grid min-h-screen w-full place-items-center bg-tierra">
      <span className="h-3 w-3 animate-pulse rounded-full bg-agua" />
    </div>
  );
}

/** Full-screen connect modal with cursor-following molecules. */
function ConnectModal() {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-tierra">
      {/* ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[60vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-agua/10 blur-[120px]" />
      <CursorMolecules />

      <div className="relative z-10 grid h-full place-items-center px-6 text-center">
        <div className="animate-rise max-w-md">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-agua/30 bg-semilla/40 text-3xl">
            🌱
          </div>
          <h1 className="font-display text-4xl font-bold">Connect your wallet</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed opacity-60">
            Connect a Stellar wallet (Freighter, xBull, Albedo…) to see your balances, send and
            receive money, and grow the part you save.
          </p>
          <div className="mt-8 flex justify-center">
            <ConnectButton />
          </div>
          <Link
            href="/"
            className="mt-8 inline-block text-xs uppercase tracking-[0.14em] text-luz-tenue/40 transition-colors hover:text-agua"
          >
            ← Back to site
          </Link>
        </div>
      </div>
    </div>
  );
}
