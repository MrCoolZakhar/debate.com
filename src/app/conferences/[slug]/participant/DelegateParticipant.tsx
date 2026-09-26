'use client';

// Delegate participant view, reused for both 'delegate' and 'head-delegate'
// applications. This whole tree sits inside the spine's PayGate.
//
// Dashboard sections (26 Sep 2026): the parent owns the sub-nav and passes the
// active `section`. Every card here stays MOUNTED and is hidden with
// display:none when its section is not shown (Pane), so switching never
// refetches a card or loses a half-uploaded position paper.
//   overview    published awards (only when there are some), the assignment
//   committee   the committee card (topics, live session), the co-delegate
//   documents   the study guide and the position paper
//   delegation  the delegation roster (members of a delegation only)

import AllocationCard from './AllocationCard';
import AssignmentHero from './AssignmentHero';
import CoDelegateCard from './CoDelegateCard';
import StudyGuideCard from './StudyGuideCard';
import PositionPaperCard from './PositionPaperCard';
import DelegationPanel from './DelegationPanel';
import MyAwardsCard from './MyAwardsCard';
import { Pane } from './dashboardKit';
import type { ParticipantApplication, ParticipantAllocation, ParticipantCommittee } from './types';

export default function DelegateParticipant({ conferenceId, conferenceSlug, conferenceStartDate, application, myAllocation, committees, allocationSwapMode, section }: {
  conferenceId: string;
  conferenceSlug: string;
  conferenceStartDate: string | null;
  application: ParticipantApplication;
  myAllocation: ParticipantAllocation | null;
  committees: ParticipantCommittee[];
  allocationSwapMode: string;
  section: string;
}) {
  const committee = myAllocation ? committees.find(c => c.id === myAllocation.conference_committee_id) ?? null : null;

  return (
    <>
      <Pane show={section === 'overview'}>
        {/* Only ever renders once the secretariat has published and this
            delegate's allocation holds an honour; otherwise nothing. */}
        <MyAwardsCard conferenceId={conferenceId} conferenceSlug={conferenceSlug} myAllocation={myAllocation} />
        <AssignmentHero
          committee={committee}
          myAllocation={myAllocation}
          conferenceStartDate={conferenceStartDate}
          independent={!application.society_id}
        />
      </Pane>

      <Pane show={section === 'committee'}>
        <AllocationCard
          committee={committee}
          myAllocation={myAllocation}
          conferenceStartDate={conferenceStartDate}
          showCountry={false}
        />
        {/* Double delegations only: the co-delegate and what the two share. */}
        <CoDelegateCard conferenceId={conferenceId} myAllocation={myAllocation} />
      </Pane>

      <Pane show={section === 'documents'}>
        <PositionPaperCard conferenceId={conferenceId} conferenceSlug={conferenceSlug} myAllocation={myAllocation} />
        <StudyGuideCard committeeId={myAllocation?.conference_committee_id ?? null} />
      </Pane>

      {/* One delegation card for everyone in a delegation (25 Sep 2026): the
          roster, grouped, the viewer first. A delegate sees only their own
          allocation and payment; leaders see everything. An independent
          delegate has no Delegation section (Overview says so instead). */}
      {application.society_id && (
        <Pane show={section === 'delegation'}>
          <DelegationPanel
            conferenceId={conferenceId}
            conferenceSlug={conferenceSlug}
            societyId={application.society_id}
            allocationSwapMode={allocationSwapMode}
            section="delegation"
          />
        </Pane>
      )}
    </>
  );
}
