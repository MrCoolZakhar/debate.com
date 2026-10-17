<!-- Moved verbatim from AGENTS.md on 17 Oct 2026 (the full file is docs/history/AGENTS.md.2026-10-17.md). Long-form reference for this area: history, owner quotes, verification notes. The rules that must hold are in AGENTS.md. -->

## FEATURE: FACULTY ADVISOR VIEW

- **The single-room view `/advisor/[code]` was removed on 24 Sep 2026** (owner: "completely remove the 'room view' for faculty advisors"). `src/app/advisor/[code]/page.tsx` is a server component that redirects to `/advisor?add=<CODE>`, so old links, emails and bookmarks open the board's add flow for that room. The nudge feature (emoji nudges to a delegate through chat) went with it, and so did its translation keys.
- Faculty advisors use the board `/advisor` (CLAUDE.md §5e): read only, nothing there writes to a session. Two views, remembered per device (`BoardPrefs.view`, `gavelling-advisor-board-prefs-v1`): **Up next** (default), one speakers list across every followed student in every room ordered by `queueRank` (speaking, next, N ahead, in the room, absent, not in session), and **By committee**, the same rows grouped per room. Nothing on the board links out to a room.
- The join page's advisor path goes to `/advisor` when `useMyAdvisorDelegation` already puts that room on the board, else to `/advisor?add=CODE`.

---
