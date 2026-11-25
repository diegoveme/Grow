/**
 * English messages. The Spanish file must match this shape exactly (it is
 * typed as `Messages`), so adding a string here means adding it there too.
 * Functions are used where a message takes values.
 */
export const en = {
  nav: {
    overview: "Overview",
    send: "Send",
    receive: "Receive",
    activity: "Activity",
    earmarked: "Earmarked",
    vault: "Vault",
    settings: "Settings",
  },
  network: {
    mainnet: "Mainnet",
    testnet: "Stellar Testnet",
  },
  shell: {
    backToSite: "← Back to site",
    connectTitle: "Connect your wallet",
    connectBody:
      "Connect a Stellar wallet (Freighter, xBull, Albedo…) to see your balances, send and receive money, and grow the part you save.",
  },
  wallet: {
    connect: "Connect wallet",
    connecting: "Connecting…",
    disconnect: "disconnect",
    disconnectTitle: "Disconnect",
  },
  settings: {
    eyebrow: "Settings",
    title: "Settings",
    subtitle: "Tune how your money splits, your language and look, and your connection.",
    splitLabel: "Spendable vs. saved",
    splitBody:
      "Choose how much of each USDC remittance you receive lands in your wallet, and how much is saved for you.",
    spendablePct: (pct: number) => `${pct}% spendable`,
    savedPct: (pct: number) => `${pct}% saved`,
    save: "Save split on-chain",
    saving: "Saving…",
    saved: "Split saved on-chain ✓",
    appearance: "Appearance",
    appearanceBody:
      "Charcoal is a soft gray-black, easier on the eyes at night, with the greens kept bright.",
    themeLight: "Light",
    themeDark: "Charcoal",
    themeSystem: "System",
    followingDevice: (dark: boolean) =>
      `Following your device: ${dark ? "charcoal" : "light"} right now.`,
    language: "Language",
    languageBody: "Grow speaks English and Spanish.",
    connection: "Connection",
    wallet: "Wallet",
    network: "Network",
    usdcContract: "USDC contract",
    growContract: "Grow contract",
  },
};

export type Messages = typeof en;
