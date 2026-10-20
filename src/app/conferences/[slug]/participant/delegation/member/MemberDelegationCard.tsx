'use client';

// The Delegation section for a member who does not lead it (taste board 5B,
// 19 Oct 2026). Leaders get LeaderCard instead; DelegationPanel picks.
//
//   1. The delegation: its round crest, name and place with the flag, and
//      counts as big numbers with their words.
//   2. Your leaders: every head delegate and faculty advisor.
//   3. Who is where: members grouped by committee, people without a seat last.
//      my_delegation_roster gives a member only their OWN allocation today,
//      so the grouping (and the committees / countries counts) render only
//      while DELEGATIONS_V2_DB; meanwhile the card lists everyone with their
//      role, and the viewer's own seat on their row.
//   4. Study guides: one row per committee the delegation sits in (only the
//      viewer's own committee until DELEGATIONS_V2_DB, and the guides of
//      other committees still need a members' read of study_guides).
//   5. The fee: covered by the delegation, paid, waived, or what is open with
//      a pay button (my_open_balances, the Payment section's own read).
//
// Nothing here shows another member's payment, papers, chair notes or awards.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, CircleDollarSign } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import DelegationCrest from '@/components/DelegationCrest';
import { useAuth } from '@/components/AuthProvider';
import { SkeletonBlock } from '@/components/Skeleton';
import { getCountryByCode } from '@/lib/countries';
import { committeeDisplayName } from '@/lib/presetNames';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { useNow } from '@/lib/useNow';
import { money } from '../../../pay/payApi';
import type { RosterMember } from '../../DelegationPanel';
import { useOpenBalances } from '../../PayNowCard';
import LockedPayButton from '../../PaymentsLocked';
import type { ParticipantAllocation, ParticipantCommittee } from '../../types';
import {
  BTN_CLASS, CommitteeDisc, FONT, INK, INK_SOFT, OK_GREEN, RoundAvatar, STROKE,
  cardStyle, committeeEmblemSrc, linkStyle, primaryBtn,
} from '../leaderKit';
import { DELEGATIONS_V2_DB } from '../v2';
import { guideState, useCommitteeGuides, useOpenStudyGuide } from '../committee/useCommitteeGuides';
import { CardTitle, MINE_TINT, ROW_LINE, SOFT_PANEL } from '../committee/youKit';

const ROLE_WORD: Record<RosterMember['role'], string> = {
  'faculty-advisor': 'Faculty advisor',
  'head-delegate': 'Head delegate',
  delegate: 'Delegate',
};

interface SocietyLook {
  logo_url: string | null;
  city: string | null;
  country_code: string | null;
}

/** The member's allocation, with the committee id the v2 roster is expected to add. */
type MemberSeat = NonNullable<RosterMember['allocation']> & { conference_committee_id?: string | null };

interface CommitteeRef {
  id: string | null;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
}

function findCommittee(seat: MemberSeat, committees: ParticipantCommittee[]): CommitteeRef {
  const byId = seat.conference_committee_id ? committees.find(c => c.id === seat.conference_committee_id) : undefined;
  const byName = byId ?? committees.find(c => c.name === seat.committee)
    ?? (seat.committee_abbr ? committees.find(c => c.abbreviation === seat.committee_abbr) : undefined);
  if (byName) return { id: byName.id, name: byName.name, abbreviation: byName.abbreviation, logo_url: byName.logo_url };
  return { id: seat.conference_committee_id ?? null, name: seat.committee ?? 'Committee', abbreviation: seat.committee_abbr, logo_url: null };
}

function shortName(c: { name: string; abbreviation: string | null }): string {
  return (c.abbreviation ?? '').trim() || committeeDisplayName(c.name, c.abbreviation);
}

function useSocietyLook(societyId: string): SocietyLook | null {
  const [loaded, setLoaded] = useState<{ key: string; look: SocietyLook } | null>(null);
  useEffect(() => {
    if (!societyId) return;
    let cancelled = false;
    (async () => {
      const client = await getFreshAuthedClient();
      if (!client || cancelled) return;
      const { data, error } = await client.from('societies').select('logo_url, city, country_code').eq('id', societyId).maybeSingle();
      if (cancelled || error || !data) return;
      setLoaded({ key: societyId, look: data as SocietyLook });
    })().catch(() => { /* the crest falls back to initials */ });
    return () => { cancelled = true; };
  }, [societyId]);
  return loaded?.key === societyId ? loaded.look : null;
}

function PersonName({ m }: { m: RosterMember }) {
  return (
    <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK, lineHeight: 1.3 }}>
      {m.name}
      {m.is_me && <span style={{ fontWeight: 500, color: INK_SOFT }}> (you)</span>}
    </span>
  );
}

function SeatMark({ seat }: { seat: MemberSeat }) {
  if (!seat.country_name && !seat.country_code) return null;
  return (
    <span className="flex items-center gap-1.5 flex-shrink-0 min-w-0" style={{ fontFamily: FONT, fontSize: 13, color: '#3E352E', maxWidth: '45%' }}>
      <CircleFlag code={seat.country_code} country={seat.country_name} size={24} decorative />
      <span className="min-w-0 [overflow-wrap:anywhere]">{seat.country_name}</span>
    </span>
  );
}

export default function MemberDelegationCard({ conferenceId, conferenceSlug, societyId, societyName, members, committees = [], myAllocation = null, selfPaid = false }: {
  conferenceId: string;
  conferenceSlug: string;
  societyId: string;
  societyName: string;
  members: RosterMember[];
  /** The conference's committees (logos and ids); empty when the caller has none. */
  committees?: ParticipantCommittee[];
  myAllocation?: ParticipantAllocation | null;
  /** The viewer's own application paid by themselves (vs the delegation). */
  selfPaid?: boolean;
}) {
  const { user } = useAuth();
  const now = useNow();
  const look = useSocietyLook(societyId);
  const balances = useOpenBalances(user?.id ?? null, conferenceId);

  const me = members.find(m => m.is_me) ?? null;
  const leaders = useMemo(() => members.filter(m => m.role === 'head-delegate' || m.role === 'faculty-advisor'), [members]);
  // Faculty advisors never sit in a committee, so "who is where" is students only.
  const students = useMemo(() => members.filter(m => m.role !== 'faculty-advisor'), [members]);

  // Committee groups: only with every member's seat (DELEGATIONS_V2_DB).
  const groups = useMemo(() => {
    if (!DELEGATIONS_V2_DB) return null;
    const byKey = new Map<string, { committee: CommitteeRef; people: { m: RosterMember; seat: MemberSeat }[] }>();
    const unseated: RosterMember[] = [];
    for (const m of students) {
      const seat = m.allocation as MemberSeat | null;
      if (!seat || !seat.committee) { unseated.push(m); continue; }
      const committee = findCommittee(seat, committees);
      const key = committee.id ?? committee.name;
      const g = byKey.get(key) ?? { committee, people: [] };
      g.people.push({ m, seat });
      byKey.set(key, g);
    }
    const list = [...byKey.values()].sort((a, b) => shortName(a.committee).localeCompare(shortName(b.committee)));
    return { list, unseated };
  }, [students, committees]);

  // Committees whose study guides this card lists.
  const guideCommittees = useMemo(() => {
    if (groups) return groups.list.map(g => g.committee).filter(c => !!c.id);
    if (!myAllocation) return [];
    const own = committees.find(c => c.id === myAllocation.conference_committee_id);
    return [{
      id: myAllocation.conference_committee_id,
      name: own?.name ?? myAllocation.conference_committees?.name ?? 'Your committee',
      abbreviation: own?.abbreviation ?? null,
      logo_url: own?.logo_url ?? null,
    }];
  }, [groups, myAllocation, committees]);
  const guides = useCommitteeGuides(guideCommittees.map(c => c.id ?? ''));
  const openGuide = useOpenStudyGuide();

  const placeCountry = look?.country_code ? getCountryByCode(look.country_code)?.name ?? null : null;
  const place = [look?.city?.trim() || null, placeCountry].filter(Boolean).join(', ');

  const committeeCount = groups ? groups.list.length : 0;
  const countryCount = groups
    ? new Set(groups.list.flatMap(g => g.people.map(p => p.seat.country_code || p.seat.country_name))).size
    : 0;

  // ── The fee ──
  const due = (balances ?? []).filter(b => b.due_cents > 0);
  const payStatus = me?.payment_status ?? null;
  let fee: React.ReactNode = null;
  if (due.length > 0) {
    fee = (
      <div className="flex items-center gap-3 flex-wrap">
        <CircleDollarSign size={24} strokeWidth={STROKE} style={{ color: INK, flexShrink: 0 }} aria-hidden />
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>
            {due.map(b => money(b.due_cents, b.currency)).join(' and ')} to pay
          </span>
          <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>Your delegation does not cover your fee yet</span>
        </div>
        {due.every(b => b.payments_ready)
          ? <Link href={`/conferences/${conferenceSlug}/pay`} className={BTN_CLASS} style={primaryBtn}>Pay now</Link>
          : <LockedPayButton slug={conferenceSlug} label="Pay now" className={BTN_CLASS} style={primaryBtn} />}
      </div>
    );
  } else if (payStatus === 'paid' || payStatus === 'waived') {
    const words = payStatus === 'waived'
      ? { title: 'Your fee is waived', sub: null }
      : selfPaid
        ? { title: 'Your fee is paid', sub: null }
        : { title: 'Your fee is covered', sub: `Paid by ${societyName}` };
    fee = (
      <div className="flex items-center gap-3">
        <CheckCircle2 size={24} strokeWidth={STROKE} style={{ color: OK_GREEN, flexShrink: 0 }} aria-hidden />
        <div className="min-w-0 flex flex-col gap-0.5">
          <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>{words.title}</span>
          {words.sub && <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>{words.sub}</span>}
        </div>
      </div>
    );
  }

  const count = (n: number, word: string) => (
    <div className="flex flex-col items-center">
      <span style={{ fontFamily: FONT, fontSize: 22, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{n}</span>
      <span style={{ fontFamily: FONT, fontSize: 12, color: INK_SOFT }}>{word}</span>
    </div>
  );

  const header = (
    <div style={cardStyle} className="flex flex-col gap-4 p-5 @[640px]:p-6 @[900px]:flex-row @[900px]:items-center @[900px]:justify-between">
      <div className="flex items-center gap-3.5 min-w-0">
        <DelegationCrest name={societyName} logoUrl={look?.logo_url ?? null} size={60} />
        <div className="min-w-0 flex flex-col gap-1">
          <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 21, fontWeight: 600, color: INK, lineHeight: 1.2 }}>{societyName}</span>
          {place && (
            <span className="flex items-center gap-1.5" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>
              {look?.country_code && <CircleFlag code={look.country_code} size={16} decorative />}
              <span className="[overflow-wrap:anywhere]">{place}</span>
            </span>
          )}
        </div>
      </div>
      <div
        className="grid text-center @[900px]:min-w-[360px]"
        style={{ gridTemplateColumns: `repeat(${groups ? 3 : 2}, minmax(0, 1fr))`, padding: '12px 0', borderRadius: 14, background: SOFT_PANEL }}
      >
        {count(members.length, members.length === 1 ? 'person' : 'people')}
        {groups ? (
          <>
            {count(committeeCount, committeeCount === 1 ? 'committee' : 'committees')}
            {count(countryCount, countryCount === 1 ? 'country' : 'countries')}
          </>
        ) : count(leaders.length, leaders.length === 1 ? 'leader' : 'leaders')}
      </div>
    </div>
  );

  const leadersCard = leaders.length > 0 && (
    <div style={cardStyle} className="flex flex-col gap-3.5 p-[18px] @[640px]:p-6">
      <CardTitle>Your Leaders</CardTitle>
      <div className="grid grid-cols-2 gap-3.5 @[760px]:grid-cols-3 @[1100px]:grid-cols-4">
        {leaders.map(l => (
          <div key={l.application_id} className="flex items-center gap-2.5 min-w-0">
            <RoundAvatar name={l.name} url={l.avatar_url} size={44} seed={l.application_id} />
            <div className="min-w-0 flex flex-col gap-px">
              <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK, lineHeight: 1.3 }}>
                {l.name}
                {l.is_me && <span style={{ fontWeight: 500, color: INK_SOFT }}> (you)</span>}
              </span>
              <span style={{ fontFamily: FONT, fontSize: 12, color: INK_SOFT }}>{ROLE_WORD[l.role]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const personRow = (m: RosterMember, seat: MemberSeat | null, indent: boolean) => (
    <div
      key={m.application_id}
      className="flex items-center gap-3"
      style={{ padding: indent ? '7px 18px 7px 52px' : '9px 18px', background: m.is_me ? MINE_TINT : 'transparent' }}
    >
      <RoundAvatar name={m.name} url={m.avatar_url} size={38} seed={m.application_id} />
      <div className="flex-1 min-w-0 flex flex-col gap-px">
        <PersonName m={m} />
        {!indent && <span style={{ fontFamily: FONT, fontSize: 12, color: INK_SOFT }}>{ROLE_WORD[m.role]}{m.claimed ? '' : ', invited'}</span>}
      </div>
      {seat && <SeatMark seat={seat} />}
    </div>
  );

  const whoCard = (
    <div style={{ ...cardStyle, padding: '18px 0 8px' }} className="min-w-0">
      <CardTitle style={{ padding: '0 18px 8px' }}>{groups ? 'Who Is Where' : 'Who Is In It'}</CardTitle>
      {groups ? (
        <>
          {groups.list.map(g => (
            <div key={g.committee.id ?? g.committee.name} style={{ borderTop: ROW_LINE, padding: '10px 0 4px' }}>
              <div className="flex items-center gap-2.5" style={{ padding: '0 18px 6px' }}>
                <CommitteeDisc src={committeeEmblemSrc(g.committee.logo_url, g.committee.name, g.committee.abbreviation)} size={24} />
                <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>{shortName(g.committee)}</span>
              </div>
              {g.people.map(p => personRow(p.m, p.seat, true))}
            </div>
          ))}
          {groups.unseated.length > 0 && (
            <div style={{ borderTop: ROW_LINE, padding: '10px 0 4px' }}>
              <div style={{ padding: '0 18px 6px', fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>No seat yet</div>
              {groups.unseated.map(m => personRow(m, null, true))}
            </div>
          )}
          {students.length === 0 && (
            <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: 0, padding: '6px 18px 10px' }}>No delegates yet.</p>
          )}
        </>
      ) : (
        <div className="@container">
          <div className="grid @[720px]:grid-cols-2" style={{ borderTop: ROW_LINE }}>
            {members.map(m => personRow(m, m.is_me ? (m.allocation as MemberSeat | null) : null, false))}
          </div>
        </div>
      )}
    </div>
  );

  const guidesCard = guideCommittees.length > 0 && (
    <div style={cardStyle} className="flex flex-col p-[18px] @[640px]:p-6 min-w-0">
      <CardTitle style={{ paddingBottom: 8 }}>Study Guides</CardTitle>
      {guideCommittees.map(c => {
        const entry = c.id ? guides?.get(c.id) : undefined;
        const st = guideState(entry, now);
        const files = entry?.guides ?? [];
        return (
          <div key={c.id ?? c.name} className="flex items-center gap-3" style={{ padding: '9px 0', borderTop: ROW_LINE }}>
            <CommitteeDisc src={committeeEmblemSrc(c.logo_url, c.name, c.abbreviation)} size={24} />
            <span className="flex-1 min-w-0 [overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK }}>{shortName(c)}</span>
            {guides === null ? (
              <SkeletonBlock width={56} height={12} />
            ) : st.kind === 'open' ? (
              <span className="flex flex-col items-end gap-1 min-w-0" style={{ maxWidth: '50%' }}>
                {files.map(g => (
                  <button key={g.id} type="button" onClick={() => openGuide(g.file_url)} className={`${BTN_CLASS} [overflow-wrap:anywhere] text-right`} style={linkStyle}>
                    {files.length === 1 ? 'Open' : g.title}
                  </button>
                ))}
              </span>
            ) : (
              <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, flexShrink: 0 }}>{st.line}</span>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="@container flex flex-col gap-4 @[640px]:gap-6">
      {header}
      {leadersCard}
      <div className="grid gap-4 @[640px]:gap-6 @[900px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start">
        {whoCard}
        {(guidesCard || fee) && (
          <div className="flex flex-col gap-4 @[640px]:gap-6 min-w-0">
            {guidesCard}
            {fee && <div style={cardStyle} className="p-[18px] @[640px]:p-6">{fee}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
