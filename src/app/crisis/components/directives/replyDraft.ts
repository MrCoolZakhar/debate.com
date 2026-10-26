// Gavelling Crisis: the reply being written is saved on this device, one draft per directive,
// restored when the directive is opened again and cleared once the reply is sent. The draft holds
// the outcome, the text AND everything the reply will change when it is sent (resources, units,
// borders, characters, a newsflash). Nothing in it is written to the crisis until Send reply.
import type { CharacterStatus, DirectiveOutcome } from '@/lib/crisis/types';

/** A unit's staged change: a new place, a new amount, or both. */
export interface UnitStage { lng?: number; lat?: number; strength?: number }
export interface NewsStage { title: string; body: string; source: string; audience: string }

/** The kinds of card the side panel can hold. */
export type EffectCardKind = 'resources' | 'unit' | 'border' | 'character' | 'news';

/**
 * One card in "What happens when you send". It only remembers WHAT it is about; what it changes is
 * staged in the maps below (resources, units, regions, characters, news), so the send reads those.
 * target: resources `cab:<id>` or `char:<id>` ('' = the author's cabinet), unit id, country key,
 * character id; news has none.
 */
export interface EffectCard { id: string; kind: EffectCardKind; target: string }

export interface EffectsDraft {
  /** The cards on the panel, in the order they were added. */
  cards: EffectCard[];
  /** Resource id to the CHANGE (not the new amount). */
  resources: Record<string, number>;
  /** Unit id to what changes about it. */
  units: Record<string, UnitStage>;
  /** Country key to the cabinet that holds it from now on; null is nobody. */
  regions: Record<string, string | null>;
  /** Character id to the new status. */
  characters: Record<string, { status: CharacterStatus; note: string }>;
  news: NewsStage | null;
}

export interface ReplyDraft { outcome: DirectiveOutcome | null; reply: string; effects: EffectsDraft }

export const STAGEABLE_STATUSES: CharacterStatus[] = ['active', 'arrested', 'dead', 'missing'];

export const emptyEffects = (): EffectsDraft => ({ cards: [], resources: {}, units: {}, regions: {}, characters: {}, news: null });

export const newCardId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** How many things the reply will change (a newsflash with no title is not one yet). */
export function countChanges(e: EffectsDraft): number {
  return Object.keys(e.resources).length + Object.keys(e.units).length + Object.keys(e.regions).length
    + Object.keys(e.characters).length + (e.news && e.news.title.trim() ? 1 : 0);
}

const OUTCOMES = ['approved', 'partial', 'denied', 'clarify', 'later'] as const;
const keyOf = (crisisId: string, directiveId: string) => `gavelling-crisis-reply-draft:${crisisId}:${directiveId}`;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

function parseEffects(raw: unknown): EffectsDraft {
  const out = emptyEffects();
  if (!isObj(raw)) return out;
  if (isObj(raw.resources)) for (const [k, v] of Object.entries(raw.resources)) { const n = num(v); if (n !== undefined && n !== 0) out.resources[k] = n; }
  if (isObj(raw.units)) {
    for (const [k, v] of Object.entries(raw.units)) {
      if (!isObj(v)) continue;
      const s: UnitStage = { lng: num(v.lng), lat: num(v.lat), strength: num(v.strength) };
      if ((s.lng !== undefined && s.lat !== undefined) || s.strength !== undefined) out.units[k] = s;
    }
  }
  if (isObj(raw.regions)) for (const [k, v] of Object.entries(raw.regions)) { if (v === null || typeof v === 'string') out.regions[k] = v; }
  if (isObj(raw.characters)) {
    for (const [k, v] of Object.entries(raw.characters)) {
      if (!isObj(v)) continue;
      const status = STAGEABLE_STATUSES.find((s) => s === v.status);
      if (status) out.characters[k] = { status, note: typeof v.note === 'string' ? v.note : '' };
    }
  }
  if (isObj(raw.news)) {
    const n = raw.news;
    out.news = {
      title: typeof n.title === 'string' ? n.title : '', body: typeof n.body === 'string' ? n.body : '',
      source: typeof n.source === 'string' ? n.source : '', audience: typeof n.audience === 'string' ? n.audience : '',
    };
  }
  const CARD_KINDS: EffectCardKind[] = ['resources', 'unit', 'border', 'character', 'news'];
  if (Array.isArray(raw.cards)) {
    for (const c of raw.cards) {
      if (!isObj(c) || typeof c.id !== 'string') continue;
      const kind = CARD_KINDS.find((k) => k === c.kind);
      if (kind) out.cards.push({ id: c.id, kind, target: typeof c.target === 'string' ? c.target : '' });
    }
  } else {
    // A draft from before the cards: one card for everything that was staged.
    if (Object.keys(out.resources).length) out.cards.push({ id: newCardId(), kind: 'resources', target: '' });
    for (const k of Object.keys(out.units)) out.cards.push({ id: newCardId(), kind: 'unit', target: k });
    for (const k of Object.keys(out.regions)) out.cards.push({ id: newCardId(), kind: 'border', target: k });
    for (const k of Object.keys(out.characters)) out.cards.push({ id: newCardId(), kind: 'character', target: k });
    if (out.news) out.cards.push({ id: newCardId(), kind: 'news', target: '' });
  }
  return out;
}

export function readReplyDraft(crisisId: string, directiveId: string): ReplyDraft | null {
  try {
    const raw = window.localStorage.getItem(keyOf(crisisId, directiveId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<ReplyDraft> & { effects?: unknown };
    const reply = typeof v.reply === 'string' ? v.reply : '';
    const outcome = OUTCOMES.find((o) => o === v.outcome) ?? null;
    const effects = parseEffects(v.effects);
    return reply || outcome || countChanges(effects) > 0 || effects.news || effects.cards.length ? { outcome, reply, effects } : null;
  } catch {
    return null;
  }
}

/** Saves the draft, or removes it when there is nothing to keep. Returns whether a draft is now stored. */
export function writeReplyDraft(crisisId: string, directiveId: string, draft: ReplyDraft | null): boolean {
  try {
    const empty = !draft || (!draft.reply.trim() && !draft.outcome && countChanges(draft.effects) === 0 && !draft.effects.news && draft.effects.cards.length === 0);
    if (empty) {
      window.localStorage.removeItem(keyOf(crisisId, directiveId));
      return false;
    }
    window.localStorage.setItem(keyOf(crisisId, directiveId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}
