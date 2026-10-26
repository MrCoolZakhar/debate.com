'use client';
// Gavelling Crisis: the reply being written for one directive (outcome, text and the staged changes).
// Restored from this device, saved as it is typed, and written once, by send(), with every staged
// change in the same call to answerDirective.

import { useEffect, useRef, useState } from 'react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { answerDirective, crisisError, type CrisisRef } from '@/lib/crisis/api';
import type { Directive, DirectiveOutcome } from '@/lib/crisis/types';
import { effectsToAnswer, type ReplyPowers } from './ReplyActions';
import { emptyEffects, readReplyDraft, writeReplyDraft, type EffectsDraft } from './replyDraft';

export interface DirectiveReply {
  outcome: DirectiveOutcome | null;
  /** Clicking the chosen outcome again clears it. */
  toggleOutcome: (o: DirectiveOutcome) => void;
  reply: string;
  setReply: (v: string) => void;
  effects: EffectsDraft;
  setEffects: (next: EffectsDraft | ((prev: EffectsDraft) => EffectsDraft)) => void;
  saved: boolean;
  editing: boolean;
  startEditing: () => void;
  busy: boolean;
  canSend: boolean;
  send: () => Promise<void>;
}

export function useDirectiveReply(ref: CrisisRef, d: Directive, who: string, powers: ReplyPowers, onSent: () => void): DirectiveReply {
  const [stored] = useState(() => readReplyDraft(ref.id, d.id));
  const [outcome, setOutcome] = useState<DirectiveOutcome | null>(stored?.outcome ?? null);
  const [reply, setReplyText] = useState(stored?.reply ?? '');
  const [effects, setEffectsState] = useState<EffectsDraft>(stored?.effects ?? emptyEffects());
  const [saved, setSaved] = useState(!!stored);
  const [editing, setEditing] = useState(!!stored && d.status === 'answered');
  const [busy, setBusy] = useState(false);
  const sent = useRef(false);
  const firstRun = useRef(true);

  // Autosave, a moment after the last change.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const t = window.setTimeout(() => {
      if (sent.current) return;
      const untouched = d.status === 'answered' && reply === (d.reply ?? '') && outcome === d.outcome && !hasStaged(effects);
      if (untouched) return;
      setSaved(writeReplyDraft(ref.id, d.id, { outcome, reply, effects }));
    }, 600);
    return () => window.clearTimeout(t);
  }, [outcome, reply, effects, ref.id, d.id, d.status, d.reply, d.outcome]);

  const toggleOutcome = (o: DirectiveOutcome) => { setOutcome((cur) => (cur === o ? null : o)); setSaved(false); };
  const setReply = (v: string) => { setReplyText(v); setSaved(false); };
  const setEffects = (next: EffectsDraft | ((prev: EffectsDraft) => EffectsDraft)) => { setEffectsState(next); setSaved(false); };
  const startEditing = () => { setOutcome(d.outcome); setReplyText(d.reply ?? ''); setSaved(false); setEditing(true); };

  const canSend = !!outcome && !!reply.trim() && !busy;

  const send = async () => {
    if (!outcome || !reply.trim() || busy) return;
    setBusy(true);
    try {
      await answerDirective(ref, d.id, outcome, reply.trim(), effectsToAnswer(effects, powers));
      sent.current = true;
      writeReplyDraft(ref.id, d.id, null);
      notifyOk(`Reply sent to ${who}`, 'crisis-directive');
      setEditing(false);
      setSaved(false);
      setEffectsState(emptyEffects());
      onSent();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not send the reply. Your text and changes are kept, try again.'), 'crisis-directive');
    } finally { setBusy(false); }
  };

  return { outcome, toggleOutcome, reply, setReply, effects, setEffects, saved, editing, startEditing, busy, canSend, send };
}

function hasStaged(e: EffectsDraft): boolean {
  return Object.keys(e.resources).length + Object.keys(e.units).length + Object.keys(e.regions).length + Object.keys(e.characters).length > 0 || !!e.news;
}
