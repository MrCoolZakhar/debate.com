/**
 * Who holds a veto, in one place (18 Sep 2026). The voting page's verdict (`evaluate`), its
 * ballot-card veto indicator and veto double check, and the delegate phone's device ballot
 * all ask the same question, so they cannot disagree about who can veto.
 *
 *   `custom` → the chair-picked `vetoCountries`
 *   `p5`     → `p5Delegations`, falling back to the shipped P5 default
 *   anything else (none, unanimous) → nobody. Unanimous mode fails a paper on any
 *   non-For vote, but that is the unanimity rule, not a veto, and it gets no veto UI.
 *
 * Matching is by country identity (`isVetoDelegation`, src/lib/vetoMatch.ts), never raw
 * string equality, so "Russian Federation" on the roster matches "Russia" in the list.
 */

import { DEFAULT_SETTINGS, impliedSettings, type CommitteeSettings } from '@/lib/settingsStore';
import { isVetoDelegation } from '@/lib/vetoMatch';
import type { VoteChoice } from '@/lib/voteState';

type VetoRules = Pick<CommitteeSettings, 'vetoMode' | 'vetoCountries' | 'p5Delegations'>;

/** The veto seats in force under a given rule set. */
export function vetoListFor(s: VetoRules): string[] {
  if (s.vetoMode === 'custom') return s.vetoCountries ?? [];
  if (s.vetoMode === 'p5') return s.p5Delegations?.length ? s.p5Delegations : DEFAULT_SETTINGS.p5Delegations;
  return [];
}

/** True when this delegation can veto under these rules. */
export function holdsVeto(s: VetoRules, country: string): boolean {
  if (s.vetoMode !== 'p5' && s.vetoMode !== 'custom') return false;
  const list = vetoListFor(s);
  return list.length > 0 && isVetoDelegation(list, country);
}

/** An Against (with or without rights) from a veto holder is a veto. */
export function isVetoChoice(choice: VoteChoice | null | undefined): boolean {
  return choice === 'against' || choice === 'against-rights';
}

/**
 * The veto rules of a committee read from its ROW, for surfaces that never hydrate the
 * settings store (the delegate page, AGENTS.md rule 14). Mirrors the voting page: stored
 * settings over the defaults, plus what the committee's identity implies (a Security Council
 * starts with the P5 veto when the chair never chose).
 */
export function vetoRulesFromRow(name: string | null | undefined, dbSettings: Record<string, unknown> | null | undefined): VetoRules {
  const stored = (dbSettings ?? {}) as Partial<CommitteeSettings>;
  const implied = impliedSettings(name, dbSettings ?? {});
  return {
    vetoMode: implied.vetoMode ?? stored.vetoMode ?? DEFAULT_SETTINGS.vetoMode,
    vetoCountries: Array.isArray(stored.vetoCountries) ? stored.vetoCountries : DEFAULT_SETTINGS.vetoCountries,
    p5Delegations: Array.isArray(stored.p5Delegations) ? stored.p5Delegations : DEFAULT_SETTINGS.p5Delegations,
  };
}
