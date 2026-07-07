# UI AUDIT — MANAGE (ORGANISER DASHBOARD) · CORE

Slice: `src/app/manage/[slug]/` — layout, dashboard, committees, applications, assignment.
Measured against `00-DESIGN-RULEBOOK.md`. Read-only audit.

---

## 1. PER-PAGE SCORECARDS (1–5)

Dimensions: **Focal hierarchy · Border & depth · Iconography & imagery · Data presentation · Typography · Badges/chips · States · Uniqueness**

### `layout.tsx` — chrome (rail + top bar)
| Dim | Score | Note |
|---|---|---|
| Focal hierarchy | **4** | Rail identity → nav → status footer reads cleanly. |
| Border & depth | **5** | Glass pill, blur+saturate, layered warm shadow, 26px radius. Reference-grade. |
| Iconography & imagery | **4** | lucide throughout; logo drop-shadow; mono-monogram fallback is fine. |
| Data presentation | **4** | Status pill as a dot+label is the right "show" move. |
| Typography | **3** | Rail itself is Outfit-clean, BUT top-bar links "← BACK / VIEW PAGE →" are UPPERCASE Outfit tracked-out — reads like eyebrows. Access-denied/section-restricted screens use mono eyebrows. |
| Badges/chips | **5** | STATUS_STYLES are saturated, tinted, bordered — exactly the fix the rest of the app still needs. |
| States | **3** | Loading = bare spinner (no skeleton of the rail). Access-denied is designed but leans on mono. |
| Uniqueness | **5** | Hover-expand floating rail is *the* memorable move. |
**Verdict: 4.3 — EXEMPLARY chrome, leave the rail alone.** Only the mobile `SidebarContent` (left-border-accent list) is a second, inconsistent nav language, and the top-bar text links are meek.

### `page.tsx` — dashboard
| Dim | Score | Note |
|---|---|---|
| Focal hierarchy | **2** | The setup checklist is NOT an unmistakable protagonist — it's a quiet cream card with a hairline 1.5px `#C8BEA8` border and a 6px hairline progress bar. Stat tiles below compete at equal weight. |
| Border & depth | **3** | Checklist has a real shadow; stat tiles are flat 1px `#DDD4C0`. |
| Iconography & imagery | **2** | Checklist steps have NO icons — just a check-circle and text. No conference banner/logo anywhere on the org's home screen. |
| Data presentation | **2** | Progress = thin bar + no %. Stat tiles are a textbook bullet-dump (icon + big number + label ×4). |
| Typography | **4** | Clean Outfit; no mono abuse here (0 mono usages). |
| Badges/chips | **3** | No real badges; steps rely on a filled/empty circle. |
| States | **2** | No empty state distinct from loading; spinner only. |
| Uniqueness | **1** | Generic SaaS onboarding checklist + 4 stat tiles. Zero memorable move. |
**Verdict: 2.4 — the weakest page in the slice. The org's front door is generic.**

### `committees/page.tsx`
| Dim | Score | Note |
|---|---|---|
| Focal hierarchy | **3** | Header + grid is clear; cards are uniform, no hero committee. |
| Border & depth | **3** | Flat 1px cards; the 5px difficulty color strip is a nice touch. |
| Iconography & imagery | **2** | No committee emblem/flag imagery on cards despite the assignment board proving flags render beautifully. Country count is text. |
| Data presentation | **2** | "12 countries", session code, PP date are three stacked mono facts — bullet-dump. No capacity ring/flag cluster. |
| Typography | **1** | **Mono everywhere**: labels, topic chips, difficulty badge, country count, session code, PP date, "Choose committee type", DELETE button all in DM Mono. This is the single most code-smelling page. |
| Badges/chips | **2** | Difficulty badge = mono uppercase on a 20%-opacity wash (`${diffColor}20`) — meek. Topic chips = mono on faint green wash, no border. |
| States | **3** | Empty state has copy but no icon/CTA button. Loading = spinner. |
| Uniqueness | **2** | The type-picker modal (GA vs Crisis) is a nice authored moment; cards are generic. |
**Verdict: 2.3 — heavy mono-pill offender.**

### `applications/page.tsx`
| Dim | Score | Note |
|---|---|---|
| Focal hierarchy | **3** | Filters → stats → list. Reasonable, but 14 filter pills form a dense grey wall up top. |
| Border & depth | **3** | Flat cards, hover-border lift. Avatar fallback is designed. |
| Iconography & imagery | **3** | Real avatars, Building2/User/Download icons. Better than committees. |
| Data presentation | **3** | Stat tiles bullet-dumped again (mono labels). Role/status/payment badges are decent. |
| Typography | **3** | Mostly Outfit; role/status badges correctly moved to Outfit. Residual mono: HEAD DEL. chip, stat-tile labels, "NATIONALITY" eyebrow in review panel. |
| Badges/chips | **4** | Role and status badges ARE the good pattern (saturated tint + border + Outfit). This page already half-adopted the Pill fix inline. |
| States | **4** | Empty state distinguishes "none yet" vs "no match" — designed. Still no icon. |
| Uniqueness | **3** | Filter-pill row is standard; the per-status inline action morphing (reject textarea) is thoughtful. |
**Verdict: 3.3 — the strongest of the three content pages; badges nearly right.**

### `assignment/page.tsx`
| Dim | Score | Note |
|---|---|---|
| Focal hierarchy | **4** | Suggestions strip → unassigned rail → committee board. Clear. |
| Border & depth | **5** | Glass panels, blur, dashed gold drop-target borders, layered shadows. |
| Iconography & imagery | **5** | Flags everywhere (`getFlagUrl`), LevelInsignia, awards, emblems. Real content. |
| Data presentation | **5** | Fill bars, tier medallions, fit scores, "N HIGH OPEN" counts. Textbook "show, don't list." |
| Typography | **3** | Intentional mono for stat-stamps is defensible, BUT it's *over*-applied: committee panel titles (`fontSize:14 fontFamily:MONO`), mode-toggle tabs, chair tabs, and section eyebrows are all mono — more than "micro-stamps only." |
| Badges/chips | **5** | Tier badges saturated + bordered + dot. Reference-grade. |
| States | **4** | Designed empty states; flash banner. No skeleton though. |
| Uniqueness | **5** | Drag-drop board + urgency-sorted drop popup. THE memorable move. |
**Verdict: 4.5 — EXEMPLAR, confirmed. Only trim mono over-reach.**

---

## 2. RANKED FINDINGS (most-embarrassing first)

### P1 — ugly / embarrassing

**F1 · `committees/page.tsx` — whole card is DM Mono; the mono-pill capital of the app**
Lines: `labelStyle` (107–116), difficulty badge (470–475), topic chips (480–484), country count (490–492), session-code button (496–498), PP-date (512–516), type-picker heading (570), DELETE button (541), CommitteeEditor "Committee Countries" eyebrow (308). **~9 distinct mono sites on one page.**
Rule broken: "Code-like fonts… the #1 AI tell" + "Meek badge colours."
Fix: Route every badge/chip through the `/account` `Pill` (Outfit, 7px radius, tinted+bordered tones from `PILL_TONES`). Specifically: difficulty → `Pill tone` mapped from `DIFF_COLOR` with a real border (drop the `${diffColor}20` wash); topic chips → Outfit `Pill tone="neutral"`; country count → a flag-cluster + Outfit count, not a mono string; session code is the ONE legit mono micro-stamp — keep it mono but pair with a copy icon (already there). Convert `labelStyle` from mono-uppercase to Outfit 11px 700 non-tracked.

**F2 · `page.tsx` — dashboard protagonist is invisible + iconless bullet-dump stats**
Lines: setup card 231–291 (hairline border, 6px progress bar, no step icons), stat grid 294–309.
Rule broken: "Big, highlighted important parts… UNMISTAKABLY primary" + "Big pages with no icons/images" + "Show, don't list."
Fix: Promote the setup card to a forest→forest-mid gradient hero with a gold radial glow (like the landing hero), thick 2px border, and a real completion ring/medallion showing "1/4" instead of the thin bar. Give each `SetupStep` a lucide icon (Building2 / FileText / CreditCard / Globe) in a tinted disc. Demote the 4 stat tiles: make them a tight 2×2 fact grid with smaller weight, or fold them into the hero — they must NOT read at equal weight to the protagonist. Add the conference banner/logo somewhere on this screen — it's the org's front door and shows no conference identity beyond the rail.

**F3 · `committees/page.tsx` + `page.tsx` — empty states are bare sentences, no icon/CTA**
Lines: committees 442–447, dashboard has none (spinner only).
Rule broken: "Empty/loading/error states are designed, not blank — an icon + CTA."
Fix: Empty committees → a Building2 icon in a tinted disc + "No committees yet" + a primary "ADD YOUR FIRST COMMITTEE" button (the header button exists but the empty state should own a CTA). Add a rail-matching skeleton to the layout loading state instead of a lone spinner.

### P2 — noticeably weak

**F4 · `applications/page.tsx` — stat tiles + filter row are mono/meek and dumped**
Lines: stat tiles 276–282 (mono labels line 280), HEAD DEL. chip 388–391 (mono), review "NATIONALITY" eyebrow 564.
Rule broken: "Bullet-dump information" + mono eyebrows.
Fix: Convert stat-tile labels + HEAD DEL. + NATIONALITY to Outfit via `Pill`. Consider a single segmented summary bar (total→submitted→accepted→assigned as a funnel) instead of 4 identical tiles — "show, don't list." The 14-pill filter wall could collapse role+payment into dropdowns to reduce the grey mass.

**F5 · `layout.tsx` — top-bar text links read as mono-style eyebrows; two nav languages**
Lines: "← BACK" 607–615, "VIEW PAGE →" 617–625 (UPPERCASE Outfit tracked); mobile `SidebarContent` 349–384 uses a left-border-accent list, a different language from the pill rail.
Rule broken: "Consistency of the language" + eyebrow smell.
Fix: Make the top-bar links sentence-case with an inline lucide arrow icon, not tracked-out caps. Reconcile mobile drawer to echo the rail's rounded-pill active state rather than the left-border-accent pattern.

**F6 · `committees/page.tsx` — CommitteeEditor is a long, icon-light form modal**
Lines: 260–319 (name, difficulty select, topics, country matrix) with a mono section eyebrow and no visual relief.
Rule broken: "Big pages with no icons/images."
Fix: Add small lucide icons to each field group; convert the mono "COMMITTEE COUNTRIES" eyebrow to Outfit; show selected-country flag chips (the matrix picker likely already has flags — surface a flag summary above the fold).

### P3 — polish

**F7 · `assignment/page.tsx` — mono over-reach beyond micro-stamps**
Lines: committee panel title 827 (`fontSize:14 fontFamily:MONO`), mode toggle 1305–1325, chair tabs 1608–1621, numerous section eyebrows.
Rule broken: mono is for "TINY stamps only"; a 14px panel title and tab labels aren't stamps.
Fix: Move the panel title and the mode/chair tab labels to Outfit 700. Keep mono strictly for the numeric stamps (fill counts, scores, tier labels) where it genuinely earns the "stamp" role. Low priority — this page is otherwise exemplary; don't destabilise it.

**F8 · `page.tsx` — quick-action buttons are an undifferentiated bold-caps row**
Lines: 312–351. One filled + three ghost buttons, all UPPERCASE tracked, no icons.
Fix: Add a leading lucide icon to each; this is the rulebook's "icons everywhere for scanning speed."

**F9 · `applications/page.tsx` — no avatar/flag on nationality in the card face**
The review panel shows nationality as text only; the assignment page proves flags render. Fix: surface a small rectangular flag next to nationality using `getFlagUrl`.

---

## 3. LEAVE-ALONE LIST (confirmed / challenged)

- **Floating rail (`layout.tsx` SideRail)** — CONFIRMED exemplar. Glass, blur+saturate, hover-expand, saturated status pill, warm shadow. Do not touch. It is the reference the rest of the slice should be pulled toward.
- **Assignment board (`assignment/page.tsx`)** — CONFIRMED exemplar. Drag-drop, urgency-sorted drop popup, flags, fill bars, tier medallions, fit scores. Best page in the app's management surface. Only nit: trim mono off the panel title/tabs (F7, P3) — otherwise hands-off.
- **Applications role/status badges** — CONFIRMED good. These already implement the Pill pattern inline (saturated tint + border + Outfit). Use them as the in-slice template; do NOT revert them to mono.
- **CHALLENGE — dashboard (`page.tsx`)** — do NOT leave alone. Despite being the landing route, it is the least authored surface here (2.4). It needs the biggest lift: a gradient hero checklist, step icons, a completion medallion, and conference imagery.

---

## SUMMARY

The rail and the assignment board are genuinely studio-grade and prove the team can hit the bar. The gap is that the polish stopped at those two: the **dashboard is a generic SaaS onboarding screen** and **`committees` is drowning in DM Mono** (≈9 mono sites) with meek wash-badges. The corrective pattern already exists in-repo — the `/account` `Pill` (Outfit, tinted, bordered) and the applications page's inline badges. Porting that pattern across committees + the dashboard stat tiles, plus giving the dashboard checklist a real protagonist treatment, would lift the whole slice.
