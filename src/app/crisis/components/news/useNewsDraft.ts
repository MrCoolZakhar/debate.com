'use client';
// Gavelling Crisis: the news composer's working copy. Everything typed is kept in this browser as it is
// typed (localStorage, every access in try/catch), so leaving the page, a reload or a crash never loses
// a story. It is separate from a draft saved to the crisis ("Save draft"), which the Crisis Director sees.

import { useCallback, useEffect, useRef, useState } from 'react';

export const ALL_ROOMS = 'all';

export interface NewsForm {
  editingId: string | null;
  title: string;
  body: string;
  source: string;
  audience: string;
  bannerUrl: string | null;
  fileUrl: string | null;
  fileName: string | null;
}

export const EMPTY_FORM: NewsForm = {
  editingId: null, title: '', body: '', source: '', audience: ALL_ROOMS, bannerUrl: null, fileUrl: null, fileName: null,
};

const keyFor = (crisisId: string) => `gavelling-crisis-news-draft:${crisisId}`;
const SAVE_DELAY_MS = 500;

const hasContent = (f: NewsForm) => !!(f.title.trim() || f.body.trim() || f.source.trim() || f.bannerUrl || f.fileUrl);

function read(crisisId: string): NewsForm | null {
  try {
    const raw = window.localStorage.getItem(keyFor(crisisId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<NewsForm>;
    const str = (x: unknown, d = '') => (typeof x === 'string' ? x : d);
    const opt = (x: unknown) => (typeof x === 'string' && x ? x : null);
    return {
      editingId: opt(p.editingId), title: str(p.title), body: str(p.body), source: str(p.source), audience: str(p.audience, ALL_ROOMS) || ALL_ROOMS,
      bannerUrl: opt(p.bannerUrl), fileUrl: opt(p.fileUrl), fileName: opt(p.fileName),
    };
  } catch { return null; }
}

function write(crisisId: string, f: NewsForm | null) {
  try {
    if (f && hasContent(f)) window.localStorage.setItem(keyFor(crisisId), JSON.stringify(f));
    else window.localStorage.removeItem(keyFor(crisisId));
  } catch { /* private window or full storage: the page still works */ }
}

export function useNewsDraft(crisisId: string) {
  const [form, setFormState] = useState<NewsForm>(() => (typeof window === 'undefined' ? EMPTY_FORM : read(crisisId) ?? EMPTY_FORM));
  const [savedAt, setSavedAt] = useState<number | null>(() => (typeof window === 'undefined' ? null : read(crisisId) ? Date.now() : null));
  const timer = useRef<number | null>(null);
  const latest = useRef(form);

  const flush = useCallback(() => {
    if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }
    write(crisisId, latest.current);
    setSavedAt(hasContent(latest.current) ? Date.now() : null);
  }, [crisisId]);

  const setForm = useCallback((patch: Partial<NewsForm>) => {
    latest.current = { ...latest.current, ...patch };
    setFormState(latest.current);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
  }, [flush]);

  /** Replaces the whole form (start over, or open a saved draft for editing). */
  const replace = useCallback((next: NewsForm) => {
    latest.current = next;
    setFormState(next);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
  }, [flush]);

  /** Forget the working copy at once (after publishing or discarding). */
  const discard = useCallback(() => {
    if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }
    latest.current = EMPTY_FORM;
    setFormState(EMPTY_FORM);
    write(crisisId, null);
    setSavedAt(null);
  }, [crisisId]);

  // Leaving the page with a pending autosave writes it first.
  useEffect(() => () => {
    if (timer.current !== null) { window.clearTimeout(timer.current); write(crisisId, latest.current); }
  }, [crisisId]);

  return { form, setForm, replace, discard, savedAt, hasContent: hasContent(form) };
}
