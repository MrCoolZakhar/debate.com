# UI AUDIT — ACCOUNT + AUTH SLICE

**Auditor:** senior UI critic · **Standard:** `00-DESIGN-RULEBOOK.md` · **Branch:** `feature/conferences-auth`

**One-line verdict:** The account area is genuinely strong — CV timeline, rank insignia, and tiered awards are exemplars that clear the bar comfortably. The **auth pages are the slice's embarrassment**: a bare centred form-card on ivory, using *none* of the site's real photography, on the one surface that is a new user's first impression. Fix those first. A handful of mono-overuse and thin-panel issues remain in the account pages.

---

## 1. PER-PAGE SCORECARD (1–5 per dimension)

| Page | Focal hier. | Border/depth | Icon/imagery | Data pres. | Typography | Badges/chips | States | Uniqueness | **Verdict** |
|------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **auth/signin** | 3 | 2 | 2 | 3 | 3 | 3 | 3 | **1** | **2.4 — WEAK. Bare card, no brand moment.** |
| **auth/signup** | 3 | 2 | 2 | 3 | 3 | 3 | 4 | **1** | **2.4 — WEAK. Same as signin; good confirmation state.** |
| **account/layout** (sidebar) | 4 | 4 | 3 | 4 | **2** | 4 | 4 | 4 | **3.6 — GOOD. Nav labels are mono/uppercase smell.** |
| **account/profile** | 5 | 4 | 4 | 4 | 3 | 4 | 4 | 4 | **4.0 — STRONG. Rank banner carries it.** |
| **account/cv** | 5 | 5 | 5 | 5 | 4 | 5 | 5 | 5 | **4.9 — EXEMPLAR. Do not touch the timeline.** |
| **account/calendar** | 4 | 5 | 5 | 4 | 4 | 5 | 5 | 4 | **4.5 — STRONG. Real skeleton, banner cards, role tags.** |
| **account/points** | 3 | 4 | 3 | **2** | 3 | 3 | 4 | 3 | **3.1 — OK BUT THIN. Ledger is a bullet-dump; earn cards flat.** |
| **accountUi** (shared) | — | 5 | 5 | 5 | 4 | 5 | — | 5 | **4.8 — EXEMPLAR primitives.** |

---

## 2. RANKED FINDINGS (most-embarrassing first)

### 🔴 P1 — `auth/signin/page.tsx:71-262` & `auth/signup/page.tsx:80-344` — The front door is a template auth card

**Problem.** Both pages are the single most generic pattern in web design: one `max-w-md` cream card, centred on ivory+grain, logo → heading → Google button → divider → form. This violates rulebook §1 ("Images/photography — empty coloured rectangles are a last resort"), §1 ("Uniqueness — ONE memorable move"), §2.1 (focal hierarchy — the whole viewport is one flat card), and §2.3 (depth). Uniqueness scores **1/5**: a designer would clock this as AI-generated on sight. It is *especially* damning because the site ships a full photo library the page ignores: `public/landing/podium-speaker.jpg`, `public/landing/organiser-desk.jpg`, `public/banners/preset-1…5.jpg`, `public/ambassador-photos/*`, `public/GavelHero.png`, and video cards (`card_debate.mp4`). The landing hero photo-cards are a named exemplar (§4) — the auth pages are their opposite.

**Concrete fix.** Convert to a **split-screen**: left ~45% is a full-bleed forest-scrimmed photo panel (`landing/podium-speaker.jpg` or a `banners/preset-*.jpg`) with an overlaid brand moment — the Gavelling wordmark, a one-line value prop ("Your Model UN, run properly."), and 2–3 ambassador portraits or a "trusted at N conferences" gold stat. Right ~55% holds the existing form on cream. Add a soft gold radial glow behind the card (the profile rank-banner already uses `radial-gradient(circle, rgba(238,217,138,0.30)…)` — reuse it). On mobile, collapse to the photo as a short 120px scrimmed header strip above the card so the imagery still lands. This single change lifts uniqueness 1→4 and imagery 2→5 on both pages.

---

### 🟠 P1 — `auth/signin/page.tsx:72-80` & `auth/signup/page.tsx:81-89` — Timid 1px border + weak radius on the primary surface

**Problem.** The auth card uses `border: '1px solid #DDD4C0'` and `borderRadius: '16px'` — the rulebook demands **1.5–2px confident borders** (§1) and the account area's own `GlassCard` uses `1.5px solid #D8CDB6` at radius `20px`. The front-door card is *thinner and flatter* than every card behind the login wall. It also isn't glass (opaque `#FAF8F3`, no backdrop-blur) while everything in `/account` is translucent glass (§1 transparency).

**Concrete fix.** Bump to `1.5px solid #D8CDB6`, radius `20px`, and adopt the `GlassCard` treatment (`rgba(250,248,243,0.82)` + `backdrop-filter: blur(14px) saturate(1.4)`) so it matches the post-login language. Ideally import `GlassCard` from `accountUi` directly.

---

### 🟠 P2 — `account/points/page.tsx:196-247` — Transaction history is a textbook bullet-dump

**Problem.** The ledger is exactly what §1 HATES and §2.6 warns against: stacked identical rows of `icon · description · amount · date · balance`, all in DM Mono, no visual weight difference between an earn and a spend beyond text colour. There's no shown data — no running-balance sparkline, no earned-vs-spent split, no grouping by month. For a "Rewards" page this reads as an accountant's export, not a product.

**Concrete fix.** Above the list, add a small **earned-vs-spent summary** (two gold/forest stat medallions, or a thin stacked bar showing lifetime earned vs spent) — "show, don't list." Group ledger rows under month sub-headers (`JULY 2026`) so the wall breaks up. Give earn rows a faint forest left-edge and spend rows a faint danger left-edge for instant scanning. Demote `bal N` visually (it's the least important column but currently same weight as the amount).

---

### 🟠 P2 — `account/points/page.tsx:146-181` — "How to Earn" cards are flat and icon-thin vs the rest of the account area

**Problem.** Three `GlassCard`s each with a 34px muted-forest icon tile + title + desc. Compared to the CV entry cards (opaque tier discs, role chips, logos) and calendar cards (banner strips, floating logos, countdown chips) these feel like a different, lower-effort product. The "COMING SOON" pill (line 164-178) is the meek grey/mono capsule the rulebook explicitly flags (§1 "meek badge colours", §5).

**Concrete fix.** Give each earn card a saturated accent per type (Trophy=gold, Award=silver-per-award-tier, Purchase=forest) on the icon tile with a real tinted border, matching the CV `discBg` gradient language. Replace the grey mono "COMING SOON" with the account `Pill` component (`tone="amber"` or `"gold"`, normal-case Outfit) — the whole account area already moved off this exact capsule; points didn't get the memo.

---

### 🟡 P2 — `account/layout.tsx:81-95, 180-213` — Nav labels are mono-smell in Outfit clothing

**Problem.** The four nav items (`MY PROFILE`, `MUN CV`, `CONFERENCE CALENDAR`, `GAVELLING POINTS`) render as ALL-CAPS + `letterSpacing: 0.05em` bold. Even though the font is Outfit, the *treatment* is the uppercase-letterspaced-eyebrow tell the rulebook calls the #1 AI smell (§1). A sidebar nav is not a micro-stamp — it's primary navigation and should read as human, title-case labels. The `ACCOUNT` section header (line 173-178, DM Mono `8.5px 0.24em`) is a legitimate micro-eyebrow and can stay.

**Concrete fix.** Switch nav labels to **Title Case Outfit** ("My Profile", "MUN CV", "Conference Calendar", "Gavelling Points") at normal letter-spacing, weight 600, and pair each with a lucide icon (User, FileText, CalendarClock, Coins) — the rulebook wants icons for scanning speed (§1) and the nav currently has none. This fixes typography 2→4 and adds iconography.

---

### 🟡 P2 — `account/layout.tsx:146-151` — Sidebar email in DM Mono

**Problem.** The user's email under the avatar is set in `'DM Mono'` (line 148). An email address is not a 3-char code or a stat — it's prose data, and mono here reads as a code-font tell (§1). Same issue recurs on the profile page mentally but it's the sidebar that's always on screen.

**Concrete fix.** Set the email in Outfit at `#9A8A78`, 12px. Reserve mono for the unlimited stamp only.

---

### 🟡 P3 — `account/profile/page.tsx:337, 351` & `points:110-124` — Mono creeping past micro-stamp size

**Problem.** The rank-banner "Your MUN Rank" eyebrow (mono 9px — fine) sits beside a mono `{cvCount} conferences` counter (line 351, 11px — borderline; it's a short phrase, not a stamp). On points, `YOUR BALANCE` / `GAVELLING POINTS` labels (mono 9-10px) are acceptable stamps, but the giant `60px` balance number in DM Mono (line 116) is the *right* mono use — keep it. The drift is small; flagging so it doesn't spread.

**Concrete fix.** Change the "N conferences" strings to Outfit; keep the numeric stat displays (`24px` CV stats, `60px` balance) in mono as intentional stat-numbers per §3.

---

### 🟡 P3 — `account/profile/page.tsx:742-778` — Notification rows are generic settings-list

**Problem.** The four notification rows (icon tile + label + desc + toggle) are competent but plain — the one place on the profile page that reverts to a standard SaaS settings list. Not embarrassing, but the weakest block on an otherwise strong page. The prompt explicitly asked whether these are "generic" — they lean that way.

**Concrete fix.** Low priority. If polished: give the active-state icon tile a subtle forest gradient (matching CV disc language) instead of a flat `rgba(27,56,40,0.09)` fill, and consider grouping the four into a single bordered panel with a hairline `◆` divider between rows for editorial detail (§2.9).

---

### 🟢 P3 — `auth/*` — No password-strength / no "forgot password" affordance

**Problem.** Signup enforces 8-char minimum only via inline error; there's no live strength meter and signin has no "Forgot password?" link. Minor UX/polish, not a rulebook violation, but a premium front door usually has both.

**Concrete fix.** Add a "Forgot password?" link under the signin password field and a lightweight strength hint on signup. Cosmetic priority.

---

## 3. LEAVE-ALONE LIST (confirmed exemplars — do NOT touch)

- **CV timeline** (`cv/page.tsx:1051-1229`) — rail with 64px conference logos + mono date stamps + gradient connector line, per-type opaque corner discs (`discBg` gradients), solid role chips, verified/self-reported `Pill`s, award chips + level badge inline. This is a §4 named exemplar and fully earns it. **5/5.**
- **Rank insignia / LevelBadge** (`accountUi.tsx:119-199`) — the escalating chevron→crowned-star military insignia on a tinted disc. Exactly the "not a candy dot" §4 exemplar. **5/5.**
- **Tiered AwardChip / AwardArtwork** (`accountUi.tsx:478-562`) — gold/silver/bronze tiering with artwork-first + graceful medal-disc fallback. Saturated, bordered, meaningful (§1). **5/5.**
- **Profile rank banner** (`profile/page.tsx:313-383`) — forest gradient, gold radial glow, 38px rank label, gold progress bar, click-through to CV. The page's protagonist, unmistakably primary (§1, §2.1). Reuse its glow on the auth fix.
- **Calendar cards + skeleton** (`calendar/page.tsx:121-343`) — banner strip / forest wash fallback, free-floating logo overlapping the strip, countdown chip, tinted role tags with rectangular flags, and a **real layout-matched shimmer skeleton** (§2.10). Strong.
- **`Pill` primitive + `ExperienceInfo` explainer** (`accountUi.tsx:47-335`) — the warm-tint, Outfit, no-candy-dot chip is the correct replacement for the old grey capsule; the tier-ladder popover with per-band ranges is genuine editorial craft. This is the standard the rest of the app's badges should copy.

---

## 4. SUMMARY

The account area is one of the best-authored slices in the app — the CV/insignia/awards trio is reference-grade and the shared `accountUi` primitives are doing real work. The remaining account weak spots are minor and localised: **points** needs a data-viz pass (it's the one bullet-dump), the **sidebar nav** and **email** carry residual mono-uppercase smell, and a couple of stray mono phrases. The **auth pages are the real gap** — they're a generic centred form on the one surface that has to sell the product, and they ignore a photo library the landing page uses beautifully. Ship the split-screen auth redesign first; everything else is polish.
