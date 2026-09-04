'use client';

// ─────────────────────────────────────────────────────────────────────────────
// The chair's scoreboard — the trophy button on /chair/[code].
//
// It used to carry its OWN ranking list and its own drill-in: a second, plainer
// implementation of the delegate performance table the organiser dashboard
// already had, drifting from it in both look and arithmetic. It now renders the
// SHARED `ScoreboardTable` / `DelegateDetail` (`@/components/ScoreboardTable`),
// fed by `buildSessionScoreboardRows` — the in-memory sibling of the conference
// side's `loadConferenceScoreboard`. Chairs and secretariat now look at the same
// object, and it can only ever be improved in one place.
//
// THREE THINGS ARE SESSION-ONLY and have no organiser equivalent, so they stay
// here rather than moving into the shared table:
//   • the forest header bar with Export CSV and ✕;
//   • the MANUAL award / deduct control — only a chair awards points, so it is
//     passed into the shared drill-in through its `detailExtra` slot;
//   • the Matrix tab, the chair's wide numeric grid.
//
// THREE NUMBERS THAT USED TO DISAGREE, and now do not:
//   1. the ranking list showed the BLENDED headline while the drill-in header
//      showed `drillTotal`, the raw objective ledger sum. Whenever
//      `scoreBlend > 0` those are different numbers with no label between them.
//      The drill-in header is gone; the shared detail's summary strip prints the
//      objective explicitly, labelled OBJECTIVE PTS whenever it differs from the
//      score badge, with the blend spelled out in its tooltip.
//   2. the Matrix's "Total" column was objective-only and silently disagreed
//      with the Ranking tab's badge for the same delegation. It is now labelled
//      "Points" (objective) and sits beside an explicit "Score" column carrying
//      the same headline the Ranking tab shows.
//   3. the CSV exported only the objective total. It now carries both.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import Portal from '@/components/Portal';
import { FlagImg } from '@/components/FlagImg';
import { NEU, NeuPill, OUTFIT } from '@/components/neu';
import { SOFT, RED, CARD_BORDER_COLOR } from '@/components/scoreboardTokens';
import {
  ScoreboardTable, Stat, SORTS, sortScoreboardRows,
  type SortKey, type ScoreboardLabels,
} from '@/components/ScoreboardTable';
import { Committee } from '@/lib/types';
import { getCountryByName, getCountryDisplayName } from '@/lib/countries';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { buildSessionScoreboardRows } from '@/lib/sessionScoreboard';
import {
  formatSpeakingTime, type ScoreboardDelegateRow,
} from '@/lib/conferenceScoreboard';
import type { LedgerRow } from '@/lib/scoring';
import { logEvent, getFeedbackForCommittee, type FeedbackEntry } from '@/lib/committeeService';

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function ScoreboardPanel({ committee, onClose, feedbackVersion = 0, isViewOnly = false }: {
  committee: Committee; onClose: () => void; feedbackVersion?: number;
  /** A Commenter reads the board; only the Moderator awards and deducts points. */
  isViewOnly?: boolean;
}) {
  const { language } = useLanguage();
  const t = useT();
  const [tab, setTab] = useState<'ranking' | 'matrix'>('ranking');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [awardAmt, setAwardAmt] = useState('');
  const [awardNote, setAwardNote] = useState('');
  const [deduct, setDeduct] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);

  // Re-reads on every realtime `feedback` event, so notes and ratings written by another
  // chair appear while the scoreboard is open. This was mount-only, which meant the board
  // silently went stale the moment a second chair wrote anything.
  useEffect(() => {
    getFeedbackForCommittee(committee.id).then(setFeedback);
  }, [committee.id, feedbackVersion]);

  // A half-typed award belongs to the delegation it was typed under. Collapsing
  // one row and opening another must not carry the amount and reason across —
  // reset in the event handler, not in an effect on `expanded`, which would be a
  // cascading render (and is what the lint rule is there to catch).
  const handleExpand = (key: string | null) => {
    setExpanded(key);
    setAwardAmt(''); setAwardNote(''); setDeduct(false);
  };

  // The shared table deliberately does NOT call `useT()` — its other callers are
  // the English-only organiser dashboard, which would otherwise start rendering
  // Spanish column headers. The translated session hands it its strings instead.
  const labels: ScoreboardLabels = useMemo(() => ({
    colRank: t('sb_col_rank'),
    colDelegation: t('sb_col_delegation'),
    colCommittee: t('sb_col_committee'),
    colSpeeches: t('sb_col_speeches'),
    colTime: t('sb_col_time'),
    colNotes: t('sb_col_notes'),
    colScore: t('sb_col_score'),
    sectionThisSession: t('sb_section_this_session'),
    sectionPointsBreakdown: t('sb_section_points_breakdown'),
    sectionChairRatings: t('sb_section_chair_ratings'),
    sectionChairComments: t('sb_section_chair_comments'),
    statSpeeches: t('sb_stat_speeches'),
    statSpeakingTime: t('sb_stat_speaking_time'),
    statMotions: t('sb_stat_motions'),
    statRightsOfReply: t('sb_stat_rights_of_reply'),
    statWpDr: t('sb_stat_wp_dr'),
    statChairNotes: t('sb_stat_chair_notes'),
    statPoints: t('sb_stat_points'),
    statObjectivePts: t('sb_stat_objective_pts'),
    titleSpeechesSplit: t('sb_title_speeches_split'),
    titleMotions: t('sb_title_motions'),
    titleWpDr: t('sb_title_wp_dr'),
    titleLedgerBlended: t('sb_title_ledger_blended'),
    titleLedger: t('sb_title_ledger'),
    titleRowSpeeches: t('sb_title_row_speeches'),
    titleScoreBlended: t('sb_title_score_blended'),
    titleScore: t('sb_title_score'),
    titleFactorAvgOne: t('sb_title_factor_avg_one'),
    titleFactorAvgMany: t('sb_title_factor_avg_many'),
    emptyNoScored: t('sb_empty_no_scored'),
    emptyNoRatings: t('sb_empty_no_ratings'),
    emptyNoComments: t('sb_empty_no_comments'),
    observer: t('sb_observer'),
    absent: t('sb_absent'),
    speechOne: t('sb_speech_one'),
    speechMany: t('sb_speech_many'),
    commentSpeechSeconds: t('sb_comment_speech_seconds'),
  }), [t]);

  // `SORTS` is exported with English labels because the organiser scoreboard
  // renders it verbatim. Same reasoning as `labels`: translate at this caller.
  const sortLabel: Record<SortKey, string> = {
    score: t('sb_col_score'),
    speeches: t('sb_col_speeches'),
    time: t('sb_stat_speaking_time'),
    comments: t('sb_sort_comments'),
    name: t('sb_col_delegation'),
  };

  const allRows = useMemo(
    () => buildSessionScoreboardRows(committee, feedback, language),
    [committee, feedback, language],
  );
  const rows = useMemo(
    () => sortScoreboardRows(allRows, sortKey, language),
    [allRows, sortKey, language],
  );

  const totals = useMemo(() => ({
    delegations: allRows.length,
    speeches: allRows.reduce((s, r) => s + r.gslSpeeches + r.caucusSpeeches, 0),
    seconds: allRows.reduce((s, r) => s + r.speakingSeconds, 0),
    comments: allRows.reduce((s, r) => s + r.comments.filter((c) => c.content.trim()).length, 0),
  }), [allRows]);

  const submitManual = (country: string) => {
    const amt = parseInt(awardAmt);
    if (!awardAmt || isNaN(amt) || amt <= 0 || !awardNote.trim()) return;
    logEvent(committee.id, {
      country,
      type: deduct ? 'manual-deduct' : 'manual-award',
      value: amt, note: awardNote.trim(),
    }, committee.code, committee.dbChairJoinSuffix ?? undefined);
    setAwardAmt(''); setAwardNote('');
  };

  const exportCsv = () => {
    // Every chair note written on a specific speech, matched the way the ledger
    // matches: country + speaking context + seconds. Two chairs may now write on
    // the SAME speech (commit 4755225), so this joins them and names each author
    // rather than picking whichever one happened to come back first.
    const commentsFor = (row: ScoreboardDelegateRow, r: LedgerRow): string => {
      if (r.type !== 'speech') return '';
      return row.comments
        .filter((c) => c.level === 'speech' && c.content.trim()
          && (c.speechContext ?? '') === (r.context ?? '')
          && (c.speechSeconds ?? 0) === (r.seconds ?? 0))
        .map((c) => (c.chairName ? `${c.chairName}: ${c.content}` : c.content))
        .join(' | ');
    };

    const byName = [...allRows].sort((a, b) =>
      getCountryDisplayName(a.country, language).localeCompare(getCountryDisplayName(b.country, language), language));

    const header = ['Delegation', 'GSL', 'Caucus', 'Speaking (s)', 'Motions', 'RTR', 'WP', 'DR', 'Manual', 'Points (objective)', 'Score (headline)', 'Quality /100'];
    const lines = [header.join(',')];
    [...allRows].sort((a, b) => b.headline - a.headline).forEach((r) => {
      lines.push([
        getCountryDisplayName(r.country, language), r.gslSpeeches, r.caucusSpeeches, r.speakingSeconds,
        r.motions, r.rightsOfReply, r.workingPapers, r.draftResolutions, r.manual,
        r.objective, r.headline, r.quality ?? '',
      ].map(csvEscape).join(','));
    });

    // Detailed per-speech / event breakdown (topics + comments + points).
    lines.push('');
    lines.push('Per-speech / event breakdown');
    lines.push(['Delegation', 'Time', 'Source', 'Detail', 'Comment', 'Points'].map(csvEscape).join(','));
    byName.forEach((row) => {
      [...row.ledger]
        .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''))
        .forEach((r) => {
          const time = r.timestamp ? new Date(r.timestamp).toLocaleString() : '';
          lines.push([getCountryDisplayName(row.country, language), time, r.label, r.detail, commentsFor(row, r), r.pts].map(csvEscape).join(','));
        });
    });

    // Chair ratings, one line per factor per delegation — the subjective half of
    // the board, which the old export dropped entirely.
    const anyFactors = allRows.some((r) => r.factors.length);
    if (anyFactors) {
      lines.push('');
      lines.push('Chair ratings');
      lines.push(['Delegation', 'Factor', 'Average', 'Scale max', 'Ratings'].map(csvEscape).join(','));
      byName.forEach((row) => {
        row.factors.forEach((f) => {
          lines.push([getCountryDisplayName(row.country, language), f.name, f.average, f.scaleMax, f.ratings].map(csvEscape).join(','));
        });
      });
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${committee.code}-scoreboard.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── The Moderator-only slot inside the shared drill-in ────────────────────
  // Passed as `detailExtra` only when this device is NOT view-only. Same UI gate as
  // every other view-only affordance in the session — AGENTS.md RULE 15 still holds:
  // RLS checks only the chair suffix, so this hides the control, it does not enforce
  // anything. Before the rename this read as an oversight; now that the role is
  // literally called Commenter, a Commenter holding award/deduct powers contradicts
  // the name on the badge.
  const manualAdjustment = (row: ScoreboardDelegateRow) => (
    <div
      className="mt-4 p-3 rounded-xl"
      style={{ borderTop: `1px solid ${CARD_BORDER_COLOR}`, backgroundColor: NEU.base }}
    >
      <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.12em', color: NEU.forest, marginBlockEnd: 8 }}>
        {t('sb_manual_adjustment')}
      </p>
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => setDeduct(false)} className="text-xs font-bold px-2.5 py-1 rounded-lg"
          style={{ fontFamily: OUTFIT, backgroundColor: !deduct ? NEU.forest : 'transparent', color: !deduct ? NEU.gold : SOFT, border: `1px solid ${CARD_BORDER_COLOR}` }}>{t('sb_award')}</button>
        <button onClick={() => setDeduct(true)} className="text-xs font-bold px-2.5 py-1 rounded-lg"
          style={{ fontFamily: OUTFIT, backgroundColor: deduct ? RED : 'transparent', color: deduct ? '#FFFFFF' : SOFT, border: `1px solid ${CARD_BORDER_COLOR}` }}>{t('sb_deduct')}</button>
        <input type="number" min={1} value={awardAmt} onChange={(e) => setAwardAmt(e.target.value)} placeholder={t('sb_pts')}
          className="w-16 text-sm text-center rounded-lg px-1.5 py-1 outline-none"
          style={{ fontFamily: OUTFIT, backgroundColor: NEU.surface, border: `1px solid ${CARD_BORDER_COLOR}`, color: NEU.ink }} />
      </div>
      <input value={awardNote} onChange={(e) => setAwardNote(e.target.value)} placeholder={t('sb_reason_required')}
        className="w-full text-sm rounded-lg px-2.5 py-1.5 mb-2 outline-none"
        style={{ fontFamily: OUTFIT, backgroundColor: NEU.surface, border: `1px solid ${CARD_BORDER_COLOR}`, color: NEU.ink }} />
      <button onClick={() => submitManual(row.country)} disabled={!awardAmt || !awardNote.trim()}
        className="text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-40 gv-lift"
        style={{ fontFamily: OUTFIT, backgroundColor: NEU.forest, color: NEU.gold }}>{t('sb_apply')}</button>
    </div>
  );

  const TH: React.CSSProperties = {
    fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.08em',
    color: SOFT, borderBottom: `2px solid ${CARD_BORDER_COLOR}`, padding: '6px 8px',
  };
  const TD: React.CSSProperties = {
    fontFamily: OUTFIT, fontSize: 12, color: SOFT, fontVariantNumeric: 'tabular-nums',
    borderBottom: `1px solid ${CARD_BORDER_COLOR}`, padding: '6px 8px', textAlign: 'end',
  };

  return (
    <Portal>
      <style>{`@keyframes sbFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(28,20,16,0.45)' }} onClick={onClose}>
        {/* Height is capped as a % of the overlay, NEVER in vh: this modal is portalled into
            #fit-root, which is scale()d, so vh resolves against the real viewport while the
            overlay's own box is only FitToScreen's BASE_H. On tall screens 88vh overflowed
            that box and the header/footer were pushed off-screen (and unreachable, because a
            centred flex item overflows in both directions). % matches Motions/Documents. */}
        <div className="w-full max-w-3xl max-h-[92%] rounded-2xl overflow-hidden flex flex-col"
          style={{ backgroundColor: NEU.surface, border: `1px solid ${CARD_BORDER_COLOR}`, boxShadow: NEU.out, fontFamily: OUTFIT }}
          onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="px-5 py-3 flex items-center gap-3 shrink-0 sticky top-0 z-10" style={{ backgroundColor: NEU.forest }}>
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: NEU.gold }} />
            <span className="text-sm font-black tracking-wide" style={{ color: NEU.gold }}>{t('sb_title')}</span>
            <div className="ms-auto flex items-center gap-2">
              <button onClick={exportCsv} className="text-xs font-bold px-3 py-1.5 rounded-lg gv-lift" style={{ backgroundColor: NEU.gold, color: NEU.forest }}>{t('sb_export_csv')}</button>
              <button onClick={onClose} className="text-[#EDE7D8] hover:text-white text-lg leading-none" aria-label={t('sb_close')}>✕</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 pt-3 shrink-0">
            {(['ranking', 'matrix'] as const).map((id) => (
              <button key={id} onClick={() => { setTab(id); setExpanded(null); }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                style={{ backgroundColor: tab === id ? NEU.forest : 'transparent', color: tab === id ? NEU.gold : SOFT, border: tab === id ? 'none' : `1px solid ${CARD_BORDER_COLOR}` }}>
                {id === 'ranking' ? t('sb_tab_ranking') : t('sb_tab_matrix')}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {tab === 'ranking' && (
              <div style={{ animation: 'sbFade 160ms ease-out' }}>
                <div className="flex gap-2.5 flex-wrap mb-4">
                  <Stat label={t('sb_stat_delegations')} value={String(totals.delegations)} />
                  <Stat label={t('sb_stat_speeches')} value={String(totals.speeches)} />
                  <Stat label={t('sb_stat_speaking_time')} value={formatSpeakingTime(totals.seconds)} />
                  <Stat label={t('sb_stat_chair_notes')} value={String(totals.comments)} />
                </div>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.12em', color: SOFT }}>{t('sb_sort_by')}</span>
                  {SORTS.map((s) => (
                    <NeuPill key={s.key} active={sortKey === s.key} onClick={() => setSortKey(s.key)}>
                      {sortLabel[s.key]}
                    </NeuPill>
                  ))}
                </div>

                <ScoreboardTable
                  rows={rows}
                  sortKey={sortKey}
                  showCommitteeColumn={false}
                  expanded={expanded}
                  onExpand={handleExpand}
                  locale={language}
                  detailSummary
                  detailExtra={isViewOnly ? undefined : manualAdjustment}
                  labels={labels}
                  emptyText={t('sb_empty_no_delegations')}
                />
              </div>
            )}

            {/* Matrix */}
            {tab === 'matrix' && (
              <div className="overflow-x-auto" style={{ animation: 'sbFade 160ms ease-out' }}>
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, textAlign: 'start' }}>{t('sb_col_delegation')}</th>
                      <th style={{ ...TH, textAlign: 'end' }} title={t('sb_matrix_gsl_title')}>{t('sb_matrix_gsl')}</th>
                      <th style={{ ...TH, textAlign: 'end' }} title={t('sb_matrix_cauc_title')}>{t('sb_matrix_cauc')}</th>
                      <th style={{ ...TH, textAlign: 'end' }} title={t('sb_matrix_time_title')}>{t('sb_col_time')}</th>
                      <th style={{ ...TH, textAlign: 'end' }} title={t('sb_matrix_mot_title')}>{t('sb_matrix_mot')}</th>
                      <th style={{ ...TH, textAlign: 'end' }} title={t('sb_matrix_rtr_title')}>{t('sb_matrix_rtr')}</th>
                      <th style={{ ...TH, textAlign: 'end' }} title={t('sb_matrix_wp_title')}>{t('sb_matrix_wp')}</th>
                      <th style={{ ...TH, textAlign: 'end' }} title={t('sb_matrix_dr_title')}>{t('sb_matrix_dr')}</th>
                      <th style={{ ...TH, textAlign: 'end' }} title={t('sb_matrix_manual_title')}>±</th>
                      {/* WAS "TOTAL", AND IT WAS NOT THE TOTAL ANYONE ELSE MEANT.
                          This column is `computeObjectiveScore` — the ledger sum
                          — while the Ranking tab's badge is the blended
                          headline. Under any `scoreBlend > 0` they differ, and
                          the column was labelled as though they could not. Both
                          are shown now, each under its own name. */}
                      <th style={{ ...TH, textAlign: 'end' }} title={t('sb_matrix_points_title')}>{t('sb_stat_points')}</th>
                      <th style={{ ...TH, textAlign: 'end', color: NEU.forest }} title={t('sb_matrix_score_title')}>{t('sb_col_score')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...allRows].sort((a, b) => b.headline - a.headline).map((r) => (
                      <tr key={r.key}>
                        {/* Cap the name column so a long delegation name truncates instead of
                            widening the table (which would force the whole row to scroll). */}
                        <td style={{ ...TD, textAlign: 'start', maxWidth: 220 }}>
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="shrink-0 flex"><FlagImg code={getCountryByName(r.country)?.code ?? ''} size={20} className="shrink-0" /></span>
                            <span className="truncate" style={{ color: NEU.ink }} title={getCountryDisplayName(r.country, language)}>{getCountryDisplayName(r.country, language)}</span>
                          </span>
                        </td>
                        <td style={TD}>{r.gslSpeeches}</td>
                        <td style={TD}>{r.caucusSpeeches}</td>
                        <td style={TD}>{formatSpeakingTime(r.speakingSeconds)}</td>
                        <td style={TD}>{r.motions}</td>
                        <td style={TD}>{r.rightsOfReply}</td>
                        <td style={TD}>{r.workingPapers}</td>
                        <td style={TD}>{r.draftResolutions}</td>
                        <td style={{ ...TD, color: r.manual < 0 ? RED : SOFT }}>{r.manual}</td>
                        <td style={{ ...TD, color: NEU.ink }}>{r.objective}</td>
                        <td style={{ ...TD, color: NEU.forest, fontWeight: 900 }}>{r.headline}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {allRows.length === 0 && (
                  <p style={{ fontFamily: OUTFIT, fontSize: 13, color: SOFT, textAlign: 'center', padding: '32px 0' }}>
                    {t('sb_empty_no_delegations')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
