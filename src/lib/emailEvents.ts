// Queues outbox rows for a platform event, resolving the conference's enabled
// template (if any) against each recipient application. Pure DB helper — no
// delivery happens here, just email_outbox rows with status 'pending'.

import { getAuthedClient } from '@/lib/supabase-auth';
import { resolveTokens, type EmailTokenContext } from '@/lib/emailTokens';

export interface QueueEventEmailResult {
  drafted: boolean;
  queued?: number;
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    delegate: 'Delegate', chair: 'Chair', 'head-delegate': 'Head Delegate',
    'faculty-advisor': 'Faculty Advisor', observer: 'Observer',
  };
  return map[role] ?? role;
}

function paymentStatusLabel(status: string | null): string | null {
  if (!status) return null;
  const map: Record<string, string> = { paid: 'Paid', unpaid: 'Unpaid', waived: 'Waived' };
  return map[status] ?? status;
}

function currencySymbol(currency: string): string {
  const map: Record<string, string> = {
    GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$',
    CHF: 'CHF ', JPY: '¥', CNY: '¥', INR: '₹', BRL: 'R$', MXN: 'MX$',
  };
  return map[currency?.toUpperCase()] ?? (currency + ' ');
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateRange(start: string, end: string): string {
  if (!start || !end) return '';
  if (start === end) return formatDate(start);
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) return `${s.toLocaleDateString('en-GB', { day: 'numeric' })}–${formatDate(end)}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

interface TemplateRow {
  id: string;
  subject: string;
  body: string;
  enabled: boolean;
}

interface RecipientRow {
  id: string;
  role: string;
  is_independent: boolean;
  payment_status: string | null;
  societies: { name: string } | null;
  assigned_committee: { abbreviation: string | null; name: string } | null;
  assigned_country_name: string | null;
  profiles: { display_name: string } | null;
}

interface ConferenceRow {
  full_name: string;
  start_date: string;
  end_date: string;
  fee_amount: number;
  fee_currency: string;
}

/**
 * Loads the conference's template for eventKey. If none exists or it's
 * disabled, returns { drafted: false } so the caller can surface a
 * "draft it" nudge. Otherwise resolves tokens per recipient application and
 * inserts one email_outbox row each (status 'pending'), returning the count.
 */
export async function queueEventEmail(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  eventKey: string,
  applicationIds: string[]
): Promise<QueueEventEmailResult> {
  if (applicationIds.length === 0) return { drafted: false };

  const { data: templateData } = await supabase
    .from('email_templates')
    .select('id, subject, body, enabled')
    .eq('conference_id', conferenceId)
    .eq('event_key', eventKey)
    .maybeSingle();

  const template = templateData as TemplateRow | null;
  if (!template || !template.enabled) return { drafted: false };

  const [{ data: confData }, { data: recipientsData }] = await Promise.all([
    supabase
      .from('conferences')
      .select('full_name, start_date, end_date, fee_amount, fee_currency')
      .eq('id', conferenceId)
      .single(),
    supabase
      .from('applications')
      .select(`
        id, role, is_independent, payment_status,
        societies (name),
        assigned_committee:conference_committees!assigned_committee_id (abbreviation, name),
        assigned_country_name,
        profiles (display_name)
      `)
      .in('id', applicationIds),
  ]);

  const conference = confData as ConferenceRow | null;
  const recipients = (recipientsData ?? []) as unknown as RecipientRow[];
  if (recipients.length === 0) return { drafted: true, queued: 0 };

  const rows = recipients.map(app => {
    const ctx: EmailTokenContext = {
      delegate_name: app.profiles?.display_name ?? null,
      role: roleLabel(app.role),
      delegation_name: app.societies?.name ?? (app.is_independent ? 'Independent' : null),
      committee: app.assigned_committee?.abbreviation ?? app.assigned_committee?.name ?? null,
      country: app.assigned_country_name ?? null,
      payment_status: paymentStatusLabel(app.payment_status),
      conference_name: conference?.full_name ?? null,
      conference_dates: conference ? formatDateRange(conference.start_date, conference.end_date) : null,
      fee: conference?.fee_amount ? `${currencySymbol(conference.fee_currency)}${conference.fee_amount}` : null,
    };
    return {
      conference_id: conferenceId,
      template_id: template.id,
      recipient_application_id: app.id,
      subject: resolveTokens(template.subject, ctx),
      body: resolveTokens(template.body, ctx),
      status: 'pending' as const,
    };
  });

  const { error } = await supabase.from('email_outbox').insert(rows);
  if (error) return { drafted: true, queued: 0 };

  return { drafted: true, queued: rows.length };
}
