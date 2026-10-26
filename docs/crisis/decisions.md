# Gavelling Crisis: Owner Decisions

Peter's answers to the 42 plan questions (25 Oct 2026), plus the follow-ups the same day. These are rules; change them only with Peter.

## Scope and timing
- Conference crisis committees only. A standalone (Sessions) version maybe later.
- Version 1: a single cabinet, and a joint crisis with two rooms.
- Show a first version the week of 1 Nov 2026, test in week 3 of November, release on 24 Dec 2026.
- Name for now: **Gavelling Crisis**. Address: `/crisis/<conference slug>/<crisis slug>`; `/crisis` lists your crises.

## People and access
- Roles: Crisis Director, sometimes Assistant Crisis Directors, backroomers, front room chairs, sometimes press. There is no cabinet director.
- Everyone gets in with their Gavelling account, OR with a personal code and their own password issued by the Crisis Director. There is no shared room code for crisis.
- Set-up: the organiser switches Gavelling Crisis on for a crisis committee (a package choice), then the Crisis Director sets up characters, staff, the map and settings in `/crisis`.
- Backroomers own specific delegates by default (they know them best). They can still see every directive and claim any, and the CD can assign any directive to anyone.
- Backroomer powers are one setting for all backroomers (not per person).
- The front room chair cannot read personal directives by default; a setting allows it.
- Crisis Staff applications, once accepted, go straight to the crisis staff.

## Directives
- All types: personal, joint, committee, press release, communiqué.
- Required: title, receiver, action text. Everything else optional.
- Delegates see the outcome label (approved, partly works, denied, more detail needed, answer coming later) as well as the reply.
- Delegates do not see their place in the queue.
- Queue order can be changed; the default is the fair order (longest wait, then whoever heard back least recently).
- **No rounds.** The committee runs as one continuous session; nothing is held for a round.
- Committee directives go through Gavelling's existing documents and voting page.
- A reply can change resources, the map and the news in the same press.

## Communication
- Delegates chat with the EXISTING live-room chat (src/components/ChatPanel.tsx), exactly as in a normal committee room (Peter, 25 Oct 2026: reuse what exists, do not rebuild). The separate crisis chat was removed; the crisis_messages table (SQL part 6) stays unused.
- Crisis delegates have no working papers or draft resolutions (no Submit a document).
- Meetings happen in person; the app holds the request and approval. The backroomer and the CD can both approve; the chair only sees them.
- News reaches the live room as a pop-up, and everyone can see the history of all news.

## World
- Each character can carry a character guide (a file the CD attaches); the delegate opens it from My Character.
- Characters hold bio, picture, powers, secret goals, resources, units and map position.
- Resources are typed counters (per character and per cabinet) with a reason on every change.
- A dead or arrested character's delegate gets a spare character picked by the CD.
- Map: the real world (current borders) first. Borders by regions and provinces, plus a quick dragger: draw land a side holds as a shape and drag its markers for a finer outline.
- Fog of war per cabinet. Delegates draw orders that become directives; staff move units; no dice.
- **No running crisis clock.** The in-world date and time is set by the CD by hand and stays static until changed.

## Not now
- No AI anywhere yet.
- Pricing is decided after it is built. Set-up for organisers works like a shop: questions about what they want, then a recommendation, with packages such as Basic crisis and the Full package.

## How the work is done
- All crisis work on the `crisis` branch.
- SQL is applied directly from the crisis chat (Peter, 25 Oct 2026); every applied change is kept in `docs/crisis/sql/`.
- Every update is checked in a real room on Gavelling Test MUN 2027 (test codes in the git-ignored `.claude/crisis-test-codes.md`).
- Design: Gavelling ivory with a lot more red (dark red gradient rail, red tints, red gradient on bigger surfaces and some buttons), green accents kept.

## Round 3 (26 Oct 2026)
- Delegate page: three columns (small left column with the character, Request to speak and Chat side by side, the date, directives open, resources two per row; Send a Directive in the middle on one screen; News above My Directives on the right). No top status bar.
- Delegates can write clarifications on a directive at any time, like a chat. Drafts are never lost (directives, news, backroom replies autosave).
- News is numbered per cabinet; a story for every room takes the next number in every cabinet. The number shows big with the source.
- Backroom: the character is the focus (big name, title, cabinet logo); small tags for waiting, last heard back, length, backroomer; goals behind a disclosure; staff notes are always internal; a "+" adds actions to a reply (resources, news, a character's status, a unit move, a border); never hand a directive to yourself.
- Characters: visible to every role; backroomers edit only when the CD allows it (Edit characters power); the character pop-up is central with Profile, Directives and Performance (points).
- Points: directives sent, approved, partly worked, denied, cabinet and joint directives, meetings held; every value editable in Settings (src/lib/crisis/points.ts).
- Meetings: requested by delegates, approved by a backroomer or the CD, seen by chairs, marked held with what was agreed.
- Notifications: a bell for every role; rows are written by database triggers (troop movements a person can see, reveals, territory gained or lost, answers, news, meetings, status changes; for staff new and handed directives, clarifications, meeting requests).
- The sidebar is complete for every role (pages being built say so).
- Overlapping avatars copy the organiser Live Status emblem (one third outside the card's top edge).
- Organiser Live Status cards of a crisis room carry "Open Gavelling Crisis"; Manage committees carries the switch-on button.
