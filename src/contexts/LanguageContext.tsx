'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Language, TranslationKey, LocaleStrings, enTranslations } from '@/lib/translations';
import { loadLocale, loadedLocale } from '@/lib/loadLocale';
import { isSessionsPath } from '@/lib/sessionRoutes';

interface LanguageContextType {
  /** The language this page renders in: the stored preference on a sessions
   *  route, always English on the conferences side. A non-English locale is
   *  code-split, so this stays 'en' until its strings have arrived and then
   *  switches in one step (the whole page changes together). */
  language: Language;
  /** The stored preference, whatever the route. */
  preferredLanguage: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  preferredLanguage: 'en',
  setLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [preferredLanguage, setLanguageState] = useState<Language>('en');
  const pathname = usePathname();
  // Conferences is English only; sessions keep the chosen language.
  const requested: Language = isSessionsPath(pathname) ? preferredLanguage : 'en';
  // Strings of the requested locale once its chunk has loaded (English is static).
  const [table, setTable] = useState<{ lang: Language; strings: LocaleStrings } | null>(null);
  const cached = requested === 'en' ? null : loadedLocale(requested);
  const active: { lang: Language; strings: LocaleStrings } | null =
    requested === 'en' ? null
      : cached ? { lang: requested, strings: cached }
      : table && table.lang === requested ? table
      : null;
  // English renders until the requested locale's strings are here.
  const language: Language = active ? active.lang : 'en';
  const strings: LocaleStrings | null = active ? active.strings : null;

  useEffect(() => {
    if (requested === 'en' || loadedLocale(requested)) return;
    let cancelled = false;
    loadLocale(requested).then(
      (loadedStrings) => { if (!cancelled) setTable({ lang: requested, strings: loadedStrings }); },
      (err) => { console.error(`[i18n] could not load '${requested}', staying in English`, err); },
    );
    return () => { cancelled = true; };
  }, [requested]);

  // A pick made on this page wins over the stored language still loading.
  const pickedRef = useRef(false);

  // The stored language, read once on mount. English is already showing; a stored
  // es / fr / ar / pt on a sessions route loads its chunk first and the page then
  // switches in one step. A failed load keeps English (the stored value is kept,
  // so the next visit tries again).
  useEffect(() => {
    let saved: Language | null = null;
    try { saved = localStorage.getItem('gavelling-language') as Language | null; } catch {}
    if (saved !== 'es' && saved !== 'fr' && saved !== 'ar' && saved !== 'pt') return;
    const lang = saved;
    const ready: Promise<unknown> = isSessionsPath(window.location.pathname) ? loadLocale(lang) : Promise.resolve();
    ready.then(
      () => { if (!pickedRef.current) setLanguageState(lang); },
      (err) => { console.error(`[i18n] could not load '${lang}', staying in English`, err); },
    );
  }, []);

  // Drive document direction + lang off the active locale. Arabic is RTL;
  // everything else is LTR. Runs client-side because locale is persisted in
  // localStorage (there is no URL/cookie locale routing).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    // Portuguese is Brazilian Portuguese (pt-BR); every other code is its own tag.
    document.documentElement.lang = language === 'pt' ? 'pt-BR' : language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    pickedRef.current = true;
    setLanguageState(lang);
    try { localStorage.setItem('gavelling-language', lang); } catch {}
  }, []);

  const t = useCallback((key: TranslationKey, vars?: Record<string, string | number>): string => {
    let str: string = strings?.[key] ?? (enTranslations as Record<string, string>)[key] ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v));
      });
    }
    return str;
  }, [strings]);

  return (
    <LanguageContext.Provider value={{ language, preferredLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useT() {
  return useContext(LanguageContext).t;
}
