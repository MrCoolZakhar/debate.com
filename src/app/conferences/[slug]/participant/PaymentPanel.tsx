'use client';

// Payment panel, never gated, always visible per selected application.
// Real UI; Stripe wiring lands separately (see src/lib/payments.ts). Shows
// the role fee, a status badge, and a PAY button that (for now) opens a
// styled "not connected yet" modal instead of a real checkout.

import { useState } from 'react';
import { CreditCard, Mail } from 'lucide-react';
import { formatFee, formatFeeAmount } from '@/lib/utils';
import { ModalOverlay } from '@/components/CommitteeEditorModal';
import { initiatePayment } from '@/lib/payments';
import { SectionCard, OUTFIT } from './shared';

type Badge = 'PAID' | 'WAIVED' | 'PARTIAL' | 'UNPAID' | 'REFUNDED';

const BADGE_STYLES: Record<Badge, { bg: string; color: string }> = {
  PAID: { bg: 'rgba(61,122,82,0.13)', color: '#2A5A3C' },
  WAIVED: { bg: 'rgba(154,138,120,0.16)', color: '#6B5F52' },
  PARTIAL: { bg: 'rgba(238,217,138,0.35)', color: '#8A6614' },
  UNPAID: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020' },
  REFUNDED: { bg: 'rgba(154,138,120,0.16)', color: '#6B5F52' },
};

function deriveBadge(paymentStatus: string, amountPaid: number): Badge {
  if (paymentStatus === 'paid') return 'PAID';
  if (paymentStatus === 'waived') return 'WAIVED';
  if (paymentStatus === 'refunded') return 'REFUNDED';
  return amountPaid > 0 ? 'PARTIAL' : 'UNPAID';
}

export interface PaymentPanelProps {
  applicationId: string;
  feeAmount: number | null;
  feeCurrency: string | null;
  allowPartial: boolean;
  paymentStatus: string;
  amountPaid: number;
  /** false when payment_timing is after_acceptance and the application is still 'submitted' */
  payableNow: boolean;
  contactEmail: string | null;
}

export default function PaymentPanel({
  applicationId, feeAmount, feeCurrency, allowPartial, paymentStatus, amountPaid, payableNow, contactEmail,
}: PaymentPanelProps) {
  const fee = feeAmount ?? 0;
  const currency = feeCurrency ?? 'GBP';
  const remaining = Math.max(0, fee - amountPaid);
  const badge = deriveBadge(paymentStatus, amountPaid);
  const owesSomething = badge === 'UNPAID' || badge === 'PARTIAL';
  const showAmountSelector = allowPartial && owesSomething && remaining > 0;

  const [customAmount, setCustomAmount] = useState<string>(() => formatFeeAmount(remaining));
  const [paying, setPaying] = useState(false);
  const [stubMessage, setStubMessage] = useState<string | null>(null);

  const amountToCharge = showAmountSelector ? Math.min(Math.max(parseFloat(customAmount) || 1, 1), Math.max(remaining, 1)) : remaining;

  async function handlePay() {
    if (paying || amountToCharge <= 0) return;
    setPaying(true);
    const result = await initiatePayment({ applicationId, amountCents: Math.round(amountToCharge * 100) });
    setPaying(false);
    setStubMessage(result.message);
  }

  return (
    <SectionCard>
      <div className="flex items-center justify-between gap-3 mb-1">
        <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: 0 }}>
          PAYMENT
        </p>
        <span
          className="px-2.5 py-0.5 rounded-full"
          style={{ ...BADGE_STYLES[badge], fontSize: '10px', fontFamily: OUTFIT, fontWeight: 700, letterSpacing: '0.08em' }}
        >
          {badge}
        </span>
      </div>

      <p className="font-black text-2xl mt-2 mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
        {fee > 0 ? formatFee(fee, currency) : 'Free'}
      </p>

      {allowPartial && fee > 0 && (
        <p className="text-xs mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          Remaining balance: <span style={{ fontWeight: 700, color: '#1C1410' }}>{formatFee(remaining, currency)}</span>
        </p>
      )}

      {!payableNow ? (
        <p
          className="text-[13px] rounded-xl px-4 py-3"
          style={{ color: '#B8844A', fontFamily: OUTFIT, backgroundColor: 'rgba(184,132,74,0.1)', border: '1px solid rgba(184,132,74,0.24)', lineHeight: 1.6 }}
        >
          Payment becomes available once your application is accepted.
        </p>
      ) : fee === 0 ? (
        <p className="text-[13px]" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          There&apos;s no fee for this role, nothing to pay.
        </p>
      ) : owesSomething ? (
        <>
          {showAmountSelector && (
            <div className="mb-4">
              <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: '#6E5F4E', fontFamily: OUTFIT, letterSpacing: '0.01em' }}>
                AMOUNT TO PAY
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={remaining}
                  step="0.01"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  onBlur={() => setCustomAmount(formatFeeAmount(amountToCharge))}
                  className="flex-1 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
                  style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', color: '#1C1410', fontFamily: OUTFIT }}
                />
                <button
                  type="button"
                  onClick={() => setCustomAmount(formatFeeAmount(remaining))}
                  className="rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none"
                  style={{ border: '1px solid #DDD4C0', color: '#1B3828', backgroundColor: 'transparent', fontFamily: OUTFIT, whiteSpace: 'nowrap' }}
                >
                  FULL AMOUNT
                </button>
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                Pay any amount from 1 up to the remaining balance.
              </p>
            </div>
          )}
          <button
            onClick={handlePay}
            disabled={paying}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm transition-colors focus:outline-none"
            style={{
              backgroundColor: paying ? '#DDD4C0' : '#1B3828',
              color: paying ? '#9A8A78' : '#EED98A',
              fontFamily: OUTFIT, letterSpacing: '0.06em', border: 'none', cursor: paying ? 'default' : 'pointer',
            }}
            onMouseEnter={e => { if (!paying) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={e => { if (!paying) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            <CreditCard size={15} />
            {paying ? 'OPENING...' : `PAY ${formatFee(amountToCharge, currency)}`}
          </button>
        </>
      ) : null}

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
