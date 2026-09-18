// ============================================================
// src/lib/sessionScoreboard.ts
//
// The chair's LIVE session, folded into the same `ScoreboardDelegateRow[]` the
// organiser dashboard renders — so `src/components/ScoreboardTable.tsx` is the
// one and only delegate performance table in the app.
//
// It is the sibling of `conferenceScoreboard.ts`, and the two differ in exactly
// one respect: WHERE the data comes from.
//
//   • `loadConferenceScoreboard` has to READ every committee of a conference out
//     of Supabase and reassemble the `Committee` shape before it can score it.
//   • this module already HAS the committee — the chair page holds the whole
//     live object in memory — so it does no I/O at all and is a pure function.
//
// Neither module re-implements any scoring maths. Every number below comes out
// of `src/lib/scoring.ts` (`computeLedger`, `computeObjectiveScore`,
// `computeQualityScore`, `computeHeadline`, `getScoringConfig`) or out of
// `conferenceScoreboard`'s own `buildActivityRow` / `foldFactors`, which are the
// folds the conference side already uses. If a total ever needs changing, it
// changes in scoring.ts and both surfaces move together.
// ============================================================

import type { Committee } from './types';
import { factorName, sourceName } from './scoringNames';
import {
  buildActivityRow,
  foldFactors,
  type ScoreboardComment,
  type ScoreboardDelegateRow,
} from './conferenceScoreboard';
import {
  computeLedger,
  computeQualityScore,
  computeHeadline,
  getScoringConfig,
} from './scoring';
import type { FeedbackEntry } from './committeeService';

/**
 * One row per delegation in the live committee, newest chair note first.
 *
 * The identity fields are the session's own: a standalone committee has no
 * `conference_committees` row, so `committeeId` carries the session id and
 * `committeeAbbrev` is null. The chair's table renders with
 * `showCommitteeColumn={false}`, so neither is displayed — they exist so the row
 * type stays honest and a row from here can be handed to any consumer of
 * `ScoreboardDelegateRow` unchanged.
 *
 * `feedback` is the committee's `feedback` rows as `getFeedbackForCommittee`
 * returns them; pass `[]` before the first fetch resolves and the board still
 * renders, minus ratings and notes.
 */
export function buildSessionScoreboardRows(
  committee: Committee,
  feedback: FeedbackEntry[],
  // Session-only. The organiser board builds its rows through
  // `loadConferenceScoreboard` and stays English, which is correct for that surface.
  language: string = 'en',
): ScoreboardDelegateRow[] {
  const cfg = getScoringConfig(committee);

  // Built-in factor and source names are English strings seeded into the committee's
  // settings, so without this a Spanish committee read "Diplomacy" and "GSL speech"
  // amid otherwise-Spanish UI. A chair's genuine rename still wins in every locale.
  const localizedFactors = cfg.factors.map((f) => ({ ...f, name: factorName(f, language) }));
  const sourceLabel = (id: string, fallback: string) =>
    sourceName({ id, name: cfg.sources.find((x) => x.id === id)?.name ?? fallback }, language);

  return committee.delegates.map((d) => {
    const activity = buildActivityRow(committee, d.country);
    const quality = computeQualityScore(feedback, d.country, cfg);

    // WHO WROTE THIS. Two chairs can now write on the same speech, so a note
    // without an author is unattributable — `chairName` rides through to the
    // shared `DelegateDetail`, which prints it under every comment.
    const comments: ScoreboardComment[] = feedback
      .filter((f) => f.country === d.country)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .map((f) => ({
        id: f.id,
        chairName: f.chairName,
        content: f.content,
        level: f.level,
        factorScores: f.factorScores,
        speechContext: f.speechContext,
        speechSeconds: f.speechSeconds,
        // WHAT it was about and WHEN it was said. Without these a note carried
        // only a three-value context enum and the time the chair typed, so every
        // note in a long session collapsed onto the same line of metadata.
        speechTopic: f.speechTopic,
        spokenAt: f.spokenAt,
        createdAt: f.createdAt,
      }));

    return {
      key: `${committee.id}|${d.country}`,
      committeeId: committee.id,
      committeeName: committee.name,
      committeeAbbrev: null,
      sessionCode: committee.code,
      country: d.country,
      status: d.status,
      isObserver: d.isObserver ?? false,

      // Blend in POINTS, never index-against-points. `computeHeadline` takes the
      // whole config so the blend and the unit scale can never come from different
      // places. `conferenceScoreboard.ts` calls it identically; the two must not
      // drift.
      headline: computeHeadline(activity.total, quality, cfg),
      objective: activity.total,
      quality,

      gslSpeeches: activity.gsl,
      caucusSpeeches: activity.caucus,
      speakingSeconds: activity.seconds,
      motions: activity.motions,
      rightsOfReply: activity.rtr,
      workingPapers: activity.wp,
      draftResolutions: activity.dr,
      manual: activity.manual,

      ledger: computeLedger(committee, d.country).map((r) => ({ ...r, label: sourceLabel(r.sourceId, r.label) })),
      comments,
      // Ratings already recorded ALWAYS display. `ScoringConfig.factorRatingsEnabled`
      // gates the chair's rating input in the feedback bar; it must never hide
      // a rating a chair has already given, or turning the setting off would
      // silently erase the record from the board.
      factors: foldFactors(feedback, d.country, localizedFactors, cfg.factorScaleMax),
    };
  });
}

/** One slice of a delegation's objective points, for the profile's stacked bar. */
export interface PointSlice {
  sourceId: string;
  label: string;
  pts: number;
}

/**
 * A delegation's objective points folded BY SOURCE, largest first — the numbers
 * behind the chair's one stacked bar.
 *
 * The same fold as `computeSourceTotals` (scoring.ts), done on the row's ledger
 * the builder above already produced rather than by re-reading the log: the time
 * bonus inside a speech row is banked against `speakingTimePer10s`, so "speeches"
 * and "speaking time" are two slices, and the slices still sum to `row.objective`.
 * Every manual award and deduction is ONE slice (`manual`) under `manualLabel`,
 * because a ledger row's own label for those is the chair's free-text reason.
 * Zero slices are dropped. Pure; no scoring maths of its own.
 */
export function sessionPointSlices(
  committee: Committee,
  ledger: ScoreboardDelegateRow['ledger'],
  language: string,
  manualLabel: string,
): PointSlice[] {
  const cfg = getScoringConfig(committee);
  const totals = new Map<string, number>();
  const labelFor = new Map<string, string>();
  for (const r of ledger) {
    const timePts = r.timePts ?? 0;
    totals.set(r.sourceId, (totals.get(r.sourceId) ?? 0) + (r.pts - timePts));
    if (!labelFor.has(r.sourceId)) labelFor.set(r.sourceId, r.label);
    if (timePts) totals.set('speakingTimePer10s', (totals.get('speakingTimePer10s') ?? 0) + timePts);
  }
  const label = (id: string): string => {
    if (id === 'manual') return manualLabel;
    const src = cfg.sources.find((s) => s.id === id);
    return src ? sourceName(src, language) : (labelFor.get(id) ?? id);
  };
  return [...totals.entries()]
    .filter(([, pts]) => pts !== 0)
    .map(([sourceId, pts]) => ({ sourceId, label: label(sourceId), pts }))
    .sort((a, b) => b.pts - a.pts);
}
