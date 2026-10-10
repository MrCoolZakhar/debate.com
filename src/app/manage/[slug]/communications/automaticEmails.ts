// automaticEmails.ts — how the Automatic emails tab explains itself
// (10 Oct 2026, the 12-year-old rule).
//
// Every automatic email belongs to ONE moment of a participant's journey and
// says when it sends in ONE plain line. Both maps are exhaustive over EventKey
// on purpose: add a key to EVENT_REGISTRY and this file refuses to compile
// until the new email has a moment, a name and a line, the same contract
// NOTIFICATION_CATEGORY enforces in emailEvents.ts.
//
// Presentation only. Nothing here decides whether an email sends: that stays
// in emailEvents.ts (eventOnWhenMissing, the template's `enabled`, functional).

import type { EventKey } from '@/lib/emailEvents';

export const JOURNEY = [
  'When They Apply',
  'When You Decide',
  'When They Get a Seat',
  'When They Pay',
  'Before the Conference',
  'After the Conference',
  'Your Team and Questions',
] as const;
export type Journey = typeof JOURNEY[number];

export const EVENT_JOURNEY: Record<EventKey, Journey> = {
  application_received: 'When They Apply',
  draft_reminder: 'When They Apply',
  import_join_invite: 'When They Apply',
  import_claim_reminder_1: 'When They Apply',
  import_claim_reminder_2: 'When They Apply',
  import_claim_reminder_3: 'When They Apply',
  aid_approved: 'When They Apply',
  aid_denied: 'When They Apply',
  application_accepted: 'When You Decide',
  application_rejected: 'When You Decide',
  allocation_assigned: 'When They Get a Seat',
  co_delegate_assigned: 'When They Get a Seat',
  allocation_changed: 'When They Get a Seat',
  allocation_removed: 'When They Get a Seat',
  delegation_swap: 'When They Get a Seat',
  added_to_delegation: 'When They Get a Seat',
  removed_from_delegation: 'When They Get a Seat',
  payment_available: 'When They Pay',
  payment_received: 'When They Pay',
  fee_waived: 'When They Pay',
  pledge_received: 'When They Pay',
  spot_received: 'When They Pay',
  spot_lost: 'When They Pay',
  documents_published: 'Before the Conference',
  position_paper_due: 'Before the Conference',
  session_join_invite: 'Before the Conference',
  session_chair_invite: 'Before the Conference',
  not_attending: 'Before the Conference',
  attendance_restored: 'Before the Conference',
  awards_open: 'After the Conference',
  award_received: 'After the Conference',
  chair_assigned: 'Your Team and Questions',
  committee_chair_invite: 'Your Team and Questions',
  chair_invite_reminder_1: 'Your Team and Questions',
  chair_invite_reminder_2: 'Your Team and Questions',
  chair_invite_reminder_3: 'Your Team and Questions',
  organizer_invite: 'Your Team and Questions',
  organizer_invite_reminder_1: 'Your Team and Questions',
  organizer_invite_reminder_2: 'Your Team and Questions',
  organizer_invite_reminder_3: 'Your Team and Questions',
  request_received: 'Your Team and Questions',
  request_reply: 'Your Team and Questions',
};

/** The row's name and its one "sends when" line. */
export const EVENT_COPY: Record<EventKey, { name: string; when: string }> = {
  application_received: { name: 'Application received', when: 'Right after someone sends their application' },
  draft_reminder: { name: 'Finish your application', when: 'When someone started an application and did not send it' },
  import_join_invite: { name: 'Join Gavelling invite', when: 'When you import someone, asking them to make an account' },
  import_claim_reminder_1: { name: 'Import reminder 1', when: '3 days after the invite, if they have not joined' },
  import_claim_reminder_2: { name: 'Import reminder 2', when: 'About a week later, if they still have not joined' },
  import_claim_reminder_3: { name: 'Import reminder 3', when: 'Around day 21, the last one' },
  aid_approved: { name: 'Financial aid approved', when: 'When you approve a financial aid request' },
  aid_denied: { name: 'Financial aid declined', when: 'When you decline a financial aid request' },
  application_accepted: { name: 'Accepted', when: 'When you accept an application' },
  application_rejected: { name: 'Not accepted', when: 'When you reject an application' },
  allocation_assigned: { name: 'Your seat', when: 'When you give a delegate a committee and country' },
  co_delegate_assigned: { name: 'Your co-delegate', when: 'When a double delegation partner is seated later' },
  allocation_changed: { name: 'Seat changed', when: "When you change a delegate's committee or country" },
  allocation_removed: { name: 'Seat removed', when: "When you take a delegate's seat away" },
  delegation_swap: { name: 'Seats swapped', when: 'When two delegates in a delegation swap seats' },
  added_to_delegation: { name: 'Joined a delegation', when: 'When someone is added to a delegation' },
  removed_from_delegation: { name: 'Left a delegation', when: 'When someone is taken out of a delegation' },
  payment_available: { name: 'Time to pay', when: 'When payment opens for someone' },
  payment_received: { name: 'Payment received', when: 'When someone who pays for themselves has paid' },
  fee_waived: { name: 'Fee waived', when: "When financial aid covers someone's whole fee" },
  pledge_received: { name: 'Delegation tickets paid', when: "When you confirm a delegation's tickets are paid" },
  spot_received: { name: 'Spot covered', when: 'Coming soon. When a delegation ticket covers someone' },
  spot_lost: { name: 'Spot lost', when: 'Coming soon. When someone loses a covered place' },
  documents_published: { name: 'Study guide out', when: "When a committee's study guide is released" },
  position_paper_due: { name: 'Position paper due', when: 'Only when you send it, to delegates without a paper' },
  session_join_invite: { name: 'Session code', when: 'Only when you send it, with the code to join their room' },
  session_chair_invite: { name: 'Chair session code', when: 'Only when you send it, with the chair code' },
  not_attending: { name: 'Not attending', when: 'When you mark someone as not attending' },
  attendance_restored: { name: 'Attending again', when: 'When you mark them as attending again' },
  awards_open: { name: 'Award nominations open', when: 'Only when you send it, to your chairs' },
  award_received: { name: 'Award received', when: 'When you publish the awards' },
  chair_assigned: { name: 'Chair assigned', when: 'When someone is made a committee chair' },
  committee_chair_invite: { name: 'Chair invite', when: 'When you invite someone to chair' },
  chair_invite_reminder_1: { name: 'Chair invite reminder 1', when: '3 days after the invite, if it is not answered' },
  chair_invite_reminder_2: { name: 'Chair invite reminder 2', when: 'About a week later' },
  chair_invite_reminder_3: { name: 'Chair invite reminder 3', when: 'Around day 21, the last one' },
  organizer_invite: { name: 'Team invite', when: 'When you invite someone to your organising team' },
  organizer_invite_reminder_1: { name: 'Team invite reminder 1', when: '3 days after the invite, if it is not answered' },
  organizer_invite_reminder_2: { name: 'Team invite reminder 2', when: 'About a week later' },
  organizer_invite_reminder_3: { name: 'Team invite reminder 3', when: 'Around day 21, the last one' },
  request_received: { name: 'New question', when: 'To your team, when someone asks you a question' },
  request_reply: { name: 'Your reply', when: "When you answer someone's question" },
};

/** The always-on reminders that chase an invite are folded into that invite's
 *  row (one line: "Reminders if not answered: 1 · 2 · 3"), not three rows. */
export const REMINDER_OF: Partial<Record<EventKey, EventKey>> = {
  import_claim_reminder_1: 'import_join_invite',
  import_claim_reminder_2: 'import_join_invite',
  import_claim_reminder_3: 'import_join_invite',
  chair_invite_reminder_1: 'committee_chair_invite',
  chair_invite_reminder_2: 'committee_chair_invite',
  chair_invite_reminder_3: 'committee_chair_invite',
  organizer_invite_reminder_1: 'organizer_invite',
  organizer_invite_reminder_2: 'organizer_invite',
  organizer_invite_reminder_3: 'organizer_invite',
};
