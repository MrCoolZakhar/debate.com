'use client';

// One committee room on the Press Desk, compact like the organiser's live status cards
// (owner, 16 Oct 2026: "too much info"): who the room is, what it is doing in one line, who
// speaks now with the queue as one row of round flags, and the papers introduced as short
// rows. No motions list. Read only.

import { BookOpen, Check, FileText, Mic, Vote, X } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import SeatName from '@/components/SeatName';
import { OUTFIT } from '@/components/neu';
import { CommitteeEmblem, TwoRowName, committeeShort } from '../participant/dashboardKit';
import type { PressDocument, PressRoom } from '@/lib/press';
import { CARD_SHADOW, FOREST, INK, INK_SOFT, SLATE, SeatLine, roomMode } from './pressKit';

/** How many queue flags fit on one row before "+N". */
const NEXT_MAX = 8;
/** How many papers a card lists before "+N more". */
const DOCS_MAX = 3;

function docStatus(d: PressDocument): { icon: typeof Check; word: string; color: string } {
  if (d.votingNow) return { icon: Vote, word: 'Voting now', color: '#7A5812' };
  if (d.status === 'passed') return { icon: Check, word: 'Passed', color: FOREST };
  if (d.status === 'failed') return { icon: X, word: 'Failed', color: '#8E3A33' };
  return { icon: BookOpen, word: 'Introduced', color: SLATE };
}

export default function PressRoomCard({ room, onOpenDoc }: {
  room: PressRoom;
  onOpenDoc: (room: PressRoom, doc: PressDocument) => void;
}) {
  const s = room.session;
  const mode = roomMode(s);
  const ModeIcon = mode.icon;
  const short = committeeShort(room.name, room.abbreviation);
  const showFloor = !!s && mode.live && (!!s.speaker || s.next.length > 0);
  const topic = s?.topic && s.topic !== 'TBD' ? s.topic : null;
  const docs = s?.documents ?? [];
  const extraDocs = docs.length - DOCS_MAX;

  return (
    <article
      className="flex flex-col gap-3 rounded-[20px] p-4"
      style={{ backgroundColor: '#FFFFFF', boxShadow: CARD_SHADOW, minWidth: 0 }}
      aria-label={room.name}
    >
      {/* Who the room is, and what it is doing */}
      <header className="flex items-start gap-3">
        <CommitteeEmblem logoUrl={room.logoUrl} name={room.name} abbreviation={room.abbreviation} size={42} isCrisis={room.committeeType === 'crisis'} />
        <div className="min-w-0 flex-1">
          <TwoRowName short={short} full={room.name} size={17} />
          {topic && (
            <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: INK_SOFT, margin: '2px 0 0 0', lineHeight: 1.35 }}>
              {topic}
            </p>
          )}
        </div>
      </header>

      <p className="flex items-start gap-1.5 [overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: mode.color, margin: 0, lineHeight: 1.35 }}>
        <ModeIcon size={15} strokeWidth={2.3} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          {mode.word}
          {mode.detail && <span style={{ fontWeight: 500, color: INK_SOFT }}>{' · '}{mode.detail}</span>}
        </span>
      </p>

      {/* The floor: who speaks now, then the queue as one row of round flags */}
      {showFloor && (
        <div className="flex flex-col gap-2 rounded-[14px] px-3 py-2.5" style={{ backgroundColor: 'rgba(238,217,138,0.2)' }}>
          {s.speaker && (
            <div className="flex items-center gap-2">
              <Mic size={15} strokeWidth={2.3} aria-label="Speaking now" style={{ color: '#8A6614', flexShrink: 0 }} />
              <SeatLine seat={s.speaker} size={30} nameSize={15} weight={800} />
            </div>
          )}
          {s.next.length > 0 && (
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: '#8A6614', flexShrink: 0 }}>Up next</span>
              <span className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label={`Up next: ${s.next.map((n) => n.country).join(', ')}`}>
                {s.next.slice(0, NEXT_MAX).map((seat, i) => (
                  <span key={`${seat.country}-${i}`} title={`${i + 1}. ${seat.country}`} style={{ lineHeight: 0, borderRadius: 999, boxShadow: '0 0 0 2px #FFFFFF' }}>
                    <CircleFlag country={seat.country} logoUrl={seat.logoUrl} size={22} decorative />
                  </span>
                ))}
                {s.next.length > NEXT_MAX && (
                  <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: INK_SOFT }}>+{s.next.length - NEXT_MAX}</span>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Papers that were introduced (never a draft only submitted) */}
      {docs.length > 0 && (
        <ul className="flex flex-col gap-1.5" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {docs.slice(0, DOCS_MAX).map((d) => {
            const st = docStatus(d);
            const StIcon = st.icon;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onOpenDoc(room, d)}
                  title={d.sponsors.length ? `Sponsors: ${d.sponsors.join(', ')}` : undefined}
                  className="flex w-full items-start gap-2 text-start rounded-[10px] px-2.5 py-2 transition-[background-color] duration-150 hover:bg-[#1B3828]/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
                  style={{ backgroundColor: 'rgba(27,56,40,0.04)' }}
                >
                  <FileText size={16} strokeWidth={2.1} aria-hidden style={{ color: SLATE, flexShrink: 0, marginTop: 1 }} />
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: INK, lineHeight: 1.35 }}>
                    {d.docCode && <span style={{ color: SLATE }}>{d.docCode} </span>}
                    {d.title || 'Untitled paper'}
                    <span className="inline-flex items-center gap-1" style={{ marginInlineStart: 8, fontSize: 12, fontWeight: 700, color: st.color, whiteSpace: 'nowrap' }}>
                      <StIcon size={12} strokeWidth={2.4} aria-hidden />{st.word}
                    </span>
                  </span>
                  <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: FOREST, textDecoration: 'underline', flexShrink: 0, marginTop: 1 }}>Read</span>
                </button>
              </li>
            );
          })}
          {extraDocs > 0 && (
            <li style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, color: INK_SOFT, paddingInlineStart: 10 }}>+{extraDocs} more {extraDocs === 1 ? 'paper' : 'papers'}</li>
          )}
        </ul>
      )}

      {!showFloor && docs.length === 0 && (
        <p style={{ fontFamily: OUTFIT, fontSize: 13, color: INK_SOFT, margin: 0 }}>
          {s ? 'Nothing on the floor right now' : 'This room has not opened yet'}
        </p>
      )}
    </article>
  );
}

/** A delegation named in a paper's sponsor list, flag and name, for the reader's header. */
export function SponsorChips({ sponsors }: { sponsors: string[] }) {
  if (sponsors.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {sponsors.map((sp, i) => (
        <span key={`${sp}-${i}`} className="inline-flex items-center gap-1.5">
          <CircleFlag country={sp} size={20} decorative />
          <SeatName name={sp} style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: INK }} subStyle={{ color: INK_SOFT, fontWeight: 500 }} />
        </span>
      ))}
    </div>
  );
}
