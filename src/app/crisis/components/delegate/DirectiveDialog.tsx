'use client';
// Gavelling Crisis: one directive, opened, as a conversation. The pop-up is tall (most of the screen): a red header band (number,
// kind, title), the outcome (or status) as a coloured statement, who it was sent to, then the thread as chat bubbles taking all the
// free space: the delegate on the right (the directive, then their clarifications), the backroom on the left (the reply and its
// notes), oldest first. The author can ALWAYS write a clarification in the big note box at the bottom, at any status, even before the
// backroom has replied (addNote). While nobody has answered it, the author can also Edit it IN PLACE (owner, 1 Nov 2026: the title in
// the band and the text in the first bubble turn into large fields, Save changes / Cancel at the bottom, editDirective) or Withdraw it
// (asked in place, then withdrawDirective). Every field here is 15.5px or bigger.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Pencil, Send, Undo2, X } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { addNote, crisisError, editDirective, withdrawDirective, type CrisisRef } from '@/lib/crisis/api';
import { CHAIR_SEND_BACK_WORD, dirNumber, isChairSendBack } from '@/lib/crisis/format';
import type { Directive, DirectiveNote } from '@/lib/crisis/types';
import { Btn, cabinetTint, CK, ThemeTag } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { CharacterName } from '../character/CharacterProfileHost';
import CrisisDialog from './CrisisDialog';
import type { PersonRef } from './MyDirectives';
import { AttachBar, useImageAttach } from './ImageAttach';
import { DirectiveBody, splitAttached, withAttached } from '../directives/attachedImage';
import { countWords } from './DirectiveForm';
import { bigField, KIND_WORD, kindIcon, statusColor, statusIcon, STATUS_WORDS, verdictOf, whenLabel, whenTitle } from './directiveUi';

interface Bubble { key: string; mine: boolean; who: string; at: string | null; body: string; sort: number }

function BubbleView({ b, lead }: { b: Bubble; lead?: string }) {
  return (
    <div className="flex" style={{ justifyContent: b.mine ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: 'min(86%, 760px)', borderRadius: b.mine ? '18px 18px 5px 18px' : '18px 18px 18px 5px', padding: '11px 15px',
        background: b.mine ? cabinetTint(CK.forest, 0.13) : CK.card, boxShadow: b.mine ? 'none' : CK.shadowSm,
      }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: b.mine ? CK.forest : CK.red, overflowWrap: 'anywhere' }}>
          {lead ? `${lead}, ` : ''}{b.who}{b.at ? <span title={whenTitle(b.at)}>{`, ${whenTitle(b.at) ?? ''} (${whenLabel(b.at)})`}</span> : ''}
        </p>
        <DirectiveBody body={b.body} thumb={260} style={{ margin: '3px 0 0', fontSize: 15.5, lineHeight: 1.6, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} />
      </div>
    </div>
  );
}

export default function DirectiveDialog({
  cref, d, notes, withNames, myMemberId, author, isAuthor, answeredBy, onChanged, onClose, onSendAgain,
}: {
  cref: CrisisRef; d: Directive; notes: DirectiveNote[]; withNames: string[]; myMemberId: string | null;
  author: PersonRef; isAuthor: boolean; answeredBy: string | null; onChanged: () => void; onClose: () => void;
  /** A directive its chair sent back: copy it into a new directive and close this pop-up. */
  onSendAgain?: () => void;
}) {
  const { settings } = useCrisis();
  const sentBack = isChairSendBack(d);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  // Until the crisis team answers it, its author can still change it or take it back.
  const editable = isAuthor && (d.status === 'awaiting_chair' || d.status === 'queued' || d.status === 'claimed' || d.status === 'clarify');
  const withdrawn = d.status === 'withdrawn';

  // Editing in place: the title and the text become fields where they are shown.
  const [editing, setEditing] = useState(false);
  const [eTitle, setETitle] = useState('');
  const [eBody, setEBody] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const editAttach = useImageAttach(cref);
  const editAttachSet = editAttach.setUrl;
  const showEdit = editing && editable;
  const wordLimit = settings.wordLimit;
  const words = countWords(withAttached(eBody, editAttach.url));
  const over = wordLimit > 0 && words > wordLimit;
  const canSave = showEdit && eTitle.trim() !== '' && eBody.trim() !== '' && !over && !saving && !editAttach.uploading;

  const startEdit = () => {
    const { text: plain, image } = splitAttached(d.body);
    setETitle(d.title);
    setEBody(plain);
    editAttachSet(image);
    setProblem(null);
    setConfirmWithdraw(false);
    setEditing(true);
  };
  const cancelEdit = () => { setEditing(false); setProblem(null); };

  const save = async () => {
    if (!canSave || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setProblem(null);
    try {
      const er = await editDirective(cref, d.id, {
        title: eTitle.trim(), body: withAttached(eBody, editAttach.url), themes: d.themes, receiver: d.receiver, covert: d.covert,
      });
      if (er.ok) {
        notifyOk(`Directive ${dirNumber(d)} changed`);
        setEditing(false);
        onChanged();
      } else if (er.reason === 'being_answered') {
        setProblem('The crisis team is writing the answer right now, so it can\'t be changed. Your text is kept.');
        onChanged();
      } else if (er.reason === 'answered') {
        setProblem('The crisis team already answered this directive, so it can\'t be changed.');
        onChanged();
      } else {
        setProblem(`This is too long. The limit is ${'limit' in er ? er.limit : 300} words. Your text is kept, so shorten it and save again.`);
      }
    } catch (e) {
      notifyErr(crisisError(e, 'Could not save your changes. Your text is kept, try again.'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const withdraw = async () => {
    if (withdrawing) return;
    setWithdrawing(true);
    try {
      const r = await withdrawDirective(cref, d.id);
      if (r.ok) {
        notifyOk(`Directive ${dirNumber(d)} withdrawn`);
        onChanged();
        onClose();
      } else if (r.reason === 'answered') {
        notifyErr('The crisis team already answered this directive, so it can\'t be withdrawn.');
        setConfirmWithdraw(false);
        onChanged();
      } else {
        notifyErr('This directive could not be withdrawn. Try again.');
        setConfirmWithdraw(false);
        onChanged();
      }
    } catch (e) {
      notifyErr(crisisError(e, 'Could not withdraw the directive. Try again.'));
    } finally {
      setWithdrawing(false);
    }
  };
  const scroller = useRef<HTMLElement>(null);
  const attach = useImageAttach(cref);

  const send = async () => {
    const body = text.trim();
    if (!body || busy || attach.uploading) return;
    setBusy(true);
    try {
      await addNote(cref, d.id, withAttached(body, attach.url));
      notifyOk('Message sent');
      setText('');
      attach.setUrl(null);
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
      out.push({ key: 'reply', mine: false, who: sentBack ? 'Your chair' : answeredBy ?? 'Backroom', at, body: d.reply, sort: at ? new Date(at).getTime() : t0 + 1 });
    }
    for (const n of notes) {
      out.push({ key: n.id, mine: n.member_id === myMemberId, who: n.member_id === myMemberId ? 'You' : sentBack ? 'Your chair' : 'Backroom', at: n.created_at, body: n.body, sort: new Date(n.created_at).getTime() });
    }
    return out.sort((a, b) => a.sort - b.sort);
  }, [d, notes, isAuthor, author.name, answeredBy, myMemberId, sentBack]);

  // The conversation shows its newest message: on open, and whenever a new one arrives. Starting an edit goes back to the top, where the fields are.
  const count = thread.length;
  const seen = useRef(0);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (seen.current === 0) el.scrollTop = el.scrollHeight;
    else if (count > seen.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    seen.current = count;
  }, [count]);
  useEffect(() => {
    if (showEdit) scroller.current?.scrollTo({ top: 0 });
  }, [showEdit]);

  const { color: tone, word: verdict, icon: verdictIcon } = verdictOf(d, 30);
  const barStyle = { flex: 'none', background: CK.surface, boxShadow: `0 -1px 0 ${CK.hair}`, padding: '12px 22px 16px' } as const;

  return (
    <CrisisDialog title="Your Directive" onClose={onClose} width={980} flush>
      <style>{`
        .dd-body { display: flex; flex-direction: column; height: min(calc(100dvh - 110px), 960px); }
        @media (max-width: 639px) { .dd-body { height: calc(100dvh - 62px); } }
      `}</style>
      <div className="dd-body">
        <div style={{ flex: 'none', background: CK.redGrad, color: '#FFF4E6', padding: '14px 22px 16px' }}>
          <p className="flex items-center justify-between gap-3 flex-wrap" style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'rgba(255,232,214,0.85)' }}>
            <span className="inline-flex items-center gap-1.5">{kindIcon(d.kind, 15)}{KIND_WORD[d.kind]}</span>
            <span title={whenTitle(d.created_at)}>Sent {whenTitle(d.created_at)} ({whenLabel(d.created_at)})</span>
          </p>
          {showEdit ? (
            <div style={{ marginTop: 8 }}>
              <label htmlFor={`dd-title-${d.id}`} style={{ display: 'block', margin: '0 0 4px', fontSize: 12.5, fontWeight: 700, color: 'rgba(255,232,214,0.9)' }}>Title</label>
              <input
                id={`dd-title-${d.id}`}
                value={eTitle}
                onChange={(e) => { setProblem(null); setETitle(e.target.value); }}
                maxLength={160}
                placeholder="A short name for it"
                style={{ ...bigField, height: 54, fontSize: 20, fontWeight: 800, color: CK.ink, background: '#FFFBF6', boxShadow: '0 2px 10px rgba(58,14,15,0.3)' }}
              />
            </div>
          ) : (
            <h3 style={{ margin: '6px 0 0', fontSize: 25, lineHeight: 1.2, fontWeight: 800, overflowWrap: 'anywhere' }}>{dirNumber(d)}: {d.title}</h3>
          )}
        </div>

        <div className="flex items-center" style={{ flex: 'none', gap: 12, padding: '11px 22px', background: cabinetTint(tone, 0.1), boxShadow: `inset 0 -1px 0 ${cabinetTint(tone, 0.2)}` }}>
          <span style={{ color: tone, lineHeight: 0, flexShrink: 0 }}>{verdictIcon}</span>
          <div className="min-w-0">
            <b style={{ display: 'block', fontSize: 21, lineHeight: 1.15, fontWeight: 800, color: tone, overflowWrap: 'anywhere' }}>{verdict}</b>
            {d.status === 'awaiting_chair' && (
              <span className="block" style={{ marginTop: 2, fontSize: 13.5, fontWeight: 700, color: CK.inkSoft }}>
                Your chair reads it first. If they send it on, it goes to the backroom.
              </span>
            )}
            {d.answered_at && (
              <span className="block" style={{ marginTop: 2, fontSize: 13.5, fontWeight: 700, color: CK.inkSoft }}>
                {sentBack ? 'Sent back' : 'Reply came in'} {whenTitle(d.answered_at)} ({whenLabel(d.answered_at)})
              </span>
            )}
            {d.outcome && d.status !== 'answered' && (
              <span className="inline-flex items-center gap-1.5" style={{ marginTop: 2, fontSize: 13.5, fontWeight: 700, color: statusColor(d.status) }}>{statusIcon(d.status)}{STATUS_WORDS[d.status]}</span>
            )}
          </div>
        </div>

        <div className="flex items-start justify-between flex-wrap" style={{ flex: 'none', gap: '8px 16px', padding: '12px 22px 0' }}>
          <div className="min-w-0" style={{ flex: '1 1 320px' }}>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1" style={{ margin: 0, fontSize: 14, color: CK.inkSoft }}>
              {d.receiver && <span><b style={{ color: CK.ink }}>To:</b> {d.receiver}</span>}
              <span><b style={{ color: CK.ink }}>From:</b> <CharacterName name={author.name} /></span>
              {withNames.length > 0 && <span><b style={{ color: CK.ink }}>Signed with:</b> {withNames.map((n, i) => <span key={`${n}-${i}`}>{i > 0 ? ', ' : ''}<CharacterName name={n} /></span>)}</span>}
            </p>
            {d.themes.length > 0 && (
              <span className="flex flex-wrap gap-1.5" style={{ marginTop: 8 }}>{d.themes.map((t) => <ThemeTag key={t} theme={t} size="md" />)}</span>
            )}
          </div>
          {editable && !sentBack && !showEdit && (
            <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
              {confirmWithdraw ? (
                <>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: CK.ink, overflowWrap: 'anywhere' }}>Withdraw this directive? The crisis team will not answer it.</span>
                  <Btn tone="danger" size="sm" disabled={withdrawing} onClick={() => { void withdraw(); }}>{withdrawing ? 'Withdrawing' : 'Yes, withdraw it'}</Btn>
                  <Btn tone="ghost" size="sm" disabled={withdrawing} onClick={() => setConfirmWithdraw(false)}>Keep it</Btn>
                </>
              ) : (
                <>
                  <Btn tone="ghost" icon={<Pencil size={15} strokeWidth={1.5} />} onClick={startEdit}>Edit</Btn>
                  <Btn tone="danger" icon={<Undo2 size={15} strokeWidth={1.5} />} onClick={() => setConfirmWithdraw(true)}>Withdraw</Btn>
                </>
              )}
            </div>
          )}
        </div>

        <section ref={scroller} aria-label="Conversation with the backroom" className="grid gap-3 content-start" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 22px 16px' }}>
          {thread.map((b) => (b.key === 'directive' && showEdit ? (
            <div key="directive-edit" style={{ background: CK.card, borderRadius: 18, padding: '12px 14px 14px', boxShadow: `${CK.shadowSm}, inset 0 0 0 2px ${cabinetTint(CK.forest, 0.28)}` }}>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={`dd-body-${d.id}`} style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: CK.forest, margin: '0 0 6px' }}>What do you want to happen?</label>
                <span aria-live="polite" style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: over ? CK.danger : CK.muted, whiteSpace: 'nowrap' }}>
                  {words}{wordLimit > 0 ? ` / ${wordLimit}` : ''} words
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <textarea
                  id={`dd-body-${d.id}`}
                  value={eBody}
                  onChange={(e) => { setProblem(null); setEBody(e.target.value); }}
                  rows={10}
                  style={{ ...bigField, minHeight: 240, resize: 'vertical', paddingBottom: 50, boxShadow: over ? 'inset 0 0 0 2px rgba(163,65,47,0.6)' : bigField.boxShadow }}
                  placeholder="Say what you do, how, and when."
                />
                <div style={{ position: 'absolute', left: 10, bottom: 9 }}>
                  <AttachBar url={editAttach.url} uploading={editAttach.uploading} onPick={(f) => { setProblem(null); void editAttach.pick(f); }} onClear={() => editAttachSet(null)} disabled={saving} />
                </div>
              </div>
              {problem && <p role="alert" style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 600, color: CK.danger }}>{problem}</p>}
              {over && !problem && <p style={{ margin: '8px 0 0', fontSize: 13.5, color: CK.danger }}>That is {words - wordLimit} words over the limit.</p>}
            </div>
          ) : (
            <BubbleView key={b.key} b={b} lead={b.key === 'directive' ? 'Directive' : b.key === 'reply' ? (sentBack ? CHAIR_SEND_BACK_WORD : 'Reply') : undefined} />
          )))}
          {!d.reply && !showEdit && (
            <p style={{ margin: '2px 0 0', fontSize: 14, color: CK.muted, textAlign: 'center' }}>
              {withdrawn ? 'This directive was withdrawn. The crisis team will not answer it.' : 'No reply yet. It shows up here by itself.'}
            </p>
          )}
        </section>

        {isAuthor && sentBack && onSendAgain && (
          <div style={barStyle}>
            <Btn tone="green" icon={<Pencil size={15} strokeWidth={1.5} />} onClick={onSendAgain}>Edit and send again</Btn>
          </div>
        )}
        {isAuthor && !sentBack && !withdrawn && showEdit && (
          <div className="flex items-center flex-wrap" style={{ ...barStyle, gap: 10 }}>
            <Btn tone="green" icon={<Check size={16} strokeWidth={1.6} />} disabled={!canSave} onClick={() => { void save(); }}>{saving ? 'Saving' : 'Save changes'}</Btn>
            <Btn tone="ghost" icon={<X size={15} strokeWidth={1.6} />} disabled={saving} onClick={cancelEdit}>Cancel</Btn>
            <span style={{ fontSize: 13.5, color: CK.inkSoft }}>Nobody has answered it yet, so you can still change it.</span>
          </div>
        )}
        {isAuthor && !sentBack && !withdrawn && !showEdit && (
          <div style={barStyle}>
            {d.status === 'clarify' && (
              <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: CK.red }}>The backroom needs more detail. Answer here and it goes back in the queue.</p>
            )}
            <div className="flex items-end" style={{ gap: 10 }}>
              <label htmlFor={`note-${d.id}`} className="sr-only">Write to the backroom</label>
              <div style={{ position: 'relative', flex: 1 }}>
                <textarea
                  id={`note-${d.id}`}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }}
                  rows={4}
                  style={{ ...bigField, minHeight: 124, resize: 'none', paddingBottom: 46 }}
                  placeholder="Add a clarification for the backroom"
                />
                <div style={{ position: 'absolute', left: 10, bottom: 8 }}>
                  <AttachBar url={attach.url} uploading={attach.uploading} onPick={(f) => { void attach.pick(f); }} onClear={() => attach.setUrl(null)} disabled={busy} />
                </div>
              </div>
              <Btn tone="green" icon={<Send size={16} strokeWidth={1.5} />} disabled={!text.trim() || busy || attach.uploading} onClick={send} style={{ height: 48, padding: '0 20px', fontSize: 15 }}>
                {busy ? 'Sending' : 'Send'}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </CrisisDialog>
  );
}
