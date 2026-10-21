'use client';

// The Overview of anyone in a delegation: head delegates, faculty advisors and
// plain delegates (owner, 21 Oct 2026: "the dashboard for head delegates and
// for plain delegates should look VERY similar"). In this order:
//   Your next step   DelegationLead with the page's step (pageNextStep); for a
//                    leader, when the page has nothing to DO, the delegation's
//                    own step (people to allocate, papers due soon, members who
//                    owe) whose button opens the Delegation section.
//   Two columns on laptops, stacked on phones:
//     left           "Your Seat" (SeatCard: the big flag on a tall card, the
//                    committee's logo and name, the study guide and the
//                    payment), then the position paper's own card
//                    (PositionPaperCard: the upload and its deadline). An
//                    advisor holds no seat: their delegation's committees
//                    (CommitteesBrief) and their payment instead.
//     right          "Your Delegation" (DelegationCard: crest, name, city and
//                    country, leaders with photos, two counts).
//   Position papers  leaders only: submitted N of M (PapersTile), with
//   Deadlines        right under it, every date ahead in order with relative
//                    words (DeadlinesCard), for everyone.
// No recap tiles for allocations or tickets and no Add delegate here any more
// (Add delegate lives under the People table in the Delegation section).
// Reads: useDelegationOverview (re-read in place on every landed change on the
// leader card, so "Your Seat" appears the moment a leader allocates
// themselves) and my_open_balances. Grey skeletons on the first read only.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { SkeletonBlock } from '@/components/Skeleton';
import DelegationLead, { liveRoomCode } from '../DelegationLead';
import type { NextStep } from '../../dashboardKit';
import PositionPaperCard from '../../PositionPaperCard';
import { useOpenBalances } from '../../PayNowCard';
import type { ParticipantAllocation, ParticipantApplication, ParticipantCommittee } from '../../types';
import { BTN_CLASS, cardStyle, FONT, secondaryBtn } from '../leaderKit';
import { useDelegationOverview } from './useDelegationOverview';
import { buildRecap, delegationStep } from './overviewRecap';
import { todayStart } from './overviewDates';
import SeatCard, { CardTitle, PaymentsBlock } from './SeatCard';
import { CommitteesBrief, DeadlinesCard, DelegationCard, PapersTile } from './OverviewCards';

export default function DelegationOverview({
  conferenceId, conferenceSlug, conferenceStartDate, societyId, application, committees, myAllocation, feeToday,
  step, notice, showDone, active, onOpenSection,
}: {
  conferenceId: string;
  conferenceSlug: string;
  conferenceStartDate: string | null;
  societyId: string;
  application: ParticipantApplication;
  /** Every committee of the conference (the page's read). */
  committees: ParticipantCommittee[];
  /** The page's copy of the viewer's allocation, until the Overview's own read lands. */
  myAllocation: ParticipantAllocation | null;
  feeToday: number;
  /** The page's next step (pageNextStep). */
  step: NextStep | null;
  notice?: React.ReactNode;
  showDone?: boolean;
  /** Overview is the section on screen: shown again, it re-reads in place. */
  active: boolean;
  onOpenSection: (key: string) => void;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const role = application.role;
  const isAdvisor = role === 'faculty-advisor';
  const leads = isAdvisor || role === 'head-delegate';
  const conferenceCommitteeIds = useMemo(() => committees.map(c => c.id), [committees]);
  const { state, reload } = useDelegationOverview({ conferenceId, societyId, userId, leader: leads, conferenceCommitteeIds });
  const balances = useOpenBalances(userId, conferenceId);
  const today = todayStart();
  const data = state.kind === 'ready' ? state.data : null;
  const recap = useMemo(() => (data ? buildRecap(data, today, balances) : null), [data, today, balances]);

  // Coming back to Overview (after moving people in Delegation) re-reads in place.
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) void reload();
    wasActive.current = active;
  }, [active, reload]);

  // The viewer's own paper went in (or back): a leader's papers count moves.
  const lastSubmitted = useRef<boolean | null>(null);
  const onPaperState = useCallback((s: { enabled: boolean; submitted: boolean } | null) => {
    if (!s) return;
    const before = lastSubmitted.current;
    lastSubmitted.current = s.submitted;
    if (before !== null && before !== s.submitted && leads) void reload();
  }, [leads, reload]);

  // The seat: the Overview's own read once it landed, else the page's copy.
  const seat = data && data.own !== undefined ? data.own : myAllocation;
  const seatCommittee = seat ? committees.find(c => c.id === seat.conference_committee_id) ?? null : null;
  const roomCode = isAdvisor ? null : liveRoomCode(seat, conferenceStartDate);

  const own = recap && data?.isLeader ? delegationStep(recap, today) : null;
  const shownStep = step?.kind === 'action' ? step : own ?? step;
  const openDelegation = () => onOpenSection('delegation');

  const payments = (
    <PaymentsBlock
      rows={balances}
      paymentStatus={application.payment_status}
      selfPaid={application.self_paid}
      feeFree={feeToday === 0}
      slug={conferenceSlug}
    />
  );

  const lead = (
    <DelegationLead
      step={shownStep}
      status={application.status}
      roomCode={roomCode}
      notice={notice}
      showDone={showDone}
      onOpenSection={onOpenSection}
    />
  );

  if (state.kind === 'loading') {
    return (
      <>
        {lead}
        <div className="@container min-w-0" aria-hidden>
          <div className="grid gap-6 @[760px]:grid-cols-2 items-start">
            <div className="flex flex-col items-center gap-4" style={{ ...cardStyle, padding: '22px 24px 28px' }}>
              <SkeletonBlock width="35%" height={18} radius={6} />
              <SkeletonBlock width={150} height={100} radius={12} />
              <SkeletonBlock width="50%" height={24} radius={8} />
              <SkeletonBlock width="60%" height={16} radius={6} />
              <SkeletonBlock height={44} radius={10} />
              <SkeletonBlock height={44} radius={10} />
            </div>
            <div className="flex flex-col gap-4" style={{ ...cardStyle, padding: '22px 24px' }}>
              <SkeletonBlock width="45%" height={18} radius={6} />
              <SkeletonBlock width="70%" height={28} radius={8} />
              <SkeletonBlock width="55%" height={16} radius={6} />
              <SkeletonBlock height={40} radius={10} />
            </div>
          </div>
        </div>
        <div aria-hidden style={{ ...cardStyle, padding: '20px 24px' }}>
          <SkeletonBlock width="30%" height={18} radius={6} />
        </div>
      </>
    );
  }

  if (state.kind === 'error' || !data || !recap) {
    return (
      <>
        {lead}
        <div style={{ ...cardStyle, padding: '20px 24px' }}>
          <p role="alert" style={{ fontFamily: FONT, fontSize: 14, color: '#8B2020', margin: 0 }}>
            {state.kind === 'error' ? state.message : 'Your delegation could not be read. Refresh the page to try again.'}
          </p>
        </div>
      </>
    );
  }

  const left = isAdvisor ? (
    <>
      <CommitteesBrief briefs={recap.committeesBrief} onOpen={() => onOpenSection('committees')} />
      <section aria-label="Your payment" className="flex flex-col gap-4" style={{ ...cardStyle, padding: '22px 24px' }}>
        <CardTitle>Your Payment</CardTitle>
        {payments}
      </section>
    </>
  ) : (
    <>
      <SeatCard
        seat={seat}
        committee={seatCommittee}
        payments={payments}
        emptyAction={data.isLeader && recap.openCount > 0 ? (
          <button type="button" onClick={openDelegation} className={BTN_CLASS} style={secondaryBtn}>
            Allocate yourself in Delegation
          </button>
        ) : undefined}
      />
      {seat && (
        <PositionPaperCard conferenceId={conferenceId} conferenceSlug={conferenceSlug} myAllocation={seat} onPaperState={onPaperState} />
      )}
    </>
  );

  return (
    <>
      {lead}
      <div className="@container flex flex-col gap-6 min-w-0">
        <div className="grid gap-6 @[760px]:grid-cols-2 items-start">
          <div className="flex flex-col gap-6 min-w-0">{left}</div>
          <div className="flex flex-col gap-6 min-w-0">
            <DelegationCard
              data={data}
              leaders={recap.leaders}
              delegateCount={recap.delegateCount}
              committeeCount={data.isLeader ? recap.committeesBrief.length : null}
              onOpen={openDelegation}
            />
          </div>
        </div>
        {data.isLeader && (
          <PapersTile
            papersIn={recap.papersIn}
            papersOf={recap.papersOf}
            known={recap.papersKnown}
            missing={recap.papersMissing}
            onOpen={openDelegation}
          />
        )}
        <DeadlinesCard rows={recap.deadlines} datesTbd={recap.datesTbd} today={today} />
      </div>
    </>
  );
}
