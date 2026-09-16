/**
 * Who is sitting in a seat, by name, in a CONFERENCE-LINKED live session.
 *
 * A committee minted from a conference knows which account was allocated to each country, so
 * a chair talking to "France" can be shown that France is Ana Pérez. Nothing about the session
 * runtime changes: `delegates.country` stays the identity everywhere, this is a label beside it.
 *
 * WHO SEES IT — CHAIRS ONLY, deliberately.
 *   `session_delegation_names(p_code)` (migration `session_delegation_names`, 16 Sep 2026) is
 *   SECURITY DEFINER with `search_path` pinned, granted to anon + authenticated, and gated on
 *   `is_session_chair` — the `x-chair-suffix` header `sessionClient` sends, the same credential
 *   every chair write is checked against. It returns ONLY
 *   `{country, country_code, seat, display_name}` for allocations with a claimed account and a
 *   non-empty display name. No email, no user id, no application or society, and it writes
 *   nothing.
 *
 *   The session code alone is NOT enough, on purpose. `sess_select` on `committees` is `true`,
 *   so a 6-char code is a weak credential (AGENTS.md is explicit that seat claims stop honest
 *   collisions, not a hostile user), and nothing in the schema makes a delegate's name public
 *   today: `conferences.show_taken_countries` publishes which COUNTRIES are taken, never who
 *   holds them, and `conference_committees.display_chairs` is a curated chair list. So a
 *   delegate's chat shows delegations exactly as before. If an organiser-facing
 *   "show delegate names" switch is ever added, this is the one place that has to learn it.
 *
 * NOT A SECURITY BOUNDARY (AGENTS.md rule 15): the chair suffix is anon-readable out of
 * `committees.settings`, like every other chair-gated RPC.
 */
import { sessionClient } from '@/lib/sessionClient';
import type { Committee } from '@/lib/types';
import { useEffect, useMemo, useState } from 'react';

export interface DelegationNameRow {
  /** The allocation's country NAME, as the conference stores it. */
  country: string;
  /** Its ISO code, so a roster that uses codes still matches. */
  countryCode: string;
  /** 1, or 2 for the second seat of a double delegation. */
  seat: number;
  displayName: string;
}

export interface DelegationNames {
  isConference: boolean;
  rows: DelegationNameRow[];
  /** Lower-cased country NAME and CODE both map to the seat's people, in seat order. */
  byCountry: Map<string, string[]>;
}

const EMPTY: DelegationNames = { isConference: false, rows: [], byCountry: new Map() };

/** Shared by the chat and Settings → People so one session reads this once, not twice. */
const cache = new Map<string, { at: number; value: DelegationNames }>();
const inflight = new Map<string, Promise<DelegationNames | null>>();
const TTL_MS = 5 * 60 * 1000;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function index(rows: DelegationNameRow[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const push = (key: string, name: string) => {
    if (!key) return;
    const list = out.get(key);
    if (list) { if (!list.includes(name)) list.push(name); }
    else out.set(key, [name]);
  };
  for (const r of [...rows].sort((a, b) => a.seat - b.seat)) {
    push(norm(r.country), r.displayName);
    push(norm(r.countryCode), r.displayName);
  }
  return out;
}

/**
 * Read the allocated names for a session. `null` means "could not read" (offline, or this
 * device does not hold the chair code) — which is NOT the same as "this session has none".
 */
export async function getSessionDelegationNames(
  code: string,
  chairSuffix?: string | null,
  opts: { force?: boolean } = {},
): Promise<DelegationNames | null> {
  const key = code.trim().toUpperCase();
  if (!key || !chairSuffix) return null;
  const hit = cache.get(key);
  if (!opts.force && hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const running = inflight.get(key);
  if (running && !opts.force) return running;

  const run = (async (): Promise<DelegationNames | null> => {
    try {
      const { data, error } = await sessionClient(key, chairSuffix)
        .rpc('session_delegation_names', { p_code: key });
      if (error || !data) return null;
      const d = data as Record<string, unknown>;
      if (d.ok !== true) return null;
      const raw = Array.isArray(d.names) ? (d.names as Record<string, unknown>[]) : [];
      const rows: DelegationNameRow[] = raw
        .map((r) => ({
          country: typeof r.country === 'string' ? r.country : '',
          countryCode: typeof r.country_code === 'string' ? r.country_code : '',
          seat: typeof r.seat === 'number' ? r.seat : 1,
          displayName: typeof r.display_name === 'string' ? r.display_name.trim() : '',
        }))
        .filter((r) => r.displayName !== '' && (r.country !== '' || r.countryCode !== ''));
      const value: DelegationNames = { isConference: d.is_conference === true, rows, byCountry: index(rows) };
      cache.set(key, { at: Date.now(), value });
      return value;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, run);
  return run;
}

/** Forget the cached read for a session (an organiser re-allocated a seat mid-session). */
export function forgetSessionDelegationNames(code: string): void {
  cache.delete(code.trim().toUpperCase());
}

/**
 * The names for one seat, in seat order. Matches by country NAME or ISO CODE, case- and
 * whitespace-insensitively, because a session roster may carry either.
 */
export function delegationNamesFor(names: DelegationNames | null, country: string): string[] {
  if (!names || !country) return [];
  return names.byCountry.get(norm(country)) ?? [];
}

/** One line for a seat: "Ana Pérez", or "Ana Pérez, Luis Gómez" on a double delegation. */
export function delegationNameLabel(names: DelegationNames | null, country: string): string {
  return delegationNamesFor(names, country).join(', ');
}

/**
 * Chair-side hook. Reads once per session (cached for five minutes and shared across
 * surfaces), only for a conference-linked committee, only with the chair suffix in hand.
 * Returns null on every other surface, so a caller can render exactly as it did before.
 *
 * It is a plain read: it never touches committee state, `updateLocal` or `localUpdateTime`
 * (AGENTS.md rules 3 and 4).
 */
export function useSessionDelegationNames(
  committee: Pick<Committee, 'code' | 'sessionOrigin' | 'dbChairJoinSuffix'> | null | undefined,
  enabled = true,
): DelegationNames | null {
  const code = committee?.code ?? '';
  const suffix = committee?.dbChairJoinSuffix ?? '';
  const isConference = committee?.sessionOrigin === 'conference';
  const on = enabled && isConference && !!code && !!suffix;
  const key = code.toUpperCase();
  // Keyed by session code, so a stale read for another room can never be shown here.
  const [loaded, setLoaded] = useState<{ key: string; value: DelegationNames } | null>(() => {
    const hit = on ? cache.get(key)?.value : undefined;
    return hit ? { key, value: hit } : null;
  });

  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    void getSessionDelegationNames(code, suffix).then((r) => { if (!cancelled && r) setLoaded({ key, value: r }); });
    return () => { cancelled = true; };
  }, [on, code, suffix, key]);

  return useMemo(() => {
    const names = loaded && loaded.key === key ? loaded.value : null;
    return on && names && names.rows.length > 0 ? names : null;
  }, [on, loaded, key]);
}

export { EMPTY as EMPTY_DELEGATION_NAMES };
