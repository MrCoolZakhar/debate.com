'use client';

// PLEDGE & INVOICING card — advisor-only. Their own pledge rendered as
// invoice lines, each with a PAY affordance calling the payments stub.

import { useState } from 'react';
import { CreditCard, Mail } from 'lucide-react';
import { formatFee } from '@/lib/utils';
import { ModalOverlay } from '@/components/CommitteeEditorModal';
import { initiatePayment } from '@/lib/payments';
import { SectionCard, OUTFIT } from './shared';

export interface InvoicingLine {
  label: string;
  satisfied: boolean;
  satisfiedLabel: string;
  amountCents: number;
}

export interface PledgeInvoicingCardProps {
  applicationId: string;
  pledgeType: 'own' | 'delegation' | 'both' | null;
  spotsPledged: number | null;
  paymentStatus: string;
  pledgeConfirmedAt: string | null;
  advisorFeeAmount: number | null;
  advisorFeeCurrency: string | null;
  delegateFeeAmount: number | null;
  contactEmail: string | null;
}

export default function PledgeInvoicingCard({
  applicationId, pledgeType, spotsPledged, paymentStatus, pledgeConfirmedAt,
  advisorFeeAmount, advisorFeeCurrency, delegateFeeAmount, contactEmail,
}: PledgeInvoicingCardProps) {
  const [payingLine, setPayingLine] = useState<number | null>(null);
  const [stubMessage, setStubMessage] = useState<string | null>(null);

  const currency = advisorFeeCurrency ?? 'GBP';
  const lines: InvoicingLine[] = [];

  if (pledgeType === 'own' || pledgeType === 'both') {
    const fee = advisorFeeAmount ?? 0;
    lines.push({
      label: fee > 0 ? `Your fee — ${formatFee(fee, currency)}` : 'Your fee',
      satisfied: paymentStatus === 'paid' || paymentStatus === 'waived',
      satisfiedLabel: 'received',
      amountCents: Math.round(fee * 100),
    });
  }
  if (pledgeType === 'delegation' || pledgeType === 'both') {
    const spots = spotsPledged ?? 0;
    lines.push({
      label: `${spots} delegation spot${spots === 1 ? '' : 's'}`,
      satisfied: !!pledgeConfirmedAt,
      satisfiedLabel: 'covered',
      amountCents: Math.round((delegateFeeAmount ?? 0) * spots * 100),
    });
  }

  async function handlePay(index: number, amountCents: number) {
    if (payingLine !== null) return;
    setPayingLine(index);
    const result = await initiatePayment({ applicationId, amountCents });
    setPayingLine(null);
    setStubMessage(result.message);
  }

  return (
    <SectionCard>
      <p className="mb-4" style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: '0 0 16px 0' }}>
        PLEDGE &amp; INVOICING
      </p>

      {lines.length === 0 ? (
        <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          No pledge on file yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {lines.map((line, i) => (
            <div
              key={line.label}
              className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
              style={{ border: '1px solid rgba(221,212,192,0.7)', backgroundColor: 'rgba(237,231,216,0.25)' }}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}>{line.label}</p>
                <p className="text-xs mt-0.5" style={{ color: line.satisfied ? '#3D7A52' : '#B8844A', fontFamily: OUTFIT, fontWeight: 600 }}>
                  {line.satisfied ? line.satisfiedLabel : 'pending'}
                </p>
              </div>
              {!line.satisfied && (
                <button
                  onClick={() => handlePay(i, line.amountCents)}
                  disabled={payingLine !== null}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none flex-shrink-0"
                  style={{
                    backgroundColor: payingLine === i ? '#DDD4C0' : '#1B3828',
                    color: payingLine === i ? '#9A8A78' : '#EED98A',
                    border: 'none', fontFamily: OUTFIT, letterSpacing: '0.05em', cursor: payingLine !== null ? 'default' : 'pointer',
                  }}
                >
                  <CreditCard size={12} /> {payingLine === i ? '...' : 'PAY'}
                </button>
              )}
            </div>
          ))}
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
