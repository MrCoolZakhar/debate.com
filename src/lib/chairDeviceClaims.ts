// ============================================================
// CHAIR DEVICE CLAIMS: one device per signed-in account per session
// ============================================================
// Contract (migration `chair_device_claims_one_device_per_account`):
//   • `chair_device_claims` holds one row per (committee, account): the SHA-256 of the
//     device token that account last chose to chair from. RLS on, no policies, no table
//     privileges: only the two SECURITY DEFINER RPCs below touch it.
//   • `claim_chair_device(p_code, p_token, p_takeover)` reads auth.uid(). No account
//     (an anonymous standalone chair) → `anonymous`, nothing stored, nothing enforced.
//     Otherwise `claimed` (first claim, or takeover moved it here), `mine` (this device
//     already holds it; refreshes last_seen_at), or `other_device` (another device holds
//     it and takeover was false, nothing changed).
//   • `chair_device_status(p_code, p_token)` → `{active_elsewhere}` for the caller only:
//     this account holds the committee on another device seen in the last 90 s.
//
// The device token IS the gavel device id (src/lib/gavelDevice.ts), so the account rule
// and the same-name gavel rule agree on what "a device" is, and the chair page and the
// voting page on one device (and two tabs on it) count as ONE device.
//
// This is not a security boundary (AGENTS.md rule 15): session writes are still checked
// only against the chair suffix. It stops one person driving the dais from two devices.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { getGavelDeviceId } from '@/lib/gavelDevice';

export type ChairDeviceReason = 'claimed' | 'mine' | 'anonymous' | 'other_device' | 'not_found' | 'no_token' | 'error';
export interface ChairDeviceResult { ok: boolean; reason: ChairDeviceReason }

async function clientFor(accessToken: string): Promise<SupabaseClient> {
  try {
    const fresh = await getFreshAuthedClient();
    if (fresh) return fresh as unknown as SupabaseClient;
  } catch { /* fall back to the token we were given */ }
  return getAuthedClient(accessToken) as unknown as SupabaseClient;
}

/** `takeover: true` = a deliberate open or "Use this device instead"; false = a re-verify. */
export async function claimChairDevice(code: string, accessToken: string, takeover: boolean): Promise<ChairDeviceResult> {
  const token = getGavelDeviceId(code);
  if (!token) return { ok: false, reason: 'no_token' };
  try {
    const client = await clientFor(accessToken);
    const { data, error } = await client.rpc('claim_chair_device', {
      p_code: code.toUpperCase(),
      p_token: token,
      p_takeover: takeover,
    });
    if (error || !data) return { ok: false, reason: 'error' };
    const d = data as { ok?: boolean; reason?: string };
    return { ok: d.ok === true, reason: (d.reason ?? 'error') as ChairDeviceReason };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** True only when the server says this account is chairing this committee on ANOTHER live device. */
export async function chairActiveElsewhere(code: string, accessToken: string): Promise<boolean> {
  const token = getGavelDeviceId(code);
  if (!token) return false;
  try {
    const client = await clientFor(accessToken);
    const { data, error } = await client.rpc('chair_device_status', { p_code: code.toUpperCase(), p_token: token });
    if (error || !data) return false;
    return (data as { active_elsewhere?: boolean }).active_elsewhere === true;
  } catch {
    return false;
  }
}

/** Short, non-reversible tag for realtime filtering. SHA-256 where available, FNV-1a otherwise. */
export async function shortTag(value: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
      return Array.from(new Uint8Array(buf).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* insecure context */ }
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `f${(h >>> 0).toString(16)}`;
}
