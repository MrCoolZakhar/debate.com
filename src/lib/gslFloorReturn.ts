/**
 * An interrupted GSL speaker keeps their place on the GSL AND the time they had left
 * (owner, 18 Oct 2026: "The GSL should stay absolutely the same, even if they have time
 * remaining"; then: "coming back still has the same time remaining and doesn't skew with the
 * amount of times they spoke").
 *
 * A delegation is POPPED from `speakers_list` the moment it is seated (Next, or Start on a
 * delegation on deck: `nextSpeaker` deletes its GSL row) and lives on the `current_speaker`
 * row from then on (RULE 2). When a caucus is accepted, or Suspend passes (motion or an
 * organiser pause), the floor is cleared (G-1).
 *
 * THE PLACE. When the floor holder is a GSL speaker (the room is on the GSL, no caucus) with
 * time still on their clock, they go back to the FRONT of the GSL: optimistic first, then ONE
 * idempotent `speakers_list_add` at 'start' (the database assigns the position; never a
 * client-computed one), on the GSL list chain through runWrite (retried, parkable). When the
 * room returns to the GSL they are on deck again.
 *
 * THE TIME: a HOLD. Instead of logging the interrupted part as its own speech, the Moderator
 * writes a hold into `committees.settings.gslHeldFloors` (a key-level patch through
 * `patch_committee_settings`, parkable; the key is in NON_HYDRATED_SETTING_KEYS, so it never
 * enters the store or a blob save, and is read only from the row as `committee.dbGslHeldFloors`):
 *   { delegateId, country, remaining, granted, seatedAt, heldAt }
 *   - remaining = the live seconds left at the press (the pressed clock, database clock),
 *   - granted   = current_speaker.time_granted (slot + every +time / yield bonus), read on the
 *                 current_speaker chain BEFORE the caller's clear; local accounting
 *                 (`speakerTimeLimit + extraSecs`) is written first and kept when that read
 *                 fails, names someone else, or a speaker write of the room is stalled,
 *   - seatedAt  = the ORIGINAL current_speaker.seated_at, the turn's identity (floorTurnKey).
 * It lives in settings, not current_speaker, because a moderated caucus uses that row for its
 * own speakers.
 *
 * RESUME. When the held delegation is next seated from the GSL (Start on deck, Next), the seat
 * is the same ONE current_speaker update as ever, with `time_remaining = remaining`,
 * `time_granted = granted` and `seated_at = the original seatedAt`; the hold is then released.
 * The turn key is therefore identical and `logFloorSpeech` (time_granted - live) logs the WHOLE
 * speech once, with every second spoken before and after the interruption. A re-interruption
 * of a resumed speech holds again with the same seatedAt and grant and a smaller remaining.
 *
 * SAFETY NET. A held part is never lost: when the held delegation is no longer on the GSL and
 * not on the floor (removed, absent at Begin Session), the Moderator logs the held part ONCE
 * (`settleHeldFloors(c, 'orphaned')`, from a chair-page effect: GSL phase only, fresh state,
 * outside the debounce window) as a GSL speech of `granted - remaining` seconds with the SAME
 * turn key, through `logTimedSpeech` (exact-by-key idempotent), and drops the hold. End Debate
 * settles every hold the same way (`settleHeldFloors(c, 'all')`).
 *
 * Honest limits: Restart on a resumed speaker reseats the plain slot, as Restart always does
 * (its grant resets to the limit, so the part spoken before the interruption is not counted,
 * exactly like the part spoken before any Restart). A hold written while this device's patch
 * is in flight is overlaid locally for the Moderator (`heldFloorsOf`) until the row carries it.
 * A room abandoned with a hold and never ended keeps the held part unlogged.
 */
import type { Committee, HeldGslFloor, SpeakerEntry } from '@/lib/types';
import { addToSpeakersList, speakerRemainingNow, patchCommitteeSettings, readSpeakerGrant } from '@/lib/committeeService';
import { floorTurnKey, logTimedSpeech, type FloorClock } from '@/lib/floorSpeech';
import { serverNow, serverNowIso } from '@/lib/serverClock';
import { speakerWriteTrouble } from '@/lib/writeStatus';

export const GSL_HELD_FLOORS_KEY = 'gslHeldFloors';

/** How long the orphan check waits after the state it saw, so a transient snapshot (an
 *  optimistic list add still in flight, a refetch mid-transition) never settles a hold. */
export const HELD_FLOOR_SETTLE_DELAY_MS = 4000;

/** The GSL speaker holding the floor with time still on their clock, or null. Read BEFORE
 *  the caller clears the floor (it reads `committee.currentSpeaker`). */
export function interruptedGslSpeaker(committee: Committee, clock?: FloorClock | null, now?: number): SpeakerEntry | null {
  const floor = committee.currentSpeaker;
  if (!floor) return null;
  // Only a GSL floor: in a caucus the current_speaker row is the CAUCUS speaker (RULE 1).
  if (committee.phase !== 'speakers-list' || committee.caucus) return null;
  if (committee.delegates.find((d) => d.id === floor.delegateId)?.status === 'absent') return null;
  const live = clock
    ? speakerRemainingNow(clock.base, clock.startedAt, now)
    : speakerRemainingNow(committee.speakerTimeRemaining, committee.speakerStartedAt, now);
  return live > 0 ? floor : null;
}

/** Put the interrupted speaker back at the front of the GSL: `update` is the caller's
 *  optimistic structural updater (updateLocal), then one idempotent add at 'start'. */
export function returnSpeakerToGslFront(
  committee: Committee,
  speaker: SpeakerEntry,
  update: (updater: (c: Committee) => Committee) => void,
): void {
  update((c) => ({
    ...c,
    speakersList: [speaker, ...c.speakersList.filter((s) => s.delegateId !== speaker.delegateId)],
  }));
  void addToSpeakersList(committee.id, speaker.delegateId, speaker.country, committee.code, committee.dbChairJoinSuffix ?? undefined, 'start');
}

// ── The holds: the row, overlaid by this device's own patch until the row carries it ──────

/** After a patch landed, the overlay gives way to the row as soon as the row agrees, and at
 *  the latest this long after the landing (a refetch may still be on its way). */
const OVERLAY_KEEP_MS = 15_000;
let overlaySeq = 0;
const overlay = new Map<string, { value: HeldGslFloor[]; seq: number; landedAt: number | null }>();

const seatMs = (iso: string | null | undefined): number => (iso ? new Date(iso).getTime() : NaN);
/** Two seat nonces name the same seating: compared in epoch ms, because the Moderator holds
 *  "...Z" and readers get "...+00:00" for the same instant (floorTurnKey does the same). */
export function sameSeat(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = seatMs(a);
  const y = seatMs(b);
  return Number.isFinite(x) && x === y;
}

function sameHolds(a: HeldGslFloor[], b: HeldGslFloor[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((h) => b.some((g) => g.delegateId === h.delegateId && sameSeat(g.seatedAt, h.seatedAt)
    && g.remaining === h.remaining && g.granted === h.granted));
}

/** Every hold of this committee: this device's patch in flight first, else the row. */
export function heldFloorsOf(committee: Committee | null | undefined): HeldGslFloor[] {
  if (!committee) return [];
  const row = committee.dbGslHeldFloors ?? [];
  const e = overlay.get(committee.id);
  if (!e) return row;
  if (e.landedAt !== null && (sameHolds(e.value, row) || Date.now() - e.landedAt > OVERLAY_KEEP_MS)) {
    overlay.delete(committee.id);
    return row;
  }
  return e.value;
}

/** The hold of one delegation, or null. */
export function heldFloorFor(committee: Committee | null | undefined, delegateId: string | null | undefined): HeldGslFloor | null {
  if (!delegateId) return null;
  return heldFloorsOf(committee).find((h) => h.delegateId === delegateId) ?? null;
}

/** ONE key-level patch of the whole list (null when empty), overlaid locally until it lands.
 *  Moderator only: the callers are Moderator-only paths. */
function writeHolds(committee: Committee, next: HeldGslFloor[]): void {
  const seq = ++overlaySeq;
  overlay.set(committee.id, { value: next, seq, landedAt: null });
  void patchCommitteeSettings(
    committee.id, { [GSL_HELD_FLOORS_KEY]: next.length > 0 ? next : null },
    committee.code, committee.dbChairJoinSuffix ?? undefined,
  ).then((ok) => {
    const e = overlay.get(committee.id);
    if (!e || e.seq !== seq) return;   // a newer write owns the overlay
    if (ok) e.landedAt = Date.now();
    else overlay.delete(committee.id); // refused: the row is the truth again
  }).catch(() => {
    const e = overlay.get(committee.id);
    if (e && e.seq === seq) overlay.delete(committee.id);
  });
}

/** The held part's turn key: the same key the resumed speech would have (floorTurnKey). */
function heldTurnKey(committee: Committee, h: HeldGslFloor): string {
  return floorTurnKey(committee.id, h.country, { base: h.remaining, startedAt: null, seatedAt: h.seatedAt });
}

/** Log a held part as the GSL speech it is: `granted - remaining` seconds, same turn key. */
function logHeldPart(committee: Committee, h: HeldGslFloor): Promise<boolean> {
  return logTimedSpeech(committee, {
    country: h.country,
    seconds: Math.max(0, h.granted - h.remaining),
    context: 'speakers-list',
    topic: committee.topic,
    turnKey: heldTurnKey(committee, h),
  });
}

/**
 * HOLD the interrupted GSL floor holder instead of logging their speech. Call where the
 * caller would call `logFloorSpeech` for them, i.e. BEFORE it issues the floor clear (the
 * grant read joins the current_speaker chain now). Returns true when the hold was taken: the
 * caller then does NOT log the speech. False (log as before): no seat nonce on the row (a
 * legacy seating), no chair password on hand, or no time left.
 */
export function holdInterruptedGslSpeaker(
  committee: Committee,
  speaker: SpeakerEntry,
  clock?: FloorClock | null,
  pressedAt?: number,
): boolean {
  const seatedAt = committee.speakerSeatedAt ?? null;
  if (!seatedAt || !Number.isFinite(seatMs(seatedAt))) return false;
  if (!committee.dbChairJoinSuffix) return false;
  const at = pressedAt ?? serverNow();
  const base = clock ? clock.base : committee.speakerTimeRemaining;
  const startedAt = clock ? clock.startedAt : committee.speakerStartedAt;
  const remaining = Math.round(speakerRemainingNow(base, startedAt, at));
  if (remaining <= 0) return false;
  const slot = Number.isFinite(committee.speakerTimeLimit) ? committee.speakerTimeLimit : 0;
  const localGranted = Math.max(remaining, Math.round(slot + Math.max(0, clock?.extraSecs ?? 0)));
  // Joins the current_speaker chain NOW: after any pause already issued, before the clear.
  const troubleAtCall = speakerWriteTrouble(committee.id);
  const grantRead = readSpeakerGrant(committee.id).catch(() => null);

  const hold: HeldGslFloor = {
    delegateId: speaker.delegateId, country: speaker.country,
    remaining, granted: localGranted, seatedAt, heldAt: serverNowIso(),
  };
  const current = heldFloorsOf(committee);
  // An older hold of the same delegation from ANOTHER seating cannot be resumed any more:
  // log it now (its own turn key) so it is never lost.
  current
    .filter((h) => h.delegateId === speaker.delegateId && !sameSeat(h.seatedAt, seatedAt))
    .forEach((h) => { void logHeldPart(committee, h); });
  writeHolds(committee, [...current.filter((h) => h.delegateId !== speaker.delegateId), hold]);

  // The persisted grant (+time survives a reload there, not in the local refs).
  void grantRead.then((row) => {
    if (!row || row.country !== speaker.country || !sameSeat(row.seatedAt, seatedAt)) return;
    if (row.timeGranted === null) return;
    const after = speakerWriteTrouble(committee.id);
    if (troubleAtCall.stalledNow || after.stalledNow || after.mark !== troubleAtCall.mark) return;
    const granted = Math.max(remaining, Math.round(row.timeGranted));
    if (granted === localGranted) return;
    const now = heldFloorsOf(committee);
    const mine = now.find((h) => h.delegateId === speaker.delegateId && h.heldAt === hold.heldAt);
    if (!mine) return;   // resumed or settled meanwhile
    writeHolds(committee, now.map((h) => (h === mine ? { ...h, granted } : h)));
  });
  return true;
}

/** The held delegation was seated with its hold: drop the hold (the turn now lives on the
 *  current_speaker row under the same seat nonce). */
export function releaseHeldFloor(committee: Committee, delegateId: string): void {
  const current = heldFloorsOf(committee);
  if (!current.some((h) => h.delegateId === delegateId)) return;
  writeHolds(committee, current.filter((h) => h.delegateId !== delegateId));
}

/**
 * Settle holds so no held part is ever lost. Moderator device only.
 *  - 'orphaned' (the chair-page effect, GSL phase only): a hold whose delegation is neither on
 *    the GSL nor seated under the same seat nonce is logged and dropped; a hold whose
 *    delegation IS seated under the same nonce was resumed and is just dropped.
 *  - 'all' (End Debate): every hold is logged and dropped, except a resumed one on the floor,
 *    whose whole speech `logFloorSpeech` logs under the same key.
 * Logging is `logTimedSpeech`, idempotent exactly by turn key, so a double fire (two devices
 * after a handover, an effect re-run) can never log a part twice.
 */
export function settleHeldFloors(committee: Committee, mode: 'orphaned' | 'all'): void {
  const holds = heldFloorsOf(committee);
  if (holds.length === 0) return;
  const keep: HeldGslFloor[] = [];
  for (const h of holds) {
    const floor = committee.currentSpeaker;
    const resumed = floor?.delegateId === h.delegateId && sameSeat(committee.speakerSeatedAt, h.seatedAt);
    if (resumed) continue;
    const waiting = floor?.delegateId !== h.delegateId
      && committee.speakersList.some((s) => s.delegateId === h.delegateId);
    if (mode === 'orphaned' && waiting) { keep.push(h); continue; }
    void logHeldPart(committee, h);
  }
  if (keep.length !== holds.length) writeHolds(committee, keep);
}

/** What the orphan check depends on, as one string ('' when there is no hold), so the chair
 *  page's effect re-runs only when one of these changes, never per tick. */
export function heldFloorsCheckKey(committee: Committee | null | undefined): string {
  const holds = heldFloorsOf(committee);
  if (!committee || holds.length === 0) return '';
  return JSON.stringify([
    holds.map((h) => `${h.delegateId}|${seatMs(h.seatedAt)}|${h.remaining}|${h.granted}`),
    committee.speakersList.map((s) => s.delegateId),
    committee.currentSpeaker?.delegateId ?? null,
    seatMs(committee.speakerSeatedAt),
    committee.phase,
    !!committee.caucus,
  ]);
}
