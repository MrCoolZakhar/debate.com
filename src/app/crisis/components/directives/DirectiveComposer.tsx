'use client';
// Gavelling Crisis: the composer pinned at the bottom of the backroom directive pop-up, like a chat
// box. The outcome chips (click again to clear), the text box, and "Send reply" (needs an outcome and
// text; sends it with the staged changes). "Add internal note" lives in the side panel now
// (InternalNote); choosing who is responsible lives at the top (DirectiveFacts). Nothing is written
// before Send reply except the "being written" mark (useDirectiveReply).

import type { ReactNode } from 'react';
import { Check, Pencil, Send } from 'lucide-react';
import { OUTCOME_LABEL, type Directive, type DirectiveOutcome } from '@/lib/crisis/types';
import { Btn, CK, cabinetTint, fieldStyle } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { OUTCOME_STYLE, isBeingWritten, memberName, buildNames } from './directiveKit';
import { StaffPic } from './directiveParts';
import { useNow } from './useNow';
import type { DirectiveReply } from './useDirectiveReply';

const OUTCOMES: DirectiveOutcome[] = ['approved', 'partial', 'denied', 'clarify', 'later'];

export default function DirectiveComposer({ d, reply, who, effectsButton }: {
  d: Directive;
  reply: DirectiveReply;
  who: string;
  /** On a narrow screen: the button to the second step. */
  effectsButton?: ReactNode;
}) {
  const { core, memberId } = useCrisis();
  const now = useNow();
  const { outcome, toggleOutcome, reply: text, setReply, saved, editing, startEditing, busy, canSend, send } = reply;
  const answeredView = d.status === 'answered' && !editing;

  // Someone else is writing the reply to this directive right now.
  const names = buildNames(core.cabinets, core.characters, core.members);
  const other = isBeingWritten(d, now) && d.drafting_member && d.drafting_member !== memberId ? d.drafting_member : null;

  return (
    <div className="flex flex-col" style={{ flex: 'none', gap: 9, padding: '11px 18px 12px 22px', background: CK.card, boxShadow: `0 -1px 0 ${CK.hair}`, borderRadius: '0 0 var(--dp-r) var(--dp-r)' }}>
      {d.status === 'clarify' && d.reply && !editing && (
        <p style={{ margin: 0, fontSize: 12.5, color: CK.inkSoft }}>You asked for more detail. The delegate’s answer comes back into the queue.</p>
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

      <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
        <span className="flex-1" />
        {effectsButton}
        {answeredView
          ? <Btn tone="green" onClick={startEditing}>Answer again</Btn>
          : <Btn tone="green" icon={<Send size={15} strokeWidth={1.5} />} onClick={send} disabled={!canSend}>{busy ? 'Sending' : 'Send reply'}</Btn>}
      </div>
    </div>
  );
}
