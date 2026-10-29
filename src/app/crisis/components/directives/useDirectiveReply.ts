'use client';
// Gavelling Crisis: the reply being written for one directive (outcome, text and the staged changes).
// Restored from this device, saved as it is typed, and written once, by send(), with every staged
// change in the same call to answerDirective.

import { useEffect, useRef, useState } from 'react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { answerDirective, crisisError, publishNews, saveNews, type CrisisRef } from '@/lib/crisis/api';
import type { Directive, DirectiveOutcome } from '@/lib/crisis/types';
import { effectsToAnswer, type ReplyPowers } from './ReplyActions';
import { isEmptySet, saveSet } from '../map/mapEdits';
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
 * earlier are internal notes and who the directive is with, both from the composer and the facts bar.
 * canPublishNews: the signed-in staffer may publish a story at once (the director, or backroom news without approval).
 */
export function useDirectiveReply(ref: CrisisRef, d: Directive, who: string, powers: ReplyPowers, onSent: () => void, canPublishNews = false): DirectiveReply {
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
  const setReply = (v: string) => { touched.current = true; setReplyText(v); setSaved(false); };
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
      writeReplyDraft(ref.id, d.id, null);
      // The answer saves a newsflash as a draft with its picture. The attached file, and publishing, follow here.
      const n = staged.news;
      let newsNote: string | null = null;
      if (n && res?.news_id) {
        try {
          if (n.attachment_url) {
            await saveNews(ref, res.news_id, {
              title: n.title, body: n.body || n.title, source_label: n.source_label ?? null, audience_cabinet_id: n.audience_cabinet_id ?? null,
              banner_url: n.banner_url ?? null, attachment_url: n.attachment_url, attachment_name: n.attachment_name ?? null,
            });
          }
          if (canPublishNews) await publishNews(ref, res.news_id);
          else newsNote = 'The newsflash waits on the News page for the Crisis Director to publish.';
        } catch (e) {
          newsNote = crisisError(e, 'The reply was sent, but the newsflash could not be finished. Open it on the News page.');
        }
      }
      // Edited outlines and drawn territory cannot ride in the answer (it carries holders only), so they are saved
      // now, through the same save the map page uses, and only because the reply was sent.
      let mapNote: string | null = null;
      if (powers.map && effects.map && !isEmptySet(effects.map)) {
        try { await saveSet(ref, effects.map); } catch (e) {
          mapNote = crisisError(e, 'The reply was sent, but the border changes could not be saved. Make them again on the Map page.');
        }
      }
      const notes = [newsNote, mapNote].filter(Boolean).join(' ');
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
