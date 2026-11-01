'use client';
// Gavelling Crisis: a delegate asks for a meeting (who, what about, how long, when).

import { useMemo, useState } from 'react';
import { Check, Minus, Plus, Send } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, requestMeeting, type CrisisRef } from '@/lib/crisis/api';
import type { Cabinet } from '@/lib/crisis/types';
import { Btn, Card, CardTitle, CK, FieldLabel, fieldStyle } from '../../crisisKit';
import { MEETING_DEFAULT, MEETING_MAX, MEETING_MIN, type Person, AvatarStack } from './meetingKit';

const clampMinutes = (n: number) => Math.min(MEETING_MAX, Math.max(MEETING_MIN, Math.round(n)));

export default function AskMeeting({ refx, people, cabinets, myCharacterId, onDone }: {
  refx: CrisisRef; people: Map<string, Person>; cabinets: Cabinet[]; myCharacterId: string | null; onDone: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [intention, setIntention] = useState('');
  // Typed as text so it can be cleared while editing; read as a whole number of minutes when sent.
  const [minutes, setMinutes] = useState(String(MEETING_DEFAULT));
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [sentNote, setSentNote] = useState<string | null>(null);

  // Own cabinet first, then the rest by cabinet order.
  const groups = useMemo(() => {
    const mineCab = myCharacterId ? people.get(myCharacterId)?.cabinet_id ?? null : null;
    // Nobody can meet a spare (nobody plays it) or a dead character.
    const all = [...people.values()].filter((p) => p.id !== myCharacterId && p.status !== 'spare' && p.status !== 'dead');
    const order = [...cabinets].sort((a, b) => (a.id === mineCab ? -1 : b.id === mineCab ? 1 : a.sort - b.sort));
    const out = order.map((cab) => ({ cab, list: all.filter((p) => p.cabinet_id === cab.id).sort((a, b) => a.name.localeCompare(b.name)) })).filter((g) => g.list.length);
    const loose = all.filter((p) => !p.cabinet_id || !cabinets.some((c) => c.id === p.cabinet_id));
    return { out, loose };
  }, [people, cabinets, myCharacterId]);

  const toggle = (id: string) => { setHint(null); setSentNote(null); setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); };

  const send = async () => {
    if (!picked.length) { setHint('Pick at least one other character to meet.'); return; }
    if (!intention.trim()) { setHint('Say what the meeting is about.'); return; }
    const length = clampMinutes(Number(minutes) || MEETING_DEFAULT);
    setBusy(true);
    try {
      const r = await requestMeeting(refx, { character_ids: picked, intention: intention.trim(), duration_minutes: length });
      if (!r.ok) { setHint('Pick at least one other character to meet.'); return; }
      notifyOk(r.status === 'awaiting_delegates' || r.status === 'pending' ? 'Meeting asked for' : 'Meeting set', 'crisis-meeting');
      setPicked([]); setIntention(''); setMinutes(String(MEETING_DEFAULT)); setHint(null);
      setSentNote(r.status === 'awaiting_delegates' ? 'Sent to the others first. It goes to the crisis team once they answer, or in 5 minutes.' : null);
      onDone();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not ask for the meeting. Try again.'), 'crisis-meeting');
    } finally { setBusy(false); }
  };

  const Chip = ({ p }: { p: Person }) => {
    const on = picked.includes(p.id);
    return (
      <button type="button" onClick={() => toggle(p.id)} aria-pressed={on}
        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
        style={{ gap: 8, border: 0, cursor: 'pointer', borderRadius: 14, padding: '5px 12px 5px 6px', fontFamily: CK.font, textAlign: 'left',
          background: on ? 'rgba(61,122,82,0.12)' : CK.card, boxShadow: on ? `inset 0 0 0 2px ${CK.ok}` : `inset 0 0 0 1px ${CK.hair}` }}>
        <AvatarStack ids={[p.id]} people={people} cabinets={cabinets} size={32} />
        <span style={{ fontSize: 13, fontWeight: 700, color: CK.ink, overflowWrap: 'anywhere' }}>{p.name}</span>
        {on && <Check size={15} strokeWidth={2} aria-hidden style={{ color: CK.ok, flex: 'none' }} />}
      </button>
    );
  };

  return (
    <Card warm>
      <CardTitle>Ask for a Meeting</CardTitle>
      <FieldLabel>Who do you want to meet</FieldLabel>
      <div className="flex flex-col" style={{ gap: 12, marginBottom: 14 }}>
        {groups.out.map((g) => (
          <div key={g.cab.id}>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: g.cab.color }}>{g.cab.name}</p>
            <div className="flex flex-wrap" style={{ gap: 8 }}>{g.list.map((p) => <Chip key={p.id} p={p} />)}</div>
          </div>
        ))}
        {groups.loose.length > 0 && <div className="flex flex-wrap" style={{ gap: 8 }}>{groups.loose.map((p) => <Chip key={p.id} p={p} />)}</div>}
        {!groups.out.length && !groups.loose.length && <p style={{ margin: 0, fontSize: 13, color: CK.inkSoft }}>There is nobody else to meet yet.</p>}
      </div>

      <div className="grid" style={{ gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <FieldLabel htmlFor="mt-intent">What is it about</FieldLabel>
          <textarea id="mt-intent" value={intention} onChange={(e) => { setIntention(e.target.value); setHint(null); }} rows={3} maxLength={500} style={{ ...fieldStyle, resize: 'vertical' }} placeholder="For example: agree a joint line before the vote" />
        </div>
        <div>
          <FieldLabel htmlFor="mt-minutes">How long, in minutes</FieldLabel>
          <div className="flex items-center" style={{ gap: 8 }}>
            <button type="button" aria-label="One minute less" onClick={() => setMinutes(String(clampMinutes((Number(minutes) || MEETING_DEFAULT) - 1)))}
              className="inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{ width: 44, height: 44, flex: 'none', border: 0, cursor: 'pointer', borderRadius: 12, background: CK.card, color: CK.ink, boxShadow: `inset 0 0 0 1px ${CK.hair}` }}>
              <Minus size={18} strokeWidth={1.5} aria-hidden />
            </button>
            <input id="mt-minutes" type="number" inputMode="numeric" min={MEETING_MIN} max={MEETING_MAX} step={1} value={minutes}
              onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
              onBlur={() => setMinutes(String(clampMinutes(Number(minutes) || MEETING_DEFAULT)))}
              style={{ ...fieldStyle, width: 96, height: 44, flex: 'none', textAlign: 'center', fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }} />
            <button type="button" aria-label="One minute more" onClick={() => setMinutes(String(clampMinutes((Number(minutes) || MEETING_DEFAULT) + 1)))}
              className="inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{ width: 44, height: 44, flex: 'none', border: 0, cursor: 'pointer', borderRadius: 12, background: CK.card, color: CK.ink, boxShadow: `inset 0 0 0 1px ${CK.hair}` }}>
              <Plus size={18} strokeWidth={1.5} aria-hidden />
            </button>
            <span style={{ fontSize: 15, fontWeight: 700, color: CK.inkSoft }}>minutes</span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: CK.inkSoft }}>From {MEETING_MIN} to {MEETING_MAX} minutes.</p>
        </div>
      </div>

      <div className="flex items-center flex-wrap" style={{ gap: 12, marginTop: 14 }}>
        <Btn tone="green" icon={<Send size={15} strokeWidth={1.5} aria-hidden />} onClick={send} disabled={busy}>{busy ? 'Sending' : 'Ask for the meeting'}</Btn>
        {sentNote && <span role="status" style={{ fontSize: 13, fontWeight: 700, color: CK.ok, overflowWrap: 'anywhere' }}>{sentNote}</span>}
        {hint && <span role="alert" style={{ fontSize: 13, fontWeight: 700, color: CK.red }}>{hint}</span>}
      </div>
    </Card>
  );
}
