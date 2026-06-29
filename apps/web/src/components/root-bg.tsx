import type { CSSProperties } from "react";

/**
 * A full-page root system that rises from the footer up to the hero title. A
 * deep, spreading base near the bottom feeds a trunk that branches through the
 * page and fans into leaf shoots by the title. The strokes draw themselves on a
 * continuous loop (grow-loop), so the roots are always visibly growing upward.
 * It sits behind the whole landing page; content may overlap it freely.
 */

interface Root {
  d: string;
  len: number;
  delay: number;
  w: number;
  color: "ink" | "leaf";
  op: number;
}

const INK = "#1C1B16";
const LEAF = "#3A7D3F";

// viewBox is 1200 x 2400: y≈2400 is the footer, y≈180 is by the title.
const ROOTS: Root[] = [
  // main trunk, footer → title
  { d: "M 600 2400 C 604 2000, 596 1500, 600 980 C 602 700, 598 440, 600 220", len: 2300, delay: 0, w: 2.4, color: "ink", op: 0.12 },

  // deep spreading base (near the footer)
  { d: "M 600 2400 C 520 2320, 380 2292, 250 2256 C 170 2234, 96 2222, 20 2216", len: 760, delay: 0.1, w: 1.6, color: "ink", op: 0.095 },
  { d: "M 600 2400 C 680 2320, 820 2292, 950 2256 C 1030 2234, 1104 2222, 1180 2216", len: 760, delay: 0.15, w: 1.6, color: "ink", op: 0.095 },
  { d: "M 600 2400 C 556 2336, 470 2312, 372 2300 C 300 2292, 232 2294, 160 2306", len: 560, delay: 0.2, w: 1, color: "ink", op: 0.07 },
  { d: "M 600 2400 C 644 2336, 730 2312, 828 2300 C 900 2292, 968 2294, 1040 2306", len: 560, delay: 0.22, w: 1, color: "ink", op: 0.07 },

  // mid-page branches off the trunk
  { d: "M 600 1760 C 520 1640, 392 1560, 320 1380 C 282 1286, 268 1206, 262 1120", len: 820, delay: 0.45, w: 1.4, color: "ink", op: 0.085 },
  { d: "M 600 1620 C 690 1500, 812 1430, 884 1250 C 922 1156, 936 1076, 942 990", len: 820, delay: 0.5, w: 1.4, color: "ink", op: 0.085 },
  { d: "M 600 1300 C 548 1220, 470 1180, 416 1090", len: 360, delay: 0.7, w: 1, color: "ink", op: 0.06 },
  { d: "M 600 1180 C 656 1108, 730 1074, 792 1000", len: 360, delay: 0.72, w: 1, color: "ink", op: 0.06 },

  // upper fan, toward the title
  { d: "M 600 760 C 532 640, 416 560, 312 420 C 276 374, 262 320, 250 250", len: 760, delay: 0.85, w: 1.7, color: "ink", op: 0.105 },
  { d: "M 600 720 C 686 600, 800 540, 904 410 C 944 360, 958 312, 974 244", len: 760, delay: 0.9, w: 1.7, color: "ink", op: 0.105 },

  // green shoots near the top
  { d: "M 600 460 C 560 412, 544 380, 528 320", len: 280, delay: 1.15, w: 1.2, color: "leaf", op: 0.27 },
  { d: "M 600 460 C 640 412, 656 380, 672 320", len: 280, delay: 1.2, w: 1.2, color: "leaf", op: 0.27 },
  { d: "M 420 560 C 392 506, 360 470, 332 420", len: 300, delay: 1.0, w: 1, color: "leaf", op: 0.24 },
  { d: "M 800 540 C 832 488, 868 454, 900 408", len: 300, delay: 1.05, w: 1, color: "leaf", op: 0.24 },
];

// Leaf buds at the top tips.
const BUDS: { cx: number; cy: number; r: number; delay: number }[] = [
  { cx: 600, cy: 218, r: 5, delay: 1.5 },
  { cx: 250, cy: 248, r: 3.2, delay: 1.7 },
  { cx: 974, cy: 242, r: 3.2, delay: 1.75 },
  { cx: 528, cy: 318, r: 3, delay: 1.6 },
  { cx: 672, cy: 318, r: 3, delay: 1.65 },
];

export function RootBg() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1200 2400"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <radialGradient id="grow-glow" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#3A7D3F" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#3A7D3F" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* growth glow rising from the footer */}
      <ellipse cx="600" cy="2400" rx="700" ry="640" fill="url(#grow-glow)" />

      {ROOTS.map((r, i) => (
        <g key={i} opacity={r.op}>
          <path
            className="grow-root"
            d={r.d}
            stroke={r.color === "leaf" ? LEAF : INK}
            strokeWidth={r.w}
            strokeLinecap="round"
            fill="none"
            pathLength={1}
            style={{ animationDelay: `${r.delay}s` } as CSSProperties}
          />
        </g>
      ))}

      {BUDS.map((b, i) => (
        <circle
          key={i}
          className="animate-drift"
          cx={b.cx}
          cy={b.cy}
          r={b.r}
          fill={LEAF}
          opacity={0.4}
          style={{ animationDelay: `${b.delay}s` }}
        />
      ))}
    </svg>
  );
}
