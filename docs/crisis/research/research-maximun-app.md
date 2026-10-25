# Maximun (maximun.app) hands-on research

Date: 25 Oct 2026. Account: Peter's own, signed in as **Crisis Director** of a test committee called "CRISIS COMMITTEE TEST / Board of Directors". Read only. Nothing was saved, created or sent. Dialogs were opened to read them and then closed or cancelled.

## Method and big limits (read first)

- The tab group Peter opened was not visible to my session ("no tab group of its own"). I created a fresh Chrome tab group and loaded https://maximun.app. Because it is the same Chrome profile it was already signed in as Peter. I closed my tab at the end.
- The whole app is ONE URL (`/`). It is a single-page app with no routing: no deep links, back button does nothing useful, no shareable page URLs. Page changes are state only.
- The committee is empty: 0 of 10 crisis team slots filled, 0 of 30 delegate slots filled, 0 directives, 0 news, 0 announcements, 0 library docs, 0 messages. So I could see containers, filters and forms, but NOT a populated directive card, the staff response form, the directive detail view, the delegate view, or the chair view.
- The Map editor was NOT opened (see section 6).
- Only the Crisis Director role is visible. There is no role switcher. Roles are fixed by the "meeting position" assigned to each personnel slot and by which join code a person used.
- Join codes (Delegate and Crisis Team) exist; I did not copy or record them.

## 1. App structure

### Layout shell
- Left sidebar, dark teal (Ocean Blue theme), icon-only at rest (about 70px wide), expands on hover to show labels (about 235px, overlays content), has a "Pin sidebar" button to keep it open. Logo tile (round "M" crest) at the top.
- Top bar, white, full width. Left: stacked "CRISIS COMMITTEE / TEST" small caps with "Board of Directors" in serif beneath (committee name block, clickable as "Go to Home"), a thin divider, then "CURRENT PAGE" small caps over the page title in a big serif. Centre-right: a rounded pill holding three live status cells separated by hairlines: CURRENT ROUND (Round 1), SUBMISSIONS (Paused / Open), CRISIS CLOCK · PAUSED (2028-11-01 00:00). Then a "JOIN CODES" pill button, a bell with unread count, and an account chip (avatar initial, name, email, chevron).
- The status pill is a nice idea: every role sees the round, whether directives can be submitted, and the in-world date at all times.
- Account menu: "Hi, Peter Zakhar", "THIS SERVER: Board of Directors", Meeting position: Crisis Director, Character: Crisis Director, Sign out.
- Join codes popover: two cards, DELEGATE code (prefix `DEL-` plus 32 hex) and CRISIS TEAM code (prefix `TEAM-` plus 32 hex), each with a Copy button. Same codes repeated at the bottom of the Crisis Director Dashboard. Very long, ugly, hard to read out loud or type on a phone. Two codes only: nothing per-character, nothing per-delegation.
- Notification bell: panel with "NOTIFICATIONS, 0 unread", "Mark all read", "No notifications yet."
- Sidebar footer: theme picker button ("Ocean Blue" with chevron) and a live clock line "Asia/Kuala_Lumpur, Oct 25, 2026, 18:45" (local time and zone shown to the user).
- Entering the app shows a black cinematic splash: "Rejoining your" over a huge serif "CRISIS" in grey, about 3 to 4 seconds, then the home screen. Tab title is "MaxiMUN | Model UN Crisis Management Software" on load and "MaxiMUN . Crisis Committee . TEST . Board of Directors" inside.

### Themes
18 colour themes in the picker, each shown as a 3-swatch chip: Classic Navy, Midnight, Deep Forest, Burgundy, Royal Violet, Ocean Blue (current default here), Desert Sand, Soft Rose, Modern Slate, High Contrast, Obsidian, Graphite, Nord Night, Cyber Neon, Ember Night, Plum Night, Deep Teal, Espresso. This is per-user and applies to the whole chrome. Delegates presumably pick their own. Strong "make it feel like my game" touch for very little work, but 18 is a lot of surface to keep accessible.

### Sidebar items in order (Crisis Director view)
1. Home
2. Crisis Director Dashboard
3. Directive Control
4. Library
5. News
6. Index (Resource Index)
7. Map
8. Announcements
9. Messages
10. Characters
11. Audit
12. (theme picker + clock at the foot)

The Home page repeats nearly all of these as 3 by 3 cards (Crisis Director Dashboard, Directive Control, Library, Resource Index, Map, Messages, Characters, News, Announcements). Audit is not on the Home cards. Home is a pure launcher: it adds nothing the sidebar does not. The card order differs from the sidebar order.

### Home page contents
- Small caps "Crisis Director", big serif "Welcome, Peter Zakhar", top-right "CURRENT CHARACTER: Crisis Director".
- A wide white card with a coloured left edge: "CLARIFICATION FOLLOW-UP / Delegates awaiting a Chair reminder / No delegate clarification reminders needed right now." with a round "0 CASES" badge on the right. This implies a feature where staff ask a delegate for clarification on a directive and a Chair is prompted to remind delegates who have not answered. Not testable with no data.
- Then the 9 launcher cards, each: pale-teal icon tile, serif title, one-line description, bold teal "Open →".

### Other roles
Not visible. What the data tells us:
- "Meeting position" options for a slot: Unassigned, Delegate, Backroomer, Frontroomer, Crisis Director, Crisis Team. So the role model is: Crisis Director (admin), Backroomer (crisis staff), Frontroomer (chair / front room), Delegate, plus a generic "Crisis Team" bucket. Crisis Team slots (10) are a separate pool from Delegate slots (30).
- Join code split: the Crisis Team code gets staff in, the Delegate code gets delegates in.

## 2. Visual design (so a designer can sketch it)

- Palette: pale ice-blue page background (very light blue-white), pure white cards with 1px light teal border and large radius (about 18 to 24px), dark teal/petrol for the sidebar and for the three hero stat tiles on the dashboard, a mid-teal accent for links ("Manage →", "Open →"), coral/salmon for danger and the "PAUSED" pill, lime-yellow dot for "live" indicators on the Resource Index.
- Type: a high-contrast classical serif (Georgia/Times-like, looks like a system serif) for page titles, card titles and big numbers; a clean grotesque (Inter-like) for body; tracked all-caps small labels (about 11 to 12px, wide letter-spacing) for every section label and field label. It reads like a financial newspaper / diplomatic document. Dense but airy; lots of whitespace on desktop, content area about 1290px wide, centred.
- Icons: thin single-weight line icons (Lucide-like) in the sidebar, in a rounded square pale tile on the home cards.
- Right-side slide-over drawers (about 45 to 50% width, full height, over a dimmed and blurred page) are the universal pattern for forms: clock config, round controls, slot management, upload document, new news, new announcement. Each has a small caps eyebrow, serif title, close X top-right, sometimes an "expand" diagonal-arrow button beside the X (news and announcement) that presumably makes the editor full-width.
- Centred small modals are used for resource category creation and price editing. So both drawers and modals exist; not strictly consistent.
- Empty states are plain centred grey sentences ("No directives match your search and filters."), no illustration, no call to action. Flat.
- Density: desktop-first. I did not test phone width.

## 3. Setup flow (what exists)

There is no separate "create committee" wizard visible to me (the committee already existed, called TEST, with the board name "Board of Directors"). Setup happens through the Crisis Director Dashboard plus other pages:

### Crisis Director Dashboard (page 2) layout, top to bottom
1. Three dark teal hero tiles in a row:
   - CRISIS CLOCK: big serif "2028-11-01 00:00", a salmon "PAUSED" pill, "Open clock settings →", and a Run button (in the DOM; when paused you press Run).
   - SUBMISSIONS: big "Paused", a white "Open" button (toggles directive submissions open).
   - ROUND 1: "End Round", "Submissions paused", "Open round controls →".
2. PERSONNEL CONTROL card, left two thirds: heading "Personnel", counter "0/10 Crisis Team · 0/30 Delegates". Two columns of rows: CRISIS TEAM (Crisis Team Slot 01 to 10) and DELEGATES (Delegates Slot 01 to 30). Each row: dark round avatar with a dash, "Slot name / Unassigned", then position ("Crisis Team" / "Delegate"), "No character", and a "Manage →" link. So the model is PRE-GENERATED SLOTS, not "add a person". The counts 10 and 30 look like fixed defaults.
3. GROUPS card, right third, "Crisis Team only": a text field with placeholder "STC, Houthi, RoY, Yemen…" and an "Add group" button, empty state "Create a group, then select its characters." Groups are labels the crisis team uses to cluster characters (factions, countries, blocs). The placeholder shows the Yemen crisis scenario Peter or the builders ran. Groups also appear as a filter on Directive Control.
4. MEETING ARCHIVE "Export timeline": four tiles with record counts and "Export TXT": All Newsticker, Breaking News, All Directives, Starred Directives. Plain text export only (no PDF/Word/CSV).
5. Join codes (repeat).

### Clock settings drawer ("Configure Crisis Clock")
- CRISIS DATE AND TIME: a native datetime-local field (shown 01/11/2028, 00:00).
- PAUSED checkbox.
- REAL-WORLD CADENCE: number plus unit. Units: Minutes, Hours. (shown 30 Minutes)
- CRISIS TIME PER TICK: number plus unit. Units: Days, Months, Years. (shown 1 Months)
- Live sentence below: "Every 30 real minutes, advance 1 Crisis months." and "Automatic advancement is paused."
- So the crisis clock is a game-time clock that auto-advances on a real-time cadence, with manual pause and run. No "seconds", no "weeks", and no "fast-forward to date X" button seen. Grammar slip: "1 Crisis months".

### Round controls drawer
- CURRENT ROUND: number field (1). SUBMISSION STATUS: select Open or Paused.
- Buttons: "Save round status" (outline) and "End & Carry Forward" (red outline, destructive). "End & Carry Forward" presumably closes the round and carries unfinished directives into the next. It is the only place the round concept is managed.
- Rounds and the submission switch are the main pacing mechanism: delegates can only submit directives when submissions are Open.

### Personnel "Manage" drawer (a slot)
- Title "Unassigned Crisis Team Slot", subtitle "Slot 01".
- MEMBER NAME (text, placeholder "Unassigned").
- MEETING POSITION (select): Unassigned, Delegate, Backroomer, Frontroomer, Crisis Director, Crisis Team.
- CHARACTER (plain text field, placeholder "Unassigned"). It is free text, NOT a picker. Characters are therefore just a string per slot: no portfolio, bio, powers, picture, or resource sheet attached.
- A checkbox card "News Publisher: May draft and publish News releases." This is a per-person permission toggle (shown for a crisis team slot). So permissions are tiny: at least "News Publisher".
- "Save changes".
- A person enters by join code; the director (or the person) is mapped to a slot. How a person is matched to a slot after joining, and how many slots can be edited in bulk, I could not see. There is no import (CSV) or bulk create visible.

### Characters page
Only shows cards for people with characters. Mine: one card, "CRISIS DIRECTOR" eyebrow, title "Crisis Director", "Crisis Team", "Peter Zakhar". Not clickable (no detail view). The home card describes it as "Browse committee characters, countries, roles, and contact actions", so it acts as a directory, with contact actions (message) per card.

### Library
- Header "COMMITTEE LIBRARY / Library / Shared background, crisis, and procedural documents for this committee." Search by title or file name. "+ Upload document" button top right.
- Upload drawer: Title, Category (select: Background Guide, Crisis Guide, Rules of Procedure, Other), Files (multi-file), text: "Recommended file format: PDF. DOCX files are supported, but complex Word layouts, fonts, or embedded elements may display with formatting differences in the browser preview." and "AI-readable formats: PDF, DOCX, XLSX, TXT, JPG, PNG, WebP, GIF. Images are analyzed with vision AI and limited to 5 MB; other files are limited to 20 MB." Footer "Nothing is shared until you confirm." and an Upload button.
- IMPORTANT: Library documents are ingested by an AI. The upload copy says files are "AI-readable". Combined with the "AI Backroomer" reviewer (below) this strongly suggests the library is the knowledge base the AI backroomer reads when answering directives. Uploading the crisis guide is how you teach the AI the scenario.

### Resource Index (page "Index")
- Eyebrow "RESOURCE INDEX", serif title "Market & resources", green dot "Live committee data" top right.
- Category tabs as pills: "Oil 3" (the 3 is a count badge, selected = dark teal pill with a lime dot) and a dashed "+ Add new category".
- Selected category "Oil Index": eyebrow "GLOBAL MARKET ASSET", description "Global oil market and delegate positions.", on the right "INDEX OIL-01".
- Left big card "GLOBAL BENCHMARK / Oil Price" with an "Edit price" outline button: huge serif "$82.50 USD / bbl", a green pill "0.00 since last update", a line chart with area fill (flat, one data point), and a footer "LOW $82.50 HIGH $82.50 UPDATED 23/10/2026".
- Right card "DELEGATE POSITIONS / Select a delegate" with a lime round minus button (collapse) and the text "Oil delegate data. Each delegate's export volume will appear here after they join." So each delegate has their own holdings per category (export volume plus strategic reserve in the Oil example), editable by staff.
- Lower card "RELATED UPDATES / What moved the index / 1 recorded changes" with a change log (Oil Price, "Initial value", who, timestamp).
- Footer "CATEGORY SETTINGS" with a red "Remove Category" button and the sentence "Remove this category and all resource data associated with it."
- "Edit price" modal: New value (number plus unit "USD / bbl") and "Reason for change" (textarea, placeholder "e.g. Updated after market report #12"), Cancel and Save change. A reason is requested (it feeds the change log and probably the News).
- "Add to Resource Index" modal: subtitle "Choose a shared global market or a resource held independently by delegates." Fields: Resource name ("This becomes the category name shown in the top bar."), Resource type (Global market asset, Delegate resource), Chart type (Line chart, Bar chart, Number only), Price unit (e.g. USD / bbl), Initial global price, and a "DELEGATE DATA" box that auto-prepares individual editable records per delegate (shows "Export volume + strategic reserve", "0 DELEGATES"). Create category / Cancel.
- Takeaway: resources are modelled as either a global price index with per-delegate position OR a plain per-delegate resource. It is a market tracker (oil, gold, grain), not a general "treasury / troops / influence" sheet. The Oil category looks pre-seeded by default (maybe a demo, Peter created 23 Oct).

### News, Announcements
- News page: card "NEWS PUBLISHER / Publish News" with "CREATE →" top right (visible to Crisis Director and to Crisis Team with the News Publisher permission); search "Search news by number or keyword…"; empty "No news match your search."
- New News drawer: Title; Importance (select: Normal News, Breaking News, "+ Add New Importance Level" so custom levels are possible); News content (big textarea); Images (up to 3, "large files are compressed"); "Publish News" disabled until filled; "Nothing is published until you confirm."
- Announcements page: "CRISIS DIRECTOR / Publish Announcement / CREATE →", same layout.
- New Announcement drawer: Title; Category (Official, Crisis Update, Operations, Schedule, Safety); content; Images up to 3; Publish Announcement. Announcements are the director's committee-wide notices (logistics, schedule, safety), chronological; News is the in-world feed "latest released intelligence and press updates". Dashboard export labels these as "Newsticker" and "Breaking News" so there is a ticker concept (probably a scrolling ticker for delegates) fed by news importance.
- Both have numbering ("by number or keyword"): items get serial numbers.

### Messages
- Two-pane layout inside one bordered card: left "RECIPIENTS" select ("Select a recipient…") and "CONVERSATIONS" list; right pane "Choose a recipient to open a private conversation."
- Home card text: "Send and reply in private conversations with eligible contacts." "Eligible" means rules decide who may message whom (probably delegates cannot message everyone). Recipient list was empty for me (no other people). 1-to-1 only: no group chat, no committee-wide chat seen.

### Audit
- A flat list of timestamped lines. Mine: "Peter Zakhar configured the committee map", "...added a map marker", "...configured the committee map". Timestamps are in a browser-locale format that mixed languages ("上午11:56", "下午03:49", Chinese AM/PM, no date) - a visible localisation bug and no date column. Only three entries and no oil price change, no clock change, no slot edits: the audit log is thin or only covers the map for now.

## 4. Directives (as far as visible)

Delegate-side submission form and the staff detail view were NOT visible (no directives exist; Crisis Director has no submit button). What the Directive Control page shows:

- Page: "Directive Control". Home blurb: "Claim, review, filter, and discuss submitted directives."
- A region labelled "Backroom work reminders" made of four stat tiles: UNCLAIMED, WAITING FOR DELEGATE, DELEGATE RESPONSE OVERDUE, RESPONSES UNFINISHED (all 0).
- Tabs: All, Unclaimed, Claimed, Discussion / Responses, Delegate Response Overdue.
- Big search: "Search by number, title, submitter, participant, or status…".
- Five filters in a row: REVIEWER (All, AI Backroomer, Peter Zakhar), DELEGATE (All + each delegate), TYPE (All, Normal, Joint), STATUS (All, Submitted, Granted, Denied, Awaiting review, Result not published), GROUPS (All groups + the groups created on the dashboard).
- Inferred workflow:
  - Directives have a number, title, submitter, participants (co-signers), a type (Normal or Joint), and optionally a group.
  - Staff CLAIM a directive (it becomes theirs), review it, and can have a back-and-forth with the delegate ("Discussion / Responses", "Waiting for delegate", "Delegate response overdue", "clarification"): the system tracks clarification requests, whether the delegate has answered in time, and nags the Chair to remind them.
  - Outcomes: Granted or Denied, and a separate state "Result not published" which means staff can finish a response and hold it, then release results together (publication of results is its own step; consistent with the "Round" and "Submissions open/paused" model: results probably go out when the round ends).
  - Starred Directives (dashboard export) means directives can be starred, probably by the director or chair for committee-level handling.
  - "Joint" type means joint directives exist (several delegates co-submitting, or committee-level). Voting on committee directives is not visible anywhere in the UI I could see (no vote or motion page exists in the sidebar). Weakness or just hidden.
  - There are NO timers on directives I could see except "response overdue" for delegate replies; no SLA countdown for staff, no assignment by director to a named staff member visible (staff self-claim; the Reviewer filter lists staff).
- **AI Backroomer**: the Reviewer filter has a built-in reviewer value `ai-backroomer-beta`, labelled "AI Backroomer". So an AI can act as a reviewer of directives (a "beta"). Combined with the AI-readable Library, this is the headline feature: an AI backroom staffer that drafts or gives first responses to directives using the crisis guide. I could not see what it does, whether it auto-answers or drafts for human approval, or its settings.
- Peter's own Reviewer id is the string "mara" (a legacy internal name leaking into the DOM), harmless.

## 5. News, press, notes, meetings

- News with importance levels (Normal, Breaking, custom) and up to 3 images; delegates read "released intelligence and press updates" (page says "Read the latest released intelligence and press updates"), so there is a notion of RELEASED vs not (drafts by crisis team).
- A "newsticker" exists (export label).
- Announcements: Official, Crisis Update, Operations, Schedule, Safety.
- Private 1-to-1 Messages with eligible contacts. Characters page offers "contact actions".
- Notifications bell.
- No meetings, no calendar/schedule, no notes-between-delegates feature, no press-corps or journalist role, no "crisis note" form separate from directives visible. No mentions of crisis arcs, portfolio powers, or secret agendas.

## 6. Map

The Map page is a 2-step setup wizard shown inside a rounded card with a stepper (1, 2), eyebrow "COMMITTEE MAP SETUP", serif title "Build your crisis situation map", "Choose the world your committee operates in, then set its place and point in time. You can adjust every detail before delegates see it."
1. Crisis category: two big selectable cards: "Real-world crisis" (AVAILABLE NOW; "Use real countries, borders, coastlines, and geographic regions.") and "Fictional crisis" (COMING LATER; "Create an original world, custom territories, and fictional geography.").
2. Scenario setting: MAP TITLE (default "Global Situation Map"), SCENARIO DATE (date picker, today by default), STARTING LOCATION (Whole world, Middle East, Europe, Asia, Custom / choose later). A summary strip shows "World, 2026-10-25, Political reference map" and "You will be able to pan, zoom, add layers, markers, routes, and operational areas."
3. Big button "Open map editor →".

I did NOT click "Open map editor": the Audit log shows each prior "configured the committee map" entry was written by a map configuration action, so pressing it likely writes config again, and I was told never to save or change committee settings. The audit log also proves a map already exists (it logs "added a map marker" earlier today). The wizard still appears every visit, even though a map was previously configured, which is clunky.
So I can NOT tell you: borders editing, units, fog of war, import of maps, how it looks, or what delegates see. What is promised in text: pan, zoom, layers, markers, routes, operational areas, "intelligence layers, routes, and control areas" (Home card: "Explore the shared situation map, intelligence layers, routes, and control areas."). No military unit tokens, no fog of war and no custom map import were mentioned anywhere. Real-world only; fictional is "coming later".

## 7. Resources, portfolio powers, character sheets, arcs

- Resources: only the Resource Index (market price plus per-delegate positions). See section 3.
- Characters: a name string per slot plus the position. No biography, no powers, no portfolio, no arcs, no secret objectives, no photo.
- No arcs or objectives tracker. No personal "crisis notes" tool.

## 8. Opinion: clever, clunky, missing

### Clever (steal or answer these)
1. Round + "Submissions Open/Paused" in the top bar for everyone: one glance tells every role whether they can act. Pacing is built into the product.
2. Crisis clock that auto-advances on a real-time cadence (e.g. every 30 real minutes = 1 crisis month) with a plain-English summary sentence. Simple, perfect for crisis.
3. "Result not published": responses can be finished and held, then released together. Proper crisis workflow.
4. Clarification follow-up tracking: "Waiting for delegate", "Delegate response overdue", Chair reminder prompts. Tracks who owes whom a reply.
5. AI Backroomer (beta) as a reviewer plus a library that is explicitly AI-readable (PDF, DOCX, XLSX, images with vision). This is the one thing Gavelling must take seriously. The AI uses the crisis guide as context.
6. Resource Index with a global price chart and per-delegate holdings and a mandatory "reason for change" feeding a "What moved the index" log.
7. Cinematic entry splash and 18 themes: emotional, fun for a crisis game.
8. Backroom triage tiles and tabs (Unclaimed / Claimed / Discussion / Overdue) that mirror how a backroom really works.
9. Every form says "Nothing is published until you confirm."
10. Per-person "News Publisher" permission.
11. Meeting archive TXT exports (newsticker, breaking news, directives, starred directives) give directors a post-game record.

### Clunky, confusing, ugly, slow
1. Single URL SPA: no deep links, no back button, cannot send a colleague a link to a directive or page; refresh returns to Home and replays the splash (about 4 s).
2. Sidebar expands over the content on hover and covers the left of the page; clicking an icon leaves the sidebar expanded until the mouse leaves; popovers (join codes) stay open when navigating. Hover interactions do not exist on touch.
3. Join codes are 32-hex strings with prefixes, only two codes (delegate, crisis team). No friendly short code, no QR, no per-person invite, no email invite. No way I could see to pre-assign a person to a slot.
4. Personnel are 10 + 30 fixed pre-made slots with generic names ("Delegates Slot 17"). No bulk import, no CSV, no portfolio assignment flow. "Character" is free text with no picker. Everything is a manual drawer per slot.
5. Characters have no depth: no bio, powers, objectives, picture.
6. Home page is a redundant launcher duplicating the sidebar; the Audit link is missing from it.
7. Audit log has no dates (only a time in a locale-mixed format, "上午11:56") and logs little. A trust feature that looks unfinished.
8. Map setup wizard re-appears each visit and gates the editor behind a "configure" step. Fictional maps "coming later". No sign of fog of war, unit tokens or import.
9. Messages are strictly 1-to-1 with a dropdown of recipients: no groups, no channels, no committee-wide chat, no unread badges on the sidebar.
10. Micro-copy glitches: "advance 1 Crisis months", slot labels "Crisis Team Slot 01 / Crisis Team", user-facing internal ids ("mara", "ai-backroomer-beta").
11. Native datetime-local and native selects in a polished UI: inconsistent.
12. Mixed overlay patterns (right drawers and centred modals).
13. Empty states are bare sentences without guidance (no "create your first X").
14. Export is TXT only.
15. Clock configured in "Months/Years per tick" only: no minutes/hours of crisis time, so it suits long-horizon crises, not tight "hours per update" scenarios.

### Missing (nothing seen, may exist in views I could not reach)
- Committee voting on joint directives / motions, speaker lists, RoP tools (Library holds RoP as a PDF only).
- Crisis notes / personal directives vs committee directives distinction beyond Normal/Joint.
- Meeting scheduling, delegate-to-delegate notes, press corps, character arcs and objectives, portfolio powers, secret information per character, templates for staff responses, canned replies, directive assignment to named staff by the director, staff timers.
- Notification settings, email or push.
- Mobile layout: untested.
- Any print or PDF of directives.

## 9. Pricing or plan limits

None shown inside the app (no plan badge, upgrade prompt, seat counter other than "0/10 Crisis Team · 0/30 Delegates", no billing page). Public landing page (fetched without login) shows no pricing; it lists Guides, Features, For Crisis Directors, About, and calls to action "Make it happen", "I'm a participant", "Discover MaxiMUN". Positioning line: "One operational workspace for crisis teams and delegates." Only hard limits seen: library upload limits (images 5 MB analysed by vision AI, other files 20 MB), news/announcement images max 3, and the slot capacity 10 crisis team + 30 delegates (may be plan-based or just defaults).

## 10. What I could not see

- Populated directive cards, staff review/response form, templates, outcomes list, delegate-side submission form (fields, limits, sponsors/signatories, resources).
- Joint directive flow and committee voting.
- Delegate, Backroomer, Frontroomer (chair) views, and how roles switch (no switcher in the Crisis Director view).
- The map editor and everything in it.
- What the AI Backroomer actually does.
- Pricing/plans.
- The Run button behaviour (not pressed), News Publisher flow after publishing, character detail, mobile layout, the "expand" button in the news drawer.
- The directive timers/assignment beyond claim, and the Clarification follow-up logic.
