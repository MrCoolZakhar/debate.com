'use client';

// The Press Desk body: the release composer (press seats and press chairs only) and every
// committee room of the conference as a card, re-read every 10 s while the tab is visible.
// Data: press_desk (src/lib/press.ts, scratch-press.sql). Read only apart from the release.

import { useCallback, useState } from 'react';
import { OUTFIT } from '@/components/neu';
import Loader from '@/components/Loader';
import type { PressDocument, PressRoom } from '@/lib/press';
import PressRoomCard from './PressRoomCard';
import PressDocViewer from './PressDocViewer';
import PressReleaseComposer from './PressReleaseComposer';
import { CARD_SHADOW, INK, INK_SOFT, usePressDesk } from './pressKit';

function Note({ title, line, action }: { title: string; line?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[20px] p-7 text-center" style={{ backgroundColor: '#FFFFFF', boxShadow: CARD_SHADOW }}>
      <p style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 800, color: INK, margin: 0 }}>{title}</p>
      {line && <p style={{ fontFamily: OUTFIT, fontSize: 14, color: INK_SOFT, margin: '6px 0 0 0' }}>{line}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default function PressDesk({ conferenceId }: { conferenceId: string }) {
  const { state, reload, patchDesk } = usePressDesk(conferenceId);
  const [reading, setReading] = useState<{ room: PressRoom; doc: PressDocument } | null>(null);
  // Stable, so the reader's focus / scroll-lock effect does not re-run on every 10 s poll.
  const closeReading = useCallback(() => setReading(null), []);

  if (state.kind === 'loading') {
    return <div className="flex items-center justify-center py-20"><Loader size={64} label="Opening the Press Desk" /></div>;
  }
  if (state.kind === 'missing') {
    return <Note title="The Press Desk is not open yet" line="It opens once press committees are switched on for Gavelling" />;
  }
  if (state.kind === 'denied') {
    return <Note title="This desk is for the press" line={state.message} />;
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
      {desk.canRelease && (
        <PressReleaseComposer
          conferenceId={conferenceId}
          label={desk.label}
          releasesLeft={desk.releasesLeft}
          nextReleaseAt={desk.nextReleaseAt}
          onSent={(left, next) => patchDesk({ releasesLeft: left, nextReleaseAt: next })}
        />
      )}

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
