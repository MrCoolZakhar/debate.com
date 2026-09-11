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

/** The receipt is the email a delegate keeps, and the next thing they need
 *  from it is the dates in their diary. Renders nothing at all when the
 *  conference has no confirmed dates — see `add_to_calendar` in emailBlocks.ts. */
const ADD_TO_CALENDAR_BUTTON: EmailBlock = { type: 'button', label: 'Add the dates to my calendar', destination: 'add_to_calendar' };

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
      // Brought onto the house style: this was the last entry in the file with
      // no heading variant, a SHOUTING-CAPS button label the style note above
      // explicitly forbids, and its opt-out links set at full body size so the
      // footnote competed with the ask.
      { type: 'paragraph', variant: 'heading', content: 'Your application is waiting' },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYou started an application to {{conference_name}} as a {{role}} and haven't finished it yet. Your answers are saved, so you can pick up exactly where you left off." },
      { type: 'button', label: 'Finish my application', destination: 'apply_page', role: '{{role}}' },
      { type: 'paragraph', variant: 'small', content: 'Not applying after all? You can delete the draft at {{draft_link}}. To stop reminders about it, use {{draft_stop_link}}.' },
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
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nPayment for your registration at {{conference_name}} is now open.' },
      { type: 'facts', items: [
        { label: 'Amount due', value: '{{fee}}' },
        { label: 'Registered as', value: '{{role}}' },
      ] },
      { type: 'paragraph', content: 'You can pay any time before the conference — open your conference view for the payment details the organizing team has set.' },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  // The approved receipt design: banner and conference identity come from
  // renderEmailHtml itself, then heading (in the conference accent), a short
  // body, the pass-style panel, the primary button and the footnote.
  //
  // The panel is deliberately a PASS, not just a receipt line: Dates, Role,
  // Committee, Delegation and Amount paid are the five things a delegate,
  // a parent or a school finance office looks for, and they are the same
  // five a delegate wants again on the morning of the conference. A row whose
  // token has no value (unallocated at payment time, no delegation) is
  // dropped by the renderer rather than printed as an unresolved marker.
  //
  // NO "Add to calendar" link. The block model cannot express one: button
  // URLs are never token-resolved and ButtonDestination is a closed union, so
  // a Google Calendar template URL built from this conference's name, dates
  // and location has nowhere to come from. See the note in emailBlocks.ts.
  payment_received: {
    subject: 'Payment received — {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Payment received' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nYour registration for {{conference_name}} is fully settled. Thank you.' },
      { type: 'facts', items: [
        { label: 'Dates', value: '{{conference_dates}}' },
        { label: 'Role', value: '{{role}}' },
        { label: 'Committee', value: '{{committee}}' },
        { label: 'Delegation', value: '{{delegation_name}}' },
        { label: 'Amount paid', value: '{{fee}}' },
      ] },
      VIEW_CONFERENCE_BUTTON,
      ADD_TO_CALENDAR_BUTTON,
      { type: 'paragraph', variant: 'small', content: 'Keep this email as your confirmation of payment.' },
    ],
  },
  fee_waived: {
    subject: 'Your {{conference_name}} fee has been waived',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your fee has been waived' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nThe organizing team has waived your registration fee for {{conference_name}}. Your place is unaffected, and we look forward to seeing you there.' },
      // A money event with no money row was the odd one out beside
      // payment_available and payment_received. "Nothing further to pay" is
      // the fact, and it belongs where a reader looks for the amount.
      { type: 'facts', items: [
        { label: 'Amount due', value: 'Nothing further to pay' },
        { label: 'Registered as', value: '{{role}}' },
      ] },
      VIEW_CONFERENCE_BUTTON,
      { type: 'paragraph', variant: 'small', content: 'Keep this email as your confirmation. If your conference view still shows a balance in a day or two, reply and ask the team to check.' },
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
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nYou have your seat for {{conference_name}}.' },
      // The committee and the country as FACTS, not buried mid-sentence. This
      // is the line a delegate comes back to this email for, weeks later.
      // The emblem and the flag, not just the words. This is the email a
      // delegate screenshots and sends to their friends; it should look like
      // their seat, not like a database row.
      { type: 'facts', items: [
        { label: 'Committee', value: '{{committee}}', iconFrom: 'committee' },
        { label: 'Representing', value: '{{country}}', iconFrom: 'country' },
      ] },
      { type: 'paragraph', content: "That's your brief for the whole conference, so it's worth starting early. Study guides and position paper details appear in your conference view as your chairs publish them." },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  allocation_changed: {
    subject: 'Your committee allocation has changed — {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your allocation has changed' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nYour allocation for {{conference_name}} has been updated. You are now in:' },
      { type: 'facts', items: [
        { label: 'Committee', value: '{{committee}}', iconFrom: 'committee' },
        { label: 'Representing', value: '{{country}}', iconFrom: 'country' },
      ] },
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
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nA paid delegation spot for {{conference_name}} has been transferred to you, so your registration is now covered.' },
      // Who is covering it, and that nothing is owed, are the two facts this
      // email exists to state. Both were inside the sentence.
      { type: 'facts', items: [
        { label: 'Amount due', value: 'Nothing further to pay' },
        { label: 'Covered by', value: '{{delegation_name}}' },
        { label: 'Registered as', value: '{{role}}' },
      ] },
      VIEW_CONFERENCE_BUTTON,
      { type: 'paragraph', variant: 'small', content: 'Delegations can move a paid spot between members. If yours is moved again, we will email you.' },
    ],
  },
  spot_lost: {
    subject: 'A change to your paid spot — {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your paid spot has moved' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nThe paid delegation spot that was covering your registration at {{conference_name}} has been transferred to another delegate.\n\nYour place is not cancelled. Speak to your head delegate, faculty advisor, or the organizing team about how payment will be settled.' },
      // No {{fee}} row here on purpose: the amount now owed depends on how
      // the delegation settles it, and printing a headline price beside
      // "unpaid" would answer a question this email cannot actually answer.
      { type: 'facts', items: [
        { label: 'Registration now', value: 'Unpaid' },
        { label: 'Delegation', value: '{{delegation_name}}' },
        { label: 'Registered as', value: '{{role}}' },
      ] },
      VIEW_CONFERENCE_BUTTON,
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
      { type: 'paragraph', variant: 'heading', content: "You're on the dais" },
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYou've been assigned as a chair at {{conference_name}}." },
      // No iconFrom here: a chair's application almost never carries an
      // assigned committee or country (46 of 376 in production), so a
      // committee emblem would resolve to nothing for most chairs.
      { type: 'facts', items: [
        { label: 'Committee', value: '{{committee}}' },
        { label: 'Your role', value: '{{role}}' },
      ] },
      { type: 'paragraph', content: 'Your session tools, roll call, speakers list, motions, documents and voting, appear under this committee. Your session code arrives closer to the conference.' },
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
      { type: 'paragraph', content: "Hi {{delegate_name}},\n\nYour session code and chair code are ready in your chair dashboard. Use them to open your committee room when it's time to gavel in." },
      // Same reason as chair_assigned: no emblem, a chair application rarely
      // has an assigned committee to draw one from.
      { type: 'facts', items: [
        { label: 'Committee', value: '{{committee}}' },
        { label: 'Your role', value: '{{role}}' },
      ] },
      { type: 'paragraph', content: 'Delegates join with the session code. The chair code is what gives you the dais.' },
      VIEW_CONFERENCE_BUTTON,
    ],
  },
  session_join_invite: {
    subject: 'Join your live committee — {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your committee is open' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\n{{conference_name}} is live. Join your committee room with the code below. See you on the floor.' },
      // The session code is the whole point of this email and it was mid
      // sentence, where a delegate cannot find it again on the morning of
      // the conference.
      { type: 'facts', items: [
        { label: 'Committee', value: '{{committee}}' },
        { label: 'Session code', value: '{{session_code}}' },
      ] },
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
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\n{{delegation_name}} has swapped allocations within its delegation at {{conference_name}}, and yours has changed as part of it. You are now in:' },
      // Same panel as allocation_changed, which this email is a variant of.
      // The emblem and the flag resolve per recipient from their own seat.
      { type: 'facts', items: [
        { label: 'Committee', value: '{{committee}}', iconFrom: 'committee' },
        { label: 'Representing', value: '{{country}}', iconFrom: 'country' },
      ] },
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
  // Chair-facing. Queued per committee by queueAwardsOpenEmails so
  // {{committee}} is the chair's own room.
  awards_open: {
    subject: 'Award nominations are open for {{committee}} at {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Time to name your awards' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nThe secretariat of {{conference_name}} has opened award nominations for **{{committee}}**. Please agree the slate with your co-chairs and submit it from your committee page, where the session scoreboard sits beside each slot as evidence.\n\nOnce submitted, the secretariat checks it against the quotas and announces every committee together at the closing ceremony.' },
      { type: 'button', label: 'Nominate from my committee page', destination: 'documents' },
      { type: 'paragraph', variant: 'small', content: 'If your slate is returned with a note, you can edit and resubmit it until the deadline.' },
    ],
  },
  // Delegate-facing. Queued per award by queueAwardReceivedEmails, which
  // supplies {{award}}, {{committee}} and {{country}} for that one honour.
  award_received: {
    subject: 'Congratulations: {{award}} at {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'You have won an award' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nThe dais and the secretariat of {{conference_name}} have recognised your work this conference.' },
      // All three facts were in one sentence. This is the email a delegate
      // screenshots, and the one they come back to when they are writing an
      // application a year later, so it should read like the certificate.
      // The emblem and the flag resolve from the recipient's own seat, the
      // same way allocation_assigned does.
      { type: 'facts', items: [
        { label: 'Award', value: '{{award}}' },
        { label: 'Committee', value: '{{committee}}', iconFrom: 'committee' },
        { label: 'Representing', value: '{{country}}', iconFrom: 'country' },
      ] },
      { type: 'paragraph', content: 'It is now on your MUN CV as a verified Gavelling entry, so you can share it with any conference you apply to next.' },
      // 'conference_page' rather than a custom URL: button URLs are not token
      // resolved, so the slug cannot be interpolated. The honour roll lives at
      // /conferences/<slug>/awards, one tap from the conference page.
      { type: 'button', label: 'See the honour roll', destination: 'conference_page' },
      { type: 'button', label: 'Open my MUN CV', destination: 'custom', url: '/account/cv' },
    ],
  },

  // ── Invite reminders ───────────────────────────────────────────────────────
  // Three follow-ups per audience, at day 3, day 10 and day 21, for someone who
  // was invited and never made an account. Queued by the `queue_invite_reminders`
  // SQL RPC, which carries a mirror of this copy the way send_draft_reminder /
  // render_draft_reminder mirrors draft_reminder: THESE ARE THE TWO PLACES, and
  // a change to one is a change to both.
  //
  // Every reminder ends. The third says so in its own words, because a person
  // who is never going to accept deserves to know the emails have stopped
  // rather than to keep bracing for the next one.
  chair_invite_reminder_1: {
    subject: 'Your chair invite to {{conference_name}} is still open',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your chair invite is waiting' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\n{{conference_name}} invited you to chair **{{committee}}** and the invite is still open. Accepting creates your free Gavelling account and opens your chair tools.' },
      { type: 'facts', items: [
        { label: 'Conference', value: '{{conference_name}}' },
        { label: 'Committee', value: '{{committee}}' },
        { label: 'Dates', value: '{{conference_dates}}' },
        { label: 'Invited by', value: '{{invited_by}}' },
      ] },
      { type: 'button', label: 'Accept and chair', destination: 'chair_invite_accept' },
      { type: 'paragraph', variant: 'small', content: 'Not able to chair this one? You can decline from the same link and the secretariat will know.' },
    ],
  },
  chair_invite_reminder_2: {
    subject: '{{conference_name}} is still holding a dais seat for you',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Still holding a seat for you' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nYour seat on the {{conference_name}} dais has not been claimed yet. Chairing on Gavelling means a live committee room: roll call, the speakers list, motions, documents and voting, all from one screen. There is nothing to install and nothing to pay.' },
      { type: 'facts', items: [
        { label: 'Committee', value: '{{committee}}' },
        { label: 'Dates', value: '{{conference_dates}}' },
        { label: 'Your fee', value: 'Waived, chairs never pay' },
      ] },
      { type: 'button', label: 'Accept and chair', destination: 'chair_invite_accept' },
      { type: 'paragraph', variant: 'small', content: 'If someone else should chair instead, forward this email to them and they can accept with their own address.' },
    ],
  },
  chair_invite_reminder_3: {
    subject: 'Last reminder: your chair invite to {{conference_name}}',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Last reminder about your chair invite' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nThis is the final reminder about chairing **{{committee}}** at {{conference_name}}. The invite stays valid, but we will stop emailing you about it after this.' },
      { type: 'button', label: 'Accept and chair', destination: 'chair_invite_accept' },
      { type: 'paragraph', variant: 'small', content: 'No reply needed if you are not interested. The secretariat can see the invite is still open and will plan around it.' },
    ],
  },
  organizer_invite_reminder_1: {
    subject: 'Your invite to the {{conference_name}} team is still open',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your team invite is waiting' },
      { type: 'paragraph', content: 'Hi,\n\n{{invited_by}} invited you to help organise **{{conference_name}}** and the invite has not been opened yet. Accepting gives you the management dashboard: applications, committees, allocations, finances and communications.' },
      { type: 'facts', items: [
        { label: 'Conference', value: '{{conference_name}}' },
        { label: 'Invited by', value: '{{invited_by}}' },
        { label: 'Role', value: 'Organiser' },
      ] },
      { type: 'button', label: 'Create an account and accept', destination: 'organizer_invite_accept' },
      // The address line is the same fact queueOrganizerInviteEmail appends to
      // the invite itself: respond_organizer_invite refuses unless the signed
      // in account matches, and most of these invitees are signed in as
      // someone else. The RPC fills the actual address in.
      { type: 'paragraph', variant: 'small', content: 'This invitation is tied to the address it was sent to. Sign in with that address to accept it, or create a free account with it.' },
    ],
  },
  organizer_invite_reminder_2: {
    subject: 'The {{conference_name}} team seat is still open',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'The team seat is still open' },
      { type: 'paragraph', content: 'Hi,\n\nYour place on the {{conference_name}} organising team has not been claimed yet. The dashboard handles applications, committees, allocations, finances and communications in one place, and organisers are never charged to use it.' },
      { type: 'facts', items: [
        { label: 'Conference', value: '{{conference_name}}' },
        { label: 'Invited by', value: '{{invited_by}}' },
        { label: 'Role', value: 'Organiser' },
      ] },
      { type: 'button', label: 'Create an account and accept', destination: 'organizer_invite_accept' },
      { type: 'paragraph', variant: 'small', content: 'This invitation is tied to the address it was sent to. Sign in with that address to accept it, or create a free account with it.' },
    ],
  },
  organizer_invite_reminder_3: {
    subject: 'Last reminder: the {{conference_name}} team invite',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Last reminder about the team invite' },
      { type: 'paragraph', content: 'Hi,\n\nThis is the final reminder that {{conference_name}} invited you onto its organising team. The invite stays valid, and we will stop emailing about it after this.' },
      { type: 'button', label: 'Create an account and accept', destination: 'organizer_invite_accept' },
      { type: 'paragraph', variant: 'small', content: 'No reply needed. The team can see the invite is still open and will plan around it.' },
    ],
  },
  import_claim_reminder_1: {
    subject: 'Your {{conference_name}} registration is waiting for you',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your registration is waiting for you' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\n{{conference_name}} has already registered you as a **{{role}}**. Create your free account with this address and your registration attaches automatically, along with anything the secretariat has allocated you.' },
      { type: 'facts', items: [
        { label: 'Conference', value: '{{conference_name}}' },
        { label: 'Role', value: '{{role}}' },
        { label: 'Delegation', value: '{{delegation_name}}' },
      ] },
      { type: 'button', label: 'Claim my registration', destination: 'import_claim' },
      { type: 'paragraph', variant: 'small', content: 'You do not need to apply again. Your place is already held, this only connects it to an account you control.' },
    ],
  },
  import_claim_reminder_2: {
    subject: 'Your {{conference_name}} place is still unclaimed',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Your place is still unclaimed' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nYour registration at {{conference_name}} is still waiting to be connected to an account. Once it is, you can see your committee and country, read the study guides as your chairs publish them, and follow your committee live on the day.' },
      { type: 'facts', items: [
        { label: 'Conference', value: '{{conference_name}}' },
        { label: 'Role', value: '{{role}}' },
        { label: 'Dates', value: '{{conference_dates}}' },
      ] },
      { type: 'button', label: 'Claim my registration', destination: 'import_claim' },
      { type: 'paragraph', variant: 'small', content: 'It takes a minute and costs nothing. Claiming does not change your registration, it only puts it in your hands.' },
    ],
  },
  import_claim_reminder_3: {
    subject: 'Last reminder: your {{conference_name}} registration',
    blocks: [
      { type: 'paragraph', variant: 'heading', content: 'Last reminder about your registration' },
      { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nThis is the final reminder that {{conference_name}} is holding a registration for you on Gavelling. Your place is unaffected either way, and we will stop emailing you about it after this.' },
      { type: 'button', label: 'Claim my registration', destination: 'import_claim' },
      { type: 'paragraph', variant: 'small', content: 'If someone else handles your registration, forward this to them and they can claim it with their own address.' },
    ],
  },
};

/** Looks up eventKey's default subject + blocks. null if the key isn't recognized. */
export function getDefaultEventEmail(eventKey: string): DefaultEventEmail | null {
  return DEFAULT_EVENT_EMAILS[eventKey] ?? null;
}
