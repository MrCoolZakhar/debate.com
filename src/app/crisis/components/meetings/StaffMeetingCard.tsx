'use client';
// Gavelling Crisis: one meeting on the staff board. Portraits overlap the card's top edge (Live Status style).
// Decline and "Mark as held" open their small form inside the card, never a pop-up.

import { useState } from 'react';
import { Check, ClipboardCheck, X } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, type CrisisRef } from '@/lib/crisis/api';
import type { Cabinet, MeetingStatus, Member } from '@/lib/crisis/types';
import { Btn, CK, fieldStyle, agoLabel } from '../../crisisKit';
import { AnswerList, AvatarStack, Fact, NameList, StatusLine, requesterName, whenText, type MeetingResponse, type MeetingX, type Person } from './meetingKit';
import { decideMeetingChecked, MEETING_ALREADY_DECIDED } from './decide';
import { InTheRoom, MeetingClockControls, MeetingClockReadout } from './MeetingClock';
import { meetingInProgress } from '@/lib/crisis/meetings';

export default function StaffMeetingCard({ m, refx, people, cabinets, members, canAct, canClock = false, onChanged, now, responses }: {
  m: MeetingX; refx: CrisisRef; people: Map<string, Person>; cabinets: Cabinet[]; members: Member[]; canAct: boolean; now: number;
  /** Staff and chairs may start and stop the meeting clock. */
  canClock?: boolean; onChanged?: () => void;
  /** The invitation answers, drawn while the meeting is still asking the others. */
  responses?: MeetingResponse[] | null;
}) {
  const [form, setForm] = useState<null | 'decline' | 'held'>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const tint = cabinets.find((c) => c.id === people.get(m.character_ids[0])?.cabinet_id)?.color ?? CK.red;

  const act = async (status: MeetingStatus, staffNote?: string, outcome?: string, ok?: string) => {
    setBusy(true);
    try {
      const landed = await decideMeetingChecked(refx, m.id, status, staffNote ?? null, outcome ?? null);
      if (landed) notifyOk(ok ?? 'Saved', 'crisis-meeting');
      else notifyErr(MEETING_ALREADY_DECIDED, 'crisis-meeting');
      setForm(null); setNote('');
      onChanged?.();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not save that meeting decision.'), 'crisis-meeting');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'relative', overflow: 'visible', marginTop: 24, background: CK.card, borderRadius: 22, border: '1px solid rgba(27,56,40,0.14)', boxShadow: CK.shadow, padding: '34px 16px 14px', borderTop: `3px solid ${tint}` }}>
      <span style={{ position: 'absolute', zIndex: 2, top: -22, left: 14, lineHeight: 0 }}>
        <AvatarStack ids={m.character_ids.slice(0, 5)} people={people} cabinets={cabinets} size={52} />
      </span>
      <div className="flex items-start justify-between gap-2 flex-wrap" style={{ marginBottom: 8 }}>
        <StatusLine status={m.status} />
        <span style={{ fontSize: 12, color: CK.muted, fontWeight: 600 }}>Asked {agoLabel(m.created_at, now)}</span>
      </div>
      <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}><NameList ids={m.character_ids} people={people} /></p>
      <p style={{ margin: '6px 0 10px', fontSize: 13.5, lineHeight: 1.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{m.intention}</p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        <Fact label="Length">{m.duration_minutes} min</Fact>
        <Fact label="When">{whenText(m)}</Fact>
        <Fact label="Asked by">{requesterName(m, people, members)}</Fact>
      </div>
      {m.status === 'awaiting_delegates' && responses !== undefined && <AnswerList m={m} responses={responses} people={people} cabinets={cabinets} />}
      {m.started_at && (m.status === 'approved' || m.status === 'held') && (
        <div className="flex flex-col" style={{ gap: 10, marginTop: 12 }}>
          <MeetingClockReadout m={m} />
          {meetingInProgress(m) && <InTheRoom m={m} people={people} cabinets={cabinets} />}
        </div>
      )}
      {canClock && m.status === 'approved' && <div style={{ marginTop: 12 }}><MeetingClockControls m={m} refx={refx} onChanged={onChanged} /></div>}
      {m.staff_note && <p style={{ margin: '10px 0 0', fontSize: 13, color: CK.inkSoft }}><b>Note to the delegates: </b>{m.staff_note}</p>}
      {m.outcome_note && <p style={{ margin: '8px 0 0', fontSize: 13, color: CK.inkSoft }}><b>What was agreed: </b>{m.outcome_note}</p>}

      {canAct && (m.status === 'awaiting_delegates' || m.status === 'pending' || m.status === 'approved') && (
        <div style={{ marginTop: 12 }}>
          {form ? (
            <div className="flex flex-col" style={{ gap: 8 }}>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} style={{ ...fieldStyle, resize: 'vertical' }}
                aria-label={form === 'decline' ? 'Note to the delegates' : 'What was agreed'}
                placeholder={form === 'decline' ? 'Note to the delegates (optional)' : 'What was agreed (staff only)'} />
              <div className="flex gap-2 flex-wrap">
                {form === 'decline'
                  ? <Btn tone="red" size="sm" icon={<X size={14} strokeWidth={1.5} aria-hidden />} disabled={busy} onClick={() => act(m.status === 'approved' ? 'cancelled' : 'declined', note, undefined, m.status === 'approved' ? 'Meeting cancelled' : 'Meeting declined')}>{m.status === 'approved' ? 'Cancel meeting' : 'Decline meeting'}</Btn>
                  : <Btn tone="green" size="sm" icon={<ClipboardCheck size={14} strokeWidth={1.5} aria-hidden />} disabled={busy} onClick={() => act('held', undefined, note, 'Marked as held')}>Save as held</Btn>}
                <Btn tone="ghost" size="sm" onClick={() => { setForm(null); setNote(''); }}>Back</Btn>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {(m.status === 'pending' || m.status === 'awaiting_delegates') && <Btn tone="green" size="sm" icon={<Check size={14} strokeWidth={1.5} aria-hidden />} disabled={busy} onClick={() => act('approved', undefined, undefined, 'Meeting approved')}>{m.status === 'awaiting_delegates' ? 'Approve now' : 'Approve'}</Btn>}
              {m.status === 'approved' && <Btn tone="green" size="sm" icon={<ClipboardCheck size={14} strokeWidth={1.5} aria-hidden />} onClick={() => setForm('held')}>Mark as held</Btn>}
              <Btn tone="danger" size="sm" icon={<X size={14} strokeWidth={1.5} aria-hidden />} onClick={() => setForm('decline')}>{m.status === 'approved' ? 'Cancel meeting' : 'Decline'}</Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
