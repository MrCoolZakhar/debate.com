'use client';
// Gavelling Crisis: the crisis staff's access to a cabinet's committee-room chat. The Crisis Director, the assistants and the
// backroomers read and write the room's chat as ONE chair-like name, "Crisis Team" (src/lib/crisis/staffChatName.ts). That name
// is added to the room's chair_names through the existing addChairName path (the same atomic, idempotent RPC the chair page
// uses, with the room's chair password as the x-chair-suffix header), so delegates' messages to the dais reach the staff and the
// delegates see a chair called Crisis Team. The chat itself is the shared session chat (src/components/ChatPanel.tsx) mounted
// the way the chair page mounts it (isChair, embedded, broadcasts merged in), and the room is loaded and kept live by the same
// hook the delegate's chat uses (useRoom in delegate/useCrisisRoom.ts). Read state is kept per staff member, never shared.
//
// Messages are sent as "Crisis Team" for everyone; which staff member wrote one is not stored (that would need a column or a
// marker in the message, which the session chat does not have).

import { useEffect, useMemo, useRef, useState } from 'react';
import ChatPanel from '@/components/ChatPanel';
import { SeatArtProvider } from '@/components/SeatFlag';
import Loader from '@/components/Loader';
import { safeChairName } from '@/lib/chairNameRules';
import { chatUnreadTotal } from '@/lib/chatConversations';
import { loadChatReadCounts, saveChatReadCounts } from '@/lib/chatReadKey';
import { addChairName, type SessionBroadcast } from '@/lib/committeeService';
import { useBroadcastHistory } from '@/lib/broadcastHistory';
import { withBroadcastMessages } from '@/lib/broadcastMessages';
import { getCommitteeFlags } from '@/lib/committeeFlags';
import { notifyErr } from '@/lib/appNotify';
import { CRISIS_TEAM_NAME } from '@/lib/crisis/staffChatName';
import type { Committee } from '@/lib/types';
import { Btn, CK } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { useRoom } from '../delegate/useCrisisRoom';

export interface StaffChat {
  /** idle = no room to open; loading / joining = on the way; failed = could not open; ready = the chat can be shown. */
  status: 'idle' | 'loading' | 'joining' | 'failed' | 'ready';
  /** A plain sentence for why the chat cannot be shown yet, or null when it is ready. */
  reason: string | null;
  /** The room, with the staff's chair name in its chair_names. */
  committee: Committee | null;
  /** The name the staff write under. */
  name: string;
  broadcasts: SessionBroadcast[];
  readCounts: Record<string, number>;
  setReadCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  chatOff: boolean;
  ended: boolean;
  unread: number;
  retry: () => void;
}

/** Opens a room's chat for the signed-in staff member. Pass null to stay idle (nothing is loaded). The room is read from the start (for the
 *  unread count) but the staff name joins the room's dais only once `join` is true, so merely looking at a room never changes it. */
export function useStaffChat(code: string | null, join = true): StaffChat {
  const { memberId } = useCrisis();
  const room = useRoom(code);
  const committee = room.committee;
  const committeeId = committee?.id ?? null;
  const suffix = committee?.dbChairJoinSuffix ?? undefined;
  const delegates = committee?.delegates;
  const name = useMemo(() => safeChairName(CRISIS_TEAM_NAME, (delegates ?? []).map((d) => d.country)), [delegates]);
  const present = !!committee?.chairNames.includes(name);

  // Join the room's dais under the staff name (once per room; the RPC is idempotent).
  const [joined, setJoined] = useState<string | null>(null);
  const [failedAttempt, setFailedAttempt] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const joinKey = committeeId ? `${committeeId}|${name}` : null;
  useEffect(() => {
    if (!join || !committeeId || !code || !joinKey || present) return;
    let cancelled = false;
    void addChairName(committeeId, name, committee?.code ?? code, suffix).then((ok) => {
      if (cancelled) return;
      if (ok) setJoined(joinKey);
      else { setFailedAttempt(`${joinKey}|${attempt}`); notifyErr('Could not open the room chat. Try again.', 'crisis-staff-chat-join'); }
    });
    return () => { cancelled = true; };
  }, [join, committeeId, code, joinKey, present, name, suffix, attempt, committee?.code]);
  const joinedHere = joined === joinKey;
  const joinFailed = !!joinKey && failedAttempt === `${joinKey}|${attempt}`;

  // The room as the chat sees it: the staff name is on the dais as soon as the RPC has answered.
  const seen = useMemo(
    () => (committee && !present && joinedHere ? { ...committee, chairNames: [...committee.chairNames, name] } : committee),
    [committee, present, joinedHere, name],
  );
  const ended = !!seen?.endedAt;
  const chatOff = seen ? getCommitteeFlags(seen).disableChat : false;

  // Read state, per staff member (never shared between two people on one room).
  const [readCounts, setReadCounts] = useState<Record<string, number>>({});
  const roomCode = seen?.code ?? '';
  const reader = useMemo(() => ({ role: 'chair' as const, identity: `${name}:${memberId ?? 'organiser'}` }), [name, memberId]);
  const hydrated = useRef('');
  useEffect(() => {
    if (!roomCode) return;
    const key = `${roomCode}:${reader.identity}`;
    const stored = loadChatReadCounts(roomCode, reader);
    // Deferred one tick so the effect body never sets state synchronously.
    const t = window.setTimeout(() => { if (stored) setReadCounts(stored); hydrated.current = key; }, 0);
    return () => window.clearTimeout(t);
  }, [roomCode, reader]);
  useEffect(() => {
    if (!roomCode || hydrated.current !== `${roomCode}:${reader.identity}`) return;
    saveChatReadCounts(roomCode, reader, readCounts);
  }, [readCounts, roomCode, reader]);

  const broadcasts = useBroadcastHistory(seen?.id, room.broadcastVersion, !!seen);

  const messages = seen?.messages;
  const chairNames = seen?.chairNames;
  const seatNames = useMemo(() => (delegates ?? []).map((d) => d.country), [delegates]);
  const unread = useMemo(() => {
    if (!messages || !chairNames) return 0;
    // Counted as the Crisis Team even before it has joined the dais.
    const names = chairNames.includes(name) ? chairNames : [...chairNames, name];
    return chatUnreadTotal(withBroadcastMessages(messages, broadcasts), name, true, names, readCounts, seatNames);
  }, [messages, chairNames, broadcasts, name, readCounts, seatNames]);

  let status: StaffChat['status'];
  let reason: string | null = null;
  if (!code) { status = 'idle'; reason = 'This cabinet has no committee room yet'; }
  else if (!room.loaded) status = 'loading';
  else if (room.failed) { status = 'failed'; reason = 'The committee room did not load'; }
  else if (!seen) { status = 'idle'; reason = 'This cabinet has no committee room yet'; }
  else if (!present && !joinedHere) {
    // An ended room can still be read without a seat on the dais.
    if (joinFailed && ended) status = 'ready';
    else if (joinFailed) { status = 'failed'; reason = 'The room chat did not open'; }
    else status = 'joining';
  } else status = 'ready';

  const retry = () => {
    if (room.failed || !room.loaded) room.retry();
    setAttempt((a) => a + 1);
  };

  return { status, reason, committee: seen, name, broadcasts, readCounts, setReadCounts, chatOff, ended, unread, retry };
}

/** The chat itself, filling a box of the given height. Chat that is off for delegates is shown read only, with a plain line saying so. */
export default function StaffRoomChat({ chat, height = 'clamp(300px, calc(100dvh - 330px), 560px)' }: { chat: StaffChat; height?: string }) {
  const { committee } = chat;
  if (chat.status === 'ready' && committee) {
    return (
      <SeatArtProvider delegates={committee.delegates}>
        {chat.chatOff && (
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: CK.inkSoft, fontFamily: CK.font }}>
            Chat is off for delegates in this room. You can read it here but not write.
          </p>
        )}
        <div className="flex overflow-hidden" style={{ height, minHeight: 240, borderRadius: 16 }}>
          <ChatPanel
            committee={committee}
            senderName={chat.name}
            isChair
            embedded
            readOnly={chat.ended || chat.chatOff}
            readCounts={chat.readCounts}
            onReadCountsChange={chat.setReadCounts}
            broadcasts={chat.broadcasts}
          />
        </div>
      </SeatArtProvider>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: 200, gap: 10, fontFamily: CK.font, color: CK.ink }}>
      {chat.status === 'loading' || chat.status === 'joining' ? (
        <>
          <Loader size={24} />
          <p style={{ margin: 0, fontSize: 13, color: CK.inkSoft }}>{chat.status === 'joining' ? 'Opening the room chat' : 'Reading the committee room'}</p>
        </>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{chat.reason ?? 'The room chat is not available'}</p>
          {chat.status === 'failed' && <Btn tone="ghost" size="sm" onClick={chat.retry}>Try again</Btn>}
        </>
      )}
    </div>
  );
}
