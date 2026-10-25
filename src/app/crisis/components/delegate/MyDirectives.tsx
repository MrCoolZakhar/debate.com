'use client';
// Gavelling Crisis: "My Directives", newest first, with the answer, the note thread and the box
// for answering a "more detail needed" question.

import { useState } from 'react';
import { ScrollText, Send } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { addNote, crisisError, type CrisisRef } from '@/lib/crisis/api';
import { KIND_LABEL, type Directive, type DirectiveNote } from '@/lib/crisis/types';
import { Btn, Card, CardTitle, CK, fieldStyle, Skeleton } from '../../crisisKit';
import { OutcomeLine, StatusLine, whenLabel } from './directiveUi';

const LONG = 280;

function DirectiveCard({
  cref, d, notes, withNames, myMemberId, authorName, isAuthor, onChanged,
}: {
  cref: CrisisRef; isAuthor: boolean; d: Directive; notes: DirectiveNote[]; withNames: string[]; myMemberId: string | null; authorName: string | null; onChanged: () => void;
}) {
  const [all, setAll] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const long = d.body.length > LONG;

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

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: CK.muted }}>
            Directive {d.no} · {KIND_LABEL[d.kind]} · {whenLabel(d.created_at)}
          </p>
          <h3 style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{d.title}</h3>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1" style={{ margin: '6px 0' }}>
        <StatusLine s={d.status} />
        <OutcomeLine d={d} />
      </div>
      {(authorName || withNames.length > 0) && (
        <p style={{ margin: '0 0 6px', fontSize: 12.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
          {authorName ? `From ${authorName}. ` : ''}{withNames.length > 0 ? `Signed with ${withNames.join(', ')}.` : ''}
        </p>
      )}
      <p
        style={{
          margin: 0, fontSize: 13.5, lineHeight: 1.55, color: CK.inkSoft, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
          ...(long && !all ? { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}),
        }}
      >
        <b style={{ color: CK.ink }}>To {d.receiver}: </b>{d.body}
      </p>
      {long && (
        <button type="button" onClick={() => setAll((x) => !x)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ border: 0, background: 'none', padding: '4px 0', fontSize: 13, fontWeight: 700, color: CK.forest, textDecoration: 'underline', cursor: 'pointer', fontFamily: CK.font }}>
          {all ? 'Show less' : 'Show all'}
        </button>
      )}

      {d.reply && (
        <div style={{ marginTop: 10, background: CK.well, borderRadius: 14, padding: '10px 12px' }}>
          <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 800, color: CK.red }}>Reply from the backroom</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{d.reply}</p>
        </div>
      )}

      {notes.length > 0 && (
        <div className="grid gap-2" style={{ marginTop: 10 }}>
          {notes.map((n) => {
            const mine = n.member_id === myMemberId;
            return (
              <div key={n.id} style={{ borderLeft: `3px solid ${mine ? CK.forest2 : CK.red}`, paddingLeft: 10 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: CK.muted }}>{mine ? 'You' : 'Backroom'} · {whenLabel(n.created_at)}</p>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.body}</p>
              </div>
            );
          })}
        </div>
      )}

      {d.status === 'clarify' && isAuthor && (
        <div style={{ marginTop: 12 }}>
          <label htmlFor={`ans-${d.id}`} style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: CK.red, marginBottom: 5 }}>
            The backroom needs more detail. Answer here and it goes back in the queue.
          </label>
          <textarea id={`ans-${d.id}`} value={text} onChange={(e) => setText(e.target.value)} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} placeholder="Write your answer" />
          <div style={{ marginTop: 8 }}>
            <Btn tone="green" size="sm" icon={<Send size={14} strokeWidth={1.5} />} disabled={!text.trim() || busy} onClick={answer}>
              {busy ? 'Sending' : 'Send answer'}
            </Btn>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function MyDirectives({
  cref, directives, notes, coauthors, nameOfCharacter, myMemberId, onChanged,
}: {
  cref: CrisisRef;
  directives: Directive[] | null;
  notes: DirectiveNote[];
  coauthors: Array<{ directive_id: string; character_id: string }>;
  nameOfCharacter: (id: string | null) => string | null;
  myMemberId: string | null;
  onChanged: () => void;
}) {
  return (
    <section aria-label="My directives">
      <Card warm style={{ marginBottom: 12 }}>
        <CardTitle icon={<ScrollText size={18} strokeWidth={1.5} />} sub="Newest first. Answers show up here by themselves.">My Directives</CardTitle>
        {directives === null ? (
          <div className="grid gap-2"><Skeleton h={60} r={14} /><Skeleton h={60} r={14} /></div>
        ) : directives.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>You have not sent a directive yet.</p>
        ) : null}
      </Card>
      <div className="grid gap-3">
        {(directives ?? []).map((d) => {
          const withNames = coauthors
            .filter((c) => c.directive_id === d.id)
            .map((c) => nameOfCharacter(c.character_id))
            .filter((n): n is string => !!n);
          const mineAuthored = d.author_member_id === myMemberId;
          return (
            <DirectiveCard
              key={d.id}
              cref={cref}
              d={d}
              notes={notes.filter((n) => n.directive_id === d.id)}
              withNames={withNames}
              myMemberId={myMemberId}
              authorName={mineAuthored ? null : nameOfCharacter(d.author_character_id)}
              isAuthor={mineAuthored}
              onChanged={onChanged}
            />
          );
        })}
      </div>
    </section>
  );
}
