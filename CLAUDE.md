# CLAUDE.md

Guidance for Claude Code when working in this repository. This file is the **map**: what
Gavelling is, who it is for, how the money and the growth work, where things live, and what
is true today. `AGENTS.md` (imported below) is the **rulebook** for the live-session runtime;
read it before touching anything under `src/app/chair`, `delegate`, `advisor`, `voting`,
`join`, `create` or `src/lib/committeeService.ts`.

@AGENTS.md

---

## 1. What Gavelling is

Two products in one Next.js codebase, sharing one Supabase project (`luruhkwrgisytejswlas`):

| Product | Identity | Money | Who |
|---|---|---|---|
| **Sessions** | anonymous, 6-char code (+ 4-digit chair suffix) | free, forever | a chair running a committee room from a laptop; delegates following on phones |
| **Conferences** | Supabase Auth accounts | organiser pays nothing; participants pay | secretariats managing hundreds of applications, allocations, papers, payments and awards |

The two meet at the database: a conference committee mints a live session (`committees.session_origin = 'conference'`, linked by `conference_committees.session_id`), and the secretariat watches every room from `/manage/[slug]/live`, reads the cross-committee scoreboard, and turns the record into awards and verified MUN CV entries.

**The strategic position** (`CONFERENCES_PRD.md`, `docs/competitive-mymun.md`): the incumbent directory charges organisers per participant per day; Gavelling charges the organiser nothing, is merchant-of-record through the organiser's own Stripe Connect account, and monetises the participant side transparently. Sessions is the top of the funnel and must stay free, anonymous and account-free.

---

## 2. Who uses it and what they want

- **Chair (Moderator / Commenter).** One laptop is the dais. Wants zero-latency controls, a queue that never empties mid-session, timers that survive reloads, and a record they can defend when awards are questioned. Everything they do is optimistic-first (AGENTS.md rules 3 to 6).
- **Delegate.** Phone in hand. Wants to know when they speak, to request the floor, submit a paper, read the study guide, and after the conference see their award on a CV they can share. They never see chair notes, factor ratings or nominations before publication.
- **Faculty advisor / observer.** Read-only board, can nudge.
- **Organiser / secretariat.** Repetition at scale: 1,000 applications, 400 seats, 30 committees. Wants the To-Do queue, fit-scored assignment, one-click emails, a live status wall, and a closing ceremony they can run from one page. Section permissions are UI-only (`src/lib/organizerPermissions.ts`); only `team` and `financials_readonly` are DB-enforced.
- **Applicant browsing.** Discovery (`/conferences/explore`, `/conferences/map`), the job board for chairs and staff (`/conferences/roles`), public conference pages with vanity URLs, and a public MUN CV at `/cv/[id]`.

Design consequences: mobile-first on every delegate and applicant surface; the chair page is desktop-first; the organiser surfaces optimise for the 900th repetition, not the first.

---

## 3. Business model (as implemented, not as pitched)

| Mechanism | Where |
|---|---|
| **Credits**: 1 credit = 1 application (delegate, head-delegate, faculty-advisor, observer; chairs exempt). Bought via `create-credit-checkout`; refunded on rejection. Welcome credit + one-time modal on signup (`CreditsWelcomeGate`). | `src/lib/payments.ts`, `src/hooks/useCredits.ts`, `ConferenceApplyClient.tsx` |
| **Subscriptions**: Unlimited (unlimited credits, platform fee waived), Pro. Regional pricing A/B. | `src/app/account/unlimited/page.tsx`, `payments.ts` |
| **Conference fees**: Stripe Connect; 5% platform fee (`PLATFORM_FEE_RATE`) + 3% + fixed processing pass-through; every amount recomputed server-side in the `create-checkout` edge function. Manual payments with proof review exist as a fallback. | `src/lib/finance.ts`, `manage/[slug]/financials/*` |
| **Gavelling Points**: earned (welcome bonus, awards at paid conferences), stored in `profiles.points_balance` via the `points_ledger` trigger. Spending is not built. | `points_ledger`, `publish_conference_awards()` |

Hard rules: organisers are never charged; Unlimited status is server-verified; public fee display goes through the `conference_public_fees` view because `conferences.fee_amount` is a stale denormalised column (`src/lib/publicFees.ts`).

---

## 4. Growth loops (what the code is built to do)

1. **Content SEO**: 32 posts in `src/app/blog/posts.ts`, the competitor-alternative posts carry the highest sitemap priority. Bare `/join` and `/create` stay indexable; anything with a code does not (`robots.ts`).
2. **Public conference pages** as landing pages: hourly ISR sitemap, IndexNow ping on publish, dynamic OG cards (`/api/og/*`), `pageMetadata()` makes a missing OG image structurally impossible (`src/lib/seo.ts`; `npm run check:og`).
3. **The MUN CV as a credential**: every profile link resolves to `/cv/<name>-<hex>`; `ShareAchievementModal` fires after a new entry; `PublicCVSignupPrompt` converts the reader. **Awards are the first thing that writes a `gavelling_verified` entry**; before that every CV entry was self-reported, which is why the awards pipeline matters commercially.
4. **Job board** for chairs and secretariat, cross-conference.
5. **Ambassadors** (`/about` form, platform fee waived) and **delegation invite links**.
6. **Draft-recovery emails** for abandoned applications.

There is **no analytics or tracking** by policy (`/privacy`). The admin console (`/admin`, DB-gated by `is_platform_admin()`) is the only observability surface.

---

## 5. Awards (chairs decide, secretariat ratifies, conference publishes)

Model UN awards are given once per conference, at the closing ceremony. Per committee the dais names a Best Delegate, usually one or two Outstanding Delegates, a few Honourable Mentions, sometimes Verbal Commendations and a Best Position Paper. The secretariat sets categories and quotas beforehand, collects each committee's slate, ratifies it and announces. Delegation awards go to a school or society, tallied from committee honours.

Gavelling mirrors that exactly. Read `src/lib/awards.ts` (the vocabulary and config) and `src/lib/awardsService.ts` (every read and write) first.

| Step | Surface | Storage |
|---|---|---|
| Configure categories, quotas, points, deadline, ratification | Manage → Settings → **Awards** (`settings/awardsUi.tsx`); dashboard checklist item `awards` (never a publish gate) | `conferences.awards_config` (jsonb; empty = platform defaults) |
| Chair nominates, with the session scoreboard as evidence | the chair's conference page, `participant/AwardsCard.tsx` (`/conferences/[slug]/role/chair`) | `conference_awards` rows, `status = 'nominated'` |
| Chair submits / withdraws | same card → `submit_committee_awards` / `withdraw_committee_awards` | `conference_committees.awards_submitted_*` |
| Secretariat approves / returns with a note / edits / assigns delegation awards | `/manage/[slug]/awards` | `awards_approved_*`, `awards_return_note`, rows → `approved` |
| Publish (the ceremony) | same page → `publish_conference_awards()` | rows → `published`; one `gavelling_verified` `mun_cv_entries` row per recipient per conference; `points_ledger` at paid conferences; `conferences.awards_published_at` |
| Delegate sees it | `participant/MyAwardsCard.tsx`, `/account/cv`, public honour roll `/conferences/[slug]/awards` | RLS: only `published` rows are readable outside the dais and the organising team |

Rules:
- **Awards only on conference-linked sessions.** The live session signposts (`ScoreboardPanel` header, the End View card) only when `committee.sessionOrigin === 'conference'`. No award UI in anonymous sessions, ever.
- `award_type` keys are stable identifiers; labels are presentation. `DEFAULT_AWARD_TYPES` points must match `award_points_for()` in the database.
- Nothing about a nomination is visible to a delegate before `publish`. Do not add a read path that bypasses the `conference_awards` RLS.
- The chair's decision is qualitative; the scoreboard is evidence. "Suggest from the record" fills empty slots and is always editable.
- `CONFERENCES_PRD.md` rule 11 ("ratings and award badges are not in scope") is about badges on directory cards, not this feature; Part 7 of the same PRD mandates it.

---

## 6. Where things live

```
src/app/
  (sessions)   create, join, chair/[code], delegate/[code], advisor/[code], voting/[code]
  (public)     /, sessions, about, contact, blog/*, [slug] (vanity), conferences/{explore,map,roles,[slug]/*}
  (participant) conferences/[slug]/{apply,pay,role/[role],papers,awards}, delegation/[societyId], my-conferences, drafts/[token], invites/*
  (organiser)  manage/[slug]/{committees,applications,assignment,documents,communications,financials,financial-aid,settings,jobs,import,live,scoreboard,awards}
  (account)    account/{profile,cv,calendar,unlimited}, auth/*, cv/[id]
  (staff)      admin
  api/         ambassador, contact, geo, indexnow, emails/queue-participant, og/*
src/lib/
  sessions     types.ts, committeeService.ts (all session DB I/O + realtime), scoring.ts, sessionScoreboard.ts, settingsStore.ts, committeeFlags.ts, docNames.ts
  conferences  conferenceAccess.ts, conferenceScoreboard.ts, awards.ts, awardsService.ts, finance.ts, payments.ts, invoices.ts, emailEvents.ts, defaultEmails.ts, organizerPermissions.ts, publicFees.ts, seo.ts, vanity.ts
  shared       translations.ts (4 locales), countries.ts, supabase.ts (anon), supabase-auth.ts (getAuthedClient), sessionClient.ts (chair suffix header)
src/components/ neu.tsx (design tokens), DatePicker, Portal, SiteNav, ScoreboardTable, ScoreboardPanel, MotionsModal, DocumentsModal, RollCallPanel, ChatPanel, SettingsPanel, FeedbackLogPanel, TutorialOverlay, GuidedWalkthrough
```

**State, honestly:** the chair page is React state + `committeeService` + a Supabase Realtime channel, with `useSettingsStore` (zustand, `localStorage: gavelling-settings`) for per-committee settings. `src/lib/store.ts` (`useCommitteeStore`, `localStorage: mun-committees`) is legacy: its only live importer is `/join`; `SpeakersListPanel`, `CaucusPanel` and `ResolutionsPanel` import it but are themselves unreferenced. The conferences layer uses no zustand at all: React state, `useAuth()` from `AuthProvider`, `getAuthedClient(session.access_token)`, and `useManage()` from the manage layout.

**Database:** there is **no `supabase/` directory and no migrations in git**. The schema lives only in the remote project; the loose `scratch-*.sql` files at the root are drafts, not truth. Inspect with the Supabase MCP tools before assuming a column exists. RLS is the security boundary everywhere; `isViewOnly`, section permissions and hidden buttons are not.

**Email:** nothing sends inline. Every email is an `email_outbox` row (rendered by a DB trigger, delivered by the `send-emails` edge function via Resend). Add an event to `EVENT_REGISTRY` in `emailEvents.ts` and TypeScript forces a category and a default body.

---

## 7. Sessions runtime in one screen

- `Committee.speakersList` is the General Speakers List: permanent, never touched by a caucus. `caucusQueue` is temporary and wiped when the caucus ends. `currentSpeaker` is its own row and is never in either list.
- `SessionPhase`: `pre-session → roll-call → speakers-list → moderated-caucus | unmoderated-caucus → voting → adjourned`. `CaucusState` is a JSONB column on `committees`.
- Motions sort by `disruptiveness`, configurable per committee via `motionOrder`; end/suspend debate always outrank caucuses; custom motions sort last.
- Optimistic writes: `updateLocal()` first, DB write fire-and-forget. Incoming realtime echoes are ignored for **3 s** after a structural local write (`localUpdateTime`), with carve-outs for broadcasts, chat, feedback and the view-only Commenter, who never debounces.
- Timers are **clock-anchored**: persist `started_at` + duration once, every client derives the remaining time locally. There is no per-second write and there must never be one.
- `speakers_list.position` reorders happen in place (parallel `position` updates), never delete-and-reinsert, because a DELETE event flashes an empty list on delegate phones.
- Tables: `committees`, `delegates`, `speakers_list` (`list_type` gsl | caucus), `current_speaker`, `motions`, `documents`, `messages` (chat + the `__system__`/`__log__` scoring ledger), `feedback`, `session_broadcasts`.

Everything else, with line numbers and the reasons behind each rule, is in `AGENTS.md`.

---

## 8. Design system and copy

- Tokens in `src/components/neu.tsx`: ivory `#EDE7D8` page, `#F0EBDD` surface, forest `#1B3828`, gold `#EED98A`, ink `#1C1410`; shadows are forest-tinted, never neutral; `muted` fails contrast for body text, use `inkSoft`. Font is **Outfit** everywhere on the conferences side (DM Mono is being retired, `docs/ui-audit/70-typography-rule.md`). Tailwind v4 with no config file.
- Lucide icons only on the conferences side (Fluent 3D emoji are allowed on the organiser dashboard via `Emoji3D`). Rectangular flags only (`getFlagUrl`). Every button gets `focus:outline-none`.
- **No em dashes in user-facing copy.** Short sentences. Say what happened and what to do next.
- Dates: the shared `DatePicker` only. Popovers: through `Portal` at fixed coordinates, flipped near edges, never clipped. Info hints open on hover. Long committee names show the acronym with the full name beneath (`committeeDisplayName`).
- i18n: four locales in `src/lib/translations.ts` (en, es, fr, ar with RTL). The DB stores English; translate at render. Rules and the list of hand-maintained bypasses are in `.claude/TRANSLATIONS.md`, which must be updated when keys change. Manage surfaces are English-only by convention.
- Polish reference: `.claude/skills/make-interfaces-feel-better/SKILL.md` (the only UI skill installed in this repo).

---

## 9. Commands, checks and environment

```bash
npm run dev          # localhost:3000
npm run build        # runs `prebuild` first: scripts/check-brand-marks.mjs fails the build on brand-mark violations
npm run lint
npm run check:og     # validates pageMetadata / OG rules against a running production server
```

No unit or end-to-end test suite and no CI. The build, the brand-mark gate and `check:og` are the quality gates; verify behaviour in the browser.

`.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Payments, email and account deletion run in Supabase edge functions with their own secrets; nothing in this repo deploys them.

Largest files (all conferences-side except the chair page): `manage/[slug]/applications/page.tsx` 5.8k, `settings/page.tsx` 5.7k, `communications/page.tsx` 5.1k, `ConferenceApplyClient.tsx` 4.8k, `assignment/page.tsx` 4.7k, `chair/[code]/page.tsx` 4.1k, `translations.ts` 4.0k. Keep diffs in these small and self-contained; put new features in new files and mount them.

---

## 10. How work happens here

- **Branches.** All work lands on `feature/conferences-auth`. Production deploys from `claude/muncommand-recreation-9yjin` and is only touched when Peter says "push to production". Commit and push after every change (`git add -A` → `git pull --rebase` → `npm run build` → push).
- **Two workstreams, one branch.** Christian Galindo owns the conferences layer and pushes to the same branch. Before editing a shared file, check `git log --author=Christian -- <file>`. Never restructure conference code as a side effect of a sessions change. The database is the real shared surface: check the live schema and his recent migrations before applying one.
- **Agents.** Investigation, implementation and verification are delegated to subagents; independent agents run in parallel; agents touching the same file are serialised; every implementation is followed by a verification agent.
- **Fix what was asked, then name what the same evidence implies**, especially when the better lever sits upstream (creation flow over checklist, email over threshold, data model over UI).
- **Docs to keep truthful:** `AGENTS.md` (sessions rules), `EXPERIENCE.md` (how a committee actually runs, with the findings register), `CONFERENCES_PRD.md` + `CONFERENCES_EXPERIENCE.md` (the conferences spec and its verified gaps), `.claude/TRANSLATIONS.md`, `docs/competitive-mymun.md`. When code changes make one of them wrong, fix the doc in the same commit.
