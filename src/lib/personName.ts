// ── Is this a person's name? ──────────────────────────────────────────────────
//
// Owner, 11 Oct 2026: "there is quite a few users that don't actually put their
// name in when they register, but rather stuff like MUN Society Taiwan, chair
// ECOSOC and stuff. we need the people's names". Organisers, chairs and
// certificates all read profiles.display_name, so it has to be a person.
//
// ONE rule, used by sign-up ("Finish signing up" in the auth pop-up), the
// profile page and the "What's Your Name?" gate (src/components/NameGate.tsx).
// The read-only SQL count in CLAUDE.md mirrors it; change both together.
//
// What is refused (case-insensitive, WHOLE words only, so "Chairez" or
// "Clubb" pass):
//   email     an '@' anywhere
//   too_short fewer than 2 letters in total
//   digits    any digit (0-9 or any other script's digits)
//   role      chair, co-chair, chairperson, secretariat, secretary, president,
//             presidency, admin, official, moderator, delegate, delegation, ...
//   org       society, club, association, school, university, college,
//             academy, conference, council, team, committee, institute, the
//             UN committee names (ECOSOC, UNSC, DISEC, UNHRC, SOCHUM, UNGA,
//             UNESCO, ...), the phrases "Model United Nations" / "United
//             Nations", and MUN.
//
// MUN is matched CASE-SENSITIVELY on purpose: "MUN" as a word, or a word that
// ends in capital "MUN" (LIMUN, WorldMUN, NODMUN). Mun is a common Korean
// family name (문), and "Mun Ji-ho" must pass. Lower-case "mun" alone is not
// refused for the same reason.
//
// What is NOT refused: one-word names (mononyms exist) and all-capitals names.
// An all-capitals name gets a "Use Title Case" suggestion (titleCaseSuggestion),
// never a block.

export type NameProblem = 'org' | 'role' | 'digits' | 'email' | 'too_short';

/** Trim, and collapse every run of whitespace (tabs, newlines, NBSP) to one space. */
export function tidyName(name: string | null | undefined): string {
  return (name ?? '').replace(/\s+/gu, ' ').trim();
}

const ROLE_WORDS = new Set([
  'chair', 'chairs', 'cochair', 'chairperson', 'chairman', 'chairwoman', 'chairing',
  'secretariat', 'secretary', 'secretarygeneral', 'president', 'presidency',
  'admin', 'admins', 'administrator', 'administration', 'official', 'officials',
  'moderator', 'rapporteur', 'delegate', 'delegates', 'delegation', 'delegations',
  'organiser', 'organisers', 'organizer', 'organizers', 'staff',
]);

const ORG_WORDS = new Set([
  'society', 'societies', 'club', 'clubs', 'association', 'school', 'schools',
  'university', 'universidad', 'universite', 'université', 'college', 'academy',
  'conference', 'council', 'team', 'committee', 'committees', 'institute',
  'organisation', 'organization', 'foundation', 'department', 'email',
  // UN bodies and the usual MUN committees.
  'ecosoc', 'unsc', 'disec', 'unhrc', 'sochum', 'unga', 'unesco', 'unicef',
  'unep', 'unodc', 'unhcr', 'undp', 'uncsw', 'unwomen', 'iaea', 'icj', 'nato',
  'jcc', 'specpol', 'hrc',
]);

const ORG_PHRASES = ['model united nations', 'united nations', 'high school', 'un women'];

/** Words of a name: runs of letters (any script), marks and apostrophes. A
 *  hyphen splits, so "co-chair" yields "co" + "chair" and "Secretary-General"
 *  yields "secretary". */
function wordsOf(name: string): string[] {
  return name.split(/[^\p{L}\p{M}'’]+/u).filter(Boolean);
}

function letterCount(name: string): number {
  return (name.match(/\p{L}/gu) ?? []).length;
}

function hasMunWord(words: string[]): boolean {
  // Case-sensitive on the original word: MUN, LIMUN, WorldMUN. Never "Mun".
  return words.some((w) => /^\p{L}*MUN$/u.test(w));
}

/** Why `name` is not a person's name, or null when it can be used. */
export function nameProblem(name: string | null | undefined): NameProblem | null {
  const clean = tidyName(name);
  if (clean.includes('@')) return 'email';
  if (letterCount(clean) < 2) return 'too_short';
  if (/\p{Nd}/u.test(clean)) return 'digits';
  const words = wordsOf(clean);
  const lower = words.map((w) => w.toLowerCase());
  // "co chair" / "co-chair" / "vice chair" are all caught by "chair";
  // "secretary general" by "secretary".
  if (lower.some((w) => ROLE_WORDS.has(w))) return 'role';
  const spaced = ` ${lower.join(' ')} `;
  if (ORG_PHRASES.some((p) => spaced.includes(` ${p} `))) return 'org';
  if (lower.some((w) => ORG_WORDS.has(w))) return 'org';
  if (hasMunWord(words)) return 'org';
  return null;
}

/** The sentence shown under the field for each problem. */
export function nameProblemMessage(problem: NameProblem): string {
  switch (problem) {
    case 'email':
      return "That looks like an email address. Use your own name, the way you'd sign a certificate.";
    case 'too_short':
      return 'Enter your name. It needs at least 2 letters.';
    case 'digits':
      return "Names don't have numbers in them. Use your own name, the way you'd sign a certificate.";
    case 'role':
      return "Use your own name, not your role. The conference shows your role as chair or secretariat on its own.";
    case 'org':
    default:
      return "Use your own name, the way you'd sign a certificate. Your MUN society goes in your delegation later.";
  }
}

/** Convenience: the sentence for `name`, or null when it is fine. */
export function nameError(name: string | null | undefined): string | null {
  const p = nameProblem(name);
  return p ? nameProblemMessage(p) : null;
}

/** True when the name has letters and every cased letter is a capital. */
export function isAllCaps(name: string | null | undefined): boolean {
  const clean = tidyName(name);
  const cased = clean.match(/\p{Lu}|\p{Ll}/gu) ?? [];
  if (cased.length < 2) return false;
  return cased.every((c) => /\p{Lu}/u.test(c));
}

/** "JEAN-LUC O'NEIL" → "Jean-Luc O'Neil". Each part after a space, hyphen or
 *  apostrophe starts with a capital. */
export function toTitleCase(name: string): string {
  return tidyName(name)
    .toLocaleLowerCase()
    .replace(/(^|[\s\-'’])(\p{Ll})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase());
}

/** For an all-capitals name, the Title Case version to offer ("Use Title
 *  Case"); null otherwise. Never applied without the person pressing it. */
export function titleCaseSuggestion(name: string | null | undefined): string | null {
  if (!isAllCaps(name)) return null;
  const t = toTitleCase(name ?? '');
  return t && t !== tidyName(name) ? t : null;
}

/** Joins a first and last name the way sign-up stores them: "First Last",
 *  tidied. A blank last name gives the first name alone (mononyms). */
export function joinName(first: string, last: string): string {
  return tidyName(`${tidyName(first)} ${tidyName(last)}`);
}
