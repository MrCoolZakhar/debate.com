# Delegations, redesigned

Status: implemented on `feature/conferences-auth` (21 Sep 2026), see "What shipped" at the end.
Owner's brief: "Redesign the entire rationale of delegations. Currently it's heavily broken. It's
not visible nicely at all, it's not functional, it barely survives. Move delegations into
applications. A list view, similar to applications, with an icon like mymun does."

Owner's decision (21 Sep 2026): delegations get **their own list** inside Applications, behind a
`People | Delegations` switch, with their own rows, filters and counts. They never share rows with
individual applications. The people list stays people only. The unified mixed queue is rejected.

---

## 1. What mymun does well (from `docs/competitive-mymun.md`)

1. **A delegation is a unit of work, not a label on a person.** mymun shows a delegation as one row
   carrying institution, city, country, "N Expected", "N Registered", "£X Paid", one Accept / Reject
   and a "Show Allocations and Members" expander. 74 delegations are 74 decisions, not 700
   (`competitive-mymun.md:14`).
2. **Expected vs registered is the headline.** A school says it will bring 12; the organiser cares
   how many of the 12 have actually turned up in the system. mymun puts both numbers side by side.
3. **Money per delegation.** "£X Paid" on the row answers the reconciliation question for the one
   person who is actually paying (the school), without opening anything.
4. **One decision for the group.** Accept / Reject on the delegation row, not per member.
5. **An icon tells the row type at a glance.** A group glyph marks a delegation, so it is never
   mistaken for a person.
6. **Allocations are one click away.** The expander shows who is in which committee.

What mymun does badly, and we deliberately do not copy: the unified queue mixes chairs, whole
delegations and individual delegates in one list (owner rejected this for Gavelling), and its
"1/1 Members Paid" fraction is an access flag dressed up as money. Gavelling already knows more
(payment provenance, the payments ledger, double delegations, block allocation) and should say it.

## 2. How delegations work today, end to end

### Data model (verified against the live schema, project `luruhkwrgisytejswlas`)

| Thing | Where | Notes |
|---|---|---|
| A delegation | `societies (id, conference_id, name, name_normalized, head_delegate_limit, advisor_user_id, spots_purchased, advisor_spots_purchased, payment_status, created_at)` | One row per conference; the same school at two conferences is two unrelated rows. **No city, country, logo or institution type.** |
| Membership | `applications.society_id` | `is_independent` is a derived mirror, never read for logic (`delegationShared.tsx:417-421`). |
| Head delegate | `applications.is_head_delegate`, written only as `role = 'head-delegate'` (`ConferenceApplyClient.tsx:2823`, `:3037`, `import/page.tsx:409`) | No screen can promote or demote one. |
| Pledge | `applications.pledge_type = 'delegation'`, `spots_pledged`, `advisors_pledged`, `pledge_confirmed_at` on the leader's application | Stated on the apply flow's "Paying for delegation spots?" step. |
| Pledged spots as money | `invoices.kind = 'pledge_spot' / 'advisor_spot'`, `society_id` AND `application_id` (the leader) set | Created by `add_pledged_spots` on `/pay` (`pay/page.tsx:1152-1188`). Live: 437 pledge_spot + 32 advisor_spot invoices. |
| Per-delegation fees | `invoices.kind = 'app_fee'` with `society_id` | 71 live rows. |
| Spot pool | `societies.spots_purchased` / `advisor_spots_purchased` | Mixes confirmed pledges AND +1 per self-funded member (`applications/page.tsx:3374-3378`, `settle_invoice_effects`). |
| Filling spots | `fillFreeSpots` (`delegationShared.tsx:58-110`), and the same loop inside `settle_invoice_effects` and `cover_pledge_spot` in SQL | Promotes the oldest accepted unpaid members to `payment_status = 'paid', self_paid = false`. |
| Invite links | `delegation_invites (token, society_id, conference_id, created_by, expires_at)`, RLS `is_society_leader` | Leader-only, from `/delegation/[societyId]` (`DelegationPortalClient.tsx:413-441`); resolves at `/invites/delegation/[token]`. |
| Stale column | `societies.payment_status` | 'unpaid' on every row of every conference checked; nothing reads it for a decision. |

RLS on `societies`: organisers read and update (`is_conference_organizer`), members read their own,
authenticated users insert. There is no organiser INSERT/DELETE path in the UI.

### Surfaces

- **Assignment → DELEGATIONS tab** (`assignment/page.tsx:4699-4721`, `:5201`, `DelegationsView.tsx`).
  The only real delegation screen. A card grid; each card opens to advisors, head delegates, pledges
  with MARK RECEIVED, add-by-search, drag-to-swap spots, waived and not-attending lists, delete when
  empty. Loads only `accepted` / `assigned` members (`DelegationsView.tsx:229`), so a delegation
  whose members are still pending looks empty. The tab is `useState` only (`:3538`), so nothing can
  link to it, and the manage rail has no Delegations entry (`manage/[slug]/layout.tsx:193-235`).
- **Assignment → delegates mode** has a DELEGATIONS rail to drop a whole country on a delegation
  (`SocietyDropAllocateModal` `:1782-1831`, `applyLocalSocietyAllocation` `:3893-3925`). This is the
  one delegation feature that is genuinely better than mymun and it stays.
- **Applications**: the delegation name on a person row (`applications/page.tsx:4374-4391`) opened a
  read-only popup of members (`:5890-6000`) with "N members · N allocated" and nothing else: no
  money, no pending count, no action but opening a member.
- **Dashboard**: a count of distinct `society_id` across ALL applications including rejected and
  withdrawn (`manage/[slug]/page.tsx:1347`), and outstanding pledged spots (`:1352`). No link.
- **Financials → Invoices**: a delegation filter keyed on the member's delegation NAME, so invoices
  owned by the delegation show as "Independent" and same-named delegations merge
  (`financials/invoices/page.tsx:520-552`).
- **Communications**: a delegation filter that hides empty delegations (`communications/page.tsx:2216-2230`).
- **Participant side**: `DelegationPanel.tsx`, `DelegationPlacard.tsx`, `DelegationCreditsCard.tsx`,
  `PledgeInvoicingCard.tsx` (now only delegation aid, `:3-8`), and the leader portal
  `/delegation/[societyId]`. **`/conferences/[slug]/delegation/[societyId]` does not exist**; the only
  delegation route is `/delegation/[societyId]`, leaders only.

### What is broken or invisible (verified)

Visibility
1. There is no list of delegations an organiser can scan. The only one is a card grid hidden in a
   tab of Assignment, which is the wrong page (deciding and chasing money is not allocating).
2. Pending members and pending pledges are invisible there (`DelegationsView.tsx:229`, `:44`).
3. No money per delegation anywhere. The per-application ledger (`conference_money_summary(detail)`)
   counts only invoices in a person's own name, so delegation-owned invoices vanish.
4. Nothing links to the delegation screen; the tab cannot be deep linked.

Missing actions: accept all, reject all, message the delegation, remind it to pay, create, rename,
change head delegate, edit spot counts.

Money and spots (bugs, each checked in code or SQL)
5. **Pledges can be granted twice.** Settling a `pledge_spot` invoice already adds a spot and stamps
   `pledge_confirmed_at` (`settle_invoice_effects`, `cover_pledge_spot`, verified in the live
   function bodies); MARK RECEIVED (`DelegationsView.tsx:411-478`) adds `spots_pledged` again and
   ignores invoices. `pledgeSatisfied` looks only at `pledge_confirmed_at`.
6. **Mark unpaid always removes a spot**, even for a member the pool covered
   (`applications/page.tsx:3444-3451`, no `self_paid` check). Fixed in this change.
7. MARK RECEIVED ignores `advisors_pledged`.
8. Undo "not attending" forces `payment_status = 'unpaid'` (`delegationShared.tsx:361`).
9. A swap forces `self_paid = false` on both people (`delegationShared.tsx:266-269`).
10. Every spot-count change is a read-then-write from the browser (lost updates under concurrency).
11. Freed spots are not refilled on remove / withdraw / reject / not attending.
12. Live evidence of double recording: at Stonehill ISMUN the organiser settled 30 pledge-spot
    invoices AND 61 member role fees for the same school (offline, 66,000 + 134,200), so the ledger
    says the school paid for 91 places for 61 people. The new row shows both as money received
    offline, honestly; it is the organiser's record, not a computation error.

12b. Live evidence of an orphaned pledge (audit item: withdrawing a leader clears their
    `society_id` but not their invoices): at Stonehill, Legacy School Bangalore still carries 20 open
    `pledge_spot` invoices (44,000) owned by a WITHDRAWN faculty advisor. They count as due nowhere
    (the owner is not accepted, CLAUDE.md §3), which is right, but nobody is told they exist.

Numbers that disagree
13. Head delegate is defined three ways (`DelegationsView.tsx:23-25` vs `DelegateParticipant.tsx:50`
    vs `DelegationPortalClient.tsx:481`).
14. "Paid Spots" on the card is really `spots_purchased`, which includes self-funded +1s.
15. Dashboard count includes dead applications and misses empty delegations.

## 3. The new rationale

**A delegation is the school's account at this conference.** It has:

- **an identity**: a name and a leader (the head delegate, or the faculty advisor);
- **a promise**: how many it said it would bring (the pledge), and how many places the organiser has
  confirmed as paid for (`spots_purchased`);
- **people**: members who have registered (applied), of whom some are waiting on a decision, some
  accepted, some allocated;
- **money**: what it has paid (the payments ledger, split Stripe vs offline) and what it still owes
  (open balances of accepted members and of the pledge invoices on its leader);
- **seats**: allocation progress of its members who take a seat.

**What the organiser decides about a delegation**

1. Let its people in: accept (or reject) the pending members, as a group.
2. Chase it: message the whole delegation, or remind the ones who owe money to pay.
3. Seat it: open it in Assignment, where block allocation already works.
4. Tidy it: take a member out of the delegation (their paid spot rules are unchanged).

**Lifecycle**

`forming` (a leader applied; drafts name the delegation) → `registering` (members apply; the row
shows pending) → `accepted` (nobody pending) → `paying` (money due) → `settled` (nothing due) →
`seated` (every accepted seat-taking member allocated). These are derived states, never stored:
they are views of the same numbers the row prints, so they cannot drift.

**Definitions used on the row** (`src/app/manage/[slug]/applications/delegationRows.ts`)

| Figure | Definition |
|---|---|
| Expected | Live pledges (delegate spots + advisor tickets); if no pledge, the confirmed spots (`spots_purchased + advisor_spots_purchased`); if neither, "No pledge". |
| Registered | Members in submitted / accepted / assigned / checked-in and attending. |
| Pending | Members still `submitted` and attending. |
| Accepted | Accepted / assigned / checked-in and attending. |
| Allocated | Of accepted delegates and head delegates, those with a committee. |
| Paid | Succeeded payments on the delegation's invoices (those with its `society_id`, plus every invoice in a member's name, de-duplicated). Stripe shown as paid, manual shown apart as "offline". Never added together (CLAUDE.md §3). |
| Due | Open / partial balances whose owner application is accepted or beyond, the same rule as `conference_money_summary().outstanding`. Conference currency only; a row with another currency says so. |
| Country | The most common nationality among live members, labelled as such. The database stores no country for a delegation. |

## 4. The UI

### Switch, not mixed rows (owner's decision, and the right one)

`People | Delegations` sits above the stat tiles. Reasons beyond the owner's call: a person and a
delegation are different decisions with different numbers (money due to a school vs one fee); mixed
rows would either duplicate every member (once as a person, once inside the delegation) or hide
them from the people list, and the people list's selection, bulk bar and optimistic-patch ledger
are all built on one row = one application. The Delegations tab carries a count of delegations
with people waiting, so the "inbox to zero" signal mymun gets from one queue is still there.

Deep link: `/manage/[slug]/applications?view=delegations` (and `&delegation=<id>` to open one).

### The Delegations list

Own counts at the top (plain numbers, no pills): Delegations, Expected, Registered, Waiting on you,
Owe money. Own filters: **To decide | To allocate | Any** and **Owes money | Paid up | Any**,
plus the page's search box (delegation name, leader, member names).

Each row:
- a group icon disc (Lucide `UsersRound`) with the members' most common nationality as a round flag
  on its corner (circle flag rule);
- the name, then the leader ("Head delegate: X", or "Faculty advisor: X" when an advisor founded
  it; "No head delegate yet" otherwise) and the country;
- **Members**: `expected` over `registered · accepted` (e.g. "12 expected / 10 registered, 8 accepted");
  "3 still applying" when drafts name it;
- **Seats**: `allocated / seat-taking accepted` with a thin progress bar;
- **Money**: "Paid X" (plus "X offline"), "X due" in rust, or "Nothing due";
- **Decision**: when people are waiting, "Accept N" and a reject icon, both through the page's
  existing `runBulk` + `handleAccept` / `handleReject` (confirm once, chunked, optimistic, one
  reconcile). Members blocked by an unpaid gating fee and secretariat are excluded exactly as in the
  people bulk bar.

Expanding a row opens its panel:
- actions: **Message delegation** (the page's existing one-off composer, frozen recipients),
  **Remind to pay** (the page's `handleBulkRemindPay`, 24h cooldown, to the people who owe),
  **Open in Assignment** (`/manage/[slug]/assignment?mode=delegations&delegation=<id>`);
- a pledge line when there is one ("Pledged 12 spots and 1 advisor ticket", "Waiting for payment"
  or "Received");
- members: avatar, name, head-delegate crown, role, status, allocation (committee acronym + round
  flag + country), payment state; clicking a member opens the existing review drawer; a remove
  button takes them out of the delegation through the existing `removeFromDelegation` (allocation
  kept, spot rules unchanged), after a confirmation that says what happens to their spot.

Phone: rows stack (identity, then the three figures in a row, then the decision), the panel's
actions wrap, member rows drop the payment column into the second line. Laptop: one grid row.

### What happens to the old surfaces

| Surface | Decision |
|---|---|
| Applications' read-only delegation popup | **Removed.** The delegation name on a person row now opens the Delegations list with that delegation expanded. |
| Assignment → DELEGATIONS tab (`DelegationsView`) | **Kept** as the spot and seat workbench (swaps, give spot, advisors, mark received), and now deep-linkable (`?mode=delegations&delegation=<id>`). Deciding, chasing and money live in Applications. |
| Assignment delegates-mode block allocation | **Kept** unchanged. |
| Participant pages and leader portal | **Kept** unchanged (out of scope; participant work is Christian's layer). |
| Dashboard delegations tile | Untouched here (another agent owns `manage/[slug]/page.tsx`); recommended fix below. |

## 5. Follow-ups this change does not do (recommended)

1. Make MARK RECEIVED refuse (or be hidden) when the leader already has `pledge_spot` invoices, and
   include `advisors_pledged`. Better: one `confirm_pledge(application)` RPC that settles the pledge
   invoices, so there is one path.
2. Move every `spots_purchased` change into atomic RPCs (`increment_society_spots`), and call
   `fillFreeSpots` after every spot-freeing action.
3. Add `societies.city` and `societies.country_code`, asked once of the leader on the apply flow
   and editable by the organiser, so the row can show the institution's own place instead of the
   members' nationality. Not done now: there is no source for the data yet and the apply flow is
   Christian's.
4. Drop or repurpose `societies.payment_status` (stale on every row).
5. Dashboard: count delegations from `societies` with at least one live member, and link the tile
   to `?view=delegations`.
6. One definition of head delegate: `is_head_delegate OR role = 'head-delegate'`, used everywhere.
7. Organiser actions still missing: create, rename, change leader.

## What shipped

- `src/app/manage/[slug]/applications/delegationRows.ts`: pure derivation (figures, money, sort).
- `src/app/manage/[slug]/applications/DelegationsBoard.tsx`: the list, counts, filters, rows, panel.
- `src/app/manage/[slug]/applications/page.tsx`: the switch, mounting, the popup removed, the name
  link repointed, and the mark-unpaid spot bug fixed (only a self-funded paid spot leaves the pool).
- `src/app/manage/[slug]/assignment/page.tsx` + `DelegationsView.tsx`: `?mode=` and `?delegation=`
  deep links.
- No migration. No RLS change: organisers already read `societies`, `invoices`, `payments`.

### Verification (21 Sep 2026)

- `tsc --noEmit` clean; eslint clean on the new files (the only errors in touched files are
  pre-existing `set-state-in-effect` findings at `DelegationsView.tsx:279` and
  `assignment/page.tsx:995, :2760`).
- The derivation was run, as the real TypeScript, against live data exported read-only for two
  conferences, and matched independent SQL figure for figure:
  - Stonehill ISMUN (7 delegations, 130 members): e.g. Canadian International School Bangalore
    32 expected / 30 registered, 30 accepted, 29/29 seated, 134,200 offline, nothing due;
    Stonehill International School 42 expected (confirmed spots, no pledge) / 61 registered,
    200,200 offline; Sri Chaitanya 1 registered, 2,200 due.
  - WorldMUN 2027 (22 delegations): received 9,960 through Stripe and 17,430 due across 15
    delegations, equal to the SQL totals; typical row 15 expected / 1 registered (only the leader
    has applied so far).
- The row and panel were rendered in the browser from that data through a temporary harness page
  (since deleted), at laptop width and at 375px (no horizontal overflow, rows stack to identity,
  three figures, decision).
- NOT verified in the browser: the real `/manage/[slug]/applications?view=delegations` page
  signed in as an organiser (no organiser session was available), the Accept / Reject / Message /
  Remind / Remove actions end to end, and the Assignment deep link opening the delegation.
