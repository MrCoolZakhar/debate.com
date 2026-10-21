# Delegations rebuild

Owner: Peter, 19 Oct 2026. The decisions below came out of a Q&A before the rebuild. The order: taste board first, then every phase (roles and management, seats and allocations, the organiser tab and pop-up, the new design).

## Who is in a delegation

- Head delegates and faculty advisors are the **leaders**. A delegation can have several of each.
- Every leader has exactly the same powers: add and remove people (another leader included, an advisor included), share the invite link, change roles, reallocate within the delegation, pay, submit position papers for members, see every member's documents and study guides.
- Leaders move roles freely, delegate to head delegate to faculty advisor and back. This replaces the old owner rule "delegate and faculty advisor never swap".
  - A delegate moved to faculty advisor: the delegate spot they held stays with the delegation as a paid spot, now free for someone else (when it was paid). They owe the faculty advisor fee if they have not paid it.
- Nobody can remove the last leader.
- A head delegate sits in a committee; a faculty advisor never does.
- **Only a head delegate or a faculty advisor creates a delegation.** The organiser cannot.
- No portal: everything is managed on the delegation card, per conference.

## Joining and leaving

- The invite link lets people straight in; they still answer the normal application questions.
- Removing someone (rare): the seat goes back to the delegation as Open. Money stays with whoever paid it: paid by the delegate, it stays with the delegate; paid by the delegation, it stays with the delegation.

## Expected size

- "Pledged" is renamed **Expected size** everywhere (it does not say "delegates"), including the conference page questions. Leaders change it at any time.
- It is a recommendation only; nothing blocks at the number. Leaders can pay for spots in one go or each member pays their own. Adding spots is one tap; removing an unpaid spot is instant; removing a paid one asks the organiser for a refund.

## Allocations

- The organiser gives the delegation seats (country + committee) whether or not people have joined yet; leaders place their people into those seats; an empty seat shows as Open. (WorldMUN case: one head delegate, 15 paid spots, the organiser can allocate 15 seats.)
- Settings → Delegations: how many seats an organiser can give ("Up to paid spots", "Up to expected size", "No limit"; default No limit). The overview always shows allocated, paid and joined.
- A double delegation is two delegates attending: two allocations, two delegate fees.
- Settings → Delegations: whether leaders may reshuffle their own people across their seats, and a deadline until when they can. Swaps with another delegation need the organiser.
- Most delegations are a mix of countries; some (WorldMUN) are mostly one country, with 2 or 3 countries when the delegation is larger than the number of committees. Offer a "same country everywhere" shortcut.

## What delegates see

- Their committee (country + name of everyone in it), once the organiser publishes allocations.
- Their delegation: who is in it and their committees. Only leaders see payments and other members' papers.
- A leader may submit a paper for a delegate; the delegate can still replace it; the latest upload wins.

## Organiser side

- Delegations is a separate tab inside Applications, not its own Manage section.
- Clicking a delegation anywhere (Applications, Assignment, Financials) opens one pop-up: People, Seats, Payments, Documents. Second steps replace the content in place.

## Design

- Move away from the forest-gradient icon tiles and the Fluent 3D emoji, toward our own drawn Gavelling icon set (reference: MyMUN). Start on Delegations, then roll it out.

## What exists today (mapped 19 Oct 2026, read only)

- A delegation is a `societies` row; membership is `applications.society_id`. Leaders are `is_society_leader` (accepted head delegate or advisor). "Pledge" is `applications.spots_pledged` / `advisors_pledged` / `pledge_type`, plus `societies.spots_purchased`.
- **Block seats already exist**: a `conference_allocations` row with `society_id` and no person. They are the "Open seat" of this rebuild. Today they are reachable only from the Assignment rail toggle (`SocietyDropAllocateModal`), never show on the leader card (`my_delegation_roster` joins on `application_id`), and nothing calls `delegation_assign_seat`, so leaders cannot fill them. That, not a cap, is the WorldMUN blocker; the delegation screens also count accepted members (`delegationRows.ts`, `DelegationsBoard.tsx`).
- Unused RPCs: `delegation_portal_overview`, `delegation_transfer_head`, `delegation_promote_to_advisor` (head delegate only today), `delegation_assign_seat`.
- `perform_delegation_swap` already honours `conferences.allocation_swap_mode` (`self_serve` lets leaders swap): the reshuffle setting builds on it, plus a deadline.
- Delegates see their delegation's names and roles (`my_delegation_roster`) and only their double-delegation partner in the committee (`CoDelegateCard`). A committee list is new.
- Leader card: `participant/DelegationPanel.tsx`. Organiser: `applications/DelegationsBoard.tsx` (in Applications), `assignment/DelegationsView.tsx`.
- "Pledge" copy: `pay/payPanels.tsx`, `DelegationPanel.tsx`, `DelegationsBoard.tsx`, `DelegationsView.tsx`, `applications/page.tsx:4311`, `settings/delegationsUi.tsx`, `financials/shared.tsx`, `ApplicantsDial.tsx`, the emails (`defaultEmails.ts`, `emailEvents.ts`, `emailCard.ts`) and two database error strings.

## The database side (20 Oct 2026, after Christian's answers)

Christian's answers are in `delegations-money-answers.md`. Two owner decisions on 20 Oct: only organisers move someone between delegate and faculty advisor (the money moves with the person, built in Christian's chat), and the apply step keeps Christian's question "How many delegates will your delegation have?" with "besides you" for a head delegate.

- `scratch-delegations-part1-people-and-seats.sql`: seats and reads only (settings columns, open seats, place and take out of a seat, organiser seat grants with the seat limit, committee roster, member seats, leader papers, study guides, chair names). Writes no invoice, payment or coverage. APPLIED 20 Oct 2026; client flag `DELEGATIONS_V2_DB` is on.
- `delegations-requests-for-christian.md`: what Christian's chat builds (removing a member, the organiser's delegate / advisor move, the "pledge" wording inside their functions). Client flag `DELEGATIONS_MONEY_DB` for the screens that call them.
- `scratch-delegations-rebuild.sql` is the superseded single draft; never apply it.

Taste board: https://claude.ai/artifact/CAVUg2YLKyTj5Y6yuVmLup

## Taste board votes (19 Oct 2026)

- Leader's card: **1A, the roster** ("definitely 1A is the best"), with bigger person circles, round crests, cards that lift like Airbnb, a Financials section (fees paid by kind, members who owe, left to pay, Pay / Add or remove spots / Receipts) and every open seat listed in columns (flag + country, committee logo + name, no invite links).
- Organiser: **2B, the table with meters** ("love this honestly"), names larger.
- Every country shows its flag and every committee its logo, everywhere. Clicking a member's committee opens that committee (its roster of countries and names).
- The leader's card lives in the conference page's **You** view (`ConferenceDetailClient` switcher Overview / You / Reviews → `ParticipantView`'s left sub-nav → the Delegation section), never a page of its own.
- The delegation pop-up's People tab (3B) stays as drawn. The Seats tab (3A) is one-tap: the progress of paid spots seated, ONE suggested set of countries that fits exactly, then countries with their free committees and "Give N", plus a link to the allocation page.
- The allocation page (3C): pick a delegation on the left (each shows paid spots still needing a seat), tap free seats in a countries × committees grid, "Give row" fills a country, tapping again takes a seat back; double seats count as 2.
- Icons: direction **A, fine line, bare ink** (owner: "continue using A"). No tiles, no gradients, no 3D emoji on these screens.
- A delegate's You page (phone, 5A / 5B): Committee = the committee logo, your country, the topics, the chairs, study guide and position paper cards, then the full committee list with your delegation tinted; Delegation = crest and counts, your leaders, who is where grouped by committee, study guides for every committee in the delegation, and whether your fee is covered.

## Round 3 (Peter, 21 Oct 2026)

- **Words.** Leaders and organisers read "allocation", never "seat", where it means an allocation: "Take out of seat" is **Unallocate** ("Their allocation stays with the delegation as an open allocation"), "Place in a seat" is Allocate, "Open seats" is Open allocations, "Give seats" is Give allocations. "Seat 1 / Seat 2" stays only for a double delegation. Member-only screens (`MemberDelegationCard.tsx`) still say "No seat yet".
- **Leader card.** Open allocations is a compact list under Financials (flag + country, committee logo + acronym, A to Z by committee); Swap allocations sits beside "Search people"; the delegation name is 36px bold.
- **Leader Overview** (replaced in Round 5 by `overview/DelegationOverview.tsx`): the next step line, recap tiles (allocations filled, open allocations, position papers submitted, tickets paid counted like the Financials card), Deadlines in date order with relative words (conference dates, each committee's `position_paper_deadline` and `study_guides_publish_at`; no payment due dates, `my_pay_overview` has none), Needs your attention, and a head delegate's own seat card.
- **Organiser live view.** `conference_allocations` is not in Realtime, so the Delegations tab, the delegation pop-up, Give allocations and the assignment Delegations view re-read quietly every 10 s while visible and on focus (`applications/delegations/useLiveRefresh.ts`), skipping a tick while a local write or an open confirm is pending (`trackWrite`, `holdLive`). A member a leader removes disappears from the Applications-fed list only when that page reloads its applications.
- **Organiser People tab.** A three-dots menu per person (`OrganiserMemberMenu.tsx`): Make head delegate / Make faculty advisor / Make delegate (`organiser_set_member_role`, its sentence shown as given; the advisor move confirms in place that the ticket follows the person), Unallocate, Remove from delegation (`delegation_remove_member`). "Add a person" (`AddPersonStep.tsx`, individual applicants) waits behind `ORGANISER_ADD_TO_DELEGATION_DB = false` for Christian's `organiser_add_to_delegation` (requested in `delegations-requests-for-christian.md`, round 3: an individual's registration fee never carries over to the delegation).
- **Organiser Allocations tab** (`SeatsTab.tsx`, replaces the 3A suggestion card): search first; every country that is a slot in any committee, A to Z; per country one chip per committee seat (free: one tap gives it; this delegation's: take back in place when empty, else the person's name; taken: greyed with who holds it); "Give in all free committees"; the delegation's allocations listed on the left with Take back.
- **Notifications** (`components/notifications/AppNotifyPills.tsx`): outcome messages are a liquid glass pill rising from the bottom centre, up to 3 stacked, on every page except the session runtime, whose cards are unchanged.

## Round 4 (Peter, 21 Oct 2026)

- **Landing.** Opening a conference page takes anyone with a live application (organisers who applied included) to the You view; a URL tab param or a clicked tab wins; a per-user hint avoids the Overview flash on repeat visits (`ConferenceDetailClient.tsx`).
- **Leader Overview.** A head delegate's "Your Seat" first, then the next step (the payment reminder), four small recap tiles, "Add delegate", and ONE Deadlines card (conference dates plus at most the next two dates). No "Needs Your Attention".
- **Add delegate** (`overview/AddDelegatePanel.tsx`): the invite link with Copy, and, only when `conferences.allow_delegation_import` is on, name + email (+ head delegate when offered) confirmed in place, then `leader_import_delegates` with one row: a `submitted` application in the delegation and an invite email. Leaders see the new person in the Delegation section's imports; the organiser sees a submitted application.
- **Leader table.** The paper cell is empty without an allocation and an Upload icon when allocated without a paper; the seat cell has no unallocate button (Unallocate lives in the three dots, also on the organiser side); Swap allocations opens its picker where the button is.
- **Committee pop-up** (`committee/committeeSlots.ts`): every country slot of the committee A to Z, holder or Open, this delegation tinted, the viewer's own row "You". Limit: `my_committee_roster` returns only SENT allocations, with no avatar or user id, so unsent slots of other delegations read "Taken" and names get initials; showing photos needs `avatar_url` from that function (owners' chat).
- **Organiser pop-up.** Crest, name and flag lead; city and country small; Expected / Joined / Paid a quiet row. People payment words from each person's OWN bills (tickets they bought excluded): "Owes X fee", "Waived", "Covered by delegation" (+ "Ticket not paid yet"), "Paid", "Nothing due yet". The People tab's "Open allocations" section is gone. The Allocations sidebar lists allocations A to Z by country, wider, bigger flags, avatars, no "Open allocation" text.
- **Allocation page.** Suggestion cards wrap reason tags under the committee instead of squeezing it; every committee logo goes through `CommitteeLogo` (preset emblem or the UN mark). Delegation concentration is -20, and zero once the delegation holds an allocation in at least 70% of the committees that have seats.

## Round 5 (Peter, 21 Oct 2026)

- **Swap allocations** (`delegation/PeopleTable.tsx` owns it): pressing it changes nothing on the card; the button becomes Cancel in the same place (Escape works too) with a short hint on the People title's line; two people with an allocation are picked anywhere on their row (the allocation cell included) and the swap runs on the second pick with no confirm (`switchSeats`, optimistic). When the conference approves swaps the second pick files the `swap_request` as before; the open request is one line under the table.
- **No swap notices.** A self-serve swap inserts no `swap_notice` row any more and the leader card shows no "swapped allocations on ..." line; the `delegation_swap` email to the two delegates is unchanged.
- **Live Overview.** Every landed change on the leader card (allocate, unallocate, swap, move, paper upload, role change, import) fires `gv-delegation-changed` (`delegation/delegationEvents.ts`); the Overview re-reads in place. Its own read includes the viewer's allocation (the page's `myAllocation` query), so a leader who allocates themselves sees Your Seat at once.
- **One Overview for everyone in a delegation** (`overview/DelegationOverview.tsx`, `useDelegationOverview.ts`, `SeatCard.tsx`, `OverviewCards.tsx`): the next step, then two columns from 760px of content width: left Your Seat (the big flag on a tall card like the old allocation card, the committee logo and name, the study guide, the payment from `my_open_balances` with Pay now or Paid) with the position paper card (the existing upload and deadline) under it; an advisor gets their delegation's committees and their payment instead. Right: Your Delegation (crest, name, city and country with the flag, leaders with photos, delegates and committees counted). Under the columns a leader's position papers (N of M, who is still to hand in) and, for everyone, Deadlines: every date ahead in order with relative words (conference, papers, study guides, payment due dates from `my_open_balances`).
- **Removed from Overview:** the allocations filled, open allocations and tickets paid tiles, and Add delegate, which now sits right under the People table in the Delegation section.


## Round 6 (Peter, 21 Oct 2026)

- **Leader side.** "Add a member" (under the People table) opens the Import delegates pop-up (roles as `import_roles` allows, faculty advisor included when that role is on), else the invite link. Overview has no next-step line; Your Seat shows the study guide and position paper as two tiles on one line; Your Delegation shows papers N of M, payments (`my_pay_overview`) and the next 3 dates. The Committee section is only the committee's country list (shared with the pop-up), with a Paper link per submitted paper; committee-wide reading waits for `scratch-committee-position-papers.sql` (`COMMITTEE_PAPERS_DB`).
- **Organiser side.** The Delegations list is full-width rows again; payment words "Paid by delegation" / "Delegation hasn't paid yet"; a person's Allocate step lists every allocation A to Z (duplicates as separate rows); the Allocations tab has a draggable divider (`gavelling-dlg-alloc-left`) and a 22px red minus on the card corner. Applications rows are about four lines (`applications/RowDelegation.tsx`).
- **Allocation emails.** Assignment's confirm pop-up shows only before an organiser's first emailed allocation ("Assign and email", "Don't show this again", "Send allocation emails manually instead"). A 3-minute buffer and the hide-until-sent database fixes wait for `scratch-allocation-email-buffer.sql`; the email to leaders after 15 quiet minutes waits for `scratch-delegation-allocation-email.sql`. My conferences shows a delegate's country only from a sent allocation.
- **Assignment page.** Pointer-based drag (mouse, pen, touch grip) onto committees, seats, between seats and back to the list; the unassigned list is sticky with a preference filter. Three redesign proposals: `docs/proposals/assignment-redesign.html`.

## Round 7: the new seat board (Peter, 21 Oct 2026)

- Delegates mode of /manage/<slug>/assignment opens on the seat board (`SeatBoard.tsx`, design on the Assignment Taste Board, "Final Direction"): left, waiting people oldest accepted first (`decided_at`, else submitted) with filters and People / Delegations tabs; middle (the only scrolling column), the suggested seats feed, or the opened person with preferences and best three seats ("Back to suggestions"; after an assignment it returns to suggestions); right, committees as ring tiles whose pop-up (`SeatBoardPopup.tsx`) lists every country A to Z with the best waiting people per open seat, or, with a person open, "Seat <Name> in <Committee>" ranked by fit. Drag a person onto a ring to open that pop-up. "Classic view" keeps the old board. The fit engine is `src/lib/assignmentFit.ts` (pure, shared).
- Delegations tab (`SeatBoardDelegations.tsx`, `SeatBoardGivePopup.tsx`): One country (every committee where it is free), Best seat in each room (`rankSeatsForSociety`), and Custom (default: a committee pop-up where each tap gives a country and stays open, with Undo and a tally). Writes through `giveExactSeats` / `takeBackOneSeat`. Known limit: undoing a double whose first seat was already held takes back both seats.
- The Applications applicant pop-up shows Best Seats (`applications/ApplicantBestSeats.tsx`): preferences and the best three seats; Assign opens the seat board with that person (`?person=<id>`).

## Round 8: the delegate and leader view (Peter, 21 Oct 2026)

- **Flags.** Every flag on the participant screens is round (`CircleFlag`); Your Seat's big flag was a rectangle (`FlagImg`), so was the old `AllocationCard`.
- **Your Seat** (`overview/SeatCard.tsx`): the round flag and the country beside it, the committee under the name, then the committee's topics numbered 1 to 3 whenever `conference_committees.topics` has any (the data was always read by the page; the card never drew it), then the study guide and the position paper as one-row tiles with ONE big button to the right of the text (Open, Upload, Submitted), then the payment.
- **Your Delegation** (`overview/OverviewCards.tsx`): the name 28px; the leaders float in one line under it (small avatars + names, faculty advisors first); counts; a leader's papers and payments; Coming up as one line per date. Both cards stretch to the same height (`items-stretch`, `OVERVIEW_CARD`) and are trimmed to fit one screen at 1280x800; stacked and tighter on phones.
- **Phones.** The People table below 760px of card width is one compact row per person: avatar, name with a role icon, the allocation as a small round flag + country + committee acronym, the paper as an icon, the three-dots menu (Allocate and Unallocate live there). Open Allocations is a title with its count and a tight list. The member card has the leaders inline in its header instead of a Your Leaders card.
- **Committee section and pop-up** (`CommitteeMatrix`): countries 17px, names 16px, 36px flags; every avatar with a known user id opens the person's public MUN CV (`CvAvatar`, `leaderKit.tsx`). Own delegation members carry `user_id` (the leader's applications read; for a member, `applications` gives their own row and the leaders'); everyone else in a committee waits for `user_id` and `avatar_url` from `my_committee_roster`, drafted in `scratch-committee-roster-avatars.sql` (the client already reads both when present).
- **Documents.** Position paper | Study guide side by side; the paper card has no expand button: deadline, status, a big "Click to select PDF" area that also takes a dropped file, "Submit position paper"; each study guide has Open.
- **Order.** People in a delegation are listed faculty advisors first, then head delegates, then delegates (`roleRank`), on the People table, the member card and the Overview.

## Round 9: seat board polish (Peter, 21 Oct 2026)

- People rows are only the name (big) and the delegation; filters Delegation and Level plus a sort control (Accepted oldest first by default, Name, 1st choice). Suggested seats are gold cards with bigger flags and names; reason pills: gold star = their choice, green plus = bonus, red minus = penalty. The opened person shows level top right and preferences as a list of four per column.
- The committee pop-up is a dense list of the classic board's double pills, open seats first (replaces the A to Z list in Round 7), each open seat with its best waiting person and a ranked list on the chevron.
- Delegations tab: only accepted delegations whose allocations are fewer than the larger of paid tickets and accepted delegates ("N more"), a "Show all delegations" toggle, one card (header, Given as compact pills, Give more with the three modes). Organiser gives run through a per-delegation write queue, so quick clicks never revert.
- Delegation names split by `src/lib/delegationName.ts` (DelegationNameLines); members always ordered faculty advisors, head delegates, delegates (`delegations/memberOrder.ts`).
- The test conference has a crisis committee (JCC, 12 characters) for checking character seats.

## Round 10 (Peter, 21 Oct 2026)

- Head delegate: Your Seat has the round flag centred (100px), country, then committee and topics; the study guide and paper tiles side by side with a quiet icon action; Your Delegation shows leaders at the top right, no "You"; the invite link is one line; the Committee section has topics in a second column.
- Organiser: setup priority rows wrap instead of truncating; recent activity shows round flags and committee emblems; at most two leaders per delegation through `shownLeaders` (creator always included, `societies.created_by`); the Allocations tab lists real countries, then custom and character seats, and hides fully given countries unless searched.
- Seat board (supersedes Round 9's gold cards and pop-up): "Smart Allocations" white cards with a gold top edge and score disc, one badge per scoring reason with its points and an inline "How this scores" breakdown; people rows show level and accepted date; the opened person shows a large level badge and where they are from; up to 8 choice bubbles around each committee ring; the committee pop-up lists every seat A to Z (Open filter, importance, holder and delegation) with the ring half outside the pop-up, and best-fit delegates only after clicking a seat. The delegations give pop-up matches it; doubles show both holders side by side; Given is a two-column grid.
