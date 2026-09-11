// One person per delegate seat, and per-SEAT gating for conference sessions.
//
// Contract (migration `delegate_seat_claims_and_open_conference_seats`):
//   • A conference seat is RESERVED when the linked conference committee has a
//     `conference_allocations` row for that country: a registered delegate, an imported
//     address with no account yet (user_id null), or a delegation block. A reserved seat
//     needs a signed-in account that is allocated to it, and claim_delegate_seat checks
//     that on the SERVER, so the gate is not only in the UI.
//   • Every other seat is OPEN: the session code alone is enough, exactly like a
//     standalone session. A conference that never invited anyone is fully open; a
//     partly imported one keeps its imports gated and lets everyone else in.
//   • The dais is OPEN (`chairsOpen`) when the conference committee has no assigned chair
//     (chair_user_ids empty), no pending conference_chair_invites row and no unclaimed
//     imported chair application: the 4-digit chair code alone then admits a chair.
//   • One person per seat (a double-delegation slot holds two). The holder is the auth
//     uid when signed in, otherwise this device's random token below. The server keeps
//     only a SHA-256 of the token, never the token itself.
//
// `delegate_seat_claims` has RLS on and NO policies: every read and write goes through
// the SECURITY DEFINER RPCs wrapped here, and none of them returns a name, an email or
// a user id.
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as anonSupabase } from '@/lib/supabase';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { sessionClient } from '@/lib/sessionClient';

const TOKEN_PREFIX = 'gavelling-seat-token:';
// Used only when localStorage is unavailable (private mode, blocked site data). The
// token then lives as long as this tab, which still keeps a reload in the same tab on
// the same seat.
const memoryTokens: Record<string, string> = {};

function randomToken(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* insecure context: fall through */ }
  try {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch { /* no Web Crypto at all */ }
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

/** This device's seat token for a session, or null if it never joined one here. */
export function peekSeatToken(code: string): string | null {
  const key = TOKEN_PREFIX + code.toUpperCase();
  try {
    const stored = localStorage.getItem(key);
    if (stored) return stored;
  } catch { /* storage blocked */ }
  return memoryTokens[key] ?? null;
}

/** This device's seat token for a session, created on first use. */
export function getSeatToken(code: string): string {
  const key = TOKEN_PREFIX + code.toUpperCase();
  const existing = peekSeatToken(code);
  if (existing && existing.length >= 16) return existing;
  const fresh = randomToken();
  memoryTokens[key] = fresh;
  try { localStorage.setItem(key, fresh); } catch { /* keep the in-memory copy */ }
  return fresh;
}

/** Seats are matched case-insensitively everywhere, on the server too. */
export function seatKey(country: string): string {
  return country.trim().toLowerCase();
}

// The RPCs read auth.uid(), so a signed-in caller must send its JWT. Prefer the auth
// SDK's current session over a token captured in a React closure, which can be stale.
async function clientFor(accessToken?: string | null): Promise<SupabaseClient> {
  if (!accessToken) return anonSupabase as unknown as SupabaseClient;
  try {
    const fresh = await getFreshAuthedClient();
    if (fresh) return fresh;
  } catch { /* fall back to the token we were given */ }
  return getAuthedClient(accessToken);
}

// ── Join rules ────────────────────────────────────────────────────────────────
export interface SessionJoinRules {
  found: boolean;
  isConference: boolean;
  /** No assigned or invited chair: the chair code alone admits a chair. Always true for a standalone session. */
  chairsOpen: boolean;
  /** `delegates.country` values that belong to allocated or invited delegates. */
  reservedCountries: string[];
}

/** null when the rules could not be read: callers must then fail CLOSED. */
export async function getSessionJoinRules(code: string): Promise<SessionJoinRules | null> {
  try {
    const { data, error } = await anonSupabase.rpc('session_join_rules', { p_code: code.toUpperCase() });
    if (error || !data) return null;
    const d = data as { found?: boolean; is_conference?: boolean; chairs_open?: boolean; reserved_countries?: unknown };
    return {
      found: d.found === true,
      isConference: d.is_conference === true,
      chairsOpen: d.chairs_open === true,
      reservedCountries: Array.isArray(d.reserved_countries)
        ? d.reserved_countries.filter((c): c is string => typeof c === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

// ── Availability ──────────────────────────────────────────────────────────────
export interface SeatState {
  country: string;
  capacity: number;
  /** At least one person holds this seat. */
  claimed: boolean;
  /** Every place on this seat is held. */
  full: boolean;
  /** This account, or this device, is one of the holders. */
  mine: boolean;
}
/** Keyed by seatKey(country). */
export type SeatAvailability = Record<string, SeatState>;

/** null on failure. Advisory only: /delegate claims the seat and is the authority. */
export async function getSeatAvailability(
  code: string,
  opts: { token?: string | null; accessToken?: string | null } = {},
): Promise<SeatAvailability | null> {
  try {
    const client = await clientFor(opts.accessToken);
    const { data, error } = await client.rpc('delegate_seat_availability', {
      p_code: code.toUpperCase(),
      p_token: opts.token ?? null,
    });
    if (error || !data) return null;
    const seats = (data as { seats?: unknown }).seats;
    const out: SeatAvailability = {};
    if (Array.isArray(seats)) {
      for (const raw of seats) {
        const s = raw as Partial<SeatState>;
        if (typeof s.country !== 'string') continue;
        out[seatKey(s.country)] = {
          country: s.country,
          capacity: Number(s.capacity) || 1,
          claimed: s.claimed === true,
          full: s.full === true,
          mine: s.mine === true,
        };
      }
    }
    return out;
  } catch {
    return null;
  }
}

// ── Claim / release ───────────────────────────────────────────────────────────
export type SeatClaimReason =
  | 'claimed' | 'mine' | 'ended'                                           // ok
  | 'taken' | 'reserved' | 'signin' | 'no_seat' | 'no_token' | 'not_found' // refused
  | 'error';                                                               // could not ask
export interface SeatClaimResult { ok: boolean; reason: SeatClaimReason }

/**
 * Take (or re-take) a seat for this account or device. Always sends the device token,
 * even when signed in, so a device claim can be adopted by the account that signs in on
 * it and a signed-in claim survives signing out on the same device.
 */
export async function claimDelegateSeat(code: string, country: string, accessToken?: string | null): Promise<SeatClaimResult> {
  try {
    const client = await clientFor(accessToken);
    const { data, error } = await client.rpc('claim_delegate_seat', {
      p_code: code.toUpperCase(),
      p_country: country,
      p_token: getSeatToken(code),
    });
    if (error || !data) return { ok: false, reason: 'error' };
    const d = data as { ok?: boolean; reason?: string };
    return { ok: d.ok === true, reason: (d.reason ?? 'error') as SeatClaimReason };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/**
 * Chair only: free every place on a seat so the next person can take it (a dead phone,
 * the wrong person). Gated on is_session_chair, i.e. the x-chair-suffix header, the same
 * credential as every other chair write. True ONLY when the server confirmed it.
 */
export async function releaseDelegateSeat(code: string, country: string, chairSuffix?: string): Promise<boolean> {
  if (!chairSuffix) return false;
  try {
    const { data, error } = await sessionClient(code, chairSuffix).rpc('release_delegate_seat', {
      p_code: code.toUpperCase(),
      p_country: country,
    });
    if (error) return false;
    return (data as { ok?: boolean } | null)?.ok === true;
  } catch {
    return false;
  }
}
