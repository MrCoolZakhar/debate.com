'use client';
// Gavelling Crisis: the chair's answer to "More detail needed" on a CABINET directive of their own cabinet. The backroom's question is shown
// first and big, under the earlier messages of the conversation, and the chair writes the cabinet's answer in a box below it (Send to the
// backroom). The answer goes in as a note (addNote); the database puts the directive back in the backroom's queue and tells the backroomer.
// The notes are read through RLS (the chair may read the notes of their own cabinet's cabinet directives). Used inside ChairDirectiveCard.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleHelp, Send } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { addNote, crisisError, listNotes, type CrisisRef } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Directive, DirectiveNote } from '@/lib/crisis/types';
import { Btn, CK, cabinetTint, fieldStyle } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { DirectiveBody } from '../directives/attachedImage';
import { whenLabel, whenTitle } from '../delegate/directiveUi';

const BLUE = '#3E6A9A';

export default function ChairClarify({ d, cref, onSent }: { d: Directive; cref: CrisisRef; onSent: () => void }) {
  const { core, memberId } = useCrisis();
  const [notes, setNotes] = useState<DirectiveNote[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const n = await listNotes(cref, d.id);
      if (mine === seq.current) setNotes(n.filter((x) => !x.internal));
    } catch { /* the question itself is on the directive; a failed read only leaves the earlier messages out */
      if (mine === seq.current) setNotes((old) => old ?? []);
    }
  }, [cref, d.id]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useCrisisLive(cref.id, ['crisis_directive_notes'], () => { void load(); });

  const askedAt = d.answered_at ? new Date(d.answered_at).getTime() : null;
  const nameOf = (n: DirectiveNote): string => {
    if (n.member_id && n.member_id === memberId) return 'You';
    const m = n.member_id ? core.members.find((x) => x.id === n.member_id) : undefined;
    if (!m) return 'Backroom';
    if (m.role === 'chair') return 'Chair';
    if (m.role === 'delegate') return m.display_name;
    return 'Backroom';
  };
  // Earlier messages (before the backroom's question), oldest first.
  const earlier = useMemo(
    () => (notes ?? []).filter((n) => askedAt === null || new Date(n.created_at).getTime() <= askedAt),
    [notes, askedAt],
  );
  const asker = d.answered_by ? core.members.find((m) => m.id === d.answered_by)?.display_name ?? null : null;
  const question = (d.reply ?? '').trim();

  const send = async () => {
    const body = text.trim();
    if (!body || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await addNote(cref, d.id, body);
      notifyOk('Sent to the backroom', 'crisis-chair');
      setText('');
      onSent();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not send your answer. Your text is kept, try again.'), 'crisis-chair');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="cm-fade" style={{ marginTop: 12 }}>
      {earlier.length > 0 && (
        <div aria-label="Earlier messages" className="grid" style={{ gap: 6, maxHeight: 'min(18dvh, 150px)', overflowY: 'auto', marginBottom: 8 }}>
          {earlier.map((n) => (
            <div key={n.id} style={{ background: CK.card, borderRadius: 12, padding: '6px 10px', boxShadow: CK.shadowSm }}>
              <p style={{ margin: 0, fontSize: 11.5, fontWeight: 800, color: nameOf(n) !== 'Backroom' ? CK.forest : CK.red, overflowWrap: 'anywhere' }}>
                {nameOf(n)}<span title={whenTitle(n.created_at) ?? undefined} style={{ marginLeft: 6, fontWeight: 600, color: CK.muted }}>{whenLabel(n.created_at)}</span>
              </p>
              <DirectiveBody body={n.body} thumb={220} style={{ margin: '2px 0 0', fontSize: 13, lineHeight: 1.5, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} />
            </div>
          ))}
        </div>
      )}
      <div style={{ background: cabinetTint(BLUE, 0.1), borderRadius: 14, padding: '10px 12px', boxShadow: `inset 0 0 0 1.5px ${cabinetTint(BLUE, 0.45)}` }}>
        <p className="flex items-center flex-wrap" style={{ margin: 0, gap: 6, fontSize: 13, fontWeight: 800, color: BLUE }}>
          <CircleHelp size={16} strokeWidth={1.6} aria-hidden />
          The backroom needs more detail{asker ? ` (${asker})` : ''}
          {d.answered_at && <span title={whenTitle(d.answered_at) ?? undefined} style={{ fontWeight: 600, color: CK.muted }}>{whenLabel(d.answered_at)}</span>}
        </p>
        {question ? (
          <DirectiveBody body={question} thumb={320} style={{ margin: '6px 0 0', fontSize: 15, lineHeight: 1.55, fontWeight: 600, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} />
        ) : (
          <p style={{ margin: '6px 0 0', fontSize: 14, color: CK.inkSoft }}>The backroom did not write a question. Answer with what you think they need to know.</p>
        )}
      </div>
      <label htmlFor={`chair-clarify-${d.id}`} style={{ display: 'block', margin: '12px 0 5px', fontSize: 13, fontWeight: 700, color: CK.ink }}>Your answer to the backroom</label>
      <textarea
        id={`chair-clarify-${d.id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }}
        rows={4}
        placeholder="Add the detail the backroom asked for"
        style={{ ...fieldStyle, fontSize: 15, padding: '10px 14px', minHeight: 100, resize: 'vertical' }}
      />
      <div className="flex flex-wrap" style={{ gap: 8, marginTop: 10 }}>
        <Btn tone="green" icon={<Send size={16} strokeWidth={1.5} aria-hidden />} disabled={!text.trim() || busy} onClick={() => { void send(); }}>
          {busy ? 'Sending' : 'Send to the backroom'}
        </Btn>
      </div>
    </div>
  );
}
