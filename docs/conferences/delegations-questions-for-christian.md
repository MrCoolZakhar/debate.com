# Delegations: open questions for Christian

From the delegations rebuild (Peter, 19 to 20 Oct 2026). The people-and-seats SQL is safe to apply without these answers (its functions take the cautious option); these decide the money behaviour. Peter's preference is noted where he gave one.

## Money when people change role or leave

1. **A paid ticket and a role move (A).** Someone already paid their own ticket, then moves between delegate and faculty advisor. Charge or refund the difference, like delegate to head delegate today (A1: widen the `zz_app_role_switched` trigger), or treat any paid ticket as paid (A2, the current default)?
2. **Covered members who change role (B).** Under the older pool coverage a member covered by the delegation stays "paid" after becoming an advisor. Reopen their fee at the advisor price (B1), or once covered always covered (B2, current default)?
3. **A leader who holds the delegation's tickets (C).** The 15 Delegate Tickets hang on the leader who added them. If that leader becomes a delegate or is removed, refuse until the tickets move (C1, drafted), move the tickets and their invoices to another leader in one step (C2), or let tickets sit on a non-leader (C3)?
4. **Advisor Tickets (D).** They never cover anyone automatically, so a delegate moved to advisor always owes the advisor fee even when the delegation bought Advisor Tickets. Add advisor coverage (D1) or keep advisor tickets only for the advisors a faculty advisor brings (D2, current)?

## What the numbers mean

5. **"Up to expected size" (E).** For the organiser's seat limit, is expected size the leaders' `spots_pledged` sum, or something else?
6. **The delegation's "paid" headline (P).** CLAUDE.md says card and offline money are never added together. What single number should a leader see as "paid" on their Financials card?
7. **What is a "fee" in the leader's counts?** "12 of 15 delegate fees paid": count tickets, or amounts?

## How paying for spots should work (Peter's view)

8. **Expected size is billing today.** Raising expected size creates a payable Delegate Ticket per spot (`add_pledged_spots`). Peter wants expected size to be a recommendation only.
9. **Extra spots at any time.** Peter: leaders "can just pay an extra one whenever they want, even without increasing the size of the delegation". Today a spot can only be bought by raising expected size. Proposal: a separate "Buy a spot" that adds a paid ticket without changing expected size, and expected size never creates invoices.
10. **Coverage before payment.** On the test conference the leader's 15 unpaid tickets already mark every member "Covered by your delegation" (pledge coverage counts tickets, not payments). Is covering before the ticket is paid intended?

## Bugs found on the way

11. **Two definitions of a leader.** `my_delegation_roster` counts `societies.advisor_user_id` and unaccepted applications as leaders; `is_society_leader` needs an accepted head delegate or advisor. Which is right?
12. **`sync_participant_invoices` does nothing when a leader calls it for a member** (it only runs for the person themself or an organiser). Intended?
13. **Leader seat swaps fail** when both people have accounts (`perform_delegation_swap` fills one seat before clearing the other). Fixed in `scratch-session-block-seats.sql`.
14. **Open seats lock countries in live rooms.** A delegation's seat with nobody in it reserves the country for everyone. Fixed in `scratch-session-block-seats.sql`.
15. **The `position-papers` bucket is public.** A paper's stored public URL downloads for anyone who has it; the client reads through signed URLs but still stores the public one. Make the bucket private?
16. **The `study-guides` bucket lets any signed-in account upload, overwrite or delete any file.** Fix drafted in `scratch-study-guides-storage.sql`.
