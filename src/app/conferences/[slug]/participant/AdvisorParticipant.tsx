'use client';

// Advisor participant view. Advisors never hold a committee allocation
// themselves, so their dashboard is the delegation: Overview is its summary
// (name, how many delegates, how many are assigned, paid spots), Delegation
// the full members table with the leader tools (import, invitation link,
// pledges, swaps), Committees every room with its session. Buying delegation
// credits and requesting delegation-pool aid live on /pay and in the parent's
// Payment section (the single money surface).
//
// ONE DelegationPanel instance serves both Overview and Delegation (it takes
// the active `section`), so its reads and a half-made swap survive a switch.

import { Users } from 'lucide-react';
import DelegationPanel from './DelegationPanel';
import CommitteesSessionsCard from './CommitteesSessionsCard';
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
      {application.society_id ? (
        <DelegationPanel
          conferenceId={conferenceId}
          conferenceSlug={conferenceSlug}
          societyId={application.society_id}
          allocationSwapMode={allocationSwapMode}
          section={section}
          onOpenMembers={() => onSelectSection('delegation')}
        />
      ) : (
        <Pane show={section === 'overview' || section === 'delegation'}>
          <DashCard>
            <CardHeading title="Your delegation" />
            <p className="inline-flex items-center gap-2" style={{ fontFamily: OUTFIT, fontSize: 14, color: INK_SOFT, margin: 0 }}>
              <Users size={16} strokeWidth={2.2} aria-hidden />
              No delegation on file for this application yet.
            </p>
          </DashCard>
        </Pane>
      )}
      <Pane show={section === 'committees'}>
        <CommitteesSessionsCard conferenceId={conferenceId} conferenceStartDate={conferenceStartDate} />
      </Pane>
    </>
  );
}
