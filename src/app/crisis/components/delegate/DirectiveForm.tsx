'use client';
// Gavelling Crisis: the "Send a Directive" form. The draft is kept in this browser until it is sent.
// Every SubmitResult is handled: ok clears the form; paused, cooldown and too_long keep the text.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PauseCircle, Send, Timer } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, submitDirective, type CrisisRef } from '@/lib/crisis/api';
import { THEMES, type Character, type DirectiveKind } from '@/lib/crisis/types';
import { Btn, Card, CardTitle, CK, FieldLabel, fieldStyle, Segmented } from '../../crisisKit';
import MultiSelect, { type MultiOption } from './MultiSelect';
import { themeIcon } from './directiveUi';

export type WorldCharacter = Pick<Character, 'id' | 'cabinet_id' | 'name' | 'status' | 'title'> & { picture_url?: string | null };

type FormKind = 'personal' | 'joint' | 'committee';
interface Draft {
  kind: FormKind;
  coauthors: string[];
  title: string;
  receiver: string;
  body: string;
  themes: string[];
}
const EMPTY: Draft = { kind: 'personal', coauthors: [], title: '', receiver: '', body: '', themes: [] };

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
      receiver: typeof p.receiver === 'string' ? p.receiver : '',
      body: typeof p.body === 'string' ? p.body : '',
      themes: strings(p.themes).filter((t) => (THEMES as readonly string[]).includes(t)),
    };
  } catch { return EMPTY; }
}

export default function DirectiveForm({
  cref, memberId, characterId, world, ownCabinetId, cabinetNames, wordLimit, open, pausedNote, onSent,
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
}) {
  const draftKey = `gavelling-crisis-draft:${cref.id}:${memberId ?? 'me'}`;
  const [d, setD] = useState<Draft>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [problem, setProblem] = useState<string | null>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    const saved = readDraft(draftKey);
    // A saved cabinet directive makes no sense for someone without a cabinet.
    setD(saved.kind === 'committee' && !ownCabinetId ? { ...saved, kind: 'personal' } : saved);
    setLoaded(true);
  }, [draftKey, ownCabinetId]);
  useEffect(() => {
    if (!loaded) return;
    try {
      if (d === EMPTY) window.localStorage.removeItem(draftKey);
      else window.localStorage.setItem(draftKey, JSON.stringify(d));
    } catch { /* private window: the draft just is not kept */ }
  }, [d, draftKey, loaded]);

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

  const set = useCallback(<K extends keyof Draft>(k: K, val: Draft[K]) => { setProblem(null); setD((p) => ({ ...p, [k]: val })); }, []);
  const words = countWords(d.body);
  const over = wordLimit > 0 && words > wordLimit;
  const waitLeft = until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
  const needsCo = d.kind === 'joint' && d.coauthors.length === 0;
  const cabinetName = ownCabinetId ? cabinetNames[ownCabinetId] ?? 'your cabinet' : null;
  const complete = d.title.trim() !== '' && d.receiver.trim() !== '' && d.body.trim() !== '';
  const canSend = open && complete && !over && !needsCo && waitLeft === 0 && !sending;

  // Co-authors can be any character in the crisis, from any cabinet.
  const coauthorOptions = useMemo<MultiOption[]>(() => {
    const own = ownCabinetId ?? '';
    const groupName = (c: WorldCharacter) => (c.cabinet_id ? cabinetNames[c.cabinet_id] ?? 'Another cabinet' : 'Others');
    return world
      .filter((c) => c.id !== characterId && c.status !== 'dead')
      .map((c) => ({ value: c.id, label: c.title ? `${c.name}, ${c.title}` : c.name, group: groupName(c), mine: c.cabinet_id === own, name: c.name }))
      .sort((a, b) => (a.mine === b.mine ? a.group.localeCompare(b.group) || a.name.localeCompare(b.name) : a.mine ? -1 : 1))
      .map(({ value, label, group }) => ({ value, label, group }));
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
        kind, title: d.title.trim(), receiver: d.receiver.trim(), body: d.body.trim(), themes: d.themes,
        covert: true, // a personal directive is always secret
        coauthors: kind === 'joint' ? d.coauthors : [],
      });
      if (r.ok) {
        notifyOk(`Directive ${r.no} sent`);
        setD(EMPTY);
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
    <Card warm>
      <CardTitle icon={<Send size={18} strokeWidth={1.5} />}>Send a Directive</CardTitle>

      {!open && (
        <div className="flex items-start gap-2" style={{ background: 'rgba(142,36,36,0.09)', borderRadius: 14, padding: '10px 12px', marginBottom: 12, color: CK.red2, fontSize: 13.5, fontWeight: 600 }}>
          <PauseCircle size={18} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
          <span>Directives are paused. {pausedNote || 'You can write one now and send it when they open.'}</span>
        </div>
      )}

      <div className="grid gap-4">
        <div>
          <FieldLabel>Kind</FieldLabel>
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
          {d.kind === 'committee' && (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: CK.inkSoft }}>
              This goes to the backroom from the whole cabinet{cabinetName ? `, ${cabinetName}` : ''}.
            </p>
          )}
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="dir-title">Title</FieldLabel>
            <input id="dir-title" value={d.title} onChange={(e) => set('title', e.target.value)} maxLength={160} style={fieldStyle} placeholder="A short name for it" />
          </div>
          <div>
            <FieldLabel htmlFor="dir-to">To</FieldLabel>
            <input id="dir-to" value={d.receiver} onChange={(e) => set('receiver', e.target.value)} maxLength={160} style={fieldStyle} placeholder="Who must do it? For example the Navy" />
          </div>
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
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <FieldLabel htmlFor="dir-body">What do you want to happen?</FieldLabel>
            <span aria-live="polite" style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: over ? CK.danger : CK.muted, whiteSpace: 'nowrap' }}>
              {words}{wordLimit > 0 ? ` / ${wordLimit}` : ''} words
            </span>
          </div>
          <textarea id="dir-body" value={d.body} onChange={(e) => set('body', e.target.value)} rows={9} style={{ ...fieldStyle, resize: 'vertical', boxShadow: over ? 'inset 0 0 0 2px rgba(163,65,47,0.6)' : fieldStyle.boxShadow }} placeholder="Say what you do, how, and when." />
        </div>

        {problem && <p role="alert" style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: CK.danger }}>{problem}</p>}
        {over && !problem && <p style={{ margin: 0, fontSize: 13, color: CK.danger }}>That is {words - wordLimit} words over the limit.</p>}
        {needsCo && <p style={{ margin: 0, fontSize: 13, color: CK.muted }}>Pick at least one co-author for a joint directive.</p>}

        <div className="flex flex-wrap items-center gap-3">
          <Btn tone="green" icon={waitLeft > 0 ? <Timer size={16} strokeWidth={1.5} /> : <Send size={16} strokeWidth={1.5} />} disabled={!canSend} onClick={send}>
            {sending ? 'Sending' : waitLeft > 0 ? `Wait ${clock(waitLeft)}` : 'Send directive'}
          </Btn>
          {waitLeft > 0 && <span style={{ fontSize: 13, color: CK.inkSoft }}>You can send again in {clock(waitLeft)}.</span>}
          {(d.title || d.body) && !sending && (
            <Btn tone="ghost" onClick={() => { setProblem(null); setD(EMPTY); }}>Clear</Btn>
          )}
        </div>
      </div>
    </Card>
  );
}
