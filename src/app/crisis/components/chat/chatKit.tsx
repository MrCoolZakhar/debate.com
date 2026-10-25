'use client';
// Gavelling Crisis chat: what the dialog, the staff page and the unread hook share.
// Data (messages + the people they name), unread marks kept in this browser, small views.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { notifyErr } from '@/lib/appNotify';
import { crisisError, listMessages, loadWorld } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Cabinet, CharacterStatus, CrisisMessage } from '@/lib/crisis/types';
import { CK, cabinetTint } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';

// ─────────── People ───────────

export interface Person {
  id: string;
  name: string;
  cabinetId: string | null;
  status: CharacterStatus;
  title: string | null;
  pictureUrl: string | null;
}

export const REMOVED_PERSON: Person = { id: '', name: 'Removed character', cabinetId: null, status: 'active', title: null, pictureUrl: null };

export function cabinetLabel(c: Cabinet | undefined): string {
  return c ? (c.short_name || c.name) : '';
}

// ─────────── Time ───────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const pad = (n: number) => String(n).padStart(2, '0');

/** List time: "14:05" today, weekday within a week, else "12 Oct". */
export function stamp(iso: string, nowMs = Date.now()): string {
  const d = new Date(iso);
  const days = Math.round((startOfDay(new Date(nowMs)) - startOfDay(d)) / 86400000);
  if (days <= 0) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (days < 7) return DAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export const clock = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const fullStamp = (iso: string) => { const d = new Date(iso); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${clock(iso)}`; };
export function dayLabel(iso: string, nowMs = Date.now()): string {
  const d = new Date(iso);
  const days = Math.round((startOfDay(new Date(nowMs)) - startOfDay(d)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export const sameDay = (a: string, b: string) => startOfDay(new Date(a)) === startOfDay(new Date(b));

// ─────────── Unread marks (this browser, per crisis and member) ───────────

const READ_EVENT = 'gavelling-crisis-chat-read';
const readKey = (crisisId: string, who: string) => `gavelling-crisis-chat-read:${crisisId}:${who}`;

export function readMarks(crisisId: string, who: string): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(readKey(crisisId, who));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch { return {}; }
}

export function markRead(crisisId: string, who: string, otherId: string, ts: number) {
  try {
    const marks = readMarks(crisisId, who);
    if ((marks[otherId] ?? 0) >= ts) return;
    marks[otherId] = ts;
    window.localStorage.setItem(readKey(crisisId, who), JSON.stringify(marks));
  } catch { /* private window: unread just stays */ }
  try { window.dispatchEvent(new Event(READ_EVENT)); } catch { /* ignore */ }
}

/** The marks, re-read when this tab or another tab marks a thread read. */
export function useReadMarks(crisisId: string, who: string): Record<string, number> {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(READ_EVENT, bump);
    window.addEventListener('storage', bump);
    return () => { window.removeEventListener(READ_EVENT, bump); window.removeEventListener('storage', bump); };
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (typeof window === 'undefined' ? {} : readMarks(crisisId, who)), [crisisId, who, version]);
}

export const msTime = (iso: string) => new Date(iso).getTime();

/** A message that reached `me` and is newer than the last time that thread was read. */
export function isUnreadFor(m: CrisisMessage, me: string, marks: Record<string, number>): boolean {
  return m.to_character_id === me && m.status === 'sent' && !!m.from_character_id && msTime(m.created_at) > (marks[m.from_character_id] ?? 0);
}

// ─────────── Threads of one character ───────────

export interface Thread { otherId: string; messages: CrisisMessage[]; last: CrisisMessage }

export function buildThreads(messages: CrisisMessage[], me: string): Thread[] {
  const by = new Map<string, CrisisMessage[]>();
  for (const m of messages) {
    const other = m.from_character_id === me ? m.to_character_id : m.to_character_id === me ? m.from_character_id : null;
    if (!other) continue;
    const list = by.get(other);
    if (list) list.push(m); else by.set(other, [m]);
  }
  const out: Thread[] = [];
  for (const [otherId, list] of by) {
    list.sort((a, b) => msTime(a.created_at) - msTime(b.created_at));
    out.push({ otherId, messages: list, last: list[list.length - 1] });
  }
  out.sort((a, b) => msTime(b.last.created_at) - msTime(a.last.created_at));
  return out;
}

// ─────────── Data ───────────

export interface ChatData {
  messages: CrisisMessage[] | null;
  error: string | null;
  people: Map<string, Person>;
  cabinets: Map<string, Cabinet>;
  reload: () => Promise<void>;
  /** Put a just-sent message on screen before the re-read lands. */
  addLocal: (m: CrisisMessage) => void;
  retry: () => void;
}

/** Messages (live) and the people they name: own cabinet from the core, others from the world list. */
export function useChatData(): ChatData {
  const { ref, staff, core } = useCrisis();
  const [messages, setMessages] = useState<CrisisMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [world, setWorld] = useState<Person[]>([]);
  const loadedOnce = useRef(false);
  const seq = useRef(0);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const rows = await listMessages(ref);
      if (mine !== seq.current) return; // a newer read is on its way
      loadedOnce.current = true;
      setMessages(rows);
      setError(null);
    } catch (e) {
      // A failed re-read keeps what is on screen; only the first load shows the problem.
      if (!loadedOnce.current) setError(crisisError(e, 'Could not load the messages.'));
      else notifyErr(crisisError(e, 'Could not refresh the messages.'), 'crisis-chat-refresh');
    }
  }, [ref]);

  const reloadWorld = useCallback(async () => {
    if (staff) return;
    try {
      const rows = await loadWorld(ref);
      setWorld(rows.map((r) => ({ id: r.id, name: r.name, cabinetId: r.cabinet_id, status: r.status, title: r.title, pictureUrl: r.picture_url })));
    } catch { /* the core characters still name your own cabinet */ }
  }, [ref, staff]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    listMessages(ref).then((rows) => {
      if (cancelled) return;
      loadedOnce.current = true;
      setMessages(rows);
    }).catch((e) => { if (!cancelled && !loadedOnce.current) setError(crisisError(e, 'Could not load the messages.')); });
    return () => { cancelled = true; };
  }, [ref, attempt]);

  useEffect(() => {
    let cancelled = false;
    if (staff) return;
    loadWorld(ref).then((rows) => {
      if (cancelled) return;
      setWorld(rows.map((r) => ({ id: r.id, name: r.name, cabinetId: r.cabinet_id, status: r.status, title: r.title, pictureUrl: r.picture_url })));
    }).catch(() => { /* see reloadWorld */ });
    return () => { cancelled = true; };
  }, [ref, staff]);

  useCrisisLive(ref.id, ['crisis_messages', 'crisis_characters'], (changed) => {
    if (!changed || changed.has('crisis_messages')) void reload();
    if (!changed || changed.has('crisis_characters')) void reloadWorld();
  });

  const addLocal = useCallback((m: CrisisMessage) => {
    setMessages((prev) => (prev && !prev.some((x) => x.id === m.id) ? [...prev, m] : prev));
  }, []);

  const people = useMemo(() => {
    const map = new Map<string, Person>();
    for (const w of world) map.set(w.id, w);
    for (const c of core.characters) {
      map.set(c.id, { id: c.id, name: c.name, cabinetId: c.cabinet_id, status: c.status, title: c.title, pictureUrl: c.picture_url });
    }
    return map;
  }, [world, core.characters]);

  const cabinets = useMemo(() => new Map(core.cabinets.map((c) => [c.id, c])), [core.cabinets]);

  return { messages, error, people, cabinets, reload, addLocal, retry: () => setAttempt((a) => a + 1) };
}

// ─────────── Small views ───────────

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

/** Round picture or initials, ringed in the cabinet colour. */
export function Avatar({ person, cabinet, size = 38, dim }: { person: Person; cabinet?: Cabinet; size?: number; dim?: boolean }) {
  const ring = cabinet?.color ?? CK.hair;
  const common = { width: size, height: size, borderRadius: '50%', flex: 'none' as const, boxShadow: `0 0 0 2px ${ring}`, opacity: dim ? 0.55 : 1 };
  if (person.pictureUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={person.pictureUrl} alt="" width={size} height={size} style={{ ...common, objectFit: 'cover', filter: dim ? 'grayscale(1)' : undefined }} />;
  }
  return (
    <span aria-hidden className="inline-flex items-center justify-center"
      style={{ ...common, background: cabinet ? cabinetTint(cabinet.color, 0.22) : CK.well, color: CK.ink, fontSize: Math.round(size * 0.36), fontWeight: 800 }}>
      {initialsOf(person.name)}
    </span>
  );
}

export const BUBBLE_MINE = 'rgba(142,36,36,0.11)';

export const iconBtn: React.CSSProperties = {
  border: 0, background: 'transparent', cursor: 'pointer', color: CK.inkSoft, borderRadius: 10, padding: 6, lineHeight: 0, flex: 'none',
};
