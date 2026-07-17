'use client';

// Advisor participant view, panel + invoicing + spine only. Advisors never
// hold a committee allocation themselves, so there's no delegate-style
// content here beyond the delegation roster and their own pledge.

import DelegationPanel from './DelegationPanel';
import DelegationCreditsCard from './DelegationCreditsCard';
import PledgeInvoicingCard from './PledgeInvoicingCard';
import { SectionCard, OUTFIT } from './shared';
import type { ParticipantApplication, ParticipantRoleConfig } from './types';
import { type CustomQuestion } from '@/lib/customQuestions';

export default function AdvisorParticipant({ conferenceId, application, allocationSwapMode, roleConfigs, contactEmail, paymentsEnabled, externalPaymentUrl, externalPaymentNote, manualActive, financialAidEnabled, aidQuestions, aidIntro }: {
  conferenceId: string;
  application: ParticipantApplication;
  allocationSwapMode: string;
  roleConfigs: ParticipantRoleConfig[];
  contactEmail: string | null;
  paymentsEnabled: boolean;
  externalPaymentUrl: string | null;
  externalPaymentNote: string | null;
  manualActive: boolean;
  financialAidEnabled: boolean;
  aidQuestions: CustomQuestion[];
  aidIntro: string | null;
}) {
  if (!application.society_id) {
    return (
      <SectionCard>
        <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          No delegation on file for this application.
        </p>
      </SectionCard>
    );
  }

  const delegateConfig = roleConfigs.find(rc => rc.role === 'delegate') ?? null;

  return (
    <div className="flex flex-col gap-6">
      <DelegationCreditsCard societyId={application.society_id} />
      <DelegationPanel
        conferenceId={conferenceId}
        societyId={application.society_id}
        allocationSwapMode={allocationSwapMode}
      />
      <PledgeInvoicingCard
        applicationId={application.id}
        conferenceId={conferenceId}
        societyId={application.society_id}
        amountPaid={application.amount_paid}
        pledgeType={application.pledge_type}
        spotsPledged={application.spots_pledged}
        pledgeConfirmedAt={application.pledge_confirmed_at}
        delegateFeeAmount={delegateConfig?.fee_amount ?? null}
        delegateFeeCurrency={delegateConfig?.fee_currency ?? null}
        contactEmail={contactEmail}
        paymentsEnabled={paymentsEnabled}
        externalPaymentUrl={externalPaymentUrl}
        externalPaymentNote={externalPaymentNote}
        manualActive={manualActive}
        financialAidEnabled={financialAidEnabled}
        aidQuestions={aidQuestions}
        aidIntro={aidIntro}
      />
    </div>
  );
}
