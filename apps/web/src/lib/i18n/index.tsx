"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { en, type Messages } from "./en";
import { es } from "./es";

export type Locale = "en" | "es";

const STORAGE_KEY = "grow-locale";
const MESSAGES: Record<Locale, Messages> = { en, es };

/** Spanish for Spanish-speaking browsers, English otherwise. */
function detect(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "en" || saved === "es") return saved;
  return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Messages;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * App language. Messages are plain typed objects (./en, ./es): a missing or
 * misnamed Spanish string fails the type check instead of showing a key.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(detect());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLocaleState(next);
  }, []);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: MESSAGES[locale] }}>
      {children}
    </I18nContext.Provider>
  );
}

function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used within an I18nProvider");
  return ctx;
}

/** The active messages, e.g. `const t = useT(); t.nav.send`. */
export function useT(): Messages {
  return useI18n().t;
}

/** The active locale and a setter (Settings → Language). */
export function useLocale(): Pick<I18nContextValue, "locale" | "setLocale"> {
  const { locale, setLocale } = useI18n();
  return { locale, setLocale };
}
