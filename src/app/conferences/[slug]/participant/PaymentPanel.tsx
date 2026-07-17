'use client';

// Payment panel, never gated, always visible per selected application.
// PAY opens a real Stripe Checkout session (src/lib/payments.ts) — the
// server recomputes every amount, this panel only mirrors that math (active
// fee phase, remaining balance) to preview it, and surfaces whatever the
// server actually decides inline. No Gavelling fee/surcharge: the delegate
// pays exactly the conference fee minus voucher/aid — Gavelling now runs on
// credits charged to the applicant separately (see useCredits/apply flow).

import { useEffect, useState } from 'react';
import { CreditCard, Mail, TriangleAlert } from 'lucide-react';
import { formatFee, formatFeeAmount, currencySymbol } from '@/lib/utils';
import { activePhaseFee, type FeePhase } from '@/lib/finance';
import { ModalOverlay } from '@/components/CommitteeEditorModal';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { createCheckout } from '@/lib/payments';
import { type CustomQuestion, type CustomAnswers, validateAnswers, answerIsEmpty } from '@/lib/customQuestions';
import CustomQuestionsField from '@/components/CustomQuestionsField';
import { SectionCard, OUTFIT } from './shared';

interface AidRequestRow {
  status: 'pending' | 'approved' | 'denied';
  granted_amount: number | null;
}

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
  conferenceId: string;
  feeAmount: number | null;
  feeCurrency: string | null;
  feePhases?: FeePhase[] | null;
  allowPartial: boolean;
  paymentStatus: string;
  amountPaid: number;
  /** false when payment_timing is after_acceptance and the application is still 'submitted' */
  payableNow: boolean;
  contactEmail: string | null;
  /** Conference-level financial aid config (separate application, financial_aid_requests table). */
  financialAidEnabled: boolean;
  aidQuestions: CustomQuestion[];
  aidIntro: string | null;
  /** True once the conference's Stripe Connect onboarding is complete AND
   *  Stripe is the active payment_method. */
  paymentsEnabled: boolean;
  /** Organizer-provided payment page, shown when manual is the active method. */
  externalPaymentUrl: string | null;
  externalPaymentNote: string | null;
  /** True when 'manual' is the conference's active payment_method. */
  manualActive: boolean;
}

export default function PaymentPanel({
  applicationId, conferenceId, feeAmount, feeCurrency, feePhases, allowPartial, paymentStatus, amountPaid, payableNow, contactEmail, financialAidEnabled, aidQuestions, aidIntro, paymentsEnabled, externalPaymentUrl, externalPaymentNote, manualActive,
}: PaymentPanelProps) {
  const { user, session } = useAuth();
  const { amount: resolvedFee, phase } = activePhaseFee({ fee_amount: feeAmount, fee_phases: feePhases });
  const fee = resolvedFee ?? 0;
  const currency = feeCurrency ?? 'GBP';

  // ── Financial aid request (separate lifecycle, financial_aid_requests table) ──
  const [aidRequest, setAidRequest] = useState<AidRequestRow | null>(null);
  const [aidRequestLoaded, setAidRequestLoaded] = useState(false);
  const [aidModalOpen, setAidModalOpen] = useState(false);
  const [aidStatement, setAidStatement] = useState('');
  const [aidRequestedAmount, setAidRequestedAmount] = useState('');
  const [aidCustomAnswers, setAidCustomAnswers] = useState<CustomAnswers>({});
  const [aidMissingIds, setAidMissingIds] = useState<string[]>([]);
  const [aidSubmitting, setAidSubmitting] = useState(false);
  const [aidSubmitError, setAidSubmitError] = useState('');

  async function fetchAidRequest(): Promise<AidRequestRow | null> {
    if (!financialAidEnabled || !user || !session) return null;
    const { data } = await getAuthedClient(session.access_token)
      .from('financial_aid_requests')
      .select('status, granted_amount')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as AidRequestRow | null) ?? null;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const row = await fetchAidRequest();
      if (cancelled) return;
      setAidRequest(row);
      setAidRequestLoaded(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financialAidEnabled, applicationId, user, session]);

  async function handleSubmitAid() {
    if (aidSubmitting || !session) return;
    if (!aidStatement.trim()) {
      setAidSubmitError('Please tell us about your circumstances.');
      return;
    }
    const questionCheck = validateAnswers(aidQuestions, aidCustomAnswers);
    if (!questionCheck.valid) {
      setAidMissingIds(questionCheck.missingIds);
      setAidSubmitError('Please answer all required questions.');
      return;
    }
    setAidSubmitting(true);
    setAidSubmitError('');
    const supabase = getAuthedClient(session.access_token);
    const requestedAmountNum = aidRequestedAmount.trim() ? parseFloat(aidRequestedAmount) : null;
    const { data, error } = await supabase.rpc('submit_aid_request', {
      p_application_id: applicationId,
      p_statement: aidStatement.trim(),
      p_requested_amount: requestedAmountNum != null && !Number.isNaN(requestedAmountNum) ? requestedAmountNum : null,
      p_custom_answers: aidCustomAnswers,
    });
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      setAidSubmitting(false);
      setAidSubmitError(result?.error || error?.message || 'Could not submit your request. Please try again.');
      return;
    }
    setAidSubmitting(false);
    setAidModalOpen(false);
    setAidStatement('');
    setAidRequestedAmount('');
    setAidCustomAnswers({});
    setAidMissingIds([]);
    const row = await fetchAidRequest();
    setAidRequest(row);
  }

  const grantedAmount = aidRequest?.status === 'approved' ? (aidRequest.granted_amount ?? 0) : 0;
  const effectiveFee = Math.max(0, fee - grantedAmount);
  const remaining = Math.max(0, effectiveFee - amountPaid);
  const badge = deriveBadge(paymentStatus, amountPaid);
  const owesSomething = badge === 'UNPAID' || badge === 'PARTIAL';
  const showAmountSelector = allowPartial && owesSomething && remaining > 0;

  const [customAmount, setCustomAmount] = useState<string>(() => formatFeeAmount(remaining));
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [stubMessage, setStubMessage] = useState<string | null>(null);

  const amountToCharge = showAmountSelector ? Math.min(Math.max(parseFloat(customAmount) || 1, 1), Math.max(remaining, 1)) : remaining;

  async function handlePay() {
    if (paying || amountToCharge <= 0 || !session) return;
    setPaying(true);
    setPayError(null);
    const result = await createCheckout({
      applicationId,
      conferenceId,
      accessToken: session.access_token,
      kind: 'role_fee',
      ...(showAmountSelector ? { amount: amountToCharge } : {}),
      ...(voucherCode.trim() ? { voucherCode: voucherCode.trim().toUpperCase() } : {}),
      feeAmount: fee,
      feeCurrency: currency,
    });
    if (result.status === 'redirect' && result.redirectUrl) {
      window.location.assign(result.redirectUrl);
      return;
    }
    setPaying(false);
    if (result.status === 'error') setPayError(result.message ?? 'Something went wrong. Please try again.');
    else setStubMessage(result.message ?? null);
  }

  return (
    <SectionCard>
      <div className="flex items-center justify-between gap-3 mb-1">
        <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: 0 }}>
          {financialAidEnabled ? 'PAY AND FINANCIAL AID' : 'PAYMENT'}
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

      {fee > 0 && phase && (
        <p className="text-[11px] font-bold mb-1" style={{ color: '#B6871F', fontFamily: OUTFIT, letterSpacing: '0.03em' }}>
          {phase.label.toUpperCase()} PRICING
        </p>
      )}

      {allowPartial && fee > 0 && grantedAmount === 0 && (
        <p className="text-xs mb-1.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          Remaining balance: <span style={{ fontWeight: 700, color: '#1C1410' }}>{formatFee(remaining, currency)}</span>
        </p>
      )}

      {aidRequestLoaded && aidRequest?.status === 'pending' && (
        <p
          className="text-[13px] rounded-xl px-4 py-3 mb-3"
          style={{ color: '#B8844A', fontFamily: OUTFIT, backgroundColor: 'rgba(184,132,74,0.1)', border: '1px solid rgba(184,132,74,0.24)', lineHeight: 1.6 }}
        >
          Your financial aid request is under review.
        </p>
      )}
      {aidRequestLoaded && aidRequest?.status === 'approved' && grantedAmount > 0 && (
        <div className="mb-3">
          <p
            className="text-[13px] rounded-xl px-4 py-3"
            style={{ color: '#2A5A3C', fontFamily: OUTFIT, backgroundColor: 'rgba(61,122,82,0.1)', border: '1px solid rgba(61,122,82,0.24)', lineHeight: 1.6 }}
          >
            Financial aid applied: -{formatFee(grantedAmount, currency)}
          </p>
          <p className="text-xs mt-1.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            Balance due: <span style={{ fontWeight: 700, color: '#1C1410' }}>{formatFee(remaining, currency)}</span>
          </p>
        </div>
      )}
      {aidRequestLoaded && aidRequest?.status === 'denied' && (
        <p
          className="text-[13px] rounded-xl px-4 py-3 mb-3"
          style={{ color: '#6E5F4E', fontFamily: OUTFIT, backgroundColor: 'rgba(154,138,120,0.1)', border: '1px solid rgba(154,138,120,0.24)', lineHeight: 1.6 }}
        >
          Your financial aid request was not approved. The standard fee applies.
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
      ) : owesSomething && manualActive && externalPaymentUrl ? (
        <>
          <a
            href={externalPaymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm transition-colors focus:outline-none"
            style={{
              backgroundColor: '#1B3828', color: '#EED98A',
              fontFamily: OUTFIT, letterSpacing: '0.06em', border: 'none', textDecoration: 'none',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            <CreditCard size={15} />
            PAY VIA THE ORGANIZING TEAM&apos;S PAYMENT PAGE
          </a>
          {externalPaymentNote && (
            <p className="text-[12.5px] mt-3" style={{ color: '#6E5F4E', fontFamily: OUTFIT, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {externalPaymentNote}
            </p>
          )}
          <p className="text-[11px] mt-3" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.5 }}>
            After you pay, the organizing team will confirm your payment here.
          </p>
        </>
      ) : owesSomething && manualActive ? (
        <>
          {externalPaymentNote && (
            <p className="text-[12.5px] mb-3" style={{ color: '#6E5F4E', fontFamily: OUTFIT, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {externalPaymentNote}
            </p>
          )}
          <p
            className="text-[13px] rounded-xl px-4 py-3"
            style={{ color: '#B8844A', fontFamily: OUTFIT, backgroundColor: 'rgba(184,132,74,0.1)', border: '1px solid rgba(184,132,74,0.24)', lineHeight: 1.6 }}
          >
            The organizing team collects this fee directly and will confirm your payment here.
          </p>
        </>
      ) : owesSomething && !paymentsEnabled ? (
        <div
          className="rounded-xl px-4 py-3"
          style={{ backgroundColor: 'rgba(184,132,74,0.1)', border: '1px solid rgba(184,132,74,0.24)' }}
        >
          <p className="text-[13px] font-bold" style={{ color: '#B8844A', fontFamily: OUTFIT, lineHeight: 1.5 }}>
            Payments coming soon
          </p>
          <p className="text-[12px] mt-1" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.6 }}>
            The organizing team is finishing payment setup — you&apos;ll be able to pay here shortly.
          </p>
        </div>
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

          <div className="mb-4">
            {!voucherOpen ? (
              <button
                type="button"
                onClick={() => setVoucherOpen(true)}
                className="text-xs font-bold focus:outline-none"
                style={{ color: '#1B3828', fontFamily: OUTFIT, textDecoration: 'underline', textUnderlineOffset: 3, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Have a voucher?
              </button>
            ) : (
              <div>
                <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: '#6E5F4E', fontFamily: OUTFIT, letterSpacing: '0.01em' }}>
                  VOUCHER CODE
                </label>
                <input
                  type="text"
                  value={voucherCode}
                  onChange={e => setVoucherCode(e.target.value)}
                  placeholder="e.g. EARLYBIRD10"
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm uppercase focus:outline-none"
                  style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', color: '#1C1410', fontFamily: OUTFIT }}
                />
                <p className="text-[11px] mt-1.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                  Checked and applied when you continue to checkout.
                </p>
              </div>
            )}
          </div>

          {payError && (
            <div
              className="flex items-start gap-2 rounded-xl px-3.5 py-2.5 mb-3"
              style={{ backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.22)' }}
            >
              <TriangleAlert size={14} style={{ color: '#8B2020', marginTop: 1, flexShrink: 0 }} />
              <p className="text-[12.5px]" style={{ color: '#8B2020', fontFamily: OUTFIT, lineHeight: 1.5 }}>
                {payError}
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
            {paying ? 'OPENING CHECKOUT...' : `PAY ${formatFee(amountToCharge, currency)}`}
          </button>
        </>
      ) : null}

      {payableNow && owesSomething && financialAidEnabled && aidRequestLoaded && !aidRequest && (
        <button
          type="button"
          onClick={() => setAidModalOpen(true)}
          className="w-full text-xs font-semibold text-center focus:outline-none mt-2.5"
          style={{ color: '#6E5F4E', fontFamily: OUTFIT, textDecoration: 'underline', textUnderlineOffset: 3, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Request Financial Aid
        </button>
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

      {aidModalOpen && (
        <ModalOverlay onClose={() => { if (!aidSubmitting) setAidModalOpen(false); }}>
          <div
            className="rounded-2xl p-6 flex flex-col gap-4"
            style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 440, maxWidth: 'calc(100vw - 32px)', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <p className="font-black text-lg" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              Request Financial Aid
            </p>

            {aidIntro && (
              <p className="text-sm" style={{ color: '#6E5F4E', fontFamily: OUTFIT, lineHeight: 1.6 }}>
                {aidIntro}
              </p>
            )}

            {aidQuestions.length > 0 && (
              <CustomQuestionsField
                questions={aidQuestions}
                answers={aidCustomAnswers}
                onChange={(next) => {
                  setAidCustomAnswers(next);
                  if (aidMissingIds.length > 0) {
                    setAidMissingIds(prev => prev.filter(id => answerIsEmpty(next[id])));
                  }
                }}
                missingIds={aidMissingIds}
              />
            )}

            <div>
              <label className="block font-semibold text-xs mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                Tell us about your circumstances
                <span className="ml-1 font-normal" style={{ color: '#9A8A78' }}>(required)</span>
              </label>
              <textarea
                rows={4}
                value={aidStatement}
                onChange={(e) => setAidStatement(e.target.value)}
                placeholder="Tell the organizers about your circumstances and what support you need"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none resize-none"
                style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', color: '#1C1410', fontFamily: OUTFIT }}
              />
            </div>

            <div>
              <label className="block font-semibold text-xs mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                Amount you are requesting <span className="font-normal" style={{ color: '#9A8A78' }}>(optional)</span>
              </label>
              <div className="flex items-center gap-2">
                <span style={{ color: '#6E5F4E', fontFamily: OUTFIT, fontWeight: 700 }}>{currencySymbol(currency)}</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={aidRequestedAmount}
                  onChange={(e) => setAidRequestedAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
                  style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', color: '#1C1410', fontFamily: OUTFIT }}
                />
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                Optional. The organizing team decides the final amount.
              </p>
            </div>

            {aidSubmitError && (
              <div
                className="flex items-start gap-2 rounded-xl px-3.5 py-2.5"
                style={{ backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.22)' }}
              >
                <TriangleAlert size={14} style={{ color: '#8B2020', marginTop: 1, flexShrink: 0 }} />
                <p className="text-[12.5px]" style={{ color: '#8B2020', fontFamily: OUTFIT, lineHeight: 1.5 }}>
                  {aidSubmitError}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setAidModalOpen(false)}
                disabled={aidSubmitting}
                className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
                style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: aidSubmitting ? 'default' : 'pointer' }}
              >
                CANCEL
              </button>
              <button
                onClick={handleSubmitAid}
                disabled={aidSubmitting || !aidStatement.trim()}
                className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
                style={{
                  backgroundColor: aidSubmitting || !aidStatement.trim() ? '#DDD4C0' : '#1B3828',
                  color: aidSubmitting || !aidStatement.trim() ? '#9A8A78' : '#EED98A',
                  fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: aidSubmitting || !aidStatement.trim() ? 'default' : 'pointer',
                }}
              >
                {aidSubmitting ? 'SUBMITTING…' : 'SUBMIT REQUEST'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </SectionCard>
  );
}
