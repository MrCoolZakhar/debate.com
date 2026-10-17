<!-- Moved verbatim from AGENTS.md on 17 Oct 2026 (the full file is docs/history/AGENTS.md.2026-10-17.md). Long-form reference for this area: history, owner quotes, verification notes. The rules that must hold are in AGENTS.md. -->

## DATABASE TABLES (DO NOT MODIFY SCHEMA WITHOUT EXPLICIT INSTRUCTION)

| Table | Purpose |
|-------|---------|
| `committees` | One row per session. Stores phase, caucus (JSONB), settings (JSONB), suspended_at, ended_at, expires_at, resuming_chair, session_origin |
| `delegates` | One row per delegate. Status: absent / present / present-voting |
| `speakers_list` | GSL queue (list_type='gsl') AND caucus queue (list_type='caucus'). NEVER mix these |
| `current_speaker` | Single row per committee. Stores who is speaking RIGHT NOW + time_remaining + started_at |
| `motions` | Pending motions including join-request and gsl-request pseudo-types |
| `documents` | Working papers and draft resolutions |
| `messages` | Chat messages + system speaking logs (sender='__system__') |
| `feedback` | Delegate feedback |

---
