'use client';

// "Your assignment" on a delegate's Overview (MyMUN's two tiles, Gavelling's
// way): the country as a BIG round flag (or the seat's crest) with its name,
// the committee as its emblem with the acronym big and the full name beneath,
// the co-delegate on a double seat, and "Join session" the moment the room
// opens. Reads nothing new: the allocation and committee come from the page,
// the crest and partner through the same helpers AllocationCard uses (which
// skips both on the Committee pane, so each is read once).

import { ArrowRight, Compass, Users } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import ProfileLink from '@/components/ProfileLink';
import { useSeatCrest } from './AllocationCard';
import { useAllocationPartner, effectiveReleaseTime, formatReleaseDate, OUTFIT } from './shared';
import { DashCard, CardHeading, CommitteeEmblem, TwoRowName, ForestLink, IconWord, INK, INK_SOFT, committeeShort } from './dashboardKit';
import type { ParticipantAllocation, ParticipantCommittee } from './types';

function hasPassed(ms: number | null): boolean {
  return ms !== null && ms <= Date.now();
}

export default function AssignmentHero({ committee, myAllocation, conferenceStartDate, independent }: {
  committee: ParticipantCommittee | null;
  myAllocation: ParticipantAllocation | null;
  conferenceStartDate: string | null;
  independent: boolean;
}) {
  const crest = useSeatCrest(myAllocation);
  const partner = useAllocationPartner(myAllocation);

  if (!committee || !myAllocation) {
    return (
      <DashCard>
        <CardHeading title="Your assignment" />
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: 'rgba(61,122,82,0.12)' }}>
            <Compass size={20} strokeWidth={2.2} style={{ color: '#1B3828', fill: 'rgba(238,217,138,0.5)' }} aria-hidden />
          </span>
          <p style={{ fontFamily: OUTFIT, fontSize: 14, color: INK_SOFT, margin: 0, lineHeight: 1.5 }}>
            Your committee and country appear here once the organisers assign them.
          </p>
        </div>
        {independent && <div className="mt-4"><IconWord icon={Users} word="Independent delegate" color={INK_SOFT} size="sm" /></div>}
      </DashCard>
    );
  }

  const sessionCode = myAllocation.conference_committees?.session_code ?? null;
  const releaseMs = effectiveReleaseTime(myAllocation.conference_committees?.released_to_delegates_at ?? null, conferenceStartDate);
  const released = hasPassed(releaseMs);

  return (
    <DashCard className="@container">
      <CardHeading title="Your assignment" />
      <div className="grid grid-cols-1 @[440px]:grid-cols-2 gap-4">
        {/* Country */}
        <div className="flex items-center gap-4 rounded-2xl p-4" style={{ backgroundColor: 'rgba(237,231,216,0.45)' }}>
          <CircleFlag
            code={myAllocation.country_code}
            logoUrl={crest}
            label={myAllocation.country_name}
            size={76}
            loading="eager"
            style={{ boxShadow: '0 8px 18px -8px rgba(27,56,40,0.45)' }}
          />
          <div className="min-w-0">
            <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: INK_SOFT, margin: '0 0 2px 0' }}>Representing</p>
            <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 20, fontWeight: 800, color: INK, margin: 0, lineHeight: 1.2 }}>
              {myAllocation.country_name}
            </p>
            {partner?.name && (
              <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: INK_SOFT, margin: '4px 0 0 0' }}>
                With <ProfileLink userId={partner.userId} name={partner.name}>{partner.name}</ProfileLink>
              </p>
            )}
          </div>
        </div>
        {/* Committee */}
        <div className="flex items-center gap-4 rounded-2xl p-4" style={{ backgroundColor: 'rgba(237,231,216,0.45)' }}>
          <CommitteeEmblem
            logoUrl={committee.logo_url}
            name={committee.name}
            abbreviation={committee.abbreviation}
            isCrisis={committee.committee_type === 'crisis'}
            size={64}
          />
          <div className="min-w-0">
            <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: INK_SOFT, margin: '0 0 2px 0' }}>Committee</p>
            <TwoRowName short={committeeShort(committee.name, committee.abbreviation)} full={committee.name} size={20} />
          </div>
        </div>
      </div>

      {(independent || (sessionCode && (released || releaseMs !== null))) && (
        <div className="flex items-center justify-between gap-3 flex-wrap mt-5">
          {independent ? <IconWord icon={Users} word="Independent delegate" color={INK_SOFT} size="sm" /> : <span />}
          {sessionCode && released ? (
            <ForestLink href={`/join?code=${sessionCode}`}>
              Join session <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
            </ForestLink>
          ) : sessionCode && releaseMs !== null ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 13, color: INK, margin: 0 }}>
              Your session opens {formatReleaseDate(releaseMs)}
            </p>
          ) : null}
        </div>
      )}
    </DashCard>
  );
}
