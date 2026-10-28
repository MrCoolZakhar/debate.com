// Loads a non-English locale on demand. English (src/lib/translations.ts) is the
// only locale in the shared bundle; each of es, fr, ar and pt is its own chunk,
// fetched the first time a visitor picks it or has it stored, then cached for
// the life of the page. A failed load is not cached, so the next pick retries.
import type { Language, LocaleStrings } from './translations';

export type LazyLanguage = Exclude<Language, 'en'>;

const LOADERS: Record<LazyLanguage, () => Promise<{ default: LocaleStrings }>> = {
  es: () => import('./locales/es'),
  fr: () => import('./locales/fr'),
  ar: () => import('./locales/ar'),
  pt: () => import('./locales/pt'),
};

const loaded: Partial<Record<LazyLanguage, LocaleStrings>> = {};
const inFlight: Partial<Record<LazyLanguage, Promise<LocaleStrings>>> = {};

/** The strings of a locale already loaded on this page, or null. */
export function loadedLocale(lang: LazyLanguage): LocaleStrings | null {
  return loaded[lang] ?? null;
}

/** Fetches a locale's chunk once; concurrent callers share one request. */
export function loadLocale(lang: LazyLanguage): Promise<LocaleStrings> {
  const ready = loaded[lang];
  if (ready) return Promise.resolve(ready);
  const pending = inFlight[lang];
  if (pending) return pending;
  const p = LOADERS[lang]()
    .then((m) => {
      loaded[lang] = m.default;
      return m.default;
    })
    .finally(() => {
      delete inFlight[lang];
    });
  inFlight[lang] = p;
  return p;
}
