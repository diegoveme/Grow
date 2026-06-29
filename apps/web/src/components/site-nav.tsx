import Link from "next/link";

export function SiteNav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between bg-gradient-to-b from-tierra via-tierra/90 to-transparent px-6 py-5 md:px-10">
      <Link href="/" className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-agua" />
        <span className="font-display text-xl font-bold tracking-wide text-luz">Grow</span>
      </Link>
      <div className="flex items-center gap-5">
        <Link
          href="/#how"
          className="hidden text-sm tracking-wide text-luz-tenue/70 transition-colors hover:text-agua sm:block"
        >
          How it works
        </Link>
        <Link
          href="/app"
          className="rounded-[2px] bg-agua px-5 py-2 text-sm font-medium uppercase tracking-wide text-tierra transition-colors hover:bg-agua-palo"
        >
          Open app
        </Link>
      </div>
    </nav>
  );
}
