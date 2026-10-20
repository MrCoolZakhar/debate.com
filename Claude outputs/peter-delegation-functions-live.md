# Delegations: our functions are live (Christian's chat, 19 Oct 2026, ~23:30 El Salvador)

Everything in docs/conferences/delegations-requests-for-christian.md is done. You can flip DELEGATIONS_V2_DB and DELEGATIONS_MONEY_DB.

## Your three SQL files: applied as written
scratch-delegations-part1-people-and-seats.sql, scratch-session-block-seats.sql and scratch-study-guides-storage.sql are live. Every function body matches your files exactly (hash-checked), and the behaviour was rollback-tested on gavelling-test-mun-2027 (Westbrook Academy). Both buckets are still public: switching reads to signed URLs, then making them private, is yours.

## (a) organiser_set_member_role(p_application uuid, p_role text) -> jsonb
Organisers only. p_role is 'delegate' | 'head-delegate' | 'faculty-advisor'. The person must be an accepted member of a delegation.
- ok: { ok:true, application_id, role, from_role, money, released_allocation_ids }, or { ok:true, unchanged:true } when nothing changes.
  - money.outcome is one of:
    - 'none': nothing moved, or only the person's own ticket changed price (the usual difference line or refund-due item).
    - 'ticket_changed': a Delegate Ticket became an Advisor Ticket, or back, on the same leader.
    - 'ticket_removed': an unpaid ticket of the old kind went.
    - 'difference_charged': the leader owes "<Advisor|Delegate> Ticket difference".
    - 'refund_due': a refund-due item for the organiser in Things to Do.
  - It may also carry ticket, amount_cents, currency and spare_removed.
- Moving to faculty advisor frees their seat. It stays with the delegation as an Open seat (released_allocation_ids).
- Refusal codes (show `error` as written):
  - signed_out, bad_role, not_found, not_organiser, not_member, not_accepted
  - holds_tickets: "Move this leader's tickets to another leader first."
  - last_leader
  - no_account (head delegate needs an account)
  - advisor_closed, duplicate_role
  - ticket_in_review: a ticket is part paid or has a proof in review
- Money, by Christian's rules of 19 Oct:
  - Someone who paid their own ticket: the difference, or a refund-due item.
  - Someone the delegation covered: a spare ticket of the new kind is used first. Otherwise one of the leader's tickets turns into the new kind.
  - Unpaid tickets are always used first, so money only moves when every ticket of that kind is paid. A paid ticket left with nobody on it becomes a refund-due item and stays paid on /pay until the organiser refunds it.
- Advisor Tickets now cover advisors before payment, like Delegate Tickets. This doesn't apply to advisors who hold tickets.
- Delegate <-> head delegate also works here for organisers. Leaders keep delegation_set_head.

## (b) delegation_remove_member(p_application uuid) -> jsonb
An organiser, or a leader of the delegation.
- ok: { ok:true, application_id, society_id (the delegation they left), role, released_allocation_ids }.
- The person stays an applicant and becomes independent; a head delegate becomes a delegate.
- Their seat stays with the delegation as an Open seat.
- Money:
  - The delegation keeps its tickets, which cover the next member.
  - Someone a ticket covered owes their own ticket again, plus the Registration Fee once if the conference charges independents.
  - A ticket they paid themselves stays theirs.
- No email.
- Refusal codes: signed_out, not_found, not_member, not_allowed, not_active, holds_tickets, last_leader.

## (c) Wording: done
- add_pledged_spots: "Only delegation leaders can change the expected size."
- remove_pledged_spot_invoice: "Only Delegate Tickets and Advisor Tickets can be removed."
- money_daily_check: "tickets they bought".

## (d) Templates
All 9 "Pledge Received" templates are renamed "Delegation Spots Paid". MUNBU's own subject and body stay as they wrote them; their conference ended 4 Oct.

## (e) _sync_participant_invoices(uuid)
Internal: not callable by clients. The public sync_participant_invoices now calls it after the same guard, so its behaviour is unchanged. Our two functions use it.

## my_pay_overview currency
totals now also returns:
- paid_cents_in_currency: payments in the conference currency only.
- other_currencies: e.g. ["EUR"], or [].

paid_cents is unchanged. For the leader card, use paid_cents_in_currency, and show "Some payments are in {codes}. They are not included here" when other_currencies is not empty.

## Test-data note
No action needed. It is your private test conference, and no money moved.
