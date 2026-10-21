'use client';

// The delegate's Committee section on the You page (delegates and head
// delegates). Owner, 21 Oct 2026: show ONLY the members of the committee,
// exactly like the committee pop-up on the leader card (CommitteePopup):
// the committee's logo with its short name over the full one, then every
// country slot A to Z (CommitteeMatrix: round flag and country, the holder
// with avatar and name or Open, this delegation tinted, the viewer's own row
// "You"). No search box. A country whose position paper is in shows an icon +
// "Paper", opened through openPositionPaper, so the committee can read each
// other's papers; while COMMITTEE_PAPERS_DB is false only where the viewer can
// already read it (their own and, for a head delegate, their delegation's).
//
// People: the viewer is drawn from their own profile (photo and name) on their
// allocation; their delegation's other rows and everyone else come from
// my_committee_roster (published allocations; photos and user ids once
// scratch-committee-roster-avatars.sql is applied, initials until then).
// Every avatar with a known user id opens that person's public MUN CV.
// The committee's topics sit in a SECOND column to the right of the name block
// (owner, 21 Oct 2026), under it on a narrow card; the study guide, the paper
// upload and the room code live on the Overview and in Documents, and every
// paper link uses the Overview tile's icon (FileText; the guide is BookOpen).

import { useMemo } from 'react';
import { Landmark } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { committeeDisplayName } from '@/lib/presetNames';
import { useSeatCrest } from '../../AllocationCard';
import type { ParticipantAllocation, ParticipantCommittee } from '../../types';
import { CommitteeDisc, FONT, INK, INK_SOFT, STROKE, cardStyle, committeeEmblemSrc } from '../leaderKit';
import { DELEGATIONS_V2_DB } from '../v2';
import { CommitteeMatrix, type CommitteeOpenSeat, type CommitteeSeatPerson } from '../CommitteePopup';
import { useCommitteeRoster, type CommitteeRosterRow } from './committeeRoster';
import { paperKey } from './committeePapers';
import { TopicsList } from '../overview/SeatCard';

export interface PaperSummary {
  enabled: boolean;
  submitted: boolean;
}

const sameCountry = (a: { country_code: string | null; country_name: string | null }, b: { country_code: string | null; country_name: string | null }) =>
  paperKey(a.country_code, a.country_name) === paperKey(b.country_code, b.country_name);

export default function MyCommitteeSection({ committee, myAllocation, paper, leads }: {
  committee: ParticipantCommittee | null;
  myAllocation: ParticipantAllocation | null;
  /** PositionPaperCard's own report (null while it reads): the papers are read again when it changes. */
  paper: PaperSummary | null;
  /** A head delegate: their delegation's papers are readable today too. */
  leads: boolean;
}) {
  const { user, profile } = useAuth();
  const myUserId = user?.id ?? null;
  const ccId = myAllocation?.conference_committee_id ?? null;
  const seatCrest = useSeatCrest(myAllocation);
  const roster = useCommitteeRoster(ccId);
  const rosterSettled = !DELEGATIONS_V2_DB || roster !== null;
  const myName = (profile?.display_name ?? '').trim();

  // The viewer, their delegation's other rows, and everyone else.
  const { people, others, openSeats, paperKeys } = useMemo(() => {
    const rows: CommitteeRosterRow[] = roster?.kind === 'ok' ? roster.rows : [];
    if (!myAllocation) return { people: [] as CommitteeSeatPerson[], others: [] as CommitteeRosterRow[], openSeats: [] as CommitteeOpenSeat[], paperKeys: [] as string[] };
    const mineSpot = { country_code: myAllocation.country_code, country_name: myAllocation.country_name };
    // The roster's row for the viewer: their country, by name first.
    const sameSpot = rows.filter(r => sameCountry(r, mineSpot));
    const meRow = sameSpot.find(r => myName && (r.display_name ?? '').trim() === myName)
      ?? sameSpot.find(r => r.is_mine)
      ?? sameSpot[0]
      ?? null;
    const me: CommitteeSeatPerson = {
      application_id: 'me',
      name: myName || meRow?.display_name || 'You',
      avatar_url: profile?.avatar_url ?? null,
      country_name: myAllocation.country_name,
      country_code: myAllocation.country_code,
      seatLogo: seatCrest,
      is_me: true,
      user_id: myUserId,
    };
    const rest = rows.filter(r => r !== meRow);
    const mates: CommitteeSeatPerson[] = rest
      .filter(r => r.is_mine && !!r.display_name)
      .map((r, i) => ({
        application_id: `mate-${paperKey(r.country_code, r.country_name)}-${r.seat ?? ''}-${i}`,
        name: r.display_name ?? 'Delegate',
        avatar_url: r.avatar_url,
        country_name: r.country_name,
        country_code: r.country_code,
        seatLogo: r.country_logo_url,
        user_id: r.user_id,
      }));
    const everyoneElse = rest.filter(r => !r.is_mine && !!r.display_name);
    // The delegation's published allocation with nobody in it yet.
    const open: CommitteeOpenSeat[] = rest
      .filter(r => r.is_mine && !r.display_name)
      .map(r => ({ country_code: r.country_code, country_name: r.country_name }));
    const keys = [paperKey(me.country_code, me.country_name), ...(leads ? mates.map(m => paperKey(m.country_code, m.country_name)) : [])];
    return { people: [me, ...mates], others: everyoneElse, openSeats: open, paperKeys: keys };
  }, [roster, myAllocation, myName, profile?.avatar_url, seatCrest, leads, myUserId]);

  if (!committee || !myAllocation || !ccId) {
    return (
      <div style={{ ...cardStyle, padding: 24 }} className="flex items-center gap-3">
        <Landmark size={22} strokeWidth={STROKE} style={{ color: INK, flexShrink: 0 }} aria-hidden />
        <p style={{ fontFamily: FONT, fontSize: 15, color: INK_SOFT, margin: 0 }}>
          Your committee and country appear here once the organisers assign them.
        </p>
      </div>
    );
  }

  const short = (committee.abbreviation ?? '').trim() || committeeDisplayName(committee.name, committee.abbreviation);
  const showFull = committee.name.trim() !== short.trim();

  return (
    <section aria-label="Your committee" className="@container flex flex-col gap-5 min-w-0 p-[18px] sm:p-6" style={cardStyle}>
      {/* The name block left, the topics in a second column top right. */}
      <div className="grid gap-x-8 gap-y-4 grid-cols-1 @[640px]:grid-cols-2 items-start min-w-0">
        <div className="flex items-start gap-4 min-w-0">
          <CommitteeDisc src={committeeEmblemSrc(committee.logo_url, committee.name, committee.abbreviation)} size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 24, fontWeight: 600, color: INK, margin: 0, lineHeight: 1.2 }}>{short}</h2>
            {showFull && <p className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, color: INK_SOFT, margin: '3px 0 0 0' }}>{committee.name}</p>}
          </div>
        </div>
        <div className="min-w-0">
          <TopicsList topics={committee.topics} />
        </div>
      </div>
      <CommitteeMatrix
        committeeId={ccId}
        people={people}
        others={others}
        openSeats={openSeats}
        rosterSettled={rosterSettled}
        paperKeys={paperKeys}
        papersRefresh={paper ? `${paper.enabled}-${paper.submitted}` : null}
      />
    </section>
  );
}
