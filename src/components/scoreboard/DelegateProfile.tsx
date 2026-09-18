'use client';

// ─────────────────────────────────────────────────────────────────────────────
// src/components/scoreboard/DelegateProfile.tsx
//
// ONE DELEGATION, OPENED — the chair's drill-in, passed to `ScoreboardTable`
// through its `renderDetail` slot.
//
// WHY IT IS NOT A FLAG ON `DelegateDetail`. That component is shared with the
// organiser dashboard, where this view is read-only and English and has been
// signed off as it stands. `renderDetail` lets the chair pass a different
// component instead, so the organiser board renders exactly the bytes it always
// did and this file is free to be what a chair needs.
//
// COMPACT, ON PURPOSE (17 Sep 2026). The owner found the previous profile
// "messy, hard to tell apart and takes too much space": eight figure tiles, a
// by-source ledger, rating bars, comment cards and a separate timeline, stacked.
// It is now four things, top to bottom:
//
//   1. ONE LINE: flag and name, then speeches, speaking time, rank and points.
//   2. ONE STACKED BAR of where the points came from, with a legend of source
//      names and values (`sessionPointSlices`, which sums to the objective).
//   3. RATINGS, one line per factor, and only when a chair has rated anything.
//   4. THE TIMELINE, NEWEST FIRST: every speech (context, duration, time, points)
//      with the chair comments written on it inline, and the other scored events.
//      Notes that belong to no speech follow under "Other comments". A chair's OWN
//      comment edits in place with a click (`EditableNote`); another chair's is
//      read-only, because a feedback row belongs to its author.
//
// Then the Moderator's plus / minus (`extra`). No chair-note count anywhere: the
// owner does not want notes tallied.
//
// It computes no score. Every number is a field of the shared row, or a fold of
// its ledger (`sessionPointSlices`), or the history's note placement
// (`buildSessionHistory`), so the ranking list, the matrix and the History tab
// can never disagree with it.
//
// CHAIR-PRIVATE. Notes and ratings are rendered here because this component is
// mounted only by `ScoreboardPanel`, which is mounted only by `/chair/[code]`.
// It must never be imported by a delegate surface (CLAUDE.md §2).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Mic, Clock, Trophy } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { SOFT, RED, CARD_BORDER_COLOR } from '@/components/scoreboardTokens';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { getCountryDisplayName } from '@/lib/countries';
import { formatSpeakingTime, type ScoreboardDelegateRow } from '@/lib/conferenceScoreboard';
import type { PointSlice } from '@/lib/sessionScoreboard';
import { speechKey, type HistorySpeech, type HistoryNote } from '@/lib/sessionHistory';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { eventIcon } from './SessionScoreboardParts';
import EditableNote from './EditableNote';

const fmt = (tpl: string, vars: Record<string, string | number>): string =>
  tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

/** One colour per source, fixed, so a source reads the same on every delegation. */
const SLICE_COLOUR: Record<string, string> = {
  gslSpeech: '#1B3828',
  caucusSpeech: '#4F7F5E',
  speakingTimePer10s: '#C9A43A',
  motionRaised: '#B8844A',
  rightOfReply: '#A35D4A',
  wpSponsor: '#5D86A8',
  drSponsor: '#34587A',
  drPassed: '#3F7A77',
  attendance: '#B9A883',
  manual: '#7E5E86',
};
const EXTRA_COLOURS = ['#8A7F5A', '#6B6B8E', '#9C6B7A', '#5F7F86'];

const MICRO: React.CSSProperties = {
  fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.1em', color: SOFT,
};

type TimelineItem =
  | { kind: 'speech'; at: string; speech: HistorySpeech; pts: number | null }
  | { kind: 'event'; at: string; row: ScoreboardDelegateRow['ledger'][number] };

export default function DelegateProfile({ row, rank, rankTotal, slices, speeches, extra }: {
  row: ScoreboardDelegateRow;
  /** 1-based place by score among `rankTotal` delegations (ties share a place). */
  rank: number;
  rankTotal: number;
  /** `sessionPointSlices` for this row. */
  slices: PointSlice[];
  /** This delegation's speeches from `buildSessionHistory`, notes already attached. */
  speeches: HistorySpeech[];
  /** The Moderator's plus / minus. Absent for a Commenter. */
  extra?: React.ReactNode;
}) {
  const t = useT();
  const { language } = useLanguage();
  const dateLocale = language === 'en' ? 'en-GB' : language;
  const clock = (iso: string) => (iso
    ? new Date(iso).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })
    : '');

  const speechCount = row.gslSpeeches + row.caucusSpeeches;

  const ctxLabel = (c: string): string => {
    switch (c) {
      case 'speakers-list': return t('sb_hist_seg_gsl');
      case 'moderated-caucus': return t('sb_hist_seg_moderated');
      case 'unmoderated-caucus': return t('sb_hist_seg_unmoderated');
      case 'tour-de-table': return t('sb_hist_seg_tour');
      default: return c;
    }
  };

  // ── Points bar ────────────────────────────────────────────────────────────
  const colourOf = (() => {
    let extraIdx = 0;
    const assigned = new Map<string, string>();
    return (id: string) => {
      if (SLICE_COLOUR[id]) return SLICE_COLOUR[id];
      if (!assigned.has(id)) assigned.set(id, EXTRA_COLOURS[extraIdx++ % EXTRA_COLOURS.length]);
      return assigned.get(id)!;
    };
  })();
  const positive = slices.filter((s) => s.pts > 0);
  const positiveSum = positive.reduce((s, x) => s + x.pts, 0);

  // ── Timeline: speeches (with their notes) + every other scored event ─────
  const ledgerSpeechPts = new Map<string, number>();
  for (const r of row.ledger) {
    if (r.type === 'speech') ledgerSpeechPts.set(speechKey(row.country, r.timestamp, r.context, r.seconds), r.pts);
  }
  const items: TimelineItem[] = [
    ...speeches.map((s): TimelineItem => ({
      kind: 'speech', at: s.timestamp, speech: s,
      pts: ledgerSpeechPts.get(speechKey(s.country, s.timestamp, s.context, s.seconds)) ?? null,
    })),
    ...row.ledger
      .filter((r) => r.type !== 'speech' && r.timestamp)
      .map((r): TimelineItem => ({ kind: 'event', at: r.timestamp, row: r })),
  ].sort((a, b) => (b.at || '').localeCompare(a.at || ''));

  const placed = new Set(speeches.flatMap((s) => s.notes.map((n) => n.id)));
  const otherComments = row.comments.filter((c) => c.content.trim() && !placed.has(c.id));

  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

  // A chair's own comment is editable where it is read (EditableNote); another
  // chair's renders exactly as before and names its author on hover.
  const noteLine = (n: Pick<HistoryNote, 'id' | 'content' | 'chairName'>) => (
    <EditableNote key={n.id} id={n.id} content={n.content} author={n.chairName} />
  );

  const eventTitle = (r: ScoreboardDelegateRow['ledger'][number]): string => {
    if (r.type === 'manual-award' || r.type === 'manual-deduct') {
      const base = r.type === 'manual-award' ? t('sb_hist_award') : t('sb_hist_deduct');
      return r.detail ? `${r.detail} · ${base}` : base.charAt(0).toLocaleUpperCase(language) + base.slice(1);
    }
    if (r.type === 'wp' || r.type === 'dr' || r.type === 'drPassed') return r.detail ? `${r.label} · ${r.detail}` : r.label;
    return r.label;
  };

  return (
    <div
      style={{
        backgroundColor: 'rgba(27,56,40,0.035)',
        borderBlockStart: `1px solid ${CARD_BORDER_COLOR}`,
        padding: '12px 16px 14px',
      }}
    >
      {/* ── 1. One line: who, and the four figures ───────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', rowGap: 6 }}>
        <SeatCircleFlag country={row.country} size={34} decorative />
        <span style={{ flex: '1 1 140px', minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: OUTFIT, fontWeight: 800, fontSize: 15.5, color: NEU.ink, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {getCountryDisplayName(row.country, language)}
          </span>
          {(row.isObserver || row.status === 'absent') && (
            <span style={{ display: 'block', fontFamily: OUTFIT, fontSize: 11, color: SOFT }}>
              {row.isObserver ? t('sb_observer') : t('sb_absent')}
            </span>
          )}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14, fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
          <span
            className="inline-flex items-center gap-1.5"
            title={fmt(t('sb_title_speeches_split'), { gsl: row.gslSpeeches, caucus: row.caucusSpeeches })}
            aria-label={`${speechCount} ${speechCount === 1 ? t('sb_speech_one') : t('sb_speech_many')}`}
          >
            <Mic size={13} strokeWidth={2.4} style={{ color: SOFT }} aria-hidden />
            {speechCount}
          </span>
          <span className="inline-flex items-center gap-1.5" title={t('sb_stat_speaking_time')}>
            <Clock size={13} strokeWidth={2.4} style={{ color: SOFT }} aria-hidden />
            {formatSpeakingTime(row.speakingSeconds)}
          </span>
          <span className="inline-flex items-center gap-1.5" title={fmt(t('sb_profile_rank_title'), { rank, n: rankTotal })}>
            <Trophy size={13} strokeWidth={2.4} style={{ color: SOFT }} aria-hidden />
            #{rank}
          </span>
          <span
            style={{
              display: 'inline-flex', alignItems: 'baseline', gap: 3,
              backgroundColor: NEU.forest, color: NEU.gold, borderRadius: 999,
              paddingInline: 11, paddingBlock: 4, fontWeight: 900, fontSize: 15,
            }}
            title={row.quality != null
              ? fmt(t('sb_title_score_blended'), { objective: row.objective, quality: row.quality })
              : fmt(t('sb_title_score'), { objective: row.objective })}
          >
            {row.headline}
            <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.75 }}>{t('sb_pts')}</span>
          </span>
        </span>
      </div>

      {/* ── 2. Where the points came from ─────────────────────────────────── */}
      <div style={{ marginBlockStart: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBlockEnd: 6 }}>
          <span style={MICRO}>{t('sb_section_points_breakdown')}</span>
          {slices.length > 0 && (
            <span
              style={{ ...MICRO, marginInlineStart: 'auto', letterSpacing: 0, fontSize: 11.5, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}
              title={row.quality != null
                ? fmt(t('sb_title_ledger_blended'), { headline: row.headline, quality: row.quality })
                : t('sb_title_ledger')}
            >
              {row.objective}
            </span>
          )}
        </div>
        {slices.length === 0 ? (
          <p style={{ fontFamily: OUTFIT, fontSize: 12, color: SOFT }}>{t('sb_empty_no_scored')}</p>
        ) : (
          <>
            {positiveSum > 0 && (
              <div
                role="img"
                aria-label={positive.map((s) => `${s.label} ${s.pts}`).join(', ')}
                style={{ display: 'flex', gap: 2, height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(27,56,40,0.08)' }}
              >
                {positive.map((s) => (
                  <span
                    key={s.sourceId}
                    title={`${s.label} ${signed(s.pts)}`}
                    style={{ flex: `${s.pts} 1 0`, minWidth: 3, backgroundColor: colourOf(s.sourceId) }}
                  />
                ))}
              </div>
            )}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, marginBlockStart: 7, display: 'flex', flexWrap: 'wrap', columnGap: 14, rowGap: 4 }}>
              {slices.map((s) => (
                <li key={s.sourceId} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: OUTFIT, fontSize: 12, color: NEU.ink }}>
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, backgroundColor: s.pts > 0 ? colourOf(s.sourceId) : RED }} />
                  {s.label}
                  <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: s.pts < 0 ? RED : NEU.forest }}>{signed(s.pts)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* ── 3. Ratings, only when someone rated ───────────────────────────── */}
      {row.factors.length > 0 && (
        <div style={{ marginBlockStart: 12 }}>
          <span style={{ ...MICRO, display: 'block', marginBlockEnd: 5 }}>{t('sb_section_chair_ratings')}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', columnGap: 18, rowGap: 3 }}>
            {row.factors.map((f) => {
              const max = Math.max(1, f.scaleMax);
              const avg = Math.round(f.average * 10) / 10;
              const dots = max <= 10;
              const filled = Math.round(f.average);
              return (
                <div
                  key={f.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}
                  title={fmt(f.ratings === 1 ? t('sb_title_factor_avg_one') : t('sb_title_factor_avg_many'), { n: f.ratings })}
                >
                  <span style={{ flex: 1, minWidth: 0, fontFamily: OUTFIT, fontSize: 12, color: NEU.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name}
                  </span>
                  {dots ? (
                    <span aria-hidden style={{ display: 'inline-flex', gap: 2.5 }}>
                      {Array.from({ length: max }, (_, i) => (
                        <span key={i} style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: i < filled ? NEU.forest : 'rgba(27,56,40,0.14)' }} />
                      ))}
                    </span>
                  ) : (
                    <span aria-hidden style={{ width: 64, height: 5, borderRadius: 999, backgroundColor: 'rgba(27,56,40,0.12)', overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${Math.min(100, (f.average / max) * 100)}%`, backgroundColor: NEU.forest }} />
                    </span>
                  )}
                  <span style={{ width: 44, textAlign: 'end', fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
                    {avg}<span style={{ fontWeight: 600, color: SOFT, fontSize: 10.5 }}>/{max}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 4. Timeline, with the comments where they were written ────────── */}
      <div style={{ marginBlockStart: 12 }}>
        <span style={{ ...MICRO, display: 'block', marginBlockEnd: 2 }}>{t('sb_section_timeline')}</span>
        {items.length === 0 ? (
          <p style={{ fontFamily: OUTFIT, fontSize: 12, color: SOFT, marginBlockStart: 4 }}>{t('sb_empty_no_timeline')}</p>
        ) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((it, i) => {
              const Icon = eventIcon(it.kind === 'speech' ? 'speech' : it.row.type);
              const pts = it.kind === 'speech' ? it.pts : it.row.pts;
              return (
                <li
                  key={i}
                  style={{
                    display: 'flex', gap: 9, paddingBlock: 6,
                    borderBlockEnd: i < items.length - 1 ? `1px solid ${CARD_BORDER_COLOR}` : 'none',
                  }}
                >
                  <Icon size={13} strokeWidth={2.4} aria-hidden style={{ color: SOFT, flexShrink: 0, marginBlockStart: 3 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ flex: 1, minWidth: 0, fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.kind === 'speech' ? (
                          <>
                            <span style={{ fontWeight: 700 }}>{ctxLabel(it.speech.context)}</span>
                            <span style={{ color: SOFT, fontVariantNumeric: 'tabular-nums' }}>{` · ${formatSpeakingTime(it.speech.seconds)}`}</span>
                          </>
                        ) : (
                          <span style={{ fontWeight: 600 }}>{eventTitle(it.row)}</span>
                        )}
                      </span>
                      <span style={{ flexShrink: 0, fontFamily: OUTFIT, fontSize: 11, color: SOFT, fontVariantNumeric: 'tabular-nums' }}>
                        {clock(it.at)}
                      </span>
                      <span style={{ flexShrink: 0, width: 34, textAlign: 'end', fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: pts != null && pts < 0 ? RED : NEU.forest }}>
                        {pts != null && pts !== 0 ? signed(pts) : ''}
                      </span>
                    </span>
                    {it.kind === 'speech' && it.speech.notes.map((n) => noteLine(n))}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {otherComments.length > 0 && (
          <div style={{ marginBlockStart: 8 }}>
            <span style={{ ...MICRO, display: 'block', marginBlockEnd: 2 }}>{t('sb_profile_other_comments')}</span>
            {otherComments.map((c) => noteLine({ id: c.id, content: c.content.trim(), chairName: c.chairName }))}
          </div>
        )}
      </div>

      {extra}
    </div>
  );
}
