'use client';
// Gavelling Crisis: one directive, opened, as a conversation. A red header band (number, kind, title),
// the outcome (or status) as a coloured statement, who it was sent to, then the thread as chat bubbles:
// the delegate on the right (the directive, then their clarifications), the backroom on the left (the
// reply and its notes), oldest first. The author can ALWAYS write a clarification at the bottom, at any
// status, even before the backroom has replied (addNote).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { addNote, crisisError, type CrisisRef } from '@/lib/crisis/api';
import { dirNumber } from '@/lib/crisis/format';
import { OUTCOME_LABEL, type Directive, type DirectiveNote } from '@/lib/crisis/types';
import { Btn, cabinetTint, CK, fieldStyle, ThemeTag } from '../../crisisKit';
import CrisisDialog from './CrisisDialog';
import type { PersonRef } from './MyDirectives';
import { KIND_WORD, kindIcon, outcomeColor, outcomeIcon, statusColor, statusIcon, STATUS_WORDS, whenLabel, whenTitle } from './directiveUi';

interface Bubble { key: string; mine: boolean; who: string; at: string | null; body: string; sort: number }

function BubbleView({ b, lead }: { b: Bubble; lead?: string }) {
  return (
    <div className="flex" style={{ justifyContent: b.mine ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '86%', borderRadius: b.mine ? '18px 18px 5px 18px' : '18px 18px 18px 5px', padding: '9px 13px',
        background: b.mine ? cabinetTint(CK.forest, 0.13) : CK.card, boxShadow: b.mine ? 'none' : CK.shadowSm,
      }}>
        <p style={{ margin: 0, fontSize: 11.5, fontWeight: 800, color: b.mine ? CK.forest : CK.red, overflowWrap: 'anywhere' }}>
          {lead ? `${lead}, ` : ''}{b.who}{b.at ? <span title={whenTitle(b.at)}>{`, ${whenTitle(b.at) ?? ''} (${whenLabel(b.at)})`}</span> : ''}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 14.5, lineHeight: 1.55, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{b.body}</p>
      </div>
    </div>
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
  const endRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await addNote(cref, d.id, body);
      notifyOk('Message sent');
      setText('');
      onChanged();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not send your message. Your text is kept, try again.'));
    } finally {
      setBusy(false);
    }
  };

  // The thread, oldest first: the directive (right), the reply (left), then every note.
  const thread = useMemo<Bubble[]>(() => {
    const t0 = new Date(d.created_at).getTime();
    const out: Bubble[] = [{ key: 'directive', mine: true, who: isAuthor ? 'You' : author.name, at: d.created_at, body: d.body, sort: t0 }];
    if (d.reply) {
      const at = d.answered_at ?? null;
      out.push({ key: 'reply', mine: false, who: answeredBy ?? 'Backroom', at, body: d.reply, sort: at ? new Date(at).getTime() : t0 + 1 });
    }
    for (const n of notes) {
      out.push({ key: n.id, mine: n.member_id === myMemberId, who: n.member_id === myMemberId ? 'You' : 'Backroom', at: n.created_at, body: n.body, sort: new Date(n.created_at).getTime() });
    }
    return out.sort((a, b) => a.sort - b.sort);
  }, [d, notes, isAuthor, author.name, answeredBy, myMemberId]);

  // A new message scrolls into view (not on the very first paint of a thread with only the directive).
  const count = thread.length;
  useEffect(() => {
    if (count > 1) endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [count]);

  const tone = d.outcome ? outcomeColor(d.outcome) : statusColor(d.status);
  const verdict = d.outcome ? OUTCOME_LABEL[d.outcome] : STATUS_WORDS[d.status];
  const verdictIcon = d.outcome ? outcomeIcon(d.outcome, 30) : statusIcon(d.status, 30);

  return (
    <CrisisDialog title="Your directive" onClose={onClose} width={720} flush>
      <div style={{ background: CK.redGrad, color: '#FFF4E6', padding: '14px 22px 16px' }}>
        <p className="flex items-center justify-between gap-3 flex-wrap" style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'rgba(255,232,214,0.85)' }}>
          <span className="inline-flex items-center gap-1.5">{kindIcon(d.kind, 15)}{KIND_WORD[d.kind]}</span>
          <span title={whenTitle(d.created_at)}>Sent {whenTitle(d.created_at)} ({whenLabel(d.created_at)})</span>
        </p>
        <h3 style={{ margin: '6px 0 0', fontSize: 25, lineHeight: 1.2, fontWeight: 800, overflowWrap: 'anywhere' }}>{dirNumber(d)}: {d.title}</h3>
      </div>

      <div className="flex items-center" style={{ gap: 12, padding: '11px 22px', background: cabinetTint(tone, 0.1), boxShadow: `inset 0 -1px 0 ${cabinetTint(tone, 0.2)}` }}>
        <span style={{ color: tone, lineHeight: 0, flexShrink: 0 }}>{verdictIcon}</span>
        <div className="min-w-0">
          <b style={{ display: 'block', fontSize: 21, lineHeight: 1.15, fontWeight: 800, color: tone, overflowWrap: 'anywhere' }}>{verdict}</b>
          {d.status === 'awaiting_chair' && (
            <span className="block" style={{ marginTop: 2, fontSize: 13, fontWeight: 700, color: CK.inkSoft }}>
              Your chair reads it first. If they send it on, it goes to the backroom.
            </span>
          )}
          {d.answered_at && (
            <span className="block" style={{ marginTop: 2, fontSize: 13, fontWeight: 700, color: CK.inkSoft }}>
              Reply came in {whenTitle(d.answered_at)} ({whenLabel(d.answered_at)})
            </span>
          )}
          {d.outcome && d.status !== 'answered' && (
            <span className="inline-flex items-center gap-1.5" style={{ marginTop: 2, fontSize: 13, fontWeight: 700, color: statusColor(d.status) }}>{statusIcon(d.status)}{STATUS_WORDS[d.status]}</span>
          )}
        </div>
      </div>

      <div style={{ padding: '12px 22px 0' }}>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1" style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>
          {d.receiver && <span><b style={{ color: CK.ink }}>To:</b> {d.receiver}</span>}
          <span><b style={{ color: CK.ink }}>From:</b> {author.name}</span>
          {withNames.length > 0 && <span><b style={{ color: CK.ink }}>Signed with:</b> {withNames.join(', ')}</span>}
        </p>
        {d.themes.length > 0 && (
          <span className="flex flex-wrap gap-1.5" style={{ marginTop: 8 }}>{d.themes.map((t) => <ThemeTag key={t} theme={t} size="md" />)}</span>
        )}
      </div>

      <section aria-label="Conversation with the backroom" className="grid gap-2.5" style={{ padding: '14px 22px 16px' }}>
        {thread.map((b) => <BubbleView key={b.key} b={b} lead={b.key === 'directive' ? 'Directive' : b.key === 'reply' ? 'Reply' : undefined} />)}
        {!d.reply && (
          <p style={{ margin: '2px 0 0', fontSize: 13, color: CK.muted, textAlign: 'center' }}>No reply yet. It shows up here by itself.</p>
        )}
        <div ref={endRef} style={{ scrollMarginBottom: 110 }} />
      </section>

      {isAuthor && (
        <div style={{ position: 'sticky', bottom: 0, background: CK.surface, boxShadow: `0 -1px 0 ${CK.hair}`, padding: '10px 22px 14px' }}>
          {d.status === 'clarify' && (
            <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: CK.red }}>The backroom needs more detail. Answer here and it goes back in the queue.</p>
          )}
          <div className="flex items-end" style={{ gap: 8 }}>
            <label htmlFor={`note-${d.id}`} className="sr-only">Write to the backroom</label>
            <textarea
              id={`note-${d.id}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }}
              rows={2}
              style={{ ...fieldStyle, resize: 'none', flex: 1 }}
              placeholder="Add a clarification for the backroom"
            />
            <Btn tone="green" icon={<Send size={15} strokeWidth={1.5} />} disabled={!text.trim() || busy} onClick={send} style={{ height: 42 }}>
              {busy ? 'Sending' : 'Send'}
            </Btn>
          </div>
        </div>
      )}
    </CrisisDialog>
  );
}
