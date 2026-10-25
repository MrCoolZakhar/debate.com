# Master of Disaster (MoD) demo teardown, for Gavelling's crisis tool

Source: https://app.masterofdisaster.co.uk/examplecrisis/ ("Sample Conference 2019", crisis "1933: Public Enemies No. 1"). Explored read-only on 25 Oct 2026 at 1440x900. Nothing submitted, saved or sent. The demo is a shared, frozen 2019 dataset (235 directives, 105 news items, 446 pages of message threads, 33 characters, 34 participants). Real login forms exist on the landing page (hidden); not touched. Note: the demo exposes every participant's username and plaintext password on the Director participants page (by design for the sandbox, but it shows passwords are stored/displayed in plain text).

## 0. Entry and overall structure

- Landing: white page, big serif "MASTER of DISASTER / CRISIS SOFTWARE" double-border logo, conference name in thin sans, five flat pure-blue (#0000FF) rectangular buttons: USG CRISIS, DIRECTOR, BACKROOM, CHAIR, DELEGATE. Orange "Get it now!" box top right. Footer "(c) Jonas Bokelmann". (Solo-dev product, and it shows.)
- Five roles, each is a separate app shell with its own URL prefix and its own default theme colour: USG (grey/white, "Crisis Designer"), Director (red + black content), Backroom (brick brown + cream content), Chair and Delegate (orange / maroon with a black top nav). Themes are per-user via Settings.
- Roles map: USG Crisis = conference-level admin (creates crises, cabinets, participants). Director (and Assistant Director) = crisis designer and backroom boss (characters, settings, allocations, battles, stats). Backroom = directive responders ("backroomers"). Chair = a delegate-character with extra duties (approve cabinet directives, chair's notes). Delegate = a character.
- Tech/feel: server-rendered PHP + jQuery + Bootstrap 4 + FontAwesome; every action is a full page load. Real-time only for the news ticker and notification bell.

## 1. USG Crisis (Crisis Designer) - /admin_index

Shell: black top bar with conference name (bold rounded white) left, "Crisis Designer" centre, round icon buttons ? (tutorial), bell, gear, then "Logout". Thin teal strip under it. Light grey left sidebar (200px) with small logo and 6 items with FontAwesome icons: Dashboard, Crises, Cabinets, Participants, Characters, Feedback. White content area, grey tiles, Raleway-style thin headings. Sparse and very low density.

- Dashboard: logo, big blue CRISES button, "Hello there, John USG. Welcome to the party." Three grey stat tiles: 34/70 Participants (quota), 22 Delegates, 1/1 Crises (quota). Licence quotas (participants and crises) are visible: it is a per-conference licensed product.
- Crises: "1/1 Crises created", blue ADD CRISIS. Table (dark teal header): Crisis Title, Crisis Director, Cabinets, Delegates, Chairs, Backroomers + icon column (envelope = send director login details, pencil = edit, bin = delete). Delete modal warns: resets all allocations of backroomers, chairs, delegates, deletes director profile and all cabinets, "entirely IRREVERSIBLE". Edit Crisis form: Conference, Crisis Title, Director (name, contact email, username, password with Change Password), plus up to two Assistant Directors (name, email, username, password, "Create AD 1/2", "Delete Director"). Blunt text: "THIS ACCOUNT ... WILL CREATE AND ALLOCATE THE CHARACTERS. THAT IS NOT POSSIBLE THROUGH THE USG CRISIS ACCOUNT".
- Cabinets: per crisis a heading "(run by Mr Director)" with Add Cabinet; rounded grey bars "Public Protectors (12 members)", "Public Enemies (12 members)" with minus (delete) and edit icons. Create modal: Cabinet Name. Delete warns it deletes character profiles and resets allocations. Edit = rename only.
- Participants: counter "34/70 signed up", ADD MEMBER, blue "Send out login details" bar, toggle Contact Details / Login Details, three accordions: Directors (2), Backroomers (8), Delegates & Chairs (24). Banner: "I STRONGLY recommend to use this page on a larger screen". Tables: Name, Contact E-Mail, Type, Crisis; delegates show Character + cabinet. Add participant form (/single_member?id=new): Name*, Contact Email*, Type* (Backroom / Delegate / Chair), Crisis*, Username*, Password* (pre-generated random, "Change Password"), plus a "Spreadsheet" button (bulk upload). Modals: send welcome email to everyone for a selected crisis (only possible once every chair and delegate has a character), per-participant welcome email, delete.
- Characters: read-only overview, accordion per cabinet "Public Protectors (15 Characters)", each row = round photo, name, "Location: Alive/Dead", View button. View modal: name, cabinet, "Represented by", Download Bio File (PDF), description. Characters outnumber delegates (33 vs 24) so killed characters can be replaced.
- Feedback: list of anonymous/named feedback to the conference (cards: name, date, text). Demo content is juvenile.
- Settings (gear): Theme dropdown (12 themes: Classic, Night, Ferrari, Desert, Bubble Gum, Thea's Special, Marxwell Hammer's Red Revolution, Colonial Fantasies, Sabina the Teenage Witch, Wear Protective Eyeglasses, THE CIRCUS, Justin Beaver at LSEMUN) + Change Password. Backroom/Director settings add "Directives overview design": Beautiful (default) or Effective (colour coded).
- Tutorial (?) modal: one text wall describing every tab.

## 2. Director - /dir_index (the crisis cockpit)

Shell: red top bar with conference name, crisis title centre, ? / bell (badge) / gear / Logout. Under it a teal strip holding the NEWS TICKER (marquee: "+++ Capone Fires Back | Cowley challenges Al Capone | ... +++", latest 4 items, click opens the article in an overlay). Left red sidebar: logo, "July 1934 / Crisis Clock" (the in-world date the director sets), Dashboard, then collapsible white-outlined groups SETTINGS and OVERVIEW, then Crisis Statistics, Cemetery, Feedback. Content area is black with dark grey (#323232) rounded cards. Density: low; big headings; lots of dead space; at 1440 wide the content is a narrow centred column.

Sidebar items:
- SETTINGS: Director Settings, Background Guide, Characters, Participants, Cabinets
- OVERVIEW: Directives (badge 8), Reading List (badge 3), Messages (badge 0), Battles, News, Announcements, Chair's Notes
- Crisis Statistics, Cemetery, Feedback

Dashboard: greeting, six stat tiles: Unanswered Directives (0), Total Directives (235), Unprocessed Message Threads (0), Total Participants (34), Delegates (22), Cabinets (2).
Notification bell: "5: You received a comment on the following directive claimed by you: Plough" ... (comments from submitters on directives you claimed).

### Director Settings (every option)
1. Directives and messages are: CLOSED / OPEN (one global switch; produces system notifications "Directives are open/closed" to everyone).
2. Directive Timer: 210 seconds (waiting time between two directives per delegate), "Edit Directive Timer".
3. Message Credits: 100, "the amount of messages that delegates can send per hour" (UI calls them "Carrier Pigeons"; "all return at 09:00:02").
4. Characters in other cabinets (in My Profile, Directive Creation and Messaging) are: NOT VISIBLE / PARTIALLY VISIBLE (just names) / FULLY VISIBLE (with summaries).
5. Crisis Clock (free text date shown in every delegate's sidebar).
6. Sending messages requires backroom approval: YES / NO.
7. Discussion on directive response: CLOSED MANUALLY / AUTO-CLOSED.
Very good set of knobs, presented as a stack of dark cards with red buttons.

### Background Guide: single file upload (PDF) shown to backroom and delegates as "Crisis Guide" button.

### Characters (director/backroom version): CREATE NEW + MULTISELECT. Accordion per cabinet. Row: photo, name, "Location: Chicago, Illinois", Alive/Dead; buttons View / Edit / Message / Kill (Revive for dead). Whole list is one long page.
- View & Edit Participant modal: represented by, bio file, Location (free text), Resources (textarea, one item per line, shown on the delegate's profile "so they don't need to ask"), Military Units (edited elsewhere).
- Edit (/single_character): Character Name*, Cabinet*, Character Description (textarea), Full Character Bio (PDF upload), Character Picture upload, Delete, "Spreadsheet" bulk import.
- Message: backroom-to-character one-way message ("They will not be able to respond").
- Multiselect: bulk kill, revive, move, message.
- Cemetery page ("Gone but not forgotten": name, "Died of ...", "We shall never forget their sacrifice") is a public memorial of dead characters; Kill asks for cause of death. Charming.

### Participants (director): Chairs (2), Delegates (22), Backroom (8) accordions. Per delegate a Character dropdown (allocation auto-saves on selection; dropdown excludes characters of other cabinets; one chair per cabinet). Shows username/password inline. "Send out everyone's login details". Add Member.

### Cabinets (director): per cabinet expandable table: Name, Character Name, Contact E-Mail, Number of directives submitted (a quiet engagement metric). "Create Character in Cabinet", edit (rename and add a map link per cabinet: "New feature"), delete.

### Directives (see section 3, shared with backroom).
### Reading List: directives backroomers escalated with "Add to Reading List" ("Director input needed or particularly relevant"). Same card list, with CLOSED overlay on finished ones.
### Messages (see section 4).
### Battles: "Battles (0)", CREATE NEW, BATTLE UNITS. Text: "The indicators on the ends of the battle bubbles ... indicate if a battle plan has already been submitted". Empty in demo, so the plan view was not visible. Create Battle form: Battle Title ("The Battle of ..."), Battle Commander I (any character) + Co-Belligerents checklist (their units become available), Battle Commander II + checklist, Description. Constraint note about a character not fighting themself. Battle Units: define unit types (e.g. infantry), then assign each character a count (0 hides the type; allows secret units visible to one delegate). Chairs of the two cabinets are notified and submit plans; director sees both side by side and publishes news from them.
### News: "Newsfeed", WRITE NEW, numbered list "105: Capone Fires Back, date", pill rows. Write News Release form: Article Title*, Attach Image, Article*, Publish. A directive can be converted with "Make into News Release" (prefills). Numbered chronologically; ticker and "All News" show them to everyone.
### Announcements: cabinet-targeted news. Write form: Title*, Cabinet* (dropdown), Announcement*. List grouped per cabinet with counts. Empty in demo.
### Chair's Notes: per cabinet (number of notes per delegate), open a delegate: timestamped chair notes (bubbles), read-only for backroom/director; "Post Note" textarea for chairs.
### Crisis Statistics: tiles + two plain tables: Backroomers (Name, Response number, Total response word count, Avg response word count; e.g. Bogdan Leon 61 responses, 11.07 words avg; Niam Dickinson 0 / N/A) and Delegates (Name (Character), Directive number, Total directive word count, average). No chart visible in the demo even though the tutorial promises "a handy graph updated every 15 minutes". Word count is a crude quality proxy but surprisingly useful to spot lazy backroomers.
### Feedback: send feedback to conference management, "Send anonymously? No/Yes".

## 3. Backroom directive queue (the core)

Shell: Backroom is the Director shell minus Settings group and Reading List: Dashboard, Characters, Directives (badge), Messages (badge), Battles, News, Announcements, Chair's Notes, Cemetery, Feedback. Dashboard: DIRECTIVES and CRISIS GUIDE buttons, three tiles (Unanswered 0, Total 235, Unprocessed Message Threads 0) and "Personal statistics" (total responses, word count, avg words).

Directives Overview page (/backroom_directives):
- Heading, "My Claimed Directives" button (separate filtered page), legend with 4 icons: spinner "In Queue (to claim)", pen "Claimed", envelope "Responded to", speech bubble "Comment" (delegate replied, needs action).
- Two "Expand All" buttons (cards collapse to title only).
- Filters: Delegate (character dropdown, 24+), Search by Directive No. (number box), Category (Strategic, Military, Personal, Press Release, Intelligence/Covert, Economic, Diplomatic), Cabinet, Group Submission (Individual / Group / Cabinet), Answer Status (All Action Required, Untouched, Claimed, Answered (not yet closed), Delegate response, Closed). Each filter is a form select with page reload. No free-text search, no sort control, no filter by backroomer in the list, no date filter.
- Pagination: First 1 2 3 4 5 ... 16 Last, 15 cards per page.
- Card: one big rounded dark card; left column = status icon + zero-padded number "0235" (bold), "12/10/2019 at 17:28", submitter character (large), cabinet (small), claimer name at bottom ("Mr Director", "Kyran Bass"); right column = bold centred title and an italic preview truncated at about 5 lines with ellipsis. Closed ones get a big "CLOSED" watermark overlay but stay clickable.
- Ordering (observed): comment-needs-action first (0235, 0218), then claimed/pen (0237, 0236, ...), then closed. So it sorts by action required rather than age; there is no SLA or waiting-time indicator, no age colouring, no timer per directive.
- "Effective (colour coded)" setting colour-codes cards by status (could not preview; changing a setting counts as saving).
- Badge number in the sidebar (8) equals claimed-but-not-closed directives, whereas the dashboard says "0 Unanswered": confusing, the two counters mean different things.

Claiming/assignment: backroomers self-claim by opening the directive and pressing a claim button (shown here as "Claimed by: X [Unclaim]"). No assignment by the director, no round-robin, no categories-to-people routing, no concurrency lock shown, no "who is idle" view.

Directive detail (/backroom_directive?id=):
- Title "235: The Final act", "Submitted by: Ma Barker", Back button.
- Left box "Claimed by: Mr Director" + Unclaim. Right box: "If you feel like the director should read this directive or you need their input to accurately respond, press this button." + "Add to Reading List".
- Backroom can re-categorise the directive (Category dropdown) and change Co-Submitters type (Individual / Cabinet / Group) after the fact.
- Directive body in full, "Make into News Release" button (turns it into a pre-filled news article).
- Discussion section: this IS the reply mechanism. There is no separate "response" field or template: the backroomer's reply is the first comment in a thread (author label "Backroom (Bogdan Leon)" so the delegate sees the role, not necessarily the person's identity, plus timestamp). Controls: "Open Discussion" / "Close Discussion" toggle (director setting can auto-close), textarea "Comments for clarification", Send. Closed state shows greyed "Discussion disabled." Only the backroomer and the submitter can comment. A delegate comment triggers a bell notification for the claimer. Delegates can't edit, and the delegate's directive is visible read-only afterward.
- No: canned replies, internal backroom notes separate from the reply, attachments, rich text, per-directive timer or priority, history of who claimed and unclaimed, tags/outcomes (e.g. "affects character X"), links to related directives, side-effect tracking (kill a character, move location) from the response. The director must go to a different page to Kill/relocate/edit resources.

## 4. Messaging and approval

- Delegates have "Carrier Pigeons" (100 / hour in the demo) shown as a counter on the messages pages. Write Letter form (/start_thread): "Start thread with" dropdown (own cabinet first, then other cabinet; names may be hidden depending on setting; unknown characters show a big "?" avatar), Message Text, Send. Messages go into a thread per pair of characters. Dead characters appear as "DEAD - Herman Hollis". Backroom-to-delegate one-way messages live under a "BACKROOM" button (/my_backroom_msgs).
- Chat style bubbles with avatar, name, timestamp; delegate view has a status legend: paper plane "Waiting for Approval", envelope "Approved and sent", X "Disapproved".
- Approval step (backroom): Messages Overview lists threads as pills with both avatars ("Blanche Barrow - Eliot Ness, date") filterable by one delegate, paginated (446 pages). Opening a thread shows every message as a bubble with an inline Approve / Disapprove dropdown per message. Settings flag "sending messages requires backroom approval YES/NO". No unread/pending highlighting in the list (the unprocessed counter is only the sidebar badge), no reason on disapproval, no bulk approve, no edit before approving, no way to see who approved.

## 5. Delegate and Chair views

Shell: orange (chair) or maroon (delegate) header with crisis title and cabinet name under it, bell with count badge (e.g. 25), ? and gear. Beneath: a black top nav with white-pill active tab: Dashboard, My Profile, Directives, Messages, Announcements, [Chair's Notes, chair only], Cemetery, Feedback. Left sidebar: logo, Crisis Clock ("July 1934"), a "Newsticker" list of round-cornered outline pills (latest ~20 items live, "SEE ALL NEWS"). Click opens article in an overlay. Content is white.

- Dashboard: "No map added." (cabinet map link slot, left), greeting, large round character photo, Crisis Guide button, three stat tiles: Directives submitted, Messages sent, "Coolness Points" (a joke metric that is clearly meaningless, numbers jump around), plus personal stats (total directives, word count, avg words per directive). Gamified vanity stats; no real progress info.
- My Profile (/my_profile): Download Bio File, Download Background Guide, character blurb, photo, name, cabinet, Location, Resources (free text set by backroom), Military Units ("You command: ..."), then "My Cabinet": every cabinet-mate with picture and blurb (and, depending on settings, other cabinets).
- Directives (/my_directives): buttons CABINET (chair only), CREATE NEW, BATTLES; legend: In Queue (spinner), Responding (pen), Unread response (envelope), Read response (open envelope). List of own and cabinet-shared directives: number, title, date, submitter, type (Individual / Group / Cabinet). Unread responses highlighted in the theme colour.
- Write Directive: Directive Title*, Category* (7 options), Co-Submitters* (Individual / Cabinet / Group; group gives checkbox list of cabinet-mates), "Save Draft (will not submit)", Directive* textarea, a disabled button "Can submit directive in [countdown]" (the director timer, 210 s, per delegate, with note "If the submit button does not appear immediately after the timer runs out, reload the page") then SUBMIT. Draft autosave shows "Saved!". Note the demo shows someone's previously saved draft prefilled, i.e. the sandbox is shared.
- Chair approval: Cabinet directives page (/cabinet_directives) with legend "Chair Approval required" (exclamation) vs "Approved by Chair (In Queue)" (tick). Opening one shows title, category, co-submitters, text. Only directives marked as Cabinet-level need chair sign-off; the chair is a player and a gatekeeper. Approve control was not visible on the examples (both already approved).
- Single directive view: category, submitter, co-submitters, body, then Discussion (backroom comments); "Discussion disabled." once closed. Delegate sees "Backroom" as author.
- Messages: see section 4. Announcements: "Cabinet Announcements", empty in demo. All News: paginated list. Cemetery as above. Feedback as above.
- Chair's Notes (chair): list of cabinet delegates with a note count, open one, chronological note bubbles (author name, timestamp), "Post Note" textarea + Save. Visible read-only to director/backroom. Purpose: awards and judging help.
- Battles (my_battles): "No battles created yet", battle plans submitted by chairs.

Notifications (bell dropdown, real-time): "You received a response to the following directive of yours: hey", "Directives are open." / "Directives are closed." (global switch toggles are spammed to everyone), "You received a comment on the following directive claimed by you", message approvals, etc. Numbered list in a dropdown, each links to notification.inc.php?id= (marks read).

## 6. What is clever (steal or improve)

1. Everything revolves around one object, the directive, with a numeric id, category and a clear lifecycle: queue, claimed, responded, comment, closed. The icon legend is simple.
2. Directive timer as a core pacing mechanic (delegate cannot spam the backroom): a countdown on the submit button, director-set. Combined with message credits per hour ("carrier pigeons") that refill. Both are simple rate limits themed to the setting.
3. Chair as a gate for cabinet directives (shared directives need chair approval before the backroom sees them), and Chair's Notes feeding awards.
4. Resources, location and units editable per character by backroom so delegates do not ask "what do I have"; characters have Alive/Dead state, kill/revive with a cause of death, a Cemetery page, and "DEAD -" labels in message lists.
5. Directive to news in one click ("Make into News Release"), live ticker for everyone, news in overlays so nobody navigates away.
6. Character visibility switch for other cabinets (hidden / names only / full), a great realism and fairness lever.
7. Crisis Clock in-world date shown to every delegate.
8. Backroom throughput stats (responses, word counts) for the director; delegate directive counts per cabinet.
9. Battles model with co-belligerents' units unlocked per battle, secret unit types, both plans revealed together then published as news.
10. Welcome-email flow only enabled once every delegate has a character; a licence/quota counter; per-crisis participants with generated credentials.
11. Cabinet map link per cabinet, background guide upload.

## 7. What is clunky, dated or missing (opinionated)

Visual and structure
- Looks like 2016 Bootstrap: pure #0000FF buttons on USG/landing, giant empty margins, content narrow and centred at 1440, huge headings, tiny helper text, mismatched button styles per role, and eleven joke themes (including a "Justin Beaver" skin) that signal hobby project, not serious conference software. Each role's visual identity changes completely, which makes support screenshots confusing.
- Low information density for the backroom, the one persona that lives in the tool for 6 hours: big cards with a 5-line preview, 15 per page, no keyboard flow, no side-by-side list and detail, no split view. Every action is a page reload; the backroom must leave the list to open a directive, then Back, then page 3 again.
- The "queue" is not really a queue: no oldest-first sort, no waiting time, no SLA colour, no per-category or per-person lane, no unassigned-first default, no claim conflict handling visible, no dashboard of who is working on what. Filter by dropdown, not chips or saved views. The only urgency signal is the comment icon.
- Counters disagree (sidebar 8 vs dashboard "0 unanswered"). Reading List count and Messages count are only badges.

Directive handling
- Reply = chat comment; no template, no structured outcome, no internal-only notes, no co-responder, no attachments, no response history audit, no link between response and world changes (kill, move, resources, news, battle). No "needs director" with reason beyond a button; no escalation tracking after it.
- Group and cabinet directive sharing is through checkboxes of cabinet-mates only; no cross-cabinet joint directives.
- Backroom can silently change category and co-submitters after the fact.
- Draft saving is manual.

Messaging
- Per-message approve dropdowns in a long thread, no inbox-zero view of only pending messages (the Messages list shows all 446 pages mixed together), pagination to 446 pages, no search, no approval reasons, no auto-approve for same-cabinet, no spam flag.

Admin
- USG, Director and Backroom are three separate apps with overlapping pages (Participants, Characters, Cabinets appear in both USG and Director). Characters are created only by the director, but USG creates cabinets and participants, which needs explaining in red capital letters on the form. Participant credentials are created by hand (username, password) and shown in plaintext; no magic links, no self-registration, no SSO.
- Stats page promises a graph but shows only tables; "Coolness Points" is a joke stat.
- No crisis timeline/phase control beyond a free-text clock; no scheduled events/"crisis updates" planned in advance; no tasks queue for the secretariat; no per-delegate private feed or character-specific news (only cabinet announcements); no role for press; no voting or committee floor features; no mobile-first delegate UI (the tutorial itself says use big screens for participants).
- Not seen or absent: awards output from the data, export of directives/messages/news, audit log, multi-language, accessibility, search across everything, undo.

## 8. Implications for Gavelling's crisis tool (quick opinions)

- Their model (directive with lifecycle + discussion thread + claim by backroom + director escalation) is the thing to match, but build it as a dense two-pane inbox with default oldest-unclaimed-first, visible waiting times, claim locks, per-category lanes, response templates, internal notes versus player-facing reply, and structured consequences (news, kill/move, resource change) attached to a response.
- Keep their best mechanics: submit timer + hourly message credits, chair approval for cabinet directives, message approval toggle, character visibility levels, crisis clock, character state with cemetery, directive-to-news in one click, resources/location owned by the backroom, battles with unit types.
- Beat them on: speed (no page reloads), phone-first delegate view, live presence of backroomers, per-backroomer load and response-time stats with an actual chart, one app shell with role-based permissions instead of five, magic-link participant access, and proper design.
- Their sandbox being shared state (drafts from previous visitors prefilled) suggests a public demo needs per-visitor reset.

## 9. What could not be seen

- Battle plan submission/side-by-side view and battle bubbles: demo has 0 battles. Same for announcements (0 in both cabinets) and battle units (none defined).
- Colour-coded "Effective" directives view and theme previews: needs saving a setting, so skipped.
- Chair approve/reject control: both cabinet directives in the demo were already approved; no pending item to expose the button.
- Claim button in the queue state: no unclaimed directive exists in the demo (0 unanswered), so only the claimed state (Claimed by + Unclaim) was visible.
- Crisis Statistics graph: not rendered (no canvas/svg on the page).
- USG "Add Crisis" form and the participant "Spreadsheet" import: the add pages were not opened beyond Add Participant; spreadsheet import page not opened.
- Real-time behaviour (ticker/bell push) can't be exercised with frozen data.
- Mobile layout not tested (desktop at 1440x900 only; participants page itself warns against small screens).
