'use client';
// Gavelling Crisis: meeting requests waiting for a yes or no, as a compact strip that can be mounted anywhere (Command's
// Needs Attention, the backroom's Directives page, the front room). It loads the pending requests itself (listMeetings, kept
// fresh by the live ping on crisis_meetings), draws one compact row per request (who asks, with whom, why, how long, when)
// with Approve and Decline, and draws NOTHING when none are pending. Approving is a plain yes or no; declining opens a small
// optional note inside the row, never a pop-up.
//
// Who may decide: staff (director, assistant director, organiser, backroomer) decide any request. A CHAIR may approve or decline
// a request that involves a character of the chair's own cabinet (crisis_decide_meeting allows role 'chair' for approved and
// declined only in that case); every other request is shown to the chair read only, with one line saying a backroomer decides.
// A delegate or press member sees nothing.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Hourglass, X } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, decideMeeting, listMeetings, loadWorld, type CrisisRef } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Cabinet, Meeting, Member } from '@/lib/crisis/types';
import { Btn, CK, fieldStyle, agoLabel } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { CharacterName } from '../character/CharacterProfileHost';
import { AvatarStack, NameList, requesterName, usePeople, whenText, type Person } from './meetingKit';
import { serverNow } from '@/lib/serverClock';

/** The pending requests (newest asked last, so the longest wait is first), live. null while the first read runs. */
export function usePendingMeetings(ref: CrisisRef, enabled: boolean): { pending: Meeting[] | null; reload: () => Promise<void> } {
  const [pending, setPending] = useState<Meeting[] | null>(null);
  const reload = useCallback(async () => {
    if (!enabled) return;
    try {
      const all = await listMeetings(ref);
      setPending(all.filter((m) => m.status === 'pending').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    } catch {
      // A failed re-read keeps what is on screen; the next ping or poll tries again.
    }
  }, [ref, enabled]);
  useEffect(() => {
    const t = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(t);
  }, [reload]);
  useCrisisLive(enabled ? ref.id : null, ['crisis_meetings'], () => { void reload(); });
  return { pending, reload };
}

/** Everyone a request can name. Staff already have every character; a chair reads the world list once. */
export function useMeetingPeople(ref: CrisisRef, enabled: boolean): Map<string, Person> {
  const { core, staff } = useCrisis();
  const [world, setWorld] = useState<Person[]>([]);
  useEffect(() => {
    if (!enabled || staff) return;
    let cancelled = false;
    loadWorld(ref).then((w) => { if (!cancelled) setWorld(w.map((x) => ({ id: x.id, name: x.name, picture_url: x.picture_url, cabinet_id: x.cabinet_id }))); }).catch(() => { /* names fall back to Unknown */ });
    return () => { cancelled = true; };
  }, [ref, enabled, staff]);
  return usePeople(core.characters, world);
}

function Row({ m, refx, people, cabinets, members, canDecide, compact, now, onDecided }: {
  m: Meeting; refx: CrisisRef; people: Map<string, Person>; cabinets: Cabinet[]; members: Member[]; canDecide: boolean; compact: boolean; now: number; onDecided: () => void;
}) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (status: 'approved' | 'declined') => {
    if (busy) return;
    setBusy(true);
    try {
      await decideMeeting(refx, m.id, status, status === 'declined' ? note : null, null);
      notifyOk(status === 'approved' ? 'Meeting approved' : 'Meeting declined', 'crisis-meeting');
      setDeclining(false); setNote('');
      onDecided();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not save that meeting decision.'), 'crisis-meeting');
    } finally { setBusy(false); }
  };

  const who = requesterName(m, people, members);
  return (
    <li style={{ listStyle: 'none', padding: compact ? '8px 0' : '10px 0', borderTop: `1px solid ${CK.hair}` }}>
      <div className="flex items-start" style={{ gap: 10 }}>
        <span style={{ flex: 'none', lineHeight: 0, paddingTop: 2 }}>
          <AvatarStack ids={m.character_ids.slice(0, 3)} people={people} cabinets={cabinets} size={compact ? 26 : 32} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: compact ? 13 : 13.5, fontWeight: 800, color: CK.ink, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
            {m.requested_by_character ? <CharacterName id={m.requested_by_character} name={who} /> : who}<span style={{ fontWeight: 600, color: CK.inkSoft }}> asks to meet </span><NameList ids={m.character_ids} people={people} />
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: CK.inkSoft, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{m.intention}</p>
          <p style={{ margin: '3px 0 0', fontSize: 12, fontWeight: 700, color: CK.muted, fontVariantNumeric: 'tabular-nums' }}>
            {m.duration_minutes} min · {whenText(m)} · asked {agoLabel(m.created_at, now)}
          </p>
        </div>
        {canDecide && !declining && (
          <div className="flex" style={{ gap: 6, flex: 'none', paddingTop: 1 }}>
            <Btn size="sm" tone="green" icon={<Check size={13} strokeWidth={1.6} aria-hidden />} disabled={busy} onClick={() => decide('approved')}>Approve</Btn>
            <Btn size="sm" tone="danger" icon={<X size={13} strokeWidth={1.6} aria-hidden />} disabled={busy} onClick={() => setDeclining(true)}>Decline</Btn>
          </div>
        )}
      </div>
      {canDecide && declining && (
        <div className="flex items-center flex-wrap" style={{ gap: 8, marginTop: 8 }}>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            placeholder="Note to the delegates (optional)"
            aria-label="Note to the delegates"
            autoFocus
            style={{ ...fieldStyle, flex: '1 1 180px', minWidth: 0, padding: '6px 10px', fontSize: 13, borderRadius: 10 }}
          />
          <Btn size="sm" tone="red" disabled={busy} onClick={() => decide('declined')}>Decline meeting</Btn>
          <Btn size="sm" tone="ghost" onClick={() => { setDeclining(false); setNote(''); }}>Back</Btn>
        </div>
      )}
    </li>
  );
}

/** May this viewer approve or decline this request? Staff always; a chair when it involves a character of their own cabinet. */
export function useCanDecideMeeting(): (m: Meeting) => boolean {
  const { staff, role, cabinetId, core } = useCrisis();
  return useCallback((m: Meeting) => {
    if (staff) return true;
    if (role !== 'chair' || !cabinetId) return false;
    const ids = [...m.character_ids, ...(m.requested_by_character ? [m.requested_by_character] : [])];
    return ids.some((id) => core.characters.find((c) => c.id === id)?.cabinet_id === cabinetId);
  }, [staff, role, cabinetId, core.characters]);
}

/** The rows only (no frame, no title), for a card that already has its own heading. Nothing when empty. */
export function MeetingRequestRows({ pending, compact = true, now, onDecided }: { pending: Meeting[]; compact?: boolean; now: number; onDecided: () => void }) {
  const { ref, core } = useCrisis();
  const people = useMeetingPeople(ref, true);
  const canDecide = useCanDecideMeeting();
  if (pending.length === 0) return null;
  return (
    <ul style={{ margin: 0, padding: 0 }}>
      {pending.map((m) => (
        <Row key={m.id} m={m} refx={ref} people={people} cabinets={core.cabinets} members={core.members} canDecide={canDecide(m)} compact={compact} now={now} onDecided={onDecided} />
      ))}
    </ul>
  );
}

/** Self-contained: loads, stays live, draws nothing when no request waits (and nothing for delegates and press). */
export default function MeetingRequestsStrip({ compact = false, bottomGap = 0 }: { compact?: boolean; bottomGap?: number }) {
  const { ref, role, staff } = useCrisis();
  const canDecide = useCanDecideMeeting();
  const mayLook = staff || role === 'chair';
  const { pending, reload } = usePendingMeetings(ref, mayLook);
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => { const t = window.setInterval(() => setNow(serverNow()), 30_000); return () => window.clearInterval(t); }, []);
  const list = useMemo(() => pending ?? [], [pending]);
  if (!mayLook || list.length === 0) return null;

  return (
    <section
      aria-label="Meeting requests"
      style={{ background: CK.redWash, borderRadius: compact ? 16 : 20, boxShadow: CK.shadowSm, padding: compact ? '8px 12px 4px' : '10px 16px 6px', minWidth: 0, fontFamily: CK.font, marginBottom: bottomGap }}
    >
      <div className="flex items-center justify-between" style={{ gap: 8, paddingBottom: 6 }}>
        <h2 className="flex items-center" style={{ gap: 7, margin: 0, fontSize: compact ? 14 : 15, fontWeight: 800, color: CK.ink }}>
          <span style={{ color: CK.red, lineHeight: 0 }}><Hourglass size={compact ? 15 : 17} strokeWidth={1.5} aria-hidden /></span>
          Meeting Requests
        </h2>
        <span className="inline-flex items-baseline" style={{ gap: 5 }}>
          <b style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CK.ink }}>{list.length}</b>
          <span style={{ fontSize: 12, fontWeight: 600, color: CK.inkSoft }}>waiting</span>
        </span>
      </div>
      <MeetingRequestRows pending={list} compact={compact} now={now} onDecided={() => { void reload(); }} />
      {list.some((m) => !canDecide(m)) && <p style={{ margin: '0 0 8px', fontSize: 12.5, color: CK.inkSoft }}>{list.every((m) => !canDecide(m)) ? 'A backroomer decides these.' : 'A backroomer decides the others.'}</p>}
    </section>
  );
}
