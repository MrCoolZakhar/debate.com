'use client';

// The Press Desk body: the release composer (press seats and press chairs only) and every
// committee room of the conference as a card, re-read every 10 s while the tab is visible.
// Data: press_desk (src/lib/press.ts, scratch-press.sql). Read only apart from the release.

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { OUTFIT } from '@/components/neu';
import Loader from '@/components/Loader';
import type { PressDesk as PressDeskData, PressDocument, PressRoom, ReleasesBoard } from '@/lib/press';
import { useNow } from '@/lib/useNow';
import { committeeShort } from '../participant/dashboardKit';
import PressRoomCard from './PressRoomCard';
import PressDocViewer from './PressDocViewer';
import PressReleaseComposer, { pressClosedLine, type PressDates, type PressTargetRoom } from './PressReleaseComposer';
import { MyReleasesCard, PressReviewCard } from './PressReleasesPanel';
import { CARD_SHADOW, INK, INK_SOFT, useReleasesBoard, usePressDesk } from './pressKit';

/** "Join the press room": the press committee's own live room, only during the conference
 *  and only once the room exists. A press seat enters locked to its seat (what /join builds
 *  for an allocated delegate); a press chair takes the join page's verified chair path. */
function JoinPressRoom({ desk, dates }: { desk: PressDeskData; dates: PressDates }) {
  const now = useNow(60_000);
  const room = desk.pressRoom;
  if (!room || room.ended || pressClosedLine(dates, now)) return null;
  const href = desk.role === 'press_seat' && room.country
    ? `/delegate/${encodeURIComponent(room.code)}?country=${encodeURIComponent(room.country)}&locked=1`
    : desk.role === 'press_chair' ? `/join?code=${encodeURIComponent(room.code)}&mode=chair` : null;
  if (!href) return null;
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 self-start rounded-[10px] px-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)]"
      style={{ minHeight: 44, backgroundColor: '#FFFFFF', color: 'var(--gv-main)', border: '1px solid color-mix(in srgb, var(--gv-main) 18%, transparent)', fontFamily: OUTFIT, fontSize: 15, fontWeight: 700, boxShadow: CARD_SHADOW }}
    >
      <LogIn size={17} strokeWidth={1.8} aria-hidden /> Join the press room
    </Link>
  );
}

function Note({ title, line, action }: { title: string; line?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[20px] p-7 text-center" style={{ backgroundColor: '#FFFFFF', boxShadow: CARD_SHADOW }}>
      <p style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 800, color: INK, margin: 0 }}>{title}</p>
      {line && <p style={{ fontFamily: OUTFIT, fontSize: 14, color: INK_SOFT, margin: '6px 0 0 0' }}>{line}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default function PressDesk({ conferenceId, dates }: { conferenceId: string; dates: PressDates }) {
  const { state, reload, patchDesk } = usePressDesk(conferenceId);
  // The release history and approval queue: for the press, and for organisers who are not
  // on the desk themselves (they can still approve and flip the switch).
  const boardOn = state.kind === 'ok' || state.kind === 'denied';
  const { board, reload: reloadBoard, patch: patchBoard } = useReleasesBoard(conferenceId, boardOn);
  const [reading, setReading] = useState<{ room: PressRoom; doc: PressDocument } | null>(null);
  // Stable, so the reader's focus / scroll-lock effect does not re-run on every 10 s poll.
  const closeReading = useCallback(() => setReading(null), []);
  const deskRooms = state.kind === 'ok' ? state.desk.rooms : null;
  const targets = useMemo<PressTargetRoom[]>(() => (deskRooms ?? [])
    .filter((r) => r.committeeType !== 'press' && !!r.session && !r.session.ended)
    .map((r) => ({ id: r.id, label: committeeShort(r.name, r.abbreviation), full: r.name })), [deskRooms]);
  const onBoardChanged = useCallback((p?: Partial<ReleasesBoard>) => {
    if (p) patchBoard(p);
    reloadBoard();
  }, [patchBoard, reloadBoard]);

  if (state.kind === 'loading') {
    return <div className="flex items-center justify-center py-20"><Loader size={64} label="Opening the Press Desk" /></div>;
  }
  if (state.kind === 'missing') {
    return <Note title="The Press Desk is not open yet" line="It opens once press committees are switched on for Gavelling" />;
  }
  if (state.kind === 'denied') {
    return (
      <div className="flex flex-col gap-6">
        {board?.canReview && <PressReviewCard conferenceId={conferenceId} board={board} onChanged={onBoardChanged} />}
        <Note title="This desk is for the press" line={state.message} />
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <Note
        title="We couldn't open the Press Desk"
        line="Check your connection and try again"
        action={<button type="button" onClick={reload} style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 700, color: 'var(--gv-main)', textDecoration: 'underline' }}>Try again</button>}
      />
    );
  }

  const { desk } = state;
  const liveCount = desk.rooms.filter((r) => r.session && !r.session.ended && !r.session.suspended && r.session.phase !== 'adjourned').length;

  return (
    <div className="flex flex-col gap-6">
      <JoinPressRoom desk={desk} dates={dates} />

      {board?.canReview && <PressReviewCard conferenceId={conferenceId} board={board} onChanged={onBoardChanged} />}

      {desk.canRelease && (
        <PressReleaseComposer
          conferenceId={conferenceId}
          dates={dates}
          label={desk.label}
          releasesLeft={desk.releasesLeft}
          nextReleaseAt={desk.nextReleaseAt}
          onSent={(left, next) => { patchDesk({ releasesLeft: left, nextReleaseAt: next }); reloadBoard(); }}
          rooms={targets}
          canPick={!!board}
          needsApproval={desk.role === 'press_seat' && (board ? board.approvalOn : desk.approvalOn === true)}
        />
      )}

      {board && <MyReleasesCard releases={board.mine} />}

      <div className="flex items-baseline gap-2">
        <span style={{ fontFamily: OUTFIT, fontSize: 28, fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums' }}>{liveCount}</span>
        <span style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 600, color: INK_SOFT }}>
          {liveCount === 1 ? 'room in session' : 'rooms in session'} of {desk.rooms.length}
        </span>
      </div>

      {desk.rooms.length === 0 ? (
        <Note title="No committees yet" line="Rooms appear here once the organisers add committees" />
      ) : (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }}>
          {desk.rooms.map((room) => (
            <PressRoomCard key={room.id} room={room} onOpenDoc={(r, d) => setReading({ room: r, doc: d })} />
          ))}
        </div>
      )}

      {reading && <PressDocViewer room={reading.room} doc={reading.doc} onClose={closeReading} />}
    </div>
  );
}
