'use client';
// Gavelling Crisis: the "Send a Directive" form, compact enough to sit on one screen at 1440x900. Drafts are
// autosaved in this browser until they are sent or discarded, so leaving the page never loses them. There can be
// SEVERAL unsent drafts (owner, 1 Nov 2026): a small "Drafts" switcher in the header starts a new one, switches
// between them and deletes one; "Draft saved" says the current one is kept and "Discard draft" throws it away.
// The same form edits a directive that has not been answered yet ("Save changes") and sends a returned one
// again. Every SubmitResult is handled: ok clears the form; paused, cooldown and too_long keep the text.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Check, Landmark, PauseCircle, Plus, Send, Timer, Trash2, UserX, X } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, editDirective, resendDirective, submitDirective, type CrisisRef, type DirectiveDraft } from '@/lib/crisis/api';
import { dirNumber, timeAgo } from '@/lib/crisis/format';
import { THEMES, type Character, type DirectiveKind } from '@/lib/crisis/types';
import { Btn, Card, CK, FieldLabel, Segmented } from '../../crisisKit';
import MultiSelect, { type MultiOption } from './MultiSelect';
import { bigField, KIND_WORD, kindIcon, themeIcon } from './directiveUi';
import { AttachBar, useImageAttach } from './ImageAttach';
import { withAttached } from '../directives/attachedImage';

/** A directive copied back into the form ("Edit and send again" after the chair sent it back). A new token = a new copy. */
export interface DirectivePrefill { token: number; kind: DirectiveKind; title: string; body: string; image: string | null; themes: string[]; coauthors: string[] }

/**
 * A directive opened in the form to be changed. Default: a cabinet directive its chair returned ("Request changes"), edited and sent
 * again under the same number. mode 'edit': a directive nobody has answered yet, changed in place ("Save changes", editDirective).
 */
export interface DirectiveResend {
  token: number; directiveId: string; label: string; note: string | null; title: string; body: string; image: string | null;
  themes: string[]; receiver: string | null; covert: boolean;
  mode?: 'resend' | 'edit';
  /** The directive's kind (edit mode shows it; the kind cannot be changed). */
  kind?: DirectiveKind;
}

/** The cabinet the sender sits in, for the cabinet directive look. */
export interface FormCabinet { name: string; logo_url: string | null; color: string }

export type WorldCharacter = Pick<Character, 'id' | 'cabinet_id' | 'name' | 'status' | 'title'> & { picture_url?: string | null };

type FormKind = 'personal' | 'joint' | 'committee';
interface Draft {
  kind: FormKind;
  coauthors: string[];
  title: string;
  body: string;
  themes: string[];
  /** An optional picture, already uploaded; it goes in as the last line of the text. */
  image: string | null;
}
const EMPTY: Draft = { kind: 'personal', coauthors: [], title: '', body: '', themes: [], image: null };

/** The trailing attached-picture line, exactly as the database strips it (crisis_word_count): the picture never counts. */
const PICTURE_LINE = /(?:\r?\n){0,2}\[image\]\((https:\/\/[^\s()]+)\)\s*$/;

/** Counts like the server: take off the picture line, then split on whitespace. */
export function countWords(text: string): number {
  const t = text.replace(PICTURE_LINE, '').trim();
  return t ? t.split(/\s+/).length : 0;
}

/** The title and note of the banner for a character who cannot act (dead, arrested or missing). */
export function inactiveBanner(status: 'dead' | 'arrested' | 'missing', note?: string | null): { title: string; note: string | null } {
  const title = status === 'arrested' ? 'Your character has been arrested' : status === 'dead' ? 'Your character has died' : 'Your character is missing';
  return { title, note: note?.trim() || null };
}

function clock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A stored draft read leniently: anything that is not shaped like one becomes empty. */
function sanitizeDraft(p: Partial<Draft> | null | undefined): Draft {
  if (!p || typeof p !== 'object') return EMPTY;
  const strings = (x: unknown) => (Array.isArray(x) ? x.filter((y): y is string => typeof y === 'string') : []);
  return {
    kind: p.kind === 'joint' || p.kind === 'committee' ? p.kind : 'personal',
    coauthors: strings(p.coauthors),
    title: typeof p.title === 'string' ? p.title : '',
    body: typeof p.body === 'string' ? p.body : '',
    themes: strings(p.themes).filter((t) => (THEMES as readonly string[]).includes(t)),
    image: typeof p.image === 'string' && p.image.startsWith('https://') ? p.image : null,
  };
}

/** The old single draft (before there could be several). */
function readDraft(key: string): Draft {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY;
    return sanitizeDraft(JSON.parse(raw) as Partial<Draft>);
  } catch { return EMPTY; }
}

// ─────────── Several drafts on this device ───────────

/** One unsent draft with when it last changed. */
interface DraftEntry { id: string; at: number; draft: Draft }
const MAX_DRAFTS = 30;

const newDraftId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
const isEmptyDraft = (d: Draft) => d.title.trim() === '' && d.body.trim() === '' && d.themes.length === 0 && d.coauthors.length === 0 && d.image === null;
const sameDraft = (a: Draft, b: Draft) => a.kind === b.kind && a.title === b.title && a.body === b.body && a.image === b.image
  && a.themes.join('|') === b.themes.join('|') && a.coauthors.join('|') === b.coauthors.join('|');

/** The list with this draft saved in it (an empty draft is left out). Returns the SAME array when nothing changed. */
function upsertDraft(list: DraftEntry[], id: string, draft: Draft): DraftEntry[] {
  const at = list.findIndex((e) => e.id === id);
  if (isEmptyDraft(draft)) return at < 0 ? list : list.filter((e) => e.id !== id);
  if (at >= 0 && sameDraft(list[at].draft, draft)) return list;
  const next = at >= 0 ? list.map((e) => (e.id === id ? { id, at: Date.now(), draft } : e)) : [...list, { id, at: Date.now(), draft }];
  if (next.length <= MAX_DRAFTS) return next;
  // Too many: the oldest one that is not this one goes.
  const oldest = [...next].filter((e) => e.id !== id).sort((a, b) => a.at - b.at)[0];
  return next.filter((e) => e !== oldest);
}

/** Reads the drafts of this person in this crisis; the old single draft is carried over into the list. */
function readStore(listKey: string, oldKey: string): { active: string; items: DraftEntry[] } {
  try {
    const raw = window.localStorage.getItem(listKey);
    if (raw) {
      const p = JSON.parse(raw) as { active?: unknown; items?: unknown };
      const items: DraftEntry[] = [];
      if (Array.isArray(p.items)) {
        for (const x of p.items as Array<{ id?: unknown; at?: unknown; draft?: unknown }>) {
          if (!x || typeof x.id !== 'string') continue;
          const draft = sanitizeDraft(x.draft as Partial<Draft>);
          if (!isEmptyDraft(draft)) items.push({ id: x.id, at: typeof x.at === 'number' && Number.isFinite(x.at) ? x.at : 0, draft });
        }
      }
      return { active: typeof p.active === 'string' ? p.active : '', items };
    }
  } catch { /* fall through to the old single draft */ }
  const old = readDraft(oldKey);
  if (isEmptyDraft(old)) return { active: '', items: [] };
  const id = newDraftId();
  return { active: id, items: [{ id, at: Date.now(), draft: old }] };
}

/** What a draft is called in the list: its title, else its first words. */
function draftLabel(d: Draft): string {
  const title = d.title.trim();
  if (title) return title;
  const words = d.body.trim().split(/\s+/).filter(Boolean);
  if (words.length) return words.slice(0, 8).join(' ') + (words.length > 8 ? ' ...' : '');
  return 'Untitled draft';
}

/** The small underlined text buttons in the form's header (light on the cabinet's red band, forest on the plain one). */
function linkStyle(onRed: boolean): CSSProperties {
  return { border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 12.5, fontWeight: 800, color: onRed ? '#FFF4E6' : CK.forest, textDecoration: 'underline' };
}

export default function DirectiveForm({
  cref, memberId, characterId, world, ownCabinetId, cabinetNames, wordLimit, open, pausedNote, blockedReason, onSent, prefill, cabinet, resend, onResendDone,
}: {
  cref: CrisisRef;
  memberId: string | null;
  characterId: string | null;
  world: WorldCharacter[];
  ownCabinetId: string | null;
  cabinetNames: Record<string, string>;
  wordLimit: number;
  open: boolean;
  pausedNote: string | null;
  /** Set when this delegate's character cannot send (dead, arrested, missing): the form is locked with this reason. */
  blockedReason?: string | null;
  onSent: () => void;
  prefill?: DirectivePrefill | null;
  cabinet?: FormCabinet | null;
  /** Set to edit a directive the chair returned; the form then has its own state and never touches the saved draft. */
  resend?: DirectiveResend | null;
  onResendDone?: () => void;
}) {
  const draftKey = `gavelling-crisis-draft:${cref.id}:${memberId ?? 'me'}`; // the old single draft, carried over into the list
  const listKey = `gavelling-crisis-drafts:${cref.id}:${memberId ?? 'me'}`;
  const [d, setD] = useState<Draft>(EMPTY);
  // The unsent drafts on this device and the one being written (it is in the list once it has anything in it).
  const [items, setItems] = useState<DraftEntry[]>([]);
  const [activeId, setActiveId] = useState('');
  const [showDrafts, setShowDrafts] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const itemsRef = useRef<DraftEntry[]>([]);
  const activeRef = useRef('');
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const sendingRef = useRef(false);
  // One id per directive being written. A retry of the SAME send (a lost answer, then Try again) reuses it, so the
  // database returns the first directive instead of a second one. It is replaced after a send, on discard, and whenever the
  // content changed since the failed try.
  const requestRef = useRef<{ id: string; sig: string } | null>(null);
  // The database said this character cannot send; it holds only for that character (a new one unlocks the form).
  const [lockedFor, setLockedFor] = useState<{ character: string | null; text: string } | null>(null);
  const [editing, setEditing] = useState<DirectiveResend | null>(null);
  const editingRef = useRef(false);
  editingRef.current = editing !== null;
  const latest = useRef<Draft>(EMPTY);
  const attach = useImageAttach(cref);
  const attachSet = attach.setUrl;

  const fixKind = useCallback((x: Draft): Draft => (x.kind === 'committee' && !ownCabinetId ? { ...x, kind: 'personal' } : x), [ownCabinetId]);
  useEffect(() => {
    const st = readStore(listKey, draftKey);
    // Back where the sender left off; if that was a blank new draft, the newest unsent one is shown instead.
    const act = st.items.find((e) => e.id === st.active) ?? [...st.items].sort((x, y) => y.at - x.at)[0] ?? null;
    const saved = act ? fixKind(act.draft) : EMPTY;
    setItems(st.items);
    setActiveId(act ? act.id : newDraftId());
    setD(saved);
    attachSet(saved.image);
    setLoaded(true);
  }, [listKey, draftKey, fixKind, attachSet]);
  // The latest list and active id, for handlers that run after a render.
  useEffect(() => { itemsRef.current = items; activeRef.current = activeId; });
  // A directive copied back in starts a NEW draft (the sender asked for it by pressing Edit and send again); the draft they were writing stays in the list.
  useEffect(() => {
    if (!prefill || !loaded) return;
    const kind: FormKind = prefill.kind === 'joint' ? 'joint' : prefill.kind === 'committee' && ownCabinetId ? 'committee' : 'personal';
    setProblem(null); setConfirmDiscard(false); setShowDrafts(false);
    requestRef.current = null;
    setActiveId(newDraftId());
    setD({ kind, coauthors: kind === 'joint' ? prefill.coauthors : [], title: prefill.title, body: prefill.body, themes: prefill.themes, image: prefill.image });
    attachSet(prefill.image);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.token, loaded]);
  // A directive opened to be changed: the unsent drafts in this browser are left exactly as they are.
  useEffect(() => {
    if (!resend || !loaded) return;
    setEditing(resend);
    setProblem(null); setConfirmDiscard(false); setShowDrafts(false);
    const editKind: FormKind = resend.mode === 'edit' ? (resend.kind === 'joint' ? 'joint' : resend.kind === 'committee' ? 'committee' : 'personal') : 'committee';
    setD({ kind: editKind, coauthors: [], title: resend.title, body: resend.body, themes: resend.themes, image: resend.image });
    attachSet(resend.image);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resend?.token, loaded]);
  /** Puts the draft that was being written back in the form (after an edit ends). */
  const restoreActive = useCallback(() => {
    const e = itemsRef.current.find((x) => x.id === activeRef.current);
    const saved = e ? fixKind(e.draft) : EMPTY;
    setEditing(null);
    setProblem(null);
    setD(saved);
    attachSet(saved.image);
  }, [fixKind, attachSet]);
  const leaveEdit = useCallback(() => {
    restoreActive();
    onResendDone?.();
  }, [restoreActive, onResendDone]);
  const writeStore = useCallback((active: string, list: DraftEntry[]) => {
    try {
      window.localStorage.setItem(listKey, JSON.stringify({ v: 1, active, items: list }));
      window.localStorage.removeItem(draftKey); // the old single draft now lives in the list
    } catch { /* private window: the drafts just are not kept */ }
  }, [listKey, draftKey]);
  useEffect(() => {
    if (!loaded || editing || !activeId) return;
    // The picture is uploaded the moment it is picked; the draft remembers its address.
    const draft = d.image === attach.url ? d : { ...d, image: attach.url };
    latest.current = draft;
    setItems((prev) => upsertDraft(prev, activeId, draft));
  }, [d, attach.url, loaded, editing, activeId]);
  useEffect(() => {
    if (!loaded || !activeId) return;
    writeStore(activeId, items);
  }, [items, activeId, loaded, writeStore]);
  // Closing the tab right after a keystroke still keeps the text.
  useEffect(() => {
    if (!loaded) return;
    const flush = () => {
      if (editingRef.current || !activeRef.current) return;
      writeStore(activeRef.current, upsertDraft(itemsRef.current, activeRef.current, latest.current));
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [loaded, writeStore]);

  // Start another draft, switch to one, or delete one. The one being written is already saved in the list.
  const startFresh = useCallback(() => {
    setProblem(null); setConfirmDiscard(false); setShowDrafts(false);
    requestRef.current = null;
    setActiveId(newDraftId());
    setD(EMPTY);
    attachSet(null);
  }, [attachSet]);
  const openDraft = (id: string) => {
    const e = items.find((x) => x.id === id);
    if (!e) return;
    setProblem(null); setConfirmDiscard(false); setShowDrafts(false); setDeleting(null);
    requestRef.current = null;
    const next = fixKind(e.draft);
    setActiveId(id);
    setD(next);
    attachSet(next.image);
  };
  const deleteDraft = (id: string) => {
    setDeleting(null);
    if (id === activeId) { setProblem(null); setD(EMPTY); attachSet(null); requestRef.current = null; }
    else setItems((prev) => prev.filter((x) => x.id !== id));
  };

  // The countdown only ticks while a cooldown is running.
  useEffect(() => {
    if (until === null) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= until) { setUntil(null); setProblem(null); }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [until]);

  const set = useCallback(<K extends keyof Draft>(k: K, val: Draft[K]) => { setProblem(null); setConfirmDiscard(false); setD((p) => ({ ...p, [k]: val })); }, []);
  const isCab = d.kind === 'committee';
  const red = CK.red;
  const hasDraft = !editing && (d.title.trim() !== '' || d.body.trim() !== '' || d.themes.length > 0 || d.coauthors.length > 0 || attach.url !== null);
  const words = countWords(withAttached(d.body, attach.url));
  const over = wordLimit > 0 && words > wordLimit;
  const waitLeft = until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
  const changing = editing?.mode === 'edit'; // an unanswered directive changed in place
  const needsCo = !editing && d.kind === 'joint' && d.coauthors.length === 0;
  const cabinetName = ownCabinetId ? cabinetNames[ownCabinetId] ?? 'your cabinet' : null;
  const complete = d.title.trim() !== '' && d.body.trim() !== '';
  const blocked = blockedReason ?? (lockedFor && lockedFor.character === characterId ? lockedFor.text : null);
  // Changing a directive is not sending a new one: paused directives, a locked character and the cooldown do not stand in its way (the database decides).
  const canSend = changing
    ? complete && !over && !sending && !attach.uploading
    : open && !blocked && complete && !over && !needsCo && waitLeft === 0 && !sending && !attach.uploading;

  // Co-authors can be any character in the crisis, from any cabinet.
  const coauthorOptions = useMemo<MultiOption[]>(() => {
    const own = ownCabinetId ?? '';
    const groupName = (c: WorldCharacter) => (c.cabinet_id ? cabinetNames[c.cabinet_id] ?? 'Another cabinet' : 'Others');
    return world
      .filter((c) => c.id !== characterId && c.status !== 'dead' && c.status !== 'spare')
      .map((c) => ({ value: c.id, label: c.title ? `${c.name}, ${c.title}` : c.name, group: groupName(c), mine: c.cabinet_id === own, name: c.name, person: { name: c.name, title: c.title, picture_url: c.picture_url ?? null } }))
      .sort((a, b) => (a.mine === b.mine ? a.group.localeCompare(b.group) || a.name.localeCompare(b.name) : a.mine ? -1 : 1))
      .map(({ value, label, group, person }) => ({ value, label, group, person }));
  }, [world, characterId, ownCabinetId, cabinetNames]);

  const themeOptions = useMemo<MultiOption[]>(() => THEMES.map((t) => ({ value: t, label: t, icon: themeIcon(t) })), []);

  const send = async () => {
    if (!canSend || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setProblem(null);
    try {
      if (editing && editing.mode === 'edit') {
        const er = await editDirective(cref, editing.directiveId, {
          title: d.title.trim(), body: withAttached(d.body, attach.url), themes: d.themes, receiver: editing.receiver, covert: editing.covert,
        });
        if (er.ok) {
          notifyOk(`Directive ${editing.label} changed`);
          restoreActive();
          onResendDone?.();
          onSent();
        } else if (er.reason === 'being_answered') {
          setProblem('The crisis team is writing the answer right now, so it can\'t be changed. Your text is kept.');
          onSent();
        } else if (er.reason === 'answered') {
          setProblem('The crisis team already answered this directive, so it can\'t be changed.');
          onSent();
        } else {
          setProblem(`This is too long. The limit is ${"limit" in er ? er.limit : 300} words. Your text is kept, so shorten it and save again.`);
        }
        return;
      }
      if (editing) {
        const rr = await resendDirective(cref, editing.directiveId, {
          title: d.title.trim(), body: withAttached(d.body, attach.url), themes: d.themes, receiver: editing.receiver, covert: editing.covert,
        });
        if (rr.ok) {
          notifyOk(rr.awaiting_chair ? 'Sent again to your chair' : 'Sent to the backroom');
          restoreActive();
          onResendDone?.();
          onSent();
        } else if (rr.reason === 'paused') {
          setProblem(rr.note ? `Directives are paused. ${rr.note}` : 'Directives are paused right now. Your text is kept.');
          onSent();
        } else if (rr.reason === 'too_long') {
          setProblem(`This is too long. The limit is ${rr.limit} words. Your text is kept, so shorten it and send again.`);
        } else if ((rr as { reason?: string }).reason === 'inactive') {
          const st = (rr as { status?: 'dead' | 'arrested' | 'missing' }).status ?? 'missing';
          setLockedFor({ character: characterId, text: inactiveBanner(st).title });
          onSent();
        } else {
          notifyErr('Your chair already dealt with this directive, so it could not be sent again.');
          onSent();
        }
        return;
      }
      const kind: DirectiveKind = d.kind;
      const draft = {
        kind, title: d.title.trim(), body: withAttached(d.body, attach.url), themes: d.themes,
        covert: true, // a personal directive is always secret
        coauthors: kind === 'joint' ? d.coauthors : [],
      };
      // The same send keeps its id; changed content is a different send.
      const sig = JSON.stringify(draft);
      if (!requestRef.current || requestRef.current.sig !== sig) requestRef.current = { id: crypto.randomUUID(), sig };
      const r = await submitDirective(cref, { ...draft, request_id: requestRef.current.id } as DirectiveDraft); // no "To": the receiver is left out and the database stores none
      if (r.ok) {
        const num = dirNumber({ no: r.no, cabinet_no: r.cabinet_no ?? null });
        const again = (r as { repeat?: boolean }).repeat === true;
        notifyOk(again ? `Directive ${num} was already sent` : r.awaiting_chair ? `Directive ${num} sent to your chair` : `Directive ${num} sent`);
        requestRef.current = null;
        setD(EMPTY);
        attach.setUrl(null);
        const sentId = activeId;
        setItems((prev) => prev.filter((x) => x.id !== sentId)); // the sent draft leaves the list; the next one starts fresh
        setActiveId(newDraftId());
        onSent();
      } else if (r.reason === 'cooldown') {
        setUntil(Date.now() + r.wait_seconds * 1000);
        setProblem('You sent one a moment ago. Your text is kept. You can send again when the timer ends.');
      } else if (r.reason === 'paused') {
        setProblem(r.note ? `Directives are paused. ${r.note}` : 'Directives are paused right now. Your text is kept.');
        onSent();
      } else if (r.reason === 'inactive') {
        setLockedFor({ character: characterId, text: inactiveBanner(r.status).title });
        setProblem('Your character cannot send directives right now. Your text is kept.');
        onSent();
      } else {
        setProblem(`This is too long. The limit is ${r.limit} words. Your text is kept, so shorten it and send again.`);
      }
    } catch (e) {
      notifyErr(crisisError(e, 'Could not send the directive. Your text is kept, try again.'));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const band = cabinet?.color || red;
  return (
    <Card
      warm={!isCab}
      style={{
        padding: '14px 18px 16px', overflow: 'hidden',
        background: isCab ? `linear-gradient(180deg, #FFF1EC 0%, ${CK.redWash} 38%, #FFF9F5 100%)` : CK.redWash,
        boxShadow: isCab ? `${CK.shadow}, 0 0 0 2px rgba(142,36,36,0.55)` : CK.shadow,
        transition: 'box-shadow 220ms ease, background 220ms ease',
      }}
    >
      <div
        className="flex items-center justify-between gap-3 flex-wrap"
        style={{
          // As tall as its content in every mode: the icon / logo disc is the same size in both, and the cabinet line sits in the same row, so nothing jumps.
          margin: '-14px -18px 12px', padding: '10px 18px',
          background: isCab ? `linear-gradient(135deg, ${CK.red2}, ${CK.red} 70%, ${band})` : 'transparent',
          color: isCab ? '#FFF4E6' : CK.ink,
          transition: 'background 220ms ease, color 220ms ease',
        }}
      >
        <h2 className="flex items-center gap-2.5 min-w-0" style={{ margin: 0, fontSize: 17, lineHeight: 1.25, fontWeight: 800, color: isCab ? '#FFF4E6' : CK.ink }}>
          {isCab ? (
            cabinet?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cabinet.logo_url} alt="" width={30} height={30} style={{ width: 30, height: 30, borderRadius: 999, objectFit: 'cover', background: '#fff', boxShadow: '0 0 0 2px rgba(255,244,230,0.85)', flexShrink: 0 }} />
            ) : (
              <span aria-hidden className="grid place-items-center" style={{ width: 30, height: 30, borderRadius: 999, background: 'rgba(255,244,230,0.16)', boxShadow: '0 0 0 2px rgba(255,244,230,0.7)', flexShrink: 0 }}>
                <Landmark size={18} strokeWidth={1.5} />
              </span>
            )
          ) : (
            <span aria-hidden className="grid place-items-center" style={{ width: 30, height: 30, color: CK.red, flexShrink: 0 }}><Send size={18} strokeWidth={1.5} aria-hidden /></span>
          )}
          <span className="flex flex-wrap items-baseline" style={{ gap: '0 10px', overflowWrap: 'anywhere' }}>
            <span>{editing ? `${changing ? 'Edit' : 'Resend'} Directive ${editing.label}` : isCab ? 'Send a Cabinet Directive' : 'Send a Directive'}</span>
            {isCab && cabinetName && <span style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.85 }}>In the name of {cabinetName}</span>}
          </span>
        </h2>
        {editing && (
          <button type="button" onClick={leaveEdit} disabled={sending} className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E6]" style={{ gap: 4, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 12.5, fontWeight: 800, color: isCab ? '#FFF4E6' : CK.forest, textDecoration: 'underline' }}>
            <X size={14} strokeWidth={1.8} aria-hidden />Cancel
          </button>
        )}
        {!editing && !sending && (hasDraft || items.length > 0) && (
          <span className="inline-flex items-center flex-wrap" style={{ gap: 8, fontSize: 12.5, fontWeight: 600, color: isCab ? '#FFE9DC' : CK.inkSoft }}>
            {hasDraft && (
              <span className="inline-flex items-center" style={{ gap: 4 }}>
                <Check size={14} strokeWidth={1.8} aria-hidden style={{ color: isCab ? '#FFF4E6' : CK.ok }} />Draft saved
              </span>
            )}
            {items.length > 0 && (
              <button type="button" onClick={() => { setShowDrafts((v) => !v); setDeleting(null); }} aria-expanded={showDrafts} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ ...linkStyle(isCab), display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
                Drafts<b style={{ fontVariantNumeric: 'tabular-nums' }}>{items.length}</b>
              </button>
            )}
            {hasDraft && (confirmDiscard ? (
              <>
                <button type="button" onClick={() => { setProblem(null); setConfirmDiscard(false); deleteDraft(activeId); }} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ ...linkStyle(isCab), color: isCab ? '#FFF4E6' : CK.danger }}>Yes, discard it</button>
                <button type="button" onClick={() => setConfirmDiscard(false)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={linkStyle(isCab)}>Keep it</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDiscard(true)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={linkStyle(isCab)}>Discard draft</button>
            ))}
          </span>
        )}
      </div>

      {showDrafts && !editing && (
        <div role="region" aria-label="Your drafts" style={{ margin: '0 0 12px', borderRadius: 14, background: 'rgba(255,255,255,0.9)', boxShadow: `inset 0 0 0 1px ${CK.hair}`, padding: '8px 10px', color: CK.ink }}>
          <ul className="grid" style={{ gap: 4, margin: 0, padding: 0, listStyle: 'none' }}>
            {[...items].sort((x, y) => y.at - x.at).map((e) => {
              const on = e.id === activeId;
              return (
                <li key={e.id} className="flex items-center" style={{ gap: 6, borderRadius: 10, background: on ? CK.well : 'transparent', padding: '2px 4px' }}>
                  {deleting === e.id ? (
                    <>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: CK.ink, overflowWrap: 'anywhere' }}>Delete this draft?</span>
                      <button type="button" onClick={() => deleteDraft(e.id)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ ...linkStyle(false), color: CK.danger }}>Yes, delete it</button>
                      <button type="button" onClick={() => setDeleting(null)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={linkStyle(false)}>Keep it</button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => openDraft(e.id)}
                        aria-current={on ? 'true' : undefined}
                        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                        style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: CK.font, padding: '5px 4px', color: CK.ink }}
                      >
                        <b style={{ display: 'block', fontSize: 13.5, lineHeight: 1.3, fontWeight: 800, overflowWrap: 'anywhere' }}>{draftLabel(e.draft)}</b>
                        <span className="inline-flex items-center" style={{ gap: 5, fontSize: 12, fontWeight: 600, color: CK.muted }}>
                          <span style={{ lineHeight: 0 }}>{kindIcon(e.draft.kind, 12)}</span>{KIND_WORD[e.draft.kind]}, {on ? 'writing now' : timeAgo(new Date(e.at).toISOString())}
                        </span>
                      </button>
                      <button type="button" onClick={() => setDeleting(e.id)} aria-label={`Delete draft ${draftLabel(e.draft)}`} title="Delete draft" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 6, lineHeight: 0, color: CK.muted }}>
                        <Trash2 size={15} strokeWidth={1.5} aria-hidden />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <div style={{ marginTop: 8 }}>
            <Btn tone="ghost" size="sm" icon={<Plus size={14} strokeWidth={1.5} />} disabled={!hasDraft} onClick={startFresh}>New draft</Btn>
          </div>
        </div>
      )}

      {editing?.note && (
        <div style={{ background: 'rgba(142,36,36,0.09)', borderRadius: 12, padding: '8px 11px', marginBottom: 12, color: CK.red2, fontSize: 13, fontWeight: 600, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
          <b>Your chair asked for changes:</b> {editing.note}
        </div>
      )}

      {blocked && !changing && (
        <div className="flex items-start gap-2" style={{ background: 'rgba(142,36,36,0.09)', borderRadius: 12, padding: '8px 11px', marginBottom: 12, color: CK.red2, fontSize: 13, fontWeight: 600 }}>
          <UserX size={17} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
          <span>{blocked}. You cannot send directives until the crisis team gives you a new character.</span>
        </div>
      )}

      {!open && !changing && (
        <div className="flex items-start gap-2" style={{ background: 'rgba(142,36,36,0.09)', borderRadius: 12, padding: '8px 11px', marginBottom: 12, color: CK.red2, fontSize: 13, fontWeight: 600 }}>
          <PauseCircle size={17} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
          <span>Directives are paused. {pausedNote || 'You can write one now and send it when they open.'}</span>
        </div>
      )}

      <div className="grid gap-3">
        <div>
          <FieldLabel hint={isCab ? 'Sent in the name of the whole cabinet. Your chair may look at it first' : undefined}>Kind</FieldLabel>
          {editing ? (
            <span className="inline-flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 800, color: CK.red }}>
              {changing ? <>{kindIcon(d.kind, 15)}{KIND_WORD[d.kind]}</> : <><Landmark size={15} strokeWidth={1.5} aria-hidden />Cabinet</>}
            </span>
          ) : (
            <Segmented<FormKind>
              ariaLabel="Kind of directive"
              value={d.kind}
              options={[
                { value: 'personal', label: 'Personal' },
                { value: 'joint', label: 'Joint' },
                ...(ownCabinetId ? [{ value: 'committee' as const, label: 'Cabinet' }] : []),
              ]}
              onChange={(k) => set('kind', k)}
            />
          )}
        </div>
        <div>
          <FieldLabel htmlFor="dir-themes" hint="Optional">Themes</FieldLabel>
          <MultiSelect
            id="dir-themes"
            ariaLabel="Themes"
            options={themeOptions}
            value={d.themes}
            onChange={(v) => set('themes', v)}
            placeholder="Pick any that fit"
            iconsOnlyAfter={2}
          />
        </div>

        {d.kind === 'joint' && !editing && (
          <div>
            <FieldLabel htmlFor="dir-co" hint="Anyone in the crisis, from any cabinet">Co-authors</FieldLabel>
            <MultiSelect
              id="dir-co"
              ariaLabel="Co-authors"
              options={coauthorOptions}
              value={d.coauthors}
              onChange={(v) => set('coauthors', v)}
              placeholder="Pick who signs it with you"
              searchable
              emptyText="Nobody matches."
            />
          </div>
        )}

        <div>
          <FieldLabel htmlFor="dir-title">Title</FieldLabel>
          <input id="dir-title" value={d.title} onChange={(e) => set('title', e.target.value)} maxLength={160} style={{ ...bigField, height: 48 }} placeholder="A short name for it" />
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <FieldLabel htmlFor="dir-body">What do you want to happen?</FieldLabel>
            <span aria-live="polite" style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: over ? CK.danger : CK.muted, whiteSpace: 'nowrap' }}>
              {words}{wordLimit > 0 ? ` / ${wordLimit}` : ''} words
            </span>
          </div>
          <div style={{ position: 'relative' }}>
            <textarea id="dir-body" value={d.body} onChange={(e) => set('body', e.target.value)} rows={13}
              style={{ ...bigField, minHeight: 280, resize: 'vertical', paddingBottom: 50, boxShadow: over ? 'inset 0 0 0 2px rgba(163,65,47,0.6)' : bigField.boxShadow }}
              placeholder="Say what you do, how, and when." />
            <div style={{ position: 'absolute', left: 10, bottom: 9 }}>
              <AttachBar url={attach.url} uploading={attach.uploading} onPick={(f) => { setProblem(null); void attach.pick(f); }} onClear={() => attach.setUrl(null)} disabled={sending} />
            </div>
          </div>
        </div>

        {problem && <p role="alert" style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: CK.danger }}>{problem}</p>}
        {over && !problem && <p style={{ margin: 0, fontSize: 13, color: CK.danger }}>That is {words - wordLimit} words over the limit.</p>}
        {needsCo && <p style={{ margin: 0, fontSize: 13, color: CK.muted }}>Pick at least one co-author for a joint directive.</p>}

        <div className="flex flex-wrap items-center gap-3">
          <Btn tone={isCab ? 'red' : 'green'} icon={waitLeft > 0 && !editing ? <Timer size={16} strokeWidth={1.5} /> : changing ? <Check size={16} strokeWidth={1.5} /> : isCab ? <Landmark size={16} strokeWidth={1.5} /> : <Send size={16} strokeWidth={1.5} />} disabled={!canSend} onClick={send} style={isCab ? { padding: '10px 18px', fontSize: 14 } : undefined}>
            {sending ? (changing ? 'Saving' : 'Sending') : waitLeft > 0 && !editing ? `Wait ${clock(waitLeft)}` : changing ? 'Save changes' : editing ? 'Send again' : isCab ? 'Send cabinet directive' : 'Send directive'}
          </Btn>
          {waitLeft > 0 && !editing && <span style={{ fontSize: 13, color: CK.inkSoft }}>You can send again in {clock(waitLeft)}.</span>}
        </div>
      </div>
    </Card>
  );
}
