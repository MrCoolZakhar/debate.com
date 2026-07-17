'use client';

// DELEGATION FINANCIAL AID card, advisor-only. Distinct from the applicant's
// own aid request (AidRequestModal) — this one is scoped by society_id and
// covers the whole delegation's fees. The pledge/pay-spots flow this
// component used to own (settled spot list, PAY 1/PAY ALL buttons) is
// superseded by the pledge_spot invoice cards + "Add Delegation Spots"
// panel on /pay — this component now only owns the aid-request sub-flow.

import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { ModalOverlay } from '@/components/CommitteeEditorModal';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { formatFee, currencySymbol } from '@/lib/utils';
import { type FormBlock, type CustomAnswers, questionsOf, validateAnswers, answerIsEmpty } from '@/lib/customQuestions';
import CustomQuestionsField from '@/components/CustomQuestionsField';
import { SectionCard, OUTFIT } from './shared';

interface DelegationAidRequest {
  status: 'pending' | 'approved' | 'denied';
  granted_amount: number | null;
  requested_amount: number | null;
}

export interface PledgeInvoicingCardProps {
  applicationId: string;
  societyId: string;
  currency: string;
  /** Conference-level financial aid config (separate application, financial_aid_requests table). */
  financialAidEnabled: boolean;
  aidBlocks: FormBlock[];
  aidIntro: string | null;
}

export default function PledgeInvoicingCard({
  applicationId, societyId, currency, financialAidEnabled, aidBlocks, aidIntro,
}: PledgeInvoicingCardProps) {
  const { session } = useAuth();

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
    if (!financialAidEnabled || !session) { setDelegationAidLoaded(true); return; }
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
    const questionCheck = validateAnswers(questionsOf(aidBlocks), aidCustomAnswers);
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

  if (!financialAidEnabled) return null;

  return (
    <SectionCard>
      <p className="mb-4" style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 16px 0' }}>
        DELEGATION FINANCIAL AID
      </p>

      {!delegationAidLoaded ? (
        <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          Loading…
        </p>
      ) : !delegationAid ? (
        <button
          type="button"
          onClick={() => setAidModalOpen(true)}
          className="text-xs font-semibold text-left focus:outline-none"
          style={{ color: '#6E5F4E', fontFamily: OUTFIT, textDecoration: 'underline', textUnderlineOffset: 3, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Request financial aid for your delegation
        </button>
      ) : delegationAid.status === 'pending' ? (
        <p
          className="text-[13px] rounded-xl px-4 py-3"
          style={{ color: '#B8844A', fontFamily: OUTFIT, backgroundColor: 'rgba(184,132,74,0.1)', border: '1px solid rgba(184,132,74,0.24)', lineHeight: 1.6 }}
        >
          Delegation aid request under review.
        </p>
      ) : delegationAid.status === 'approved' ? (
        <p
          className="text-[13px] rounded-xl px-4 py-3"
          style={{ color: '#2A5A3C', fontFamily: OUTFIT, backgroundColor: 'rgba(61,122,82,0.1)', border: '1px solid rgba(61,122,82,0.24)', lineHeight: 1.6 }}
        >
          Delegation aid approved — {formatFee(delegationAid.granted_amount ?? 0, currency)} applied across your delegation&apos;s spots.
        </p>
      ) : (
        <p
          className="text-[13px] rounded-xl px-4 py-3"
          style={{ color: '#6E5F4E', fontFamily: OUTFIT, backgroundColor: 'rgba(154,138,120,0.1)', border: '1px solid rgba(154,138,120,0.24)', lineHeight: 1.6 }}
        >
          Delegation aid request was not approved.
        </p>
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

            {aidBlocks.length > 0 && (
              <CustomQuestionsField
                blocks={aidBlocks}
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
