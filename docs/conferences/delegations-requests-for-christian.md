> **Status (20 Oct 2026): all of this is live** (Christian's chat): `organiser_set_member_role`, `delegation_remove_member`, the wording fixes, the 9 renamed templates, `paid_cents_in_currency` / `other_currencies` in `my_pay_overview`, and our three SQL files. Both client switches are on. Contract: his project doc `peter-delegation-functions-live.md`.

# Delegations: requests for Christian's chat

From Peter's delegations rebuild, 20 Oct 2026, after Christian's answers of 19 Oct. Our SQL (`scratch-delegations-part1-people-and-seats.sql`) now holds people and seats only: it writes no invoices, payments, `payment_status`, coverage or ticket numbering, and changes none of the functions on your do-not-move list. Everything below touches money, so it is yours to build with a rollback test. Our screens only call it and show its sentence.

Every function we call answers `{ok: true, ...}` or `{ok: false, code, error}`, where `error` is a plain sentence we can show as written.

## (a) Organiser-only move between delegate and faculty advisor

Your answers 1 to 4: the money moves with the person (A1 for every role), a covered delegate's ticket becomes an Advisor Ticket (B), a leader holding tickets is refused with "Move this leader's tickets to another leader first" (C1), and a spare Advisor Ticket is used first (D), with the same rules in reverse.

Proposed signature, which the organiser's delegation pop-up will call:

```
organiser_set_member_role(p_application uuid, p_role text) returns jsonb
  p_role: 'delegate' | 'faculty-advisor'
  ok:     {ok: true, application_id, role}
  refuse: {ok: false, code, error}, for example
          not_organiser (a leader called it), holds_tickets, last_leader,
          advisor_closed, duplicate_role, not_accepted
```

The people side we would like inside the same transaction, so a role and its seat never disagree:

- Delegate to faculty advisor: their seat becomes an Open seat of the delegation. Our `_delegation_release_seat(p_application, p_society)` does exactly that (person cleared, committee, country and seat kept, `allocation_sent` false; it touches no money). Then `assigned_*` clear and `assigned` goes back to `accepted`.
- Never leave a delegation without an accepted leader with an account. Our `_delegation_leader_count(p_society, p_except)` counts them.
- No Gavelling credit is taken for the move (`app.delegation_role_move`).

Delegate and head delegate keep moving through the live `delegation_set_head`; leaders never get the advisor move.

## (b) Remove a member from a delegation

Organisers and the delegation's leaders (`is_society_leader`). It changes `society_id`, which moves ticket coverage through your triggers, so we do not write it.

```
delegation_remove_member(p_application uuid) returns jsonb
  ok:     {ok: true, application_id, name, released_allocation_ids uuid[]}
  refuse: {ok: false, code, error}, for example
          not_leader, last_leader, holds_tickets
```

- Their seat becomes an Open seat of the delegation through our `_delegation_release_seat`.
- They stay an applicant of the conference (independent, status unchanged), as the organiser's "Remove from delegation" does today. Not the withdraw path.
- Money per your rules: what happens to their own paid ticket, to a ticket the delegation covered, and to the delegation ticket that covered them.
- No email from the function; the client decides whether to queue `removed_from_delegation`.

## (c) "Pledge" in two error sentences

Both are on your list, so only you can change them. Current text, read live on 20 Oct 2026:

- `add_pledged_spots`: `'Only delegation leaders can pledge spots.'`
  Suggested: "Only delegation leaders can change the expected size."
- `remove_pledged_spot_invoice`: `'Only pledged spots and advisor tickets can be removed.'`
  Suggested: "Only Delegate Tickets and Advisor Tickets can be removed."

`money_daily_check` also says "the tickets they pledged", but only Gavelling reads that email. Change it whenever you are in there.

## (d) The `pledge_received` email

Our default copy (`src/lib/defaultEmails.ts`) already says "Delegation spots paid", and the event is listed as Delegation Spots Paid. What still says "pledge" is in the database, written by organisers:

- 9 `email_templates` rows for `pledge_received` are still named "Pledge Received", on these conferences (slugs): `model-united-nations-of-bilkent-university-s7yp8` (MUNBU), `limun-2027`, `oakmun2026`, `handmun`, `kmk2026`, `york-university-model-united-nations-conference-x0gsg`, `justitia-model-united-nations-vo9am`, `dav-airoli-model-interpol-general-assembly-ht707`, `the-canadian-international-school-of-egypt-model-united-nati-pz4n8`.
- MUNBU (`0d09824d-80bd-418e-9bbc-f35cf9ebaa84`) also has the subject "MUNBU WORKSHOP'26 PLEDGE RECEIVED" and a body that says "your pledge to cover delegation spots has been marked as received".
- LIMUN 2027's test row has the subject "Test Email Pledge Received".

Your call whether to rename the template names (likely just our old default name) and whether to ask MUNBU before touching their subject and body. The event key `pledge_received` stays.

## (e) An internal `_sync_participant_invoices`, only if (b) needs it

Your answer 12: the public `sync_participant_invoices` returns quietly when a leader calls it for a member. If `delegation_remove_member` needs to re-sync the removed person, an internal `_sync_participant_invoices(p_application uuid)`, called only after the function's own `is_society_leader` or organiser check, would do it. The public one stays as it is.

## Added 20 Oct 2026 (from the client build)

- **`organiser_set_member_role` should also cover delegate <-> head delegate for organisers.** Nothing on the organiser side moves someone to head delegate today, and `delegation_set_head` is leader-only. The organiser pop-up calls this one function for every role change.
- **Other-currency payments on the leader card.** Answer 6 asks for "Some payments are in {codes}. They are not included here", but `my_pay_overview` sums payments in every currency, so the leader card cannot say that truthfully yet. If you want that line, `my_pay_overview` (or a field beside it) needs to return the totals in the conference currency only plus the other codes.
- **Small client touch on /pay:** `pay/BalanceHeader.tsx` now exports its `itemsCurrency` helper so the leader card shows the same currency as /pay. No behaviour change.
- **Test data note:** on the private test conference `gavelling-test-mun-2027` (Peter's, credits sponsored) a setup script reset `applications.payment_status` directly from the free-registration "paid" to "unpaid" before the mock fees were added. No money moved; it is against your "payments are the truth" rule, so say if you want those rows re-derived another way.

## 20 Oct, round 2

### (a) Removing a member: the SQL is ready for you

`scratch-delegations-remove-member.sql` (repo root) is written for your chat to read, test and apply. It needs part 1 applied first (it calls `_delegation_release_seat` and `_delegation_leader_count`).

- `delegation_remove_member(p_application uuid) returns jsonb`: an accepted leader of the member's delegation or an organiser. Refuses `last_leader` and `holds_tickets` ("Move this leader's tickets to another leader first.", your C1). The seat becomes an Open seat of the delegation, `society_id` becomes null, `assigned` goes back to `accepted`, and the person stays an applicant. It writes no invoice, payment, `payment_status` or coverage itself.
- The header lists exactly what your live triggers do when `society_id` changes (`zz_app_society_changed`, `zz_applications_pledge_coverage`, the audit and credit triggers), so you can check them.
- **One gap to decide:** the removed member's own role fee, when it was waived as "Covered by your delegation", is not reopened. `apply_pledge_coverage_society` only loops over people still in the old delegation, and the call for the new society (null) does nothing. So one ticket ends up covering two people: the removed member and the next member it moves to. Our rule is that money paid by the delegation stays with the delegation, so we think the removed member should owe their own fee again. That change is in your functions, so we have not made it.
- The same file adds `organiser_set_head(p_application uuid, p_head boolean) returns jsonb`. It is the live `delegation_set_head` with an organiser check (`is_conference_organizer`) instead of a leader check, and it moves only between delegate and head delegate. The money happens exactly as today through your `zz_app_role_switched` trigger, and no credit is taken (`app.delegation_role_move`). It keeps the last-leader rule and adds `holds_tickets` on a demotion. The live `delegation_set_head` has neither check, so please confirm both. This is the delegate <-> head delegate part of the earlier request for `organiser_set_member_role`. The delegate <-> faculty advisor move is still yours.
- A rolled-back verification block runs at the end of the file.

### (b) Leaders choosing which member a Delegate Ticket covers

Today coverage is automatic: a delegation's tickets cover the earliest members to join (your answer 10, `pledge_covered_application_ids`). Leaders have asked to choose which member a paid Delegate Ticket covers. Two questions:

- May a leader assign a ticket to a specific member?
- If so, how? For example, a pinned `covered_application_id` on the `pledge_spot` invoice that `pledge_covered_application_ids` honours before the join order, or a leader-only function that swaps coverage between two members.

Nothing on our side calls anything for this until you decide.

### (c) Expected size never below the delegates in the delegation

The leader card now stops the minus button at the number of delegates already in the delegation. `remove_pledged_spot_invoice` (the X on /pay) can still go below it: it voids any open, unpaid `pledge_spot` and lowers `spots_pledged` with no check against the members. Please refuse it on the server when the delegation's expected size (your answer 5: the leaders' `spots_pledged` plus one for each head delegate) would drop below the number of delegates and head delegates in the delegation who are not rejected or withdrawn. A sentence we can show: "Your delegation already has {n} delegates. Remove a delegate first."

## 21 Oct, round 3

### Organisers adding an individual delegate to a delegation

Peter asked for a "+" in the organiser's delegation pop-up that adds an accepted individual delegate (someone who applied on their own, `society_id` null) to the delegation. The client is built and waits behind `ORGANISER_ADD_TO_DELEGATION_DB = false` (`manage/[slug]/applications/delegations/v2.ts`); nothing calls the function until you say it is live.

What we ask for: `organiser_add_to_delegation(p_application uuid, p_society uuid) returns jsonb`, organisers of the conference only, answering `{ ok, code, error }` with a sentence we show as given.

- The person must be an accepted (or assigned) delegate of the same conference with no delegation yet. Head delegates and faculty advisors are not added this way.
- **Peter's rule: the individual's registration fee must not carry over to the delegation.** What the person already paid, or still owes, on their own application stays theirs: it is never counted as the delegation's money, never moved onto a leader's invoices, and never turned into a Delegate Ticket. The delegation's own registration fee (the per-delegation line) is not charged to them either.
- Your call how their own role fee works from there. Our guess: if they already paid it, they keep their paid spot and the delegation's tickets keep covering the others; if they have not paid, the delegation's tickets may cover them the usual way (`pledge_covered_application_ids`).
- If they hold an allocation, it stays theirs and is not turned into an open seat of the delegation.
- Refusals we expect: `not_organiser`, `not_individual` (already in a delegation), `wrong_role`, `wrong_conference`, `not_accepted`, and the seat limit if you think it applies.
