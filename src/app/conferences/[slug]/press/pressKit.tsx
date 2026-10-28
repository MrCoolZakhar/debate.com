'use client';

// The Press Desk's small shared pieces: the polling hook, room state in words, motion
// labels, and the round flag + name of a seat. Read only; nothing here writes.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Clock, Flag, PauseCircle, ListChecks, ListOrdered, Users, Coffee, Vote, MessagesSquare, Moon,
  type LucideIcon,
} from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import SeatName from '@/components/SeatName';
import { OUTFIT } from '@/components/neu';
import { refreshSessionNow } from '@/lib/supabase-auth';
import { fetchPressDesk, fetchReleasesBoard, type PressDesk, type PressMotion, type PressRoomSession, type PressSeat, type ReleasesBoard } from '@/lib/press';

export const INK = '#1C1410';
export const INK_SOFT = '#5A5046';
export const FOREST = 'var(--gv-main)';
export const SLATE = '#2F6076';
export const CARD_SHADOW = '0 1px 2px color-mix(in srgb, var(--gv-main) 6%, transparent), 0 8px 24px color-mix(in srgb, var(--gv-main) 8%, transparent)';

export const POLL_MS = 10_000;

export type DeskState =
  | { kind: 'loading' }
  | { kind: 'ok'; desk: PressDesk }
  | { kind: 'missing' }
  | { kind: 'denied'; message: string }
  | { kind: 'error' };

/**
 * The desk, re-read every 10 s while the tab is visible (the organiser live wall's pattern):
 * paused while hidden, and on return the session is refreshed first, then read at once.
 * A failed re-read keeps what was on screen.
 */
export function usePressDesk(conferenceId: string | null): {
  state: DeskState;
  reload: () => void;
  patchDesk: (patch: Partial<PressDesk>) => void;
} {
  const [state, setState] = useState<DeskState>({ kind: 'loading' });
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!conferenceId || inFlight.current) return;
    inFlight.current = true;
    try {
      const r = await fetchPressDesk(conferenceId);
      setState((prev) => {
        if (r.kind === 'ok') return { kind: 'ok', desk: r.value };
        // Keep the rooms already shown when a re-read fails.
        if (r.kind === 'error' && prev.kind === 'ok') return prev;
        if (r.kind === 'denied') return { kind: 'denied', message: r.message };
        return r.kind === 'missing' ? { kind: 'missing' } : { kind: 'error' };
      });
    } finally {
      inFlight.current = false;
    }
  }, [conferenceId]);

  useEffect(() => {
    if (!conferenceId) return;
    let alive = true;
    const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
    const tick = () => { if (visible()) void load(); };
    tick();
    const poll = setInterval(tick, POLL_MS);
    const onVis = () => {
      if (!visible()) return;
      void refreshSessionNow().then(() => { if (alive) tick(); });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearInterval(poll); document.removeEventListener('visibilitychange', onVis); };
  }, [conferenceId, load]);

  const patchDesk = useCallback((patch: Partial<PressDesk>) => {
    setState((prev) => (prev.kind === 'ok' ? { kind: 'ok', desk: { ...prev.desk, ...patch } } : prev));
  }, []);

  return { state, reload: () => { void load(); }, patchDesk };
}

/**
 * The sent releases and the approval queue (press_releases_board), read on mount, after
 * every send or review (`reload`), and every 20 s while the tab is visible so a press chair
 * sees a new release waiting. Null until read, and while the SQL is not applied (`missing`)
 * or the read fails: the panels then draw nothing.
 */
export function useReleasesBoard(conferenceId: string | null, enabled: boolean): {
  board: ReleasesBoard | null;
  reload: () => void;
  patch: (p: Partial<ReleasesBoard>) => void;
} {
  const [board, setBoard] = useState<ReleasesBoard | null>(null);
  const inFlight = useRef(false);
  const load = useCallback(async () => {
    if (!conferenceId || !enabled || inFlight.current) return;
    inFlight.current = true;
    try {
      const r = await fetchReleasesBoard(conferenceId);
      if (r.kind === 'ok') setBoard(r.value);
      else if (r.kind !== 'error') setBoard(null);
    } finally {
      inFlight.current = false;
    }
  }, [conferenceId, enabled]);
  useEffect(() => {
    if (!conferenceId || !enabled) return;
    const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
    const tick = () => { if (visible()) void load(); };
    tick();
    const poll = setInterval(tick, 20_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(poll); document.removeEventListener('visibilitychange', tick); };
  }, [conferenceId, enabled, load]);
  const patch = useCallback((p: Partial<ReleasesBoard>) => setBoard((b) => (b ? { ...b, ...p } : b)), []);
  return { board, reload: () => { void load(); }, patch };
}

// ── What the room is doing, in words ────────────────────────────────────────

export interface RoomMode {
  icon: LucideIcon;
  word: string;
  /** A caucus's topic / name, when it has one. */
  detail: string | null;
  live: boolean;
  color: string;
}

export function roomMode(s: PressRoomSession | null): RoomMode {
  if (!s) return { icon: Clock, word: 'Not started', detail: null, live: false, color: INK_SOFT };
  if (s.ended) return { icon: Flag, word: 'Ended', detail: null, live: false, color: INK_SOFT };
  if (s.suspended) return { icon: PauseCircle, word: 'Suspended', detail: null, live: false, color: '#8A3B12' };
  const c = s.caucus;
  switch (s.phase) {
    case 'pre-session':
    case 'roll-call':
      return { icon: ListChecks, word: 'Roll call', detail: null, live: true, color: FOREST };
    case 'speakers-list':
      return { icon: ListOrdered, word: "General Speakers' List", detail: null, live: true, color: FOREST };
    case 'moderated-caucus': {
      const tour = !!c?.purpose && /^Tour de Table/i.test(c.purpose);
      return {
        icon: tour ? MessagesSquare : Users,
        word: tour ? 'Tour de Table' : (c?.motionLabel || 'Moderated caucus'),
        detail: tour ? null : c?.purpose ?? null,
        live: true, color: FOREST,
      };
    }
    case 'unmoderated-caucus':
      return c?.isConsultation
        ? { icon: MessagesSquare, word: c.motionLabel || 'Consultation of the Whole', detail: c.purpose, live: true, color: FOREST }
        : { icon: Coffee, word: 'Unmoderated caucus', detail: c?.purpose ?? null, live: true, color: FOREST };
    case 'voting':
      return { icon: Vote, word: 'Voting', detail: null, live: true, color: '#7A5812' };
    case 'adjourned':
      return { icon: Moon, word: 'Adjourned', detail: null, live: false, color: INK_SOFT };
    default:
      return { icon: Clock, word: 'In session', detail: null, live: true, color: FOREST };
  }
}

// ── Motions ─────────────────────────────────────────────────────────────────

const MOTION_LABEL: Record<string, string> = {
  moderated: 'Moderated caucus',
  unmoderated: 'Unmoderated caucus',
  consultation: 'Consultation of the Whole',
  tour: 'Tour de Table',
  'suspend-debate': 'Suspend debate',
  'end-debate': 'End debate',
  custom: 'Motion',
};

export function motionLabel(m: PressMotion): string {
  if (m.type === 'custom') return m.topic || MOTION_LABEL.custom;
  return MOTION_LABEL[m.type] ?? 'Motion';
}

export function clock(secs: number | null): string | null {
  if (secs == null || secs <= 0) return null;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function motionTimes(m: PressMotion): string | null {
  const total = clock(m.totalTime);
  const each = clock(m.speakingTime);
  if (m.type === 'tour') {
    const order = m.tourOrder === 'desc' ? 'Z to A' : m.tourOrder === 'custom' ? 'Room order' : 'A to Z';
    return [each ? `${each} each` : null, order].filter(Boolean).join(' · ') || null;
  }
  return [total, each ? `${each} each` : null].filter(Boolean).join(' · ') || null;
}

// ── A seat: round flag (crest, flag, initials) and its name, never cut ──────

export function SeatLine({ seat, size = 28, nameSize = 15, weight = 700 }: {
  seat: PressSeat; size?: number; nameSize?: number; weight?: number;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <CircleFlag country={seat.country} logoUrl={seat.logoUrl} size={size} label={seat.country} decorative />
      <SeatName
        name={seat.country}
        style={{ fontFamily: OUTFIT, fontSize: nameSize, fontWeight: weight, color: INK, lineHeight: 1.25 }}
        subStyle={{ fontWeight: 500, color: INK_SOFT }}
      />
    </span>
  );
}
