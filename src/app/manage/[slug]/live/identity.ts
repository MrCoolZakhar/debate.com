// ─────────────────────────────────────────────────────────────────────────────
// Committee identity for the live-status surface: the acronym UI rule.
//
// Kept in its own module (rather than in cardModel) so `LiveModals` can use it
// as well — cardModel imports LiveModals, so LiveModals cannot import cardModel.
// ─────────────────────────────────────────────────────────────────────────────

import { committeeDisplayName, matchPresetEmblemEntry } from '@/lib/presetNames';
import type { LiveCommittee } from './LiveModals';

//
// HOUSE RULE: a long committee name renders as its ACRONYM, with the full name
// small beneath. The page shipped a local hand-roll that used ONLY the explicit
// `abbreviation` column, and 184 of 392 production rows (47%) have none — so
// nearly half the grid printed a long name into a narrow column and truncated
// it to about eleven characters ("Disarmament a…" instead of DISEC).
//
// The obvious fix — hand every row to `deriveCommitteeAcronym` — was measured
// against all 392 rows and is NOT safe here. Two failure modes, both of which
// make a committee floor harder to read rather than easier:
//
//   • its preset-alias match fires on ordinary words. "Programa de las Naciones
//     Unidas para el Medio Ambiente" matched the Arab League alias "las" and
//     rendered as **LAS**; "AD HOC: Council of the Gods" matched "hoc" and
//     rendered as **HoC**; six unrelated committees all rendered as **CRISIS**
//     and four as **GA**. Collapsing distinct rooms onto one label is the exact
//     opposite of what this grid is for.
//   • its initials fallback invents things. "AIPPM Frozen on 25th June 1975"
//     became **AF2J1**; "UNCSW (United Nation commission on the status of
//     women)" became **UUNCSW**; "Supreme Court of the United States (SCOTUS)"
//     became **SCUSS**.
//
// So the acronym is taken from sources that cannot be wrong, in order:
//
//   1. the explicit `abbreviation` column;
//   2. an acronym THE NAME ITSELF SPELLS OUT — "… (DISEC)", "… – UNSC",
//      "ECOSOC (Economic and Social Council)". This is the dominant real
//      pattern in production and it is the organiser's own text, so it is not a
//      guess. It also fixes both Spanish rows above: they end in "– PNUMA" and
//      "– AGNU";
//   3. a preset's REAL acronym, and only when it is a clean 3–6 letter
//      all-caps label — which excludes "GA", "EU" and "HoC" — and only when it
//      is UNIQUE within this conference, which excludes the six "CRISIS" rooms
//      and the "UNEP Junior" / "UNEP Senior" pair.
//
// Anything else keeps its full name. A wrapped long name is honest; an invented
// acronym, or one shared by six different rooms, is not.

/** An acronym the name itself contains. Never a guess — this is the organiser's
 *  own text, lifted out of their own title. */
export function acronymInName(name: string): string | null {
  const t = (name ?? '').trim();
  if (!t) return null;
  // An all-uppercase title has no distinguishable acronym token inside it —
  // every word looks like one. ("SINGLE DELEGATE GENERAL ASSEMBLY: UNICEF")
  if (t === t.toUpperCase()) return null;

  // "… (DISEC)" / "… [SCOTUS]" — a trailing bracketed acronym.
  const paren = t.match(/[([]\s*([A-Z][A-Za-z0-9]{1,7})\s*[)\]]\s*$/);
  if (paren) return paren[1];

  // "… – UNSC" / "… - WHO" / "… — UN WOMEN" — a trailing acronym after a dash.
  const dash = t.match(/[—–-]\s*([A-Z][A-Za-z0-9 ]{1,10})$/);
  if (dash) {
    const tok = dash[1].trim();
    if (tok.length >= 2 && tok === tok.toUpperCase()) return tok;
  }

  // "ECOSOC (Economic and Social Council)" — a leading acronym then a gloss.
  // The lookahead requires whitespace or an opening bracket, so "CRISIS: The
  // Dancing Plague" (a category prefix, not an acronym) does not match.
  //
  // THREE CHARACTERS MINIMUM. Two-letter leads are qualifiers, not identities:
  // measured on production, the 2-char rule turned "UN Commission on the Status
  // of Women" into **UN** and "AD HOC: Council of the Gods" into **AD**, which
  // names nothing. Both now keep their full name instead.
  const lead = t.match(/^([A-Z][A-Z0-9]{2,7})(?=[\s(])/);
  if (lead) return lead[1];

  return null;
}

/** Is a preset's acronym clean enough to stand in for a committee's name? */
function presetAcronymCandidate(name: string): string | null {
  const label = matchPresetEmblemEntry(name, null)?.label ?? '';
  return /^[A-Z]{3,6}$/.test(label) ? label : null;
}

export interface CommitteeIdentity {
  /** The large label: an acronym when one can be trusted, else the full name. */
  title: string;
  /** The full name, when the title is not already it. */
  subtitle: string | null;
  /** Monogram for the logo fallback disc. */
  mono: string;
}

/** Resolve every committee's identity TOGETHER, because uniqueness within the
 *  conference is part of the rule. Returns a map keyed by `conf.id`. */
export function committeeIdentities(rows: LiveCommittee[]): Map<string, CommitteeIdentity> {
  // Pass 1: a candidate acronym per row, and how often each candidate occurs.
  const candidates = new Map<string, string | null>();
  const uses = new Map<string, number>();
  for (const r of rows) {
    const explicit = (r.conf.abbreviation ?? '').trim();
    const cand = explicit || acronymInName(r.conf.name) || presetAcronymCandidate(r.conf.name) || null;
    candidates.set(r.conf.id, cand);
    if (cand) uses.set(cand, (uses.get(cand) ?? 0) + 1);
  }

  // Pass 2: drop any acronym two committees in this conference would share.
  const out = new Map<string, CommitteeIdentity>();
  for (const r of rows) {
    const cand = candidates.get(r.conf.id) ?? null;
    const unique = cand && (uses.get(cand) ?? 0) === 1 ? cand : null;
    const title = committeeDisplayName(r.conf.name, unique) || r.conf.name;
    out.set(r.conf.id, {
      title,
      subtitle: title !== r.conf.name ? r.conf.name : null,
      mono: (unique ?? r.conf.name).slice(0, 3).toUpperCase(),
    });
  }
  return out;
}

/** Single-row form, for a modal that has one committee and no conference list
 *  to check uniqueness against. Uniqueness cannot be tested here, so the preset
 *  fallback is deliberately NOT used — only sources that cannot be wrong. */
export function committeeIdentity(conf: LiveCommittee['conf']): CommitteeIdentity {
  const explicit = (conf.abbreviation ?? '').trim();
  const acr = explicit || acronymInName(conf.name) || null;
  const title = committeeDisplayName(conf.name, acr) || conf.name;
  return {
    title,
    subtitle: title !== conf.name ? conf.name : null,
    mono: (acr ?? conf.name).slice(0, 3).toUpperCase(),
  };
}
