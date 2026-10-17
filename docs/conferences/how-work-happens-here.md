<!-- Moved verbatim from CLAUDE.md on 17 Oct 2026 (the full file is docs/history/CLAUDE.md.2026-10-17.md). Long-form reference for this area: history, owner quotes, verification notes. The rules that must hold are in CLAUDE.md. -->

## 10. How work happens here

- **Branches.** All work lands on `feature/conferences-auth`. Production deploys from `claude/muncommand-recreation-9yjin` and is only touched when Peter says "push to production". Commit and push after every change (`git add -A` → `git pull --rebase` → `npm run build` → push).
- **Two workstreams, one branch.** Christian Galindo owns the conferences layer and pushes to the same branch. Before editing a shared file, check `git log --author=Christian -- <file>`. Never restructure conference code as a side effect of a sessions change. The database is the real shared surface: check the live schema and his recent migrations before applying one.
- **Agents.** Investigation, implementation and verification are delegated to subagents; independent agents run in parallel; agents touching the same file are serialised; every implementation is followed by a verification agent.
- **Fix what was asked, then name what the same evidence implies**, especially when the better lever sits upstream (creation flow over checklist, email over threshold, data model over UI).
- **Docs to keep truthful:** `AGENTS.md` (sessions rules), `EXPERIENCE.md` (how a committee actually runs, with the findings register), `CONFERENCES_PRD.md` + `CONFERENCES_EXPERIENCE.md` (the conferences spec and its verified gaps), `.claude/TRANSLATIONS.md`, `docs/competitive-mymun.md`. When code changes make one of them wrong, fix the doc in the same commit.
