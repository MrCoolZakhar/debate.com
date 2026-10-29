'use client';
// Gavelling Crisis: the composer pinned at the bottom of the backroom directive pop-up, like a chat
// box. The outcome chips (click again to clear), the text box, and two actions: "Add internal note"
// (the text becomes a note only staff see; the outcome is ignored) and "Send reply" (needs an outcome
// and text; sends it with the staged changes). Choosing who is responsible lives at the top of the
// pop-up (DirectiveFacts). Only an internal note is written before Send reply.

import { useState, type ReactNode } from 'react';
import { Check, Lock, Send } from 'lucide-react';
import { notifyErr } from '@/lib/appNotify';
import { addNote, crisisError, type CrisisRef } from '@/lib/crisis/api';
import { OUTCOME_LABEL, type Directive, type DirectiveOutcome } from '@/lib/crisis/types';
import { Btn, CK, cabinetTint, fieldStyle } from '../../crisisKit';
import { OUTCOME_STYLE } from './directiveKit';
import type { DirectiveReply } from './useDirectiveReply';

const OUTCOMES: DirectiveOutcome[] = ['approved', 'partial', 'denied', 'clarify', 'later'];

export default function DirectiveComposer({ crisisRef, d, reply, who, onNoteAdded, effectsButton }: {
  crisisRef: CrisisRef;
  d: Directive;
  reply: DirectiveReply;
  who: string;
  /** The note landed: re-read the thread. */
  onNoteAdded: () => void | Promise<void>;
  /** On a narrow screen: the button to the second step. */
  effectsButton?: ReactNode;
}) {
  const { outcome, toggleOutcome, reply: text, setReply, saved, editing, startEditing, busy, canSend, send } = reply;
  const [working, setWorking] = useState<'note' | null>(null);
  // An answered directive has no reply being written: its box is only for internal notes.
  const [noteOnly, setNoteOnly] = useState('');

  const answeredView = d.status === 'answered' && !editing;
  const value = answeredView ? noteOnly : text;
  const setValue = answeredView ? setNoteOnly : setReply;

  // The text box becomes an internal note; the outcome is left as it is.
  const addInternal = async () => {
    const body = value.trim();
    if (!body || working) return;
    setWorking('note');
    try { await addNote(crisisRef, d.id, body, true); setValue(''); await onNoteAdded(); }
    catch (e) { notifyErr(crisisError(e, 'Could not add the note. Your text is kept, try again.'), 'crisis-directive'); }
    finally { setWorking(null); }
  };

  return (
    <div className="flex flex-col" style={{ flex: 'none', gap: 9, padding: '11px 18px 12px 22px', background: CK.card, boxShadow: `0 -1px 0 ${CK.hair}`, borderRadius: '0 0 var(--dp-r) var(--dp-r)' }}>
      {d.status === 'clarify' && d.reply && !editing && (
        <p style={{ margin: 0, fontSize: 12.5, color: CK.inkSoft }}>You asked for more detail. The delegate’s answer comes back into the queue.</p>
      )}

      {!answeredView && (
        <div className="flex flex-wrap" role="group" aria-label="Answer status" style={{ gap: 6 }}>
          {OUTCOMES.map((o) => {
            const on = outcome === o;
            const st = OUTCOME_STYLE[o];
            return (
              <button key={o} type="button" aria-pressed={on} onClick={() => toggleOutcome(o)} title={on ? 'Click again to clear' : undefined}
                className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.97] transition-transform"
                style={{ border: 0, borderRadius: 999, padding: '5px 12px 5px 9px', gap: 6, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: CK.font,
                  background: on ? st.color : cabinetTint(st.color, 0.07), color: on ? '#fff' : st.color,
                  boxShadow: on ? CK.shadowSm : `inset 0 0 0 1px ${cabinetTint(st.color, 0.24)}` }}>
                <st.Icon size={16} strokeWidth={1.6} aria-hidden />
                <span>{OUTCOME_LABEL[o]}</span>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <textarea
          value={value} onChange={(e) => setValue(e.target.value)} rows={answeredView ? 2 : 3} maxLength={8000}
          aria-label={answeredView ? 'Internal note' : `Reply to ${who}`}
          placeholder={answeredView ? 'Add an internal note, only staff see it' : `Reply to ${who}, or write a note only staff see`}
          style={{ ...fieldStyle, resize: 'none', background: CK.page, paddingBottom: 28 }}
        />
        {saved && !answeredView && (
          <span className="inline-flex items-center" aria-live="polite" style={{ position: 'absolute', right: 14, bottom: 9, gap: 4, fontSize: 11.5, fontWeight: 700, color: CK.muted }}>
            <Check size={12} strokeWidth={2} aria-hidden />Draft saved
          </span>
        )}
      </div>

      <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
        <span className="flex-1" />
        {effectsButton}
        <Btn tone="ghost" icon={<Lock size={14} strokeWidth={1.5} />} onClick={addInternal} disabled={!value.trim() || !!working}
          title="Only staff see an internal note. The answer status is not used.">Add internal note</Btn>
        {answeredView
          ? <Btn tone="green" onClick={startEditing}>Answer again</Btn>
          : <Btn tone="green" icon={<Send size={15} strokeWidth={1.5} />} onClick={send} disabled={!canSend}>{busy ? 'Sending' : 'Send reply'}</Btn>}
      </div>
    </div>
  );
}
