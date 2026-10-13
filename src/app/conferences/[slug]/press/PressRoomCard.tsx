'use client';

// One committee room on the Press Desk: who it is, what it is doing, who speaks now and
// next, the motions on the floor and the papers that have been introduced. Read only.

import { BookOpen, Check, FileText, Mic, Vote, X } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import SeatName from '@/components/SeatName';
import { OUTFIT } from '@/components/neu';
import { CommitteeEmblem, TwoRowName, committeeShort } from '../participant/dashboardKit';
import type { PressDocument, PressRoom } from '@/lib/press';
import { CARD_SHADOW, FOREST, INK, INK_SOFT, SLATE, SeatLine, motionLabel, motionTimes, roomMode } from './pressKit';

function SmallLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: '#8A6614', margin: '0 0 6px 0' }}>{children}</p>
  );
}

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
  const showFloor = !!s && mode.live;
  const topic = s?.topic && s.topic !== 'TBD' ? s.topic : null;

  return (
    <article
      className="flex flex-col gap-4 rounded-[20px] p-5"
      style={{ backgroundColor: '#FFFFFF', boxShadow: CARD_SHADOW, minWidth: 0 }}
      aria-label={room.name}
    >
      {/* Who the room is */}
      <header className="flex items-start gap-3">
        <CommitteeEmblem logoUrl={room.logoUrl} name={room.name} abbreviation={room.abbreviation} size={48} isCrisis={room.committeeType === 'crisis'} />
        <div className="min-w-0 flex-1">
          <TwoRowName short={short} full={room.name} size={18} />
          {topic && (
            <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 13, color: INK_SOFT, margin: '4px 0 0 0', lineHeight: 1.4 }}>
              {topic}
            </p>
          )}
        </div>
      </header>

      {/* What it is doing */}
      <div className="flex items-start gap-2" style={{ color: mode.color }}>
        <span
          aria-hidden
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: mode.live ? 'rgba(61,122,82,0.13)' : 'rgba(28,20,16,0.06)' }}
        >
          <ModeIcon size={16} strokeWidth={2.2} />
        </span>
        <div className="min-w-0" style={{ paddingTop: 4 }}>
          <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
            {mode.word}
          </p>
          {mode.detail && (
            <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 500, color: INK_SOFT, margin: '2px 0 0 0', lineHeight: 1.4 }}>
              {mode.detail}
            </p>
          )}
        </div>
      </div>

      {/* Who speaks now and next */}
      {showFloor && (s.speaker || s.next.length > 0) && (
        <div>
          {s.speaker && (
            <div className="flex items-center gap-2.5 rounded-[14px] p-3" style={{ backgroundColor: 'rgba(238,217,138,0.22)' }}>
              <Mic size={16} strokeWidth={2.3} aria-label="Speaking now" style={{ color: '#8A6614', flexShrink: 0 }} />
              <SeatLine seat={s.speaker} size={34} nameSize={16} weight={800} />
            </div>
          )}
          {s.next.length > 0 && (
            <div style={{ marginTop: s.speaker ? 10 : 0 }}>
              <SmallLabel>Up next</SmallLabel>
              <ol className="flex flex-col gap-2" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {s.next.map((seat, i) => (
                  <li key={`${seat.country}-${i}`} className="flex items-center gap-2.5">
                    <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: INK_SOFT, width: 16, textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                    <SeatLine seat={seat} size={24} nameSize={14} weight={600} />
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Motions on the floor */}
      {showFloor && s.motions.length > 0 && (
        <div>
          <SmallLabel>Motions on the floor</SmallLabel>
          <ul className="flex flex-col gap-2" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {s.motions.map((m) => {
              const times = motionTimes(m);
              const chair = m.proposedBy === '__chair__';
              return (
                <li key={m.id} className="rounded-[12px] px-3 py-2.5" style={{ backgroundColor: 'rgba(27,56,40,0.04)' }}>
                  <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: INK, margin: 0, lineHeight: 1.3 }}>
                    {motionLabel(m)}
                    {times && <span style={{ fontWeight: 500, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>{' · '}{times}</span>}
                  </p>
                  {m.type !== 'custom' && m.topic && (
                    <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 13, color: INK_SOFT, margin: '2px 0 0 0', lineHeight: 1.4 }}>{m.topic}</p>
                  )}
                  {m.proposedBy && (
                    <p className="flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: INK_SOFT, margin: '4px 0 0 0' }}>
                      <span>Raised by</span>
                      {chair ? (
                        <span style={{ fontWeight: 600, color: INK }}>the chair</span>
                      ) : (
                        <SeatLine seat={{ country: m.proposedBy, logoUrl: null }} size={18} nameSize={12.5} weight={600} />
                      )}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Papers that were introduced (never a draft only submitted) */}
      {s && s.documents.length > 0 && (
        <div>
          <SmallLabel>Papers</SmallLabel>
          <ul className="flex flex-col gap-2" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {s.documents.map((d) => {
              const st = docStatus(d);
              const StIcon = st.icon;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => onOpenDoc(room, d)}
                    className="w-full text-start rounded-[12px] px-3 py-2.5 transition-[background-color] duration-150 hover:bg-[#1B3828]/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
                    style={{ backgroundColor: 'rgba(27,56,40,0.04)' }}
                  >
                    <span className="flex items-start gap-2.5">
                      <FileText size={18} strokeWidth={2.1} aria-hidden style={{ color: SLATE, flexShrink: 0, marginTop: 1 }} />
                      <span className="min-w-0 flex-1">
                        <span className="block [overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: INK, lineHeight: 1.3 }}>
                          {d.docCode && <span style={{ color: SLATE }}>{d.docCode} </span>}
                          {d.title || 'Untitled paper'}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="inline-flex items-center gap-1" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: st.color }}>
                            <StIcon size={13} strokeWidth={2.4} aria-hidden />{st.word}
                          </span>
                          {d.sponsors.length > 0 && (
                            <span className="inline-flex items-center" aria-label={`Sponsors: ${d.sponsors.join(', ')}`} title={d.sponsors.join(', ')}>
                              {d.sponsors.slice(0, 5).map((sp, i) => (
                                <span key={`${sp}-${i}`} style={{ marginInlineStart: i === 0 ? 0 : -6, borderRadius: 999, boxShadow: '0 0 0 2px #FFFFFF', display: 'inline-flex' }}>
                                  <CircleFlag country={sp} size={20} decorative />
                                </span>
                              ))}
                              {d.sponsors.length > 5 && (
                                <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: INK_SOFT, marginInlineStart: 4 }}>+{d.sponsors.length - 5}</span>
                              )}
                            </span>
                          )}
                        </span>
                      </span>
                      <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: FOREST, textDecoration: 'underline', flexShrink: 0, marginTop: 1 }}>Read</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!showFloor && (!s || s.documents.length === 0) && (
        <p style={{ fontFamily: OUTFIT, fontSize: 13.5, color: INK_SOFT, margin: 0 }}>
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
