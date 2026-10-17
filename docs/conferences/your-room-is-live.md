<!-- Moved verbatim from CLAUDE.md on 17 Oct 2026 (the full file is docs/history/CLAUDE.md.2026-10-17.md). Long-form reference for this area: history, owner quotes, verification notes. The rules that must hold are in CLAUDE.md. -->

## 5e. "Your room is live" (22 Sep 2026)

The moment a signed-in person lands on the site while one of their conference rooms is live,
`LiveRoomsGate` (root layout, `src/components/liveRooms/`) sends them straight in: an
**organiser** to `/manage/[slug]/live` (how many committees are live and in session), a
**chair** straight onto the dais with no chair code at all (`enter_live_chair_room` decides at
press time: "Start the session" for the first chair in, "Join as co-chair" for the next, and the
card shows who is already on the dais and how many delegations are present), a
**delegate** to their allocated seat (`/delegate/CODE?country=...&locked=1`, round country
flag as the headline), and a **faculty advisor** (accepted / assigned / checked-in application;
owner: "put in a note for faculty advisors to have the pop up as well") to the advisor board
`/advisor` as ONE entry per conference, "Follow your delegation", with how many of their students
sit in live rooms (24 Sep 2026; it used to be one entry per room, to `/advisor/CODE`). One prompt
at a time, organiser > chair > delegate > advisor; several
entries are a compact list. "Not now" lasts for the page visit; it stops by itself when the
conference ends or the room ends. The same rooms stay under "Live now" in the profile menu.
Source: `my_live_rooms()` (caller's own rows only, never the chair suffix). It never opens on a
live session route, /join, auth or apply paths, and never over another gate. On /sessions it
also carries the standalone rejoin. Rules in AGENTS.md, "Your room is live".

**Faculty advisor board (24 Sep 2026).** `/advisor` shows a teacher where each of their students
is in the speaking queue across many committee rooms: rooms added by session code are followed on
THIS device (nothing stored server-side), and a signed-in conference faculty advisor, head
delegate or observer gets their conference filled in with nothing typed. That comes from
`my_advisor_delegation()` (SECURITY DEFINER, `search_path = public, pg_temp`, EXECUTE for
`authenticated` only, revoked from PUBLIC and anon), read by `useMyAdvisorDelegation()`
(`src/lib/advisorDelegation.ts`, keyed on the user id, one read per account per page load,
`reload()` to retry). It returns, per conference where the caller holds an `accepted` /
`assigned` / `checked-in` application as `faculty-advisor`, head delegate (`role =
'head-delegate'` or `is_head_delegate`) or `observer` (one role per conference, in that order):
the conference (id, full name, acronym, logo, slug, dates), `myRole`, the society name, `seats` =
every allocation of the caller's OWN society (linked through the allocation's application's
`society_id`, or `conference_allocations.society_id` for a delegation block seat; withdrawn /
rejected students left out) with the session code, committee, country, seat, the student's
display name (else the invite name) and role, and `rooms` = every committee of the conference
that has a session. Observers get rooms and no seats; an advisor with no society on the
application falls back to `societies.advisor_user_id`. Never another society, never an email, a
student's user id or anything from `committees.settings`. No points, no rank on the board;
reminders are in-app only (nothing here sends email).

**Two views (24 Sep 2026, owner).** A segmented control at the top (`ViewSwitch` in
`src/app/advisor/board/AdvisorBoard.tsx`, radiogroup, arrow keys, remembered per device as
`BoardPrefs.view`, default `queue`): **Up next** is ONE speakers list across every followed student
in every room, ordered by `queueRank` (`src/lib/advisorBoard/derive.ts`): speaking now, then next,
then N speakers ahead ascending (ties by committee), then in the room, then "Needs a look"
(absent), then rooms not in session, the last three under quiet dividers. Each row (`SeatRow` in
`board/SeatCard.tsx`): the place in the room's list as the chair's sidebar numbers it (#1 = the
floor, a mic disc), the round flag, the student's name (or the country) with the country, the
committee acronym (full name as tooltip) and what the room is doing, and WHEN in plain words with
the ticking clock or estimated wait. **By committee** groups the same rows under one header per
room (acronym large, full name beneath, the room's mode and who holds the floor with their clock),
rooms where a student speaks soonest first, rooms not in session last. Tapping a row opens the
StudentSheet. **The single-room view `/advisor/[code]` was removed the same day**: it redirects to
`/advisor?add=CODE`, and nothing on the board links to a room.

---
