'use client';

// Request Financial Aid modal, extracted from PaymentPanel so both the
// participant view and the /pay page can open it against the same
// financial_aid_requests lifecycle (submit_aid_request RPC). Owns only the
// form + submit — the caller still owns fetching/displaying the resulting
// aid request status (see AidRequestModalProps.onSubmitted).

import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { ModalOverlay } from '@/components/CommitteeEditorModal';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { currencySymbol } from '@/lib/utils';
import { type CustomQuestion, type CustomAnswers, validateAnswers, answerIsEmpty } from '@/lib/customQuestions';
import CustomQuestionsField from '@/components/CustomQuestionsField';
import { OUTFIT } from './shared';

export interface AidRequestModalProps {
  applicationId: string;
  conferenceId: string;
  aidQuestions: CustomQuestion[];
  aidIntro: string | null;
  currency: string;
  /** Set when requesting aid for a whole delegation pool rather than a single applicant. */
  societyId?: string;
  open: boolean;
  onClose: () => void;
  /** Called after a successful submit, before onClose — the caller refetches its own aid-request state. */
  onSubmitted: () => void;
}

export default function AidRequestModal({
  applicationId, aidQuestions, aidIntro, currency, societyId, open, onClose, onSubmitted,
}: AidRequestModalProps) {
  const { session } = useAuth();
  const [requestedAmount, setRequestedAmount] = useState('');
  const [customAnswers, setCustomAnswers] = useState<CustomAnswers>({});
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  if (!open) return null;

  async function handleSubmit() {
    if (submitting || !session) return;
    const questionCheck = validateAnswers(aidQuestions, customAnswers);
    if (!questionCheck.valid) {
      setMissingIds(questionCheck.missingIds);
      setSubmitError('Please answer all required questions.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    const supabase = getAuthedClient(session.access_token);
    const requestedAmountNum = requestedAmount.trim() ? parseFloat(requestedAmount) : null;
    const { data, error } = await supabase.rpc('submit_aid_request', {
      p_application_id: applicationId,
      p_statement: null,
      p_requested_amount: requestedAmountNum != null && !Number.isNaN(requestedAmountNum) ? requestedAmountNum : null,
      p_custom_answers: customAnswers,
      p_society_id: societyId ?? null,
    });
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      setSubmitting(false);
      setSubmitError(result?.error || error?.message || 'Could not submit your request. Please try again.');
      return;
    }
    setSubmitting(false);
    setRequestedAmount('');
    setCustomAnswers({});
    setMissingIds([]);
    onSubmitted();
    onClose();
  }

  return (
    <ModalOverlay onClose={() => { if (!submitting) onClose(); }}>
      <div
        className="rounded-2xl p-6 flex flex-col gap-4"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 440, maxWidth: 'calc(100vw - 32px)', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <p className="font-black text-lg" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          {societyId ? 'Request Financial Aid for Your Delegation' : 'Request Financial Aid'}
        </p>

        {aidIntro && (
          <p className="text-sm" style={{ color: '#6E5F4E', fontFamily: OUTFIT, lineHeight: 1.6 }}>
            {aidIntro}
          </p>
        )}

        {aidQuestions.length > 0 && (
          <CustomQuestionsField
            questions={aidQuestions}
            answers={customAnswers}
            onChange={(next) => {
              setCustomAnswers(next);
              if (missingIds.length > 0) {
                setMissingIds(prev => prev.filter(id => answerIsEmpty(next[id])));
              }
            }}
            missingIds={missingIds}
          />
        )}

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
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
              style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', color: '#1C1410', fontFamily: OUTFIT }}
            />
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            Optional. The organizing team decides the final amount.
          </p>
        </div>

        {submitError && (
          <div
            className="flex items-start gap-2 rounded-xl px-3.5 py-2.5"
            style={{ backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.22)' }}
          >
            <TriangleAlert size={14} style={{ color: '#8B2020', marginTop: 1, flexShrink: 0 }} />
            <p className="text-[12.5px]" style={{ color: '#8B2020', fontFamily: OUTFIT, lineHeight: 1.5 }}>
              {submitError}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
            style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: submitting ? 'default' : 'pointer' }}
          >
            CANCEL
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: submitting ? '#DDD4C0' : '#1B3828',
              color: submitting ? '#9A8A78' : '#EED98A',
              fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: submitting ? 'default' : 'pointer',
            }}
          >
            {submitting ? 'SUBMITTING…' : 'SUBMIT REQUEST'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
