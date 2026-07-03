# Conferences Landing — Field Research & Concept Briefs

*Research run: 3 July 2026. Method: live WebFetch of each page + search fallback where a
fetch returned 403 or JS-empty (noted per row). This document feeds the three
`/conferences/landing-lab` variants directly — every build decision below cites a row here.*

---

## 1. Field register — event platform front pages

| Platform | Fetch | Above-the-fold anatomy | Primary CTA (exact) | Event highlighting | Trust / social proof | Traction drivers |
|---|---|---|---|---|---|---|
| **Eventbrite** | live | Browse-first. H1 "Discover the Best Local Events & Things to Do" + search bar with autocomplete; category row (Music, Nightlife, Food & Drink…) directly under it | Dual-path: "Create Events" (nav, repeated) vs. "Find my tickets"; no single dominant button | Category modules; "Browsing events in [location]" with "All / For you / Today / This weekend" tabs; "Top destinations" city image tiles ×15 | **Absent on home** — no numbers, testimonials or ratings | City pages, category pages, event-type pages, "For you" personalization tab |
| **Luma (lu.ma)** | live | Organiser-first minimalism. H1 "Delightful events start here." Almost nothing else — nav (Discover Events, Sign In), one sentence, one button | "Create Your First Event", centered under H1, sub-copy "Set up an event page, invite friends and sell tickets." | Home barely shows events; discovery lives at /discover (city calendars). The home page is a *supply-side* pitch | None on home. The product's ubiquity in tech circles *is* the proof | /discover city pages, subscribable calendars |
| **DICE (dice.fm)** | 403 → search fallback (Wikipedia, Trustpilot, Zendesk, Medium UX case) | Poster-first browse; brand line "Tickets for your kind of shows"; mission "get people out more". Square event artwork grid, city-scoped | App download / per-event "Find tickets" | Artwork-led cards; date/price/location/type browsing; famous urgency chip "Selling fast"; Spotify/Apple Music sync powers "tailored recommendations" on home | Trustpilot praise centres on ease + curation, not displayed on home | City scenes, genre pages, taste-based personalization |
| **Meetup** | live | Browse-first. H1 "The people platform. Where interests become friendships." then immediate local events for detected city | "Join Meetup" (hero, repeated); "Sign up for free" lower | Location-based "Events near [city]"; in-person vs online split; per-event attendee counts (1–171); dated rows "Sat, Jul 4 · 7:30 AM" | Attendee counts per event; "Since 2002" longevity; member testimonials in blog module | Popular-cities section, 10 category tiles, detected-location personalization |
| **Resident Advisor (ra.co)** | live | Editorial-first. No hero; magazine features lead ("A History of Ghettotech in Ten Tracks"), then city-scoped event listing | "View more events" after the city listing — navigation-based, zero pressure | **Date-grouped rows** ("Fri, 3 Jul / Sat, 4 Jul"), venue names, genre tags, raw attendee counts as the only urgency device | "RA Recommends" staff picks; bylined critics; label partnerships. No user star-ratings | City event pages, genre exploration, daily editorial ("Mix of the Day") |
| **Ticket Tailor** | 403 → search fallback (Trustpilot profile, G2, own SERP snippets) | Organiser-only B2B. "Sell tickets online" / "Easily create events and start selling tickets for free…" | Free-start CTA; low-fee positioning | n/a (no attendee discovery) | Heavy: "trusted by over 73,000 Event Creators across 120 countries"; Trustpilot embedded; concrete testimonial "8,000 tickets selling in one hour" | Fee calculator, comparison pages ("vs Eventbrite") |
| **Bizzabo** | live | B2B enterprise. H1 "The Bizzabo Event Experience OS", sub "The intelligence behind every great event" | "Get a Demo" — nav + hero | Product capability cards (Registration, Agenda, Badges…) | Logo wall (Amazon, HubSpot, Bloomberg, FT…); G2 4.5★ "437 reviews", Capterra 4.5★, Gartner 4.5★; benchmark-report lead magnet | Analyst reports, customer stories, resource hub |
| **Airbnb Experiences** | 403 → search fallback (airbnb newsroom, Skift, Arival) | Browse-first discovery integrated into Explore tab; 2025 relaunch emphasises **vetted quality** ("unique, interesting, differentiated and high quality") | Per-card booking; "Airbnb Originals" flagship module | Curated rows by destination/dates; 19 categories, 650+ cities; cards carry photo, price, rating, review count; social layer ("see who else is going") | Host vetting story ("expertise, reputation, authenticity"); star ratings + review counts on every card | City/category pages, Originals editorial, profile network effects |
| **mymun** (direct competitor) | live | Browse-first. H1 **"Find your next MUN conference"**, sub "Browse Model United Nations (MUN) conferences worldwide, then apply and pay in one place"; 4 featured conference cards; continental grid | "Browse conferences" under hero; "Apply now" on cards | Cards = image + title + location + date **only** — no fees, no delegate counts, no ratings. Continental grouping with counts ("Asia 307 conferences", "Online 263") | Scale numbers only (conference counts per region). **No testimonials, no ratings, no delegate-side proof** | Regional filter pages, online/in-person split, blog SEO, Masterclass/glossary content |

### What the register actually says

1. **Two-sided platforms hedge; single-audience pages convert.** Eventbrite's home has no
   dominant CTA because it serves two masters. Luma and Ticket Tailor pick one audience and
   are the clearest pages in the set. → Each variant must *pick a primary audience* and serve
   the other two through clearly subordinate paths.
2. **Date-grouping is the native grammar of event discovery** (RA, Meetup, DICE). Calendar
   position is the #1 decision fact for a delegate planning a term.
3. **Attendee counts are the cheapest honest urgency device** (Meetup, RA). MUN equivalent:
   expected delegates + days-until-start. DICE's "Selling fast" is the escalated version.
4. **mymun leaves the entire "informed decision" lane open.** Its cards omit fee, size and
   any review signal — the three facts a delegate (or the teacher paying) needs. Gavelling's
   data model has all three *today*.
5. **Editorial curation beats infinite inventory when inventory is small** (RA, Airbnb
   Originals). With 3–4 listed conferences, a curated "season" reads as taste; a search-and-
   filter empty state reads as failure.

---

## 2. State-of-the-art 2026 — craft standards

Pages studied live: **linear.app**, **stripe.com**, **vercel.com**, **raycast.com**; plus
2025/26 round-ups (Orizon "10 favourite landing pages, summer 2025", Thunderclap,
Line25, Awwwards landing-page gallery) to identify recurring citations.

Key observations:

- **Linear** — "The product development system for teams and agents." Premium through
  *subtraction*: one primary CTA, static screenshots as proof, "gentle rather than dramatic"
  type scale, testimonials without superlatives.
- **Stripe** — outcome-first headline; quantified trust ("US$1.9T processed", "99.999%
  uptime", "50% of Fortune 100"); one recognisable brand shape (the diagonal); copy "avoids
  superlatives; relies on specific metrics".
- **Raycast** — "Your shortcut to everything." Four words, then two download buttons. Motion
  restraint: one subtle keyboard animation. "Premium emerges through absence: no stock
  photography, minimal color."
- **Vercel** — trust through *customer narratives with numbers* ("Zapier serves over 100
  million monthly visits on Vercel") instead of logo walls.
- **Round-up consensus**: hierarchy readable "in milliseconds"; one laser-focused CTA;
  specificity in headline copy; scroll-triggered motion only where it explains something;
  editorial imagery over stock.

### The 2026 craft checklist (anti-"AI-look" benchmarks — every variant is judged against these)

1. **One idea per viewport.** The first screen makes exactly one claim and offers exactly one
   primary action. Secondary paths are typographically subordinate, not sibling buttons.
2. **Numbers over adjectives.** Every trust statement is a specific, verifiable figure drawn
   from live data ("1,250 delegates expected", "4.5★ from delegates") — never "world-class",
   "seamless", "revolutionize".
3. **The product/data is the imagery.** Real conference banners, real review text, real fees.
   Stock photos only as *environment*, never as meaning.
4. **One memorable move per page.** A single distinctive structural device (Stripe's diagonal,
   Raycast's keyboard). Everything else is quiet.
5. **No uniform card grids.** Identical-padding 3-up/4-up icon cards are the #1 "AI-generated"
   tell. Vary row anatomy; prefer ledgers, headliner-plus-list, split-screens, numbered lists.
6. **Gentle type scale, one dramatic moment.** A single oversized display setting (the
   headline or the featured event) — everything else within a calm 12–20px band.
7. **Motion restraint.** Hover states and at most one entrance/scroll effect that carries
   meaning. No parallax carnival, no floating blobs.
8. **Label discipline.** Micro-labels (DM Mono) do real work (dates, fees, counts) — never
   decorative eyebrow spam ("✦ POWERFUL FEATURES ✦").
9. **Load-to-action < 1 scroll.** The primary CTA is reachable and understandable without
   scrolling on a 13" laptop *and* a 375px phone.
10. **Honest emptiness.** With a 3-item inventory, design for 3 items — headliner + supporting
    acts — not a grid template that begs to be filled.

---

## 3. What this means for an MUN platform

**Audiences, in economic order:**

| Audience | Job on this page | Decision facts | Best pattern fit |
|---|---|---|---|
| Delegates (16–25) | find + apply to a conference | date vs term calendar, city, fee, size, vibe, reviews | DICE/RA discovery, Airbnb card trust |
| Organisers | list + run a conference | fees (zero), tooling breadth, proof someone real uses it | Luma/Ticket Tailor supply pitch |
| Chairs/staff | find open roles | which conferences are hiring, how to apply | Meetup "join" mechanics, jobs-board rows |
| Faculty advisors | vet safety/legitimacy | institution names, fees, reviews, scale | Bizzabo-grade trust artifacts |

**Discovery axes the data supports today:** date (start_date ordering), city/country, fee
(amount + currency, incl. FREE), scale (expected_delegates), rating (conference_reviews,
public SELECT). mymun exposes *none* of fee/scale/rating on its cards — this is the wedge.

**MUN-specific trust signals available now:** delegate counts (LIMUN 1,250), institution-grade
edition lineage (LIMUN — running since 2000; "2027" in the name does that work), real review
stars + quotable review text (4 LIMUN reviews, 4.5★ average, e.g. *"My third LIMUN and still
the gold standard."*), committee rosters with topics, open chair/secretariat roles.

**What Gavelling's data can actually power today:** 3 public conferences (LIMUN 2027 London
with real theatre-audience banner + wreath logo; TESTMUN San Salvador, free; GAVMUN1
Guatemala), live reviews for LIMUN, committees per conference, the /conferences/roles board,
zero-platform-fee organiser offer. Design for *this* inventory (craft rule 10), with modules
that scale as inventory grows.

---

## 4. Concept briefs

Three theses, not three skins. Each names its pattern ancestry, owns one audience, and meets
the checklist above.

---

### V1 — "Stagefront" · Dice/RA-style poster-first browse

**Conversion thesis.** Delegates don't comparison-shop first — they *fall for a conference*,
then rationalise. Lead with the most cinematic asset we own (LIMUN's theatre-audience banner)
treated the way DICE treats a headline show and RA treats a city weekend: imagery, dates and
attendance, zero sales voice. Desire first, facts one scroll later.

**Named patterns.** DICE poster-first browse + "selling fast"-class urgency (rendered as a
days-until countdown); RA date-grouped listing rows with attendee counts; Airbnb-style rating
on the headliner.

**Headline / CTA copy.**
- H1: **"Go where the debate is."**
- Sub: "Real conferences, real committee rooms — from London to San Salvador. Pick your
  weekend."
- Primary CTA: **"Find a conference"** → /conferences/explore
- Subordinate text links: "Organising one? List it free" → /conferences/new · "Chair or
  staff a committee" → /conferences/roles

**Above-fold wireframe.** Full-bleed LIMUN banner to the viewport top (SiteNav `overlay`),
forest scrim bottom-up. Bottom-left: DM Mono kicker with live count ("3 CONFERENCES ON THE
BOARD"), H1 in one dramatic size, sub, one gold CTA. Bottom-right (desktop): the headliner's
own facts as a quiet caption — LIMUN 2027 · 19–21 Feb · ★ 4.5 — anchoring the photo to a real
event, not stock.

**Event-highlight module.** "On the marquee": LIMUN as a full-width headliner row (logo
free-floating with drop-shadow, name at display size, date, city, fee, delegates, star row,
days-until chip), then the remaining conferences as slim RA-style date rows grouped by month.
No grid. Concluded/future states handled by timing tone.

**Craft-standard compliance.** One memorable move = photo-to-the-top hero with marquee
headliner. Numbers over adjectives (counts, fee, stars). No card grid — headliner + ledger
rows. Single dramatic type moment (H1). Motion: one hover lift + scrim only.

---

### V2 — "The Record" · Eventbrite-search utility × Stripe numeric precision

**Conversion thesis.** The delegate's (and the funding teacher's) real anxiety is
*information asymmetry*: what does it cost, how big is it, is it any good? mymun hides all
three. Put every decision fact in a typeset index with a working search on top, and the page
converts on **confidence** — the Kayak/Stripe move: precision as brand.

**Named patterns.** Eventbrite search-first utility (search bar as the hero's centre of
gravity); mymun's browse-first H1 formula inverted from vague to factual; Stripe quantified-
trust strip; RA ledger typography.

**Headline / CTA copy.**
- H1: **"The conference circuit, on the record."**
- Sub: "Dates, fees, delegate counts and real reviews — every listed conference, before you
  commit a weekend."
- Primary CTA: the **search field itself** ("Search name, city, or acronym…"), Enter →
  explore. Button label: **"Search"**.
- Stat strip under search (live-computed): "3 conferences · 1,750 seats · 3 countries".
- Subordinate: "List your conference — free for organisers" → /conferences/new · "Open
  chairing roles" → /conferences/roles.

**Above-fold wireframe.** No hero image. Cream field, oversized typographic H1 (the one
dramatic type moment), search bar directly beneath, stat strip in DM Mono. First index rows
visible at the fold's edge so the ledger pulls the scroll.

**Event-highlight module.** "The index": a full-width table-ledger — DM Mono date column,
Outfit name column with acronym + city, then fee / expected delegates / rating columns in
tabular figures, hairline rules, generous row height. LIMUN row carries its logo and a
review pull-quote set as a footnote line. Mobile: rows restack into two-line entries, same
hairlines. Below: one quiet organiser band (Ticket Tailor logic: "zero platform fees" +
one concrete proof line) and a roles line.

**Craft-standard compliance.** One memorable move = the ledger itself. Label discipline: every
mono label is a real fact. No cards at all. Honest emptiness: a 3-row ledger still looks
deliberate. Motion: row hover tint only.

---

### V3 — "First Gavel" · Luma-style supply-side minimalism

**Conversion thesis.** A directory is only as good as its supply. Luma's home ignores
attendees and sells *hosting* in one sentence — because each new event page recruits its own
attendees. Gavelling's sharpest economic weapon is **zero platform fees** (Ticket Tailor's
low-fee positioning, minus the fee entirely). Pitch organisers with one claim + running
proof; delegates get a clearly subordinate path.

**Named patterns.** Luma "Delightful events start here" one-claim hero + single CTA; Ticket
Tailor fee-first positioning with concrete testimonial mechanics; Vercel customer-narrative
proof ("LIMUN 2027 runs on Gavelling — 1,250 delegates expected") instead of a logo wall.

**Headline / CTA copy.**
- H1: **"Run the conference. Keep the fees."**
- Sub: "Registration, allocations, documents and live committee sessions — end-to-end on
  Gavelling. Zero platform fees for organisers."
- Primary CTA: **"Start your conference"** → /conferences/new
- Secondary (ghost): **"Browse conferences"** → /conferences/explore
- Tertiary line: "Rather chair one? See open roles" → /conferences/roles

**Above-fold wireframe.** Split screen. Left (forest panel, ivory type): kicker, H1, sub, CTA
pair. Right: proof, not decoration — the LIMUN banner cropped as a window with its wreath
logo free-floating and a caption narrative ("LIMUN 2027 · runs on Gavelling · 1,250
delegates expected · ★ 4.5 from delegates"), with a real review quote beneath. Mobile: left
panel stacks above proof.

**Event-highlight module.** Proof over browsing: the customer-narrative window (above), one
verbatim delegate review as a typeset editorial quote, then a numbered capability list
(01 Registration & allocations / 02 Document portal / 03 Live committee sessions / 04
Automated comms) set as an *index list*, explicitly not icon cards. Closing band flips the
audience: "Here to delegate? 3 conferences are open now →".

**Craft-standard compliance.** One idea per viewport (fee claim). One memorable move = split
hero where the right half is live customer data. Numbered list instead of icon-card grid.
Numbers over adjectives throughout. Motion: none beyond hovers.

---

## 5. Five decision-relevant findings (executive summary)

1. **mymun shows no fee, size or rating on any card** — Gavelling's richer data rendered
   plainly is instant, defensible differentiation (drives V2, and the fact rows in V1/V3).
2. **Single-audience homes out-convert dual-path homes** (Luma/Ticket Tailor vs Eventbrite's
   CTA soup) — hence three variants that each *pick* an audience instead of hedging.
3. **Date-grouping + attendance counts are the native grammar of event discovery** (RA,
   Meetup, DICE) — the season ledger and days-until chips come straight from this.
4. **2026 premium = subtraction + specificity** (Linear, Raycast, Stripe): one claim, one CTA,
   real numbers, real product imagery, one memorable structural move — codified in the
   10-point checklist in §2.
5. **With 3 listings, curation beats search theatre** (RA editorial, Airbnb Originals):
   headliner-plus-supporting-acts layouts make small inventory read as taste, not emptiness.
