'use client';

// ONE card format for every motion on the floor (Oct 2026, TY7ZZ3 / Asia WorldMUN: "the motion's
// name and topic are very hard to see; unmods are not in the same format; show the flag of the
// delegate that raised it"). Used by MotionsModal's voting view (the motion being voted on and
// the queue column) and its list view, for every type: moderated, unmoderated, consultation,
// Tour de Table (A-Z, Z-A, Room Order), Custom, Suspend and End Debate.
//
// Layout, top to bottom, the same for every type:
//   1. the motion's name (the committee's own motion names; a Custom motion's own name)
//   2. its topic, when it has one
//   3. who raised it: a ROUND flag (initials for a custom seat, a gavel disc for the chair)
//      and the delegation's name, which wraps to a second line and is never cut off
//   4. the times, always in the same three slots: Total | Per speaker | Speakers (or Order
//      for a Tour de Table). A type that has none of them draws no row.
//
// Projector rules (item 14): no text under 13px at the 1280x820 FitToScreen layout, times and
// rank numbers in tabular figures, and every text colour at least 4.5:1 on the modal's ivory
// (#FAF8F3): ink #1C1410 17.1:1, forest #1B3828 12.0:1, SOFT #5A4A3C 8.0:1. Presentation only:
// nothing here writes or decides anything.

import React from 'react';
import { Gavel } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import type { PendingMotion } from '@/lib/types';
import { getCountryDisplayName } from '@/lib/countries';
import { caucusQueueCapacity } from '@/lib/committeeService';
import { SeatCircleFlag } from '@/components/CircleFlag';

export const MOTION_CHAIR_KEY = '__chair__';

/** Readable secondary ink on ivory: 7.98:1 on #FAF8F3, 6.9:1 on #EDE7D8. Never #9A8A78 (3.15:1). */
export const MOTION_SOFT = '#5A4A3C';
const INK = '#1C1410';
const FOREST = '#1B3828';

export type MotionCardSize = 'primary' | 'queue' | 'list';

const SIZES: Record<MotionCardSize, {
  name: number; topic: number; topicLabel: number; flag: number; who: number; whoLabel: number;
  factLabel: number; factValue: number; gap: number;
}> = {
  // Was: name 30px, topic 24px, timings 14px, a 56x40 rectangle flag with no name.
  primary: { name: 34, topic: 24, topicLabel: 15, flag: 44, who: 20, whoLabel: 13, factLabel: 14, factValue: 28, gap: 12 },
  // Was: name 18px, topic 16px, timings 12px, a 32x24 rectangle flag with no name.
  queue:   { name: 20, topic: 16, topicLabel: 13, flag: 30, who: 15, whoLabel: 13, factLabel: 13, factValue: 18, gap: 8 },
  // Was: name 16px, proposer 14px with a 20px rectangle, topic 14px #6A5A4A, 12px pills.
  list:    { name: 20, topic: 16, topicLabel: 13, flag: 30, who: 15, whoLabel: 13, factLabel: 13, factValue: 18, gap: 8 },
};

/** m:ss, the way every clock in the room reads ("10:00", "1:30", "0:45"). */
export function motionClock(totalSecs: number): string {
  const s = Math.max(0, Math.round(totalSecs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function ProposerFlag({ proposedBy, size }: { proposedBy: string; size: number }) {
  if (proposedBy === MOTION_CHAIR_KEY) {
    return (
      <span aria-hidden className="inline-flex items-center justify-center rounded-full shrink-0"
        style={{ width: size, height: size, backgroundColor: FOREST, color: '#EED98A' }}>
        <Gavel size={Math.round(size * 0.52)} strokeWidth={2.2} />
      </span>
    );
  }
  return (
    <SeatCircleFlag country={proposedBy} size={size} decorative fallback="initials"
      monogramColors={{ bg: FOREST, fg: '#EED98A' }}
      style={{ boxShadow: '0 1px 3px rgba(28,20,16,0.18)' }} />
  );
}

/** The rank disc that straddles a card's top corner: big tabular numerals, gold on forest (9.1:1). */
export function MotionRankBadge({ n, large = false }: { n: number; large?: boolean }) {
  const t = useT();
  const px = large ? 34 : 30;
  return (
    <div
      role="img" aria-label={t('motion_card_rank', { n })}
      className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center z-10 pointer-events-none select-none tabular-nums"
      style={{ width: px, height: px, backgroundColor: FOREST, color: '#EED98A', fontSize: large ? 17 : 15, fontWeight: 900, boxShadow: '0 2px 6px rgba(27,56,40,0.30)' }}
    >
      {n}
    </div>
  );
}

export function MotionSummary({ motion, label, size, language, titleAddon }: {
  motion: PendingMotion;
  /** The name to show (motionDisplayLabel: the committee's renamed motion name, or a Custom motion's own). */
  label: string;
  size: MotionCardSize;
  language: string;
  /** Rendered right after the name, on its line (the queue card's edit pencil). */
  titleAddon?: React.ReactNode;
}) {
  const t = useT();
  const z = SIZES[size];
  const m = motion;
  const isCustom = m.type === 'custom';
  const isProcedural = m.type === 'suspend-debate' || m.type === 'end-debate';
  // A Custom motion's `topic` IS its name, already the title.
  const topic = !isCustom && m.topic?.trim() ? m.topic.trim() : '';

  const whoName = !m.proposedBy ? '' : m.proposedBy === MOTION_CHAIR_KEY
    ? t('motion_card_chair')
    : getCountryDisplayName(m.proposedBy, language);

  // The three fixed slots. A slot a type does not have is drawn empty, so Total is always in
  // the first column and Per speaker always in the second, whatever the motion.
  type Fact = { label: string; value: string; title?: string } | null;
  let facts: [Fact, Fact, Fact] = [null, null, null];
  if (!isCustom && !isProcedural) {
    const total: Fact = m.totalTime > 0 ? { label: t('motion_card_total'), value: motionClock(m.totalTime) } : null;
    const per: Fact = (m.type === 'moderated' || m.type === 'tour') && m.speakingTime > 0
      ? { label: t('motion_card_per_speaker'), value: motionClock(m.speakingTime) } : null;
    let third: Fact = null;
    if (m.type === 'moderated' && m.speakingTime > 0 && m.totalTime > 0) {
      const n = caucusQueueCapacity(m.totalTime, m.speakingTime, 0, 0);
      const rem = m.totalTime % m.speakingTime;
      third = {
        label: t('motion_card_speakers'),
        value: rem ? `${n}*` : String(n),
        title: rem ? t('motion_card_last_short', { n: rem }) : undefined,
      };
    } else if (m.type === 'tour') {
      third = {
        label: t('motion_card_order'),
        value: m.tourOrder === 'desc' ? t('motions_za') : m.tourOrder === 'custom' ? t('motions_room_order') : t('motions_az'),
      };
    }
    facts = [total, per, third];
  }
  const hasFacts = facts.some(Boolean);

  return (
    <div className="flex flex-col min-w-0" style={{ gap: z.gap }}>
      {/* 1. Name */}
      <div className="flex items-start gap-2 min-w-0">
        <span className="min-w-0 [overflow-wrap:anywhere]"
          style={{ fontSize: z.name, lineHeight: 1.12, fontWeight: 900, color: INK }}>
          {label}
        </span>
        {titleAddon}
      </div>

      {/* 2. Topic */}
      {topic && (
        <p className="min-w-0 [overflow-wrap:anywhere]" style={{ fontSize: z.topic, lineHeight: 1.25, fontWeight: 600, color: INK }}>
          <span style={{ fontSize: z.topicLabel, fontWeight: 800, color: FOREST, letterSpacing: '0.02em', marginInlineEnd: 6 }}>
            {t('motion_card_topic')}
          </span>
          {topic}
        </p>
      )}

      {/* 3. Who raised it */}
      {m.proposedBy ? (
        <div className="flex items-center min-w-0" style={{ gap: size === 'primary' ? 12 : 9 }}>
          <ProposerFlag proposedBy={m.proposedBy} size={z.flag} />
          <div className="min-w-0 flex flex-col">
            <span style={{ fontSize: z.whoLabel, lineHeight: 1.2, fontWeight: 600, color: MOTION_SOFT }}>{t('motion_card_raised_by')}</span>
            <span className="[overflow-wrap:anywhere]" style={{ fontSize: z.who, lineHeight: 1.18, fontWeight: 800, color: INK }}>{whoName}</span>
          </div>
        </div>
      ) : (
        <span style={{ fontSize: z.who, fontWeight: 600, color: MOTION_SOFT }}>{t('motion_card_no_proposer')}</span>
      )}

      {/* 4. Times, three fixed slots. Labels first, values second, so the values of every
          column share one baseline even when a label wraps. */}
      {hasFacts && (
        <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 min-w-0">
          {facts.map((f, i) => (
            <span key={`l${i}`} className="self-end [overflow-wrap:anywhere]"
              style={{ fontSize: z.factLabel, lineHeight: 1.15, fontWeight: 700, color: MOTION_SOFT }}>
              {f?.label ?? ''}
            </span>
          ))}
          {facts.map((f, i) => (
            <span key={`v${i}`} title={f?.title} className="tabular-nums [overflow-wrap:anywhere]"
              style={{ fontSize: f && i === 2 && m.type === 'tour' ? Math.round(z.factValue * 0.72) : z.factValue, lineHeight: 1.1, fontWeight: 900, color: FOREST }}>
              {f?.value ?? ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
