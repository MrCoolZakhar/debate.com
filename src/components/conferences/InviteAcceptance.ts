// ── InviteAcceptance ───────────────────────────────────────────────────────
//
// The data behind the organiser dashboard's dial (owner, 23 Sep 2026: "The
// graph should be based on how many people in total they are expecting and how
// many people have applied, ok maybe not just accepted"). The dial itself is
// ./ApplicantsDial.tsx; this file only counts, per role, how many people have
// APPLIED and how many of those are ACCEPTED.
//
// The rule, per role:
//
//   Delegates (delegate + head-delegate), Faculty advisors, Observers:
//     applied  = every application of that role that is live: not rejected or
//                withdrawn, and submitted (drafts live in application_drafts and
//                never reach this table; a row with no submitted_at is skipped
//                defensively). Imported / invited rows with no account count:
//                the organiser put that person on the list.
//     accepted = those at accepted / assigned / checked-in (the organiser's
//                decision). The rest of applied is still pending.
//
//   Chairs (the old invite logic, deduped by account):
//     accepted = distinct accounts on the dais: accepted
//                conference_chair_invites (invited_user_id) together with live
//                chair applications with an account at accepted / assigned /
//                checked-in (accepting a chair invite creates that application,
//                so the two are unioned by user id, never added), plus imported
//                chair applications with no account that the organiser placed.
//     applied  = accepted + pending chair invites + chair applications still
//                waiting for a decision, again one per account. Declined and
//                revoked invites are not counted.
//
// Roles are disjoint (a person holds one role row), so the per-role counts can
// honestly share one ring.

const PLACED = new Set(['accepted', 'assigned', 'checked-in']);
const CLOSED = new Set(['rejected', 'withdrawn']);

export interface InviteAppRow {
  role: string;
  status: string;
  user_id: string | null;
  submitted_at?: string | null;
}

export interface ChairInviteRow {
  status: string;
  invited_user_id: string | null;
}

export type InviteRoleKey = 'delegates' | 'advisors' | 'observers' | 'chairs';

export interface RoleApplicationCount {
  key: InviteRoleKey;
  /** Live applications (accepted + pending). */
  applied: number;
  /** Of those, accepted by the organiser. */
  accepted: number;
}

const ROLE_OF: Record<string, Exclude<InviteRoleKey, 'chairs'> | undefined> = {
  delegate: 'delegates',
  'head-delegate': 'delegates',
  'faculty-advisor': 'advisors',
  observer: 'observers',
};

export function applicationsByRole(apps: InviteAppRow[], chairInvites: ChairInviteRow[]): RoleApplicationCount[] {
  const tally: Record<Exclude<InviteRoleKey, 'chairs'>, { applied: number; accepted: number }> = {
    delegates: { applied: 0, accepted: 0 },
    advisors: { applied: 0, accepted: 0 },
    observers: { applied: 0, accepted: 0 },
  };
  // Chairs: accounts, so an invite and the application it created are one person.
  const chairsIn = new Set<string>();
  const chairsWaiting = new Set<string>();
  let chairsInAnon = 0;
  let chairsWaitingAnon = 0;

  for (const a of apps) {
    if (CLOSED.has(a.status)) continue;
    if (a.submitted_at === null) continue;
    const placed = PLACED.has(a.status);
    if (a.role === 'chair') {
      if (a.user_id) (placed ? chairsIn : chairsWaiting).add(a.user_id);
      else if (placed) chairsInAnon += 1;
      else chairsWaitingAnon += 1;
      continue;
    }
    const key = ROLE_OF[a.role];
    if (!key) continue;
    tally[key].applied += 1;
    if (placed) tally[key].accepted += 1;
  }
  for (const inv of chairInvites) {
    if (inv.status === 'accepted') {
      if (inv.invited_user_id) chairsIn.add(inv.invited_user_id);
      else chairsInAnon += 1;
    } else if (inv.status === 'pending') {
      if (inv.invited_user_id) chairsWaiting.add(inv.invited_user_id);
      else chairsWaitingAnon += 1;
    }
  }
  let waiting = chairsWaitingAnon;
  for (const id of chairsWaiting) if (!chairsIn.has(id)) waiting += 1;
  const chairsAccepted = chairsIn.size + chairsInAnon;

  return [
    { key: 'delegates', ...tally.delegates },
    { key: 'advisors', ...tally.advisors },
    { key: 'observers', ...tally.observers },
    { key: 'chairs', applied: chairsAccepted + waiting, accepted: chairsAccepted },
  ];
}

/** Display labels, in the dial's key order. */
export const INVITE_ROLE_LABEL: Record<InviteRoleKey, string> = {
  delegates: 'Delegates',
  advisors: 'Faculty advisors',
  observers: 'Observers',
  chairs: 'Chairs',
};
