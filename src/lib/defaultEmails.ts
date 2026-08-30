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

// ── House style for the defaults ─────────────────────────────────────────────
// Every default follows the same three-beat rhythm the renderer is built for:
//
//   1. heading  — the news, in five words or fewer, no greeting
//   2. body     — "Hi {{delegate_name}}," then what happened and what it means
//   3. button   — one action, sentence case, describing the destination
//   4. small    — optional: the honest footnote (what we still don't know,
//                 what the reader should do if it looks wrong)
//
// Headings never repeat the subject line verbatim, and never promise anything
// the product doesn't actually do. Button labels are sentence case: SHOUTING
// CAPS read as an ad, and these are not ads.

const VIEW_CONFERENCE_BUTTON: EmailBlock = { type: 'button', label: 'View my conference', destination: 'documents' };

export const DEFAULT_EVENT_EMAILS: Record<string, DefaultEventEmail> = {
  application_received: {
    subject: "We've received your application to {{conference_name}}",
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your application is in' },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nThanks for applying to {{conference_name}} as a {{role}}. Your application is now with the organizing team for review.\n\nThere is nothing further for you to do right now — we'll email you as soon as there's a decision." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  // Queued by the `send_draft_reminder` SQL RPC rather than queueEventEmail
  // (the organizer sends it against an application_drafts row, which has no
  // application to resolve recipients from). That function carries a SQL
  // mirror of this subject + these blocks as its own no-template fallback —
  // if you change the copy here, change it there too.
  //
  // The trailing paragraph carries the two token links as plain text: the
  // block model has no token-carrying button destination, and extending that
  // closed union for a footer line isn't worth it.
  draft_reminder: {
    subject: 'Your {{conference_name}} application is still unfinished',
    blocks: [
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYou started an application to {{conference_name}} as a {{role}} and haven't finished it yet. Your answers are saved — pick up where you left off." },
      { type: 'button', label: 'FINISH MY APPLICATION', destination: 'apply_page', role: '{{role}}' },
      { type: 'paragraph', content: 'Not applying after all? You can delete the draft at {{draft_link}}. To stop reminders about it, use {{draft_stop_link}}.' },
    ],
  },
  application_accepted: {
    subject: "You're in! Your {{conference_name}} application has been accepted",
    blocks: [
      { type: 'paragraph', variant: 'heading', content: "You're in" },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYour application to {{conference_name}} as a {{role}} has been accepted. We're glad to have you with us.\n\nYour committee allocation, any fee you owe, and the documents your chairs publish all live in one place — open your conference view to see where things stand." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  application_rejected: {
    subject: 'An update on your {{conference_name}} application',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'About your application' },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nThank you for applying to {{conference_name}}. After review, we aren't able to offer you a place this time.\n\nWe know that's a disappointing thing to read, and it isn't a judgement on you as a delegate — good conferences turn away strong applicants every year simply because there are more of them than there are seats. We hope you'll apply again." },
    ],
  },
  payment_available: {
    subject: 'Payment is now open for {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your fee is ready to pay' },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nPayment for your {{role}} registration at {{conference_name}} is now open. The fee is **{{fee}}**.\n\nYou can pay any time before the conference — open your conference view for the payment details the organizing team has set." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  payment_received: {
    subject: 'Payment received — {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Payment received' },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nWe've recorded your payment of **{{fee}}** for {{conference_name}}. Your registration is fully settled — thank you.\n\nKeep this email as your confirmation." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  fee_waived: {
    subject: 'Your {{conference_name}} fee has been waived',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your fee has been waived' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nThe organizing team has waived your registration fee for {{conference_name}}. There is nothing further for you to pay, and your place is unaffected.\n\nWe look forward to seeing you there.' },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  aid_approved: {
    subject: 'Your financial aid request for {{conference_name}} has been approved',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your aid request was approved' },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYour financial aid request for {{conference_name}} has been approved. The organizing team will apply the support to your balance." },
      VIEW_CONFERENCE_BUTTON,
      { type: 'paragraph', variant: 'small', content: "You don't need to do anything right now. Your conference view will show the updated amount once the team has applied it." },
    ],
  },
  aid_denied: {
    subject: 'An update on your financial aid request for {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'About your aid request' },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nThank you for requesting financial aid for {{conference_name}}. After review, the organizing team isn't able to offer aid this time, so the standard registration fee applies.\n\nIf your circumstances change, or if there's context the team didn't have, you're welcome to write back and ask them to look again." },
    ],
  },
  allocation_assigned: {
    subject: 'Your committee allocation for {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your allocation is ready' },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYou've been placed in **{{committee}}**, representing **{{country}}**, at {{conference_name}}.\n\nThat's your brief for the whole conference, so it's worth starting early. Study guides and position paper details appear in your conference view as your chairs publish them." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  allocation_changed: {
    subject: 'Your committee allocation has changed — {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your allocation has changed' },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYour allocation for {{conference_name}} has been updated. You're now in **{{committee}}**, representing **{{country}}**." },
      VIEW_CONFERENCE_BUTTON,
      { type: 'paragraph', variant: 'small', content: 'If you had already started a position paper, check it against the new committee and country before you go any further.' },
    ],
  },
  allocation_removed: {
    subject: 'Your committee allocation has been removed — {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your allocation has been removed' },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYour committee allocation for {{conference_name}} has been removed, so you don't currently hold a committee or country placement.\n\nThis is usually a step in a reshuffle rather than the end of the story — the organizing team will be in touch if a new allocation is on the way. If you weren't expecting this, reply and ask." },
    ],
  },
  pledge_received: {
    subject: 'Delegation pledge received — {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Pledge received' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nYour pledge to cover delegation spots for {{delegation_name}} at {{conference_name}} has been marked received. Thank you for handling payment on behalf of your delegation.\n\nYour conference view shows which spots the pledge covers and who is currently holding them.' },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  added_to_delegation: {
    subject: "You've joined {{delegation_name}} — {{conference_name}}",
    blocks: [
      { type: 'paragraph', variant: 'heading', content: "You're part of {{delegation_name}}" },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYou've been added to {{delegation_name}}'s delegation for {{conference_name}}. Your head delegate and faculty advisor can now see you as part of their group, and any spots the delegation has paid for can be assigned to you." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  removed_from_delegation: {
    subject: 'You have left {{delegation_name}} — {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: "You've left {{delegation_name}}" },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYou've been removed from {{delegation_name}}'s delegation for {{conference_name}}. Your own registration is unaffected — you are still applying or attending exactly as before.\n\nIf that doesn't look right, get in touch with your head delegate or the organizing team." },
    ],
  },
  spot_received: {
    subject: "You've been given a paid spot — {{conference_name}}",
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your spot is paid for' },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nA paid delegation spot for {{conference_name}} has been transferred to you, so your registration is now covered. There's nothing further for you to pay." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  spot_lost: {
    subject: 'A change to your paid spot — {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your paid spot has moved' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nThe paid delegation spot that was covering your registration at {{conference_name}} has been transferred to another delegate, so your registration now shows as unpaid.\n\nYour place is not cancelled. Speak to your head delegate, faculty advisor, or the organizing team about how payment will be settled.' },
    ],
  },
  not_attending: {
    subject: "You've been marked not attending — {{conference_name}}",
    blocks: [
      { type: 'paragraph', variant: 'heading', content: "You're marked as not attending" },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYou've been marked as not attending {{conference_name}}. If you held a committee allocation, it has been released back to the pool for someone else.\n\nIf this was a mistake, contact the organizing team as soon as you can — allocations get taken quickly." },
    ],
  },
  attendance_restored: {
    subject: 'Your attendance has been restored — {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: "You're back on the list" },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYour registration for {{conference_name}} is active again.\n\nWorth checking: your committee allocation may have been released while you were marked as not attending, so confirm your current committee and payment status." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  documents_published: {
    subject: 'Your study guide is up for {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your study guide is up' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nThe study guide for your committee at {{conference_name}} has been published. It sets the topics, the scope of debate, and what your chairs expect you to have read.\n\nGive yourself time with it before the first session.' },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  chair_assigned: {
    subject: "You've been assigned as a chair — {{conference_name}}",
    blocks: [
      { type: 'paragraph', variant: 'heading', content: "You're chairing {{committee}}" },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYou've been assigned as a chair of **{{committee}}** at {{conference_name}}.\n\nYour session tools — roll call, speakers list, motions, documents, and voting — appear under this committee, and your session code arrives closer to the conference." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  committee_chair_invite: {
    subject: "You're invited to chair {{committee}} at {{conference_name}}",
    blocks: [
      { type: 'paragraph', variant: 'heading', content: "You've been invited to chair" },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\n{{conference_name}} has invited you to chair **{{committee}}**.\n\nAccepting adds the conference to your Gavelling account and opens your chair tools — roll call, speakers list, motions, documents, and voting." },
      { type: 'button', label: 'Accept the invitation', destination: 'chair_invite_accept' },
      { type: 'paragraph', variant: 'small', content: "If you weren't expecting this invitation, you can ignore it — nothing happens until you accept." },
    ],
  },
  organizer_invite: {
    subject: "You're invited to help organize {{conference_name}}",
    blocks: [
      { type: 'paragraph', variant: 'heading', content: "You've been invited to organize" },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\n{{conference_name}} has invited you to join its organizing team.\n\nAccepting opens the management dashboard, where organizers handle applications, committees, allocations, finances, and communications." },
      { type: 'button', label: 'Accept the invitation', destination: 'organizer_invite_accept' },
      { type: 'paragraph', variant: 'small', content: "If you weren't expecting this invitation, you can ignore it — nothing happens until you accept." },
    ],
  },
  session_chair_invite: {
    subject: 'Your session details for {{committee}} — {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: '{{conference_name}} is live' },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYour session code and chair code for **{{committee}}** are ready in your chair dashboard. Use them to open your committee room when it's time to gavel in.\n\nDelegates join with the session code; the chair code is what gives you the dais." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  session_join_invite: {
    subject: 'Join your live committee — {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your committee is open' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\n{{conference_name}} is live. Your session code for **{{committee}}** is **{{session_code}}**.\n\nUse it to join your committee room — see you on the floor.' },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  request_reply: {
    subject: 'Re: {{request_subject}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'The team replied' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nThe organizing team for {{conference_name}} has answered your question, “{{request_subject}}”.\n\nOpen your conference view to read the full reply and carry on the conversation there.' },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  // Organizer-facing, unlike every other default here. The custom-destination
  // button carries no url on purpose: queueRequestReceivedEmail fills it with
  // the deep link to that specific inbox thread, and the digest fills it with
  // the inbox itself.
  request_received: {
    subject: 'New question from {{delegate_name}} — {{request_subject}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'A delegate has a question' },
      { type: 'paragraph', content: '{{delegate_name}} asked {{conference_name}} about “{{request_subject}}”.' },
      { type: 'paragraph', content: '{{request_body}}' },
      { type: 'button', label: 'Reply in the inbox', destination: 'custom', url: '' },
      { type: 'paragraph', variant: 'small', content: 'Reply from the inbox rather than this email — the delegate sees your answer in their conference view, and the thread stays with the conference.' },
    ],
  },
  delegation_swap: {
    subject: 'Your committee allocation has been swapped — {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your allocation has been swapped' },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\n{{delegation_name}} has swapped allocations within its delegation, and yours has changed as part of it. You're now in **{{committee}}**, representing **{{country}}**, at {{conference_name}}." },
      VIEW_CONFERENCE_BUTTON,
      { type: 'paragraph', variant: 'small', content: 'Any research or position paper you had started applies to your old committee — check it against the new one before you continue.' },
    ],
  },
  import_join_invite: {
    subject: 'Your {{conference_name}} registration is on Gavelling',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your registration is waiting' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\n{{conference_name}} runs on Gavelling, and your registration is already there under this email address — committee, country, and payment status included.\n\nOpen your invitation to activate your account. Everything attaches itself; you do not need to register again.' },
      { type: 'button', label: 'View my invitation', destination: 'import_claim' },
    ],
  },
};

/** Looks up eventKey's default subject + blocks. null if the key isn't recognized. */
export function getDefaultEventEmail(eventKey: string): DefaultEventEmail | null {
  return DEFAULT_EVENT_EMAILS[eventKey] ?? null;
}
