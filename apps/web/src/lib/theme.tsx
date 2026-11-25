"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/** What the user picked in Settings → Appearance. */
export type ThemePreference = "light" | "dark" | "system";
/** What is actually painted. */
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "grow-theme";

/**
 * Runs in <head> before the first paint, so a reload never flashes the light
 * theme for someone who chose charcoal. Keep it tiny and dependency-free.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}")||"light";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`;

const systemPrefersDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

function resolve(pref: ThemePreference): ResolvedTheme {
  return pref === "dark" || (pref === "system" && systemPrefersDark()) ? "dark" : "light";
}

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Applies the theme to <html data-theme> and remembers the choice. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // null until the stored choice is read: applying the default before that
  // would flip a charcoal page back to light for a frame on every load.
  const [stored, setPref] = useState<ThemePreference | null>(null);
  const [resolved, setResolved] = useState<ResolvedTheme>("light");
  const preference: ThemePreference = stored ?? "light";

  // Read the stored choice once in the browser (the init script already painted it).
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    setPref(saved === "dark" || saved === "system" ? saved : "light");
  }, []);

  // Apply, and follow the OS while on "system".
  useEffect(() => {
    if (!stored) return;
    const apply = () => {
      const next = resolve(preference);
      document.documentElement.dataset.theme = next;
      setResolved(next);
    };
    apply();
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [stored, preference]);

  const setPreference = useCallback((pref: ThemePreference) => {
    localStorage.setItem(STORAGE_KEY, pref);
    setPref(pref);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
