// Resolves a free-text committee cell (from an imported spreadsheet) to ONE of
// a conference's committees, or says clearly that it cannot.
//
// Why this exists: KenyaMUN (18 Sep 2026) imported 286 delegates whose sheet
// said "Social, Cultural and Humanitarian Committee (SOCHUM)" while the
// conference committee was called "Social, Humanitarian and Cultural
// Committee" (abbreviation SOCHUM). The old matcher accepted only an exact
// name or an exact abbreviation, so every row imported without an allocation.
//
// Order, first decisive step wins:
//   1. exact name (case- and accent-insensitive, trimmed)
//   2. abbreviation: the committee's abbreviation, or the "(ABBR)" at the end
//      of the committee's own name, compared letters and digits only
//   3. a trailing "(ABBR)" in the cell, checked against the same abbreviations,
//      cross-checked with the rest of the cell as a name
//   4. normalised name: "&" = "and", "UN" = "United Nations", "Org." =
//      "Organization", punctuation, filler words and word order ignored
//
// It NEVER guesses: a step that matches two committees returns `ambiguous`, and
// a cell whose "(ABBR)" and name point at two different committees is
// `ambiguous` too. Pure, no I/O, no imports, so it can be self-checked with tsx.

export interface MatchableCommittee {
  id: string;
  name: string;
  abbreviation: string | null;
}

export type CommitteeMatchVia = 'name' | 'abbreviation' | 'parenthetical' | 'normalised';

export type CommitteeMatchResult<T extends MatchableCommittee> =
  | { kind: 'match'; committee: T; via: CommitteeMatchVia }
  | { kind: 'ambiguous'; candidates: T[] }
  | { kind: 'none' };

function foldText(s: string): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Letters and digits only: "U.N.S.C." and "UNSC" are one abbreviation. */
function abbrKey(s: string): string {
  return foldText(s).replace(/[^a-z0-9]/g, '');
}

/** "Foo Bar (FB)" → { outer: "Foo Bar", inner: "FB" }. Only a TRAILING group. */
function splitTrailingParen(s: string): { outer: string; inner: string } | null {
  const m = /^(.*\S)\s*\(([^()]+)\)\s*$/.exec((s ?? '').trim());
  if (!m) return null;
  const inner = m[2].trim();
  if (!inner) return null;
  return { outer: m[1].trim(), inner };
}

const TOKEN_EXPANSIONS: Record<string, string[]> = {
  un: ['united', 'nations'],
  org: ['organization'],
  orgn: ['organization'],
  organisation: ['organization'],
  intl: ['international'],
  int: ['international'],
  dept: ['department'],
  govt: ['government'],
};

// Filler words carry no identity: "Social, Cultural and Humanitarian Committee"
// and "Social Humanitarian Cultural" are the same committee.
const FILLER = new Set(['and', 'of', 'the', 'for', 'on', 'in', 'to', 'a', 'an', 'committee']);

/** Order-insensitive token signature of a name, or '' when nothing is left. */
function nameSignature(s: string): string {
  const text = foldText(s).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  if (!text) return '';
  const tokens = new Set<string>();
  for (const t of text.split(' ')) {
    if (!t) continue;
    for (const x of TOKEN_EXPANSIONS[t] ?? [t]) {
      if (!FILLER.has(x)) tokens.add(x);
    }
  }
  return [...tokens].sort().join(' ');
}

interface Prepared<T> {
  c: T;
  exactName: string;
  abbrs: Set<string>;
  signatures: Set<string>;
}

function prepare<T extends MatchableCommittee>(c: T): Prepared<T> {
  const abbrs = new Set<string>();
  const signatures = new Set<string>();
  if (c.abbreviation && abbrKey(c.abbreviation)) abbrs.add(abbrKey(c.abbreviation));
  const own = splitTrailingParen(c.name);
  if (own && abbrKey(own.inner)) abbrs.add(abbrKey(own.inner));
  const full = nameSignature(c.name);
  if (full) signatures.add(full);
  if (own) {
    const outer = nameSignature(own.outer);
    if (outer) signatures.add(outer);
  }
  return { c, exactName: foldText(c.name), abbrs, signatures };
}

function unique<T extends MatchableCommittee>(list: Prepared<T>[]): T[] {
  const seen = new Map<string, T>();
  for (const p of list) seen.set(p.c.id, p.c);
  return [...seen.values()];
}

function decide<T extends MatchableCommittee>(hits: T[], via: CommitteeMatchVia): CommitteeMatchResult<T> | null {
  if (hits.length === 1) return { kind: 'match', committee: hits[0], via };
  if (hits.length > 1) return { kind: 'ambiguous', candidates: hits };
  return null;
}

export function matchCommitteeCell<T extends MatchableCommittee>(committees: T[], value: string): CommitteeMatchResult<T> {
  const raw = (value ?? '').trim();
  if (!raw) return { kind: 'none' };
  const prepared = committees.map(prepare);

  // 1. exact name
  const exact = foldText(raw);
  const byName = decide(unique(prepared.filter(p => p.exactName === exact)), 'name');
  if (byName) return byName;

  // 2. the whole cell is an abbreviation
  const key = abbrKey(raw);
  if (key) {
    const byAbbr = decide(unique(prepared.filter(p => p.abbrs.has(key))), 'abbreviation');
    if (byAbbr) return byAbbr;
  }

  // 3. "Full name (ABBR)"
  const split = splitTrailingParen(raw);
  if (split) {
    const innerKey = abbrKey(split.inner);
    const outerSig = nameSignature(split.outer);
    const outerExact = foldText(split.outer);
    const byParen = innerKey ? unique(prepared.filter(p => p.abbrs.has(innerKey))) : [];
    const byOuter = unique(prepared.filter(p =>
      p.exactName === outerExact || (!!outerSig && p.signatures.has(outerSig))));

    if (byParen.length > 0 && byOuter.length > 0) {
      // Both halves spoke. They must agree on exactly one committee.
      const agreed = byParen.filter(c => byOuter.some(o => o.id === c.id));
      if (agreed.length === 1) return { kind: 'match', committee: agreed[0], via: 'parenthetical' };
      return { kind: 'ambiguous', candidates: unique([...byParen, ...byOuter].map(c => ({ c } as Prepared<T>))) };
    }
    const fromParen = decide(byParen, 'parenthetical');
    if (fromParen) return fromParen;
    const fromOuter = decide(byOuter, 'normalised');
    if (fromOuter) return fromOuter;
  }

  // 4. normalised name of the whole cell
  const sig = nameSignature(raw);
  if (sig) {
    const bySig = decide(unique(prepared.filter(p => p.signatures.has(sig))), 'normalised');
    if (bySig) return bySig;
  }

  return { kind: 'none' };
}
