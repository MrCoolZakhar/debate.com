'use client';

/**
 * Financial aid is ONE pool of money per person (prompt 127, 14 Oct 2026). The
 * database spends it by itself (apply_aid_pool on every aid approval, new
 * invoice and invoice sync) until they owe 0, and never refunds it. What is not
 * used yet stays with them and pays for the next ticket or add-on they add, so
 * /pay and the organizer's screens show "{amount} of aid left".
 *
 * aid_pool_status(p_application_id) answers the applicant and the conference's
 * organizers: { ok, has_aid, currency, granted_cents, applied_cents,
 * left_cents }. The client never calls apply_aid_pool. A failed read, ok:false
 * or has_aid:false all mean "show nothing", never an error.
 */

import { useEffect, useState } from 'react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';

export type AidPool = {
  currency: string;
  grantedCents: number;
  appliedCents: number;
  leftCents: number;
};

export async function readAidPool(applicationId: string): Promise<AidPool | null> {
  try {
    const c = await getFreshAuthedClient();
    if (!c) return null;
    const { data, error } = await c.rpc('aid_pool_status', { p_application_id: applicationId });
    if (error || !data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;
    if (d.ok !== true || d.has_aid !== true) return null;
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    return {
      currency: typeof d.currency === 'string' ? d.currency : '',
      grantedCents: n(d.granted_cents),
      appliedCents: n(d.applied_cents),
      leftCents: n(d.left_cents),
    };
  } catch {
    return null;
  }
}

/**
 * One aid_pool_status read per open card or page, and again whenever
 * `refreshKey` changes (the screen's own re-read after any money change: pass
 * the object that screen re-reads, so a new identity means new money).
 */
export function useAidPool(applicationId: string | null | undefined, refreshKey?: unknown): AidPool | null {
  const [read, setRead] = useState<{ id: string; pool: AidPool | null } | null>(null);
  useEffect(() => {
    if (!applicationId) return;
    let alive = true;
    readAidPool(applicationId).then(p => { if (alive) setRead({ id: applicationId, pool: p }); });
    return () => { alive = false; };
  }, [applicationId, refreshKey]);
  // An answer for another application (or none asked for) shows nothing.
  return applicationId && read?.id === applicationId ? read.pool : null;
}

/** "{amount} of aid left", or null when there is nothing left to show. */
export function aidLeftLabel(pool: AidPool | null, format: (cents: number, currency: string) => string): string | null {
  if (!pool || pool.leftCents <= 0) return null;
  return `${format(pool.leftCents, pool.currency)} of aid left`;
}
