'use client';
// Gavelling Crisis: the reply being written for one directive (outcome, text and the staged changes).
// Restored from this device, saved as it is typed, and written once, by send(), with every staged
// change in the same call to answerDirective.

import { useEffect, useRef, useState } from 'react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { answerDirective, crisisError, markDrafting, type CrisisRef } from '@/lib/crisis/api';
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

/**
 * The reply being written. NOTHING reaches the crisis until send(): not the outcome, not the text, not a
 * single staged change (resources, units, borders, characters, a newsflash). The only things written
 * earlier are internal notes, who the directive is with, and the "being written" mark (crisis_mark_drafting: once on
 * the first keystroke, then at most once a minute while typing, switched off when the draft is emptied or the pop-up
 * is closed with nothing written). The answer carries the border changes and the newsflash with its file in the same
 * call, and the database publishes the story itself when this person may.
 */
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
  const touched = useRef(false);
  const latest = useRef({ outcome, reply, effects, d });
  useEffect(() => { latest.current = { outcome, reply, effects, d }; });
  /** When the "being written" mark was last sent (0 = not marked). */
  const markedAt = useRef(0);

  // Closing the pop-up (or moving to another directive) with nothing written takes the mark off.
  useEffect(() => () => {
    if (!markedAt.current || sent.current || latest.current.reply.trim()) return;
    markedAt.current = 0;
    markDrafting(ref, latest.current.d.id, false).catch(() => { /* presence only */ });
  }, [ref]);

  // Switching to another directive in the reader unmounts this one: the draft is kept on this device first.
  useEffect(() => () => {
    if (sent.current || !touched.current) return;
    const l = latest.current;
    const untouched = l.d.status === 'answered' && l.reply === (l.d.reply ?? '') && l.outcome === l.d.outcome && !hasStaged(l.effects);
    if (!untouched) writeReplyDraft(ref.id, l.d.id, { outcome: l.outcome, reply: l.reply, effects: l.effects });
  }, [ref.id]);

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

  const toggleOutcome = (o: DirectiveOutcome) => { touched.current = true; setOutcome((cur) => (cur === o ? null : o)); setSaved(false); };
  const setReply = (v: string) => {
    touched.current = true; setReplyText(v); setSaved(false);
    // Say that a reply is being written: on the first keystroke, then at most once a minute.
    if (v.trim()) {
      const t = Date.now();
      if (!markedAt.current || t - markedAt.current >= 60_000) {
        markedAt.current = t;
        markDrafting(ref, d.id, true).catch(() => { /* presence only */ });
      }
    } else if (markedAt.current) {
      markedAt.current = 0;
      markDrafting(ref, d.id, false).catch(() => { /* presence only */ });
    }
  };
  const setEffects = (next: EffectsDraft | ((prev: EffectsDraft) => EffectsDraft)) => { touched.current = true; setEffectsState(next); setSaved(false); };
  const startEditing = () => { touched.current = true; setOutcome(d.outcome); setReplyText(d.reply ?? ''); setSaved(false); setEditing(true); };

  const canSend = !!outcome && !!reply.trim() && !busy;

  const send = async () => {
    if (!outcome || !reply.trim() || busy) return;
    setBusy(true);
    try {
      const staged = effectsToAnswer(effects, powers);
      const res = await answerDirective(ref, d.id, outcome, reply.trim(), staged);
      sent.current = true;
      markedAt.current = 0;
      writeReplyDraft(ref.id, d.id, null);
      // The database published the story itself when this person may; otherwise it waits for the director.
      const notes = staged.news && res?.news_published === false ? 'The story waits for the director on the News page.' : '';
      notifyOk(notes ? `Reply sent to ${who}. ${notes}` : `Reply sent to ${who}`, 'crisis-directive');
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
  return Object.keys(e.resources).length + Object.keys(e.units).length + Object.keys(e.regions).length + Object.keys(e.characters).length > 0 || !!e.news || !!e.map || e.cards.length > 0;
}
