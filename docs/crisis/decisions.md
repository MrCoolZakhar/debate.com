# Gavelling Crisis: Owner Decisions

Peter's answers to the 42 plan questions (25 Oct 2026), plus the follow-ups the same day. These are rules; change them only with Peter.

## Scope and timing
- Conference crisis committees only. A standalone (Sessions) version maybe later.
- Version 1: a single cabinet, and a joint crisis with two rooms.
- Show a first version the week of 1 Nov 2026, test in week 3 of November, release on 24 Dec 2026.
- Name for now: **Gavelling Crisis**. Address: `/crisis/<conference slug>/<crisis slug>`; `/crisis` lists your crises.

## People and access
- Roles: Crisis Director, sometimes Assistant Crisis Directors, backroomers, front room chairs, sometimes press. There is no cabinet director.
- Everyone gets in with their Gavelling account, OR with a personal code and their own password issued by the Crisis Director. The committee room code also works in place of a personal code, but always with the person's OWN password (round 5): nobody gets in with a shared code alone.
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

## Round 4 (Peter, 26 Oct 2026)

Directives everywhere
- The directive's TITLE is the most important thing: at the very top of every directive card, the biggest text on the card, always fits (wraps, never cut). The number sits slightly overlapping the card's top edge as a small badge ("No. 13"). Tags and the rest go small, bottom right.
- The character is on the left: the portrait, with the name beneath it as two rows (short name big, full name small) per the no-ellipsis rule.
- My Directives (delegate) reads "11: Title".
- A directive shows the time the response came in (answered_at).
- Command "Waiting for a Reply": no explanatory line. Just the title with "17 directives open" at the top right, then straight into the directives.

Backroom
- A directive opens as a pop-up like the delegate's, shaped like the organiser committee editor (main pop-up with a side panel next to it). The side panel holds the actions: resources up/down, map moves (units, strength, borders), character status, news. All staged and applied the moment the reply is sent (crisis_answer_directive already does this).
- The outcome buttons (Approve etc.) can be clicked again to unselect before sending.

Crisis Director Command
- Less on one page. No awkward gaps around the war map. No News card on Command: that column is Needs Your Approval, with the "Crisis news" button there (we no longer say "crisis break").
- Front Rooms: a semi-live dashboard like the organiser Live Status cards.
- Cabinet Resources: the icon in a circle, the number under it, the change small beside it (green up, red down). Room for 6 to 8 per cabinet. "See all" opens a pop-up.
- Resources are cabinet resources. Individual (per character) resources come later.

Resources
- Clicking a resource opens its history as a graph; up is green, down is red.

Notifications and history
- Each kind looks different (its own icon and colour).
- Clicking a notification opens a pop-up showing what changed: for the map a small map showing the movement from where to where, for troops what changed (strength from and to), with "Open the map".
- A full history page: backroom and director see every change and who made it; delegates see what changed for their cabinet only, never who.

Meetings
- Start and stop a timer on the meeting itself (not strict); show who is in the room.

Delegates
- The directive form has no "To": title, "What do you want to happen?", themes. Joint co-authors are picked with their pictures.
- "Characters" becomes "Cabinet". A delegate never sees another character's directives or performance (profile only). The director decides whether delegates see the other cabinet and how much (Settings: hidden, names and pictures, full profiles).
- News without a picture is all text (no empty picture space). Delegates are not told whether news went to every room or only their cabinet.

## Round 5 (Peter, 27 Oct 2026)

Map
- It is called "Map", never "War map". History is a tab inside the Map page for everybody (/map?tab=history); /history redirects there.
- Tools: Select and Borders. No "Extend territory". Select picks a unit OR a territory (a country or a drawn area). A selected territory's border can be dragged: corners where there are few, otherwise press on or near the border to pull it out from that point. Borders: click a country to select and hand it over; click anywhere that is not a country to draw a new territory.
- No overlap: growing a territory over another's land cuts that land out of the other (crisis_map_regions.geometry holds edited country outlines).
- No "suspected" units.
- Fog of war: each cabinet sees its own countries and areas, plus a sight circle around each of its own units (army 450 km, navy 650, air 950, missiles 800, base 450, spy 220, submarine 500, other 400). Any other cabinet's unit inside one of those circles is visible to it automatically (enforced by the database); the backroom can still reveal a unit by hand.
- Characters stand on an exact spot (picked on a map) and appear on the map for the backroom and the director only.

Command (again: one screen, no page scroll at 1440x900)
- Map card: the cabinet view tabs at the very top with "Open the full map" beside them; no fog or fit view in the preview; the map fills the card with no gap.
- Cabinet Resources under the map, compact (an overview).
- "Crisis news" opens the composer in a pop-up.
- Waiting for a Reply rows: the title runs the full width; the character (portrait, surname, title) sits underneath.
- Front Rooms: "Join as chair" is the primary button; the other is "Watch only" (the read-only secretariat view, which cannot change roll call).

Backroom directive pop-up
- Looks like a chat, like the delegate's view: the directive and every note as bubbles, internal notes marked "Only staff", a composer at the bottom with the outcome chips, "Add internal note" and "Send reply".
- "What happens when you send" starts empty with a "+"; each chosen action is a card; several character changes, unit moves and borders can be added.

Chair
- Cabinet directives go to the cabinet's chair first (setting, on by default); the chair sends them to the backroom or sends them back with a note.
- The director can "Try it as" a chair and the press. Test chairs and press exist in the test crisis.

Test committee
- Each character's picture is its seat's picture in the live room (kept in sync by the database).

## Round 7 (Peter, 30 Oct 2026)

Design rule (standing): **no random white space.** Every card fills its slot, columns end level, no half-empty tiles, no odd alignment. If a column has room left, it gets a useful bento card (Needs Attention), never a white gap. Check every screen at 1440x900 for this before reporting.

- Directives tab = the one-by-one reader (one directive in focus, the rest stepping off to the right, smaller; click to bring forward, open to respond). The opened directive pop-up has no side rail of other directives and the normal text size. Facts and the responsible backroomer sit in the white field beside the character. Internal notes live in What Happens When You Send; its recap sits at the bottom, compact. Map actions open the map large in place of the pop-up's content (Back returns).
- "Being written": a reply typed in the last 5 minutes (crisis_directives.drafting_at) means someone is on it: it leaves Waiting for a Reply and is never moved by a rebalance.
- Command: Front Rooms look like the organiser live-wall room cards; a Needs Attention card fills the space under them; reassign from Waiting for a Reply; tighter resources.
- Meetings: requests and upcoming meetings first, held and declined as a one-line history; requests also show (above directives) on the backroom's Directives page and for chairs.
- Map: changes wait in a shared draft until "Send to delegates" (setting, default on), planned moves keep their line until sent, an undo button, territory of one cabinet merges when extended and never overlaps another's, the original country always shows underneath, characters on one spot fan out, other cabinets' characters hidden from delegates (setting, default off).
- Answering a directive is one transaction: news with its file is published by the database when allowed, and map edits ride in effects.map (part 20).
- Characters: a delegate name anywhere opens their profile; performance = speaking time and directives (incl. co-authored, breakdown on hover), with the same stats page as regular sessions.

## Round 8 (Peter, 30 Oct 2026)

- Never set `turbopack.root` in next.config (it made `next dev` spawn PostCSS helpers without limit and crashed the Mac twice). Agents run only eslint on their files; one build at the end by the lead.
- Command's live room pop-up: Cabinet Directives and Crisis News tabs instead of Documents; the crisis chair's home shows the same.
- Map: the unsent-changes bar sits top right outside the map; every map change (characters, units added or deleted too) waits for Send to delegates; drawing ends back on Select; Go back also undoes a discarded draft; History groups changes into batches and can bring the map back to a past point; no flicker on apply; the sight ring's line is clickable; unit deletes work; fog never leaves a no-longer-spotted unit visible; country ownership always shows to delegates; custom zones (up to 20 colours, name, description) and more map detail in the spirit of Google My Maps.
- Delegate directive form: Themes beside Kind on one row, a bigger text box, an optional image through a pin inside the box, shown inline in the chat. News images open full size. My Character shows the character on the map.
- Performance is ONE blended total (in-room session points plus directive points) with one breakdown; Statistics compares delegates on that blend.
- Cabinet settings open as a pop-up; meeting clocks run only from the database anchors.

## Round 9 (Peter, 30 Oct 2026)

- Cabinet directives are assigned to the Crisis Director first (the database does it, SQL part 27; after the chair's approval when the chair must approve). Personal and joint directives still go to the character's backroomer. Setting: Settings > Directives > "Cabinet directives go to the Crisis Director first" (`cabinetDirectivesToDirector`, default on).
- The Director gets a prompt on any staff page when one is waiting (`CabinetDirectivePrompt`, mounted in the crisis layout): Review opens it like a notification link, Allocate to someone else replaces the card with the staff list, X closes it. Handled ones are remembered per device; on page load only the last 30 minutes pop up; it waits while another dialog is open.
