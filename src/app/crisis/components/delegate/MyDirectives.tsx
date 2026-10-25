'use client';
// Gavelling Crisis: "My Directives", newest first. Every directive is its own card (number and kind
// small, the title big, a status line, the outcome in its colour, the first line of the reply).
// A click opens a dialog with the whole directive, the reply and the talk with the backroom.

import { useState } from 'react';
import { Send } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { addNote, crisisError, type CrisisRef } from '@/lib/crisis/api';
import { KIND_LABEL, type Directive, type DirectiveNote } from '@/lib/crisis/types';
import { Btn, Card, CK, fieldStyle, Skeleton } from '../../crisisKit';
import CrisisDialog from './CrisisDialog';
import { OutcomeLine, StatusLine, themeIcon, whenLabel } from './directiveUi';

function firstLine(text: string): string {
  const line = text.split('\n').map((l) => l.trim()).find((l) => l) ?? '';
  return line;
}

function DirectiveCard({ d, onOpen }: { d: Directive; onOpen: () => void }) {
  const ask = d.status === 'clarify';
  const reply = d.reply ? firstLine(d.reply) : '';
  return (
    <Card style={{ padding: 0, boxShadow: ask ? `${CK.shadow}, 0 0 0 2px rgba(142,36,36,0.35)` : CK.shadow }}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open directive ${d.no}: ${d.title}`}
        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
        style={{ border: 0, background: 'transparent', borderRadius: 22, padding: '16px 18px', cursor: 'pointer', fontFamily: CK.font }}
      >
        <p className="flex items-baseline justify-between gap-3 flex-wrap" style={{ margin: 0, fontSize: 12, fontWeight: 600, color: CK.muted }}>
          <span>Directive {d.no} · {KIND_LABEL[d.kind]}</span>
          <span>{whenLabel(d.created_at)}</span>
        </p>
        <h3 style={{ margin: '6px 0 0', fontSize: 19, lineHeight: 1.25, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{d.title}</h3>
        <div className="flex flex-col gap-1" style={{ marginTop: 10 }}>
          <StatusLine s={d.status} />
          <OutcomeLine d={d} />
        </div>
        {reply && (
          <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.45, color: CK.inkSoft, overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            <b style={{ color: CK.red }}>Reply: </b>{reply}
          </p>
        )}
      </button>
    </Card>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 700, color: CK.muted }}>{label}</p>
      {children}
    </div>
  );
}

function DirectiveDialog({
  cref, d, notes, withNames, myMemberId, authorName, isAuthor, onChanged, onClose,
}: {
  cref: CrisisRef; d: Directive; notes: DirectiveNote[]; withNames: string[]; myMemberId: string | null; authorName: string | null; isAuthor: boolean; onChanged: () => void; onClose: () => void;
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

  return (
    <CrisisDialog title={`Directive ${d.no}`} eyebrow={KIND_LABEL[d.kind]} onClose={onClose} width={720}>
      <div className="grid gap-4">
        <h3 style={{ margin: 0, fontSize: 22, lineHeight: 1.25, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{d.title}</h3>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <StatusLine s={d.status} />
          <OutcomeLine d={d} />
        </div>

        <dl className="grid gap-3 sm:grid-cols-2" style={{ margin: 0 }}>
          <Block label="Sent"><span style={{ fontSize: 14, color: CK.ink }}>{whenLabel(d.created_at)}</span></Block>
          <Block label="To"><span style={{ fontSize: 14, color: CK.ink, overflowWrap: 'anywhere' }}>{d.receiver}</span></Block>
          {authorName && <Block label="From"><span style={{ fontSize: 14, color: CK.ink, overflowWrap: 'anywhere' }}>{authorName}</span></Block>}
          {withNames.length > 0 && <Block label="Signed with"><span style={{ fontSize: 14, color: CK.ink, overflowWrap: 'anywhere' }}>{withNames.join(', ')}</span></Block>}
          {d.themes.length > 0 && (
            <Block label="Themes">
              <span className="flex flex-wrap gap-x-3 gap-y-1">
                {d.themes.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5" style={{ fontSize: 14, fontWeight: 600, color: CK.forest }}>{themeIcon(t, 15)}{t}</span>
                ))}
              </span>
            </Block>
          )}
        </dl>

        <Block label="What you asked for">
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{d.body}</p>
        </Block>

        {d.reply && (
          <div style={{ background: CK.well, borderRadius: 16, padding: '12px 14px' }}>
            <p style={{ margin: '0 0 4px', fontSize: 12.5, fontWeight: 800, color: CK.red }}>Reply from the backroom</p>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{d.reply}</p>
          </div>
        )}

        {notes.length > 0 && (
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: CK.muted }}>Talk with the backroom</p>
            <div className="grid gap-2.5">
              {notes.map((n) => {
                const mine = n.member_id === myMemberId;
                return (
                  <div key={n.id} style={{ borderLeft: `3px solid ${mine ? CK.forest2 : CK.red}`, paddingLeft: 10 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: CK.muted }}>{mine ? 'You' : 'Backroom'} · {whenLabel(n.created_at)}</p>
                    <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {d.status === 'clarify' && isAuthor && (
          <div>
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
      </div>
    </CrisisDialog>
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
  const [openId, setOpenId] = useState<string | null>(null);
  const openOne = openId ? (directives ?? []).find((d) => d.id === openId) ?? null : null;

  return (
    <section aria-labelledby="my-directives-title">
      <h2 id="my-directives-title" style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 800, color: CK.ink }}>My Directives</h2>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: CK.inkSoft }}>Newest first. Answers show up here by themselves.</p>
      {directives === null ? (
        <div className="grid gap-3"><Skeleton h={110} r={22} /><Skeleton h={110} r={22} /></div>
      ) : directives.length === 0 ? (
        <Card><p style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>You have not sent a directive yet.</p></Card>
      ) : (
        <div className="grid gap-4">
          {directives.map((d) => <DirectiveCard key={d.id} d={d} onOpen={() => setOpenId(d.id)} />)}
        </div>
      )}
      {openOne && (
        <DirectiveDialog
          key={openOne.id}
          cref={cref}
          d={openOne}
          notes={notes.filter((n) => n.directive_id === openOne.id)}
          withNames={coauthors
            .filter((c) => c.directive_id === openOne.id)
            .map((c) => nameOfCharacter(c.character_id))
            .filter((n): n is string => !!n)}
          myMemberId={myMemberId}
          authorName={openOne.author_member_id === myMemberId ? null : nameOfCharacter(openOne.author_character_id)}
          isAuthor={openOne.author_member_id === myMemberId}
          onChanged={onChanged}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  );
}
