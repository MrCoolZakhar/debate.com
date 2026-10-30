'use client';
// Gavelling Crisis: the "Send a Directive" form, compact enough to sit on one screen at 1440x900. The
// draft is autosaved in this browser until it is sent or discarded, so leaving the page never loses it
// (a small "Draft saved" note says so, and "Discard draft" throws it away). Every SubmitResult is
// handled: ok clears the form; paused, cooldown and too_long keep the text.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, PauseCircle, Send, Timer } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, submitDirective, type CrisisRef, type DirectiveDraft } from '@/lib/crisis/api';
import { dirNumber } from '@/lib/crisis/format';
import { THEMES, type Character, type DirectiveKind } from '@/lib/crisis/types';
import { Btn, Card, CK, FieldLabel, fieldStyle, Segmented } from '../../crisisKit';
import MultiSelect, { type MultiOption } from './MultiSelect';
import { themeIcon } from './directiveUi';
import { AttachBar, useImageAttach } from './ImageAttach';
import { withAttached } from '../directives/attachedImage';

/** A directive copied back into the form ("Edit and send again" after the chair sent it back). A new token = a new copy. */
export interface DirectivePrefill { token: number; kind: DirectiveKind; title: string; body: string; image: string | null; themes: string[]; coauthors: string[] }

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

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function clock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function readDraft(key: string): Draft {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Partial<Draft>;
    const strings = (x: unknown) => (Array.isArray(x) ? x.filter((y): y is string => typeof y === 'string') : []);
    return {
      kind: p.kind === 'joint' || p.kind === 'committee' ? p.kind : 'personal',
      coauthors: strings(p.coauthors),
      title: typeof p.title === 'string' ? p.title : '',
      body: typeof p.body === 'string' ? p.body : '',
      themes: strings(p.themes).filter((t) => (THEMES as readonly string[]).includes(t)),
      image: typeof p.image === 'string' && p.image.startsWith('https://') ? p.image : null,
    };
  } catch { return EMPTY; }
}

export default function DirectiveForm({
  cref, memberId, characterId, world, ownCabinetId, cabinetNames, wordLimit, open, pausedNote, onSent, prefill,
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
  onSent: () => void;
  prefill?: DirectivePrefill | null;
}) {
  const draftKey = `gavelling-crisis-draft:${cref.id}:${memberId ?? 'me'}`;
  const [d, setD] = useState<Draft>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const sendingRef = useRef(false);
  const latest = useRef<Draft>(EMPTY);
  const attach = useImageAttach(cref);
  const attachSet = attach.setUrl;

  useEffect(() => {
    const saved = readDraft(draftKey);
    // A saved cabinet directive makes no sense for someone without a cabinet.
    setD(saved.kind === 'committee' && !ownCabinetId ? { ...saved, kind: 'personal' } : saved);
    attachSet(saved.image);
    setLoaded(true);
  }, [draftKey, ownCabinetId, attachSet]);
  // A directive copied back in replaces the form (the sender asked for it by pressing Edit and send again).
  useEffect(() => {
    if (!prefill || !loaded) return;
    const kind: FormKind = prefill.kind === 'joint' ? 'joint' : prefill.kind === 'committee' && ownCabinetId ? 'committee' : 'personal';
    setProblem(null); setConfirmDiscard(false);
    setD({ kind, coauthors: kind === 'joint' ? prefill.coauthors : [], title: prefill.title, body: prefill.body, themes: prefill.themes, image: prefill.image });
    attachSet(prefill.image);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.token, loaded]);
  const saveDraft = useCallback((draft: Draft) => {
    try {
      if (draft === EMPTY) window.localStorage.removeItem(draftKey);
      else window.localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch { /* private window: the draft just is not kept */ }
  }, [draftKey]);
  useEffect(() => {
    if (!loaded) return;
    // The picture is uploaded the moment it is picked; the draft remembers its address.
    const draft = d.image === attach.url ? d : { ...d, image: attach.url };
    latest.current = draft;
    saveDraft(draft);
  }, [d, attach.url, loaded, saveDraft]);
  // Closing the tab right after a keystroke still keeps the text.
  useEffect(() => {
    if (!loaded) return;
    const flush = () => saveDraft(latest.current);
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [loaded, saveDraft]);

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
  const hasDraft = d.title.trim() !== '' || d.body.trim() !== '' || d.themes.length > 0 || d.coauthors.length > 0 || attach.url !== null;
  const words = countWords(d.body);
  const over = wordLimit > 0 && words > wordLimit;
  const waitLeft = until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
  const needsCo = d.kind === 'joint' && d.coauthors.length === 0;
  const cabinetName = ownCabinetId ? cabinetNames[ownCabinetId] ?? 'your cabinet' : null;
  const complete = d.title.trim() !== '' && d.body.trim() !== '';
  const canSend = open && complete && !over && !needsCo && waitLeft === 0 && !sending && !attach.uploading;

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
      const kind: DirectiveKind = d.kind;
      const r = await submitDirective(cref, {
        kind, title: d.title.trim(), body: withAttached(d.body, attach.url), themes: d.themes,
        covert: true, // a personal directive is always secret
        coauthors: kind === 'joint' ? d.coauthors : [],
      } as DirectiveDraft); // no "To": the receiver is left out and the database stores none
      if (r.ok) {
        const num = dirNumber({ no: r.no, cabinet_no: r.cabinet_no ?? null });
        notifyOk(r.awaiting_chair ? `Directive ${num} sent to your chair` : `Directive ${num} sent`);
        setD(EMPTY);
        attach.setUrl(null);
        onSent();
      } else if (r.reason === 'cooldown') {
        setUntil(Date.now() + r.wait_seconds * 1000);
        setProblem('You sent one a moment ago. Your text is kept. You can send again when the timer ends.');
      } else if (r.reason === 'paused') {
        setProblem(r.note ? `Directives are paused. ${r.note}` : 'Directives are paused right now. Your text is kept.');
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

  return (
    <Card warm style={{ padding: '14px 18px 16px' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: 12 }}>
        <h2 className="flex items-center gap-2" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: CK.ink }}>
          <span style={{ color: CK.red, lineHeight: 0 }}><Send size={18} strokeWidth={1.5} aria-hidden /></span>
          Send a Directive
        </h2>
        {hasDraft && !sending && (
          <span className="inline-flex items-center flex-wrap" style={{ gap: 8, fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>
            <span className="inline-flex items-center" style={{ gap: 4 }}>
              <Check size={14} strokeWidth={1.8} aria-hidden style={{ color: CK.ok }} />Draft saved
            </span>
            {confirmDiscard ? (
              <>
                <button type="button" onClick={() => { setProblem(null); setConfirmDiscard(false); setD(EMPTY); attach.setUrl(null); }} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 12.5, fontWeight: 800, color: CK.danger, textDecoration: 'underline' }}>Yes, discard it</button>
                <button type="button" onClick={() => setConfirmDiscard(false)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 12.5, fontWeight: 800, color: CK.forest, textDecoration: 'underline' }}>Keep it</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDiscard(true)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: CK.font, fontSize: 12.5, fontWeight: 800, color: CK.forest, textDecoration: 'underline' }}>Discard draft</button>
            )}
          </span>
        )}
      </div>

      {!open && (
        <div className="flex items-start gap-2" style={{ background: 'rgba(142,36,36,0.09)', borderRadius: 12, padding: '8px 11px', marginBottom: 12, color: CK.red2, fontSize: 13, fontWeight: 600 }}>
          <PauseCircle size={17} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
          <span>Directives are paused. {pausedNote || 'You can write one now and send it when they open.'}</span>
        </div>
      )}

      <div className="grid gap-3">
        <div className="flex flex-wrap items-end" style={{ gap: '10px 16px' }}>
          <div style={{ flex: 'none' }}>
            <FieldLabel hint={d.kind === 'committee' ? `From the whole cabinet${cabinetName ? `, ${cabinetName}` : ''}` : undefined}>Kind</FieldLabel>
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
          </div>
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <FieldLabel htmlFor="dir-themes" hint="Optional">Themes</FieldLabel>
            <MultiSelect
              id="dir-themes"
              ariaLabel="Themes"
              options={themeOptions}
              value={d.themes}
              onChange={(v) => set('themes', v)}
              placeholder="Pick any that fit"
            />
          </div>
        </div>

        {d.kind === 'joint' && (
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
          <input id="dir-title" value={d.title} onChange={(e) => set('title', e.target.value)} maxLength={160} style={fieldStyle} placeholder="A short name for it" />
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
              style={{ ...fieldStyle, minHeight: 280, resize: 'vertical', paddingBottom: 50, boxShadow: over ? 'inset 0 0 0 2px rgba(163,65,47,0.6)' : fieldStyle.boxShadow }}
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
          <Btn tone="green" icon={waitLeft > 0 ? <Timer size={16} strokeWidth={1.5} /> : <Send size={16} strokeWidth={1.5} />} disabled={!canSend} onClick={send}>
            {sending ? 'Sending' : waitLeft > 0 ? `Wait ${clock(waitLeft)}` : 'Send directive'}
          </Btn>
          {waitLeft > 0 && <span style={{ fontSize: 13, color: CK.inkSoft }}>You can send again in {clock(waitLeft)}.</span>}
        </div>
      </div>
    </Card>
  );
}
