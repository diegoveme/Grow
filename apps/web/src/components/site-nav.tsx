import Link from "next/link";
import { ConnectButton } from "./connect-button";

export function SiteNav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between bg-gradient-to-b from-tierra via-tierra/90 to-transparent px-6 py-5 md:px-10">
      <Link href="/" className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-agua" />
        <span className="font-display text-xl font-bold tracking-wide text-luz">Raíz</span>
      </Link>
      <div className="flex items-center gap-6">
        <Link
          href="/#how"
          className="hidden text-sm tracking-wide text-luz-tenue/70 transition-colors hover:text-agua sm:block"
        >
          How it works
        </Link>
        <Link
          href="/app"
          className="hidden text-sm tracking-wide text-luz-tenue/70 transition-colors hover:text-agua sm:block"
        >
          Dashboard
        </Link>
        <ConnectButton />
      </div>
    </nav>
  );
}
