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

Taste board: https://claude.ai/artifact/CAVUg2YLKyTj5Y6yuVmLup
