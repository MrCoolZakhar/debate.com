'use client';

// Delegate participant view, reused for both 'delegate' and 'head-delegate'
// applications. This whole tree sits inside the spine's PayGate.
//
// Dashboard sections (26 Sep 2026): the parent owns the sub-nav and passes the
// active `section`. Every card here stays MOUNTED and is hidden with
// display:none when its section is not shown (Pane), so switching never
// refetches a card or loses a half-uploaded position paper.
//   overview    published awards (only when there are some), the assignment
//               (independent delegates only; see delegation below)
//   committee   the committee card (5A: topics, co-delegate, live room), the
//               study guide and paper at a glance, the committee list
//   documents   the study guide and the position paper
//   delegation  members of a delegation only, and FIRST (owner, 19 Oct 2026:
//               Delegation is their overview, there is no Overview section):
//               the page's next-step card (DelegationLead), published awards,
//               then the leader or member card. The assignment hero is left
//               out for them: the Committee section and the delegation card
//               already show the seat.
// Below xl (10 Oct 2026) there is no sub-nav: the panes stack in this order on
// one page, with Payment and Support placed by the parent.

import { useCallback, useState } from 'react';
import { FileText, Flag, Landmark, Users } from 'lucide-react';
import AssignmentHero from './AssignmentHero';
import MyCommitteeSection from './delegation/committee/MyCommitteeSection';
import StudyGuideCard from './StudyGuideCard';
import PositionPaperCard from './PositionPaperCard';
import DelegationPanel from './DelegationPanel';
import MyAwardsCard from './MyAwardsCard';
import { Pane, useDashStacked, useReportNextStep, type NextStep } from './dashboardKit';
import { effectiveReleaseTime, formatReleaseDate } from './shared';
import type { ParticipantApplication, ParticipantAllocation, ParticipantCommittee } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** The delegate's own next step for the phone page, from what the page and
 *  the position paper card already read. The page puts paying and review
 *  first; this is what comes after. */
function delegateNextStep(
  myAllocation: ParticipantAllocation | null,
  conferenceStartDate: string | null,
  paper: { enabled: boolean; submitted: boolean } | null,
): NextStep {
  if (!myAllocation) {
    return { kind: 'done', line: 'The organisers will assign your committee and country next. You will get an email when they do.' };
  }
  const cc = myAllocation.conference_committees;
  const code = cc?.session_code ?? null;
  const releaseMs = effectiveReleaseTime(cc?.released_to_delegates_at ?? null, conferenceStartDate);
  const now = Date.now();
  if (code && releaseMs !== null && releaseMs <= now) {
    return { kind: 'action', line: 'Your committee room is open.', action: { label: 'Join session', href: `/join?code=${code}` } };
  }
  const deadline = cc?.position_paper_deadline ?? null;
  const deadlineAhead = !deadline || new Date(deadline).getTime() > now;
  if (paper && paper.enabled && !paper.submitted && deadlineAhead) {
    return {
      kind: 'action',
      line: deadline ? `Submit your position paper by ${fmtDay(deadline)}.` : 'Submit your position paper.',
      action: { label: 'Go to your paper', scrollTo: 'you-documents' },
    };
  }
  if (code && releaseMs !== null) {
    return { kind: 'done', line: `Your committee room opens ${formatReleaseDate(releaseMs)}. Read your study guide before then.` };
  }
  return { kind: 'done', line: 'Read your study guide and prepare your speeches for the committee.' };
}

export default function DelegateParticipant({ conferenceId, conferenceSlug, conferenceStartDate, application, myAllocation, committees, allocationSwapMode, section, onSelectSection, delegationLead }: {
  conferenceId: string;
  conferenceSlug: string;
  conferenceStartDate: string | null;
  application: ParticipantApplication;
  myAllocation: ParticipantAllocation | null;
  committees: ParticipantCommittee[];
  allocationSwapMode: string;
  section: string;
  /** Switches the desktop sub-nav (the paper and guide cards lead to Documents). */
  onSelectSection?: (key: string) => void;
  /** The top of the Delegation section (next step, status, Join session), from the page. */
  delegationLead?: React.ReactNode;
}) {
  const committee = myAllocation ? committees.find(c => c.id === myAllocation.conference_committee_id) ?? null : null;
  // Below xl every pane shows on one page (see ParticipantView), in this
  // order: awards and the assignment, the committee, documents, delegation.
  const stacked = useDashStacked();
  const [paper, setPaper] = useState<{ enabled: boolean; submitted: boolean } | null>(null);
  useReportNextStep(stacked ? delegateNextStep(myAllocation, conferenceStartDate, paper) : null);
  // With no seat yet, the Committee and Documents sections would only repeat
  // "appears once you are assigned": the phone page leaves them out.
  const assigned = !!myAllocation;
  // The Committee section's paper and guide cards open the full cards in
  // Documents: the desktop switches section, the phone page scrolls to it.
  const openDocuments = useCallback(() => {
    onSelectSection?.('documents');
    requestAnimationFrame(() => document.getElementById('you-documents')?.scrollIntoView({ block: 'start' }));
  }, [onSelectSection]);

  const inDelegation = !!application.society_id;

  return (
    <>
      {/* One delegation card for everyone in a delegation (25 Sep 2026): the
          roster, grouped, the viewer first. A delegate sees only their own
          allocation and payment; leaders see everything. Since 19 Oct 2026 it
          is their first section and carries what Overview used to. */}
      {application.society_id && (
        <Pane show={section === 'delegation'} title="Your Delegation" icon={Users}>
          {delegationLead}
          <MyAwardsCard conferenceId={conferenceId} conferenceSlug={conferenceSlug} myAllocation={myAllocation} />
          <DelegationPanel
            conferenceId={conferenceId}
            conferenceSlug={conferenceSlug}
            societyId={application.society_id}
            allocationSwapMode={allocationSwapMode}
            section="delegation"
            member={{ committees, myAllocation, selfPaid: application.self_paid }}
          />
        </Pane>
      )}

      {!inDelegation && (
      <Pane show={section === 'overview'} title="Your Assignment" icon={Flag}>
        {/* Only ever renders once the secretariat has published and this
            delegate's allocation holds an honour; otherwise nothing. */}
        <MyAwardsCard conferenceId={conferenceId} conferenceSlug={conferenceSlug} myAllocation={myAllocation} />
        <AssignmentHero
          committee={committee}
          myAllocation={myAllocation}
          conferenceStartDate={conferenceStartDate}
          independent={!application.society_id}
          joinFromXlOnly={stacked}
        />
      </Pane>
      )}

      <Pane show={section === 'committee'} title="Your Committee" icon={Landmark} phone={assigned}>
        {/* Taste board 5A: the committee (with a double delegate's partner),
            the study guide and position paper at a glance, the committee list. */}
        <MyCommitteeSection
          conferenceId={conferenceId}
          conferenceStartDate={conferenceStartDate}
          committee={committee}
          myAllocation={myAllocation}
          paper={paper}
          onOpenDocuments={openDocuments}
          joinFromXlOnly={stacked}
        />
      </Pane>

      <Pane show={section === 'documents'} title="Documents" icon={FileText} phone={assigned} anchor="you-documents">
        <PositionPaperCard conferenceId={conferenceId} conferenceSlug={conferenceSlug} myAllocation={myAllocation} onPaperState={setPaper} />
        <StudyGuideCard committeeId={myAllocation?.conference_committee_id ?? null} />
      </Pane>
    </>
  );
}
