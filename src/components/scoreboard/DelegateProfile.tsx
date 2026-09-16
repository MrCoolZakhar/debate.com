'use client';

// ─────────────────────────────────────────────────────────────────────────────
// src/components/scoreboard/DelegateProfile.tsx
//
// ONE DELEGATION, OPENED — the chair's drill-in, passed to `ScoreboardTable`
// through its `renderDetail` slot.
//
// WHY IT IS NOT A FLAG ON `DelegateDetail`. That component is shared with the
// organiser dashboard, where this view is read-only and English and has been
// signed off as it stands. Rebuilding it in place would have meant two divergent
// renders inside one function, gated on a boolean. `renderDetail` lets the chair
// pass a different component instead, so the organiser board renders exactly the
// bytes it rendered yesterday and this file is free to be what a chair needs.
//
// WHAT CHANGED, AND WHY. The owner's words: "all tabs look the same". They did:
// five stacked headings in identical 10px capitals, with no glyph, no tint and no
// hierarchy, so finding the notes meant reading every heading. Now the profile
// opens with the delegation itself — round flag, name, score — and then five
// sections that are each visibly a different thing:
//
//   ACTIVITY        forest   what they did, as figures
//   POINTS          gold     the ledger that sums to the objective total
//   RATINGS         sage     the chairs' factor sliders
//   COMMENTS        amber    what the chairs wrote, and who wrote it
//   TIMELINE        forest   the same ledger in the order it happened
//
// It computes NOTHING. Every number on screen is a field of the
// `ScoreboardDelegateRow` the shared builder already produced, which is the same
// row the organiser sees, so the two surfaces can still never disagree.
//
// CHAIR-PRIVATE. Notes and ratings are rendered here because this component is
// mounted only by `ScoreboardPanel`, which is mounted only by `/chair/[code]`.
// It must never be imported by a delegate surface (CLAUDE.md §2).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Coins, Star, MessageSquareQuote, Activity, History } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { SOFT, RED, CARD_BORDER_COLOR } from '@/components/scoreboardTokens';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { getCountryDisplayName } from '@/lib/countries';
import { formatSpeakingTime, type ScoreboardDelegateRow, type ScoreboardComment } from '@/lib/conferenceScoreboard';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { IconStat, SectionHead, eventIcon, STAT_ICONS, TINT } from './SessionScoreboardParts';

const fmt = (tpl: string, vars: Record<string, string | number>): string =>
  tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

export default function DelegateProfile({ row, extra }: {
  row: ScoreboardDelegateRow;
  /** The Moderator's manual award / deduct control. Absent for a Commenter. */
  extra?: React.ReactNode;
}) {
  const t = useT();
  const { language } = useLanguage();
  const dateLocale = language === 'en' ? 'en-GB' : language;
  const stamp = (iso: string) =>
    new Date(iso).toLocaleString(dateLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const comments = row.comments.filter((c) => c.content.trim());
  const speeches = row.gslSpeeches + row.caucusSpeeches;

  // The ledger, folded by source for POINTS and left in time order for TIMELINE.
  // Same rows, two readings: "where did the points come from" and "what happened".
  const grouped: { sourceId: string; label: string; rows: typeof row.ledger; subtotal: number }[] = [];
  for (const r of row.ledger) {
    let g = grouped.find((x) => x.sourceId === r.sourceId);
    if (!g) { g = { sourceId: r.sourceId, label: r.label, rows: [], subtotal: 0 }; grouped.push(g); }
    g.rows.push(r);
    g.subtotal += r.pts;
  }
  const timeline = [...row.ledger]
    .filter((r) => r.timestamp)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const ctxLabel = (c?: string): string => {
    switch (c) {
      case 'speakers-list': return t('fb_tag_gsl');
      case 'moderated-caucus': return t('fb_tag_caucus');
      case 'unmoderated-caucus': return t('fb_tag_unmod');
      case 'tour-de-table': return t('fb_tag_tour');
      default: return c ? c.toUpperCase() : '';
    }
  };

  const commentMeta = (c: ScoreboardComment): string => [
    c.level === 'speech' ? ctxLabel(c.speechContext ?? undefined) : t('sb_comment_level_session'),
    c.speechTopic?.trim() || '',
    c.speechSeconds ? fmt(t('sb_comment_speech_seconds'), { n: c.speechSeconds }) : '',
    c.spokenAt || c.createdAt ? stamp((c.spokenAt || c.createdAt) as string) : '',
  ].filter(Boolean).join(' · ');

  const empty = (text: string) => (
    <p style={{ fontFamily: OUTFIT, fontSize: 12, color: SOFT, textWrap: 'pretty' }}>{text}</p>
  );

  return (
    <div
      style={{
        backgroundColor: 'rgba(27,56,40,0.035)',
        borderBlockStart: `1px solid ${CARD_BORDER_COLOR}`,
        padding: '14px 16px 16px',
      }}
    >
      {/* ── Who this is ──────────────────────────────────────────────────────
          The row above scrolls out of sight as soon as the ledger is long, and
          the old drill-in then had nothing on it naming the delegation. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBlockEnd: 14 }}>
        <SeatCircleFlag country={row.country} size={40} decorative />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: OUTFIT, fontWeight: 800, fontSize: 16, color: NEU.ink, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {getCountryDisplayName(row.country, language)}
          </span>
          <span style={{ fontFamily: OUTFIT, fontSize: 11, color: SOFT }}>
            {row.isObserver ? t('sb_observer') : row.status === 'absent' ? t('sb_absent') : `${speeches} ${speeches === 1 ? t('sb_speech_one') : t('sb_speech_many')}`}
          </span>
        </span>
        <span
          style={{
            marginInlineStart: 'auto', flexShrink: 0,
            fontFamily: OUTFIT, fontWeight: 900, fontSize: 15, fontVariantNumeric: 'tabular-nums',
            backgroundColor: NEU.forest, color: NEU.gold, borderRadius: 999,
            paddingInline: 13, paddingBlock: 5,
          }}
          title={row.quality != null
            ? fmt(t('sb_title_score_blended'), { objective: row.objective, quality: row.quality })
            : fmt(t('sb_title_score'), { objective: row.objective })}
        >
          {row.headline}
        </span>
      </div>

      {/* ── ACTIVITY ───────────────────────────────────────────────────────── */}
      <SectionHead icon={Activity} label={t('sb_section_this_session')} tint={TINT.forest} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBlockEnd: 18 }}>
        <IconStat icon={STAT_ICONS.speeches} label={t('sb_stat_speeches')} value={String(speeches)}
          title={fmt(t('sb_title_speeches_split'), { gsl: row.gslSpeeches, caucus: row.caucusSpeeches })} />
        <IconStat icon={STAT_ICONS.time} label={t('sb_stat_speaking_time')} value={formatSpeakingTime(row.speakingSeconds)} />
        <IconStat icon={STAT_ICONS.motions} label={t('sb_stat_motions')} value={String(row.motions)} title={t('sb_title_motions')} />
        <IconStat icon={STAT_ICONS.rtr} label={t('sb_stat_rights_of_reply')} value={String(row.rightsOfReply)} />
        <IconStat icon={STAT_ICONS.docs} label={t('sb_stat_wp_dr')} value={`${row.workingPapers} / ${row.draftResolutions}`}
          title={fmt(t('sb_title_wp_dr'), { wp: row.workingPapers, dr: row.draftResolutions })} tint={TINT.sage} />
        <IconStat icon={STAT_ICONS.notes} label={t('sb_stat_chair_notes')} value={String(comments.length)} tint={TINT.amber} />
        {/* OBJECTIVE, NOT THE BADGE above: the ledger below sums to this, and
            whenever a quality blend is set the two legitimately differ. */}
        <IconStat
          icon={STAT_ICONS.points} tint={TINT.gold}
          label={row.quality != null && row.headline !== row.objective ? t('sb_stat_objective_pts') : t('sb_stat_points')}
          value={String(row.objective)}
          title={row.quality != null ? fmt(t('sb_title_ledger_blended'), { headline: row.headline, quality: row.quality }) : t('sb_title_ledger')}
        />
        <IconStat icon={STAT_ICONS.quality} tint={TINT.sage} label={t('sb_stat_quality')}
          value={row.quality != null ? String(row.quality) : t('sb_quality_unrated')} title={t('sb_title_quality')} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22 }}>
        {/* ── POINTS ─────────────────────────────────────────────────────── */}
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <SectionHead icon={Coins} label={t('sb_section_points_breakdown')} tint={TINT.gold}
            trailing={grouped.length ? `${row.objective}` : undefined} />
          {grouped.length === 0 && empty(t('sb_empty_no_scored'))}
          {grouped.map((g) => (
            <div key={g.sourceId} style={{ marginBlockEnd: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: NEU.forest, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {g.label}
                </span>
                <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, marginInlineStart: 'auto', fontVariantNumeric: 'tabular-nums', color: g.subtotal < 0 ? RED : NEU.forest }}>
                  {g.subtotal < 0 ? '' : '+'}{g.subtotal}
                </span>
              </div>
              {g.rows.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
                  <span style={{ fontFamily: OUTFIT, fontSize: 11.5, color: SOFT, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.detail || r.label}
                    {r.timestamp ? ` · ${stamp(r.timestamp)}` : ''}
                  </span>
                  <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontVariantNumeric: 'tabular-nums', color: r.pts < 0 ? RED : NEU.ink, flexShrink: 0 }}>
                    {r.pts < 0 ? '' : '+'}{r.pts}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ── RATINGS + COMMENTS ─────────────────────────────────────────── */}
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <SectionHead icon={Star} label={t('sb_section_chair_ratings')} tint={TINT.sage}
            trailing={row.quality != null ? `${row.quality}/100` : undefined} />
          {row.factors.length === 0 ? (
            <div style={{ marginBlockEnd: 16 }}>{empty(t('sb_empty_no_ratings'))}</div>
          ) : (
            <div style={{ marginBlockEnd: 16 }}>
              {row.factors.map((f) => {
                const pct = Math.max(0, Math.min(100, (f.average / Math.max(1, f.scaleMax)) * 100));
                return (
                  <div key={f.id} style={{ marginBlockEnd: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBlockEnd: 3 }}>
                      <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, color: NEU.ink }}>{f.name}</span>
                      <span
                        style={{ fontFamily: OUTFIT, fontSize: 11, color: SOFT, marginInlineStart: 'auto', fontVariantNumeric: 'tabular-nums' }}
                        title={fmt(f.ratings === 1 ? t('sb_title_factor_avg_one') : t('sb_title_factor_avg_many'), { n: f.ratings })}
                      >
                        {f.average} / {f.scaleMax}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, backgroundColor: 'rgba(27,56,40,0.09)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, backgroundColor: NEU.forest }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <SectionHead icon={MessageSquareQuote} label={t('sb_section_chair_comments')} tint={TINT.amber}
            trailing={comments.length ? String(comments.length) : undefined} />
          {comments.length === 0 ? empty(t('sb_empty_no_comments')) : comments.map((c) => (
            <div
              key={c.id}
              style={{
                backgroundColor: NEU.surface, border: `1px solid ${CARD_BORDER_COLOR}`,
                // Concentric: 10px inner radius + the 9/11px padding of the card.
                borderRadius: 10, padding: '9px 11px', marginBlockEnd: 7,
                borderInlineStart: `3px solid ${TINT.amber.fg}`,
              }}
            >
              <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink, lineHeight: 1.5, textWrap: 'pretty' }}>{c.content}</p>
              <p style={{ fontFamily: OUTFIT, fontSize: 10.5, color: SOFT, marginBlockStart: 5 }}>
                {c.chairName ? <strong style={{ color: NEU.forest, fontWeight: 700 }}>{c.chairName}</strong> : null}
                {c.chairName && commentMeta(c) ? ' · ' : ''}
                {commentMeta(c)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── TIMELINE ───────────────────────────────────────────────────────
          The same ledger rows as POINTS, read the other way: in the order they
          happened, newest first, each wearing the glyph of what it was. A chair
          defending an award wants "what did they do, and when", which the
          by-source fold above genuinely cannot answer. */}
      <div style={{ marginBlockStart: 18 }}>
        <SectionHead icon={History} label={t('sb_section_timeline')} tint={TINT.forest}
          trailing={timeline.length ? String(timeline.length) : undefined} />
        {timeline.length === 0 ? empty(t('sb_empty_no_timeline')) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {timeline.map((r, i) => {
              const Icon = eventIcon(r.type);
              return (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0', borderBlockEnd: i < timeline.length - 1 ? `1px solid ${CARD_BORDER_COLOR}` : 'none' }}>
                  <span
                    aria-hidden
                    className="inline-flex items-center justify-center"
                    style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, backgroundColor: 'rgba(27,56,40,0.07)', color: NEU.forest }}
                  >
                    <Icon size={13} strokeWidth={2.3} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, color: NEU.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.label}
                      {r.type === 'speech' && r.context ? <span style={{ fontWeight: 600, color: SOFT }}>{` · ${ctxLabel(r.context)}`}</span> : null}
                    </span>
                    <span style={{ display: 'block', fontFamily: OUTFIT, fontSize: 10.5, color: SOFT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[r.detail, r.timestamp ? stamp(r.timestamp) : ''].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span style={{ flexShrink: 0, fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: r.pts < 0 ? RED : NEU.forest }}>
                    {r.pts < 0 ? '' : '+'}{r.pts}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {extra}
    </div>
  );
}
