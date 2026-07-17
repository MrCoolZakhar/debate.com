'use client';

// Advisor participant view, panel + invoicing + spine only. Advisors never
// hold a committee allocation themselves, so there's no delegate-style
// content here beyond the delegation roster and their own pledge.

import DelegationPanel from './DelegationPanel';
import DelegationCreditsCard from './DelegationCreditsCard';
import PledgeInvoicingCard from './PledgeInvoicingCard';
import { SectionCard, OUTFIT } from './shared';
import type { ParticipantApplication, ParticipantRoleConfig } from './types';
import { type FormBlock } from '@/lib/customQuestions';

export default function AdvisorParticipant({ conferenceId, application, allocationSwapMode, roleConfigs, financialAidEnabled, aidBlocks, aidIntro }: {
  conferenceId: string;
  application: ParticipantApplication;
  allocationSwapMode: string;
  roleConfigs: ParticipantRoleConfig[];
  financialAidEnabled: boolean;
  aidBlocks: FormBlock[];
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
        societyId={application.society_id}
        currency={delegateConfig?.fee_currency ?? 'GBP'}
        financialAidEnabled={financialAidEnabled}
        aidBlocks={aidBlocks}
        aidIntro={aidIntro}
      />
    </div>
  );
}
