// ============================================================
// src/lib/roomRetention.ts
//
// HOW LONG A STANDALONE ROOM IS KEPT, said to the chair before it happens (23 Sep 2026).
//
// The truth is `delete_expired_committees()` in the database (pg_cron, hourly at :00).
// It never touches a conference room (`session_origin = 'conference'`). For every other room:
//   • ended          → deleted once `expires_at` has passed (End Debate sets it to +1 hour);
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
