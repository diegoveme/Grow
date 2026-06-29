/**
 * The "root system" illustration behind the hero: a river of money branching
 * into spendable (agua) and growing (oro) roots, with drifting particles.
 * Pure SVG, no interactivity.
 */
export function RootBg() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <radialGradient id="glow-agua" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3ECAD6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#3ECAD6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-brote" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5C9E55" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#5C9E55" stopOpacity="0" />
        </radialGradient>
        <filter id="blur-soft">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>

      <ellipse cx="600" cy="400" rx="500" ry="300" fill="url(#glow-agua)" opacity="0.6" />
      <ellipse cx="800" cy="550" rx="300" ry="200" fill="url(#glow-brote)" opacity="0.5" />

      {/* main trunk: the river of money */}
      <path
        d="M 600 -10 C 600 100, 600 200, 600 380"
        stroke="#3ECAD6"
        strokeWidth="1.5"
        fill="none"
        opacity="0.18"
        filter="url(#blur-soft)"
      />
      {/* spendable roots (agua) */}
      <path
        d="M 600 380 C 580 440, 480 500, 380 560 C 320 600, 260 620, 180 660"
        stroke="#3ECAD6"
        strokeWidth="1.2"
        fill="none"
        opacity="0.2"
        filter="url(#blur-soft)"
      />
      <path
        d="M 480 490 C 440 530, 380 560, 300 590"
        stroke="#3ECAD6"
        strokeWidth="0.7"
        fill="none"
        opacity="0.12"
        filter="url(#blur-soft)"
      />
      {/* yield roots (oro) */}
      <path
        d="M 600 380 C 630 440, 720 490, 820 540 C 900 580, 980 590, 1060 640"
        stroke="#C8A84B"
        strokeWidth="1.2"
        fill="none"
        opacity="0.2"
        filter="url(#blur-soft)"
      />
      <path
        d="M 720 490 C 780 530, 860 550, 940 580"
        stroke="#C8A84B"
        strokeWidth="0.7"
        fill="none"
        opacity="0.12"
        filter="url(#blur-soft)"
      />

      {/* split node: the heart */}
      <circle cx="600" cy="380" r="5" fill="#3ECAD6" opacity="0.35" />
      <circle cx="600" cy="380" r="12" fill="none" stroke="#3ECAD6" strokeWidth="0.8" opacity="0.15" />
      <circle cx="600" cy="380" r="22" fill="none" stroke="#3ECAD6" strokeWidth="0.5" opacity="0.08" />

      {/* drifting particles */}
      <circle className="animate-drift" cx="600" cy="120" r="1.6" fill="#3ECAD6" />
      <circle className="animate-drift [animation-delay:1.2s]" cx="594" cy="190" r="1.1" fill="#3ECAD6" />
      <circle className="animate-drift [animation-delay:2s]" cx="610" cy="260" r="1.3" fill="#C8A84B" />

      <circle cx="180" cy="660" r="3" fill="#3ECAD6" opacity="0.25" />
      <circle cx="1060" cy="640" r="3" fill="#C8A84B" opacity="0.3" />
    </svg>
  );
}
