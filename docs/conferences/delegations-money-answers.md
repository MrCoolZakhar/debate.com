# Delegations: answers on the money questions

For Peter's delegations rebuild. Written 19 Oct 2026 by Christian's chat, from the live database, the Financials history and Christian's rules.

How to read the labels:

- **Decided** means Christian already made this rule and it is live. Do not change it.
- **Recommended** means it follows from his rules, but he has not ruled on this exact case. Treat it as the answer unless he says otherwise.
- Questions 1 to 4 were answered by Christian on 19 Oct.

## Ground rules first: what must not move

/pay and Financials took weeks of test runs to get right. They are live behind `store_flags` that are all on now. Please do not change any of the following. If your work needs one of them to behave differently, send the case to Christian's chat. We change it there with a rollback test, the same way as everything else in Financials.

- **Invoice and coverage functions:**
  - `sync_participant_invoices`
  - `settle_invoice_effects`
  - `cover_pledge_spot`
  - `pledge_covered_application_ids`
  - `_apply_pledge_cover_to_app`
  - `apply_pledge_coverage_society` and `apply_pledge_coverage_all`
- **Ticket numbering:** `renumber_pledge_spot_labels`, `renumber_delegation_tickets` and the `zz_renumber_delegation_tickets` trigger.
- **Tickets on /pay:** `add_pledged_spots`, `add_pledged_advisor_spots`, `remove_pledged_spot_invoice` (the X on /pay) and `trim_excess_spot_invoices`.
- **Role switches:** the `zz_app_role_switched` trigger and `_app_role_switched`.
- **Prices and checks:** `invoices.price_locked` and `invoice_price_locked`, and `money_daily_check`, which emails Gavelling if a leader is ever covered by their own ticket.
- **Card payments:** stripe-webhook v22 and create-checkout v21.
- **What /pay and the menu read:** `my_pay_overview` and the "Payment due" figure (`fin_attention_due_v2`).
- **One way to write money:** never set `applications.payment_status` or `invoices.status` directly. Money moves only through payments rows and the functions above. Payments are the truth.
- **Leaders pay their own ticket.**
  - A head delegate's or advisor's own ticket is never covered by tickets they bought. Their own ticket is "Delegate Ticket 1" or "Advisor Ticket 1"; the tickets they buy are numbered 2 to N+1.
  - Delegate tickets cover delegates only. That includes head delegates who bought no tickets, but never the person who bought them.

Your swap fix (`perform_delegation_swap`) touches no invoices or payments today. Please keep it that way. If a swap needs to move money, send it to us.

## Money when people change role or leave

Christian answered questions 1 to 4 himself on 19 Oct. All four are **Decided**.

**The principle: when a role changes, the money moves with the person.** The ticket follows the new role, and whoever paid is charged the difference or gets a refund for it. Nothing is silently kept and nothing is silently lost.

**Who can change roles.** Only organizers can move someone between delegate and faculty advisor, in either direction. The roles are very different, so the organizer must always know when it happens. Leaders on your delegation screens never get this action. Moves between delegate and head delegate keep working as they do today.

**1. A paid ticket and a role move (A). Decided: A1, for every role.**

- When someone who paid their own ticket changes role:
  - If the new role costs more, they get a "<Role> Ticket difference" line.
  - If it costs less, the organizer gets a refund-due item in Things to Do.
- This is today's rule, widened from delegate and head delegate to every role. Same `_app_role_switched` function, same `fin_role_switch_diff` flag.

**2. Covered members who change role (B). Decided: the ticket becomes an advisor ticket.**

- A delegate covered by their delegation's ticket becomes an advisor. The delegate ticket that covered them turns into an Advisor Ticket on the same leader, at the advisor price.
  - If that ticket was paid, the leader is charged the difference (advisor dearer) or the organizer gets a refund-due item for it (advisor cheaper).
  - If it was not paid yet, it simply becomes an unpaid Advisor Ticket.
- When the delegation already has Advisor Tickets, question 4 applies instead.

**3. A leader who holds the delegation's tickets (C). Decided: C1.**

- Refuse the move or removal while that leader holds any tickets: "Move this leader's tickets to another leader first".
- Moving tickets, with the payments and receipts already on them, comes later as one organizer-only action built in Christian's chat with a rollback test.
- Never let tickets sit on a non-leader (C3).

**4. Advisor Tickets (D). Decided: use a spare Advisor Ticket first.**

When a delegate becomes an advisor and the delegation has a spare Advisor Ticket:

| Their delegate ticket | The spare Advisor Ticket | What happens |
|---|---|---|
| Paid | Paid | They go on the Advisor Ticket. The delegate ticket is removed and refunded (a refund-due item for the organizer). |
| Paid | Not paid | The money moves from the delegate ticket onto the Advisor Ticket, and the delegate ticket is removed. If the advisor price is lower, the difference is refunded; if it is higher, the difference is owed. |
| Not paid | Paid | They go on the Advisor Ticket and the unpaid delegate ticket is removed. |
| Not paid | Not paid | They go on the Advisor Ticket and the unpaid delegate ticket is removed. This case follows from the other three; Christian did not state it. |

With no spare Advisor Ticket, question 2 applies: their delegate ticket turns into an Advisor Ticket. "Their delegate ticket" means their own paid ticket, or the delegation ticket covering them. The refund or difference goes to whoever paid it.

The same rules apply in reverse when an organizer moves an advisor to delegate. An Advisor Ticket becomes a delegate ticket, or the person goes onto a spare delegate ticket, and the difference is charged or refunded.

**Who builds it.** This is a money operation, so the server side is built in Christian's chat through the Supabase MCP, with a rollback test on every case above. It will be one organizer-only function that changes the role and moves the money in one step, and it will refuse when a leader calls it. Your screens only call it and show its sentence. Tell us when you need it, and don't write role or invoice updates for these moves yourself.

## What the numbers mean

**5. "Up to expected size" (E). Recommended.**

- Expected delegates = the sum of `spots_pledged` over the delegation's accepted leaders, plus each head delegate, who holds their own delegate seat (Delegate Ticket 1).
- Advisors are not delegate seats.
- Watch the wording: since 18 Oct the apply step asks "How many delegates will your delegation have?". For a head delegate, make sure your screens state whether that number includes them, for example "besides you", so the seat limit and the tickets agree.

**6. The delegation's "paid" headline (P). Recommended.**

- Use the same number /pay shows that leader as Paid (`my_pay_overview`), in the conference's one currency.
- Card payments and organizer-accepted proofs both count, net of refunds. Proofs still in review are not paid. Show them separately, as /pay does.
- Every conference now has one currency (prompt 126). Payments in another currency are left out of totals with the line "Some payments are in {codes}. They are not included here", as Financials does.
- Never compute a second total. If /pay and the delegations page disagree, people write to Jess.

**7. What is a "fee" in the leader's counts? Recommended: count tickets.**

- "12 of 15 Delegate Tickets paid", using the ticket names /pay already uses.
- A ticket counts as paid when its invoice is settled.
- Amounts belong in the money line, not the count.

## How paying for spots should work

**8. Expected size is billing today. Decided (Christian, 18 Oct): keep it.**

- Christian redesigned this step on 18 Oct (prompt 136). The leader is asked "How many delegates will your delegation have?" and told "We will generate an invoice for each delegate in your delegation. You can add or remove delegates at any time. Delegates can also pay for themselves at any point."
- The reason in his words: it gives Gavelling a truthful, complete size, and it is easier to understand than "delegation spots".
- So expected size and the delegate tickets are one number on purpose. Please don't split them.

**9. Extra spots at any time. Decided, with the same mechanism.**

- A "Buy another ticket" button is welcome. It calls `add_pledged_spots(app, 1)`, which raises expected size by one and creates the ticket.
- The X on /pay (`remove_pledged_spot_invoice`) removes an unpaid ticket and lowers the size by one.
- One number, two buttons. Please don't add a second kind of ticket that exists outside the expected size.

**10. Coverage before payment. Decided: yes, on purpose.**

- Christian's 24 Sep rule ("a pledge covers the delegate") is live as `fin_pledge_covers`. A pledged ticket covers the earliest delegates to join, whether or not it is paid yet.
- The delegate sees "Covered by your delegation". The leader owes the open tickets on their own /pay.
- Delegates never chase a fee their leader promised.

## Bugs found on the way

**11. Two definitions of a leader. Recommended: `is_society_leader`.**

- The one that grants powers is an accepted head delegate or advisor.
- This matches the OAKMUN decision of 18 Oct: a delegation only becomes visible once its leader is accepted (`_society_visible`).
- `my_delegation_roster` may still list pending leaders as members, marked pending, but should give them no leader powers and no money view.
- Treat `societies.advisor_user_id` as legacy: they are a leader only if they also hold an accepted application.

**12. `sync_participant_invoices` does nothing when a leader calls it for a member. Intended.**

- It is the only guard on a SECURITY DEFINER function, so it stays.
- It also returns quietly when it runs inside your own SECURITY DEFINER function, because it checks `auth.uid()`.
- If a leader action has to re-sync a member, ask Christian's chat for an internal `_sync_participant_invoices` that your function calls after its own `is_society_leader` check. Please don't loosen the public one.

**13 and 14. Seat swaps and open seats. Yours.** Fine to apply, as long as the fixes touch no invoices or payments. They don't today.

**15. The `position-papers` bucket is public. Yes, make it private, after one check.**

- It holds 296 files.
- Before switching it, grep for `getPublicUrl` and any stored `file_url` that is read directly: the chair and organizer review screens, and the Documents page (prompts 129 to 131).
- Then move every read to signed URLs.

**16. The `study-guides` bucket. Yes, apply the upload fix. Also make the bucket private.**

- It holds 70 files and is also public.
- Public means anyone with a link can read a study guide before its release date. Since prompt 129, release dates decide what delegates see.
- Organizers upload from the Documents page's committee pop-up (prompt 131). Keep that path rule working. No database function references the bucket.

## Before you apply SQL

Send us `scratch-session-block-seats.sql` and `scratch-study-guides-storage.sql` before they go live. We'll read them against the money list above, usually within the hour. That's the only check we need.
