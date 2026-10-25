'use client';
// Gavelling Crisis: how a directive's state is said in words. Shared by the delegate and chair pages.

import {
  CheckCircle2, Clock, HelpCircle, Hourglass, Undo2, UserRoundCog, XCircle, CircleDot,
  Swords, Eye, Handshake, Coins, Newspaper, User, Landmark, VenetianMask, type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { OUTCOME_LABEL, type Directive, type DirectiveOutcome, type DirectiveStatus } from '@/lib/crisis/types';
import { CK } from '../../crisisKit';

export const STATUS_WORDS: Record<DirectiveStatus, string> = {
  queued: 'Waiting for the backroom',
  claimed: 'With a backroomer',
  clarify: 'More detail needed',
  answered: 'Answered',
  withdrawn: 'Withdrawn',
};

export function statusIcon(s: DirectiveStatus): ReactNode {
  const p = { size: 15, strokeWidth: 1.5, 'aria-hidden': true } as const;
  if (s === 'queued') return <Hourglass {...p} />;
  if (s === 'claimed') return <UserRoundCog {...p} />;
  if (s === 'clarify') return <HelpCircle {...p} />;
  if (s === 'answered') return <CheckCircle2 {...p} />;
  return <Undo2 {...p} />;
}

export function statusColor(s: DirectiveStatus): string {
  if (s === 'answered') return CK.ok;
  if (s === 'clarify') return CK.red;
  if (s === 'withdrawn') return CK.muted;
  return CK.goldDeep;
}

export function outcomeColor(o: DirectiveOutcome): string {
  if (o === 'approved') return CK.ok;
  if (o === 'partial') return CK.goldDeep;
  if (o === 'denied') return CK.danger;
  return CK.red;
}

export function outcomeIcon(o: DirectiveOutcome): ReactNode {
  const p = { size: 15, strokeWidth: 1.5, 'aria-hidden': true } as const;
  if (o === 'approved') return <CheckCircle2 {...p} />;
  if (o === 'denied') return <XCircle {...p} />;
  if (o === 'later') return <Clock {...p} />;
  if (o === 'clarify') return <HelpCircle {...p} />;
  return <CircleDot {...p} />;
}

/** "Approved" etc., or nothing while there is no outcome. */
export function OutcomeLine({ d }: { d: Pick<Directive, 'outcome'> }) {
  if (!d.outcome) return null;
  return (
    <span className="inline-flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 800, color: outcomeColor(d.outcome) }}>
      {outcomeIcon(d.outcome)}
      {OUTCOME_LABEL[d.outcome]}
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

export function whenLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

const THEME_ICONS: Record<string, LucideIcon> = {
  Military: Swords, Intelligence: Eye, Diplomatic: Handshake, Economic: Coins, Press: Newspaper, Personal: User, Political: Landmark, Covert: VenetianMask,
};

/** The line icon for a theme (fine line, bare ink). */
export function themeIcon(theme: string, size = 16): ReactNode {
  const I = THEME_ICONS[theme] ?? CircleDot;
  return <I size={size} strokeWidth={1.5} aria-hidden />;
}
