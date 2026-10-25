'use client';
// Gavelling Crisis: one directive, opened. A red gradient header band (number, kind icon, title), the
// outcome as a big coloured statement, "What you asked" in a soft card, "The backroom's reply" in its own
// card with a red left accent, then the conversation as chat bubbles (theirs left, yours right) with the
// reply box when the backroom asked for more detail.

import { useState } from 'react';
import { MessageSquareReply, Send } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { addNote, crisisError, type CrisisRef } from '@/lib/crisis/api';
import { OUTCOME_LABEL, type Directive, type DirectiveNote } from '@/lib/crisis/types';
import { Btn, cabinetTint, CK, fieldStyle, ThemeTag } from '../../crisisKit';
import CrisisDialog from './CrisisDialog';
import type { PersonRef } from './MyDirectives';
import { KIND_WORD, kindIcon, outcomeColor, outcomeIcon, statusColor, statusIcon, STATUS_WORDS, whenLabel } from './directiveUi';

function Soft({ title, children, accent, warm }: { title: string; children: React.ReactNode; accent?: string; warm?: boolean }) {
  return (
    <section style={{ background: warm ? CK.redWash : CK.card, borderRadius: 18, boxShadow: accent ? `${CK.shadowSm}, inset 5px 0 0 ${accent}` : CK.shadowSm, padding: accent ? '13px 16px 14px 20px' : '13px 16px 14px' }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 800, color: CK.red }}>{title}</h3>
      {children}
    </section>
  );
}

export default function DirectiveDialog({
  cref, d, notes, withNames, myMemberId, author, isAuthor, answeredBy, onChanged, onClose,
}: {
  cref: CrisisRef; d: Directive; notes: DirectiveNote[]; withNames: string[]; myMemberId: string | null;
  author: PersonRef; isAuthor: boolean; answeredBy: string | null; onChanged: () => void; onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const answer = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await addNote(cref, d.id, body);
      notifyOk('Answer sent');
      setText('');
      onChanged();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not send your answer. Your text is kept, try again.'));
    } finally {
      setBusy(false);
    }
  };

  const tone = d.outcome ? outcomeColor(d.outcome) : statusColor(d.status);
  const verdict = d.outcome ? OUTCOME_LABEL[d.outcome] : STATUS_WORDS[d.status];
  const verdictIcon = d.outcome ? outcomeIcon(d.outcome, 36) : statusIcon(d.status, 36);
  const bodyText = { margin: 0, fontSize: 15, lineHeight: 1.6, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } as const;

  return (
    <CrisisDialog title={`Directive ${d.no}`} onClose={onClose} width={760} flush>
      <div style={{ background: CK.redGrad, color: '#FFF4E6', padding: '16px 22px 18px' }}>
        <p className="flex items-center justify-between gap-3 flex-wrap" style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'rgba(255,232,214,0.85)' }}>
          <span className="inline-flex items-center gap-1.5">{kindIcon(d.kind, 15)}Directive {d.no}, {KIND_WORD[d.kind]}</span>
          <span>{whenLabel(d.created_at)}</span>
        </p>
        <h3 style={{ margin: '6px 0 0', fontSize: 24, lineHeight: 1.2, fontWeight: 800, overflowWrap: 'anywhere' }}>{d.title}</h3>
      </div>

      <div className="flex items-center" style={{ gap: 14, padding: '14px 22px', background: cabinetTint(tone, 0.1), boxShadow: `inset 0 -1px 0 ${cabinetTint(tone, 0.2)}` }}>
        <span style={{ color: tone, lineHeight: 0, flexShrink: 0 }}>{verdictIcon}</span>
        <div className="min-w-0">
          <b style={{ display: 'block', fontSize: 25, lineHeight: 1.15, fontWeight: 800, color: tone, overflowWrap: 'anywhere' }}>{verdict}</b>
          {d.outcome && d.status !== 'answered' && (
            <span className="inline-flex items-center gap-1.5" style={{ marginTop: 3, fontSize: 13, fontWeight: 700, color: statusColor(d.status) }}>{statusIcon(d.status)}{STATUS_WORDS[d.status]}</span>
          )}
        </div>
      </div>

      <div className="grid gap-3.5" style={{ padding: '16px 22px 24px' }}>
        <Soft title="What You Asked">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1" style={{ margin: '0 0 8px', fontSize: 13.5, color: CK.inkSoft }}>
            <span><b style={{ color: CK.ink }}>To:</b> {d.receiver}</span>
            <span><b style={{ color: CK.ink }}>From:</b> {author.name}</span>
            {withNames.length > 0 && <span><b style={{ color: CK.ink }}>Signed with:</b> {withNames.join(', ')}</span>}
          </p>
          {d.themes.length > 0 && (
            <span className="flex flex-wrap gap-1.5" style={{ marginBottom: 10 }}>{d.themes.map((t) => <ThemeTag key={t} theme={t} size="md" />)}</span>
          )}
          <p style={bodyText}>{d.body}</p>
        </Soft>

        <Soft title="The Backroom's Reply" accent={CK.red} warm>
          {d.reply ? (
            <>
              <p style={bodyText}>{d.reply}</p>
              <p style={{ margin: '8px 0 0', fontSize: 12.5, fontWeight: 700, color: CK.muted }}>
                {answeredBy ?? 'The backroom'}{d.answered_at ? `, ${whenLabel(d.answered_at)}` : ''}
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>No reply yet. It shows up here by itself.</p>
          )}
        </Soft>

        {(notes.length > 0 || (d.status === 'clarify' && isAuthor)) && (
          <section aria-label="Conversation with the backroom">
            <h3 className="flex items-center gap-2" style={{ margin: '4px 0 8px', fontSize: 13, fontWeight: 800, color: CK.red }}>
              <MessageSquareReply size={16} strokeWidth={1.5} aria-hidden />Conversation
            </h3>
            <div className="grid gap-2.5">
              {notes.map((n) => {
                const mine = n.member_id === myMemberId;
                return (
                  <div key={n.id} className="flex" style={{ justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '84%', borderRadius: mine ? '18px 18px 5px 18px' : '18px 18px 18px 5px', padding: '9px 13px',
                      background: mine ? cabinetTint(CK.forest, 0.13) : CK.card, boxShadow: mine ? 'none' : CK.shadowSm,
                    }}>
                      <p style={{ margin: 0, fontSize: 11.5, fontWeight: 800, color: mine ? CK.forest : CK.red }}>{mine ? 'You' : 'Backroom'}, {whenLabel(n.created_at)}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 14.5, lineHeight: 1.55, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {d.status === 'clarify' && isAuthor && (
              <div style={{ marginTop: 12 }}>
                <label htmlFor={`ans-${d.id}`} style={{ display: 'block', fontSize: 13, fontWeight: 700, color: CK.red, marginBottom: 5 }}>
                  The backroom needs more detail. Answer here and it goes back in the queue.
                </label>
                <textarea id={`ans-${d.id}`} value={text} onChange={(e) => setText(e.target.value)} rows={4} style={{ ...fieldStyle, resize: 'vertical' }} placeholder="Write your answer" />
                <div style={{ marginTop: 8 }}>
                  <Btn tone="green" icon={<Send size={15} strokeWidth={1.5} />} disabled={!text.trim() || busy} onClick={answer}>
                    {busy ? 'Sending' : 'Send answer'}
                  </Btn>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </CrisisDialog>
  );
}
