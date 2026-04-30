# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start development server at localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
```

No test suite is configured.

## Environment

Requires a `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Architecture

Gavelling is a real-time Model UN committee management tool. Chairs run sessions; delegates join via a 6-character session code.

### Routes

| Path | Role |
|------|------|
| `/` | Landing page — start or join a committee |
| `/create` | Chair creates a committee (name, topic, delegates, settings) |
| `/chair/[code]` | Full chair dashboard (main operational view) |
| `/delegate/[code]` | Delegate view — speakers list, documents, chat |
| `/advisor/[code]` | Observer/advisor view |
| `/voting/[code]` | Standalone voting screen |
| `/join` | Code entry redirect |

### State: two stores, one service

**`src/lib/store.ts` (`useCommitteeStore`)** — Zustand store with `persist` middleware (`localStorage` key: `mun-committees`). Holds all committee state locally. Used only in the delegate/advisor views (which fall back to local state).

**`src/lib/settingsStore.ts` (`useSettingsStore`)** — Zustand store with `persist` (`localStorage` key: `gavelling-settings`). Stores per-committee `CommitteeSettings` keyed by committee code. Governs voting thresholds, quorum, allowed motion types, access controls.

**`src/lib/committeeService.ts`** — All Supabase operations. The chair page (`/chair/[code]`) exclusively calls this service and does **not** use the Zustand store. It writes directly to the DB and receives real-time updates via `subscribeToCommittee`, which opens a Supabase Realtime channel on the committee's tables.

### Data model highlights (`src/lib/types.ts`)

- `Committee.speakersList` — the **General Speakers List (GSL)**. Never touched by caucuses.
- `Committee.caucusQueue` — the per-caucus speaker queue. Wiped when a caucus ends.
- `SessionPhase`: `pre-session → roll-call → speakers-list → moderated-caucus | unmoderated-caucus → voting → adjourned`
- `PendingMotion.disruptiveness` — computed priority score: consultation > tour-de-table > unmoderated > moderated. Motions are displayed sorted descending by this value.
- `CaucusState` is stored as a JSONB column in the `committees` table, not a separate table.

### Supabase tables

`committees`, `delegates`, `speakers_list` (has `list_type`: `'gsl'` | `'caucus'`), `current_speaker`, `motions`, `documents`, `messages`, `feedback`

### Panel components (`src/components/`)

Each panel (`SpeakersListPanel`, `CaucusPanel`, `MotionsPanel`, `ResolutionsPanel`, `RollCallPanel`, `ChatPanel`, `SettingsPanel`) is rendered by the chair page and receives the `committee` object plus callback props that call `committeeService` functions. They do not call Supabase directly.

### Key design decisions

- The chair page uses a **local-optimistic update** pattern: `updateLocal()` applies changes immediately to React state while the async DB write proceeds in parallel. Incoming Supabase Realtime events are debounced (ignored for ~500 ms after a local write) to prevent the remote echo from overwriting optimistic state.
- Timer ticks (speaker countdown, caucus countdown) are handled client-side with `setInterval` in the chair page, writing to `current_speaker.time_remaining` each second.
- The `speakers_list` table uses a `position` integer for ordering. Reorder operations delete and re-insert the full list.

## UI Skills
@.claude/skills/ui-ux-pro-max/SKILL.md
@.claude/skills/awesome-design/SKILL.md
@.claude/skills/impeccable/SKILL.md
