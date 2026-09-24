'use client';

// ============================================================
// src/lib/advisorBoard/data.ts
//
// Reads for the Faculty Advisor board (24 Sep 2026): batched anonymous reads of every
// followed room, like the organiser live wall, plus ONE light realtime channel for all
// of them, a 15 s poll while the tab is visible, and a catch-up on wake / online.
//
// Never read here: `committees.settings` (it holds the chair code), any `messages` row
// that is not the scoring ledger (chat includes private conversations), `feedback`
// (chair notes and ratings), `motions`. Nothing here writes.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { serverNow } from '../serverClock';
import type { CaucusState } from '../types';
import type { BoardLogEvent, RoomData, RoomDelegate, RoomDocument, RoomQueueRow } from './types';

const COMMITTEE_COLUMNS = 'id, code, name, topic, phase, session_origin, ended_at, suspended_at, caucus, speaker_time_limit, updated_at';
const POLL_MS = 15_000;
const COALESCE_MS = 300;

// ── The room lookup the "Add a room" flow uses ──────────────────────────────

export interface RoomPreview {
  id: string;
  code: string;
  name: string;
  topic: string;
  phase: string;
  sessionOrigin: 'conference' | 'standalone';
  endedAt: string | null;
  suspendedAt: string | null;
  delegates: RoomDelegate[];
}

export type LookupResult = { status: 'ok'; room: RoomPreview } | { status: 'not_found' } | { status: 'error'; error: unknown };

export async function lookupRoom(code: string): Promise<LookupResult> {
  try {
    const { data, error } = await supabase
      .from('committees')
      .select('id, code, name, topic, phase, session_origin, ended_at, suspended_at')
      .eq('code', code.toUpperCase())
      .maybeSingle();
    if (error) return { status: 'error', error };
    if (!data) return { status: 'not_found' };
    const row = data as Record<string, unknown>;
    const { data: dels, error: dErr } = await supabase
      .from('delegates')
      .select('id, country, is_observer, logo_url, status')
      .eq('committee_id', row.id as string)
      .order('country', { ascending: true });
    if (dErr) return { status: 'error', error: dErr };
    return {
      status: 'ok',
      room: {
        id: String(row.id),
        code: String(row.code),
        name: String(row.name ?? ''),
        topic: String(row.topic ?? ''),
        phase: String(row.phase ?? ''),
        sessionOrigin: row.session_origin === 'conference' ? 'conference' : 'standalone',
        endedAt: (row.ended_at as string | null) ?? null,
        suspendedAt: (row.suspended_at as string | null) ?? null,
        delegates: ((dels ?? []) as Record<string, unknown>[]).map(toDelegate),
      },
    };
  } catch (error) {
    return { status: 'error', error };
  }
}

// ── Row mappers ──────────────────────────────────────────────────────────────

function toDelegate(r: Record<string, unknown>): RoomDelegate {
  return {
    id: String(r.id ?? ''),
    country: String(r.country ?? ''),
    isObserver: r.is_observer === true,
    logoUrl: (r.logo_url as string | null) ?? null,
    status: String(r.status ?? 'absent'),
  };
}

function toQueue(r: Record<string, unknown>): RoomQueueRow {
  return { id: String(r.id), country: String(r.country ?? ''), position: Number(r.position ?? 0) };
}

const LEDGER_PREFIX = '__log__:';
const KNOWN_TYPES = new Set(['speech', 'motion-raised', 'motion-passed', 'motion-failed', 'motion-edited', 'right-of-reply']);

/** `__log__:` rows to board events. One speech per floor turn (exact `turnKey`), the same
 *  dedupe as scoring.ts; the legacy `|p:` keys are compared within 15 s. */
export function parseLedger(rows: { content: string }[]): BoardLogEvent[] {
  const out: BoardLogEvent[] = [];
  const seen = new Set<string>();
  const legacy = new Map<string, number[]>();
  for (const r of rows) {
    if (typeof r.content !== 'string' || !r.content.startsWith(LEDGER_PREFIX)) continue;
    let e: Record<string, unknown>;
    try { e = JSON.parse(r.content.slice(LEDGER_PREFIX.length)) as Record<string, unknown>; } catch { continue; }
    if (!e || typeof e !== 'object' || typeof e.country !== 'string') continue;
    const rawType = typeof e.type === 'string' ? e.type : 'speech';
    const type = (KNOWN_TYPES.has(rawType) ? rawType : 'other') as BoardLogEvent['type'];
    const turnKey = typeof e.turnKey === 'string' ? e.turnKey : null;
    const ts = typeof e.timestamp === 'string' ? e.timestamp : null;
    if (turnKey) {
      if (turnKey.includes('|p:')) {
        const at = ts ? new Date(ts).getTime() : NaN;
        const prior = legacy.get(turnKey) ?? [];
        if (prior.some((p) => !Number.isFinite(p) || !Number.isFinite(at) || Math.abs(at - p) < 15_000)) continue;
        legacy.set(turnKey, [...prior, at]);
      } else {
        if (seen.has(turnKey)) continue;
        seen.add(turnKey);
      }
    }
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    out.push({
      type,
      country: e.country,
      timestamp: ts,
      seconds: num(e.seconds),
      context: str(e.context),
      topic: str(e.topic),
      motionId: str(e.motionId),
      motionType: str(e.motionType),
      totalTime: num(e.totalTime),
      speakingTime: num(e.speakingTime),
      outcome: str(e.outcome),
      prevMotionId: str(e.prevMotionId),
    });
  }
  return out;
}

// ── Batched reads ────────────────────────────────────────────────────────────

type FetchResult = { ok: true; rooms: RoomData[]; foundCodes: Set<string> } | { ok: false; error: unknown };

async function fetchRooms(by: { codes?: string[]; ids?: string[] }): Promise<FetchResult> {
  try {
    let q = supabase.from('committees').select(COMMITTEE_COLUMNS);
    if (by.ids) q = q.in('id', by.ids);
    else q = q.in('code', by.codes ?? []);
    const { data: cRows, error: cErr } = await q;
    if (cErr) return { ok: false, error: cErr };
    const committees = (cRows ?? []) as Record<string, unknown>[];
    const ids = committees.map((c) => String(c.id));
    const foundCodes = new Set(committees.map((c) => String(c.code)));
    if (ids.length === 0) return { ok: true, rooms: [], foundCodes };

    const [csRes, slRes, dRes, docRes, ...msgRes] = await Promise.all([
      supabase.from('current_speaker').select('committee_id, country, time_remaining, started_at, time_granted, seated_at').in('committee_id', ids),
      supabase.from('speakers_list').select('id, committee_id, country, position, list_type, created_at').in('committee_id', ids)
        .order('position', { ascending: true }).order('created_at', { ascending: true }).order('id', { ascending: true }),
      supabase.from('delegates').select('id, committee_id, country, is_observer, logo_url, status').in('committee_id', ids),
      supabase.from('documents').select('committee_id, type, status, doc_code, title, sponsors').in('committee_id', ids),
      // The ledger ONLY, one read per room so the 1,000-row page cap applies per room.
      ...ids.map((id) => supabase.from('messages').select('content, created_at')
        .eq('committee_id', id).eq('recipient', '__log__').eq('sender', '__system__')
        .order('created_at', { ascending: true })),
    ]);
    for (const r of [csRes, slRes, dRes, docRes, ...msgRes]) if (r.error) return { ok: false, error: r.error };

    const now = serverNow();
    const byId = <T,>(rows: Record<string, unknown>[] | null, map: (r: Record<string, unknown>) => T) => {
      const m = new Map<string, T[]>();
      for (const r of rows ?? []) {
        const k = String(r.committee_id);
        const arr = m.get(k) ?? [];
        arr.push(map(r));
        m.set(k, arr);
      }
      return m;
    };
    const speakers = byId(csRes.data as Record<string, unknown>[] | null, (r) => r);
    const lists = byId(slRes.data as Record<string, unknown>[] | null, (r) => r);
    const dels = byId(dRes.data as Record<string, unknown>[] | null, toDelegate);
    const docs = byId(docRes.data as Record<string, unknown>[] | null, (r): RoomDocument => ({
      type: String(r.type ?? ''),
      status: String(r.status ?? ''),
      docCode: (r.doc_code as string | null) ?? null,
      title: String(r.title ?? ''),
      sponsors: Array.isArray(r.sponsors) ? (r.sponsors as unknown[]).map(String) : [],
    }));

    const rooms: RoomData[] = committees.map((c, i) => {
      const id = String(c.id);
      const cs = speakers.get(id)?.[0];
      const list = lists.get(id) ?? [];
      const msgs = (msgRes[i]?.data ?? []) as { content: string }[];
      return {
        id,
        code: String(c.code),
        name: String(c.name ?? ''),
        topic: String(c.topic ?? ''),
        phase: String(c.phase ?? ''),
        sessionOrigin: c.session_origin === 'conference' ? 'conference' : 'standalone',
        endedAt: (c.ended_at as string | null) ?? null,
        suspendedAt: (c.suspended_at as string | null) ?? null,
        caucus: (c.caucus && typeof c.caucus === 'object' ? (c.caucus as CaucusState) : null),
        speakerTimeLimit: Number.isFinite(c.speaker_time_limit) ? Number(c.speaker_time_limit) : 90,
        updatedAt: (c.updated_at as string | null) ?? null,
        current: cs ? {
          country: (cs.country as string | null) || null,
          timeRemaining: Number.isFinite(cs.time_remaining) ? Number(cs.time_remaining) : 0,
          startedAt: (cs.started_at as string | null) ?? null,
          timeGranted: Number.isFinite(cs.time_granted) ? Number(cs.time_granted) : null,
          seatedAt: (cs.seated_at as string | null) ?? null,
        } : null,
        gsl: list.filter((r) => r.list_type === 'gsl').map(toQueue),
        caucusQueue: list.filter((r) => r.list_type === 'caucus').map(toQueue),
        delegates: dels.get(id) ?? [],
        events: parseLedger(msgs),
        documents: docs.get(id) ?? [],
        fetchedAt: now,
      };
    });
    return { ok: true, rooms, foundCodes };
  } catch (error) {
    return { ok: false, error };
  }
}

// ── The live hook ────────────────────────────────────────────────────────────

export interface BoardData {
  /** By session code. */
  rooms: Record<string, RoomData>;
  /** Codes that were looked up and do not exist (deleted rooms). */
  missing: Set<string>;
  /** True once the first read of the current code set has answered. */
  loaded: boolean;
  /** serverNow() of the last read that succeeded. 0 = never. */
  lastOkAt: number;
  /** The realtime channel is SUBSCRIBED. */
  subscribed: boolean;
  /** The last read failed (the board keeps what it had). */
  failed: boolean;
  refresh: () => void;
}

export function useBoardData(codes: string[]): BoardData {
  const codesKey = [...new Set(codes)].sort().join(',');
  const [rooms, setRooms] = useState<Record<string, RoomData>>({});
  const [missing, setMissing] = useState<Set<string>>(() => new Set());
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [lastOkAt, setLastOkAt] = useState(0);
  const [subscribed, setSubscribed] = useState(false);
  const [failed, setFailed] = useState(false);

  const roomsRef = useRef(rooms);
  const codesRef = useRef<string[]>([]);
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);
  useEffect(() => { codesRef.current = codesKey ? codesKey.split(',') : []; }, [codesKey]);
  // Every read gets a sequence number; a room is only replaced by a read that STARTED
  // after the one it came from, so a slow poll can never put back an older queue over a
  // realtime refetch that already landed.
  const seqRef = useRef(0);
  const roomSeqRef = useRef<Map<string, number>>(new Map());

  const applyResult = useCallback((res: FetchResult, requestedCodes: string[] | null, key: string, seq: number) => {
    if (key !== codesRef.current.join(',')) return;   // the code set moved on meanwhile
    if (!res.ok) { setFailed(true); return; }
    setFailed(false);
    setLastOkAt(serverNow());
    const live = new Set(codesRef.current);
    const accepted = res.rooms.filter((r) => live.has(r.code) && (roomSeqRef.current.get(r.code) ?? -1) < seq);
    for (const r of accepted) roomSeqRef.current.set(r.code, seq);
    setRooms((prev) => {
      const next: Record<string, RoomData> = {};
      for (const [code, r] of Object.entries(prev)) if (live.has(code)) next[code] = r;
      for (const r of accepted) next[r.code] = r;
      if (requestedCodes) for (const c of requestedCodes) if (!res.foundCodes.has(c)) delete next[c];
      return next;
    });
    if (requestedCodes) {
      setMissing(new Set(requestedCodes.filter((c) => !res.foundCodes.has(c))));
      setLoadedKey(key);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    const list = codesRef.current;
    const key = list.join(',');
    if (list.length === 0) { setRooms({}); setMissing(new Set()); setLoadedKey(''); setLastOkAt(serverNow()); return; }
    const seq = ++seqRef.current;
    const res = await fetchRooms({ codes: list });
    applyResult(res, list, key, seq);
  }, [applyResult]);

  const fetchIds = useCallback(async (ids: string[]) => {
    const key = codesRef.current.join(',');
    const seq = ++seqRef.current;
    const res = await fetchRooms({ ids });
    applyResult(res, null, key, seq);
  }, [applyResult]);

  // First read of this code set, then a poll while the tab is visible.
  useEffect(() => {
    const first = window.setTimeout(() => { void fetchAll(); }, 0);
    const tick = () => { if (document.visibilityState === 'visible') void fetchAll(); };
    const iv = window.setInterval(tick, POLL_MS);
    const onVis = () => { if (document.visibilityState === 'visible') void fetchAll(); };
    const onOnline = () => { void fetchAll(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOnline);
    };
  }, [codesKey, fetchAll]);

  // One realtime channel for every followed room, rebuilt when the set of room ids changes.
  const idsKey = Object.values(rooms).map((r) => r.id).sort().join(',');
  useEffect(() => {
    if (!idsKey) return;
    const ids = idsKey.split(',');
    const idSet = new Set(ids);
    const dirty = new Set<string>();
    let timer: number | null = null;
    let everyRoom = false;
    const flush = () => {
      timer = null;
      if (everyRoom) { everyRoom = false; dirty.clear(); void fetchAll(); return; }
      const list = [...dirty];
      dirty.clear();
      if (list.length) void fetchIds(list);
    };
    const mark = (id: string | null) => {
      if (id && idSet.has(id)) dirty.add(id); else if (!id) everyRoom = true; else return;
      if (timer === null) timer = window.setTimeout(flush, COALESCE_MS);
    };
    const inList = `in.(${ids.join(',')})`;
    const pick = (p: { new?: Record<string, unknown>; old?: Record<string, unknown> }, col: string) => {
      const v = (p.new && p.new[col]) ?? (p.old && p.old[col]);
      return typeof v === 'string' ? v : null;
    };
    let channel: RealtimeChannel = supabase.channel(`advisor-board-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    for (const table of ['current_speaker', 'speakers_list', 'delegates'] as const) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `committee_id=${inList}` },
        (p: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => mark(pick(p, 'committee_id')));
    }
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'committees', filter: `id=${inList}` },
      (p: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => mark(pick(p, 'id')));
    // A filtered subscription does not receive DELETEs (the old row carries only its key),
    // so a delegation taken off a list is caught here: the deleted row's id is matched
    // against the queue rows this board already holds. Rows of other rooms are ignored.
    channel = channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'speakers_list' },
      (p: { old?: Record<string, unknown> }) => {
        const rowId = p.old && typeof p.old.id === 'string' ? p.old.id : null;
        if (!rowId) return;
        for (const r of Object.values(roomsRef.current)) {
          if (r.gsl.some((q) => q.id === rowId) || r.caucusQueue.some((q) => q.id === rowId)) { mark(r.id); return; }
        }
      });
    let wasSubscribed = false;
    channel.subscribe((status) => {
      const ok = status === 'SUBSCRIBED';
      setSubscribed(ok);
      // Realtime does not replay what was missed while the socket was down.
      if (ok && wasSubscribed) void fetchAll();
      if (ok) wasSubscribed = true;
    });
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      void supabase.removeChannel(channel);
      setSubscribed(false);
    };
  }, [idsKey, fetchAll, fetchIds]);

  return {
    rooms,
    missing,
    loaded: loadedKey === codesKey,
    lastOkAt,
    subscribed: subscribed && !!idsKey,
    failed,
    refresh: () => { void fetchAll(); },
  };
}
