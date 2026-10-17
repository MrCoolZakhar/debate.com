<!-- Moved verbatim from CLAUDE.md on 17 Oct 2026 (the full file is docs/history/CLAUDE.md.2026-10-17.md). Long-form reference for this area: history, owner quotes, verification notes. The rules that must hold are in CLAUDE.md. -->

## 2. Who uses it and what they want

- **Chair (Moderator / Commenter).** One laptop is the dais. Wants zero-latency controls, a queue that never empties mid-session, timers that survive reloads, and a record they can defend when awards are questioned. Everything they do is optimistic-first (AGENTS.md rules 3 to 6).
- **Delegate.** Phone in hand. Wants to know when they speak, to request the floor, submit a paper, read the study guide, and after the conference see their award on a CV they can share. They never see chair notes, factor ratings or nominations before publication.
- **Faculty advisor / observer.** Read-only board at `/advisor` (the single-room view and its nudges were removed 24 Sep 2026).
- **Organiser / secretariat.** Repetition at scale: 1,000 applications, 400 seats, 30 committees. Wants the To-Do queue, fit-scored assignment, one-click emails, a live status wall, and a closing ceremony they can run from one page. Section permissions are UI-only (`src/lib/organizerPermissions.ts`); only `team` and `financials_readonly` are DB-enforced.
- **Applicant browsing.** Discovery (`/conferences/explore`, `/conferences/map`), the job board for chairs and staff (`/conferences/roles`), public conference pages with vanity URLs, and a public MUN CV at `/cv/[id]`.

Design consequences: mobile-first on every delegate and applicant surface; the chair page is desktop-first; the organiser surfaces optimise for the 900th repetition, not the first.

---
