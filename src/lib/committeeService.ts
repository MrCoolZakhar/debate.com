// ============================================================
// src/lib/committeeService.ts
// All Supabase database operations for Gavelling.
// ============================================================

import { supabase } from './supabase';
import { sessionClient } from './sessionClient';
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
export function caucusRemainingNow(caucus: CaucusState | null | undefined, now: number = Date.now()): number {
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
  now: number = Date.now(),
): number {
  const base = Number.isFinite(speakerTimeRemaining) ? speakerTimeRemaining : 0;
  if (!speakerStartedAt) return Math.max(0, base);
  const startedMs = new Date(speakerStartedAt).getTime();
  if (!Number.isFinite(startedMs)) return Math.max(0, base);
  const elapsed = Math.max(0, Math.round((now - startedMs) / 1000));
  return Math.max(0, base - elapsed);
}

/** Stamp the total-clock anchor onto a caucus. `running` false → paused (anchor cleared,
 *  remainingTime is the literal truth). Always pass the LIVE remaining, not the stale one. */
export function anchorCaucusClock(caucus: CaucusState, liveRemaining: number, running: boolean): CaucusState {
  return {
    ...caucus,
    remainingTime: Math.max(0, Math.round(liveRemaining)),
    totalStartedAt: running ? new Date().toISOString() : null,
  };
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
    dbSeparateChairCode: ((row.settings as Record<string, unknown>)?.separateChairCode as boolean) ?? false,
    dbSettings: (row.settings as Record<string, unknown>) ?? null,
    dbScoring: ((row.settings as Record<string, unknown>)?.scoring as Committee['dbScoring']) ?? null,
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
    supabase.from('speakers_list').select('*').eq('committee_id', committeeRow.id).eq('list_type', 'gsl').order('position', { ascending: true }),
    supabase.from('speakers_list').select('*').eq('committee_id', committeeRow.id).eq('list_type', 'caucus').order('position', { ascending: true }),
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
  }));

  const messages: Committee['messages'] = (messageRows ?? []).map((m: DbRow) => ({
    id: m.id as string, sender: m.sender as string, content: m.content as string,
    timestamp: new Date(m.created_at as string), isPrivate: m.is_private as boolean,
    recipient: m.recipient as string | undefined,
  }));

  return rowToCommittee(committeeRow, delegates, gslDeduped, caucusQueue, currentSpeaker, speakerTimeRemaining, pendingMotions, documents, messages, speakerStartedAt);
}

// ============================================================
// COMMITTEE SETTINGS (persisted to committees.settings jsonb)
// ============================================================

export async function saveCommitteeSettings(committeeId: string, settings: object, code: string, chairSuffix?: string): Promise<void> {
  // Merge into the existing settings jsonb so chairJoinSuffix/separateChairCode are preserved.
  const { data: row, error: readErr } = await supabase
    .from('committees').select('settings').eq('id', committeeId).single();
  if (readErr) { console.error('Error reading committee settings:', readErr); return; }
  const current = (row?.settings as Record<string, unknown>) ?? {};
  const merged = { ...current, ...settings };
  const { error } = await sessionClient(code, chairSuffix).from('committees').update({ settings: merged }).eq('id', committeeId);
  if (error) console.error('Error saving committee settings:', error);
}

// ============================================================
// PHASE MANAGEMENT
// ============================================================

export async function setPhase(committeeId: string, phase: SessionPhase, code: string, chairSuffix?: string): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('committees').update({ phase }).eq('id', committeeId);
  if (error) console.error('Error setting phase:', error);
}

// ============================================================
// ROLL CALL
// ============================================================

// Returns whether the write actually landed. Every caller that only wants fire-and-forget
// can keep ignoring the value; the delegate page uses it to refund the rate-limit slot and
// roll its optimistic status back when the write is rejected (e.g. by RLS).
export async function setDelegateStatus(delegateId: string, status: DelegateStatus, code: string, chairSuffix?: string): Promise<boolean> {
  const { error } = await sessionClient(code, chairSuffix).from('delegates').update({ status }).eq('id', delegateId);
  if (error) console.error('Error setting delegate status:', error);
  return !error;
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

export async function addToSpeakersList(committeeId: string, delegateId: string, country: string, code: string, chairSuffix?: string, position?: number): Promise<void> {
  const pos = position !== undefined ? position : Date.now();
  const { error } = await sessionClient(code, chairSuffix).from('speakers_list').insert({
    committee_id: committeeId, delegate_id: delegateId, country,
    position: pos, list_type: 'gsl',
  });
  if (error) console.error('Error adding to GSL:', error);
}

export async function removeFromSpeakersList(committeeId: string, delegateId: string, code: string, chairSuffix?: string): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('speakers_list').delete()
    .eq('committee_id', committeeId).eq('delegate_id', delegateId).eq('list_type', 'gsl');
  if (error) console.error('Error removing from GSL:', error);
}

// ============================================================
// CAUCUS LIST (list_type = 'caucus')
// Temporary — per-motion, wiped when caucus ends, GSL untouched
// ============================================================

export async function addToCaucusList(committeeId: string, delegateId: string, country: string, code: string, chairSuffix?: string, position?: number): Promise<void> {
  const pos = position !== undefined ? position : Date.now();
  const { error } = await sessionClient(code, chairSuffix).from('speakers_list').insert({
    committee_id: committeeId, delegate_id: delegateId, country,
    position: pos, list_type: 'caucus',
  });
  if (error) console.error('Error adding to caucus list:', error);
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

export async function removeFromCaucusList(committeeId: string, delegateId: string, code: string, chairSuffix?: string): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('speakers_list').delete()
    .eq('committee_id', committeeId).eq('delegate_id', delegateId).eq('list_type', 'caucus');
  if (error) console.error('Error removing from caucus list:', error);
}

export async function clearCaucusList(committeeId: string, code: string, chairSuffix?: string): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('speakers_list').delete()
    .eq('committee_id', committeeId).eq('list_type', 'caucus');
  if (error) console.error('Error clearing caucus list:', error);
}

export async function reorderSpeakersList(
  committeeId: string,
  entries: { delegateId: string; country: string }[],
  code: string,
  chairSuffix?: string,
  listType: 'gsl' | 'caucus' = 'gsl',
): Promise<void> {
  if (entries.length === 0) return;
  // Parallel in-place position updates — avoids DELETE+INSERT which fires a
  // DELETE realtime event causing the delegate view to briefly flash an empty list.
  const client = sessionClient(code, chairSuffix);
  await Promise.all(
    entries.map((e, i) =>
      client.from('speakers_list')
        .update({ position: i + 1 })
        .eq('committee_id', committeeId)
        .eq('delegate_id', e.delegateId)
        .eq('list_type', listType),
    ),
  );
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

// In-flight conditional clear of current_speaker, if any. nextSpeaker() awaits it before
// writing, so a clear issued by the caucus lifecycle can NEVER land after — and therefore
// never blank — a speaker that nextSpeaker has just seated. See
// clearCurrentSpeakerIfUnchanged() for the full ordering argument.
let currentSpeakerClearInFlight: Promise<void> | null = null;

export async function nextSpeaker(
  committeeId: string,
  speakerTimeLimit: number,
  nextDelegateId: string | null,
  nextCountry: string | null,
  removeDelegateId: string | null,
  code: string,
  chairSuffix?: string,
): Promise<void> {
  // HAPPENS-BEFORE GUARD (MUST NEVER HAPPEN #5). Rule #5 forbids firing a blind
  // clearCurrentSpeaker when entering a caucus because it races nextSpeakerInDB: two
  // unordered fire-and-forget writes to the same row, last one wins, and a late clear
  // wipes the caucus speaker. This guard removes the concurrency entirely — any clear
  // already issued is drained before we seat anyone.
  if (currentSpeakerClearInFlight) {
    try { await currentSpeakerClearInFlight; } catch { /* a failed clear must not block the advance */ }
  }
  const client = sessionClient(code, chairSuffix);
  await Promise.all([
    removeDelegateId
      ? client.from('speakers_list').delete()
          .eq('committee_id', committeeId)
          .eq('delegate_id', removeDelegateId)
          .eq('list_type', 'gsl')
      : Promise.resolve(),
    client.from('current_speaker')
      .update({
        delegate_id: nextDelegateId,
        country: nextCountry,
        time_remaining: speakerTimeLimit,
        started_at: null,
      })
      .eq('committee_id', committeeId),
  ]);
}

// Sync time_remaining to DB at structural moments (pause, expire).
// tickSpeakerTimer removed — per-second DB writes caused excessive realtime events.
export async function syncSpeakerTime(committeeId: string, timeRemaining: number, code: string, chairSuffix?: string): Promise<void> {
  await sessionClient(code, chairSuffix).from('current_speaker')
    .update({ time_remaining: timeRemaining })
    .eq('committee_id', committeeId);
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
  startedAt: string = new Date().toISOString(), timeRemaining?: number,
): Promise<void> {
  const patch: Record<string, unknown> = { started_at: startedAt };
  if (typeof timeRemaining === 'number') patch.time_remaining = Math.max(0, Math.round(timeRemaining));
  await sessionClient(code, chairSuffix).from('current_speaker')
    .update(patch)
    .eq('committee_id', committeeId);
}

export async function stopSpeakerTimer(committeeId: string, code: string, chairSuffix?: string): Promise<void> {
  await sessionClient(code, chairSuffix).from('current_speaker')
    .update({ started_at: null })
    .eq('committee_id', committeeId);
}

export async function clearCurrentSpeaker(committeeId: string, code: string, chairSuffix?: string): Promise<void> {
  await sessionClient(code, chairSuffix).from('current_speaker')
    .update({ delegate_id: null, country: null, time_remaining: 0, started_at: null })
    .eq('committee_id', committeeId);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 *  2. ORDERED — the promise is published to currentSpeakerClearInFlight, and
 *     nextSpeaker() awaits it before writing. So a clear can never be overtaken by, or
 *     overtake, a seat that starts after it.
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
): Promise<void> {
  if (!expectedDelegateId && !expectedCountry) return;
  const run = (async () => {
    let q = sessionClient(code, chairSuffix).from('current_speaker')
      .update({ delegate_id: null, country: null, time_remaining: 0, started_at: null })
      .eq('committee_id', committeeId);
    // delegate_id is a uuid column — a Room-Order placeholder id ("room-order-3") would be
    // a 22P02 cast error, so fall back to the country text for those.
    if (expectedDelegateId && UUID_RE.test(expectedDelegateId)) q = q.eq('delegate_id', expectedDelegateId);
    else if (expectedCountry) q = q.eq('country', expectedCountry);
    else return;
    const { error } = await q;
    if (error) console.error('Error clearing current speaker:', error);
  })();
  const wrapped: Promise<void> = run.finally(() => {
    if (currentSpeakerClearInFlight === wrapped) currentSpeakerClearInFlight = null;
  });
  currentSpeakerClearInFlight = wrapped;
  await wrapped;
}

// Lightweight single-row fetch of just the current speaker — used by co-chair views
// to react to current_speaker realtime events without a full committee refetch.
export async function getCurrentSpeakerRow(committeeId: string): Promise<{
  currentSpeaker: SpeakerEntry | null; speakerTimeRemaining: number; speakerStartedAt: string | null;
} | null> {
  const { data, error } = await supabase.from('current_speaker')
    .select('delegate_id, country, time_remaining, started_at')
    .eq('committee_id', committeeId).maybeSingle();
  if (error) { console.error('Error fetching current speaker:', error); return null; }
  const row = data as DbRow | null;
  return {
    currentSpeaker: row?.country
      ? { delegateId: row.delegate_id as string, country: row.country as string }
      : null,
    speakerTimeRemaining: (row?.time_remaining as number) ?? 0,
    speakerStartedAt: (row?.started_at as string | null) ?? null,
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

export async function getDelegatesList(committeeId: string): Promise<Delegate[]> {
  const { data, error } = await supabase.from('delegates')
    .select('id, country, status, is_observer')
    .eq('committee_id', committeeId).order('country', { ascending: true });
  if (error) { console.error('Error fetching delegates:', error); return []; }
  return (data ?? []).map((d: DbRow) => ({
    id: d.id as string, country: d.country as string, status: d.status as DelegateStatus,
    isObserver: (d.is_observer as boolean) ?? false,
  }));
}

// Both GSL and caucus queues in one round-trip (getCommitteeByCode uses two).
export async function getSpeakersLists(committeeId: string): Promise<{ speakersList: SpeakerEntry[]; caucusQueue: SpeakerEntry[] }> {
  const { data, error } = await supabase.from('speakers_list')
    .select('delegate_id, country, list_type, position')
    .eq('committee_id', committeeId).order('position', { ascending: true });
  if (error) { console.error('Error fetching speakers lists:', error); return { speakersList: [], caucusQueue: [] }; }
  const rows = (data ?? []) as DbRow[];
  const toEntry = (s: DbRow): SpeakerEntry => ({ delegateId: s.delegate_id as string, country: s.country as string });
  return {
    speakersList: rows.filter((s) => s.list_type === 'gsl').map(toEntry),
    caucusQueue: rows.filter((s) => s.list_type === 'caucus').map(toEntry),
  };
}

export async function getMessagesList(committeeId: string): Promise<Committee['messages']> {
  const { data, error } = await supabase.from('messages')
    .select('id, sender, content, created_at, is_private, recipient')
    .eq('committee_id', committeeId).order('created_at', { ascending: true });
  if (error) { console.error('Error fetching messages:', error); return []; }
  return (data ?? []).map((m: DbRow) => ({
    id: m.id as string, sender: m.sender as string, content: m.content as string,
    timestamp: new Date(m.created_at as string), isPrivate: m.is_private as boolean,
    recipient: m.recipient as string | undefined,
  }));
}

export async function getDocumentsList(committeeId: string): Promise<CommitteeDocument[]> {
  const { data, error } = await supabase.from('documents')
    .select('*').eq('committee_id', committeeId).order('created_at', { ascending: true });
  if (error) { console.error('Error fetching documents:', error); return []; }
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
  }));
}

export async function getPendingMotionsList(committeeId: string): Promise<PendingMotion[]> {
  // Include gsl-request / join-request pseudo-motions — the delegate view reads them from here
  // to show "awaiting approval". The main feed filters them out at the display layer.
  const { data, error } = await supabase.from('motions')
    .select('*').eq('committee_id', committeeId).eq('status', 'pending')
    .order('disruptiveness', { ascending: false });
  if (error) { console.error('Error fetching motions:', error); return []; }
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

export async function addPendingMotion(
  committeeId: string, motion: Omit<PendingMotion, 'id' | 'disruptiveness'>,
  code: string, chairSuffix: string | undefined, motionOrder?: string[],
): Promise<string | null> {
  const disruptiveness = calcDisruptiveness(motion.type, motion.totalTime, motionOrder);
  const { data, error } = await sessionClient(code, chairSuffix).from('motions').insert({
    committee_id: committeeId, type: motion.type, proposed_by: motion.proposedBy,
    total_time: motion.totalTime, speaking_time: motion.speakingTime, topic: motion.topic,
    tour_order: motion.tourOrder ?? null,
    status: 'pending', disruptiveness,
  }).select('id').single();
  if (error) { console.error('Error adding motion:', error); return null; }
  return data.id as string;
}

export async function removePendingMotion(motionId: string, code: string, chairSuffix?: string): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('motions').delete().eq('id', motionId);
  if (error) console.error('Error removing motion:', error);
}

export async function clearPendingMotions(committeeId: string, code: string, chairSuffix?: string): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('motions').delete()
    .eq('committee_id', committeeId).eq('status', 'pending');
  if (error) console.error('Error clearing motions:', error);
}

// ============================================================
// CAUCUS
// ============================================================

export async function updateCaucus(committeeId: string, caucus: CaucusState | null, code: string, chairSuffix?: string): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('committees').update({ caucus }).eq('id', committeeId);
  if (error) console.error('Error updating caucus:', error);
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
  };
}

export async function updateDocumentStatus(docId: string, status: DocumentStatus, code: string, chairSuffix?: string): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('documents').update({ status }).eq('id', docId);
  if (error) console.error('Error updating document status:', error);
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
  const payload = JSON.stringify({ ...e, timestamp: new Date().toISOString() });
  const { error } = await sessionClient(code, chairSuffix).from('messages').insert({
    committee_id: committeeId, sender: '__system__',
    content: `__log__:${payload}`, is_private: true, recipient: '__log__',
  });
  if (error) console.error('Error logging event:', error);
}

export async function logSpeakingTime(
  committeeId: string,
  country: string,
  seconds: number,
  context: 'speakers-list' | 'moderated-caucus' | 'unmoderated-caucus' | 'tour-de-table',
  topic: string,
  code: string,
  chairSuffix?: string,
): Promise<void> {
  if (seconds <= 0) return;
  await logEvent(committeeId, { country, type: 'speech', seconds, context, topic }, code, chairSuffix);
}

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
  createdAt: string;
}

export async function addFeedback(
  committeeId: string, country: string, chairName: string, content: string,
  code: string, chairSuffix: string | undefined,
  opts?: { level?: FeedbackLevel; factorScores?: Record<string, number>; speechContext?: string | null; speechSeconds?: number | null },
): Promise<string | null> {
  const { data, error } = await sessionClient(code, chairSuffix).from('feedback').insert({
    committee_id: committeeId, country, chair_name: chairName, content,
    level: opts?.level ?? 'speech',
    factor_scores: opts?.factorScores ?? {},
    speech_context: opts?.speechContext ?? null,
    speech_seconds: opts?.speechSeconds ?? null,
  }).select('id').single();
  if (error) { console.error('Error adding feedback:', error); return null; }
  return data.id as string;
}

export async function updateFeedback(
  id: string, patch: { content?: string; factorScores?: Record<string, number>; speechContext?: string | null; speechSeconds?: number | null },
  code: string, chairSuffix?: string,
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.content !== undefined) update.content = patch.content;
  if (patch.factorScores !== undefined) update.factor_scores = patch.factorScores;
  if (patch.speechContext !== undefined) update.speech_context = patch.speechContext;
  if (patch.speechSeconds !== undefined) update.speech_seconds = patch.speechSeconds;
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
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await sessionClient(code, chairSuffix).from('committees')
    .update({ expires_at: expiresAt, phase: 'adjourned' }).eq('id', committeeId);
  if (error) console.error('Error suspending session:', error);
}

export async function resumeSession(committeeId: string, code: string, chairSuffix?: string): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('committees')
    .update({ suspended_at: null, phase: 'speakers-list' }).eq('id', committeeId);
  if (error) console.error('Error resuming session:', error);
}

export async function claimResumeSession(committeeId: string, chairName: string, code: string, chairSuffix?: string): Promise<boolean> {
  const { data, error } = await sessionClient(code, chairSuffix)
    .from('committees')
    .update({ resuming_chair: chairName })
    .eq('id', committeeId)
    .is('resuming_chair', null)
    .select('id')
    .single();
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
export async function startResumeRollCall(committeeId: string, code: string, chairSuffix?: string): Promise<boolean> {
  const { data, error } = await sessionClient(code, chairSuffix).from('committees').update({
    suspended_at: null,
    resuming_chair: null,
    phase: 'pre-session',
  }).eq('id', committeeId).select('id').maybeSingle();
  if (error) console.error('Error starting resume roll call:', error);
  return !error && !!data;
}

export async function suspendDebate(committeeId: string, code: string, chairSuffix?: string): Promise<void> {
  const { error } = await sessionClient(code, chairSuffix).from('committees')
    .update({ suspended_at: new Date().toISOString(), phase: 'adjourned' })
    .eq('id', committeeId);
  if (error) console.error('Error suspending debate:', error);
}

export async function endDebate(committeeId: string, code: string, chairSuffix?: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();
  const { error } = await sessionClient(code, chairSuffix).from('committees')
    .update({ ended_at: new Date().toISOString(), expires_at: expiresAt, phase: 'adjourned' })
    .eq('id', committeeId);
  if (error) console.error('Error ending debate:', error);
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

export async function updateCommitteeChairSuffixInDB(committeeId: string, chairJoinSuffix: string, code: string, currentChairSuffix?: string): Promise<void> {
  const { data: existing } = await supabase
    .from('committees')
    .select('settings')
    .eq('id', committeeId)
    .single();
  const currentSettings = (existing?.settings as Record<string, unknown>) ?? {};
  await sessionClient(code, currentChairSuffix)
    .from('committees')
    .update({ settings: { ...currentSettings, chairJoinSuffix } })
    .eq('id', committeeId);
}

// ============================================================
// HEAD CHAIR  (persisted in settings jsonb; claim-at-will)
// ============================================================
// Sets who holds the gavel. Any chair may claim it — from Settings or when joining as chair.
// Stored in settings so every device derives view-only status from it instead of a
// presence join-order race. null/unset → the committee creator (chair_names[0]) is head.
export async function updateCommitteeHeadChairInDB(committeeId: string, headChair: string, code: string, chairSuffix?: string): Promise<void> {
  const { data: existing } = await supabase
    .from('committees')
    .select('settings')
    .eq('id', committeeId)
    .single();
  const currentSettings = (existing?.settings as Record<string, unknown>) ?? {};
  const { error } = await sessionClient(code, chairSuffix)
    .from('committees')
    .update({ settings: { ...currentSettings, headChair } })
    .eq('id', committeeId);
  if (error) console.error('Error setting head chair:', error);
}

// Persist the scoring config into the committee settings jsonb so it reaches
// delegates / FAs / co-chairs on other devices (localStorage never syncs across devices).
export async function updateCommitteeScoringInDB(committeeId: string, scoring: unknown, code: string, chairSuffix?: string): Promise<void> {
  const { data: existing } = await supabase
    .from('committees')
    .select('settings')
    .eq('id', committeeId)
    .single();
  const currentSettings = (existing?.settings as Record<string, unknown>) ?? {};
  await sessionClient(code, chairSuffix)
    .from('committees')
    .update({ settings: { ...currentSettings, scoring } })
    .eq('id', committeeId);
}

// ============================================================
// CHAIR NAMES
// ============================================================

export async function addChairName(committeeId: string, name: string, code: string, chairSuffix?: string): Promise<void> {
  const { data } = await supabase
    .from('committees')
    .select('chair_names')
    .eq('id', committeeId)
    .single();
  const current: string[] = data?.chair_names ?? [];
  if (current.includes(name)) return;
  const { error } = await sessionClient(code, chairSuffix)
    .from('committees')
    .update({ chair_names: [...current, name] })
    .eq('id', committeeId);
  if (error) console.error('Error adding chair name:', error);
}

export async function updateSpeakerTimeLimit(committeeId: string, limitSeconds: number, code: string, chairSuffix?: string): Promise<void> {
  await sessionClient(code, chairSuffix).from('committees').update({ speaker_time_limit: limitSeconds }).eq('id', committeeId);
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
  const nowIso = new Date().toISOString();
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

export function subscribeToCommittee(
  committeeId: string,
  onChange: (table: string) => void,
  // Realtime does NOT replay events missed while the socket was down — the normal case for a
  // backgrounded phone. Callers use this to run a catch-up fetch on every re-SUBSCRIBED.
  onStatus?: (status: RealtimeStatus) => void,
): () => void {
  // Tear down any prior channel for this committee first.
  const prev = committeeChannels[committeeId];
  if (prev) { supabase.removeChannel(prev); delete committeeChannels[committeeId]; }

  const channel = supabase
    .channel(`committee-${committeeId}-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'committees', filter: `id=eq.${committeeId}` }, () => onChange('committees'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'delegates', filter: `committee_id=eq.${committeeId}` }, () => onChange('delegates'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'speakers_list', filter: `committee_id=eq.${committeeId}` }, () => onChange('speakers_list'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'current_speaker', filter: `committee_id=eq.${committeeId}` }, () => onChange('current_speaker'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'motions', filter: `committee_id=eq.${committeeId}` }, () => onChange('motions'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `committee_id=eq.${committeeId}` }, () => onChange('documents'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `committee_id=eq.${committeeId}` }, () => onChange('messages'))
    // Chair notes and factor ratings. These are NOT optimistic speaker/timer/caucus
    // state, so RULE 4's debounce does not apply to them — and they are the one input
    // to the scoreboard that was previously mount-only, which is why two chairs
    // writing at once never saw each other and the scoreboard went stale while open.
    .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback', filter: `committee_id=eq.${committeeId}` }, () => onChange('feedback'))
    // Organiser broadcasts are fanned out one row per committee, so the same committee_id
    // filter every other table uses is all that is needed — no conference lookup.
    .on('postgres_changes', { event: '*', schema: 'public', table: 'session_broadcasts', filter: `committee_id=eq.${committeeId}` }, () => onChange('session_broadcasts'))
    .subscribe((status) => { onStatus?.(status as RealtimeStatus); });
  committeeChannels[committeeId] = channel;
  return () => {
    supabase.removeChannel(channel);
    if (committeeChannels[committeeId] === channel) delete committeeChannels[committeeId];
  };
}