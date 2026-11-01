// Gavelling Crisis: crisis points, to help chairs and the CD judge awards.
// Points follow the PERSON (owner, 1 Nov 2026): every directive belongs to the delegate who wrote it, whichever character
// they were playing, so a person's total adds up everything they wrote and every meeting they took part in, across every
// character they played, with no cap (writing a lot rewards a lot). `personPoints` is the headline everywhere;
// `characterPoints` stays for the per-character view (what one character earned). Read by the character profile
// (backroom, Command) and later by awards. Every value can be changed in Settings (settings.points); the defaults
// below are a starting point, not a rule.
// Outcomes reward a good plan (approved > partly > denied); sending is worth a little so quiet
// delegates are visible; meetings held and cabinet directives count because they move the committee.

import { getCrisisClient } from './client';
import { isChairSendBack } from './format';
import type { CrisisRef } from './api';
import type { Directive, Meeting } from './types';

export interface PointsConfig {
  directiveSent: number;     // every personal or joint directive sent
  approved: number;          // extra when the backroom approves it
  partial: number;           // extra when it partly works
  denied: number;            // extra when denied (0 or negative)
  cabinetDirective: number;  // extra for a cabinet directive
  jointDirective: number;    // extra for each co-author of a joint directive
  meetingHeld: number;       // each meeting the character took part in that was held
  manual: number;            // reserved for staff adjustments (not counted yet)
}

export const DEFAULT_POINTS: PointsConfig = {
  directiveSent: 1, approved: 3, partial: 2, denied: 0, cabinetDirective: 2, jointDirective: 1, meetingHeld: 2, manual: 0,
};

export function readPoints(settings: Record<string, unknown> | null | undefined): PointsConfig {
  const p = (settings && typeof settings === 'object' ? (settings as { points?: Partial<PointsConfig> }).points : undefined) ?? {};
  return { ...DEFAULT_POINTS, ...p };
}

export interface PointsLine { label: string; count: number; each: number; total: number }
export interface PointsResult { total: number; lines: PointsLine[] }

/** The columns of a directive the points read (so Statistics can pass its light rows). */
export type PointsDirective = Pick<Directive, 'id' | 'kind' | 'status' | 'outcome' | 'author_character_id'> & {
  /** The delegate who wrote it. Needed for a person's total; a row without it counts for its character only. */
  author_member_id?: string | null;
};

/** Points of one character from the directives they wrote (or co-wrote) and the meetings they held. */
export function characterPoints(
  characterId: string,
  directives: PointsDirective[],
  meetings: Meeting[],
  config: PointsConfig,
  coauthored: Set<string> = new Set(), // ids of joint directives this character co-wrote
): PointsResult {
  // A directive the chair turned back never reached the backroom: it earns nothing and is never a denial.
  const mine = directives.filter((d) => d.author_character_id === characterId && d.status !== 'withdrawn' && !isChairSendBack(d));
  const sent = mine.length;
  const approved = mine.filter((d) => d.outcome === 'approved').length;
  const partial = mine.filter((d) => d.outcome === 'partial').length;
  const denied = mine.filter((d) => d.outcome === 'denied').length;
  const cabinet = mine.filter((d) => d.kind === 'committee').length;
  const joint = directives.filter((d) => coauthored.has(d.id)).length;
  const held = meetings.filter((m) => m.status === 'held' && m.character_ids.includes(characterId)).length;
  return linesOf({ sent, approved, partial, denied, cabinet, joint, held }, config);
}

// ─────────── Points follow the person ───────────

/**
 * The few columns Statistics and the points need for EVERY directive of the crisis (no cap, nothing long), with the
 * author's member id. Same rows as loadDirectiveStatRows (api.ts) plus `author_member_id`.
 */
export type PointsRow = Pick<Directive, 'id' | 'kind' | 'status' | 'outcome' | 'author_character_id' | 'author_member_id' | 'answered_by' | 'answered_at' | 'created_at'>;
export async function loadDirectiveStatRowsWithAuthors(ref: CrisisRef): Promise<PointsRow[]> {
  const client = await getCrisisClient(ref.conf, ref.crisis);
  const out: PointsRow[] = [];
  for (let from = 0; ; from += 1000) {
    const res = await client.from('crisis_directives')
      .select('id, kind, status, outcome, author_character_id, author_member_id, answered_by, answered_at, created_at')
      .eq('crisis_id', ref.id).order('no', { ascending: false }).range(from, from + 999);
    if (res.error) throw res.error;
    const rows = (res.data ?? []) as PointsRow[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

/** Joint directive co-authors, as character id to the ids of the directives that character signed. */
export function coauthorsByCharacter(rows: Array<{ directive_id: string; character_id: string }>): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = m.get(r.character_id) ?? new Set<string>();
    set.add(r.directive_id);
    m.set(r.character_id, set);
  }
  return m;
}

const counts = (d: PointsDirective) => d.status !== 'withdrawn' && !isChairSendBack(d);

/**
 * Every character this person has played: the ones they wrote a directive as, plus the one they play now.
 * (Characters they held without writing anything are not known to the database's history, so they add nothing.)
 */
export function personCharacterIds(memberId: string, directives: PointsDirective[], currentCharacterId: string | null): Set<string> {
  const ids = new Set<string>();
  if (currentCharacterId) ids.add(currentCharacterId);
  for (const d of directives) if (d.author_member_id === memberId && d.author_character_id) ids.add(d.author_character_id);
  return ids;
}

/**
 * The points of one PERSON: the directives they wrote (as any character), the joint directives they co-signed (as any
 * character) and the meetings they took part in. No cap. `coauthored` is coauthorsByCharacter(...) of the whole crisis.
 */
export function personPoints(
  memberId: string,
  directives: PointsDirective[],
  meetings: Meeting[],
  config: PointsConfig,
  coauthored: Map<string, Set<string>>,
  characterIds: Set<string>,
): PointsResult {
  const mine = directives.filter((d) => d.author_member_id === memberId && counts(d));
  const sent = mine.length;
  const approved = mine.filter((d) => d.outcome === 'approved').length;
  const partial = mine.filter((d) => d.outcome === 'partial').length;
  const denied = mine.filter((d) => d.outcome === 'denied').length;
  const cabinet = mine.filter((d) => d.kind === 'committee').length;
  const signed = new Set<string>();
  for (const id of characterIds) for (const dId of coauthored.get(id) ?? []) signed.add(dId);
  const joint = directives.filter((d) => signed.has(d.id) && d.author_member_id !== memberId && counts(d)).length;
  const held = meetings.filter((m) => m.status === 'held' && (m.requested_by_member === memberId || m.character_ids.some((c) => characterIds.has(c)))).length;
  return linesOf({ sent, approved, partial, denied, cabinet, joint, held }, config);
}

function linesOf(n: { sent: number; approved: number; partial: number; denied: number; cabinet: number; joint: number; held: number }, config: PointsConfig): PointsResult {
  const lines: PointsLine[] = [
    { label: 'Directives sent', count: n.sent, each: config.directiveSent, total: n.sent * config.directiveSent },
    { label: 'Approved', count: n.approved, each: config.approved, total: n.approved * config.approved },
    { label: 'Partly worked', count: n.partial, each: config.partial, total: n.partial * config.partial },
    { label: 'Denied', count: n.denied, each: config.denied, total: n.denied * config.denied },
    { label: 'Cabinet directives', count: n.cabinet, each: config.cabinetDirective, total: n.cabinet * config.cabinetDirective },
    { label: 'Joint directives co-written', count: n.joint, each: config.jointDirective, total: n.joint * config.jointDirective },
    { label: 'Meetings held', count: n.held, each: config.meetingHeld, total: n.held * config.meetingHeld },
  ];
  return { total: lines.reduce((s, l) => s + l.total, 0), lines };
}
