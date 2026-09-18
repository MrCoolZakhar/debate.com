/**
 * pledgedSpots.ts — turning a delegation's pledge into a head count.
 *
 * WHY THIS EXISTS
 * An application row is one person. A delegation pledge is not: when a faculty
 * advisor or head delegate says "I will pay for 12 delegate spots", twelve
 * people are coming to the conference and exactly one row exists for them. Every
 * headline "applicants" number on the organiser dashboard and in the admin
 * console counted rows, so a 200-person delegation conference read as a handful
 * of applications. WorldMUN is the extreme case: 54 rows, 166 pledged spots
 * nobody had filled yet.
 *
 * WHAT A PLEDGED SPOT IS
 * `applications.pledge_type = 'delegation'` with `spots_pledged` (delegate
 * seats the delegation pays for) and `advisors_pledged` (advisor tickets). Both
 * are stated on the apply flow's "Paying for delegation spots?" step. Once the
 * organiser marks the pledge received, the same numbers are added to
 * `societies.spots_purchased` / `advisor_spots_purchased`, and members of the
 * delegation then CONSUME those spots as they register (that is exactly what
 * DelegationsView's `openCount = spots_purchased - paidAttending.length` shows).
 *
 * WHICH IS WHY THIS SUBTRACTS.
 * A pledged spot that a real delegate has already taken up is one person, not
 * two. Counting pledges and registrations side by side without netting them off
 * would have overstated SISMUN by 116 people (116 pledged, 121 already
 * registered under those same delegations). So per delegation:
 *
 *     outstanding = max(0, pledged spots + pledged advisor tickets
 *                          - people already registered under that delegation)
 *
 * and the headline becomes `registered rows + outstanding`. It can only ever
 * grow the number by people who are genuinely not on the list yet.
 *
 * A pledge on an application with no `society_id` (rare, but possible before a
 * delegation is resolved) has nobody to net off against and counts in full,
 * keyed to the application itself so it can never be merged with another one.
 *
 * Rejected and withdrawn rows count for nothing, on either side of the
 * subtraction: their pledge is not coming, and neither are they.
 */

/** The columns the arithmetic needs, and all of them. Every caller selects
 *  exactly this shape (plus whatever else that surface already wanted). */
export interface PledgeRow {
  id: string;
  status: string | null;
  society_id: string | null;
  pledge_type: string | null;
  spots_pledged: number | null;
  advisors_pledged: number | null;
}

/** A row counts as a live participant, and its pledge as live, in these states.
 *  Mirrors the statuses every other "is this person coming" read uses. */
const LIVE_STATUSES = new Set(['submitted', 'accepted', 'assigned', 'checked-in']);

export function isLiveApplication(status: string | null | undefined): boolean {
  return LIVE_STATUSES.has(status ?? '');
}

/** Heads pledged by one application: delegate spots (only when the pledge was
 *  actually made) plus advisor tickets, which are recorded independently of
 *  `pledge_type` by the apply flow. */
function pledgedHeadsOf(r: PledgeRow): number {
  const spots = r.pledge_type === 'delegation' ? (r.spots_pledged ?? 0) : 0;
  return Math.max(0, spots) + Math.max(0, r.advisors_pledged ?? 0);
}

/**
 * Pledged spots nobody has registered against yet, for one conference's
 * applications. This is the number of extra PEOPLE the pledges represent.
 */
export function outstandingPledgedSpots(rows: readonly PledgeRow[]): number {
  const pledgedBy = new Map<string, number>();
  const membersBy = new Map<string, number>();

  for (const r of rows) {
    if (!isLiveApplication(r.status)) continue;
    // A pledge without a delegation is its own group, so it is never netted
    // off against somebody else's members.
    const key = r.society_id ?? `app:${r.id}`;
    if (r.society_id) membersBy.set(key, (membersBy.get(key) ?? 0) + 1);
    const heads = pledgedHeadsOf(r);
    if (heads > 0) pledgedBy.set(key, (pledgedBy.get(key) ?? 0) + heads);
  }

  let total = 0;
  for (const [key, pledged] of pledgedBy) {
    total += Math.max(0, pledged - (membersBy.get(key) ?? 0));
  }
  return total;
}

/**
 * The same arithmetic across many conferences at once, for the admin console.
 * Rows may belong to any conference; each conference is netted off on its own,
 * because a delegation lives inside one conference (`societies.conference_id`).
 */
export function outstandingPledgedSpotsByConference(
  rows: readonly (PledgeRow & { conference_id: string | null })[],
): Map<string, number> {
  const byConference = new Map<string, PledgeRow[]>();
  for (const r of rows) {
    if (!r.conference_id) continue;
    const list = byConference.get(r.conference_id);
    if (list) list.push(r);
    else byConference.set(r.conference_id, [r]);
  }
  const out = new Map<string, number>();
  for (const [confId, list] of byConference) {
    const n = outstandingPledgedSpots(list);
    if (n > 0) out.set(confId, n);
  }
  return out;
}
