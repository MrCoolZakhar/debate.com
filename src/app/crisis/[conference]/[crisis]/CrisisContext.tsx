'use client';
// Gavelling Crisis: what every page under /crisis/<conference>/<crisis> shares.
// The layout resolves who the viewer is (account or personal code), loads the core world
// (crisis, cabinets, people, characters) and keeps it live. Pages read it with useCrisis().

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { crisisError, heartbeat, loadCore, readPresence, resolveCrisis, type CrisisCore, type CrisisRef } from '@/lib/crisis/api';
import { ensureServerClock } from '@/lib/serverClock';
import { useCrisisLive } from '@/lib/crisis/live';
import { readSettings, isDirector, isStaff, type CrisisRole, type CrisisSettings, type ResolvedCrisis } from '@/lib/crisis/types';

export interface CrisisContextValue {
  ref: CrisisRef;
  role: CrisisRole;
  memberId: string | null;
  cabinetId: string | null;
  characterId: string | null;
  displayName: string | null;
  conference: NonNullable<ResolvedCrisis['conference']>;
  core: CrisisCore;
  settings: CrisisSettings;
  staff: boolean;
  director: boolean;
  live: boolean;
  /** Re-read the core world now (after a write the page made). */
  reloadCore: () => Promise<void>;
  /** A screen that shows who is online calls this (use usePresencePoll). While any does, ONE poll re-reads the members' last_seen_at
   *  every 60 s with the tab visible, because a heartbeat no longer pings the live channel. Returns the release function. */
  watchPresence: () => () => void;
}

const Ctx = createContext<CrisisContextValue | null>(null);

export function useCrisis(): CrisisContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCrisis must be used inside the crisis layout');
  return v;
}

/** Keeps the "online" figures of the calling screen fresh (one shared poller, however many screens call it). */
export function usePresencePoll(): void {
  const { watchPresence } = useCrisis();
  useEffect(() => watchPresence(), [watchPresence]);
}

export type CrisisGate =
  | { state: 'loading' }
  | { state: 'not_found' }
  | { state: 'denied' }
  | { state: 'error'; message: string }
  | { state: 'ready'; value: CrisisContextValue };

/** Resolves and loads the crisis. `identityKey` changes when the viewer changes (user id or code token). */
export function useCrisisGate(conf: string, crisis: string, identityKey: string): { gate: CrisisGate; retry: () => void } {
  const [resolved, setResolved] = useState<ResolvedCrisis | null>(null);
  const [core, setCore] = useState<CrisisCore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loading = useRef(false);

  useEffect(() => { ensureServerClock(); }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const r = await resolveCrisis(conf, crisis);
        if (cancelled) return;
        setResolved(r);
        if (r.found && r.allowed && r.crisis_id) {
          const c = await loadCore({ conf, crisis, id: r.crisis_id });
          if (!cancelled) setCore(c);
        }
      } catch (e) {
        if (!cancelled) setError(crisisError(e, 'Could not open this crisis.'));
      }
    })();
    return () => { cancelled = true; };
  }, [conf, crisis, identityKey, attempt]);

  const crisisId = resolved?.allowed ? resolved.crisis_id ?? null : null;
  const ref = useMemo<CrisisRef | null>(() => (crisisId ? { conf, crisis, id: crisisId } : null), [conf, crisis, crisisId]);

  const reloadCore = useCallback(async () => {
    if (!ref || loading.current) return;
    loading.current = true;
    try {
      const c = await loadCore(ref);
      setCore(c);
    } catch { /* keep what we have; the next ping or poll retries */ } finally {
      loading.current = false;
    }
  }, [ref]);

  const live = useCrisisLive(crisisId, ['crises', 'crisis_cabinets', 'crisis_members', 'crisis_characters'], () => { void reloadCore(); });

  // Presence for the "online" count.
  useEffect(() => {
    if (!ref) return;
    void heartbeat(ref);
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void heartbeat(ref); }, 60_000);
    return () => window.clearInterval(t);
  }, [ref]);

  // ONE presence poller for the whole page: it runs only while a screen that shows who is online is mounted.
  const watchers = useRef(0);
  const pollTimer = useRef<number | null>(null);
  const refRef = useRef(ref);
  useEffect(() => { refRef.current = ref; }, [ref]);
  const watchPresence = useCallback(() => {
    const tick = async () => {
      const r = refRef.current;
      if (!r || document.visibilityState !== 'visible') return;
      try {
        const rows = await readPresence(r);
        const seen = new Map(rows.map((x) => [x.id, x.last_seen_at]));
        setCore((prev) => {
          if (!prev) return prev;
          let changed = false;
          const members = prev.members.map((m) => {
            if (!seen.has(m.id)) return m;
            const at = seen.get(m.id) ?? null;
            if (at === m.last_seen_at) return m;
            changed = true;
            return { ...m, last_seen_at: at };
          });
          return changed ? { ...prev, members } : prev;
        });
      } catch { /* keep the dots as they are; the next poll retries */ }
    };
    watchers.current += 1;
    if (pollTimer.current === null) {
      void tick();
      pollTimer.current = window.setInterval(() => { void tick(); }, 60_000);
    }
    return () => {
      watchers.current = Math.max(0, watchers.current - 1);
      if (watchers.current === 0 && pollTimer.current !== null) { window.clearInterval(pollTimer.current); pollTimer.current = null; }
    };
  }, []);

  const value = useMemo<CrisisContextValue | null>(() => {
    if (!ref || !resolved?.role || !resolved.conference || !core) return null;
    const role = resolved.role;
    return {
      ref, role,
      memberId: resolved.member_id ?? null,
      cabinetId: resolved.cabinet_id ?? null,
      characterId: resolved.character_id ?? null,
      displayName: resolved.display_name ?? null,
      conference: resolved.conference,
      core,
      settings: readSettings(core.crisis.settings),
      staff: isStaff(role),
      director: isDirector(role),
      live,
      reloadCore,
      watchPresence,
    };
  }, [ref, resolved, core, live, reloadCore, watchPresence]);

  let gate: CrisisGate;
  if (error && !value) gate = { state: 'error', message: error };
  else if (!resolved) gate = { state: 'loading' };
  else if (!resolved.found) gate = { state: 'not_found' };
  else if (!resolved.allowed) gate = { state: 'denied' };
  else if (!value) gate = { state: 'loading' };
  else gate = { state: 'ready', value };

  return { gate, retry: () => setAttempt((a) => a + 1) };
}

export function CrisisProvider({ value, children }: { value: CrisisContextValue; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Base path of this crisis, for links. */
export function crisisBase(ref: Pick<CrisisRef, 'conf' | 'crisis'>): string {
  return `/crisis/${ref.conf}/${ref.crisis}`;
}
