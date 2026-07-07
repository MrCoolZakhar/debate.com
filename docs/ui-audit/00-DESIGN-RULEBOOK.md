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
