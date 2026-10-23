// The delegate phone's allowances, counted per DELEGATION, not per phone (owner, 23 Oct 2026:
// "allowance should be counted per country"). A double delegation's two phones share:
//   • the self status-change limit (3 per rolling 3 hours),
//   • the request-to-speak clocks (60 s before an unanswered request may be re-sent, a
//     15-minute lockout after a chair refuses one).
//
// The database is the source of truth (scratch-seat-kick-and-allowance.sql, section B):
//   delegate_allowance(p_code, p_country)                    read
//   record_delegate_allowance(p_code, p_country, p_kind)     'status' | 'status_refund' |
//                                                            'gsl_request' | 'gsl_clear'
// and a refused request is stamped by a trigger where the chair removes it. Both RPCs are
// anon-callable with the session code and carry no personal data.
//
// Before that SQL is applied the RPCs answer PGRST202: `missing`, and the page keeps its
// per-phone localStorage limits exactly as before. A network failure is `null`: the page also
// falls back for that press. Not a security boundary (AGENTS.md rule 15).
import { supabase } from '@/lib/supabase';

export interface DelegateAllowance {
  /** Self status changes left in the rolling window (0..3). */
  statusLeft: number;
  /** ms until the oldest counted change leaves the window (0 when none). */
  statusNextMs: number;
  /** ms before an unanswered request to speak may be re-sent (0 when it may). */
  gslRetryLeftMs: number;
  /** ms left on the lockout after a refused request (0 when none). */
  gslDeniedLeftMs: number;
  /** Date.now() when the answer arrived: the ms values above count down from here. */
  readAt: number;
}

export type AllowanceRead = DelegateAllowance | 'missing' | null;
export type AllowanceRecord = { ok: true; state: DelegateAllowance } | { ok: false; reason: 'limit'; state: DelegateAllowance } | 'missing' | null;
export type AllowanceKind = 'status' | 'status_refund' | 'gsl_request' | 'gsl_clear';

const RPC_TIMEOUT_MS = 10_000;

type Raw = Record<string, unknown>;
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

function parse(d: Raw): DelegateAllowance {
  return {
    statusLeft: Math.max(0, Math.min(3, num(d.status_left))),
    statusNextMs: Math.max(0, num(d.status_next_ms)),
    gslRetryLeftMs: Math.max(0, num(d.gsl_retry_left_ms)),
    gslDeniedLeftMs: Math.max(0, num(d.gsl_denied_left_ms)),
    readAt: Date.now(),
  };
}

function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message ?? '');
}

async function call(fn: string, args: Record<string, unknown>): Promise<{ data: Raw | null; missing: boolean } | null> {
  const ask = async () => {
    try {
      const { data, error } = await supabase.rpc(fn, args);
      if (isMissing(error)) return { data: null, missing: true };
      if (error || !data || typeof data !== 'object') return null;
      return { data: data as Raw, missing: false };
    } catch {
      return null;
    }
  };
  return Promise.race([ask(), new Promise<null>((resolve) => setTimeout(() => resolve(null), RPC_TIMEOUT_MS))]);
}

/** The delegation's shared allowance. `missing` = the SQL is not applied; null = could not read. */
export async function readDelegateAllowance(code: string, country: string): Promise<AllowanceRead> {
  const res = await call('delegate_allowance', { p_code: code.toUpperCase(), p_country: country });
  if (!res) return null;
  if (res.missing) return 'missing';
  if (res.data?.ok !== true) return null;
  return parse(res.data);
}

/**
 * Count one event against the delegation. A `status` beyond the limit answers
 * `{ ok: false, reason: 'limit' }` with the state, and the caller must not write the status.
 */
export async function recordDelegateAllowance(code: string, country: string, kind: AllowanceKind): Promise<AllowanceRecord> {
  const res = await call('record_delegate_allowance', { p_code: code.toUpperCase(), p_country: country, p_kind: kind });
  if (!res) return null;
  if (res.missing) return 'missing';
  const d = res.data;
  if (!d) return null;
  if (d.ok === true) return { ok: true, state: parse(d) };
  if (d.reason === 'limit') return { ok: false, reason: 'limit', state: parse(d) };
  return null;
}
