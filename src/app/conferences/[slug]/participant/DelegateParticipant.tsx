'use client';

// Delegate participant view, reused for both 'delegate' and 'head-delegate'
// applications. This whole tree sits inside the spine's PayGate.
//
// Dashboard sections (26 Sep 2026): the parent owns the sub-nav and passes the
// active `section`. Every card here stays MOUNTED and is hidden with
// display:none when its section is not shown (Pane), so switching never
// refetches a card or loses a half-uploaded position paper.
//   overview    published awards (only when there are some), then the seat
//               for an independent delegate (the assignment hero). Anyone in
//               a delegation has their seat, guide, paper and payment on the
//               delegation Overview (DelegationOverview, owner 21 Oct 2026)
//   delegation  members of a delegation only, second: the leader or member card
//   committee   the committee's members only, like the leader card's committee
//               pop-up, each with their paper once it is in (owner, 21 Oct 2026)
//   documents   the study guide and the position paper
// Below lg (10 Oct 2026) there is no sub-nav: the panes stack in this order on
// one page, with Payment and Support placed by the parent.

import { useState } from 'react';
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

export default function DelegateParticipant({ conferenceId, conferenceSlug, conferenceStartDate, application, myAllocation, committees, allocationSwapMode, section }: {
  conferenceId: string;
  conferenceSlug: string;
  conferenceStartDate: string | null;
  application: ParticipantApplication;
  myAllocation: ParticipantAllocation | null;
  committees: ParticipantCommittee[];
  allocationSwapMode: string;
  section: string;
  /** Switches the desktop sub-nav. Nothing here switches it any more. */
  onSelectSection?: (key: string) => void;
}) {
  const committee = myAllocation ? committees.find(c => c.id === myAllocation.conference_committee_id) ?? null : null;
  // Below lg every pane shows on one page (see ParticipantView), in this
  // order: awards and the seat, the delegation, the committee, documents.
  const stacked = useDashStacked();
  const [paper, setPaper] = useState<{ enabled: boolean; submitted: boolean } | null>(null);
  useReportNextStep(stacked ? delegateNextStep(myAllocation, conferenceStartDate, paper) : null);
  // With no seat yet, the Committee and Documents sections would only repeat
  // "appears once you are assigned": the phone page leaves them out.
  const assigned = !!myAllocation;

  const inDelegation = !!application.society_id;

  return (
    <>
      {/* Overview: published awards (only once the secretariat publishes an
          honour for this allocation), then the seat. */}
      {/* Anyone in a delegation has their seat on the delegation Overview
          (DelegationOverview, owner 21 Oct 2026): this pane then draws only
          the awards. */}
      <Pane show={section === 'overview'} title={inDelegation ? undefined : 'Your Assignment'} icon={Flag}>
        <MyAwardsCard conferenceId={conferenceId} conferenceSlug={conferenceSlug} myAllocation={myAllocation} />
        {inDelegation ? null : (
          <AssignmentHero
            committee={committee}
            myAllocation={myAllocation}
            conferenceStartDate={conferenceStartDate}
            independent
            joinFromXlOnly={stacked}
          />
        )}
      </Pane>

      {/* One delegation card for everyone in a delegation (25 Sep 2026): the
          leader card for leaders, the member card (5B) for everyone else. */}
      {application.society_id && (
        <Pane show={section === 'delegation'} title="Your Delegation" icon={Users} anchor="you-delegation">
          <DelegationPanel
            conferenceId={conferenceId}
            conferenceSlug={conferenceSlug}
            societyId={application.society_id}
            allocationSwapMode={allocationSwapMode}
            member={{ committees, myAllocation, selfPaid: application.self_paid }}
          />
        </Pane>
      )}

      <Pane show={section === 'committee'} title="Your Committee" icon={Landmark} phone={assigned}>
        {/* Only the committee's members, exactly like the leader card's
            committee pop-up, each with their paper once it is in (owner,
            21 Oct 2026). */}
        <MyCommitteeSection
          committee={committee}
          myAllocation={myAllocation}
          paper={paper}
          leads={application.role === 'head-delegate'}
        />
      </Pane>

      <Pane show={section === 'documents'} title="Documents" icon={FileText} phone={assigned} anchor="you-documents">
        <PositionPaperCard conferenceId={conferenceId} conferenceSlug={conferenceSlug} myAllocation={myAllocation} onPaperState={setPaper} />
        <StudyGuideCard committeeId={myAllocation?.conference_committee_id ?? null} />
      </Pane>
    </>
  );
}
