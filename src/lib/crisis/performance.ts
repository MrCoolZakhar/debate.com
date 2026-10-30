// Gavelling Crisis: ONE performance total per character (owner, 30 Oct 2026).
//
//   IN THE ROOM       what the regular session scoring gives the character's seat in the front-room committee: speeches, speaking
//                     time, motions, documents, attendance (buildSessionScoreboardRows / sessionPointSlices, which sum to the
//                     seat's objective points and follow the room's own scoring settings).
//   OUT OF THE ROOM   what the crisis gives for directives and meetings (characterPoints, src/lib/crisis/points.ts). The values
//                     are in ONE place, DEFAULT_POINTS there, and the Crisis Director changes them in Settings > Points:
//                       1 point for each directive sent, +3 when approved, +2 when it partly works, +0 when denied,
//                       +2 for a cabinet directive, +1 for each co-author of a joint directive, +2 for each meeting held.
//
// The total is the two added together. Statistics ranks delegates on it and shows the split.

import { getCommitteeByCode } from '@/lib/committeeService';
import { everPresentFromHistory } from '@/lib/scoring';
import { readStatusHistory } from '@/lib/attendanceHistory';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { buildSessionScoreboardRows, sessionPointSlices, type PointSlice } from '@/lib/sessionScoreboard';
import type { ScoreboardDelegateRow } from '@/lib/conferenceScoreboard';
import type { Committee } from '@/lib/types';
import type { CrisisRef } from './api';
import { getCrisisClient } from './client';
import type { PointsConfig, PointsLine, PointsResult } from './points';
import type { Cabinet, Character } from './types';

// ─────────── The committee-room seat of a character ───────────

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();

/** The seat named like the character: an exact match first, then one name inside the other when only one seat fits. */
export function findSeat(committee: Committee, name: string): string | null {
  const me = norm(name);
  if (!me) return null;
  const seats = committee.delegates.map((d) => d.country);
  const exact = seats.find((s) => norm(s) === me);
  if (exact) return exact;
  const loose = seats.filter((s) => { const n = norm(s); return n.length >= 4 && (n.includes(me) || me.includes(n)); });
  return loose.length === 1 ? loose[0] : null;
}

/** A cabinet's committee room with its scoreboard rows (the regular session scoring, roll-call history included). */
export interface RoomBoard { cabinetId: string; committee: Committee; rows: ScoreboardDelegateRow[]; everPresent: Set<string> | null }

/** Reads every cabinet's committee room. A room that cannot be read is left out; throws only when none could be. */
export async function loadRoomBoards(ref: CrisisRef, cabinets: Cabinet[]): Promise<RoomBoard[]> {
  const linked = cabinets.filter((c) => c.conference_committee_id);
  if (!linked.length) return [];
  const client = await getCrisisClient(ref.conf, ref.crisis);
  const r = await client.from('conference_committees').select('id, session_code').in('id', linked.map((c) => c.conference_committee_id as string));
  if (r.error) throw new Error('rooms');
  const codeOf = new Map(((r.data ?? []) as Array<{ id: string; session_code: string | null }>).map((x) => [x.id, x.session_code]));
  const out: RoomBoard[] = [];
  let read = 0;
  for (const cab of linked) {
    const code = codeOf.get(cab.conference_committee_id as string);
    if (!code) continue;
    const committee = await getCommitteeByCode(code);
    if (!committee) continue;
    read += 1;
    const history = await readStatusHistory(await getFreshAuthedClient(), committee.id).catch(() => null);
    const everPresent = everPresentFromHistory(history);
    out.push({ cabinetId: cab.id, committee, everPresent, rows: buildSessionScoreboardRows(committee, [], 'en', { everPresent }) });
  }
  if (read === 0) throw new Error('read');
  return out;
}

/** The character's seat row: the character's own cabinet room first, then the other rooms. */
export function seatOf(boards: RoomBoard[], char: Pick<Character, 'name' | 'cabinet_id'>): { board: RoomBoard; row: ScoreboardDelegateRow } | null {
  const ordered = [...boards.filter((b) => b.cabinetId === char.cabinet_id), ...boards.filter((b) => b.cabinetId !== char.cabinet_id)];
  for (const board of ordered) {
    const seat = findSeat(board.committee, char.name);
    const row = seat ? board.rows.find((x) => x.country === seat) : undefined;
    if (row) return { board, row };
  }
  return null;
}

// ─────────── The blend ───────────

export interface BlendLine { id: string; label: string; pts: number; count?: number; each?: number }
export interface Blend {
  room: number;
  out: number;
  total: number;
  roomLines: BlendLine[];
  outLines: BlendLine[];
}

/** In-room slices (null while the room is unread or has no seat) plus the crisis points, as one total with one breakdown. */
export function blendPerformance(roomSlices: PointSlice[] | null, out: PointsResult): Blend {
  const roomLines: BlendLine[] = (roomSlices ?? []).map((s) => ({ id: s.sourceId, label: s.label, pts: s.pts }));
  const outLines: BlendLine[] = out.lines
    .filter((l: PointsLine) => l.count > 0)
    .map((l) => ({ id: l.label, label: l.label, pts: l.total, count: l.count, each: l.each }));
  const room = roomLines.reduce((s, l) => s + l.pts, 0);
  const outPts = out.total;
  return { room, out: outPts, total: room + outPts, roomLines, outLines };
}

/** The in-room slices of one seat row, exactly as the regular session breaks its points down. */
export function roomSlices(board: RoomBoard, row: ScoreboardDelegateRow): PointSlice[] {
  return sessionPointSlices(board.committee, row.ledger, 'en', 'Manual points');
}

/** Points to read: whole numbers plain, anything else to one decimal. */
export function fmtPts(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

const pts = (n: number) => `${n} ${Math.abs(n) === 1 ? 'point' : 'points'}`;

/** The out-of-the-room rules in plain words, from the Crisis Director's own values (Settings > Points). */
export function pointsRules(c: PointsConfig): string {
  return `Out of the room: ${pts(c.directiveSent)} for each directive sent, plus ${c.approved} when it is approved, ${c.partial} when it partly works and ${c.denied} when it is denied. `
    + `A cabinet directive earns ${c.cabinetDirective} more, each co-author of a joint directive ${c.jointDirective}, and each meeting held ${c.meetingHeld}. `
    + 'In the room: the committee room\'s own scoring for speeches, speaking time, motions and documents.';
}
