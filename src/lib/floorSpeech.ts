/**
 * THE speech logger. Every path that ends a floor turn logs through this module, so there
 * is one seconds source and one idempotency rule:
 *
 *   Next (GSL), Next (caucus), Finish/Yield, a caucus accepted over a speaker, a caucus
 *   ended by hand or by expiry, Suspend / End Debate (motion or organiser broadcast), and
 *   the Consultation of the Whole floor holder (flag tap, caucus end).
 *
 * Only Next used to log a GSL speech, so speeches were silently missing from stats and
 * scoring (audit G-1): the last speaker on a GSL that ran dry, a speaker interrupted by an
 * accepted caucus motion, and a speaker on the floor when Suspend or End Debate passed.
 *
 * SECONDS (audit T-3). `logFloorSpeech` reads them from the PERSISTED anchor:
 * `readSpokenSeconds` = current_speaker.time_granted minus the live remaining, which
 * survives a reload and a gavel handover. The read joins the current_speaker write chain
 * SYNCHRONOUSLY when `logFloorSpeech` is called, so call it AFTER issuing a pause (it then
 * sees where the clock stopped) and BEFORE issuing the Next or the floor clear (it then
 * still sees this speaker). Only when the row predates time_granted or names someone else
 * does it fall back to local accounting, `startBase + extraSecs - liveRemaining`:
 *   - startBase     = the slot the turn started with (GSL: the speaker time limit;
 *                     moderated caucus: the caucus slot),
 *   - extraSecs     = +time granted to this turn on this device,
 *   - liveRemaining = speakerRemainingNow(base, startedAt), on the database clock.
 *
 * IDEMPOTENT per turn, EXACTLY by key (S7). The turn key is the speaker plus the seat
 * nonce `current_speaker.seated_at`, which `nextSpeaker` stamps every time it seats a
 * delegation and every clear nulls. It is stable through pauses, restarts and +time, and
 * different for every seating, so two triggers on the same turn (a double click, an accept
 * that races a suspend, a second chair device) share a key and a second real speech by the
 * same delegation never does. There is no time window any more: the old paused `p:N` key
 * recurred legitimately, which is what the 15 s window papered over. The key rides in the
 * payload as `turnKey`; this device, the committee's own log and `parseLogEvents` all drop a
 * repeated key, so even two devices that both wrote cannot double-score.
 *
 * A row seated before the column existed has no nonce; it falls back to the old anchor key
 * (`s:` started_at, or `p:` the paused remaining), still deduped exactly.
 *
 * Room Order "Speaker N" placeholders are never logged per turn (they are not delegations,
 * and their queue and speaker clock cannot be persisted: the id columns are uuids), and a
 * zero-second turn is never logged. Instead the whole Room Order Tour de Table is credited
 * ONCE when it ends, by `creditRoomOrderTour`: one `tour-de-table` speech for every
 * delegation on the roster snapshot taken when the motion passed (`caucus.roomOrderCountries`),
 * keyed per tour instance (`caucus.tourStartedAt`) + country.
 */
import type { Committee } from '@/lib/types';
import { speakerRemainingNow, readSpokenSeconds } from '@/lib/committeeService';
import { sessionClient } from '@/lib/sessionClient';
import { serverNow } from '@/lib/serverClock';

/** The chair page's live speaker clock. When omitted the helper reads the committee row's
 *  own anchor (`speakerTimeRemaining` + `speakerStartedAt`) and assumes no extra time. */
export interface FloorClock {
  base: number;
  startedAt: string | null;
  extraSecs?: number;
}

export type SpeechContext = 'speakers-list' | 'moderated-caucus' | 'unmoderated-caucus' | 'tour-de-table';

/** Stable identity of one floor turn: the speaker plus the seat nonce (S7). The nonce is
 *  normalised to epoch ms, because the Moderator holds the ISO string it wrote ("...Z") and
 *  every other device reads Postgres's rendering of the same instant ("...+00:00"). */
export function floorTurnKey(
  committeeId: string,
  country: string,
  anchor: { base: number; startedAt: string | null; seatedAt?: string | null },
): string {
  const seatedMs = anchor.seatedAt ? new Date(anchor.seatedAt).getTime() : NaN;
  if (Number.isFinite(seatedMs)) return `${committeeId}|${country}|seat:${seatedMs}`;
  // Legacy row (seated before current_speaker.seated_at existed).
  const at = anchor.startedAt ? `s:${anchor.startedAt}` : `p:${Math.max(0, Math.round(anchor.base))}`;
  return `${committeeId}|${country}|${at}`;
}

/** Turn key for a Consultation of the Whole floor holder, whose turn is timed on this
 *  device from the moment the chair tapped their flag (epoch ms, database clock). */
export function cowTurnKey(committeeId: string, country: string, floorSinceMs: number): string {
  return `${committeeId}|${country}|cow:${Math.round(floorSinceMs)}`;
}

// Turn keys this device has logged (or is logging).
const loggedTurnKeys = new Set<string>();

function isRoomOrderSpeaker(committee: Committee): boolean {
  if (committee.currentSpeaker?.delegateId?.startsWith('room-order-')) return true;
  return committee.phase === 'moderated-caucus' && (committee.caucus?.purpose?.includes('Room Order') ?? false);
}

/** Seconds spoken so far in the current floor turn, or 0, from local accounting. Pure. */
export function floorSpeechSeconds(committee: Committee, clock?: FloorClock, now: number = serverNow()): number {
  if (!committee.currentSpeaker) return 0;
  const base = clock ? clock.base : committee.speakerTimeRemaining;
  const startedAt = clock ? clock.startedAt : committee.speakerStartedAt;
  const live = speakerRemainingNow(base, startedAt, now);
  const extra = Math.max(0, clock?.extraSecs ?? 0);
  const inCaucus = committee.phase === 'moderated-caucus' && !!committee.caucus;
  const startBase = inCaucus
    ? (committee.caucus!.speakerTimeRemaining > 0 ? committee.caucus!.speakerTimeRemaining : committee.caucus!.speakingTime)
    : committee.speakerTimeLimit;
  const spent = Math.round((Number.isFinite(startBase) ? startBase : 0) + extra - live);
  return Math.max(0, spent);
}

/** Has this turn already been logged, here or (as far as this device knows) by another
 *  device? Exact by key. Synchronous, so a caller can claim the key before any await. */
function alreadyLogged(committee: Committee, turnKey: string): boolean {
  if (loggedTurnKeys.has(turnKey)) return true;
  const needle = `"turnKey":${JSON.stringify(turnKey)}`;
  return (committee.messages ?? []).some((m) =>
    m.sender === '__system__' && m.recipient === '__log__' && m.content.includes(needle));
}

async function insertSpeech(
  committee: Committee,
  e: { country: string; seconds: number; context: SpeechContext; topic: string; turnKey: string; at: number },
): Promise<boolean> {
  const payload = JSON.stringify({
    country: e.country,
    type: 'speech',
    seconds: e.seconds,
    context: e.context,
    topic: e.topic,
    turnKey: e.turnKey,
    timestamp: new Date(e.at).toISOString(),
  });
  const { error } = await sessionClient(committee.code, committee.dbChairJoinSuffix ?? undefined)
    .from('messages')
    .insert({ committee_id: committee.id, sender: '__system__', content: `__log__:${payload}`, is_private: true, recipient: '__log__' });
  if (error) {
    console.error('Error logging speech:', error);
    loggedTurnKeys.delete(e.turnKey);   // let a retry through
    return false;
  }
  return true;
}

/**
 * Log a speech whose seconds the caller already knows (the Consultation of the Whole floor
 * holder), with the same per-turn idempotency as `logFloorSpeech`. Fire-and-forget safe.
 */
export async function logTimedSpeech(
  committee: Committee,
  e: { country: string; seconds: number; context: SpeechContext; topic: string; turnKey: string },
): Promise<boolean> {
  const seconds = Math.max(0, Math.round(e.seconds));
  if (!e.country || seconds <= 0) return false;
  const now = serverNow();
  if (alreadyLogged(committee, e.turnKey)) return true;
  loggedTurnKeys.add(e.turnKey);
  return insertSpeech(committee, { ...e, seconds, at: now });
}

/**
 * Write one `speech` log row for the current floor speaker. Fire-and-forget safe: resolves
 * to true when a row was written (or already existed), false when there was nothing to
 * log or the insert failed.
 */
export async function logFloorSpeech(committee: Committee, clock?: FloorClock): Promise<boolean> {
  const speaker = committee.currentSpeaker;
  if (!speaker?.country) return false;
  if (isRoomOrderSpeaker(committee)) return false;
  // Joins the current_speaker chain NOW: after any pause the caller already issued, before
  // any Next or clear it issues next.
  const persisted = readSpokenSeconds(committee.id).catch(() => null);
  const fallbackSeconds = floorSpeechSeconds(committee, clock);

  const anchor = clock
    ? { base: clock.base, startedAt: clock.startedAt, seatedAt: committee.speakerSeatedAt ?? null }
    : { base: committee.speakerTimeRemaining, startedAt: committee.speakerStartedAt, seatedAt: committee.speakerSeatedAt ?? null };
  const turnKey = floorTurnKey(committee.id, speaker.country, anchor);
  const now = serverNow();
  if (alreadyLogged(committee, turnKey)) return true;
  loggedTurnKeys.add(turnKey);   // claimed before the await: a second trigger stops here

  const anchorRead = await persisted;
  const seconds = anchorRead && anchorRead.country === speaker.country ? anchorRead.seconds : fallbackSeconds;
  if (seconds <= 0) { loggedTurnKeys.delete(turnKey); return false; }

  const inCaucus = committee.phase === 'moderated-caucus' && !!committee.caucus;
  return insertSpeech(committee, {
    country: speaker.country,
    seconds,
    context: inCaucus ? 'moderated-caucus' : 'speakers-list',
    topic: inCaucus ? (committee.caucus?.purpose || committee.topic) : committee.topic,
    turnKey,
    at: now,
  });
}

/** Turn key for the one credited speech per delegation in a Room Order Tour de Table:
 *  the tour instance (database-clock instant the motion passed, epoch ms) plus the country. */
export function roomOrderTourTurnKey(committeeId: string, country: string, tourStartedAtMs: number): string {
  return `${committeeId}|${country}|tour:${Math.round(tourStartedAtMs)}`;
}

/**
 * A Room Order Tour de Table has ENDED (End button, expiry, Next past the total or past the
 * last placeholder, another caucus accepted over it, End Debate): credit every delegation
 * that was in the room when the tour started with exactly ONE speech, context
 * `tour-de-table`.
 *
 * - Who: `caucus.roomOrderCountries`, the snapshot MotionsModal takes at accept with the
 *   tour's own eligibility rule (every delegate not absent, observers included). A tour
 *   accepted before the snapshot existed has none and credits nobody.
 * - Seconds: the tour's per-speaker time (`caucus.speakingTime`). Placeholders cannot be
 *   mapped to seats, so no per-delegation elapsed time exists; the owner asked for one
 *   speech each, not seconds precision.
 * - Only a tour that actually ran: someone was called, or time came off the total. Accepting
 *   one by mistake and ending it at once credits nobody.
 * - Idempotent: `roomOrderTourTurnKey` per country, checked against this device's claims and
 *   the loaded log before the insert, and deduped exactly in `parseLogEvents`, so a second
 *   trigger, a reload or a second device can never double-credit.
 *
 * Call from the Moderator's device only. One insert for the whole batch. Fire-and-forget safe.
 */
export async function creditRoomOrderTour(committee: Committee | null | undefined): Promise<boolean> {
  const caucus = committee?.caucus;
  if (!committee || !caucus || !(caucus.purpose?.includes('Room Order') ?? false)) return false;
  const countries = Array.from(new Set((caucus.roomOrderCountries ?? []).filter((c) => typeof c === 'string' && c)));
  const startedMs = caucus.tourStartedAt ? new Date(caucus.tourStartedAt).getTime() : NaN;
  if (countries.length === 0 || !Number.isFinite(startedMs)) return false;
  const ran = !!caucus.currentSpeaker || (caucus.spokenCountries?.length ?? 0) > 0
    || !!caucus.totalStartedAt || caucus.remainingTime < caucus.totalTime;
  if (!ran) return false;
  const seconds = Math.max(1, Math.round(caucus.speakingTime || 0));
  const at = new Date(serverNow()).toISOString();
  const topic = caucus.purpose || committee.topic;
  const todo = countries
    .map((country) => ({ country, turnKey: roomOrderTourTurnKey(committee.id, country, startedMs) }))
    .filter((e) => !alreadyLogged(committee, e.turnKey));
  if (todo.length === 0) return true;
  todo.forEach((e) => loggedTurnKeys.add(e.turnKey));   // claimed before the await
  const rows = todo.map((e) => ({
    committee_id: committee.id,
    sender: '__system__',
    is_private: true,
    recipient: '__log__',
    content: `__log__:${JSON.stringify({
      country: e.country, type: 'speech', seconds, context: 'tour-de-table' as SpeechContext,
      topic, turnKey: e.turnKey, timestamp: at,
    })}`,
  }));
  const { error } = await sessionClient(committee.code, committee.dbChairJoinSuffix ?? undefined)
    .from('messages').insert(rows);
  if (error) {
    console.error('Error crediting Room Order tour:', error);
    todo.forEach((e) => loggedTurnKeys.delete(e.turnKey));
    return false;
  }
  return true;
}
