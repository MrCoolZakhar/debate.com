'use client';
// Gavelling Crisis: how a directive's state is said in words, colour and icon. Shared by the delegate
// and chair pages (the chair page uses StatusLine and whenLabel).

import {
  CheckCircle2, CircleDot, CircleHelp, Clock, Contrast, Gavel, Hourglass, Undo2, UserRoundCog, XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { OUTCOME_LABEL, type Directive, type DirectiveKind, type DirectiveOutcome, type DirectiveStatus } from '@/lib/crisis/types';
import { CHAIR_SEND_BACK_WORD, isChairSendBack, timeAgo } from '@/lib/crisis/format';
import { CK, THEME_STYLE } from '../../crisisKit';
import { KIND_ICON } from '../directives/directiveKit';

export const STATUS_WORDS: Record<DirectiveStatus, string> = {
  awaiting_chair: 'With your chair',
  queued: 'Waiting for the backroom',
  claimed: 'With a backroomer',
  clarify: 'More detail needed',
  answered: 'Answered',
  withdrawn: 'Withdrawn',
};

export function statusIcon(s: DirectiveStatus, size = 15): ReactNode {
  const p = { size, strokeWidth: 1.5, 'aria-hidden': true } as const;
  if (s === 'awaiting_chair') return <Gavel {...p} />;
  if (s === 'queued') return <Hourglass {...p} />;
  if (s === 'claimed') return <UserRoundCog {...p} />;
  if (s === 'clarify') return <CircleHelp {...p} />;
  if (s === 'answered') return <CheckCircle2 {...p} />;
  return <Undo2 {...p} />;
}

export function statusColor(s: DirectiveStatus): string {
  if (s === 'answered') return CK.ok;
  if (s === 'awaiting_chair') return PLUM;
  if (s === 'clarify') return BLUE;
  if (s === 'withdrawn') return CK.muted;
  return CK.goldDeep;
}

const BLUE = '#2F5F8F';
/** A cabinet directive waiting for the chair: its own colour, apart from the backroom's gold. */
const PLUM = '#7B3F61';

/** approved green, partly works gold, denied red, more detail needed blue, answer later grey. */
export function outcomeColor(o: DirectiveOutcome): string {
  if (o === 'approved') return CK.ok;
  if (o === 'partial') return CK.goldDeep;
  if (o === 'denied') return CK.danger;
  if (o === 'clarify') return BLUE;
  return CK.muted;
}

export function outcomeIcon(o: DirectiveOutcome, size = 15): ReactNode {
  const p = { size, strokeWidth: 1.5, 'aria-hidden': true } as const;
  if (o === 'approved') return <CheckCircle2 {...p} />;
  if (o === 'denied') return <XCircle {...p} />;
  if (o === 'later') return <Clock {...p} />;
  if (o === 'clarify') return <CircleHelp {...p} />;
  return <Contrast {...p} />;
}

export const KIND_WORD: Record<DirectiveKind, string> = {
  personal: 'Personal', joint: 'Joint', committee: 'Cabinet', press_release: 'Press release', communique: 'Communiqué',
};

/** The kind's icon: the ONE map is KIND_ICON in directives/directiveKit.ts. */
export function kindIcon(k: DirectiveKind, size = 15): ReactNode {
  const I = KIND_ICON[k];
  return <I size={size} strokeWidth={1.5} aria-hidden />;
}

/** What the delegate reads as a directive's verdict. A directive its chair turned back is "Sent back by your chair" (plum, never the denied red). */
export function verdictOf(d: Pick<Directive, 'status' | 'reply' | 'outcome'>, size = 15): { word: string; color: string; icon: ReactNode } {
  if (isChairSendBack(d)) return { word: CHAIR_SEND_BACK_WORD, color: PLUM, icon: <Undo2 size={size} strokeWidth={1.5} aria-hidden /> };
  if (d.outcome) return { word: OUTCOME_LABEL[d.outcome], color: outcomeColor(d.outcome), icon: outcomeIcon(d.outcome, size) };
  return { word: STATUS_WORDS[d.status], color: statusColor(d.status), icon: statusIcon(d.status, size) };
}

/** "Approved" etc., or nothing while there is no outcome. */
export function OutcomeLine({ d }: { d: Pick<Directive, 'status' | 'reply' | 'outcome'> }) {
  if (!d.outcome) return null;
  const v = verdictOf(d);
  return (
    <span className="inline-flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 800, color: v.color }}>
      {v.icon}
      {v.word}
    </span>
  );
}

export function StatusLine({ s }: { s: DirectiveStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 700, color: statusColor(s) }}>
      {statusIcon(s)}
      {STATUS_WORDS[s]}
    </span>
  );
}

/** Real-world time as "12 min ago" (the crisis has its own in-world date, so never a calendar date). */
export function whenLabel(iso: string | null | undefined): string {
  return timeAgo(iso);
}

/** The exact time, for a title tooltip. */
export function whenTitle(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  try { return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return undefined; }
}

/** The line icon for a theme, in the theme's own colour. */
export function themeIcon(theme: string, size = 16): ReactNode {
  const t = THEME_STYLE[theme];
  const I = t?.Icon ?? CircleDot;
  return <span style={{ color: t?.color ?? CK.muted, lineHeight: 0 }}><I size={size} strokeWidth={1.5} aria-hidden /></span>;
}
