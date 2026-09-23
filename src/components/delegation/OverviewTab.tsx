'use client';

// Overview: who the delegation is, how many people are in it, where they sit,
// what is still owed, and what to do next.

import type { ReactNode } from 'react';
import { ArrowRight, Armchair, Clock, Crown, GraduationCap, Link2, MapPin, Receipt, Users } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import { CircleFlag } from '@/components/CircleFlag';
import { LogoDisc } from '@/components/LogoDisc';
import { getCountryByCode } from '@/lib/countries';
import { centsToFee } from '@/lib/invoices';
import {
  canHoldSeat, initialsOf, isAccepted, isHead, isLive, moneySummary, seatHolder,
  type PortalData,
} from './portalModel';
import { BigNumber, Panel, PanelTitle, PersonAvatar } from './portalUi';

export type PortalTab = 'overview' | 'members' | 'allocations' | 'payments';

function NextAction({ icon: I, text, cta, onClick }: { icon: typeof Users; text: ReactNode; cta: string; onClick: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2" style={{ padding: '12px 0', borderTop: NEU.hairline }}>
      <I size={18} strokeWidth={2.2} aria-hidden style={{ color: NEU.forest, flexShrink: 0 }} />
      <p className="flex-1 min-w-[180px]" style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.ink, lineHeight: 1.45 }}>{text}</p>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2"
        style={{ border: 'none', background: 'transparent', color: NEU.forest, fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', padding: '4px 0' }}
      >
        {cta} <ArrowRight size={15} strokeWidth={2.4} aria-hidden />
      </button>
    </li>
  );
}

export function OverviewTab({ data, onGo }: { data: PortalData; onGo: (tab: PortalTab | 'invite') => void }) {
  const { society, conference } = data;
  const live = data.members.filter(isLive);
  const heads = live.filter(isHead);
  const advisors = live.filter((m) => m.role === 'faculty-advisor');
  const delegates = live.filter((m) => !isHead(m) && m.role !== 'faculty-advisor');
  const accepted = live.filter(isAccepted);
  const waiting = live.filter((m) => m.status === 'submitted');
  const seated = live.filter((m) => !!m.assigned_country_name);
  const emptySeats = data.seats.filter((s) => !seatHolder(s, data.members));
  const seatable = live.filter(canHoldSeat);
  const unseated = seatable.filter((m) => !m.assigned_country_name);
  const money = moneySummary(data);

  const countryName = society.country_code ? (getCountryByCode(society.country_code)?.name ?? society.country_code) : null;
  const place = [society.city, countryName].filter(Boolean).join(', ');
  const conferenceName = conference.acronym || conference.full_name || 'the conference';

  const actions: ReactNode[] = [];
  if (emptySeats.length > 0 && unseated.length > 0) {
    actions.push(<NextAction key="seat" icon={Armchair} onClick={() => onGo('allocations')} cta="Seat them"
      text={<>{emptySeats.length === 1 ? 'One seat is' : `${emptySeats.length} seats are`} empty and {unseated.length === 1 ? 'one delegate is' : `${unseated.length} delegates are`} waiting for a seat.</>} />);
  } else if (emptySeats.length > 0) {
    actions.push(<NextAction key="seat-empty" icon={Armchair} onClick={() => onGo('invite')} cta="Invite delegates"
      text={<>{emptySeats.length === 1 ? 'One seat has' : `${emptySeats.length} seats have`} nobody to sit in {emptySeats.length === 1 ? 'it' : 'them'} yet.</>} />);
  }
  if (money.myOutstandingCents > 0) {
    actions.push(<NextAction key="pay" icon={Receipt} onClick={() => onGo('payments')} cta="See the bill"
      text={<>Your delegation bill has {centsToFee(money.myOutstandingCents, money.currency)} left to pay.</>} />);
  }
  if (waiting.length > 0) {
    actions.push(<NextAction key="wait" icon={Clock} onClick={() => onGo('members')} cta="See who"
      text={<>{waiting.length === 1 ? 'One application is' : `${waiting.length} applications are`} waiting for the organiser to review.</>} />);
  }
  if (advisors.length === 0 && data.facultyAdvisorsEnabled) {
    actions.push(<NextAction key="fa" icon={GraduationCap} onClick={() => onGo('members')} cta="Choose one"
      text="Your delegation has no faculty advisor yet." />);
  }
  if (live.length <= 1) {
    actions.push(<NextAction key="invite" icon={Link2} onClick={() => onGo('invite')} cta="Copy the link"
      text="Nobody else has joined yet. Send your invite link to your delegates." />);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The delegation */}
      <Panel style={{ padding: '20px 18px' }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <LogoDisc src={society.logo_url ?? null} size={84} fallbackText={initialsOf(society.name)} alt={society.name} style={{ boxShadow: 'none', border: NEU.hairline }} />
          <div className="min-w-0 flex-1">
            <h1 style={{ fontFamily: OUTFIT, fontSize: 26, fontWeight: 800, color: NEU.ink, letterSpacing: '-0.02em', lineHeight: 1.15, textWrap: 'balance' }}>
              {society.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
              {place && (
                <span className="inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft }}>
                  {society.country_code
                    ? <CircleFlag code={society.country_code} size={18} decorative />
                    : <MapPin size={15} strokeWidth={2.2} aria-hidden />}
                  {place}
                </span>
              )}
              <span style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft }}>at {conferenceName}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          <LeaderLine icon={Crown} label="Head delegate" people={heads} empty="Nobody yet" />
          <LeaderLine icon={GraduationCap} label={advisors.length > 1 ? 'Faculty advisors' : 'Faculty advisor'} people={advisors}
            empty={data.facultyAdvisorsEnabled ? 'Nobody yet' : 'This conference takes no faculty advisors'} />
        </div>
      </Panel>

      {/* Counts */}
      <Panel>
        <PanelTitle icon={Users} title="People" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-5">
          <BigNumber value={live.length} label={live.length === 1 ? 'Member' : 'Members'} />
          <BigNumber value={delegates.length} label={delegates.length === 1 ? 'Delegate' : 'Delegates'} tone="soft" note={`plus ${heads.length} head, ${advisors.length} advisor${advisors.length === 1 ? '' : 's'}`} />
          <BigNumber value={accepted.length} label="Accepted" tone="forest" />
          <BigNumber value={waiting.length} label="Waiting for review" tone={waiting.length > 0 ? 'ink' : 'soft'} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel>
          <PanelTitle icon={Armchair} title="Seats" aside={<GoLink onClick={() => onGo('allocations')}>Allocations</GoLink>} />
          <div className="grid grid-cols-3 gap-4">
            <BigNumber value={data.seats.length} label={data.seats.length === 1 ? 'Seat given' : 'Seats given'} />
            <BigNumber value={data.seats.length - emptySeats.length} label="Filled" tone="forest" />
            <BigNumber value={emptySeats.length} label="Empty" tone={emptySeats.length > 0 ? 'danger' : 'soft'} />
          </div>
          <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft, marginTop: 12, lineHeight: 1.45 }}>
            {seated.length} of {seatable.length} delegate{seatable.length === 1 ? '' : 's'} have a committee and country.
          </p>
        </Panel>
        <Panel>
          <PanelTitle icon={Receipt} title="Money" aside={<GoLink onClick={() => onGo('payments')}>Payments</GoLink>} />
          <div className="grid grid-cols-2 gap-4">
            <BigNumber value={centsToFee(money.receivedCents, money.currency)} label="Paid online" tone="forest" />
            <BigNumber value={centsToFee(money.outstandingCents, money.currency)} label="Still owed" tone={money.outstandingCents > 0 ? 'danger' : 'soft'} />
          </div>
          {money.offlineCents > 0 && (
            <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft, marginTop: 12 }}>
              {centsToFee(money.offlineCents, money.currency)} more was recorded by the organiser as paid outside Gavelling.
            </p>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelTitle icon={ArrowRight} title="Next" sub={actions.length === 0 ? 'Nothing needs you right now.' : undefined} />
        {actions.length > 0 && <ul style={{ marginTop: -6 }}>{actions}</ul>}
      </Panel>
    </div>
  );
}

function GoLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2"
      style={{ border: 'none', background: 'transparent', color: NEU.forest, fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
      {children} <ArrowRight size={14} strokeWidth={2.4} aria-hidden />
    </button>
  );
}

function LeaderLine({ icon: I, label, people, empty }: { icon: typeof Crown; label: string; people: { id: string; name: string; avatar_url: string | null }[]; empty: string }) {
  return (
    <div className="flex items-center gap-3 min-w-0" style={{ padding: '12px 14px', borderRadius: 14, backgroundColor: NEU.wash }}>
      <I size={18} strokeWidth={2.2} aria-hidden style={{ color: NEU.deepGold, flexShrink: 0 }} />
      <div className="min-w-0 flex-1">
        <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, color: NEU.inkSoft }}>{label}</p>
        {people.length === 0 ? (
          <p style={{ fontFamily: OUTFIT, fontSize: 14, color: NEU.inkSoft, marginTop: 2 }}>{empty}</p>
        ) : (
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-1">
            {people.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-2 min-w-0">
                <PersonAvatar name={p.name} url={p.avatar_url} size={24} />
                <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: NEU.ink }}>{p.name}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
