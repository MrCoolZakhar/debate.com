<!-- Moved verbatim from AGENTS.md on 17 Oct 2026 (the full file is docs/history/AGENTS.md.2026-10-17.md). Long-form reference for this area: history, owner quotes, verification notes. The rules that must hold are in AGENTS.md. -->

## FEATURE: AWARDS (conference-linked sessions only)

### CURRENT STATE: SET-UP, REVIEW AND PUBLISH LIVE (12 Oct 2026)
- Settings → Awards is `settings/awardsUi.tsx` (`AwardsSettings`): blank slate → "Will
  every committee give the same awards?" → the editor (Placements, Other awards,
  Custom awards; shared set or per-committee sets). Full description in CLAUDE.md §5.
  `awardsComingSoon.tsx` was deleted.
- `conferences.awards_config` gained `setUp`, `sameForAll` and `perCommittee`
  (`{ [conference_committee_id]: { types } }`, replacing the shared `types` for that
  committee). `getAwardsConfig` reports `enabled` only when `setUp === true`: `{}`
  and every config saved before 11 Oct 2026 read as NOT set up.
- **The chair gate is `awardsOfferedFor(config, conferenceCommitteeId)`** and nothing
  else: the chair's `AwardsCard`, and in a session `useChairAwards` /
  `resolveChairAwards` (`src/lib/sessionAwardsLink.ts`) for the ScoreboardPanel link,
  the End View card, the top-bar CTA and the session Settings → Awards tab. A failed
  lookup is "not offered". Read per committee with `configForCommittee`. Never add an
  award affordance for chairs that does not pass this gate. Published awards are
  read by status and never gated.
- **Review and publish** is `settings/awardsReview.tsx` (`AwardsReview` data,
  `AwardsReviewView` pure view), the right column of `AwardsSettings` (13 Oct 2026, each
  committee's slate in a pop-up) and only
  once awards are set up: per committee slate state (own `reviewState`, so a late
  slate is not shown as Published), Approve (`approveSlate`), Return with a required
  note (`returnSlate`), and one Publish for the conference (`publishAwards`, behind a
  `ConfirmModal`; approved rows only while `requireApproval`, idempotent, so
  "Publish new awards" republishes late additions). It sends no email. Details in
  CLAUDE.md §5.
- `/manage/[slug]/awards` still redirects to Settings; `AwardsConsole.tsx` stays
  unrendered (and does not read `perCommittee` yet). The database is unchanged;
  `scratch-awards-setup.sql` is an unapplied draft that enforces the gate in RLS.
- The `awards` set-up priority stays out of the dashboard checklist,
  `conference_setup_status()` and `SETUP_STEPS` (since 7 Sep 2026).

Everything below still describes the feature as built and is still true of the code
and the database. Read it before touching anything awards-related.

### The shape
- Awards are a CONFERENCE feature. The live session only signposts them. The gate is
  `committee.sessionOrigin === 'conference'` (surfaced by `rowToCommittee`); an anonymous
  standalone session must never render an award affordance (PRD rule 8).
- Vocabulary, config reader, slate lifecycle and scoreboard suggestions: `src/lib/awards.ts`.
  Every read/write: `src/lib/awardsService.ts`. Nothing else may touch `conference_awards`.
- Lifecycle: `nominated` (chair) → `approved` (secretariat, `approve_committee_awards`) →
  `published` (conference, `publish_conference_awards`). Per-committee stamps live on
  `conference_committees.awards_submitted_at / awards_approved_at / awards_return_note`;
  the ceremony moment is `conferences.awards_published_at`. Categories, quotas, points,
  deadline and `requireApproval` are `conferences.awards_config` (jsonb; `{}` = defaults).
- Publishing mints ONE `mun_cv_entries` row per recipient per conference with
  `source = 'gavelling_verified'` (upgrading a self-reported entry for the same conference in
  place; checked 12 Oct 2026: it no longer writes `points_ledger`, its `points_rows` is
  always 0). It is
  idempotent: already-published rows are never touched, so late additions republish safely.

### Surfaces
- Chair: `conferences/[slug]/participant/AwardsCard.tsx` on their conference page, with the
  session scoreboard (`loadConferenceScoreboard(..., [committeeId])`) beside the slots.
- Secretariat: Settings → Awards (`settings/awardsUi.tsx` set-up, `settings/awardsReview.tsx`
  review, return with note, publish). The old desk `manage/[slug]/awards/AwardsConsole.tsx`
  (edit, delegation standings, certificates CSV) is unrendered, see CURRENT STATE above.
- Delegate: `participant/MyAwardsCard.tsx`, `/account/cv`, public `/conferences/[slug]/awards`.
- Session: `ScoreboardPanel` header link and the End View card on the chair page, both
  resolved through `resolveChairAwardsHref(code)` and both conference-only.

### Rules
- **Nominations are secret until publish.** RLS on `conference_awards` exposes unpublished
  rows only to the committee's chairs and the organising team. Never add a read path around it.
- `award_type` keys are stable identifiers. Renaming a built-in changes `label`, never `key`.
  `DEFAULT_AWARD_TYPES[].points` must match `award_points_for()` in the database.
- The chair's decision is qualitative. `suggestSlate` fills EMPTY slots from the blended
  headline score and is always editable; it must never be applied without the chair seeing it.
- `committee_awards_locked()` (approved or published) is what stops chair writes. The UI
  mirrors it with `chairCanEdit(slateState(...))`; treat the DB as the truth.

---
