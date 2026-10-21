'use client';

// Delegate participant view, reused for both 'delegate' and 'head-delegate'
// applications. This whole tree sits inside the spine's PayGate.
//
// Dashboard sections (26 Sep 2026): the parent owns the sub-nav and passes the
// active `section`. Every card here stays MOUNTED and is hidden with
// display:none when its section is not shown (Pane), so switching never
// refetches a card or loses a half-uploaded position paper.
//   overview    published awards (only when there are some), then the seat:
//               the assignment hero for an independent delegate, the compact
//               OwnSeatCard for anyone in a delegation (owner, 20 Oct 2026:
//               Overview is back and is their OWN page; the page's next step,
//               DelegationLead, sits above it and carries Join session)
//   delegation  members of a delegation only, second: the leader or member card
//   committee   the committee card (5A: topics, co-delegate, live room), the
//               study guide and paper at a glance, the committee list
//   documents   the study guide and the position paper
// Below lg (10 Oct 2026) there is no sub-nav: the panes stack in this order on
// one page, with Payment and Support placed by the parent.

import { useCallback, useState } from 'react';
import { Compass, FileText, Flag, Landmark, Users } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import ProfileLink from '@/components/ProfileLink';
import AssignmentHero from './AssignmentHero';
import { useSeatCrest } from './AllocationCard';
import MyCommitteeSection from './delegation/committee/MyCommitteeSection';
import StudyGuideCard from './StudyGuideCard';
import PositionPaperCard from './PositionPaperCard';
import DelegationPanel from './DelegationPanel';
import MyAwardsCard from './MyAwardsCard';
import { CardHeading, CommitteeEmblem, DashCard, INK, INK_SOFT, Pane, TwoRowName, committeeShort, useDashStacked, useReportNextStep, type NextStep } from './dashboardKit';
import { effectiveReleaseTime, formatReleaseDate, OUTFIT, useAllocationPartner } from './shared';
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

/** A delegation member's own seat in Overview: the flag (or the seat's crest)
 *  with the country, the committee's emblem with its short name over the full
 *  one, and a double seat's partner. No Join session here: the next step above
 *  it carries that. Names wrap, never cut. */
export function OwnSeatCard({ committee, myAllocation, alwaysTitled = false }: {
  committee: ParticipantCommittee | null;
  myAllocation: ParticipantAllocation | null;
  /** Keep the "Your Seat" title on the phone page too (a leader's Overview has no pane heading). */
  alwaysTitled?: boolean;
}) {
  const crest = useSeatCrest(myAllocation);
  const partner = useAllocationPartner(myAllocation);
  const hideTitle = !alwaysTitled;
  if (!committee || !myAllocation) {
    return (
      <DashCard>
        <CardHeading title="Your Seat" stackedHide={hideTitle} />
        <p className="inline-flex items-center gap-2" style={{ fontFamily: OUTFIT, fontSize: 14, color: INK_SOFT, margin: 0, lineHeight: 1.5 }}>
          <Compass size={18} strokeWidth={1.8} aria-hidden style={{ color: 'var(--gv-main)', flexShrink: 0 }} />
          Your committee and country appear here once the organisers assign them.
        </p>
      </DashCard>
    );
  }
  return (
    <DashCard className="@container">
      <CardHeading title="Your Seat" stackedHide={hideTitle} />
      <div className="grid grid-cols-1 @[480px]:grid-cols-2 gap-5">
        <div className="flex items-center gap-3.5 min-w-0">
          <CircleFlag code={myAllocation.country_code} logoUrl={crest} label={myAllocation.country_name} size={52} />
          <div className="min-w-0">
            <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 18, fontWeight: 800, color: INK, margin: 0, lineHeight: 1.2 }}>
              {myAllocation.country_name}
            </p>
            {partner?.name && (
              <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: INK_SOFT, margin: '3px 0 0 0' }}>
                With <ProfileLink userId={partner.userId} name={partner.name}>{partner.name}</ProfileLink>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3.5 min-w-0">
          <CommitteeEmblem
            logoUrl={committee.logo_url}
            name={committee.name}
            abbreviation={committee.abbreviation}
            isCrisis={committee.committee_type === 'crisis'}
            size={48}
          />
          <TwoRowName short={committeeShort(committee.name, committee.abbreviation)} full={committee.name} size={18} />
        </div>
      </div>
    </DashCard>
  );
}

export default function DelegateParticipant({ conferenceId, conferenceSlug, conferenceStartDate, application, myAllocation, committees, allocationSwapMode, section, onSelectSection, seatShownByLeader = false }: {
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
  /** A head delegate's seat is drawn at the top of the leader Overview
   *  (LeaderOverview, owner 21 Oct 2026), so this pane draws only the awards. */
  seatShownByLeader?: boolean;
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
  // The Committee section's paper and guide cards open the full cards in
  // Documents: the desktop switches section, the phone page scrolls to it.
  const openDocuments = useCallback(() => {
    onSelectSection?.('documents');
    requestAnimationFrame(() => document.getElementById('you-documents')?.scrollIntoView({ block: 'start' }));
  }, [onSelectSection]);

  const inDelegation = !!application.society_id;

  return (
    <>
      {/* Overview: published awards (only once the secretariat publishes an
          honour for this allocation), then the seat. */}
      <Pane show={section === 'overview'} title={seatShownByLeader ? undefined : 'Your Assignment'} icon={Flag}>
        <MyAwardsCard conferenceId={conferenceId} conferenceSlug={conferenceSlug} myAllocation={myAllocation} />
        {seatShownByLeader ? null : inDelegation ? (
          <OwnSeatCard committee={committee} myAllocation={myAllocation} />
        ) : (
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
