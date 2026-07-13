// Queues outbox rows for a platform event, resolving the conference's enabled
// template (if any) against each recipient application. Pure DB helper — no
// delivery happens here, just email_outbox rows with status 'pending'.

import { getAuthedClient } from '@/lib/supabase-auth';
import { resolveTokens, type EmailTokenContext } from '@/lib/emailTokens';
import { normalizeBlocks, flattenBlocksToPlainText, type EmailBlock } from '@/lib/emailBlocks';
import { renderEmailHtml, type EmailRenderConference, type EmailTheme } from '@/lib/emailHtml';
import { formatFee } from '@/lib/utils';
import { triggerEmailDelivery } from '@/lib/emailDelivery';
import { getDefaultEventEmail } from '@/lib/defaultEmails';

// ── Event registry ────────────────────────────────────────────────────────────
// Single source of truth for platform email events, shared by this lib
// (queueEventEmail) and the UI (communications page, DraftNotice).

export interface EventDef {
  key: string;
  label: string;
  description: string;
  defaultDelivery: 'immediate' | 'manual';
  /** Functional invites (committee_chair_invite, import_join_invite) always
   *  send — clicking INVITE is the consent — so the Notifications registry
   *  hides their toggle and shows a fixed "always sends" note instead. */
  functional?: boolean;
}

export const EVENT_REGISTRY: EventDef[] = [
  { key: 'application_received', label: 'Application Received', description: 'Sent to a delegate when their application is submitted.', defaultDelivery: 'immediate' },
  { key: 'application_accepted', label: 'Application Accepted', description: 'Sent when an application is accepted.', defaultDelivery: 'immediate' },
  { key: 'application_rejected', label: 'Application Rejected', description: 'Sent when an application is rejected.', defaultDelivery: 'immediate' },
  { key: 'payment_available', label: 'Payment Available', description: "Sent when payment opens up for a delegate. Companion to Application Accepted: on acceptance, this is suppressed for anyone who was actually emailed Application Accepted for the same action — it only sends alone when that email resolved to nothing (off or unconfigured) for them.", defaultDelivery: 'immediate' },
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
  { key: 'committee_chair_invite', label: 'Chair invite', description: 'Sent when an organizer invites someone to chair a committee. Always sends — clicking INVITE is the consent — using your draft if enabled, otherwise our default.', defaultDelivery: 'immediate', functional: true },
  { key: 'session_chair_invite', label: 'Session Chair Invite', description: 'Sent to committee chairs with their session code and chair password.', defaultDelivery: 'manual' },
  { key: 'session_join_invite', label: 'Session Join Invite', description: 'Sent to committee participants inviting them to join the live session.', defaultDelivery: 'manual' },
  { key: 'request_reply', label: 'Request reply', description: 'Sent to a participant when the organizing team replies to their question.', defaultDelivery: 'immediate' },
  { key: 'delegation_swap', label: 'Delegation swap', description: 'Sent to both delegates when their committee allocations are swapped within a delegation.', defaultDelivery: 'immediate' },
  { key: 'position_paper_feedback', label: 'Position Paper Feedback', description: 'Sent to a delegate when their chair leaves feedback on their position paper.', defaultDelivery: 'immediate' },
  { key: 'import_join_invite', label: 'Import: join Gavelling', description: 'Sent to imported applicants asking them to create a Gavelling account so their registration attaches automatically. Always sends — clicking INVITE is the consent — using your draft if enabled, otherwise our default.', defaultDelivery: 'immediate', functional: true },
];

/** Looks up a registry event's display label, falling back to the raw key if unknown. */
export function getEventLabel(eventKey: string): string {
  return EVENT_REGISTRY.find(e => e.key === eventKey)?.label ?? eventKey;
}

// ── Three-state send outcome ─────────────────────────────────────────────────
// 'sent-custom'   — enabled + a real drafted template -> that draft sent.
// 'sent-default'  — enabled but undrafted (a stub row, or empty content) ->
//                    getDefaultEventEmail sent instead.
// 'off'           — a row exists with enabled=false -> skip SILENTLY, no notice.
// 'unconfigured'  — no row at all -> nothing sent; the UI nudges the organizer
//                    to TURN ON (send our default) or DRAFT their own.
// 'no-recipients' — applicationIds was empty, or every id was suppressed by
//                    the caller's consolidation rule -> nothing to notice.
export type QueueOutcome = 'sent-custom' | 'sent-default' | 'off' | 'unconfigured' | 'no-recipients';

export interface QueueEventEmailResult {
  outcome: QueueOutcome;
  /** True iff outcome === 'sent-custom'. Kept for callers that only care
   *  whether their OWN drafted copy went out (e.g. removeFromDelegation's
   *  return shape) — prefer `outcome` for anything UI-facing. */
  drafted: boolean;
  queued?: number;
  /** Application ids that actually received an outbox row this call — the
   *  suppression set a subsequent lower-priority queueEventEmail call should
   *  pass so it doesn't double-email the same people (e.g. payment_available
   *  after application_accepted). */
  queuedApplicationIds?: string[];
  eventKey?: string;
  eventLabel?: string;
}

/** True when the outcome should surface a DraftNotice-style nudge — the two
 *  "something's missing" states. 'off' and 'sent-custom' never notice: OFF is
 *  an explicit organizer choice, and a real draft sending is just success. */
export function shouldNotify(outcome: QueueOutcome): outcome is 'unconfigured' | 'sent-default' {
  return outcome === 'unconfigured' || outcome === 'sent-default';
}

/** Convenience wrapper for the common call-site shape: push a notice iff the
 *  outcome warrants one. Replaces the old `if (!result.drafted) pushDraftNotice(key)`
 *  pattern, which would have incorrectly noticed on 'off' under the new semantics. */
export function notifyIfNeeded(
  result: QueueEventEmailResult,
  push: (eventKey: string, outcome: 'unconfigured' | 'sent-default') => void
) {
  if (shouldNotify(result.outcome)) push(result.eventKey ?? '', result.outcome);
}

/** A template row counts as "drafted" only once it actually has content — a
 *  stub row created by TURN ON (enabled, empty body) is still "undrafted"
 *  and falls back to the default copy. */
function hasDraftContent(template: TemplateRow): boolean {
  const blocks = Array.isArray(template.body_blocks) ? (template.body_blocks as unknown[]) : [];
  return blocks.length > 0 || !!(template.body && template.body.trim().length > 0);
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
  society_id: string | null;
  payment_status: string | null;
  societies: { name: string } | null;
  assigned_committee: { abbreviation: string | null; name: string } | null;
  assigned_country_name: string | null;
  profiles: { display_name: string; email: string | null } | null;
  invited_email: string | null;
  invited_name: string | null;
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
  email_theme: EmailTheme | null;
}

/**
 * Loads the conference's template for eventKey and resolves the three-state
 * send outcome (see QueueOutcome above): enabled+drafted sends that draft,
 * enabled+undrafted falls back to getDefaultEventEmail, a disabled row skips
 * silently, and no row at all skips with an 'unconfigured' nudge. `opts.suppressIds`
 * lets a caller drop recipients another higher-priority event already emailed
 * in the same action (consolidation rules) — suppressed recipients are simply
 * excluded before anything is looked up, never counted as a failure.
 */
export async function queueEventEmail(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  eventKey: string,
  applicationIds: string[],
  extraCtx?: EmailTokenContext,
  opts?: { suppressIds?: Set<string> | string[] }
): Promise<QueueEventEmailResult> {
  const eventLabel = getEventLabel(eventKey);
  const suppress = opts?.suppressIds instanceof Set ? opts.suppressIds : new Set(opts?.suppressIds ?? []);
  const ids = applicationIds.filter(id => !suppress.has(id));
  if (ids.length === 0) return { outcome: 'no-recipients', drafted: false, eventKey, eventLabel };

  const { data: templateData } = await supabase
    .from('email_templates')
    .select('id, subject, body, body_blocks, enabled')
    .eq('conference_id', conferenceId)
    .eq('event_key', eventKey)
    .maybeSingle();

  const template = templateData as TemplateRow | null;
  if (!template) return { outcome: 'unconfigured', drafted: false, eventKey, eventLabel };
  if (!template.enabled) return { outcome: 'off', drafted: false, eventKey, eventLabel };

  const useDraft = hasDraftContent(template);
  const fallback = useDraft ? null : getDefaultEventEmail(eventKey);
  const outcome: QueueOutcome = useDraft ? 'sent-custom' : 'sent-default';

  const [{ data: confData }, { data: recipientsData }] = await Promise.all([
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
        profiles (display_name, email),
        invited_email, invited_name
      `)
      .in('id', ids),
  ]);

  const conference = confData as ConferenceRow | null;
  const recipients = (recipientsData ?? []) as unknown as RecipientRow[];
  if (recipients.length === 0) return { outcome, drafted: useDraft, queued: 0, queuedApplicationIds: [], eventKey, eventLabel };

  const renderConf: EmailRenderConference = {
    slug: conference?.slug ?? '',
    acronym: conference?.acronym ?? '',
    full_name: conference?.full_name ?? '',
    banner_url: conference?.banner_url ?? null,
    logo_url: conference?.logo_url ?? null,
    contact_email: conference?.contact_email ?? '',
    email_theme: conference?.email_theme ?? null,
  };
  const blocks = useDraft ? normalizeBlocks(template.body_blocks, template.body) : (fallback?.blocks ?? []);
  const subjectSource = useDraft ? template.subject : (fallback?.subject ?? '');
  const flatBody = flattenBlocksToPlainText(blocks, renderConf);

  const rows = recipients.map(app => {
    const ctx: EmailTokenContext = {
      delegate_name: app.profiles?.display_name ?? app.invited_name ?? null,
      role: roleLabel(app.role),
      delegation_name: app.societies?.name ?? (app.society_id == null ? 'Independent' : null),
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
      recipient_email: app.profiles?.email ?? app.invited_email ?? null,
      subject: resolveTokens(subjectSource, ctx),
      body: resolveTokens(flatBody, ctx),
      body_html: renderEmailHtml({ blocks, conference: renderConf, ctx }),
      status: 'pending' as const,
    };
  });

  const { error } = await supabase.from('email_outbox').insert(rows);
  if (error) return { outcome, drafted: useDraft, queued: 0, queuedApplicationIds: [], eventKey, eventLabel };

  triggerEmailDelivery(supabase);

  return {
    outcome,
    drafted: useDraft,
    queued: rows.length,
    queuedApplicationIds: rows.map(r => r.recipient_application_id),
    eventKey,
    eventLabel,
  };
}

// ── Turn-on-default helper ───────────────────────────────────────────────────
// Creates (or re-enables) a conference's stub template for an event so
// queueEventEmail's "enabled + undrafted" default-send path activates —
// shared by the Notifications registry's toggle-on-an-unconfigured-row action
// and the "TURN ON" affordance on the 'unconfigured' DraftNotice.

export async function turnOnDefaultEmail(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  eventKey: string
): Promise<{ ok: boolean; error?: string }> {
  const event = EVENT_REGISTRY.find(e => e.key === eventKey);

  const { data: existing } = await supabase
    .from('email_templates')
    .select('id')
    .eq('conference_id', conferenceId)
    .eq('event_key', eventKey)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('email_templates').update({ enabled: true }).eq('id', (existing as { id: string }).id);
    return { ok: !error, error: error?.message };
  }

  const { error } = await supabase.from('email_templates').insert({
    conference_id: conferenceId,
    event_key: eventKey,
    name: event?.label ?? eventKey,
    subject: '',
    body: '',
    body_blocks: [],
    enabled: true,
    delivery: event?.defaultDelivery ?? 'immediate',
    lifecycle: 'draft',
  });
  return { ok: !error, error: error?.message };
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
      .select('slug, acronym, full_name, banner_url, logo_url, contact_email, email_theme')
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
    email_theme: conference?.email_theme ?? null,
  };

  const ctx: EmailTokenContext = {
    delegate_name: invitedName,
    committee: committeeName,
    conference_name: conference?.full_name ?? null,
  };

  const useTemplate = !!template && template.enabled;
  const fallback = getDefaultEventEmail('committee_chair_invite');
  const blocks: EmailBlock[] = useTemplate ? normalizeBlocks(template!.body_blocks, template!.body) : (fallback?.blocks ?? []);
  const subjectSource = useTemplate ? template!.subject : (fallback?.subject ?? '');
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

// ── Import "join Gavelling" invite emails ───────────────────────────────────
// Bulk variant of the chair-invite pattern: recipients are unclaimed imported
// applications (user_id null, invited_email set). One template lookup, one
// outbox insert per still-unclaimed application, one delivery trigger.

export interface ImportJoinInviteRecipient {
  applicationId: string;
  invitedEmail: string;
  invitedName: string;
}

export async function queueImportJoinInviteEmails(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  recipients: ImportJoinInviteRecipient[]
): Promise<{ queued: number }> {
  if (recipients.length === 0) return { queued: 0 };

  const [{ data: confData }, { data: templateData }] = await Promise.all([
    supabase
      .from('conferences')
      .select('slug, acronym, full_name, banner_url, logo_url, contact_email, email_theme')
      .eq('id', conferenceId)
      .single(),
    supabase
      .from('email_templates')
      .select('id, subject, body, body_blocks, enabled')
      .eq('conference_id', conferenceId)
      .eq('event_key', 'import_join_invite')
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
    email_theme: conference?.email_theme ?? null,
  };

  const useTemplate = !!template && template.enabled;
  const fallback = getDefaultEventEmail('import_join_invite');
  const blocks: EmailBlock[] = useTemplate ? normalizeBlocks(template!.body_blocks, template!.body) : (fallback?.blocks ?? []);
  const subjectSource = useTemplate ? template!.subject : (fallback?.subject ?? '');
  const flatBody = flattenBlocksToPlainText(blocks, renderConf);

  const rows = recipients.map(r => {
    const ctx: EmailTokenContext = {
      delegate_name: r.invitedName,
      conference_name: conference?.full_name ?? null,
    };
    return {
      conference_id: conferenceId,
      template_id: useTemplate ? template!.id : null,
      recipient_application_id: r.applicationId,
      recipient_email: r.invitedEmail,
      subject: resolveTokens(subjectSource, ctx),
      body: resolveTokens(flatBody, ctx),
      body_html: renderEmailHtml({ blocks, conference: renderConf, ctx }),
      status: 'pending' as const,
    };
  });

  const { error } = await supabase.from('email_outbox').insert(rows);
  if (error) return { queued: 0 };

  triggerEmailDelivery(supabase);

  return { queued: rows.length };
}
