# UI AUDIT — MANAGE / SECONDARY PAGES

**Slice:** `manage/[slug]/settings`, `communications`, `documents`, `financials`, `jobs`
**Measured against:** `docs/ui-audit/00-DESIGN-RULEBOOK.md`
**Verdict in one line:** These are the plumbing rooms of the manage suite — functionally complete, palette-correct, and almost entirely un-designed. Every page is a **vertical stack of flat cream cards** (`#FAF8F3` + 1px `#DDD4C0`, `borderRadius:16`), zero gradients, zero glass, zero grain, zero depth. Not one of them uses the floating-drawer pattern the owner "LOVES", and the entire slice leans on **DM Mono as a UI eyebrow/label/tab/badge font** — the rulebook's stated #1 AI tell. Financials is a literal three-line stub.

---

## 1. PER-PAGE SCORECARDS (1–5)

| Dimension | Settings | Comms | Documents | Financials | Jobs |
|---|:--:|:--:|:--:|:--:|:--:|
| Focal hierarchy | 2 | 3 | 2 | 1 | 3 |
| Border & depth | 2 | 2 | 2 | 1 | 2 |
| Iconography & imagery | 2 | 3 | 3 | 1 | 4 |
| Data presentation | 2 | 3 | 2 | 1 | 3 |
| Typography (mono discipline) | 1 | 2 | 1 | 2 | 1 |
| Badges/chips | 3 | 3 | 3 | — | 3 |
| States (empty/loading/error) | 2 | 4 | 2 | 1 | 4 |
| Uniqueness | 1 | 2 | 2 | 1 | 2 |
| **Weighted verdict** | **1.9 — weak** | **2.8 — passable** | **2.2 — weak** | **1.2 — stub** | **2.8 — passable** |

**Ranking, worst → best:** Financials (stub) · Settings (biggest surface, biggest miss) · Documents · Communications · Jobs.

Notes per page:
- **Settings** — the largest, most-recently-reworked surface, and it under-delivers hardest relative to its ambition. Pill tabs in **mono**, seven identical flat cards stacked in a `max-w-3xl` column, a text-only "Conference details" mega-form, and — most damningly — it re-implements the *exact* settings-drawer concept the owner already ships elsewhere, but as flat inline cards instead of a floating drawer.
- **Communications** — the strongest-built of the five (real two-column composer, designed empty state with `Mail` icon + CTA, colored status system). Held back by mono creeping into stat labels, recipient counts, and the email-list status pills, plus a flat 3-up stat row.
- **Documents** — competent tab+card layout with real flags on position papers (good), but study-guide rows are a text list with a grey `FileText` glyph, the paper stats are a **4-item mono bullet-dump**, and empty states are bare centered sentences.
- **Financials** — three lines of text. No card, no icon, no on-brand framing. The single most embarrassing screen in the slice.
- **Jobs** — best-in-slice: lucide meta icons on every row, category color-coding, line-clamped description, animated skeleton loader, designed empty state. Still flat cards, still mono labels everywhere, still a low-contrast stat row.

---

## 2. RANKED FINDINGS (most-embarrassing first)

### F1 · Financials is a bare-text stub, not a designed "coming soon" · P1
`financials/page.tsx:4-14`
**Problem.** The whole page is an eyebrow + `<h1>` + one grey sentence "This section is being built. Check back soon." No card, no icon, no illustration, no border — it doesn't even use the shared `cardStyle`. Violates "Empty/loading/error states are designed, not blank" and "big page with no icons/images". A conference organiser who clicks Financials sees something that looks broken.
**Fix (aspirational stub — still on-brand).** Render a single centered **hero placeholder card**: forest→forest-mid gradient panel with a gold radial glow, a large `Wallet`/`Landmark` lucide icon in a gold-ringed disc (reuse the pricing-medallion treatment from the rulebook exemplars), an Outfit-900 headline "Payments are coming to Gavelling", one paragraph, and a **3-up preview grid of ghosted/greyed "future" stat medallions** (Total collected · Outstanding · Refunded) sitting behind a `blur(2px)` + "Coming with Stripe" gold badge. Add a secondary "Notify me when it's live" ghost button. Even disabled, it should read as a deliberately-designed feature teaser matched to the landing hero quality bar — not a maintenance note.

### F2 · DM Mono is used as the UI label/tab/eyebrow font across the entire slice · P1
Settings tabs `settings/page.tsx:768` · custom-question role tabs `:1433` · lineage eyebrows `:1742,1792` · all `SECTION_KEYS` permission chips `:1554,1584` · Comms stat labels `communications/page.tsx:485` · email status pills `:548` · recipient-count line `:807-816` · Documents committee tabs `documents/page.tsx:508` · filter pills `:648` · study-guide `formatFileSize` rows `:552` · Jobs stat labels `jobs/page.tsx:816` · category tabs `:834` · all modal `labelStyle` field labels `jobs/page.tsx:415`, `documents/page.tsx:163,175`.
**Problem.** The rulebook is explicit: "If a label is mono + UPPERCASE + letter-spaced and it's not a micro-stamp, it's wrong… Mono eyebrows everywhere = the #1 AI tell." Right now mono is the default label typeface for tabs, form-field labels, stat captions, and pills — none of which are 3-char micro-stamps.
**Fix.** Global sweep: switch every **tab, form-field label, stat caption, and pill** to `Outfit` (semibold, `letterSpacing` reduced to ~0.02–0.04em). *Keep* mono only on genuine micro-stamps: the `12 KB`/`1.4 MB` file-size chips, the `? estimated recipients` count, a bare acronym+year stamp. That single change removes most of the AI smell from this slice at once.

### F3 · Settings ignores the floating-drawer pattern the owner explicitly loves · P1
`settings/page.tsx:747-758` (whole page is `max-w-3xl` + pill tabs + stacked `cardStyle` cards)
**Problem.** Rulebook LOVES list: "Floating settings side-drawers — the manage floating rail / conference-settings drawer pattern is the reference; reuse the 'floating panel over content' idea elsewhere." This is the settings page and it is the *flattest* realisation possible: four mono pill tabs over a single scrolling column of seven visually-identical flat cards. There is no rail, no drawer, no glass, no depth, no protagonist. The Conference tab alone stacks six full-width cards (details, banner, logo, fee, description, socials) with no grouping hierarchy.
**Fix.** Restructure into the floating pattern: a **left vertical section rail** (glass pill, icons→labels on hover, matching `layout.tsx`) listing Applications / Conference / Team / Privacy, with the active section's content in a **floating elevated panel** (`backdrop-blur`, translucent `#FAF8F3` over a grain layer, layered warm shadow `0 20px 60px rgba(27,56,40,.12)`, thick 1.5px border). Within a section, promote the primary card (e.g. Conference Details) with a subtle forest top-accent and demote secondary cards. At minimum, if a full drawer is out of scope: bump borders to 1.5px, add elevation + grain to the active card, and give each card an icon-in-disc header instead of a plain bold `<p>`.

### F4 · Documents study-guide list & paper stats are a flat text/bullet dump · P2
Study-guide rows `documents/page.tsx:541-601` · paper stat line `:631-636`
**Problem.** Study guides render as plain rows: a grey `FileText` glyph + title + mono filename, dividers only. Position-paper counts are four stacked mono spans ("12 submitted · 5 approved · 4 awaiting · 2 rejected") — a textbook "bullet-dump information" violation where a chart/ring would have punch. No focal element, no visual weight for a published vs draft guide.
**Fix.** (a) Replace the 4-span stat line with a **segmented review-progress bar** (green approved / amber pending / red rejected proportional fill) plus one bold total, or four small gold-ringed count medallions — "show, don't list". (b) Give each study-guide row a **red PDF file-type tile** (icon in a rounded square with saturated tint) instead of the meek grey glyph, and elevate the row to a bordered mini-card on hover.

### F5 · Communications stat row and Jobs stat row are flat, low-contrast, mono-captioned · P2
Comms `communications/page.tsx:471-490` · Jobs `jobs/page.tsx:802-821`
**Problem.** Both pages open with a stats strip that's the page's natural protagonist, rendered as flat cream boxes with a big number and a **mono uppercase caption**. No gradient, no icon, no accent — they read as placeholders, and the mono caption is the F2 tell again. Nothing on either page is "unmistakably primary" (rulebook principle 1 & the "big highlighted important parts" love).
**Fix.** Promote to **stat medallions/tiles with identity**: a lucide icon per stat (`Send`/`Clock`/`FileEdit` for comms; `Briefcase`/`Users`/`Layers` for jobs) in a tinted disc, the number in Outfit-900, an Outfit (not mono) caption, and a hairline gold underline or forest left-accent on the primary stat. Give the row a gradient or grain backing so it separates from the page.

### F6 · Meek/flat card language everywhere — 1px hairline borders, no depth · P2
Shared `cardStyle` `settings/page.tsx:726-732` · comms cards `communications/page.tsx:480,533,738` · documents sections `:525,608` · jobs cards `:255`
**Problem.** Every card in the slice is `1px solid #DDD4C0` on `#FAF8F3` with a flat fill and (mostly) no shadow. The rulebook LOVES "thick, confident borders (1.5–2px)" and HATES timid 1px hairlines "that blend into the bg", and asks for depth/elevation/glass. The whole slice reads one-note and cheap-flat.
**Fix.** Move the card family to **1.5px borders** with a layered warm shadow (`0 2px 8px rgba(27,56,40,.05), 0 12px 32px rgba(27,56,40,.06)`) and a hover-lift. Reserve one **elevated/gradient hero card per page** (the protagonist) so hierarchy exists. This is a shared-token change that lifts all five pages at once.

### F7 · Settings "Conference Details" is a long, icon-free, image-free mega-form · P2
`settings/page.tsx:922-1114`
**Problem.** One card holds full name, acronym, contact email, student-level toggle, format toggle, start/end dates, city, country, expected delegates, and a save button — ~190 lines of stacked labelled inputs with **not one icon** and no sectioning. Prime "big page no icons/images" territory; the eye has nothing to grab.
**Fix.** Break into labelled sub-groups with a lucide icon per group header (Identity `Landmark` · Dates `CalendarDays` · Location `MapPin` · Scale `Users`), lay the location row out beside a **flag chip** for the selected country (the slice already imports `getFlagUrl` in documents — reuse it), and turn student-level/format into the same segmented control but with tiny icons. Add air between groups.

### F8 · Empty states are bare centered sentences (Settings, Documents) · P2
Settings organizers empty `settings/page.tsx:1515` · custom-questions empty `:1447` · Documents study-guides empty `:538` · papers empty `:663`
**Problem.** "No team members yet.", "No study guides yet.", "No position papers submitted yet." — plain grey one-liners, no icon, no CTA. Rulebook: "an empty state with an icon + CTA." Communications and Jobs already do this correctly (`Mail` icon + compose CTA at `communications/page.tsx:500`; designed jobs empty at `:844`) — so the inconsistency is self-evident within the same slice.
**Fix.** Match the Comms/Jobs pattern: lucide icon (`Users`/`FileText`/`Inbox`) in a tinted disc, a one-line headline, a sub-line, and where an action exists a forest CTA ("Upload a study guide", "Invite a co-organiser").

### F9 · Delete-conference modal breaks the design language (pure fill, no border, plain text) · P3
`settings/page.tsx:1693-1725`
**Problem.** The destructive-confirm modal is `#FAF8F3` with **no border, no radius-family match, no danger iconography** — just bold text and two buttons. Every other modal in the slice (QuestionModal, PostingModal, Documents modals) has a border and consistent chrome; this one-off reads unfinished, and it's the highest-stakes action on the page.
**Fix.** Add the standard 1.5px border + warm shadow, a `AlertTriangle` in a danger-tinted disc at the top, and keep the red button — make the most dangerous action look the most deliberate.

### F10 · Permission-chip cluster in Organizers is a wrap of 8 mono grey pills · P3
`settings/page.tsx:1576-1590` (`SECTION_KEYS`)
**Problem.** Under each non-owner organiser, eight identical mono toggle-pills wrap in a grey row — meek, low-affordance, and it's not obvious they're toggles. Mono + grey + uppercase = the meek-badge + code-font double violation.
**Fix.** Render as a compact **icon grid** (one lucide glyph per section: `Users2`/`FileText`/`Grid`/`Mail`/`Wallet`/`Briefcase`/`Settings`), Outfit micro-labels, with a saturated forest fill + gold check when granted and a clear off state. Reads as a permissions matrix, not a pile of pills.

### F11 · Email composer body editor is a raw `font-mono` HTML textarea · P3
`communications/page.tsx:698` (`className="... text-sm font-mono"`)
**Problem.** The message body is edited as raw HTML in a monospace textarea with `<strong>`/`<h2>` tags inserted literally — this is a developer artifact leaking into an organiser-facing tool, and `font-mono` here is the code-font tell in its most literal form. `handleLinkInsert` uses `window.prompt` (`:218`).
**Fix.** Not strictly a visual-token fix, but flag: at minimum set the textarea to Outfit and style the toolbar buttons as proper bordered icon-buttons; ideally swap to a lightweight contentEditable WYSIWYG so organisers never see tags. Replace `window.prompt` with an inline link popover.

### F12 · Jobs `GhostBtn` uses off-palette `#DC3545` danger red · P3
`jobs/page.tsx:37-52,83,157,212` (`#DC3545`)
**Problem.** The jobs page defines danger as `#DC3545` (Bootstrap red), but the rulebook danger token is `#8B2020`, which the rest of the slice (settings, documents) uses correctly. Inconsistent one-off color = "consistency of the language" violation.
**Fix.** Replace all `#DC3545` with `#8B2020`.

---

## 3. LEAVE-ALONE LIST (already at/near the bar — don't touch)

- **Communications empty state** (`communications/page.tsx:500-519`) — icon + headline + sub + forest CTA. This is the template the other empty states should copy.
- **Communications two-column composer layout** (`:646-857`) — genuine left-editor / right-sidebar structure with audience + send-time + warning cards. Solid IA; the recipient-preview logic (`computeRecipientCount`) is a nice touch.
- **Communications status color system** (`:66-71`) — saturated, meaningful dot+text+bg tints per status. Correct badge conviction (only the mono *font* on the pill needs fixing per F2).
- **Jobs page overall** — the strongest page: lucide meta icons per row (`:286-304`), category color-coding (`:48-52`), line-clamped description (`:309`), animated skeleton loader (`:754-768`), designed empty state (`:844`), inline expandable applications panel with avatars. Only F2/F5/F6/F12 apply — structure is good.
- **Documents position-paper cards** (`:668-695`) — real rectangular flags via `getFlagUrl`, delegate name, status badge, download link. On-brand; keep the flags.
- **PillToggle component** (`settings/page.tsx:106-141`) — clean, correct forest/parchment states. Reusable and fine.
- **Lineage approve/reject flow** (`settings/page.tsx:1730-1896`) — the *interaction* and status badges are well-considered (approved green / pending amber / owner-decides grey are correctly saturated); only the mono eyebrows (F2) drag it down.

---

## SUMMARY

The slice is **structurally sound but visually undercooked**. Two systemic, high-leverage fixes would lift every page: **(F2)** purge DM Mono from tabs/labels/captions/pills back to Outfit, and **(F6)** move the shared card family to 1.5px borders + layered shadow + one elevated hero card per page. The two headline embarrassments are **Financials** (a bare stub that should be a designed teaser, F1) and **Settings** (the owner's favourite pattern — the floating drawer — reduced to a flat scrolling column, F3). Communications and Jobs already show what "good" looks like inside this same slice, which makes the weaker pages' flatness a consistency failure, not just an ambition gap.
