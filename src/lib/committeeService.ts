// ============================================================
// src/lib/committeeService.ts
// All Supabase database operations for Gavelling.
// Import and call these functions instead of using the
// Zustand store directly whenever you need data to persist
// across devices.
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

// ── Helpers ──────────────────────────────────────────────────

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function calcDisruptiveness(type: PendingMotionType, totalTime: number): number {
  const base = {
    consultation: 4_000_000,
    tour: 3_000_000,
    unmoderated: 2_000_000,
    moderated: 1_000_000,
  };
  return base[type] + totalTime;
}

// ── Types returned by Supabase queries ───────────────────────

type DbRow = Record<string, unknown>;

// ── Convert a Supabase committee row → Committee type ────────
// This bridges the database shape (snake_case) to the
// TypeScript shape (camelCase) that the rest of the app uses.

function rowToCommittee(
  row: DbRow,
  delegates: Delegate[] = [],
  speakersList: SpeakerEntry[] = [],
  currentSpeaker: SpeakerEntry | null = null,
  speakerTimeRemaining: number = 0,
  pendingMotions: PendingMotion[] = [],
  documents: CommitteeDocument[] = [],
  messages: Committee['messages'] = [],
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
    currentSpeaker,
    speakerTimeLimit: row.speaker_time_limit as number,
    speakerTimeRemaining,
    motions: [],
    pendingMotions,
    resolutions: [],
    documents,
    caucus: (row.caucus as CaucusState) ?? null,
    messages,
    createdAt: new Date(row.created_at as string),
  };
}

// ============================================================
// COMMITTEE LIFECYCLE
// ============================================================

/**
 * createCommittee
 * Called when a chair clicks "Start Committee".
 * Writes the committee + all delegates to Supabase.
 * Returns the 6-character session code on success, null on error.
 */
export async function createCommittee(
  name: string,
  topic: string,
  chairNames: string[],
  delegateNames: string[],
): Promise<string | null> {
  const code = generateCode();

  // 1. Insert the committee row
  const { data: committeeRow, error: committeeError } = await supabase
    .from('committees')
    .insert({
      code,
      name,
      topic,
      chair_names: chairNames,
      phase: 'pre-session',
      speaker_time_limit: 90,
    })
    .select()
    .single();

  if (committeeError || !committeeRow) {
    console.error('Error creating committee:', committeeError);
    return null;
  }

  // 2. Insert all delegates in one batch
  if (delegateNames.length > 0) {
    const delegateRows = delegateNames.map((country) => ({
      committee_id: committeeRow.id,
      country,
      status: 'absent',
    }));

    const { error: delegateError } = await supabase
      .from('delegates')
      .insert(delegateRows);

    if (delegateError) {
      console.error('Error inserting delegates:', delegateError);
      // Committee was created — return the code anyway so the
      // chair isn't left with a broken session
    }
  }

  // 3. Create the current_speaker placeholder row
  await supabase.from('current_speaker').insert({
    committee_id: committeeRow.id,
    delegate_id: null,
    country: null,
    time_remaining: 90,
  });

  return code;
}

/**
 * getCommitteeByCode
 * Fetches a full committee from Supabase by its 6-char code.
 * Used by:
 *   - Chair rejoining a session from any device (item 1)
 *   - Delegate joining a session
 *   - Advisor joining a session
 * Returns null if the code doesn't match any committee.
 */
export async function getCommitteeByCode(code: string): Promise<Committee | null> {
  const upperCode = code.toUpperCase();

  // 1. Fetch the committee row
  const { data: committeeRow, error: committeeError } = await supabase
    .from('committees')
    .select('*')
    .eq('code', upperCode)
    .single();

  if (committeeError || !committeeRow) {
    return null;
  }

  // 2. Fetch delegates
  const { data: delegateRows } = await supabase
    .from('delegates')
    .select('*')
    .eq('committee_id', committeeRow.id)
    .order('country', { ascending: true });

  const delegates: Delegate[] = (delegateRows ?? []).map((d: DbRow) => ({
    id: d.id as string,
    country: d.country as string,
    status: d.status as DelegateStatus,
  }));

  // 3. Fetch speakers list
  const { data: speakersRows } = await supabase
    .from('speakers_list')
    .select('*')
    .eq('committee_id', committeeRow.id)
    .order('position', { ascending: true });

  const speakersList: SpeakerEntry[] = (speakersRows ?? []).map((s: DbRow) => ({
    delegateId: s.delegate_id as string,
    country: s.country as string,
  }));

  // 4. Fetch current speaker
  const { data: speakerRow } = await supabase
    .from('current_speaker')
    .select('*')
    .eq('committee_id', committeeRow.id)
    .single();

  const currentSpeaker: SpeakerEntry | null =
    speakerRow?.country
      ? { delegateId: speakerRow.delegate_id as string, country: speakerRow.country as string }
      : null;

  const speakerTimeRemaining = (speakerRow?.time_remaining as number) ?? 0;

  // 5. Fetch pending motions
  const { data: motionRows } = await supabase
    .from('motions')
    .select('*')
    .eq('committee_id', committeeRow.id)
    .eq('status', 'pending')
    .order('disruptiveness', { ascending: false });

  const pendingMotions: PendingMotion[] = (motionRows ?? []).map((m: DbRow) => ({
    id: m.id as string,
    type: m.type as PendingMotionType,
    proposedBy: m.proposed_by as string,
    totalTime: m.total_time as number,
    speakingTime: m.speaking_time as number,
    topic: m.topic as string,
    speakerList: [],
    proposerPosition: null,
    disruptiveness: m.disruptiveness as number,
  }));

  // 6. Fetch documents
  const { data: docRows } = await supabase
    .from('documents')
    .select('*')
    .eq('committee_id', committeeRow.id)
    .order('created_at', { ascending: true });

  const documents: CommitteeDocument[] = (docRows ?? []).map((d: DbRow) => ({
    id: d.id as string,
    type: d.type as CommitteeDocument['type'],
    docCode: d.doc_code as string,
    title: d.title as string,
    sponsors: (d.sponsors as string[]) ?? [],
    content: (d.content as string) ?? '',
    status: d.status as DocumentStatus,
    submittedAt: d.created_at as string,
    fileUrl: d.file_url as string | undefined,
    fileName: d.file_name as string | undefined,
  }));

  // 7. Fetch messages
  const { data: messageRows } = await supabase
    .from('messages')
    .select('*')
    .eq('committee_id', committeeRow.id)
    .order('created_at', { ascending: true });

  const messages: Committee['messages'] = (messageRows ?? []).map((m: DbRow) => ({
    id: m.id as string,
    sender: m.sender as string,
    content: m.content as string,
    timestamp: new Date(m.created_at as string),
    isPrivate: m.is_private as boolean,
    recipient: m.recipient as string | undefined,
  }));

  return rowToCommittee(
    committeeRow,
    delegates,
    speakersList,
    currentSpeaker,
    speakerTimeRemaining,
    pendingMotions,
    documents,
    messages,
  );
}

// ============================================================
// PHASE MANAGEMENT
// ============================================================

/**
 * setPhase
 * Updates the session phase — e.g. from roll-call to speakers-list.
 * Every connected screen reacts instantly via real-time.
 */
export async function setPhase(
  committeeId: string,
  phase: SessionPhase,
): Promise<void> {
  const { error } = await supabase
    .from('committees')
    .update({ phase })
    .eq('id', committeeId);

  if (error) console.error('Error setting phase:', error);
}

// ============================================================
// ROLL CALL
// ============================================================

/**
 * setDelegateStatus
 * Updates a single delegate's attendance status during roll call.
 */
export async function setDelegateStatus(
  delegateId: string,
  status: DelegateStatus,
): Promise<void> {
  const { error } = await supabase
    .from('delegates')
    .update({ status })
    .eq('id', delegateId);

  if (error) console.error('Error setting delegate status:', error);
}

// ============================================================
// SPEAKERS LIST
// ============================================================

/**
 * addToSpeakersList
 * Adds a delegate to the end of the speakers list queue.
 */
export async function addToSpeakersList(
  committeeId: string,
  delegateId: string,
  country: string,
): Promise<void> {
  // Get current max position
  const { data: existing } = await supabase
    .from('speakers_list')
    .select('position')
    .eq('committee_id', committeeId)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition = existing && existing.length > 0
    ? (existing[0].position as number) + 1
    : 1;

  const { error } = await supabase
    .from('speakers_list')
    .insert({ committee_id: committeeId, delegate_id: delegateId, country, position: nextPosition });

  if (error) console.error('Error adding to speakers list:', error);
}

/**
 * removeFromSpeakersList
 * Removes a delegate from the speakers list queue.
 */
export async function removeFromSpeakersList(
  committeeId: string,
  delegateId: string,
): Promise<void> {
  const { error } = await supabase
    .from('speakers_list')
    .delete()
    .eq('committee_id', committeeId)
    .eq('delegate_id', delegateId);

  if (error) console.error('Error removing from speakers list:', error);
}

/**
 * addDelegate
 * Adds a new country to a committee mid-session.
 */
export async function addDelegate(
  committeeId: string,
  country: string,
): Promise<void> {
  const { error } = await supabase
    .from('delegates')
    .insert({ committee_id: committeeId, country, status: 'absent' });
  if (error) console.error('Error adding delegate:', error);
}

/**
 * nextSpeaker
 * Advances to the next speaker — removes them from the queue
 * and sets them as the current speaker.
 */
export async function nextSpeaker(
  committeeId: string,
  speakerTimeLimit: number,
): Promise<void> {
  // Get the first person in the queue
  const { data: first } = await supabase
    .from('speakers_list')
    .select('*')
    .eq('committee_id', committeeId)
    .order('position', { ascending: true })
    .limit(1)
    .single();

  if (!first) {
    // No one in queue — clear current speaker
    await supabase
      .from('current_speaker')
      .update({ delegate_id: null, country: null, time_remaining: speakerTimeLimit })
      .eq('committee_id', committeeId);
    return;
  }

  // Remove them from the queue
  await supabase
    .from('speakers_list')
    .delete()
    .eq('id', first.id);

  // Set them as current speaker
  await supabase
    .from('current_speaker')
    .update({
      delegate_id: first.delegate_id,
      country: first.country,
      time_remaining: speakerTimeLimit,
    })
    .eq('committee_id', committeeId);
}

/**
 * tickSpeakerTimer
 * Decrements the current speaker's timer by 1 second.
 * Called every second by the chair's timer interval.
 */
export async function tickSpeakerTimer(committeeId: string): Promise<void> {
  const { data: row } = await supabase
    .from('current_speaker')
    .select('time_remaining')
    .eq('committee_id', committeeId)
    .single();

  if (!row || row.time_remaining <= 0) return;

  await supabase
    .from('current_speaker')
    .update({ time_remaining: row.time_remaining - 1 })
    .eq('committee_id', committeeId);
}

// ============================================================
// MOTIONS
// ============================================================

/**
 * addPendingMotion
 * Saves a new motion to the database.
 * Sorted by disruptiveness so the most disruptive shows first.
 */
export async function addPendingMotion(
  committeeId: string,
  motion: Omit<PendingMotion, 'id' | 'disruptiveness'>,
): Promise<void> {
  const disruptiveness = calcDisruptiveness(motion.type, motion.totalTime);

  const { error } = await supabase.from('motions').insert({
    committee_id: committeeId,
    type: motion.type,
    proposed_by: motion.proposedBy,
    total_time: motion.totalTime,
    speaking_time: motion.speakingTime,
    topic: motion.topic,
    status: 'pending',
    disruptiveness,
  });

  if (error) console.error('Error adding motion:', error);
}

/**
 * removePendingMotion
 * Deletes a motion — called when it's enacted or dismissed.
 */
export async function removePendingMotion(motionId: string): Promise<void> {
  const { error } = await supabase
    .from('motions')
    .delete()
    .eq('id', motionId);

  if (error) console.error('Error removing motion:', error);
}

/**
 * clearPendingMotions
 * Removes all pending motions for a committee.
 * Called when a motion passes and the caucus begins.
 */
export async function clearPendingMotions(committeeId: string): Promise<void> {
  const { error } = await supabase
    .from('motions')
    .delete()
    .eq('committee_id', committeeId)
    .eq('status', 'pending');

  if (error) console.error('Error clearing motions:', error);
}

// ============================================================
// CAUCUS
// ============================================================

/**
 * updateCaucus
 * Saves the full caucus state as a JSON blob on the committee row.
 * Called whenever caucus state changes (timer tick, speaker advance, etc.)
 */
export async function updateCaucus(
  committeeId: string,
  caucus: CaucusState | null,
): Promise<void> {
  const { error } = await supabase
    .from('committees')
    .update({ caucus })
    .eq('id', committeeId);

  if (error) console.error('Error updating caucus:', error);
}

// ============================================================
// DOCUMENTS (Working Papers + Draft Resolutions)
// ============================================================

/**
 * addDocument
 * Saves a new WP or DR to the database.
 */
export async function addDocument(
  committeeId: string,
  doc: Omit<CommitteeDocument, 'id' | 'submittedAt'>,
): Promise<void> {
  const { error } = await supabase.from('documents').insert({
    committee_id: committeeId,
    type: doc.type,
    doc_code: doc.docCode,
    title: doc.title,
    sponsors: doc.sponsors,
    content: doc.content,
    status: doc.status,
    file_url: doc.fileUrl ?? null,
  });

  if (error) console.error('Error adding document:', error);
}

/**
 * updateDocumentStatus
 * Advances a document through its lifecycle:
 * submitted → on-floor → introduced → passed/failed
 */
export async function updateDocumentStatus(
  docId: string,
  status: DocumentStatus,
): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({ status })
    .eq('id', docId);

  if (error) console.error('Error updating document status:', error);
}

/**
 * removeDocument
 * Deletes a document entirely.
 */
export async function removeDocument(docId: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', docId);

  if (error) console.error('Error removing document:', error);
}

// ============================================================
// CHAT
// ============================================================

/**
 * sendMessage
 * Saves a chat message to the database.
 * Real-time subscription on the messages table means every
 * connected screen sees it instantly.
 */
export async function sendMessage(
  committeeId: string,
  sender: string,
  content: string,
  isPrivate: boolean = false,
  recipient?: string,
): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    committee_id: committeeId,
    sender,
    content,
    is_private: isPrivate,
    recipient: recipient ?? null,
  });

  if (error) console.error('Error sending message:', error);
}

// ============================================================
// FEEDBACK (Chair notes on delegates — item 6)
// ============================================================

/**
 * addFeedback
 * Saves a chair's note about a specific delegation.
 * Survives session end — accessible post-session for review.
 */
export async function addFeedback(
  committeeId: string,
  country: string,
  chairName: string,
  content: string,
): Promise<void> {
  const { error } = await supabase.from('feedback').insert({
    committee_id: committeeId,
    country,
    chair_name: chairName,
    content,
  });

  if (error) console.error('Error adding feedback:', error);
}

/**
 * getFeedbackForCommittee
 * Fetches all feedback entries for a committee post-session.
 * Returns them grouped by country for easy display.
 */
export async function getFeedbackForCommittee(
  committeeId: string,
): Promise<Record<string, { chairName: string; content: string; createdAt: string }[]>> {
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .eq('committee_id', committeeId)
    .order('created_at', { ascending: true });

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
// SESSION CLEANUP (item 8)
// ============================================================

/**
 * suspendSession
 * Sets an expiry timestamp on the committee when debate is suspended.
 * Supabase's scheduled cleanup job deletes it after 24 hours.
 */
export async function suspendSession(committeeId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('committees')
    .update({ expires_at: expiresAt, phase: 'adjourned' })
    .eq('id', committeeId);

  if (error) console.error('Error suspending session:', error);
}

// ============================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================

/**
 * subscribeToCommittee
 * Sets up real-time listeners on all tables for a given committee.
 * Call this once when a chair or delegate loads their session page.
 * Pass a callback that will be called whenever anything changes —
 * the callback receives the table name so you can update only what changed.
 *
 * Returns an unsubscribe function — call it when the component unmounts.
 *
 * Usage:
 *   const unsubscribe = subscribeToCommittee(committeeId, (table) => {
 *     refetchCommittee(); // re-fetch from Supabase and update local state
 *   });
 *   return () => unsubscribe(); // in useEffect cleanup
 */
export function subscribeToCommittee(
  committeeId: string,
  onChange: (table: string) => void,
): () => void {
  const channel = supabase
    .channel(`committee-${committeeId}-${Date.now()}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'committees',
      filter: `id=eq.${committeeId}`,
    }, () => onChange('committees'))
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'delegates',
      filter: `committee_id=eq.${committeeId}`,
    }, () => onChange('delegates'))
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'speakers_list',
      filter: `committee_id=eq.${committeeId}`,
    }, () => onChange('speakers_list'))
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'current_speaker',
      filter: `committee_id=eq.${committeeId}`,
    }, () => onChange('current_speaker'))
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'motions',
      filter: `committee_id=eq.${committeeId}`,
    }, () => onChange('motions'))
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'documents',
      filter: `committee_id=eq.${committeeId}`,
    }, () => onChange('documents'))
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'messages',
      filter: `committee_id=eq.${committeeId}`,
    }, () => onChange('messages'))
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
