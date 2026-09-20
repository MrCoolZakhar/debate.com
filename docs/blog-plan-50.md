# 50 new MUN guides: ranked content plan

Status: PLAN ONLY. Nothing here is written yet. The blog template is being redesigned in
parallel; writers follow this document, the template agent owns the rendering.

Scope of the ask (owner, 20 Sep 2026): "Identify 50 new very useful pages for different
levels of MUN delegates, organisers, chairs, faculty advisors, literally everything about
MUN possible and add them. Then index all of it."

---

## 0. What exists today, and what that means for this plan

34 posts live in `src/app/blog/posts.ts`. The sitemap is generated from that manifest, so a
post cannot be left out of the sitemap by accident.

**Read this before anything else: the blog template was rebuilt in parallel with this plan
(20 Sep 2026) and two of the three problems below are already solved.** The manifest is no
longer `{slug, title, description}`. It now carries `category` (one of five shelves:
`chairing`, `delegates`, `procedure`, `organisers`, `software`), `date`, optional `updated`,
`readingMinutes` and optional `featured`, with the shelf's icon, accent and cover art in
`src/components/blog/blogTaxonomy.ts`. `RelatedGuides` moved to `src/components/blog/` and
now picks same-shelf siblings first (up to three of six) topped up from the manifest ring.
Every writer must read `docs/blog-authoring.md` and add the full manifest entry, not the old
three fields.

What that changes for this plan:

1. **Topical related links: SOLVED.** Each of the 50 entries below names a `category` by
   implication through its cluster; assign it explicitly when adding the manifest entry (the
   mapping is in section 5). The one thing the new component does not do is honour an
   explicit per-post `related` list, so the in-body contextual links named in each entry
   below are still the only way to pass link equity to a specific post. Writers must not
   skip them. If a `related?: string[]` field is ever added, the "links out to" lists below
   are the data for it.
2. **`/blog` is no longer a flat list. Shelf hub URLs are an upside, not a blocker.**
   The index is server-rendered, groups every post under its shelf as a real `<a href>` card,
   and gives each shelf an `id` anchor, so `check:indexability`'s crawl-link rule is
   satisfied for all 84 posts without any further work. What is still missing is an
   *indexable* `/blog/<shelf>` URL: there is no such route and nothing shelf-shaped is in
   `sitemap.ts`, so five obvious mid-funnel landing pages ("MUN chairing guides", "MUN guides
   for organisers") do not exist. **Recommended, not required:** five shelf hub pages, one
   per existing category, each answering 200, self-canonical, with a title, an h1 and real
   editorial text in the raw HTML, listed in `sitemap.ts`, and linked from `/blog` and from
   `FooterLegal`. Reuse the existing five categories; do not invent a sixth taxonomy.
3. **Dates: the schema is fixed, the discipline is on the writers.** `date` is first
   published and `updated` is the content date; the sitemap's `lastmod` is `updated ?? date`.
   The old `BLOG_DEFAULT_DATE` fallback is gone, so a missing date is now a build-time
   problem rather than a silent lie, which is the right trade. Rule for this project: set
   `date` to the real publication date and leave `updated` out entirely until the content
   genuinely changes. Priority banding is still a judgement call: keep the four
   competitor-alternative posts and `free-mun-tools` at 0.9, give the five shelf hubs and
   the ten pillar posts 0.85, everything else the 0.8 default.

Also true and worth stating plainly: `npm run check:indexability` and `npm run check:og`
must pass after this ships. `pageMetadata()` already makes a missing OG image structurally
impossible, so the OG side is mostly free; the crawl-link rule is the one that will fail if
the hubs are client-rendered.

### Competitive read (searched 20 Sep 2026)

Who actually ranks for MUN informational queries today:

- **bestdelegate.com** — still the authority on delegate craft (crisis directives, research,
  chairing series, "is MUN valuable for college admissions"). Much of it is 2012-2019 and
  reads it. Beatable on freshness and structure, not on domain authority.
- **wisemee.com** — the most aggressive current SEO operator. Owns template and glossary
  queries ("MUN glossary", "MUN study guide template", "how to write MUN crisis directive",
  "MUN crisis rules of procedure"). Thin-ish pages, heavy internal linking. This is the
  direct competitor for most of the delegate cluster.
- **blog.modeldiplomat.com** — new, and moving straight at the ORGANISER keywords we want
  ("MUN Budget Template: Organize Conference Finances 2026", "Model UN Country Profile").
  If we do not take the secretariat cluster in the next two quarters, they will.
- **allamericanmun.com, munprep.org, imun.cloud, munual** — mid-tier, topic-specific.
- **mymun.com/blog** — thin, sporadic ("How to Research Your Country for MUN"). Our four
  competitor-alternative posts already engage them commercially; the informational blog is
  not where they compete.
- **amun.org, nmun.org, un.org, university LibGuides** — high-trust, low-frequency. They own
  "getting started with Model United Nations" institutionally and will not be displaced on
  that exact phrase, which is why item 1 below targets the question form, not the brand form.

**The strategic gap:** almost nobody is writing well for the secretariat. bestdelegate
abandoned it, mymun sells to them but does not write for them, and modeldiplomat has just
started. The secretariat cluster (items 30-41) is where Gavelling both has the least
competition and the only real commercial conversion. It is also where we can say something
nobody else can: the organiser pays nothing.

### Rules for every writer on this project

- House voice, taken from the existing posts: second person, short declarative sentences,
  concrete numbers, no hype. A short opening paragraph that states the stakes, then H2s that
  are questions or tasks. One italic callout per 2-3 H2s with the thing an experienced
  person would tell you. Closing CTA block, one line, honest.
- **No em dashes in user-facing copy** (CLAUDE.md section 8). Use a comma, a colon or a full
  stop.
- Match the existing file shape: `pageMetadata()`, `articleSchema`, `breadcrumbSchema`, the
  `s` style object, `<RelatedGuides currentSlug=... />`, the forest CTA. The template agent
  may change this; do not invent a second shape in the meantime.
- Every claim about how Gavelling behaves must be true. `mun-technology-guide` already
  carries one false claim (it says the chair view "can be mirrored to a projector"; there is
  no projector view). Do not add more. When a post mentions a Gavelling feature, the writer
  checks it in the product first.
- Cite real sources for factual claims (UN Digital Library, treaty collection, conference
  handbooks). Do not invent statistics. Where a number varies by conference, say so.
- **Never state a traffic figure in the post or in this plan.** No keyword volumes were
  measured. Everything labelled "high demand" below is a judgement call from SERP shape and
  competitor coverage.

---

## 1. The 50, ranked

Rank = expected value, blending judged search demand, our realistic chance of ranking, and
commercial value to Gavelling. Ranks 1-10 are the ones to write first.

Legend for **Cannibalisation**: every entry names the existing post it sits beside and how
the two are kept apart. "Clear" means no existing post targets that query set.

---

### 1. What Is Model UN? A Complete Beginner's Explanation
- **Slug:** `/blog/what-is-model-un`
- **Audience:** new delegate, curious student, parent, teacher considering a club
- **Level:** beginner
- **Intent:** informational, top of funnel. Someone has heard the phrase and wants to know
  what actually happens in a room.
- **Primary keyword:** what is Model UN
- **Secondary:** how does Model UN work, Model United Nations explained, what do you do in
  Model UN
- **Promise:** Understand exactly what happens in a Model UN committee, from roll call to
  the final vote, in ten minutes.
- **Outline:**
  - The one-paragraph answer, placed above everything else so it can be lifted as a snippet
  - What a committee room physically looks and sounds like (40 placards, a dais, a clock)
  - The day in order: roll call, setting the agenda, speakers list, caucuses, drafting,
    voting
  - What a delegate is actually being asked to do: represent a government, not yourself
  - The three things that surprise first-timers (you are not debating your own opinion,
    most work happens in unmoderated caucus, procedure is a tool not a test)
  - Who runs it: chairs, secretariat, crisis staff, faculty advisors
  - High school vs university vs online
  - Where to start this month
- **Length:** 1,800-2,200 words
- **Assets:** one annotated diagram of a committee room (dais, GSL screen, blocs); a simple
  table of the day's phases against what a delegate does in each. No download needed.
- **Links out to:** `mun-glossary`, `mun-for-beginners`, `mun-committee-types`,
  `mun-rules-of-procedure`, `mun-delegate-tips`, `is-mun-worth-it`
- **Links in from:** every beginner-cluster post, the `/blog` hub, and the homepage crawl
  nav. This is the cluster's pillar; it should be the most-linked page on the blog.
- **Cannibalisation:** Clear. Nothing in `posts.ts` defines the activity. `mun-delegate-tips`
  assumes you already know what MUN is; this one is the page that should be feeding it.

---

### 2. MUN Glossary: Every Term, Explained Plainly
- **Slug:** `/blog/mun-glossary`
- **Audience:** new delegate, faculty advisor, parent
- **Level:** beginner
- **Intent:** reference, repeat-visit. Someone heard "unmod" or "signatory" and needs it now.
- **Primary keyword:** MUN glossary
- **Secondary:** Model UN terms, MUN vocabulary, MUN abbreviations
- **Promise:** Every word you will hear in a committee room, defined in one sentence, with
  the ones people get wrong flagged.
- **Outline:**
  - A-Z list, each term: one-sentence definition, then one line of "what it means in
    practice"
  - Grouped sections so the page is skimmable: procedure, documents, people, debate, crisis,
    conference admin
  - The terms that differ by circuit, marked as such (unmod, lobbying, placard, resolution
    vs clause numbering)
  - The five terms beginners consistently misuse (signatory vs sponsor, motion vs point,
    working paper vs draft resolution, abstain vs pass, moderated vs unmoderated)
  - Deep links: every term that has a full guide links to it
- **Length:** 2,500-3,000 words but structurally a list, not prose. 110-140 terms.
- **Assets:** an in-page A-Z jump bar with anchor links; a printable one-page PDF of the
  40 most-used terms (see section 4, this is a download). FAQPage or DefinedTermSet schema
  is worth adding here.
- **Links out to:** effectively every post on the blog. This is the second hub.
- **Links in from:** `what-is-model-un`, `mun-for-beginners`, all four procedure posts,
  `start-mun-club`
- **Cannibalisation:** Clear. wisemee and munprep own this today and their pages are thin
  definition lists with no practice notes. The "what it means in practice" line and the
  misuse section are the differentiator.

---

### 3. MUN Position Paper Examples: Three Full Papers, Annotated
- **Slug:** `/blog/mun-position-paper-examples`
- **Audience:** new delegate, experienced delegate, faculty advisor reviewing drafts
- **Level:** beginner to intermediate
- **Intent:** transactional-informational. They want to see one, not read about one.
- **Primary keyword:** MUN position paper example
- **Secondary:** position paper sample, Model UN position paper template, position paper
  format example
- **Promise:** Three complete position papers at three quality levels, with the chair's
  margin notes on each.
- **Outline:**
  - Why an example beats a format guide (and a pointer to the format guide)
  - Paper 1: a GA topic, strong. Full text, then annotations on what earns the mark
  - Paper 2: a Security Council topic, strong but different in shape (shorter, harder on
    precedent and voting record)
  - Paper 3: a mediocre paper, full text, annotated with exactly why a chair scores it low
  - The annotation key: what chairs actually mark against
  - Side-by-side of the same paragraph written badly and well
  - Format variations by circuit (THIMUN, UNA-USA, conferences that grade, conferences that
    do not)
  - Download the three papers plus a blank template
- **Length:** 2,400-2,800 words including the three full papers
- **Assets:** three papers rendered as styled document blocks with margin callouts;
  downloadable .docx template and the three examples as PDF. This is the most
  download-driven post in the plan.
- **Links out to:** `mun-position-paper-guide` (the format reference), `mun-country-research`,
  `mun-clause-phrases`, `mun-opening-speech`
- **Links in from:** `mun-position-paper-guide` (must link out to this prominently, near the
  top, not just in Related), `mun-conference-preparation`, `mun-club-curriculum`
- **Cannibalisation:** **Complements `mun-position-paper-guide`.** Strict split: the existing
  post owns "how to write / format / mistakes" and must NOT grow an examples section; this
  post owns "show me one" and links back for the how-to rather than repeating it. Each links
  to the other in the first 150 words.

---

### 4. Preambulatory and Operative Clauses: The Complete Phrase List
- **Slug:** `/blog/mun-clause-phrases`
- **Audience:** delegate at every level, chair checking a draft
- **Level:** beginner to intermediate
- **Intent:** reference, used mid-drafting with the page open in another tab.
- **Primary keyword:** operative clauses list
- **Secondary:** preambulatory phrases, MUN clause starters, operative phrases Model UN
- **Promise:** Every accepted preambulatory and operative phrase, with what each one commits
  the committee to and which ones a chair will strike.
- **Outline:**
  - The two-minute rule: preambulatory clauses describe, operative clauses act
  - Full preambulatory phrase list, grouped by what they do (noting, recalling, alarmed,
    bearing in mind), with an example line under each
  - Full operative phrase list, ordered by force: from "Requests" up to "Decides" and
    "Demands"
  - Which verbs a General Assembly committee is actually allowed to use, and which belong
    only to the Security Council. This is the section nobody else writes and chairs care
    most about
  - Punctuation and numbering rules, with the three formatting errors that get papers sent
    back
  - Sub-clauses and sub-sub-clauses: when to use them, when they hide a weak idea
  - Twelve phrases to avoid because they say nothing
  - Copy any phrase with one tap
- **Length:** 1,900-2,300 words, mostly structured lists
- **Assets:** copy-to-clipboard on every phrase (see section 4, this is closer to a tool than
  an article); a printable two-page PDF; a table mapping operative verb to binding force to
  which organ may use it.
- **Links out to:** `mun-resolution-writing`, `mun-resolution-example`,
  `mun-working-paper-guide`, `mun-amendment-guide`
- **Links in from:** `mun-resolution-writing` (prominently), `mun-working-paper-guide`,
  `mun-position-paper-examples`
- **Cannibalisation:** **Complements `mun-resolution-writing`.** The existing post covers
  clause types conceptually; it keeps that and links here for the list. This post must not
  teach resolution structure. Currently owned by scattered PDFs and wisemee; a genuinely
  complete, correctly-scoped list wins it.

---

### 5. Model UN Resolution Example: A Full Resolution, Line by Line
- **Slug:** `/blog/mun-resolution-example`
- **Audience:** delegate, chair vetting submissions
- **Level:** intermediate
- **Intent:** transactional-informational, same shape as item 3.
- **Primary keyword:** MUN resolution example
- **Secondary:** sample Model UN resolution, draft resolution example, Model UN resolution
  template
- **Promise:** One complete draft resolution, annotated clause by clause, plus the amended
  version that actually passed.
- **Outline:**
  - The header block: committee, topic, sponsors, signatories, and what each of those four
    lines commits you to
  - The full resolution text, realistic length, on a real topic
  - Annotation on each preambulatory clause: why it is there, what it is doing politically
  - Annotation on each operative clause: what it costs, who pays, who would vote against
  - The same resolution after three amendments, showing what changed and why it passed
  - Why this one passed: the vote count and the blocs behind it
  - What a chair looks for before accepting it for debate
  - Template download
- **Length:** 2,000-2,400 words
- **Assets:** the resolution as a styled document with margin annotations; a before/after
  amendment diff; .docx template download.
- **Links out to:** `mun-resolution-writing`, `mun-clause-phrases`, `mun-amendment-guide`,
  `mun-working-paper-guide`, `mun-bloc-building`
- **Links in from:** `mun-resolution-writing`, `mun-amendment-guide`, `mun-clause-phrases`
- **Cannibalisation:** **Complements `mun-resolution-writing` and `mun-amendment-guide`.**
  Three resolution pages is the maximum this cluster can carry without splitting its own
  authority. The split is: writing (process) / phrases (reference) / example (artefact).
  Writers must check the other two before adding any section.

---

### 6. Model UN for Beginners: Your First Conference, Hour by Hour
- **Slug:** `/blog/mun-for-beginners`
- **Audience:** new delegate, nervous first-timer
- **Level:** beginner
- **Intent:** informational with high anxiety. "What will actually happen to me."
- **Primary keyword:** Model UN for beginners
- **Secondary:** first MUN conference tips, first time Model UN, MUN beginner guide
- **Promise:** A walkthrough of your first conference from registration desk to closing
  ceremony, with the thing to do in each hour.
- **Outline:**
  - Before you arrive: the three things worth doing the night before
  - Registration and the first ten minutes in the room
  - Roll call: what to say, and the present vs present-and-voting decision explained properly
  - Setting the agenda: the first vote you will take and why it matters more than it looks
  - Your first speech: what to do if you have nothing prepared
  - The first unmoderated caucus: how to join a bloc when you know nobody
  - Lunch, and what experienced delegates do with it
  - Day two: drafting, and how to get your name on a paper
  - Voting procedure and the closing
  - The five things nobody tells first-timers
- **Length:** 2,000-2,400 words
- **Assets:** a timeline graphic of a two-day conference; a small "what to say" phrase box
  for roll call, motions and yields.
- **Links out to:** `what-is-model-un`, `mun-glossary`, `mun-conference-preparation`,
  `mun-opening-speech`, `mun-dress-code`, `mun-common-mistakes`
- **Links in from:** `what-is-model-un`, `mun-conference-preparation`, `start-mun-club`,
  `mun-club-curriculum`
- **Cannibalisation:** **Complements `mun-conference-preparation`.** That post is a
  week-by-week prep checklist BEFORE the conference; this one is the narrative of the days
  themselves. Keep the prep timeline out of this post entirely and link to it once.

---

### 7. How to Start a MUN Conference From Scratch
- **Slug:** `/blog/start-a-mun-conference`
- **Audience:** secretariat/organiser, ambitious student, school or university society
- **Level:** intermediate to advanced
- **Intent:** high-intent planning. Someone has decided to do it and needs the shape of the
  whole job.
- **Primary keyword:** how to start a MUN conference
- **Secondary:** start a Model UN conference, organise a MUN conference, create your own MUN
  conference
- **Promise:** The whole job, from the first meeting to the closing gavel, with what it
  genuinely costs and what you can skip in year one.
- **Outline:**
  - The decision before every other decision: how many delegates, how many days
  - Year-one scope that actually works: 4-6 committees, 120-200 delegates, one venue, two
    days. Why bigger fails
  - The founding team: the five roles you cannot do without, and the ones that can wait
  - Institutional approval: who has to say yes at a school and at a university, and what
    they will ask for
  - Money: the minimum viable budget, what has to be paid before any fee arrives, and the
    cash-flow trap that kills first-year conferences
  - Committees and topics: choosing a slate that a first-year chair pool can actually run
  - The 8-month calendar, as a table
  - What to outsource, buy, or do by hand in year one
  - Going from year one to year two: what to write down before you forget it
- **Length:** 2,600-3,200 words
- **Assets:** an 8-month Gantt-style table; a minimum-viable-budget table with line items;
  a founding-team org chart.
- **Links out to:** `mun-conference-budget`, `mun-secretariat-roles`,
  `mun-conference-venue-logistics`, `mun-conference-marketing`, `mun-country-allocation`,
  `mun-conference-planning`, `mun-director-guide`
- **Links in from:** `mun-conference-planning` (prominently), `mun-director-guide`,
  `start-mun-club`, `mun-team-fundraising`, and the organiser hub
- **Cannibalisation:** **Complements `mun-conference-planning`.** Real overlap risk, handle
  carefully. The existing post is a timeline for someone who already has a conference to
  plan. This post is for someone with nothing: it owns the decision to do it at all, scope,
  approval, founding team and first-year economics, and defers the timeline to the existing
  post rather than repeating it. If a writer finds themselves rewriting the eight-months-out
  section, stop and link instead.

---

### 8. MUN Conference Budget: What It Costs and How to Set Your Fees
- **Slug:** `/blog/mun-conference-budget`
- **Audience:** secretariat/organiser, treasurer, faculty advisor signing off
- **Level:** intermediate to advanced
- **Intent:** high-intent, spreadsheet-in-hand. They are about to commit money.
- **Primary keyword:** MUN conference budget
- **Secondary:** Model UN conference costs, how much does it cost to run a MUN conference,
  MUN registration fee pricing
- **Promise:** A real line-item budget, how to price a delegate fee that covers it, and the
  four costs first-time organisers forget.
- **Outline:**
  - The two budgets you need: the committed-cost budget and the per-delegate budget
  - Every line item, grouped: venue, catering, printing, materials, technology, awards,
    insurance, staff costs, contingency
  - Venue is almost always the largest single line. How to size it before you sign
  - Setting the delegate fee: cost per delegate, plus contingency, plus the margin you need
    to survive under-registration
  - Break-even maths, worked, at three conference sizes
  - The four forgotten costs: payment processing, insurance, accessibility provision, and
    the no-show gap between registered and paid
  - Fee structures that work: early bird, delegation rates, observer and advisor rates,
    financial aid
  - Cash flow: what you pay before any money arrives, and how to stage deposits
  - Contingency: 15-20 percent is the widely used figure and why
  - What software costs, and the per-user-per-day trap. Some platforms charge the organiser
    per participant per day, which scales against you exactly as the conference succeeds.
    Gavelling charges the organiser nothing and the organiser is merchant of record through
    their own Stripe account
  - Download the budget spreadsheet
- **Length:** 2,600-3,000 words
- **Assets:** the full line-item table; three worked break-even tables; **a downloadable
  budget spreadsheet (XLSX)**, which is the real asset here and should be built before the
  article is written.
- **Links out to:** `start-a-mun-conference`, `mun-conference-registration-payments`,
  `mun-conference-sponsorship`, `mun-conference-venue-logistics`, `best-mun-software-2026`,
  `mymun-alternative`
- **Links in from:** `start-a-mun-conference`, `mun-conference-planning`,
  `mun-conference-sponsorship`, `mun-director-guide`, `mun-team-fundraising`
- **Cannibalisation:** Clear. Nothing on the blog touches conference money. modeldiplomat
  has a budget-template post and is the one to beat; beat it with real numbers and a
  spreadsheet that works, not a listicle.

---

### 9. THIMUN Rules of Procedure: The Complete Guide
- **Slug:** `/blog/thimun-rules-of-procedure`
- **Audience:** delegate and chair on the European, Asian and international circuit
- **Level:** intermediate
- **Intent:** reference. A delegate trained on North American procedure is about to attend a
  THIMUN-affiliated conference, or vice versa.
- **Primary keyword:** THIMUN rules of procedure
- **Secondary:** THIMUN procedure, THIMUN style MUN, lobbying THIMUN
- **Promise:** How debate actually runs under THIMUN procedure, and exactly what changes if
  you learned MUN in North America.
- **Outline:**
  - What THIMUN procedure is and which conferences use it
  - The structural difference: debate runs through formal speakers lists and yields, without
    the caucus motions of the North American circuit
  - Lobbying and merging: the first day is for building resolutions, not debating them
  - The resolution-centred debate model: time for and against a resolution, then amendments
  - Amendments as the centre of gravity, including amendments to the second degree
  - Points of information: the mechanic North American delegates find hardest
  - Speaking mechanics: recognition, yields, the chair's discretion
  - No awards at THIMUN itself, and what that changes about how the room behaves
  - Voting: procedural vs substantive, and what the thresholds are
  - A conversion table: this is the North American thing, this is the THIMUN equivalent, this
    has no equivalent
- **Length:** 2,400-2,800 words
- **Assets:** a two-column conversion table (UNA-USA/North American term, THIMUN equivalent);
  a flow diagram of a THIMUN debate day.
- **Links out to:** `mun-rules-of-procedure`, `mun-procedure-styles-compared`,
  `una-usa-rules-of-procedure`, `mun-points-explained`, `mun-amendment-guide`,
  `mun-resolution-example`
- **Links in from:** `mun-rules-of-procedure` (prominently), `mun-procedure-styles-compared`,
  `choosing-mun-conferences`, `university-mun-guide`
- **Cannibalisation:** **Complements `mun-rules-of-procedure`.** The existing post is the
  generic reference and already says rules "differ across major MUN conferences"; it should
  be edited to link out to this and to item 10 at exactly that sentence. This post must be
  THIMUN-only and must not restate generic points and motions.

---

### 10. UNA-USA Rules of Procedure: The Complete Guide
- **Slug:** `/blog/una-usa-rules-of-procedure`
- **Audience:** delegate and chair on the North American circuit, and any chair writing a
  conference rulebook
- **Level:** intermediate
- **Intent:** reference, same shape as item 9.
- **Primary keyword:** UNA-USA rules of procedure
- **Secondary:** UNA-USA procedure, Model UN rules UNA-USA, UNA-USA vs Harvard procedure
- **Promise:** The full UNA-USA ruleset as it is actually run, including the parts most
  conferences quietly modify.
- **Outline:**
  - What UNA-USA procedure is and where it is used
  - Setting the agenda, the opening vote most rulebooks under-explain
  - The general speakers list as the default state of the room
  - Motions in precedence order, with the actual disruptiveness ranking
  - Moderated and unmoderated caucus: proposing, timing, extending
  - Points: order, inquiry, personal privilege, and when each interrupts a speaker
  - Working papers, draft resolutions, signatories and sponsors
  - Amendments: friendly and unfriendly, and the voting order
  - Voting procedure: procedural vs substantive, majorities, abstentions, roll call, rights
    of explanation
  - The five rules almost every conference modifies, so you check the handbook anyway
- **Length:** 2,400-2,800 words
- **Assets:** a precedence-order table for motions; a voting-threshold table; a one-page
  printable rules card (download, shared with item 43's cheat sheet asset).
- **Links out to:** `mun-rules-of-procedure`, `mun-motions-explained`, `mun-voting-procedures`,
  `mun-points-explained`, `mun-procedure-styles-compared`, `mun-amendment-guide`
- **Links in from:** `mun-rules-of-procedure`, `mun-motions-explained`,
  `mun-procedure-styles-compared`, `mun-chair-script`
- **Cannibalisation:** **Complements `mun-rules-of-procedure`, `mun-motions-explained` and
  `mun-voting-procedures`.** Highest cannibalisation risk on the list, because the existing
  generic post is largely UNA-USA-flavoured already. Mitigation: this post is explicitly
  branded and structured as the named ruleset, cites rule numbering, and defers all
  conceptual explanation ("what is a motion", "what does abstain mean") to the three existing
  posts, which it links inline. If it cannot be written without restating them, drop it and
  put the UNA-USA specificity into the existing post instead. Decide this before writing.

---

### 11. Model UN Committee Types Explained
- **Slug:** `/blog/mun-committee-types`
- **Audience:** new delegate choosing preferences, faculty advisor placing students,
  organiser designing a slate
- **Level:** beginner
- **Intent:** informational, decision-adjacent. "Which committee should I put first?"
- **Primary keyword:** Model UN committee types
- **Secondary:** MUN committees explained, GA vs ECOSOC MUN, which MUN committee should I
  choose
- **Promise:** Every kind of committee you will see on a conference list, what debate feels
  like in each, and who it suits.
- **Outline:**
  - General Assembly committees: size, pace, what a good delegate does
  - ECOSOC and the specialised agencies: smaller, more technical, underrated
  - The Security Council: 15 seats, veto, and a completely different rhythm
  - Regional bodies: EU, AU, ASEAN, OAS, and why they are not just small GAs
  - Crisis committees and cabinets
  - Joint crisis committees and historical committees
  - Press corps and the International Press
  - Ad hoc and novelty committees
  - Custom and parliamentary chambers, where seats are party members rather than countries
  - A table: size, procedure, difficulty, best for
- **Length:** 2,000-2,400 words
- **Assets:** the summary table; a difficulty-vs-size scatter graphic.
- **Links out to:** `mun-security-council-guide`, `mun-crisis-committee-guide`,
  `mun-press-corps-guide`, `what-is-model-un`, `mun-glossary`
- **Links in from:** `what-is-model-un`, `mun-for-beginners`, `mun-conference-preparation`,
  `choosing-mun-conferences`, `mun-country-allocation`
- **Cannibalisation:** Clear as an overview. Must not re-teach the UNSC or crisis committees;
  it gives each two paragraphs and links to the existing deep guides. Those two existing
  posts get more traffic out of this page than it takes from them.

---

### 12. How to Write a MUN Crisis Directive
- **Slug:** `/blog/mun-crisis-directive-guide`
- **Audience:** crisis delegate, crisis staff
- **Level:** intermediate to advanced
- **Intent:** transactional. They have a directive to write tonight.
- **Primary keyword:** how to write a crisis directive
- **Secondary:** MUN crisis directive example, personal directive Model UN, public directive
  format
- **Promise:** The three kinds of directive, what each one is for, and full worked examples
  of each.
- **Outline:**
  - What a directive is and why it replaces a resolution
  - Public (committee) directives: format, signatories, what a committee can actually do
  - Private or personal directives: what your portfolio powers genuinely allow, with the
    test to apply
  - Press releases and communiqués as a third form
  - The most useful directive nobody writes: the information request
  - Specific, active, short. Three rewrites of the same directive getting better
  - Worked examples: one public, two private, one press release, each annotated with the
    crisis staff response it would get
  - How crisis staff decide whether your directive succeeds, partly succeeds, or backfires
  - Sequencing: building an arc across six directives instead of firing one-offs
  - Common failures: exceeding your portfolio, vagueness, asking for information you could
    infer, and the "and then I win" directive
- **Length:** 2,200-2,600 words
- **Assets:** four annotated directive documents; a portfolio-powers test as a decision list;
  a downloadable directive template.
- **Links out to:** `mun-crisis-committee-guide`, `mun-crisis-backroom-guide`,
  `how-to-run-crisis-committee`, `mun-committee-types`
- **Links in from:** `mun-crisis-committee-guide` (prominently), `how-to-run-crisis-committee`,
  `mun-crisis-backroom-guide`
- **Cannibalisation:** **Complements `mun-crisis-committee-guide`.** That post already
  mentions directive writing in its description; it should keep one short section and link
  here. bestdelegate, wisemee and allamericanmun all have a page on this, all thin on
  examples. Worked examples are the whole play.

---

### 13. Is Model UN Worth It? An Honest Answer
- **Slug:** `/blog/is-mun-worth-it`
- **Audience:** student deciding, parent paying, faculty advisor justifying the budget
- **Level:** beginner
- **Intent:** commercial-investigational and high-emotion. Real ambivalence in the SERP.
- **Primary keyword:** is Model UN worth it
- **Secondary:** does Model UN look good on college applications, Model UN benefits, is MUN
  a good extracurricular
- **Promise:** What Model UN is genuinely worth on an application and in life, and when it is
  a waste of your time.
- **Outline:**
  - The honest short answer, stated in the first paragraph
  - What admissions officers actually see: participation vs leadership vs impact, and why
    four years of attending reads as filler
  - The skills that transfer and are provable: public speaking under time pressure, writing
    to a brief, negotiating with people who disagree, reading a room
  - The skills people claim transfer and do not
  - When MUN is the wrong choice: if it is displacing depth in the thing you actually care
    about
  - How to make it count: chair, run the club, found a conference, or build a record
  - Evidence beats assertion. Awards, chairing roles and conferences organised are the
    things that survive a reader who was not there
  - Careers where it genuinely helps, and careers where nobody will ask
  - The cost side: fees, travel, weekends. Say it plainly
- **Length:** 1,900-2,300 words
- **Assets:** a table of claim vs reality; a short "what to do instead if" decision list.
- **Links out to:** `mun-on-your-cv`, `what-is-model-un`, `how-to-become-a-mun-chair`,
  `mun-awards-guide`, `start-a-mun-conference`
- **Links in from:** `what-is-model-un`, `mun-on-your-cv`, `university-mun-guide`,
  `start-mun-club`
- **Cannibalisation:** Clear. bestdelegate and wisemee both rank here with promotional
  answers; the SERP already contains sceptical takes, so the honest version is the one that
  differentiates. Do not write an advert.

---

### 14. Delegate Applications and Country Allocation: An Organiser's Guide
- **Slug:** `/blog/mun-country-allocation`
- **Audience:** secretariat/organiser, USG for delegate affairs
- **Level:** advanced
- **Intent:** high-intent operational. They have 600 applications and four weeks.
- **Primary keyword:** MUN country allocation
- **Secondary:** Model UN delegate allocation, how to assign countries MUN conference,
  MUN application process organiser
- **Promise:** How to turn a pile of applications into a seated conference without
  spreadsheet chaos or an inbox of complaints.
- **Outline:**
  - The two allocations: delegations to committees, and delegates to seats. Doing them in the
    wrong order is the classic mistake
  - Collecting preferences that are actually usable: how many, in what format, and the
    questions that predict fit
  - Experience signals worth asking for and what they are worth
  - Double delegations, and what breaks when you model them as one seat
  - Seat importance: a P5 seat and a small-state seat are not the same open seat, and a flat
    fill count hides that
  - Allocating delegation blocks: schools want their students in different committees, or the
    same one. Ask first
  - Balancing committees so no room is 40 first-timers
  - Crisis and cabinet character allocation, which does not fit a country model
  - Handling the reallocation requests that will arrive, and the policy that prevents most of
    them
  - Releasing allocations: what to send, when, and what to never put in a public spreadsheet
  - Doing it by hand vs doing it with software: what actually takes the time
- **Length:** 2,600-3,000 words
- **Assets:** a countries-by-committees matrix screenshot or diagram showing filled, open and
  not-on-roster as three distinct states; a preference-form template.
- **Links out to:** `start-a-mun-conference`, `mun-secretariat-roles`,
  `mun-conference-registration-payments`, `mun-committee-types`, `mun-director-guide`,
  `best-mun-software-2026`
- **Links in from:** `mun-director-guide`, `mun-conference-planning`, `start-a-mun-conference`,
  `mun-head-delegate-guide`
- **Cannibalisation:** Clear. This is the single deepest thing Gavelling does that nobody
  writes about. `mun-director-guide` mentions "planning committees" and should link here.

---

### 15. Registration, Payments and Refunds for MUN Conferences
- **Slug:** `/blog/mun-conference-registration-payments`
- **Audience:** secretariat/organiser, treasurer, faculty advisor paying for a delegation
- **Level:** intermediate to advanced
- **Intent:** high-intent operational and slightly anxious. Money and other people's money.
- **Primary keyword:** MUN conference registration and payment
- **Secondary:** MUN conference refund policy, how to collect delegate fees, Model UN
  conference payment system
- **Promise:** How to take money from schools in six countries without losing track of who
  paid, and a refund policy that does not end in an argument.
- **Outline:**
  - Who is actually paying: individual delegates, schools paying for a block, societies,
    and why the three need different flows
  - Registration stages: expression of interest, application, acceptance, payment, check-in.
    Collapsing any two of these causes a specific failure
  - Taking payment online: card processing, who is merchant of record, and what that means
    for your society's liability
  - Bank transfer and manual payment, which is the majority outside the countries card
    processing reaches. How to review proof of payment without a shared inbox
  - Invoicing a school: what a finance office needs on the document before it will pay
  - Fee structures: early bird, delegation rate, per-role fees, add-ons, application fees
  - Financial aid and waivers, including partial grants, and how to assess them fairly
  - The refund policy: write it before you take the first payment. A worked example policy
    with cancellation tiers, transfer-to-another-delegate rules, and the force majeure clause
  - Chasing unpaid fees without souring a relationship you need next year
  - Reconciliation: closing the books after the conference, and the report your treasurer
    and your school will ask for
- **Length:** 2,600-3,000 words
- **Assets:** a refund policy template (download); an invoice template; a table of payment
  method against who it suits and what it costs you.
- **Links out to:** `mun-conference-budget`, `start-a-mun-conference`,
  `mun-country-allocation`, `mun-conference-day-operations`, `best-mun-software-2026`
- **Links in from:** `mun-conference-budget`, `start-a-mun-conference`, `mun-director-guide`,
  `mun-head-delegate-guide`, `mun-chaperone-guide`
- **Cannibalisation:** Clear. Nothing covers conference money anywhere on the blog.

---

### 16. How to Research Your Country for MUN
- **Slug:** `/blog/mun-country-research`
- **Audience:** delegate at every level
- **Level:** beginner to intermediate
- **Intent:** transactional-informational. They have an assignment and two weeks.
- **Primary keyword:** how to research your country for MUN
- **Secondary:** Model UN country research, MUN country profile, MUN research guide
- **Promise:** A research method that produces a position, not a pile of facts, in one
  evening.
- **Outline:**
  - The mistake: researching the country instead of researching the position
  - The country profile: government type, economy, alliances, region, and what each tells you
    about how this country votes
  - Finding the actual position: permanent mission website, foreign ministry statements, UN
    speeches, and what to do when there are none
  - Voting records: how to find how your country voted on the resolution that matters, on the
    UN Digital Library
  - Treaty ratifications, reservations and non-signatures. A reservation is often the whole
    position
  - Blocs and groupings: G77, NAM, EU, OIC, African Group, and what membership commits you to
  - When the honest answer is "this country has no stated position": how to reason from
    interest and precedent, defensibly
  - Researching a country you find uncomfortable to represent
  - The one-page research sheet you actually take into committee
  - Sources ranked by how much a chair trusts them
- **Length:** 2,200-2,600 words
- **Assets:** a one-page country research sheet (download); a source table ranked by
  reliability with direct links; a worked example on one country and one topic.
- **Links out to:** `mun-position-paper-guide`, `mun-position-paper-examples`,
  `mun-country-profiles`, `mun-bloc-building`, `mun-conference-preparation`
- **Links in from:** `mun-position-paper-guide`, `mun-position-paper-examples`,
  `mun-for-beginners`, `mun-club-curriculum`, `mun-country-profiles`
- **Cannibalisation:** **Complements `mun-position-paper-guide`**, which currently carries a
  short "Research Sources That Actually Work" list. That list gets trimmed to three lines and
  links here. Competitors are LibGuides and bestdelegate's aging research hub; the voting
  record and reservations sections are where we beat both.

---

### 17. How to Handle Difficult Delegates
- **Slug:** `/blog/mun-difficult-delegates`
- **Audience:** chair, crisis director, faculty advisor
- **Level:** intermediate
- **Intent:** problem-solving, often searched the night before or during a conference.
- **Primary keyword:** how to handle difficult delegates MUN
- **Secondary:** MUN chair problems, disruptive delegate Model UN, chairing difficult
  committee
- **Promise:** The eight delegates who derail a committee, and the exact intervention for
  each one.
- **Outline:**
  - Principle first: your job is the room's debate, not the individual's behaviour. Choose
    the smallest intervention that protects the room
  - The dominator who takes every speaking slot
  - The rules lawyer who raises points to score points
  - The silent delegate who has not spoken in four hours
  - The bloc that has locked everyone else out of the draft
  - The delegate breaking character, or being offensive in character
  - The delegate who is clearly out of their depth and drowning
  - The pre-written speech read at 200 words a minute
  - The two delegates having a personal argument through the committee
  - Escalation ladder: private word at break, public procedural ruling, dais note,
    secretariat, faculty advisor. When to jump straight to the top
  - What never works: sarcasm from the dais, public humiliation, ignoring it
  - Safeguarding: the line at which a behaviour problem becomes a welfare problem and stops
    being yours to handle
- **Length:** 2,200-2,600 words
- **Assets:** an escalation ladder graphic; a phrase box of exact dais language per scenario,
  matching the style of `mun-chair-script`.
- **Links out to:** `mun-chair-script`, `mun-controlling-the-floor`, `how-to-chair-first-mun`,
  `mun-safeguarding`, `mun-judging-rubric`
- **Links in from:** `how-to-chair-first-mun` (prominently), `mun-chair-script`,
  `how-to-run-mun-committee`, `mun-controlling-the-floor`
- **Cannibalisation:** **Complements `how-to-chair-first-mun`**, which promises "handling the
  unexpected" in one section. That section keeps two paragraphs and links here. Genuinely
  under-served by competitors and highly shareable among chairs.

---

### 18. How to Start a MUN Club at Your School
- **Slug:** `/blog/start-mun-club`
- **Audience:** student founder, faculty advisor, teacher asked to sponsor one
- **Level:** beginner
- **Intent:** planning, high-intent, seasonal (August-October peak).
- **Primary keyword:** how to start a Model UN club
- **Secondary:** starting a MUN club at school, Model UN club ideas, how to set up a MUN club
- **Promise:** From the first conversation with a teacher to your first conference, in one
  term.
- **Outline:**
  - Getting institutional approval: what a head of department actually needs to hear, and the
    one-page proposal that gets a yes
  - Finding a faculty advisor, and what you are asking them for in hours per week
  - Recruiting: where the members come from, and why the debating society is not the only
    place to look
  - The first meeting, which decides whether there is a second one
  - The first term: a realistic schedule of eight sessions
  - Running your first in-house mock committee with people who know nothing
  - Choosing a first conference and how many students to send
  - Money: subs, school funding, and the first fundraiser
  - Structure and succession: officers, handover, and why year three is where clubs die
  - The free tools a club can run on
- **Length:** 2,200-2,600 words
- **Assets:** a one-page proposal template for school leadership (download); a first-term
  schedule table; a first-meeting agenda.
- **Links out to:** `mun-club-curriculum`, `mun-faculty-advisor-guide`,
  `choosing-mun-conferences`, `mun-team-fundraising`, `what-is-model-un`, `free-mun-tools`
- **Links in from:** `mun-faculty-advisor-guide` (prominently), `mun-club-curriculum`,
  `what-is-model-un`, `is-mun-worth-it`
- **Cannibalisation:** **Complements `mun-faculty-advisor-guide`**, which has a "Building the
  Program" section. That section stays advisor-facing (support, oversight, welfare) and this
  post owns founding mechanics. Competitors: bestdelegate, allamericanmun, AMUN, un.org. The
  institutional-approval and succession sections are where they are all weakest.

---

### 19. MUN Speech Examples: Openings, Caucus Speeches and Closings
- **Slug:** `/blog/mun-speech-examples`
- **Audience:** delegate at every level
- **Level:** beginner to intermediate
- **Intent:** transactional. They need words, now.
- **Primary keyword:** MUN speech example
- **Secondary:** Model UN speech template, moderated caucus speech example, MUN closing
  speech
- **Promise:** Twelve real speeches, each under a minute, with why each one works.
- **Outline:**
  - The four speech shapes and when each is used
  - Opening GSL speech: three full examples at 60, 75 and 90 seconds
  - Moderated caucus speech: three examples on the same sub-topic taking different angles
  - The persuasion speech before a vote
  - The response speech: answering an attack without losing the room
  - The closing or thank-you speech
  - A chair-facing speech: a point of information answered well
  - What changes between 30, 60 and 90 seconds, shown on the same content
  - Rhetorical moves that work in a committee room and the three that always land badly
  - Writing a speech in the 90 seconds before you are called
- **Length:** 2,200-2,600 words including full speech texts
- **Assets:** twelve speech blocks with timing marks; a fill-in speech skeleton (download).
- **Links out to:** `mun-opening-speech`, `mun-public-speaking-tips`,
  `general-speakers-list-guide`, `how-to-run-moderated-caucus`, `mun-negotiation-tactics`
- **Links in from:** `mun-opening-speech` (prominently), `mun-public-speaking-tips`,
  `mun-for-beginners`, `mun-club-curriculum`
- **Cannibalisation:** **Complements `mun-opening-speech`**, which already has "templates and
  examples" for the opening speech specifically. Hard rule: this post gives the opening speech
  three examples and no theory, and covers the five speech types the existing post does not.
  If the existing post is expanded instead, cut this one. Decide before writing.

---

### 20. Common MUN Mistakes, and What To Do Instead
- **Slug:** `/blog/mun-common-mistakes`
- **Audience:** new and intermediate delegates, faculty advisors coaching
- **Level:** beginner to intermediate
- **Intent:** informational, high engagement, strong internal-link hub.
- **Primary keyword:** common Model UN mistakes
- **Secondary:** MUN mistakes to avoid, why did I not win Model UN, MUN beginner mistakes
- **Promise:** The 25 mistakes chairs see every weekend, sorted by how much they cost you.
- **Outline:**
  - Research mistakes: representing yourself, ignoring the voting record, one-source research
  - Writing mistakes: the position paper that describes the topic, the resolution nobody can
    fund, unfriendly amendments raised at the wrong time
  - Speaking mistakes: the read-aloud speech, the 90-second speech with one idea,
    the point of order used as a weapon
  - Procedure mistakes: motions in the wrong order, yielding badly, abstaining by accident
  - Bloc mistakes: joining the biggest bloc, writing alone, refusing to merge
  - Behaviour mistakes: the ones that get you struck from the awards list without you knowing
  - Advanced mistakes: winning the room and losing the vote, optimising for the dais rather
    than the outcome
  - A "what to do instead" line on every single one, each linking to the relevant guide
- **Length:** 2,000-2,400 words
- **Assets:** a cost-vs-frequency table; no download.
- **Links out to:** nearly the whole delegate cluster. Designed as a link hub.
- **Links in from:** `mun-delegate-tips`, `mun-for-beginners`, `mun-awards-guide`,
  `mun-conference-preparation`
- **Cannibalisation:** **Complements `mun-delegate-tips`.** Overlap is real: tips and mistakes
  are the same content inverted. Split: `mun-delegate-tips` stays positive and
  awards-oriented; this post is diagnostic, organised by symptom, and exists primarily to
  route readers to the specific guide. If the router function is not built (section 0, item
  1), this post loses most of its value.

---

### 21. How to Become a MUN Chair: Applying, Interviewing and Getting Picked
- **Slug:** `/blog/how-to-become-a-mun-chair`
- **Audience:** experienced delegate wanting to move to the dais, first-time chair applicant
- **Level:** intermediate
- **Intent:** high-intent career-shaped. Commercially valuable: this is the audience for
  `/conferences/roles`.
- **Primary keyword:** how to become a MUN chair
- **Secondary:** MUN chair application, Model UN chair interview questions, how to apply to
  chair a MUN conference
- **Promise:** What secretariats look for in a chair application, and how to get your first
  dais.
- **Outline:**
  - What chairing actually involves, and the honest workload including the background guide
  - When you are ready: the experience most conferences expect, and the exceptions
  - Where the openings are posted, and when in the year they appear
  - The application: what a chair application asks and what each question is really testing
  - The writing sample, which is usually the deciding item
  - The interview: the six questions almost every secretariat asks, with what a good answer
    contains
  - Choosing which committee to apply for, and why applying for the flagship first is often
    the wrong move
  - Vice chair, rapporteur, crisis staff and director: the other routes onto a dais
  - What to do in the months between being accepted and the conference
  - Your first dais: what to prepare
- **Length:** 2,000-2,400 words
- **Assets:** a chair application checklist; a sample answer set for the six interview
  questions.
- **Links out to:** `how-to-chair-first-mun`, `mun-background-guide-writing`,
  `mun-chair-script`, `mun-judging-rubric`, `how-to-run-mun-committee`
- **Links in from:** `how-to-chair-first-mun`, `mun-delegate-tips`, `is-mun-worth-it`,
  `mun-on-your-cv`, `university-mun-guide`. Should also be linked from `/conferences/roles`.
- **Cannibalisation:** Clear. `how-to-chair-first-mun` starts after you have the role; this
  one ends where that one starts. Low competition, real demand, and it feeds a Gavelling
  surface directly.

---

### 22. How to Write a MUN Background Guide (Study Guide)
- **Slug:** `/blog/mun-background-guide-writing`
- **Audience:** chair, academic team, USG academics
- **Level:** intermediate to advanced
- **Intent:** transactional. They have a deadline and a blank document.
- **Primary keyword:** how to write a MUN background guide
- **Secondary:** MUN study guide template, background guide format, Model UN study guide
  example
- **Promise:** A structure that produces a guide delegates actually read, and a schedule that
  gets it done on time.
- **Outline:**
  - What the guide is for: raising the floor of debate, not proving you read the literature
  - The standard structure, with target page counts for each part
  - The chair's letter: short, human, and the two things it must say
  - Committee mandate and history: one to two pages, and what to cut
  - The topic section: setting, actors, the conflict, the state of play, the deadlock
  - Bloc positions without telling delegates what to think
  - Questions a resolution must answer: the most useful page in the guide and the most
    commonly skipped
  - Further reading and bibliography, and the citation standard to pick
  - Readability: images, subheadings, and length limits. A 40-page guide is not read
  - Research process and schedule: how to write it in six weeks alongside your degree
  - Getting it reviewed by the secretariat, and AI-assistance policy, which conferences are
    starting to write down
- **Length:** 2,400-2,800 words
- **Assets:** a full background guide template (.docx download); a page-budget table; one
  annotated excerpt of a strong topic section.
- **Links out to:** `how-to-chair-first-mun`, `how-to-become-a-mun-chair`,
  `mun-topic-selection` (see section 6, not in this 50), `mun-country-research`,
  `mun-committee-types`
- **Links in from:** `how-to-become-a-mun-chair`, `how-to-chair-first-mun`,
  `mun-director-guide`, `mun-secretariat-roles`
- **Cannibalisation:** Clear. wisemee holds both "how to write a MUN study guide" and "MUN
  study guide template"; the template download plus a realistic six-week schedule is the
  differentiator.

---

### 23. How to Judge a MUN Committee: The Chair's Scoring Rubric
- **Slug:** `/blog/mun-judging-rubric`
- **Audience:** chair, secretariat setting award policy, faculty advisor explaining a result
- **Level:** intermediate to advanced
- **Intent:** operational and slightly fraught. Chairs want defensibility.
- **Primary keyword:** MUN judging criteria
- **Secondary:** MUN scoring rubric, how chairs score delegates, Model UN award criteria
- **Promise:** A rubric you can defend when a faculty advisor asks why their student did not
  win.
- **Outline:**
  - Why an explicit rubric beats an impression, and what happens when you do not have one
  - The five criteria most rubrics use: research and accuracy, speaking, diplomacy and
    negotiation, contribution to documents, procedural competence
  - Weighting them, and how weighting changes what the committee does
  - Quantitative evidence: speech count, speaking time, papers sponsored, motions raised. What
    it is good for and where it lies to you
  - Qualitative judgement: why the best delegate is sometimes not the loudest one, and how to
    write that down at the time rather than at the end
  - Taking notes during a session without losing the room
  - Blending the two: a score that is mostly judgement, evidenced by the record
  - Bias: recency, volume, accent, gender, confidence. Concrete countermeasures for each
  - Disqualifiers, and telling the delegate at the time rather than at the ceremony
  - Handing your slate to the secretariat, and the note that should come with it
  - Keeping a defensible record, including with software
- **Length:** 2,400-2,800 words
- **Assets:** a printable scoring rubric (download); a weighting table; a filled example
  scoresheet for one delegate across a session.
- **Links out to:** `mun-awards-guide`, `mun-award-categories`, `mun-chair-script`,
  `mun-difficult-delegates`, `how-to-run-mun-committee`
- **Links in from:** `mun-awards-guide` (prominently), `how-to-chair-first-mun`,
  `mun-award-categories`, `mun-director-guide`
- **Cannibalisation:** **Complements `mun-awards-guide`**, which is delegate-facing ("what
  chairs look for"). This is chair-facing ("how to decide and defend it"). Same subject,
  opposite side of the dais, and both must say so in their opening paragraph.

---

### 24. MUN Award Categories Explained
- **Slug:** `/blog/mun-award-categories`
- **Audience:** delegate, faculty advisor, organiser setting policy
- **Level:** beginner to intermediate
- **Intent:** informational. "What is an honourable mention actually worth?"
- **Primary keyword:** MUN award categories
- **Secondary:** what is outstanding delegate, MUN honourable mention meaning, best delegation
  award how calculated
- **Promise:** Every award a conference gives, what it means, and how many of each there
  usually are.
- **Outline:**
  - Best Delegate, and why there is exactly one
  - Outstanding Delegate, usually one or two
  - Honourable Mention, and the range conferences use
  - Verbal Commendation and why it is not on your CV
  - Best Position Paper as a separate track
  - Diplomacy and Peace awards, and conferences that use them to say something different
  - Delegation awards: Best Large Delegation, Best Small Delegation, Outstanding Delegation,
    and how the points are usually tallied from committee honours
  - Crisis-specific awards
  - Typical quotas per committee size, and why quotas exist
  - Conferences that give no awards at all, and what that changes
  - What each one is worth when a reader who was not there sees it
- **Length:** 1,700-2,000 words
- **Assets:** a table of award, typical quota per 40-seat committee, and what it signals; a
  worked delegation-award tally.
- **Links out to:** `mun-awards-guide`, `mun-judging-rubric`, `mun-award-ceremony-guide`,
  `mun-on-your-cv`, `mun-head-delegate-guide`
- **Links in from:** `mun-awards-guide`, `mun-judging-rubric`, `mun-on-your-cv`,
  `mun-head-delegate-guide`
- **Cannibalisation:** **Complements `mun-awards-guide`**, which answers "how Best Delegate is
  chosen". This answers "what are all the awards". The existing post should link here in its
  first section rather than adding a categories list.

---

### 25. Recruiting and Running a Secretariat
- **Slug:** `/blog/mun-secretariat-roles`
- **Audience:** secretary-general, director-general, organiser
- **Level:** advanced
- **Intent:** operational planning.
- **Primary keyword:** MUN secretariat roles
- **Secondary:** what does a secretary general do MUN, Model UN conference staff structure,
  USG roles MUN
- **Promise:** Every secretariat role, what it actually does week by week, and how big a team
  you need at your size.
- **Outline:**
  - The core five: Secretary-General, Director-General, USG Academics, USG Delegate Affairs,
    USG Finance
  - The next five: Logistics, Marketing and Outreach, Technology, Press, Hospitality
  - Crisis and academic teams underneath academics
  - Team size against conference size: a table, with the roles you can merge at small scale
  - Recruiting: when to open applications, what to ask, and recruiting from your own delegates
  - The handover problem, which is the defining weakness of student-run conferences. What to
    write down and where to keep it
  - Delegating authority: who can commit money, who can email the whole delegate list, who can
    change a committee
  - Access control and why not everyone should see the finances
  - Meeting rhythm through the year
  - Burnout, and the two roles that always take more than anyone expects
- **Length:** 2,400-2,800 words
- **Assets:** an org chart at three conference sizes; a role-by-role responsibility table; a
  handover document template (download).
- **Links out to:** `start-a-mun-conference`, `mun-director-guide`, `mun-conference-budget`,
  `how-to-become-a-mun-chair`, `mun-conference-day-operations`
- **Links in from:** `mun-director-guide`, `start-a-mun-conference`, `mun-conference-planning`
- **Cannibalisation:** **Complements `mun-director-guide`**, which covers "briefing chairs" and
  overall direction. This is the staffing structure beneath the director. Existing post links
  here at its team section.

---

### 26. How to Run a Crisis Committee
- **Slug:** `/blog/how-to-run-crisis-committee`
- **Audience:** crisis director, chair, USG crisis
- **Level:** advanced
- **Intent:** operational. Someone has been given a crisis committee and is scared.
- **Primary keyword:** how to run a crisis committee
- **Secondary:** crisis director guide MUN, crisis committee rules of procedure, how to chair
  crisis MUN
- **Promise:** How to design an arc, staff a backroom and run the room so the crisis never
  stalls.
- **Outline:**
  - The three jobs: front room chair, crisis director, backroom staff, and who decides what
  - Designing the arc before the conference: the opening scenario, three planned escalations,
    two branch points, and the ending you will probably not use
  - Pacing: how often an update should land, and what happens when they land too fast
  - Crisis procedure: how it differs from GA procedure, what survives and what is dropped
  - Reading directives at speed and deciding outcomes consistently
  - Rewarding good play without letting one delegate run the committee
  - Keeping the front room busy while the backroom writes
  - Joint crisis committees: two rooms, one world, and the coordination that makes or breaks
    it
  - Historical committees and the rules on hindsight
  - When the arc dies: the three recovery moves
  - Safety and taste: the topics and turns that go wrong, and the line to hold
- **Length:** 2,600-3,000 words
- **Assets:** an arc diagram across a two-day conference; a crisis update template; a
  directive-response decision table.
- **Links out to:** `mun-crisis-committee-guide`, `mun-crisis-backroom-guide`,
  `mun-crisis-directive-guide`, `mun-committee-types`, `mun-difficult-delegates`
- **Links in from:** `mun-crisis-committee-guide` (prominently), `mun-crisis-backroom-guide`,
  `how-to-chair-first-mun`, `mun-director-guide`
- **Cannibalisation:** **Complements `mun-crisis-committee-guide`**, which is delegate-facing
  and mentions "backroom vs frontroom". This is staff-facing. Absorbs the joint crisis and
  historical committee material that would otherwise be a separate thin page.

---

### 27. The Crisis Backroom: How Crisis Staff Actually Work
- **Slug:** `/blog/mun-crisis-backroom-guide`
- **Audience:** crisis staff, aspiring crisis staff, crisis delegate wanting to understand the
  other side
- **Level:** advanced
- **Intent:** informational-operational, very under-served.
- **Primary keyword:** MUN crisis backroom
- **Secondary:** crisis staff guide, how crisis staff respond to directives, backroom Model UN
- **Promise:** What happens to your note after you hand it up, and how to be the staffer
  everyone wants.
- **Outline:**
  - The backroom's actual job: continuity, consistency, and pace
  - The triage system: which directives get a full response, which get a line, which get
    nothing, and how to make that fair
  - Writing a crisis update that changes the room in 90 seconds
  - Playing characters: the ambassador, the general, the journalist, and staying in one voice
  - Keeping a world bible so two staffers do not contradict each other
  - Managing a delegate's arc across a weekend without letting them win alone
  - Saying no to a directive well
  - Coordination with the front room: what the chair needs to know before an update lands
  - The tools: shared documents, a timeline, a tracker of who has what
  - Crisis notes from delegates: response times, and what happens when you cannot keep up
- **Length:** 2,200-2,600 words
- **Assets:** a directive triage flowchart; a world bible template; a crisis update template.
- **Links out to:** `how-to-run-crisis-committee`, `mun-crisis-directive-guide`,
  `mun-crisis-committee-guide`
- **Links in from:** `how-to-run-crisis-committee`, `mun-crisis-directive-guide`,
  `mun-crisis-committee-guide`
- **Cannibalisation:** Clear. Almost nobody writes for crisis staff. Low volume, near-zero
  competition, high shareability inside a niche that produces future organisers.

---

### 28. How to Keep Debate Moving When a Committee Stalls
- **Slug:** `/blog/mun-controlling-the-floor`
- **Audience:** chair
- **Level:** intermediate
- **Intent:** problem-solving, often searched during a conference.
- **Primary keyword:** how to control the floor MUN chair
- **Secondary:** MUN committee not talking, how to keep MUN debate moving, chairing a quiet
  committee
- **Promise:** Eleven interventions for a committee that has gone quiet, circular or chaotic.
- **Outline:**
  - Diagnose first: a quiet room, a circular room and a chaotic room need opposite treatment
  - The quiet room: seeding the speakers list, calling on placards, a tour de table, splitting
    into smaller groups
  - The circular room: narrowing the moderated caucus topic, forcing a drafting deadline,
    naming the disagreement out loud
  - The chaotic room: shortening speaking time, refusing motions, taking an unmoderated caucus
    away
  - The room where three delegates are doing all the work
  - Using speaking time as the main lever, and what 45 vs 90 seconds does to a committee
  - Deadlines as a tool: papers due before lunch changes everything
  - When to let silence sit
  - The chair's own speech, used sparingly
  - Reading the room from the dais: what to actually look at
  - Handling the last hour, which is a different problem from the rest of the conference
- **Length:** 2,000-2,400 words
- **Assets:** a diagnose-and-intervene table; exact dais phrasing boxes.
- **Links out to:** `how-to-run-moderated-caucus`, `mun-chair-script`, `mun-difficult-delegates`,
  `general-speakers-list-guide`, `tour-de-table-mun`, `how-to-run-mun-committee`
- **Links in from:** `how-to-run-mun-committee`, `how-to-chair-first-mun`, `mun-chair-script`,
  `how-to-run-moderated-caucus`
- **Cannibalisation:** **Complements `how-to-run-mun-committee`** (procedure order) and
  `how-to-run-moderated-caucus` (one format). This post is about judgement when procedure is
  working and debate is not, which none of them covers.

---

### 29. Negotiation and Diplomacy in MUN
- **Slug:** `/blog/mun-negotiation-tactics`
- **Audience:** intermediate and experienced delegates, head delegates
- **Level:** intermediate to advanced
- **Intent:** skill-building, evergreen, high shareability.
- **Primary keyword:** MUN negotiation tactics
- **Secondary:** how to negotiate in Model UN, MUN diplomacy skills, how to persuade delegates
  MUN
- **Promise:** How to get a clause you care about into a resolution that is not yours.
- **Outline:**
  - Interests, not positions. The one idea from real negotiation theory that changes a
    committee
  - Mapping the room in the first hour: who is aligned, who is movable, who is a blocker
  - Trading: what you actually have to give (sponsorship, speaking support, a clause, a vote)
  - Working with a country whose position is opposed to yours
  - The blocker: when to route around them and when to buy them
  - Merging papers without losing your clause, which is where most delegates lose
  - Reading a draft for what has been quietly removed
  - Concession sequencing: what to give first and what to hold
  - Coalitions of the unwilling: the small states bloc, and why it wins more often than
    expected
  - Staying in character while being genuinely persuasive
  - What a chair sees as diplomacy and what they see as bullying
- **Length:** 2,200-2,600 words
- **Assets:** a room-mapping worksheet; a trade-value table.
- **Links out to:** `mun-bloc-building`, `mun-working-paper-guide`, `mun-amendment-guide`,
  `mun-delegate-tips`, `mun-speech-examples`
- **Links in from:** `mun-bloc-building` (prominently), `mun-delegate-tips`,
  `mun-awards-guide`, `mun-head-delegate-guide`
- **Cannibalisation:** **Complements `mun-bloc-building`**, which covers forming and leading a
  coalition. This is the one-to-one persuasion layer beneath it. Keep bloc formation out of
  this post.

---

### 30. Points in MUN: Order, Inquiry, Information and Personal Privilege
- **Slug:** `/blog/mun-points-explained`
- **Audience:** delegate, chair
- **Level:** beginner to intermediate
- **Intent:** reference, looked up mid-session.
- **Primary keyword:** points in Model UN
- **Secondary:** point of parliamentary inquiry, point of personal privilege MUN, point of
  information Model UN
- **Promise:** All four points, what each is for, whether it interrupts a speaker, and the
  exact wording.
- **Outline:**
  - The four points, in one table, with interrupt-or-not marked
  - Point of Order: procedural error only, and the most common misuse
  - Point of Parliamentary Inquiry: asking the chair about procedure, not the topic
  - Point of Personal Privilege: comfort and audibility, and why it is the only one that can
    interrupt a speaker in most rulesets
  - Point of Information: asking a speaker a question, central on the THIMUN circuit and
    optional on the North American one
  - How to answer a hostile point of information without losing the room
  - Rights of reply, which are not a point, and where they sit
  - Chair rulings: how a chair should respond to each, and what "the point is not well taken"
    means
  - Circuit differences in one table
  - The three points delegates invent that do not exist
- **Length:** 1,700-2,000 words
- **Assets:** the four-point summary table; a wording box per point; a circuit-difference
  table.
- **Links out to:** `mun-points-of-order`, `mun-right-of-reply`, `mun-rules-of-procedure`,
  `mun-motions-explained`, `thimun-rules-of-procedure`
- **Links in from:** `mun-points-of-order` (prominently), `mun-motions-explained`,
  `mun-rules-of-procedure`, `mun-glossary`
- **Cannibalisation:** **Complements `mun-points-of-order`**, which is deep on one point. This
  is the umbrella covering all four plus points of information. The existing post must stay
  order-specific and link here; if it starts covering the other three, they cannibalise each
  other. This is the second-highest overlap risk in the plan after item 10.

---

### 31. Marketing a MUN Conference: How to Fill Your Committees
- **Slug:** `/blog/mun-conference-marketing`
- **Audience:** USG marketing/outreach, secretary-general
- **Level:** intermediate
- **Intent:** operational, urgent. Registration is open and empty.
- **Primary keyword:** how to promote a MUN conference
- **Secondary:** MUN conference marketing, attract delegations to MUN conference, MUN
  conference outreach
- **Promise:** How delegations actually decide which conference to attend, and how to reach
  them before the other conference does.
- **Outline:**
  - Who you are marketing to: the faculty advisor signs the cheque, the head delegate chooses,
    the delegate gets excited. Three different messages
  - The calendar reality: schools plan a year ahead and book in two windows. Missing a window
    costs you a year
  - Your conference page: the eight things a faculty advisor looks for before they reply,
    and the four that make them leave
  - Direct outreach to schools and societies, and the email that actually gets a reply
  - Returning delegations: the cheapest delegates you will ever get, and the post-conference
    moment when you secure them
  - Listing on conference directories, and what a good listing needs
  - Social media: what works per platform, and the trap of spending months on it
  - Chair and staff recruitment as marketing, because chairs bring their schools
  - Social proof: reviews, photos, past awards, alumni
  - Pricing as a signal, and the early-bird deadline that moves decisions
  - Tracking: what to measure when you have no analytics budget
- **Length:** 2,400-2,800 words
- **Assets:** an outreach email template; a conference-page checklist; an annual marketing
  calendar table.
- **Links out to:** `start-a-mun-conference`, `mun-conference-budget`,
  `mun-conference-registration-payments`, `mun-secretariat-roles`, `choosing-mun-conferences`
- **Links in from:** `start-a-mun-conference`, `mun-conference-planning`, `mun-director-guide`.
  Should also link to `/conferences/explore`, which is the directory the post describes.
- **Cannibalisation:** Clear. Also the natural place to link the Gavelling public conference
  page and directory without it reading as an advert, because a listing genuinely is part of
  the answer.

---

### 32. Running Conference Day: The Operations Manual
- **Slug:** `/blog/mun-conference-day-operations`
- **Audience:** secretariat, logistics team, director-general
- **Level:** advanced
- **Intent:** operational, searched in the last week.
- **Primary keyword:** MUN conference day checklist
- **Secondary:** running a MUN conference day, Model UN conference logistics, MUN conference
  run of show
- **Promise:** An hour-by-hour run of show for both days, and the fifteen things that go wrong.
- **Outline:**
  - The week before: printing, room signage, badges, the box that goes to every room
  - Registration desk design: throughput maths, and why a single queue for 400 people fails
  - Opening ceremony: the shortest version that still works
  - Committee session one, and the staff walk that catches most problems
  - The command centre: who sits there, what they can see, and how a chair asks for help
  - Knowing what is happening in twelve rooms at once, which is the hardest operational
    problem of the day and the one software actually solves
  - Breaks, lunch and the logistics of moving 400 people
  - The fifteen things that go wrong, with the fix for each: a missing chair, a projector, a
    delegate in the wrong room, a lost bag, a sick delegate, a fire alarm
  - Day two, which is a different problem: attendance drops, energy drops, drafting peaks
  - Voting and closing: collecting resolutions, finalising awards, and the ceremony
  - Pack-down and the same-evening debrief
  - The post-conference week: refunds, thank-yous, certificates, the report
- **Length:** 2,600-3,000 words
- **Assets:** a two-day run of show table; a committee-room box packing list; an incident
  escalation card (download).
- **Links out to:** `mun-conference-venue-logistics`, `mun-secretariat-roles`,
  `mun-award-ceremony-guide`, `mun-safeguarding`, `mun-director-guide`,
  `best-mun-software-2026`
- **Links in from:** `mun-director-guide` (prominently), `mun-conference-planning`,
  `start-a-mun-conference`, `mun-conference-venue-logistics`
- **Cannibalisation:** **Complements `mun-conference-planning`** (which ends with a short
  "Conference Day" section) and `mun-director-guide`. Both should link here and neither should
  grow their day-of sections. Genuine overlap risk, so the operations detail here has to be
  much deeper than a section could be, or the page is not worth writing.

---

### 33. MUN Team Fundraising: How to Pay for Conferences
- **Slug:** `/blog/mun-team-fundraising`
- **Audience:** faculty advisor, head delegate, club treasurer
- **Level:** beginner to intermediate
- **Intent:** problem-solving with a real deadline. Often the blocker on attendance.
- **Primary keyword:** MUN fundraising ideas
- **Secondary:** how to fund a Model UN trip, MUN club funding, paying for MUN conference fees
- **Promise:** Nine ways school MUN teams actually raise the money, ranked by how much they
  raise per hour of work.
- **Outline:**
  - What you actually need to raise: build the number before you fundraise
  - School and department budgets, and the case that wins one
  - Student subscriptions, and pricing them so they do not exclude
  - Grants: local foundations, Rotary and civic clubs, UN associations, alumni funds
  - Local business sponsorship and what a business gets in return
  - Alumni: the most reliable source almost nobody asks
  - Events that work and events that lose money once you count the hours
  - Crowdfunding, and when it is worth the social cost
  - Conference financial aid and fee waivers: almost every conference has them and almost
    nobody asks
  - Keeping costs down: travel, shared rooms, local conferences, online conferences
  - Equity: making sure fundraising does not quietly select for wealthier students
  - Handling money: who holds it, how it is recorded, and what your school will require
- **Length:** 2,000-2,400 words
- **Assets:** a fundraising-method table (effort, typical return, lead time); a sponsorship
  request letter template; a grant application checklist.
- **Links out to:** `mun-faculty-advisor-guide`, `start-mun-club`, `choosing-mun-conferences`,
  `mun-conference-sponsorship`, `mun-chaperone-guide`
- **Links in from:** `mun-faculty-advisor-guide`, `start-mun-club`, `choosing-mun-conferences`
- **Cannibalisation:** Clear, and distinct from item 34 (that one raises money FOR a
  conference, this raises money TO ATTEND one). Both must state the distinction in the opening
  paragraph and link to each other.

---

### 34. MUN Conference Sponsorship: Finding and Keeping Sponsors
- **Slug:** `/blog/mun-conference-sponsorship`
- **Audience:** secretariat, USG finance/partnerships
- **Level:** advanced
- **Intent:** operational, money-shaped.
- **Primary keyword:** MUN conference sponsorship
- **Secondary:** Model UN sponsorship proposal, sponsors for MUN conference, MUN conference
  partnership
- **Promise:** What sponsors actually buy, what to offer at each tier, and the proposal that
  gets a meeting.
- **Outline:**
  - What a sponsor is buying: access to a specific, educated, young audience and their
    parents. Say it in those terms
  - Who sponsors MUN conferences in practice: universities, tutoring and test-prep, law firms,
    embassies and cultural institutes, local business, NGOs, airlines and hotels
  - Cash, in-kind and media partnerships. In-kind is often the better deal
  - The tier structure: three tiers, what each includes, and pricing them against your budget
  - The sponsorship deck: eight slides, what each must contain
  - The cold approach that works, and the timing in their financial year
  - Embassies and cultural institutes, which are a distinct process with a long lead time
  - Delivering: what you promised, evidenced, in a report
  - Renewal, which is worth more than any new sponsor
  - What to refuse, and having that conversation with your school before it arises
- **Length:** 2,200-2,600 words
- **Assets:** a tier table; a sponsorship proposal template (download); a post-conference
  sponsor report template.
- **Links out to:** `mun-conference-budget`, `start-a-mun-conference`,
  `mun-conference-marketing`, `mun-secretariat-roles`, `mun-team-fundraising`
- **Links in from:** `mun-conference-budget` (prominently), `start-a-mun-conference`,
  `mun-team-fundraising`
- **Cannibalisation:** Clear. See item 33 for the split.

---

### 35. Choosing MUN Conferences: A Circuit Guide
- **Slug:** `/blog/choosing-mun-conferences`
- **Audience:** faculty advisor, head delegate, club president
- **Level:** intermediate
- **Intent:** decision-making, seasonal, high intent.
- **Primary keyword:** how to choose a MUN conference
- **Secondary:** best MUN conferences for beginners, MUN conference calendar, which MUN
  conference should I attend
- **Promise:** How to build a season that develops your team instead of exhausting it.
- **Outline:**
  - The four axes: size, circuit, competitiveness, cost
  - Matching conference to experience level, with a concrete first-year, second-year,
    third-year progression
  - Reading a conference before committing: the background guides, the rulebook, the
    secretariat's responsiveness, last year's photos
  - Red flags: no published rules, no refund policy, a fee that seems high for the venue, no
    named secretariat, no history
  - THIMUN-circuit vs North American vs local, and what your students learn from each
  - Travel, visas and the lead time international conferences need
  - Online conferences: what they are good for and what they are not
  - Budgeting a season, not a conference
  - Building a season of three: one local, one development, one target
  - Where to find conferences and how to evaluate a directory listing
  - Booking: deposits, delegation sizes, and the commitment you are making
- **Length:** 2,200-2,600 words
- **Assets:** a conference evaluation scorecard (download); a season-planning table; a red-flag
  checklist.
- **Links out to:** `mun-faculty-advisor-guide`, `mun-head-delegate-guide`,
  `mun-team-fundraising`, `thimun-rules-of-procedure`, `mun-conference-preparation`,
  `university-mun-guide`
- **Links in from:** `mun-faculty-advisor-guide` (its "Choosing Conferences" section should
  shrink and link here), `start-mun-club`, `mun-head-delegate-guide`. Should link to
  `/conferences/explore` and `/conferences/map`.
- **Cannibalisation:** **Complements `mun-faculty-advisor-guide`**, which has a four-bullet
  "Choosing Conferences" section. That section is trimmed to two lines and links here. Do not
  publish a "best MUN conferences 2026" ranking: that is the directory's job
  (`/conferences/explore`) and a blog ranking would cannibalise a commercially important
  product surface.

---

### 36. Safeguarding at MUN Conferences
- **Slug:** `/blog/mun-safeguarding`
- **Audience:** organiser, faculty advisor, school leadership, chair
- **Level:** advanced
- **Intent:** compliance and duty of care. Low volume, very high trust value.
- **Primary keyword:** MUN safeguarding
- **Secondary:** Model UN child protection policy, MUN conference safeguarding policy, duty of
  care Model UN
- **Promise:** The safeguarding policy a student-run conference needs, and the situations it
  has to cover.
- **Outline:**
  - Why a student-run conference hosting minors needs a written policy, and who is liable if
    there is not one
  - The policy's minimum contents: named safeguarding lead, reporting route, record keeping,
    code of conduct, definitions
  - Checks on staff and chairs, which vary by country. What to ask your school or university
  - Supervision ratios and who is responsible for a delegate at each moment. The gap between
    "at the conference" and "with their school" is where incidents happen
  - Socials, evening events and accommodation, which is where most of the risk sits
  - Committee content: topics that can be genuinely distressing, trigger warnings, and the
    right of a delegate to step out
  - Harassment and discrimination: reporting, response, and the decision to remove someone
  - Photography and consent, including social media
  - Incident response on the day: who is told, in what order, and what is written down
  - Data protection: you hold names, ages, dietary and medical information for hundreds of
    minors
  - Working with visiting faculty advisors, who retain responsibility for their own students
  - Online conferences, which have their own safeguarding shape
- **Length:** 2,400-2,800 words
- **Assets:** a safeguarding policy template (download, clearly marked as a starting point to
  be checked locally); a code of conduct template; an incident record form.
- **Links out to:** `mun-conference-day-operations`, `mun-chaperone-guide`,
  `mun-difficult-delegates`, `mun-accessibility`, `mun-secretariat-roles`
- **Links in from:** `mun-chaperone-guide`, `mun-conference-day-operations`,
  `mun-faculty-advisor-guide`, `mun-director-guide`
- **Cannibalisation:** Clear, and completely unwritten in this space. **Caution:** this page
  gives quasi-legal guidance and varies by jurisdiction. It needs a named human author, a
  reviewed date, an explicit "this is not legal advice, check your own jurisdiction and your
  institution's policy" line at the top, and it must not claim to be a compliant policy.

---

### 37. Chaperoning a MUN Delegation
- **Slug:** `/blog/mun-chaperone-guide`
- **Audience:** faculty advisor, parent volunteer, teacher travelling with students
- **Level:** beginner to intermediate
- **Intent:** operational and anxious. A teacher is about to take 15 teenagers abroad.
- **Primary keyword:** chaperoning a Model UN trip
- **Secondary:** MUN trip permission slip, taking students to a MUN conference, MUN risk
  assessment
- **Promise:** Everything to arrange before you travel, and the rules to set once you arrive.
- **Outline:**
  - Your legal position: your students remain your responsibility at someone else's conference
  - Permissions and paperwork: consent forms, medical information, dietary requirements,
    emergency contacts, insurance
  - Risk assessment, which your school will require. What it has to cover for a MUN trip
  - Ratios and second adults, and the rules for overnight trips
  - Travel: passports, visas, timings, and the contingency for a delayed return
  - Accommodation rules and the conversation to have on arrival
  - The rules you set for the trip, agreed in writing with students and parents before you go
  - Your daily schedule: check-ins, debriefs, and how present to be
  - Medical and welfare: what you carry, what you can administer, who you call
  - Behaviour incidents away from home, and the decision to send a student back
  - Staying in touch with parents and school during the trip
  - Your own workload and the second adult who makes it survivable
- **Length:** 2,200-2,600 words
- **Assets:** a permission slip template; a risk assessment template; a trip pack checklist. All
  downloads, all marked as starting points to be adapted to your school's policy.
- **Links out to:** `mun-faculty-advisor-guide`, `mun-safeguarding`, `choosing-mun-conferences`,
  `mun-team-fundraising`, `mun-conference-preparation`
- **Links in from:** `mun-faculty-advisor-guide` (prominently), `mun-safeguarding`,
  `choosing-mun-conferences`
- **Cannibalisation:** **Complements `mun-faculty-advisor-guide`**, which covers the coaching
  and program side and says nothing about travel and duty of care. Same legal caveat as item
  36.

---

### 38. The MUN Club Curriculum: Ten Sessions From Nothing to First Conference
- **Slug:** `/blog/mun-club-curriculum`
- **Audience:** faculty advisor, club president, head delegate running training
- **Level:** beginner (to teach), intermediate (to run)
- **Intent:** transactional. They have a room, an hour a week and no plan.
- **Primary keyword:** MUN club training plan
- **Secondary:** Model UN lesson plan, MUN club activities, how to teach Model UN
- **Promise:** Ten ready-to-run sessions, each an hour, that take a group with no experience
  to a real conference.
- **Outline:**
  - How to use this: group size, timing, and what to do with mixed experience
  - Session 1: what MUN is, and a 20-minute mock debate on something silly to break the ice
  - Session 2: countries, positions and the difference between your view and your country's
  - Session 3: research, with a live research race
  - Session 4: the position paper, written in the session
  - Session 5: speaking, with 60-second speeches and timed feedback
  - Session 6: procedure part one, motions and the speakers list, taught by doing
  - Session 7: procedure part two, caucusing and voting
  - Session 8: resolutions and clause writing
  - Session 9: a full mock committee, two hours if you can get it
  - Session 10: conference logistics, expectations and nerves
  - Running the mock committee well, which is the hardest of the ten
  - Ongoing: what a club does in the weeks between conferences
  - Assessing progress without making it feel like school
- **Length:** 2,600-3,000 words
- **Assets:** a full session plan pack (download, ten one-page plans); printable placards; a
  starter roster and topic list for the mock committee. **Mention that a free anonymous
  session can be created in seconds so the mock committee runs on real software with the
  students on their phones, which is exactly the product's top-of-funnel.**
- **Links out to:** `start-mun-club`, `mun-faculty-advisor-guide`, `what-is-model-un`,
  `mun-glossary`, `mun-speech-examples`, `mun-position-paper-examples`, `free-mun-tools`
- **Links in from:** `start-mun-club` (prominently), `mun-faculty-advisor-guide`,
  `mun-head-delegate-guide`
- **Cannibalisation:** Clear. This is the single most useful page on the plan for a faculty
  advisor and it is not written anywhere well. It is also the most natural place in the entire
  blog for a genuine product demonstration.

---

### 39. Putting Model UN on Your CV and University Application
- **Slug:** `/blog/mun-on-your-cv`
- **Audience:** delegate applying to university or a first job, head delegate, chair
- **Level:** intermediate
- **Intent:** transactional-informational, high emotional stakes, seasonal (autumn peak).
- **Primary keyword:** how to put Model UN on your CV
- **Secondary:** Model UN resume example, MUN on college application, how to describe Model UN
  experience
- **Promise:** How to write four years of MUN into three lines that a reader who was not there
  will believe.
- **Outline:**
  - The failure mode: a list of conferences attended, which reads as attendance
  - What a reader actually credits: role, scale, outcome, and evidence
  - The three lines: what you did, how big it was, what resulted
  - Before and after: six real-shaped entries rewritten
  - Awards: how to state them so they are understood by someone who does not know the circuit
  - Chairing, secretariat and founding a conference, which are the entries that carry real
    weight
  - Where MUN goes on a CV, and when it should be cut
  - The personal statement: using one committee as a story instead of listing the activity
  - Interviews: the two MUN questions that come up and how to answer them without jargon
  - Verifiability, which is the quiet problem: everything above is self-reported. A record
    issued by the conference, or a public profile a reader can open, is worth more than a
    claim
- **Length:** 1,900-2,300 words
- **Assets:** six before/after CV entry pairs; a phrase bank for describing MUN outcomes in
  non-MUN language. Link to a real public MUN CV as a worked example.
- **Links out to:** `is-mun-worth-it`, `mun-award-categories`, `how-to-become-a-mun-chair`,
  `mun-head-delegate-guide`, `university-mun-guide`
- **Links in from:** `is-mun-worth-it` (prominently), `mun-awards-guide`,
  `mun-award-categories`, `how-to-become-a-mun-chair`
- **Cannibalisation:** Clear. Also the best natural fit for the MUN CV product: the
  verifiability section is a real argument, not an advert, and it should link to `/cv/[id]`
  as an example rather than to a signup page.

---

### 40. Venue and Logistics for a MUN Conference
- **Slug:** `/blog/mun-conference-venue-logistics`
- **Audience:** organiser, logistics team
- **Level:** advanced
- **Intent:** operational. Usually the first big commitment.
- **Primary keyword:** MUN conference venue
- **Secondary:** Model UN conference logistics, how many rooms for a MUN conference, MUN venue
  checklist
- **Promise:** How to pick a venue that fits, and everything to ask before you sign.
- **Outline:**
  - Sizing: rooms needed for N committees, plus the plenary, plus registration, plus staff
    space. A table, because this is the calculation people get wrong
  - Room requirements per committee: seats, table layout, projector, power, acoustics, and
    the one that always fails, wifi for 40 phones
  - The plenary space, used twice and priced for the whole day
  - Using a school, a university and a hired venue: the real trade-offs, including who is
    liable
  - The site visit: a checklist of what to look at and what to measure
  - The contract: dates, access times, cancellation terms, damage, insurance, what is included
  - Catering: options, dietary requirements, and the timing of 400 lunches
  - Accessibility: step-free routes, lifts, accessible toilets, hearing loops, quiet room.
    This determines who can attend, so decide it before you sign
  - Signage and wayfinding, which is cheap and always under-done
  - Technology on site: what to bring, what to hire, and what to assume will not work
  - Staff and volunteer space, and the room nobody books
- **Length:** 2,400-2,800 words
- **Assets:** a room-requirement calculator table; a site visit checklist (download); a venue
  contract question list.
- **Links out to:** `mun-conference-budget`, `mun-conference-day-operations`,
  `mun-accessibility`, `start-a-mun-conference`, `mun-secretariat-roles`
- **Links in from:** `start-a-mun-conference`, `mun-conference-budget`,
  `mun-conference-planning`, `mun-conference-day-operations`
- **Cannibalisation:** **Complements `mun-conference-planning`**, whose "Eight Months Out"
  section mentions venue. That stays a single bullet linking here.

---

### 41. Running the Closing Ceremony and Awards
- **Slug:** `/blog/mun-award-ceremony-guide`
- **Audience:** secretariat, secretary-general, chair submitting a slate
- **Level:** intermediate to advanced
- **Intent:** operational, searched in the final week.
- **Primary keyword:** MUN closing ceremony
- **Secondary:** MUN awards ceremony, how to run MUN award ceremony, Model UN closing ceremony
  script
- **Promise:** How to collect, ratify and announce awards without a controversy or a two-hour
  ceremony.
- **Outline:**
  - Deciding award policy before the conference, not on the last morning
  - Categories and quotas per committee, published in advance so chairs are not inventing
    them
  - Collecting slates from chairs: the deadline, the format, and the evidence you ask for
  - Ratification: what the secretariat is actually checking, and the two reasons to send a
    slate back
  - Delegation awards: how the tally works, and publishing the formula beforehand so it cannot
    be argued with afterwards
  - Certificates: producing 400 of them without a crisis
  - The ceremony itself: a run of show that takes 45 minutes, not two hours
  - Announcement order, and the small choices that make it feel like an occasion
  - Photography and the moment delegates actually want
  - Handling a disputed award, which will happen at least once
  - After: publishing the results, sending records to delegates, and the fact that a result
    a delegate can prove years later is worth more than a certificate that gets lost
- **Length:** 2,000-2,400 words
- **Assets:** a ceremony run of show; a chair slate submission form template; a certificate
  template; a delegation-award tally sheet.
- **Links out to:** `mun-award-categories`, `mun-judging-rubric`, `mun-awards-guide`,
  `mun-conference-day-operations`, `mun-on-your-cv`
- **Links in from:** `mun-conference-day-operations`, `mun-award-categories`,
  `mun-judging-rubric`, `mun-director-guide`
- **Cannibalisation:** Clear, and organiser-facing where both existing awards posts are
  delegate-facing. **Product note:** Gavelling's awards surfaces are currently behind a
  coming-soon screen (CLAUDE.md section 5). This post must NOT claim a live awards feature.
  Write it as procedure advice and revisit the CTA when awards ship.

---

### 42. Accessibility and Inclusion at MUN Conferences
- **Slug:** `/blog/mun-accessibility`
- **Audience:** organiser, faculty advisor, chair
- **Level:** intermediate to advanced
- **Intent:** informational-operational. Low volume, high trust and link value.
- **Primary keyword:** accessible MUN conference
- **Secondary:** Model UN accessibility, inclusive Model UN, MUN conference disability access
- **Promise:** What to change so that your conference is genuinely attendable, from the venue
  to the dais.
- **Outline:**
  - Physical access: routes, lifts, seating, toilets, and the questions to ask at the site
    visit
  - Deaf and hard of hearing delegates: captioning options, hearing loops, room acoustics, and
    what a chair can do for free (repeat motions, face the room, use the screen)
  - Blind and low vision delegates: documents in accessible formats, the screen as a shared
    source of truth, speaking lists read aloud
  - Neurodivergent delegates: a quiet room, predictable schedules, written procedure, and why
    the unmoderated caucus is often the hardest part of the day
  - Anxiety and first-timers: lowering the cost of a first speech
  - Language: non-native English speakers, speaking speed, and what a chair should say at the
    start
  - Cost as an access barrier, and financial aid that is easy to ask for
  - Gender, religion and dress code: what to write down about attire so it is not enforced
    arbitrarily
  - Dietary and medical requirements collected once and actually used
  - Digital accessibility of your own conference materials and website
  - Writing an access statement, and why publishing it increases attendance
- **Length:** 2,000-2,400 words
- **Assets:** an access checklist across venue, materials, committee and communication; an
  access statement template.
- **Links out to:** `mun-conference-venue-logistics`, `mun-safeguarding`,
  `mun-conference-day-operations`, `mun-difficult-delegates`, `how-to-chair-first-mun`
- **Links in from:** `mun-conference-venue-logistics`, `mun-safeguarding`,
  `mun-conference-planning`
- **Cannibalisation:** Clear, and essentially unwritten in MUN. Low traffic, high editorial
  value, and the kind of page that earns links from university societies and teacher networks.

---

### 43. Model UN Dress Code: What To Wear
- **Slug:** `/blog/mun-dress-code`
- **Audience:** new delegate, parent, faculty advisor
- **Level:** beginner
- **Intent:** informational, high volume, low depth, high anxiety.
- **Primary keyword:** what to wear to Model UN
- **Secondary:** MUN dress code, western business attire Model UN, Model UN outfit
- **Promise:** What western business attire actually means, on a student budget, with the
  things chairs notice.
- **Outline:**
  - What "western business attire" means in practice and what it does not require
  - A workable outfit for anyone, on a budget, including what you probably already own
  - Shoes, which is the mistake everyone makes once, and the second pair
  - What is not acceptable at most conferences, stated plainly and without moralising
  - National dress and cultural attire, which most conferences explicitly welcome
  - Religious dress
  - Gender-neutral guidance, and conferences that are moving away from gendered rules
  - Socials and the other dress codes in the weekend
  - Crisis and cabinet committees, which are sometimes different
  - Online conferences
  - What to actually carry with you into committee
- **Length:** 1,300-1,600 words. This one is deliberately short.
- **Assets:** two or three simple illustrated outfit diagrams; a packing list. No download
  needed.
- **Links out to:** `mun-for-beginners`, `mun-conference-preparation`, `what-is-model-un`
- **Links in from:** `mun-for-beginners`, `mun-conference-preparation`, `what-is-model-un`
- **Cannibalisation:** Clear. Low commercial value and it will never convert anybody, but it
  is high-volume beginner traffic that feeds the beginner cluster, and the cluster is what
  converts later. Write it once, keep it short, do not over-invest.

---

### 44. Comparing MUN Procedures: THIMUN, UNA-USA and Harvard Style
- **Slug:** `/blog/mun-procedure-styles-compared`
- **Audience:** delegate crossing circuits, chair writing a rulebook, organiser choosing one
- **Level:** intermediate
- **Intent:** comparison. A genuinely distinct query from either ruleset alone.
- **Primary keyword:** THIMUN vs UNA-USA
- **Secondary:** Model UN procedure styles, types of MUN procedure, which MUN rules of
  procedure to use
- **Promise:** The three main procedures side by side, and which one to run at your
  conference.
- **Outline:**
  - The three families and where each is used
  - One comparison table covering: debate structure, caucuses, lobbying, amendments, points,
    voting, awards, formality
  - Where debate energy sits in each, which is the real difference
  - What transfers between them and what actively misleads you
  - Crisis procedure as a fourth family with its own rules
  - Conferences that run a hybrid, which is most of them
  - Choosing a procedure for your own conference: delegate experience, committee size, staff
    experience, and how much you want to write
  - Writing your own rulebook: what must be decided, and the sections that cause disputes
  - Explaining the procedure to delegates before they arrive
- **Length:** 1,900-2,300 words, table-led
- **Assets:** the large comparison table (the main asset, should be the thing that ranks);
  a decision list for organisers.
- **Links out to:** `thimun-rules-of-procedure`, `una-usa-rules-of-procedure`,
  `mun-rules-of-procedure`, `mun-motions-explained`, `mun-crisis-committee-guide`,
  `choosing-mun-conferences`
- **Links in from:** `thimun-rules-of-procedure`, `una-usa-rules-of-procedure`,
  `mun-rules-of-procedure`, `choosing-mun-conferences`, `start-a-mun-conference`
- **Cannibalisation:** **Sits between items 9, 10 and the existing `mun-rules-of-procedure`.**
  Four procedure pages is the ceiling. The split must be enforced: generic reference
  (existing), THIMUN (9), UNA-USA (10), comparison (this). If items 9 and 10 are not both
  written, write this one as the single "styles" page instead and skip them.

---

### 45. Head Delegate Guide: Leading a School Delegation
- **Slug:** `/blog/mun-head-delegate-guide`
- **Audience:** head delegate, club president, experienced delegate stepping up
- **Level:** intermediate to advanced
- **Intent:** role-shaped, under-served.
- **Primary keyword:** MUN head delegate
- **Secondary:** head delegate responsibilities, leading a MUN delegation, MUN team captain
- **Promise:** The job nobody writes down: selecting, preparing and holding together a
  delegation.
- **Outline:**
  - What the role actually is, and the split of responsibility with the faculty advisor
  - Selecting the delegation: criteria, fairness, and telling people no
  - Distributing country and committee assignments inside your team
  - Running preparation: deadlines, drafts, mock sessions, and who checks what
  - The head delegate at the conference: your own committee plus everyone else's
  - Daily team rhythm: morning brief, lunch check-in, evening debrief
  - Supporting a delegate who is struggling, without doing it for them
  - Managing the delegation's reputation, because chairs remember schools
  - Delegation awards and how they are actually won, which is consistency not heroics
  - Conflict inside a team, which is the part that ends friendships
  - Handover: preparing the next head delegate, and the document that makes it survivable
  - Your own performance, which will suffer, and deciding in advance how much
- **Length:** 2,200-2,600 words
- **Assets:** a team preparation timeline; a delegation handover template; a selection criteria
  grid.
- **Links out to:** `mun-faculty-advisor-guide`, `choosing-mun-conferences`,
  `mun-conference-preparation`, `mun-award-categories`, `mun-negotiation-tactics`,
  `mun-club-curriculum`
- **Links in from:** `mun-faculty-advisor-guide`, `start-mun-club`, `mun-club-curriculum`,
  `choosing-mun-conferences`, `mun-delegate-tips`
- **Cannibalisation:** Clear. Genuinely absent from the blog and thinly covered everywhere
  else, despite being one of the most common leadership roles in school MUN.

---

### 46. Hosting an Online or Hybrid MUN Conference
- **Slug:** `/blog/host-hybrid-mun-conference`
- **Audience:** organiser, secretariat, faculty advisor running an in-house event
- **Level:** intermediate to advanced
- **Intent:** operational. Structural demand: online conferences lowered the barrier to
  entry and never went away.
- **Primary keyword:** how to host an online MUN conference
- **Secondary:** hybrid Model UN conference, virtual MUN conference platform, running MUN
  online
- **Promise:** What actually changes when the conference is online or split across rooms, and
  the setup that survives eight hours.
- **Outline:**
  - Fully online vs hybrid vs in-person with remote delegations. Three different problems
  - Time zones, which decide your schedule and your delegate pool
  - Session length: an eight-hour in-person day is a four-hour online day. Plan accordingly
  - The stack: video, committee management, document sharing, chat. What each must do and
    where a single tool helps
  - Procedure online: raising placards, voting, unmoderated caucus in breakouts
  - The unmoderated caucus is the hardest part online. Three ways to run it
  - Keeping delegates engaged when they can mute you
  - The hybrid trap: remote delegates in an in-person committee are second-class unless you
    design against it. Concrete measures
  - Chair workload online, which is higher, and the second chair that fixes it
  - Safeguarding and conduct online: recording, private messages, moderation
  - Fees and value: what an online conference can honestly charge
  - Testing the whole thing a week before, with real people
- **Length:** 2,400-2,800 words
- **Assets:** a stack comparison table; an online day schedule template; a pre-conference test
  checklist.
- **Links out to:** `mun-online-committees`, `mun-technology-guide`,
  `mun-conference-day-operations`, `start-a-mun-conference`, `best-mun-software-2026`,
  `mun-safeguarding`
- **Links in from:** `mun-online-committees` (prominently), `mun-technology-guide`,
  `start-a-mun-conference`
- **Cannibalisation:** **Complements `mun-online-committees`**, which is chair-and-delegate
  facing ("how to chair and participate remotely"). This is organiser-facing ("how to host
  one"). The existing post keeps all in-committee advice; this post keeps all logistics,
  money and stack decisions. Neither repeats the other.

---

### 47. MUN Country Profiles: Policy Briefs for the Most-Assigned Countries
- **Slug:** `/blog/mun-country-profiles`
- **Audience:** delegate, faculty advisor preparing a team
- **Level:** beginner to intermediate
- **Intent:** reference, repeat use, strong internal-link hub.
- **Primary keyword:** Model UN country profile
- **Secondary:** MUN country policy, country profile template MUN, Model UN country research
  sheet
- **Promise:** A one-page policy brief for the twenty countries assigned most often, and a
  template for any country.
- **Outline:**
  - How to use a brief: it is a starting point, not a substitute for the voting record
  - The template, explained: government, economy, region, bloc memberships, standing positions,
    red lines, typical allies, typical opponents
  - Twenty briefs, each one screen: the P5, plus Germany, Japan, India, Brazil, South Africa,
    Nigeria, Egypt, Saudi Arabia, Iran, Turkey, Indonesia, Mexico, Australia, Canada, Kenya
  - How to extend a brief for a specific topic
  - Countries with no clear position, and how to reason about them
  - A blank template to download
- **Length:** 3,000-3,500 words, but structurally twenty short blocks. Consider splitting into
  twenty sub-pages later ONLY if each can carry genuine depth; twenty thin pages would be a
  quality risk and should not be created as a first move.
- **Assets:** twenty profile cards; a blank profile template (download); ideally a filterable
  table. **This is the entry in the plan most likely to be better as a tool than an article:
  see section 4.**
- **Links out to:** `mun-country-research`, `mun-position-paper-guide`, `mun-bloc-building`,
  `mun-security-council-guide`
- **Links in from:** `mun-country-research` (prominently), `mun-position-paper-guide`,
  `mun-club-curriculum`, `mun-for-beginners`
- **Cannibalisation:** **Complements `mun-country-research`**, which teaches the method. This
  supplies the output. Do not let this page teach research method.
- **Risk note:** the highest maintenance burden on the plan. Policy positions age. Either
  commit to an annual review with a visible "reviewed" date, or reduce it to the template plus
  ten briefs.

---

### 48. University Model UN: How It Differs From High School
- **Slug:** `/blog/university-mun-guide`
- **Audience:** school leaver, first-year university student, university society committee
- **Level:** intermediate
- **Intent:** transitional. Someone good at school MUN arriving at university.
- **Primary keyword:** university Model UN
- **Secondary:** college MUN vs high school MUN, university MUN society, collegiate Model UN
- **Promise:** What changes at university level, and how to arrive ready instead of
  surprised.
- **Outline:**
  - The step up: preparation depth, speaking standard, and the assumption that you know
    procedure
  - Committee types you will meet more of: specialised agencies, crisis, historical, JCC
  - The circuit: travelling teams, selection and trials, and how a university society works
  - Selection for a travel team, which is competitive and often opaque. How to make the case
  - Funding: society budgets, student union grants, travel costs
  - Chairing and staffing at university level, which arrives much sooner than people expect
  - Running your society's own conference, which is the biggest thing most societies do
  - Academic overlap: which degrees actually benefit, and how to use it
  - Time cost, honestly
  - Careers: diplomacy, law, policy, consulting, and what MUN is actually worth in each
  - If your university has no society, start one
- **Length:** 2,000-2,400 words
- **Assets:** a high school vs university comparison table; a society structure diagram.
- **Links out to:** `is-mun-worth-it`, `mun-on-your-cv`, `how-to-become-a-mun-chair`,
  `start-a-mun-conference`, `choosing-mun-conferences`, `mun-crisis-committee-guide`
- **Links in from:** `is-mun-worth-it`, `mun-on-your-cv`, `choosing-mun-conferences`,
  `start-mun-club`
- **Cannibalisation:** Clear. Explicitly requested in the brief and genuinely under-served:
  most MUN content is written for one level without saying which.

---

### 49. Visa Invitation Letters for International Delegations
- **Slug:** `/blog/mun-visa-invitation-letters`
- **Audience:** organiser, faculty advisor with international students
- **Level:** advanced
- **Intent:** narrow, urgent, high-stakes. Someone's delegation cannot travel.
- **Primary keyword:** MUN conference visa invitation letter
- **Secondary:** Model UN visa letter template, inviting international delegates MUN,
  MUN conference visa support
- **Promise:** What a visa invitation letter must contain, when to issue it, and how not to
  create a problem for your conference.
- **Outline:**
  - Why international delegations need a letter and what it is and is not
  - Lead times: three to six months is normal, and later than that means they are not coming
  - What the letter must contain: conference details, dates, the named delegate, their role,
    who is paying, accommodation, and a named signatory with a contact
  - Who signs it, and why a student signature is often not enough. Getting institutional
    letterhead
  - What you should never say in one, including guarantees about the applicant
  - Your own exposure: what you are being asked to vouch for, and the policy that protects you
  - Requiring payment or acceptance before issuing, and why that is standard
  - Handling a refusal: refund policy, remote participation, reallocating the seat
  - Tracking who has asked, who has been issued, and who has travelled
  - Related paperwork: proof of accommodation, travel insurance, parental consent for minors
  - A template letter
- **Length:** 1,600-2,000 words. This one is deliberately narrow and precise.
- **Assets:** a visa invitation letter template (download, with a clear caveat); a lead-time
  timeline; a tracking sheet.
- **Links out to:** `mun-conference-registration-payments`, `start-a-mun-conference`,
  `mun-conference-marketing`, `mun-chaperone-guide`, `mun-safeguarding`
- **Links in from:** `mun-conference-registration-payments`, `start-a-mun-conference`,
  `choosing-mun-conferences`, `mun-chaperone-guide`
- **Cannibalisation:** Clear, and effectively unwritten. Low volume, extremely high intent,
  and the kind of page a secretariat bookmarks and shares. **Same caveat as item 36: this
  touches immigration, so it needs the "not legal advice, requirements vary by country" line
  and must not promise outcomes.**

---

### 50. The MUN Press Corps: Being a Journalist in Committee
- **Slug:** `/blog/mun-press-corps-guide`
- **Audience:** press delegate, press director, organiser considering adding a press committee
- **Level:** intermediate
- **Intent:** informational, narrow, almost unwritten.
- **Primary keyword:** MUN press corps
- **Secondary:** International Press Model UN, MUN journalist role, how to run a press
  committee MUN
- **Promise:** How a press committee actually works, what gets you judged well, and how to run
  one.
- **Outline:**
  - What a press corps is for and the two models: independent journalists vs assigned outlets
  - The assigned outlet model, which is the more interesting one: writing as a state
    broadcaster is a policy exercise
  - What you do all day: sitting in committees, interviewing, filing to deadline
  - Article forms: news report, interview, op-ed, front page, live coverage
  - Interviewing a delegate mid-conference without disrupting the room
  - Photography and multimedia
  - Deadlines and publishing: how conferences actually distribute press output
  - How press delegates are judged, which is different from every other committee
  - Running a press committee as a director: assignments, editing, workload, publication
  - Ethics: fabrication, in-character bias, and the line
  - Why a press corps improves the whole conference, which is the argument to make to your
    secretariat
- **Length:** 1,700-2,000 words
- **Assets:** one example article per form; a press committee brief template.
- **Links out to:** `mun-committee-types`, `mun-crisis-committee-guide`,
  `mun-secretariat-roles`, `mun-judging-rubric`
- **Links in from:** `mun-committee-types` (prominently), `mun-secretariat-roles`,
  `mun-glossary`
- **Cannibalisation:** Clear. Lowest expected traffic on the list, near-zero competition, and
  it completes the "everything about MUN" coverage the owner asked for. Write it last.

---

## 2. The top 10 for traffic

Judgement calls from SERP shape and competitor coverage. No volumes were measured.

| # | Post | Why |
|---|---|---|
| 1 | `what-is-model-un` | The head term of the entire category and we do not have a page for it. Every other post in the beginner cluster currently has nothing to link up to. Institutional sites (un.org, AMUN) own the branded phrase, but the question form is winnable with a better page. |
| 2 | `mun-glossary` | Permanent reference demand, repeat visits, snippet-friendly, and the strongest internal link hub available. wisemee and munprep hold it with thin definition lists. |
| 3 | `mun-position-paper-examples` | "Example" queries convert to clicks far better than "how to" queries in student niches, and our existing how-to post has no example to send them to. The demand is already proven by the existing post's topic. |
| 4 | `mun-clause-phrases` | "Operative clauses list" and "preambulatory phrases" are the most-copied artefacts in MUN. Currently served mostly by PDFs and scanned handouts, which are weak competitors. A clean copyable list should win. |
| 5 | `mun-resolution-example` | Same logic as 3. "Sample resolution" is searched by everyone who has ever been told to write one. |
| 6 | `mun-for-beginners` | Broad, evergreen, seasonal spike every August to October, and the natural second stop after item 1. |
| 7 | `mun-dress-code` | High-volume, low-effort beginner query with almost no good answer. It will never convert anyone, but it feeds the beginner cluster. |
| 8 | `mun-committee-types` | Searched by every delegate filling in a preference form, which is most delegates, once a year. Also the router into our UNSC and crisis guides. |
| 9 | `is-mun-worth-it` | High-volume and high-engagement, searched by students and parents, with a SERP that already contains scepticism, so an honest answer is differentiated rather than contrarian. |
| 10 | `mun-speech-examples` | "Example" demand again, and the existing `mun-opening-speech` proves the topic works for us. |

Close runners-up, in order: `mun-country-research`, `thimun-rules-of-procedure`,
`start-mun-club`, `mun-crisis-directive-guide`, `mun-points-explained`.

Note the pattern: seven of the ten are beginner or "show me the artefact" pages. That is
where the volume is. It is not where the money is, which is the next section.

## 3. The five most likely to convert an organiser

Conversion here means: an organiser or aspiring organiser reads the page and creates a
conference on Gavelling. These are ranked by intent, not by traffic. All five are low-volume
compared with section 2.

1. **`start-a-mun-conference`** — the single highest-intent query in the space. Someone
   searching it is deciding to run a conference. The post's founding-team, scope and
   first-year-economics sections make it the natural place to introduce a platform, and the
   honest pitch is structural: the organiser pays nothing, which nobody else can say. Link to
   `/create` for the mock-session path and to the organiser signup for the real one.

2. **`mun-conference-budget`** — the page where the competitor's pricing model dies on its
   own terms. A reader building a line-item budget will encounter "software" as a line, and
   the honest comparison is that some platforms charge the organiser per participant per day
   while Gavelling charges them nothing and makes them merchant of record. Do not oversell
   it: state the figure, link to `mymun-alternative` for the full comparison, and move on.
   The budget spreadsheet download is the lead magnet.

3. **`mun-conference-registration-payments`** — the highest product-fit page on the list.
   Every section (staged registration, delegation block payment, manual payment proof review,
   per-role fees, financial aid, refunds, reconciliation) maps onto something Gavelling
   already does and most organisers currently do in a spreadsheet and an inbox. The pain is
   acute and the reader is already looking for a system.

4. **`mun-country-allocation`** — Gavelling's deepest genuine differentiator (scored
   allocation, seat importance tiers, double delegations, delegation blocks) and the job an
   organiser most dreads. The post can be entirely vendor-neutral and still convert, because
   the "by hand vs with software" section writes itself once you have described the problem
   honestly.

5. **`mun-conference-day-operations`** — searched in the final week, when the reader is
   anxious and will try anything. The "knowing what is happening in twelve rooms at once"
   section is a live status wall, which is a thing Gavelling has and almost nobody else does.
   Also the fastest possible trial: a free session can be created in under a minute.

Runners-up worth naming: **`how-to-become-a-mun-chair`** (feeds `/conferences/roles`, which
is a real product surface currently getting no editorial traffic), **`mun-club-curriculum`**
(session 9's mock committee is the most natural free-session demo in the whole plan), and
**`mun-on-your-cv`** (the verifiability section is the honest argument for the MUN CV, and it
converts a delegate rather than an organiser, which is the top of the other funnel).

## 4. Pages that should be tools or downloads, not articles

Several entries above are really an asset with an article wrapped round it. Build the asset
first; if the asset is good the article writes itself and earns links.

**Build as an interactive tool (article is the wrapper):**
- **`mun-clause-phrases`** — a searchable, copy-on-tap phrase list with a filter by operative
  force and by organ. As prose it is a wall of text; as a tool it is something delegates keep
  open during drafting and link to each other.
- **`mun-country-profiles`** — really a filterable data table, not an article. Twenty prose
  blocks will read badly and age badly. Consider building it as a small data-driven page with
  a `reviewed` date, or cut it to the template plus ten briefs.
- **`mun-resolution-example`** — a resolution formatter (paste your clauses, get correct
  numbering, indentation and punctuation) would out-earn the article by a wide margin and is
  a small build.

**Ship the download with the article, and treat the download as the deliverable:**
- `mun-conference-budget` → budget spreadsheet (XLSX). Build before writing.
- `mun-position-paper-examples` → .docx template plus the three example PDFs.
- `mun-background-guide-writing` → full background guide .docx template.
- `mun-club-curriculum` → ten one-page session plans as a single PDF pack.
- `mun-judging-rubric` → printable rubric and scoresheet.
- `mun-chaperone-guide` → permission slip, risk assessment, trip pack checklist.
- `mun-safeguarding` → policy template, code of conduct, incident form.
- `mun-visa-invitation-letters` → letter template.
- `mun-conference-venue-logistics` → site visit checklist.
- `mun-conference-sponsorship` → proposal deck template and sponsor report template.
- `mun-conference-registration-payments` → refund policy and invoice templates.
- `mun-secretariat-roles` → handover document template.
- `choosing-mun-conferences` → conference evaluation scorecard.

**Not a new page at all, attach to an existing one:**
- A printable one-page dais cheat sheet (motions in precedence order, voting thresholds,
  quorum, the exact chair phrases) belongs as a download on the existing
  `mun-rules-of-procedure` and `mun-chair-script`, not as a 51st post. It would cannibalise
  both.

**Downloads and indexability:** `next.config.ts` already sets `X-Robots-Tag: noindex` on
`*.pdf` and `*.txt` and they are not disallowed, which is exactly right. Downloads must never
be listed in the sitemap and must always sit behind an HTML page that is. Do not gate any of
them behind an email form: the conversion is the product, not a mailing list, and gating
would kill the links these assets exist to earn.

## 5. Publishing, clusters and indexing

**Shelf assignment.** The manifest already has five categories. Every one of the 50 gets one
of them, no new taxonomy. Set `category` when adding the manifest entry:

| `category` | Shelf label | New posts assigned to it |
|---|---|---|
| `delegates` | For delegates | 1, 2, 3, 5, 6, 11, 13, 16, 19, 20, 29, 39, 43, 45, 47, 48 |
| `procedure` | Rules and procedure | 4, 9, 10, 30, 44, 50 |
| `chairing` | Chairing | 12, 17, 21, 22, 23, 24, 26, 27, 28 |
| `organisers` | For organisers | 7, 8, 14, 15, 18, 25, 31, 32, 33, 34, 35, 36, 37, 38, 40, 41, 42, 49 |
| `software` | Tools and comparisons | 46 |

Three judgement calls in that table, flagged so they can be overruled:
- **Item 4 (clause phrases) goes in `procedure`, not `delegates`**, to keep the `delegates`
  shelf from swallowing the whole writing cluster. Items 3 and 5 stay in `delegates` because
  they are artefacts a delegate wants, not rules.
- **Items 18, 33, 35, 37, 38 (the school and faculty advisor set) go in `organisers`.** There
  is no `schools` shelf and adding one for six posts would strand the shelf. `organisers` is
  the least wrong fit: the reader is an adult running something.
- **Item 46 (hosting online) is the only new `software` post**, which leaves that shelf at
  seven posts, all commercial. That is deliberate: it is the highest-converting shelf and
  should stay tight rather than being padded.

`organisers` ends up the largest shelf at 18 new posts plus the two existing ones, which is
the clearest argument for the five shelf hub URLs in section 0: "MUN guides for organisers"
is a landing page worth having, and right now it is only an anchor on `/blog`.

**Cadence.** Do not publish 50 posts in one week. Suggested order, roughly twelve weeks:
1. Weeks 1-2: items 1 and 2, plus the five shelf hub pages if they are being built (the
   pillar and the hubs first, so later posts land into a structure rather than beside one).
2. Weeks 3-5: items 3, 4, 5, 6, 11, 43, 19, 20 (the traffic set).
3. Weeks 6-8: items 7, 8, 14, 15, 25, 31, 32, 34, 40 (the conversion set, and the one to
   finish before modeldiplomat consolidates).
4. Weeks 9-10: items 9, 10, 30, 44, 17, 21, 22, 23, 28 (procedure and chairing).
5. Weeks 11-12: the remainder, ending with items 42, 49, 50.

**Indexing work required alongside:** the sitemap now reads `updated ?? date` straight off the
manifest, so a correct manifest entry is all a post needs. Set `date` honestly, leave
`updated` unset until the content really changes, and never batch-touch `updated` to look
fresh. If the five shelf hubs are built they need their own `sitemap.ts` entries with their
own content dates. Decide the priority band (proposal: shelf hubs and the ten pillars at 0.85,
the competitor-alternative posts stay 0.9, everything else 0.8). Ping IndexNow on publish the
same way conference pages do, and run `npm run check:indexability` and `npm run check:og`
after each batch, not at the end.

**Schema worth adding** (the template agent's call): `FAQPage` on items 1, 13, 30 and 43;
`HowTo` on 3, 4, 5, 12, 22; `DefinedTermSet` on item 2. All three are honest fits and none
requires new copy.

**E-E-A-T gap to close:** `articleSchema.author` is `Organization` on every post. For items
36, 37 and 49 (safeguarding, chaperoning, visas) that is not good enough: those need a named
human author, a `dateModified` that is genuinely maintained, and an explicit scope caveat.

## 6. What is missing, and what I deliberately did not include

**Genuine gaps that did not make the 50 and probably should be numbers 51 to 55:**
1. **`mun-committee-topics`** — "Model UN topic ideas" is a large, recurring query from both
   chairs writing background guides and organisers building a slate, and it is not covered by
   any existing post or by any of the 50. It was cut only for room. It is a strong candidate
   for the next batch and a natural companion to item 22.
2. **`mun-opening-ceremony-speech`** — the Secretary-General's opening address. Narrow, but
   searched by exactly one person per conference at exactly the moment they are panicking.
3. **`mun-conference-website`** — what a conference page must contain to convert a faculty
   advisor. Would slot under organising and is a direct fit for the public conference page
   product, but it overlaps item 31's page-checklist section, so it needs a clean split first.
4. **`mun-delegation-management` (organiser side)** — I split this across items 14, 15 and 45
   rather than giving it a page. If the delegation-block flows turn out to be a bigger part of
   the organiser story than assumed, it deserves its own.
5. **`mun-ai-policy`** — conferences are starting to write down rules about AI-assisted
   position papers and background guides, and there is no good reference anywhere. Genuinely
   new territory, no competition, and likely to be a large query within a year. Speculative,
   which is why it is not in the 50.

**Deliberately excluded, with reasons:**
- **"Best MUN conferences 2026" style rankings.** That is `/conferences/explore`'s job. A blog
  ranking would cannibalise a commercially important product surface and would need constant
  maintenance.
- **Individual country pages** (200 of them). Thin-content risk at exactly the scale Google
  penalises, and item 47 already covers the top twenty in one strong page.
- **Individual conference reviews** (HMUN, NHSMUN, WorldMUN). Volatile, occasionally
  contentious, and better handled as user reviews on conference pages than as editorial.
- **Translated guides.** CLAUDE.md section 4 forbids hreflang until real indexable
  self-canonical locale URLs exist. The four locales are an app feature, not a blog feature.
  Do not translate the blog as part of this project.

**Two structural risks a writer cannot fix alone:**
- `RelatedGuides` now matches on shelf, which is a large improvement, but it still cannot
  point post A at the one specific post B that completes it. Every "links out to" list below
  is therefore a set of IN-BODY links a writer has to place by hand. A batch of posts written
  without them will look complete and pass every check while passing no link equity at all.
  The cheapest insurance is a `related?: string[]` field on `BlogPost` fed from these lists.
- Seven of the existing 34 posts need small edits as part of this project, not after it:
  `mun-position-paper-guide` (trim research section, link to items 3 and 16),
  `mun-resolution-writing` (link to items 4 and 5), `mun-rules-of-procedure` (link to items
  9, 10, 44 at its "rules differ" sentence), `mun-points-of-order` (link to item 30),
  `mun-awards-guide` (link to items 23 and 24), `mun-faculty-advisor-guide` (trim "Choosing
  Conferences" and "Building the Program", link to items 18, 35, 37), `mun-director-guide`
  (link to items 7, 14, 25, 32). Without those edits the new posts sit beside the old ones
  instead of above them, and several of the cannibalisation mitigations above do not hold.
