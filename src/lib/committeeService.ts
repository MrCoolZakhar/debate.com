// ============================================================
// src/lib/committeeService.ts
// All Supabase database operations for Gavelling.
// ============================================================

import { supabase } from './supabase';
import { sessionClient } from './sessionClient';
import { parseIntroState } from './documentFlow';
import { serverNow, serverNowIso } from './serverClock';
import { runWrite, rowsOf, cancelPendingRetries, type WriteResult } from './writeStatus';
import { noteFlushedSettings } from './settingsEcho';
import {
  Committee,
  Delegate,
  DelegateStatus,
  SessionPhase,
  PendingMotion,
  PendingMotionType,
  CommitteeDocument,
  DocumentStatus,
  CaucusState,
  SpeakerEntry,
} from './types';

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function calcDisruptiveness(type: PendingMotionType, totalTime: number, motionOrder?: string[]): number {
  // Procedural motions keep fixed high scores
  if (type === 'end-debate') return 6_000_000 + totalTime;
  if (type === 'suspend-debate') return 5_000_000 + totalTime;
  // A Custom motion disrupts nothing at all, so it always sorts to the very
  // bottom of the queue. 0 is strictly below the lowest orderable base (1M).
  if (type === 'custom') return 0;
  // The 4 orderable types: position 0 = 4M base, position 1 = 3M, etc.
  const order = motionOrder ?? ['consultation', 'tour', 'unmoderated', 'moderated'];
  const idx = order.indexOf(type);
  const base = idx >= 0 ? (4 - idx) * 1_000_000 : 1_000_000;
  return base + totalTime;
}

// ============================================================
// CLOCK ANCHORS — pure readers, safe on every surface
//
// You cannot sync a per-second TICK across devices, and you must not try: writing
// caucus.remainingTime every second is one write/sec/committee AND it re-arms the
// realtime debounce (RULE 4 / MUST NEVER HAPPEN #4).
//
// You do not need to. ANCHOR instead: persist a start timestamp + a duration ONCE and
// let every client derive `remaining = duration - (now - startedAt)` and render its own
// tick. All devices agree because they derive from the same fixed point rather than from
// each other. This is exactly what current_speaker.started_at already does for the
// speaker clock; caucus.totalStartedAt does it for the total caucus clock.
//
// Both helpers are pure functions of the committee row — no localStorage, no store — so
// they are safe to call from the delegate and advisor pages (MUST NEVER HAPPEN #14).
// ============================================================

/** Live remaining seconds on the TOTAL caucus clock. Falls back to the stored
 *  remainingTime when there is no anchor (paused clock, or a caucus started before the
 *  anchor field existed) — never NaN, never a jumped clock. */
export function caucusRemainingNow(caucus: CaucusState | null | undefined, now: number = serverNow()): number {
  if (!caucus) return 0;
  const base = Number.isFinite(caucus.remainingTime) ? caucus.remainingTime : 0;
  if (!caucus.totalStartedAt) return Math.max(0, base);
  const startedMs = new Date(caucus.totalStartedAt).getTime();
  if (!Number.isFinite(startedMs)) return Math.max(0, base);
  const elapsed = Math.max(0, Math.round((now - startedMs) / 1000));
  return Math.max(0, base - elapsed);
}

/** Live remaining seconds on the CURRENT SPEAKER clock (GSL or caucus alike).
 *  `speakerTimeRemaining` is current_speaker.time_remaining — the value at the anchor —
 *  and `speakerStartedAt` is current_speaker.started_at (null = paused). */
export function speakerRemainingNow(
  speakerTimeRemaining: number,
  speakerStartedAt: string | null | undefined,
  now: number = serverNow(),
): number {
  const base = Number.isFinite(speakerTimeRemaining) ? speakerTimeRemaining : 0;
  if (!speakerStartedAt) return Math.max(0, base);
  const startedMs = new Date(speakerStartedAt).getTime();
  if (!Number.isFinite(startedMs)) return Math.max(0, base);
  const elapsed = Math.max(0, Math.round((now - startedMs) / 1000));
  return Math.max(0, base - elapsed);
}

/** Wall-clock ms at which a RUNNING speaker clock reaches zero, or null when it is paused
 *  (no anchor) or unparseable. */
export function speakerClockEndsAt(speakerTimeRemaining: number, speakerStartedAt: string | null | undefined): number | null {
  if (!speakerStartedAt) return null;
  const startedMs = new Date(speakerStartedAt).getTime();
  if (!Number.isFinite(startedMs)) return null;
  const base = Number.isFinite(speakerTimeRemaining) ? Math.max(0, speakerTimeRemaining) : 0;
  return startedMs + base * 1000;
}

/** Live TOTAL of a MODERATED caucus (or Tour de Table), which is speaking time: it only
 *  runs while a speaker's clock runs. When the speaker clock has already reached zero the
 *  total is read AT that instant, so it stops with the speaker on every surface even
 *  before the Moderator's device re-anchors it (a sleeping laptop, a slow write). Pass the
 *  current_speaker anchor; with no running speaker it is exactly caucusRemainingNow. */
export function moderatedCaucusRemainingNow(
  caucus: CaucusState | null | undefined,
  speakerTimeRemaining: number,
  speakerStartedAt: string | null | undefined,
  now: number = serverNow(),
): number {
  const end = speakerClockEndsAt(speakerTimeRemaining, speakerStartedAt);
  return caucusRemainingNow(caucus, end === null ? now : Math.min(now, end));
}

/** How many delegates a moderated caucus queue can hold right now.
 *
 *  The rule (Peter, 14 Sep 2026): if ANY time is left beyond what is already committed,
 *  one more delegate fits, even if their slot is only ten seconds. Committed time is the
 *  current speaker's live remaining clock plus a full speaking time for everyone queued.
 *  So a delegate fits whenever committed < remaining; the last one's clock is capped to
 *  the time actually left when they are called (see capSpeakerSlot). The old rule,
 *  floor(remainingTime / speakingTime), also ignored who was already queued and read the
 *  stale anchor value, so it said "full" with minutes on the clock. */
export function caucusQueueCapacity(
  remainingTotal: number,
  speakingTime: number,
  queueLength: number,
  currentSpeakerRemaining: number,
): number {
  const speak = speakingTime > 0 ? speakingTime : 1;
  const committed = Math.max(0, currentSpeakerRemaining) + queueLength * speak;
  const spare = Math.max(0, remainingTotal) - committed;
  return queueLength + (spare > 0 ? Math.ceil(spare / speak) : 0);
}

/** A speaker's clock when called in a moderated caucus: the motion's speaking time, or
 *  whatever is left of the caucus if that is less. Never below 1 while time remains. */
export function capSpeakerSlot(speakingTime: number, remainingTotal: number): number {
  const speak = Math.max(0, Math.round(speakingTime));
  const left = Math.max(0, Math.round(remainingTotal));
  return left > 0 ? Math.max(1, Math.min(speak, left)) : speak;
}

/** Stamp the total-clock anchor onto a caucus. `running` false → paused (anchor cleared,
 *  remainingTime is the literal truth). Always pass the LIVE remaining, not the stale one. */
export function anchorCaucusClock(caucus: CaucusState, liveRemaining: number, running: boolean): CaucusState {
  return {
    ...caucus,
    remainingTime: Math.max(0, Math.round(liveRemaining)),
    totalStartedAt: running ? serverNowIso() : null,
  };
}

/** Seconds the current speaker has actually spoken, from the PERSISTED anchor: what they
 *  were granted (slot plus every +time) minus what is left on the clock now. Survives a
 *  reload and a gavel handover, unlike a device-local extra-time counter (audit T-3).
 *  `timeGranted` null (a row from before the column existed) returns null, so the caller
 *  can fall back to its own accounting. */
export function spokenSecondsFromAnchor(
  timeGranted: number | null | undefined,
  timeRemaining: number,
  startedAt: string | null | undefined,
  now: number = serverNow(),
): number | null {
  if (typeof timeGranted !== 'number' || !Number.isFinite(timeGranted)) return null;
  return Math.max(0, Math.round(timeGranted) - speakerRemainingNow(timeRemaining, startedAt, now));
}

/** A caucus as it is kept through a break (suspend, end, a resume that restores it): the
 *  total paused at its live value (pauseCaucusLive) AND nobody on its floor. The floor
 *  holder's speech is logged and current_speaker is cleared when the break starts, so a
 *  `currentSpeaker` left in the caucus JSON was a phantom speaker on every restored caucus
 *  (S4). The queue (speakers_list rows) is untouched. */
export function freezeCaucusForBreak(
  caucus: CaucusState,
  speakerTimeRemaining: number,
  speakerStartedAt: string | null | undefined,
  now: number = serverNow(),
): CaucusState {
  const paused = pauseCaucusLive(caucus, speakerTimeRemaining, speakerStartedAt, now);
  return paused.currentSpeaker == null && !paused.floorSince ? paused : { ...paused, currentSpeaker: null, floorSince: null };
}

/** The phase a stored caucus belongs to. */
export function phaseForCaucus(caucus: CaucusState): SessionPhase {
  return caucus.type === 'moderated' ? 'moderated-caucus' : 'unmoderated-caucus';
}

/** The caucus with BOTH of its clocks read live and the total paused at that value. Used
 *  when a session suspends or ends, so the break does not drain the caucus (audit C-1).
 *  A moderated total is read capped at the speaker clock's zero, like every other reader. */
export function pauseCaucusLive(
  caucus: CaucusState,
  speakerTimeRemaining: number,
  speakerStartedAt: string | null | undefined,
  now: number = serverNow(),
): CaucusState {
  if (!caucus.totalStartedAt) return caucus;
  const live = caucus.type === 'moderated'
    ? moderatedCaucusRemainingNow(caucus, speakerTimeRemaining, speakerStartedAt, now)
    : caucusRemainingNow(caucus, now);
  return { ...caucus, remainingTime: Math.max(0, Math.round(live)), totalStartedAt: null };
}

type DbRow = Record<string, unknown>;

function rowToCommittee(
  row: DbRow,
  delegates: Delegate[] = [],
  speakersList: SpeakerEntry[] = [],
  caucusQueue: SpeakerEntry[] = [],
  currentSpeaker: SpeakerEntry | null = null,
  speakerTimeRemaining: number = 0,
  pendingMotions: PendingMotion[] = [],
  documents: CommitteeDocument[] = [],
  messages: Committee['messages'] = [],
  speakerStartedAt: string | null = null,
): Committee {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    topic: row.topic as string,
    chairName: (row.chair_names as string[])[0] ?? 'Chair',
    chairNames: row.chair_names as string[],
    delegates,
    phase: row.phase as SessionPhase,
    speakersList,
    caucusQueue,
    currentSpeaker,
    speakerTimeLimit: row.speaker_time_limit as number,
    speakerTimeRemaining,
    speakerStartedAt,
    motions: [],
    pendingMotions,
    resolutions: [],
    documents,
    caucus: (row.caucus as CaucusState) ?? null,
    messages,
    createdAt: new Date(row.created_at as string),
    suspendedAt: (row.suspended_at as string | null) ?? null,
    endedAt: (row.ended_at as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    resumingChair: (row.resuming_chair as string | null) ?? null,
    dbChairJoinSuffix: ((row.settings as Record<string, unknown>)?.chairJoinSuffix as string) ?? null,
    dbHeadChair: ((row.settings as Record<string, unknown>)?.headChair as string) ?? null,
    dbHeadChairDevice: ((row.settings as Record<string, unknown>)?.headChairDevice as string) || null,
    dbSeparateChairCode: ((row.settings as Record<string, unknown>)?.separateChairCode as boolean) ?? false,
    dbSettings: (row.settings as Record<string, unknown>) ?? null,
    dbScoring: ((row.settings as Record<string, unknown>)?.scoring as Committee['dbScoring']) ?? null,
    sessionOrigin: row.session_origin === 'conference' ? 'conference' : 'standalone',
  };
}

// ============================================================
// COMMITTEE LIFECYCLE
// ============================================================

export async function createCommittee(
  name: string,
  topic: string,
  chairNames: string[],
  delegateNames: string[],
  observerCountries: string[] = [],
): Promise<{ code: string; chairJoinSuffix: string } | null> {
  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000));
  const createPromise = async (): Promise<{ code: string; chairJoinSuffix: string } | null> => {
    const code = generateCode();
    const chairJoinSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    const client = sessionClient(code, chairJoinSuffix);

    const { data: committeeRow, error: committeeError } = await client
      .from('committees')
      .insert({
        code, name, topic, chair_names: chairNames, phase: 'pre-session', speaker_time_limit: 90,
        settings: { chairJoinSuffix, separateChairCode: true },
      })
      .select()
      .single();

    if (committeeError || !committeeRow) {
      console.error('Error creating committee:', committeeError);
      return null;
    }

    if (delegateNames.length > 0) {
      const obs = new Set(observerCountries.map((c) => c.toLowerCase()));
      const delegateRows = delegateNames.map((country) => ({ committee_id: committeeRow.id, country, status: 'absent', is_observer: obs.has(country.toLowerCase()) }));
      const BATCH_SIZE = 50;
      for (let i = 0; i < delegateRows.length; i += BATCH_SIZE) {
        const batch = delegateRows.slice(i, i + BATCH_SIZE);
        const { error: delegateError } = await client.from('delegates').insert(batch);
        if (delegateError) console.error('Error inserting delegates batch:', delegateError);
      }
    }

    await client.from('current_speaker').insert({
      committee_id: committeeRow.id, delegate_id: null, country: null, time_remaining: 90,
    });
    return { code, chairJoinSuffix };
  };
  return Promise.race([createPromise(), timeoutPromise]);
}

export async function getCommitteeByCode(code: string): Promise<Committee | null> {
  const upperCode = code.toUpperCase();

  const { data: committeeRow, error: committeeError } = await supabase
    .from('committees').select('*').eq('code', upperCode).single();
  if (committeeError || !committeeRow) return null;

  // Run all sub-queries in parallel (S8) — was 7 sequential round-trips (~700ms–2s total)
  const [
    { data: delegateRows },
    { data: speakersRows },
    { data: caucusRows },
    { data: speakerRow },
    { data: motionRows },
    { data: docRows },
    { data: messageRows },
  ] = await Promise.all([
    supabase.from('delegates').select('*').eq('committee_id', committeeRow.id).order('country', { ascending: true }),
    // position, then created_at, then id: `position` alone is not a total order if two rows
    // ever share one (rows written before speakers_list_add existed still can), and an
    // undefined order is a queue that reshuffles on every refetch. Every queue reader uses
    // this same three-key order so all devices agree.
    supabase.from('speakers_list').select('*').eq('committee_id', committeeRow.id).eq('list_type', 'gsl')
      .order('position', { ascending: true }).order('created_at', { ascending: true }).order('id', { ascending: true }),
    supabase.from('speakers_list').select('*').eq('committee_id', committeeRow.id).eq('list_type', 'caucus')
      .order('position', { ascending: true }).order('created_at', { ascending: true }).order('id', { ascending: true }),
    supabase.from('current_speaker').select('*').eq('committee_id', committeeRow.id).maybeSingle(),
    // Include ALL pending motions, incl. the gsl-request / join-request pseudo-motions: the
    // chair's request panels and the delegate's pending-state UI read them from here. The main
    // motions feed filters them out at the display layer — do NOT exclude them at the query
    // level or request-to-speak and join requests silently break.
    supabase.from('motions').select('*').eq('committee_id', committeeRow.id).eq('status', 'pending').order('disruptiveness', { ascending: false }),
    supabase.from('documents').select('*').eq('committee_id', committeeRow.id).order('created_at', { ascending: true }),
    supabase.from('messages').select('*').eq('committee_id', committeeRow.id).order('created_at', { ascending: true }),
  ]);

  const delegates: Delegate[] = (delegateRows ?? []).map((d: DbRow) => ({
    id: d.id as string, country: d.country as string, status: d.status as DelegateStatus,
    isObserver: (d.is_observer as boolean) ?? false,
    logoUrl: (d.logo_url as string | null) ?? null,
  }));

  // GSL only — caucus list is never loaded into speakersList
  const speakersList: SpeakerEntry[] = (speakersRows ?? []).map((s: DbRow) => ({
    delegateId: s.delegate_id as string, country: s.country as string,
  }));

  // Caucus queue — separate from GSL
  const caucusQueue: SpeakerEntry[] = (caucusRows ?? []).map((s: DbRow) => ({
    delegateId: s.delegate_id as string, country: s.country as string,
  }));

  const currentSpeaker: SpeakerEntry | null = (speakerRow as DbRow | null)?.country
    ? { delegateId: (speakerRow as DbRow).delegate_id as string, country: (speakerRow as DbRow).country as string }
    : null;
  const speakerTimeRemaining = ((speakerRow as DbRow | null)?.time_remaining as number) ?? 0;
  const speakerStartedAt = ((speakerRow as DbRow | null)?.started_at as string | null) ?? null;
  const speakerSeatedAt = ((speakerRow as DbRow | null)?.seated_at as string | null) ?? null;

  // The current speaker must never also appear as a GSL queue entry (can happen after
  // a suspend/resume cycle). GSL list only — caucusQueue is left untouched.
  const gslDeduped = currentSpeaker
    ? speakersList.filter((s) => s.delegateId !== currentSpeaker.delegateId)
    : speakersList;

  const pendingMotions: PendingMotion[] = (motionRows ?? []).map((m: DbRow) => ({
    id: m.id as string, type: m.type as PendingMotionType, proposedBy: m.proposed_by as string,
    totalTime: m.total_time as number, speakingTime: m.speaking_time as number,
    topic: m.topic as string, speakerList: [], proposerPosition: null,
    tourOrder: (m.tour_order as 'asc' | 'desc' | 'custom' | null) ?? undefined,
    disruptiveness: m.disruptiveness as number,
  }));

  const documents: CommitteeDocument[] = (docRows ?? []).map((d: DbRow) => ({
    id: d.id as string, type: d.type as CommitteeDocument['type'],
    docCode: d.doc_code as string, title: d.title as string,
    sponsors: (d.sponsors as string[]) ?? [], content: (d.content as string) ?? '',
    status: d.status as DocumentStatus, submittedAt: d.created_at as string,
    fileUrl: d.file_url as string | undefined, fileName: d.file_name as string | undefined,
    presentationMinutes: d.presentation_minutes as number | undefined,
    qaMinutes: d.qa_minutes as number | undefined,
    readingMinutes: d.reading_minutes as number | undefined,
    approval: (d.approval as 'approved' | 'rejected') ?? undefined,
    introState: parseIntroState(d.intro_state),
  }));

  const messages: Committee['messages'] = (messageRows ?? []).map((m: DbRow) => ({
    id: m.id as string, sender: m.sender as string, content: m.content as string,
    timestamp: new Date(m.created_at as string), isPrivate: m.is_private as boolean,
    recipient: m.recipient as string | undefined,
  }));

  return {
    ...rowToCommittee(committeeRow, delegates, gslDeduped, caucusQueue, currentSpeaker, speakerTimeRemaining, pendingMotions, documents, messages, speakerStartedAt),
    speakerSeatedAt: currentSpeaker ? speakerSeatedAt : null,
  };
}

// ============================================================
// COMMITTEE SETTINGS (persisted to committees.settings jsonb)
// ============================================================

/**
 * THE settings writer. Sends ONLY the given keys through `patch_committee_settings`, which
 * does `settings = coalesce(settings,'{}') || patch` in one statement (SECURITY INVOKER, so
 * the `sess_chair_update` RLS still checks the x-chair-suffix header). There is no read, so
 * there is no read-modify-write race between chairs and no failed read that can wipe the
 * blob (D-1, D-2). Pass the CHANGED keys, never `getSettings(code)`.
 *
 * Keys that other writers own are dropped here defensively: `chairJoinSuffix` (the RPC
 * refuses it; use updateCommitteeChairSuffixInDB), `separateChairCode`, `agendaTopicIndex`
 * (updateCommitteeAgendaInDB) and `votingReturnPhase` (set_committee_voting_phase).
 * `headChair` / `headChairDevice` go through updateCommitteeHeadChairInDB.
 *
 * Returns true only when the row was really updated (false on an RLS refusal, which
 * supabase-js does not report as an error).
 */
export async function patchCommitteeSettings(committeeId: string, patch: Record<string, unknown>, code: string, chairSuffix?: string): Promise<boolean> {
  // V3: remembered so this device's own realtime echo is not mistaken for another chair's change.
  noteFlushedSettings(committeeId, patch);
  const { data, error } = await sessionClient(code, chairSuffix)
    .rpc('patch_committee_settings', { p_committee: committeeId, p_patch: patch });
  if (error) { console.error('Error patching committee settings:', error); return false; }
  return data === true;
}

export async function saveCommitteeSettings(committeeId: string, settings: object, code: string, chairSuffix?: string): Promise<boolean> {
  const patch: Record<string, unknown> = { ...(settings as Record<string, unknown>) };
  for (const k of ['chairJoinSuffix', 'separateChairCode', 'headChair', 'headChairDevice', 'agendaTopicIndex', 'votingReturnPhase']) delete patch[k];
  if (Object.keys(patch).length === 0) return true;
  return patchCommitteeSettings(committeeId, patch, code, chairSuffix);
}

// ============================================================
// PHASE MANAGEMENT
// ============================================================

// Every write below resolves with whether it LANDED (see src/lib/writeStatus.ts, audit R-5).
// supabase-js resolves on an RLS rejection and reports `error: null` for a zero-row update,
// so each one asks for `.select('id')` and counts rows. Callers that only want
// fire-and-forget keep ignoring the value; failures are reported to the chair page's
// "Not saved" toast either way.
const phaseKey = (committeeId: string) => `${committeeId}:phase`;
const caucusKey = (committeeId: string) => `${committeeId}:caucus`;
const speakerKey = (committeeId: string) => `${committeeId}:speaker`;
const lifecycleKey = (committeeId: string) => `${committeeId}:lifecycle`;

/** Phases in which no speaker clock may keep running (audit G-4). The GSL and both caucus
 *  phases own the speaker clock; nothing else does. */
const CLOCKLESS_PHASES: SessionPhase[] = ['pre-session', 'adjourned', 'voting'];

/** Zero rows from a write guarded on `ended_at is null and suspended_at is null`: was it the
 *  guard (the room is on a break now: a correct no-op) or a refusal (RLS)? SELECT is public. */
async function lifecycleGuardOutcome(committeeId: string): Promise<WriteResult> {
  const { data: row, error } = await supabase.from('committees')
    .select('suspended_at, ended_at').eq('id', committeeId).maybeSingle();
  if (error || !row) return 'failed';
  return row.ended_at || row.suspended_at ? 'skipped' : 'failed';
}

// S2: phase and caucus writes are refused by the database once the committee is suspended
// or ended, so a write still retrying from before a Suspend / End (venue Wi-Fi) can never
// reopen the room behind the break. No caller writes a live phase or caucus during a break:
// the resume path goes through startResumeRollCall / beginSessionAfterRollCall, and the
// break itself through suspendDebate / endDebate.
export async function setPhase(committeeId: string, phase: SessionPhase, code: string, chairSuffix?: string): Promise<boolean> {
  const r = await runWrite(phaseKey(committeeId), async () => {
    const { data, error } = await sessionClient(code, chairSuffix).from('committees')
      .update({ phase }).eq('id', committeeId).is('ended_at', null).is('suspended_at', null).select('id');
    if (error) { console.error('Error setting phase:', error); return 'failed'; }
    return rowsOf(data) > 0 ? 'ok' : lifecycleGuardOutcome(committeeId);
  }, { retry: true });
  if (r === 'ok' && CLOCKLESS_PHASES.includes(phase)) void pauseSpeakerClockLive(committeeId, code, chairSuffix);
  return r !== 'failed';
}

/** Phase and caucus in ONE update (audit R-7), so no reader ever sees a caucus phase
 *  without its caucus, or the GSL with a caucus clock, and a failure cannot leave the two
 *  disagreeing. Use it wherever both change together: accepting a caucus motion, ending a
 *  caucus by hand or by expiry, and beginning the session after a resume. */
export async function setPhaseAndCaucus(
  committeeId: string, phase: SessionPhase, caucus: CaucusState | null,
  code: string, chairSuffix?: string,
): Promise<boolean> {
  const r = await runWrite([phaseKey(committeeId), caucusKey(committeeId)], async () => {
    const { data, error } = await sessionClient(code, chairSuffix).from('committees')
      .update({ phase, caucus }).eq('id', committeeId).is('ended_at', null).is('suspended_at', null).select('id');
    if (error) { console.error('Error setting phase and caucus:', error); return 'failed'; }
    return rowsOf(data) > 0 ? 'ok' : lifecycleGuardOutcome(committeeId);
  }, { retry: true });
  if (r === 'ok' && CLOCKLESS_PHASES.includes(phase)) void pauseSpeakerClockLive(committeeId, code, chairSuffix);
  return r !== 'failed';
}

/** R-6: end a moderated caucus by EXPIRY only while the stored row is still the caucus the
 *  chair's effect saw (still `moderated-caucus`, same total-clock anchor). Phase and caucus
 *  in one statement (R-7). Runs through `runWrite` on the same keys as `setPhaseAndCaucus`:
 *    - 'ok'      a row was updated (resolves true);
 *    - 'skipped' nothing matched because the caucus had moved on (a new caucus, a pause, an
 *                extend, a manual end). A correct no-op, NOT reported (resolves false);
 *    - 'failed'  a transport error, or zero rows while the row still matches (RLS refused
 *                it). Retried, then reported to the "Not saved" toast (resolves false).
 *  The one fallback when the caller has no anchor is `setPhaseAndCaucus`, never both. */
export async function endModeratedCaucusIfAnchorUnchanged(
  committeeId: string, expectedTotalStartedAt: string, code: string, chairSuffix?: string,
): Promise<boolean> {
  const r = await runWrite([phaseKey(committeeId), caucusKey(committeeId)], async () => {
    const { data, error } = await sessionClient(code, chairSuffix).from('committees')
      .update({ phase: 'speakers-list', caucus: null })
      .eq('id', committeeId)
      .eq('phase', 'moderated-caucus')
      .eq('caucus->>totalStartedAt', expectedTotalStartedAt)
      .select('id');
    if (error) { console.error('Error ending caucus (conditional):', error); return 'failed'; }
    if (rowsOf(data) > 0) return 'ok';
    // Zero rows: moved on (skip) or refused (fail)? SELECT is public, so look.
    const { data: row, error: readErr } = await supabase.from('committees')
      .select('phase, caucus').eq('id', committeeId).maybeSingle();
    if (readErr) return 'failed';
    const stillMatches = row?.phase === 'moderated-caucus'
      && (row.caucus as CaucusState | null)?.totalStartedAt === expectedTotalStartedAt;
    return stillMatches ? 'failed' : 'skipped';
  }, { retry: true });
  return r === 'ok';
}

/** Begin (or resume) debate after a roll call. A caucus that was paused by a suspension
 *  comes back as its own phase, still paused, so the dais presses play when the room is
 *  ready. With no caucus the GSL opens and `caucus` is written null explicitly, and any
 *  leftover caucus queue rows are cleared, so no caucus data survives into the GSL
 *  (audit C-1). Conditional on still being in roll call: a stale second press is a no-op.
 *  Resolves with the phase the committee is now in, or null when the write failed. */
export async function beginSessionAfterRollCall(
  committeeId: string, code: string, chairSuffix?: string,
): Promise<SessionPhase | null> {
  let landed: SessionPhase | null = null;
  const r = await runWrite([phaseKey(committeeId), caucusKey(committeeId)], async () => {
    const { data: row, error: readErr } = await supabase.from('committees')
      .select('phase, caucus').eq('id', committeeId).maybeSingle();
    if (readErr || !row) { console.error('Error reading committee before begin:', readErr); return 'failed'; }
    if (row.phase !== 'pre-session') { landed = row.phase as SessionPhase; return 'skipped'; }
    let caucus = (row.caucus as CaucusState | null) ?? null;
    // A caucus suspended before suspend paused its clock (or left behind by an old
    // two-write caucus end) may still carry a running anchor. Pause it at its live value;
    // one with no time left is over, not something to restore.
    if (caucus) caucus = freezeCaucusForBreak(caucus, 0, null);
    if (caucus && !(caucus.remainingTime > 0)) caucus = null;
    const phase: SessionPhase = caucus ? phaseForCaucus(caucus) : 'speakers-list';
    const { data, error } = await sessionClient(code, chairSuffix).from('committees')
      .update({ phase, caucus }).eq('id', committeeId).eq('phase', 'pre-session').select('id');
    if (error) { console.error('Error beginning session:', error); return 'failed'; }
    if (rowsOf(data) === 0) return 'failed';
    landed = phase;
    return 'ok';
  }, { retry: true });
  if (r === 'failed') return null;
  if (landed === 'speakers-list') void clearCaucusList(committeeId, code, chairSuffix);
  return landed;
}

// ============================================================
// ROLL CALL
// ============================================================

// Returns whether the write actually landed. Every caller that only wants fire-and-forget
// can keep ignoring the value; the delegate page uses it to refund the rate-limit slot and
// roll its optimistic status back when the write is rejected (e.g. by RLS).
export async function setDelegateStatus(delegateId: string, status: DelegateStatus, code: string, chairSuffix?: string): Promise<boolean> {
  // Zero rows is a rejection here (the id exists), not a no-op. Not auto-retried: a status
  // tap is superseded by the next tap within seconds, and the delegate page rolls back.
  const r = await runWrite(`delegate:${delegateId}:status`, async () => {
    const { data, error } = await sessionClient(code, chairSuffix).from('delegates')
      .update({ status }).eq('id', delegateId).select('id');
    if (error) { console.error('Error setting delegate status:', error); return 'failed'; }
    return rowsOf(data) > 0 ? 'ok' : 'failed';
  }, { retry: false });
  return r !== 'failed';
}

export async function setDelegateObserver(delegateId: string, isObserver: boolean, code: string, chairSuffix?: string): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('delegates').update({ is_observer: isObserver }).eq('id', delegateId);
  if (error) console.error('Error setting delegate observer:', error);
}

export async function batchSetDelegateStatuses(
  updates: { id: string; status: DelegateStatus }[],
  code: string,
  chairSuffix?: string,
): Promise<void> {
  await Promise.all(updates.map(({ id, status }) => setDelegateStatus(id, status, code, chairSuffix)));
}

// ============================================================
// GSL — General Speakers List (list_type = 'gsl')
// Never touched by caucuses or motions
// ============================================================

// ── Queue positions: ONE scheme, assigned by the database ─────────────────────
// Positions used to come from three incompatible sources: `queue.length + 1` from the
// chair's caucus add paths, `Date.now()` as the default here, and 1..n from a reorder.
// A removal or a Next leaves a gap, so `length + 1` landed ON an existing position
// (production, QKUHGA, 14 Sep 2026: two caucus rows at 4 and two at 5), and two rows
// with the same position have no defined order — every refetch could shuffle them on
// every device. `speakers_list_add` computes max+1 (or min-1 for "add first") under a
// per-list advisory lock, so two devices appending at once can never collide.
// It is SECURITY INVOKER: the unchanged RLS on speakers_list still decides who may write.
export type SpeakerListType = 'gsl' | 'caucus';

// ── Ordered fire-and-forget writes ────────────────────────────────────────────
// Writes that share a key reach the server in the order they were ISSUED: each waits for
// the previous one to settle. Used per list (an add then a drag must not reorder before
// the insert exists) and per committee for current_speaker (a late stop-at-zero must not
// land after the Next that followed it). The chain swallows and logs errors, so a
// fire-and-forget caller never sees an unhandled rejection and one failed write never
// blocks the next.
const writeChains = new Map<string, Promise<unknown>>();
async function chained<T = void>(key: string, fn: () => Promise<T>, onError?: T): Promise<T> {
  const prev = writeChains.get(key) ?? Promise.resolve();
  const run: Promise<T> = prev.catch(() => undefined).then(fn).catch((err) => {
    console.error(`Queued write failed (${key}):`, err);
    return onError as T;
  });
  writeChains.set(key, run);
  try { return await run; } finally { if (writeChains.get(key) === run) writeChains.delete(key); }
}

/** A DELETE that removed nothing is ambiguous: the row may already be gone (another chair,
 *  a double tap) or RLS may have refused it. SELECT is public on every session table, so
 *  look: still there means the delete was refused. */
async function deleteOutcome(
  deleted: unknown, error: { message?: string } | null, label: string,
  stillThere: () => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<WriteResult> {
  if (error) { console.error(`Error ${label}:`, error); return 'failed'; }
  if (rowsOf(deleted) > 0) return 'ok';
  const { data, error: readErr } = await stillThere();
  if (readErr) return 'failed';
  return rowsOf(data) > 0 ? 'failed' : 'skipped';
}
const listChainKey = (committeeId: string, listType: SpeakerListType) => `${committeeId}:list:${listType}`;
const currentSpeakerChainKey = (committeeId: string) => `${committeeId}:current_speaker`;

async function addToQueue(
  committeeId: string, delegateId: string, country: string, listType: SpeakerListType,
  at: 'start' | 'end', code: string, chairSuffix?: string,
): Promise<boolean> {
  // Retried: `speakers_list_add` is idempotent (ON CONFLICT DO NOTHING), and the retry stays
  // inside the list chain, so a later drag still cannot run before this insert exists.
  // Room-Order placeholders cannot be stored (uuid column); that is known, not a failure.
  if (!UUID_RE.test(delegateId)) return false;
  const r = await chained(listChainKey(committeeId, listType), () => runWrite(
    `${committeeId}:list:${listType}:${delegateId}`,
    () => addToQueueNow(committeeId, delegateId, country, listType, at, code, chairSuffix),
    { retry: true },
  ), 'failed' as WriteResult);
  return r !== 'failed';
}

async function addToQueueNow(
  committeeId: string, delegateId: string, country: string, listType: SpeakerListType,
  at: 'start' | 'end', code: string, chairSuffix?: string,
): Promise<WriteResult> {
  const client = sessionClient(code, chairSuffix);
  const { error } = await client.rpc('speakers_list_add', {
    p_committee: committeeId, p_delegate: delegateId, p_country: country,
    p_list_type: listType, p_at: at,
  });
  // An RLS-refused INSERT inside the RPC raises, so no error here means the row exists.
  if (!error) return 'ok';
  // Fallback only if the RPC itself is unavailable. Date.now() is still monotonic enough
  // to append after a 1..n reorder; its negative prepends.
  if (error.code === 'PGRST202' || error.code === '42883') {
    const { error: insErr } = await client.from('speakers_list').insert({
      committee_id: committeeId, delegate_id: delegateId, country,
      position: at === 'start' ? -Date.now() : Date.now(), list_type: listType,
    });
    if (insErr && insErr.code !== '23505') { console.error(`Error adding to ${listType} list:`, insErr); return 'failed'; }
    return 'ok';
  }
  console.error(`Error adding to ${listType} list:`, error);
  return 'failed';
}

/** Append to the GSL (`at: 'end'`, the default) or put a delegate first (`'start'`). */
export async function addToSpeakersList(committeeId: string, delegateId: string, country: string, code: string, chairSuffix?: string, at: 'start' | 'end' = 'end'): Promise<boolean> {
  return addToQueue(committeeId, delegateId, country, 'gsl', at, code, chairSuffix);
}

async function removeFromQueue(committeeId: string, delegateId: string, listType: SpeakerListType, code: string, chairSuffix?: string): Promise<boolean> {
  // Ordered on the list chain like the add, so an add-then-remove cannot land reversed.
  // Not auto-retried: a refused delete is reported; a row already gone is a success.
  // Room-Order placeholders ("room-order-3") were never stored (uuid column): nothing to do.
  if (!UUID_RE.test(delegateId)) return true;
  const r = await chained(listChainKey(committeeId, listType), () => runWrite(
    `${committeeId}:list:${listType}:${delegateId}`,
    async () => {
      const { data, error } = await sessionClient(code, chairSuffix).from('speakers_list').delete()
        .eq('committee_id', committeeId).eq('delegate_id', delegateId).eq('list_type', listType).select('id');
      return deleteOutcome(data, error, `removing from ${listType} list`, () => supabase.from('speakers_list').select('id')
        .eq('committee_id', committeeId).eq('delegate_id', delegateId).eq('list_type', listType).limit(1));
    },
    { retry: false },
  ), 'failed' as WriteResult);
  return r !== 'failed';
}

export async function removeFromSpeakersList(committeeId: string, delegateId: string, code: string, chairSuffix?: string): Promise<boolean> {
  return removeFromQueue(committeeId, delegateId, 'gsl', code, chairSuffix);
}

// ============================================================
// CAUCUS LIST (list_type = 'caucus')
// Temporary — per-motion, wiped when caucus ends, GSL untouched
// ============================================================

/** Append to the caucus queue (`at: 'end'`, the default) or put a delegate first. */
export async function addToCaucusList(committeeId: string, delegateId: string, country: string, code: string, chairSuffix?: string, at: 'start' | 'end' = 'end'): Promise<boolean> {
  return addToQueue(committeeId, delegateId, country, 'caucus', at, code, chairSuffix);
}

// Batch insert entire caucus list at once — avoids sequential await rate limits
export async function batchAddToCaucusList(
  committeeId: string,
  delegates: { delegateId: string; country: string }[],
  code: string,
  chairSuffix?: string,
): Promise<void> {
  if (delegates.length === 0) return;
  const rows = delegates.map((d, i) => ({
    committee_id: committeeId,
    delegate_id: d.delegateId,
    country: d.country,
    position: i + 1,
    list_type: 'caucus',
  }));
  const { error } = await sessionClient(code, chairSuffix).from('speakers_list').insert(rows);
  if (error) console.error('Error batch adding to caucus list:', error);
}

export async function removeFromCaucusList(committeeId: string, delegateId: string, code: string, chairSuffix?: string): Promise<boolean> {
  return removeFromQueue(committeeId, delegateId, 'caucus', code, chairSuffix);
}

export async function clearCaucusList(committeeId: string, code: string, chairSuffix?: string): Promise<boolean> {
  // Idempotent (clearing an empty queue is still a cleared queue), so retried.
  const r = await chained(listChainKey(committeeId, 'caucus'), () => runWrite(
    `${committeeId}:list:caucus:clear`,
    async () => {
      const { data, error } = await sessionClient(code, chairSuffix).from('speakers_list').delete()
        .eq('committee_id', committeeId).eq('list_type', 'caucus').select('id');
      return deleteOutcome(data, error, 'clearing caucus list', () => supabase.from('speakers_list').select('id')
        .eq('committee_id', committeeId).eq('list_type', 'caucus').limit(1));
    },
    // Never re-run from the toast (S3): minutes later it would wipe a NEW caucus queue.
    { retry: true, rerunnable: false },
  ), 'failed' as WriteResult);
  return r !== 'failed';
}

export async function reorderSpeakersList(
  committeeId: string,
  entries: { delegateId: string; country: string }[],
  code: string,
  chairSuffix?: string,
  listType: 'gsl' | 'caucus' = 'gsl',
): Promise<boolean> {
  if (entries.length === 0) return true;
  // In place, never DELETE + INSERT (a DELETE realtime event flashes an empty list on
  // delegate phones). It used to be N parallel single-row updates: a refetch landing
  // mid-batch read half-old/half-new positions, and two quick drags interleaved into
  // DUPLICATE positions that then shuffled on every refetch. `speakers_list_reorder` is
  // one statement under the same per-list lock as the add, and rows this device did not
  // know about keep their order after the listed ones, so no two rows can share a position.
  //
  // Chained per list, on the SAME chain as the add: two drags fired back to back must reach
  // the server in the order the chair made them (or the OLDER order could land last and
  // stick), and a drag right after an add must not run before the insert exists.
  //
  // Retried (the same order applied twice is the same order). The RPC returns void and an
  // RLS-refused UPDATE inside it is silent, so a refusal looked exactly like success. After
  // the RPC, the stored order of the listed rows is read back (SELECT is public) and
  // compared: a mismatch is reported as a failure through writeStatus (the "Not saved"
  // toast) and retried. Rows that vanished meanwhile (a Next, a removal) are ignored.
  const ids = entries.map((e) => e.delegateId).filter((id) => UUID_RE.test(id));
  if (ids.length === 0) return true;
  const r = await chained(listChainKey(committeeId, listType), () => runWrite(
    `${committeeId}:list:${listType}:order`,
    async () => {
      const client = sessionClient(code, chairSuffix);
      const { error } = await client.rpc('speakers_list_reorder', {
        p_committee: committeeId, p_delegate_ids: ids, p_list_type: listType,
      });
      if (!error) {
        const { data: rows, error: readErr } = await supabase.from('speakers_list')
          .select('delegate_id').eq('committee_id', committeeId).eq('list_type', listType)
          .order('position', { ascending: true });
        if (readErr || !rows) return 'ok';   // cannot verify: do not invent a failure
        const wanted = new Set(ids);
        const stored = (rows as { delegate_id: string }[]).map((x) => x.delegate_id).filter((id) => wanted.has(id));
        const present = new Set(stored);
        const expected = ids.filter((id, i) => ids.indexOf(id) === i && present.has(id));
        if (stored.every((id, i) => id === expected[i])) return 'ok';
        console.error('Reorder did not land (refused, or overtaken by another device).');
        return 'failed';
      }
      if (error.code === 'PGRST202' || error.code === '42883') {
        // RPC unavailable: sequential (not parallel) updates, so at least no interleaving.
        for (let i = 0; i < ids.length; i++) {
          const { error: upErr } = await client.from('speakers_list').update({ position: i + 1 })
            .eq('committee_id', committeeId).eq('delegate_id', ids[i]).eq('list_type', listType);
          if (upErr) return 'failed';
        }
        return 'ok';
      }
      console.error('Error reordering speakers list:', error);
      return 'failed';
    },
    { retry: true },
  ), 'failed' as WriteResult);
  return r !== 'failed';
}

// ============================================================
// DELEGATES
// ============================================================

export async function addDelegate(committeeId: string, country: string, code: string, chairSuffix?: string): Promise<string | null> {
  const { data, error } = await sessionClient(code, chairSuffix).from('delegates')
    .insert({ committee_id: committeeId, country, status: 'absent', is_observer: false })
    .select('id').single();
  if (error) { console.error('Error adding delegate:', error); return null; }
  return data.id as string;
}

// ============================================================
// CURRENT SPEAKER + TIMER
// ============================================================

export async function nextSpeaker(
  committeeId: string,
  speakerTimeLimit: number,
  nextDelegateId: string | null,
  nextCountry: string | null,
  removeDelegateId: string | null,
  code: string,
  chairSuffix?: string,
  /** The seat nonce (S7). Pass the value the caller put into local state, so this device's
   *  turn key and every reader's agree. Ignored (written null) when nobody is seated. */
  seatedAt: string = serverNowIso(),
): Promise<boolean> {
  // HAPPENS-BEFORE GUARD (MUST NEVER HAPPEN #5). Rule #5 forbids firing a blind
  // clearCurrentSpeaker when entering a caucus because it races nextSpeakerInDB: two
  // unordered fire-and-forget writes to the same row, last one wins, and a late clear
  // wipes the caucus speaker. This guard removes the concurrency entirely — every
  // current_speaker write this device issues (the conditional clear included, start, stop,
  // sync, the stop-at-zero, the anchor read for speech logging) rides ONE chain, so a write
  // issued before this Next is drained before we seat anyone and can never land after it.
  // (This used to be a separate in-flight promise for the clear alone; the chain subsumes it.)
  const r = await chained(currentSpeakerChainKey(committeeId), async () => {
    // Retried as a unit: seating a speaker with a fixed clock and deleting a GSL row are
    // both idempotent. `time_granted` starts at the slot (audit T-3).
    return runWrite(speakerKey(committeeId), async () => {
      const client = sessionClient(code, chairSuffix);
      const limit = Math.max(0, Math.round(speakerTimeLimit));
      const [removed, seated] = await Promise.all([
        removeDelegateId && UUID_RE.test(removeDelegateId)
          ? client.from('speakers_list').delete()
              .eq('committee_id', committeeId)
              .eq('delegate_id', removeDelegateId)
              .eq('list_type', 'gsl')
              .select('id')
              .then(({ data, error }) => deleteOutcome(data, error, 'removing the called speaker from the GSL',
                () => supabase.from('speakers_list').select('id').eq('committee_id', committeeId)
                  .eq('delegate_id', removeDelegateId).eq('list_type', 'gsl').limit(1)))
          : Promise.resolve<WriteResult>('skipped'),
        client.from('current_speaker')
          .update({
            delegate_id: nextDelegateId,
            country: nextCountry,
            time_remaining: limit,
            time_granted: limit,
            started_at: null,
            seated_at: nextCountry ? seatedAt : null,
          })
          .eq('committee_id', committeeId)
          .select('committee_id')
          .then(({ data, error }): WriteResult => {
            if (error) { console.error('Error seating next speaker:', error); return 'failed'; }
            return rowsOf(data) > 0 ? 'ok' : 'failed';
          }),
      ]);
      return removed === 'failed' || seated === 'failed' ? 'failed' : 'ok';
    }, { retry: true });
  }, 'failed' as WriteResult);
  return r !== 'failed';
}

/** One current_speaker update on the chain, retried, row-counted. */
function speakerClockWrite(
  committeeId: string, patch: Record<string, unknown>, label: string,
  code: string, chairSuffix?: string,
): Promise<boolean> {
  return chained(currentSpeakerChainKey(committeeId), () => runWrite(speakerKey(committeeId), async () => {
    const { data, error } = await sessionClient(code, chairSuffix).from('current_speaker')
      .update(patch).eq('committee_id', committeeId).select('committee_id');
    if (error) { console.error(`Error ${label}:`, error); return 'failed'; }
    return rowsOf(data) > 0 ? 'ok' : 'failed';
  }, { retry: true }), 'failed' as WriteResult).then((r) => r !== 'failed');
}

// Sync time_remaining to DB at structural moments (restart, a new time limit).
// tickSpeakerTimer removed — per-second DB writes caused excessive realtime events.
// Pass `timeGranted` when the clock is reset to a fresh slot (restart, new limit), so the
// persisted grant matches the clock it describes (audit T-3).
// `stop` also nulls started_at in the SAME update (restart: one write, not stop-then-sync,
// so no reader ever sees a stopped clock with the old base).
export async function syncSpeakerTime(committeeId: string, timeRemaining: number, code: string, chairSuffix?: string, timeGranted?: number, stop = false): Promise<boolean> {
  const patch: Record<string, unknown> = { time_remaining: Math.max(0, Math.round(timeRemaining)) };
  if (typeof timeGranted === 'number') patch.time_granted = Math.max(0, Math.round(timeGranted));
  if (stop) patch.started_at = null;
  return speakerClockWrite(committeeId, patch, 'syncing speaker time', code, chairSuffix);
}

/** PAUSE the speaker clock in ONE update: `started_at` null and `time_remaining` the live
 *  value, together (audit G-3). As two writes, phones briefly saw the clock jump back to
 *  its old base, and if the second failed a reload handed the speaker their time back. */
export async function pauseSpeakerTimer(committeeId: string, timeRemaining: number, code: string, chairSuffix?: string): Promise<boolean> {
  return speakerClockWrite(committeeId, { started_at: null, time_remaining: Math.max(0, Math.round(timeRemaining)) }, 'pausing speaker timer', code, chairSuffix);
}

/** Pause whatever speaker clock the DATABASE says is running, at its live value. Used when
 *  the session leaves every clock-owning phase (suspend, end, roll call, voting), where no
 *  local anchor can be trusted (audit G-4). Conditional on the anchor it read, so it can
 *  never overwrite a clock that was restarted meanwhile. On the current_speaker chain. */
export async function pauseSpeakerClockLive(committeeId: string, code: string, chairSuffix?: string): Promise<boolean> {
  const r = await chained(currentSpeakerChainKey(committeeId), () => runWrite(`${speakerKey(committeeId)}:live-pause`, async () => {
    const { data: row, error: readErr } = await supabase.from('current_speaker')
      .select('time_remaining, started_at').eq('committee_id', committeeId).maybeSingle();
    if (readErr) return 'failed';
    if (!row?.started_at) return 'skipped';
    const live = speakerRemainingNow(row.time_remaining as number, row.started_at as string);
    const { data, error } = await sessionClient(code, chairSuffix).from('current_speaker')
      .update({ started_at: null, time_remaining: live })
      .eq('committee_id', committeeId).eq('started_at', row.started_at as string)
      .select('committee_id');
    if (error) { console.error('Error pausing speaker clock:', error); return 'failed'; }
    if (rowsOf(data) > 0) return 'ok';
    // Zero rows: restarted or paused meanwhile (skip), or refused while unchanged (fail).
    const { data: again, error: againErr } = await supabase.from('current_speaker')
      .select('started_at').eq('committee_id', committeeId).maybeSingle();
    if (againErr) return 'failed';
    const same = !!again?.started_at && new Date(again.started_at as string).getTime() === new Date(row.started_at as string).getTime();
    return same ? 'failed' : 'skipped';
  // Automatic and context-bound: never re-run from the toast (S3), and part of a break.
  }, { retry: true, rerunnable: false, survivesLifecycle: true }), 'failed' as WriteResult);
  return r !== 'failed';
}

/** Add time to the current speaker and re-anchor, persisting the grant with the clock
 *  (audit T-3). `startedAt` null writes a paused clock. The grant is added to the stored
 *  `time_granted` (read, then written on the same chain); a legacy row with no grant
 *  stays null so readers fall back. */
export async function grantSpeakerTime(
  committeeId: string, seconds: number, timeRemaining: number, startedAt: string | null,
  code: string, chairSuffix?: string,
): Promise<boolean> {
  const add = Math.max(0, Math.round(seconds));
  const r = await chained(currentSpeakerChainKey(committeeId), () => runWrite(speakerKey(committeeId), async () => {
    const { data: row, error: readErr } = await supabase.from('current_speaker')
      .select('time_granted').eq('committee_id', committeeId).maybeSingle();
    if (readErr) return 'failed';
    const granted = typeof row?.time_granted === 'number' ? (row.time_granted as number) + add : null;
    const { data, error } = await sessionClient(code, chairSuffix).from('current_speaker')
      .update({ started_at: startedAt, time_remaining: Math.max(0, Math.round(timeRemaining)), time_granted: granted })
      .eq('committee_id', committeeId).select('committee_id');
    if (error) { console.error('Error granting speaker time:', error); return 'failed'; }
    return rowsOf(data) > 0 ? 'ok' : 'failed';
  }, { retry: false }), 'failed' as WriteResult);
  // Not auto-retried: re-reading the grant and adding again would double it.
  return r !== 'failed';
}

/** The seconds the current speaker has spoken, read from the persisted anchor on the
 *  current_speaker chain, so it sees every clock write this device issued before it (a
 *  pause, a grant) and none issued after (the Next). Null when the row cannot be read,
 *  names nobody, or predates `time_granted`: fall back to local accounting then.
 *  The T-3 primitive behind `logFloorSpeech` (src/lib/floorSpeech.ts), which is the ONLY
 *  speech logger: never log a speech from here directly. */
export async function readSpokenSeconds(committeeId: string): Promise<{
  delegateId: string | null; country: string; seconds: number;
} | null> {
  return chained(currentSpeakerChainKey(committeeId), async () => {
    const { data: row, error } = await supabase.from('current_speaker')
      .select('delegate_id, country, time_remaining, started_at, time_granted')
      .eq('committee_id', committeeId).maybeSingle();
    if (error || !row?.country) return null;
    const seconds = spokenSecondsFromAnchor(row.time_granted as number | null, row.time_remaining as number, row.started_at as string | null);
    if (seconds === null) return null;
    return { delegateId: (row.delegate_id as string | null) ?? null, country: row.country as string, seconds };
  }, null);
}

/** A speaker's clock ran out: park current_speaker at a literal 0 (started_at null,
 *  time_remaining 0) ONLY IF the row still holds that speaker. One statement, on the
 *  current_speaker chain, so it cannot land after a Next issued later, and if a Next landed
 *  first the identity predicate matches nothing. */
export async function stopSpeakerAtZeroIfUnchanged(
  committeeId: string, expectedDelegateId: string | null, expectedCountry: string | null,
  code: string, chairSuffix?: string,
): Promise<boolean> {
  if (!expectedDelegateId && !expectedCountry) return true;
  // Zero rows means a Next landed first: a correct no-op, not a failure.
  const r = await chained(currentSpeakerChainKey(committeeId), () => runWrite(speakerKey(committeeId), async () => {
    let q = sessionClient(code, chairSuffix).from('current_speaker')
      .update({ started_at: null, time_remaining: 0 })
      .eq('committee_id', committeeId);
    if (expectedDelegateId && UUID_RE.test(expectedDelegateId)) q = q.eq('delegate_id', expectedDelegateId);
    else if (expectedCountry) q = q.eq('country', expectedCountry);
    else return 'skipped';
    const { data, error } = await q.select('committee_id');
    if (error) { console.error('Error stopping speaker at zero:', error); return 'failed'; }
    if (rowsOf(data) > 0) return 'ok';
    return speakerStillMatches(committeeId, expectedDelegateId, expectedCountry);
  }, { retry: true }), 'failed' as WriteResult);
  return r !== 'failed';
}

/** Arm the speaker clock.
 *
 *  `timeRemaining` and `startedAt` are written TOGETHER and are the complete anchor:
 *  every surface renders `speakerRemainingNow(time_remaining, started_at)`, so both
 *  halves have to describe the same instant or the readers disagree. Writing only
 *  `started_at` (as this used to) left the base at whatever the last sync happened to
 *  store, which is why a resumed speaker could jump.
 *
 *  `startedAt` is supplied by the caller rather than stamped here so the chair's own
 *  local anchor and the persisted one are the SAME string — the chair is then just
 *  another reader of the anchor it wrote, and cannot drift away from its own delegates. */
export async function startSpeakerTimer(
  committeeId: string, code: string, chairSuffix?: string,
  startedAt: string = serverNowIso(), timeRemaining?: number,
): Promise<boolean> {
  const patch: Record<string, unknown> = { started_at: startedAt };
  if (typeof timeRemaining === 'number') patch.time_remaining = Math.max(0, Math.round(timeRemaining));
  return speakerClockWrite(committeeId, patch, 'starting speaker timer', code, chairSuffix);
}

/** Stop the clock WITHOUT recording where it stopped. Prefer `pauseSpeakerTimer`, which
 *  writes the live value in the same update (audit G-3); this remains for callers that
 *  follow it with a write that seats a fresh clock anyway (Next, restart). */
export async function stopSpeakerTimer(committeeId: string, code: string, chairSuffix?: string): Promise<boolean> {
  return speakerClockWrite(committeeId, { started_at: null }, 'stopping speaker timer', code, chairSuffix);
}

export async function clearCurrentSpeaker(committeeId: string, code: string, chairSuffix?: string): Promise<boolean> {
  return speakerClockWrite(committeeId, { delegate_id: null, country: null, time_remaining: 0, started_at: null, seated_at: null }, 'clearing current speaker', code, chairSuffix);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Zero rows from a conditional current_speaker write: does the row still hold the speaker
 *  the predicate named? Yes means the write was REFUSED ('failed', reported); no means a Next
 *  or a clear landed first ('skipped', a correct silent no-op). SELECT is public. */
async function speakerStillMatches(
  committeeId: string, expectedDelegateId: string | null, expectedCountry: string | null,
): Promise<WriteResult> {
  const { data: row, error } = await supabase.from('current_speaker')
    .select('delegate_id, country').eq('committee_id', committeeId).maybeSingle();
  if (error) return 'failed';
  if (!row) return 'skipped';
  const matches = expectedDelegateId && UUID_RE.test(expectedDelegateId)
    ? row.delegate_id === expectedDelegateId
    : !!expectedCountry && row.country === expectedCountry;
  return matches ? 'failed' : 'skipped';
}

/**
 * Clear current_speaker ONLY IF the row still holds the speaker the caller saw.
 *
 * This is the caucus-lifecycle-safe replacement for clearCurrentSpeaker(), which
 * MUST NEVER HAPPEN #5 forbids on caucus entry. Two independent properties make it
 * race-free where the blind clear was not:
 *
 *  1. CONDITIONAL — the UPDATE carries a predicate on the speaker's identity
 *     (delegate_id, or country for Room-Order "Speaker N" placeholders whose ids are not
 *     uuids). If a nextSpeaker() write has already seated somebody else, the predicate
 *     matches zero rows and the clear is a silent no-op. It can only ever erase the
 *     exact speaker the caller intended to erase.
 *  2. ORDERED — it rides the current_speaker write chain with nextSpeaker() and every
 *     clock write, so a clear can never be overtaken by, or overtake, a seat issued
 *     after it (and a clear issued after a seat is a no-op by property 1).
 *
 * Together: a late clear is a no-op, and a clear cannot be late relative to any seat
 * issued after it. Passing expectedDelegateId=null and expectedCountry=null is a no-op
 * (nothing was on the floor, nothing to clear).
 */
export async function clearCurrentSpeakerIfUnchanged(
  committeeId: string,
  expectedDelegateId: string | null,
  expectedCountry: string | null,
  code: string,
  chairSuffix?: string,
): Promise<boolean> {
  if (!expectedDelegateId && !expectedCountry) return true;
  // Retried (a conditional clear is idempotent); zero rows = someone else was seated, a
  // correct no-op. The retries stay on the chain, so a later Next still waits for them.
  const run = chained(currentSpeakerChainKey(committeeId), () => runWrite(speakerKey(committeeId), async () => {
    let q = sessionClient(code, chairSuffix).from('current_speaker')
      .update({ delegate_id: null, country: null, time_remaining: 0, started_at: null, seated_at: null })
      .eq('committee_id', committeeId);
    // delegate_id is a uuid column — a Room-Order placeholder id ("room-order-3") would be
    // a 22P02 cast error, so fall back to the country text for those.
    if (expectedDelegateId && UUID_RE.test(expectedDelegateId)) q = q.eq('delegate_id', expectedDelegateId);
    else if (expectedCountry) q = q.eq('country', expectedCountry);
    else return 'skipped';
    const { data, error } = await q.select('committee_id');
    if (error) { console.error('Error clearing current speaker:', error); return 'failed'; }
    if (rowsOf(data) > 0) return 'ok';
    return speakerStillMatches(committeeId, expectedDelegateId, expectedCountry);
  // Part of a break (Suspend / End clear the floor), so a Suspend never cancels its retries.
  }, { retry: true, survivesLifecycle: true }), 'failed' as WriteResult);
  return (await run) !== 'failed';
}

// Lightweight single-row fetch of just the current speaker — used by Commenter views
// to react to current_speaker realtime events without a full committee refetch.
export async function getCurrentSpeakerRow(committeeId: string): Promise<{
  currentSpeaker: SpeakerEntry | null; speakerTimeRemaining: number; speakerStartedAt: string | null;
  speakerSeatedAt: string | null;
} | null> {
  const { data, error } = await supabase.from('current_speaker')
    .select('delegate_id, country, time_remaining, started_at, seated_at')
    .eq('committee_id', committeeId).maybeSingle();
  if (error) { console.error('Error fetching current speaker:', error); return null; }
  const row = data as DbRow | null;
  return {
    currentSpeaker: row?.country
      ? { delegateId: row.delegate_id as string, country: row.country as string }
      : null,
    speakerTimeRemaining: (row?.time_remaining as number) ?? 0,
    speakerStartedAt: (row?.started_at as string | null) ?? null,
    speakerSeatedAt: row?.country ? ((row?.seated_at as string | null) ?? null) : null,
  };
}

// ============================================================
// SCOPED SINGLE-TABLE FETCHERS
// Used by the delegate/advisor realtime handlers to patch ONE slice of the
// committee instead of re-pulling the whole committee (7 tables, select('*'))
// on every realtime event. This is the egress lever: a current_speaker advance
// no longer drags the full delegate roster + chat history to every client.
// The row→app mapping here MUST stay identical to getCommitteeByCode.
// ============================================================

// P-4: every slice fetcher returns NULL on a failed read, never an empty list. An empty
// list is a real answer ("nobody is on the GSL"); a network blip is not, and treating it as
// one used to empty the roster on phones, show the waiting room, and stamp false GSL
// denials. Callers skip applying a null and keep what they already have.
export async function getDelegatesList(committeeId: string): Promise<Delegate[] | null> {
  const { data, error } = await supabase.from('delegates')
    .select('id, country, status, is_observer, logo_url')
    .eq('committee_id', committeeId).order('country', { ascending: true });
  if (error) { console.error('Error fetching delegates:', error); return null; }
  return (data ?? []).map((d: DbRow) => ({
    id: d.id as string, country: d.country as string, status: d.status as DelegateStatus,
    isObserver: (d.is_observer as boolean) ?? false,
    logoUrl: (d.logo_url as string | null) ?? null,
  }));
}

// Both GSL and caucus queues in one round-trip (getCommitteeByCode uses two).
export async function getSpeakersLists(committeeId: string): Promise<{ speakersList: SpeakerEntry[]; caucusQueue: SpeakerEntry[] } | null> {
  const { data, error } = await supabase.from('speakers_list')
    .select('delegate_id, country, list_type, position')
    .eq('committee_id', committeeId)
    // Same three-key order as getCommitteeByCode, so delegates and chairs never disagree on ties.
    .order('position', { ascending: true }).order('created_at', { ascending: true }).order('id', { ascending: true });
  if (error) { console.error('Error fetching speakers lists:', error); return null; }
  const rows = (data ?? []) as DbRow[];
  const toEntry = (s: DbRow): SpeakerEntry => ({ delegateId: s.delegate_id as string, country: s.country as string });
  return {
    speakersList: rows.filter((s) => s.list_type === 'gsl').map(toEntry),
    caucusQueue: rows.filter((s) => s.list_type === 'caucus').map(toEntry),
  };
}

export async function getMessagesList(committeeId: string): Promise<Committee['messages'] | null> {
  const { data, error } = await supabase.from('messages')
    .select('id, sender, content, created_at, is_private, recipient')
    .eq('committee_id', committeeId).order('created_at', { ascending: true });
  if (error) { console.error('Error fetching messages:', error); return null; }
  return (data ?? []).map((m: DbRow) => ({
    id: m.id as string, sender: m.sender as string, content: m.content as string,
    timestamp: new Date(m.created_at as string), isPrivate: m.is_private as boolean,
    recipient: m.recipient as string | undefined,
  }));
}

export async function getDocumentsList(committeeId: string): Promise<CommitteeDocument[] | null> {
  const { data, error } = await supabase.from('documents')
    .select('*').eq('committee_id', committeeId).order('created_at', { ascending: true });
  if (error) { console.error('Error fetching documents:', error); return null; }
  return (data ?? []).map((d: DbRow) => ({
    id: d.id as string, type: d.type as CommitteeDocument['type'],
    docCode: d.doc_code as string, title: d.title as string,
    sponsors: (d.sponsors as string[]) ?? [], content: (d.content as string) ?? '',
    status: d.status as DocumentStatus, submittedAt: d.created_at as string,
    fileUrl: d.file_url as string | undefined, fileName: d.file_name as string | undefined,
    presentationMinutes: d.presentation_minutes as number | undefined,
    qaMinutes: d.qa_minutes as number | undefined,
    readingMinutes: d.reading_minutes as number | undefined,
    approval: (d.approval as 'approved' | 'rejected') ?? undefined,
    introState: parseIntroState(d.intro_state),
  }));
}

export async function getPendingMotionsList(committeeId: string): Promise<PendingMotion[] | null> {
  // Include gsl-request / join-request pseudo-motions — the delegate view reads them from here
  // to show "awaiting approval". The main feed filters them out at the display layer.
  const { data, error } = await supabase.from('motions')
    .select('*').eq('committee_id', committeeId).eq('status', 'pending')
    .order('disruptiveness', { ascending: false });
  if (error) { console.error('Error fetching motions:', error); return null; }
  return (data ?? []).map((m: DbRow) => ({
    id: m.id as string, type: m.type as PendingMotionType, proposedBy: m.proposed_by as string,
    totalTime: m.total_time as number, speakingTime: m.speaking_time as number,
    topic: m.topic as string, speakerList: [], proposerPosition: null,
    tourOrder: (m.tour_order as 'asc' | 'desc' | 'custom' | null) ?? undefined,
    disruptiveness: m.disruptiveness as number,
  }));
}

// ============================================================
// MOTIONS
// ============================================================

/**
 * The committees ROW only (phase, caucus, topic, settings, suspend/end stamps, chair names),
 * mapped exactly as getCommitteeByCode maps it, with every child slice left EMPTY. A
 * `committees` realtime event only ever changes this row, so this is all such an event
 * needs; it replaced the 8-query full refetch (including every message) that each Next in a
 * caucus used to trigger on every phone (PERF-3). Callers take the row fields from the
 * result (ROW_FIELDS in src/lib/sessionSync.ts) and never its empty slices. Null on error.
 */
export async function getCommitteeRowById(committeeId: string): Promise<Committee | null> {
  const { data, error } = await supabase.from('committees').select('*').eq('id', committeeId).maybeSingle();
  if (error) { console.error('Error fetching committee row:', error); return null; }
  if (!data) return null;
  return rowToCommittee(data as DbRow);
}

/**
 * Light lookup for the join page (J-1): the committee row plus the roster, in ONE round
 * trip (PostgREST embed over delegates_committee_id_fkey). No lists, motions, documents or
 * messages, so 190 delegates joining in a burst no longer download 190 chat histories.
 * `undefined` = the read failed (network), `null` = no such committee.
 */
export async function getCommitteeRosterByCode(code: string): Promise<Committee | null | undefined> {
  const { data, error } = await supabase.from('committees')
    .select('*, delegates(id, country, status, is_observer, logo_url)')
    .eq('code', code.toUpperCase()).maybeSingle();
  if (error) { console.error('Error looking up committee:', error); return undefined; }
  if (!data) return null;
  const row = data as DbRow;
  const delegates: Delegate[] = ((row.delegates as DbRow[] | null) ?? [])
    .map((d) => ({
      id: d.id as string, country: d.country as string, status: d.status as DelegateStatus,
      isObserver: (d.is_observer as boolean) ?? false,
      logoUrl: (d.logo_url as string | null) ?? null,
    }))
    .sort((a, b) => (a.country < b.country ? -1 : a.country > b.country ? 1 : 0));
  return rowToCommittee(row, delegates);
}

/**
 * Roll call "All present / All present+voting / Clear" as ONE statement
 * (`set_delegate_statuses`, SECURITY INVOKER, so the delegates RLS still applies, and it
 * additionally requires the chair suffix). Rows already at the target status are skipped
 * and emit no realtime event. It used to be one UPDATE per delegate: 190 writes and 190
 * events for a General Assembly (PERF-2). `ids` omitted = every delegate in the committee.
 * Returns the number of rows changed, 'unavailable' when the RPC does not exist (PGRST202,
 * the only case for a per-row fallback), or null when the call failed or was refused.
 */
export async function setDelegateStatusesBulk(
  committeeId: string, status: DelegateStatus, ids: string[] | null,
  code: string, chairSuffix?: string,
): Promise<number | 'unavailable' | null> {
  const { data, error } = await sessionClient(code, chairSuffix).rpc('set_delegate_statuses', {
    p_committee: committeeId, p_status: status, p_ids: ids,
  });
  if (error) {
    console.error('Error setting delegate statuses (bulk):', error);
    // Only a missing function justifies the per-row fallback. A refusal would be refused row
    // by row too, and a transport error is not fixed by sending N more requests.
    return error.code === 'PGRST202' ? 'unavailable' : null;
  }
  return typeof data === 'number' ? data : 0;
}

export async function addPendingMotion(
  committeeId: string, motion: Omit<PendingMotion, 'id' | 'disruptiveness'>,
  code: string, chairSuffix: string | undefined, motionOrder?: string[],
): Promise<string | null> {
  const disruptiveness = calcDisruptiveness(motion.type, motion.totalTime, motionOrder);
  let id: string | null = null;
  // An INSERT is not idempotent (a retry after a lost response makes a duplicate motion),
  // so a failure is reported but never retried automatically.
  await runWrite(`${committeeId}:motion-add:${motion.type}:${motion.proposedBy}`, async () => {
    const { data, error } = await sessionClient(code, chairSuffix).from('motions').insert({
      committee_id: committeeId, type: motion.type, proposed_by: motion.proposedBy,
      total_time: motion.totalTime, speaking_time: motion.speakingTime, topic: motion.topic,
      tour_order: motion.tourOrder ?? null,
      status: 'pending', disruptiveness,
    }).select('id').single();
    if (error || !data) { console.error('Error adding motion:', error); return 'failed'; }
    id = data.id as string;
    return 'ok';
  }, { retry: false });
  return id;
}

export async function removePendingMotion(motionId: string, code: string, chairSuffix?: string): Promise<boolean> {
  // A temp id (`temp-...`) never reached the database; there is nothing to delete.
  if (!UUID_RE.test(motionId)) return false;
  const r = await runWrite(`motion:${motionId}:remove`, async () => {
    const { data, error } = await sessionClient(code, chairSuffix).from('motions').delete().eq('id', motionId).select('id');
    return deleteOutcome(data, error, 'removing motion', () => supabase.from('motions').select('id').eq('id', motionId).limit(1));
  }, { retry: false });
  return r !== 'failed';
}

export async function clearPendingMotions(committeeId: string, code: string, chairSuffix?: string): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('motions').delete()
    .eq('committee_id', committeeId).eq('status', 'pending');
  if (error) console.error('Error clearing motions:', error);
}

// ============================================================
// CAUCUS
// ============================================================

/** Write the caucus alone (a clock re-anchor, a queue advance, an extension). When the
 *  PHASE changes too, use `setPhaseAndCaucus` instead (audit R-7). */
export async function updateCaucus(committeeId: string, caucus: CaucusState | null, code: string, chairSuffix?: string): Promise<boolean> {
  const r = await runWrite(caucusKey(committeeId), async () => {
    const { data, error } = await sessionClient(code, chairSuffix).from('committees')
      .update({ caucus }).eq('id', committeeId).is('ended_at', null).is('suspended_at', null).select('id');
    if (error) { console.error('Error updating caucus:', error); return 'failed'; }
    return rowsOf(data) > 0 ? 'ok' : lifecycleGuardOutcome(committeeId);
  }, { retry: true });
  return r !== 'failed';
}

/** Write the caucus ONLY IF the stored caucus still names `expected.currentSpeaker` and
 *  still carries the total-clock anchor `expected.totalStartedAt` (JSONB path filters, one
 *  statement). Used by the stop-at-zero re-anchor: a Next, a pause, an end or a restart all
 *  change one of the two, so a late re-anchor becomes a no-op instead of reverting them. */
export async function updateCaucusIfUnchanged(
  committeeId: string, caucus: CaucusState,
  expected: { currentSpeaker: string | null; totalStartedAt: string },
  code: string, chairSuffix?: string,
): Promise<boolean> {
  // Zero rows is either "the caucus moved on" (a correct no-op, silent) or a refusal (RLS,
  // reported). The row is re-read to tell them apart.
  const r = await runWrite(caucusKey(committeeId), async () => {
    let q = sessionClient(code, chairSuffix).from('committees').update({ caucus })
      .eq('id', committeeId)
      .is('ended_at', null).is('suspended_at', null)
      .eq('caucus->>totalStartedAt', expected.totalStartedAt);
    q = expected.currentSpeaker === null
      ? q.is('caucus->>currentSpeaker', null)
      : q.eq('caucus->>currentSpeaker', expected.currentSpeaker);
    const { data, error } = await q.select('id');
    if (error) { console.error('Error updating caucus (conditional):', error); return 'failed'; }
    if (rowsOf(data) > 0) return 'ok';
    const { data: row, error: readErr } = await supabase.from('committees')
      .select('caucus, suspended_at, ended_at').eq('id', committeeId).maybeSingle();
    if (readErr || !row) return 'failed';
    const stored = (row.caucus as CaucusState | null) ?? null;
    const stillMatches = !row.ended_at && !row.suspended_at
      && stored?.totalStartedAt === expected.totalStartedAt
      && (stored?.currentSpeaker ?? null) === expected.currentSpeaker;
    return stillMatches ? 'failed' : 'skipped';
  }, { retry: true });
  return r !== 'failed';
}

// ============================================================
// DOCUMENTS
// ============================================================

export async function addDocument(
  committeeId: string, doc: Omit<CommitteeDocument, 'id' | 'submittedAt'>,
  code: string, chairSuffix?: string,
): Promise<CommitteeDocument | null> {
  const { data, error } = await sessionClient(code, chairSuffix).from('documents').insert({
    committee_id: committeeId, type: doc.type, doc_code: doc.docCode, title: doc.title,
    sponsors: doc.sponsors, content: doc.content, status: doc.status,
    file_url: doc.fileUrl ?? null, file_name: doc.fileName ?? null,
    presentation_minutes: doc.presentationMinutes ?? null,
    qa_minutes: doc.qaMinutes ?? null,
    reading_minutes: doc.readingMinutes ?? null,
  }).select().single();
  if (error) { console.error('Error adding document:', error); return null; }
  return {
    id: data.id as string,
    type: data.type as CommitteeDocument['type'],
    docCode: data.doc_code as string,
    title: data.title as string,
    sponsors: (data.sponsors as string[]) ?? [],
    content: (data.content as string) ?? '',
    status: data.status as DocumentStatus,
    submittedAt: data.created_at as string,
    fileUrl: data.file_url as string | undefined,
    fileName: data.file_name as string | undefined,
    presentationMinutes: data.presentation_minutes as number | undefined,
    qaMinutes: data.qa_minutes as number | undefined,
    readingMinutes: data.reading_minutes as number | undefined,
    approval: (data.approval as 'approved' | 'rejected') ?? undefined,
    introState: parseIntroState(data.intro_state),
  };
}

/** Resolves true only when the row was really updated (an RLS refusal resolves with no
 *  error and zero rows). Callers that record a verdict (the voting page) must check it. */
export async function updateDocumentStatus(docId: string, status: DocumentStatus, code: string, chairSuffix?: string): Promise<boolean> {
  const { data, error } = await sessionClient(code, chairSuffix).from('documents').update({ status }).eq('id', docId).select('id');
  if (error) { console.error('Error updating document status:', error); return false; }
  return rowsOf(data) > 0;
}

// Chair approval gate — set/clear a document's approval. null clears the decision (back to undecided).
export async function updateDocumentApproval(docId: string, approval: 'approved' | 'rejected' | null, code: string, chairSuffix?: string): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('documents').update({ approval }).eq('id', docId);
  if (error) console.error('Error updating document approval:', error);
}

export async function updateDocumentTimings(
  docId: string,
  readingMinutes: number,
  presentationMinutes: number,
  qaMinutes: number,
  status: DocumentStatus,
  code: string,
  chairSuffix?: string,
): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('documents').update({
    reading_minutes: readingMinutes,
    presentation_minutes: presentationMinutes,
    qa_minutes: qaMinutes,
    status,
  }).eq('id', docId);
  if (error) console.error('Error updating document timings:', error);
}

export async function deleteDocumentsByType(
  committeeId: string,
  type: 'working-paper' | 'draft-resolution',
  code: string,
  chairSuffix?: string,
): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('documents')
    .delete()
    .eq('committee_id', committeeId)
    .eq('type', type);
  if (error) console.error('Error deleting documents by type:', error);
}

export async function removeDocument(docId: string, code: string, chairSuffix?: string): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('documents').delete().eq('id', docId);
  if (error) console.error('Error removing document:', error);
}

// ============================================================
// CHAT
// ============================================================

export async function sendMessage(
  committeeId: string, sender: string, content: string,
  code: string, chairSuffix: string | undefined,
  isPrivate: boolean = false, recipient?: string,
  messageType?: 'general' | 'speech-comment',
): Promise<boolean> {
  // Encode messageType as a prefix so it survives without a schema change
  const encoded = messageType === 'speech-comment' ? `[🎙️] ${content}` : content;
  // Writes MUST keep going through sessionClient(code, chairSuffix) with unchanged headers —
  // the RLS write-gate keys off them and will silently reject anything else.
  const { error } = await sessionClient(code, chairSuffix).from('messages').insert({
    committee_id: committeeId, sender, content: encoded, is_private: isPrivate, recipient: recipient ?? null,
  });
  if (error) { console.error('Error sending message:', error); return false; }
  // Reported so the sender can render a real failed state instead of a bubble that silently
  // evaporates on the next reconcile.
  return true;
}

// ============================================================
// JOIN REQUESTS  (stored as motions with type='join-request')
// ============================================================

export async function requestJoinSession(
  committeeId: string, delegateId: string, country: string,
  desiredStatus: 'present' | 'present-voting',
  code: string,
): Promise<void> {
  // Check if there's already a pending join-request from this country
  const { data: existing } = await supabase
    .from('motions')
    .select('id')
    .eq('committee_id', committeeId)
    .eq('type', 'join-request')
    .eq('proposed_by', country)
    .eq('status', 'pending')
    .maybeSingle();
  if (existing) return; // already pending

  const { error } = await sessionClient(code).from('motions').insert({
    committee_id: committeeId,
    type: 'join-request',
    proposed_by: country,
    total_time: 0,
    speaking_time: 0,
    topic: JSON.stringify({ delegateId, desiredStatus }),
    status: 'pending',
    disruptiveness: 99_000_000, // shown at very top
  });
  if (error) console.error('Error requesting join:', error);
}

export async function approveJoinRequest(
  committeeId: string, motionId: string, delegateId: string,
  desiredStatus: 'present' | 'present-voting',
  code: string, chairSuffix?: string,
): Promise<void> {
  await setDelegateStatus(delegateId, desiredStatus, code, chairSuffix);
  const { error } = await sessionClient(code, chairSuffix).from('motions').delete().eq('id', motionId);
  if (error) console.error('Error approving join request:', error);
}

/**
 * A chair recognised an absent delegate from the side panel (clicked them onto a speakers
 * list). The status write itself is already fired optimistically by the chair page; this
 * repeats it and AWAITS it, then deletes any pending join-request from that country, so the
 * delegate's phone never observes the request disappearing while it still reads absent
 * (the delegate page treats exactly that as "denied"). Same order as approveJoinRequest.
 * Fire-and-forget from the caller. The repeated status write is idempotent.
 */
export async function resolveJoinRequestsOnAdmit(
  committeeId: string, delegateId: string, country: string, status: DelegateStatus,
  code: string, chairSuffix?: string,
): Promise<void> {
  const ok = await setDelegateStatus(delegateId, status, code, chairSuffix);
  if (!ok) return;
  const { error } = await sessionClient(code, chairSuffix).from('motions').delete()
    .eq('committee_id', committeeId).eq('type', 'join-request').eq('proposed_by', country);
  if (error) console.error('Error resolving join request on admit:', error);
}

export async function denyJoinRequest(motionId: string, code: string, chairSuffix?: string): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('motions').delete().eq('id', motionId);
  if (error) console.error('Error denying join request:', error);
}

// ============================================================
// GSL REQUESTS — delegate asks chair to add them to the GSL
// ============================================================

export async function requestGslSpot(committeeId: string, delegateId: string, country: string, code: string): Promise<void> {
  // Idempotent — ignore if already pending
  const { data: existing } = await supabase
    .from('motions').select('id')
    .eq('committee_id', committeeId).eq('type', 'gsl-request')
    .eq('proposed_by', country).eq('status', 'pending').maybeSingle();
  if (existing) return;
  const { error } = await sessionClient(code).from('motions').insert({
    committee_id: committeeId,
    type: 'gsl-request',
    proposed_by: country,
    total_time: 0,
    speaking_time: 0,
    topic: JSON.stringify({ delegateId }),
    status: 'pending',
    disruptiveness: 98_000_000, // shown prominently, just below join-requests
  });
  if (error) console.error('Error requesting GSL spot:', error);
}

export async function approveGslRequest(
  committeeId: string, motionId: string, delegateId: string, country: string,
  code: string, chairSuffix?: string,
): Promise<void> {
  await addToSpeakersList(committeeId, delegateId, country, code, chairSuffix);
  const { error } = await sessionClient(code, chairSuffix).from('motions').delete().eq('id', motionId);
  if (error) console.error('Error approving GSL request:', error);
}

export async function denyGslRequest(motionId: string, code: string, chairSuffix?: string): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('motions').delete().eq('id', motionId);
  if (error) console.error('Error denying GSL request:', error);
}

// ============================================================
// SPEAKING LOG  (stored as system messages, used for statistics)
// ============================================================

export type LedgerEventType =
  | 'speech' | 'motion-raised' | 'right-of-reply'
  | 'manual-award' | 'manual-deduct' | 'custom';

// Generalised event writer — every point-earning action becomes a logged event on the
// same messages + `__log__:` channel that speaking time already uses, so points are
// traceable and motion/RTR points actually fire.
export async function logEvent(committeeId: string, e: {
  country: string; type: LedgerEventType; sourceId?: string; // sourceId = which scoring source
  seconds?: number; context?: string; topic?: string; value?: number; note?: string;
}, code: string, chairSuffix?: string): Promise<void> {
  const payload = JSON.stringify({ ...e, timestamp: serverNowIso() });   // database clock (T-1)
  const { error } = await sessionClient(code, chairSuffix).from('messages').insert({
    committee_id: committeeId, sender: '__system__',
    content: `__log__:${payload}`, is_private: true, recipient: '__log__',
  });
  if (error) console.error('Error logging event:', error);
}

// Speeches are NOT logged here: `logFloorSpeech` / `logTimedSpeech` in src/lib/floorSpeech.ts
// are the only speech writers (one seconds source, per-turn idempotency). `logEvent` stays
// for motion, right-of-reply and manual ledger rows.

// ============================================================
// FEEDBACK
// ============================================================

export type FeedbackLevel = 'speech' | 'session' | 'conference';

export interface FeedbackEntry {
  id: string;
  country: string;
  chairName: string;
  content: string;           // chair's PRIVATE note — never sent to delegates
  level: FeedbackLevel;
  factorScores: Record<string, number>;
  speechContext: string | null;
  speechSeconds: number | null;
  // WHAT the speech was about — the caucus topic or motion label, or the committee
  // topic on the GSL. `speechContext` alone is a three-value enum, so without this
  // every note in an eight-hour session read identically and a chair could not tell
  // one caucus from another. The speaking log has carried the topic all along; it
  // was simply never copied onto the note.
  speechTopic: string | null;
  // WHEN the speech happened. `createdAt` is when the CHAIR TYPED, and a note
  // written on a past speech through the collapsed capsule can be typed an hour
  // later. Null on rows written before this column existed, and on a note started
  // while the delegate still holds the floor until the speech is logged.
  spokenAt: string | null;
  createdAt: string;
}

export async function addFeedback(
  committeeId: string, country: string, chairName: string, content: string,
  code: string, chairSuffix: string | undefined,
  opts?: {
    level?: FeedbackLevel; factorScores?: Record<string, number>;
    speechContext?: string | null; speechSeconds?: number | null;
    speechTopic?: string | null; spokenAt?: string | null;
  },
): Promise<string | null> {
  const { data, error } = await sessionClient(code, chairSuffix).from('feedback').insert({
    committee_id: committeeId, country, chair_name: chairName, content,
    level: opts?.level ?? 'speech',
    factor_scores: opts?.factorScores ?? {},
    speech_context: opts?.speechContext ?? null,
    speech_seconds: opts?.speechSeconds ?? null,
    speech_topic: opts?.speechTopic ?? null,
    spoken_at: opts?.spokenAt ?? null,
  }).select('id').single();
  if (error) { console.error('Error adding feedback:', error); return null; }
  return data.id as string;
}

export async function updateFeedback(
  id: string,
  patch: {
    content?: string; factorScores?: Record<string, number>;
    speechContext?: string | null; speechSeconds?: number | null;
    speechTopic?: string | null; spokenAt?: string | null;
  },
  code: string, chairSuffix?: string,
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.content !== undefined) update.content = patch.content;
  if (patch.factorScores !== undefined) update.factor_scores = patch.factorScores;
  if (patch.speechContext !== undefined) update.speech_context = patch.speechContext;
  if (patch.speechSeconds !== undefined) update.speech_seconds = patch.speechSeconds;
  if (patch.speechTopic !== undefined) update.speech_topic = patch.speechTopic;
  if (patch.spokenAt !== undefined) update.spoken_at = patch.spokenAt;
  const { error } = await sessionClient(code, chairSuffix).from('feedback').update(update).eq('id', id);
  if (error) console.error('Error updating feedback:', error);
}

export async function deleteFeedback(id: string, code: string, chairSuffix?: string): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('feedback').delete().eq('id', id);
  if (error) console.error('Error deleting feedback:', error);
}

function rowToFeedback(row: DbRow): FeedbackEntry {
  return {
    id: row.id as string,
    country: row.country as string,
    chairName: row.chair_name as string,
    content: (row.content as string) ?? '',
    level: ((row.level as FeedbackLevel) ?? 'speech'),
    factorScores: (row.factor_scores as Record<string, number>) ?? {},
    speechContext: (row.speech_context as string | null) ?? null,
    speechSeconds: (row.speech_seconds as number | null) ?? null,
    speechTopic: (row.speech_topic as string | null) ?? null,
    spokenAt: (row.spoken_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function getFeedbackForCommittee(
  committeeId: string,
): Promise<FeedbackEntry[]> {
  const { data, error } = await supabase.from('feedback').select('*')
    .eq('committee_id', committeeId).order('created_at', { ascending: true });
  if (error || !data) return [];
  return (data as DbRow[]).map(rowToFeedback);
}

// Delegate-facing read — NEVER selects content (the chair's private note).
export async function getDelegateFeedback(
  committeeId: string, country: string,
): Promise<{ level: FeedbackLevel; factorScores: Record<string, number>; createdAt: string }[]> {
  const { data, error } = await supabase.from('feedback')
    .select('level, factor_scores, created_at')
    .eq('committee_id', committeeId).eq('country', country)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return (data as DbRow[]).map((row) => ({
    level: ((row.level as FeedbackLevel) ?? 'speech'),
    factorScores: (row.factor_scores as Record<string, number>) ?? {},
    createdAt: row.created_at as string,
  }));
}

// ============================================================
// SESSION CLEANUP
// ============================================================

export async function suspendSession(committeeId: string, code: string, chairSuffix?: string): Promise<void> {
  const expiresAt = new Date(serverNow() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await sessionClient(code, chairSuffix).from('committees')
    .update({ expires_at: expiresAt, phase: 'adjourned' }).eq('id', committeeId);
  if (error) console.error('Error suspending session:', error);
}

/** @deprecated Unused. Skips the roll call and leaves caucus data behind; resume through
 *  claimResumeSession + startResumeRollCall + beginSessionAfterRollCall. Kept conditional
 *  so a stray call can never un-suspend an ended committee. */
export async function resumeSession(committeeId: string, code: string, chairSuffix?: string): Promise<boolean> {
  const { data, error } = await sessionClient(code, chairSuffix).from('committees')
    .update({ suspended_at: null, phase: 'speakers-list', caucus: null })
    .eq('id', committeeId).not('suspended_at', 'is', null).is('ended_at', null).select('id');
  if (error) console.error('Error resuming session:', error);
  return !error && rowsOf(data) > 0;
}

// ── The resume latch (audit S-1) ─────────────────────────────────────────────
// All three writes that touch `resuming_chair` now also require the committee to STILL be
// suspended. Without it a stale device (asleep through another chair's resume) pressed
// Resume, found the latch null again, won it, and threw a running committee back into roll
// call. The `.is('resuming_chair', null)` single-winner guard is untouched: this only ADDS
// a condition, it never loosens one. A false return means "refetch and look".
export async function claimResumeSession(committeeId: string, chairName: string, code: string, chairSuffix?: string): Promise<boolean> {
  const { data, error } = await sessionClient(code, chairSuffix)
    .from('committees')
    .update({ resuming_chair: chairName })
    .eq('id', committeeId)
    .is('resuming_chair', null)
    .not('suspended_at', 'is', null)
    .is('ended_at', null)
    .select('id')
    .maybeSingle();
  if (error) console.error('Error claiming resume:', error);
  return !error && !!data;
}

/**
 * Release a resume claim that THIS chair holds.
 *
 * `resuming_chair` is a one-shot latch: `claimResumeSession` only writes it when it is
 * null, and `startResumeRollCall` is the only thing that clears it. If the roll-call write
 * fails after the claim succeeded, the latch stays set forever and NO chair can ever resume
 * the committee again. This is the release valve for that path.
 *
 * The `.eq('resuming_chair', chairName)` guard is a compare-and-swap, exactly like the
 * `.is(..., null)` guard on the claim: you can only release a latch you actually hold, so
 * the single-winner guarantee is preserved — this never lets a second chair clear someone
 * else's live claim.
 */
export async function releaseResumeClaim(committeeId: string, chairName: string, code: string, chairSuffix?: string): Promise<boolean> {
  const { data, error } = await sessionClient(code, chairSuffix)
    .from('committees')
    .update({ resuming_chair: null })
    .eq('id', committeeId)
    .eq('resuming_chair', chairName)
    .select('id')
    .maybeSingle();
  if (error) console.error('Error releasing resume claim:', error);
  return !error && !!data;
}

/**
 * Take over a resume claim abandoned by another chair (they crashed, closed the tab, or
 * lost connectivity between claiming and starting the roll call).
 *
 * Still a compare-and-swap — `.eq('resuming_chair', fromChairName)` — so if two chairs try
 * to take over the same stale latch at the same moment, the first write flips the value and
 * the second matches no row and returns false. Exactly one winner, same as the claim.
 */
export async function takeOverResumeClaim(committeeId: string, fromChairName: string, toChairName: string, code: string, chairSuffix?: string): Promise<boolean> {
  const { data, error } = await sessionClient(code, chairSuffix)
    .from('committees')
    .update({ resuming_chair: toChairName })
    .eq('id', committeeId)
    .eq('resuming_chair', fromChairName)
    .not('suspended_at', 'is', null)
    .is('ended_at', null)
    .select('id')
    .maybeSingle();
  if (error) console.error('Error taking over resume claim:', error);
  return !error && !!data;
}

/**
 * Returns true only when the roll call actually started. The caller MUST check it: on false
 * the resume latch is still held and has to be released (see `releaseResumeClaim`), or the
 * committee is stranded suspended forever.
 */
export async function startResumeRollCall(committeeId: string, code: string, chairSuffix?: string, chairName?: string): Promise<boolean> {
  // Still suspended, and (when the caller names itself) the latch is still ours: a device
  // that lost its latch to a take-over can no longer start a second roll call.
  // `caucus` is deliberately left alone: a caucus paused by the suspension is restored (or
  // explicitly cleared) by beginSessionAfterRollCall when the dais begins debate.
  let q = sessionClient(code, chairSuffix).from('committees').update({
    suspended_at: null,
    resuming_chair: null,
    phase: 'pre-session',
  }).eq('id', committeeId).not('suspended_at', 'is', null).is('ended_at', null);
  if (chairName) q = q.eq('resuming_chair', chairName);
  const { data, error } = await q.select('id').maybeSingle();
  if (error) console.error('Error starting resume roll call:', error);
  return !error && !!data;
}

type LiveClocks = { phase: SessionPhase; caucus: CaucusState | null; suspendedAt: string | null; endedAt: string | null };

/** Read the committee row and freeze its caucus at live values, as of the database clock.
 *  A caucus survives only while the committee is IN a caucus phase; anything else (a
 *  leftover from an old two-write caucus end) is cleared. */
async function readFrozenCaucus(committeeId: string): Promise<LiveClocks & { frozenCaucus: CaucusState | null } | null> {
  const [{ data: row, error }, { data: spk }] = await Promise.all([
    supabase.from('committees').select('phase, caucus, suspended_at, ended_at').eq('id', committeeId).maybeSingle(),
    supabase.from('current_speaker').select('time_remaining, started_at').eq('committee_id', committeeId).maybeSingle(),
  ]);
  if (error || !row) { console.error('Error reading committee clocks:', error); return null; }
  const phase = row.phase as SessionPhase;
  const caucus = (row.caucus as CaucusState | null) ?? null;
  const inCaucus = phase === 'moderated-caucus' || phase === 'unmoderated-caucus';
  const frozenCaucus = caucus && inCaucus
    ? freezeCaucusForBreak(caucus, (spk?.time_remaining as number) ?? 0, (spk?.started_at as string | null) ?? null)
    : null;
  return {
    phase, caucus, frozenCaucus,
    suspendedAt: (row.suspended_at as string | null) ?? null,
    endedAt: (row.ended_at as string | null) ?? null,
  };
}

/**
 * Suspend debate. Resolves true when the committee IS suspended afterwards (this call did
 * it, or it already was), false when it could not be (the write failed after retries, or
 * the committee has ENDED, which can never be suspended: audit V-8). On false the caller
 * rolls its optimistic suspension back.
 *
 * One committees update freezes the caucus TOTAL at its live value (audit C-1), stamps
 * `suspended_at` from the database clock (T-1), and is conditional on `ended_at is null`
 * and on not being suspended already, so a second device cannot restamp it. Then the
 * speaker clock is paused at its live value (G-4). Logging the speech of whoever held the
 * floor is the CALLER's job (the floor-speech helper), before calling this.
 */
export async function suspendDebate(committeeId: string, code: string, chairSuffix?: string): Promise<boolean> {
  let suspended = false;
  // S2: a phase, caucus or seat write still backing off from before the break must not land
  // after it. (The floor clear and the live pause are part of the break and exempt.)
  cancelPendingRetries([phaseKey(committeeId), caucusKey(committeeId), speakerKey(committeeId)]);
  const r = await runWrite(lifecycleKey(committeeId), async () => {
    const live = await readFrozenCaucus(committeeId);
    if (!live) return 'failed';
    if (live.endedAt) { suspended = false; return 'skipped'; }
    if (live.suspendedAt) { suspended = true; return 'skipped'; }
    const { data, error } = await sessionClient(code, chairSuffix).from('committees')
      .update({ suspended_at: serverNowIso(), phase: 'adjourned', caucus: live.frozenCaucus })
      .eq('id', committeeId)
      .is('ended_at', null)
      .is('suspended_at', null)
      .eq('phase', live.phase)
      .select('id');
    if (error) { console.error('Error suspending debate:', error); return 'failed'; }
    // Zero rows: something changed between the read and the write (or RLS refused it).
    // Retrying re-reads, and reports "already suspended/ended" correctly.
    if (rowsOf(data) === 0) return 'failed';
    suspended = true;
    return 'ok';
  // Never re-run from the toast (S3): the caller has already rolled the suspension back.
  }, { retry: true, rerunnable: false });
  if (suspended) void pauseSpeakerClockLive(committeeId, code, chairSuffix);
  return r !== 'failed' && suspended;
}

/**
 * End debate. Resolves true when the committee HAS ended afterwards (this call or an
 * earlier one), false only when the write failed; the caller then rolls back its
 * optimistic End View. Idempotent (audit V-8): `.is('ended_at', null)` means a second
 * device never rewrites `ended_at` or restarts the deletion countdown. Both clocks are
 * frozen like a suspension (C-1, G-4), timestamps come from the database clock (T-1).
 * The +1 h `expires_at` is mirrored optimistically by MotionsModal and the chair page's
 * organiser-broadcast path: if one is ever changed, change all three.
 */
export async function endDebate(committeeId: string, code: string, chairSuffix?: string): Promise<boolean> {
  let ended = false;
  cancelPendingRetries([phaseKey(committeeId), caucusKey(committeeId), speakerKey(committeeId)]);   // S2
  const r = await runWrite(lifecycleKey(committeeId), async () => {
    const live = await readFrozenCaucus(committeeId);
    if (!live) return 'failed';
    if (live.endedAt) { ended = true; return 'skipped'; }
    const nowMs = serverNow();
    // A suspended committee's caucus was already frozen when it suspended; keep it as is.
    const caucus = live.suspendedAt ? live.caucus : live.frozenCaucus;
    const { data, error } = await sessionClient(code, chairSuffix).from('committees')
      .update({
        ended_at: new Date(nowMs).toISOString(),
        expires_at: new Date(nowMs + 1 * 60 * 60 * 1000).toISOString(),
        phase: 'adjourned',
        caucus,
      })
      .eq('id', committeeId)
      .is('ended_at', null)
      .select('id');
    if (error) { console.error('Error ending debate:', error); return 'failed'; }
    if (rowsOf(data) === 0) return 'failed';   // retry re-reads: ended elsewhere → skipped
    ended = true;
    return 'ok';
  }, { retry: true, rerunnable: false });   // S3: never re-run from the toast
  if (ended) void pauseSpeakerClockLive(committeeId, code, chairSuffix);
  return r !== 'failed' && ended;
}

// ============================================================
// CODE MANAGEMENT
// ============================================================

export async function updateCommitteeCode(committeeId: string, newCode: string, code: string, chairSuffix?: string): Promise<boolean> {
  const upper = newCode.toUpperCase().trim();
  if (!upper || upper.length < 4) return false;

  // Check uniqueness
  const { data: existing } = await supabase
    .from('committees').select('id').eq('code', upper).maybeSingle();
  if (existing) return false; // code already taken

  const { error } = await sessionClient(code, chairSuffix)
    .from('committees').update({ code: upper }).eq('id', committeeId);
  if (error) { console.error('Error updating committee code:', error); return false; }
  return true;
}

// ============================================================
// CHAIR JOIN SUFFIX
// ============================================================

// The ONLY writer of `settings.chairJoinSuffix` (`patch_committee_settings` refuses the key).
// `set_committee_chair_suffix` merges that one key in a single statement, so a failed read
// can no longer replace the blob with `{ chairJoinSuffix }` alone (D-2). RLS still applies:
// the caller must hold the CURRENT code, so a committee with no code in the DB cannot be
// given one from the client (that was already true of the old direct update).
export async function updateCommitteeChairSuffixInDB(committeeId: string, chairJoinSuffix: string, code: string, currentChairSuffix?: string): Promise<boolean> {
  const { data, error } = await sessionClient(code, currentChairSuffix)
    .rpc('set_committee_chair_suffix', { p_committee: committeeId, p_suffix: chairJoinSuffix });
  if (error) { console.error('Error setting chair code:', error); return false; }
  return data === true;
}

// ============================================================
// HEAD CHAIR  (persisted in settings jsonb; claim-at-will)
// ============================================================
// Sets who holds the gavel. Any chair may claim it — from Settings or when joining as chair.
// Stored in settings so every device derives view-only status from it instead of a
// presence join-order race. null/unset → the committee creator (chair_names[0]) is head.
// `headChairDevice` (src/lib/gavelDevice.ts) is written in the SAME update: the taking
// device's id, or null when the gavel is handed to another name (that chair's device claims
// it on arrival). Omitting it therefore clears it, which is the safe reading of a name change.
// Both keys go through `patch_committee_settings` in ONE statement (key-level merge, no
// read), so nothing else in the blob can be touched. The holder's name is also appended to
// `chair_names` atomically (D-8: 4 rooms had a gavel holder missing from the chair list).
export async function updateCommitteeHeadChairInDB(committeeId: string, headChairRaw: string, code: string, chairSuffix?: string, headChairDevice: string | null = null): Promise<boolean> {
  // Trimmed, exactly like `add_committee_chair_name`, so the gavel name always matches an
  // entry in chair_names and the `?chairName=` comparison.
  const headChair = (headChairRaw ?? '').trim();
  const ok = await patchCommitteeSettings(
    committeeId,
    { headChair, headChairDevice: headChairDevice || null },
    code,
    chairSuffix,
  );
  if (!ok) { console.error('Error setting head chair: the write was refused'); return false; }
  if (headChair) void addChairName(committeeId, headChair, code, chairSuffix);
  return true;
}

// ============================================================
// AGENDA  (conference sessions whose committee has 2-3 topics)
// ============================================================
// The dais chooses which of the conference committee's topics opens debate, and can move
// to the next one later. ONE update writes both halves, so they can never disagree:
//   • `topic` becomes the chosen text, so every surface that already reads committees.topic
//     (chair header, delegate phones, the organiser live wall) shows it with no new code.
//   • `settings.agendaTopicIndex` (0-based number) records the choice. It is a CONTRACT:
//     absent = never chosen. The organiser-side re-sync in CommitteeEditorModal reads it so
//     editing the conference committee does not overwrite the dais's choice.
// Read-merged so only this key changes (chairJoinSuffix and headChair survive).
// Returns true ONLY when a row was really updated. supabase-js resolves with error null on
// an RLS-rejected zero-row update, so `.select('id')` plus a row count is the only proof.
export async function updateCommitteeAgendaInDB(
  committeeId: string,
  topicIndex: number,
  topic: string,
  code: string,
  chairSuffix?: string,
): Promise<boolean> {
  // `set_committee_agenda` writes `topic` and merges `agendaTopicIndex` into the blob in one
  // statement, with no read first, so it cannot wipe chairJoinSuffix and cannot race another
  // chair's settings write. It returns false when RLS refused the update.
  const { data, error } = await sessionClient(code, chairSuffix)
    .rpc('set_committee_agenda', { p_committee: committeeId, p_index: topicIndex, p_topic: topic });
  if (error) {
    console.error('Error setting agenda:', error);
    return false;
  }
  return data === true;
}

/** The longest topic the chair's inline editor accepts (masthead, CommitteeIdentityBadge). */
export const COMMITTEE_TOPIC_MAX = 150;

// The Moderator rewording the room's topic inline (sidebar masthead). Writes `committees.topic`
// ONLY: `settings.agendaTopicIndex` is untouched, so on a conference committee the stored pick
// survives. (The organiser's CommitteeEditorModal re-sync keeps the room's text only while it
// still equals one of the conference topics; a custom wording is replaced by the topic the
// stored index points at on the organiser's next save.) Conditional on `ended_at is null`,
// counted with `.select('id')` because an RLS refusal resolves with error null and zero rows.
// Not retried: the caller rolls its optimistic topic back on false, so a retry landing later
// would contradict the screen.
export async function updateCommitteeTopicInDB(committeeId: string, topic: string, code: string, chairSuffix?: string): Promise<boolean> {
  const next = topic.trim().slice(0, COMMITTEE_TOPIC_MAX);
  if (!next) return false;
  const r = await runWrite(`${committeeId}:topic`, async () => {
    const { data, error } = await sessionClient(code, chairSuffix).from('committees')
      .update({ topic: next }).eq('id', committeeId).is('ended_at', null).select('id');
    if (error) { console.error('Error updating topic:', error); return 'failed'; }
    return rowsOf(data) > 0 ? 'ok' : 'failed';
  }, { retry: false, rerunnable: false });
  return r !== 'failed';
}

// Persist the scoring config into the committee settings jsonb so it reaches
// delegates / FAs / Commenters on other devices (localStorage never syncs across devices).
// Key-level patch: only `scoring` changes. The scoring object itself is one value, so two
// chairs editing different score sources at the same moment still resolve last-write-wins.
export async function updateCommitteeScoringInDB(committeeId: string, scoring: unknown, code: string, chairSuffix?: string): Promise<boolean> {
  return patchCommitteeSettings(committeeId, { scoring }, code, chairSuffix);
}

// ============================================================
// CHAIR NAMES
// ============================================================

// Atomic `array_append` in `add_committee_chair_name`, guarded by "not already present" in
// the same statement: two chairs joining at once both land, and a failed read can no
// longer replace the list with one name. Exact-match, as before. True when the name is on
// the list and this caller holds the chair code.
export async function addChairName(committeeId: string, name: string, code: string, chairSuffix?: string): Promise<boolean> {
  const { data, error } = await sessionClient(code, chairSuffix)
    .rpc('add_committee_chair_name', { p_committee: committeeId, p_name: name });
  if (error) { console.error('Error adding chair name:', error); return false; }
  return data === true;
}

export async function updateSpeakerTimeLimit(committeeId: string, limitSeconds: number, code: string, chairSuffix?: string): Promise<boolean> {
  const r = await runWrite(`${committeeId}:speaker-limit`, async () => {
    const { data, error } = await sessionClient(code, chairSuffix).from('committees')
      .update({ speaker_time_limit: limitSeconds }).eq('id', committeeId).select('id');
    if (error) { console.error('Error updating speaker time limit:', error); return 'failed'; }
    return rowsOf(data) > 0 ? 'ok' : 'failed';
  }, { retry: true });
  return r !== 'failed';
}

// ============================================================
// ORGANISER BROADCASTS
// ============================================================

// `session_broadcasts` is written by the conferences layer (organiser-only INSERT) and read
// by every session surface (SELECT is public — the policy qualifier is literally `true`), so
// the plain anon client is correct here: a chair suffix buys nothing on a read.
//
// Rows are FANNED OUT one per committee by the organiser, so a session never has to resolve
// its conference to find its messages — filtering on `committee_id` is the whole query.

export type BroadcastKind = 'informational' | 'actionable';
export type BroadcastAction = 'pause' | 'end';

export interface SessionBroadcast {
  id: string;
  committeeId: string;
  conferenceId: string | null;
  kind: BroadcastKind;
  message: string;
  imageUrl: string | null;
  /** NOT NULL exactly when `kind === 'actionable'` — enforced by a table CHECK. */
  action: BroadcastAction | null;
  /** When the action takes effect. Null = on the chair's acknowledgement. */
  actionAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

function rowToBroadcast(r: Record<string, unknown>): SessionBroadcast {
  return {
    id: r.id as string,
    committeeId: r.committee_id as string,
    conferenceId: (r.conference_id as string) ?? null,
    kind: r.kind as BroadcastKind,
    message: r.message as string,
    imageUrl: (r.image_url as string) ?? null,
    action: (r.action as BroadcastAction) ?? null,
    actionAt: (r.action_at as string) ?? null,
    createdAt: r.created_at as string,
    expiresAt: (r.expires_at as string) ?? null,
  };
}

/**
 * Every broadcast for this committee that has not yet expired, oldest first.
 *
 * The expiry filter is applied in SQL so a chair who joins hours late never even sees a
 * stale announcement, and re-applied on the client each render — a row fetched while live
 * can expire while the page is still open.
 */
export async function getActiveBroadcasts(committeeId: string): Promise<SessionBroadcast[]> {
  const nowIso = serverNowIso();   // database clock (T-1), so a skewed device does not over- or under-filter
  const { data, error } = await supabase
    .from('session_broadcasts')
    .select('*')
    .eq('committee_id', committeeId)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('created_at', { ascending: true });
  if (error) { console.error('Error loading broadcasts:', error); return []; }
  return (data ?? []).map((r) => rowToBroadcast(r as Record<string, unknown>));
}

// ============================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================

// One live channel per committee. A re-subscribe REPLACES the prior connection (no
// stacking / connection spike), but each new channel gets a UNIQUE topic so its `.on()`
// handlers are always registered before subscribe() — reusing a fixed topic returns the
// already-subscribed channel and throws "cannot add postgres_changes callbacks after subscribe()".
const committeeChannels: Record<string, ReturnType<typeof supabase.channel>> = {};

export type RealtimeStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

export type CommitteeTable =
  | 'committees' | 'delegates' | 'speakers_list' | 'current_speaker' | 'motions'
  | 'documents' | 'messages' | 'feedback' | 'session_broadcasts';

/** The raw realtime change, for handlers that can apply it without a refetch (messages). */
export interface CommitteeChangePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
}

const ALL_COMMITTEE_TABLES: CommitteeTable[] = [
  'committees', 'delegates', 'speakers_list', 'current_speaker', 'motions',
  'documents', 'messages', 'feedback', 'session_broadcasts',
];

/** Map a realtime `messages` row to the app shape used by getMessagesList. */
export function messageFromRow(m: Record<string, unknown>): Committee['messages'][number] {
  return {
    id: m.id as string, sender: m.sender as string, content: m.content as string,
    timestamp: new Date(m.created_at as string), isPrivate: m.is_private as boolean,
    recipient: (m.recipient as string | null) ?? undefined,
  };
}

export function subscribeToCommittee(
  committeeId: string,
  onChange: (table: string, payload?: CommitteeChangePayload) => void,
  // Realtime does NOT replay events missed while the socket was down — the normal case for a
  // backgrounded phone. Callers use this to run a catch-up fetch on every re-SUBSCRIBED.
  onStatus?: (status: RealtimeStatus) => void,
  // Bind only these tables. Delegate and advisor devices render neither chair notes nor
  // organiser broadcasts, so they do not subscribe to `feedback` / `session_broadcasts` at
  // all: a Commenter's note autosaves every 700 ms and each save used to make every phone
  // refetch the whole committee (PERF-1). Default: all nine.
  tables: CommitteeTable[] = ALL_COMMITTEE_TABLES,
): () => void {
  // Tear down any prior channel for this committee first.
  const prev = committeeChannels[committeeId];
  if (prev) { supabase.removeChannel(prev); delete committeeChannels[committeeId]; }

  // Chair notes and factor ratings (`feedback`) are NOT optimistic speaker/timer/caucus
  // state, so RULE 4's debounce does not apply to them. Organiser broadcasts are fanned out
  // one row per committee, so the same committee_id filter is all they need.
  let channel = supabase.channel(`committee-${committeeId}-${Date.now()}`);
  for (const table of tables) {
    const filter = table === 'committees' ? `id=eq.${committeeId}` : `committee_id=eq.${committeeId}`;
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter },
      (p: { eventType: CommitteeChangePayload['eventType']; new: Record<string, unknown>; old: Record<string, unknown> }) =>
        onChange(table, {
          eventType: p.eventType,
          new: p.new && Object.keys(p.new).length ? p.new : null,
          old: p.old && Object.keys(p.old).length ? p.old : null,
        }),
    );
  }
  channel.subscribe((status) => { onStatus?.(status as RealtimeStatus); });
  committeeChannels[committeeId] = channel;
  return () => {
    supabase.removeChannel(channel);
    if (committeeChannels[committeeId] === channel) delete committeeChannels[committeeId];
  };
}