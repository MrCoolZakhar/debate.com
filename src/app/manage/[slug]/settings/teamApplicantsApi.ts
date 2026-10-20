// ── Settings > Team: the secretariat and staff applicants ──────────────────
//
// Job Board prompt 3 (owner decision): secretariat and staff applicants land
// ONLY in Settings > Team. `team_applicants(p_conf)` is the one read of the
// list; it also stamps that an organizer reviewed applicants, so it is called
// each time the Team tab opens and never for the tab badge. The badge counts
// waiting rows with a plain head count, which records nothing.
//
// Verified reads: an error, null data or { ok: false } is a failure.

import { useEffect, useState } from 'react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { UserFacingError } from '@/lib/friendlyError';
import type { JobPick } from '../applications/JobPicksBlock';

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

export interface TeamApplicant {
  application_id: string;
  role: 'secretariat' | 'staff' | string;
  status: string;
  submitted_at: string | null;
  decided_at: string | null;
  user_id: string | null;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  unlimited: boolean;
  experience_entries: TeamExperienceEntry[] | null;
  custom_answers: Record<string, unknown> | null;
  organizer_note: string | null;
  on_team: boolean;
  picks: JobPick[] | null;
}

export interface TeamApplicantsResult {
  canAccept: boolean;
  applicants: TeamApplicant[];
}

export async function loadTeamApplicants(conferenceId: string): Promise<TeamApplicantsResult> {
  const supabase = await getFreshAuthedClient();
  if (!supabase) throw new UserFacingError('Your session has expired, please refresh and sign in again.');
  const { data, error } = await supabase.rpc('team_applicants', { p_conf: conferenceId });
  if (error) throw error;
  if (!data) throw new UserFacingError('Could not load the applicants. Please try again.');
  const res = data as { ok?: boolean; message?: string; can_accept?: boolean; applicants?: TeamApplicant[] };
  if (!res.ok) throw new UserFacingError(res.message || 'Could not load the applicants. Please try again.');
  return { canAccept: !!res.can_accept, applicants: Array.isArray(res.applicants) ? res.applicants : [] };
}

/** Waiting (submitted) secretariat and staff applications, for the Team badge. 0 on any failure. */
export async function countTeamWaiting(conferenceId: string): Promise<number> {
  const supabase = await getFreshAuthedClient();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('conference_id', conferenceId)
    .in('role', ['secretariat', 'staff'])
    .eq('status', 'submitted');
  if (error) return 0;
  return count ?? 0;
}

/** The Team tab's badge: read once per conference; the Applicants list
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
  return role === 'secretariat' ? 'Secretariat' : role === 'staff' ? 'Staff' : role;
}

export function firstPickTitle(a: TeamApplicant): string | null {
  const list = [...(a.picks ?? [])].sort((x, y) => (x.rank ?? 99) - (y.rank ?? 99));
  const t = list[0]?.title?.trim();
  return t || null;
}
