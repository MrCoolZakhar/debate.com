'use client';

// Delegate participant view, reused for both 'delegate' and 'head-delegate'
// applications. This whole tree sits inside the spine's PayGate.

import AllocationCard from './AllocationCard';
import CoDelegateCard from './CoDelegateCard';
import StudyGuideCard from './StudyGuideCard';
import PositionPaperCard from './PositionPaperCard';
import DelegationPlacard from './DelegationPlacard';
import DelegationPanel from './DelegationPanel';
import MyAwardsCard from './MyAwardsCard';
import type { ParticipantApplication, ParticipantAllocation, ParticipantCommittee } from './types';

export default function DelegateParticipant({ conferenceId, conferenceSlug, conferenceStartDate, application, myAllocation, committees, allocationSwapMode }: {
  conferenceId: string;
  conferenceSlug: string;
  conferenceStartDate: string | null;
  application: ParticipantApplication;
  myAllocation: ParticipantAllocation | null;
  committees: ParticipantCommittee[];
  allocationSwapMode: string;
}) {
  const committee = myAllocation ? committees.find(c => c.id === myAllocation.conference_committee_id) ?? null : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Only ever renders once the secretariat has published and this
          delegate's allocation holds an honour; otherwise nothing. */}
      <MyAwardsCard conferenceId={conferenceId} conferenceSlug={conferenceSlug} myAllocation={myAllocation} />

      <AllocationCard
        committee={committee}
        myAllocation={myAllocation}
        conferenceStartDate={conferenceStartDate}
      />

      {/* Double delegations only: the co-delegate and what the two share. */}
      <CoDelegateCard conferenceId={conferenceId} myAllocation={myAllocation} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StudyGuideCard committeeId={myAllocation?.conference_committee_id ?? null} />
        <PositionPaperCard conferenceId={conferenceId} conferenceSlug={conferenceSlug} myAllocation={myAllocation} />
      </div>

      {/* One delegation card for everyone in a delegation (25 Sep 2026): the
          roster, grouped and paged, the viewer first. A delegate sees only
          their own allocation and payment; leaders see everything. An
          independent delegate keeps the plain placard. */}
      {application.society_id ? (
        <DelegationPanel
          conferenceId={conferenceId}
          conferenceSlug={conferenceSlug}
          societyId={application.society_id}
          allocationSwapMode={allocationSwapMode}
        />
      ) : (
        <DelegationPlacard
          societyId={application.society_id}
          paymentStatus={application.payment_status}
          selfPaid={application.self_paid}
          amountPaid={application.amount_paid}
        />
      )}
    </div>
  );
}
