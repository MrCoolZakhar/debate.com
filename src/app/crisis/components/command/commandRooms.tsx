'use client';
// Gavelling Crisis: "Front Rooms", every cabinet's live room as the organiser's Live Status card in a smaller size
// (commandRoomCard.tsx), always on screen: the cards share the card's height and drop their small rows when short, so
// nothing scrolls. A click opens the room pop-up (the organiser's live status for that room).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Presentation } from 'lucide-react';
import type { CrisisRef } from '@/lib/crisis/api';
import type { Cabinet } from '@/lib/crisis/types';
import { Card, CardTitle } from '../../crisisKit';
import { loadRoomStates, type RoomState } from './commandData';
import { EmptyLine } from './commandParts';
import CommandRoomDialog from './commandRoomDialog';
import CrisisRoomCard, { ROOM_CARD_CSS, ROOM_OVERHANG } from './commandRoomCard';

export function useRoomStates(cref: CrisisRef, cabinets: Cabinet[]): { rooms: RoomState[] | null; failed: boolean } {
  const [rooms, setRooms] = useState<RoomState[] | null>(null);
  const [failed, setFailed] = useState(false);
  const cabinetsRef = useRef(cabinets);
  useEffect(() => { cabinetsRef.current = cabinets; });
  const key = cabinets.map((c) => `${c.id}:${c.conference_committee_id ?? ''}:${c.name}:${c.color}:${c.logo_url ?? ''}`).join('|');
  const seq = useRef(0);

  const read = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const r = await loadRoomStates(cref, cabinetsRef.current);
      if (mine !== seq.current) return;
      setRooms(r);
      setFailed(false);
    } catch {
      // A failed re-read keeps what is on screen.
      if (mine === seq.current) setFailed(true);
    }
  }, [cref]);

  useEffect(() => {
    const first = window.setTimeout(() => { void read(); }, 0);
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') void read(); }, 10_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void read(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearTimeout(first); window.clearInterval(poll); document.removeEventListener('visibilitychange', onVisible); };
  }, [read, key]);

  return { rooms, failed };
}

export function FrontRoomsCard({ cabinets, conferenceId, rooms, failed }: {
  cabinets: Cabinet[]; conferenceId: string; rooms: RoomState[] | null; failed: boolean;
}) {
  const byCab = useMemo(() => new Map((rooms ?? []).map((r) => [r.cabinetId, r])), [rooms]);
  // The pop-up is found by cabinet id, so it follows the live state and a retired room code.
  const [openId, setOpenId] = useState<string | null>(null);
  const openCab = openId ? cabinets.find((c) => c.id === openId) ?? null : null;
  const openRoom = openId ? byCab.get(openId) ?? null : null;

  return (
    <Card warm className="cmd-card cmd-rooms" style={{ display: 'flex', flexDirection: 'column' }}>
      <style>{ROOM_CARD_CSS}</style>
      <CardTitle icon={<Presentation size={17} strokeWidth={1.5} />}>Front Rooms</CardTitle>
      {cabinets.length === 0 ? <EmptyLine>No cabinets yet.</EmptyLine> : (
        <div className="cmd-rooms-list flex flex-col" style={{ gap: 0 }}>
          {cabinets.map((cab) => {
            const r = byCab.get(cab.id);
            const linked = !!r?.live;
            return (
              <div key={cab.id} className="rm-slot" style={{ flex: '1 1 236px', paddingTop: ROOM_OVERHANG + 6, maxHeight: 290 + ROOM_OVERHANG }}>
                <CrisisRoomCard
                  cab={cab}
                  live={r?.live ?? null}
                  placeholder={rooms === null ? (failed ? 'Could not read this room' : 'Reading the room') : 'No room linked'}
                  onOpen={linked ? () => setOpenId(cab.id) : undefined}
                />
              </div>
            );
          })}
        </div>
      )}
      {openCab && openRoom?.live && <CommandRoomDialog cab={openCab} room={openRoom} conferenceId={conferenceId} onClose={() => setOpenId(null)} />}
    </Card>
  );
}
