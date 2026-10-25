'use client';
// Gavelling Crisis: what every page under /crisis/<conference>/<crisis> shares.
// The layout resolves who the viewer is (account or personal code), loads the core world
// (crisis, cabinets, people, characters) and keeps it live. Pages read it with useCrisis().

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { heartbeat, loadCore, resolveCrisis, type CrisisCore, type CrisisRef } from '@/lib/crisis/api';
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
}

const Ctx = createContext<CrisisContextValue | null>(null);

export function useCrisis(): CrisisContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCrisis must be used inside the crisis layout');
  return v;
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
        if (!cancelled) setError((e as Error).message || 'Could not open this crisis.');
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
    };
  }, [ref, resolved, core, live, reloadCore]);

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
