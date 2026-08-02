// Default copy for every EVENT_REGISTRY key, written in a warm-professional
// voice using the same {{token}} placeholders as a chair-authored template.
// Single source for:
//   - The Notifications tab's PREVIEW DEFAULT / test-send affordance (a
//     registry row with no drafted template still shows something real).
//   - The chair-invite and import-join-invite built-in fallbacks, which used
//     to carry their own inline copy in emailEvents.ts — now they read from
//     this same map instead of duplicating it.
// Drafting a template overrides the default for that event, as before.
//   - queueEventEmail's three-state semantics: an ENABLED row with no real
//     content (a stub created by TURN ON, or an empty draft) falls back to
//     this map and actually sends it, the 'sent-default' outcome. A row
//     that's disabled skips silently; no row at all skips with an
//     'unconfigured' nudge. See the QueueOutcome docs in emailEvents.ts.
//   - The two functional invites (committee_chair_invite, import_join_invite)
//     always consult this map when their own template isn't enabled+drafted;
//     they never gate sending on template state at all.

import type { EmailBlock } from './emailBlocks';

export interface DefaultEventEmail {
  subject: string;
  blocks: EmailBlock[];
}

const VIEW_CONFERENCE_BUTTON: EmailBlock = { type: 'button', label: 'VIEW MY CONFERENCE', destination: 'documents' };

export const DEFAULT_EVENT_EMAILS: Record<string, DefaultEventEmail> = {
  application_received: {
    subject: "We've received your application to {{conference_name}}",
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nThanks for applying to {{conference_name}} as a {{role}}. Your application has been submitted and is now with the organizing team for review — we'll be in touch as soon as there's a decision." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  application_accepted: {
    subject: "You're in! Your {{conference_name}} application has been accepted",
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nGood news — your application to {{conference_name}} as a {{role}} has been accepted. We're glad to have you with us, and you'll find everything you need for the run-up to the conference in your account." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  application_rejected: {
    subject: 'An update on your {{conference_name}} application',
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nThank you for your interest in {{conference_name}}. After careful review, we're not able to offer you a place this time. We know that's disappointing, and we appreciate the time you put into applying — we hope to see you at a future conference." },
    ],
  },
  payment_available: {
    subject: 'Payment is now open for {{conference_name}}',
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nPayment for your {{role}} registration at {{conference_name}} is now open — the fee is {{fee}}. You can pay any time before the conference from your account." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  payment_received: {
    subject: 'Payment received — {{conference_name}}',
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nThis confirms we've received your payment of {{fee}} for {{conference_name}}. Your registration is fully settled — thank you." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  fee_waived: {
    subject: 'Your {{conference_name}} fee has been waived',
    blocks: [
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nYour registration fee for {{conference_name}} has been waived — there is nothing further for you to pay. We look forward to seeing you there.' },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  aid_approved: {
    subject: 'Your financial aid request for {{conference_name}} has been approved',
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nGood news — your financial aid request for {{conference_name}} has been approved. The organizing team will apply the support to your balance; you don't need to do anything further right now." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  aid_denied: {
    subject: 'An update on your financial aid request for {{conference_name}}',
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nThank you for requesting financial aid for {{conference_name}}. After review, the organizing team isn't able to offer aid at this time, and the standard registration fee applies. If your circumstances change, feel free to reach out to the organizing team." },
    ],
  },
  allocation_assigned: {
    subject: 'Your committee allocation for {{conference_name}}',
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYour committee allocation for {{conference_name}} is ready: you've been placed in {{committee}}, representing {{country}}. Start your research early — study guides and position paper details are in your account." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  allocation_changed: {
    subject: 'Your committee allocation has changed — {{conference_name}}',
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYour allocation for {{conference_name}} has been updated. You're now placed in {{committee}}, representing {{country}}. Please double-check your research and position paper against the new committee and country." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  allocation_removed: {
    subject: 'Your committee allocation has been removed — {{conference_name}}',
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYour committee allocation for {{conference_name}} has been removed. You currently don't hold a committee or country placement — the organizing team will follow up if a new one is on the way, or you're welcome to reach out with any questions." },
    ],
  },
  pledge_received: {
    subject: 'Delegation pledge received — {{conference_name}}',
    blocks: [
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nYour pledge to cover delegation spots for {{delegation_name}} at {{conference_name}} has been marked received. Thank you for organizing payment on behalf of your delegation.' },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  added_to_delegation: {
    subject: "You've joined {{delegation_name}} — {{conference_name}}",
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYou've been added to {{delegation_name}}'s delegation for {{conference_name}}. Your head delegate or faculty advisor can now see you as part of their group." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  removed_from_delegation: {
    subject: 'You have left {{delegation_name}} — {{conference_name}}',
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYou've been removed from {{delegation_name}}'s delegation for {{conference_name}}. Your registration itself is unaffected — reach out to the organizing team if this doesn't look right." },
    ],
  },
  spot_received: {
    subject: "You've been given a paid spot — {{conference_name}}",
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nGood news — a paid delegation spot for {{conference_name}} has been transferred to you, so your registration is now covered. Nothing further to pay." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  spot_lost: {
    subject: 'A change to your paid spot — {{conference_name}}',
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYour paid delegation spot for {{conference_name}} has been transferred to another delegate, so your registration now shows as unpaid. Please get in touch with your head delegate, faculty advisor, or the organizing team about settling payment." },
    ],
  },
  not_attending: {
    subject: "You've been marked not attending — {{conference_name}}",
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYou've been marked as not attending {{conference_name}}. If you held a committee allocation, it has been released back to the pool. If this was a mistake, please contact the organizing team." },
    ],
  },
  attendance_restored: {
    subject: 'Your attendance has been restored — {{conference_name}}',
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYou're back on as attending {{conference_name}}. Your registration is active again — check your account for your current committee and payment status." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  documents_published: {
    subject: 'Your study guide is up for {{conference_name}}',
    blocks: [
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nThe study guide for your committee at {{conference_name}} has just been released. Take a look before the next session.' },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  chair_assigned: {
    subject: "You've been assigned as a chair — {{conference_name}}",
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYou've been assigned as a chair of {{committee}} at {{conference_name}}. Your session tools — roll call, speakers list, motions, and voting — will be ready under this committee closer to the conference." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  committee_chair_invite: {
    subject: "You're invited to chair {{committee}} at {{conference_name}}",
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYou've been invited to chair {{committee}} at {{conference_name}}. Accepting adds this conference to your Gavelling account and gives you access to your chair tools." },
      { type: 'button', label: 'ACCEPT INVITATION', destination: 'chair_invite_accept' },
    ],
  },
  organizer_invite: {
    subject: "You're invited to help organize {{conference_name}}",
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYou've been invited to join the organizing team of {{conference_name}} as an organizer. Accepting gives you access to the conference management dashboard, where organizers manage applications, committees, and communications." },
      { type: 'button', label: 'ACCEPT INVITATION', destination: 'organizer_invite_accept' },
    ],
  },
  session_chair_invite: {
    subject: 'Your session details for {{committee}} — {{conference_name}}',
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\n{{conference_name}} is live. Your session code and chair password for {{committee}} are ready in your chair dashboard — use them to open your committee room when it's time to gavel in." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  session_join_invite: {
    subject: 'Join your live committee — {{conference_name}}',
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\n{{conference_name}} is live. Your session code for {{committee}} is {{session_code}}. Use it to join your committee room — see you on the floor." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  request_reply: {
    subject: 'Re: {{request_subject}}',
    blocks: [
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nThe organizing team for {{conference_name}} has replied to your question. Sign in to see the full reply and continue the conversation if needed.' },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  delegation_swap: {
    subject: 'Your committee allocation has been swapped — {{conference_name}}',
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nAs part of a delegation swap within {{delegation_name}}, your committee allocation for {{conference_name}} has changed. You're now placed in {{committee}}, representing {{country}} — please update your research accordingly." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  import_join_invite: {
    subject: '{{conference_name}} now runs on Gavelling',
    blocks: [
      { type: 'paragraph', content: '{{conference_name}} now runs on Gavelling — create your account with this email address and your registration will be attached automatically.' },
      { type: 'button', label: 'CREATE YOUR ACCOUNT', destination: 'signup_page' },
    ],
  },
};

/** Looks up eventKey's default subject + blocks. null if the key isn't recognized. */
export function getDefaultEventEmail(eventKey: string): DefaultEventEmail | null {
  return DEFAULT_EVENT_EMAILS[eventKey] ?? null;
}
