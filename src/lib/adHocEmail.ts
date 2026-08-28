// Ad-hoc ("custom") organizer email: one-off copy written by an organizer and
// sent to a specific set of applications, with no EVENT_REGISTRY key behind it.
//
// This is the SAME machinery the Communications composer sends through — an
// `email_sends` summary row, one `email_outbox` row per recipient tagged with
// that send's id, `renderEmailHtml` for the branded body, `resolveTokens` for
// the per-recipient substitutions, then `triggerEmailDelivery` to kick the
// drain. Extracted here so a second surface (the Applications bulk bar) can
// send one without growing a second sender. Anything queued through this
// function therefore shows up in Communications → History exactly like a
// composer send, which is where organizers already go to audit what went out.
//
// CONSENT: an organizer-composed one-off is a broadcast, so it is gated on the
// SAME 'marketing' notification category the composer uses, evaluated through
// the shared `recipientAllowsCategory` in `@/lib/emailEvents` — never by
// reading notify_email_marketing here. There is deliberately NO new
// EVENT_REGISTRY key: the registry is the contract for *product* emails with
// per-event templates and categories, and arbitrary organizer copy is not one
// of those. Adding a key would also have silently reclassified this as an
// 'applications' email in NOTIFICATION_CATEGORY, which is the wrong consent.

import type { getAuthedClient } from '@/lib/supabase-auth';
import { recipientAllowsCategory, type PreferenceRow } from '@/lib/emailEvents';
import { resolveTokens, type EmailTokenContext } from '@/lib/emailTokens';
import { renderEmailHtml, type EmailRenderConference, type EmailTheme } from '@/lib/emailHtml';
import { flattenBlocksToPlainText, type EmailBlock } from '@/lib/emailBlocks';
import { triggerEmailDelivery } from '@/lib/emailDelivery';
import { formatFee } from '@/lib/utils';
import { activePhaseFee, type FeePhase } from '@/lib/finance';

interface ConferenceRow {
  slug: string;
  acronym: string;
  full_name: string;
  start_date: string | null;
  end_date: string | null;
  fee_amount: number;
  fee_currency: string;
  banner_url: string | null;
  logo_url: string | null;
  contact_email: string;
  email_theme: EmailTheme | null;
}

interface RecipientRow {
  id: string;
  role: string;
  society_id: string | null;
  payment_status: string | null;
  societies: { name: string } | null;
  assigned_committee: { abbreviation: string | null; name: string } | null;
  assigned_country_name: string | null;
  profiles: (PreferenceRow & { display_name: string; email: string | null }) | null;
  invited_email: string | null;
  invited_name: string | null;
}

interface RoleFeeConfigRow {
  role: string;
  fee_amount: number | null;
  fee_currency: string | null;
  fee_phases: FeePhase[] | null;
}

export interface QueueAdHocEmailArgs {
  conferenceId: string;
  /** auth.users id of the organizer sending, recorded on email_sends.sent_by. */
  sentBy: string;
  subject: string;
  blocks: EmailBlock[];
  applicationIds: string[];
  /** Free-form provenance stored on email_sends.recipient_filter, so History
   *  can say where a send came from rather than showing an empty audience. */
  recipientFilter?: Record<string, unknown>;
}

export interface QueueAdHocEmailResult {
  /** Outbox rows actually written. */
  queued: number;
  /** Recipients dropped by the marketing opt-out gate. */
  optedOut: number;
  emailSendId: string | null;
  error?: string;
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

function formatDate(d: string | null): string {
  if (!d) return 'TBD';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return 'TBD';
  if (start === end) return formatDate(start);
  const s = new Date(start);
  const e = new Date(end);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.toLocaleDateString('en-GB', { day: 'numeric' })}–${formatDate(end)}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** Role- and phase-aware {{fee}}, same resolution queueEventEmail and the
 *  Communications composer use, so the same token never renders two numbers. */
function resolveFeeToken(
  role: string,
  roleConfigs: RoleFeeConfigRow[],
  conference: Pick<ConferenceRow, 'fee_amount' | 'fee_currency'> | null
): string | null {
  const config = roleConfigs.find(rc => rc.role === role);
  if (config) {
    const { amount } = activePhaseFee({ fee_amount: config.fee_amount, fee_phases: config.fee_phases });
    return formatFee(amount, config.fee_currency ?? conference?.fee_currency ?? 'USD');
  }
  return conference?.fee_amount ? formatFee(conference.fee_amount, conference.fee_currency) : null;
}

/**
 * Queues one organizer-composed email to `applicationIds`. Returns how many
 * outbox rows were written and how many recipients the marketing opt-out
 * dropped; nothing is thrown, every failure comes back on `error`.
 */
export async function queueAdHocEmail(
  supabase: ReturnType<typeof getAuthedClient>,
  args: QueueAdHocEmailArgs
): Promise<QueueAdHocEmailResult> {
  const { conferenceId, sentBy, subject, blocks, applicationIds } = args;
  const empty: QueueAdHocEmailResult = { queued: 0, optedOut: 0, emailSendId: null };
  if (applicationIds.length === 0) return empty;
  if (!subject.trim() || blocks.length === 0) {
    return { ...empty, error: 'A subject and a message are both required.' };
  }

  const [{ data: confData }, { data: recipientsData }, { data: roleConfigsData }] = await Promise.all([
    supabase
      .from('conferences')
      .select('slug, acronym, full_name, start_date, end_date, fee_amount, fee_currency, banner_url, logo_url, contact_email, email_theme')
      .eq('id', conferenceId)
      .single(),
    supabase
      .from('applications')
      .select(`
        id, role, society_id, payment_status,
        societies (name),
        assigned_committee:conference_committees!assigned_committee_id (abbreviation, name),
        assigned_country_name,
        profiles (display_name, email, notify_email_applications, notify_email_payments, notify_email_documents, notify_email_marketing),
        invited_email, invited_name
      `)
      .in('id', applicationIds),
    supabase
      .from('application_role_configs')
      .select('role, fee_amount, fee_currency, fee_phases')
      .eq('conference_id', conferenceId),
  ]);

  const conference = confData as ConferenceRow | null;
  if (!conference) return { ...empty, error: 'Could not load this conference.' };
  const roleConfigs = (roleConfigsData ?? []) as RoleFeeConfigRow[];
  const allRecipients = (recipientsData ?? []) as unknown as RecipientRow[];

  // Consent gate, through the shared predicate — an organizer-composed
  // broadcast is a 'marketing' email, exactly as the Communications composer
  // treats it. Manual selection never overrides an opt-out.
  const recipients = allRecipients.filter(a => recipientAllowsCategory('marketing', a.profiles));
  const optedOut = allRecipients.length - recipients.length;
  if (recipients.length === 0) return { ...empty, optedOut };

  const renderConf: EmailRenderConference = {
    slug: conference.slug,
    acronym: conference.acronym,
    full_name: conference.full_name,
    banner_url: conference.banner_url,
    logo_url: conference.logo_url,
    contact_email: conference.contact_email,
    email_theme: conference.email_theme,
  };
  const flatBody = flattenBlocksToPlainText(blocks, renderConf);

  // The send summary goes in first so every outbox row can carry its real id
  // — that link is what lets Communications → History expand this send into a
  // per-recipient delivery breakdown.
  const sentAtIso = new Date().toISOString();
  const { data: sendData, error: sendError } = await supabase
    .from('email_sends')
    .insert({
      conference_id: conferenceId,
      sent_by: sentBy,
      subject,
      body_html: renderEmailHtml({ blocks, conference: renderConf, ctx: {} }),
      recipient_filter: args.recipientFilter ?? {},
      recipient_count: recipients.length,
      scheduled_at: null,
      status: 'sent',
      sent_at: sentAtIso,
    })
    .select('id')
    .single();
  if (sendError || !sendData) {
    return { ...empty, optedOut, error: sendError?.message ?? 'Could not record this send.' };
  }
  const emailSendId = (sendData as { id: string }).id;

  const rows = recipients.map(app => {
    const ctx: EmailTokenContext = {
      delegate_name: app.profiles?.display_name ?? app.invited_name ?? null,
      role: roleLabel(app.role),
      delegation_name: app.societies?.name ?? (app.society_id == null ? 'Independent' : null),
      committee: app.assigned_committee?.abbreviation ?? app.assigned_committee?.name ?? null,
      country: app.assigned_country_name ?? null,
      payment_status: paymentStatusLabel(app.payment_status),
      conference_name: conference.full_name,
      conference_dates: formatDateRange(conference.start_date, conference.end_date),
      fee: resolveFeeToken(app.role, roleConfigs, conference),
    };
    return {
      conference_id: conferenceId,
      // No template row: this copy is a one-off, not a saved template, and
      // email_outbox.template_id is nullable. Writing a throwaway
      // email_templates row per send would litter the Communications
      // template list. The drain (send-emails) never reads template_id.
      template_id: null,
      email_send_id: emailSendId,
      recipient_application_id: app.id,
      recipient_email: app.profiles?.email ?? app.invited_email ?? null,
      subject: resolveTokens(subject, ctx),
      body: resolveTokens(flatBody, ctx),
      body_html: renderEmailHtml({ blocks, conference: renderConf, ctx }),
      status: 'pending' as const,
    };
  });

  const { error: outboxError } = await supabase.from('email_outbox').insert(rows);
  if (outboxError) {
    return { queued: 0, optedOut, emailSendId, error: outboxError.message };
  }

  triggerEmailDelivery(supabase);
  return { queued: rows.length, optedOut, emailSendId };
}
