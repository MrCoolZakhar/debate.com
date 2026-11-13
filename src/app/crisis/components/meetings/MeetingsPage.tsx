'use client';
// Gavelling Crisis: meetings. A request goes to the invited delegates first (they accept or decline here or in the pop-up);
// once all have answered, or after 5 minutes, it goes to the backroom. Staff approve, decline and mark meetings held;
// chairs only see (to know who leaves the room). Meetings happen in person.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, Hourglass, MailOpen, Users, X, type LucideIcon } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { cancelMeeting, crisisError, listMeetings } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Meeting } from '@/lib/crisis/types';
import { Btn, Card, CK, Skeleton } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import AskMeeting from './AskMeeting';
import MeetingHistory from './MeetingHistory';
import StaffMeetingCard from './StaffMeetingCard';
import { InTheRoom, MeetingClockReadout } from './MeetingClock';
import { meetingInProgress } from '@/lib/crisis/meetings';
import { useClockOverlay } from '@/lib/crisis/meetingClockStore';
import { AnswerList, AvatarStack, Fact, InviteButtons, NameList, StatusLine, requesterName, useMyCharacterId, hasWhen, whenText } from './meetingKit';
import { useMeetingResponses } from './useMeetingResponses';
import { useMeetingPeopleData } from './MeetingRequestsStrip';
import { serverNow } from '@/lib/serverClock';

const isActive = (m: Meeting) => m.status === 'awaiting_delegates' || m.status === 'pending' || m.status === 'approved';

export default function MeetingsPage() {
  const { ref, role, staff, memberId, core } = useCrisis();
  const characterId = useMyCharacterId();
  const [fetched, setFetched] = useState<Meeting[] | null>(null);
  // A copy of the clock fields a press expects stays over the row until the re-read agrees (no snap back).
  const meetings = useClockOverlay(fetched);
  const seq = useRef(0);
  const loaded = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => serverNow());
  const isDelegate = role === 'delegate';
  const { responses, reload: reloadResponses } = useMeetingResponses(ref, true, !!fetched?.some((m) => m.status === 'awaiting_delegates'));

  useEffect(() => { const t = window.setInterval(() => setNow(serverNow()), 30_000); return () => window.clearInterval(t); }, []);

  // Every read is numbered: a slow older answer never overwrites a newer one (that made clocks jump back and forth).
  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const r = await listMeetings(ref);
      if (mine !== seq.current) return;
      loaded.current = true;
      setFetched(r);
      setError(null);
    } catch (e) {
      if (mine !== seq.current) return;
      if (!loaded.current) setError(crisisError(e, 'Could not load the meetings.'));
      else notifyErr(crisisError(e, 'Could not refresh the meetings.'), 'crisis-meetings-refresh');
    }
  }, [ref]);

  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, 0);
    return () => { window.clearTimeout(t); };
  }, [ref, load]);
  useCrisisLive(ref.id, ['crisis_meetings'], () => { void load(); });

  const { people, pickable } = useMeetingPeopleData(ref, true);
  const mine = useMemo(() => (meetings ?? []), [meetings]);
  const active = useMemo(() => mine.filter(isActive), [mine]);
  // Invitations waiting for MY answer: asked by someone else, naming my character, and I have not answered yet.
  const invites = useMemo(() => (isDelegate && characterId && responses
    ? mine.filter((m) => m.status === 'awaiting_delegates' && m.character_ids.includes(characterId) && m.requested_by_character !== characterId
      && !responses.some((r) => r.meeting_id === m.id && r.character_id === characterId))
    : []), [isDelegate, characterId, responses, mine]);
  const answered = () => { void load(); void reloadResponses(); };

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
        {isDelegate ? 'Meetings happen in person. The others you ask answer first, then the backroom.' : staff ? 'Meetings happen in person. Approve or decline requests here.' : 'Who is meeting, so you know who leaves the room.'}
      </p>
    </div>
  );

  if (isDelegate) {
    return (
      <div style={{ paddingBottom: 40, width: '100%', minWidth: 0 }}>
        {heading}
        <div className="grid items-start" style={{ gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))' }}>
          <AskMeeting refx={ref} people={people} pickable={pickable} cabinets={core.cabinets} myCharacterId={characterId} onDone={() => void load()} />
          <div>
            {invites.length > 0 && (
              <section aria-label="Invitations" style={{ marginBottom: 22 }}>
                <div className="flex items-baseline gap-2 flex-wrap" style={{ color: CK.red }}>
                  <MailOpen size={19} strokeWidth={1.5} aria-hidden style={{ alignSelf: 'center' }} />
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: CK.ink }}>Invitations</h2>
                  <b style={{ fontSize: 24, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CK.red }}>{invites.length}</b>
                  <span style={{ fontSize: 13, fontWeight: 700, color: CK.inkSoft }}>waiting for your answer</span>
                </div>
                {invites.map((m) => (
                  <div key={m.id} style={{ position: 'relative', overflow: 'visible', marginTop: 28, background: CK.redWash, borderRadius: 22, border: '1px solid rgba(27,56,40,0.14)', borderTop: `3px solid ${CK.red}`, boxShadow: CK.shadow, padding: '34px 16px 14px' }}>
                    <span style={{ position: 'absolute', zIndex: 2, top: -22, left: 14, lineHeight: 0 }}><AvatarStack ids={[m.requested_by_character, ...m.character_ids].filter((x, i, a): x is string => !!x && a.indexOf(x) === i).slice(0, 5)} people={people} cabinets={core.cabinets} size={52} /></span>
                    <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>
                      {requesterName(m, people, core.members)}<span style={{ fontWeight: 600, color: CK.inkSoft }}> asks to meet </span><NameList ids={m.character_ids} people={people} />
                    </p>
                    <p style={{ margin: '6px 0 10px', fontSize: 13.5, lineHeight: 1.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{m.intention}</p>
                    <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                      <Fact label="Length">{m.duration_minutes} min</Fact>
                      {hasWhen(m) && <Fact label="When">{whenText(m)}</Fact>}
                    </div>
                    <AnswerList m={m} responses={responses} people={people} cabinets={core.cabinets} />
                    <div style={{ marginTop: 12 }}><InviteButtons refx={ref} meetingId={m.id} onAnswered={answered} /></div>
                  </div>
                ))}
              </section>
            )}
            <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: CK.ink }}>Your Meetings</h2>
            {!mine.length && <Card><p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>You have not asked for a meeting yet.</p></Card>}
            {active.filter((m) => !invites.some((i) => i.id === m.id)).map((m) => (
              <div key={m.id} style={{ position: 'relative', overflow: 'visible', marginTop: 28, background: CK.card, borderRadius: 22, border: '1px solid rgba(27,56,40,0.14)', boxShadow: CK.shadow, padding: '34px 16px 14px' }}>
                <span style={{ position: 'absolute', zIndex: 2, top: -22, left: 14, lineHeight: 0 }}><AvatarStack ids={m.character_ids.slice(0, 5)} people={people} cabinets={core.cabinets} size={52} /></span>
                <div className="flex items-start justify-between gap-2 flex-wrap" style={{ marginBottom: 6 }}><StatusLine status={m.status} /></div>
                <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}><NameList ids={m.character_ids} people={people} /></p>
                <p style={{ margin: '6px 0 10px', fontSize: 13.5, lineHeight: 1.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{m.intention}</p>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                  <Fact label="Length">{m.duration_minutes} min</Fact>
                  {hasWhen(m) && <Fact label="When">{whenText(m)}</Fact>}
                </div>
                {m.started_at && (m.status === 'approved' || m.status === 'held') && (
                  <div className="flex flex-col" style={{ gap: 10, marginTop: 12 }}>
                    <MeetingClockReadout m={m} />
                    {meetingInProgress(m) && <InTheRoom m={m} people={people} cabinets={core.cabinets} />}
                  </div>
                )}
                {m.status === 'awaiting_delegates' && <AnswerList m={m} responses={responses} people={people} cabinets={core.cabinets} />}
                {m.staff_note && <p style={{ margin: '10px 0 0', fontSize: 13, color: CK.inkSoft }}><b>Note from the backroom: </b>{m.staff_note}</p>}
                {m.requested_by_member === memberId && isActive(m) && (
                  <div style={{ marginTop: 12 }}><Btn tone="danger" size="sm" icon={<X size={14} strokeWidth={1.5} aria-hidden />} onClick={() => cancel(m)}>Cancel</Btn></div>
                )}
              </div>
            ))}
            <MeetingHistory meetings={mine.filter((m) => !isActive(m))} people={people} now={now} />
          </div>
        </div>
      </div>
    );
  }

  // Staff and chairs: the focus is what needs a yes or no, and what is approved or running (with its clock). Held, declined and
  // cancelled meetings are only a collapsed one-line history underneath.
  const asking = mine.filter((m) => m.status === 'awaiting_delegates').sort((x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime());
  const waiting = mine.filter((m) => m.status === 'pending').sort((x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime());
  const approved = mine.filter((m) => m.status === 'approved').sort((x, y) => Number(meetingInProgress(y)) - Number(meetingInProgress(x)) || new Date(y.decided_at ?? y.created_at).getTime() - new Date(x.decided_at ?? x.created_at).getTime());
  const running = approved.filter(meetingInProgress).length;
  const lanes: Array<{ key: string; label: string; Icon: LucideIcon; color: string; list: Meeting[]; empty: string; extra?: string }> = [
    { key: 'asking', label: 'Asking the Others', Icon: Users, color: CK.inkSoft, list: asking, empty: 'Nobody is being asked.', extra: asking.length > 0 ? 'the others answer first' : undefined },
    { key: 'pending', label: 'Waiting for a Decision', Icon: Hourglass, color: CK.warn, list: waiting, empty: 'No requests are waiting.' },
    { key: 'approved', label: 'Approved and Running', Icon: CalendarCheck, color: CK.ok, list: approved, empty: 'No meetings are approved yet.', extra: running > 0 ? `${running} running now` : undefined },
  ];

  return (
    <div style={{ paddingBottom: 40, width: '100%', minWidth: 0 }}>
      {heading}
      <div className="grid items-start" style={{ gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
        {lanes.map((l) => (
          <section key={l.key} aria-label={l.label} style={{ minWidth: 0 }}>
            <div className="flex items-baseline gap-2 flex-wrap" style={{ color: l.color }}>
              <l.Icon size={19} strokeWidth={1.5} aria-hidden style={{ alignSelf: 'center' }} />
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: CK.ink }}>{l.label}</h2>
              <b style={{ fontSize: 24, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: l.color }}>{l.list.length}</b>
              {l.extra && <span style={{ fontSize: 13, fontWeight: 700, color: CK.inkSoft }}>{l.extra}</span>}
            </div>
            {!l.list.length && <p style={{ margin: '14px 0 0', fontSize: 13.5, color: CK.inkSoft }}>{l.empty}</p>}
            {l.list.map((m) => (
              <StaffMeetingCard key={m.id} m={m} refx={ref} people={people} cabinets={core.cabinets} members={core.members} canAct={staff} canClock={staff || role === 'chair'} onChanged={() => void load()} now={now} responses={responses} />
            ))}
          </section>
        ))}
      </div>
      <MeetingHistory meetings={mine.filter((m) => !isActive(m))} people={people} now={now} noteRef={staff ? ref : undefined} onChanged={() => void load()} />
    </div>
  );
}
