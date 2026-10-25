# Crisis committee tooling: public web research (25 Oct 2026)

Method: WebSearch and WebFetch only. Vendor pages are marketing and unverified. No reviews, complaints or conference lists were found for any tool except Deus (see below). Gaps are stated per tool.

## 1. Master of Disaster (MoD)
- URL: https://masterofdisaster.co.uk/ ; demo: https://app.masterofdisaster.co.uk/examplecrisis/ ; sign-up: https://masterofdisaster.co.uk/get_mod
- What: web platform, "Europe's best crisis simulation platform", built to replace paper and spreadsheets in crisis simulations. Footer credit: Jonas Bokelmann (2026). Site shows a counter of 12,566,960 words exchanged (a traction signal, unverified).
- Platform: web app, no mobile app mentioned. Several colour schemes.
- Roles seen in the demo: USG Crisis, Director, Backroom, Chair, Delegate. The demo page shows only a title ("Sample Conference 2019"), the role labels and a "Get it now" link; no login or UI was visible to a fetch.
- Features by role (from the landing page):
  - Organiser: whole crisis in one place; one-click welcome emails with logins and bios; assign characters to delegates; share bios, background guide and character profiles; full setup control with no contact with MoD admins needed.
  - Backroom: filter and categorise directives; monitor inter-delegate messages; reply to directives via a comment-style system; adjust a delegate's directive-sending speed (rate limit); take and share notes on delegate performance; approve delivery of messages; view chairs' notes on delegates; send cabinet-specific announcements.
  - Chair: chairs' notes on delegates are visible to the backroom. No dedicated chair console is described.
  - Delegate: send directives; see characters in other cabinets; message other delegates (delivery needs backroom approval); track where a directive is; real-time news and notifications; view profiles and bio files; summary of all characters in their cabinet.
  - Other: directive timer, integrated feedback system, director's reading list, real-time crisis statistics, background guide visible to all.
- Directive workflow: delegate sends -> backroom filters/categorises/approves -> backroom replies in comment thread -> delegate sees status updates and notifications. Specific status names are not published.
- Map/military: none mentioned. This is a clear gap.
- Cross-cabinet: messages approved by backroom can reach characters in any cabinet (joint crisis support).
- Setup: short sign-up form (name, conference name and year, dates, number of crises, total participants), then "immediate access".
- Pricing: the landing page appeared to show about GBP 20 per participant per day, with a much lower rate (about GBP 1) above 60 participants; the layout was ambiguous and /get_mod showed no price. A BestDelegate/Wisemee article (https://www.wisemee.com/?p=1586) calls it "currently free" with a try-it section. Treat pricing as unconfirmed.
- Traction: only the word counter and Wisemee's recommendation for joint cabinet crises. No named conferences found.
- Strengths: focused on directives and messaging, approval gate on messages, rate limiting, easy onboarding, cabinet/JCC aware, cheap or free.
- Weaknesses: no map, no resources/personnel tracking, no public statuses, little public documentation, unclear pricing, single-developer feel, UK/Europe centric.

## 2. MaxiMUN (public pages only)
- URL: https://maximun.app (pages: /features, /for-crisis-directors, /guides, /about, /privacy). Sign in with Google; "Enter MaxiMUN" / "Start a Committee".
- What: "one operational workspace for crisis teams and delegates"; committee management for Crisis Directors, crisis teams and delegates. Maker, history, pricing and conferences using it: not stated anywhere I could reach (About page gives only a mission line).
- Features (https://maximun.app/features):
  - Command (directors): flexible committee structure, organise personnel, Crisis Clock (control crisis time), customisable role permissions, publish announcements.
  - Directives (delegates and crisis team): delegates draft and submit; crisis team claims, discusses, clarifies, grants, modifies or denies. Joint directives, signatures, decisions.
  - World: interactive map, resource index, news and updates, role-specific announcements (each participant sees the view suited to their role).
- Setup (https://maximun.app/for-crisis-directors): Google sign-in, create and customise committee, define conference context, organise crisis team and delegate positions, set role access, invite by committee code. Workflow framed as Prepare, Coordinate, Pace.
- Directive workflow and statuses (from its guide https://maximun.app/guides/how-to-manage-directives-in-a-crisis-committee): Submitted (shared queue with number, timestamp, author, reviewer) -> Claimed (one responsible reviewer) -> Clarification requested -> Decided (granted, modified, partially successful, delayed, denied) -> Applied (resources, relationships, maps, public events updated before closing). Overdue conversations should be visible. Suggested metrics: median time to first review, unclaimed submissions, clarifications awaiting delegates, decisions not yet applied, reviewers overloaded. Joint directives need verified signatures and per-signatory contribution.
- Staffing guidance (https://maximun.app/guides/how-to-organize-a-model-un-crisis-team): organise staff by character, issue area (military, intelligence, economics, press), faction or function; about one backroom staffer per 3-5 delegates; staff rule on ordinary decisions, escalate irreversible/committee-wide ones to the director; monitor queue (unclaimed, oldest waiting, clarifications pending, updates awaiting approval).
- Other guides: how to run a crisis committee, what a CD does, crisis arc, effective updates, best tools (https://maximun.app/guides/best-tools-for-running-a-model-un-crisis-committee). The tools guide rates forms/sheets, chat apps, docs/slides, paper, and dedicated software; it does not name Master of Disaster or Discord. It suggests a trial run of about 10 directives, 2 conflicts, a resource change and an update deadline, and test questions: ownership/status/wait time visible, decisions update maps/resources with history, recover state after a mistake, easy joining.
- Strengths: the closest to the full vision (queue with claim, clarification, applied step, map, resources, personnel, clock, role permissions); strong content marketing/SEO; Google sign-in plus committee code join is low friction.
- Weaknesses and unknowns: pricing, team, traction and testimonials not visible publicly; the marketing page says nothing about front room chair tools (speakers list, motions) or delegate chat; map and resource detail is names only. Another agent is covering the logged-in app.

## 3. Other tools and workflows
- Deus Crisis Software (UNA-York, two York University students). Defunct: Wisemee page marks it "RIP" (https://www.wisemee.com/?p=1586). Earlier BestDelegate piece (https://bestdelegate.com/chairing-for-beginners-part-ii-styles-of-chairing-and-software) says it brought directives, news releases and cabinets together, gave backroom immediate replies and direct messaging, each conference got its own URL and accounts, and customisable by chairs, delegates and backroom. Used by a dozen-plus conferences (ManMUN, OxIMUN, HamMUN, WarMUN, UBIMUN, UCLMUN, NancyMUN, YorkMUN, LSEMUN, LIMUN, CardiffMUN) and ZuMUN 2018 JCC (https://zumun.ch/wp-content/uploads/2018/05/ZuMUN2018_StudyGuide_JCC.pdf). Wisemee says scale 10 to 100 delegates and "a bit of a learning curve". Lesson: demand existed, a student-made tool dying left a gap that MoD fills.
- Kennesaw State capstone "Model UN Crisis Software" (ASP.NET Core MVC, Azure SQL): directive and news management, user management, messaging. Student project, not a product (https://kennesaw.edu/ccse/events/computing-showcase/sp24-cday-winners.php, seen via search snippet only; fetch failed on certificate).
- McMUN 2018 paperless crisis: plain conference-issued email accounts, staff could read all mail. Faster than paper (paper replies could take over an hour), cheaper, but access concerns for delegates without devices (https://www.mironline.ca/?p=30008).
- Gettysburg: no technology, paper crisis notepads (https://engage.gettysburg.edu/modun/crisis-information/). NYUMUNC used Gchat and Google Docs for directives and records (found via search summary; https://bestdelegate.com/new-york-university-model-united-nations-conference-nyumunc-10-way-joint-crisis).
- General MUN software that is NOT crisis-specific (per https://blog.modeldiplomat.com/mun-simulation-software-tools-2026): MUN Command by MyMUN (https://mymun.com/mun-command), ChairMUN, Muncoordinated (free, open source, suggests pairing with Discord), MUNify, ManageUN, MUN World, MUNLine, MUNPoint, munhood, Placard, Model Diplomat. None mention crisis features. wxMUN cannot edit country names so is unsuitable for crisis (BestDelegate). MyMUN's own docs and blog (https://mymun.com/blog/mun-crisis-committees-a-beginners-guide) explain crisis but I found no crisis tooling in MUN Command.
- Google Forms/Sheets, Discord bots, Notion templates: I found no published MUN-specific template or bot. Only generic Discord-to-Sheets bots (e.g. https://github.com/carljkt/discord-google-sheets-bot). MaxiMUN's tools guide describes the Forms/Sheets pattern and its failure modes (fragmented context, duplicates, manual permissions). Could not find a "Crisis Hub" product; I did not include it.

## Concepts worth knowing (from guides)
- Public directives are debated and voted by the committee; private directives / crisis notes go to the backroom and are secret (https://modeldiplomat.com/learn/glossary/public-directive, https://mymun.com/blog/mun-crisis-committees-a-beginners-guide). A directive has no effect until staff return it signed (ZuMUN rule).

## Complaints from users
Found none about MoD or MaxiMUN (no reviews or Reddit threads indexed). Only complaint: Deus had a learning curve and has since disappeared.

## Judgement for Gavelling
- Market is thin: one live niche tool (MoD, no map) and one new, full-featured but opaque one (MaxiMUN). Dead predecessor (Deus) shows conferences adopt such tools.
- Differentiators available: live war-game map, claim/clarify/applied directive pipeline, a front room chair console tied to the same record, and free entry via Sessions funnel.
- Open questions I could not answer from public pages: MaxiMUN pricing, owner and traction; MoD exact pricing and statuses; any real user complaints.
