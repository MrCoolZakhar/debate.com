# GAVELLING CONFERENCES — UI QUALITY RULEBOOK
**The standard every conferences-side surface is measured against. Owner-defined taste, codified.**

This is the yardstick for the UI audit. A page/component either clears this bar or it gets flagged. "It works" is not "it's good." The goal is a site that a professional UI designer could not tell was built by an AI — surfaces that feel *authored*, not generated.

---

## 1. THE TASTE (owner, verbatim intent)

### LOVES — reach for these
- **Uniqueness** — a surface should have ONE memorable move you don't see on every SaaS. No template smell.
- **Thick, confident borders** — 1.5–2px defined edges, not timid 1px hairlines that blend into the bg.
- **Icons everywhere** they add meaning or scanning speed. A wall of text with no icon is a failure.
- **Images / photography** — real conference photos, logos, banners, portraits. Empty coloured rectangles are a last resort.
- **Big, highlighted important parts** — the primary thing on a page should be UNMISTAKABLY primary: large, elevated, gradient/gold, impossible to miss.
- **Gradients** — forest→forest-mid, gold radial glows, warm depth. Flat fills are the floor, not the ceiling.
- **Transparency & backdrop highlights** — glass surfaces, backdrop-blur, translucent panels that let context through.
- **Floating settings side-drawers** — the manage floating rail / conference-settings drawer pattern is the reference; reuse the "floating panel over content" idea elsewhere.
- **Draggable elements** — direct manipulation (the assignment board) beats form-filling where it fits.

### HATES — flag on sight
- **Code-like fonts** — DM Mono used as body/label/heading. Mono is for TINY stamps only (a date, a 3-char code, a stat number). Mono eyebrows everywhere = the #1 AI tell. If a label is mono + UPPERCASE + letter-spaced and it's not a micro-stamp, it's wrong.
- **Big pages with no icons/images** — long text/form pages that never break the monotony with a visual.
- **Meek badge colours** — pale grey/washed pills with no conviction. Badges must have saturated, meaningful tints + a real border.
- **Bullet-dump information** — listing facts as stacked rows/bullets when a chart, medallion, ring, timeline, grid, or map would show them with more punch and less reading. "Show, don't list."

---

## 2. WHAT MAKES A POWERFUL UI (principles the audit applies)

1. **Clear focal hierarchy** — every viewport has one obvious protagonist. If everything is the same weight, nothing is.
2. **Contrast as the tool** — you create emphasis by DEMOTING the secondary as much as by promoting the primary. Uniform thickness/colour = no hierarchy.
3. **Depth & elevation** — layered shadows, glass, gradients give a screen dimensionality. Flat-on-flat reads cheap.
4. **Meaningful motion** — hover lifts, arrow nudges, shimmer, expand-on-hover. Never gratuitous; always feedback. Respect `prefers-reduced-motion`.
5. **Density done right** — pack related info tightly and legibly (a 2×2 fact grid) instead of sprawling stacks; give the page air between groups.
6. **Show data, don't list it** — occupancy → a fill bar; price → a medallion; a schedule → a timeline; locations → a map/flags; rank → an insignia.
7. **Consistency of the language** — same card radius, same border weight family, same eyebrow treatment, same button language across a surface. One-off styling reads as unfinished.
8. **Real content over placeholders** — logos, banners, avatars, flags. A page that leans on monograms everywhere hasn't earned its polish.
9. **Editorial detail** — a gold ◆ separator, a hairline rule, an asymmetric layout, a numbered index. Small craft signals a human made it.
10. **Empty/loading/error states are designed**, not blank — a skeleton that matches the layout, an empty state with an icon + CTA.

---

## 3. THE DESIGN SYSTEM (tokens — non-negotiable palette)
Ivory `#EDE7D8` (page bg) · Cream `#FAF8F3` (cards) · Parchment `#DDD4C0` / stronger `#D8CDB6` / `#C8BEA8` (borders) · Forest `#1B3828` (primary) · Forest-mid `#2A5A3C` (hover) · Forest-light `#3D7A52` (success) · Gold-on-dark `#EED98A` · Gold-decorative `#B6871F` · Amber `#B8844A` · Sky `#4A7896` · Plum `#8A6BA0` · Ink `#1C1410` · Muted `#9A8A78` · Danger `#8B2020`.
Fonts: **Outfit** (all UI, display 900, buttons UPPERCASE bold) + **DM Mono** (micro-stamps ONLY). lucide-react icons only, never emoji. Rectangular flags via `getFlagUrl`/`getCountryByName` (radius 2–3px, never circular). Warm shadows `rgba(27,56,40,x)`. Grain overlay for depth.

---

## 4. EXEMPLARS (already good — match this quality bar)
- **Manage floating rail** (`manage/[slug]/layout.tsx`) — hover-expanding glass pill, icons→labels. The reference for "floating panel."
- **Landing hero photo cards** — full-bleed photo, scrim, overlaid name, 2×2 facts, gold APPLY, gavel disc, gold glow.
- **CV timeline** — rail with logos + dates, role chips, per-type corner discs, opaque badges.
- **Assignment board** — all-committees drag-and-drop, urgency-sorted drop popup. Direct manipulation done right.
- **Rank insignia + level badge** — escalating military-style insignia, not a candy dot.
- **Pricing medallion** (conference detail) — gold-ringed circle, click-to-expand breakdown. "Show, don't list."
- **Committee slider cards** (conference detail) — emblem, chairs, roman-numeral agenda, capacity bar.

## 5. USUAL SUSPECTS (where AI-smell tends to hide — check these hard)
- **DM Mono eyebrows sprawled** across a page as section labels (should be sparse Outfit or removed).
- **Manage pages** (applications/assignment/settings/committees) still carry uppercase-mono grey pills — the "Pill" fix only landed in `/account`. Meek badges live here.
- **Stub/plain pages** — financials (a stub), documents, communications, jobs — likely under-designed vs the polished public pages.
- **Form pages** — new-conference creation, apply flow, settings: long, icon-light, form-heavy. Prime "big page no images" territory.
- **Empty/loading states** — check every list for a designed empty state, not a bare sentence.
- **Bullet dumps** — any place listing 3+ facts as stacked rows that a medallion/ring/grid/chart/map could show better.
- **The map page** and **organise hub** — verify they're not thin.

---

## 6. HOW TO SCORE (the audit rubric — apply per page AND per notable component)
Rate each on a **1–5** scale (1 = AI-generated smell / broken, 5 = authored, would-ship-at-a-design-studio):
- **Focal hierarchy** (is the protagonist obvious?)
- **Border & depth** (defined edges, elevation, glass/gradient — or flat and timid?)
- **Iconography & imagery** (present and meaningful — or a text wall?)
- **Data presentation** (shown uniquely — or bullet-dumped?)
- **Typography** (Outfit-led, mono only as micro-stamps — or code-font smell?)
- **Badges/chips** (saturated + bordered + meaningful — or meek grey?)
- **States** (empty/loading/error designed?)
- **Uniqueness** (one memorable move — or template?)

For every finding give: **file:approx-line**, the **problem** (which rule it violates), a **concrete fix** (specific: "replace the 3 stacked mono rows with a gold-ringed stat medallion like the pricing one"), and a **priority** (P1 = ugly/embarrassing, P2 = noticeably weak, P3 = polish). Rank findings most-embarrassing first. Be brutally honest — flag the exemplary too, briefly, so we know what NOT to touch.

---

## 7. THE SESSIONS ROUND (14 to 18 Sep 2026): WHAT THE OWNER LIKED AND DISLIKED

Sourced from Peter's own messages on the sessions redesign (chair, delegate, voting, join, create). Each line is a rule. Where a rule here disagrees with an older line above, this section wins.

**Corrections to §3.** Round flags are now correct wherever a flag sits in a circle: `CircleFlag` / `SeatCircleFlag`, artwork filling the disc edge to edge (rectangles still use `getFlagUrl`, and the two never mix). DM Mono is retired even as a micro-stamp on new work (`70-typography-rule.md`).

### Liked: keep doing
- **Bookmark flaps.** Tabs that grow out of the surface they belong to: the Settings spine ribbons, the half-circle quorum tabs attached to the top of the speakers list, the icon ribbons on the voting roll call. "I like the flaps of the bookmark and the sliders."
- **Icon first, word small beneath** on any button with an icon or indicator (Vote, Finish, RTR). Icon-only buttons still get a tooltip.
- **Things grow out of the button that opened them** (Motions, Documents, Chat, Scoreboard, Settings, the session code). Fast, transform and opacity only, never laggy on bad wifi.
- **Apple-style glass notifications**, top right, short-lived, one card per event however often it fires.
- **Massive, projector-sized moments:** the session code presenter "absolutely massive", a big floor speaker flag, a big initial roll call, a big timer when a paper has no document.
- **The document is the protagonist** during an introduction: pdf.js pages like MyMUN, the timer a movable, resizable floating device.
- **The order of proceedings set-up page**, with icons per stage instead of I, II, III.
- **The voting roll call with settings bookmarks to the side**, centred on the roll call, threshold open by default.
- **Circles everywhere for people and delegations**, flags filling the circle fully (muncommand is the reference), a soft shadow behind each flag.
- **The voter carousel:** round flags receding left and right of the voter.
- **Result screens with character:** a different GIF for Passed, Failed, Vetoed; voted cards that change colour completely.
- **The Gavelling mark embossed into the floor**, barely visible, centred on the speaker.
- **Direct manipulation:** drag from anywhere on a row, drag on the collapsed rail, movable popovers that remember where they were put.
- **Chat that feels like WhatsApp or Instagram but wears the forest and gold.**
- **A slight colour per section** to carry hierarchy (tab-coloured icons in Settings), on a strict type scale (1:1.6).
- **One page, no page scroll** for set-up screens (voting set-up, Settings Motions, committee set-up); only the list inside scrolls.
- **Emails as cards with pictures:** committee emblem, country flag, conference logo, like the checkout card and the MyMUN emails.
- **Visibility in the room first:** bigger flags and names in the sidebar (then +10%), because a projector and a laptop across a room are the real viewing distance.

### Disliked: never do again
- **"Too AI generated":** generic centred cards, stock fonts, templated set-up pages, stock-looking icons. It was said of the before-voting page, the DR voting page, a Settings icon and the Conferences promo pop-up.
- **Too much text.** One short lead line per section; every explanation goes in a hover "i", never a sentence under a control.
- **Count and status pills.** No "15 delegations", "Observer", "queued speakers" or "Introduced" pills and no overlay pill headings. Counts are plain typography; observer is the megaphone.
- **Warning banners and info strips** ("veto power active", "Informational", "Accepting this will not change the session"). Use an "i" or nothing.
- **Repeating context.** Do not print the committee topic or motion topic on every history row, points line or heading; say what it was (GSL, moderated caucus) and how long.
- **Counting things nobody needs** (chair note counts, a "Ready to vote" count, delegations inside the Start button).
- **Controls that vanish or move.** Speaker buttons always render; RTR and Add time stay open until the motion changes; nothing jumps when a mode starts.
- **Anything clipped or overlapping:** a code running off screen, cut column headings, a cut Resume label, clipped suggestions, a floating panel over a dialog, a button under a list.
- **Layouts that change size** as content arrives (the old join page) or leave a dead gap (a max-width column inside a wider dialog).
- **Pop-ups where typing inline works** (add a seat, edit the topic). No big editing bubble; a pencil and the text becomes a field in place.
- **Loud or tacky colour:** full saturated orange, a skeuomorphic LCD timer, a massive green block. Pleasant, soft, on brand, still AA.
- **Dimming absent delegations.** It kills visibility in the room; colour appears only when they become P or PV.
- **Dead-weight options:** view toggles (A-Z / QUEUE), sort-by selectors (headers sort), a second voting-rules panel that duplicates Settings, two Back buttons, "Call first speaker", a "No current speaker" screen, a close X on a stage the chair should finish.
- **Status colour outside its moment:** P/PV tinting only during roll call; the observer toggle only in roll call, an indicator elsewhere.
- **Full-circle quorum capsules** ("kinda suck"). Half-circle tabs attached to the list.
- **A hammer in a circle** on primary buttons. Centred gradient buttons with a plain label.
- **Bands around flags or a blue globe** for an unknown seat. Initials in the sidebar, a user glyph elsewhere.
- **Emails with no images, repeated facts, or raw slugs** as names ("kenyamodelunitednations"). Use the display name.
- **Shipping one screen size.** Every change is checked from 1024x768 to 2560x1440; defaults (sidebar width, flag size) scale with the screen.
- **Em dashes** in anything a user reads.

---

## 8. WEAKEST AREAS (AUDIT 18 SEP 2026)

Method: public pages screenshotted on the dev server at 1280x800 (not signed in); signed-in surfaces read in code (last-change dates, icon and gradient use, hairline cards, pills, uppercase eyebrows, em dashes) and checked against the July slice audits (`10-` to `60-*.md`). Ranked worst first. Sessions chair and voting surfaces are not on this list: they are the current reference.

1. **Not-found and error screens.** There is no `src/app/not-found.tsx`, so every bad URL shows Next's default black "404 | This page could not be found". Session pages show a bare "Committee not found" line and one button. Direction: a branded not-found (ivory, the gavel mark, one line, links to Explore, Join and Sessions) and session error screens with an icon, what happened, and two ways forward.
2. **The blog (34 posts, the main organic entry point).** `/blog` is a stack of white text cards with no site nav, no images and no icons; an article is a plain text column. Direction: `SiteNav`, a cover image or illustrated diagram per post, category icons, read time as typography, in-article visuals (the motion ladder, a GSL diagram) and one designed call to action to run a free session.
3. **Faculty advisor view (`/advisor/[code]`).** Missed by the whole sessions round: rectangular 96x68 flags where every other session surface is round, a DM Mono phase chip, heavy 5xl titles. Direction: rebuild on `SeatCircleFlag`, the chair top bar and the Commenter floor layout (floor delegation left, queue right).
4. **Delegate phone view.** Half-migrated: `DelegateUI` has round flag discs, but `delegate/[code]/page.tsx` still draws emoji paperclips (📎) and ▲▼ glyphs, rectangular seat flags, and about 20 em dashes. Direction: Lucide icons, round flags throughout, the same glass cards as the chair's notifications, a sweep of copy.
5. **Transactional emails.** Most templates are text-first (the owner rejected the KenyaMUN email for having no images and too much information). Direction: one card template with the conference logo, committee emblem and country flag (the checkout card), one fact per line, never a slug, used by every allocation, payment and invite email.
6. **Chair and staff roles board (`/conferences/roles`).** A "coming soon" mascot page sitting in the nav and the sitemap as growth loop 4, with an em dash in its copy. Direction: ship the board, or take it out of nav and sitemap and replace it with a short alerts sign-up that shows how many roles are coming.
7. **`/create`, step one.** A shouting all-caps "SELECT COMMITTEE TYPE" over three cards where two are dead ("Coming soon", and "Coming H2 2026", which is already now). The first click of the free funnel is a disabled carousel. Direction: open straight on the MUN set-up and mention other formats in one quiet line.
8. **Manage plumbing pages: Jobs, Documents, Import, Financial aid.** Unchanged since early September: stacks of flat cream cards with 1px hairlines, one Lucide import each, no gradient or glass (July scores 1.9 to 2.8); Financial aid is a 40-line shell. Direction: the floating-panel and big-numeral language of the dashboard and assignment board, an icon per row, a designed empty state per list.
9. **Public conference sub-pages: `/awards` (honour roll) and `/reviews`.** 96 and 30 lines, no icons, no imagery. The honour roll is the most shareable moment a conference has. Direction: a ceremonial page with committee emblems, round flags, tiered award marks from the CV, and share cards.
10. **Conference detail page.** The hero is strong, but the section tabs are icons with no words (the icon-with-word-below rule is broken) and Overview is a long text wall, with committees and pricing hidden behind unlabelled tabs. Direction: label the tabs, lead with committees and the pricing medallion, pull quotes or photos into the overview.
11. **Explore directory.** Card names truncate at desktop width ("GloryMUN 20...", "MLSI MUN 20..."), uppercase letter-spaced eyebrows remain ("CONFERENCE DIRECTORY", "CONFERENCES AROUND YOU", "BACK TO CONFERENCES"), and each banner carries a stack of pills (format, date, price). Direction: let names wrap to two lines, price and dates as plain typography, drop the eyebrows.
12. **Em dashes across user-facing copy.** About 20 in English strings in `translations.ts` (voting rule sentences, resume errors) plus dozens in communications (38), applications (30), the live wall (47 across `CommitteeCard` and `LiveModals`), the apply flow (25) and the delegate page (21). Direction: one sweep with short sentences; keep a lone dash only as an empty-value placeholder in tables.
13. **The Conferences promo pop-up in sessions.** Owner verdict on 18 Sep: "way too AI generated". Direction: bigger headings, a third of the words, one image or the product itself instead of three icon tiles.
14. **Admin console.** Internal, so last, but `DataTab` alone has 19 uppercase letter-spaced labels and the console keeps growing (past conferences, detail pop-ups). Direction: apply the Settings type scale and tab colours before adding more to it.
