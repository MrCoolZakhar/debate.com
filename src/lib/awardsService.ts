// ============================================================
// src/lib/awardsService.ts
//
// Every read and write against `conference_awards`, the awards_* stamps and
// `conferences.awards_config`. UI never talks to these tables directly.
//
// Writes that change a slate's lifecycle (submit / withdraw / approve /
// return / publish) go through SECURITY DEFINER RPCs because the stamps live
// on `conference_committees`, which chairs cannot update, and because
// publishing fans out into `mun_cv_entries` and `points_ledger`, which no
// client may write for another user. Nominations themselves are plain rows
// guarded by RLS: chairs of the committee while the slate is unlocked,
// organisers always.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { AWARD_COLUMNS, type AwardsConfig, type ConferenceAwardRow } from './awards';

export interface NominationInput {
  conferenceId: string;
  conferenceCommitteeId: string;
  awardType: string;
  awardLabel: string;
  countryCode: string;
  countryName: string;
  userId: string | null;
  allocationId: string | null;
  recipientName: string | null;
  rationale: string | null;
  position?: number;
}

export async function loadConferenceAwards(
  supabase: SupabaseClient,
  conferenceId: string,
): Promise<ConferenceAwardRow[]> {
  const { data, error } = await supabase
    .from('conference_awards')
    .select(AWARD_COLUMNS)
    .eq('conference_id', conferenceId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[awards] load failed:', error);
    return [];
  }
  return (data ?? []) as unknown as ConferenceAwardRow[];
}

export async function loadCommitteeAwards(
  supabase: SupabaseClient,
  conferenceCommitteeId: string,
): Promise<ConferenceAwardRow[]> {
  const { data, error } = await supabase
    .from('conference_awards')
    .select(AWARD_COLUMNS)
    .eq('conference_committee_id', conferenceCommitteeId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[awards] committee load failed:', error);
    return [];
  }
  return (data ?? []) as unknown as ConferenceAwardRow[];
}

/** Published honours only (what the RLS exposes to everyone), for the public honour roll. */
export async function loadPublishedAwards(
  supabase: SupabaseClient,
  conferenceId: string,
): Promise<ConferenceAwardRow[]> {
  const { data, error } = await supabase
    .from('conference_awards')
    .select(AWARD_COLUMNS)
    .eq('conference_id', conferenceId)
    .eq('status', 'published')
    .order('award_type');
  if (error) {
    console.error('[awards] published load failed:', error);
    return [];
  }
  return (data ?? []) as unknown as ConferenceAwardRow[];
}

/** Insert one nomination. `assignedBy` must be the caller (RLS checks it). Returns the row or an error message. */
export async function createNomination(
  supabase: SupabaseClient,
  assignedBy: string,
  input: NominationInput,
): Promise<{ row: ConferenceAwardRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('conference_awards')
    .insert({
      conference_id: input.conferenceId,
      conference_committee_id: input.conferenceCommitteeId,
      assigned_by: assignedBy,
      award_type: input.awardType,
      award_label: input.awardLabel,
      country_code: input.countryCode,
      country_name: input.countryName,
      user_id: input.userId,
      allocation_id: input.allocationId,
      recipient_name: input.recipientName,
      rationale: input.rationale,
      position: input.position ?? 1,
      status: 'nominated',
    })
    .select(AWARD_COLUMNS)
    .single();
  if (error) return { row: null, error: friendlyAwardError(error.message) };
  return { row: data as unknown as ConferenceAwardRow, error: null };
}

export async function updateNomination(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Pick<ConferenceAwardRow, 'rationale' | 'country_code' | 'country_name' | 'user_id' | 'allocation_id' | 'recipient_name' | 'position'>>,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('conference_awards')
    .update(patch)
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) return friendlyAwardError(error.message);
  // Zero rows back = RLS refused (slate locked or not our committee).
  if (!data) return 'This slate is locked, so the nomination could not be changed.';
  return null;
}

export async function deleteNomination(supabase: SupabaseClient, id: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('conference_awards')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) return friendlyAwardError(error.message);
  if (!data) return 'This slate is locked, so the nomination could not be removed.';
  return null;
}

/** Organiser-only: assign a delegation award to a society. */
export async function createDelegationAward(
  supabase: SupabaseClient,
  assignedBy: string,
  input: { conferenceId: string; awardType: string; awardLabel: string; societyId: string; recipientName: string; rationale?: string | null },
): Promise<{ row: ConferenceAwardRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('conference_awards')
    .insert({
      conference_id: input.conferenceId,
      conference_committee_id: null,
      assigned_by: assignedBy,
      award_type: input.awardType,
      award_label: input.awardLabel,
      society_id: input.societyId,
      recipient_name: input.recipientName,
      rationale: input.rationale ?? null,
      status: 'approved',
    })
    .select(AWARD_COLUMNS)
    .single();
  if (error) return { row: null, error: friendlyAwardError(error.message) };
  return { row: data as unknown as ConferenceAwardRow, error: null };
}

// ── Lifecycle RPCs ──────────────────────────────────────────────────────────

async function rpcVoid(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<string | null> {
  const { error } = await supabase.rpc(fn, args);
  return error ? friendlyAwardError(error.message) : null;
}

export const submitSlate = (s: SupabaseClient, committeeId: string) =>
  rpcVoid(s, 'submit_committee_awards', { p_committee: committeeId });
export const withdrawSlate = (s: SupabaseClient, committeeId: string) =>
  rpcVoid(s, 'withdraw_committee_awards', { p_committee: committeeId });
export const approveSlate = (s: SupabaseClient, committeeId: string) =>
  rpcVoid(s, 'approve_committee_awards', { p_committee: committeeId });
export const returnSlate = (s: SupabaseClient, committeeId: string, note: string) =>
  rpcVoid(s, 'return_committee_awards', { p_committee: committeeId, p_note: note });

export interface PublishResult {
  awards: number;
  cv_entries: number;
  points_rows: number;
}

export async function publishAwards(
  supabase: SupabaseClient,
  conferenceId: string,
): Promise<{ result: PublishResult | null; error: string | null }> {
  const { data, error } = await supabase.rpc('publish_conference_awards', { p_conference: conferenceId });
  if (error) return { result: null, error: friendlyAwardError(error.message) };
  const r = (data ?? {}) as Partial<PublishResult>;
  return { result: { awards: r.awards ?? 0, cv_entries: r.cv_entries ?? 0, points_rows: r.points_rows ?? 0 }, error: null };
}

// ── Config ──────────────────────────────────────────────────────────────────

export async function saveAwardsConfig(
  supabase: SupabaseClient,
  conferenceId: string,
  config: AwardsConfig,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('conferences')
    .update({ awards_config: { ...config, configuredAt: config.configuredAt ?? new Date().toISOString() } })
    .eq('id', conferenceId)
    .select('id')
    .maybeSingle();
  if (error) return friendlyAwardError(error.message);
  if (!data) return 'Your changes were not saved. Sign in again and retry.';
  return null;
}

// ── Errors ──────────────────────────────────────────────────────────────────

function friendlyAwardError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('conference_awards_seat_type_uniq')) return 'That delegation already holds this award in this committee.';
  if (m.includes('conference_awards_society_type_uniq')) return 'That delegation already holds this award.';
  if (m.includes('slate is locked')) return 'This slate has been approved and can no longer be changed.';
  if (m.includes('not authorised')) return 'You are not allowed to do that for this committee.';
  if (m.includes('row-level security')) return 'This slate is locked, or you are not a chair of this committee.';
  return message;
}
