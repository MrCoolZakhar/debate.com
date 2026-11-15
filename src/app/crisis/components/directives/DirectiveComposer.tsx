'use client';
// Gavelling Crisis: the composer pinned at the bottom of the backroom directive pop-up, like a chat
// box. The outcome chips (click again to clear), the text box, and "Send reply" (needs an outcome and
// text; sends it with the staged changes). "Add internal note" lives in the side panel now
// (InternalNote); choosing who is responsible lives at the top (DirectiveFacts). Nothing is written
// before Send reply except the "being written" mark (useDirectiveReply).
// On an answered directive the box writes AGAIN instead (owner, 15 Nov 2026, HULTMUN backroomers): "Send message" adds a
// message the delegate sees and is told about (a visible note, docs/crisis/sql/044), and the answer stays as it was.
// "Edit the answer" is the old "Answer again": it changes the sent answer's words and outcome.

import { useState, type ReactNode } from 'react';
import { Check, Map as MapIcon, Pencil, Send } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { addNote, crisisError } from '@/lib/crisis/api';
import { OUTCOME_LABEL, type Directive, type DirectiveOutcome } from '@/lib/crisis/types';
import { Btn, CK, cabinetTint, fieldStyle } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { OUTCOME_STYLE, isBeingWritten, memberName, buildNames } from './directiveKit';
import { StaffPic } from './directiveParts';
import { MAP_WAITS_NOTE } from './replyToDraft';
import { useNow } from './useNow';
import type { DirectiveReply } from './useDirectiveReply';

const OUTCOMES: DirectiveOutcome[] = ['approved', 'partial', 'denied', 'clarify', 'later'];

export default function DirectiveComposer({ d, reply, who, effectsButton, onNoteAdded }: {
  d: Directive;
  reply: DirectiveReply;
  who: string;
  /** On a narrow screen: the button to the second step. */
  effectsButton?: ReactNode;
  /** A message landed on the directive: re-read its thread. */
  onNoteAdded?: () => void;
}) {
  const { ref, core, memberId } = useCrisis();
  // A message after the answer: its own text, never the answer's.
  const [message, setMessage] = useState('');
  const [messageBusy, setMessageBusy] = useState(false);
  const now = useNow();
  const { outcome, toggleOutcome, reply: text, setReply, saved, editing, startEditing, busy, canSend, send } = reply;
  const answeredView = d.status === 'answered' && !editing;

  const sendMessage = async () => {
    const body = message.trim();
    if (!body || messageBusy) return;
    setMessageBusy(true);
    try {
      await addNote(ref, d.id, body, false);
      setMessage('');
      notifyOk(`Message sent to ${who}`, 'crisis-directive');
      onNoteAdded?.();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not send the message. Your text is kept, try again.'), 'crisis-directive');
    } finally {
      setMessageBusy(false);
    }
  };

  // Someone else is writing the reply to this directive right now.
  const names = buildNames(core.cabinets, core.characters, core.members);
  const other = isBeingWritten(d, now) && d.drafting_member && d.drafting_member !== memberId ? d.drafting_member : null;

  return (
    <div className="flex flex-col" style={{ flex: 'none', gap: 9, padding: '11px 18px 12px 22px', background: CK.card, boxShadow: `0 -1px 0 ${CK.hair}`, borderRadius: '0 0 var(--dp-r) var(--dp-r)' }}>
      {d.status === 'clarify' && d.reply && !editing && (
        <p style={{ margin: 0, fontSize: 12.5, color: CK.inkSoft }}>You asked for more detail. {d.kind === 'committee' ? 'The cabinet’s answer' : 'The delegate’s answer'} comes back into the queue.</p>
      )}
      {other && !answeredView && (
        <p className="flex items-center" style={{ margin: 0, gap: 7, fontSize: 12.5, fontWeight: 700, color: CK.goldDeep }}>
          <StaffPic member={names.members.get(other)} size={20} />
          <Pencil size={13} strokeWidth={1.6} aria-hidden />
          {memberName(other, names)} is writing a reply to this directive
        </p>
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

      {!answeredView && (
        <div style={{ position: 'relative' }}>
          <textarea
            value={text} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={8000}
            aria-label={`Reply to ${who}`} placeholder={`Reply to ${who}`}
            style={{ ...fieldStyle, resize: 'none', background: CK.page, paddingBottom: 28 }}
          />
          {saved && (
            <span className="inline-flex items-center" aria-live="polite" style={{ position: 'absolute', right: 14, bottom: 9, gap: 4, fontSize: 11.5, fontWeight: 700, color: CK.muted }}>
              <Check size={12} strokeWidth={2} aria-hidden />Draft saved
            </span>
          )}
        </div>
      )}

      {!answeredView && reply.mapToDraft && (
        <p className="flex items-start" style={{ margin: 0, gap: 6, fontSize: 12, fontWeight: 600, lineHeight: 1.35, color: CK.inkSoft }}>
          <MapIcon size={13} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none', marginTop: 2 }} />
          <span>{MAP_WAITS_NOTE}</span>
        </p>
      )}

      {answeredView && (
        <textarea
          value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={8000}
          aria-label={`Message ${who}`} placeholder={`Message ${who}. The answer stays as it is`}
          style={{ ...fieldStyle, resize: 'none', background: CK.page }}
        />
      )}

      <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
        <span className="flex-1" />
        {effectsButton}
        {answeredView ? (
          <>
            <Btn tone="ghost" icon={<Pencil size={14} strokeWidth={1.5} />} onClick={startEditing} disabled={messageBusy}>Edit the answer</Btn>
            <Btn tone="green" icon={<Send size={15} strokeWidth={1.5} />} onClick={() => void sendMessage()} disabled={!message.trim() || messageBusy}>{messageBusy ? 'Sending' : 'Send message'}</Btn>
          </>
        ) : <Btn tone="green" icon={<Send size={15} strokeWidth={1.5} />} onClick={send} disabled={!canSend}>{busy ? 'Sending' : 'Send reply'}</Btn>}
      </div>
    </div>
  );
}
