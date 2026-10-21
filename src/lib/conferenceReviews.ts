'use client';

// ── Conference reviews: who may write one, when, and what is saved ────────────
//
// Owner, 21 Oct 2026:
//  1. Nobody is offered a review (prompt, button, form or pop-up) until the
//     conference's LAST DAY has passed: `end_date`, falling back to
//     `start_date`; dates to be decided = never. `reviewWindowOpen` is the one
//     test, used by the conference page, the profile page and the menu.
//  2. Everyone who attended gets the review pop-up every time they open that
//     conference's page until they submit one (ConferenceReviewGate). "Not now"
//     closes it for that page view only; there is no "never".
//  3. Overall stars (required) and an optional written review. Five more 1..5
//     ratings (REVIEW_CRITERIA) are drawn and saved only once the database has
//     the `criteria` column: `scratch-conference-review-criteria.sql`, a draft
//     for the owners' chat. Until then REVIEW_CRITERIA_DB stays false and the
//     pop-up saves `rating` + `review_text` exactly as before.
//  4. The same pending review is a "Needs your attention" row ("Review <ACR>"),
//     added in src/lib/myActivity.ts so `attentionRows` stays the one rule.
//
// "Attended" mirrors the database's `user_attended_conference(conference_id)`
// (the insert policy on conference_reviews): an application of the caller in
// status 'assigned' or 'checked-in', or a conference_allocations row naming the
// caller. Reads here go through RLS as the caller, own rows only.

import { getAuthedClient } from '@/lib/supabase-auth';
import { hasConcluded, hasNoDates } from '@/lib/conferenceDates';
import { UserFacingError } from '@/lib/friendlyError';

/** Flip together with the owners applying scratch-conference-review-criteria.sql. */
export const REVIEW_CRITERIA_DB = false;

export const REVIEW_CRITERIA = [
  { key: 'committees', label: 'Committees and debate' },
  { key: 'chairs', label: 'Chairs' },
  { key: 'organisation', label: 'Organisation' },
  { key: 'social', label: 'Social events' },
  { key: 'value', label: 'Value for money' },
] as const;

export type ReviewCriterionKey = (typeof REVIEW_CRITERIA)[number]['key'];
export type ReviewCriteria = Partial<Record<ReviewCriterionKey, number>>;

/** Fired on window after a review lands, so the menu row and other prompts go. */
export const REVIEW_SUBMITTED_EVENT = 'gavelling-review-submitted';

/** Has the conference's last day passed? Dates to be decided: never. */
export function reviewWindowOpen(c: {
  start_date?: string | null;
  end_date?: string | null;
  dates_tbd?: boolean | null;
}): boolean {
  if (hasNoDates(c)) return false;
  return hasConcluded(c);
}

export interface ReviewConference {
  id: string;
  slug: string;
  acronym: string | null;
  full_name: string | null;
  logo_url: string | null;
  start_date: string | null;
  end_date: string | null;
  dates_tbd: boolean | null;
}

const CONF_COLUMNS = 'id, slug, acronym, full_name, logo_url, start_date, end_date, dates_tbd';

/**
 * Conferences the caller attended, whose last day has passed, that they have
 * not reviewed yet, most recently ended first. Throws when a read fails, so a
 * caller can keep what it had instead of showing an empty list.
 */
export async function fetchPendingReviews(accessToken: string, userId: string): Promise<ReviewConference[]> {
  const client = getAuthedClient(accessToken);
  const [apps, allocs, mine] = await Promise.all([
    client.from('applications').select(`conference_id, conferences ( ${CONF_COLUMNS} )`)
      .eq('user_id', userId).in('status', ['assigned', 'checked-in']),
    client.from('conference_allocations').select(`conference_id, conferences ( ${CONF_COLUMNS} )`)
      .eq('user_id', userId),
    client.from('conference_reviews').select('conference_id').eq('user_id', userId),
  ]);
  if (apps.error || allocs.error || mine.error) throw apps.error ?? allocs.error ?? mine.error;
  const reviewed = new Set(((mine.data ?? []) as { conference_id: string }[]).map((r) => r.conference_id));
  const out = new Map<string, ReviewConference>();
  type Row = { conferences: ReviewConference | ReviewConference[] | null };
  for (const row of [...(apps.data ?? []), ...(allocs.data ?? [])] as unknown as Row[]) {
    const c = Array.isArray(row.conferences) ? row.conferences[0] : row.conferences;
    if (!c?.id || !c.slug || out.has(c.id) || reviewed.has(c.id)) continue;
    if (!reviewWindowOpen(c)) continue;
    out.set(c.id, c);
  }
  const lastDay = (c: ReviewConference) => (c.end_date || c.start_date || '').slice(0, 10);
  return [...out.values()].sort((a, b) => lastDay(b).localeCompare(lastDay(a)));
}

/** Save the caller's review. Throws the raw error; callers show friendlyError. */
export async function submitConferenceReview(
  accessToken: string,
  input: {
    conferenceId: string;
    userId: string;
    rating: number;
    text: string;
    displayName: string | null;
    criteria?: ReviewCriteria;
  },
): Promise<void> {
  const row: Record<string, unknown> = {
    conference_id: input.conferenceId,
    user_id: input.userId,
    rating: input.rating,
    review_text: input.text.trim() || null,
    display_name: input.displayName,
  };
  if (REVIEW_CRITERIA_DB && input.criteria) {
    const clean: ReviewCriteria = {};
    for (const { key } of REVIEW_CRITERIA) {
      const v = input.criteria[key];
      if (typeof v === 'number' && v >= 1 && v <= 5) clean[key] = Math.round(v);
    }
    if (Object.keys(clean).length > 0) row.criteria = clean;
  }
  const { data, error } = await getAuthedClient(accessToken)
    .from('conference_reviews')
    .insert(row)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new UserFacingError('Your review could not be saved. Please try again');
  try {
    window.dispatchEvent(new CustomEvent(REVIEW_SUBMITTED_EVENT, { detail: { conferenceId: input.conferenceId } }));
  } catch { /* ignore */ }
}
