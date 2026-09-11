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

Last swept: 11 Sep 2026.

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

- [ ] **No admin surface has been verified visually, and it is now LIVE.**
      The Users tab, the Pending tab, and the verified seal and sort on the
      conferences tab shipped to production on 11 Sep (`c912c90`) without anyone
      having seen them. `/admin` is gated on a platform-admin account and I will
      not sign in as one. Blocked on: Peter looking.
- [ ] **The Stripe-return confirmation moment is unverified end to end, and
      it is now LIVE** (shipped 11 Sep, `c912c90`). It needs an authed user with
      a paid application and `?payment=success`. The apply-completion arrival IS
      verified against SISMUN 2026, and the polling logic is byte-identical to
      what it replaced, so the risk is presentational. The first real card
      payment on production is now the test; worth watching the next one.

## Deliberately not done, with reasons

Nothing currently. The three items that lived here (pending chairs on the live
wall and the public committee card, the calendar link in the confirmation
email, and the draft reminder's doubled heading) were all overruled and are
done.

One judgement was kept inside the work rather than reversed: the PUBLIC
committee card shows that a chair is coming without naming them, because an
invitee may decline and publishing their name against a conference they never
agreed to chair is not ours to do. Say the word if it should name them; it is
a one-line change.
