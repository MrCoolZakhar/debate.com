/**
 * societyMatch.ts — fuzzy matching of a typed delegation name against the
 * delegations (societies) that already exist for this conference.
 *
 * WHY
 * A delegate types their school the way they say it ("st marys", "LSE",
 * "Westminister"), and the delegation was created by somebody else, typed the
 * way THEY say it ("Saint Mary's High School", "London School of Economics MUN
 * Society", "Westminster School"). A plain substring match finds none of
 * those, the delegate concludes the delegation does not exist, and the
 * conference ends up with two delegations for one school.
 *
 * TWO JOBS, TWO STANDARDS
 * Suggesting a delegation is cheap to get wrong: the applicant sees the list
 * and picks, or does not. Deciding that a typed name IS an existing
 * delegation is not: the apply flow then attaches the application to it
 * (ConferenceApplyClient handleContinue). So the suggestion score is generous
 * and the "same delegation" test (societyDedupeKey / isSameSocietyName) is
 * deliberately narrow.
 *
 * HOW (pure, client-side, no imports)
 *  1. Normalise (normalizeSocietyName): apostrophes dropped ("mary's" =
 *     "marys"), lowercase, accents stripped (NFKD), letters NFD does not
 *     decompose folded (ı i, ß ss, ł l, ø o, æ ae, œ oe, đ d, þ th, ð d), "&"
 *     to "and", anything that is not a letter, digit or combining mark in ANY
 *     script to a space. Non-Latin names ("北京四中", "Лицей 239") keep their
 *     letters; the old ASCII-only rule deleted them, so every such name
 *     normalised to its digits or to nothing and they all matched each other.
 *  2. The STRICT key (societyDedupeKey), the only thing treated as "the same
 *     delegation": the normalised words IN ORDER, with only these ignored:
 *     "and", a leading "The", and a "MUN" / "Model UN" / "Model United
 *     Nations" PHRASE at the very start or end. So "LSE MUN" = "The LSE Model
 *     United Nations" = "LSE", but "Government Model High School" is not
 *     "Government High School", "United Nations International School of
 *     Hanoi" is not "International School of Hanoi", "Geneva International
 *     School" is not "International School of Geneva" (order), "School A" is
 *     not "School" (no word is ever dropped for being short), and "Main St"
 *     is not "Main Saint".
 *  3. Fuzzy tokens: the normalised words with "st" read as "saint" and a
 *     token glued to "mun" split ("hultmun" = "hult mun"). Core tokens then
 *     drop the words that say what KIND of body it is rather than WHICH one
 *     (school, high, college, MUN, society, club, international...) and stop
 *     words (the, of, and, de...). Compared as sets: word order never matters.
 *  4. Score, 0 to 1, the best of:
 *     - strict: same strict key. Score 1.
 *     - loose: same loose key (fuzzy tokens minus stop words and the Model
 *       UN words, sorted). Score 0.97: a near-certain suggestion, never an
 *       automatic match. The loose key keeps school-type words, so "Harvard
 *       University" and "Harvard High School" do not meet here.
 *     - core: the sorted core tokens are identical, or glued together they
 *       are ("Kings wood" = "Kingswood"). Score 0.95.
 *     - acronym: a one-word query equal to the other name's initials ("LSE"
 *       vs "London School of Economics"). Score 0.9.
 *     - tokens: each query token takes its best match among the candidate's
 *       tokens: equal 1; a small typo 1 - edits/length, at most 1 edit under
 *       8 letters and 2 from 8 up; a prefix 0.9 (0.7 at two letters), but
 *       ONLY for the word still being typed, so a finished "kings" never
 *       prefix-matches "kingswood". 70% query coverage + 30% candidate
 *       coverage.
 *     - glued: when the query has two or more core words, all of them joined
 *       with no spaces, compared with the same typo rule or found inside the
 *       candidate's joined words ("kings wood" vs "Kingswood"). Score up to 0.8.
 *     - substring: the candidate's fuzzy text contains the query's (3+
 *       characters), or a candidate word starts with a 2-letter query, so
 *       everything the old `includes` filter found is still found. Score 0.7.
 *  5. Anything at or above MATCH_THRESHOLD (0.62) is a suggestion, best first.
 */

export interface SocietyLike {
  id: string;
  name: string;
}

export interface SocietyMatch<T extends SocietyLike> {
  society: T;
  score: number;
  /** Normalises to the same delegation. Creating another would duplicate it. */
  exact: boolean;
}

export const MATCH_THRESHOLD = 0.62;

/** Longest delegation name the apply flow accepts (the input's maxLength).
 *  rankSocieties also cuts a longer query to this, because the token scorer
 *  is quadratic in the number of words and a pasted paragraph would stall
 *  every keystroke. */
export const MAX_SOCIETY_NAME_CHARS = 120;

/** Words that say what kind of body a delegation is, not which one. */
const GENERIC = new Set([
  'school', 'schools', 'high', 'highschool', 'secondary', 'grammar', 'prep', 'preparatory',
  'academy', 'college', 'collegiate', 'institute', 'institution', 'university', 'uni',
  'lycee', 'liceo', 'lyceum', 'gymnasium', 'gimnasio', 'colegio', 'escuela', 'instituto',
  'universidad', 'universite', 'universita', 'universitat', 'international', 'intl',
  'mun', 'model', 'united', 'nations', 'un', 'society', 'soc', 'club', 'team', 'group',
  'association', 'assoc', 'delegation', 'debate', 'debating', 'program', 'programme',
]);

/** The subset of GENERIC that is about Model UN itself. Dropped when taking a
 *  name's initials, so "LSE MUN Society" abbreviates to "LSE", not "LSEMS". */
const MUN_WORDS = new Set([
  'mun', 'model', 'united', 'nations', 'un', 'society', 'soc', 'club', 'team', 'group',
  'association', 'assoc', 'delegation', 'debate', 'debating', 'program', 'programme',
]);

const STOP = new Set([
  'the', 'of', 'and', 'for', 'at', 'in', 'on', 'a', 'an',
  'de', 'la', 'le', 'les', 'du', 'des', 'del', 'el', 'los', 'las', 'di', 'da', 'do', 'dos',
  'der', 'die', 'das', 'und', 'y', 'e', 'et',
]);

/** Letters that NFKD leaves alone but a reader treats as a plain Latin
 *  letter. Keyed by the LOWERCASE form: the input is lowercased first. */
const FOLD: Record<string, string> = {
  'ı': 'i', 'ß': 'ss', 'ł': 'l', 'ø': 'o', 'æ': 'ae', 'œ': 'oe', 'đ': 'd', 'þ': 'th', 'ð': 'd',
};

/** Lowercase, accent-free, punctuation-free, single-spaced, any script. */
export function normalizeSocietyName(s: string): string {
  return (s ?? '')
    // Before NFKD: the spacing acute (U+00B4) decomposes to a space plus a
    // mark, which would split "mary´s" in two.
    .replace(/['’‘`´ʼ]/g, '')
    // Before NFKD, so "İ" (lowercased to "i" + combining dot) loses the dot.
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    // Recompose what NFKD split that is not an accent (Hangul syllables).
    .normalize('NFC')
    .replace(/[ıßłøæœđþð]/g, c => FOLD[c] ?? c)
    .replace(/&/g, ' and ')
    // Letters, digits and combining marks of every script survive. Marks stay
    // because in Devanagari, Thai or Arabic they are part of the word; the
    // Latin accents are already gone above.
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim();
}

/** Fuzzy tokens: "st" read as "saint", a glued "mun" split off. Never used
 *  for the strict key: "Main St School" is a street, not a saint. */
function allTokens(s: string): string[] {
  const out: string[] = [];
  for (const raw of normalizeSocietyName(s).split(' ')) {
    if (!raw) continue;
    const t = raw === 'st' ? 'saint' : raw === 'ste' ? 'sainte' : raw;
    // "hultmun" / "lsemun" -> "hult mun" / "lse mun"
    if (t.length > 5 && t.endsWith('mun')) {
      out.push(t.slice(0, -3), 'mun');
    } else {
      out.push(t);
    }
  }
  return out;
}

function coreTokens(all: string[]): string[] {
  const core = all.filter(t => !GENERIC.has(t) && !STOP.has(t));
  if (core.length) return core;
  // A name made only of generic words ("High School") still needs something
  // to compare, so fall back rather than match everything or nothing.
  const noStop = all.filter(t => !STOP.has(t));
  return noStop.length ? noStop : all;
}

function initialsOf(all: string[]): string[] {
  const noStop = all.filter(t => !STOP.has(t));
  const withoutMun = noStop.filter(t => !MUN_WORDS.has(t));
  const a = noStop.map(t => t[0]).join('');
  const b = withoutMun.map(t => t[0]).join('');
  return a === b ? [a] : [a, b];
}

/** Optimal string alignment distance (Levenshtein plus adjacent swaps). */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev2: number[] = new Array(n + 1).fill(0);
  let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[n];
}

/** 1 - edits/length when the words are long enough and close enough, else 0. */
function typoSimilarity(a: string, b: string): number {
  const minLen = Math.min(a.length, b.length);
  const maxLen = Math.max(a.length, b.length);
  if (minLen < 4) return 0;
  const allowed = maxLen >= 8 ? 2 : 1;
  const d = editDistance(a, b);
  return d <= allowed ? 1 - d / maxLen : 0;
}

/** `typed` is the query-side word; `prefixOk` is true only for the word the
 *  applicant is still typing. */
function tokenSimilarity(typed: string, other: string, prefixOk: boolean): number {
  if (typed === other) return 1;
  if (prefixOk && typed.length >= 2 && other.startsWith(typed)) {
    return typed.length >= 3 ? 0.9 : 0.7;
  }
  return typoSimilarity(typed, other);
}

/** The Model UN wrapper around an institution's name, for the LOOSE key
 *  only (a suggestion score). Deliberately narrower than GENERIC: "school",
 *  "college", "university" stay, or "Harvard University" and "Harvard High
 *  School" would score as one. */
const LOOSE_IGNORE = new Set([
  'mun', 'model', 'united', 'nations', 'un', 'society', 'soc', 'club', 'team', 'delegation',
]);

/** Sorted fuzzy tokens minus stop words and the Model UN words. Equal loose
 *  keys are a near-certain SUGGESTION (0.97), never an automatic match. A
 *  one-letter word is never dropped ("School A" is not "School"). */
function looseKey(s: string): string {
  const all = allTokens(s);
  const kept = all.filter(t => t.length === 1 || (!STOP.has(t) && !LOOSE_IGNORE.has(t)));
  const base = kept.length ? kept : all.filter(t => t.length === 1 || !STOP.has(t));
  return [...(base.length ? base : all)].sort().join(' ');
}

/** The Model UN phrases a strict key may shed, and only at the very start or
 *  the very end of a name. Longest first. */
const MUN_PHRASES: string[][] = [['model', 'united', 'nations'], ['model', 'un'], ['mun']];

function shedLeading(words: string[]): string[] | null {
  for (const p of MUN_PHRASES) {
    if (words.length > p.length && p.every((w, i) => words[i] === w)) return words.slice(p.length);
  }
  return null;
}

function shedTrailing(words: string[]): string[] | null {
  for (const p of MUN_PHRASES) {
    const off = words.length - p.length;
    if (off > 0 && p.every((w, i) => words[off + i] === w)) return words.slice(0, off);
  }
  return null;
}

/**
 * The STRICT identity of a delegation name. Two names with the same key ARE
 * the same delegation: a typed name with the same key as exactly one
 * existing delegation is treated as picking it (and the apply flow says so on
 * screen), and is never offered as a new one to create.
 *
 * Ignores ONLY: case, accents, punctuation, the word "and" / "&", a leading
 * "The", and a "MUN" / "Model UN" / "Model United Nations" phrase at the
 * start or end. Word order counts, no other word is dropped anywhere, and
 * "st" stays "st". Never reduces a name to nothing: "MUN" alone stays "mun".
 */
export function societyDedupeKey(s: string): string {
  const all = normalizeSocietyName(s).split(' ').filter(Boolean);
  const noAnd = all.filter(t => t !== 'and');
  let words = noAnd.length ? noAnd : all;
  for (let changed = true; changed;) {
    changed = false;
    if (words.length > 1 && words[0] === 'the') { words = words.slice(1); changed = true; }
    const lead = shedLeading(words);
    if (lead) { words = lead; changed = true; }
  }
  const trail = shedTrailing(words);
  if (trail) words = trail;
  return words.join(' ');
}

/** Everything the scorer derives from one name. The candidate side is the
 *  same list on every keystroke, so it is memoised by the raw string. */
interface NameProfile {
  all: string[];
  strict: string;
  loose: string;
  core: string[];
  initials: string[];
  text: string;
}

const PROFILE_CACHE = new Map<string, NameProfile>();
const PROFILE_CACHE_MAX = 5000;

function profileOf(name: string): NameProfile {
  const hit = PROFILE_CACHE.get(name);
  if (hit) return hit;
  const all = allTokens(name);
  const prof: NameProfile = {
    all,
    strict: societyDedupeKey(name),
    loose: looseKey(name),
    core: coreTokens(all),
    initials: initialsOf(all),
    text: all.join(' '),
  };
  if (PROFILE_CACHE.size >= PROFILE_CACHE_MAX) PROFILE_CACHE.clear();
  PROFILE_CACHE.set(name, prof);
  return prof;
}

/** How alike two delegation names are, 0 to 1. See the file header. */
export function societyNameScore(query: string, candidate: string): number {
  const qp = profileOf(query);
  const cp = profileOf(candidate);
  const qAll = qp.all;
  const cAll = cp.all;
  if (!qAll.length || !cAll.length) return 0;
  if (qp.strict === cp.strict) return 1;
  if (qp.loose === cp.loose) return 0.97;
  const q = qp.core;
  const c = cp.core;

  const qSorted = [...q].sort().join(' ');
  const cSorted = [...c].sort().join(' ');
  if (qSorted === cSorted || q.join('') === c.join('')) return 0.95;

  // The last word is only "being typed" while no space follows it.
  const typing = /\s$/.test(query) ? null : qAll[qAll.length - 1];

  let score = 0;

  // Acronym, in either direction.
  if (q.length === 1 && q[0].length >= 2 && cp.initials.includes(q[0])) score = Math.max(score, 0.9);
  if (c.length === 1 && c[0].length >= 2 && qp.initials.includes(c[0])) score = Math.max(score, 0.9);

  // Token coverage, word order ignored.
  const best = (qt: string, ct: string) => tokenSimilarity(qt, ct, qt === typing);
  const qSide = q.reduce((sum, qt) => sum + Math.max(0, ...c.map(ct => best(qt, ct))), 0) / q.length;
  const cSide = c.reduce((sum, ct) => sum + Math.max(0, ...q.map(qt => best(qt, ct))), 0) / c.length;
  score = Math.max(score, 0.7 * qSide + 0.3 * cSide);

  // Glued, for names that split their words differently. Only when the query
  // itself was split, or a one-word "kings" would match inside "kingswood".
  if (q.length >= 2) {
    const qGlued = q.join('');
    const cGlued = c.join('');
    if (qGlued.length >= 5 && cGlued.length >= 5) {
      score = Math.max(score, typoSimilarity(qGlued, cGlued));
      if (cGlued.includes(qGlued)) score = Math.max(score, 0.8);
    }
  }

  // Substring, so nothing the old `includes` filter found is lost.
  const qNorm = qp.text;
  if (qNorm.length >= 3 && cp.text.includes(qNorm)) {
    score = Math.max(score, 0.7);
  } else if (qNorm.length === 2 && cAll.some(t => t.startsWith(qNorm))) {
    score = Math.max(score, 0.7);
  }

  return Math.min(1, score);
}

/** True when two names are the same delegation (the strict key). Only this
 *  may turn a typed name into an existing delegation without a click. */
export function isSameSocietyName(a: string, b: string): boolean {
  const pa = profileOf(a);
  const pb = profileOf(b);
  if (!pa.strict || !pb.strict) return false;
  return pa.strict === pb.strict;
}

/**
 * The delegations worth suggesting for what has been typed so far, best
 * first. A one-character query lists the names with a word starting with it
 * (ranking is meaningless at one letter).
 */
export function rankSocieties<T extends SocietyLike>(
  query: string,
  societies: T[],
  opts: { limit?: number; threshold?: number } = {},
): SocietyMatch<T>[] {
  const limit = opts.limit ?? 8;
  const threshold = opts.threshold ?? MATCH_THRESHOLD;
  if (query.length > MAX_SOCIETY_NAME_CHARS) query = query.slice(0, MAX_SOCIETY_NAME_CHARS);
  const qNorm = normalizeSocietyName(query);
  if (!qNorm) return [];

  if (qNorm.replace(/ /g, '').length < 2) {
    return societies
      .filter(s => allTokens(s.name).some(t => t.startsWith(qNorm)))
      .slice(0, limit)
      .map(society => ({ society, score: 0.5, exact: false }));
  }

  return societies
    .map(society => {
      const score = societyNameScore(query, society.name);
      return { society, score, exact: isSameSocietyName(query, society.name) };
    })
    .filter(m => m.score >= threshold)
    .sort((a, b) => b.score - a.score || a.society.name.localeCompare(b.society.name))
    .slice(0, limit);
}
