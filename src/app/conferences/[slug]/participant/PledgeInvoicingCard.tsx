'use client';

// PLEDGE & INVOICING card, advisor-only. A pledge is only ever about paying
// for delegation spots (the advisor's own fee is handled by the universal
// PaymentPanel above, like any other participant). Settled spots render
// straight from the invoices table (payer RLS read); unpaid spots get a PAY
// affordance offering one spot or all remaining, via kind 'pledge_spots'.

import { useEffect, useState } from 'react';
import { CreditCard, Mail, Check, TriangleAlert } from 'lucide-react';
import { ModalOverlay } from '@/components/CommitteeEditorModal';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { createCheckout } from '@/lib/payments';
import { formatFee } from '@/lib/utils';
import { SectionCard, OUTFIT } from './shared';

interface PledgeSpotInvoice {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
}

export interface PledgeInvoicingCardProps {
  applicationId: string;
  conferenceId: string;
  /** Bumped by any settled invoice on this application — used to trigger a refetch. */
  amountPaid: number;
  pledgeType: 'delegation' | null;
  spotsPledged: number | null;
  pledgeConfirmedAt: string | null;
  delegateFeeAmount: number | null;
  delegateFeeCurrency: string | null;
  contactEmail: string | null;
  /** True once the conference's Stripe Connect onboarding is complete. */
  paymentsEnabled: boolean;
  /** Organizer-provided payment page, shown as a fallback when paymentsEnabled is false. */
  externalPaymentUrl: string | null;
  externalPaymentNote: string | null;
}

export default function PledgeInvoicingCard({
  applicationId, conferenceId, amountPaid, pledgeType, spotsPledged, pledgeConfirmedAt, delegateFeeAmount, delegateFeeCurrency, contactEmail, paymentsEnabled, externalPaymentUrl, externalPaymentNote,
}: PledgeInvoicingCardProps) {
  const { session } = useAuth();
  const [invoices, setInvoices] = useState<PledgeSpotInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingSpots, setPayingSpots] = useState<number | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [stubMessage, setStubMessage] = useState<string | null>(null);

  const spots = spotsPledged ?? 0;
  const currency = delegateFeeCurrency ?? 'GBP';
  const perSpot = delegateFeeAmount ?? 0;

  useEffect(() => {
    if (pledgeType !== 'delegation' || !session) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    getAuthedClient(session.access_token)
      .from('invoices')
      .select('id, amount_cents, currency, status')
      .eq('application_id', applicationId)
      .eq('kind', 'pledge_spot')
      .then(({ data }) => {
        if (cancelled) return;
        setInvoices((data as PledgeSpotInvoice[] | null) ?? []);
        setLoading(false);
      });
    return () => { cancelled = true; };
    // amountPaid changes whenever any invoice on this application settles —
    // including these pledge-spot invoices — so it's the refetch signal.
  }, [applicationId, pledgeType, session, amountPaid]);

  const settledInvoices = invoices.filter(i => i.status === 'settled');
  const settledCount = settledInvoices.length;
  const fullyCovered = !!pledgeConfirmedAt || settledCount >= spots;
  const remaining = Math.max(0, spots - settledCount);

  async function handlePay(spotCount: number) {
    if (payingSpots !== null || !session) return;
    setPayingSpots(spotCount);
    setPayError(null);
    const result = await createCheckout({
      applicationId,
      conferenceId,
      accessToken: session.access_token,
      kind: 'pledge_spots',
      spotCount,
      feeAmount: perSpot * spotCount,
      feeCurrency: currency,
    });
    if (result.status === 'redirect' && result.redirectUrl) {
      window.location.assign(result.redirectUrl);
      return;
    }
    setPayingSpots(null);
    if (result.status === 'error') setPayError(result.message ?? 'Something went wrong. Please try again.');
    else setStubMessage(result.message ?? null);
  }

  return (
    <SectionCard>
      <p className="mb-4" style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 16px 0' }}>
        PLEDGE &amp; INVOICING
      </p>

      {pledgeType !== 'delegation' || spots === 0 ? (
        <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          No pledge on file yet.
        </p>
      ) : loading ? (
        <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          Loading invoices…
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {fullyCovered && settledInvoices.length === 0 && (
            <div
              className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
              style={{ border: '1px solid rgba(221,212,192,0.7)', backgroundColor: 'rgba(237,231,216,0.25)' }}
            >
              <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}>
                {spots} delegation spot{spots === 1 ? '' : 's'}
              </p>
              <span className="flex items-center gap-1 flex-shrink-0 text-xs font-bold" style={{ color: '#3D7A52', fontFamily: OUTFIT }}>
                <Check size={13} /> COVERED
              </span>
            </div>
          )}
          {settledInvoices.map((inv, i) => (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
              style={{ border: '1px solid rgba(221,212,192,0.7)', backgroundColor: 'rgba(237,231,216,0.25)' }}
            >
              <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}>
                Delegation spot {i + 1} — {formatFee(inv.amount_cents / 100, inv.currency)}
              </p>
              <span className="flex items-center gap-1 flex-shrink-0 text-xs font-bold" style={{ color: '#3D7A52', fontFamily: OUTFIT }}>
                <Check size={13} /> PAID
              </span>
            </div>
          ))}

          {!fullyCovered && remaining > 0 && !paymentsEnabled && externalPaymentUrl && (
            <div
              className="rounded-xl px-4 py-3"
              style={{ border: '1px solid rgba(221,212,192,0.7)', backgroundColor: 'rgba(237,231,216,0.25)' }}
            >
              <p className="text-sm font-semibold" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: '0 0 4px 0' }}>
                {remaining} delegation spot{remaining === 1 ? '' : 's'} remaining
              </p>
              <p className="text-xs mb-3" style={{ color: '#B8844A', fontFamily: OUTFIT, fontWeight: 600 }}>
                pending — {formatFee(perSpot, currency)} each
              </p>
              <a
                href={externalPaymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold focus:outline-none"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, letterSpacing: '0.05em', border: 'none', textDecoration: 'none' }}
              >
                <CreditCard size={12} /> PAY VIA THE ORGANIZING TEAM&apos;S PAYMENT PAGE
              </a>
              {externalPaymentNote && (
                <p className="text-xs mt-2" style={{ color: '#6E5F4E', fontFamily: OUTFIT, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {externalPaymentNote}
                </p>
              )}
              <p className="text-[11px] mt-2" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.5 }}>
                After you pay, the organizing team will confirm your payment here.
              </p>
            </div>
          )}

          {!fullyCovered && remaining > 0 && !paymentsEnabled && !externalPaymentUrl && (
            <p
              className="text-[13px] rounded-xl px-4 py-3"
              style={{ color: '#B8844A', fontFamily: OUTFIT, backgroundColor: 'rgba(184,132,74,0.1)', border: '1px solid rgba(184,132,74,0.24)', lineHeight: 1.6 }}
            >
              The organizing team has not enabled online payments yet. You will be able to pay here once they do.
            </p>
          )}

          {!fullyCovered && remaining > 0 && paymentsEnabled && (
            <div
              className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 flex-wrap"
              style={{ border: '1px solid rgba(221,212,192,0.7)', backgroundColor: 'rgba(237,231,216,0.25)' }}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}>
                  {remaining} delegation spot{remaining === 1 ? '' : 's'} remaining
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#B8844A', fontFamily: OUTFIT, fontWeight: 600 }}>
                  pending — {formatFee(perSpot, currency)} each
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handlePay(1)}
                  disabled={payingSpots !== null}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none"
                  style={{
                    backgroundColor: payingSpots === 1 ? '#DDD4C0' : '#1B3828',
                    color: payingSpots === 1 ? '#9A8A78' : '#EED98A',
                    border: 'none', fontFamily: OUTFIT, letterSpacing: '0.05em', cursor: payingSpots !== null ? 'default' : 'pointer',
                  }}
                >
                  <CreditCard size={12} /> {payingSpots === 1 ? '...' : 'PAY 1 SPOT'}
                </button>
                {remaining > 1 && (
                  <button
                    onClick={() => handlePay(remaining)}
                    disabled={payingSpots !== null}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none"
                    style={{
                      border: '1px solid #DDD4C0', color: '#1B3828', backgroundColor: 'transparent',
                      fontFamily: OUTFIT, letterSpacing: '0.05em', cursor: payingSpots !== null ? 'default' : 'pointer',
                      opacity: payingSpots !== null && payingSpots !== remaining ? 0.5 : 1,
                    }}
                  >
                    <CreditCard size={12} /> {payingSpots === remaining ? '...' : `PAY ALL (${remaining})`}
                  </button>
                )}
              </div>
            </div>
          )}

          {!fullyCovered && remaining > 0 && paymentsEnabled && (
            <p className="text-[11px]" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.5 }}>
              A service fee is added at checkout.
            </p>
          )}

          {payError && (
            <div
              className="flex items-start gap-2 rounded-xl px-3.5 py-2.5"
              style={{ backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.22)' }}
            >
              <TriangleAlert size={14} style={{ color: '#8B2020', marginTop: 1, flexShrink: 0 }} />
              <p className="text-[12.5px]" style={{ color: '#8B2020', fontFamily: OUTFIT, lineHeight: 1.5 }}>
                {payError}
              </p>
            </div>
          )}
        </div>
      )}

      {stubMessage && (
        <ModalOverlay onClose={() => setStubMessage(null)}>
          <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 380, maxWidth: 'calc(100vw - 32px)' }}>
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 44, height: 44, borderRadius: '9999px', backgroundColor: 'rgba(184,132,74,0.14)', border: '1px solid rgba(184,132,74,0.3)' }}
            >
              <CreditCard size={19} style={{ color: '#B8844A' }} />
            </div>
            <p className="text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT, lineHeight: 1.6 }}>
              {stubMessage}
            </p>
            {contactEmail && (
              <a
                href={`mailto:${contactEmail}`}
                className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none"
                style={{ border: '1px solid #DDD4C0', color: '#1B3828', backgroundColor: 'rgba(27,56,40,0.04)', fontFamily: OUTFIT, textDecoration: 'none' }}
              >
                <Mail size={14} />
                {contactEmail}
              </a>
            )}
            <button
              onClick={() => setStubMessage(null)}
              className="rounded-xl py-2.5 font-bold text-sm focus:outline-none"
              style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT }}
            >
              GOT IT
            </button>
          </div>
        </ModalOverlay>
      )}
    </SectionCard>
  );
}
