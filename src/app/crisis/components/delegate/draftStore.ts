'use client';
// Gavelling Crisis: the delegate's unsent directive drafts, kept in this browser only (localStorage). The Send a Directive form
// writes them; a draft the sender saved on purpose ("Save as draft") is marked `saved` and also shows in My Directives, where it can
// be opened back in the form or deleted. Nothing here touches the database.

import { useCallback, useEffect, useState } from 'react';
import { THEMES } from '@/lib/crisis/types';

export type FormKind = 'personal' | 'joint' | 'committee';
export interface Draft {
  kind: FormKind;
  coauthors: string[];
  title: string;
  body: string;
  themes: string[];
  /** An optional picture, already uploaded; it goes in as the last line of the text. */
  image: string | null;
}
export const EMPTY: Draft = { kind: 'personal', coauthors: [], title: '', body: '', themes: [], image: null };

/** One unsent draft with when it last changed. `saved` = the sender pressed "Save as draft" (it shows in My Directives). */
export interface DraftEntry { id: string; at: number; draft: Draft; saved?: boolean }
export const MAX_DRAFTS = 30;

/** A stored draft read leniently: anything that is not shaped like one becomes empty. */
export function sanitizeDraft(p: Partial<Draft> | null | undefined): Draft {
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

export const newDraftId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
export const isEmptyDraft = (d: Draft) => d.title.trim() === '' && d.body.trim() === '' && d.themes.length === 0 && d.coauthors.length === 0 && d.image === null;
const sameDraft = (a: Draft, b: Draft) => a.kind === b.kind && a.title === b.title && a.body === b.body && a.image === b.image
  && a.themes.join('|') === b.themes.join('|') && a.coauthors.join('|') === b.coauthors.join('|');

/** The list with this draft saved in it (an empty draft is left out). Returns the SAME array when nothing changed. The `saved` mark is kept. */
export function upsertDraft(list: DraftEntry[], id: string, draft: Draft): DraftEntry[] {
  const at = list.findIndex((e) => e.id === id);
  if (isEmptyDraft(draft)) return at < 0 ? list : list.filter((e) => e.id !== id);
  if (at >= 0 && sameDraft(list[at].draft, draft)) return list;
  const next = at >= 0 ? list.map((e) => (e.id === id ? { ...e, at: Date.now(), draft } : e)) : [...list, { id, at: Date.now(), draft }];
  if (next.length <= MAX_DRAFTS) return next;
  // Too many: the oldest one that is not this one goes.
  const oldest = [...next].filter((e) => e.id !== id).sort((a, b) => a.at - b.at)[0];
  return next.filter((e) => e !== oldest);
}

export const draftListKey = (crisisId: string, memberId: string | null) => `gavelling-crisis-drafts:${crisisId}:${memberId ?? 'me'}`;
export const draftOldKey = (crisisId: string, memberId: string | null) => `gavelling-crisis-draft:${crisisId}:${memberId ?? 'me'}`;

/** Reads the drafts of this person in this crisis; the old single draft is carried over into the list. */
export function readStore(listKey: string, oldKey: string): { active: string; items: DraftEntry[] } {
  try {
    const raw = window.localStorage.getItem(listKey);
    if (raw) {
      const p = JSON.parse(raw) as { active?: unknown; items?: unknown };
      const items: DraftEntry[] = [];
      if (Array.isArray(p.items)) {
        for (const x of p.items as Array<{ id?: unknown; at?: unknown; draft?: unknown; saved?: unknown }>) {
          if (!x || typeof x.id !== 'string') continue;
          const draft = sanitizeDraft(x.draft as Partial<Draft>);
          if (!isEmptyDraft(draft)) items.push({ id: x.id, at: typeof x.at === 'number' && Number.isFinite(x.at) ? x.at : 0, draft, ...(x.saved === true ? { saved: true } : {}) });
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
export function draftLabel(d: Draft): string {
  const title = d.title.trim();
  if (title) return title;
  const words = d.body.trim().split(/\s+/).filter(Boolean);
  if (words.length) return words.slice(0, 8).join(' ') + (words.length > 8 ? ' ...' : '');
  return 'Untitled draft';
}


// ─────────── Telling the other parts of the page ───────────

const CHANGED = 'gavelling-crisis-drafts-changed';
const OPEN = 'gavelling-crisis-draft-open';

/** The store changed (the form saved, or a draft was removed from My Directives). `removed` = a draft deleted from outside the form. */
export function announceDraftsChanged(listKey: string, removed?: string): void {
  try { window.dispatchEvent(new CustomEvent(CHANGED, { detail: { listKey, removed: removed ?? null } })); } catch { /* nothing to tell */ }
}
export function onDraftsChanged(listKey: string, fn: (removed: string | null) => void): () => void {
  const h = (e: Event) => {
    const d = (e as CustomEvent<{ listKey?: string; removed?: string | null }>).detail;
    if (d?.listKey === listKey) fn(d.removed ?? null);
  };
  window.addEventListener(CHANGED, h);
  return () => window.removeEventListener(CHANGED, h);
}

const pendingOpenKey = (crisisId: string, memberId: string | null) => `gavelling-crisis-draft-open:${crisisId}:${memberId ?? 'me'}`;

/** Ask the Send a Directive form to open this draft. With the form on the page it hears it at once; otherwise it opens it when the home page loads. */
export function requestOpenDraft(crisisId: string, memberId: string | null, id: string): void {
  try { window.sessionStorage.setItem(pendingOpenKey(crisisId, memberId), id); } catch { /* the event below still works on the home page */ }
  try { window.dispatchEvent(new CustomEvent(OPEN, { detail: { listKey: draftListKey(crisisId, memberId), id } })); } catch { /* nothing to tell */ }
}
export function onOpenDraftRequest(listKey: string, fn: (id: string) => void): () => void {
  const h = (e: Event) => {
    const d = (e as CustomEvent<{ listKey?: string; id?: string }>).detail;
    if (d?.listKey === listKey && d.id) fn(d.id);
  };
  window.addEventListener(OPEN, h);
  return () => window.removeEventListener(OPEN, h);
}
/** The draft waiting to be opened (set by requestOpenDraft); reading it clears it. */
export function takePendingOpenDraft(crisisId: string, memberId: string | null): string | null {
  try {
    const k = pendingOpenKey(crisisId, memberId);
    const id = window.sessionStorage.getItem(k);
    if (id) window.sessionStorage.removeItem(k);
    return id;
  } catch { return null; }
}

// ─────────── The saved drafts, for My Directives ───────────

/** The drafts the sender saved on purpose, newest first, kept up to date, and a way to delete one. */
export function useSavedDrafts(crisisId: string, memberId: string | null): { drafts: DraftEntry[]; remove: (id: string) => void } {
  const listKey = draftListKey(crisisId, memberId);
  const oldKey = draftOldKey(crisisId, memberId);
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const read = useCallback(() => {
    const st = readStore(listKey, oldKey);
    setDrafts(st.items.filter((e) => e.saved).sort((a, b) => b.at - a.at));
  }, [listKey, oldKey]);
  useEffect(() => {
    const t = window.setTimeout(read, 0);
    const off = onDraftsChanged(listKey, () => read());
    const onStorage = (e: StorageEvent) => { if (e.key === listKey) read(); };
    window.addEventListener('storage', onStorage);
    return () => { window.clearTimeout(t); off(); window.removeEventListener('storage', onStorage); };
  }, [listKey, read]);
  const remove = useCallback((id: string) => {
    try {
      const st = readStore(listKey, oldKey);
      window.localStorage.setItem(listKey, JSON.stringify({ v: 1, active: st.active === id ? '' : st.active, items: st.items.filter((e) => e.id !== id) }));
    } catch { /* private window: nothing was kept anyway */ }
    announceDraftsChanged(listKey, id);
  }, [listKey, oldKey]);
  return { drafts, remove };
}
