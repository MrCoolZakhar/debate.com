# UI AUDIT — Roles Board · Organise Hub · Conference Creation

Measured against `00-DESIGN-RULEBOOK.md`. Files audited:
- `src/app/conferences/roles/ConferencesRolesClient.tsx` (~1206 lines)
- `src/app/conferences/organise/ConferencesOrganiseClient.tsx` (~342 lines)
- `src/app/conferences/new/page.tsx` (~1162 lines)

Reference exemplar for the bar: `src/app/conferences/ConferenceCard.tsx` — full-bleed banner photo, floating logo, gradient+watermark fallback, 2×2 fact micro-grid, gold APPLY pill. The public cards are *authored*. Two of the three surfaces below fall short of that same bar their own codebase already set.

---

## 1. SCORECARDS (1–5 per dimension; 1 = AI smell, 5 = would-ship)

### A. ROLES BOARD — `ConferencesRolesClient.tsx`

| Dimension | Score | Note |
|---|---|---|
| Focal hierarchy | 4 | Editorial 900-weight hero + kanban columns; APPLY is a clear protagonist per card. Slightly diluted by every card weighing the same. |
| Border & depth | 4 | Glass filter pill bar (backdrop-blur + inset highlight), ambient radial washes, card hover-lift with layered shadow. Real depth. |
| Iconography & imagery | 4 | Category icons, comp icons, flag images, logo tiles, `MapPin`/`Clock`/`CalendarDays` meta rows. Good density of meaning. Logo tile falls back to bare acronym text (no gradient). |
| Data presentation | 3 | Meta rows are still a stacked icon-list; the hero stats are a mono ◆-separated string, not a medallion/ring. "Show don't list" only half-applied. |
| Typography | 3 | Outfit-led and mostly right — BUT mono is over-reached: filter pill count, hero stat line, "LOOKING FOR" eyebrow, modal "COVER NOTE" label, GroupHeader count. Several are borderline non-stamp uses. |
| Badges/chips | 4 | Category + comp chips are saturated, tinted, bordered, iconed. This is the model the *other two* pages should copy. Applied/status button tints are meek-ish grey though. |
| States | 4 | Layout-matched skeleton (columns + card shape), two distinct empty states (no-postings vs no-match) with icon + CTA. Well designed. |
| Uniqueness | 4 | The category kanban + floating glass filter rail is a memorable move. Not template. |
| **VERDICT** | **~3.75** | **The strongest of the three. This is the reference the other two should be dragged up to. Do not gut it — just trim mono and upgrade a couple of meek pieces.** |

### B. ORGANISE HUB — `ConferencesOrganiseClient.tsx`

| Dimension | Score | Note |
|---|---|---|
| Focal hierarchy | 3 | Forest hero bar + gold CTA is clear, but below it every card is identical weight; no protagonist among conferences. |
| Border & depth | 2 | Cards are flat `#FAF8F3` + 1px hairline border (rulebook wants 1.5–2px). A 6px accent strip is the only depth. Hover adds a shadow but the resting state is timid. |
| Iconography & imagery | 1 | **Zero icons. Zero imagery.** `logo_url` is fetched in the query and typed on the interface but NEVER rendered. A conference-management card with no logo, no flag, no location pin, no calendar icon — pure text. This is the rulebook's #1 hate ("wall of text with no icon is a failure"). |
| Data presentation | 2 | City/country/date are three stacked text rows. No flag, no date medallion, no capacity/status ring. Bullet-dump. |
| Typography | 2 | Mono sprayed everywhere as non-stamp text: acronym row, date row, status pill, the "PUBLIC"/"PRIVATE" section eyebrows, AND all four filter pills use `DM Mono`. Mono-as-body is the #1 AI tell and it's the dominant font on this page. |
| Badges/chips | 2 | LIVE/DRAFT/ARCHIVED pills are pale washed tints (0.12–0.2 alpha) with NO border. Exactly the "meek badge" the rulebook flags on sight. |
| States | 3 | Skeleton is a bare grey `#DDD4C0` rectangle (doesn't match the card's strip+content anatomy). Empty state is text + CTA but icon-less. |
| Uniqueness | 1 | Generic SaaS "my items grid." No memorable move. Template smell. |
| **VERDICT** | **~2.0** | **The weakest surface in this slice and the most embarrassing. It looks generated. Its own codebase ships a far better conference card (`ConferenceCard.tsx`) it refuses to reuse.** |

> NOTE: the brief described "delegating/chairing/organizing tabs." This file has none — it is organizer-only with ALL/ACTIVE/DRAFT/ARCHIVED status filters. The tabbed hub either lives elsewhere or was never built; flagging the mismatch.

### C. CONFERENCE CREATION — `new/page.tsx`

| Dimension | Score | Note |
|---|---|---|
| Focal hierarchy | 3 | Two-step card is centred and clear; the CONTINUE / CREATE button is a clear primary. But the whole page is one undifferentiated stack of fields — no visual anchor, no hero. |
| Border & depth | 3 | Card has a decent layered shadow. But inputs are 1.5px `#DDD4C0` hairlines (fine) and the outer card is a 1px border (rulebook wants 1.5–2px). Flat cream on cream. |
| Iconography & imagery | 2 | Step 2 has the banner uploader (good, real imagery) + preset thumbnails + social icons. Step 1 — the longer, denser step — is **10 fields with ZERO icons**. No icon on Name, Email, Dates, Country, City, Fee, Delegates. Prime "big form, icon-light" territory the rulebook calls out by name. |
| Data presentation | 3 | Toggle groups + radio-cards for visibility are good (better than selects). Fee, dates, delegates are plain inputs where an icon/affordance would help scanning. |
| Typography | 4 | Mostly clean Outfit. Only two mono uses ("OR PICK A PRESET", predecessor acronym stamp) and both are legit micro-stamps. This page respects the font rule best of the three. |
| Badges/chips | 3 | No status badges to speak of; toggle-group active state is a solid forest fill (good). The visibility radio-cards are well done. |
| States | 3 | Banner has upload spinner + uploading text (good). Predecessor search has searching/empty/results states. But there is NO success/created state and no field-level inline validation beyond the acronym. |
| Uniqueness | 2 | It's a competent two-step form, but it reads as a generated form. The step indicator is a plain pill-with-number; no progress %, no imagery, no editorial move. "Authored form" bar not met. |
| **VERDICT** | **~2.9** | **Functional and typographically disciplined, but Step 1 is a naked 10-field column — the textbook "big page, no icons" failure. Needs field icons + a visual anchor to feel authored.** |

---

## 2. RANKED FINDINGS (most-embarrassing first)

### 🔴 F1 — Organise cards render NO logo/imagery despite fetching it · P1
`ConferencesOrganiseClient.tsx:38–129` (card) + `:165` (query selects `logo_url`).
**Problem:** `logo_url` is queried, typed on `OrgConference`, and then never used. The card is pure text on a flat panel — violating the rulebook's top hate ("Big pages / cards with no icons/images"). Meanwhile `ConferenceCard.tsx` in the same folder renders a floating logo with a gradient+watermark fallback.
**Fix:** Add a 44–52px logo tile top-left of each card (white rounded tile, 1.5px border, `object-fit:contain`), with the existing `gradientFor(acronym)` fallback + watermark acronym when `logo_url` is null. Reuse the exact tile pattern from `ConferenceCard.tsx:190+` / the roles-board logo tile (`ConferencesRolesClient.tsx:315–343`). Put the acronym + status pill to its right. This single change moves the page from 1→3 on iconography.

### 🔴 F2 — Organise status pills are borderless washed tints (meek badges) · P1
`ConferencesOrganiseClient.tsx:44–48`.
**Problem:** LIVE = `rgba(61,122,82,0.12)`, ARCHIVED = `rgba(154,138,120,0.15)`, DRAFT = `rgba(238,217,138,0.2)` — pale fills with **no border**, the exact "meek badge colours … pale washed pills with no conviction" the rulebook flags on sight.
**Fix:** Copy the roles-board chip recipe (`ConferencesRolesClient.tsx:375–409`): saturated bg + a real `1px solid` tinted border + an icon. LIVE → forest-green tint + `1px solid rgba(42,90,60,0.3)` + a `Radio`/`Circle` dot icon; DRAFT → gold tint + gold border + `PencilLine`; ARCHIVED → muted tint + muted border + `Archive`. Make them ~10–11px, not 9px.

### 🔴 F3 — Organise hub uses DM Mono as its dominant body/label font · P1
`ConferencesOrganiseClient.tsx:75` (acronym), `:101` (date range), `:218` (hero eyebrow), `:243` (all 4 filter pills), `:280`/`:288` (PUBLIC/PRIVATE section headers), `:78` (status pill).
**Problem:** Mono is on the acronym row, the date row, the section headers, AND every filter pill — that's mono-as-UI-language, the #1 AI tell per the rulebook. Only the tiny acronym stamp is defensible.
**Fix:** Switch filter pills, PUBLIC/PRIVATE section eyebrows, and the date row to Outfit (semibold, small, letter-spaced for eyebrows). Keep DM Mono ONLY on the acronym micro-stamp. Match the roles-board `FilterPill` which is correctly Outfit (`:168`).

### 🟠 F4 — Creation Step 1 is 10 fields with zero icons · P1
`new/page.tsx:557–731` (Step 1 body).
**Problem:** The longest, densest step — Name, Acronym, Email, Level, Start/End dates, Country, City, Format, Delegates, Fee — has not a single icon. Textbook "big page, form-heavy, icon-light." Step 2 has icons (social inputs, banner) so the inconsistency is glaring within the same flow.
**Fix:** Add a leading lucide icon inside each `Field` label (or as an input prefix like `SocialInput` already does): `Type` for Name, `Hash` for Acronym, `Mail` for Email, `GraduationCap` for Level, `CalendarDays` for dates, `Globe`/flag for Country, `MapPin` for City, `Monitor`/`Users` for Format, `Users` for Delegates, `Banknote` for Fee. Reuse the `SocialInput` left-icon prefix pattern (`:107–125`) so it's consistent with Step 2. Instant lift from text-column to scannable form.

### 🟠 F5 — Creation page has no visual anchor / authored hero · P2
`new/page.tsx:444–512`.
**Problem:** The page is `SiteNav` → step pills → one cream card of fields. No banner, no gradient, no illustration, no imagery until the user is deep in Step 2. It reads as a generated form, failing the "authored not generated" bar and "big pages with no images."
**Fix:** Add a compact editorial header above the card: a 900-weight "Create a conference" title + gold ◆ + one-line subhead (mirror the roles-board header `:958–980`), optionally over a faint forest→forest-mid gradient band or a soft gold radial wash like roles' ambient blobs (`:934–952`). Consider making the step indicator a real progress affordance (a thin forest fill bar 50%→100%) instead of two static pills.

### 🟠 F6 — Organise skeleton doesn't match the card anatomy · P2
`ConferencesOrganiseClient.tsx:254–259`.
**Problem:** Loading state is a plain `#DDD4C0` grey rounded rectangle. The rulebook wants "a skeleton that matches the layout." Roles board does this correctly (`:1080–1109`); organise does not.
**Fix:** Build the skeleton from the card shell: 6px top strip, a logo-tile placeholder (after F1), two title bars, a location bar, a date bar, and two button placeholders. Steal the roles skeleton structure.

### 🟠 F7 — Roles hero stats are a mono ◆-string, not a "shown" datum · P2
`ConferencesRolesClient.tsx:982–994`.
**Problem:** `03 OPEN ROLES ◆ 02 CONFERENCES HIRING ◆ 05 WITH REWARDS` is a bullet-dump-in-a-line and it's all DM Mono. Rulebook: "Show data, don't list it," and mono should be micro-stamps only. The ◆ separators are a nice editorial touch but three mono stats in a row is a lot of mono.
**Fix:** Promote to three small stat medallions/tiles (number in large Outfit-black, label in small Outfit-caps), keeping the gold ◆ as a divider or dropping it. Keep the *number* in mono if you like (that's a legit stat stamp), but the LABELS should be Outfit.

### 🟡 F8 — Organise card is a flat 1px hairline; wants a defined edge · P2
`ConferencesOrganiseClient.tsx:59`.
**Problem:** `border: '1px solid #DDD4C0'` — the rulebook explicitly wants "1.5–2px defined edges, not timid 1px hairlines." Same on the outer creation card (`new/page.tsx:453`) and the roles posting card (`:296`).
**Fix:** Bump card borders to `1.5px`. Cheap, uniform, on-brand.

### 🟡 F9 — Roles logo tile falls back to bare acronym text (no gradient) · P2
`ConferencesRolesClient.tsx:335–342`.
**Problem:** When `logo_url` is null the 56px tile shows plain forest acronym text on white — flat, and inconsistent with `ConferenceCard.tsx` which uses a `gradientFor()` fill + watermark. The rulebook prefers "real content over placeholders" and gradients over flat fills.
**Fix:** Fall back to the `gradientFor(acronym)` forest gradient tile + large low-opacity watermark acronym, matching the public card. Share one `<LogoTile>` component across roles + organise + public card.

### 🟡 F10 — Applied/Accepted/Rejected buttons are meek-grey · P2
`ConferencesRolesClient.tsx:224–244`.
**Problem:** APPLIED/ACCEPTED use `rgba(27,56,40,0.08)` / `rgba(61,122,82,0.12)` — very low-alpha, low-conviction fills for what is meaningful status. Sits oddly beside the confident forest APPLY button.
**Fix:** Give the "accepted" state real conviction (solid-ish forest-light bg + gold check), and "rejected" a clearer danger-tinted pill with border. These are the *outcome* of the flow — they deserve saturation.

### 🟡 F11 — Predecessor results dropdown / empty use flat text rows · P3
`new/page.tsx:1026–1066`.
**Problem:** Searching/empty/results are plain text lines. Fine, but the result rows have no logo/flag and the searching state is a bare "Searching…" (no spinner), inconsistent with the banner uploader which does spin.
**Fix:** Add the conference logo tile + country flag to each result row; give the searching state a small spinner. Low priority but tightens consistency.

### 🟡 F12 — Modal "COVER NOTE (OPTIONAL)" label is mono · P3
`ConferencesRolesClient.tsx:670–675`.
**Problem:** A form field label in DM Mono, uppercase, letter-spaced — borderline non-stamp mono use.
**Fix:** Move to Outfit semibold caps (keep the small size + spacing). Trivial.

### 🟡 F13 — Organise CTA button label is mono-adjacent; footer duplicated · P3
`ConferencesOrganiseClient.tsx:298–338` and roles `:726–772`.
**Problem:** The footer block is copy-pasted verbatim across organise + roles (and elsewhere). Not a visual defect but a maintenance/consistency smell — divergence risk.
**Fix:** Extract a shared `<ConferenceFooter>` component. (Consistency-of-language rule.)

---

## 3. LEAVE-ALONE LIST (already at/near the bar — don't touch)

- **Roles floating glass filter pill bar** (`ConferencesRolesClient.tsx:997–1076`) — backdrop-blur + saturate + inset highlight + sticky. Textbook exemplar of the "floating panel" move. Keep.
- **Roles category + compensation chips** (`:375–409`) — saturated, tinted, bordered, iconed. This is the badge standard; propagate it, don't weaken it.
- **Roles ambient radial washes** (`:934–952`) — gold + forest blurred blobs behind the header give real depth. Keep.
- **Roles two-tier empty states + layout-matched skeleton** (`:1080–1165`) — designed, icon+CTA, distinguishes no-data vs no-match. Model behaviour.
- **Roles editorial hero** (`:958–980`) — 900-weight clamp title + gold-period + gold ◆ eyebrow. Authored. Keep (just Outfit-ify the stat labels per F7).
- **Roles posting-card hover lift** (`:299–310`) — translateY + layered shadow + border warm-up. Good meaningful motion.
- **Creation banner uploader + preset picker** (`new/page.tsx:823–909`) — real imagery, gold selected-ring, hover-lift thumbnails, upload spinner. The best-authored block in the creation flow. Keep.
- **Creation visibility radio-cards** (`:1073–1102`) — description-rich selectable cards beat a plain toggle. Good "show don't make them guess."
- **Creation typography discipline** — only two legit mono stamps on the whole page. The other two surfaces should learn from it.

---

## 4. ONE-LINE PRESCRIPTION PER PAGE

- **Organise hub (score ~2.0):** the embarrassing one. Reuse `ConferenceCard.tsx`'s logo tile + gradient fallback, kill the borderless status pills for bordered iconed chips, and evict DM Mono from everything but the acronym stamp. Three fixes take it 2→3.5.
- **Creation form (score ~2.9):** add a leading icon to every Step-1 field (F4) and an editorial header/progress anchor (F5). Typographically it's already the cleanest page — it just needs eyes and a face.
- **Roles board (score ~3.75):** the exemplar of this slice. Only trim mono (hero stat labels, modal label) and upgrade the flat logo fallback + meek status buttons. Do not restructure.
