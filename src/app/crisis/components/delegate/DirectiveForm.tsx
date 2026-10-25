'use client';
// Gavelling Crisis: the "Send a Directive" form. The draft is kept in this browser until it is sent.
// Every SubmitResult is handled: ok clears the form; paused, cooldown and too_long keep the text.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PauseCircle, Send, Timer } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, submitDirective, type CrisisRef } from '@/lib/crisis/api';
import { THEMES, type Character, type DirectiveKind } from '@/lib/crisis/types';
import { Btn, Card, CardTitle, CK, FieldLabel, fieldStyle, Segmented } from '../../crisisKit';

export type WorldCharacter = Pick<Character, 'id' | 'cabinet_id' | 'name' | 'status' | 'title'>;

interface Draft {
  kind: 'personal' | 'joint';
  coauthors: string[];
  title: string;
  receiver: string;
  body: string;
  themes: string[];
  resources_used: string;
  goal: string;
  affects: string;
  covert: boolean;
}
const EMPTY: Draft = { kind: 'personal', coauthors: [], title: '', receiver: '', body: '', themes: [], resources_used: '', goal: '', affects: '', covert: true };

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
    return {
      ...EMPTY, ...p,
      kind: p.kind === 'joint' ? 'joint' : 'personal',
      coauthors: Array.isArray(p.coauthors) ? p.coauthors.filter((x) => typeof x === 'string') : [],
      themes: Array.isArray(p.themes) ? p.themes.filter((x) => typeof x === 'string') : [],
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

  useEffect(() => { setD(readDraft(draftKey)); setLoaded(true); }, [draftKey]);
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
  const toggle = (k: 'themes' | 'coauthors', val: string) => {
    setProblem(null);
    setD((p) => ({ ...p, [k]: p[k].includes(val) ? p[k].filter((x) => x !== val) : [...p[k], val] }));
  };

  const words = countWords(d.body);
  const over = wordLimit > 0 && words > wordLimit;
  const waitLeft = until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
  const needsCo = d.kind === 'joint' && d.coauthors.length === 0;
  const complete = d.title.trim() !== '' && d.receiver.trim() !== '' && d.body.trim() !== '';
  const canSend = open && complete && !over && !needsCo && waitLeft === 0 && !sending;

  const people = useMemo(() => {
    const list = world.filter((c) => c.id !== characterId && c.status !== 'dead');
    const groups = new Map<string, WorldCharacter[]>();
    for (const c of list) {
      const k = c.cabinet_id ?? 'none';
      groups.set(k, [...(groups.get(k) ?? []), c]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (a === ownCabinetId ? -1 : b === ownCabinetId ? 1 : 0))
      .map(([k, chars]) => ({ key: k, name: k === 'none' ? 'Others' : cabinetNames[k] ?? 'Another cabinet', chars }));
  }, [world, characterId, ownCabinetId, cabinetNames]);

  const send = async () => {
    if (!canSend || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setProblem(null);
    try {
      const kind: DirectiveKind = d.kind;
      const r = await submitDirective(cref, {
        kind, title: d.title.trim(), receiver: d.receiver.trim(), body: d.body.trim(), themes: d.themes,
        resources_used: d.resources_used.trim(), goal: d.goal.trim(), affects: d.affects.trim(), covert: d.covert,
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

  const chip = (on: boolean) => ({
    border: 0, borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: CK.font,
    background: on ? CK.greenBtn : CK.card, color: on ? '#FFFFFF' : CK.inkSoft,
    boxShadow: on ? CK.shadowSm : `inset 0 0 0 1px ${CK.hair}`, textAlign: 'left' as const, overflowWrap: 'anywhere' as const,
  });

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
          <Segmented<'personal' | 'joint'>
            ariaLabel="Kind of directive"
            value={d.kind}
            options={[{ value: 'personal', label: 'Personal' }, { value: 'joint', label: 'Joint' }]}
            onChange={(k) => set('kind', k)}
          />
        </div>

        {d.kind === 'joint' && (
          <div>
            <FieldLabel hint="Pick who signs it with you">Co-authors</FieldLabel>
            {people.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: CK.muted }}>There is nobody else to pick yet.</p>
            ) : (
              <div className="grid gap-3">
                {people.map((g) => (
                  <div key={g.key}>
                    <p style={{ margin: '0 0 5px', fontSize: 12, fontWeight: 700, color: CK.muted }}>{g.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {g.chars.map((c) => (
                        <button key={c.id} type="button" aria-pressed={d.coauthors.includes(c.id)} onClick={() => toggle('coauthors', c.id)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={chip(d.coauthors.includes(c.id))}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
          <div className="flex items-baseline justify-between gap-3">
            <FieldLabel htmlFor="dir-body">What do you want to happen?</FieldLabel>
            <span aria-live="polite" style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: over ? CK.danger : CK.muted, whiteSpace: 'nowrap' }}>
              {words}{wordLimit > 0 ? ` / ${wordLimit}` : ''} words
            </span>
          </div>
          <textarea id="dir-body" value={d.body} onChange={(e) => set('body', e.target.value)} rows={7} style={{ ...fieldStyle, resize: 'vertical', boxShadow: over ? 'inset 0 0 0 2px rgba(163,65,47,0.6)' : fieldStyle.boxShadow }} placeholder="Say what you do, how, and when." />
        </div>

        <div>
          <FieldLabel>Themes</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <button key={t} type="button" aria-pressed={d.themes.includes(t)} onClick={() => toggle('themes', t)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={chip(d.themes.includes(t))}>{t}</button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <FieldLabel htmlFor="dir-res">Resources used</FieldLabel>
            <input id="dir-res" value={d.resources_used} onChange={(e) => set('resources_used', e.target.value)} style={fieldStyle} placeholder="Money, troops..." />
          </div>
          <div>
            <FieldLabel htmlFor="dir-goal">Goal it serves</FieldLabel>
            <input id="dir-goal" value={d.goal} onChange={(e) => set('goal', e.target.value)} style={fieldStyle} placeholder="Why do this?" />
          </div>
          <div>
            <FieldLabel htmlFor="dir-aff">Who it affects</FieldLabel>
            <input id="dir-aff" value={d.affects} onChange={(e) => set('affects', e.target.value)} style={fieldStyle} placeholder="Who feels it?" />
          </div>
        </div>

        <div>
          <FieldLabel>Secret or public</FieldLabel>
          <Segmented<'covert' | 'overt'>
            ariaLabel="Secret or public"
            value={d.covert ? 'covert' : 'overt'}
            options={[{ value: 'covert', label: 'Covert (secret)' }, { value: 'overt', label: 'Overt (public)' }]}
            onChange={(k) => set('covert', k === 'covert')}
          />
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
