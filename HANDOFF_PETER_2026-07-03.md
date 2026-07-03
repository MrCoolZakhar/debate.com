# PETER → CHRISTIAN'S CLAUDE — SESSION HANDOFF, 2–3 JULY 2026

Everything Peter's Claude Code session changed on `feature/conferences-auth` across 2–3 July, written for the architecture-holding Claude. Read top to bottom once; the GOTCHAS and OPEN RISKS sections are the parts that will bite prompts if skipped. All commits are on `origin/feature/conferences-auth`. Nothing touched the deploy branch or the sessions runtime logic.

Range: everything after your `001d6a9` is Peter's 3 July work; the 2 July work (`8e7d6db`…`f3d00ed`) predates your `971e9c3`/`001d6a9` and is summarized here too since it postdates your June-30 handoff.

---

## 0. TL;DR

- **Production `/conferences` landing replaced** with the owner-approved "Stagefront" composition (research-driven, several iterations). One more iteration is in flight (see §10).
- **Conference detail page** rebuilt twice: mymun-grade committee display → role-aware page + review system. **Reviews violate PRD rule 11 — needs a product decision (§9).**
- **New feature systems shipped**: conference reviews, previous-editions lineage with owner approval, age capture + per-conference min-age, drag-and-drop allocation board with importance tiers + suggestions, role-aware apply flow (ONE Apply button), job board rebuilt twice.
- **Account section overhauled twice** (profile, MUN CV timeline, calendar, points) + auto-derived experience level.
- **Three real bugs found & fixed**: supabase `getSession()` eternal-spinner hang (2.5s failsafe in AuthProvider), `conference_organizers` RLS infinite recursion (locked ALL secretariat out of /manage), conference creation 100% broken (`status:'draft'` CHECK violation + RETURNING-vs-RLS).
- **Two QA agents produced findings docs** (`docs/qa/delegate-signup-findings.md`, `CONFERENCES_EXPERIENCE.md`). **One HIGH security hole is still open: `applications` RLS lets delegates forge accepted/paid/assigned (§9.1).**
- **DB got 9 migrations + demo data**: 5 new demo conferences with real logos, reviews, ghost avatars, importance tiers. WorldMUN was renamed by you to LIMUN 2027 mid-session — all Peter's demo assets survived on that row.

---

## 1. LANDING PAGE (`/conferences`) — replaced with "Stagefront"

- **Process**: three rejected AI-looking rounds → a research pass (register of Eventbrite/Luma/Dice/RA/mymun front pages + 2026 craft standards, in `docs/design/landing-research.md`) → three concepts → owner picked V1 "Stagefront" → iterated. The lab lives at `/conferences/landing-lab?v=1|2|3` (V2 "The Record", V3 "First Gavel" kept for reference).
- **Production wiring**: `src/app/conferences/page.tsx` → `StagefrontClient.tsx` → renders `landing-lab/VariantStagefront.tsx`. **One source of truth: editing VariantStagefront changes production.** Old `ConferencesClient.tsx` is unreferenced but kept.
- **Current composition** (commit `c6cf613`): dark theatre hero (LIMUN banner constrained to hero zone, hard-fades to cream) → job-board promo "Opportunities beyond delegating" (cream, live `job_postings` stats) → **"Happening near you"** auto-scrolling rail (ivory) → MUN explainer pair (cream) → organiser tools 2×2 photo section → season ledger (ivory) → globe verbatim → ivory footer with `/Conferences.png`.
- **IP geolocation**: new `src/app/api/geo/route.ts` reads Vercel `x-vercel-ip-*` headers (nulls in dev), client falls back to `ipapi.co`; matches `conf.country`, personalizes "MUN in {country}". Only meaningful on Vercel deploys.
- **Shared card**: `src/app/conferences/ConferenceCard.tsx` — the explore card extracted; explore AND landing import it. Change it once, both update.
- **SiteNav learned two things** (`src/components/SiteNav.tsx`): (a) **floating pill nav** ported from ui/forest-ivory-redesign (center links in a fixed glass pill; logo/actions scroll away); (b) **`overlay` prop** — header floats transparently over hero media instead of the 72px ivory strip (light controls, drop-shadowed logo); (c) **conferences wordmark default**: any pathname starting `/conferences` or `/manage` shows `/Conferences.png` unless `logoOverride` is passed. The two-tone wordmark must NEVER get the gold-flatten filter.

## 2. CONFERENCE DETAIL PAGE (`/conferences/[slug]/ConferenceDetailClient.tsx`)

Rebuilt across the two days; current state:
- Hero bleeds to viewport top (`SiteNav overlay`), free-floating conference logo (150px), icon-only glass tabs (Landmark = overview, FileText = documents with a lock badge until allocated, Star = reviews).
- Committees: full-width horizontal slider of cards (free-floating committee `logo_url` — new column, see §8 — chairs from `display_chairs` jsonb, roman-numeral topics, capacity bar with % from `get_committee_occupancy()` RPC, "+ APPLY NOW" dashed circle when a chair seat is open, tri-state sort pills DIFFICULTY/AVAILABILITY/GA-CRISIS: click = asc → desc → reset). Roster is a list-format modal (flag rows, OPEN / TAKEN pills).
- **Role-aware sidebar** (Phase-2-relevant): organizer/secretariat → MANAGE CONFERENCE + EDIT PAGE, no apply; applicant → status card (+ allocation sub-card); uninvolved signed-in → **ONE "APPLY NOW"** button expanding an in-card role picker (fees, window status, disabled-with-reason); signed out → single Apply → sign-in with `next`. One-role-per-user honored (secretariat+chair coexistence displayed).
- Pricing: gold medallion (headline fee) with click-to-expand per-role breakdown. The old "Application Windows" sidebar card was removed at the owner's request — `getRoleWindowStatus` still drives the role picker.
- Docs tab locked until allocation, with a proper locked-state card.

## 3. REVIEWS SYSTEM (new; commit `7fdbad0`)

- Table `conference_reviews` (UNIQUE(conference_id, user_id), rating 1–5, review_text, `display_name` snapshot because profiles aren't anon-readable). RLS: public SELECT; INSERT/UPDATE gated by `user_attended_conference()` SECURITY DEFINER (assigned/checked-in application OR allocation). Verified by role simulation.
- UI: Reviews tab (avg + count + cards + attendee-only inline form), dismissible "How was {acronym}?" prompt on the conference page AND `/account/profile` (localStorage `review-prompt-{conferenceId}`).
- Consumes the predecessor contract defensively (works whether or not the columns exist).
- 4 demo reviews seeded on LIMUN from genuinely-allocated ghost users.
- **⚠ PRD rule 11 says ratings are out of scope. Owner requested this anyway. PRD needs updating or a decision — don't let prompts "fix" it by deleting the feature.**

## 4. PREVIOUS-EDITIONS LINEAGE (new; commit `db8f34e`)

- Columns: `conferences.predecessor_conference_id uuid` (FK, self-DISTINCT CHECK) + `predecessor_approved boolean NOT NULL DEFAULT false`.
- **Security model**: `predecessor_approved` is immutable to clients via `guard_predecessor_fields` BEFORE trigger; only `approve_predecessor_link(successor_id, approve)` (SECURITY DEFINER, checks `is_conference_owner(predecessor)`) can set it; re-pointing/clearing the claim resets approval; forced `approved=true` on INSERT is silently reset. `list_incoming_predecessor_claims()` lets the predecessor's team see claims from private successors. Ten RLS attack scenarios simulated and passing.
- UI: creation step 2 "Previous Editions" block (NO/YES + debounced search over own+public conferences); `/manage/[slug]/settings` → Privacy → "Lineage" card (incoming claims APPROVE/REJECT for owner, "OWNER DECIDES" chip for secretariat; outgoing claim status + WITHDRAW).
- **Bonus fixes riding this commit — conference creation was 100% broken**: the form inserted `status:'draft'` (violates `conferences_status_check`) and `.insert().select()` failed RLS for private conferences (RETURNING is evaluated before the ownership trigger's row is visible → misleading "row-level security" error). Fixed: `status: isPublic?'public':'private'`, dropped the read-back. **The swallowed-error `.insert().select().single()` pattern still exists elsewhere in manage (e.g. committee editor) — see §9.3.**

## 5. AGE SYSTEM (new; commit `43baeea`)

- Signup collects required DOB (13+ validation) → `handle_new_user` trigger REPLACED additively to copy `raw_user_meta_data->>'date_of_birth'` → `profiles.date_of_birth` (nullable). Verified with throwaway users, then cleaned. **Google OAuth signups have no DOB** — caught by an inline collector in the apply flow.
- `conferences.min_age integer` CHECK 10–99; "Minimum Age" card in Settings → Applications; gold "N+" chip near the apply CTA; apply flow blocks under-age **computed at conference start date**, prompts inline for missing DOB. **Client-side only — server enforcement should ride the applications-RLS hardening (§9.1).**

## 6. MANAGE AREA

- **Layout** (`manage/[slug]/layout.tsx`): sidebar replaced by a floating glass **icon rail** (68px, everything dead-centred) that expands on hover to 256px showing logo + literally "`{acronym} {year}`" (e.g. "LIMUN 2027") + nav labels + vibrant status pill. Content margin is now `md:ml-[96px]`. Chunky DM Mono purged from manage chrome; STATUS_STYLES are vibrant translucent tints with borders.
- **Assignment** (`manage/[slug]/assignment/page.tsx`) rebuilt twice, current: all-committees board (no tabs), applicant rail with delegation chip (societies join / "Independent"), native HTML5 drag-and-drop onto committee panels → drop popup listing open slots **most-urgent-first (importance tier, then fit score)** → one-click ALLOCATE; suggestions strip; must-pay gate/duplicate handling/chairs mode preserved. **`committee_country_slots.importance`** column ('standard'/'high'/'medium'/'low'; green/amber/red chips, click-to-cycle) powers urgency.
- **Applications**: applicant avatars (ambassador photos seeded on ~half of LIMUN applicants; generic User-icon fallback), vibrant badges.
- **Settings**: Visual tab gained Conference Logo upload + Registration Fee (amount + currency) cards; Applications tab gained Minimum Age.

## 7. ACCOUNT SECTION (two passes; commits `3d25510`, `83e734f`)

- **Profile**: framed bordered column; nationality (country autocomplete + flag) + DOB on one row with derived Age; **big full-width MUN-rank banner** (derived level + progress + "add conferences to rank up" CTA); playful "Countries I've Conferenced In" flag collector (`profiles.conference_countries text[]`); notification prefs as icon+description+PillToggle rows; review-prompt block preserved.
- **MUN CV**: mymun-style vertical timeline — big **conference** logo primary (small committee logo inline next to committee name), `Month Year` labels, sorted by new **`mun_cv_entries.event_date`** desc; add/edit modal with Gavelling+community suggestions that import the matched conference's logo; awards are a **multi-select chip selector** on new `awards text[]` (legacy `award` kept in sync = `awards[0]`); up to 3 photos (`photos text[]`, storage `conference-assets/cv/{userId}/`); award artwork resolves `/awards/<slug>.png` with a styled medal fallback — **award "Diplomacy" renamed "Diplomacy Award"** (slug aliases to `diplomacy.png`). Big circular + button replaces "Add Entry". Rank-up info panel wired to `EXPERIENCE_BANDS`.
- **Experience is now DERIVED, not user-set**: `src/lib/munExperience.ts` — 0–1 Beginner / 2–4 Intermediate / 5–8 Advanced / 9+ Expert from CV count; synced into `profiles.mun_experience_level` on CV changes + profile load (apply flows keep reading the column). The manual selector is gone.
- **New Pill primitive** in `src/app/account/accountUi.tsx` (Outfit, warm meaning-tied tints, leading dot) replacing the owner-hated DM-Mono-uppercase pills **within account/ only**. Inventory of the same pattern elsewhere (detail page, manage applications/assignment/settings, explore, roles, apply, new) is in the `83e734f` agent report — owner hasn't green-lit the global sweep yet.

## 8. DATABASE — full delta (project `luruhkwrgisytejswlas`)

**Migrations applied (all additive):**
1. `committee_display_chairs_and_public_occupancy` — `conference_committees.display_chairs jsonb` + `get_committee_occupancy(uuid[])` SECURITY DEFINER (public confs only, country codes only).
2. `conference_committees_logo_url` — committee logo slot.
3. `fix_conference_organizers_policy_recursion` — **"Owners can manage team" recursed on itself; ALL secretariat were locked out of /manage.** Replaced inline EXISTS with `is_conference_owner()` SECURITY DEFINER. (Same recursion class as your June-30 fix.)
4. `add_committee_country_slot_importance` — `committee_country_slots.importance` + demo tiers.
5. `conference_reviews` table + `user_attended_conference()` + RLS.
6. `add_conference_predecessor_lineage` — predecessor columns + `approve_predecessor_link()` + `guard_predecessor_fields` trigger + `list_incoming_predecessor_claims()`.
7. `profiles.date_of_birth` + **`handle_new_user` REPLACED** (adds null-safe DOB copy; otherwise byte-identical).
8. `conferences.min_age` CHECK 10–99.
9. `cv_entries_awards_photos_logo` (`awards[]`, `photos[]`, `logo_url` on mun_cv_entries, awards backfilled) + `profiles.conference_countries` + `mun_cv_entries.event_date`.

**Data changes (no code):** LIMUN logo/banner assets in storage; 12→then-reduced display_chairs seeded (DISEC/WHO have 1 chair + open posting, by design); role configs enabled with fees (FA $45 etc.); WHO chair posting; **5 demo conferences** `c0ffee00-…0002–0006` (HNMUN Boston, OxIMUN Oxford, PIMUN Paris, EuroMUN Maastricht, YMUN New Haven — real logos in `public/demo-logos/`, credits in its README) + **5 job postings** (`b0b00000-…0005–0009`, one paid) → 9 open roles total; 4 LIMUN reviews; ambassador avatar_urls on ~13 applicant profiles; **QA evidence rows left intentionally**: user `qa.delegate.test1@gmail.com` with 3 forged applications (SEC-1 proof — see §9.1, do NOT clean up silently), QA conference `creation-lab-mun-2027-qalab` (private, keep), `docs/qa/` + `CONFERENCES_EXPERIENCE.md` reference them.

**Auth fix (code, not DB)**: `AuthProvider.getSession()` bounded with a 2.5s failsafe + profile fetch no longer awaited — the Web-Lock hang was wedging EVERY auth-gated page behind an eternal spinner (this was the "VIEW PAGE doesn't lead anywhere" report).

## 9. OPEN RISKS / DECISIONS NEEDED (ranked)

1. **SEC-1 (HIGH, still open): `applications` RLS forgery.** INSERT only checks `user_id = auth.uid()`; UPDATE has no WITH CHECK. A delegate can self-set `status='accepted'`, `payment_status='paid'`, `assigned_*`, and can insert into PRIVATE conferences by UUID, ignoring windows/enabled flags. Proven with live evidence rows. Fix must be coordinated with your `auto_accept` client-side status logic (a naive WITH CHECK pinning `status='submitted'` breaks it) — cleanest is a SECURITY DEFINER apply RPC that derives status server-side, and it should also enforce `min_age` (§5) and window/enabled checks. Full evidence: `docs/qa/delegate-signup-findings.md`.
2. **Signup is dead in prod conditions**: Supabase default SMTP rate-limit ("email rate limit exceeded"). Infra fix (Resend/SendGrid in Auth settings), small, launch-critical.
3. **Dashboard Publish still hard-blocked**: `applications: false, // will be real in later prompt` in `manage/[slug]/page.tsx`. One-line unblock (derive from role configs). Also: "Send All Allocations" still sends no email (flag-flip only), position papers insert a nonexistent `country_name` column (one-line fix, orphaned storage file on failure), required custom questions unenforced.
4. **PRD rule 11 vs reviews** (§3) — update PRD or scope the feature.
5. **Swallowed-error pattern** (`.insert().select().single()` + `useAuth().session` timing) persists in manage writes outside creation — can silently no-op writes after the auth failsafe renders logged-out.
6. `CONFERENCES_EXPERIENCE.md` (repo root) = the full verified findings register + gap analysis with July-12/15 criticality; treat as the QA source of truth alongside the PRD.

## 10. FINAL STAGEFRONT ITERATION (landed, commit `af931c5`)

Hero is now a split: headline/CTAs left, the three soonest conferences stacked vertically on the RIGHT inside the hero (new `compact` prop on the shared `ConferenceCard` — default false, explore unchanged); the standalone featured section below was deleted. The job-board CTA gained 3 tiny fanned pop-up chips of the newest real open roles (logo + role + category tint, staggered float-in, reduced-motion safe, all linking to /conferences/roles). Explainer photos upscaled to clamp(280px,24vw,320px) using the real 1400px photos. Organiser tools compressed to the job-board section's footprint (2×2 kept, icons 48px). Season ledger deleted entirely (its helpers too; shared.tsx exports untouched).

## 11. GOTCHAS FOR PROMPTS (new since your handoff)

- Editing `landing-lab/VariantStagefront.tsx` edits PRODUCTION `/conferences`.
- `ConferenceCard.tsx` is shared by explore + landing — visual changes propagate to both.
- SiteNav: never gold-flatten `/Conferences.png`; `overlay` prop exists; conferences/manage routes get the conferences wordmark by default.
- `handle_new_user` now sets `date_of_birth` — manual auth-user seeding recipes should include it (or not — it's null-safe).
- `mun_experience_level` is machine-managed — don't build UI that lets users set it.
- Award list lives in `src/app/account/accountUi.tsx` (`AWARD_LIST`); "Diplomacy Award" aliases to `diplomacy.png`; owner will drop artwork into `public/awards/` (six slugs).
- The scrolled-screenshot blankness in headless captures on pages with fixed backdrops is a tooling artifact, not a rendering bug.
- Demo cast passwords unchanged (`GavTest123!`); Camila is the go-to organizer login; Aria the go-to delegate.
