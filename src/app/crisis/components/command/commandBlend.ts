'use client';
// Gavelling Crisis: every delegate's blended performance for the Statistics pop-up. One load of the committee rooms (the regular
// session scoring of each character's seat), the meetings and the joint-directive co-authors, then the same arithmetic as the
// character's Performance tab (src/lib/crisis/performance.ts + points.ts), so the two always show the same total.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listMeetings, type CrisisRef } from '@/lib/crisis/api';
import { getCrisisClient } from '@/lib/crisis/client';
import { blendPerformance, loadRoomBoards, roomSlices, seatOf, type Blend, type RoomBoard } from '@/lib/crisis/performance';
import { characterPoints, readPoints } from '@/lib/crisis/points';
import type { Cabinet, Character, Directive, Meeting } from '@/lib/crisis/types';

export interface DelegateBlend extends Blend {
  /** False when no committee-room seat carries this character's name (the room part is then zero). */
  hasSeat: boolean;
}

export type BlendState = { status: 'loading' } | { status: 'ready'; roomsRead: boolean; byCharacter: Map<string, DelegateBlend> };

const REFRESH_MS = 30_000;

export function useDelegateBlends(
  ref: CrisisRef,
  cabinets: Cabinet[],
  characters: Character[],
  directives: Directive[] | null,
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
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current || document.visibilityState !== 'visible') return;
    inFlight.current = true;
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
        const m = new Map<string, Set<string>>();
        for (const r of (coRows.value.data ?? []) as Array<{ directive_id: string; character_id: string }>) {
          const set = m.get(r.character_id) ?? new Set<string>();
          set.add(r.directive_id);
          m.set(r.character_id, set);
        }
        setCo(m);
      } else setCo((p) => p ?? new Map());
    } catch {
      setBoards((p) => p ?? { read: false, list: [] });
      setMeetings((p) => p ?? []);
      setCo((p) => p ?? new Map());
    } finally { inFlight.current = false; }
  }, [ref]);

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
    const byCharacter = new Map<string, DelegateBlend>();
    for (const c of characters) {
      const out = characterPoints(c.id, directives, meetings, config, co.get(c.id) ?? new Set());
      const seat = seatOf(boards.list, c);
      const b = blendPerformance(seat ? roomSlices(seat.board, seat.row) : null, out);
      byCharacter.set(c.id, { ...b, hasSeat: !!seat });
    }
    return { status: 'ready', roomsRead: boards.read, byCharacter };
  }, [boards, meetings, co, directives, characters, settings]);
}
