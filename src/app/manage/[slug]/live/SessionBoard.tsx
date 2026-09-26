'use client';

// ─────────────────────────────────────────────────────────────────────────────
// The chair's scoreboard, READ ONLY, for the organiser side (23 Sep 2026).
//
// Owner: "The scoreboard and the rest of the details that should be synced with
// sessions still look like the old design. Amend this to be the absolute same."
//
// So this renders the SAME pieces the chair's `ScoreboardPanel` renders, from the
// SAME adapters, with the SAME props:
//   • the three icon chips (delegations, speeches, speaking time);
//   • `ScoreboardTable` with column-header sorting, round 34px flags, no NOTES
//     column, wrapped headers, the chair's widths and the chair's score cell;
//   • `DelegateProfile` when a delegation is opened;
//   • the Matrix grid;
//   • `HistoryTab`, the session read back segment by segment.
//
// WHAT IS DELIBERATELY ABSENT, because an organiser observes and never scores:
//   • `ManualAdjust` (the Moderator's plus / minus) — `DelegateProfile.extra` is
//     never passed;
//   • note editing — no `NoteEditingProvider` is mounted, so every `EditableNote`
//     renders as plain read-only text (`mine` is false without a provider).
//
// It computes nothing. Rows are `buildSessionScoreboardRows`, the point slices
// `sessionPointSlices`, the history `buildSessionHistory` — the chair's functions.
// Manage surfaces are English; `useT()` returns English outside a sessions route,
// so the strings below are the chair's own keys, read in English.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import { ListOrdered, Grid3x3, History as HistoryIcon } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { SOFT, RED, CARD_BORDER_COLOR } from '@/components/scoreboardTokens';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { SeatArtProvider } from '@/components/SeatFlag';
import {
  ScoreboardTable, sortScoreboardRows, naturalSortDir,
  type SortKey, type SortDir, type ScoreboardLabels,
} from '@/components/ScoreboardTable';
import { IconStat, STAT_ICONS, TINT } from '@/components/scoreboard/SessionScoreboardParts';
import DelegateProfile from '@/components/scoreboard/DelegateProfile';
import HistoryTab from '@/components/scoreboard/HistoryTab';
import { getCountryDisplayName } from '@/lib/countries';
import { useT } from '@/contexts/LanguageContext';
import { buildSessionScoreboardRows, sessionPointSlices } from '@/lib/sessionScoreboard';
import { buildSessionHistory, type HistorySpeech } from '@/lib/sessionHistory';
import { formatSpeakingTime, type ScoreboardDelegateRow, type ConferenceScoreboard } from '@/lib/conferenceScoreboard';
import type { Committee } from '@/lib/types';
import type { FeedbackEntry } from '@/lib/committeeService';

/** The chair's table strings, from the chair's own translation keys. */
export function useChairScoreboardLabels(): ScoreboardLabels {
  const t = useT();
  return useMemo(() => ({
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
    statQuality: t('sb_stat_quality'),
    titleQuality: t('sb_title_quality'),
    qualityUnrated: t('sb_quality_unrated'),
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
    commentLevelSpeech: t('sb_comment_level_speech'),
    commentLevelSession: t('sb_comment_level_session'),
    commentLevelConference: t('sb_comment_level_conference'),
    ctxGsl: t('fb_tag_gsl'),
    ctxModerated: t('fb_tag_caucus'),
    ctxUnmoderated: t('fb_tag_unmod'),
    ctxTour: t('fb_tag_tour'),
    commentWritten: t('sb_comment_written'),
    sortAscending: t('sb_sort_asc'),
    sortDescending: t('sb_sort_desc'),
  }), [t]);
}

/** The styles the chair's panel defines for the table's pressable headers and the
 *  History tab's segment headers. Scoped by class, so mounting it twice is harmless. */
export function SessionBoardStyles() {
  return (
    <style>{`
      @keyframes sbFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
      .gv-sort-th:hover{color:${NEU.forest}}
      .gv-sort-th:active{transform:scale(0.96)}
      .gv-sb-seg{transition:background 160ms cubic-bezier(0.22,1,0.36,1),transform 160ms cubic-bezier(0.22,1,0.36,1)}
      .gv-sb-seg:hover{background:rgba(27,56,40,0.05)}
      .gv-sb-seg:active{transform:scale(0.995)}
    `}</style>
  );
}

/** The chair's score cell: headline in forest numerals over a bar relative to the top
 *  score, gold for the leader. `rank` is the row's place (1 = leader). */
export function ChairScoreCell({ row, max, leader }: { row: ScoreboardDelegateRow; max: number; leader: boolean }) {
  const t = useT();
  const pct = max > 0 ? Math.max(0, Math.min(100, (row.headline / max) * 100)) : 0;
  return (
    <span
      className="inline-flex flex-col items-end"
      style={{ gap: 4, fontFamily: OUTFIT }}
      title={row.quality != null
        ? t('sb_title_score_blended').replace('{objective}', String(row.objective)).replace('{quality}', String(row.quality))
        : t('sb_title_score').replace('{objective}', String(row.objective))}
    >
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, lineHeight: 1 }}>
        <span style={{ fontWeight: 800, fontSize: 16, color: NEU.forest, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
          {row.headline}
        </span>
        <span style={{ fontWeight: 700, fontSize: 10, color: SOFT }}>{t('sb_pts')}</span>
      </span>
      <span aria-hidden style={{ width: 52, height: 3, borderRadius: 999, backgroundColor: 'rgba(27,56,40,0.10)', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, borderRadius: 999, backgroundColor: leader ? '#C9A43A' : NEU.forest }} />
      </span>
    </span>
  );
}

/** Place by headline, ties sharing a place — the profile's `#n`. */
export function rankByHeadline(rows: ScoreboardDelegateRow[]): Map<string, number> {
  const byScore = [...rows].sort((a, b) => b.headline - a.headline);
  const out = new Map<string, number>();
  byScore.forEach((r, i) => {
    const prev = byScore[i - 1];
    out.set(r.key, prev && prev.headline === r.headline ? out.get(prev.key)! : i + 1);
  });
  return out;
}

/** Every speech of a session, grouped by delegation, with its chair notes placed
 *  exactly where the History tab places them. */
export function speechesByCountryOf(committee: Committee, feedback: FeedbackEntry[]): Map<string, HistorySpeech[]> {
  const out = new Map<string, HistorySpeech[]>();
  for (const seg of buildSessionHistory(committee, feedback)) for (const sp of seg.speeches) {
    const list = out.get(sp.country);
    if (list) list.push(sp); else out.set(sp.country, [sp]);
  }
  return out;
}

export type BoardTab = 'ranking' | 'matrix' | 'history';

/**
 * The chair's scoreboard body for one session, read only.
 *
 * `tabs` picks which of the chair's tabs to offer (default all three). With a
 * single tab the tab strip is not drawn.
 */
export function SessionScoreboardBoard({ committee, feedback, tabs = ['ranking', 'matrix', 'history'], showChips = true }: {
  committee: Committee;
  feedback: FeedbackEntry[];
  tabs?: BoardTab[];
  showChips?: boolean;
}) {
  const t = useT();
  const labels = useChairScoreboardLabels();
  const [tab, setTab] = useState<BoardTab>(tabs[0]);
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>(naturalSortDir('score'));
  const [expanded, setExpanded] = useState<string | null>(null);

  const allRows = useMemo(() => buildSessionScoreboardRows(committee, feedback, 'en'), [committee, feedback]);
  const rows = useMemo(() => sortScoreboardRows(allRows, sortKey, 'en', sortDir), [allRows, sortKey, sortDir]);
  const totals = useMemo(() => ({
    delegations: allRows.length,
    speeches: allRows.reduce((s, r) => s + r.gslSpeeches + r.caucusSpeeches, 0),
    seconds: allRows.reduce((s, r) => s + r.speakingSeconds, 0),
  }), [allRows]);
  const rankOf = useMemo(() => rankByHeadline(allRows), [allRows]);
  const maxHeadline = useMemo(() => Math.max(0, ...allRows.map((r) => r.headline)), [allRows]);
  const speechesByCountry = useMemo(() => speechesByCountryOf(committee, feedback), [committee, feedback]);

  const TH: React.CSSProperties = {
    fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.08em',
    color: SOFT, borderBottom: `2px solid ${CARD_BORDER_COLOR}`, padding: '6px 8px',
  };
  const TD: React.CSSProperties = {
    fontFamily: OUTFIT, fontSize: 12, color: SOFT, fontVariantNumeric: 'tabular-nums',
    borderBottom: `1px solid ${CARD_BORDER_COLOR}`, padding: '6px 8px', textAlign: 'end',
  };

  const TAB_META: Record<BoardTab, { label: string; icon: typeof ListOrdered }> = {
    ranking: { label: t('sb_tab_ranking'), icon: ListOrdered },
    matrix: { label: t('sb_tab_matrix'), icon: Grid3x3 },
    history: { label: t('sb_tab_history'), icon: HistoryIcon },
  };

  return (
    <SeatArtProvider delegates={committee.delegates}>
      <SessionBoardStyles />
      {showChips && (
        <div className="flex gap-2 flex-wrap shrink-0">
          <IconStat compact icon={STAT_ICONS.delegations} label={t('sb_stat_delegations')} value={String(totals.delegations)} />
          <IconStat compact icon={STAT_ICONS.speeches} label={t('sb_stat_speeches')} value={String(totals.speeches)} />
          <IconStat compact icon={STAT_ICONS.time} label={t('sb_stat_speaking_time')} value={formatSpeakingTime(totals.seconds)} tint={TINT.sage} />
        </div>
      )}

      {tabs.length > 1 && (
        <div className="flex gap-1 pt-3 shrink-0">
          {tabs.map((id) => {
            const { label, icon: Icon } = TAB_META[id];
            return (
              <button key={id} onClick={() => { setTab(id); setExpanded(null); }}
                aria-pressed={tab === id}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 focus:outline-none"
                style={{ fontFamily: OUTFIT, backgroundColor: tab === id ? NEU.forest : 'transparent', color: tab === id ? NEU.gold : SOFT, border: tab === id ? 'none' : `1px solid ${CARD_BORDER_COLOR}`, minHeight: 32 }}>
                <Icon size={13} strokeWidth={2.4} aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div className="pt-4">
        {tab === 'ranking' && (
          <div style={{ animation: 'sbFade 160ms ease-out' }}>
            <ScoreboardTable
              rows={rows}
              sortKey={sortKey}
              sortDir={sortDir}
              onSortChange={(key, dir) => { setSortKey(key); setSortDir(dir); }}
              showCommitteeColumn={false}
              expanded={expanded}
              onExpand={setExpanded}
              locale="en"
              circleFlags
              flagSize={34}
              hideNotesColumn
              wrapHeaders
              columnWidths={{ speeches: 92, time: 84, score: 96 }}
              renderScore={(row) => <ChairScoreCell row={row} max={maxHeadline} leader={rankOf.get(row.key) === 1} />}
              renderDetail={(row) => (
                <DelegateProfile
                  row={row}
                  rank={rankOf.get(row.key) ?? 0}
                  rankTotal={allRows.length}
                  slices={sessionPointSlices(committee, row.ledger, 'en', t('sb_breakdown_manual'))}
                  speeches={speechesByCountry.get(row.country) ?? []}
                />
              )}
              labels={labels}
              emptyText={t('sb_empty_no_delegations')}
            />
          </div>
        )}

        {tab === 'history' && (
          <div style={{ animation: 'sbFade 160ms ease-out' }}>
            <HistoryTab committee={committee} feedback={feedback} />
          </div>
        )}

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
                  <th style={{ ...TH, textAlign: 'end' }} title={t('sb_matrix_points_title')}>{t('sb_stat_points')}</th>
                  <th style={{ ...TH, textAlign: 'end' }} title={t('sb_title_quality')}>{t('sb_matrix_quality')}</th>
                  <th style={{ ...TH, textAlign: 'end', color: NEU.forest }} title={t('sb_matrix_score_title')}>{t('sb_col_score')}</th>
                </tr>
              </thead>
              <tbody>
                {[...allRows].sort((a, b) => b.headline - a.headline).map((r) => (
                  <tr key={r.key}>
                    <td style={{ ...TD, textAlign: 'start', maxWidth: 220 }}>
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 flex"><SeatCircleFlag country={r.country} size={26} decorative /></span>
                        <span className="min-w-0 [overflow-wrap:anywhere]" style={{ color: NEU.ink }}>{getCountryDisplayName(r.country, 'en')}</span>
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
                    <td style={{ ...TD, color: r.quality != null ? NEU.ink : SOFT }}>{r.quality != null ? r.quality : '–'}</td>
                    <td style={{ ...TD, color: NEU.forest, fontWeight: 900 }}>{r.headline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allRows.length > 0 ? (
              <p style={{ fontFamily: OUTFIT, fontSize: 11.5, lineHeight: 1.6, color: SOFT, marginBlockStart: 12 }}>
                {t('sb_matrix_legend')}
              </p>
            ) : (
              <p style={{ fontFamily: OUTFIT, fontSize: 13, color: SOFT, textAlign: 'center', padding: '32px 0' }}>
                {t('sb_empty_no_delegations')}
              </p>
            )}
          </div>
        )}
      </div>
    </SeatArtProvider>
  );
}

/** Loading / error / no-session states shared by every organiser session view. */
export function SessionLoadState({ loading, error, hasSession, children }: {
  loading: boolean; error: string; hasSession: boolean; children: React.ReactNode;
}) {
  if (!hasSession) {
    return (
      <p style={{ fontFamily: OUTFIT, fontSize: 13, color: SOFT, textAlign: 'center', padding: '40px 0' }}>
        This committee has no live session yet, so there is nothing to show.
      </p>
    );
  }
  if (error) {
    return (
      <p className="text-xs" style={{ fontFamily: OUTFIT, color: RED, backgroundColor: 'rgba(139,32,32,0.06)', border: '1px solid rgba(139,32,32,0.2)', borderRadius: 10, padding: '8px 12px' }}>
        {error}
      </p>
    );
  }
  if (loading) {
    return (
      <div className="flex justify-center py-14">
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
      </div>
    );
  }
  return <>{children}</>;
}

/**
 * The chair's `DelegateProfile` for one row of the WHOLE-CONFERENCE scoreboard
 * (`loadConferenceScoreboard`): rank among its own committee, the stacked point
 * bar and the speech timeline with chair notes, from the session the loader
 * assembled. Read only, like everything on the organiser side.
 */
export function ConferenceRowProfile({ row, scoreboard }: {
  row: ScoreboardDelegateRow;
  scoreboard: ConferenceScoreboard;
}) {
  const t = useT();
  const sessionId = row.key.slice(0, row.key.indexOf('|'));
  const sess = scoreboard.sessions[sessionId];
  const peers = useMemo(
    () => scoreboard.rows.filter((r) => r.key.startsWith(`${sessionId}|`)),
    [scoreboard.rows, sessionId],
  );
  const rank = useMemo(() => rankByHeadline(peers).get(row.key) ?? 0, [peers, row.key]);
  const speeches = useMemo(
    () => (sess ? speechesByCountryOf(sess.committee, sess.feedback).get(row.country) ?? [] : []),
    [sess, row.country],
  );
  return (
    <SeatArtProvider delegates={sess?.committee.delegates}>
      <DelegateProfile
        row={row}
        rank={rank}
        rankTotal={peers.length}
        slices={sess ? sessionPointSlices(sess.committee, row.ledger, 'en', t('sb_breakdown_manual')) : []}
        speeches={speeches}
      />
    </SeatArtProvider>
  );
}
