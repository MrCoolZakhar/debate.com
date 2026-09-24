'use client';

// ============================================================
// src/lib/advisorBoard/store.ts
//
// The Faculty Advisor board's DEVICE store (24 Sep 2026). A code-only board lives on
// this device and nowhere else: the rooms an advisor follows, which delegations in each
// are theirs, and any first names they typed. Names never leave the device (owner).
//
//   localStorage `gavelling-advisor-board-v1`
//     { rooms: [{ code, addedAt, endedSeenAt?, follows: [{ country, name? }] }],
//       seen?: { [code]: epoch ms } }         // first time a conference room was seen
//
// A room is forgotten 7 days after it was first seen ended (`endedSeenAt`). Every access
// is wrapped: storage can be blocked (private window, previews) and the board must still
// render, it simply forgets on reload.
// ============================================================

import { useSyncExternalStore } from 'react';

export const BOARD_STORAGE_KEY = 'gavelling-advisor-board-v1';
export const PREFS_STORAGE_KEY = 'gavelling-advisor-board-prefs-v1';
/** A room is dropped this long after it was first seen ended. */
export const ENDED_ROOM_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

export interface BoardFollow {
  country: string;
  /** First name typed by the advisor. Device only, never sent anywhere. */
  name?: string;
}

export interface BoardRoom {
  code: string;
  addedAt: number;
  endedSeenAt?: number;
  follows: BoardFollow[];
}

export interface BoardState {
  rooms: BoardRoom[];
  /** When this device first saw a CONFERENCE room (the "no speech in 90 minutes" clock). */
  seen: Record<string, number>;
}

/** How the board lists students: one speakers-list across rooms, or grouped per committee. */
export type BoardView = 'queue' | 'committee';

export interface BoardPrefs {
  reminders: boolean;
  keepAwake: boolean;
  view: BoardView;
}

const EMPTY: BoardState = { rooms: [], seen: {} };
const DEFAULT_PREFS: BoardPrefs = { reminders: true, keepAwake: false, view: 'queue' };

export function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function parseState(raw: string | null): BoardState {
  if (!raw) return EMPTY;
  try {
    const v = JSON.parse(raw) as Partial<BoardState>;
    const rooms: BoardRoom[] = [];
    const codes = new Set<string>();
    for (const r of Array.isArray(v.rooms) ? v.rooms : []) {
      if (!r || typeof r.code !== 'string') continue;
      const code = normaliseCode(r.code);
      if (code.length !== 6 || codes.has(code)) continue;
      codes.add(code);
      const follows: BoardFollow[] = [];
      const seenCountries = new Set<string>();
      for (const f of Array.isArray(r.follows) ? r.follows : []) {
        if (!f || typeof f.country !== 'string' || !f.country.trim()) continue;
        const key = f.country.trim().toLowerCase();
        if (seenCountries.has(key)) continue;
        seenCountries.add(key);
        const name = typeof f.name === 'string' ? f.name.trim().slice(0, 40) : '';
        follows.push(name ? { country: f.country.trim(), name } : { country: f.country.trim() });
      }
      rooms.push({
        code,
        addedAt: Number.isFinite(r.addedAt) ? Number(r.addedAt) : Date.now(),
        ...(Number.isFinite(r.endedSeenAt) ? { endedSeenAt: Number(r.endedSeenAt) } : {}),
        follows,
      });
    }
    const seen: Record<string, number> = {};
    if (v.seen && typeof v.seen === 'object') {
      for (const [k, ts] of Object.entries(v.seen)) if (Number.isFinite(ts)) seen[normaliseCode(k)] = Number(ts);
    }
    return { rooms, seen };
  } catch {
    return EMPTY;
  }
}

// ── A tiny external store so every component reads one copy ────────────────

let current: BoardState | null = null;
let prefs: BoardPrefs | null = null;
const listeners = new Set<() => void>();

function read(): BoardState {
  if (current) return current;
  let raw: string | null = null;
  try { raw = localStorage.getItem(BOARD_STORAGE_KEY); } catch { raw = null; }
  current = pruneEnded(parseState(raw));
  return current;
}

function write(next: BoardState) {
  current = next;
  try { localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(next)); } catch { /* storage blocked: keep in memory */ }
  listeners.forEach((fn) => fn());
}

function pruneEnded(s: BoardState, now = Date.now()): BoardState {
  const rooms = s.rooms.filter((r) => !r.endedSeenAt || now - r.endedSeenAt < ENDED_ROOM_KEEP_MS);
  return rooms.length === s.rooms.length ? s : { ...s, rooms };
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === BOARD_STORAGE_KEY) { current = null; fn(); }
    if (e.key === PREFS_STORAGE_KEY) { prefs = null; fn(); }
  };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(fn); window.removeEventListener('storage', onStorage); };
}

const serverSnapshot = EMPTY;

export function useBoardState(): BoardState {
  return useSyncExternalStore(subscribe, read, () => serverSnapshot);
}

export function getBoardState(): BoardState {
  return read();
}

export function saveRoom(code: string, follows: BoardFollow[]) {
  const s = read();
  const c = normaliseCode(code);
  const existing = s.rooms.find((r) => r.code === c);
  const room: BoardRoom = existing ? { ...existing, follows } : { code: c, addedAt: Date.now(), follows };
  const rooms = existing ? s.rooms.map((r) => (r.code === c ? room : r)) : [...s.rooms, room];
  write({ ...s, rooms });
}

export function removeRoom(code: string) {
  const s = read();
  const c = normaliseCode(code);
  write({ ...s, rooms: s.rooms.filter((r) => r.code !== c) });
}

/** Record that a room was seen ended (once), and forget any room ended over 7 days ago. */
export function markRoomsEnded(codes: string[], now = Date.now()) {
  const s = read();
  const set = new Set(codes);
  let changed = false;
  const rooms = s.rooms.map((r) => {
    if (set.has(r.code) && !r.endedSeenAt) { changed = true; return { ...r, endedSeenAt: now }; }
    return r;
  });
  const next = pruneEnded({ ...s, rooms }, now);
  if (changed || next.rooms.length !== s.rooms.length) write(next);
}

/** First time this device saw a conference room (seeds the 90-minute cue). */
export function markSeen(codes: string[], now = Date.now()) {
  const s = read();
  const missing = codes.filter((c) => !s.seen[c]);
  if (missing.length === 0) return;
  const seen = { ...s.seen };
  for (const c of missing) seen[c] = now;
  write({ ...s, seen });
}

// ── Preferences (reminder bell, keep the screen awake, the list view) ───────

function readPrefs(): BoardPrefs {
  if (prefs) return prefs;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<BoardPrefs>) : {};
    prefs = {
      reminders: typeof v.reminders === 'boolean' ? v.reminders : DEFAULT_PREFS.reminders,
      keepAwake: typeof v.keepAwake === 'boolean' ? v.keepAwake : DEFAULT_PREFS.keepAwake,
      view: v.view === 'committee' ? 'committee' : 'queue',
    };
  } catch {
    prefs = { ...DEFAULT_PREFS };
  }
  return prefs;
}

export function useBoardPrefs(): BoardPrefs {
  return useSyncExternalStore(subscribe, readPrefs, () => DEFAULT_PREFS);
}

export function setBoardPref<K extends keyof BoardPrefs>(key: K, value: BoardPrefs[K]) {
  prefs = { ...readPrefs(), [key]: value };
  try { localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs)); } catch { /* keep in memory */ }
  listeners.forEach((fn) => fn());
}
