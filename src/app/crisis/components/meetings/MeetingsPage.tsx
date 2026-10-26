'use client';
// Gavelling Crisis: meetings. Delegates ask and follow their requests; staff approve, decline and
// mark meetings held; chairs only see (to know who leaves the room). Meetings happen in person.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CalendarCheck, CircleCheck, Hourglass, X } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { cancelMeeting, crisisError, listMeetings, loadWorld } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Meeting } from '@/lib/crisis/types';
import { Btn, Card, CK, Skeleton } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import AskMeeting from './AskMeeting';
import StaffMeetingCard from './StaffMeetingCard';
import { AvatarStack, Fact, NameList, StatusLine, usePeople, whenText, type Person } from './meetingKit';

export default function MeetingsPage() {
  const { ref, role, staff, memberId, characterId, core } = useCrisis();
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [world, setWorld] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const isDelegate = role === 'delegate';

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);

  const load = useCallback(async () => {
    try { setMeetings(await listMeetings(ref)); setError(null); } catch (e) {
      if (!meetings) setError(crisisError(e, 'Could not load the meetings.')); else notifyErr(crisisError(e, 'Could not refresh the meetings.'), 'crisis-meetings-refresh');
    }
  }, [ref, meetings]);

  useEffect(() => {
    let cancelled = false;
    listMeetings(ref).then((r) => { if (!cancelled) setMeetings(r); }).catch((e) => { if (!cancelled) setError(crisisError(e, 'Could not load the meetings.')); });
    if (isDelegate) {
      loadWorld(ref).then((w) => { if (!cancelled) setWorld(w.map((x) => ({ id: x.id, name: x.name, picture_url: x.picture_url, cabinet_id: x.cabinet_id }))); }).catch(() => { /* own cabinet still works */ });
    }
    return () => { cancelled = true; };
  }, [ref, isDelegate]);
  useCrisisLive(ref.id, ['crisis_meetings'], () => { void load(); });

  const people = usePeople(core.characters, world);
  const mine = useMemo(() => (meetings ?? []), [meetings]);

  const cancel = async (m: Meeting) => {
    try { await cancelMeeting(ref, m.id); notifyOk('Meeting cancelled', 'crisis-meeting'); void load(); } catch (e) { notifyErr(crisisError(e, 'Could not cancel the meeting.'), 'crisis-meeting'); }
  };

  if (error && !meetings) return <Card style={{ marginTop: 8 }}><p role="alert" style={{ margin: 0, color: CK.red, fontWeight: 700 }}>{error}</p></Card>;
  if (!meetings) {
    return <div className="flex flex-col" style={{ gap: 12, marginTop: 8 }}><Skeleton h={28} w={220} /><Skeleton h={160} r={22} /><Skeleton h={160} r={22} /></div>;
  }

  const heading = (
    <div style={{ margin: '8px 0 14px' }}>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: CK.ink }}>Meetings</h1>
      <p style={{ margin: '3px 0 0', fontSize: 13.5, color: CK.inkSoft }}>
        {isDelegate ? 'Meetings happen in person. Ask here and the backroom answers.' : staff ? 'Meetings happen in person. Approve or decline requests here.' : 'Who is meeting, so you know who leaves the room.'}
      </p>
    </div>
  );

  if (isDelegate) {
    return (
      <div style={{ paddingBottom: 40 }}>
        {heading}
        <div className="grid items-start" style={{ gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
          <AskMeeting refx={ref} people={people} cabinets={core.cabinets} myCharacterId={characterId} onDone={() => void load()} />
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: CK.ink }}>Your meetings</h2>
            {!mine.length && <Card><p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>You have not asked for a meeting yet.</p></Card>}
            {mine.map((m) => (
              <div key={m.id} style={{ position: 'relative', overflow: 'visible', marginTop: 28, background: CK.card, borderRadius: 22, border: '1px solid rgba(27,56,40,0.14)', boxShadow: CK.shadow, padding: '34px 16px 14px' }}>
                <span style={{ position: 'absolute', zIndex: 2, top: -22, left: 14, lineHeight: 0 }}><AvatarStack ids={m.character_ids.slice(0, 5)} people={people} cabinets={core.cabinets} size={52} /></span>
                <div className="flex items-start justify-between gap-2 flex-wrap" style={{ marginBottom: 6 }}><StatusLine status={m.status} /></div>
                <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}><NameList ids={m.character_ids} people={people} /></p>
                <p style={{ margin: '6px 0 10px', fontSize: 13.5, lineHeight: 1.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{m.intention}</p>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                  <Fact label="Length">{m.duration_minutes} min</Fact>
                  <Fact label="When">{whenText(m)}</Fact>
                </div>
                {m.staff_note && <p style={{ margin: '10px 0 0', fontSize: 13, color: CK.inkSoft }}><b>Note from the backroom: </b>{m.staff_note}</p>}
                {m.requested_by_member === memberId && (m.status === 'pending' || m.status === 'approved') && (
                  <div style={{ marginTop: 12 }}><Btn tone="danger" size="sm" icon={<X size={14} strokeWidth={1.5} aria-hidden />} onClick={() => cancel(m)}>Cancel</Btn></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const lanes: Array<{ key: string; label: string; Icon: typeof Hourglass; color: string; list: Meeting[] }> = [
    { key: 'pending', label: 'Waiting for approval', Icon: Hourglass, color: CK.warn, list: mine.filter((m) => m.status === 'pending') },
    { key: 'approved', label: 'Approved', Icon: CalendarCheck, color: CK.ok, list: mine.filter((m) => m.status === 'approved') },
    { key: 'held', label: 'Held', Icon: CircleCheck, color: CK.forest, list: mine.filter((m) => m.status === 'held') },
    { key: 'closed', label: 'Declined or cancelled', Icon: Ban, color: CK.muted, list: mine.filter((m) => m.status === 'declined' || m.status === 'cancelled') },
  ];

  return (
    <div style={{ paddingBottom: 40 }}>
      {heading}
      <div className="grid items-start" style={{ gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}>
        {lanes.map((l) => (
          <section key={l.key} aria-label={l.label} style={{ minWidth: 0 }}>
            <div className="flex items-baseline gap-2" style={{ color: l.color }}>
              <l.Icon size={17} strokeWidth={1.5} aria-hidden style={{ alignSelf: 'center' }} />
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: CK.ink }}>{l.label}</h2>
              <b style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums', color: l.color }}>{l.list.length}</b>
            </div>
            {!l.list.length && <p style={{ margin: '14px 0 0', fontSize: 13, color: CK.muted }}>Nothing here.</p>}
            {l.list.map((m) => (
              <StaffMeetingCard key={m.id} m={m} refx={ref} people={people} cabinets={core.cabinets} members={core.members} canAct={staff} now={now} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
