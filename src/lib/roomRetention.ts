// ============================================================
// src/lib/roomRetention.ts
//
// HOW LONG A STANDALONE ROOM IS KEPT, said to the chair before it happens (23 Sep 2026).
//
// The truth is `delete_expired_committees()` in the database (pg_cron, hourly at :00).
// It never touches a conference room (`session_origin = 'conference'`). For every other room:
//   • ended          → deleted once `expires_at` has passed (End Debate sets it to +24 hours,
//                      ENDED_KEEP_HOURS, so a committee ended by accident can be reopened);
//   • suspended      → deleted 72 hours after `suspended_at` when the room HELD DEBATE (any
//                      speech on the `__log__` ledger), 36 hours otherwise;
//   • live and idle  → deleted after 24 hours with no activity (not shown here).
// KEEP THE TWO NUMBERS BELOW IN STEP WITH THAT FUNCTION.
//
// The cron runs on the hour, so a room really goes up to an hour after the time shown.
// ============================================================

import type { Committee } from './types';
import { parseLedgerEvents } from './scoring';

export const SUSPENDED_KEEP_HOURS = 36;
export const SUSPENDED_DEBATED_KEEP_HOURS = 72;

/**
 * How long an ENDED room is kept, and how long it can be reopened (owner, 7 Oct 2026:
 * "when someone ends debate, going onto the same session within 24 hours, it still
 * allows them back in to restart it. This happened in some committees where they
 * accidentally ended it").
 *
 * The two numbers are deliberately the same: a room must still EXIST to be reopened, and
 * End Debate used to set `expires_at` to one hour, so the cron deleted an accidentally
 * ended standalone room before anyone could get back to it. Changing the reopen window
 * without changing the keep window would be a promise the database breaks.
 *
 * A CONFERENCE room is never deleted at all (`delete_expired_committees()` filters
 * `session_origin <> 'conference'`), so it always outlives the conference by any margin;
 * the owner's "at least until the conference ends + 1 day" is satisfied by that, and
 * `expires_at` on such a room is inert.
 */
export const ENDED_KEEP_HOURS = 24;
export const REOPEN_WINDOW_HOURS = 24;

/** The instant an ended room stops being reopenable, or null when it has not ended. */
export function reopenWindowEndsAt(committee: Committee): Date | null {
  if (!committee.endedAt) return null;
  const ended = new Date(committee.endedAt).getTime();
  if (!Number.isFinite(ended)) return null;
  return new Date(ended + REOPEN_WINDOW_HOURS * 3_600_000);
}

/**
 * Can this room be restarted right now? True for `REOPEN_WINDOW_HOURS` after it ended.
 * `nowMs` is the DATABASE clock (serverNow), never Date.now (AGENTS.md RULE 6b): the
 * window is compared against a timestamp the database wrote.
 */
export function canReopenEndedRoom(committee: Committee, nowMs: number): boolean {
  const until = reopenWindowEndsAt(committee);
  return !!until && nowMs < until.getTime();
}

/** Any speech logged on the ledger: the same test the database makes. */
export function roomHeldDebate(committee: Committee): boolean {
  return parseLedgerEvents(committee).some((e) => (e.type ?? 'speech') === 'speech');
}

/** Hours a room suspended now is kept. `floorSpeech`: a speech about to be logged by the suspension itself. */
export function suspendedKeepHours(committee: Committee, floorSpeech = false): number {
  return floorSpeech || roomHeldDebate(committee) ? SUSPENDED_DEBATED_KEEP_HOURS : SUSPENDED_KEEP_HOURS;
}

/**
 * When this room will be deleted, or null when it will not be (a conference room, a live
 * room). `nowMs` is the database clock (serverNow) for a suspension that has not landed yet.
 */
export function roomKeptUntil(committee: Committee, nowMs?: number, floorSpeech = false): Date | null {
  if (committee.sessionOrigin === 'conference') return null;
  if (committee.endedAt) return committee.expiresAt ? new Date(committee.expiresAt) : null;
  const from = committee.suspendedAt ? new Date(committee.suspendedAt).getTime() : nowMs;
  if (from == null || !Number.isFinite(from)) return null;
  return new Date(from + suspendedKeepHours(committee, floorSpeech) * 3_600_000);
}

/** "Thu 25 Sep, 14:30" in the reader's language and time zone. */
export function formatKeptUntil(when: Date, language: string): string {
  try {
    return new Intl.DateTimeFormat(language, {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(when);
  } catch {
    return when.toLocaleString();
  }
}
