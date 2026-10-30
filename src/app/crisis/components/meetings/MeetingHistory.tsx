'use client';
// Gavelling Crisis: held, declined and cancelled meetings as a compact, collapsible history: one line each (who, when, how
// long, what came of it). They need no detail, so they never get a card.

import { useState } from 'react';
import { Ban, ChevronDown, CircleCheck, ClipboardCheck, History, XCircle } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, decideMeeting, type CrisisRef } from '@/lib/crisis/api';
import type { Meeting, MeetingStatus } from '@/lib/crisis/types';
import { clockText, meetingSeconds } from '@/lib/crisis/meetings';
import { Btn, CK, fieldStyle } from '../../crisisKit';
import { NameList, STATUS_LOOK, type Person } from './meetingKit';

const WORD: Record<MeetingStatus, string> = { pending: 'Waiting', approved: 'Approved', held: 'Held', declined: 'Declined', cancelled: 'Cancelled' };

function stamp(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** What came of it, in a few words: the note that was agreed, the reason for a no, or just the status. */
function outcomeText(m: Meeting): string {
  const note = (m.status === 'held' ? m.outcome_note : m.staff_note)?.trim();
  return note ? `${WORD[m.status]}: ${note}` : WORD[m.status];
}

function lengthText(m: Meeting, now: number): string {
  const secs = m.status === 'held' && m.started_at && m.ended_at ? meetingSeconds(m, now) : null;
  return secs !== null ? `${clockText(secs)} of ${m.duration_minutes} min` : `${m.duration_minutes} min`;
}

export default function MeetingHistory({ meetings, people, now, noteRef, onChanged }: {
  meetings: Meeting[]; people: Map<string, Person>; now: number;
  /** Staff pass the crisis ref: a held meeting then keeps a "What was agreed" field they can still write or change. */
  noteRef?: CrisisRef; onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const saveNote = async (m: Meeting) => {
    if (!noteRef || busy) return;
    setBusy(true);
    try {
      await decideMeeting(noteRef, m.id, 'held', null, text.trim());
      notifyOk('Saved', 'crisis-meeting');
      setEditing(null);
      onChanged?.();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not save what was agreed.'), 'crisis-meeting');
    } finally { setBusy(false); }
  };
  if (meetings.length === 0) return null;
  const sorted = [...meetings].sort((a, b) => new Date(b.ended_at ?? b.decided_at ?? b.updated_at).getTime() - new Date(a.ended_at ?? a.decided_at ?? a.updated_at).getTime());
  const held = meetings.filter((m) => m.status === 'held').length;
  const closed = meetings.length - held;

  return (
    <section aria-label="Meeting history" style={{ marginTop: 22 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
        style={{ gap: 8, border: 0, background: 'transparent', cursor: 'pointer', padding: '4px 2px', fontFamily: CK.font, color: CK.ink }}
      >
        <History size={17} strokeWidth={1.5} aria-hidden style={{ color: CK.inkSoft }} />
        <b style={{ fontSize: 15 }}>History</b>
        <span className="inline-flex items-baseline" style={{ gap: 4 }}><b style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{held}</b><span style={{ fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>held</span></span>
        <span className="inline-flex items-baseline" style={{ gap: 4 }}><b style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{closed}</b><span style={{ fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>declined or cancelled</span></span>
        <ChevronDown size={16} strokeWidth={1.6} aria-hidden style={{ color: CK.inkSoft, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} />
      </button>
      {open && (
        <ul style={{ margin: '6px 0 0', padding: '2px 14px', background: CK.card, borderRadius: 18, boxShadow: CK.shadowSm }}>
          {sorted.map((m, i) => {
            const { color } = STATUS_LOOK[m.status];
            const Icon = m.status === 'held' ? CircleCheck : m.status === 'declined' ? XCircle : Ban;
            return (
              <li
                key={m.id}
                className="flex items-baseline flex-wrap"
                style={{ listStyle: 'none', gap: '2px 12px', padding: '8px 0', borderTop: i === 0 ? 0 : `1px solid ${CK.hair}`, fontSize: 13, color: CK.inkSoft }}
              >
                <Icon size={15} strokeWidth={1.5} aria-hidden style={{ color, alignSelf: 'center', flex: 'none' }} />
                <b style={{ color: CK.ink, flex: '1 1 220px', minWidth: 0, overflowWrap: 'anywhere' }}><NameList ids={m.character_ids} people={people} /></b>
                <span style={{ fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{stamp(m.ended_at ?? m.decided_at ?? m.updated_at)}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', flex: 'none' }}>{lengthText(m, now)}</span>
                <span style={{ color, fontWeight: 700, flex: '1 1 160px', minWidth: 0, overflowWrap: 'anywhere' }}>{outcomeText(m)}</span>
                {noteRef && m.status === 'held' && editing !== m.id && (
                  <button
                    type="button"
                    onClick={() => { setEditing(m.id); setText(m.outcome_note ?? ''); }}
                    className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                    style={{ gap: 5, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 12.5, fontWeight: 800, color: CK.forest, textDecoration: 'underline', flex: 'none' }}
                  >
                    <ClipboardCheck size={14} strokeWidth={1.5} aria-hidden />{m.outcome_note?.trim() ? 'Change what was agreed' : 'Add what was agreed'}
                  </button>
                )}
                {noteRef && m.status === 'held' && editing === m.id && (
                  <div className="flex flex-col" style={{ gap: 8, flexBasis: '100%', marginTop: 4 }}>
                    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={500} style={{ ...fieldStyle, resize: 'vertical' }} aria-label="What was agreed" placeholder="What was agreed (staff only)" />
                    <div className="flex gap-2 flex-wrap">
                      <Btn tone="green" size="sm" icon={<ClipboardCheck size={14} strokeWidth={1.5} aria-hidden />} disabled={busy} onClick={() => saveNote(m)}>{busy ? 'Saving' : 'Save'}</Btn>
                      <Btn tone="ghost" size="sm" disabled={busy} onClick={() => setEditing(null)}>Back</Btn>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
