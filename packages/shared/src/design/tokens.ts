/**
 * Grow design tokens — the visual language of "your money takes root and grows".
 * Light, organic palette from the Grow logo: warm paper cream as the canvas,
 * ink-black for type, leaf green as the living accent, and an earthy ochre for
 * yield.
 *
 * Mirrors the reference concept so web (Tailwind) and any future surface
 * share a single source of truth.
 */
export const colors = {
  tierra: '#EBE5D4', // paper — base background
  tierraMid: '#F6F1E5', // raised paper — cards / panels
  semilla: '#DED5C0', // seed — borders / nodes
  musgo: '#2C552C', // moss — deep green
  brote: '#4F9A4A', // sprout — success / growth accent
  agua: '#3A7D3F', // leaf — primary action (green)
  aguaPalo: '#57A35C', // light leaf — hover
  luz: '#1C1B16', // ink — primary text
  luzTenue: '#595345', // soft ink — secondary text
  oro: '#A97E2B', // ochre — yield / earnings
} as const;

export type ColorToken = keyof typeof colors;

export const fonts = {
  /** Serif display face for headings — editorial, organic. */
  display: "'Playfair Display', Georgia, serif",
  /** Neutral body face. */
  body: "'Inter', system-ui, -apple-system, sans-serif",
} as const;

/** Default remittance split — 70% spendable, 30% growing in the vault. */
export const DEFAULT_SPLIT = {
  spendableBps: 7000,
  vaultBps: 3000,
} as const;

/** Radii, in px, kept intentionally tight (the concept uses 1–4px). */
export const radii = {
  sharp: '1px',
  sm: '2px',
  md: '4px',
  pill: '9999px',
} as const;
