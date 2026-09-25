// emailAllowance.ts — the bulk email allowance (25 Sep 2026).
//
// Every conference sends 1,000 bulk emails free: only what goes through
// queueAdHocEmail (the Communications builder, the Applications bulk Email
// bar) counts, because those outbox rows carry an email_send_id. Automatic
// notifications never count. Packs (buy_email_pack) add 100, 500 or unlimited.
// `email_allowance(p_conf)` is the read; `enforced` is false until the
// production deploy switches store_flags.email_cap_enforced on, and while it
// is false the numbers are information only and nothing blocks.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface EmailAllowance {
  free: number;
  used: number;
  extra: number;
  unlimited: boolean;
  /** Null when unlimited. */
  remaining: number | null;
  enforced: boolean;
}

function asInt(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback;
}

export async function readEmailAllowance(client: SupabaseClient, conferenceId: string): Promise<EmailAllowance | null> {
  try {
    const { data, error } = await client.rpc('email_allowance', { p_conf: conferenceId });
    if (error || !data || (data as { ok?: boolean }).ok !== true) return null;
    const a = data as Record<string, unknown>;
    return {
      free: asInt(a.free, 1000),
      used: asInt(a.used),
      extra: asInt(a.extra),
      unlimited: a.unlimited === true,
      remaining: typeof a.remaining === 'number' ? a.remaining : null,
      enforced: a.enforced === true,
    };
  } catch {
    return null;
  }
}

/** The database's own refusal ("This conference has used its N emails. Get
 *  more in the Store, then send again."), after friendlyError. */
export function isEmailAllowanceMessage(message: string | null | undefined): boolean {
  return !!message && /has used its [\d,]+ emails/i.test(message);
}

/** True when a send of `recipients` would not fit and the cap is enforced. */
export function emailsShort(a: EmailAllowance | null, recipients: number): boolean {
  return !!a && a.enforced && !a.unlimited && a.remaining !== null && a.remaining < recipients;
}

export function emailsShortSentence(recipients: number, a: EmailAllowance): string {
  const left = a.remaining ?? 0;
  return `This email goes to ${recipients.toLocaleString('en-US')} ${recipients === 1 ? 'person' : 'people'} and your conference has ${left.toLocaleString('en-US')} ${left === 1 ? 'email' : 'emails'} left`;
}

/** "N of 1,000 free emails used", or the pack-extended cap, or unlimited. */
export function emailsUsedLine(a: EmailAllowance): string {
  const used = a.used.toLocaleString('en-US');
  if (a.unlimited) return `${used} emails sent, unlimited for this conference`;
  const cap = a.free + a.extra;
  return a.extra > 0
    ? `${used} of ${cap.toLocaleString('en-US')} emails used`
    : `${used} of ${a.free.toLocaleString('en-US')} free emails used`;
}
