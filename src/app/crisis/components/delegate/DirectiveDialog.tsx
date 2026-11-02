'use client';
// Gavelling Crisis: one directive, opened, as a conversation. The pop-up is for READING AND WRITING LONG DIRECTIVES (owner, 2 Nov 2026),
// so nothing here takes room from the text: ONE slim header line (kind icon, number and title, ONE small status pill, when it was sent),
// a tiny line under it (From, Signed with, the themes as icons, and Edit / Withdraw), then the thread as chat bubbles taking all the free
// space (the directive on the right, the backroom on the left, oldest first, 13px text so a full 300-word directive fits without scrolling
// on a laptop), and a compact note box that grows. There is no "To:" line. The author can always write a clarification (addNote). Edit exists
// only while the backroom has NOT replied (awaiting the chair, changes asked for by the chair, queued, claimed); once it asked for detail
// or answered, Edit is gone (the database refuses it too). A CABINET directive can be edited only while it waits for the chair or the chair
// asked for changes. Withdraw is asked in place. The delegate may edit their own latest clarification until the backroom replies after it (crisis_edit_note, SQL part 36).

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Pencil, Send, Undo2, X } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { addNote, crisisError, editDirective, editNote, withdrawDirective, type CrisisRef } from '@/lib/crisis/api';
import { CHAIR_SEND_BACK_WORD, dirNumber, isChairSendBack } from '@/lib/crisis/format';
import type { Directive, DirectiveNote } from '@/lib/crisis/types';
import { Btn, cabinetTint, CK, ThemeTag } from '../../crisisKit';
import { isCabinetDirective } from '../directives/cabinetStamp';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { CharacterName } from '../character/CharacterProfileHost';
import CrisisDialog from './CrisisDialog';
import type { PersonRef } from './MyDirectives';
import { AttachBar, useImageAttach } from './ImageAttach';
import { DirectiveBody, splitAttached, withAttached } from '../directives/attachedImage';
import { countWords } from './DirectiveForm';
import { bigField, KIND_WORD, kindIcon, verdictOf, whenLabel, whenTitle } from './directiveUi';

interface Bubble { key: string; mine: boolean; who: string; at: string | null; body: string; sort: number; edited?: boolean }

function BubbleView({ b, lead, onEdit, editor }: { b: Bubble; lead?: string; onEdit?: () => void; editor?: ReactNode }) {
  return (
    <div className="flex" style={{ justifyContent: b.mine ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: 'min(92%, 820px)', borderRadius: b.mine ? '16px 16px 5px 16px' : '16px 16px 16px 5px', padding: '8px 12px',
        background: b.mine ? cabinetTint(CK.forest, 0.13) : CK.card, boxShadow: b.mine ? 'none' : CK.shadowSm,
      }}>
        <p style={{ margin: 0, fontSize: 11.5, fontWeight: 800, color: b.mine ? CK.forest : CK.red, overflowWrap: 'anywhere' }}>
          {lead ? `${lead}, ` : ''}{b.who}{b.at ? <span title={whenTitle(b.at)}>{`, ${whenTitle(b.at) ?? ''} (${whenLabel(b.at)})`}</span> : ''}
          {b.edited && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 600, color: CK.muted }}>edited</span>}
          {onEdit && !editor && (
            <button type="button" onClick={onEdit} className="focus:outline-none inline-flex items-center" style={{ marginLeft: 8, gap: 3, fontSize: 11.5, fontWeight: 700, color: CK.forest, background: 'none', border: 0, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>
              <Pencil size={11} strokeWidth={1.5} />Edit
            </button>
          )}
        </p>
        {editor ?? <DirectiveBody body={b.body} thumb={260} style={{ margin: '2px 0 0', fontSize: 13, lineHeight: 1.55, color: CK.ink, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} />}
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
  // Until the crisis team answers it, its author can take it back.
  const editable = isAuthor && (d.status === 'awaiting_chair' || d.status === 'queued' || d.status === 'claimed' || d.status === 'clarify');
  // Edit only while the backroom has not replied (owner, 2 Nov 2026): never once it asked for detail or answered. A directive that
  // went back to the queue after a clarification already carries the backroom's reply, so it is not editable either. A cabinet
  // directive can also be changed only until the chair approved it (owner, 1 Nov 2026).
  const backroomReplied = d.status === 'clarify' || d.status === 'answered' || (d.status !== 'awaiting_chair' && d.status !== 'changes_requested' && !!d.answered_at);
  const canEdit = isAuthor && !backroomReplied && (isCabinetDirective(d) ? (d.status === 'awaiting_chair' || d.status === 'changes_requested') : (d.status === 'awaiting_chair' || d.status === 'changes_requested' || d.status === 'queued' || d.status === 'claimed'));
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
  const showEdit = editing && canEdit;
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
      } else if (er.reason === 'approved') {
        notifyErr('Your chair already approved this cabinet directive, so it can\'t be changed.');
        setEditing(false);
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
  // Editing the newest clarification in place, while the backroom has not replied after it.
  const [noteEdits, setNoteEdits] = useState<Record<string, { body: string; edited_at: string }>>({});
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteImage, setNoteImage] = useState<string | null>(null);
  const [noteProblem, setNoteProblem] = useState<string | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const noteSavingRef = useRef(false);
  const noteEditBox = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = noteEditBox.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 190)}px`;
  }, [noteDraft, editingNote]);
  const startNoteEdit = (id: string, body: string) => {
    const { text: plain, image } = splitAttached(body);
    setNoteDraft(plain);
    setNoteImage(image);
    setNoteProblem(null);
    setEditingNote(id);
  };
  const saveNote = async (id: string) => {
    if (noteSavingRef.current) return;
    const body = noteDraft.trim();
    if (!body) { setNoteProblem('Write something first'); return; }
    noteSavingRef.current = true;
    setNoteSaving(true);
    try {
      const r = await editNote(cref, id, withAttached(body, noteImage));
      if (r.ok) {
        setNoteEdits((m) => ({ ...m, [id]: { body: withAttached(body, noteImage), edited_at: new Date().toISOString() } }));
        notifyOk('Clarification changed');
        setEditingNote(null);
        onChanged();
      } else if (r.reason === 'replied') {
        notifyErr('The backroom has already replied, so it can\'t be changed.');
        setEditingNote(null);
        onChanged();
      } else {
        setNoteProblem('Write something first');
      }
    } catch (e) {
      notifyErr(crisisError(e, 'Could not save your changes. Your text is kept, try again.'));
    } finally {
      noteSavingRef.current = false;
      setNoteSaving(false);
    }
  };
  const scroller = useRef<HTMLElement>(null);
  const noteBox = useRef<HTMLTextAreaElement>(null);
  const attach = useImageAttach(cref);
  // The note box starts at 3 lines and grows with what is typed (up to about 8 lines).
  useEffect(() => {
    const el = noteBox.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 190)}px`;
  }, [text]);

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
      const ov = noteEdits[n.id];
      out.push({ key: n.id, mine: n.member_id === myMemberId, who: n.member_id === myMemberId ? 'You' : sentBack ? 'Your chair' : 'Backroom', at: n.created_at, body: ov?.body ?? n.body, sort: new Date(n.created_at).getTime(), edited: !!(n.edited_at || ov) });
    }
    return out.sort((a, b) => a.sort - b.sort);
  }, [d, notes, isAuthor, author.name, answeredBy, myMemberId, sentBack, noteEdits]);
  const lastBubble = thread[thread.length - 1];
  const lastNote = lastBubble ? notes.find((n) => n.id === lastBubble.key) : undefined;
  const editableNoteId = isAuthor && !sentBack && !withdrawn && !showEdit && lastNote && lastNote.member_id === myMemberId
    && (!d.answered_at || new Date(d.answered_at).getTime() < new Date(lastNote.created_at).getTime())
    ? lastNote.id : null;

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

  const { color: tone, word: verdict, icon: verdictIcon } = verdictOf(d, 13);
  const barStyle = { flex: 'none', background: CK.surface, boxShadow: `0 -1px 0 ${CK.hair}`, padding: '8px 18px 12px' } as const;
  const replyAt = d.answered_at;
  const pillHint = d.status === 'awaiting_chair' ? 'Your chair reads it first. If they send it on, it goes to the backroom.' : verdict;

  return (
    <CrisisDialog title="Your Directive" onClose={onClose} width={980} flush>
      <style>{`
        .dd-body { display: flex; flex-direction: column; height: min(calc(100dvh - 110px), 960px); }
        @media (max-width: 639px) { .dd-body { height: calc(100dvh - 62px); } }
      `}</style>
      <div className="dd-body">
        {/* ONE slim header: kind, number and title, the status as one small pill, when it was sent. */}
        <div style={{ flex: 'none', background: CK.card, boxShadow: `0 1px 0 ${CK.hair}`, padding: '10px 18px 8px' }}>
          {showEdit ? (
            <div className="flex items-center" style={{ gap: 10 }}>
              <span style={{ flex: 'none', fontSize: 15, fontWeight: 800, color: CK.red }}>{dirNumber(d)}:</span>
              <label htmlFor={`dd-title-${d.id}`} className="sr-only">Title</label>
              <input
                id={`dd-title-${d.id}`}
                value={eTitle}
                onChange={(e) => { setProblem(null); setETitle(e.target.value); }}
                maxLength={160}
                placeholder="A short name for it"
                style={{ ...bigField, flex: 1, minWidth: 0, height: 40, minHeight: 40, fontSize: 15, fontWeight: 800, padding: '6px 12px' }}
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center" style={{ gap: '4px 10px' }}>
              <span title={KIND_WORD[d.kind]} role="img" aria-label={KIND_WORD[d.kind]} className="inline-flex" style={{ color: CK.red, flex: 'none' }}>{kindIcon(d.kind, 17)}</span>
              <h3 style={{ margin: 0, flex: '1 1 220px', minWidth: 0, fontSize: 18, lineHeight: 1.25, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{dirNumber(d)}: {d.title}</h3>
              <span
                title={pillHint}
                className="inline-flex items-center"
                style={{ flex: 'none', gap: 5, height: 24, padding: '0 10px', borderRadius: 999, fontSize: 12, fontWeight: 800, color: tone, background: cabinetTint(tone, 0.13), whiteSpace: 'nowrap' }}
              >
                {verdictIcon}{verdict}
              </span>
              <span title={whenTitle(d.created_at)} style={{ flex: 'none', fontSize: 12, fontWeight: 600, color: CK.muted }}>
                Sent {whenLabel(d.created_at)}{replyAt ? `, ${sentBack ? 'sent back' : 'reply'} ${whenLabel(replyAt)}` : ''}
              </span>
            </div>
          )}
          {/* Tiny facts: who it is from, who signed it, the themes as icons, and Edit / Withdraw. No "To". */}
          <div className="flex items-center flex-wrap" style={{ gap: '4px 14px', marginTop: 5, fontSize: 12.5, color: CK.inkSoft }}>
            <span><b style={{ color: CK.ink }}>From</b> <CharacterName name={author.name} /></span>
            {withNames.length > 0 && <span><b style={{ color: CK.ink }}>Signed with</b> {withNames.map((n, i) => <span key={`${n}-${i}`}>{i > 0 ? ', ' : ''}<CharacterName name={n} /></span>)}</span>}
            {d.themes.length > 0 && <span className="inline-flex flex-wrap" style={{ gap: 4 }}>{d.themes.map((t) => <ThemeTag key={t} theme={t} iconOnly />)}</span>}
            {(editable || canEdit) && !sentBack && !showEdit && (
              <span className="inline-flex items-center flex-wrap" style={{ gap: 6, marginLeft: 'auto' }}>
                {confirmWithdraw ? (
                  <>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: CK.ink, overflowWrap: 'anywhere' }}>Withdraw it? The crisis team will not answer it.</span>
                    <Btn tone="danger" size="sm" disabled={withdrawing} onClick={() => { void withdraw(); }}>{withdrawing ? 'Withdrawing' : 'Yes, withdraw it'}</Btn>
                    <Btn tone="ghost" size="sm" disabled={withdrawing} onClick={() => setConfirmWithdraw(false)}>Keep it</Btn>
                  </>
                ) : (
                  <>
                    {canEdit && <Btn tone="ghost" size="sm" icon={<Pencil size={13} strokeWidth={1.5} />} onClick={startEdit}>Edit</Btn>}
                    {editable && <Btn tone="danger" size="sm" icon={<Undo2 size={13} strokeWidth={1.5} />} onClick={() => setConfirmWithdraw(true)}>Withdraw</Btn>}
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        <section ref={scroller} aria-label="Conversation with the backroom" className="grid gap-2 content-start" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 18px 12px' }}>
          {thread.map((b) => (b.key === 'directive' && showEdit ? (
            <div key="directive-edit" style={{ background: CK.card, borderRadius: 16, padding: '8px 12px 10px', boxShadow: `${CK.shadowSm}, inset 0 0 0 2px ${cabinetTint(CK.forest, 0.28)}` }}>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={`dd-body-${d.id}`} style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: CK.forest, margin: '0 0 4px' }}>What do you want to happen?</label>
                <span aria-live="polite" style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: over ? CK.danger : CK.muted, whiteSpace: 'nowrap' }}>
                  {words}{wordLimit > 0 ? ` / ${wordLimit}` : ''} words
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <textarea
                  id={`dd-body-${d.id}`}
                  value={eBody}
                  onChange={(e) => { setProblem(null); setEBody(e.target.value); }}
                  style={{ ...bigField, fontSize: 14, lineHeight: 1.55, padding: '9px 12px', height: 'min(50dvh, 480px)', minHeight: 200, resize: 'vertical', paddingBottom: 46, boxShadow: over ? 'inset 0 0 0 2px rgba(163,65,47,0.6)' : bigField.boxShadow }}
                  placeholder="Say what you do, how, and when."
                />
                <div style={{ position: 'absolute', left: 10, bottom: 8 }}>
                  <AttachBar url={editAttach.url} uploading={editAttach.uploading} onPick={(f) => { setProblem(null); void editAttach.pick(f); }} onClear={() => editAttachSet(null)} disabled={saving} />
                </div>
              </div>
              {problem && <p role="alert" style={{ margin: '6px 0 0', fontSize: 13, fontWeight: 600, color: CK.danger }}>{problem}</p>}
              {over && !problem && <p style={{ margin: '6px 0 0', fontSize: 13, color: CK.danger }}>That is {words - wordLimit} words over the limit.</p>}
            </div>
          ) : (
            <BubbleView
              key={b.key}
              b={b}
              lead={b.key === 'directive' ? 'Directive' : b.key === 'reply' ? (sentBack ? CHAIR_SEND_BACK_WORD : 'Reply') : undefined}
              onEdit={editableNoteId === b.key ? () => startNoteEdit(b.key, b.body) : undefined}
              editor={editableNoteId === b.key && editingNote === b.key ? (
                <div style={{ marginTop: 4, minWidth: 'min(70vw, 420px)' }}>
                  <label htmlFor={`note-edit-${b.key}`} className="sr-only">Change your clarification</label>
                  <textarea
                    ref={noteEditBox}
                    id={`note-edit-${b.key}`}
                    value={noteDraft}
                    onChange={(e) => { setNoteProblem(null); setNoteDraft(e.target.value); }}
                    rows={3}
                    style={{ ...bigField, fontSize: 14, lineHeight: 1.5, padding: '8px 12px', minHeight: 72, resize: 'none' }}
                  />
                  {noteProblem && <p role="alert" style={{ margin: '4px 0 0', fontSize: 12.5, fontWeight: 600, color: CK.danger }}>{noteProblem}</p>}
                  <div className="flex items-center" style={{ gap: 8, marginTop: 6 }}>
                    <Btn tone="green" size="sm" disabled={noteSaving} onClick={() => { void saveNote(b.key); }}>{noteSaving ? 'Saving' : 'Save'}</Btn>
                    <Btn tone="ghost" size="sm" disabled={noteSaving} onClick={() => { setEditingNote(null); setNoteProblem(null); }}>Cancel</Btn>
                  </div>
                </div>
              ) : undefined}
            />
          )))}
          {!d.reply && !showEdit && withdrawn && (
            <p style={{ margin: '2px 0 0', fontSize: 13, color: CK.muted, textAlign: 'center' }}>This directive was withdrawn. The crisis team will not answer it.</p>
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
          </div>
        )}
        {isAuthor && !sentBack && !withdrawn && !showEdit && (
          <div style={barStyle}>
            <div className="flex items-end" style={{ gap: 8 }}>
              <label htmlFor={`note-${d.id}`} className="sr-only">Write to the backroom</label>
              <div style={{ position: 'relative', flex: 1 }}>
                <textarea
                  ref={noteBox}
                  id={`note-${d.id}`}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }}
                  rows={3}
                  style={{ ...bigField, fontSize: 14, lineHeight: 1.5, padding: '8px 12px', minHeight: 84, resize: 'none', paddingBottom: 40 }}
                  placeholder={d.status === 'clarify' ? 'Add the detail the backroom asked for' : 'Add a clarification for the backroom'}
                />
                <div style={{ position: 'absolute', left: 8, bottom: 6 }}>
                  <AttachBar url={attach.url} uploading={attach.uploading} onPick={(f) => { void attach.pick(f); }} onClear={() => attach.setUrl(null)} disabled={busy} />
                </div>
              </div>
              <Btn tone="green" icon={<Send size={16} strokeWidth={1.5} />} disabled={!text.trim() || busy || attach.uploading} onClick={send} style={{ height: 42, padding: '0 18px', fontSize: 14 }}>
                {busy ? 'Sending' : 'Send'}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </CrisisDialog>
  );
}
