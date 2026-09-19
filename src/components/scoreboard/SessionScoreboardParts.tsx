'use client';

// ─────────────────────────────────────────────────────────────────────────────
// src/components/scoreboard/SessionScoreboardParts.tsx
//
// The small shared pieces of the CHAIR's scoreboard — the figure chips at the
// top, the icon-led section headings, and the one table of "which glyph means
// which kind of event". SESSION ONLY: this folder exists so the chair's board can
// be redesigned without touching one pixel of the organiser's, which renders the
// same `ScoreboardTable` and is English by design. These primitives take their
// strings as props; the two callers in this folder do the translating with
// `useT()`. Nothing under `src/app/manage` imports anything in here.
//
// WHY ICONS AT ALL. The owner's reading of the old board: "all tabs look the
// same". Four identical ivory tiles of 10px capitals, then four identical
// sections of 10px capitals, are genuinely hard to tell apart at a glance from
// the dais. A glyph is the fastest possible label — a microphone is a speech
// before you have read anything — so every figure and every section now leads
// with one, and each section carries its own tint so the eye can jump to the
// part it wants instead of reading four headings to find it.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  Mic, Clock, Gavel, CornerUpLeft, FileText, MessageSquareQuote, Coins, Star,
  Award, ScrollText, CheckCircle2, UserCheck, Sparkles, Users, type LucideIcon,
} from 'lucide-react';
import { NEU, NeuInset, OUTFIT } from '@/components/neu';
import { SOFT, CARD_BORDER_COLOR } from '@/components/scoreboardTokens';

/** Section tints. Each section of the drill-in gets its own, so the four no
 *  longer read as one undifferentiated column of capitals. */
export const TINT = {
  forest: { fg: NEU.forest, bg: 'rgba(27,56,40,0.10)' },
  gold: { fg: '#7A5B12', bg: 'rgba(238,217,138,0.42)' },
  amber: { fg: '#8A5A2E', bg: 'rgba(184,132,74,0.16)' },
  sage: { fg: '#2F6045', bg: 'rgba(47,96,69,0.12)' },
} as const;

export type Tint = typeof TINT[keyof typeof TINT];

/**
 * One figure, led by its glyph. Replaces the plain `Stat` tile on the chair's
 * surfaces only — the organiser board keeps `Stat` from ScoreboardTable, which
 * is untouched.
 *
 * `compact` is the top-of-panel strip (one line, chip-shaped); the default is
 * the tile used inside a delegation's profile.
 */
export function IconStat({
  icon: Icon, label, value, title, compact = false, tint = TINT.forest,
}: {
  icon: LucideIcon; label: string; value: string; title?: string;
  compact?: boolean; tint?: Tint;
}) {
  if (compact) {
    return (
      <span
        title={title}
        className="inline-flex items-center gap-2 rounded-full"
        style={{
          backgroundColor: NEU.surface, border: `1px solid ${CARD_BORDER_COLOR}`,
          boxShadow: NEU.outSm, paddingInline: 11, paddingBlock: 6, minHeight: 34,
        }}
      >
        <span
          aria-hidden
          className="inline-flex items-center justify-center rounded-full"
          style={{ width: 22, height: 22, backgroundColor: tint.bg, color: tint.fg, flexShrink: 0 }}
        >
          <Icon size={12.5} strokeWidth={2.4} />
        </span>
        <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 14.5, color: NEU.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
        <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.09em', color: SOFT, lineHeight: 1, whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </span>
    );
  }
  return (
    <NeuInset className="text-center" style={{ padding: '9px 12px', borderRadius: 12, flex: '1 1 96px', minWidth: 0 }}>
      <span
        aria-hidden
        className="inline-flex items-center justify-center rounded-full"
        style={{ width: 22, height: 22, backgroundColor: tint.bg, color: tint.fg, marginBlockEnd: 5 }}
      >
        <Icon size={12.5} strokeWidth={2.4} />
      </span>
      <p title={title} style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 19, color: NEU.ink, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </p>
      <p title={title} style={{ fontFamily: OUTFIT, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.1em', color: SOFT, marginBlockStart: 5 }}>
        {label}
      </p>
    </NeuInset>
  );
}

/** An icon-led section heading, with an optional figure on the trailing end. */
export function SectionHead({
  icon: Icon, label, trailing, tint = TINT.forest,
}: { icon: LucideIcon; label: string; trailing?: React.ReactNode; tint?: Tint }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBlockEnd: 9 }}>
      <span
        aria-hidden
        className="inline-flex items-center justify-center"
        style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: tint.bg, color: tint.fg, flexShrink: 0 }}
      >
        <Icon size={13} strokeWidth={2.4} />
      </span>
      <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.12em', color: NEU.forest }}>
        {label}
      </span>
      {trailing != null && (
        <span style={{ marginInlineStart: 'auto', fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: SOFT, fontVariantNumeric: 'tabular-nums' }}>
          {trailing}
        </span>
      )}
    </div>
  );
}

/** Which glyph a ledger row / log event wears. One table, so the profile's
 *  timeline and the history tab can never label the same event differently. */
export function eventIcon(type: string): LucideIcon {
  switch (type) {
    case 'speech': return Mic;
    case 'motion-raised': return Gavel;
    case 'motion-passed': return Gavel;
    case 'motion': return Gavel;
    case 'right-of-reply': return CornerUpLeft;
    case 'manual-award': return Award;
    case 'manual-deduct': return Award;
    case 'wp': return FileText;
    case 'dr': return ScrollText;
    case 'drPassed': return CheckCircle2;
    case 'attendance': return UserCheck;
    default: return Sparkles;
  }
}

export const STAT_ICONS = {
  delegations: Users,
  speeches: Mic,
  time: Clock,
  motions: Gavel,
  rtr: CornerUpLeft,
  docs: FileText,
  notes: MessageSquareQuote,
  points: Coins,
  quality: Star,
} as const;
