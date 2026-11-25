"use client";

import { useState } from "react";
import type { DailyVolume } from "@/lib/api";
import { formatCompact } from "@/lib/format";

const PLOT_HEIGHT = 160;

/** Round up to a clean axis maximum: 1, 2, 5 x 10^n. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((s) => s * exp >= value) ?? 10;
  return step * exp;
}

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/**
 * Daily USDC volume through the contract: one series, so no legend (the
 * heading names it). Columns are capped at 24px with a 4px rounded top and a
 * square baseline; hover or focus a day for its numbers, and the table below
 * repeats every value.
 */
export function DailyVolumeChart({ data }: { data: DailyVolume[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => Number(d.volume)), 0));
  const ticks = [0, max / 2, max];

  if (!data.length) {
    return (
      <div className="rounded-md border border-dashed border-luz/10 px-4 py-10 text-center text-sm opacity-50">
        No remittances yet. The first one will show up here.
      </div>
    );
  }

  const shown = active ?? data.length - 1;
  const point = data[shown];

  return (
    <div>
      {/* Headroom for the top tick and the direct label above the tallest bar. */}
      <div className="mt-8 flex gap-3">
        {/* Y axis: three clean ticks, muted ink. */}
        <div className="relative w-12 shrink-0 text-right text-[11px] text-luz-tenue/60" style={{ height: PLOT_HEIGHT }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: (t / max) * PLOT_HEIGHT }}>
              {formatCompact(t)}
            </span>
          ))}
        </div>

        <div className="relative flex-1" style={{ height: PLOT_HEIGHT }}>
          {/* Recessive gridlines at the ticks. */}
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute inset-x-0 border-t border-luz/5"
              style={{ bottom: (t / max) * PLOT_HEIGHT }}
            />
          ))}

          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d, i) => {
              const height = Math.max(2, (Number(d.volume) / max) * PLOT_HEIGHT);
              const isLast = i === data.length - 1;
              return (
                <button
                  key={d.date}
                  type="button"
                  aria-label={`${shortDate(d.date)}: ${formatCompact(d.volume)} USDC in ${d.remittances} remittances`}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="group relative flex h-full flex-1 items-end justify-center outline-none"
                >
                  <span
                    className={`block w-full max-w-[24px] rounded-t-[4px] bg-agua transition-opacity ${
                      active !== null && active !== i ? "opacity-40" : ""
                    } group-focus-visible:ring-2 group-focus-visible:ring-luz/40`}
                    style={{ height }}
                  />
                  {/* Selective direct label: the latest day only. */}
                  {isLast && active === null && (
                    <span className="absolute text-[11px] text-luz" style={{ bottom: height + 4 }}>
                      {formatCompact(d.volume)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* X axis: first and last day, centered under their own columns. */}
      <div className="mt-2 flex gap-3 text-[11px] text-luz-tenue/60">
        <div className="w-12 shrink-0" />
        <div className="flex flex-1 gap-[2px]">
          {data.map((d, i) => (
            <span key={d.date} className="flex-1 whitespace-nowrap text-center">
              {i === 0 || i === data.length - 1 ? shortDate(d.date) : ""}
            </span>
          ))}
        </div>
      </div>
      {point && (
        <p className="mt-3 text-xs text-luz-tenue" aria-live="polite">
          <span className="font-medium text-luz">{shortDate(point.date)}</span> ·{" "}
          {formatCompact(point.volume)} USDC · {point.remittances}{" "}
          {point.remittances === 1 ? "remittance" : "remittances"}
        </p>
      )}

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-luz-tenue/70 hover:text-luz">View as table</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-luz-tenue/60">
            <tr>
              <th className="py-1 font-normal">Day</th>
              <th className="py-1 text-right font-normal">Remittances</th>
              <th className="py-1 text-right font-normal">Volume (USDC)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date} className="border-t border-luz/5">
                <td className="py-1">{d.date}</td>
                <td className="py-1 text-right">{d.remittances}</td>
                <td className="py-1 text-right">{Number(d.volume).toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
