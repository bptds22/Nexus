"use client";

/**
 * useTranslation — the consumer hook. Pages read strings via
 * `t.path.to.key` (typed against the FR dictionary shape) and
 * call setLang / toggleLang when they need to drive the language
 * choice from inside the page (the toggle button does this).
 *
 * Returns the dictionary as `t` (not a function) — same ergonomic
 * shape as the lib/config/ exports, no string keys to typo.
 */

import { dictionaries, type Dictionary } from "./dictionaries";
import { useLang } from "./LanguageContext";

interface TranslationApi {
  t: Dictionary;
  lang: "fr" | "en";
  setLang: (next: "fr" | "en") => void;
  toggleLang: () => void;
}

export function useTranslation(): TranslationApi {
  const { lang, setLang, toggleLang } = useLang();
  return {
    t: dictionaries[lang],
    lang,
    setLang,
    toggleLang,
  };
}
