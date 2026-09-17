'use client';

// ─────────────────────────────────────────────────────────────────────────────
// src/components/scoreboard/HistoryTab.tsx
//
// THE SESSION, IN THE ORDER IT HAPPENED — the Scoreboard's third tab, beside
// Ranking and Matrix.
//
// The Ranking and Matrix tabs both answer "who did how much". Neither can answer
// "what actually happened in that caucus", which is the question a chair is asked
// at the closing ceremony and the one an awards decision has to survive. This tab
// answers it: every debate segment of the session, newest first, and under each
// one every speech that was given in it — who spoke, for how long, and what the
// chairs wrote about it, with the author's name on the note.
//
// A SEGMENT IS A MOTION'S DEBATE. `buildSessionHistory` (src/lib/sessionHistory.ts)
// derives them from the log: a run of speeches sharing a speaking context and a
// topic is one segment (a caucus, or a stretch of the General Speakers' List).
// The header says only which kind of debate it was, when, and how long was
// spoken; each row says who spoke, when and for how long, with the chair comment
// inline. No topic is printed (17 Sep 2026, owner): the caucus purpose rides in
// the header's tooltip only.
// Motions raised, rights of reply and manual awards sit in the segment that was
// running when they happened, in time order with the speeches.
//
// COLLAPSIBLE, NEWEST OPEN. The segment the committee is in (or has just left) is
// expanded on arrival and every older one is closed, because that is the one a
// chair opening the board is almost always looking for. Opening another leaves
// this one open: comparing two caucuses is a real thing chairs do.
//
// CHAIR-PRIVATE. Chair notes are rendered here. Mounted only by
// `ScoreboardPanel`, which is mounted only by `/chair/[code]`. A delegate surface
// must never import this (CLAUDE.md §2).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import {
  ChevronRight, ListOrdered, Gavel, Users, MicVocal, CircleDot, Clock,
  type LucideIcon,
} from 'lucide-react';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import { SOFT, RED, CARD_BORDER_COLOR } from '@/components/scoreboardTokens';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { getCountryDisplayName } from '@/lib/countries';
import { formatSpeakingTime } from '@/lib/conferenceScoreboard';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import type { Committee } from '@/lib/types';
import type { FeedbackEntry } from '@/lib/committeeService';
import {
  buildSessionHistory, type HistorySpeech, type HistoryEvent, type SegmentKind,
} from '@/lib/sessionHistory';
import { eventIcon, TINT } from './SessionScoreboardParts';

const KIND_ICON: Record<SegmentKind, LucideIcon> = {
  'speakers-list': ListOrdered,
  'moderated-caucus': Gavel,
  'unmoderated-caucus': Users,
  'tour-de-table': MicVocal,
  other: CircleDot,
};

export default function HistoryTab({ committee, feedback }: {
  committee: Committee;
  /** The same rows the panel loaded for the Ranking tab. Chair-private. */
  feedback: FeedbackEntry[];
}) {
  const t = useT();
  const { language } = useLanguage();
  const dateLocale = language === 'en' ? 'en-GB' : language;

  const segments = useMemo(() => buildSessionHistory(committee, feedback), [committee, feedback]);

  // `null` = nobody has pressed anything yet, so the newest segment reads as open
  // and the rest as closed. Materialised on the first press. Deriving it this way
  // rather than in an effect keeps the default correct when the log grows under a
  // chair's hands (a speech landing must not collapse what they are reading) and
  // costs no cascading render.
  const [openIds, setOpenIds] = useState<Set<string> | null>(null);
  const isOpen = (id: string, i: number) => (openIds ? openIds.has(id) : i === 0);
  const toggle = (id: string) => setOpenIds((prev) => {
    const next = new Set(prev ?? (segments.length ? [segments[0].id] : []));
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const stamp = (iso: string) => (iso
    ? new Date(iso).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })
    : '');

  const kindLabel = (k: SegmentKind): string => {
    switch (k) {
      case 'speakers-list': return t('sb_hist_seg_gsl');
      case 'moderated-caucus': return t('sb_hist_seg_moderated');
      case 'unmoderated-caucus': return t('sb_hist_seg_unmoderated');
      case 'tour-de-table': return t('sb_hist_seg_tour');
      default: return t('sb_hist_seg_other');
    }
  };

  const eventLabel = (e: HistoryEvent): string => {
    switch (e.type) {
      case 'motion-raised': return t('sb_hist_motion_raised');
      case 'right-of-reply': return t('sb_hist_right_of_reply');
      case 'manual-award': return t('sb_hist_award');
      case 'manual-deduct': return t('sb_hist_deduct');
      default: return e.note || e.type;
    }
  };

  if (segments.length === 0) {
    return (
      <p style={{ fontFamily: OUTFIT, fontSize: 13, color: SOFT, textAlign: 'center', padding: '40px 0', textWrap: 'pretty' }}>
        {t('sb_hist_empty')}
      </p>
    );
  }

  // ── One speech: who, how long, when, and what the chairs wrote ──────────
  // No context label and no topic on the row (17 Sep 2026, owner): the segment
  // header already says GSL or moderated caucus, and repeating the committee
  // topic or the caucus purpose on every line was noise. The chair comment sits
  // where the topic used to be.
  const renderSpeech = (s: HistorySpeech) => (
    <li style={{ display: 'flex', gap: 10, paddingBlock: 7, borderBlockEnd: `1px solid ${CARD_BORDER_COLOR}` }}>
      <SeatCircleFlag country={s.country} size={26} decorative style={{ marginBlockStart: 1 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, minHeight: 26 }}>
          <span style={{ flex: 1, minWidth: 0, fontFamily: OUTFIT, fontWeight: 700, fontSize: 13, color: NEU.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', alignSelf: 'center' }}>
            {getCountryDisplayName(s.country, language)}
          </span>
          <span style={{ flexShrink: 0, alignSelf: 'center', fontFamily: OUTFIT, fontSize: 11, color: SOFT, fontVariantNumeric: 'tabular-nums' }}>
            {stamp(s.timestamp)}
          </span>
          <span
            style={{
              flexShrink: 0, alignSelf: 'center', minWidth: 52, textAlign: 'end',
              fontFamily: OUTFIT, fontWeight: 800, fontSize: 12.5, color: NEU.forest,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatSpeakingTime(s.seconds)}
          </span>
        </span>
        {s.notes.map((n) => (
          <span
            key={n.id}
            style={{
              display: 'block', marginBlockStart: 2, paddingInlineStart: 9,
              borderInlineStart: `2px solid ${TINT.amber.fg}`,
              fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink, lineHeight: 1.45, textWrap: 'pretty',
            }}
          >
            {n.content}
            <span style={{ color: SOFT, fontSize: 11, whiteSpace: 'nowrap' }}>{` · ${n.chairName || t('fb_chair')}`}</span>
          </span>
        ))}
      </span>
    </li>
  );

  // ── A motion raised, a right of reply, a manual adjustment ────────────────
  const renderEvent = (e: HistoryEvent) => {
    const Icon = eventIcon(e.type);
    const signed = e.type === 'manual-deduct' ? -Math.abs(e.value ?? 0) : e.type === 'manual-award' ? Math.abs(e.value ?? 0) : null;
    return (
      <li style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBlock: 7, borderBlockEnd: `1px solid ${CARD_BORDER_COLOR}` }}>
        {/* Same 26px column as a speech row's flag, so every row lines up. */}
        <span aria-hidden className="inline-flex items-center justify-center" style={{ width: 26, flexShrink: 0, color: SOFT }}>
          <Icon size={14} strokeWidth={2.3} />
        </span>
        <span style={{ flex: 1, minWidth: 0, fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <strong style={{ fontWeight: 700 }}>{getCountryDisplayName(e.country, language)}</strong>
          {` · ${eventLabel(e)}`}
          {e.note && e.type.startsWith('manual') ? <span style={{ color: SOFT }}>{` · ${e.note}`}</span> : null}
        </span>
        <span style={{ flexShrink: 0, fontFamily: OUTFIT, fontSize: 11, color: SOFT, fontVariantNumeric: 'tabular-nums' }}>
          {stamp(e.timestamp)}
        </span>
        <span style={{ flexShrink: 0, minWidth: 52, textAlign: 'end', fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: signed != null && signed < 0 ? RED : NEU.forest }}>
          {signed != null ? `${signed < 0 ? '' : '+'}${signed}` : ''}
        </span>
      </li>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {segments.map((seg, i) => {
        const open = isOpen(seg.id, i);
        const Icon = KIND_ICON[seg.kind];
        // One chronological stream: speeches and events interleaved as they
        // happened, which is how a chair reads a caucus back.
        const items: ({ kind: 'speech'; at: string; s: HistorySpeech } | { kind: 'event'; at: string; e: HistoryEvent })[] = [
          ...seg.speeches.map((s) => ({ kind: 'speech' as const, at: s.timestamp, s })),
          ...seg.events.map((e) => ({ kind: 'event' as const, at: e.timestamp, e })),
        ].sort((a, b) => (a.at || '').localeCompare(b.at || ''));

        return (
          <section
            key={seg.id}
            style={{
              backgroundColor: NEU.surface, border: `1px solid ${CARD_BORDER_COLOR}`,
              // Concentric: the 14px card holds 10px note cards inside 12px padding.
              borderRadius: 14, boxShadow: open ? NEU.outSm : 'none', overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => toggle(seg.id)}
              aria-expanded={open}
              className="w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] gv-sb-seg"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, textAlign: 'start',
                background: open ? 'rgba(27,56,40,0.05)' : 'transparent', border: 'none',
                cursor: 'pointer', paddingInline: 12, paddingBlock: 10, minHeight: 52,
              }}
            >
              <span
                aria-hidden
                className="inline-flex items-center justify-center"
                style={{ width: 30, height: 30, borderRadius: 10, flexShrink: 0, backgroundColor: TINT.forest.bg, color: TINT.forest.fg }}
              >
                <Icon size={15} strokeWidth={2.4} />
              </span>
              {/* Just the kind of debate and when it opened. The caucus purpose
                  (or the committee topic) is in the tooltip, never on screen:
                  the owner asked for it not to be repeated. */}
              <span style={{ flex: 1, minWidth: 0 }} title={seg.topic || undefined}>
                <span style={{ display: 'block', fontFamily: OUTFIT, fontWeight: 800, fontSize: 13.5, color: NEU.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {kindLabel(seg.kind)}
                </span>
                {seg.startedAt && (
                  <span style={{ display: 'block', fontFamily: OUTFIT, fontSize: 11, color: SOFT, fontVariantNumeric: 'tabular-nums' }}>
                    {seg.endedAt && stamp(seg.endedAt) !== stamp(seg.startedAt)
                      ? `${stamp(seg.startedAt)} – ${stamp(seg.endedAt)}`
                      : stamp(seg.startedAt)}
                  </span>
                )}
              </span>
              {seg.totalSeconds > 0 && (
                <span
                  className="inline-flex items-center gap-1"
                  style={{ flexShrink: 0, fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: NEU.forest, fontVariantNumeric: 'tabular-nums' }}
                  title={t('sb_stat_speaking_time')}
                >
                  <Clock size={12} strokeWidth={2.4} aria-hidden style={{ color: SOFT }} />
                  {formatSpeakingTime(seg.totalSeconds)}
                </span>
              )}
              <ChevronRight
                size={15} aria-hidden
                style={{ flexShrink: 0, color: SOFT, transform: open ? 'rotate(90deg)' : 'none', transition: `transform 160ms ${EASE}` }}
              />
            </button>
            {open && (
              <div style={{ paddingInline: 12, paddingBlockEnd: 10, borderBlockStart: `1px solid ${CARD_BORDER_COLOR}` }}>
                {items.length === 0 ? (
                  <p style={{ fontFamily: OUTFIT, fontSize: 12, color: SOFT, paddingBlock: 12 }}>{t('sb_hist_no_speeches')}</p>
                ) : (
                  <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {items.map((it, k) => (
                      <React.Fragment key={k}>
                        {it.kind === 'speech' ? renderSpeech(it.s) : renderEvent(it.e)}
                      </React.Fragment>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
