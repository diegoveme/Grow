"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { config } from "./config";

/**
 * Wallet context backed by the Stellar Wallets Kit (v2 static API). The kit is
 * browser-only (custom elements + window access), so it is initialized lazily
 * inside the provider and never imported during SSR.
 */
interface WalletContextValue {
  address: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const initialized = useRef(false);

  /** Initialize the static kit exactly once, in the browser. */
  const ensureInit = useCallback(async () => {
    const { StellarWalletsKit, Networks } = await import("@creit.tech/stellar-wallets-kit");
    if (!initialized.current) {
      const { defaultModules } = await import(
        "@creit.tech/stellar-wallets-kit/modules/utils"
      );
      StellarWalletsKit.init({
        modules: defaultModules(),
        network: config.network === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET,
      });
      initialized.current = true;
    }
    return StellarWalletsKit;
  }, []);

  // Reconnect silently if the kit already remembers a wallet.
  useEffect(() => {
    (async () => {
      try {
        const kit = await ensureInit();
        const { address } = await kit.getAddress();
        if (address) setAddress(address);
      } catch {
        /* no wallet connected yet — ignore */
      }
    })();
  }, [ensureInit]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const kit = await ensureInit();
      const { address } = await kit.authModal();
      setAddress(address);
    } finally {
      setConnecting(false);
    }
  }, [ensureInit]);

  const disconnect = useCallback(() => {
    setAddress(null);
    void (async () => {
      try {
        const kit = await ensureInit();
        await kit.disconnect();
      } catch {
        /* ignore */
      }
    })();
  }, [ensureInit]);

  const signTransaction = useCallback(
    async (xdr: string) => {
      const kit = await ensureInit();
      const { signedTxXdr } = await kit.signTransaction(xdr, {
        address: address ?? undefined,
        networkPassphrase: config.networkPassphrase,
      });
      return signedTxXdr;
    },
    [address, ensureInit],
  );

  return (
    <WalletContext.Provider
      value={{ address, connecting, connect, disconnect, signTransaction }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
