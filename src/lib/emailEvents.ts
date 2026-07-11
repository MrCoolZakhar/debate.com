// Queues outbox rows for a platform event, resolving the conference's enabled
// template (if any) against each recipient application. Pure DB helper — no
// delivery happens here, just email_outbox rows with status 'pending'.

import { getAuthedClient } from '@/lib/supabase-auth';
import { resolveTokens, type EmailTokenContext } from '@/lib/emailTokens';
import { normalizeBlocks, flattenBlocksToPlainText, type EmailBlock } from '@/lib/emailBlocks';
import { renderEmailHtml, type EmailRenderConference } from '@/lib/emailHtml';
import { formatFee } from '@/lib/utils';
import { triggerEmailDelivery } from '@/lib/emailDelivery';

// ── Event registry ────────────────────────────────────────────────────────────
// Single source of truth for platform email events, shared by this lib
// (queueEventEmail) and the UI (communications page, DraftNotice).

export interface EventDef {
  key: string;
  label: string;
  description: string;
  defaultDelivery: 'immediate' | 'manual';
}

export const EVENT_REGISTRY: EventDef[] = [
  { key: 'application_received', label: 'Application Received', description: 'Sent to a delegate when their application is submitted.', defaultDelivery: 'immediate' },
  { key: 'application_accepted', label: 'Application Accepted', description: 'Sent when an application is accepted.', defaultDelivery: 'immediate' },
  { key: 'application_rejected', label: 'Application Rejected', description: 'Sent when an application is rejected.', defaultDelivery: 'immediate' },
  { key: 'payment_available', label: 'Payment Available', description: 'Sent when payment opens up for a delegate.', defaultDelivery: 'immediate' },
  { key: 'payment_received', label: 'Payment Received', description: "Sent when a delegate is marked paid.", defaultDelivery: 'immediate' },
  { key: 'fee_waived', label: 'Fee Waived', description: "Sent when a delegate's fee is waived.", defaultDelivery: 'immediate' },
  { key: 'allocation_assigned', label: 'Allocation Assigned', description: 'Sent when a delegate is allocated a committee and country.', defaultDelivery: 'immediate' },
  { key: 'allocation_changed', label: 'Allocation Changed', description: "Sent when a delegate's allocation changes.", defaultDelivery: 'immediate' },
  { key: 'allocation_removed', label: 'Allocation Removed', description: "Sent when a delegate's allocation is removed.", defaultDelivery: 'manual' },
  { key: 'pledge_received', label: 'Pledge Received', description: 'Sent when a pledge is marked received.', defaultDelivery: 'immediate' },
  { key: 'added_to_delegation', label: 'Added to Delegation', description: 'Sent when a delegate joins a delegation.', defaultDelivery: 'immediate' },
  { key: 'removed_from_delegation', label: 'Removed from Delegation', description: 'Sent when a delegate leaves a delegation.', defaultDelivery: 'manual' },
  { key: 'spot_received', label: 'Spot Received', description: 'Sent when a delegate is given a paid spot.', defaultDelivery: 'immediate' },
  { key: 'spot_lost', label: 'Spot Lost', description: 'Sent when a delegate loses their paid spot.', defaultDelivery: 'manual' },
  { key: 'not_attending', label: 'Marked Not Attending', description: 'Sent when a delegate is marked not attending.', defaultDelivery: 'manual' },
  { key: 'attendance_restored', label: 'Attendance Restored', description: "Sent when a delegate's attendance is restored.", defaultDelivery: 'immediate' },
  { key: 'documents_published', label: 'Documents Published', description: 'Sent when working papers or resolutions are published.', defaultDelivery: 'manual' },
  { key: 'chair_assigned', label: 'Chair Assigned', description: 'Sent when someone is assigned as a committee chair.', defaultDelivery: 'immediate' },
  { key: 'committee_chair_invite', label: 'Chair invite', description: 'Sent when an organizer invites someone to chair a committee.', defaultDelivery: 'immediate' },
  { key: 'session_chair_invite', label: 'Session Chair Invite', description: 'Sent to committee chairs with their session code and chair password.', defaultDelivery: 'manual' },
  { key: 'session_join_invite', label: 'Session Join Invite', description: 'Sent to committee participants inviting them to join the live session.', defaultDelivery: 'manual' },
  { key: 'request_reply', label: 'Request reply', description: 'Sent to a participant when the organizing team replies to their question.', defaultDelivery: 'immediate' },
  { key: 'delegation_swap', label: 'Delegation swap', description: 'Sent to both delegates when their committee allocations are swapped within a delegation.', defaultDelivery: 'immediate' },
  { key: 'position_paper_feedback', label: 'Position Paper Feedback', description: 'Sent to a delegate when their chair leaves feedback on their position paper.', defaultDelivery: 'immediate' },
];

/** Looks up a registry event's display label, falling back to the raw key if unknown. */
export function getEventLabel(eventKey: string): string {
  return EVENT_REGISTRY.find(e => e.key === eventKey)?.label ?? eventKey;
}

export interface QueueEventEmailResult {
  drafted: boolean;
  queued?: number;
  eventKey?: string;
  eventLabel?: string;
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
  body_blocks: unknown;
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
  profiles: { display_name: string; email: string | null } | null;
}

interface ConferenceRow {
  slug: string;
  acronym: string;
  full_name: string;
  start_date: string;
  end_date: string;
  fee_amount: number;
  fee_currency: string;
  banner_url: string | null;
  logo_url: string | null;
  contact_email: string;
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
  applicationIds: string[],
  extraCtx?: EmailTokenContext
): Promise<QueueEventEmailResult> {
  if (applicationIds.length === 0) return { drafted: false, eventKey, eventLabel: getEventLabel(eventKey) };

  const { data: templateData } = await supabase
    .from('email_templates')
    .select('id, subject, body, body_blocks, enabled')
    .eq('conference_id', conferenceId)
    .eq('event_key', eventKey)
    .maybeSingle();

  const template = templateData as TemplateRow | null;
  if (!template || !template.enabled) return { drafted: false, eventKey, eventLabel: getEventLabel(eventKey) };

  const [{ data: confData }, { data: recipientsData }] = await Promise.all([
    supabase
      .from('conferences')
      .select('slug, acronym, full_name, start_date, end_date, fee_amount, fee_currency, banner_url, logo_url, contact_email')
      .eq('id', conferenceId)
      .single(),
    supabase
      .from('applications')
      .select(`
        id, role, is_independent, payment_status,
        societies (name),
        assigned_committee:conference_committees!assigned_committee_id (abbreviation, name),
        assigned_country_name,
        profiles (display_name, email)
      `)
      .in('id', applicationIds),
  ]);

  const conference = confData as ConferenceRow | null;
  const recipients = (recipientsData ?? []) as unknown as RecipientRow[];
  if (recipients.length === 0) return { drafted: true, queued: 0 };

  const renderConf: EmailRenderConference = {
    slug: conference?.slug ?? '',
    acronym: conference?.acronym ?? '',
    full_name: conference?.full_name ?? '',
    banner_url: conference?.banner_url ?? null,
    logo_url: conference?.logo_url ?? null,
    contact_email: conference?.contact_email ?? '',
  };
  const blocks = normalizeBlocks(template.body_blocks, template.body);
  const flatBody = flattenBlocksToPlainText(blocks, renderConf);

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
      fee: conference?.fee_amount ? formatFee(conference.fee_amount, conference.fee_currency) : null,
      ...extraCtx,
    };
    return {
      conference_id: conferenceId,
      template_id: template.id,
      recipient_application_id: app.id,
      recipient_email: app.profiles?.email ?? null,
      subject: resolveTokens(template.subject, ctx),
      body: resolveTokens(flatBody, ctx),
      body_html: renderEmailHtml({ blocks, conference: renderConf, ctx }),
      status: 'pending' as const,
    };
  });

  const { error } = await supabase.from('email_outbox').insert(rows);
  if (error) return { drafted: true, queued: 0 };

  triggerEmailDelivery(supabase);

  return { drafted: true, queued: rows.length };
}

// ── Chair invite email ──────────────────────────────────────────────────────
// Unlike queueEventEmail, the recipient here has no application row yet (they
// may not even have applied) — so this queues a single outbox row directly
// against recipient_email rather than resolving applicationIds. Organizers can
// customize the 'committee_chair_invite' template like any other event; a
// missing/disabled template falls back to a built-in default so the invite
// email is never blocked on template setup.

export interface QueueChairInviteEmailArgs {
  conferenceId: string;
  committeeName: string;
  token: string;
  invitedEmail: string;
  invitedName: string;
}

export async function queueChairInviteEmail(
  supabase: ReturnType<typeof getAuthedClient>,
  args: QueueChairInviteEmailArgs
): Promise<void> {
  const { conferenceId, committeeName, token, invitedEmail, invitedName } = args;

  const [{ data: confData }, { data: templateData }] = await Promise.all([
    supabase
      .from('conferences')
      .select('slug, acronym, full_name, banner_url, logo_url, contact_email')
      .eq('id', conferenceId)
      .single(),
    supabase
      .from('email_templates')
      .select('id, subject, body, body_blocks, enabled')
      .eq('conference_id', conferenceId)
      .eq('event_key', 'committee_chair_invite')
      .maybeSingle(),
  ]);

  const conference = confData as ConferenceRow | null;
  const template = templateData as TemplateRow | null;
  const renderConf: EmailRenderConference = {
    slug: conference?.slug ?? '',
    acronym: conference?.acronym ?? '',
    full_name: conference?.full_name ?? '',
    banner_url: conference?.banner_url ?? null,
    logo_url: conference?.logo_url ?? null,
    contact_email: conference?.contact_email ?? '',
  };

  const ctx: EmailTokenContext = {
    delegate_name: invitedName,
    committee: committeeName,
    conference_name: conference?.full_name ?? null,
  };

  const useTemplate = !!template && template.enabled;
  const blocks: EmailBlock[] = useTemplate
    ? normalizeBlocks(template!.body_blocks, template!.body)
    : [
        { type: 'paragraph', content: `You've been invited to chair ${committeeName} at ${renderConf.acronym}.` },
        { type: 'paragraph', content: 'Accepting adds this conference to your Gavelling account.' },
        { type: 'button', label: 'ACCEPT INVITATION', destination: 'chair_invite_accept' },
      ];

  const subjectSource = useTemplate ? template!.subject : `You're invited to chair ${committeeName} at ${renderConf.acronym}`;
  const flatBody = flattenBlocksToPlainText(blocks, renderConf, { chairInviteToken: token });

  const { error } = await supabase.from('email_outbox').insert({
    conference_id: conferenceId,
    template_id: useTemplate ? template!.id : null,
    recipient_application_id: null,
    recipient_email: invitedEmail,
    subject: resolveTokens(subjectSource, ctx),
    body: resolveTokens(flatBody, ctx),
    body_html: renderEmailHtml({ blocks, conference: renderConf, ctx, chairInviteToken: token }),
    status: 'pending',
  });
  if (error) return;

  triggerEmailDelivery(supabase);
}
