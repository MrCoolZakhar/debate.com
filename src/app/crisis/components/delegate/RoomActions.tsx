'use client';
// Gavelling Crisis: the delegate's live-room actions: two small buttons the width of the profile card,
// side by side: "Request to speak" (red) and "Chat" (with unread). There are no working papers or draft
// resolutions in crisis, so there is no "Submit a document".
//
// Request to speak uses the existing session functions exactly as the phone does:
//   request  requestGslSpot (a gsl-request motion), cooldowns kept in the SAME localStorage key as
//            the delegate page (gsl-request:<committee>:<seat>) and in the shared per-delegation
//            allowance (delegateAllowance.ts)

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Hand, MessagesSquare } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { getPendingMotionsList, requestGslSpot } from '@/lib/committeeService';
import { readDelegateAllowance, recordDelegateAllowance, type DelegateAllowance } from '@/lib/delegateAllowance';
import type { Committee, Delegate } from '@/lib/types';
import { Btn, CK } from '../../crisisKit';
import { sameSeat, type CrisisRoom } from './useCrisisRoom';

// Request to speak: the same two clocks and key as src/app/delegate/[code]/page.tsx
// (that page does not export them; keep the numbers in step with GSL_RETRY_MS / GSL_DENIED_MS there).
const GSL_RETRY_MS = 60 * 1000;
const GSL_DENIED_MS = 15 * 60 * 1000;
const GSL_DENIAL_GRACE_MS = 2500;

type GslCooldown = { requestedAt?: number; deniedAt?: number };
const cooldownKey = (committeeId: string, seat: string) => `gsl-request:${committeeId}:${seat}`;

function readCooldown(committeeId: string, seat: string): GslCooldown {
  try {
    const raw = window.localStorage.getItem(cooldownKey(committeeId, seat));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as GslCooldown) : {};
  } catch { return {}; }
}
function writeCooldown(committeeId: string, seat: string, value: GslCooldown): void {
  try {
    const key = cooldownKey(committeeId, seat);
    if (!value.requestedAt && !value.deniedAt) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch { /* private window */ }
}
const leftOf = (at: number | undefined, span: number, now: number) => (at ? Math.max(0, span - (now - at)) : 0);

function waitWords(ms: number): string {
  const secs = Math.ceil(ms / 1000);
  return secs >= 60 ? `${Math.ceil(secs / 60)} min` : `${secs} s`;
}

// Icon on top, the word small beneath; the button fills its half of the row.
const SMALL: CSSProperties = {
  width: '100%', flexDirection: 'column', justifyContent: 'center', gap: 4, padding: '9px 6px', fontSize: 12.5, borderRadius: 12,
  whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.2,
};
// The reason lines span both columns and come after the two buttons (order), so the buttons stay side by side.
const FULL_ROW: CSSProperties = { gridColumn: '1 / -1', order: 3 };

/** The red button, plus a one-line reason underneath (ordered last in the wrapping row). */
function RequestToSpeak({ committee, seat }: { committee: Committee; seat: Delegate }) {
  const country = seat.country;
  const committeeRef = useRef(committee);
  useEffect(() => { committeeRef.current = committee; }, [committee]);

  const floor = committee.currentSpeaker ?? null;
  const floorName = floor?.country ?? (committee.phase === 'moderated-caucus' ? committee.caucus?.currentSpeaker ?? null : null);
  const iHaveFloor = sameSeat(floorName, country);
  const gslIndex = committee.speakersList.findIndex((s) => sameSeat(s.country, country));
  const caucusIndex = committee.phase === 'moderated-caucus' ? (committee.caucusQueue ?? []).findIndex((s) => sameSeat(s.country, country)) : -1;
  const onGsl = gslIndex !== -1;
  const onList = iHaveFloor || onGsl || caucusIndex !== -1;
  const pending = (committee.pendingMotions ?? []).some((m) => (m.type as string) === 'gsl-request' && sameSeat(m.proposedBy, country));
  const closedPhase = committee.phase === 'moderated-caucus' || committee.phase === 'unmoderated-caucus' || committee.phase === 'voting';
  const over = !!committee.endedAt;
  const paused = !over && (!!committee.suspendedAt || committee.phase === 'adjourned');
  const absent = seat.status === 'absent';

  // Cooldowns (persisted, per committee AND seat; shared with the delegate phone).
  const [cooldown, setCooldown] = useState<GslCooldown>(() => readCooldown(committee.id, country));
  const [now, setNow] = useState(() => Date.now());
  const cooldownRef = useRef(cooldown);
  const commit = useCallback((next: GslCooldown) => {
    cooldownRef.current = next;
    setCooldown(next);
    setNow(Date.now());
    writeCooldown(committeeRef.current.id, country, next);
  }, [country]);

  const deniedLeft = onList ? 0 : leftOf(cooldown.deniedAt, GSL_DENIED_MS, now);
  const retryLeft = onList ? 0 : leftOf(cooldown.requestedAt, GSL_RETRY_MS, now);
  const clockOpen = deniedLeft > 0 || retryLeft > 0;
  useEffect(() => {
    if (!clockOpen) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [clockOpen]);

  // The shared allowance: another phone of this delegation may have asked or been refused.
  const allowanceMissing = useRef(false);
  const lastClearAt = useRef(0);
  const refreshAllowance = useCallback(async () => {
    if (allowanceMissing.current) return;
    const a = await readDelegateAllowance(committeeRef.current.code, country);
    if (a === 'missing') { allowanceMissing.current = true; return; }
    if (!a) return;
    const x: DelegateAllowance = a;
    const req = x.gslRetryLeftMs > 0 ? x.readAt - (GSL_RETRY_MS - x.gslRetryLeftMs) : undefined;
    const den = x.gslDeniedLeftMs > 0 ? x.readAt - (GSL_DENIED_MS - x.gslDeniedLeftMs) : undefined;
    if (req === undefined && den === undefined) return;
    const prev = cooldownRef.current;
    const later = (p?: number, q?: number) => (p === undefined ? q : q === undefined ? p : Math.max(p, q));
    const next: GslCooldown = { requestedAt: later(prev.requestedAt, req), deniedAt: later(prev.deniedAt, den) };
    if (next.requestedAt !== prev.requestedAt || next.deniedAt !== prev.deniedAt) commit(next);
  }, [country, commit]);

  useEffect(() => {
    const id = window.setTimeout(() => { void refreshAllowance(); }, 400);
    return () => window.clearTimeout(id);
  }, [pending, onList, refreshAllowance]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshAllowance(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshAllowance]);

  // A request that vanishes without the delegation reaching the list is a refusal, but only after
  // a grace window: an approval is two writes (list insert, motion delete) that can arrive in either order.
  const hadPending = useRef(pending);
  const denialTimer = useRef<number | null>(null);
  useEffect(() => {
    if (hadPending.current && !pending && !onList && denialTimer.current === null) {
      denialTimer.current = window.setTimeout(() => {
        denialTimer.current = null;
        const c = committeeRef.current;
        const listed = c.speakersList.some((s) => sameSeat(s.country, country)) || sameSeat(c.currentSpeaker?.country, country);
        const again = (c.pendingMotions ?? []).some((m) => (m.type as string) === 'gsl-request' && sameSeat(m.proposedBy, country));
        if (!listed && !again) commit({ deniedAt: Date.now() });
      }, GSL_DENIAL_GRACE_MS);
    }
    if (onList) {
      if (denialTimer.current !== null) { window.clearTimeout(denialTimer.current); denialTimer.current = null; }
      // Reaching the list ends both clocks, here and on the delegation's other phones.
      const sh = cooldownRef.current;
      if (sh.requestedAt || sh.deniedAt) {
        const id = window.setTimeout(() => {
          commit({});
          if (!allowanceMissing.current && Date.now() - lastClearAt.current > 5000) {
            lastClearAt.current = Date.now();
            void recordDelegateAllowance(committeeRef.current.code, country, 'gsl_clear');
          }
        }, 0);
        hadPending.current = pending;
        return () => window.clearTimeout(id);
      }
    }
    hadPending.current = pending;
  }, [pending, onList, country, commit]);
  useEffect(() => () => { if (denialTimer.current !== null) window.clearTimeout(denialTimer.current); }, []);

  const [asking, setAsking] = useState(false);
  const request = async () => {
    if (asking) return;
    const c = committeeRef.current;
    setAsking(true);
    const before = cooldownRef.current;
    commit({ requestedAt: Date.now() });
    try {
      await requestGslSpot(c.id, seat.id, country, c.code);
      void recordDelegateAllowance(c.code, country, 'gsl_request');
      // requestGslSpot only logs a failure, so read the motions back once to be sure it landed.
      const motions = await getPendingMotionsList(c.id);
      if (motions) {
        const landed = motions.some((m) => (m.type as string) === 'gsl-request' && sameSeat(m.proposedBy, country));
        const listed = committeeRef.current.speakersList.some((s) => sameSeat(s.country, country)) || sameSeat(committeeRef.current.currentSpeaker?.country, country);
        if (!landed && !listed) { commit(before); notifyErr('Your request did not reach the chair. Try again.'); return; }
      }
      notifyOk('Your chair has your request');
    } catch {
      commit(before);
      notifyErr('Your request did not reach the chair. Try again.');
    } finally {
      setAsking(false);
    }
  };

  // What the request button says. What the room can see outranks anything this device remembers.
  const req = (() => {
    if (iHaveFloor) return { label: 'You have the floor', hint: undefined as string | undefined, off: true };
    if (onList) return { label: 'You are on the list', hint: undefined, off: true };
    if (over) return { label: 'Request to speak', hint: 'The session has ended', off: true };
    if (paused) return { label: 'Request to speak', hint: 'The session is suspended', off: true };
    if (closedPhase) return { label: 'Request to speak', hint: 'Open again on the speakers list', off: true };
    if (absent) return { label: 'Request to speak', hint: 'Your chair marks you present at roll call first', off: true };
    if (deniedLeft > 0) return { label: 'Request to speak', hint: `Your chair said no. Ask again in ${waitWords(deniedLeft)}`, off: true };
    if (pending) {
      if (retryLeft > 0) return { label: 'Request sent', hint: 'Waiting for your chair', off: true };
      return { label: 'Ask again', hint: 'Your chair has not answered yet', off: false };
    }
    return { label: 'Request to speak', hint: undefined, off: false };
  })();

  return (
    <>
      <Btn tone="red" icon={<Hand size={16} strokeWidth={1.5} aria-hidden />} disabled={req.off || asking} onClick={request} style={SMALL}>
        {req.label}
      </Btn>
      {req.hint && <span role="status" style={{ ...FULL_ROW, fontSize: 12.5, color: CK.inkSoft }}>{req.hint}</span>}
    </>
  );
}

/** Request to speak and Chat, side by side. */
export default function RoomActions({ room, onChat }: { room: CrisisRoom; onChat: () => void }) {
  const ready = room.status === 'ready' && room.committee && room.seat;
  const chatReason = ready ? null : room.status === 'loading' ? 'Opening your committee room' : room.reason;
  return (
    <div className="grid grid-cols-2" style={{ gap: 8 }}>
      {ready ? (
        <RequestToSpeak key={room.committee!.id + room.seat!.id} committee={room.committee!} seat={room.seat!} />
      ) : (
        <Btn tone="ghost" icon={<Hand size={16} strokeWidth={1.5} aria-hidden />} disabled title={chatReason ?? undefined} aria-disabled style={SMALL}>Request to speak</Btn>
      )}
      <Btn tone="ghost" icon={<MessagesSquare size={16} strokeWidth={1.5} aria-hidden />} disabled={!ready} title={chatReason ?? undefined} onClick={onChat} style={SMALL} aria-label={room.unread > 0 ? `Chat, ${room.unread} unread` : 'Chat'}>
        <span className="inline-flex items-baseline" style={{ gap: 5 }}>
          Chat
          {room.unread > 0 && <b aria-hidden style={{ color: CK.red, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{room.unread}</b>}
        </span>
      </Btn>
      {!ready && chatReason && <span style={{ ...FULL_ROW, fontSize: 12.5, color: CK.inkSoft }}>{chatReason}</span>}
      {room.status === 'failed' && (
        <span style={FULL_ROW}><Btn tone="ghost" size="sm" onClick={room.retry}>Try again</Btn></span>
      )}
    </div>
  );
}
