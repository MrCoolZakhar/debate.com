'use client';
// Gavelling Crisis: the delegate's chat. It is the existing live-room chat (src/components/ChatPanel.tsx),
// mounted the way src/app/delegate/[code]/page.tsx mounts it: the committee of the cabinet's room, the
// delegate's seat name as the identity, embedded, read state per reader, broadcasts merged in, and the
// chat-off cases (Secretariat messages only, or the disabled notice).

import ChatPanel from '@/components/ChatPanel';
import ChatDisabledNotice from '@/components/ChatDisabledNotice';
import CrisisDialog from './CrisisDialog';
import type { CrisisRoom } from './useCrisisRoom';

export default function ChatDialog({ room, onClose }: { room: CrisisRoom; onClose: () => void }) {
  const { committee, seat } = room;
  const ended = !!committee?.endedAt;
  return (
    <CrisisDialog title="Committee Room" onClose={onClose} width={860} flush>
      <div className="flex overflow-hidden" style={{ height: 'min(680px, calc(100dvh - 130px))', minHeight: 260 }}>
        {!committee || !seat ? (
          <p style={{ margin: 0, padding: 20, fontSize: 14 }}>{room.reason ?? 'Your committee room opens on the conference days'}</p>
        ) : room.chatOff ? (
          room.broadcasts.length > 0 ? (
            <ChatPanel
              key="secretariat-only"
              committee={committee}
              senderName={seat.country}
              isChair={false}
              embedded
              readOnly
              secretariatOnly
              broadcasts={room.broadcasts}
              readCounts={room.readCounts}
              onReadCountsChange={room.setReadCounts}
            />
          ) : (
            <ChatDisabledNotice />
          )
        ) : (
          <ChatPanel
            committee={committee}
            senderName={seat.country}
            isChair={false}
            embedded
            readCounts={room.readCounts}
            onReadCountsChange={room.setReadCounts}
            readOnly={ended}
            broadcasts={room.broadcasts}
          />
        )}
      </div>
    </CrisisDialog>
  );
}
