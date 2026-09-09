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

## Needs a decision from Peter

- [ ] **The five pre-registration actions.** Nothing sent, no credits issued.
      Previews: `claude.ai/code/artifact/677b7c78`.
      - Top up 203 pre-registrants to 2 credits (dry run: all have exactly 1,
        so it is exactly 203 credits, nobody double-granted)
      - Email those 203 (apology + the extra credit)
      - Email the 681 pre-registrants with no account
      - Add 884 pre-registrants to the mailing list
- [ ] **Turn on the invite reminders.** The machinery is built and verified in
      preview: 127 due today (32 chairs, 29 organisers, 66 imports), ledger
      empty, zero outbox rows. `queue_invite_reminders` defaults to PREVIEW, so
      it is inert until scheduled. To enable:
      ```sql
      select cron.schedule('invite-reminders', '15 10 * * *',
        $$select public.queue_invite_reminders(false)$$);
      ```
      The `false` is mandatory: a cron that omits it silently sends nothing.
- [ ] **Should the reminder RPC honour a conference's own drafted template?**
      Right now it always uses the built-in copy for its nine event keys, while
      `draft_reminder` DOES honour a draft. So an organiser can write
      `chair_invite_reminder_1` in Communications and watch it be ignored. Real
      inconsistency, deliberately not fixed silently.

## Blocked on information

- [ ] **ONUcly's original email failure was never explained.** The code now
      reports the true cause instead of blaming the audience filter, but the
      original fault is still unknown. Blocked on: the exact on-screen error
      text from them.

## Needs a human's eyes

- [ ] **No admin surface has been verified visually** — the Users tab, the
      Pending tab, or the new verified seal and sort on the conferences tab.
      `/admin` is gated on a platform-admin account and I will not sign in as
      one. Blocked on: Peter looking.
- [ ] **The Stripe-return confirmation moment is unverified end to end.** It
      needs an authed user with a paid application and `?payment=success`. The
      apply-completion arrival IS verified live against SISMUN 2026. The
      polling logic is byte-identical to what it replaced, so the risk is
      presentational, but it deserves one real payment before it ships.

## Deliberately not done, with reasons

Recorded rather than dropped. Overrule any of these.

- [ ] **Pending chairs on the LIVE committee card and the public committee
      card.** The committees page, the committee editor and the assignment
      board all now show invitees inline in the dais, greyed, with a PENDING
      badge. Two surfaces do not:
      - `live/CommitteeCard.tsx` — the live wall is operational, and its copy
        is built on whether chairs hold the SESSION CODE ("Chairs have the
        code" vs "No chair assigned yet", `cardModel.ts:552`). A pending
        invitee has no code, so threading them in makes that headline wrong on
        the surface that matters most while rooms are running. Doing it
        properly means changing the card model, not the render.
      - The public committee card — a delegate deciding whether to apply
        should see who is confirmed to chair, not who was asked.
- [ ] **"Add to calendar" in the confirmation email.** It is in the
      confirmation PAGE and works. It is not in the email because
      `ButtonDestination` is a closed union, `custom` takes a literal URL, and
      button URLs are never token-resolved, so a per-conference Google Calendar
      URL is not expressible. Enabling it means widening the union, branching
      `resolveButtonUrl`, widening `ButtonUrlConference` beyond `slug` to carry
      dates and location, and mirroring the same URL into
      `gavelling_email_html` for the SQL senders. Written up in
      `emailBlocks.ts`.
- [ ] **`render_draft_reminder`'s fallback prints its heading twice.** That SQL
      path writes only a plain `body`, and `email_outbox_fill_body_html` then
      builds the card using the SUBJECT as the H1 — so the new heading block
      shows again as the first body line. Matching the TS default exactly was
      the instruction and this is a faithful mirror of it. The clean fix is for
      that function to return a `body_html` built with `gavelling_email_html`
      and for both callers to insert it, which is a behaviour change beyond
      the ask.
