// ============================================================
// src/lib/advisorBoard/derive.ts
//
// Pure functions from a room's rows to what the advisor board says about one student
// (24 Sep 2026). No I/O, no React. Times are always on the DATABASE clock (`now` is
// `serverNow()` at the call site, RULE 6b); never Date.now() against a session stamp.
//
// Advisors never see points, rank, ratings, chair notes or nominations: everything here
// is an objective count or duration, with the room average for context.
// ============================================================

import { speakerRemainingNow, moderatedCaucusRemainingNow, caucusRemainingNow } from '../committeeService';
import type { CaucusState } from '../types';
import type { BoardLogEvent, RoomData, RoomDelegate, RoomQueueRow } from './types';

/** A reminder fires when a student is this many speakers away (and again when they speak). */
export const REMIND_AHEAD = 2;
/** "No speech in 90 minutes". */
export const QUIET_CUE_MS = 90 * 60 * 1000;

export type SeatKind = 'speaking' | 'next' | 'ahead' | 'in-room' | 'absent' | 'not-in-session';

export type RoomMode =
  | 'gsl' | 'moderated' | 'tour' | 'unmoderated' | 'consultation'
  | 'not-started' | 'roll-call' | 'voting' | 'break' | 'ended' | 'missing' | 'not-open' | 'loading';

/** A countdown the card ticks locally, evaluated with `clockSeconds(spec, now)`. */
export interface ClockSpec {
  /** The floor speaker's clock (current_speaker anchor), or null. */
  speaker: { timeRemaining: number; startedAt: string | null } | null;
  /** Seconds added after the speaker's clock (the slots of those queued ahead). */
  extra: number;
  /** A moderated caucus: the total caps the answer. */
  caucusCap: CaucusState | null;
  /** An unmoderated caucus / consultation: the total alone. */
  total: CaucusState | null;
}

export interface SeatState {
  kind: SeatKind;
  /** Speakers before this student (ahead / next). */
  ahead: number;
  mode: RoomMode;
  /** The caucus's own label (motion name given by the chair), when one runs. */
  caucusLabel: string | null;
  /** Speaking: time left. Next / ahead: estimated wait. Unmoderated room: time left. */
  clock: ClockSpec | null;
  /** The delegation is not on this room's roster at all. */
  notOnRoster: boolean;
  delegate: RoomDelegate | null;
  /** Stable key of the current turn, for reminders. */
  speakingKey: string | null;
  /** Stable key of the queue row, for the "2 speakers away" reminder. */
  queueKey: string | null;
}

const lc = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

export function sameSeat(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = lc(a);
  return !!x && x === lc(b);
}

export function findDelegate(room: RoomData, country: string, countryCode?: string | null): RoomDelegate | null {
  return room.delegates.find((d) => sameSeat(d.country, country))
    ?? (countryCode ? room.delegates.find((d) => sameSeat(d.country, countryCode)) : undefined)
    ?? null;
}

export function clockSeconds(spec: ClockSpec | null, now: number): number {
  if (!spec) return 0;
  if (spec.total) return caucusRemainingNow(spec.total, now);
  const sp = spec.speaker ? speakerRemainingNow(spec.speaker.timeRemaining, spec.speaker.startedAt, now) : 0;
  let s = sp + Math.max(0, spec.extra);
  if (spec.caucusCap) {
    const cap = moderatedCaucusRemainingNow(spec.caucusCap, spec.speaker?.timeRemaining ?? 0, spec.speaker?.startedAt ?? null, now);
    s = Math.min(s, Math.max(cap, sp));
  }
  return Math.max(0, Math.round(s));
}

/** Is the room debating right now (the only time presence and queues mean anything)? */
export function roomMode(room: RoomData | null, codeKnown = true, loading = false): RoomMode {
  if (!codeKnown) return 'not-open';
  if (!room) return loading ? 'loading' : 'missing';
  if (room.endedAt) return 'ended';
  if (room.suspendedAt || room.phase === 'adjourned') return 'break';
  if (room.phase === 'voting') return 'voting';
  if (room.phase === 'pre-session') {
    return room.delegates.some((d) => d.status !== 'absent') ? 'roll-call' : 'not-started';
  }
  if (room.phase === 'moderated-caucus') {
    const tour = (room.caucus?.purpose ?? '').startsWith('Tour de Table');
    return tour ? 'tour' : 'moderated';
  }
  if (room.phase === 'unmoderated-caucus') return room.caucus?.isConsultation ? 'consultation' : 'unmoderated';
  if (room.phase === 'speakers-list') return 'gsl';
  return 'not-started';
}

export function inSession(mode: RoomMode): boolean {
  return mode === 'gsl' || mode === 'moderated' || mode === 'tour' || mode === 'unmoderated' || mode === 'consultation';
}

function epoch(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? String(ms) : iso;
}

/** `codeKnown` false = the committee has no session yet; `loading` = not read yet. */
export function deriveSeat(room: RoomData | null, country: string, countryCode: string | null, codeKnown = true, loading = false): SeatState {
  const mode = roomMode(room, codeKnown, loading);
  const base: SeatState = {
    kind: 'not-in-session', ahead: 0, mode, caucusLabel: null, clock: null,
    notOnRoster: false, delegate: null, speakingKey: null, queueKey: null,
  };
  if (!room || !inSession(mode)) {
    if (room) base.delegate = findDelegate(room, country, countryCode);
    return base;
  }
  const caucus = room.caucus;
  const moderated = mode === 'moderated' || mode === 'tour';
  base.caucusLabel = caucus && mode !== 'gsl' ? (caucus.motionLabel || null) : null;
  const delegate = findDelegate(room, country, countryCode);
  base.delegate = delegate;
  const name = delegate?.country ?? country;
  const cs = room.current;
  const speakerAnchor = cs ? { timeRemaining: cs.timeRemaining, startedAt: cs.startedAt } : null;

  // Who holds the floor.
  let floor: string | null = null;
  if (mode === 'gsl') floor = cs?.country ?? null;
  else if (moderated) floor = caucus?.currentSpeaker ?? cs?.country ?? null;
  else if (mode === 'consultation') floor = caucus?.currentSpeaker ?? null;

  if (floor && sameSeat(floor, name)) {
    base.kind = 'speaking';
    if (mode === 'consultation') {
      base.speakingKey = `${room.id}|${lc(name)}|cow:${epoch(caucus?.floorSince)}`;
    } else {
      const csIsThem = cs && sameSeat(cs.country, name);
      base.clock = csIsThem ? { speaker: speakerAnchor, extra: 0, caucusCap: null, total: null } : null;
      base.speakingKey = `${room.id}|${lc(name)}|${csIsThem ? epoch(cs!.seatedAt ?? cs!.startedAt) : `c:${epoch(caucus?.totalStartedAt)}:${caucus?.spokenCountries?.length ?? 0}`}`;
    }
    return base;
  }

  if (!delegate) { base.kind = 'absent'; base.notOnRoster = true; return base; }
  if (delegate.status === 'absent') { base.kind = 'absent'; return base; }

  const queue: RoomQueueRow[] = mode === 'gsl' ? room.gsl : moderated ? room.caucusQueue : [];
  const idx = queue.findIndex((q) => sameSeat(q.country, name));
  if (idx >= 0) {
    const floorBusy = !!floor;
    const ahead = (floorBusy ? 1 : 0) + idx;
    const slot = mode === 'gsl' ? room.speakerTimeLimit : (caucus?.speakingTime ?? room.speakerTimeLimit);
    const floorClock = floorBusy && cs && sameSeat(cs.country, floor) ? speakerAnchor : null;
    base.kind = ahead <= 1 ? 'next' : 'ahead';
    base.ahead = ahead;
    base.queueKey = `${room.id}|q|${queue[idx].id}`;
    base.clock = {
      speaker: floorClock,
      // Those queued before this student, each a full slot. A seated speaker whose clock
      // row is missing counts as a full slot too.
      extra: Math.max(0, idx) * Math.max(0, slot) + (floorBusy && !floorClock ? slot : 0),
      caucusCap: moderated ? caucus : null,
      total: null,
    };
    return base;
  }

  base.kind = 'in-room';
  if ((mode === 'unmoderated' || mode === 'consultation') && caucus) {
    base.clock = { speaker: null, extra: 0, caucusCap: null, total: caucus };
  }
  return base;
}

/** Speakers-list order across every room: lower speaks sooner. Speaking now, then
 *  on deck / next, then N speakers ahead (ascending), then in the room but not queued,
 *  then absent, then rooms not in session. */
export function queueRank(s: SeatState): number {
  switch (s.kind) {
    case 'speaking': return 0;
    case 'next':
    case 'ahead': return 1 + s.ahead;
    case 'in-room': return 1000;
    case 'absent': return 2000;
    default: return 3000;
  }
}

/** The student's place in their room's list: the floor speaker is #1, the first queued
 *  delegation #2, in every mode (the chair's GSL sidebar numbers it the same way; its caucus
 *  panel numbers the queue from 1, the board keeps one rule). Null when not on a list. */
export function placeOf(s: SeatState): number | null {
  if (s.kind === 'speaking') return 1;
  if (s.kind === 'next' || s.kind === 'ahead') return s.ahead + 1;
  return null;
}

/** The bands of the "Up next" list. `queue` has no heading: it is the list itself. */
export type BoardGroup = 'queue' | 'room' | 'look' | 'out';

export function groupOf(s: SeatState): BoardGroup {
  if (s.kind === 'speaking' || s.kind === 'next' || s.kind === 'ahead') return 'queue';
  if (s.kind === 'in-room') return 'room';
  if (s.kind === 'absent') return 'look';
  return 'out';
}

/** Who holds the floor in a room that is in session, with their clock when it is theirs. */
export function roomFloor(room: RoomData | null): { country: string; clock: ClockSpec | null } | null {
  const mode = roomMode(room);
  if (!room || !inSession(mode)) return null;
  const cs = room.current;
  let floor: string | null = null;
  if (mode === 'gsl') floor = cs?.country ?? null;
  else if (mode === 'moderated' || mode === 'tour') floor = room.caucus?.currentSpeaker ?? cs?.country ?? null;
  else if (mode === 'consultation') floor = room.caucus?.currentSpeaker ?? null;
  if (!floor) return null;
  const mine = cs && sameSeat(cs.country, floor) && mode !== 'consultation';
  return {
    country: findDelegate(room, floor)?.country ?? floor,
    clock: mine ? { speaker: { timeRemaining: cs!.timeRemaining, startedAt: cs!.startedAt }, extra: 0, caucusCap: null, total: null } : null,
  };
}

// ── Today: objective counts, never scores ─────────────────────────────────────

export interface StudentCounts {
  speeches: number;
  seconds: number;
  motionsRaised: number;
  motionsPassed: number;
  rightsOfReply: number;
}

export interface MotionItem {
  id: string;
  country: string;
  at: string | null;
  motionType?: string;
  topic?: string;
  totalTime?: number;
  speakingTime?: number;
  outcome: 'passed' | 'rejected' | 'failed' | 'fell' | null;
}

const atMs = (e: { timestamp?: string | null; at?: string | null }) => {
  const ms = new Date((e.timestamp ?? e.at) ?? '').getTime();
  return Number.isFinite(ms) ? ms : 0;
};

/** Every motion in the room as one line with its outcome (motion-raised / -edited /
 *  -passed / -failed folded by id). A legacy raise with no id was written only when a
 *  caucus passed, so it reads as passed. */
export function foldMotions(events: BoardLogEvent[]): MotionItem[] {
  const sorted = events
    .filter((e) => e.type.startsWith('motion-'))
    .slice()
    .sort((a, b) => atMs(a) - atMs(b));
  const byId = new Map<string, MotionItem>();
  const out: MotionItem[] = [];
  let legacy = 0;
  for (const e of sorted) {
    const fields = { motionType: e.motionType, topic: e.topic, totalTime: e.totalTime, speakingTime: e.speakingTime };
    if (e.type === 'motion-raised') {
      if (!e.motionId) {
        out.push({ id: `legacy-${legacy++}`, country: e.country, at: e.timestamp, ...fields, outcome: 'passed' });
        continue;
      }
      if (byId.has(e.motionId)) continue;
      const item: MotionItem = { id: e.motionId, country: e.country, at: e.timestamp, ...fields, outcome: null };
      byId.set(e.motionId, item);
      out.push(item);
    } else if (e.type === 'motion-edited') {
      const prev = e.prevMotionId ? byId.get(e.prevMotionId) : undefined;
      if (prev && e.motionId) {
        byId.set(e.motionId, prev);
        Object.assign(prev, fields, { outcome: null });
      }
    } else if (e.type === 'motion-passed' || e.type === 'motion-failed') {
      const outcome = e.type === 'motion-passed' ? 'passed' : ((e.outcome as MotionItem['outcome']) ?? 'failed');
      const existing = e.motionId ? byId.get(e.motionId) : undefined;
      if (existing) { existing.outcome = outcome; continue; }
      const item: MotionItem = { id: e.motionId ?? `orphan-${out.length}`, country: e.country, at: e.timestamp, ...fields, outcome };
      if (e.motionId) byId.set(e.motionId, item);
      out.push(item);
    }
  }
  return out;
}

export function countsFor(room: RoomData, country: string, motions = foldMotions(room.events)): StudentCounts {
  const c: StudentCounts = { speeches: 0, seconds: 0, motionsRaised: 0, motionsPassed: 0, rightsOfReply: 0 };
  for (const e of room.events) {
    if (!sameSeat(e.country, country)) continue;
    if (e.type === 'speech' && (e.seconds ?? 0) > 0) { c.speeches++; c.seconds += Math.round(e.seconds ?? 0); }
    if (e.type === 'right-of-reply') c.rightsOfReply++;
  }
  for (const m of motions) {
    if (!sameSeat(m.country, country)) continue;
    c.motionsRaised++;
    if (m.outcome === 'passed') c.motionsPassed++;
  }
  return c;
}

/** The average per present, non-observer delegation. Null when nobody counts. */
export function roomAverage(room: RoomData): StudentCounts | null {
  const members = room.delegates.filter((d) => !d.isObserver && d.status !== 'absent');
  if (members.length === 0) return null;
  const motions = foldMotions(room.events);
  const sum: StudentCounts = { speeches: 0, seconds: 0, motionsRaised: 0, motionsPassed: 0, rightsOfReply: 0 };
  for (const d of members) {
    const c = countsFor(room, d.country, motions);
    sum.speeches += c.speeches; sum.seconds += c.seconds;
    sum.motionsRaised += c.motionsRaised; sum.motionsPassed += c.motionsPassed;
    sum.rightsOfReply += c.rightsOfReply;
  }
  const n = members.length;
  return {
    speeches: sum.speeches / n, seconds: sum.seconds / n,
    motionsRaised: sum.motionsRaised / n, motionsPassed: sum.motionsPassed / n,
    rightsOfReply: sum.rightsOfReply / n,
  };
}

export type TimelineItem =
  | { kind: 'speech'; at: string | null; seconds: number; context: string | null }
  | { kind: 'motion'; at: string | null; motion: MotionItem }
  | { kind: 'reply'; at: string | null };

/** Newest first. */
export function timelineFor(room: RoomData, country: string): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const e of room.events) {
    if (!sameSeat(e.country, country)) continue;
    if (e.type === 'speech' && (e.seconds ?? 0) > 0) items.push({ kind: 'speech', at: e.timestamp, seconds: Math.round(e.seconds ?? 0), context: e.context ?? null });
    else if (e.type === 'right-of-reply') items.push({ kind: 'reply', at: e.timestamp });
  }
  for (const m of foldMotions(room.events)) {
    if (sameSeat(m.country, country)) items.push({ kind: 'motion', at: m.at, motion: m });
  }
  return items.sort((a, b) => atMs(b) - atMs(a));
}

export function papersFor(room: RoomData, country: string) {
  return room.documents.filter((d) => d.sponsors.some((s) => sameSeat(s, country)));
}

export interface Cues {
  notOnList: boolean;
  quiet: boolean;
}

/** Coaching cues: facts only. `followingSince` = when this device began following. */
export function cuesFor(room: RoomData | null, state: SeatState, country: string, followingSince: number, now: number): Cues {
  const cues: Cues = { notOnList: false, quiet: false };
  if (!room || state.kind === 'absent' || state.kind === 'not-in-session') return cues;
  cues.notOnList = state.mode === 'gsl' && state.kind === 'in-room';
  if (state.kind === 'speaking') return cues;
  let last = 0;
  for (const e of room.events) {
    if (e.type === 'speech' && sameSeat(e.country, country)) last = Math.max(last, atMs(e));
  }
  cues.quiet = now - Math.max(last, followingSince) >= QUIET_CUE_MS;
  return cues;
}
