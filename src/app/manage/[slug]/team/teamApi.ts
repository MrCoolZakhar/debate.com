// ── Team: the people who run the conference (owner, 14 Nov 2026) ───────────
//
// Chairs, secretariat and staff are decided in Team > Team Applications, never
// in Applications. One source for the list, its types and the waiting count
// (moved here from settings/teamApplicantsApi.ts):
//   team_applicants_v2(p_conf)   the list; it also stamps that an organiser
//                                reviewed applicants, so it is read when the
//                                tab opens and never for a badge
//   accept_chair_application     a chair accepted (and seated, or seated later)
//   countTeamWaiting             the badge: a plain head count, records nothing
// Verified reads: an error, null data or { ok: false } is a failure.

import { useEffect, useState } from 'react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { UserFacingError } from '@/lib/friendlyError';
import { queueEventEmail, notifyIfNeeded, heldUnresolvedMessage, fallbackDefaultMessage } from '@/lib/emailEvents';
import { notifyErr } from '@/lib/appNotify';
import type { JobPick } from '../applications/JobPicksBlock';
import type { PushDraftNotice } from '../applications/teamDecisions';

export interface TeamExperienceEntry {
  id: string;
  source_cv_entry_id?: string | null;
  entry_type: string | null;
  conference_name: string;
  committee: string | null;
  allocation: string | null;
  event_date: string | null;
  awards: string[] | null;
  description: string | null;
}

export type TeamPick = JobPick & { committee_id?: string | null };

export interface TeamApplicant {
  application_id: string;
  role: 'chair' | 'secretariat' | 'staff' | string;
  status: string;
  submitted_at: string | null;
  decided_at: string | null;
  user_id: string | null;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  experience_entries: TeamExperienceEntry[] | null;
  custom_answers: Record<string, unknown> | null;
  organizer_note: string | null;
  on_team: boolean;
  picks: TeamPick[] | null;
  /** Chairs (team_applicants_v2). */
  assigned_committee_id?: string | null;
  seated_committee_ids?: string[] | null;
  committee_preferences?: { committee_id: string; rank: number | null }[] | null;
}

export interface TeamCommittee { id: string; name: string; abbreviation: string | null; chairs: number }

export interface TeamApplicantsResult {
  canAccept: boolean;
  committees: TeamCommittee[];
  applicants: TeamApplicant[];
}

const LOAD_FAILED = 'Could not load the applicants. Please try again.';

export async function loadTeamApplicantsV2(conferenceId: string): Promise<TeamApplicantsResult> {
  const supabase = await getFreshAuthedClient();
  if (!supabase) throw new UserFacingError('Your session has expired, please refresh and sign in again.');
  const { data, error } = await supabase.rpc('team_applicants_v2', { p_conf: conferenceId });
  if (error) throw error;
  if (!data) throw new UserFacingError(LOAD_FAILED);
  const res = data as { ok?: boolean; message?: string; can_accept?: boolean; committees?: TeamCommittee[]; applicants?: TeamApplicant[] };
  if (!res.ok) throw new UserFacingError(res.message || LOAD_FAILED);
  return {
    canAccept: !!res.can_accept,
    committees: Array.isArray(res.committees) ? res.committees : [],
    applicants: Array.isArray(res.applicants) ? res.applicants : [],
  };
}

/** Accepts a chair: seated in a committee (status 'assigned'), or null to seat later.
 *  The acceptance email goes out after it, the same way acceptTeamApplication sends it,
 *  only when the application was still waiting. */
export async function acceptChair(args: {
  conferenceId: string; appId: string; committeeId: string | null; pushDraftNotice: PushDraftNotice;
}): Promise<{ ok: true; status: string; committeeId: string | null; followUpFailed: boolean } | { ok: false; message: string }> {
  const supabase = await getFreshAuthedClient();
  if (!supabase) return { ok: false, message: 'Your session has expired, please refresh and sign in again.' };
  const { data, error } = await supabase.rpc('accept_chair_application', { p_application_id: args.appId, p_committee_id: args.committeeId });
  if (error) throw error;
  const r = (data ?? null) as { ok?: boolean; status?: string; committee_id?: string | null; was?: string; message?: string } | null;
  if (!r?.ok) return { ok: false, message: r?.message || 'Could not accept the application. Please try again.' };
  let followUpFailed = false;
  if (r.was === 'submitted') {
    try {
      const result = await queueEventEmail(supabase, args.conferenceId, 'application_accepted', [args.appId]);
      notifyIfNeeded(result, args.pushDraftNotice);
      const fellBack = fallbackDefaultMessage(result);
      if (fellBack) notifyErr(fellBack, 'email-held');
      const held = heldUnresolvedMessage(result);
      if (held) notifyErr(held, 'email-held');
    } catch {
      followUpFailed = true;
    }
  }
  return { ok: true, status: r.status ?? 'accepted', committeeId: r.committee_id ?? args.committeeId, followUpFailed };
}

/** Waiting (submitted) chair, secretariat and staff applications, for the Team badge. 0 on any failure. */
export async function countTeamWaiting(conferenceId: string): Promise<number> {
  const supabase = await getFreshAuthedClient();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('conference_id', conferenceId)
    .in('role', ['chair', 'secretariat', 'staff'])
    .eq('status', 'submitted');
  if (error) return 0;
  return count ?? 0;
}

/** The Team badge: read once per conference; the Team Applications list
 *  corrects it through the setter whenever it loads or a decision lands. */
export function useTeamWaitingCount(conferenceId: string | null): [number, (n: number) => void] {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!conferenceId) return;
    let cancelled = false;
    void countTeamWaiting(conferenceId).then(v => { if (!cancelled) setN(v); });
    return () => { cancelled = true; };
  }, [conferenceId]);
  return [n, setN];
}

export function teamRoleLabel(role: string): string {
  return role === 'chair' ? 'Chair' : role === 'secretariat' ? 'Secretariat' : role === 'staff' ? 'Staff' : role;
}

export function firstPickTitle(a: TeamApplicant): string | null {
  const list = [...(a.picks ?? [])].sort((x, y) => (x.rank ?? 99) - (y.rank ?? 99));
  const t = list[0]?.title?.trim();
  return t || null;
}

/** The committee to preselect when seating a chair: their first pick with a
 *  committee, else their first committee preference, else none. */
export function preselectCommittee(a: TeamApplicant): string | null {
  const pick = [...(a.picks ?? [])].sort((x, y) => (x.rank ?? 99) - (y.rank ?? 99)).find(p => !!p.committee_id);
  if (pick?.committee_id) return pick.committee_id;
  const pref = [...(a.committee_preferences ?? [])].sort((x, y) => (x.rank ?? 99) - (y.rank ?? 99))[0];
  return pref?.committee_id ?? null;
}

export function committeeShort(c: Pick<TeamCommittee, 'name' | 'abbreviation'>): string {
  return c.abbreviation?.trim() || c.name;
}
