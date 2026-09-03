// Queues outbox rows for a platform event, resolving the conference's enabled
// template (if any) against each recipient application. Pure DB helper, no
// delivery happens here, just email_outbox rows with status 'pending'.

import { getAuthedClient } from '@/lib/supabase-auth';
import { resolveTokens, type EmailTokenContext } from '@/lib/emailTokens';
import { normalizeBlocks, flattenBlocksToPlainText, getSiteUrl, type EmailBlock } from '@/lib/emailBlocks';
import { renderEmailHtml, type EmailRenderConference, type EmailTheme } from '@/lib/emailHtml';
import { formatFee } from '@/lib/utils';
import { activePhaseFee, type FeePhase } from '@/lib/finance';
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
   *  send, clicking INVITE is the consent, so the Notifications registry
   *  hides their toggle and shows a fixed "always sends" note instead. */
  functional?: boolean;
}

export const EVENT_REGISTRY = [
  { key: 'application_received', label: 'Application Received', description: 'Sent to a delegate when their application is submitted.', defaultDelivery: 'immediate' },
  { key: 'draft_reminder', label: 'Unfinished application reminder', description: "Sent to someone who started an application and never submitted it, nudging them back to their saved answers. Queued by the send_draft_reminder RPC (organizer-only, one reminder per draft per 72 hours), not by queueEventEmail. It follows the same superset rule as Question received: with no template row our default still sends, and only a row you have explicitly turned off skips it.", defaultDelivery: 'immediate' },
  { key: 'application_accepted', label: 'Application Accepted', description: 'Sent when an application is accepted.', defaultDelivery: 'immediate' },
  { key: 'application_rejected', label: 'Application Rejected', description: 'Sent when an application is rejected.', defaultDelivery: 'immediate' },
  { key: 'payment_available', label: 'Payment Available', description: "Sent when payment opens up for a delegate. Companion to Application Accepted: on acceptance, this is suppressed for anyone who was actually emailed Application Accepted for the same action. It only sends alone when that email resolved to nothing (off or unconfigured) for them.", defaultDelivery: 'immediate' },
  { key: 'payment_received', label: 'Payment Received', description: "Sent when a delegate is marked paid.", defaultDelivery: 'immediate' },
  { key: 'fee_waived', label: 'Fee Waived', description: "Sent when a delegate's fee is waived.", defaultDelivery: 'immediate' },
  { key: 'aid_approved', label: 'Financial Aid Approved', description: "Sent when a delegate's financial aid request is approved.", defaultDelivery: 'immediate' },
  { key: 'aid_denied', label: 'Financial Aid Denied', description: "Sent when a delegate's financial aid request is denied.", defaultDelivery: 'immediate' },
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
  { key: 'documents_published', label: 'Study guide released', description: "Sent automatically to a committee's delegates when its study guide release time passes.", defaultDelivery: 'immediate' },
  { key: 'chair_assigned', label: 'Chair Assigned', description: 'Sent when someone is assigned as a committee chair.', defaultDelivery: 'immediate' },
  { key: 'committee_chair_invite', label: 'Chair invite', description: 'Sent when an organizer invites someone to chair a committee. Always sends, clicking INVITE is the consent, using your draft if enabled, otherwise our default.', defaultDelivery: 'immediate', functional: true },
  { key: 'organizer_invite', label: 'Organizer invite', description: 'Sent when someone is invited to join the organizing team. Always sends, clicking INVITE is the consent, using your draft if enabled, otherwise our default.', defaultDelivery: 'immediate', functional: true },
  { key: 'session_chair_invite', label: 'Session Chair Invite', description: 'Sent to committee chairs with their session code and chair password.', defaultDelivery: 'manual' },
  { key: 'session_join_invite', label: 'Session Join Invite', description: 'Sent to committee participants inviting them to join the live session.', defaultDelivery: 'manual' },
  { key: 'request_reply', label: 'Request reply', description: 'Sent to a participant when the organizing team replies to their question.', defaultDelivery: 'immediate' },
  { key: 'request_received', label: 'Question received', description: 'Sent to your organizing team when a participant asks a question on Gavelling, and again as a digest every 3 days while questions are still awaiting a reply. Each organizer can turn it off under Questions & Reminders on their own profile.', defaultDelivery: 'immediate' },
  { key: 'delegation_swap', label: 'Delegation swap', description: 'Sent to both delegates when their committee allocations are swapped within a delegation.', defaultDelivery: 'immediate' },
  { key: 'import_join_invite', label: 'Import: join Gavelling', description: 'Sent to imported applicants asking them to create a Gavelling account so their registration attaches automatically. Always sends, clicking INVITE is the consent, using your draft if enabled, otherwise our default.', defaultDelivery: 'immediate', functional: true },
] as const satisfies readonly EventDef[];

/** Union of every valid event key, derived from the registry itself so
 *  NOTIFICATION_CATEGORY below can be checked for exhaustiveness at compile
 *  time — add a key to EVENT_REGISTRY and TypeScript refuses to build until
 *  it also has a category. */
export type EventKey = typeof EVENT_REGISTRY[number]['key'];

/** Looks up a registry event's display label, falling back to the raw key if unknown. */
export function getEventLabel(eventKey: string): string {
  return EVENT_REGISTRY.find(e => e.key === eventKey)?.label ?? eventKey;
}

// ── Notification preference mapping ─────────────────────────────────────────
// Every EVENT_REGISTRY key maps to one of the toggles on /account/profile.
// Before an outbox row is written for a recipient, queueEventEmail checks
// their corresponding notify_email_* preference (default true when unset,
// same default the profile page uses). Imported/unregistered recipients (no
// profiles row, user_id null) have never had a chance to set a preference,
// so they always receive the email. ALWAYS_SEND_EVENTS below skips this
// check entirely for the handful of emails the product can't function
// without, the invite itself is the consent.

export type NotificationCategory = 'applications' | 'payments' | 'documents' | 'marketing' | 'requests';

export const NOTIFICATION_CATEGORY: Record<EventKey, NotificationCategory> = {
  application_received: 'applications',
  // Deliberately NOT 'requests': notify_email_reminders is the organizer-side
  // questions digest, and its profile-page copy says exactly that. An
  // unfinished-application nudge is a participant application email.
  draft_reminder: 'applications',
  application_accepted: 'applications',
  application_rejected: 'applications',
  payment_available: 'payments',
  payment_received: 'payments',
  fee_waived: 'payments',
  aid_approved: 'applications',
  aid_denied: 'applications',
  allocation_assigned: 'applications',
  allocation_changed: 'applications',
  allocation_removed: 'applications',
  pledge_received: 'applications',
  added_to_delegation: 'applications',
  removed_from_delegation: 'applications',
  spot_received: 'applications',
  spot_lost: 'applications',
  not_attending: 'applications',
  attendance_restored: 'applications',
  documents_published: 'documents',
  chair_assigned: 'applications',
  committee_chair_invite: 'applications',
  organizer_invite: 'applications',
  session_chair_invite: 'applications',
  session_join_invite: 'applications',
  request_reply: 'applications',
  request_received: 'requests',
  delegation_swap: 'applications',
  import_join_invite: 'applications',
};

/** The profiles column each category is gated on. 'requests' reuses the
 *  long-existing but previously unwired notify_email_reminders column (NOT
 *  NULL DEFAULT true), so an organizer who has never opened their profile
 *  receives question alerts — no migration, and no conflation with the
 *  applications toggle, which is a participant-side concern. */
export const PREFERENCE_FIELD: Record<NotificationCategory, PreferenceField> = {
  applications: 'notify_email_applications',
  payments: 'notify_email_payments',
  documents: 'notify_email_documents',
  marketing: 'notify_email_marketing',
  requests: 'notify_email_reminders',
};

export type PreferenceField =
  | 'notify_email_applications'
  | 'notify_email_payments'
  | 'notify_email_documents'
  | 'notify_email_marketing'
  | 'notify_email_reminders';

export type PreferenceRow = Partial<Record<PreferenceField, boolean | null>>;

// Transactional/functional emails a user can't opt out of without breaking
// the product: clicking INVITE (chair/import) is itself the consent, and a
// reply to a question the participant asked themselves isn't a marketing
// choice, it's the answer they're waiting on.
const ALWAYS_SEND_EVENTS = new Set(['committee_chair_invite', 'organizer_invite', 'import_join_invite', 'request_reply']);

/** True if this recipient should receive an email in `category` given their
 *  notification preferences. THE one place a notify_email_* column is read at
 *  send time — `recipientAllowsEvent` (registry events) and the ad-hoc sender
 *  in `@/lib/adHocEmail` (organizer-composed one-offs, 'marketing') both go
 *  through here rather than testing the column themselves. Unregistered /
 *  imported recipients have no profiles row and so no preference to honour
 *  yet; they stay eligible. */
export function recipientAllowsCategory(
  category: NotificationCategory,
  profiles: PreferenceRow | null
): boolean {
  if (!profiles) return true; // imported, unclaimed: no preferences to honour yet
  const pref = profiles[PREFERENCE_FIELD[category]];
  return pref !== false; // default true when null/undefined, same as the profile page
}

/** True if this recipient should receive eventKey given their notification
 *  preferences. Unregistered/imported recipients (no profiles row) and
 *  always-send functional events bypass the check. */
function recipientAllowsEvent(
  eventKey: string,
  profiles: PreferenceRow | null
): boolean {
  if (ALWAYS_SEND_EVENTS.has(eventKey)) return true;
  const category = NOTIFICATION_CATEGORY[eventKey as EventKey];
  if (!category) return true;
  return recipientAllowsCategory(category, profiles);
}

// ── Three-state send outcome ─────────────────────────────────────────────────
// 'sent-custom':   enabled + a real drafted template -> that draft sent.
// 'sent-default':  enabled but undrafted (a stub row, or empty content) ->
//                  getDefaultEventEmail sent instead.
// 'off':           a row exists with enabled=false -> skip SILENTLY, no notice.
// 'unconfigured':  no row at all -> nothing sent; the UI nudges the organizer
//                  to TURN ON (send our default) or DRAFT their own.
// 'no-recipients': applicationIds was empty, or every id was suppressed by
//                  the caller's consolidation rule -> nothing to notice.
export type QueueOutcome = 'sent-custom' | 'sent-default' | 'off' | 'unconfigured' | 'no-recipients';

export interface QueueEventEmailResult {
  outcome: QueueOutcome;
  /** True iff outcome === 'sent-custom'. Kept for callers that only care
   *  whether their OWN drafted copy went out (e.g. removeFromDelegation's
   *  return shape); prefer `outcome` for anything UI-facing. */
  drafted: boolean;
  queued?: number;
  /** Application ids that actually received an outbox row this call, the
   *  suppression set a subsequent lower-priority queueEventEmail call should
   *  pass so it doesn't double-email the same people (e.g. payment_available
   *  after application_accepted). */
  queuedApplicationIds?: string[];
  eventKey?: string;
  eventLabel?: string;
}

/** True when the outcome should surface a DraftNotice-style nudge, the two
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

/** A template row counts as "drafted" only once it actually has content, a
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

function formatDate(d: string | null): string {
  if (!d) return 'TBD';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return 'TBD';
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
  profiles: {
    display_name: string; email: string | null;
    notify_email_applications: boolean | null; notify_email_payments: boolean | null; notify_email_documents: boolean | null;
    notify_email_marketing: boolean | null;
  } | null;
  invited_email: string | null;
  invited_name: string | null;
}

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
  // Selected purely for the email footer's social row.
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  website_url: string | null;
}

interface RoleFeeConfigRow {
  role: string;
  fee_amount: number | null;
  fee_currency: string | null;
  fee_phases: FeePhase[] | null;
}

/** Role- and phase-aware fee token: the {{fee}} a recipient actually owes
 *  today, not the retired conferences.fee_amount (frequently 0 now that the
 *  real price lives per-role in application_role_configs, with an optional
 *  phase window). Falls back to the old conference-level value only when
 *  the recipient's role has no config row at all. */
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
 * Loads the conference's template for eventKey and resolves the three-state
 * send outcome (see QueueOutcome above): enabled+drafted sends that draft,
 * enabled+undrafted falls back to getDefaultEventEmail, a disabled row skips
 * silently, and no row at all skips with an 'unconfigured' nudge. `opts.suppressIds`
 * lets a caller drop recipients another higher-priority event already emailed
 * in the same action (consolidation rules); suppressed recipients are simply
 * excluded before anything is looked up, never counted as a failure.
 */
export async function queueEventEmail(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  eventKey: string,
  applicationIds: string[],
  extraCtx?: EmailTokenContext,
  opts?: { suppressIds?: Set<string> | string[]; sendAfter?: string }
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

  const [{ data: confData }, { data: recipientsData }, { data: roleConfigsData }] = await Promise.all([
    supabase
      .from('conferences')
      .select('slug, acronym, full_name, start_date, end_date, fee_amount, fee_currency, banner_url, logo_url, contact_email, email_theme, instagram_url, facebook_url, tiktok_url, website_url')
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
      .in('id', ids),
    supabase
      .from('application_role_configs')
      .select('role, fee_amount, fee_currency, fee_phases')
      .eq('conference_id', conferenceId),
  ]);

  const conference = confData as ConferenceRow | null;
  const roleConfigs = (roleConfigsData ?? []) as RoleFeeConfigRow[];
  const allRecipients = (recipientsData ?? []) as unknown as RecipientRow[];
  // Preference gate: drop recipients who've opted out of this event's
  // category. Imported/unclaimed applicants and always-send functional
  // events (see ALWAYS_SEND_EVENTS) pass through untouched.
  const recipients = allRecipients.filter(app => recipientAllowsEvent(eventKey, app.profiles));
  if (recipients.length === 0) return { outcome, drafted: useDraft, queued: 0, queuedApplicationIds: [], eventKey, eventLabel };

  const renderConf: EmailRenderConference = {
    slug: conference?.slug ?? '',
    acronym: conference?.acronym ?? '',
    full_name: conference?.full_name ?? '',
    banner_url: conference?.banner_url ?? null,
    logo_url: conference?.logo_url ?? null,
    contact_email: conference?.contact_email ?? '',
    instagram_url: conference?.instagram_url ?? null,
    facebook_url: conference?.facebook_url ?? null,
    tiktok_url: conference?.tiktok_url ?? null,
    website_url: conference?.website_url ?? null,
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
      fee: resolveFeeToken(app.role, roleConfigs, conference),
      ...extraCtx,
    };
    return {
      conference_id: conferenceId,
      template_id: template.id,
      recipient_application_id: app.id,
      recipient_email: app.profiles?.email ?? app.invited_email ?? null,
      subject: resolveTokens(subjectSource, ctx),
      body: resolveTokens(flatBody, ctx),
      body_html: renderEmailHtml({ blocks, conference: renderConf, ctx, variant: 'transactional' }),
      status: 'pending' as const,
      ...(opts?.sendAfter ? { send_after: opts.sendAfter } : {}),
    };
  });

  const { error } = await supabase.from('email_outbox').insert(rows);
  if (error) {
    console.error(`[queueEventEmail] email_outbox insert failed for "${eventKey}" (${rows.length} row${rows.length === 1 ? '' : 's'}):`, error.message);
    return { outcome, drafted: useDraft, queued: 0, queuedApplicationIds: [], eventKey, eventLabel };
  }

  // A scheduled row (send_after set) is left for the server-side cron to
  // drain when its time arrives; only an immediate queue kicks the
  // client-triggered delivery.
  if (!opts?.sendAfter) {
    triggerEmailDelivery(supabase);
  }

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
// queueEventEmail's "enabled + undrafted" default-send path activates,
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
  });
  return { ok: !error, error: error?.message };
}

// ── Chair invite email ──────────────────────────────────────────────────────
// Unlike queueEventEmail, the recipient here has no application row yet (they
// may not even have applied), so this queues a single outbox row directly
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
      .select('slug, acronym, full_name, banner_url, logo_url, contact_email, email_theme, instagram_url, facebook_url, tiktok_url, website_url')
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
    instagram_url: conference?.instagram_url ?? null,
    facebook_url: conference?.facebook_url ?? null,
    tiktok_url: conference?.tiktok_url ?? null,
    website_url: conference?.website_url ?? null,
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
    body_html: renderEmailHtml({ blocks, conference: renderConf, ctx, chairInviteToken: token, variant: 'transactional' }),
    status: 'pending',
  });
  if (error) return;

  triggerEmailDelivery(supabase);
}

// ── Organizer invite email ──────────────────────────────────────────────────
// Same shape as queueChairInviteEmail: the invitee has no application row
// (they may not even have an account yet), so this queues a single outbox
// row directly against recipient_email. Organizers can customize the
// 'organizer_invite' template like any other event; a missing/disabled
// template falls back to the built-in default so the invite is never
// blocked on template setup.

export interface QueueOrganizerInviteEmailArgs {
  conferenceId: string;
  token: string;
  invitedEmail: string;
  /** null when the invitee has no Gavelling account yet — there is no name to greet them by. */
  invitedName: string | null;
  /** Whether the invited email already belongs to a Gavelling account. false
   *  swaps in create-account copy (no {{delegate_name}} to greet with, and a
   *  CTA that reads "create an account" rather than "accept"). */
  accountExists: boolean;
  /** Display name of the organizer who sent the invite, used only in the
   *  no-account copy since there's no invitee name to personalize with. */
  inviterName: string;
}

export async function queueOrganizerInviteEmail(
  supabase: ReturnType<typeof getAuthedClient>,
  args: QueueOrganizerInviteEmailArgs
): Promise<void> {
  const { conferenceId, token, invitedEmail, invitedName, accountExists, inviterName } = args;

  const [{ data: confData }, { data: templateData }] = await Promise.all([
    supabase
      .from('conferences')
      .select('slug, acronym, full_name, banner_url, logo_url, contact_email, email_theme, instagram_url, facebook_url, tiktok_url, website_url')
      .eq('id', conferenceId)
      .single(),
    supabase
      .from('email_templates')
      .select('id, subject, body, body_blocks, enabled')
      .eq('conference_id', conferenceId)
      .eq('event_key', 'organizer_invite')
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
    instagram_url: conference?.instagram_url ?? null,
    facebook_url: conference?.facebook_url ?? null,
    tiktok_url: conference?.tiktok_url ?? null,
    website_url: conference?.website_url ?? null,
    email_theme: conference?.email_theme ?? null,
  };

  const ctx: EmailTokenContext = {
    delegate_name: invitedName,
    conference_name: conference?.full_name ?? null,
  };

  const useTemplate = !!template && template.enabled;
  const fallback = getDefaultEventEmail('organizer_invite');

  // No account yet: there's no invitee name to greet ({{delegate_name}}
  // would resolve to an unresolved-token marker), so the fallback swaps in
  // fixed create-account copy naming the inviter and the conference acronym
  // instead. A conference's own customized template (useTemplate) is left
  // alone either way — same as the existing-account path, it's on the
  // organizer to know their template greets an invitee by name.
  const noAccountBlocks: EmailBlock[] = [
    { type: 'paragraph', content: `${inviterName} invited you to join the organizing team of ${renderConf.acronym || renderConf.full_name} on Gavelling. Create your free account with this email address to accept.` },
    { type: 'button', label: 'CREATE ACCOUNT AND ACCEPT', destination: 'organizer_invite_accept' },
  ];

  const blocks: EmailBlock[] = useTemplate
    ? normalizeBlocks(template!.body_blocks, template!.body)
    : accountExists
      ? (fallback?.blocks ?? [])
      : noAccountBlocks;
  const subjectSource = useTemplate ? template!.subject : (fallback?.subject ?? '');
  const flatBody = flattenBlocksToPlainText(blocks, renderConf, { organizerInviteToken: token });

  const { error } = await supabase.from('email_outbox').insert({
    conference_id: conferenceId,
    template_id: useTemplate ? template!.id : null,
    recipient_application_id: null,
    recipient_email: invitedEmail,
    subject: resolveTokens(subjectSource, ctx),
    body: resolveTokens(flatBody, ctx),
    body_html: renderEmailHtml({ blocks, conference: renderConf, ctx, organizerInviteToken: token, variant: 'transactional' }),
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

  const recipientIds = recipients.map(r => r.applicationId);

  const [{ data: confData }, { data: templateData }, { data: claimData }, { data: allocData }] = await Promise.all([
    supabase
      .from('conferences')
      .select('slug, acronym, full_name, banner_url, logo_url, contact_email, email_theme, instagram_url, facebook_url, tiktok_url, website_url')
      .eq('id', conferenceId)
      .single(),
    supabase
      .from('email_templates')
      .select('id, subject, body, body_blocks, enabled')
      .eq('conference_id', conferenceId)
      .eq('event_key', 'import_join_invite')
      .maybeSingle(),
    // Per-recipient claim token: the personal /invites/import/[token] link the
    // 'import_claim' button resolves to. A null token means the DB trigger
    // hasn't minted one (or the row isn't really an imported invite), so that
    // recipient is skipped rather than sent a dead-link '#' button.
    supabase
      .from('applications')
      .select('id, claim_token')
      .in('id', recipientIds),
    // Per-recipient allocation, so the default copy can lead with their seat.
    supabase
      .from('conference_allocations')
      .select('application_id, country_name, conference_committees(name, abbreviation)')
      .in('application_id', recipientIds),
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
    instagram_url: conference?.instagram_url ?? null,
    facebook_url: conference?.facebook_url ?? null,
    tiktok_url: conference?.tiktok_url ?? null,
    website_url: conference?.website_url ?? null,
    email_theme: conference?.email_theme ?? null,
  };

  const claimTokenByApp = new Map<string, string | null>();
  for (const c of (claimData ?? []) as { id: string; claim_token: string | null }[]) {
    claimTokenByApp.set(c.id, c.claim_token);
  }
  const allocByApp = new Map<string, { countryName: string; committeeName: string }>();
  type CommitteeLite = { name: string; abbreviation: string | null };
  type AllocRow = { application_id: string; country_name: string | null; conference_committees: CommitteeLite | CommitteeLite[] | null };
  for (const a of (allocData ?? []) as unknown as AllocRow[]) {
    // PostgREST types this to-one embed as an array in the generic even though
    // it returns a single object at runtime, so normalize both shapes.
    const committee = Array.isArray(a.conference_committees) ? a.conference_committees[0] : a.conference_committees;
    if (a.application_id && committee?.name && a.country_name && !allocByApp.has(a.application_id)) {
      allocByApp.set(a.application_id, { countryName: a.country_name, committeeName: committee.name });
    }
  }

  const useTemplate = !!template && template.enabled;
  const fallback = getDefaultEventEmail('import_join_invite');
  // A custom enabled template is shared verbatim across recipients (organizer's
  // own copy); otherwise each recipient gets the default, with an allocation
  // holder's leading paragraph swapped for a seat-specific one.
  const sharedBlocks: EmailBlock[] = useTemplate ? normalizeBlocks(template!.body_blocks, template!.body) : (fallback?.blocks ?? []);
  const subjectSource = useTemplate ? template!.subject : (fallback?.subject ?? '');

  const rows = recipients.flatMap(r => {
    const token = claimTokenByApp.get(r.applicationId) ?? null;
    if (!token) return []; // no claim link to send, skip this recipient entirely

    let blocks = sharedBlocks;
    if (!useTemplate) {
      const alloc = allocByApp.get(r.applicationId);
      if (alloc) {
        blocks = sharedBlocks.map(b =>
          b.type === 'paragraph'
            ? { ...b, content: 'Hi {{delegate_name}},\n\n{{conference_name}} runs on Gavelling. You are registered as ' + alloc.countryName + ' in ' + alloc.committeeName + '. Open your invitation to confirm your seat and activate your account, and everything attaches automatically.' }
            : b
        );
      }
    }

    const ctx: EmailTokenContext = {
      delegate_name: r.invitedName,
      conference_name: conference?.full_name ?? null,
    };
    return [{
      conference_id: conferenceId,
      template_id: useTemplate ? template!.id : null,
      recipient_application_id: r.applicationId,
      recipient_email: r.invitedEmail,
      subject: resolveTokens(subjectSource, ctx),
      body: resolveTokens(flattenBlocksToPlainText(blocks, renderConf, { importClaimToken: token }), ctx),
      body_html: renderEmailHtml({ blocks, conference: renderConf, ctx, importClaimToken: token, variant: 'transactional' }),
      status: 'pending' as const,
    }];
  });

  if (rows.length === 0) return { queued: 0 };

  const { error } = await supabase.from('email_outbox').insert(rows);
  if (error) return { queued: 0 };

  triggerEmailDelivery(supabase);

  return { queued: rows.length };
}

// ── Organizer-directed event queue ("a question just came in") ──────────────
// Every other event in the registry is participant-facing: queueEventEmail
// resolves its recipients from applications joined to profiles. An organizer
// has no application row, so this resolves the organizing team from
// conference_organizers (which every conference owner also has a row in)
// joined to profiles, and writes outbox rows with recipient_application_id
// null against a resolved recipient_email — the same shape
// queueChairInviteEmail / queueOrganizerInviteEmail already use for
// recipients who aren't applicants. Nothing about the 27 existing events
// changes.
//
// Template rules, a deliberate superset of the two patterns already here:
//   no template row      -> built-in default sends (an organizer alert must
//                           not be silently blocked on template setup, the
//                           way an 'unconfigured' participant event is)
//   row present, off     -> skip, that's an explicit organizer choice
//   row on but undrafted -> built-in default
//   row on and drafted   -> their draft

export interface QueueRequestReceivedArgs {
  conferenceId: string;
  requestId: string;
  subject: string;
  /** The participant's opening message. Truncated in the email body. */
  body: string;
  /** Display name of the participant who asked. */
  askerName: string | null;
}

const REQUEST_BODY_PREVIEW_CHARS = 600;

interface OrganizerRecipientRow {
  user_id: string;
  profiles: { display_name: string | null; email: string | null; notify_email_reminders: boolean | null } | null;
}

/** Deep link into the conference's Communications inbox, focused on one thread. */
export function requestInboxUrl(slug: string, requestId: string): string {
  return `${getSiteUrl()}/manage/${slug}/communications?inbox=${encodeURIComponent(requestId)}`;
}

/** Points any custom-destination button in the built-in default at this
 *  specific thread. A conference's own drafted template is never rewritten. */
function withInboxLink(blocks: EmailBlock[], url: string): EmailBlock[] {
  return blocks.map(b => (b.type === 'button' && b.destination === 'custom' ? { ...b, url } : b));
}

export async function queueRequestReceivedEmail(
  supabase: ReturnType<typeof getAuthedClient>,
  args: QueueRequestReceivedArgs
): Promise<{ queued: number }> {
  const { conferenceId, requestId, subject, body, askerName } = args;
  const eventKey = 'request_received';

  const [{ data: confData }, { data: templateData }, { data: organizerData }] = await Promise.all([
    supabase
      .from('conferences')
      .select('slug, acronym, full_name, banner_url, logo_url, contact_email, email_theme, instagram_url, facebook_url, tiktok_url, website_url')
      .eq('id', conferenceId)
      .single(),
    supabase
      .from('email_templates')
      .select('id, subject, body, body_blocks, enabled')
      .eq('conference_id', conferenceId)
      .eq('event_key', eventKey)
      .maybeSingle(),
    supabase
      .from('conference_organizers')
      .select('user_id, profiles (display_name, email, notify_email_reminders)')
      .eq('conference_id', conferenceId),
  ]);

  const template = templateData as TemplateRow | null;
  if (template && !template.enabled) return { queued: 0 };

  const conference = confData as ConferenceRow | null;
  const renderConf: EmailRenderConference = {
    slug: conference?.slug ?? '',
    acronym: conference?.acronym ?? '',
    full_name: conference?.full_name ?? '',
    banner_url: conference?.banner_url ?? null,
    logo_url: conference?.logo_url ?? null,
    contact_email: conference?.contact_email ?? '',
    instagram_url: conference?.instagram_url ?? null,
    facebook_url: conference?.facebook_url ?? null,
    tiktok_url: conference?.tiktok_url ?? null,
    website_url: conference?.website_url ?? null,
    email_theme: conference?.email_theme ?? null,
  };

  const useDraft = !!template && hasDraftContent(template);
  const fallback = getDefaultEventEmail(eventKey);
  const inboxUrl = requestInboxUrl(renderConf.slug, requestId);
  const blocks: EmailBlock[] = useDraft
    ? normalizeBlocks(template!.body_blocks, template!.body)
    : withInboxLink(fallback?.blocks ?? [], inboxUrl);
  const subjectSource = useDraft ? template!.subject : (fallback?.subject ?? '');
  const flatBody = flattenBlocksToPlainText(blocks, renderConf);

  const trimmed = body.trim();
  const preview = trimmed.length > REQUEST_BODY_PREVIEW_CHARS
    ? `${trimmed.slice(0, REQUEST_BODY_PREVIEW_CHARS)}…`
    : trimmed;

  const ctx: EmailTokenContext = {
    delegate_name: askerName,
    conference_name: conference?.full_name ?? null,
    request_subject: subject,
    request_body: preview,
  };

  const organizers = (organizerData ?? []) as unknown as OrganizerRecipientRow[];
  const rows = organizers
    .filter(o => recipientAllowsEvent(eventKey, o.profiles))
    .map(o => o.profiles?.email)
    .filter((e): e is string => !!e)
    .filter((e, i, all) => all.indexOf(e) === i)
    .map(email => ({
      conference_id: conferenceId,
      template_id: useDraft ? template!.id : null,
      recipient_application_id: null,
      recipient_email: email,
      subject: resolveTokens(subjectSource, ctx),
      body: resolveTokens(flatBody, ctx),
      body_html: renderEmailHtml({ blocks, conference: renderConf, ctx, variant: 'transactional' }),
      status: 'pending' as const,
    }));

  if (rows.length === 0) return { queued: 0 };

  const { error } = await supabase.from('email_outbox').insert(rows);
  if (error) {
    console.error(`[queueRequestReceivedEmail] email_outbox insert failed (${rows.length} row${rows.length === 1 ? '' : 's'}):`, error.message);
    return { queued: 0 };
  }

  triggerEmailDelivery(supabase);
  return { queued: rows.length };
}

/** Client-side companion to queueRequestReceivedEmail: a participant's own
 *  session can never write email_outbox (organizer-only RLS), so their
 *  browser POSTs the request id to the existing participant queue route,
 *  which re-authorizes it and queues with the service role. */
export async function notifyOrganizersOfRequest(
  accessToken: string,
  conferenceId: string,
  requestId: string
): Promise<void> {
  try {
    const res = await fetch('/api/emails/queue-participant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ conferenceId, eventKey: 'request_received', requestId }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: string } | null;
      console.error(`[notifyOrganizersOfRequest] rejected (${res.status}):`, payload?.error);
    }
  } catch (err) {
    console.error('[notifyOrganizersOfRequest] request threw:', err);
  }
}

// ── Participant-triggered event queue (browser → server route) ─────────────
// email_outbox has a single RLS policy, organizer-only writes, so a
// participant's browser session calling queueEventEmail directly inserts
// zero rows (the error is swallowed, see the "known, reported gap" NOTE
// comments at each participant call site). This instead POSTs to
// /api/emails/queue-participant, which re-authorizes the specific (event,
// applicationIds) pair against the caller's own JWT server-side and then
// queues with the service role, still through queueEventEmail's own
// three-state template rules, just without a client-side RLS bypass.

export async function queueParticipantEventEmail(
  accessToken: string,
  conferenceId: string,
  eventKey: string,
  applicationIds: string[],
  extraCtx?: EmailTokenContext
): Promise<QueueEventEmailResult> {
  const eventLabel = getEventLabel(eventKey);
  try {
    const res = await fetch('/api/emails/queue-participant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ conferenceId, eventKey, applicationIds, extraCtx }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null;
      console.error(`[queueParticipantEventEmail] "${eventKey}" rejected (${res.status}):`, body?.error);
      return { outcome: 'unconfigured', drafted: false, queued: 0, eventKey, eventLabel };
    }
    return await res.json() as QueueEventEmailResult;
  } catch (err) {
    console.error(`[queueParticipantEventEmail] "${eventKey}" request threw:`, err);
    return { outcome: 'unconfigured', drafted: false, queued: 0, eventKey, eventLabel };
  }
}

/**
 * The allocation announcement, raised by a DELEGATION LEADER who has just
 * seated one of their own block members.
 *
 * Separate from queueParticipantEventEmail because it names a SEAT, not
 * recipients: the server reads the occupant out of the allocation row itself,
 * so a leader can only ever email whoever is actually sitting in a seat their
 * delegation owns. See authorizeAllocationAssigned in the route.
 *
 * Safe to fire without awaiting — every failure path returns rather than
 * throws, so a seat assignment is never blocked by the email.
 */
export async function queueLeaderAllocationEmail(
  accessToken: string,
  conferenceId: string,
  allocationId: string
): Promise<QueueEventEmailResult> {
  const eventKey = 'allocation_assigned';
  const eventLabel = getEventLabel(eventKey);
  try {
    const res = await fetch('/api/emails/queue-participant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ conferenceId, eventKey, allocationId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null;
      console.error(`[queueLeaderAllocationEmail] rejected (${res.status}):`, body?.error);
      return { outcome: 'unconfigured', drafted: false, queued: 0, eventKey, eventLabel };
    }
    return await res.json() as QueueEventEmailResult;
  } catch (err) {
    console.error('[queueLeaderAllocationEmail] request threw:', err);
    return { outcome: 'unconfigured', drafted: false, queued: 0, eventKey, eventLabel };
  }
}
