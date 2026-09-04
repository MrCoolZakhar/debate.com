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
): ScoreboardDelegateRow[] {
  const cfg = getScoringConfig(committee);

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

      headline: computeHeadline(activity.total, quality, cfg.scoreBlend),
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

      ledger: computeLedger(committee, d.country),
      comments,
      // Ratings already recorded ALWAYS display. `ScoringConfig.factorRatingsEnabled`
      // gates the chair's rating input in the feedback bar; it must never hide
      // a rating a chair has already given, or turning the setting off would
      // silently erase the record from the board.
      factors: foldFactors(feedback, d.country, cfg.factors, cfg.factorScaleMax),
    };
  });
}
