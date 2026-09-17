// ============================================================
// PERSISTED ROLL-CALL VOTES (V-2, V-3, V-4)
// ============================================================
// A roll-call vote on a draft resolution used to live in one browser tab: a reload lost
// every ballot, two chair devices tallied separately, and nobody else could see it.
//
// WHERE IT LIVES: `documents.vote_state` (jsonb, nullable), one object per draft resolution.
// Chosen over a `document_votes` table because:
//   • a vote belongs to exactly one document and there is at most one live vote per
//     document, so a row per document is the natural key;
//   • `documents` is already in the realtime publication and already subscribed to by every
//     session surface, and its RLS (`sess_upd` = is_session_chair) is exactly the gate we
//     want, so no new table, policy, publication entry or subscription was needed;
//   • one device drives the vote (the Moderator), so there are no concurrent writers whose
//     individual ballots a single blob could clobber.
//
// WRITES: only through `save_document_vote_state(p_document, p_state)` (SECURITY INVOKER,
// RLS applies via the x-chair-suffix header). `seq` must strictly grow: a stale device can
// never overwrite a newer state. Result: 'ok' | 'stale' | 'denied' | 'error'.
//
// PHASE: `set_committee_voting_phase(p_committee, p_enter)` stores the phase the room was in
// under `settings.votingReturnPhase` and sets `phase = 'voting'` in ONE statement; leaving
// restores exactly that phase (a caucus phase whose caucus is gone falls back to the GSL).
// The return phase lives on the committee rather than in a document's vote_state because
// the room enters voting mode when the voting screen opens, before any document is picked.

import { supabase } from './supabase';
import { sessionClient } from './sessionClient';
import type { SessionPhase } from './types';

export type VoteChoice = 'for' | 'against' | 'for-rights' | 'against-rights' | 'abstain';
export interface DelegateVote { delegateId: string; country: string; choice: VoteChoice }
export type VoteStatus = 'voting' | 'rights-speakers' | 'result';

/** A frozen seat: enough to render a row if the delegation is later removed. */
export interface FrozenSeat { id: string; country: string }

export interface VoteStateV1 {
  v: 1;
  /** Strictly increasing; the DB refuses a write whose seq is not above the stored one. */
  seq: number;
  status: VoteStatus;
  /** The ballot order, frozen when the vote opened (also the present/PV numerator). */
  order: FrozenSeat[];
  /** Every non-observer seat when the vote opened (the quorum/veto denominator). */
  votable: FrozenSeat[];
  votes: DelegateVote[];
  currentVoterIndex: number;
  passedIds: string[];
  rightsOrder: DelegateVote[];
  rightsIndex: number;
  rightsTimerLimit: number;
  result: 'passed' | 'failed' | null;
  startedAt: string;
  updatedAt: string;
  /** Chair name that drove the last write (display only). */
  driver: string | null;
  /** How ballots are cast, frozen when the vote opened (src/lib/deviceVoting.ts). Absent = roll call.
   *  'device': choices are cast on delegates' own devices into document_device_votes and only
   *  enter `votes` when revealed; there is no pass round. */
  method?: 'rollcall' | 'device';
}

const CHOICES: VoteChoice[] = ['for', 'against', 'for-rights', 'against-rights', 'abstain'];

function asSeats(v: unknown): FrozenSeat[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is { id: unknown; country: unknown } => !!x && typeof x === 'object')
    .map((x) => ({ id: String(x.id ?? ''), country: String(x.country ?? '') }))
    .filter((x) => x.id);
}

function asVotes(v: unknown): DelegateVote[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is { delegateId: unknown; country: unknown; choice: unknown } => !!x && typeof x === 'object')
    .map((x) => ({ delegateId: String(x.delegateId ?? ''), country: String(x.country ?? ''), choice: x.choice as VoteChoice }))
    .filter((x) => x.delegateId && CHOICES.includes(x.choice));
}

/** Defensive parse of a stored blob. Anything unrecognisable is null (treated as no vote). */
export function parseVoteState(raw: unknown): VoteStateV1 | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || typeof r.seq !== 'number') return null;
  const status = r.status === 'rights-speakers' || r.status === 'result' ? r.status : 'voting';
  const int = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : d);
  return {
    v: 1,
    seq: r.seq,
    status,
    order: asSeats(r.order),
    votable: asSeats(r.votable),
    votes: asVotes(r.votes),
    currentVoterIndex: int(r.currentVoterIndex, 0),
    passedIds: Array.isArray(r.passedIds) ? r.passedIds.map(String) : [],
    rightsOrder: asVotes(r.rightsOrder),
    rightsIndex: int(r.rightsIndex, 0),
    rightsTimerLimit: int(r.rightsTimerLimit, 60) || 60,
    result: r.result === 'passed' || r.result === 'failed' ? r.result : null,
    startedAt: typeof r.startedAt === 'string' ? r.startedAt : '',
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : '',
    driver: typeof r.driver === 'string' ? r.driver : null,
    method: r.method === 'device' ? 'device' : 'rollcall',
  };
}

/** True while a vote is open (not yet at its result). */
export function isVoteOpen(s: VoteStateV1 | null | undefined): boolean {
  return !!s && s.status !== 'result';
}

/** Every stored vote state in a committee, keyed by document id. Anon read (documents SELECT is public). */
export async function loadVoteStates(committeeId: string): Promise<Record<string, VoteStateV1> | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, vote_state')
    .eq('committee_id', committeeId)
    .not('vote_state', 'is', null);
  if (error) { console.error('Error loading vote states:', error); return null; }
  const out: Record<string, VoteStateV1> = {};
  for (const row of (data ?? []) as { id: string; vote_state: unknown }[]) {
    const parsed = parseVoteState(row.vote_state);
    if (parsed) out[row.id] = parsed;
  }
  return out;
}

export type VoteSaveResult = 'ok' | 'stale' | 'denied' | 'error';

export async function saveVoteState(documentId: string, state: VoteStateV1, code: string, chairSuffix?: string): Promise<VoteSaveResult> {
  const { data, error } = await sessionClient(code, chairSuffix)
    .rpc('save_document_vote_state', { p_document: documentId, p_state: state });
  if (error) { console.error('Error saving vote state:', error); return 'error'; }
  return data === 'ok' || data === 'stale' || data === 'denied' ? data : 'error';
}

export interface VotingPhaseResult { ok: boolean; phase: SessionPhase | null; reason: string }

export async function setVotingPhase(committeeId: string, enter: boolean, code: string, chairSuffix?: string): Promise<VotingPhaseResult> {
  const { data, error } = await sessionClient(code, chairSuffix)
    .rpc('set_committee_voting_phase', { p_committee: committeeId, p_enter: enter });
  if (error || !data || typeof data !== 'object') {
    if (error) console.error('Error changing the voting phase:', error);
    return { ok: false, phase: null, reason: 'error' };
  }
  const d = data as { ok?: boolean; phase?: string | null; reason?: string };
  return { ok: d.ok === true, phase: (d.phase ?? null) as SessionPhase | null, reason: d.reason ?? '' };
}
