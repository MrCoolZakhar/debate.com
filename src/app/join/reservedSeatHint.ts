'use client';

// ── Who a reserved conference seat is held for (masked) ─────────────────────
//
// A conference committee reserves each allocated seat for the delegate the
// organiser invited or imported. Many of them never made an account, so on
// /join a signed-out visitor who picks a reserved seat is told which invitation
// it is held for, with a MASKED address ("***dwae@gmail.com": the last four
// characters of the local part plus the domain), and can sign up with that
// address right there. The profiles trigger (claim_imported_applications) links
// the invitation on sign-up; an existing account signing in is linked by
// claim_my_imported_applications, called once on return (see CLAIM_MARKER).
//
// RPC session_reserved_seat_hint(p_code, p_country): SECURITY DEFINER, anon +
// authenticated. Never a full address, a name or an id.

import { supabase as anonSupabase } from '@/lib/supabase';

export interface ReservedSeatHint {
  seat: number | null;
  /** Masked address, or null when the allocation has none on record. */
  email: string | null;
  /** First letter of the invited name, when known. */
  initial: string | null;
  /** The invitation already belongs to an account (sign in, not sign up). */
  hasAccount: boolean;
}

/** null = the read failed; [] = not reserved (or nothing on record). */
export async function getReservedSeatHint(code: string, country: string): Promise<ReservedSeatHint[] | null> {
  try {
    const { data, error } = await anonSupabase.rpc('session_reserved_seat_hint', {
      p_code: code.toUpperCase(),
      p_country: country,
    });
    if (error || !data) return null;
    const d = data as { ok?: boolean; hints?: unknown };
    if (!d.ok || !Array.isArray(d.hints)) return [];
    return d.hints.map((h) => {
      const r = h as { seat?: unknown; email?: unknown; initial?: unknown; has_account?: unknown };
      return {
        seat: typeof r.seat === 'number' ? r.seat : null,
        email: typeof r.email === 'string' ? r.email : null,
        initial: typeof r.initial === 'string' ? r.initial : null,
        hasAccount: r.has_account === true,
      };
    });
  } catch {
    return null;
  }
}

/** sessionStorage key set when "This is me" is pressed, so the return to /join
 *  runs claim_my_imported_applications once for an EXISTING account. */
export const claimMarkerKey = (code: string) => `gavelling-join-claim:${code.toUpperCase()}`;

export function setClaimMarker(code: string): void {
  try { sessionStorage.setItem(claimMarkerKey(code), String(Date.now())); } catch { /* storage blocked */ }
}

/** True (and cleared) when a marker younger than an hour exists for this code. */
export function takeClaimMarker(code: string): boolean {
  try {
    const k = claimMarkerKey(code);
    const v = sessionStorage.getItem(k);
    if (!v) return false;
    sessionStorage.removeItem(k);
    return Date.now() - Number(v) < 60 * 60 * 1000;
  } catch {
    return false;
  }
}
