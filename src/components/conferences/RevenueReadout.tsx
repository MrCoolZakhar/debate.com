'use client';

import Link from 'next/link';
import { NEU, OUTFIT, NeuInset } from '@/components/neu';
import { formatFee } from '@/lib/utils';
import { moneyFromCents, type ConferenceMoney } from '@/lib/conferenceMoney';

// ── Revenue read-out ───────────────────────────────────────────────────────
// Where the money is, from the payments ledger (conference_money_summary via
// src/lib/conferenceMoney.ts), never from payment_status x fee:
//   Received      what actually came in THROUGH Gavelling (succeeded Stripe
//                 payments). A free chair stamped 'paid' on arrival adds 0.
//   Outstanding   open balances of accepted participants' invoices.
//   Offline       only when the organiser recorded money received elsewhere
//                 (marked paid / approved proof). Shown apart, never added.
// A conference with no fee and no money is a legitimate, finished state, not
// a zero; it says so in words rather than printing "0 / 0".

export default function RevenueReadout({
  fee, currency, money, href,
}: {
  fee: number;
  currency: string;
  /** null while loading (or if the read failed): dashes, never a guess. */
  money: ConferenceMoney | null;
  href: string;
}) {
  const received = moneyFromCents(money?.received_cents);
  const offline = moneyFromCents(money?.offline_cents);
  const outstanding = moneyFromCents(money?.outstanding_cents);
  if (fee <= 0 && money && received === 0 && offline === 0 && outstanding === 0) {
    return (
      <NeuInset small style={{ padding: '8px 12px', borderRadius: 14 }}>
        <p style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: NEU.muted }}>
          No delegate fee set — nothing to collect.{' '}
          <Link href={href} style={{ color: NEU.deepGold, fontWeight: 800, textDecoration: 'none' }}>
            Add one
          </Link>
        </p>
      </NeuInset>
    );
  }

  const cur = money?.currency ?? currency;
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  const cells: { label: string; value: number | null; hint: string; accent: string }[] = [
    {
      label: 'Received', value: money ? received : null, accent: NEU.deepGold,
      hint: money
        ? `${n(money.received_count, 'payment', 'payments')} received through Gavelling. Free registrations and waived fees count as nothing.`
        : 'Loading',
    },
    {
      label: 'Outstanding', value: money ? outstanding : null, accent: NEU.ink,
      hint: money
        ? `Still owed on ${n(money.outstanding_count, 'open invoice', 'open invoices')} of accepted participants.`
        : 'Loading',
    },
  ];
  if (money && offline > 0) {
    cells.push({
      label: 'Offline', value: offline, accent: NEU.muted,
      hint: `${n(money.offline_count, 'payment', 'payments')} you recorded as paid outside Gavelling. Not money received through the platform.`,
    });
  }

  return (
    <NeuInset small style={{ padding: '8px 4px', borderRadius: 14 }}>
      <div className="flex items-stretch">
        {cells.map((c, i) => (
          <div
            key={c.label}
            className="flex flex-col min-w-0 text-center"
            title={c.hint}
            style={{
              flex: 1,
              padding: '0 8px',
              borderInlineStart: i === 0 ? undefined : '1px solid rgba(27,56,40,0.10)',
            }}
          >
            <span
              className="truncate"
              style={{
                fontFamily: OUTFIT, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: NEU.muted,
              }}
            >
              {c.label}
            </span>
            <span
              className="truncate"
              style={{
                fontFamily: OUTFIT, fontSize: 15, fontWeight: 900, color: c.accent,
                fontVariantNumeric: 'tabular-nums', marginTop: 2, lineHeight: 1.1,
              }}
            >
              {c.value === null ? '—' : formatFee(c.value, cur)}
            </span>
          </div>
        ))}
      </div>
    </NeuInset>
  );
}
