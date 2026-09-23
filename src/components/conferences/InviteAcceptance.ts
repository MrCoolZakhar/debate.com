// ── InviteAcceptance ───────────────────────────────────────────────────────
//
// The data behind the organiser dashboard's dial (owner, 23 Sep 2026: "instead
// of the status, show how many delegates / FAs / observers / chairs have
// accepted their invite"; then "It should look the same, but the data should
// just be different"). The dial itself is ./ApplicantsDial.tsx, unchanged in
// look; this file only counts.
//
// What "accepted" and "invited" mean is decided by `inviteAcceptanceByRole`
// below, from the rows the dashboard already reads. The rule, per role:
//
//   Delegates (delegate + head-delegate), Faculty advisors, Observers:
//     invited  = every application of that role that is not rejected or
//                withdrawn and is either accepted by the organiser (accepted /
//                assigned / checked-in) or still an unclaimed invite (an
//                imported / invited row with no account, user_id null).
//     accepted = those rows with an account on them (user_id set). An imported
//                applicant becomes that by claiming the invite
//                (claim_import_invite writes user_id); a self-applicant has one
//                from the start and counts once the organiser accepts them.
//     A self-applicant still waiting for a decision is an APPLICANT, not an
//     invitee, and is counted on neither side.
//
//   Chairs:
//     accepted = distinct accounts that are on the dais: accepted
//                conference_chair_invites (invited_user_id) together with chair
//                applications with an account at accepted / assigned /
//                checked-in (accepting a chair invite creates that application,
//                so the two are unioned by user id, never added).
//     invited  = accepted + pending chair invites + unclaimed imported chair
//                applications (user_id null). Declined and revoked invites are
//                not counted.

const PLACED = new Set(['accepted', 'assigned', 'checked-in']);
const CLOSED = new Set(['rejected', 'withdrawn']);

export interface InviteAppRow {
  role: string;
  status: string;
  user_id: string | null;
}

export interface ChairInviteRow {
  status: string;
  invited_user_id: string | null;
}

export type InviteRoleKey = 'delegates' | 'advisors' | 'observers' | 'chairs';

export interface InviteRoleCount {
  key: InviteRoleKey;
  accepted: number;
  invited: number;
}

const ROLE_OF: Record<string, Exclude<InviteRoleKey, 'chairs'> | undefined> = {
  delegate: 'delegates',
  'head-delegate': 'delegates',
  'faculty-advisor': 'advisors',
  observer: 'observers',
};

export function inviteAcceptanceByRole(apps: InviteAppRow[], chairInvites: ChairInviteRow[]): InviteRoleCount[] {
  const tally: Record<Exclude<InviteRoleKey, 'chairs'>, { accepted: number; invited: number }> = {
    delegates: { accepted: 0, invited: 0 },
    advisors: { accepted: 0, invited: 0 },
    observers: { accepted: 0, invited: 0 },
  };
  const chairsIn = new Set<string>();
  let chairsOut = 0;

  for (const a of apps) {
    if (CLOSED.has(a.status)) continue;
    if (a.role === 'chair') {
      if (!a.user_id) chairsOut += 1;
      else if (PLACED.has(a.status)) chairsIn.add(a.user_id);
      continue;
    }
    const key = ROLE_OF[a.role];
    if (!key) continue;
    if (!a.user_id) {
      tally[key].invited += 1;
    } else if (PLACED.has(a.status)) {
      tally[key].invited += 1;
      tally[key].accepted += 1;
    }
  }
  for (const inv of chairInvites) {
    if (inv.status === 'accepted') {
      if (inv.invited_user_id) chairsIn.add(inv.invited_user_id);
    } else if (inv.status === 'pending') {
      chairsOut += 1;
    }
  }

  return [
    { key: 'delegates', ...tally.delegates },
    { key: 'advisors', ...tally.advisors },
    { key: 'observers', ...tally.observers },
    { key: 'chairs', accepted: chairsIn.size, invited: chairsIn.size + chairsOut },
  ];
}

/** Display labels, in the dial's key order. */
export const INVITE_ROLE_LABEL: Record<InviteRoleKey, string> = {
  delegates: 'Delegates',
  advisors: 'Faculty advisors',
  observers: 'Observers',
  chairs: 'Chairs',
};
