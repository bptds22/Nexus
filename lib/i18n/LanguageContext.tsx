"use client";

/**
 * LanguageContext — client-side i18n provider for the marketing
 * surfaces. FR is the default ; EN is the secondary language.
 *
 * Persistence : the user's choice is stored in localStorage under
 * the key 'nexus-lang'. The initial render uses 'fr' on both
 * server and client to avoid hydration mismatch ; the persisted
 * value is applied after mount via useEffect.
 *
 * Mirrors the single-source-of-truth pattern used elsewhere in
 * lib/config/ (pricing.ts, civilVocab.ts) — strings live in
 * lib/i18n/dictionaries.ts ; pages read them via useTranslation().
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "fr" | "en";

const STORAGE_KEY = "nexus-lang";

interface LanguageContextValue {
  lang: Lang;
  setLang: (next: Lang) => void;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Default to 'fr' so server HTML matches the first client render —
  // no hydration warning. The persisted choice is applied after mount.
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "fr" || stored === "en") {
      setLangState(stored);
    }
  }, []);

  const setLang = (next: Lang) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const toggleLang = () => setLang(lang === "fr" ? "en" : "fr");

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLang must be used inside <LanguageProvider>");
  }
  return ctx;
}
