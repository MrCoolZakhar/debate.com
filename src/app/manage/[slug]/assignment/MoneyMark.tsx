'use client';

// A person's money as icon + word (owner, 15 Nov 2026), read from the invoices
// through src/lib/applicationMoney.ts, never applications.payment_status.
// Style A: a fine-line Lucide icon in bare ink, no pill, no tile.

import { CircleCheck, Clock, FileSearch, MinusCircle, Wallet } from 'lucide-react';
import { OUTFIT } from '@/components/neu';
import { moneyLabel, type MoneyState } from '@/lib/applicationMoney';

const ICON = { paid: CircleCheck, review: FileSearch, started: Clock, part: Wallet, owes: Wallet, none: MinusCircle } as const;
const TONE: Record<MoneyState, string> = {
  paid: '#2A5A3C', review: '#7A5A10', started: '#5A4E42', part: '#8A6614', owes: '#8A6614', none: '#5A4E42',
};

export default function MoneyMark({ state, hideNone = false, color, size = 12 }: {
  state: MoneyState;
  /** Draw nothing for 'none' (the Assignment rail). */
  hideNone?: boolean;
  /** Overrides the tone, for a mark on a dark row. */
  color?: string;
  size?: number;
}) {
  if (hideNone && state === 'none') return null;
  const Icon = ICON[state];
  return (
    <span className="inline-flex items-center gap-1" style={{ fontFamily: OUTFIT, fontSize: size, fontWeight: 700, color: color ?? TONE[state], whiteSpace: 'nowrap', flexShrink: 0 }}>
      <Icon size={size + 2} strokeWidth={1.6} aria-hidden="true" />
      {moneyLabel(state)}
    </span>
  );
}
