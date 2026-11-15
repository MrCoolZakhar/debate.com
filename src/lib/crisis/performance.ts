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
//
// Points follow the PERSON, not the cabinet or the character (owner, 15 Nov 2026): a person's room points are every seat
// of every character they played, in EVERY committee room (a character moved to another cabinet keeps the points it earned
// in the old room), counted only for the time they played that character (crisis_character_players, loadPlayWindows).

import { getCommitteeByCode } from '@/lib/committeeService';
import { everPresentFromHistory } from '@/lib/scoring';
import { readStatusHistory } from '@/lib/attendanceHistory';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { buildSessionScoreboardRows, sessionPointSlices, type PointSlice } from '@/lib/sessionScoreboard';
import type { ScoreboardDelegateRow } from '@/lib/conferenceScoreboard';
import type { Committee } from '@/lib/types';
import type { CrisisRef } from './api';
import { getCrisisClient } from './client';
import type { PlayedCheck, PointsConfig, PointsLine, PointsResult } from './points';
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

/** Every seat named like the character, in every committee room (a moved character has one in the old room and the new). */
export function seatsOf(boards: RoomBoard[], char: Pick<Character, 'name' | 'cabinet_id'>): Array<{ board: RoomBoard; row: ScoreboardDelegateRow }> {
  const ordered = [...boards.filter((b) => b.cabinetId === char.cabinet_id), ...boards.filter((b) => b.cabinetId !== char.cabinet_id)];
  const out: Array<{ board: RoomBoard; row: ScoreboardDelegateRow }> = [];
  for (const board of ordered) {
    const seat = findSeat(board.committee, char.name);
    const row = seat ? board.rows.find((x) => x.country === seat) : undefined;
    if (row) out.push({ board, row });
  }
  return out;
}

// ─────────── Who played which character, when ───────────

/** One stretch of a person playing a character: from `from` to `to` (null while they still play it), epoch ms. */
export interface PlayWindow { characterId: string; memberId: string; from: number; to: number | null }

/** The crisis's play history (crisis_character_players). Null when it cannot be read: points then count as before. */
export async function loadPlayWindows(ref: CrisisRef): Promise<PlayWindow[] | null> {
  try {
    const client = await getCrisisClient(ref.conf, ref.crisis);
    const r = await client.from('crisis_character_players').select('character_id, member_id, started_at, ended_at').eq('crisis_id', ref.id);
    if (r.error) return null;
    return ((r.data ?? []) as Array<{ character_id: string; member_id: string; started_at: string; ended_at: string | null }>).map((w) => ({
      characterId: w.character_id, memberId: w.member_id, from: Date.parse(w.started_at), to: w.ended_at ? Date.parse(w.ended_at) : null,
    }));
  } catch { return null; }
}

/**
 * Whether this person played this character at this moment. No history known (or none for this person): yes, as before.
 * A moment-less row (the attendance credit) counts when they played the character at all.
 */
export function playedBy(windows: PlayWindow[] | null, memberId: string, characterId: string, at: string | null | undefined): boolean {
  if (!windows) return true;
  const mine = windows.filter((w) => w.memberId === memberId);
  if (!mine.length) return true;
  const own = mine.filter((w) => w.characterId === characterId);
  if (!own.length) return false;
  if (!at) return true;
  const t = Date.parse(at);
  if (Number.isNaN(t)) return true;
  return own.some((w) => t >= w.from && (w.to === null || t <= w.to));
}

/** The check personPoints takes for one person. */
export function playedCheck(windows: PlayWindow[] | null, memberId: string): PlayedCheck {
  return (characterId, at) => playedBy(windows, memberId, characterId, at);
}

/** Slices from several seats as one list: the same source adds up. */
export function mergeSlices(list: PointSlice[]): PointSlice[] {
  const by = new Map<string, PointSlice>();
  for (const s of list) {
    const cur = by.get(s.sourceId);
    by.set(s.sourceId, cur ? { ...cur, pts: cur.pts + s.pts } : { ...s });
  }
  return [...by.values()].sort((a, b) => b.pts - a.pts);
}

/**
 * The committee-room points of a person (memberId) over the characters they played, or of the characters themselves
 * (memberId null: a character nobody plays shows everything its seats earned). Every seat in every room, each once; a
 * person's seats count only the ledger rows from while they played that character.
 */
export function personRoomSlices(boards: RoomBoard[], chars: Array<Pick<Character, 'id' | 'name' | 'cabinet_id'>>, memberId: string | null, windows: PlayWindow[] | null): { slices: PointSlice[]; seats: number } {
  const slices: PointSlice[] = [];
  const seen = new Set<string>();
  for (const c of chars) {
    for (const seat of seatsOf(boards, c)) {
      const k = `${seat.board.committee.id}:${seat.row.country}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const ledger = memberId ? seat.row.ledger.filter((r) => playedBy(windows, memberId, c.id, r.timestamp || null)) : seat.row.ledger;
      slices.push(...sessionPointSlices(seat.board.committee, ledger, 'en', 'Manual points'));
    }
  }
  return { slices: mergeSlices(slices), seats: seen.size };
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
