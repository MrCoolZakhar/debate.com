# UI AUDIT — PUBLIC DISCOVERY SURFACE
**Slice:** the `/conferences` landing, `/conferences/explore` directory, `/conferences/map` globe, the shared `ConferenceCard`, `SiteNav`, and supporting `ConferenceFocusCards` / `shared.tsx`.
**Measured against:** `docs/ui-audit/00-DESIGN-RULEBOOK.md`.
**Scale:** 1 = AI-generated smell / broken · 5 = authored, would-ship-at-a-design-studio.

---

## 1. PER-PAGE / PER-COMPONENT SCORECARD

### `/conferences` landing — `VariantStagefront.tsx`
| Dimension | Score | Note |
|---|---|---|
| Focal hierarchy | **5** | Hero headline + gold CTA + photo-card rail is an unmistakable protagonist. Bands alternate dark/cream/ivory cleanly. |
| Border & depth | **4** | Real elevation everywhere (glass tiles, floating stat ledger, drop-shadowed cards). Loses one for the timid `1px rgba(27,56,40,0.14)` hairline on the podium photo (rulebook wants 1.5–2px). |
| Iconography & imagery | **5** | Four real photos + video globe + logos + flags. Zero text walls. This is the exemplar the rest of the site should envy. |
| Data presentation | **2** | The live stat ledger (OPEN ROLES / CONFERENCES HIRING / CHAIR SEATS) is a **bullet dump of three mono rows** — exactly the "show, don't list" failure. See F1. |
| Typography | **3** | Outfit-led and confident — but **seven+** mono UPPERCASE letter-spaced eyebrows (`THE JOB BOARD`, `NEAR YOU`, `NEW TO THE CIRCUIT?`, `ORGANISER TOOLS`, `THE GAME`, `WHY GAVELLING`, the hero counter). Rulebook: mono = micro-stamps ONLY. This is the #1 AI tell, sprawled. See F2. |
| Badges/chips | **4** | Role-pop chips are genuinely good (tinted left-border, logo, category stamp). FREE / fee chips saturated + bordered. |
| States | **3** | Geo has a graceful "Finding your region…" fallback and role chips are conditional — but there is **no loading skeleton for the hero rail or stat ledger** (they show `—` / empty until fetch lands). |
| Uniqueness | **5** | Fanned "notification" role chips + straddling live stat ledger + auto-scroll regional rail + gavel-disc hero cards. Memorable, not template. |
| **Verdict** | **~3.9** | The most authored surface in the slice. Two concrete drags: mono-eyebrow sprawl and the 3-row stat dump. Fix those and it's a 4.5. |

### `/conferences/explore` — `ConferencesExploreClient.tsx`
| Dimension | Score | Note |
|---|---|---|
| Focal hierarchy | **4** | Editorial title + green/gold full-stop, then the sticky glass filter bar as the clear operational anchor. Good. |
| Border & depth | **4** | Floating glass filter bar with inset highlight + ambient radial washes = real depth. |
| Iconography & imagery | **3** | Search/sliders/back icons present; grid is card-driven (imagery lives in the card). Header itself is icon-light but acceptable for a directory. |
| Data presentation | **4** | Grid of cards is the right call; the "SHOWING N CONFERENCES" rule-line is a nice editorial touch. |
| Typography | **2** | Filter pills are fine — but every panel label (`FORMAT`, `LEVEL`, `CONTINENT`), the back-link, the results count, and the eyebrow are **DM Mono UPPERCASE letter-spaced**. Same sprawl as the landing. See F4. |
| Badges/chips | **2** | The inactive `FilterPill` is `rgba(237,231,216,0.5)` bg + `#6B5F52` text — **the exact "meek washed pill with no conviction" the rulebook flags**. See F3. |
| States | **5** | Best-in-slice: a real layout-matching skeleton grid AND a designed empty state (custom globe+magnifier SVG + headline + CTA). Leave alone. |
| Uniqueness | **3** | Competent Airbnb-style directory. The glass filter bar is the one memorable move; otherwise conventional. |
| **Verdict** | **~3.4** | Structurally solid, states excellent. Held back by meek inactive pills and mono-label sprawl in the filter drawer. |

### `/conferences/map` — `map/page.tsx`
| Dimension | Score | Note |
|---|---|---|
| Focal hierarchy | **4** | Full-bleed world map + single centered hint is a clear, cinematic protagonist. |
| Border & depth | **4** | Layered z-stack (grain / trail canvas / map / clouds video / card) genuinely deep. Cursor trail is a lovely touch. |
| Iconography & imagery | **3** | All imagery, no text walls — but the continent info-card has **zero icons** (no flag cluster, no pin, no lucide). A map page that never shows a flag is a miss. See F6. |
| Data presentation | **2** | The continent card lists "Active Conferences: N" and "Highlighted Conference: —" as **two label→value rows** — a bullet dump where a big medallion number + a mini conference chip would land harder. "Highlighted" is `—` whenever no app in 7 days. See F5. |
| Typography | **3** | Outfit headline strong; but the eyebrow, both hint pills, the back button, and the stat value are all DM Mono. Hint pills at 11px mono are borderline-OK as stamps; the card eyebrow is not. |
| Badges/chips | **3** | Hint/back pills are forest + faint-gold-border — decent conviction, consistent. |
| States | **3** | Card has a 2-bar pulse skeleton (good). But **scroll-only navigation has no visible affordance for touch/trackpad users**, and there's no empty state when a continent has 0 conferences (card still renders "0" + "—"). |
| Uniqueness | **5** | Hover-a-continent-and-scroll with a cloud-transition video and a cursor trail is a genuinely singular move. Nothing template about it. |
| **Verdict** | **~3.4** | Spectacular concept, undercut by a flat 2-row info card that reads like a debug readout on top of a cinematic globe. |

### Shared `ConferenceCard.tsx`
| Dimension | Score | Note |
|---|---|---|
| Focal hierarchy | **5** | `heroCompact` photo tier with gold glow + gavel disc is a protagonist; classic tier has clean logo-over-band hierarchy. |
| Border & depth | **4** | Layered glow shadow, hover lift, banner scrim. Classic-tier default border is `#DDD4C0` 1px — one notch under the 1.5–2px target, but hover promotes it. |
| Iconography & imagery | **5** | Banner photo / gradient-fallback / monogram, flags, calendar + users icons, gavel disc. Exemplary. |
| Data presentation | **4** | 2×2 fact micro-grid in the hero tier is the rulebook's "density done right." |
| Typography | **3** | Facts, dates, fee, acronym eyebrow, monogram initials **all DM Mono** — defensible as micro-stamps (date, 3-char code, stat) but the sheer count per card pushes toward code-font smell. Borderline-OK. |
| Badges/chips | **5** | FREE = saturated green tint + border; fee = gold tint + border; format chip = glass. All conviction. Reference quality. |
| States | **3** | No internal skeleton (owner handles that in explore) and no `onError` fallback on `banner_url`/`logo_url` — a broken URL leaves a gap. |
| Uniqueness | **5** | The gavel-disc-straddling-the-corner wrapper trick is authored craft. |
| **Verdict** | **~4.3** | The strongest single component in the slice. Don't touch the badges or the disc. |

### `SiteNav.tsx`
| Dimension | Score | Note |
|---|---|---|
| Focal hierarchy | **4** | Floating glass pill nav (the rulebook's named exemplar pattern) + clear account/CTA cluster. |
| Border & depth | **4** | Glass pill with layered shadow + inset — the reference "floating panel" done right. |
| Iconography & imagery | **3** | Globe icon on lang toggle; avatar. Otherwise text links (fine for a nav). |
| Data presentation | n/a | — |
| Typography | **4** | Outfit throughout; DM Mono only on the language code (`EN`/`ES`) — a legit 2-char stamp. Correct restraint. |
| Badges/chips | **2** | The `✨ NEW` language badge and `GAVELLING UNLIMITED ✦` / `UPGRADE ✦` use **literal emoji** (`✨`, `✦`) — rulebook §3: "lucide-react icons only, never emoji." See F7. |
| States | **4** | Menus close on outside-click, mobile menu animates. Solid. |
| Uniqueness | **4** | The scroll-detached floating pill is a nice signature. |
| **Verdict** | **~3.7** | Good bones. The emoji in badges are the one embarrassing tell. |

### `ConferenceFocusCards.tsx` (supporting)
| Dimension | Score | Note |
|---|---|---|
| — | **DEAD CODE** | The default-export component is **never rendered** anywhere (only its `FocusCard` type is imported, in the unused `ConferencesClient.tsx`). Expander-card pattern is fine but uses `2px solid transparent`→`#3D7A52` borders and a plain gradient fallback. Not worth polishing until wired in. See F8. |
| **Verdict** | **—** | Recommend deletion or wiring, not restyling. |

### `shared.tsx` / `StagefrontClient.tsx` (supporting)
Token/util module + thin data-fetch wrapper. `LabFooter` is clean (ivory, real logo, real SVG icons). No standalone findings. `StagefrontClient` has **no loading state** — it renders `VariantStagefront` with empty arrays until the fetch resolves, which is what starves the hero (F1/states). Leave the files; fix the symptom in the landing.

---

## 2. RANKED FINDINGS (most-embarrassing first)

### F1 · `VariantStagefront.tsx:475–506` — the live stat ledger is a 3-row bullet dump · **P1**
Three stacked forest rows, each a big gold number + a mono LABEL + a sub-line (`OPEN ROLES` / `CONFERENCES HIRING` / `CHAIR SEATS`). This is precisely the rulebook's "listing facts as stacked rows when a medallion/ring/grid would show them with more punch" failure — and it sits next to the site's best photo, so the contrast is stark. Worse, before `jobStats` loads all three read `—`.
**Fix:** convert to the pricing-medallion language the rulebook names as an exemplar — three **gold-ringed stat medallions** (circle, big Outfit number, tiny caption) in a row, or one hero medallion for OPEN ROLES with the other two as small satellite chips. Give each a lucide icon (Users / Building2 / Gavel). Add a shimmer/skeleton for the pre-fetch `—` state.

### F2 · `VariantStagefront.tsx:281, 386, 466, 469, 498, 518, 552, 569, 591, 704` — DM Mono eyebrow sprawl · **P1**
Eight-plus section labels are DM Mono + UPPERCASE + `letter-spacing: 0.18–0.24em` (`… CONFERENCES ON THE BOARD`, `THE JOB BOARD`, `NEAR YOU`, `NEW TO THE CIRCUIT?`, `THE GAME`, `WHY GAVELLING`, `ORGANISER TOOLS`, plus photo captions). Rulebook §1 HATES, verbatim: "Mono eyebrows everywhere = the #1 AI tell." None of these are micro-stamps.
**Fix:** demote to **Outfit** eyebrows — 700 weight, `letter-spacing: 0.14em`, `font-size: 11px`, still `GOLD` — OR drop the eyebrow entirely on 2–3 sections and let the big Outfit headline carry it. Keep DM Mono ONLY on the true stamp captions (`CHAIRS · SECRETARIAT · STAFF`).

### F3 · `ConferencesExploreClient.tsx:58–77` (`FilterPill`) — meek washed inactive pills · **P1**
Inactive pill = `backgroundColor: rgba(237,231,216,0.5)`, `color: #6B5F52`, `border: rgba(221,212,192,0.9)`. That's the "pale grey/washed pill with no conviction" the rulebook flags on sight — a whole row of them across the continent filter reads unfinished. Rulebook §5 explicitly notes the "Pill fix only landed in `/account`" and these still carry the old treatment.
**Fix:** give the inactive state real conviction — cream `#FAF8F3` fill, `#4A4238` ink text, a **1.5px** `#D8CDB6` border, hover warming to `rgba(27,56,40,0.06)` + forest text. Active stays forest/gold.

### F4 · `ConferencesExploreClient.tsx:195, 207, 348, 355, 366, 395` — mono labels in header + filter drawer · **P2**
The back-link, `CONFERENCE DIRECTORY` eyebrow, the `FORMAT`/`LEVEL`/`CONTINENT` group labels, and `SHOWING N CONFERENCES` are all DM Mono UPPERCASE letter-spaced. Same tell as F2, in the directory.
**Fix:** same remedy — Outfit 700 for group labels and the count rule; keep mono only on the single `SHOWING N` stamp if desired. Back-link → Outfit 600 with its `ArrowLeft` icon.

### F5 · `map/page.tsx:635–705` — continent info-card is a 2-row label→value dump · **P2**
On top of a cinematic globe, the payoff card reads `Active Conferences … N` and `Highlighted Conference … —` as two flat justify-between rows — a debug readout. `Highlighted` collapses to `—` whenever no application landed in 7 days (common), so the card frequently shows a dash.
**Fix:** make `activeCount` a **big gold Outfit numeral** (medallion or oversized figure) as the card's hero stat with a `Globe`/`MapPin` icon; render the highlighted conference as a **mini conference chip** (logo + name + date) reusing the card language, not a truncated text value. When 0 conferences, swap to a designed empty line ("No live conferences here yet — be the first") instead of `0` + `—`.

### F6 · `map/page.tsx:547–727` — the map's own card shows no flag/pin iconography · **P2**
A geography feature whose result card contains not a single flag, pin, or lucide icon — only text. Rulebook §1: "A wall of text with no icon is a failure," and §3 explicitly wants rectangular flags via `getFlagUrl`.
**Fix:** add a `MapPin` next to the eyebrow and a small cluster of 3–4 rectangular country flags (from that continent's live conferences) under the heading — makes the card feel part of the flag-forward card system.

### F7 · `SiteNav.tsx:186, 338–339, 352` — literal emoji in badges · **P2**
`✨ NEW`, `UPGRADE TO UNLIMITED ✦`, `GAVELLING UNLIMITED ✦` use raw emoji/glyphs. Rulebook §3: "lucide-react icons only, never emoji."
**Fix:** replace `✨` with a lucide `Sparkles` (size 9, gold) and `✦` with lucide `Sparkle`/`Star` or the gold ◆ editorial separator the rulebook mentions. Keeps the badge on-system and crisp at small sizes.

### F8 · `ConferenceFocusCards.tsx` (whole file) — dead component · **P3**
The default export is never rendered (grep confirms only the `FocusCard` type is imported, by the otherwise-unused `ConferencesClient.tsx`). Its expander cards duplicate card logic with a thinner border language.
**Fix:** delete the component (keep the `FocusCard` type if still referenced) OR wire it into a real surface. Don't spend polish budget on code that never ships. If kept, reconcile its `2px transparent → #3D7A52` border and plain-gradient fallback with `ConferenceCard`.

### F9 · `VariantStagefront.tsx:447–449` — timid 1px hairline on the podium photo · **P3**
`border: 1px solid rgba(27,56,40,0.14)` on the flagship job-board photo is exactly the "timid 1px hairline that blends into the bg" the rulebook warns against — especially against cream.
**Fix:** bump to `1.5px rgba(27,56,40,0.22)` or a hairline gold `rgba(182,135,31,0.3)` to match the authored edges elsewhere.

### F10 · `ConferenceCard.tsx:154, 334, 382` — no `onError` fallback on `banner_url`/`logo_url` images · **P3**
A dead banner or logo URL leaves a blank band / gap; the footer logos elsewhere use `onError` to hide gracefully. Rulebook §10 wants states designed.
**Fix:** add `onError` handlers that fall back to the gradient+monogram branch (banner) and the initials chip (logo) already coded for the null case.

---

## 3. LEAVE-ALONE LIST (genuinely good — do not touch)

- **`ConferenceCard` badges** (`ConferenceCard.tsx:263–283, 458–472`) — FREE green-tint-bordered, fee gold-tint-bordered, format glass chip. Reference-quality conviction; the rest of the site should copy these.
- **The gavel-disc wrapper trick** (`ConferenceCard.tsx:499–531`) — overflow-safe corner disc + gold glow. Authored craft.
- **Hero photo-card rail + 2×2 fact micro-grid** (`heroCompact` tier) — the rulebook's named landing exemplar, executed.
- **Explore skeleton + empty state** (`ConferencesExploreClient.tsx:402–438`) — layout-matching pulse grid and a custom SVG empty state with icon + CTA. Best states in the slice.
- **The map cursor-trail + hover-scroll-cloud-transition mechanic** (`map/page.tsx`) — the single most unique move on the whole surface. Keep it; only fix the card sitting on top of it.
- **Role-pop notification chips** (`VariantStagefront.tsx:1024–1083`) — tinted left-border, logo/monogram, category stamp, playful fan. Exemplary "show, don't list."
- **The floating glass filter bar** (`ConferencesExploreClient.tsx:247–388`) and **SiteNav floating pill** — both correct executions of the rulebook's "floating panel over content" reference.
- **`LabFooter`** (`shared.tsx:209–255`) — ivory, real wordmark, real SVG icons. On-system.
