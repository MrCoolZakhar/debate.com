'use client';

// The delegation pop-up's Payments tab: read only, from the payments ledger
// (CLAUDE.md §2). The three figures are delegationRows.ts's: received is
// succeeded card payments, recorded offline is succeeded manual payments
// (never added to received), owed is open balances of accepted members.
// Below them, every invoice of the delegation: the ones carrying its
// society_id (delegation spots, advisor tickets) and every member's own.
// Money is changed in Financials, never here.

import { useMemo } from 'react';
import Link from 'next/link';
import { formatCents } from '@/app/manage/[slug]/financials/shared';
import { memberName, type DelegationMemberLite } from '../delegationRows';
import type { DelegationsData, DelegationView } from './useDelegationsData';
import { FONT, INK, INK_SOFT, OK_GREEN, OWE, ROW_LINE, linkStyle } from './kit';

const KIND_LABEL: Record<string, string> = {
  role_fee: 'Role fee',
  app_fee: 'Application fee',
  pledge_spot: 'Delegation spot',
  advisor_spot: 'Advisor ticket',
  addon: 'Add-on',
};

const STATUS: Record<string, { label: string; color: string }> = {
  settled: { label: 'Paid', color: OK_GREEN },
  open: { label: 'Open', color: OWE },
  partial: { label: 'Part paid', color: OWE },
  waived: { label: 'Waived', color: INK_SOFT },
  void: { label: 'Cancelled', color: INK_SOFT },
};

const GRID = 'minmax(0,1.3fr) minmax(0,1fr) 120px 120px 110px';

export default function PaymentsTab<M extends DelegationMemberLite>({ row, data, currency, slug }: {
  row: DelegationView<M>;
  slug: string;
  data: DelegationsData<M>;
  currency: string;
}) {
  const invoices = useMemo(() => {
    const ids = new Set(row.members.map(m => m.id));
    return data.invoices
      .filter(i => i.society_id === row.id || (!!i.application_id && ids.has(i.application_id)))
      .sort((a, b) => (a.status === 'void' ? 1 : 0) - (b.status === 'void' ? 1 : 0));
  }, [data.invoices, row.id, row.members]);
  const byId = useMemo(() => new Map(row.members.map(m => [m.id, m] as const)), [row.members]);

  if (data.moneyUnavailable) {
    return <p style={{ padding: '24px 28px', fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>The payments could not be read just now. Close this and open it again.</p>;
  }

  const figures = [
    { n: row.receivedCents, word: 'received by card' },
    { n: row.offlineCents, word: 'recorded offline' },
    { n: row.dueCents, word: 'owed' },
  ];

  return (
    <div className="flex-1 min-h-0 overflow-auto" style={{ padding: '20px 0 10px' }}>
      <div className="flex flex-wrap items-baseline" style={{ gap: '10px 32px', padding: '0 28px 18px' }}>
        {figures.map(f => (
          <span key={f.word} className="inline-flex items-baseline gap-2">
            <b style={{ fontFamily: FONT, fontSize: 24, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums' }}>{formatCents(f.n, currency)}</b>
            <span style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>{f.word}</span>
          </span>
        ))}
        {row.otherCurrency && (
          <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>Some items in another currency are left out.</span>
        )}
      </div>

      {invoices.length === 0 ? (
        <p style={{ padding: '0 28px', fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>Nothing has been charged to this delegation yet.</p>
      ) : (
        <div style={{ minWidth: 700 }}>
          <div className="grid" style={{ gridTemplateColumns: GRID, gap: 16, padding: '10px 28px' }}>
            {['What', 'Who', 'Amount', 'Paid', 'Status'].map(h => (
              <span key={h} style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: INK_SOFT }}>{h}</span>
            ))}
          </div>
          {invoices.map(i => {
            const who = i.application_id ? byId.get(i.application_id) : undefined;
            const st = STATUS[i.status] ?? { label: i.status, color: INK_SOFT };
            const what = i.label?.trim() || KIND_LABEL[i.kind] || 'Item';
            const qty = (i.quantity ?? 1) > 1 ? ` × ${i.quantity}` : '';
            return (
              <div key={i.id} className="grid items-center" style={{ gridTemplateColumns: GRID, gap: 16, padding: '11px 28px', borderTop: `1px solid ${ROW_LINE}`, fontFamily: FONT, fontSize: 14 }}>
                <span className="[overflow-wrap:anywhere]" style={{ color: INK }}>{what}{qty}</span>
                <span className="[overflow-wrap:anywhere]" style={{ color: INK }}>
                  {who ? memberName(who) : 'The delegation'}
                  {i.society_id && who && <span style={{ color: INK_SOFT }}> for the delegation</span>}
                </span>
                <span style={{ color: INK, fontVariantNumeric: 'tabular-nums' }}>{formatCents(i.amount_cents, i.currency || currency)}</span>
                <span style={{ color: INK, fontVariantNumeric: 'tabular-nums' }}>{formatCents(i.amount_paid_cents, i.currency || currency)}</span>
                <span style={{ color: st.color }}>{st.label}</span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ padding: '16px 28px 6px' }}>
        <Link href={`/manage/${slug}/financials/invoices`} style={{ ...linkStyle, fontSize: 14 }}>Open invoices in Financials</Link>
      </div>
    </div>
  );
}
