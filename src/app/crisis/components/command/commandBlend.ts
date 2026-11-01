'use client';
// Gavelling Crisis: every delegate's blended performance for the Statistics pop-up. One load of the committee rooms (the regular
// session scoring of each character's seat), the meetings and the joint-directive co-authors, then the same arithmetic as the
// character's Performance tab (src/lib/crisis/performance.ts + points.ts), so the two always show the same total.
// Points follow the PERSON (owner, 1 Nov 2026): one total per delegate, adding up every character they played (their
// directives, meetings and the seats those characters held in the committee rooms), no cap.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listMeetings, type CrisisRef } from '@/lib/crisis/api';
import { getCrisisClient } from '@/lib/crisis/client';
import { useSingleFlight } from '@/lib/crisis/live';
import { blendPerformance, loadRoomBoards, roomSlices, seatOf, type Blend, type RoomBoard } from '@/lib/crisis/performance';
import { coauthorsByCharacter, personCharacterIds, personPoints, readPoints, type PointsDirective } from '@/lib/crisis/points';
import type { PointSlice } from '@/lib/sessionScoreboard';
import type { Cabinet, Character, Meeting, Member } from '@/lib/crisis/types';

export interface DelegateBlend extends Blend {
  /** False when no committee-room seat carries the name of any character this person played (the room part is then zero). */
  hasSeat: boolean;
  /** Every character this person has played: the one they play now first, then the ones they wrote directives as. */
  characterIds: string[];
}

export type BlendState = { status: 'loading' } | { status: 'ready'; roomsRead: boolean; byMember: Map<string, DelegateBlend> };

/** Slices from several seats as one list: the same source adds up. */
export function mergeSlices(list: PointSlice[]): PointSlice[] {
  const by = new Map<string, PointSlice>();
  for (const s of list) {
    const cur = by.get(s.sourceId);
    by.set(s.sourceId, cur ? { ...cur, pts: cur.pts + s.pts } : { ...s });
  }
  return [...by.values()].sort((a, b) => b.pts - a.pts);
}

const REFRESH_MS = 30_000;

export function useDelegateBlends(
  ref: CrisisRef,
  cabinets: Cabinet[],
  characters: Character[],
  /** The delegates: points are added up per person. */
  members: Member[],
  /** Every directive of the crisis, light columns with the author (loadDirectiveStatRowsWithAuthors): the points never depend on how many are on screen. */
  directives: PointsDirective[] | null,
  settings: Record<string, unknown>,
  /** Reads nothing until true (the pop-up's other view does not need the rooms). */
  enabled = true,
): BlendState {
  const [boards, setBoards] = useState<{ read: boolean; list: RoomBoard[] } | null>(null);
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [co, setCo] = useState<Map<string, Set<string>> | null>(null);
  const cabinetsRef = useRef(cabinets);
  useEffect(() => { cabinetsRef.current = cabinets; });
  const key = cabinets.map((c) => `${c.id}:${c.conference_committee_id ?? ''}`).join('|');
  // A read asked for while one runs is queued once, not dropped.
  const read = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const client = await getCrisisClient(ref.conf, ref.crisis);
      const [rooms, mtgs, coRows] = await Promise.allSettled([
        loadRoomBoards(ref, cabinetsRef.current),
        listMeetings(ref),
        client.from('crisis_directive_coauthors').select('directive_id, character_id'),
      ]);
      // A failed re-read keeps what is on screen; a first failed room read says so (rooms read: false).
      if (rooms.status === 'fulfilled') setBoards({ read: true, list: rooms.value });
      else setBoards((p) => p ?? { read: false, list: [] });
      if (mtgs.status === 'fulfilled') setMeetings(mtgs.value);
      else setMeetings((p) => p ?? []);
      if (coRows.status === 'fulfilled' && !coRows.value.error) {
        setCo(coauthorsByCharacter((coRows.value.data ?? []) as Array<{ directive_id: string; character_id: string }>));
      } else setCo((p) => p ?? new Map());
    } catch {
      setBoards((p) => p ?? { read: false, list: [] });
      setMeetings((p) => p ?? []);
      setCo((p) => p ?? new Map());
    }
  }, [ref]);
  const load = useSingleFlight(read);

  useEffect(() => {
    if (!enabled) return;
    const first = window.setTimeout(() => { void load(); }, 0);
    const poll = window.setInterval(() => { void load(); }, REFRESH_MS);
    const onVis = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.clearTimeout(first); window.clearInterval(poll); document.removeEventListener('visibilitychange', onVis); };
  }, [load, key, enabled]);

  return useMemo<BlendState>(() => {
    if (!boards || !meetings || !co || !directives) return { status: 'loading' };
    const config = readPoints(settings);
    const byId = new Map(characters.map((c) => [c.id, c]));
    const byMember = new Map<string, DelegateBlend>();
    for (const m of members) {
      if (m.role !== 'delegate') continue;
      const ids = personCharacterIds(m.id, directives, m.character_id);
      const out = personPoints(m.id, directives, meetings, config, co, ids);
      // The room part: the seat of every character this person played, each seat once.
      const slices: PointSlice[] = [];
      const seen = new Set<string>();
      for (const id of ids) {
        const c = byId.get(id);
        const seat = c ? seatOf(boards.list, c) : null;
        if (!seat) continue;
        const k = `${seat.board.cabinetId}:${seat.row.country}`;
        if (seen.has(k)) continue;
        seen.add(k);
        slices.push(...roomSlices(seat.board, seat.row));
      }
      const b = blendPerformance(seen.size ? mergeSlices(slices) : null, out);
      byMember.set(m.id, { ...b, hasSeat: seen.size > 0, characterIds: [...ids].sort((x, y) => (x === m.character_id ? -1 : y === m.character_id ? 1 : 0)) });
    }
    return { status: 'ready', roomsRead: boards.read, byMember };
  }, [boards, meetings, co, directives, characters, members, settings]);
}
