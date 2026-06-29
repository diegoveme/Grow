"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { config } from "@/lib/config";

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar: fixed, vertical navigation (md and up). */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-luz/5 bg-tierra-mid/40 px-4 py-6 md:flex">
      <Link href="/" className="mb-8 flex items-center gap-2 px-2">
        <span className="h-2.5 w-2.5 rounded-full bg-agua" />
        <span className="font-display text-xl font-bold tracking-wide">Raíz</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-agua/10 text-agua"
                  : "text-luz-tenue/60 hover:bg-luz/5 hover:text-luz"
              }`}
            >
              <Icon
                className={active ? "text-agua" : "text-luz-tenue/50 group-hover:text-luz"}
              />
              <span className="tracking-wide">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 flex items-center gap-2 rounded-md border border-luz/5 px-3 py-2 text-xs text-luz-tenue/50">
        <span className="h-1.5 w-1.5 rounded-full bg-brote" />
        {config.network === "PUBLIC" ? "Mainnet" : "Stellar Testnet"}
      </div>
    </aside>
  );
}

/** Mobile bottom navigation: fixed bar (below md). */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-luz/10 bg-tierra/95 backdrop-blur md:hidden">
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] tracking-wide transition-colors ${
              active ? "text-agua" : "text-luz-tenue/50"
            }`}
          >
            <Icon width={20} height={20} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
