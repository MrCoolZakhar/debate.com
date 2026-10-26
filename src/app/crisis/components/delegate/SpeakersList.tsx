'use client';
// Gavelling Crisis: a very simple, compact speakers list for the delegate. Who has the floor now (picture
// and name), then the next three names, with the delegate's own place highlighted. The room phase is only a
// small label above it. Reads the shared room (useCrisisRoom); writes nothing.

import { useMemo } from 'react';
import { Mic } from 'lucide-react';
import type { Committee } from '@/lib/types';
import { Avatar, CK, Skeleton } from '../../crisisKit';
import { sameSeat, type CrisisRoom } from './useCrisisRoom';

const NEXT_SHOWN = 3;

function phaseLabel(c: Committee): string {
  if (c.endedAt) return 'Ended';
  if (c.suspendedAt || c.phase === 'adjourned') return 'Suspended';
  switch (c.phase) {
    case 'pre-session': case 'roll-call': return 'Roll Call';
    case 'speakers-list': return 'Speakers List';
    case 'moderated-caucus': return 'Moderated Caucus';
    case 'unmoderated-caucus': return c.caucus?.isConsultation ? 'Consultation of the Whole' : 'Unmoderated Caucus';
    case 'voting': return 'Voting';
    default: return 'In Session';
  }
}

function ordinal(n: number): string {
  const r = n % 100;
  if (r >= 11 && r <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

function Person({ name, picture, size, mine, strong }: { name: string; picture: string | null; size: number; mine: boolean; strong?: boolean }) {
  return (
    <div
      className="flex items-center"
      style={{
        gap: 9, padding: mine ? '3px 9px 3px 5px' : '1px 5px', borderRadius: 14,
        background: mine ? 'rgba(238,217,138,0.5)' : 'transparent', boxShadow: mine ? `inset 0 0 0 1.5px ${CK.goldMid}` : 'none',
      }}
    >
      <Avatar name={name} src={picture} size={size} color={mine ? CK.goldMid : CK.red} />
      <span className="min-w-0" style={{ fontSize: strong ? 14.5 : 13, fontWeight: strong || mine ? 800 : 600, color: CK.ink, overflowWrap: 'anywhere' }}>
        {name}
        {mine && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 800, color: CK.goldDeep }}>You</span>}
      </span>
    </div>
  );
}

export default function SpeakersList({ room, characters }: { room: CrisisRoom; characters: Array<{ name: string; picture_url?: string | null }> }) {
  const { committee, seat } = room;
  const pictureOf = useMemo(() => {
    const byName = new Map(characters.map((c) => [c.name.trim().toLowerCase(), c.picture_url ?? null]));
    return (name: string) => byName.get(name.trim().toLowerCase()) ?? null;
  }, [characters]);

  if (room.status === 'loading') {
    return <div className="grid gap-2"><Skeleton h={14} w={120} /><Skeleton h={34} r={17} /><Skeleton h={26} r={13} /><Skeleton h={26} r={13} /></div>;
  }
  if (!committee || !seat) {
    return <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>{room.reason ?? 'Your committee room opens on the conference days'}</p>;
  }

  const country = seat.country;
  const moderated = committee.phase === 'moderated-caucus';
  const floorName = committee.currentSpeaker?.country ?? (moderated ? committee.caucus?.currentSpeaker ?? null : null);
  const queue = (moderated ? committee.caucusQueue ?? [] : committee.speakersList).map((s) => s.country);
  const unused = !!committee.endedAt || !!committee.suspendedAt || ['adjourned', 'unmoderated-caucus', 'voting'].includes(committee.phase);
  const iSpeak = sameSeat(floorName, country);
  const myIndex = queue.findIndex((n) => sameSeat(n, country));
  const shown = queue.slice(0, NEXT_SHOWN);
  const myShown = myIndex !== -1 && myIndex < NEXT_SHOWN;

  return (
    <div>
      <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: CK.red }}>{phaseLabel(committee)}</p>
      {unused ? (
        <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>The speakers list is not in use right now.</p>
      ) : (
        <div className="grid gap-1">
          <p className="flex items-center gap-1.5" style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: CK.muted }}>
            <Mic size={13} strokeWidth={1.5} aria-hidden />Speaking now
          </p>
          {floorName ? (
            <Person name={floorName} picture={pictureOf(floorName)} size={32} mine={iSpeak} strong />
          ) : (
            <p style={{ margin: '0 0 0 4px', fontSize: 13.5, color: CK.inkSoft }}>Nobody has the floor.</p>
          )}
          {shown.length > 0 && (
            <>
              <p style={{ margin: '6px 0 0', fontSize: 11.5, fontWeight: 700, color: CK.muted }}>Next</p>
              {shown.map((n, i) => <Person key={`${n}-${i}`} name={n} picture={pictureOf(n)} size={24} mine={myShown && i === myIndex} />)}
            </>
          )}
          {!myShown && myIndex !== -1 && (
            <>
              <p style={{ margin: '4px 0 0', fontSize: 11.5, fontWeight: 700, color: CK.muted }}>Your place</p>
              <Person name={country} picture={pictureOf(country)} size={24} mine />
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: CK.goldDeep }}>You are {ordinal(myIndex + 1)} in line.</p>
            </>
          )}
          {!floorName && shown.length === 0 && <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>Nobody is on the list yet.</p>}
        </div>
      )}
    </div>
  );
}
