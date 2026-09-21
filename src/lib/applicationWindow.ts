// applicationWindow.ts — when a role accepts applications, decided exactly the
// way the database decides it.
//
// Since 19 Sep 2026 the trigger guard_application_write() refuses a
// non-organiser application INSERT when the role config is missing or
// disabled, when now() < applications_open_at, or when now() >
// applications_close_at (P0001, hint 'role_closed' / 'role_not_open').
// Before this file the apply page checked only is_enabled, so an applicant
// could fill in the whole form for a role whose window had closed and meet
// the refusal at Submit (MUNBU WS, 21 Sep 2026).
//
// "now" is the DATABASE clock (serverNow() from serverClock.ts), never the
// device clock alone: a phone a day off would otherwise show the form for a
// closed role, or hide it for an open one.

import { useEffect, useState } from 'react';
import { serverNow, subscribeServerClock } from '@/lib/serverClock';

export type RoleWindowState = 'open' | 'disabled' | 'not_open' | 'closed';

export interface RoleWindowConfig {
  is_enabled?: boolean | null;
  applications_open_at?: string | null;
  applications_close_at?: string | null;
}

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/** The trigger's three checks, in its order. */
export function roleWindowState(cfg: RoleWindowConfig | null | undefined, now: number): RoleWindowState {
  if (!cfg || !cfg.is_enabled) return 'disabled';
  const openAt = ms(cfg.applications_open_at);
  if (openAt !== null && now < openAt) return 'not_open';
  const closeAt = ms(cfg.applications_close_at);
  if (closeAt !== null && now > closeAt) return 'closed';
  return 'open';
}

/** The database's "now", re-rendering every `tickMs` and whenever the clock
 *  offset is re-measured, so a form left open past the closing minute turns
 *  into the closed screen on its own. */
export function useServerNow(tickMs = 30_000): number {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const unsub = subscribeServerClock(() => setNow(serverNow()));
    const id = window.setInterval(() => setNow(serverNow()), tickMs);
    return () => { unsub(); window.clearInterval(id); };
  }, [tickMs]);
  return now;
}

/** True for the trigger's window refusals: an expected business rule, not a
 *  crash, so callers must not report it as one. */
export function isApplicationWindowRefusal(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { hint?: unknown; message?: unknown };
  if (e.hint === 'role_closed' || e.hint === 'role_not_open') return true;
  return typeof e.message === 'string'
    && /^Applications for this role (are closed|are not open yet|have closed)\.$/.test(e.message);
}

/** "22 Sep 2026, 23:59" in the reader's own timezone. */
export function formatWindowInstant(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Organiser side: fee phases against the application window ──────────────

/** YYYY-MM-DD of an instant as seen in `timeZone` (UTC when null / invalid). */
export function dayInZone(iso: string, timeZone: string | null): string {
  const d = new Date(iso);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Milliseconds `timeZone` is ahead of UTC at instant `t`. */
function zoneOffsetMs(t: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(t));
  const get = (k: string) => Number(parts.find(p => p.type === k)?.value ?? 0);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wall - Math.floor(t / 1000) * 1000;
}

/** 23:59 on `day` (YYYY-MM-DD) in `timeZone`, as an ISO instant. No (or an
 *  unknown) timezone means 23:59 UTC. */
export function endOfDayIso(day: string, timeZone: string | null): string {
  return zonedIso(day, 23, 59, timeZone);
}

/** 00:00 on `day` in `timeZone` (UTC when none), as an ISO instant. */
export function startOfDayIso(day: string, timeZone: string | null): string {
  return zonedIso(day, 0, 0, timeZone);
}

/** `hh:mm` on `day` (YYYY-MM-DD) in `timeZone`, as an ISO instant. */
export function zonedIso(day: string, hh: number, mm: number, timeZone: string | null): string {
  const [y, m, d] = day.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  if (!timeZone) return new Date(guess).toISOString();
  try {
    let t = guess - zoneOffsetMs(guess, timeZone);
    t = guess - zoneOffsetMs(t, timeZone); // settle across a DST change
    return new Date(t).toISOString();
  } catch {
    return new Date(guess).toISOString();
  }
}

/** "23 Sep" for a YYYY-MM-DD day, never shifted by the reader's timezone. */
export function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "22nd" */
export function ordinalDay(day: string): string {
  const n = Number(day.slice(8, 10));
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${s}`;
}
