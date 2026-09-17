// ============================================================
// DEVICE VOTING (17 Sep 2026)
// ============================================================
// A draft resolution can be voted on from each delegation's own device instead of by roll
// call. Chosen per committee with `settings.votingMethod` ('rollcall' default | 'device'),
// and frozen into the ballot when it opens as `vote_state.method` (src/lib/voteState.ts), so
// changing the setting mid-vote never changes a vote in progress.
//
// Contract (migration `device_voting_ballots_and_rpcs`):
//   • `document_device_votes` (one row per delegation per ballot; ballot id =
//     vote_state.startedAt) and `document_device_ballots` (revealed_at per ballot). RLS on,
//     NO policies, no table grants: readable and writable only through the RPCs below.
//     The choices cannot live in vote_state because vote_state is anon-readable.
//   • `cast_device_vote(p_code, p_document, p_country, p_choice, p_token)`: the caller must
//     hold a live claim on that seat (same holder rules as claim_delegate_seat: the signed-in
//     account on THIS device, or this device's token), the delegation must be in the frozen
//     ballot order, the ballot must be a device ballot at status 'voting', the room in the
//     voting phase, and the ballot not yet revealed. A choice can be changed until the reveal.
//     Abstain only when abstentions are allowed and the delegation is Present (not P+V).
//   • `my_device_ballot(p_code, p_country, p_token)`: the open device ballot this delegation
//     is in (doc code, title), and ONLY its own choice, and only for the seat's holder.
//   • `device_vote_status(p_code, p_document)`: chair-gated (is_session_chair). Counts and,
//     per seat in the order, voted / joined / active. Never a direction.
//   • `reveal_device_votes(p_code, p_document, p_force)`: chair-gated. Refuses with
//     'incomplete' until every delegation has voted unless p_force; then stamps revealed_at
//     (once) and returns every choice. Idempotent: a reload reads the same votes back.
//
// Honest limit: the chair suffix is anon-readable (AGENTS.md rule 15), so anyone holding the
// session code can call the chair-gated RPCs and reveal early. Keeping choices from the chair
// until the reveal is a courtesy of the UI, not a security boundary.

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as anonSupabase } from '@/lib/supabase';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { sessionClient } from '@/lib/sessionClient';
import { getSeatToken } from '@/lib/seatClaims';
import type { DelegateVote, VoteChoice } from '@/lib/voteState';

export type VotingMethod = 'rollcall' | 'device';

async function delegateClient(accessToken?: string | null): Promise<SupabaseClient> {
  if (!accessToken) return anonSupabase as unknown as SupabaseClient;
  try {
    const fresh = await getFreshAuthedClient();
    if (fresh) return fresh;
  } catch { /* fall back to the token we were given */ }
  return getAuthedClient(accessToken);
}

type Raw = Record<string, unknown>;
const CHOICES: VoteChoice[] = ['for', 'against', 'for-rights', 'against-rights', 'abstain'];
const isChoice = (v: unknown): v is VoteChoice => typeof v === 'string' && (CHOICES as string[]).includes(v);

// ── Delegate side ────────────────────────────────────────────────────────────
export interface MyDeviceBallot {
  documentId: string;
  docCode: string;
  title: string;
  ballot: string;
  /** This device holds the seat's live claim (otherwise it cannot vote). */
  holder: boolean;
  choice: VoteChoice | null;
  revealed: boolean;
  mayAbstain: boolean;
}

/** undefined = could not read; null = no device ballot open for this delegation. */
export async function getMyDeviceBallot(code: string, country: string, accessToken?: string | null): Promise<MyDeviceBallot | null | undefined> {
  try {
    const client = await delegateClient(accessToken);
    const { data, error } = await client.rpc('my_device_ballot', {
      p_code: code.toUpperCase(), p_country: country, p_token: getSeatToken(code),
    });
    if (error || !data || (data as Raw).ok !== true) return undefined;
    const d = data as Raw;
    if (d.open !== true) return null;
    return {
      documentId: String(d.document_id ?? ''),
      docCode: String(d.doc_code ?? ''),
      title: String(d.title ?? ''),
      ballot: String(d.ballot ?? ''),
      holder: d.holder === true,
      choice: isChoice(d.choice) ? d.choice : null,
      revealed: d.revealed === true,
      mayAbstain: d.may_abstain === true,
    };
  } catch {
    return undefined;
  }
}

export type CastResult = 'ok' | 'closed' | 'revealed' | 'not_holder' | 'not_in_ballot' | 'no_abstain' | 'no_ballot' | 'error';

export async function castDeviceVote(code: string, documentId: string, country: string, choice: VoteChoice, accessToken?: string | null): Promise<CastResult> {
  try {
    const client = await delegateClient(accessToken);
    const { data, error } = await client.rpc('cast_device_vote', {
      p_code: code.toUpperCase(), p_document: documentId, p_country: country, p_choice: choice, p_token: getSeatToken(code),
    });
    if (error || !data) return 'error';
    const d = data as Raw;
    if (d.ok === true) return 'ok';
    const r = String(d.reason ?? 'error');
    return (['closed', 'revealed', 'not_holder', 'not_in_ballot', 'no_abstain', 'no_ballot'] as string[]).includes(r) ? r as CastResult : 'error';
  } catch {
    return 'error';
  }
}

// ── Chair side ───────────────────────────────────────────────────────────────
export interface DeviceSeatStatus { id: string; country: string; voted: boolean; joined: boolean; active: boolean }
export interface DeviceVoteStatus {
  ballot: string;
  total: number;
  cast: number;
  seats: DeviceSeatStatus[];
  revealed: boolean;
}

/** null = could not read (network, or this device does not hold the chair code). */
export async function getDeviceVoteStatus(code: string, documentId: string, chairSuffix?: string | null): Promise<DeviceVoteStatus | null> {
  if (!chairSuffix) return null;
  try {
    const { data, error } = await sessionClient(code.toUpperCase(), chairSuffix)
      .rpc('device_vote_status', { p_code: code.toUpperCase(), p_document: documentId });
    if (error || !data || (data as Raw).ok !== true) return null;
    const d = data as Raw;
    const seats = (Array.isArray(d.seats) ? d.seats as Raw[] : []).map((s) => ({
      id: String(s.id ?? ''), country: String(s.country ?? ''),
      voted: s.voted === true, joined: s.joined === true, active: s.active === true,
    }));
    return {
      ballot: String(d.ballot ?? ''),
      total: typeof d.total === 'number' ? d.total : seats.length,
      cast: typeof d.cast === 'number' ? d.cast : seats.filter((s) => s.voted).length,
      seats,
      revealed: d.revealed === true,
    };
  } catch {
    return null;
  }
}

export type RevealResult =
  | { ok: true; ballot: string; votes: DelegateVote[]; cast: number; total: number }
  | { ok: false; reason: 'incomplete' | 'denied' | 'no_ballot' | 'error'; cast?: number; total?: number };

export async function revealDeviceVotes(code: string, documentId: string, chairSuffix: string | null | undefined, force: boolean): Promise<RevealResult> {
  if (!chairSuffix) return { ok: false, reason: 'denied' };
  try {
    const { data, error } = await sessionClient(code.toUpperCase(), chairSuffix)
      .rpc('reveal_device_votes', { p_code: code.toUpperCase(), p_document: documentId, p_force: force });
    if (error || !data) return { ok: false, reason: 'error' };
    const d = data as Raw;
    if (d.ok !== true) {
      const r = String(d.reason ?? 'error');
      return {
        ok: false,
        reason: r === 'incomplete' || r === 'denied' || r === 'no_ballot' ? r : 'error',
        cast: typeof d.cast === 'number' ? d.cast : undefined,
        total: typeof d.total === 'number' ? d.total : undefined,
      };
    }
    const votes = (Array.isArray(d.votes) ? d.votes as Raw[] : [])
      .map((v) => ({ delegateId: String(v.delegateId ?? ''), country: String(v.country ?? ''), choice: v.choice }))
      .filter((v): v is DelegateVote => !!v.delegateId && isChoice(v.choice));
    return { ok: true, ballot: String(d.ballot ?? ''), votes, cast: Number(d.cast ?? votes.length), total: Number(d.total ?? 0) };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** Joined = a live seat claim (not idle-expired). `active` = seen in the last 2 minutes. */
export function joinedSeatsFrom(seats: { country: string; active: boolean }[]): Map<string, { active: boolean }> {
  const m = new Map<string, { active: boolean }>();
  for (const s of seats) {
    const k = s.country.trim().toLowerCase();
    const prev = m.get(k);
    m.set(k, { active: (prev?.active ?? false) || s.active });
  }
  return m;
}
