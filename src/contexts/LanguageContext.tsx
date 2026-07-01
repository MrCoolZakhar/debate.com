'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Language, TranslationKey, translations } from '@/lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gavelling-language') as Language | null;
      if (saved === 'en' || saved === 'es' || saved === 'fr' || saved === 'ar') setLanguageState(saved);
    } catch {}
  }, []);

  // Drive document direction + lang off the active locale. Arabic is RTL;
  // everything else is LTR. Runs client-side because locale is persisted in
  // localStorage (there is no URL/cookie locale routing).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try { localStorage.setItem('gavelling-language', lang); } catch {}
  }, []);

  const t = useCallback((key: TranslationKey, vars?: Record<string, string | number>): string => {
    let str: string = ((translations as Record<string, Record<string, string>>)[language])?.[key] ?? (translations.en as Record<string, string>)[key] ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v));
      });
    }
    return str;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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
