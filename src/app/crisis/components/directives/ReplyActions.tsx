// Gavelling Crisis: what a reply does when it is sent. The staged changes of the side panel
// (replyDraft's EffectsDraft) become the effects of one crisis_answer_directive call.
// The old "Add an action" pop-up is gone: every kind of change now has its own always-visible
// section in EffectsPanel.

import type { AnswerEffects } from '@/lib/crisis/api';
import { isEmptySet } from '../map/mapEdits';
import type { EffectsDraft } from './replyDraft';

/** What the signed-in staffer may change from a reply (the director may change everything). */
export interface ReplyPowers { resources: boolean; units: boolean; map: boolean; characters: boolean }

/**
 * Turns the staged changes into the effects of one answer. A section the staffer has no power over is left out.
 * `mapToDraft`: the map parts (unit moves and amounts, country holders, the map edit set) are left out because they
 * were added to the shared unsent map instead (replyToDraft.ts); everything else still goes with the answer.
 */
export function effectsToAnswer(effects: EffectsDraft, powers: ReplyPowers, opts: { mapToDraft?: boolean } = {}): AnswerEffects {
  const out: AnswerEffects = {};
  const live = !opts.mapToDraft;
  if (powers.resources) {
    const rows = Object.entries(effects.resources).filter(([, delta]) => delta !== 0).map(([id, delta]) => ({ id, delta }));
    if (rows.length) out.resources = rows;
  }
  if (live && powers.units) {
    const rows = Object.entries(effects.units).map(([id, u]) => ({
      id,
      lng: u.lng !== undefined && u.lat !== undefined ? u.lng : undefined,
      lat: u.lng !== undefined && u.lat !== undefined ? u.lat : undefined,
      strength: u.strength,
    }));
    if (rows.length) out.units = rows;
  }
  if (live && powers.map) {
    const rows = Object.entries(effects.regions).map(([key, owner]) => ({ key, owner_cabinet_id: owner }));
    if (rows.length) out.regions = rows;
  }
  // Border changes and drawn territory ride in the answer as one edit set, applied in the same transaction.
  if (live && powers.map && !isEmptySet(effects.map)) out.map = effects.map as object;
  // The database ignores character changes from a backroomer without the power, so they are not offered or sent.
  const chars = !powers.characters ? [] : Object.entries(effects.characters).map(([id, c]) => ({ id, status: c.status, status_note: c.note.trim() || null }));
  if (chars.length) out.characters = chars;
  const n = effects.news;
  if (n && n.title.trim()) {
    out.news = { title: n.title.trim(), body: n.body.trim() || undefined, source_label: n.source.trim() || undefined, audience_cabinet_id: n.audience || null,
      banner_url: n.bannerUrl || null, attachment_url: n.fileUrl || null, attachment_name: n.fileUrl ? (n.fileName || null) : null,
    };
  }
  return out;
}
