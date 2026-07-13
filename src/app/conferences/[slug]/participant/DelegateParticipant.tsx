'use client';

// Delegate participant view — reused for both 'delegate' and 'head-delegate'
// applications. This whole tree sits inside the spine's PayGate.

import AllocationCard from './AllocationCard';
import StudyGuideCard from './StudyGuideCard';
import PositionPaperCard from './PositionPaperCard';
import DelegationPlacard from './DelegationPlacard';
import DelegationPanel from './DelegationPanel';
import type { ParticipantApplication, ParticipantAllocation, ParticipantCommittee } from './types';

export default function DelegateParticipant({ conferenceId, application, myAllocation, committees, allocationSwapMode }: {
  conferenceId: string;
  application: ParticipantApplication;
  myAllocation: ParticipantAllocation | null;
  committees: ParticipantCommittee[];
  allocationSwapMode: string;
}) {
  const committee = myAllocation ? committees.find(c => c.id === myAllocation.conference_committee_id) ?? null : null;

  return (
    <div className="flex flex-col gap-6">
      <AllocationCard
        committee={committee}
        countryCode={myAllocation?.country_code ?? null}
        countryName={myAllocation?.country_name ?? null}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StudyGuideCard committeeId={myAllocation?.conference_committee_id ?? null} />
        <PositionPaperCard conferenceId={conferenceId} myAllocation={myAllocation} />
      </div>

      <DelegationPlacard
        societyId={application.society_id}
        paymentStatus={application.payment_status}
        selfPaid={application.self_paid}
        amountPaid={application.amount_paid}
      />

      {/* Head delegates additionally get the full delegation panel below their own view */}
      {application.role === 'head-delegate' && application.society_id && (
        <DelegationPanel
          conferenceId={conferenceId}
          societyId={application.society_id}
          allocationSwapMode={allocationSwapMode}
        />
      )}
    </div>
  );
}
