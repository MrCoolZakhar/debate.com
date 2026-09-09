# Outstanding work

A tracked list of work that was asked for and is not finished. It exists
because the same items kept getting dropped: they arrived mid-turn while
something else was in flight, got acknowledged, and then lived only in a chat
summary. Nothing tracked them.

**Rules for this file**
- One line per item, with what "done" actually means.
- Tick it only when the work is in the repo (or in the remote database) and the
  build passes. "Prototyped" is not done.
- Anything blocked on Peter says so, and says exactly what is being waited on.
- When an item is finished, delete it. This is a to-do list, not a changelog;
  the commit messages are the changelog.

Last swept: 9 Sep 2026.

---

## Approved designs that are not in the product

- [ ] **Confirmation moment.** Two rounds of feedback went into a prototype
      (`claude.ai/code/artifact/e26a328a`). The product still shows a 38px
      spinner strip on the participant tab. Done = a real confirmation surface
      after both arrivals (application submitted, and payment) with the pass
      card, the spin, the paid/unpaid states and the calendar link.
- [ ] **Confirmation email redesign.** Peter approved the design and the
      "conference theme wins" rule, and was sent a live copy. The real
      `payment_received` template is untouched, so nothing he approved sends.
      Done = the default template rebuilt, banner + identity band + pass panel
      + calendar link, theme accent honoured.
- [ ] **Invite reminders.** Copy for all three stages was written and
      previewed (`claude.ai/code/artifact/677b7c78`). No code exists at all: no
      EVENT_REGISTRY keys, no RPC, no cron, no dedupe table. Done = the
      machinery built and dry-runnable. Sending stays off until Peter says go.

## Started, left half-finished

- [ ] **Admin set-up to verified.** Only the stat tile and a filter were
      changed. The per-row set-up donut ring, the "Set-up" sort and the
      "Set-up" filter group are all still set-up-based, and no `VerifiedCheck`
      appears on a row. Done = the row reads verified, with set-up kept only
      where it still earns its place.
- [ ] **Pending chairs on the LIVE committee card and the public committee
      card.** The committees page, the committee editor and the assignment
      board now all show invitees inline in the dais, greyed, with a PENDING
      badge. Two surfaces deliberately do not, and this is a judgement call
      Peter should overrule if he disagrees:
      - `live/CommitteeCard.tsx` — the live status wall is operational, used
        while rooms are running. Its copy is built on whether chairs have the
        SESSION CODE (`cardModel.ts:552`, "Chairs have the code" vs "No chair
        assigned yet"). A pending invitee has no code, so threading them in
        makes that headline wrong on the surface that matters most when it is
        being watched. Doing it properly means changing the card model, not
        just the render.
      - The public committee card on `ConferenceDetailClient` — a delegate
        deciding whether to apply should see who is actually confirmed to
        chair, not who was asked.
- [ ] **Eight emails still bury facts in prose:** `award_received`,
      `delegation_swap`, `session_join_invite`, `chair_assigned`,
      `session_chair_invite`, `fee_waived`, `spot_received`, `spot_lost`.
      Done = the facts-shaped data moved into a `facts` block, as
      `allocation_assigned` and `payment_received` already do.
- [ ] **`send_draft_reminder` SQL** still carries the old-schema copy as its
      own fallback. The TypeScript default was modernised; its mirror was not.
- [ ] **Four acronym sites still show a bare acronym** because their RPC
      returns no date: `get_chair_invite`, `get_organizer_invite`,
      `peek_application_draft`, and the admin live-committees row. Each is one
      column added to a Postgres function plus a TS field.

## Recommended and never acted on

- [ ] **Soften or drop the secretariat verification criterion.** It requires a
      SECOND organiser, so a conference genuinely run by one person can never
      be verified however ready it is. It blocks 167 conferences, 25 of them
      published, and only 7 conferences are verified in total. This was named
      as the highest-impact change available and then not done.

## Under-delivered

- [ ] **"Send me a few copies to preview in LIMUN"** — one was sent, not a few.

## Unresolved

- [ ] **ONUcly's original email failure was never explained.** The code was
      changed to report the true cause instead of blaming the audience filter,
      and Peter was asked to get the exact wording from them. That never came
      back. Blocked on: the on-screen error text.
- [ ] **No admin surface has been verified by eye.** `/admin` is gated on a
      platform-admin account. Blocked on: Peter looking, or a way to view it
      without signing in as someone.

## Blocked on Peter (correctly)

He said he would come back on these. Nothing has been sent and no credits
issued.

- [ ] Top up 203 pre-registrants to 2 credits (dry run: all have exactly 1)
- [ ] Email those 203 (apology + the extra credit)
- [ ] Email the 681 pre-registrants with no account
- [ ] Enable the invite reminder cron (~296 people, day 3 / 10 / 21)
- [ ] Add 884 pre-registrants to the mailing list
