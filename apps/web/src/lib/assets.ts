import type { AssetCode } from "@raiz/shared";

export type { AssetCode };

export type Accent = "agua" | "oro";

export interface AssetMeta {
  code: AssetCode;
  label: string;
  /** Theme accent used for this asset across the UI. */
  accent: Accent;
}

/** Single source of truth for the assets Raíz handles in the UI. */
export const ASSETS: Record<AssetCode, AssetMeta> = {
  USDC: { code: "USDC", label: "USDC", accent: "oro" },
  XLM: { code: "XLM", label: "XLM", accent: "agua" },
};

/** Order assets appear in the send toggle. */
export const SENDABLE_ASSETS: AssetCode[] = ["USDC", "XLM"];

export const accentText: Record<Accent, string> = {
  agua: "text-agua",
  oro: "text-oro",
};
