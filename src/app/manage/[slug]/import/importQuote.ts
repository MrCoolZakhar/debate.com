// importQuote.ts — what an organiser import costs (25 Sep 2026).
//
// Each NEW imported row whose role is delegate, head-delegate, faculty-advisor
// or observer costs 1 conference credit, charged by the database at insert
// (applications_organizer_import_charge). Chair, secretariat and staff rows
// and re-imported rows (updates) are free. A paid import makes the delegate's
// later claim free; their own credit is never taken.
//
// `import_quote(p_conf, p_rows)` answers { charged, credits, conference_credits,
// need_credits }; `charged` is false until the production deploy switches
// store_flags.organizer_import_charged on, and then the numbers are shown as
// information and nothing blocks. A short conference tops up through the
// credits pop-up, then `store_transfer_in(p_conf, need)` moves the credits and
// the same import runs once.

import type { SupabaseClient } from '@supabase/supabase-js';

const CHARGED_ROLES = new Set(['delegate', 'head-delegate', 'faculty-advisor', 'observer']);

export function isChargedImportRole(role: string | null | undefined): boolean {
  return !!role && CHARGED_ROLES.has(role);
}

export interface ImportQuote {
  charged: boolean;
  credits: number;
  conference_credits: number;
  need_credits: number;
}

function asInt(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback;
}

export async function readImportQuote(client: SupabaseClient, conferenceId: string, rows: number): Promise<ImportQuote | null> {
  try {
    const { data, error } = await client.rpc('import_quote', { p_conf: conferenceId, p_rows: rows });
    if (error || !data || (data as { ok?: boolean }).ok !== true) return null;
    const a = data as Record<string, unknown>;
    return {
      charged: a.charged === true,
      credits: asInt(a.credits, rows),
      conference_credits: asInt(a.conference_credits),
      need_credits: asInt(a.need_credits),
    };
  } catch {
    return null;
  }
}

/** The database's refusal at insert, by its hint. */
export function isImportCreditsError(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { hint?: unknown }).hint === 'import_credits';
}

export const IMPORT_CREDITS_SENTENCE =
  'Importing costs 1 credit for each delegate, head delegate, faculty advisor or observer. Add credits to your conference in the Store, then import again.';

/** Moves `qty` of the caller's own credits into the conference. Plain message on refusal. */
export async function transferIntoConference(client: SupabaseClient, conferenceId: string, qty: number): Promise<{ ok: boolean; message?: string }> {
  const { data, error } = await client.rpc('store_transfer_in', { p_conf: conferenceId, p_qty: qty });
  if (error) return { ok: false, message: 'Your credits could not be moved into the conference. Open the Store and try again.' };
  const a = (data ?? {}) as { ok?: boolean; message?: string };
  return a.ok === true ? { ok: true } : { ok: false, message: a.message };
}
