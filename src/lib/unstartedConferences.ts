// unstartedConferences.ts: the conferences a signed-in person already runs that
// are NOT taking applications yet (owner, 19 Oct 2026: "if someone has a
// conference created but not running applications yet, there will be a pop-up
// once they click on create. Some people simply just create multiple
// conferences").
//
// Read by the "You Already Have a Conference" pop-up on /conferences/new
// (src/app/conferences/new/ExistingConferencePrompt.tsx). CREATED conferences
// only: a wizard draft (conference_drafts, or the browser-local draft in
// conferenceDrafts.ts) is not a conference and is never read here.
//
// A conference counts when ALL of these hold:
//   - the person is on its team as 'owner' (the creator or a co-owner) or
//     'organizer' (conference_organizers; every creator has an owner row).
//     'secretariat' and 'staff' are left out: they cannot finish the set-up.
//   - it is not a test or demo conference (isTestConference)
//   - it is not over: its last day (end date, else start date) is today or
//     later, and a conference with no dates yet counts as not over
//   - no role of it is open for applications right now, judged exactly the way
//     the database judges it (roleWindowState on application_role_configs,
//     against the database clock)
//   - it has received no application at all (any role, any status, imported
//     rows included)
//
// Every failed read returns null, and the caller then shows nothing: this can
// never stand between someone and creating a conference.

import type { SupabaseClient } from '@supabase/supabase-js';
import { isTestConference } from '@/lib/publicConferences';
import { roleWindowState } from '@/lib/applicationWindow';

export interface UnstartedConference {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  logo_url: string | null;
}

interface ConfRow {
  id: string;
  slug: string | null;
  full_name: string | null;
  acronym: string | null;
  logo_url: string | null;
  is_demo: boolean | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
}

/** At most this many are checked for applications and listed. */
const MAX_LISTED = 5;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Not over yet; no dates counts as not over (the isUpcoming rule). */
function notOver(c: ConfRow, today: string): boolean {
  const last = c.end_date || c.start_date;
  return !last || last >= today;
}

export async function fetchUnstartedConferences(
  sb: SupabaseClient,
  userId: string,
  now: number,
): Promise<UnstartedConference[] | null> {
  try {
    const { data: orgRows, error: orgError } = await sb
      .from('conference_organizers')
      .select('role, conferences (id, slug, full_name, acronym, logo_url, is_demo, start_date, end_date, created_at)')
      .eq('user_id', userId)
      .in('role', ['owner', 'organizer']);
    if (orgError || !orgRows) return null;

    const today = todayUtc();
    const byId = new Map<string, ConfRow>();
    for (const row of orgRows as { conferences: ConfRow | ConfRow[] | null }[]) {
      const c = Array.isArray(row.conferences) ? row.conferences[0] : row.conferences;
      if (!c?.id || !c.slug || !c.full_name?.trim()) continue;
      if (isTestConference(c)) continue;
      if (!notOver(c, today)) continue;
      byId.set(c.id, c);
    }
    if (byId.size === 0) return [];

    const ids = Array.from(byId.keys());
    const { data: cfgRows, error: cfgError } = await sb
      .from('application_role_configs')
      .select('conference_id, is_enabled, applications_open_at, applications_close_at')
      .in('conference_id', ids);
    if (cfgError || !cfgRows) return null;
    const running = new Set<string>();
    for (const cfg of cfgRows as { conference_id: string; is_enabled: boolean | null; applications_open_at: string | null; applications_close_at: string | null }[]) {
      if (roleWindowState(cfg, now) === 'open') running.add(cfg.conference_id);
    }

    const candidates = ids
      .filter((id) => !running.has(id))
      .map((id) => byId.get(id) as ConfRow)
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      .slice(0, MAX_LISTED);
    if (candidates.length === 0) return [];

    const checks = await Promise.all(candidates.map((c) =>
      sb.from('applications').select('id').eq('conference_id', c.id).limit(1),
    ));
    if (checks.some((r) => r.error || !r.data)) return null;

    return candidates
      .filter((_, i) => (checks[i].data ?? []).length === 0)
      .map((c) => ({
        id: c.id,
        slug: c.slug as string,
        full_name: (c.full_name ?? '').replace(/\s+/g, ' ').trim(),
        acronym: (c.acronym ?? '').replace(/\s+/g, ' ').trim(),
        logo_url: c.logo_url,
      }));
  } catch {
    return null;
  }
}
