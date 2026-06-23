// ============================================================
// src/lib/committeeService.ts
// All Supabase database operations for Gavelling.
// ============================================================

import { supabase } from './supabase';
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
  // The 4 orderable types: position 0 = 4M base, position 1 = 3M, etc.
  const order = motionOrder ?? ['moderated', 'unmoderated', 'tour', 'consultation'];
  const idx = order.indexOf(type);
  const base = idx >= 0 ? (4 - idx) * 1_000_000 : 1_000_000;
  return base + totalTime;
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
    dbSeparateChairCode: ((row.settings as Record<string, unknown>)?.separateChairCode as boolean) ?? false,
    dbSettings: (row.settings as Record<string, unknown>) ?? null,
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

    const { data: committeeRow, error: committeeError } = await supabase
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
        const { error: delegateError } = await supabase.from('delegates').insert(batch);
        if (delegateError) console.error('Error inserting delegates batch:', delegateError);
      }
    }

    await supabase.from('current_speaker').insert({
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
    supabase.from('motions').select('*').eq('committee_id', committeeRow.id).eq('status', 'pending').not('type', 'in', '("gsl-request","join-request")').order('disruptiveness', { ascending: false }),
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

export async function saveCommitteeSettings(committeeId: string, settings: object): Promise<void> {
  // Merge into the existing settings jsonb so chairJoinSuffix/separateChairCode are preserved.
  const { data: row, error: readErr } = await supabase
    .from('committees').select('settings').eq('id', committeeId).single();
  if (readErr) { console.error('Error reading committee settings:', readErr); return; }
  const current = (row?.settings as Record<string, unknown>) ?? {};
  const merged = { ...current, ...settings };
  const { error } = await supabase.from('committees').update({ settings: merged }).eq('id', committeeId);
  if (error) console.error('Error saving committee settings:', error);
}

// ============================================================
// PHASE MANAGEMENT
// ============================================================

export async function setPhase(committeeId: string, phase: SessionPhase): Promise<void> {
  const { error } = await supabase.from('committees').update({ phase }).eq('id', committeeId);
  if (error) console.error('Error setting phase:', error);
}

// ============================================================
// ROLL CALL
// ============================================================

export async function setDelegateStatus(delegateId: string, status: DelegateStatus): Promise<void> {
  const { error } = await supabase.from('delegates').update({ status }).eq('id', delegateId);
  if (error) console.error('Error setting delegate status:', error);
}

export async function setDelegateObserver(delegateId: string, isObserver: boolean): Promise<void> {
  const { error } = await supabase.from('delegates').update({ is_observer: isObserver }).eq('id', delegateId);
  if (error) console.error('Error setting delegate observer:', error);
}

export async function batchSetDelegateStatuses(
  updates: { id: string; status: DelegateStatus }[]
): Promise<void> {
  await Promise.all(updates.map(({ id, status }) => setDelegateStatus(id, status)));
}

// ============================================================
// GSL — General Speakers List (list_type = 'gsl')
// Never touched by caucuses or motions
// ============================================================

export async function addToSpeakersList(committeeId: string, delegateId: string, country: string, position?: number): Promise<void> {
  const pos = position !== undefined ? position : Date.now();
  const { error } = await supabase.from('speakers_list').insert({
    committee_id: committeeId, delegate_id: delegateId, country,
    position: pos, list_type: 'gsl',
  });
  if (error) console.error('Error adding to GSL:', error);
}

export async function removeFromSpeakersList(committeeId: string, delegateId: string): Promise<void> {
  const { error } = await supabase.from('speakers_list').delete()
    .eq('committee_id', committeeId).eq('delegate_id', delegateId).eq('list_type', 'gsl');
  if (error) console.error('Error removing from GSL:', error);
}

// ============================================================
// CAUCUS LIST (list_type = 'caucus')
// Temporary — per-motion, wiped when caucus ends, GSL untouched
// ============================================================

export async function addToCaucusList(committeeId: string, delegateId: string, country: string, position?: number): Promise<void> {
  const pos = position !== undefined ? position : Date.now();
  const { error } = await supabase.from('speakers_list').insert({
    committee_id: committeeId, delegate_id: delegateId, country,
    position: pos, list_type: 'caucus',
  });
  if (error) console.error('Error adding to caucus list:', error);
}

// Batch insert entire caucus list at once — avoids sequential await rate limits
export async function batchAddToCaucusList(
  committeeId: string,
  delegates: { delegateId: string; country: string }[],
): Promise<void> {
  if (delegates.length === 0) return;
  const rows = delegates.map((d, i) => ({
    committee_id: committeeId,
    delegate_id: d.delegateId,
    country: d.country,
    position: i + 1,
    list_type: 'caucus',
  }));
  const { error } = await supabase.from('speakers_list').insert(rows);
  if (error) console.error('Error batch adding to caucus list:', error);
}

export async function removeFromCaucusList(committeeId: string, delegateId: string): Promise<void> {
  const { error } = await supabase.from('speakers_list').delete()
    .eq('committee_id', committeeId).eq('delegate_id', delegateId).eq('list_type', 'caucus');
  if (error) console.error('Error removing from caucus list:', error);
}

export async function clearCaucusList(committeeId: string): Promise<void> {
  const { error } = await supabase.from('speakers_list').delete()
    .eq('committee_id', committeeId).eq('list_type', 'caucus');
  if (error) console.error('Error clearing caucus list:', error);
}

export async function reorderSpeakersList(
  committeeId: string,
  entries: { delegateId: string; country: string }[],
  listType: 'gsl' | 'caucus' = 'gsl',
): Promise<void> {
  if (entries.length === 0) return;
  // Parallel in-place position updates — avoids DELETE+INSERT which fires a
  // DELETE realtime event causing the delegate view to briefly flash an empty list.
  await Promise.all(
    entries.map((e, i) =>
      supabase.from('speakers_list')
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

export async function addDelegate(committeeId: string, country: string): Promise<string | null> {
  const { data, error } = await supabase.from('delegates')
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
): Promise<void> {
  await Promise.all([
    removeDelegateId
      ? supabase.from('speakers_list').delete()
          .eq('committee_id', committeeId)
          .eq('delegate_id', removeDelegateId)
          .eq('list_type', 'gsl')
      : Promise.resolve(),
    supabase.from('current_speaker')
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
export async function syncSpeakerTime(committeeId: string, timeRemaining: number): Promise<void> {
  await supabase.from('current_speaker')
    .update({ time_remaining: timeRemaining })
    .eq('committee_id', committeeId);
}

export async function startSpeakerTimer(committeeId: string): Promise<void> {
  await supabase.from('current_speaker')
    .update({ started_at: new Date().toISOString() })
    .eq('committee_id', committeeId);
}

export async function stopSpeakerTimer(committeeId: string): Promise<void> {
  await supabase.from('current_speaker')
    .update({ started_at: null })
    .eq('committee_id', committeeId);
}

export async function clearCurrentSpeaker(committeeId: string): Promise<void> {
  await supabase.from('current_speaker')
    .update({ delegate_id: null, country: null, time_remaining: 0, started_at: null })
    .eq('committee_id', committeeId);
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
// MOTIONS
// ============================================================

export async function addPendingMotion(
  committeeId: string, motion: Omit<PendingMotion, 'id' | 'disruptiveness'>, motionOrder?: string[],
): Promise<string | null> {
  const disruptiveness = calcDisruptiveness(motion.type, motion.totalTime, motionOrder);
  const { data, error } = await supabase.from('motions').insert({
    committee_id: committeeId, type: motion.type, proposed_by: motion.proposedBy,
    total_time: motion.totalTime, speaking_time: motion.speakingTime, topic: motion.topic,
    tour_order: motion.tourOrder ?? null,
    status: 'pending', disruptiveness,
  }).select('id').single();
  if (error) { console.error('Error adding motion:', error); return null; }
  return data.id as string;
}

export async function removePendingMotion(motionId: string): Promise<void> {
  const { error } = await supabase.from('motions').delete().eq('id', motionId);
  if (error) console.error('Error removing motion:', error);
}

export async function clearPendingMotions(committeeId: string): Promise<void> {
  const { error } = await supabase.from('motions').delete()
    .eq('committee_id', committeeId).eq('status', 'pending');
  if (error) console.error('Error clearing motions:', error);
}

// ============================================================
// CAUCUS
// ============================================================

export async function updateCaucus(committeeId: string, caucus: CaucusState | null): Promise<void> {
  const { error } = await supabase.from('committees').update({ caucus }).eq('id', committeeId);
  if (error) console.error('Error updating caucus:', error);
}

// ============================================================
// DOCUMENTS
// ============================================================

export async function addDocument(
  committeeId: string, doc: Omit<CommitteeDocument, 'id' | 'submittedAt'>,
): Promise<CommitteeDocument | null> {
  const { data, error } = await supabase.from('documents').insert({
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
  };
}

export async function updateDocumentStatus(docId: string, status: DocumentStatus): Promise<void> {
  const { error } = await supabase.from('documents').update({ status }).eq('id', docId);
  if (error) console.error('Error updating document status:', error);
}

export async function updateDocumentTimings(
  docId: string,
  readingMinutes: number,
  presentationMinutes: number,
  qaMinutes: number,
  status: DocumentStatus,
): Promise<void> {
  const { error } = await supabase.from('documents').update({
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
): Promise<void> {
  const { error } = await supabase.from('documents')
    .delete()
    .eq('committee_id', committeeId)
    .eq('type', type);
  if (error) console.error('Error deleting documents by type:', error);
}

export async function removeDocument(docId: string): Promise<void> {
  const { error } = await supabase.from('documents').delete().eq('id', docId);
  if (error) console.error('Error removing document:', error);
}

// ============================================================
// CHAT
// ============================================================

export async function sendMessage(
  committeeId: string, sender: string, content: string,
  isPrivate: boolean = false, recipient?: string,
  messageType?: 'general' | 'speech-comment',
): Promise<void> {
  // Encode messageType as a prefix so it survives without a schema change
  const encoded = messageType === 'speech-comment' ? `[🎙️] ${content}` : content;
  const { error } = await supabase.from('messages').insert({
    committee_id: committeeId, sender, content: encoded, is_private: isPrivate, recipient: recipient ?? null,
  });
  if (error) console.error('Error sending message:', error);
}

// ============================================================
// JOIN REQUESTS  (stored as motions with type='join-request')
// ============================================================

export async function requestJoinSession(
  committeeId: string, delegateId: string, country: string,
  desiredStatus: 'present' | 'present-voting',
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

  const { error } = await supabase.from('motions').insert({
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
): Promise<void> {
  await setDelegateStatus(delegateId, desiredStatus);
  const { error } = await supabase.from('motions').delete().eq('id', motionId);
  if (error) console.error('Error approving join request:', error);
}

export async function denyJoinRequest(motionId: string): Promise<void> {
  const { error } = await supabase.from('motions').delete().eq('id', motionId);
  if (error) console.error('Error denying join request:', error);
}

// ============================================================
// GSL REQUESTS — delegate asks chair to add them to the GSL
// ============================================================

export async function requestGslSpot(committeeId: string, delegateId: string, country: string): Promise<void> {
  // Idempotent — ignore if already pending
  const { data: existing } = await supabase
    .from('motions').select('id')
    .eq('committee_id', committeeId).eq('type', 'gsl-request')
    .eq('proposed_by', country).eq('status', 'pending').maybeSingle();
  if (existing) return;
  const { error } = await supabase.from('motions').insert({
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
): Promise<void> {
  await addToSpeakersList(committeeId, delegateId, country);
  const { error } = await supabase.from('motions').delete().eq('id', motionId);
  if (error) console.error('Error approving GSL request:', error);
}

export async function denyGslRequest(motionId: string): Promise<void> {
  const { error } = await supabase.from('motions').delete().eq('id', motionId);
  if (error) console.error('Error denying GSL request:', error);
}

// ============================================================
// SPEAKING LOG  (stored as system messages, used for statistics)
// ============================================================

export async function logSpeakingTime(
  committeeId: string,
  country: string,
  seconds: number,
  context: 'speakers-list' | 'moderated-caucus' | 'unmoderated-caucus' | 'tour-de-table',
  topic: string,
): Promise<void> {
  if (seconds <= 0) return;
  const payload = JSON.stringify({ country, seconds, context, topic, timestamp: new Date().toISOString() });
  const { error } = await supabase.from('messages').insert({
    committee_id: committeeId,
    sender: '__system__',
    content: `__log__:${payload}`,
    is_private: true,
    recipient: '__log__',
  });
  if (error) console.error('Error logging speaking time:', error);
}

// ============================================================
// FEEDBACK
// ============================================================

export async function addFeedback(
  committeeId: string, country: string, chairName: string, content: string,
): Promise<void> {
  const { error } = await supabase.from('feedback').insert({
    committee_id: committeeId, country, chair_name: chairName, content,
  });
  if (error) console.error('Error adding feedback:', error);
}

export async function getFeedbackForCommittee(
  committeeId: string,
): Promise<Record<string, { chairName: string; content: string; createdAt: string }[]>> {
  const { data, error } = await supabase.from('feedback').select('*')
    .eq('committee_id', committeeId).order('created_at', { ascending: true });
  if (error || !data) return {};
  const grouped: Record<string, { chairName: string; content: string; createdAt: string }[]> = {};
  for (const row of data) {
    const country = row.country as string;
    if (!grouped[country]) grouped[country] = [];
    grouped[country].push({
      chairName: row.chair_name as string,
      content: row.content as string,
      createdAt: row.created_at as string,
    });
  }
  return grouped;
}

// ============================================================
// SESSION CLEANUP
// ============================================================

export async function suspendSession(committeeId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from('committees')
    .update({ expires_at: expiresAt, phase: 'adjourned' }).eq('id', committeeId);
  if (error) console.error('Error suspending session:', error);
}

export async function resumeSession(committeeId: string): Promise<void> {
  const { error } = await supabase.from('committees')
    .update({ suspended_at: null, phase: 'speakers-list' }).eq('id', committeeId);
  if (error) console.error('Error resuming session:', error);
}

export async function claimResumeSession(committeeId: string, chairName: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('committees')
    .update({ resuming_chair: chairName })
    .eq('id', committeeId)
    .is('resuming_chair', null)
    .select('id')
    .single();
  return !error && !!data;
}

export async function startResumeRollCall(committeeId: string): Promise<void> {
  const { error } = await supabase.from('committees').update({
    suspended_at: null,
    resuming_chair: null,
    phase: 'pre-session',
  }).eq('id', committeeId);
  if (error) console.error('Error starting resume roll call:', error);
}

export async function suspendDebate(committeeId: string): Promise<void> {
  const { error } = await supabase.from('committees')
    .update({ suspended_at: new Date().toISOString(), phase: 'adjourned' })
    .eq('id', committeeId);
  if (error) console.error('Error suspending debate:', error);
}

export async function endDebate(committeeId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from('committees')
    .update({ ended_at: new Date().toISOString(), expires_at: expiresAt, phase: 'adjourned' })
    .eq('id', committeeId);
  if (error) console.error('Error ending debate:', error);
}

// ============================================================
// CODE MANAGEMENT
// ============================================================

export async function updateCommitteeCode(committeeId: string, newCode: string): Promise<boolean> {
  const upper = newCode.toUpperCase().trim();
  if (!upper || upper.length < 4) return false;

  // Check uniqueness
  const { data: existing } = await supabase
    .from('committees').select('id').eq('code', upper).maybeSingle();
  if (existing) return false; // code already taken

  const { error } = await supabase
    .from('committees').update({ code: upper }).eq('id', committeeId);
  if (error) { console.error('Error updating committee code:', error); return false; }
  return true;
}

// ============================================================
// CHAIR JOIN SUFFIX
// ============================================================

export async function updateCommitteeChairSuffixInDB(committeeId: string, chairJoinSuffix: string): Promise<void> {
  const { data: existing } = await supabase
    .from('committees')
    .select('settings')
    .eq('id', committeeId)
    .single();
  const currentSettings = (existing?.settings as Record<string, unknown>) ?? {};
  await supabase
    .from('committees')
    .update({ settings: { ...currentSettings, chairJoinSuffix } })
    .eq('id', committeeId);
}

// ============================================================
// CHAIR NAMES
// ============================================================

export async function addChairName(committeeId: string, name: string): Promise<void> {
  const { data } = await supabase
    .from('committees')
    .select('chair_names')
    .eq('id', committeeId)
    .single();
  const current: string[] = data?.chair_names ?? [];
  if (current.includes(name)) return;
  const { error } = await supabase
    .from('committees')
    .update({ chair_names: [...current, name] })
    .eq('id', committeeId);
  if (error) console.error('Error adding chair name:', error);
}

export async function updateSpeakerTimeLimit(committeeId: string, limitSeconds: number): Promise<void> {
  await supabase.from('committees').update({ speaker_time_limit: limitSeconds }).eq('id', committeeId);
}

// ============================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================

export function subscribeToCommittee(committeeId: string, onChange: (table: string) => void): () => void {
  // Stable channel name per committee — a re-subscribe must REPLACE the prior connection,
  // not stack a new one. A unique suffix (e.g. Date.now()) caused every effect re-run /
  // StrictMode double-invoke / reconnect to open a brand-new websocket under a fresh name,
  // accumulating connections (the concurrent-peak spike). One multiplexed channel per tab.
  const channel = supabase
    .channel(`committee-${committeeId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'committees', filter: `id=eq.${committeeId}` }, () => onChange('committees'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'delegates', filter: `committee_id=eq.${committeeId}` }, () => onChange('delegates'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'speakers_list', filter: `committee_id=eq.${committeeId}` }, () => onChange('speakers_list'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'current_speaker', filter: `committee_id=eq.${committeeId}` }, () => onChange('current_speaker'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'motions', filter: `committee_id=eq.${committeeId}` }, () => onChange('motions'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `committee_id=eq.${committeeId}` }, () => onChange('documents'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `committee_id=eq.${committeeId}` }, () => onChange('messages'))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}