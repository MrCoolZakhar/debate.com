// invoicesApi.ts — the Invoices page's reads (prompt 93). Writes (mark paid,
// mark unpaid, refunds) live in ../financialsApi.ts because the Applications
// page and the Things to do pop-up use them too. All amounts are minor units.

import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { plainOrFallback, UserFacingError } from '@/lib/friendlyError';

export interface PersonRow {
  application_id: string;
  name: string;
  email: string | null;
  role: string;
  app_status: string;
  delegation: string | null;
  society_id: string | null;
  claimed: boolean;
  currency: string | null;
  owed_cents: number;
  paid_cents: number;
  in_review_cents: number;
  items_open: number;
  items_total: number;
  kinds: string[];
  any_card: boolean;
  to_do: number;
  open_invoice_ids: string[];
  manual_paid_invoice_ids: string[];
  last_payment_at: string | null;
  closed: boolean;
}

export interface PersonInvoice {
  invoice_id: string;
  label: string;
  kind: string;
  amount_cents: number;
  paid_cents: number;
  aid_cents: number;
  due_cents: number;
  currency: string;
  status: 'open' | 'partial' | 'settled' | 'waived';
  void_reason: string | null;
  created_at: string;
  for_name: string | null;
  price_locked: boolean;
  in_review: boolean;
  in_started_payment: boolean;
  paid_by_card: boolean;
  refundable_cents: number;
  removable: boolean;
}

export interface PersonPayment {
  key: string;
  at: string;
  how: 'card' | 'proof' | 'marked';
  by: string | null;
  proof_path: string | null;
  note: string | null;
  total_cents: number;
  returned_cents: number;
  currency: string;
  items: { invoice_id: string; label: string; kind: string; amount_cents: number }[];
}

export interface LedgerLine {
  at: string;
  amount_cents: number;
  currency: string;
  status: string;
  type: string;
  method: string | null;
  label: string;
  by: string | null;
  note: string | null;
  reason: string | null;
}

export interface AuditRow {
  at: string;
  action: string;
  amount_cents: number | null;
  currency: string | null;
  old: Record<string, unknown> | null;
  new: Record<string, unknown> | null;
  note: string | null;
  by: string | null;
}

export interface PersonDetail {
  person: {
    application_id: string; name: string; email: string | null; role: string; app_status: string;
    delegation: string | null; claimed: boolean; payment_status: string | null; self_paid: boolean | null;
  };
  invoices: PersonInvoice[];
  payments: PersonPayment[];
  ledger: LedgerLine[];
  audit: AuditRow[];
}

async function rpcRead<T>(fn: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const c = await getFreshAuthedClient();
  if (!c) throw new UserFacingError('Your session has expired. Please sign in again.');
  const { data, error } = await c.rpc(fn, args);
  if (error) throw error;
  const a = (data ?? {}) as Record<string, unknown>;
  if (a.ok !== true) throw new UserFacingError(plainOrFallback(a.error, fallback));
  return a as T;
}

export async function readPeople(conferenceId: string): Promise<PersonRow[]> {
  const a = await rpcRead<{ people?: PersonRow[] }>('financials_people', { p_conference_id: conferenceId },
    'The people billed could not be read. Try again in a moment.');
  return Array.isArray(a.people) ? a.people : [];
}

export async function readPerson(applicationId: string): Promise<PersonDetail> {
  const a = await rpcRead<Partial<PersonDetail>>('financials_person', { p_application_id: applicationId },
    'This person could not be read. Try again in a moment.');
  return {
    person: a.person as PersonDetail['person'],
    invoices: Array.isArray(a.invoices) ? a.invoices : [],
    payments: Array.isArray(a.payments) ? a.payments : [],
    ledger: Array.isArray(a.ledger) ? a.ledger : [],
    audit: Array.isArray(a.audit) ? a.audit : [],
  };
}

/** Role keys in words, for the line under a name. */
export function roleWord(role: string): string {
  const map: Record<string, string> = {
    delegate: 'Delegate', 'head-delegate': 'Head delegate', 'faculty-advisor': 'Faculty advisor',
    observer: 'Observer', chair: 'Chair', secretariat: 'Secretariat', staff: 'Staff',
  };
  return map[role] ?? (role ? role.charAt(0).toUpperCase() + role.slice(1).replace(/-/g, ' ') : '');
}
