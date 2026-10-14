/**
 * How many committees sent their award slate for approval and are waiting on
 * the organisers (13 Oct 2026). Shown on the manage sidebar's Settings entry,
 * the Settings tab strip's Awards tab and each submitted committee row in
 * Review and Publish. The rule is `awardsWaitingCount` in src/lib/awards.ts.
 *
 * Two head-light reads: the committees' stamps and the award rows' statuses
 * (organisers read both under RLS). A failed read answers 0, never a guess.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { awardsWaitingCount } from '@/lib/awards';

export async function loadAwardsWaiting(supabase: SupabaseClient, conferenceId: string): Promise<number> {
  const [cRes, aRes] = await Promise.all([
    supabase.from('conference_committees')
      .select('id, awards_submitted_at, awards_approved_at')
      .eq('conference_id', conferenceId)
      .not('awards_submitted_at', 'is', null)
      .is('awards_approved_at', null),
    supabase.from('conference_awards')
      .select('conference_committee_id, status')
      .eq('conference_id', conferenceId),
  ]);
  if (cRes.error || !cRes.data) return 0;
  if (cRes.data.length === 0) return 0;
  return awardsWaitingCount(cRes.data, aRes.error || !aRes.data ? [] : aRes.data);
}
