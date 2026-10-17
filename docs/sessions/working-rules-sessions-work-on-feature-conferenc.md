<!-- Moved verbatim from AGENTS.md on 17 Oct 2026 (the full file is docs/history/AGENTS.md.2026-10-17.md). Long-form reference for this area: history, owner quotes, verification notes. The rules that must hold are in AGENTS.md. -->

## WORKING RULES — SESSIONS WORK ON `feature/conferences-auth`

### RULE: Never push to production without explicit instruction
- All sessions work happens on **`feature/conferences-auth`**.
- The production deploy branch is `claude/muncommand-recreation-9yjin` (auto-deploys to gavelling.com via Vercel).
- **NEVER** merge into or push to the deploy branch unless Peter explicitly says "push to production" / "deploy this".
- Committing and pushing to `feature/conferences-auth` is fine and expected — that branch does not deploy.

### RULE: Always cross-check against Christian's work
- Christian Galindo (`chrisgalindoh`) owns the conferences layer that shares this branch.
- Before changing any shared surface, check `git log --author=Christian` and `git log -p <file>` for his recent commits on that file.
- Never revert, restructure, or "clean up" conference-side code (`/manage`, `/conferences`, applications, assignment, financials, auth) as a side effect of a sessions change.
- The shared surface between the two workstreams is **the database**. Schema changes must be checked against his migrations before being applied.

### RULE: Always launch agents for tasks
- Every task — investigation, audit, implementation, verification — is delegated to a subagent via the Agent tool.
- Run independent agents in parallel in a single message.
- Implementation agents that touch the same file must be serialized, not parallelized.
- Every implementation is followed by a **verification agent** that independently confirms the change works.
