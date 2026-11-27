'use client';

// The unassigned rail's payment filter (owner, 15 Nov 2026): allocate paid
// people first. Paid = moneyState 'paid' or 'none' (nothing owed); Not paid =
// everything else. Read from the invoices (src/lib/applicationMoney.ts), kept
// in the URL as ?pay=paid / ?pay=unpaid.

import { NEU, OUTFIT } from '@/components/neu';
import { moneySettled, type MoneyState } from '@/lib/applicationMoney';

export type RailPay = 'all' | 'paid' | 'unpaid';

export function railPayFromUrl(v: string | null): RailPay {
  return v === 'paid' || v === 'unpaid' ? v : 'all';
}

export function matchesRailPay(state: MoneyState, filter: RailPay): boolean {
  if (filter === 'all') return true;
  return filter === 'paid' ? moneySettled(state) : !moneySettled(state);
}

const CHOICES: { v: RailPay; label: string }[] = [
  { v: 'all', label: 'All' },
  { v: 'paid', label: 'Paid' },
  { v: 'unpaid', label: 'Not paid' },
];

export function RailPaymentFilter({ value, onChange }: { value: RailPay; onChange: (v: RailPay) => void }) {
  return (
    <div role="radiogroup" aria-label="Filter by payment" className="flex flex-wrap gap-1.5">
      {CHOICES.map(c => {
        const on = value === c.v;
        return (
          <button
            key={c.v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(c.v)}
            className="focus:outline-none"
            style={{
              flex: '1 1 auto', minHeight: 36, padding: '0 12px', borderRadius: 999,
              fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
              color: on ? '#EED98A' : NEU.ink, backgroundColor: on ? '#1B3828' : NEU.surface,
              border: 'none', boxShadow: on ? 'none' : NEU.outSm, cursor: 'pointer',
            }}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
