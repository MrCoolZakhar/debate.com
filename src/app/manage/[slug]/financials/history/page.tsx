'use client';

/**
 * Financials History — the exact transaction log: every paid/waived
 * application, newest first, dated by paid_at when recorded else the
 * application date.
 */

import { BadgePercent, Receipt } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { NEU, NEU_GRADIENTS, OUTFIT, NeuCard, NeuInset, NeuIconDisc } from '@/components/neu';
import {
  useFinancialsData, useFinancialsCurrency,
  rowAmount, committeeAbbr, CountryFlag, chipStyle, formatRowDate, paymentMethod,
  mutedCaption,
} from '../shared';

export default function FinancialsHistoryPage() {
  const { conference } = useManage();
  const { fin, loading } = useFinancialsData();
  const { disp } = useFinancialsCurrency();

  if (!conference) return null;

  const fee = conference.fee_amount ?? 0;

  // History, the exact transaction log: every paid/waived application, newest
  // first, dated by paid_at when recorded else the application date.
  const historyRows = fin.live
    .filter(r => r.payment_status === 'paid' || r.payment_status === 'waived')
    .slice()
    .sort((a, b) =>
      new Date(b.paid_at ?? b.submitted_at).getTime() - new Date(a.paid_at ?? a.submitted_at).getTime());

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Receipt} emoji="Receipt" size={36} />
        <div>
          <h2 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 18, color: NEU.ink, lineHeight: 1.15 }}>
            Transaction history
          </h2>
          <p style={mutedCaption}>
            Every collected and waived fee, newest first. Dated by payment when recorded, otherwise the application date.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[22px] animate-pulse" style={{ height: 180, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
      ) : historyRows.length === 0 ? (
        <NeuInset className="flex flex-col items-center text-center px-6 py-10">
          <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.ink }}>
            No transactions yet
          </p>
          <p className="mt-1 max-w-sm" style={{ ...mutedCaption, fontSize: 11.5 }}>
            Paid and waived fees appear here as a detailed chronological log.
          </p>
        </NeuInset>
      ) : (
        <NeuCard style={{ padding: '6px 0', overflow: 'hidden' }}>
          {historyRows.map((r, i) => {
            const waived = r.payment_status === 'waived';
            const amount = rowAmount(fee, r);
            const discount = Number(r.voucher_discount) || 0;
            const discounted = discount > 0;
            const hasPaidAt = !waived && !!r.paid_at;
            const method = paymentMethod(r);
            const dateIso = r.paid_at ?? r.submitted_at;
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 flex-wrap px-5 py-2.5"
                style={i > 0 ? { borderTop: '1px solid rgba(221,212,192,0.55)' } : undefined}
              >
                {/* Date, leads the log */}
                <span
                  className="inline-flex items-baseline gap-1.5 flex-shrink-0"
                  title={hasPaidAt ? 'Payment recorded on this date' : waived ? 'Fee waived (application date)' : 'Application date, no payment date recorded'}
                  style={{ minWidth: 118 }}
                >
                  <span style={{ fontFamily: OUTFIT, fontSize: 8, fontWeight: 800, letterSpacing: '0.1em', color: NEU.muted, opacity: 0.85 }}>
                    {hasPaidAt ? 'PAID' : waived ? 'WAIVED' : 'APPLIED'}
                  </span>
                  <span style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 600, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
                    {formatRowDate(dateIso)}
                  </span>
                </span>

                {/* Name */}
                <span
                  className="truncate"
                  style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink, flex: '1 1 140px', minWidth: 120 }}
                >
                  {r.profiles?.display_name ?? 'Unknown'}
                </span>

                {/* Committee + flag */}
                <span
                  className="inline-flex items-center gap-1.5"
                  title={r.assigned_committee?.name ?? undefined}
                  style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: NEU.muted, minWidth: 64 }}
                >
                  {committeeAbbr(r.assigned_committee)}
                  <CountryFlag name={r.assigned_country_name} code={r.assigned_country_code} />
                </span>

                {/* Voucher discount, when applied */}
                {discounted && (
                  <span
                    className="inline-flex items-center gap-1"
                    title={`Voucher discount of ${disp(discount)} applied`}
                    style={{ ...chipStyle, fontSize: 8.5, backgroundColor: 'rgba(182,135,31,0.14)', color: NEU.deepGold, border: '1px solid rgba(182,135,31,0.36)' }}
                  >
                    <BadgePercent size={10} strokeWidth={2.5} />
                    −{disp(discount)}
                  </span>
                )}

                {/* Amount */}
                <span
                  style={{
                    fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 900,
                    color: waived ? NEU.muted : NEU.ink,
                    textDecoration: waived ? 'line-through' : 'none',
                    textDecorationColor: 'rgba(154,138,120,0.55)',
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: 64, textAlign: 'right', marginLeft: 'auto',
                  }}
                >
                  {disp(waived ? fee : amount)}
                </span>

                {/* Method chip, STRIPE / SELF-PAID / DELEGATION / MANUAL / AMBASSADOR / UNLIMITED */}
                {method && (
                  <span
                    title={method.title}
                    style={{
                      ...chipStyle, fontSize: 8.5,
                      backgroundColor: 'rgba(154,138,120,0.13)', color: '#6B5E4E',
                      border: '1px solid rgba(154,138,120,0.35)',
                    }}
                  >
                    {method.label}
                  </span>
                )}
              </div>
            );
          })}
        </NeuCard>
      )}
    </section>
  );
}
