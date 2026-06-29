/**
 * Raíz design tokens — the visual language of "your money takes root".
 * Dark, earthy palette: soil at the base, water (agua) as the active accent,
 * gold (oro) for yield, and moss/sprout greens for growth.
 *
 * Mirrors the reference concept so web (Tailwind) and any future surface
 * share a single source of truth.
 */
export const colors = {
  tierra: '#1C1A14', // soil — base background
  tierraMid: '#2E2A1E', // raised soil — cards / panels
  semilla: '#4A3F28', // seed — borders / nodes
  musgo: '#2D4A2A', // moss — secondary growth
  brote: '#5C9E55', // sprout — success / growth accent
  agua: '#3ECAD6', // water — primary action (cyan)
  aguaPalo: '#7EDEE7', // light water — hover
  luz: '#F7F0E0', // light — primary text
  luzTenue: '#EDE5D0', // dim light — secondary text
  oro: '#C8A84B', // gold — yield / earnings
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
