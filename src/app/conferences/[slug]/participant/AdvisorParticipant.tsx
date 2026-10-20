'use client';

// Advisor participant view. Advisors never hold a committee allocation
// themselves. Owner, 20 Oct 2026: Overview is the advisor's OWN page, drawn by
// ParticipantView (DelegationLead: the next step, documents needed back, or
// "You're all set"); Delegation is the second section with the leader card
// (import, invite link, expected size, swaps); Committees the rooms the
// delegation sits in (delegation/advisor/AdvisorCommitteesSection; every room
// only without a delegation). Buying delegation credits and requesting
// delegation-pool aid live on /pay and in the parent's Payment section.

import { Landmark, Users } from 'lucide-react';
import DelegationPanel from './DelegationPanel';
import CommitteesSessionsCard from './CommitteesSessionsCard';
import AdvisorCommitteesSection from './delegation/advisor/AdvisorCommitteesSection';
import { OUTFIT } from './shared';
import { DashCard, CardHeading, INK_SOFT, Pane } from './dashboardKit';
import type { ParticipantApplication } from './types';

export default function AdvisorParticipant({ conferenceId, conferenceSlug, conferenceStartDate, application, allocationSwapMode, section, onSelectSection }: {
  conferenceId: string;
  conferenceSlug: string;
  conferenceStartDate: string | null;
  application: ParticipantApplication;
  allocationSwapMode: string;
  section: string;
  onSelectSection: (key: string) => void;
}) {
  return (
    <>
      <Pane show={section === 'delegation'} title="Your Delegation" icon={Users}>
        {application.society_id ? (
          <DelegationPanel
            conferenceId={conferenceId}
            conferenceSlug={conferenceSlug}
            societyId={application.society_id}
            allocationSwapMode={allocationSwapMode}
          />
        ) : (
          <DashCard>
            <CardHeading title="Your delegation" stackedHide />
            <p className="inline-flex items-center gap-2" style={{ fontFamily: OUTFIT, fontSize: 14, color: INK_SOFT, margin: 0 }}>
              <Users size={16} strokeWidth={2.2} aria-hidden />
              No delegation on file for this application yet.
            </p>
          </DashCard>
        )}
      </Pane>
      <Pane show={section === 'committees'} title="Committees" icon={Landmark}>
        {application.society_id ? (
          <AdvisorCommitteesSection
            conferenceId={conferenceId}
            conferenceStartDate={conferenceStartDate}
            societyId={application.society_id}
            onOpenDelegation={() => onSelectSection('delegation')}
          />
        ) : (
          <CommitteesSessionsCard conferenceId={conferenceId} conferenceStartDate={conferenceStartDate} />
        )}
      </Pane>
    </>
  );
}
