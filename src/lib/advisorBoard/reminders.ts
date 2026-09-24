'use client';

// ============================================================
// src/lib/advisorBoard/reminders.ts
//
// "Be in the room when your student speaks" (24 Sep 2026). A reminder fires ONCE per
// turn: when a followed student is REMIND_AHEAD speakers away, and when they start
// speaking. Turn keys are stable (derive.ts): speaking = committee + country + the seat's
// `current_speaker.seated_at`; two away = committee + the student's `speakers_list` row id.
// Fired keys persist 12 h on this device, so a reload or a reconnect never fires again.
//
// Never fires from stale data (a read older than 25 s, or the channel not subscribed),
// and never on the first read of a room: only on a change observed live.
//
// Effects: the board's sticky banner (the caller renders it), a soft two-note chime
// synthesised with Web Audio (no file; the context is unlocked on the first tap), a
// vibration where supported, and a "● Maya speaks next" tab-title prefix restored once
// the page is seen.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { serverNow } from '../serverClock';
import { REMIND_AHEAD, type SeatState } from './derive';
import type { FollowedSeat } from './types';

const FIRED_KEY = 'gavelling-advisor-reminders-v1';
const FIRED_TTL_MS = 12 * 60 * 60 * 1000;
export const REMINDER_MAX_AGE_MS = 25_000;

// ── Fired keys (device, 12 h) ────────────────────────────────────────────────

function readFired(now = Date.now()): Record<string, number> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    const v = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const out: Record<string, number> = {};
    for (const [k, ts] of Object.entries(v)) if (Number.isFinite(ts) && now - ts < FIRED_TTL_MS) out[k] = ts;
    return out;
  } catch {
    return {};
  }
}

function writeFired(map: Record<string, number>) {
  try { localStorage.setItem(FIRED_KEY, JSON.stringify(map)); } catch { /* storage blocked: memory only */ }
}

// ── Chime + vibration ────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

/** Create / resume the AudioContext inside a user gesture, so a later chime can play. */
export function unlockReminderAudio() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch { /* no audio: the banner and vibration still work */ }
}

export function playReminderChime() {
  try {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const ctx = audioCtx;
    const t0 = ctx.currentTime + 0.02;
    const notes: [number, number][] = [[659.25, 0], [880, 0.16]];   // E5 then A5
    for (const [freq, at] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.16, t0 + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.55);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.6);
    }
  } catch { /* ignore */ }
}

function vibrate() {
  try { navigator.vibrate?.([180, 90, 180]); } catch { /* unsupported */ }
}

// ── The hook ─────────────────────────────────────────────────────────────────

export interface BoardSeatView {
  seat: FollowedSeat;
  state: SeatState;
  /** serverNow() when this seat's room was read; 0 when there is no room. */
  fetchedAt: number;
  /** Session code, when the seat sits in a live room. */
  code: string | null;
}

export interface ActiveReminder {
  key: string;
  seatKey: string;
  kind: 'speaking' | 'soon';
  ahead: number;
  label: string;
}

interface Candidate { key: string; kind: 'speaking' | 'soon'; view: BoardSeatView }

function candidatesOf(view: BoardSeatView): Candidate[] {
  const out: Candidate[] = [];
  const s = view.state;
  if (s.kind === 'speaking' && s.speakingKey) out.push({ key: `speak|${s.speakingKey}`, kind: 'speaking', view });
  if ((s.kind === 'next' || s.kind === 'ahead') && s.queueKey && s.ahead <= REMIND_AHEAD) out.push({ key: `soon|${s.queueKey}`, kind: 'soon', view });
  return out;
}

export function useAdvisorReminders(opts: {
  views: BoardSeatView[];
  enabled: boolean;
  subscribed: boolean;
  labelOf: (view: BoardSeatView) => string;
  titleOf: (r: ActiveReminder) => string;
}) {
  const { views, enabled, subscribed, labelOf, titleOf } = opts;
  const [active, setActive] = useState<ActiveReminder[]>([]);
  const baselined = useRef<Set<string>>(new Set());
  const baseTitle = useRef<string | null>(null);
  const pending = useRef<ActiveReminder[]>([]);
  const liveKeys = useRef<Set<string>>(new Set());
  // How many speakers are ahead NOW, per live reminder key: a banner that fired at "2 away"
  // must read "speaks next" once the queue moves, and sort by the live number.
  const liveAhead = useRef<Map<string, number>>(new Map());
  const labelRef = useRef(labelOf);
  const titleRef = useRef(titleOf);
  useEffect(() => { labelRef.current = labelOf; titleRef.current = titleOf; }, [labelOf, titleOf]);

  // Unlock audio on the first tap anywhere.
  useEffect(() => {
    const onGesture = () => unlockReminderAudio();
    window.addEventListener('pointerdown', onGesture, { capture: true });
    window.addEventListener('keydown', onGesture, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture, { capture: true });
      window.removeEventListener('keydown', onGesture, { capture: true });
    };
  }, []);

  const restoreTitle = useCallback(() => {
    if (baseTitle.current !== null) { document.title = baseTitle.current; baseTitle.current = null; }
  }, []);

  // Watch every seat for a turn that newly qualifies.
  useEffect(() => {
    const now = serverNow();
    const fired = readFired();
    let firedChanged = false;
    const fresh: ActiveReminder[] = [];
    // Group by room: a room's FIRST read is its baseline and never fires.
    const byCode = new Map<string, BoardSeatView[]>();
    for (const v of views) {
      if (!v.code || !v.fetchedAt) continue;
      const arr = byCode.get(v.code) ?? [];
      arr.push(v);
      byCode.set(v.code, arr);
    }
    for (const [code, list] of byCode) {
      const baseline = !baselined.current.has(code);
      baselined.current.add(code);
      for (const v of list) {
        const stale = !subscribed || now - v.fetchedAt > REMINDER_MAX_AGE_MS;
        for (const c of candidatesOf(v)) {
          if (fired[c.key]) continue;
          if (stale && !baseline) continue;   // wait for fresh data; it may still qualify then
          fired[c.key] = Date.now();
          firedChanged = true;
          if (baseline || !enabled) continue;
          fresh.push({ key: c.key, seatKey: v.seat.key, kind: c.kind, ahead: v.state.ahead, label: labelRef.current(v) });
        }
      }
    }
    if (firedChanged) writeFired(fired);
    // Drop banners whose turn no longer holds (the speech ended, the queue moved on).
    liveKeys.current = new Set(views.flatMap((v) => candidatesOf(v).map((c) => c.key)));
    liveAhead.current = new Map(views.flatMap((v) => candidatesOf(v).map((c) => [c.key, v.state.ahead] as [string, number])));
    pending.current.push(...fresh);
    // Applied on the next task, never synchronously inside the effect. The queue lives in a
    // ref, so a fresh reminder is never lost if the views change again before it lands.
    window.setTimeout(() => {
      const add = pending.current.splice(0);
      setActive((prev) => {
        const fresh = (r: ActiveReminder) => {
          const ahead = liveAhead.current.get(r.key);
          return ahead === undefined || ahead === r.ahead ? r : { ...r, ahead };
        };
        const kept = prev.filter((r) => liveKeys.current.has(r.key) && !add.some((f) => f.seatKey === r.seatKey)).map(fresh);
        const next = [...add.filter((r) => liveKeys.current.has(r.key)), ...kept];
        return next.length === prev.length && next.every((r, i) => r.key === prev[i]?.key && r.ahead === prev[i]?.ahead) ? prev : next;
      });
    }, 0);
    if (fresh.length > 0) {
      playReminderChime();
      vibrate();
      // The same order as the banner: speaking first, then the fewest speakers away.
      const first = [...fresh].sort((a, b) => (a.kind === b.kind ? a.ahead - b.ahead : a.kind === 'speaking' ? -1 : 1))[0];
      if (baseTitle.current === null) baseTitle.current = document.title;
      document.title = `● ${titleRef.current(first)}`;
    }
  }, [views, enabled, subscribed]);

  // The title prefix goes once the page is seen: visible and focused, a few seconds on.
  useEffect(() => {
    let t: number | null = null;
    const check = () => {
      if (baseTitle.current === null) return;
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        if (t === null) t = window.setTimeout(() => { t = null; restoreTitle(); }, 6000);
      }
    };
    const iv = window.setInterval(check, 1000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(iv);
      if (t !== null) window.clearTimeout(t);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
      restoreTitle();
    };
  }, [restoreTitle]);

  const dismiss = useCallback((key: string) => {
    setActive((prev) => prev.filter((r) => r.key !== key));
    restoreTitle();
  }, [restoreTitle]);

  // Most urgent first: speaking before "soon", then fewer ahead.
  const sorted = [...active].sort((a, b) => (a.kind === b.kind ? a.ahead - b.ahead : a.kind === 'speaking' ? -1 : 1));
  return { active: sorted, dismiss };
}
