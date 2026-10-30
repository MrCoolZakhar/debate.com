// ============================================================
// src/lib/pressOutlets.ts
//
// The outlets a Model UN press corps is made of, and each outlet's round seat
// picture. A press seat is a NAME, not a country, so it has no flag; if its
// name is one of these outlets it draws the outlet's logo instead of initials.
//
// ONE LOOKUP: `pressOutletLogo(name)` returns `/press-logos/<slug>.png` or
// null. It is wired into the three seat-art resolvers (`effectiveSlotArt` and
// `artFromIndex` in slotGroups.ts, `sessionSeatArt` in sessionFlags.ts), AFTER
// a seat's own crest and its group's crest and BEFORE the national flag.
//
// EXACT MATCH ONLY after normalising (lower case, accents and punctuation
// dropped, "&" read as "and"). Never a substring or fuzzy match: a country or a
// person must never pick up a newsroom's logo.
//
// The files are 256 px square PNGs (logo contained on white, padded so a
// circle crop shows the whole mark); see public/press-logos/CREDITS.md.
// ============================================================

const BASE = '/press-logos';

/** slug -> the names the outlet goes by (the first is the preset name). */
const OUTLETS: Record<string, string[]> = {
  'bbc': ['BBC', 'BBC News', 'British Broadcasting Corporation', 'BBC World Service'],
  'al-jazeera': ['Al Jazeera', 'Al Jazeera English', 'Aljazeera', 'Al Jazeera News'],
  'rt': ['RT', 'RT News', 'Russia Today', 'RT Russia Today'],
  'the-new-york-times': ['The New York Times', 'New York Times', 'NYT', 'NY Times', 'The NYT'],
  'the-guardian': ['The Guardian', 'Guardian', 'The Guardian UK'],
  'le-monde': ['Le Monde'],
  'reuters': ['Reuters', 'Thomson Reuters', 'Reuters News Agency'],
  'cnn': ['CNN', 'CNN International', 'Cable News Network'],
  'fox-news': ['Fox News', 'Fox News Channel'],
  'the-economist': ['The Economist', 'Economist'],
  'the-times-of-india': ['The Times of India', 'Times of India', 'TOI'],
  'associated-press': ['Associated Press', 'The Associated Press', 'AP', 'AP News'],
  'afp': ['AFP', 'Agence France-Presse', 'Agence France Presse'],
  'africanews': ['Africanews', 'Africa News'],
  'hindustan-times': ['Hindustan Times', 'The Hindustan Times'],
  'dawn': ['Dawn', 'Dawn News', 'Dawn Pakistan'],
  'al-arabiya': ['Al Arabiya', 'Al-Arabiya', 'Alarabiya', 'Al Arabiya News'],
  'the-korea-herald': ['The Korea Herald', 'Korea Herald'],
  'china-daily': ['China Daily'],
};

function normalise(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const BY_NAME: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [slug, names] of Object.entries(OUTLETS)) {
    for (const n of names) m.set(normalise(n), `${BASE}/${slug}.png`);
  }
  return m;
})();

/** The outlet's logo for a seat name, or null when the name is not a known outlet. */
export function pressOutletLogo(name: string): string | null {
  if (!name) return null;
  return BY_NAME.get(normalise(name)) ?? null;
}
