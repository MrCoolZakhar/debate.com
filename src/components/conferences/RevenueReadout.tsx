'use client';

import Link from 'next/link';
import { ArrowRight, Wallet } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { formatFee } from '@/lib/utils';
import { moneyFromCents, type ConferenceMoney } from '@/lib/conferenceMoney';

// ── Revenue read-out: one compact line in the dashboard header ─────────────
// Where the money is, from the payments ledger (conference_money_summary via
// src/lib/conferenceMoney.ts), never from payment_status x fee:
//   Received      what actually came in THROUGH Gavelling (succeeded Stripe
//                 payments). A free chair stamped 'paid' on arrival adds 0.
//   Outstanding   open balances of accepted participants' invoices.
//   Offline       only when the organiser recorded money received elsewhere
//                 (marked paid / approved proof). Shown apart, never added.
// A conference with no fee and no money is a legitimate, finished state, not
// a zero; it says so in words rather than printing "0 / 0".
//
// It used to be a three-cell inset card inside "Applicants against target".
// The owner asked for the financials to be much smaller on the dashboard
// (21 Sep 2026), so it is one line of plain typography with one link to the
// Financials overview. The detail lives there.

export default function RevenueReadout({
  fee, currency, money, href,
}: {
  fee: number;
  currency: string;
  /** null while loading (or if the read failed): dashes, never a guess. */
  money: ConferenceMoney | null;
  /** The Financials overview. The one link this strip carries. */
  href: string;
}) {
  const received = moneyFromCents(money?.received_cents);
  const offline = moneyFromCents(money?.offline_cents);
  const outstanding = moneyFromCents(money?.outstanding_cents);
  const cur = money?.currency ?? currency;
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

  const noFee = fee <= 0 && !!money && received === 0 && offline === 0 && outstanding === 0;

  const figure = (label: string, value: number | null, color: string, hint: string) => (
    <span className="inline-flex items-baseline gap-1 min-w-0" title={hint}>
      <span style={{ fontSize: 11, fontWeight: 600, color: NEU.inkSoft }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {value === null ? '–' : formatFee(value, cur)}
      </span>
    </span>
  );

  return (
    <Link
      href={href}
      className="inline-flex items-center min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-opacity hover:opacity-80"
      style={{
        gap: 10, padding: '6px 10px 6px 11px', borderRadius: 12, textDecoration: 'none',
        fontFamily: OUTFIT, background: 'rgba(27,56,40,0.045)', maxWidth: '100%',
      }}
      aria-label="Open Financials"
    >
      <Wallet size={15} strokeWidth={2.3} style={{ color: NEU.deepGold, flexShrink: 0 }} aria-hidden />
      {noFee ? (
        <span style={{ fontSize: 11.5, fontWeight: 600, color: NEU.inkSoft, whiteSpace: 'nowrap' }}>
          No delegate fee set
        </span>
      ) : (
        <span className="inline-flex items-baseline min-w-0" style={{ gap: 12 }}>
          {figure(
            'Received', money ? received : null, NEU.forest,
            money
              ? `${n(money.received_count, 'payment', 'payments')} received through Gavelling. Free registrations and waived fees count as nothing.`
              : 'Loading',
          )}
          {figure(
            'Outstanding', money ? outstanding : null, NEU.ink,
            money
              ? `Still owed on ${n(money.outstanding_count, 'open invoice', 'open invoices')} of accepted participants.`
              : 'Loading',
          )}
          {/* Offline stays apart and is never added to Received. */}
          {money && offline > 0 && figure(
            'Offline', offline, NEU.inkSoft,
            `${n(money.offline_count, 'payment', 'payments')} you recorded as paid outside Gavelling. Not money received through the platform.`,
          )}
        </span>
      )}
      <span className="inline-flex items-center gap-1 flex-shrink-0" style={{ fontSize: 11, fontWeight: 800, color: NEU.forest }}>
        Financials
        <ArrowRight size={12} aria-hidden />
      </span>
    </Link>
  );
}
