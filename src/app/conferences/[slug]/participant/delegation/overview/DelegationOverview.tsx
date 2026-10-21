'use client';

// The Overview of anyone in a delegation: head delegates, faculty advisors and
// plain delegates (owner, 21 Oct 2026: "the dashboard for head delegates and
// for plain delegates should look VERY similar"). In this order:
//   Join session     only while the committee room is open, then the page's
//                    `notice` (documents the organisers need back). There is
//                    no "Your next step" line any more (owner, 21 Oct 2026):
//                    the payment sits in Your Seat, papers in its tile.
//   Two columns on laptops, stacked on phones:
//     left           "Your Seat" (SeatCard: the big flag on a tall card, the
//                    committee's logo and name, ONE line of two small tiles,
//                    the study guide and the position paper
//                    (PositionPaperCard variant="tile": Upload or Submitted),
//                    then the payment). An advisor holds no seat: their
//                    delegation's committees (CommitteesBrief) and their
//                    payment instead.
//     right          "Your Delegation" (DelegationCard: crest, name, city and
//                    country, counts, leaders with photos; for a leader the
//                    papers submitted N of M and their own payments, the
//                    Financials card's numbers; for everyone the next three
//                    dates, compact).
// Reads: useDelegationOverview (re-read in place on every landed change on the
// leader card, so "Your Seat" appears the moment a leader allocates
// themselves), my_open_balances, and for a leader my_pay_overview
// (useOverviewPay). Grey skeletons on the first read only.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { DoorOpen } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { SkeletonBlock } from '@/components/Skeleton';
import { liveRoomCode } from '../DelegationLead';
import type { NextStep } from '../../dashboardKit';
import PositionPaperCard from '../../PositionPaperCard';
import { useOpenBalances } from '../../PayNowCard';
import type { ParticipantAllocation, ParticipantApplication, ParticipantCommittee } from '../../types';
import { BTN_CLASS, cardStyle, FONT, INK, primaryBtn, secondaryBtn, STROKE } from '../leaderKit';
import { useDelegationOverview } from './useDelegationOverview';
import { useOverviewPay } from './useOverviewPay';
import { buildRecap } from './overviewRecap';
import { todayStart } from './overviewDates';
import SeatCard, { CardTitle, PaymentsBlock } from './SeatCard';
import { CommitteesBrief, DelegationCard } from './OverviewCards';

export default function DelegationOverview({
  conferenceId, conferenceSlug, conferenceStartDate, societyId, application, committees, myAllocation, feeToday,
  notice, active, onOpenSection,
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
  /** The page's next step (pageNextStep). No longer drawn here (owner, 21 Oct 2026). */
  step?: NextStep | null;
  notice?: React.ReactNode;
  /** Kept for the caller; there is no next-step card to draw it in. */
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
  const pay = useOverviewPay(conferenceId, leads);
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

  // Join session while the committee room is open, then what the organisers
  // need back. No next-step line (owner, 21 Oct 2026).
  const lead = (
    <>
      {roomCode && (
        <section aria-label="Your committee room" className="flex items-center justify-between gap-3 flex-wrap" style={{ ...cardStyle, padding: '16px 22px' }}>
          <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: INK }}>Your committee room is open</span>
          <Link href={`/join?code=${roomCode}`} className={BTN_CLASS} style={primaryBtn}>
            <DoorOpen size={17} strokeWidth={STROKE} aria-hidden />
            Join session
          </Link>
        </section>
      )}
      {notice}
    </>
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
        paperTile={seat ? (
          <PositionPaperCard variant="tile" conferenceId={conferenceId} conferenceSlug={conferenceSlug} myAllocation={seat} onPaperState={onPaperState} />
        ) : undefined}
        emptyAction={data.isLeader && recap.openCount > 0 ? (
          <button type="button" onClick={openDelegation} className={BTN_CLASS} style={secondaryBtn}>
            Allocate yourself in Delegation
          </button>
        ) : undefined}
      />
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
              societyId={societyId}
              data={data}
              leaders={recap.leaders}
              delegateCount={recap.delegateCount}
              committeeCount={data.isLeader ? recap.committeesBrief.length : null}
              papers={data.isLeader ? { in: recap.papersIn, of: recap.papersOf, known: recap.papersKnown } : null}
              pay={data.isLeader ? pay : null}
              deadlines={recap.deadlines}
              datesTbd={recap.datesTbd}
              today={today}
              onOpen={openDelegation}
            />
          </div>
        </div>
      </div>
    </>
  );
}
