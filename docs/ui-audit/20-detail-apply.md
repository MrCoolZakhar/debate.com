# UI AUDIT — CONFERENCE DETAIL PAGE + APPLY FLOW
**Slice:** `conferences/[slug]` detail, `apply/` multi-step form, `apply/confirmation`, server wrapper.
**Auditor stance:** senior UI critic, measuring against `00-DESIGN-RULEBOOK.md`. Read in full: detail 2271 lines, apply 1115 lines, confirmation 104 lines, page wrapper 6 lines.

---

## 1. SCORECARDS

### `ConferenceDetailClient.tsx` — the flagship public page
| Dimension | Score | Note |
|---|---|---|
| Focal hierarchy | **4** | Hero → glass stat strip → apply card is a clean, confident cascade. The protagonist (banner + green apply card) is unmistakable. |
| Border & depth | **4** | Layered scrims, backdrop-blur glass strip, warm shadows, gold-ring medallion. Genuinely dimensional. Loses a point for 1px hairline borders everywhere the rulebook wants 1.5–2px. |
| Iconography & imagery | **4** | Real banner, logos, chair avatars, rectangular flags, lucide icons in the stat strip. This is what the rulebook asks for. |
| Data presentation | **4** | Pricing medallion, capacity fill bars, roman-numeral agenda, roster progress ring — mostly "show don't list." The pricing *breakdown* and stat strip regress to rows. |
| Typography | **2** | **DM Mono is a plague here.** 20+ mono eyebrows, mono meta on every card, mono in the medallion, mono review dates, mono in the roster modal. This is the #1 AI tell and it's everywhere. |
| Badges/chips | **3** | Difficulty pills and TAKEN/OPEN roster chips are saturated + bordered (good). But most "badges" are mono-uppercase text with no fill/border — meek by the rulebook's definition. |
| States | **4** | Documents-locked, no-reviews, no-committees, 404 all have icon + copy. Loading is a bare spinner (below bar). |
| Uniqueness | **4** | The gold medallion + hover-arrow committee slider + roster modal is a memorable, authored move. Not template. |
**Verdict:** A strong, near-shippable page sabotaged by one systemic flaw — mono-eyebrow overuse — plus timid 1px borders. Fix the type and it's a 4.3 page.

### `apply/ConferenceApplyClient.tsx` — the multi-step form
| Dimension | Score | Note |
|---|---|---|
| Focal hierarchy | **2** | Every step is a flat cream card with a plain `<h2>` heading. No hero, no protagonist, no visual anchor. All steps read at the same weight. |
| Border & depth | **2** | One card with a shadow, then flat-on-flat rounded rectangles inside. Radio "toggles", preference blocks, experience tiles are all the same `rgba(27,56,40,0.04)` fill with a thin border. |
| Iconography & imagery | **1** | **Near-zero icons.** No lucide imports at all. The ONLY graphics in the entire ~1100-line form are: flags in the country dropdown, a hand-rolled checkmark SVG, and a spinner. This is textbook "big page, no images." |
| Data presentation | **2** | Fee shown as a sentence ("Registration fee: £X"). Experience levels are a 2×2 of text tiles. Preferences are stacked form blocks. Everything is listed, nothing is shown. |
| Typography | **2** | Mono on the step indicator numbers+labels, the "INDEPENDENT/WITH A SOCIETY" toggle labels, "Preference N", the breadcrumb. Mono used as *body-adjacent* labels — exactly what the rulebook forbids. |
| Badges/chips | **2** | AUTO-ACCEPTED and AGE REQUIREMENT chips exist and are OK-ish, but the age-gate chips use Outfit while everything else uses mono — inconsistent. Most "chips" are again mono text. |
| States | **3** | 404 / already-applied / not-open / age-gate / needs-DOB all have designed screens. Credit here. But they're monotonous cream cards, one after another. |
| Uniqueness | **1** | Zero memorable moves. This is a generic SaaS wizard. An experienced designer would clock it as AI-generated in two seconds. |
**Verdict:** The flattest page in the app, confirmed. It works, it's logically sound, but it is visually anonymous — a form wizard with no iconography, no imagery, no depth, and no single authored idea. This is the P1 target of the whole slice.

### `apply/confirmation/page.tsx`
| Dimension | Score | Note |
|---|---|---|
| Focal hierarchy | **3** | Centered check-disc → heading → CTAs. Fine, if plain. |
| Border & depth | **2** | Grey circle, hand-rolled check SVG, flat. No celebration, no gold, no elevation. |
| Iconography & imagery | **2** | One inline checkmark. No conference logo, no gold, no gavel. |
| Typography | **3** | Mono eyebrow ("APPLICATION SUBMITTED") — defensible as a micro-stamp, but combined with everything else it's more mono debt. |
| Badges/chips | n/a | — |
| States | **3** | It *is* a state, and it's serviceable. |
| Uniqueness | **1** | Anonymous success screen. Could belong to any app. |
**Verdict:** A missed emotional beat. The one moment to reward the applicant is a grey circle and a checkmark.

### `page.tsx` (server wrapper)
6 lines, pure passthrough. **Nothing to audit.** Correct and minimal — leave alone.

---

## 2. FINDINGS — most-embarrassing first

### 🔴 P1 — The entire apply flow has essentially zero icons or imagery
`apply/ConferenceApplyClient.tsx` — whole file (no `lucide-react` import at all; contrast the detail page's 30-icon import on line 6).
**Rule broken:** "Big pages with no icons/images" (HATES) + "Icons everywhere they add meaning" (LOVES) + Uniqueness.
**Why it looks AI-made:** a long, multi-screen form where the only non-text pixels are a spinner and a hand-drawn checkmark. Humans decorate wizards; generators emit bare inputs.
**Concrete fix:** Import lucide and put a meaningful icon on every step's `<h2>` and every choice:
- Step 1 "Applying as" → role icon (`Gavel`/`Users`/`Mic`/`Eye` by role) in a gold-tinted rounded square, like the detail stat-strip icon chips.
- Step 2 society toggle → `Building2` (society) vs `User` (independent) inside each tile.
- Step 4 experience tiles → an escalating insignia per level (a 1–4 pip ramp, or `Sprout`/`TrendingUp`/`Award`/`Crown`) — reuse the rank-insignia idea from the exemplars.
- Add the conference **logo** (already fetched on detail; add `logo_url` to the apply `select`) at the top of the form card so the applicant sees *what* they're applying to.
- Preference blocks → number them with a gold ordinal disc (reuse the roman-numeral treatment) instead of the mono "Preference N" text.

### 🔴 P1 — DM Mono sprawl on the detail page (the #1 AI tell, verbatim)
`ConferenceDetailClient.tsx` — mono eyebrows/labels at lines **1010** (ORGANISED BY), **1142** (STUDY GUIDES), **1201** (POSITION PAPER), **1310** (DELEGATE REVIEWS), **1346** (YOUR REVIEW), **1416** (FROM PREVIOUS EDITION), **1482/1541/1565/1642** (sidebar eyebrows), **817** (hero acronym), plus mono on card meta (**1023, 1174, 1204, 1335, 1499**), medallion sub-label (**1712**), roster modal (**2135, 2179, 2193, 2201**), difficulty pills (**1965**), capacity labels (**2066–2071**).
**Rule broken:** "Code-like fonts — DM Mono used as body/label/heading … Mono eyebrows everywhere = the #1 AI tell."
**Why it looks AI-made:** the rulebook names this exact pattern. Every section is stamped with a letter-spaced uppercase mono kicker. That's the generated-template signature.
**Concrete fix:** Keep mono ONLY for true micro-stamps: the price digits, the `%` figure, the 2-letter country fallback, the acronym stamp, a date. Convert all section eyebrows (ORGANISED BY, STUDY GUIDES, POSITION PAPER, DELEGATE REVIEWS, YOUR REVIEW, FROM PREVIOUS EDITION, sidebar kickers) to **Outfit 800, 11px, letter-spacing 0.08em, color `#B6871F`** — or drop the eyebrow entirely where the card content is self-evident. Difficulty pills and capacity labels → Outfit bold, not mono.

### 🟠 P2 — The apply step indicator is a generic wizard tracker
`apply/ConferenceApplyClient.tsx:1046–1080`.
**Rule broken:** Uniqueness (template smell) + Typography (mono numbers+labels) + Border/depth.
**Why it looks AI-made:** circle-line-circle-line progress bar with mono numerals and a `✓` — the single most common AI wizard component in existence.
**Concrete fix:** Give it one authored move. Options: (a) a continuous gold-filling rail where completed segments fill forest→gold with a `cubic-bezier` transition matching the capacity bars; (b) replace mono step numbers with Outfit and put a lucide icon per step (Role/Society/Preferences/Experience) inside the disc; (c) at minimum, active disc gets a gold ring glow (`0 0 0 4px rgba(238,217,138,0.18)`) so the current step is unmistakably the protagonist. Move labels to Outfit.

### 🟠 P2 — Confirmation screen wastes the celebration moment
`apply/confirmation/page.tsx:26–52`.
**Rule broken:** "Big, highlighted important parts" + Gradients + Uniqueness + States.
**Why it looks AI-made:** grey circle + generic checkmark + two buttons. No brand, no gold, no delight — the default success page every scaffold ships.
**Concrete fix:** Make it feel earned. Green→forest gradient disc with a gold ring and a lucide `Check` (or a gavel), a subtle gold radial glow behind it (reuse the apply-card `radial-gradient` at line 1474), the conference **logo/acronym** so it's *this* conference's confirmation, and a "what happens next" mini-timeline (Submitted → Under review → Decision) instead of one flat sentence. That timeline also satisfies "show, don't list."

### 🟠 P2 — Step 1 fee shown as a bullet-dump sentence, not a stat
`apply/ConferenceApplyClient.tsx:369–395`.
**Rule broken:** "Bullet-dump information … a medallion/ring/grid would show them with more punch" + consistency (the detail page already has a gold pricing medallion).
**Why it looks weak:** "Registration fee: £X" as prose, when the sibling detail page renders the exact same number as a gold-ringed medallion. Inconsistent language across one surface.
**Concrete fix:** Render the fee as a compact stat block or a mini gold medallion echoing the detail page — currency symbol large in Outfit 900, "PER DELEGATE" caption, AUTO-ACCEPTED as a real saturated pill beside it. Reuse the medallion component so the two pages speak the same visual language.

### 🟠 P2 — Society & experience "selectors" are flat text tiles
`apply/ConferenceApplyClient.tsx:432–457` (independent/society toggle) and `746–761` (experience grid).
**Rule broken:** Border/depth (flat-on-flat) + Iconography + meek selection affordance.
**Why it looks AI-made:** identical `rgba(27,56,40,0.04)` rectangles distinguished only by a border color swap and a tiny dot. No icon, no elevation, no color on selection.
**Concrete fix:** Selected tile gets forest fill + gold text (not a 6%-tint), a lucide icon per option, and a lift shadow on hover (`0 6px 18px rgba(27,56,40,0.12)`). The experience grid should escalate visually (pip ramp / insignia) so ADVANCED clearly outranks BEGINNER — right now they're four identical boxes.

### 🟡 P3 — 1px hairline borders throughout the detail page
`ConferenceDetailClient.tsx` — `SectionCard` (line 261 `1px solid #DDD4C0`), stat strip, review cards, social buttons, most cards.
**Rule broken:** "Thick, confident borders — 1.5–2px … not timid 1px hairlines."
**Fix:** Bump card and strip borders to `1.5px` and use the stronger parchment tokens (`#D8CDB6`/`#C8BEA8`) the rulebook lists. Note the apply form card already gets this right (`1.5px solid #C8BEA8`, line 1083) — propagate that choice to the detail cards for consistency.

### 🟡 P3 — Loading states are bare spinners
`ConferenceDetailClient.tsx:637–643`, `apply:833–839`, `1145–1148`, confirmation `95–98`.
**Rule broken:** "Empty/loading/error states are designed, not blank — a skeleton that matches the layout."
**Fix:** Replace the full-page spinners with a skeleton that matches the real layout (hero bar block + stat-strip row + card placeholders on detail; step-indicator + card skeleton on apply). The study-guides inline spinner can stay.

### 🟡 P3 — Position-paper status pill is meek mono
`ConferenceDetailClient.tsx:1273` and `2135`.
**Rule broken:** "Meek badge colours" + mono overuse.
**Fix:** The `ppStatusMap` tints (1188–1193) are fine, but the pill is mono 9px with no border. Give it a 1px border in the status color and switch the label to Outfit 800. Same for the roster "SEATS FILLED" line.

### 🟡 P3 — Age-gate chips use a different font family than every other chip
`apply/ConferenceApplyClient.tsx:920–924` (AGE REQUIREMENT, Outfit) vs `386–392` (AUTO-ACCEPTED, mono) vs `961–965` (`{minAge}+ CONFERENCE`, Outfit).
**Rule broken:** "Consistency of the language — same eyebrow treatment across a surface."
**Fix:** Pick one chip language for the whole flow (recommend Outfit 800 + saturated tint + 1px border) and apply it to all: AUTO-ACCEPTED, AGE REQUIREMENT, `N+ CONFERENCE`.

### 🟡 P3 — Social/organiser links are grey ghost circles
`ConferenceDetailClient.tsx:1040–1108`.
**Rule broken:** Meek treatment (grey `#9A8A78` on transparent, 1px border) until hover.
**Fix:** Minor — give the resting state a faint gold/forest tint fill so the row doesn't read as disabled. Low priority; the hover state is nicely authored.

### 🟡 P3 — "About" description is an unbroken wall of text
`ConferenceDetailClient.tsx:998–1004`.
**Rule broken:** "Big pages with no icons/images" (locally).
**Fix:** Optional — a small `Landmark`/`Info` icon header or a gold hairline lead-in would break the monotony. Low priority since real descriptions carry it.

---

## 3. LEAVE-ALONE LIST (confirmed exemplars — do NOT touch)

- **Pricing medallion** (`1694–1770`) — gold radial glow, 1.5px gold ring, `0 0 0 8px` halo, click-to-expand. Textbook "show don't list." **Confirmed exemplar.** (Only nit: the sub-label at 1712 is mono — but here it's a legit micro-stamp, leave it.)
- **Committee slider cards** (`1900–2105`) — free-floating emblem with drop-shadow, roman-numeral agenda, chair avatars, gold ◆ separators, capacity fill bar with eased transition, dashed "APPLY NOW" open-seat affordance. Authored and dense-done-right. **Confirmed exemplar.** (Fix the mono meta/difficulty pill per P1, but the *structure* is a keeper.)
- **Roster modal** (`2113–2214`) — flags + saturated TAKEN(forest/gold)/OPEN(green-bordered) pills + progress ring header. Genuinely good data presentation. **Keep**; only upgrade the mono "SEATS FILLED" label.
- **Glass stat strip** (`847–892`) — backdrop-blur, gold icon chips, overlaps the hero by -44px. Strong depth move. **Keep.**
- **Role-aware apply sidebar** (`1479–1691`) — the four-branch (organizer / applicant-status / signed-out / role-picker) card with grain + gold radial glow, allocation sub-card with flag, expanding role picker with per-role fee/window. This is genuinely authored and role-aware — the best thing in the slice. **Keep** (only demote its mono eyebrows per P1).
- **Documents-locked empty state** (`1115–1135`) — lock disc + icon + copy. Designed, not blank. **Keep.**
- **Hero** (`730–844`) — layered scrims, logo drop-shadow, flag + gold ◆ + date, acronym watermark fallback. **Keep.**
- **`page.tsx`** — correct minimal passthrough. **Keep.**

---

## SUMMARY — where the effort goes
The **detail page is 80% there**; its problems are systemic-but-shallow (rip out mono eyebrows, thicken borders) rather than structural. The **apply flow is the real work**: it needs iconography, a memorable step tracker, non-flat selectors, a medallion-style fee, and a celebratory confirmation — it currently reads as a generic AI-scaffolded wizard, which the rulebook flags as the cardinal sin. Fix apply first.
