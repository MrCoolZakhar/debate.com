// Gavelling Crisis: crisis points per character, to help chairs and the CD judge awards.
// Read by the character profile (backroom, Command) and later by awards. Every value can be changed
// in Settings (settings.points); the defaults below are a starting point, not a rule.
// Outcomes reward a good plan (approved > partly > denied); sending is worth a little so quiet
// delegates are visible; meetings held and cabinet directives count because they move the committee.

import { isChairSendBack } from './format';
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

/** Points of one character from the directives they wrote (or co-wrote) and the meetings they held. */
export function characterPoints(
  characterId: string,
  directives: Directive[],
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
  const lines: PointsLine[] = [
    { label: 'Directives sent', count: sent, each: config.directiveSent, total: sent * config.directiveSent },
    { label: 'Approved', count: approved, each: config.approved, total: approved * config.approved },
    { label: 'Partly worked', count: partial, each: config.partial, total: partial * config.partial },
    { label: 'Denied', count: denied, each: config.denied, total: denied * config.denied },
    { label: 'Cabinet directives', count: cabinet, each: config.cabinetDirective, total: cabinet * config.cabinetDirective },
    { label: 'Joint directives co-written', count: joint, each: config.jointDirective, total: joint * config.jointDirective },
    { label: 'Meetings held', count: held, each: config.meetingHeld, total: held * config.meetingHeld },
  ];
  return { total: lines.reduce((s, l) => s + l.total, 0), lines };
}
