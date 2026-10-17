<!-- Moved verbatim from AGENTS.md on 17 Oct 2026 (the full file is docs/history/AGENTS.md.2026-10-17.md). Long-form reference for this area: history, owner quotes, verification notes. The rules that must hold are in AGENTS.md. -->

## THINGS THAT MUST NEVER HAPPEN

1. **Never wipe speakersList when entering a caucus**
2. **Never put GSL delegates into caucusQueue or vice versa**
3. **Never call setCommittee or updateLocal from inside the timer interval**
4. **Never set localUpdateTime from timer tick operations**
5. **Never call clearCurrentSpeaker when entering a caucus** (races with nextSpeakerInDB)
6. **Never use committee.chairNames[0] as senderName for chat** — always use myChairName from URL param
7. **Never remove a delegate from GSL when their status changes to absent during pre-session (roll call)**
8. **Never pass currentSpeaker to caucus RollCallPanel** — caucusRollCallCommittee sets it to null
9. **Never await DB writes for UI updates** — always fire-and-forget, optimistic first
10. **Never call removePendingMotionInDB with a temp ID** — wait for real UUID via pendingIds tracking
11. **Never use a native `<input type="date">` (or any other old/native date picker)** — see UI RULES
12. **Never write the settings store back to the DB as a whole blob** — send only the changed keys through `patchCommitteeSettings` / `saveCommitteeSettings` (see FEATURE: SETTINGS, WRITE side). Posting `{ ...getSettings(code), [key]: value }` is what used to revert another chair's settings and, with a hydrated `headChair`, the gavel itself. `NON_HYDRATED_SETTING_KEYS` (`chairJoinSuffix`, `separateChairCode`, `headChair`, `headChairDevice`, `agendaTopicIndex`, `votingReturnPhase`) never enter the store and each has its own writer.
13. **Never regenerate `chairJoinSuffix` when the DB already has one** — it is the ONLY write credential (`x-chair-suffix` → `is_session_chair`) and the code every chair typed on the join page. Overwriting it locks every chair out of a live committee. `SettingsPanel.tsx:415-425` generates one only when the store copy is `''`; keep that guard.
14. **Never read a setting via `getSettings(code)` on the delegate or advisor pages** — neither page ever hydrates the store, so it silently returns `DEFAULT_SETTINGS`. Use `getCommitteeFlags` / `sponsorLabel` / `getScoringConfig` / `docName`, which are pure functions of the committee row.
15. **Never treat `isViewOnly` as a permission** — it is a UI gate only. RLS grants full write access to anyone holding the chair suffix.
16. **Never render award UI in a standalone session, and never expose an unpublished nomination to a delegate** — awards are gated on `sessionOrigin === 'conference'` and on the `conference_awards` RLS. See FEATURE: AWARDS.

---
