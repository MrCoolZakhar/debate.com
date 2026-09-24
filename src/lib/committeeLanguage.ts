// ─────────────────────────────────────────────────────────────────────────────
// A committee's WORKING LANGUAGE (23 Sep 2026, owner: "In the committee set-up,
// add a small language setting").
//
// Storage: `conference_committees.working_language` (text, nullable, 1 to 40
// characters after trimming; migration `conference_committees_working_language`).
// It holds the DISPLAY NAME ("English", "Spanish", or whatever the organiser
// typed under Other), not a code, so every reader prints it as is.
//
// DEFAULT 'English' (owner, 23 Sep 2026: "Language selection by default should
// be English"; migration `conference_committees_working_language_default_english`
// set the column default and backfilled every existing row). NULL is still
// allowed and still means "not set": readers print nothing for it.
// ─────────────────────────────────────────────────────────────────────────────

/** The six UN official languages first, then the other common MUN languages. */
export const COMMITTEE_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'Arabic',
  'Chinese',
  'Russian',
  'Portuguese',
  'German',
  'Italian',
  'Turkish',
  'Japanese',
  // Languages MUN committees are run in outside the UN six (24 Sep 2026, owner: "add any
  // that you can find verified has committees in it. Definitely missing Hindi, Urdu,
  // Slovak, Polish and Bahasa"): national-language committees at Indian, Pakistani,
  // Indonesian, Malaysian, Bangladeshi and Central / Eastern European conferences.
  'Hindi',
  'Urdu',
  'Bengali',
  'Bahasa Indonesia',
  'Bahasa Melayu',
  'Korean',
  'Vietnamese',
  'Thai',
  'Polish',
  'Slovak',
  'Czech',
  'Hungarian',
  'Romanian',
  'Ukrainian',
  'Greek',
  'Dutch',
] as const;

/** What a new committee starts on. */
export const DEFAULT_COMMITTEE_LANGUAGE = 'English';

export const COMMITTEE_LANGUAGE_MAX = 40;

/** Trimmed, length-capped, and null when empty, exactly what the column accepts. */
export function normaliseCommitteeLanguage(raw: string | null | undefined): string | null {
  const v = (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, COMMITTEE_LANGUAGE_MAX);
  return v ? v : null;
}

/** True when the value is one of the listed languages (case-insensitive). */
export function isListedCommitteeLanguage(v: string | null | undefined): boolean {
  if (!v) return false;
  const k = v.trim().toLowerCase();
  return COMMITTEE_LANGUAGES.some((l) => l.toLowerCase() === k);
}

const LANGUAGE_CODES: Record<string, string> = {
  english: 'EN', spanish: 'ES', french: 'FR', arabic: 'AR', chinese: 'ZH',
  russian: 'RU', portuguese: 'PT', german: 'DE', italian: 'IT', turkish: 'TR',
  japanese: 'JA', hindi: 'HI', urdu: 'UR', bengali: 'BN', 'bahasa indonesia': 'ID',
  'bahasa melayu': 'MS', korean: 'KO', vietnamese: 'VI', thai: 'TH', polish: 'PL',
  slovak: 'SK', czech: 'CS', hungarian: 'HU', romanian: 'RO', ukrainian: 'UK',
  greek: 'EL', dutch: 'NL',
};

/** The flag (ISO 3166 code, for CircleFlag) that stands for a listed language.
 *  Arabic uses Saudi Arabia's flag. Null for anything typed under Other, which
 *  the pickers draw as a Languages glyph instead. */
const LANGUAGE_FLAGS: Record<string, string> = {
  english: 'GB', spanish: 'ES', french: 'FR', arabic: 'SA', chinese: 'CN',
  russian: 'RU', portuguese: 'PT', german: 'DE', italian: 'IT', turkish: 'TR',
  japanese: 'JP', hindi: 'IN', urdu: 'PK', bengali: 'BD', 'bahasa indonesia': 'ID',
  'bahasa melayu': 'MY', korean: 'KR', vietnamese: 'VN', thai: 'TH', polish: 'PL',
  slovak: 'SK', czech: 'CZ', hungarian: 'HU', romanian: 'RO', ukrainian: 'UA',
  greek: 'GR', dutch: 'NL',
};

export function committeeLanguageFlag(name: string | null | undefined): string | null {
  if (!name) return null;
  return LANGUAGE_FLAGS[name.trim().toLowerCase()] ?? null;
}

/** A two-letter tag for tight spots (the public committee card's corner):
 *  the ISO 639-1 code for a listed language, else the first two letters. The
 *  full name always rides along as the tooltip / accessible name. */
export function committeeLanguageCode(name: string): string {
  const k = name.trim().toLowerCase();
  return LANGUAGE_CODES[k] ?? (k.replace(/[^\p{L}]/gu, '').slice(0, 2).toUpperCase() || '?');
}
