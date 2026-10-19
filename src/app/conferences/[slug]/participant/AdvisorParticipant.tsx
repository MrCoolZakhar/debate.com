'use client';

// Advisor participant view. Advisors never hold a committee allocation
// themselves, so their dashboard is the delegation: Overview is its summary
// (name, how many delegates, how many are assigned, paid spots), Delegation
// the full members table with the leader tools (import, invitation link,
// pledges, swaps), Committees the rooms the delegation sits in
// (delegation/advisor/AdvisorCommitteesSection; every room only without a delegation). Buying delegation
// credits and requesting delegation-pool aid live on /pay and in the parent's
// Payment section (the single money surface).
//
// ONE DelegationPanel instance serves both Overview and Delegation (it takes
// the active `section`), so its reads and a half-made swap survive a switch.
// With a delegation (19 Oct 2026) there is no Overview section: Delegation is
// first, with the page's next-step card above the leader card.

import { Landmark, Users } from 'lucide-react';
import DelegationPanel from './DelegationPanel';
import CommitteesSessionsCard from './CommitteesSessionsCard';
import AdvisorCommitteesSection from './delegation/advisor/AdvisorCommitteesSection';
import { OUTFIT } from './shared';
import { DashCard, CardHeading, INK_SOFT, Pane, StackHeading, useDashStacked } from './dashboardKit';
import type { ParticipantApplication } from './types';

export default function AdvisorParticipant({ conferenceId, conferenceSlug, conferenceStartDate, application, allocationSwapMode, section, onSelectSection, delegationLead }: {
  conferenceId: string;
  conferenceSlug: string;
  conferenceStartDate: string | null;
  application: ParticipantApplication;
  allocationSwapMode: string;
  section: string;
  onSelectSection: (key: string) => void;
  /** With a delegation, Delegation is the first section and opens with the
   *  page's next-step card (DelegationLead, owner 19 Oct 2026). */
  delegationLead?: React.ReactNode;
}) {
  // The one-page phone dashboard (below xl): Your Delegation (the full
  // members card, whatever section the desktop has open), then Committees.
  const stacked = useDashStacked();
  return (
    <>
      {application.society_id && stacked && <StackHeading title="Your Delegation" icon={Users} />}
      {application.society_id && delegationLead && <Pane show={section === 'delegation'}>{delegationLead}</Pane>}
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
        <Pane show={section === 'overview' || section === 'delegation'} title="Your Delegation" icon={Users}>
          <DashCard>
            <CardHeading title="Your delegation" stackedHide />
            <p className="inline-flex items-center gap-2" style={{ fontFamily: OUTFIT, fontSize: 14, color: INK_SOFT, margin: 0 }}>
              <Users size={16} strokeWidth={2.2} aria-hidden />
              No delegation on file for this application yet.
            </p>
          </DashCard>
        </Pane>
      )}
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
