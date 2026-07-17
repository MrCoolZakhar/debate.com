'use client';

// PLEDGE & INVOICING card, advisor-only. A pledge is only ever about paying
// for delegation spots (the advisor's own fee is handled on the /pay page,
// like any other participant). Settled spots render straight from the
// invoices table (payer RLS read); unpaid spots get a PAY affordance
// offering one spot or all remaining, via kind 'pledge_spots'.

import { useEffect, useState } from 'react';
import { CreditCard, Mail, Check, TriangleAlert } from 'lucide-react';
import { ModalOverlay } from '@/components/CommitteeEditorModal';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { createCheckout } from '@/lib/payments';
import { formatFee, currencySymbol } from '@/lib/utils';
import { type CustomQuestion, type CustomAnswers, normalizeQuestions, validateAnswers, answerIsEmpty } from '@/lib/customQuestions';
import CustomQuestionsField from '@/components/CustomQuestionsField';
import { SectionCard, OUTFIT } from './shared';

interface PledgeSpotInvoice {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
}

interface DelegationAidRequest {
  status: 'pending' | 'approved' | 'denied';
  granted_amount: number | null;
  requested_amount: number | null;
}

export interface PledgeInvoicingCardProps {
  applicationId: string;
  conferenceId: string;
  societyId: string;
  /** Bumped by any settled invoice on this application — used to trigger a refetch. */
  amountPaid: number;
  pledgeType: 'delegation' | null;
  spotsPledged: number | null;
  pledgeConfirmedAt: string | null;
  delegateFeeAmount: number | null;
  delegateFeeCurrency: string | null;
  contactEmail: string | null;
  /** True once the conference's Stripe Connect onboarding is complete AND
   *  Stripe is the active payment_method. */
  paymentsEnabled: boolean;
  /** Organizer-provided payment page, shown when manual is the active method. */
  externalPaymentUrl: string | null;
  externalPaymentNote: string | null;
  /** True when 'manual' is the conference's active payment_method. */
  manualActive: boolean;
  /** Conference-level financial aid config (separate application, financial_aid_requests table). */
  financialAidEnabled: boolean;
  aidQuestions: CustomQuestion[];
  aidIntro: string | null;
}

export default function PledgeInvoicingCard({
  applicationId, conferenceId, societyId, amountPaid, pledgeType, spotsPledged, pledgeConfirmedAt, delegateFeeAmount, delegateFeeCurrency, contactEmail, paymentsEnabled, externalPaymentUrl, externalPaymentNote, manualActive, financialAidEnabled, aidQuestions, aidIntro,
}: PledgeInvoicingCardProps) {
  const { session } = useAuth();
  const [invoices, setInvoices] = useState<PledgeSpotInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingSpots, setPayingSpots] = useState<number | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [stubMessage, setStubMessage] = useState<string | null>(null);
  // Bumped after a delegation-aid "covered" checkout response (spots settled
  // server-side, no redirect) so the invoices list refetches without a reload.
  const [refreshKey, setRefreshKey] = useState(0);

  const spots = spotsPledged ?? 0;
  const currency = delegateFeeCurrency ?? 'GBP';
  const perSpot = delegateFeeAmount ?? 0;

  // ── Delegation financial aid request (pool, separate lifecycle, same
  // financial_aid_requests table but scoped by society_id instead of applicant) ──
  const [delegationAid, setDelegationAid] = useState<DelegationAidRequest | null>(null);
  const [delegationAidLoaded, setDelegationAidLoaded] = useState(false);
  const [aidModalOpen, setAidModalOpen] = useState(false);
  const [aidRequestedAmount, setAidRequestedAmount] = useState('');
  const [aidCustomAnswers, setAidCustomAnswers] = useState<CustomAnswers>({});
  const [aidMissingIds, setAidMissingIds] = useState<string[]>([]);
  const [aidSubmitting, setAidSubmitting] = useState(false);
  const [aidSubmitError, setAidSubmitError] = useState('');

  async function fetchDelegationAid(): Promise<DelegationAidRequest | null> {
    if (!financialAidEnabled || !session) return null;
    const { data } = await getAuthedClient(session.access_token)
      .from('financial_aid_requests')
      .select('status, granted_amount, requested_amount')
      .eq('society_id', societyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as DelegationAidRequest | null) ?? null;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const row = await fetchDelegationAid();
      if (cancelled) return;
      setDelegationAid(row);
      setDelegationAidLoaded(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financialAidEnabled, societyId, session]);

  async function handleSubmitDelegationAid() {
    if (aidSubmitting || !session) return;
    const questionCheck = validateAnswers(normalizeQuestions(aidQuestions), aidCustomAnswers);
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
      p_statement: null,
      p_requested_amount: requestedAmountNum != null && !Number.isNaN(requestedAmountNum) ? requestedAmountNum : null,
      p_custom_answers: aidCustomAnswers,
      p_society_id: societyId,
    });
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      setAidSubmitting(false);
      setAidSubmitError(result?.error || error?.message || 'Could not submit your request. Please try again.');
      return;
    }
    setAidSubmitting(false);
    setAidModalOpen(false);
    setAidRequestedAmount('');
    setAidCustomAnswers({});
    setAidMissingIds([]);
    const row = await fetchDelegationAid();
    setDelegationAid(row);
  }

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
    // refreshKey covers the delegation-aid "covered" checkout path, where
    // spots settle server-side without moving amountPaid (no cash changed hands).
  }, [applicationId, pledgeType, session, amountPaid, refreshKey]);

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
    if (result.status === 'error') {
      setPayError(result.message ?? 'Something went wrong. Please try again.');
    } else {
      if (result.status === 'recorded') setRefreshKey(k => k + 1);
      setStubMessage(result.message ?? null);
    }
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

          {!fullyCovered && remaining > 0 && manualActive && externalPaymentUrl && (
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

          {!fullyCovered && remaining > 0 && manualActive && !externalPaymentUrl && (
            <div
              className="rounded-xl px-4 py-3"
              style={{ border: '1px solid rgba(221,212,192,0.7)', backgroundColor: 'rgba(237,231,216,0.25)' }}
            >
              <p className="text-sm font-semibold" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: '0 0 4px 0' }}>
                {remaining} delegation spot{remaining === 1 ? '' : 's'} remaining
              </p>
              {externalPaymentNote && (
                <p className="text-xs mb-2" style={{ color: '#6E5F4E', fontFamily: OUTFIT, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {externalPaymentNote}
                </p>
              )}
              <p className="text-[13px] rounded-xl px-3 py-2.5" style={{ color: '#B8844A', fontFamily: OUTFIT, backgroundColor: 'rgba(184,132,74,0.1)', border: '1px solid rgba(184,132,74,0.24)', lineHeight: 1.6 }}>
                The organizing team collects this fee directly and will confirm your payment here.
              </p>
            </div>
          )}

          {!fullyCovered && remaining > 0 && !manualActive && !paymentsEnabled && (
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

          {financialAidEnabled && delegationAidLoaded && (
            <>
              {!delegationAid && (
                <button
                  type="button"
                  onClick={() => setAidModalOpen(true)}
                  className="text-xs font-semibold text-left focus:outline-none mt-1"
                  style={{ color: '#6E5F4E', fontFamily: OUTFIT, textDecoration: 'underline', textUnderlineOffset: 3, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Request financial aid for your delegation
                </button>
              )}
              {delegationAid?.status === 'pending' && (
                <p
                  className="text-[13px] rounded-xl px-4 py-3"
                  style={{ color: '#B8844A', fontFamily: OUTFIT, backgroundColor: 'rgba(184,132,74,0.1)', border: '1px solid rgba(184,132,74,0.24)', lineHeight: 1.6 }}
                >
                  Delegation aid request under review.
                </p>
              )}
              {delegationAid?.status === 'approved' && (
                <p
                  className="text-[13px] rounded-xl px-4 py-3"
                  style={{ color: '#2A5A3C', fontFamily: OUTFIT, backgroundColor: 'rgba(61,122,82,0.1)', border: '1px solid rgba(61,122,82,0.24)', lineHeight: 1.6 }}
                >
                  Delegation aid approved — {formatFee(delegationAid.granted_amount ?? 0, currency)} applied across your delegation&apos;s spots.
                </p>
              )}
              {delegationAid?.status === 'denied' && (
                <p
                  className="text-[13px] rounded-xl px-4 py-3"
                  style={{ color: '#6E5F4E', fontFamily: OUTFIT, backgroundColor: 'rgba(154,138,120,0.1)', border: '1px solid rgba(154,138,120,0.24)', lineHeight: 1.6 }}
                >
                  Delegation aid request was not approved.
                </p>
              )}
            </>
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

      {aidModalOpen && (
        <ModalOverlay onClose={() => { if (!aidSubmitting) setAidModalOpen(false); }}>
          <div
            className="rounded-2xl p-6 flex flex-col gap-4"
            style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 440, maxWidth: 'calc(100vw - 32px)', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <p className="font-black text-lg" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              Request Financial Aid for Your Delegation
            </p>

            {aidIntro && (
              <p className="text-sm" style={{ color: '#6E5F4E', fontFamily: OUTFIT, lineHeight: 1.6 }}>
                {aidIntro}
              </p>
            )}

            {aidQuestions.length > 0 && (
              <CustomQuestionsField
                questions={normalizeQuestions(aidQuestions)}
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
                Amount you are requesting for the delegation <span className="font-normal" style={{ color: '#9A8A78' }}>(optional)</span>
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
                onClick={handleSubmitDelegationAid}
                disabled={aidSubmitting}
                className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
                style={{
                  backgroundColor: aidSubmitting ? '#DDD4C0' : '#1B3828',
                  color: aidSubmitting ? '#9A8A78' : '#EED98A',
                  fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: aidSubmitting ? 'default' : 'pointer',
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
