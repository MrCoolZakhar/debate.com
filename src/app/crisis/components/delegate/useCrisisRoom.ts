'use client';
// Gavelling Crisis: the delegate's live room, loaded ONCE and shared by the status block, the
// speakers list, "Request to speak" and the chat.
//
// The room is the live session of the delegate's cabinet (crisis_cabinets.conference_committee_id ->
// conference_committees.session_code). The delegate's SEAT is the room's delegates row whose name
// matches their character (seatKey: case and spaces ignored). The pipeline is the delegate phone's own
// (src/app/delegate/[code]/page.tsx): getCommitteeByCodeWithRetry + startSessionSync, with messages and
// organiser broadcasts included so the existing ChatPanel can be mounted exactly as the phone does.
// Chat read state is kept per reader (chatReadKey.ts), identity = the seat's name in the room.

import { useEffect, useMemo, useRef, useState } from 'react';
import { getCrisisClient } from '@/lib/crisis/client';
import { getCommitteeByCodeWithRetry, type SessionBroadcast } from '@/lib/committeeService';
import { useBroadcastHistory } from '@/lib/broadcastHistory';
import { secretariatUnread, withBroadcastMessages } from '@/lib/broadcastMessages';
import { chatUnreadTotal, mergeMessagesById } from '@/lib/chatConversations';
import { loadChatReadCounts, saveChatReadCounts } from '@/lib/chatReadKey';
import { getCommitteeFlags } from '@/lib/committeeFlags';
import { withRoomOrderQueue } from '@/lib/roomOrderQueue';
import { seatKey } from '@/lib/seatClaims';
import { startSessionSync, rowFields, withCurrentSpeaker, withLists } from '@/lib/sessionSync';
import type { Character } from '@/lib/crisis/types';
import type { Committee, Delegate } from '@/lib/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';

export const sameSeat = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && seatKey(a) === seatKey(b);

export type RoomStatus = 'loading' | 'no_room' | 'failed' | 'no_seat' | 'ready';

export interface CrisisRoom {
  status: RoomStatus;
  committee: Committee | null;
  seat: Delegate | null;
  character: Character | null;
  retry: () => void;
  /** A plain sentence for why the room cannot be used yet, or null when it is ready. */
  reason: string | null;
  // Chat (the existing ChatPanel's props)
  broadcasts: SessionBroadcast[];
  readCounts: Record<string, number>;
  setReadCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  chatOff: boolean;
  unread: number;
}

/** The cabinet's room code. Read again each minute while there is none. */
function useRoomCode() {
  const { ref, cabinetId, core } = useCrisis();
  const ccId = core.cabinets.find((c) => c.id === cabinetId)?.conference_committee_id ?? null;
  const [read, setRead] = useState<{ ccId: string; code: string | null } | null>(null);
  const haveCode = useRef(false);

  useEffect(() => {
    if (!ccId) return;
    let cancelled = false;
    const run = async () => {
      if (haveCode.current) return;
      try {
        const client = await getCrisisClient(ref.conf, ref.crisis);
        const r = await client.from('conference_committees').select('session_code').eq('id', ccId).maybeSingle();
        if (cancelled || r.error) return;
        const code = (r.data as { session_code: string | null } | null)?.session_code ?? null;
        haveCode.current = !!code;
        setRead({ ccId, code });
      } catch { /* the next tick retries */ }
    };
    const first = window.setTimeout(() => { void run(); }, 0);
    const again = window.setInterval(() => { if (document.visibilityState === 'visible') void run(); }, 60_000);
    return () => { cancelled = true; haveCode.current = false; window.clearTimeout(first); window.clearInterval(again); };
  }, [ref.conf, ref.crisis, ccId]);

  if (!ccId) return { ready: true, code: null as string | null };
  const mine = read?.ccId === ccId ? read : null;
  return { ready: !!mine, code: mine?.code ?? null };
}

/** The live room, kept current by the delegate page's own sync (messages and broadcasts included). */
function useRoom(code: string | null) {
  const [state, setState] = useState<{ code: string; committee: Committee | null; failed: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [broadcastVersion, setBroadcastVersion] = useState(0);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    (async () => {
      const result = await getCommitteeByCodeWithRetry(code.toUpperCase(), { isCancelled: () => cancelled });
      if (cancelled) return;
      if (result.status !== 'ok') { setState({ code, committee: null, failed: result.status === 'error' }); return; }
      setState({ code, committee: result.committee, failed: false });
      const patch = (fn: (c: Committee) => Committee) => setState((s) => (s && s.committee ? { ...s, committee: fn(s.committee) } : s));
      const sync = startSessionSync({
        committeeId: result.committee.id,
        tables: ['committees', 'delegates', 'speakers_list', 'current_speaker', 'motions', 'documents', 'messages', 'session_broadcasts'],
        slices: ['row', 'delegates', 'lists', 'currentSpeaker', 'motions', 'documents', 'messages'],
        onEvent: (table) => {
          if (table === 'session_broadcasts') { setBroadcastVersion((v) => v + 1); return true; }
          return false;
        },
        onCatchUp: (phase) => { if (phase === 'done') setBroadcastVersion((v) => v + 1); },
        onMessage: (m) => patch((p) => {
          const merged = mergeMessagesById(p.messages, [m]);
          return merged === p.messages ? p : { ...p, messages: merged };
        }),
        apply: (slice, data) => {
          switch (slice) {
            case 'row': patch((p) => withRoomOrderQueue({ ...p, ...rowFields(data as Committee) })); break;
            case 'delegates': patch((p) => ({ ...p, delegates: data as Committee['delegates'] })); break;
            case 'lists': patch((p) => withLists(p, data as Parameters<typeof withLists>[1])); break;
            case 'currentSpeaker': patch((p) => withCurrentSpeaker(p, data as Parameters<typeof withCurrentSpeaker>[1], { includeRemaining: true })); break;
            case 'motions': patch((p) => ({ ...p, pendingMotions: data as Committee['pendingMotions'] })); break;
            case 'documents': patch((p) => ({ ...p, documents: data as Committee['documents'] })); break;
            case 'messages': patch((p) => {
              const merged = mergeMessagesById(p.messages, data as Committee['messages']);
              return merged === p.messages ? p : { ...p, messages: merged };
            }); break;
            default: break;
          }
        },
      });
      if (cancelled) { sync.stop(); return; }
      stop = sync.stop;
    })();
    return () => { cancelled = true; stop?.(); };
  }, [code, attempt]);

  const mine = state && state.code === code ? state : null;
  return {
    loaded: !!mine,
    committee: mine?.committee ?? null,
    failed: mine?.failed ?? false,
    broadcastVersion,
    retry: () => { setState(null); setAttempt((a) => a + 1); },
  };
}

export function useCrisisRoom(): CrisisRoom {
  const { characterId, core } = useCrisis();
  const { ready, code } = useRoomCode();
  const room = useRoom(code);
  const character = useMemo(() => core.characters.find((c) => c.id === characterId) ?? null, [core.characters, characterId]);

  const committee = room.committee;
  const seat = useMemo(
    () => (committee && character ? committee.delegates.find((d) => sameSeat(d.country, character.name)) ?? null : null),
    [committee, character],
  );
  const country = seat?.country ?? '';

  // Chat read state, per reader (this seat), as the phone keeps it.
  const [readCounts, setReadCounts] = useState<Record<string, number>>({});
  const roomCode = committee?.code ?? '';
  const hydrated = useRef<string>('');
  useEffect(() => {
    if (!roomCode || !country) return;
    const key = `${roomCode}:${country}`;
    const stored = loadChatReadCounts(roomCode, { role: 'delegate', identity: country });
    // Deferred one tick so the effect body never sets state synchronously.
    const t = window.setTimeout(() => { if (stored) setReadCounts(stored); hydrated.current = key; }, 0);
    return () => window.clearTimeout(t);
  }, [roomCode, country]);
  useEffect(() => {
    if (!roomCode || !country || hydrated.current !== `${roomCode}:${country}`) return;
    saveChatReadCounts(roomCode, { role: 'delegate', identity: country }, readCounts);
  }, [readCounts, roomCode, country]);

  const broadcasts = useBroadcastHistory(committee?.id, room.broadcastVersion, !!seat);
  const chatOff = committee ? getCommitteeFlags(committee).disableChat : false;

  const messages = committee?.messages;
  const chairNames = committee?.chairNames;
  const delegates = committee?.delegates;
  const unread = useMemo(() => {
    if (!seat) return 0;
    if (chatOff) return secretariatUnread(broadcasts, readCounts);
    return chatUnreadTotal(
      withBroadcastMessages(messages ?? [], broadcasts), country, false, chairNames ?? [], readCounts, (delegates ?? []).map((d) => d.country),
    );
  }, [seat, chatOff, broadcasts, readCounts, messages, country, chairNames, delegates]);

  let status: RoomStatus;
  let reason: string | null = null;
  if (!ready) status = 'loading';
  else if (!code) { status = 'no_room'; reason = 'Your committee room opens on the conference days'; }
  else if (!room.loaded) status = 'loading';
  else if (room.failed) { status = 'failed'; reason = 'Your committee room did not load'; }
  else if (!committee) { status = 'no_room'; reason = 'Your committee room opens on the conference days'; }
  else if (!seat) { status = 'no_seat'; reason = 'Your seat is not in the room yet. Ask your chair'; }
  else status = 'ready';

  return {
    status, committee, seat, character, retry: room.retry, reason,
    broadcasts, readCounts, setReadCounts, chatOff, unread,
  };
}
