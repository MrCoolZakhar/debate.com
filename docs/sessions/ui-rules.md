<!-- Moved verbatim from AGENTS.md on 17 Oct 2026 (the full file is docs/history/AGENTS.md.2026-10-17.md). Long-form reference for this area: history, owner quotes, verification notes. The rules that must hold are in AGENTS.md. -->

## UI RULES

### RULE: Always use the shared DatePicker for dates
- The native `<input type="date">` (and any other old or native date picker) must **NEVER** be used anywhere in the app.
- **EVERY** date input must use the shared friendly picker `@/components/DatePicker`.
- It takes `value` (ISO `'YYYY-MM-DD'`), `onChange(iso)`, and optional `min` / `max` / `placeholder`, and matches the forest/ivory neumorphic system.

### RULE: Popovers, dropdowns and tooltips must NEVER be clipped
- Any floating layer (menu, dropdown, typeahead list, calendar, tooltip, hover card) must **NEVER** be visually cut off by an ancestor's `overflow` (a rounded `overflow:hidden` card, or a scrollable `overflow-y:auto` panel / modal) or run off the edge of the viewport.
- Render the layer through `@/components/Portal` at **fixed** viewport coordinates computed from the trigger's `getBoundingClientRect()`. Reposition it on `scroll` (capture phase) and `resize`, and close on outside click while accounting for the portaled node.
- Near the right or bottom edge, **flip**: clamp `left` so it stays on screen, and open upward when there is not enough room below.
- Reference implementation: the applications `PaymentMenu` (`src/app/manage/[slug]/applications/page.tsx`). The shared `DatePicker` and `ConferenceRosterPicker` typeaheads follow the same pattern.
- **NEVER** un-clip a popover by loosening a shared card's `overflow` — always fix it at the popover.

### RULE: Informational "i" / hint popups open on HOVER, not click
- Small informational affordances (an "i" or "?" badge, a hint icon, a "what is this" explainer) must reveal their content on **hover** (`onMouseEnter` / `onMouseLeave` with a small close delay so the pointer can travel into the panel), never on click.
- Keep them keyboard and focus accessible (reveal on focus too), and prefer a native `title` for the simplest one-line hints.
- Click-to-toggle is reserved for menus and actions — not for read-only explanations.

### RULE: Long committee names show the ACRONYM, with the full name small beneath
- When a committee's name is long (multi-word / spelled-out), display its **acronym** as the primary, larger label, and put the full spelled-out name in **smaller letters directly beneath it** as a secondary line. Example: "Disarmament and International Security Committee" renders as **DISEC** with "Disarmament and International Security Committee" small underneath.
- Use the shared `committeeDisplayName(fullName, acronym?)` helper in `src/lib/presetNames.ts` to derive the acronym (it collapses long names to an acronym). Prefer an explicit `abbreviation` when the committee has one.
- If the acronym has no meaningful expansion (or the name is already short), just show the name once — no redundant second line.
- Applies everywhere committees render: applications, assignment, committee cards, rosters, overviews.

---
