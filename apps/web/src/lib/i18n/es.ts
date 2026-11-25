import type { Messages } from "./en";

/** Spanish messages (Latin American). Same shape as ./en, enforced by the type. */
export const es: Messages = {
  nav: {
    overview: "Inicio",
    send: "Enviar",
    receive: "Recibir",
    activity: "Actividad",
    earmarked: "Apartados",
    vault: "Vault",
    settings: "Ajustes",
  },
  network: {
    mainnet: "Mainnet",
    testnet: "Stellar Testnet",
  },
  shell: {
    backToSite: "← Volver al sitio",
    connectTitle: "Conecta tu wallet",
    connectBody:
      "Conecta una wallet de Stellar (Freighter, xBull, Albedo…) para ver tus saldos, enviar y recibir dinero, y hacer crecer lo que ahorras.",
  },
  wallet: {
    connect: "Conectar wallet",
    connecting: "Conectando…",
    disconnect: "desconectar",
    disconnectTitle: "Desconectar",
  },
  settings: {
    eyebrow: "Ajustes",
    title: "Ajustes",
    subtitle: "Ajusta cómo se reparte tu dinero, el idioma, el aspecto y tu conexión.",
    splitLabel: "Disponible vs. ahorro",
    splitBody:
      "Elige cuánto de cada remesa en USDC que recibes llega a tu wallet y cuánto se guarda como ahorro.",
    spendablePct: (pct: number) => `${pct}% disponible`,
    savedPct: (pct: number) => `${pct}% ahorro`,
    save: "Guardar reparto on-chain",
    saving: "Guardando…",
    saved: "Reparto guardado on-chain ✓",
    appearance: "Apariencia",
    appearanceBody:
      "Carbón es un gris oscuro suave, más cómodo de noche, con los verdes bien vivos.",
    themeLight: "Claro",
    themeDark: "Carbón",
    themeSystem: "Sistema",
    followingDevice: (dark: boolean) =>
      `Siguiendo tu dispositivo: ahora en ${dark ? "carbón" : "claro"}.`,
    language: "Idioma",
    languageBody: "Grow habla español e inglés.",
    connection: "Conexión",
    wallet: "Wallet",
    network: "Red",
    usdcContract: "Contrato USDC",
    growContract: "Contrato de Grow",
  },
};
