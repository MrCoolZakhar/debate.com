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
- Messages between delegates are free by default; backroomers can read them; backroom approval is a setting.
- Meetings happen in person; the app holds the request and approval. The backroomer and the CD can both approve; the chair only sees them.
- News reaches the live room as a pop-up, and everyone can see the history of all news.

## World
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
