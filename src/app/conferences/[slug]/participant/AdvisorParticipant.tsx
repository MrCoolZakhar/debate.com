'use client';

// Advisor participant view, panel + spine only. Advisors never hold a
// committee allocation themselves, so there's no delegate-style content
// here beyond the delegation roster. Buying delegation credits and
// requesting delegation-pool financial aid both live on /pay now (the
// single money surface), not duplicated here.

import DelegationPanel from './DelegationPanel';
import CommitteesSessionsCard from './CommitteesSessionsCard';
import { SectionCard, OUTFIT } from './shared';
import type { ParticipantApplication } from './types';

export default function AdvisorParticipant({ conferenceId, conferenceStartDate, application, allocationSwapMode }: {
  conferenceId: string;
  conferenceStartDate: string | null;
  application: ParticipantApplication;
  allocationSwapMode: string;
}) {
  if (!application.society_id) {
    return (
      <div className="flex flex-col gap-6">
        <SectionCard>
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            No delegation on file for this application.
          </p>
        </SectionCard>
        <CommitteesSessionsCard conferenceId={conferenceId} conferenceStartDate={conferenceStartDate} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <DelegationPanel
        conferenceId={conferenceId}
        societyId={application.society_id}
        allocationSwapMode={allocationSwapMode}
      />
      <CommitteesSessionsCard conferenceId={conferenceId} conferenceStartDate={conferenceStartDate} />
    </div>
  );
}
