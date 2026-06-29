import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { RootBg } from "@/components/root-bg";
import { CursorMolecules } from "@/components/cursor-molecules";

const stats = [
  { num: "$860B", label: "Global remittances / yr" },
  { num: "<5s", label: "Settlement time" },
  { num: "~6%", label: "APY on yield" },
  { num: "$0.001", label: "Fee per tx" },
];

const steps = [
  {
    icon: "🌎",
    title: "Send from anywhere",
    desc: "Connect your wallet and send USDC over Stellar. No intermediary bank. No three business days.",
    tag: "Stellar · SEP-24",
  },
  {
    icon: "⚡",
    title: "Arrives in seconds",
    desc: "The transaction finalizes on Stellar in under five seconds. The anchor converts and delivers in USDC.",
    tag: "Anchor ramps",
  },
  {
    icon: "🌱",
    title: "Raíz splits it",
    desc: "A Soroban smart contract (Rust) automatically divides the funds: the part you keep spendable, and the part you want to grow.",
    tag: "Soroban · Rust",
  },
  {
    icon: "🌾",
    title: "The root earns yield",
    desc: "The savings portion enters a DeFindex vault routing into Blend. It earns APY in USDC, and you can withdraw anytime, even as cash.",
    tag: "DeFindex · Blend",
  },
];

export default function Home() {
  return (
    <>
      <SiteNav />

      {/* HERO */}
      <section className="relative grid min-h-screen place-items-center overflow-hidden px-6 pb-16 pt-28">
        <RootBg />
        <CursorMolecules />
        <div className="relative z-10 mx-auto max-w-3xl text-center animate-rise">
          <div className="mb-6 flex items-center justify-center gap-3 text-xs uppercase tracking-[0.18em] text-agua">
            <span className="h-px w-8 bg-agua/40" />
            Remittances · Stellar · DeFi
            <span className="h-px w-8 bg-agua/40" />
          </div>
          <h1 className="font-display text-5xl font-black leading-[1.05] tracking-tight md:text-7xl">
            Your money arrives
            <br />
            and <em className="italic text-agua">takes root.</em>
          </h1>
          <p className="mx-auto mt-6 max-w-md text-luz-tenue/75">
            Send across borders. Your family receives it instantly, and a part grows on its
            own, earning yield while they live.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/app"
              className="rounded-[2px] bg-agua px-8 py-3.5 text-sm font-medium uppercase tracking-wide text-tierra transition-colors hover:bg-agua-palo"
            >
              Start sending
            </Link>
            <Link
              href="/#how"
              className="rounded-[2px] border border-luz/20 px-8 py-3.5 text-sm uppercase tracking-wide text-luz transition-colors hover:border-agua hover:text-agua"
            >
              How it works
            </Link>
          </div>

          <div className="mt-16 flex flex-wrap justify-center gap-x-12 gap-y-6 border-t border-luz/10 pt-10">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <span className="block font-display text-3xl font-bold text-oro">{s.num}</span>
                <span className="mt-1 block text-xs uppercase tracking-wider opacity-50">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FLOW */}
      <section id="how" className="mx-auto max-w-4xl px-6 py-28">
        <div className="mb-4 text-xs uppercase tracking-[0.14em] text-agua/80">The flow</div>
        <h2 className="mb-14 font-display text-3xl font-bold leading-tight md:text-5xl">
          Four steps.
          <br />
          Your money works.
        </h2>

        <div className="relative">
          <div className="absolute bottom-3 left-6 top-3 w-px bg-gradient-to-b from-agua via-brote to-oro opacity-30" />
          <div className="space-y-2">
            {steps.map((step) => (
              <div key={step.title} className="grid grid-cols-[48px_1fr] items-start gap-6 py-6">
                <div className="z-10 flex h-12 w-12 items-center justify-center rounded-full border border-semilla bg-semilla/60 text-lg">
                  {step.icon}
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed opacity-60">{step.desc}</p>
                  <span className="mt-3 inline-block rounded-[1px] bg-agua/10 px-2.5 py-1 text-[0.68rem] uppercase tracking-wider text-agua">
                    {step.tag}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SPLIT VISUAL */}
        <div className="mt-16 grid gap-6 rounded-md border border-luz/5 bg-tierra-mid p-8">
          <div>
            <div className="mb-3 text-xs uppercase tracking-wider opacity-50">
              Example · you receive $200 USDC
            </div>
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-[1px]">
              <div className="bg-agua" style={{ flex: 70 }} />
              <div className="bg-oro" style={{ flex: 30 }} />
            </div>
            <div className="mt-3 flex gap-8 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-agua" /> Spendable now
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-oro" /> Growing in the vault
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-stretch gap-8">
            <div>
              <div className="font-display text-3xl font-bold text-agua">$140</div>
              <div className="mt-1 text-xs opacity-50">Cash out · anchor ramp</div>
            </div>
            <div className="w-px bg-luz/10" />
            <div>
              <div className="font-display text-3xl font-bold text-oro">$60</div>
              <div className="mt-1 text-xs opacity-50">Growing ~ $3.60 / yr in yield</div>
            </div>
          </div>
          <p className="border-t border-luz/5 pt-4 text-sm opacity-40">
            You decide the percentage. Change it anytime from your dashboard.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-luz/5 px-6 py-10 md:px-10">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-agua" />
          <span className="font-display text-lg font-bold text-luz">Raíz</span>
        </div>
        <div className="text-xs uppercase tracking-wider text-agua/70">
          ⬡ Built on Stellar · Soroban · DeFindex · Blend
        </div>
        <div className="text-xs opacity-30">PayFi · 2026</div>
      </footer>
    </>
  );
}
