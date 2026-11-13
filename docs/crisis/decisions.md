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

## Round 11 (1 Nov 2026): audit fixes and the owner's answers

Owner decisions (Peter, 1 Nov 2026):
- Chairs see their own cabinet only (enforced in the database), and only SEE meeting requests; staff decide them.
- Press uses the Front Room and the Press Desk; press releases are approved by the crisis staff (the press chair, if any, still sees them).
- A character who dies or is arrested: staff are prompted to give a spare; the delegate keeps their directives and points, and in the room only the seat's name and picture change. Spare delegates (people without a character) can be added and given a character quickly.
- Cabinet directives always go to the Crisis Director; there is no "on duty". Max cabinets today is 2.
- Backroomers see every directive by default (a Director setting can turn it off).
- Points follow the person (all their characters together), no cap.
- A delegate can edit or withdraw a directive until it is answered. There is no claiming: directives are assigned automatically.
- Meetings: invited delegates accept or decline first (pop-up and tab); once all answered, or after 5 minutes, it goes to the backroom.
- Map sends are one notification ("N changes to the map") that opens a replay and a clickable breakdown.
- Several drafts for delegates and staff. Resource templates and more resource tools.
- Room chat shows which staff member wrote ("Crisis Team · Name").
- Not now: set-up and codes, security and logging in, packages, access expiry (archive will be premium).
SQL: docs/crisis/sql/028_chair_request_changes.sql, 029_audit_fixes.sql (parts 29a to 29h, 30a, 30b).

## Round 23: Hult MUN, the first real conference (13 Nov 2026)

Hult MUN (13 to 15 Nov 2026) runs a joint French Revolution crisis: National Assembly and Paris Commune, both conference
committees with live rooms. Its crisis is `french-revolution` (crisis id 999a9606-…), made from the two committees' seats:
one character per seat (32), every allocated delegate as a member with their account, every empty seat as a code-only
member named after the character, the two chairs with their accounts, and code-only staff (Crisis Director, Assistant
Crisis Director, Backroom 1 to 4, Press). Everyone has a personal code and a 6-digit password; the code sheet is kept
outside git (private/hult-crisis-codes.csv in the crisis worktree) and is NOT sent until Peter says so. Peter's own
account is an Assistant Director there, so cabinet directives go to the conference's own Crisis Director (the first
director by creation date).

Feedback from their Crisis Director, now built (SQL part 37, docs/crisis/sql/037_*):
- Chairs can see both cabinets: a setting, default off. Read only for the other cabinet; approving stays own cabinet.
- Cross-cabinet meetings: a setting, default on. Delegates invite other cabinets' characters by name and picture
  (crisis_meeting_people) even when "What delegates see of the other cabinets" is Nothing.
- Third parties on the map: an owner that is neither a cabinet nor a delegate (name and colour), offered wherever an
  owner is picked ("Someone else…"). A party that owns nothing drops out of the list; staff can rename or remove one
  (its land becomes nobody's). Stored in settings.thirdParties, owners checked by a trigger.
- Clarifications on cabinet directives: the writer, co-authors or the cabinet's chair answer; the chair gets the
  question as a pop-up and on the Front Room, and an answer goes straight back to the backroom (no second chair approval).
- The map opens on where the characters are when there are no units yet.

Round 24 (13 Nov 2026, Hult MUN set-up):
- "Chairs see both cabinets" is ON by default (SQL part 38); Hult has it on.
- Hult's in-world date is 25 June 1791, 09:00. Characters carry public-domain portraits from Wikimedia Commons, stored in our own crisis-media bucket (no portrait exists of Jean-François Varlet).
- The live-room pop-up sends a delegate of a crisis committee to the crisis, not to a seat.
- Old map underneath (setting historicalMap = 'etatmajor'): IGN's État-major map of France (1820 to 1866), open data, served through /api/crisis-tiles so visitors never call a third party; the map then zooms to street level (16). Zone and territory fills thin out over it.
- Landmarks (settings.landmarks): named places with a description, shown from street zoom with a Landmarks toggle; read only for now. Hult's 30 landmarks, 6 districts and 47 sections came from their Google My Maps file (districts and sections are zones of the types District and Section).
