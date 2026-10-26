'use client';
// Gavelling Crisis: a delegate asks for a meeting (who, what about, how long, when).

import { useMemo, useState } from 'react';
import { Check, Send } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, requestMeeting, type CrisisRef } from '@/lib/crisis/api';
import type { Cabinet } from '@/lib/crisis/types';
import { Btn, Card, CardTitle, CK, FieldLabel, Segmented, fieldStyle } from '../../crisisKit';
import { DURATIONS, WHEN_NEXT, WHEN_NOW, type Person, AvatarStack } from './meetingKit';

type WhenMode = 'next' | 'now' | 'other';

export default function AskMeeting({ refx, people, cabinets, myCharacterId, onDone }: {
  refx: CrisisRef; people: Map<string, Person>; cabinets: Cabinet[]; myCharacterId: string | null; onDone: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [intention, setIntention] = useState('');
  const [minutes, setMinutes] = useState('10');
  const [mode, setMode] = useState<WhenMode>('next');
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  // Own cabinet first, then the rest by cabinet order.
  const groups = useMemo(() => {
    const mineCab = myCharacterId ? people.get(myCharacterId)?.cabinet_id ?? null : null;
    const all = [...people.values()].filter((p) => p.id !== myCharacterId);
    const order = [...cabinets].sort((a, b) => (a.id === mineCab ? -1 : b.id === mineCab ? 1 : a.sort - b.sort));
    const out = order.map((cab) => ({ cab, list: all.filter((p) => p.cabinet_id === cab.id).sort((a, b) => a.name.localeCompare(b.name)) })).filter((g) => g.list.length);
    const loose = all.filter((p) => !p.cabinet_id || !cabinets.some((c) => c.id === p.cabinet_id));
    return { out, loose };
  }, [people, cabinets, myCharacterId]);

  const toggle = (id: string) => { setHint(null); setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); };

  const send = async () => {
    if (!picked.length) { setHint('Pick at least one other character to meet.'); return; }
    if (!intention.trim()) { setHint('Say what the meeting is about.'); return; }
    const when = mode === 'next' ? WHEN_NEXT : mode === 'now' ? WHEN_NOW : other.trim();
    setBusy(true);
    try {
      const r = await requestMeeting(refx, { character_ids: picked, intention: intention.trim(), duration_minutes: Number(minutes), wanted_time: when || null });
      if (!r.ok) { setHint('Pick at least one other character to meet.'); return; }
      notifyOk(r.status === 'pending' ? 'Meeting asked for' : 'Meeting set', 'crisis-meeting');
      setPicked([]); setIntention(''); setOther(''); setHint(null);
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
      <CardTitle>Ask for a meeting</CardTitle>
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
          <FieldLabel>How long</FieldLabel>
          <GSelect value={minutes} onChange={setMinutes} aria-label="Meeting length" options={DURATIONS.map((d) => ({ value: String(d), label: `${d} minutes` }))} />
        </div>
        <div>
          <FieldLabel>When</FieldLabel>
          <Segmented<WhenMode> ariaLabel="When" value={mode} onChange={setMode} options={[{ value: 'next', label: WHEN_NEXT }, { value: 'now', label: WHEN_NOW }, { value: 'other', label: 'Another time' }]} />
          {mode === 'other' && <input value={other} onChange={(e) => setOther(e.target.value)} maxLength={120} aria-label="When" placeholder="For example: after the break" style={{ ...fieldStyle, marginTop: 8 }} />}
        </div>
      </div>

      <div className="flex items-center flex-wrap" style={{ gap: 12, marginTop: 14 }}>
        <Btn tone="green" icon={<Send size={15} strokeWidth={1.5} aria-hidden />} onClick={send} disabled={busy}>{busy ? 'Sending' : 'Ask for the meeting'}</Btn>
        {hint && <span role="alert" style={{ fontSize: 13, fontWeight: 700, color: CK.red }}>{hint}</span>}
      </div>
    </Card>
  );
}
