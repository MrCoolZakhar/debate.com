'use client';

/**
 * Financials Overview — revenue stat tiles, the delegate estimate block, and
 * the read-only payment pipeline. Neumorphic throughout (neu.tsx
 * primitives). Onboarding (Stripe/manual) lives on the Settings route now;
 * vouchers live there too, beneath it. No payment writes happen on this
 * page, marking paid stays on the Applications page.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, BadgePercent, CircleCheck, Clock, HandCoins, Hourglass,
  PiggyBank, TrendingUp, Users,
} from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { roundMoney } from '@/lib/finance';
import {
  NEU, NEU_GRADIENTS, OUTFIT,
  NeuCard, NeuInset, NeuStatTile, NeuProgress, NeuPill, NeuIconDisc,
} from '@/components/neu';
import {
  useFinancialsData, useFinancialsCurrency,
  rowAmount, roleLabel, RoleIcon, roleTone, committeeAbbr, CountryFlag,
  cumulativeSpark, chipStyle, formatRowDate, paymentMethod,
  PIPELINE_FILTERS, type PipelineFilter, mutedCaption,
} from './shared';

export default function FinancialsOverviewPage() {
  const { conference } = useManage();
  const { rows, fin, loading } = useFinancialsData();
  const { disp } = useFinancialsCurrency();
  const [filter, setFilter] = useState<PipelineFilter>('all');

  if (!conference) return null;

  const fee = conference.fee_amount ?? 0;
  const expectedDelegates = conference.expected_delegates || 0;

  const pipelineRows = fin.live.filter(r => {
    if (filter === 'paid') return r.payment_status === 'paid';
    if (filter === 'unpaid') return r.payment_status === 'unpaid';
    if (filter === 'waived') return r.payment_status === 'waived';
    return true;
  });

  return (
    <>
      {/* ── 2 · Revenue overview ── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="rounded-[22px] animate-pulse" style={{ height: 118, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
          <NeuStatTile
            emoji="Money bag"
            icon={PiggyBank}
            gradient={NEU_GRADIENTS.green}
            value={disp(fin.collected)}
            label={`Collected · ${fin.paidRows.length} paid`}
            spark={cumulativeSpark(rows ?? [], r => r.payment_status === 'paid')}
          />
          <NeuStatTile
            emoji="Hourglass not done"
            icon={Hourglass}
            gradient={NEU_GRADIENTS.amber}
            value={disp(fin.pending)}
            label={`Pending · ${fin.pendingRows.length} accepted unpaid`}
            spark={cumulativeSpark(rows ?? [], r => (r.status === 'accepted' || r.status === 'assigned') && r.payment_status === 'unpaid')}
          />
          <NeuStatTile
            emoji="Money with wings"
            icon={HandCoins}
            gradient={NEU_GRADIENTS.sage}
            value={disp(fin.waived)}
            label={`Waived · ${fin.waivedRows.length} fee${fin.waivedRows.length === 1 ? '' : 's'} forgone`}
            style={{ opacity: 0.72 }}
          />
          <NeuStatTile
            emoji="Chart increasing"
            icon={TrendingUp}
            gradient={NEU_GRADIENTS.gold}
            value={disp(fin.expectedTotal)}
            label="Expected total · collected + pending"
            spark={cumulativeSpark(rows ?? [], r =>
              r.payment_status === 'paid'
              || ((r.status === 'accepted' || r.status === 'assigned') && r.payment_status === 'unpaid'))}
          />
        </div>
      )}

      {/* ── 3 · Delegate estimate block ── */}
      <NeuCard style={{ padding: '20px 22px', marginTop: 20, marginBottom: 32 }}>
        <div className="flex items-center gap-3 mb-4">
          <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Users} emoji="Busts in silhouette" size={36} />
          <div>
            <h2 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 16, color: NEU.ink, lineHeight: 1.2 }}>
              Delegate estimate vs reality
            </h2>
            <p style={mutedCaption}>
              Your estimate of {expectedDelegates} delegates comes from the conference settings.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl animate-pulse" style={{ height: 84, backgroundColor: NEU.base, boxShadow: NEU.inSm }} />
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
              <p style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
                {fin.acceptedDelegates} accepted · {fin.paidDelegates} paid
              </p>
              <p style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
                estimate {expectedDelegates}
              </p>
            </div>
            <NeuProgress value={fin.acceptedDelegates} max={Math.max(1, expectedDelegates)} thumb height={12} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              <NeuInset small className="px-4 py-3">
                <p style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: NEU.muted, textTransform: 'uppercase' }}>
                  Projected revenue at estimate
                </p>
                <p style={{ fontFamily: OUTFIT, fontSize: 20, fontWeight: 900, color: NEU.ink, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
                  {disp(roundMoney(expectedDelegates * fee))}
                </p>
                <p style={mutedCaption}>
                  {expectedDelegates} delegates × {disp(fee)} fee. Assumes every
                  delegate pays the full fee, before vouchers and waivers.
                </p>
              </NeuInset>
              <NeuInset small className="px-4 py-3">
                <p style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: NEU.muted, textTransform: 'uppercase' }}>
                  Revenue at current acceptance
                </p>
                <p style={{ fontFamily: OUTFIT, fontSize: 20, fontWeight: 900, color: NEU.forest, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
                  {disp(roundMoney(fin.acceptedDelegates * fee))}
                </p>
                <p style={mutedCaption}>
                  {fin.acceptedDelegates} accepted delegate{fin.acceptedDelegates === 1 ? '' : 's'} × {disp(fee)}.
                  Same full-fee assumption; the tiles above show actual discounted figures.
                </p>
              </NeuInset>
            </div>
          </>
        )}
      </NeuCard>

      {/* ── 4 · Payment pipeline ── */}
      <section className="mb-2">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-3">
            <NeuIconDisc gradient={NEU_GRADIENTS.amber} icon={HandCoins} emoji="Receipt" size={36} />
            <div>
              <h2 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 18, color: NEU.ink, lineHeight: 1.15 }}>
                Payment pipeline
              </h2>
              <p style={mutedCaption}>
                Read-only here. Mark payments on the{' '}
                <Link
                  href={`/manage/${conference.slug}/applications`}
                  style={{ color: NEU.forest, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 2 }}
                >
                  Applications page
                </Link>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {PIPELINE_FILTERS.map(f => (
              <NeuPill key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>
                {f.label}
              </NeuPill>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="rounded-[22px] animate-pulse" style={{ height: 180, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
        ) : fin.live.length === 0 ? (
          <NeuInset className="flex flex-col items-center text-center px-6 py-10">
            <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.ink }}>
              No applications yet
            </p>
            <p className="mt-1 max-w-sm" style={{ ...mutedCaption, fontSize: 11.5 }}>
              Fees appear here as people apply. Share your conference page to start filling the pipeline.
            </p>
            <Link
              href={`/manage/${conference.slug}/applications`}
              className="inline-flex items-center gap-1.5 mt-4"
              style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: NEU.forest, textDecoration: 'none' }}
            >
              GO TO APPLICATIONS <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          </NeuInset>
        ) : pipelineRows.length === 0 ? (
          <NeuInset small className="text-center px-6 py-8">
            <p style={{ ...mutedCaption, fontSize: 12 }}>
              No {filter} applications right now.
            </p>
          </NeuInset>
        ) : (
          <NeuCard style={{ padding: '6px 0', overflow: 'hidden' }}>
            {pipelineRows.map((r, i) => {
              const paid = r.payment_status === 'paid';
              const waived = r.payment_status === 'waived';
              const amount = rowAmount(fee, r);
              const discounted = (Number(r.voucher_discount) || 0) > 0;
              // True paid_at when recorded; otherwise the application date,
              // labelled APPLIED so it never masquerades as a payment date.
              const hasPaidAt = paid && !!r.paid_at;
              const method = paymentMethod(r);
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 flex-wrap px-5 py-2.5"
                  style={i > 0 ? { borderTop: '1px solid rgba(221,212,192,0.55)' } : undefined}
                >
                  {/* Name */}
                  <span
                    className="truncate"
                    style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink, flex: '1 1 140px', minWidth: 120 }}
                  >
                    {r.profiles?.display_name ?? 'Unknown'}
                  </span>

                  {/* Role chip */}
                  <span
                    className="inline-flex items-center gap-1"
                    style={{
                      ...chipStyle,
                      backgroundColor: roleTone(r.role).bg,
                      color: roleTone(r.role).color,
                      border: `1px solid ${roleTone(r.role).border}`,
                    }}
                  >
                    <RoleIcon role={r.role} />
                    {roleLabel(r.role).toUpperCase()}
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

                  {/* Date, real payment date when recorded, else application date */}
                  <span
                    className="inline-flex items-baseline gap-1.5"
                    title={hasPaidAt ? 'Payment recorded on this date' : 'Application submitted on this date (no payment date recorded)'}
                    style={{ minWidth: 118 }}
                  >
                    <span style={{ fontFamily: OUTFIT, fontSize: 8, fontWeight: 800, letterSpacing: '0.1em', color: NEU.muted, opacity: 0.85 }}>
                      {hasPaidAt ? 'PAID' : 'APPLIED'}
                    </span>
                    <span style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 600, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
                      {formatRowDate(hasPaidAt ? r.paid_at! : r.submitted_at)}
                    </span>
                  </span>

                  {/* Amount */}
                  <span
                    title={discounted ? `Voucher discount of ${disp(Number(r.voucher_discount) || 0)} applied` : undefined}
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
                    {discounted && !waived && (
                      <BadgePercent size={11} strokeWidth={2.5} style={{ display: 'inline', marginLeft: 4, color: NEU.deepGold, verticalAlign: '-1.5px' }} />
                    )}
                  </span>

                  {/* Status chip */}
                  {waived ? (
                    <span
                      className="inline-flex items-center gap-1"
                      style={{ ...chipStyle, backgroundColor: 'rgba(184,132,74,0.16)', color: '#9A6B2F', border: '1px solid rgba(184,132,74,0.42)' }}
                    >
                      <HandCoins size={10} strokeWidth={2.5} />
                      WAIVED
                    </span>
                  ) : paid ? (
                    <span
                      className="inline-flex items-center gap-1"
                      style={{ ...chipStyle, backgroundColor: 'rgba(61,122,82,0.17)', color: '#2A5A3C', border: '1px solid rgba(61,122,82,0.45)' }}
                    >
                      <CircleCheck size={10} strokeWidth={2.5} />
                      PAID
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1"
                      style={{ ...chipStyle, backgroundColor: 'rgba(184,132,74,0.12)', color: '#9A6B2F', border: '1px solid rgba(184,132,74,0.3)' }}
                    >
                      <Clock size={10} strokeWidth={2.5} />
                      UNPAID
                    </span>
                  )}

                  {/* Method chip, HOW the payment happened (see paymentMethod) */}
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
    </>
  );
}
