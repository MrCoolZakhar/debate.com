'use client';

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Mail, AlertTriangle, Send, Bell, Copy, X, ChevronDown, ChevronLeft, ChevronRight, Image as ImageIcon, Palette, Trash2,
  BadgeCheck, MessageSquare, CalendarDays, ArrowRight, Compass, Wrench,
  Zap, Clock, BookOpen, KeyRound, PenLine, Plus, Wallet, Package,
} from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { ConfirmModal, useConfirmModal } from '@/components/ConfirmModal';
import { FilterPopoverShell, FilterGroup, FilterHeading, toggleIn } from '@/components/FilterPopover';
import { DatePicker } from '@/components/DatePicker';
import {
  EMAIL_TOKEN_KEYS, EMAIL_TOKEN_LABELS,
  type EmailTokenContext, type EmailTokenKey,
} from '@/lib/emailTokens';
import { EVENT_REGISTRY, queueEventEmail, getEventLabel, notifyIfNeeded, turnOnDefaultEmail, type EventDef, type EventKey } from '@/lib/emailEvents';
import { EASE } from '@/components/neu';
import {
  SOFT, AMBER_INK, GREEN_INK, RED,
  CARD_BORDER, CARD_SHADOW as LIFTED_SHADOW,
} from '../live/tokens';
import { useDraftNotices, DraftNoticeList } from '@/components/DraftNotice';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { type EmailBlock, normalizeBlocks, flattenBlocksToPlainText } from '@/lib/emailBlocks';
import { renderEmailHtml, resolveEmailTheme, type EmailTheme } from '@/lib/emailHtml';
import { triggerEmailDelivery } from '@/lib/emailDelivery';
import { queueAdHocEmail } from '@/lib/adHocEmail';
import EmailComposer, { type PreviewCandidate } from '@/components/EmailComposer';
import { formatFee } from '@/lib/utils';
import { activePhaseFee, type FeePhase } from '@/lib/finance';
import { getDefaultEventEmail } from '@/lib/defaultEmails';
import DefaultEmailPreviewModal from '@/components/DefaultEmailPreviewModal';
import { markEmailsExplored } from '@/lib/emailsExplored';
import GuidedWalkthrough, {
  TourGold, TourGreen, OTTER_INTRO, OTTER_OUTRO, type WalkthroughStep,
} from '@/components/GuidedWalkthrough';
import ProfileLink from '@/components/ProfileLink';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Full restorable audience selection, persisted to email_templates.audience.
 *  `committeeIds` is additive (optional): audiences saved before the committee
 *  filter existed simply have no key and restore exactly as before. */
interface SavedAudience {
  roles: string[];
  paymentStatuses: string[];
  delegationIds: string[];
  includeIndependents: boolean;
  attendance: string[];
  applicationStatuses: string[];
  aidStatuses?: string[];
  committeeIds?: string[];
  manualIds: string[];
  excludedIds: string[];
}

interface EmailTemplate {
  id: string;
  conference_id: string;
  event_key: string | null;
  name: string;
  subject: string;
  body: string;
  body_blocks: unknown;
  enabled: boolean;
  delivery: 'immediate' | 'manual';
  lifecycle: 'draft' | 'ready';
  updated_at: string;
  audience: SavedAudience | null;
}

interface AppRow {
  id: string;
  user_id: string | null;
  role: string;
  status: string;
  payment_status: string | null;
  attending: boolean;
  society_id: string | null;
  societies: { name: string } | null;
  assigned_committee_id: string | null;
  assigned_committee: { abbreviation: string | null; name: string; session_code: string | null } | null;
  assigned_country_name: string | null;
  profiles: { display_name: string; email: string | null; notify_email_marketing: boolean | null; avatar_url: string | null } | null;
  invited_email: string | null;
  invited_name: string | null;
  aid_status: string | null;
}

interface Committee {
  id: string;
  name: string;
  abbreviation: string | null;
  study_guides_publish_at: string | null;
  study_guides_notified_at: string | null;
}

interface Society {
  id: string;
  name: string;
}

interface RoleFeeConfig {
  role: string;
  fee_amount: number | null;
  fee_currency: string | null;
  fee_phases: FeePhase[] | null;
}

interface EmailSend {
  id: string;
  subject: string;
  recipient_filter: Record<string, unknown> | null;
  recipient_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  created_at: string;
  body_html: string | null;
}

interface OutboxDetailRow {
  id: string;
  recipient_email: string | null;
  status: string;
  error: string | null;
  sent_at: string | null;
  recipient_application_id: string | null;
}

/** One row of the whole outbox, summary columns only (no bodies). This is what
 *  lets the Sent feed show AUTOMATIC traffic — the majority of real sends have
 *  no email_sends row at all, only outbox rows written by queueEventEmail. */
interface OutboxFeedRow extends OutboxDetailRow {
  template_id: string | null;
  email_send_id: string | null;
  subject: string;
  created_at: string;
  send_after: string | null;
}

/** Automatic outbox rows grouped by event + day — one feed entry per burst. */
interface AutoSendGroup {
  key: string;
  eventKey: string | null;
  label: string;
  day: string;
  latestAt: string;
  count: number;
  delivered: number;
  failed: number;
  pending: number;
  rows: OutboxFeedRow[];
}

/** In-progress application drafts (public.application_draft_status — the
 *  security-barrier view; the raw table is not organiser-readable). */
interface DraftStatusRow {
  id: string;
  updated_at: string;
  reminders_sent: number | null;
  reminder_opt_out: boolean | null;
}

/** Provider errors are written for engineers. Organizers need to know which
 *  address is wrong, that they can fix it themselves, and where. `fixable`
 *  marks the cases an organizer can actually resolve in the import editor. */
function friendlyDeliveryError(raw: string, recipient: string | null): { text: string; fixable: boolean } {
  const address = recipient ? `"${recipient}"` : 'this address';
  if (/Invalid recipient address/i.test(raw) || /validation_error|Invalid `to` field/i.test(raw)) {
    return { text: `${address} is not a valid email address, so nothing could be delivered to it. You can correct it yourself in the import editor, and their pending emails will send automatically.`, fixable: true };
  }
  if (/No recipient email/i.test(raw)) {
    return { text: 'No email address on record for this person. Add one in the import editor to reach them.', fixable: true };
  }
  if (/statusCode":429|rate limit/i.test(raw)) {
    return { text: 'Sending was rate limited. This will retry automatically, no action needed.', fixable: false };
  }
  if (/No id returned/i.test(raw)) {
    return { text: 'The email provider did not confirm this one. Resend it.', fixable: false };
  }
  return { text: raw, fixable: false };
}

// ── Inbox (Q&R threads) ──────────────────────────────────────────────────────

interface SwapMetadata {
  society_id?: string;
  app_a?: string;
  app_b?: string;
  member_a?: string;
  member_b?: string;
  before?: { a?: string; b?: string };
  after?: { a?: string; b?: string };
}

interface InboxRequest {
  id: string;
  user_id: string;
  application_id: string | null;
  subject: string;
  status: string;
  kind: string;
  metadata: SwapMetadata;
  seen_by_organizer: boolean;
  organizer_seen_at: string | null;
  created_at: string;
  last_message_at: string;
}

interface InboxMessage {
  id: string;
  request_id: string;
  sender_user_id: string;
  is_organizer: boolean;
  body: string;
  created_at: string;
}

interface InboxProfile {
  display_name: string;
  avatar_url: string | null;
}

const KIND_CHIP: Record<string, { label: string; bg: string; color: string }> = {
  question: { label: 'QUESTION', bg: 'rgba(27,56,40,0.08)', color: '#1B3828' },
  swap_request: { label: 'SWAP REQUEST', bg: 'rgba(182,135,31,0.16)', color: '#8A6614' },
  swap_notice: { label: 'SWAP', bg: 'rgba(154,138,120,0.16)', color: '#6B5F52' },
};

const INBOX_STATE_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

const INBOX_KIND_OPTIONS = [
  { value: 'question', label: 'Question' },
  { value: 'swap_request', label: 'Swap request' },
  { value: 'swap_notice', label: 'Swap' },
];

const INDEPENDENT_KEY = '__independent__';

// ── Audience filter option sets ──────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'delegate', label: 'Delegates' },
  { value: 'chair', label: 'Chairs' },
  { value: 'head-delegate', label: 'Head Delegates' },
  { value: 'faculty-advisor', label: 'Faculty Advisors' },
  { value: 'observer', label: 'Observers' },
];

const PAYMENT_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'waived', label: 'Waived' },
];

const ATTENDANCE_OPTIONS = [
  { value: 'attending', label: 'Attending' },
  { value: 'not_attending', label: 'Not attending' },
];

const APP_STATUS_OPTIONS = [
  { value: 'accepted', label: 'Accepted' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'submitted', label: 'Submitted' },
];

const AID_OPTIONS = [
  { value: 'pending', label: 'Aid requested' },
];

// ── Audience matcher (pure) ──────────────────────────────────────────────────
// Extracted from the old inline matchesAudienceFilters closure so per-chip
// live counts can evaluate hypothetical selections against the same predicate
// the real audience uses — one matcher, zero drift.

interface AudienceFilterSets {
  roles: Set<string>;
  payment: Set<string>;
  delegations: Set<string>;
  committees: Set<string>;
  attendance: Set<string>;
  status: Set<string>;
  aid: Set<string>;
}

function appMatchesAudience(a: AppRow, f: AudienceFilterSets): boolean {
  if (f.roles.size > 0 && !f.roles.has(a.role)) return false;
  if (f.payment.size > 0) {
    const ok = [...f.payment].some(p => {
      if (p === 'paid') return a.payment_status === 'paid' || a.payment_status === 'waived';
      if (p === 'unpaid') return a.payment_status === 'unpaid';
      if (p === 'waived') return a.payment_status === 'waived';
      return false;
    });
    if (!ok) return false;
  }
  if (f.delegations.size > 0) {
    const wantsIndependent = f.delegations.has(INDEPENDENT_KEY);
    const societyIds = [...f.delegations].filter(id => id !== INDEPENDENT_KEY);
    const ok = (wantsIndependent && a.society_id == null) || (a.society_id != null && societyIds.includes(a.society_id));
    if (!ok) return false;
  }
  if (f.committees.size > 0 && !(a.assigned_committee_id != null && f.committees.has(a.assigned_committee_id))) return false;
  if (f.attendance.size > 0) {
    const ok = [...f.attendance].some(v => (v === 'attending' ? a.attending !== false : a.attending === false));
    if (!ok) return false;
  }
  if (f.status.size > 0 && !f.status.has(a.status)) return false;
  if (f.aid.size > 0 && !f.aid.has(a.aid_status ?? '')) return false;
  return true;
}

// ── Ad-hoc seed templates (the gallery) ──────────────────────────────────────
// Static seeds for the emails organisers currently write in other tools.
// Deliberately NOT EVENT_REGISTRY keys: these are one-off broadcasts through
// the ad-hoc pipeline (marketing consent, explicit audience), not automatic
// product emails. The two session-code seeds borrow the polished
// session_join_invite / session_chair_invite default copy that production
// shows almost nobody finds in the Automatic registry.

interface SeedContent {
  name: string;
  subject: string;
  blocks: EmailBlock[];
  /** Filter preset the seed suggests — chips light up, the organiser adjusts. */
  audience?: Partial<SavedAudience>;
}

interface AdHocSeed {
  id: string;
  icon: typeof Bell;
  title: string;
  blurb: string;
  /** Tokens the seeded copy uses — surfaced on the card so the organiser
   *  knows what gets personalised before opening the editor. */
  tokens: EmailTokenKey[];
  /** One option opens the builder directly; two offer the owner's fork
   *  (Gavelling template vs write-your-own) inline on the card. */
  options: { label: string; content: SeedContent }[];
}

const EMPTY_SAVED_AUDIENCE: SavedAudience = {
  roles: [], paymentStatuses: [], delegationIds: [], includeIndependents: false,
  attendance: [], applicationStatuses: [], aidStatuses: [], committeeIds: [],
  manualIds: [], excludedIds: [],
};

const SESSION_JOIN_DEFAULT = getDefaultEventEmail('session_join_invite');
const SESSION_CHAIR_DEFAULT = getDefaultEventEmail('session_chair_invite');

const AD_HOC_SEEDS: AdHocSeed[] = [
  {
    id: 'session-codes-delegates',
    icon: KeyRound,
    title: 'Session codes — delegates',
    blurb: 'Every allocated delegate gets the join code for their committee room.',
    tokens: ['delegate_name', 'committee', 'session_code'],
    options: [
      {
        label: 'Use the Gavelling template',
        content: {
          name: 'Session codes — delegates',
          subject: SESSION_JOIN_DEFAULT?.subject ?? 'Join your live committee — {{conference_name}}',
          blocks: SESSION_JOIN_DEFAULT?.blocks ?? [],
          audience: { roles: ['delegate'] },
        },
      },
      {
        label: 'Write custom',
        content: {
          name: 'Session codes — delegates',
          subject: '',
          blocks: [{ type: 'paragraph', content: '' }],
          audience: { roles: ['delegate'] },
        },
      },
    ],
  },
  {
    id: 'session-codes-chairs',
    icon: KeyRound,
    title: 'Session codes — chairs',
    blurb: 'Chairs get their session details and where to find their chair password.',
    tokens: ['delegate_name', 'committee', 'conference_name'],
    options: [
      {
        label: 'Use the Gavelling template',
        content: {
          name: 'Session codes — chairs',
          subject: SESSION_CHAIR_DEFAULT?.subject ?? 'Your session details — {{conference_name}}',
          blocks: SESSION_CHAIR_DEFAULT?.blocks ?? [],
          audience: { roles: ['chair'] },
        },
      },
      {
        label: 'Write custom',
        content: {
          name: 'Session codes — chairs',
          subject: '',
          blocks: [{ type: 'paragraph', content: '' }],
          audience: { roles: ['chair'] },
        },
      },
    ],
  },
  {
    id: 'payment-reminder',
    icon: Wallet,
    title: 'Payment reminder',
    blurb: 'A nudge to everyone whose fee is still outstanding.',
    tokens: ['delegate_name', 'role', 'fee'],
    options: [{
      label: 'Use this template',
      content: {
        name: 'Payment reminder',
        subject: 'Reminder — your {{conference_name}} fee is still unpaid',
        blocks: [
          { type: 'paragraph', content: "Hi {{delegate_name}},\n\nA quick reminder that your {{role}} registration fee of {{fee}} for {{conference_name}} is still outstanding. You can settle it any time from your account — and if you've paid or arranged a waiver in the last day or two, please ignore this." },
          { type: 'button', label: 'VIEW MY CONFERENCE', destination: 'documents' },
          { type: 'paragraph', variant: 'small', content: 'Questions about payment? Reply to this email and the organizing team will help.' },
        ],
        audience: { paymentStatuses: ['unpaid'] },
      },
    }],
  },
  {
    id: 'welcome-pack',
    icon: Package,
    title: 'Welcome / logistics pack',
    blurb: 'Arrival, venue and schedule details in one email before the conference.',
    tokens: ['delegate_name', 'conference_name', 'conference_dates'],
    options: [{
      label: 'Use this template',
      content: {
        name: 'Welcome pack',
        subject: 'Welcome to {{conference_name}} — everything you need to know',
        blocks: [
          { type: 'paragraph', variant: 'heading', content: 'Welcome to {{conference_name}}' },
          { type: 'paragraph', content: 'Hi {{delegate_name}},\n\n{{conference_name}} runs {{conference_dates}}, and everything you need before you arrive is below.' },
          { type: 'paragraph', variant: 'heading', content: 'Getting there' },
          { type: 'paragraph', content: 'Add your venue address, doors-open time and transport tips here.' },
          { type: 'paragraph', variant: 'heading', content: 'What to bring' },
          { type: 'paragraph', content: 'Add your dress code, printed materials and anything else to pack here.' },
          { type: 'button', label: 'VIEW MY CONFERENCE', destination: 'documents' },
          { type: 'paragraph', variant: 'small', content: "If anything changes we'll email again — this is the one to keep." },
        ],
      },
    }],
  },
  {
    id: 'study-guide-nudge',
    icon: BookOpen,
    title: 'Study guide nudge',
    blurb: 'Point delegates at their study guide before the first session.',
    tokens: ['delegate_name', 'committee'],
    options: [{
      label: 'Use this template',
      content: {
        name: 'Study guide nudge',
        subject: 'Your {{committee}} study guide is waiting',
        blocks: [
          { type: 'paragraph', content: 'Hi {{delegate_name}},\n\nThe study guide for {{committee}} is up. Give it a read before {{conference_name}} begins — it sets the topics, the scope of debate, and what your chairs expect in a position paper.' },
          { type: 'button', label: 'VIEW MY CONFERENCE', destination: 'documents' },
        ],
        audience: { roles: ['delegate'] },
      },
    }],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const OUTFIT = "'Outfit', sans-serif";
const BORDER = '#DDD4C0';

/** The landing's card surface — the live-status system verbatim (./../live/tokens):
 *  ivory surface, measured hairline, lifted forest shadow. The builder now
 *  uses it too (the old CARD_STYLE surface went with the sidebar). */
const PANEL: React.CSSProperties = {
  backgroundColor: '#F0EBDD',
  border: CARD_BORDER,
  boxShadow: LIFTED_SHADOW,
};

/** Same three-state rule queueEventEmail applies: a stub row created by TURN ON
 *  (enabled, empty content) still sends the DEFAULT copy. */
function templateHasContent(t: { body_blocks: unknown; body: string } | undefined | null): boolean {
  if (!t) return false;
  const blocks = Array.isArray(t.body_blocks) ? (t.body_blocks as unknown[]) : [];
  return blocks.length > 0 || !!(t.body && t.body.trim().length > 0);
}

// ── Automatic-emails registry, grouped by lifecycle stage ────────────────────
// Exhaustive over EventKey on purpose: add a key to EVENT_REGISTRY and this
// refuses to compile until the new event has a stage — the same contract
// NOTIFICATION_CATEGORY enforces.

const STAGE_ORDER = ['Applying', 'Payment', 'Allocation', 'Delegations', 'Session', 'Team & questions'] as const;
type Stage = typeof STAGE_ORDER[number];

const EVENT_STAGE: Record<EventKey, Stage> = {
  application_received: 'Applying',
  draft_reminder: 'Applying',
  application_accepted: 'Applying',
  application_rejected: 'Applying',
  aid_approved: 'Applying',
  aid_denied: 'Applying',
  import_join_invite: 'Applying',
  payment_available: 'Payment',
  payment_received: 'Payment',
  fee_waived: 'Payment',
  pledge_received: 'Payment',
  allocation_assigned: 'Allocation',
  allocation_changed: 'Allocation',
  allocation_removed: 'Allocation',
  delegation_swap: 'Allocation',
  added_to_delegation: 'Delegations',
  removed_from_delegation: 'Delegations',
  spot_received: 'Delegations',
  spot_lost: 'Delegations',
  not_attending: 'Delegations',
  attendance_restored: 'Delegations',
  documents_published: 'Session',
  session_chair_invite: 'Session',
  session_join_invite: 'Session',
  chair_assigned: 'Team & questions',
  committee_chair_invite: 'Team & questions',
  organizer_invite: 'Team & questions',
  request_reply: 'Team & questions',
  request_received: 'Team & questions',
};

/** 24h snooze for dismissable rail cards, per conference, client-local. */
function railDismissKey(conferenceId: string) {
  return `gv-comms-rail-dismissed-${conferenceId}`;
}

/**
 * "Has this browser been walked through the emails system?" — one flag for the
 * whole account, not per conference: the tour explains the product, and an
 * organiser running their third conference does not need it a third time.
 * Written when the tour is FINISHED OR SKIPPED (see `closeTour`), never when it
 * merely opens, so a mis-click does not burn the one auto-start.
 */
const COMMS_TOUR_SEEN_KEY = 'gv-comms-tour-seen-v1';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Recipient delivery timestamp: bare time when sent today, time + date otherwise. */
function formatSentAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const isToday = d.toDateString() === new Date().toDateString();
  return isToday ? time : `${time} · ${formatDate(iso)}`;
}

function formatDateRange(start: string, end: string): string {
  if (!start || !end) return '';
  if (start === end) return formatDate(start);
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) {
    return `${s.toLocaleDateString('en-GB', { day: 'numeric' })}–${formatDate(end)}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function roleLabel(role: string) {
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

/** Summarizes recipient_filter for a History row. Handles both the old single-select shape and the new combinable-filters shape. */
function formatFilter(filter: Record<string, unknown> | null, societies: Society[], committees: Committee[]): string {
  if (!filter) return 'All participants';

  // Legacy single-select shape (audience: 'all' | 'role' | 'committee' | 'status' | 'unpaid' | 'unallocated' | 'not_attending' | 'delegation').
  if (typeof filter.audience === 'string') {
    const audience = filter.audience as string;
    if (audience === 'all') return 'All participants';
    if (audience === 'role' && filter.role) {
      const labels: Record<string, string> = {
        delegate: 'Delegates', chair: 'Chairs', 'head-delegate': 'Head Delegates',
        'faculty-advisor': 'Faculty Advisors', observer: 'Observers',
      };
      return labels[filter.role as string] ?? String(filter.role);
    }
    if (audience === 'committee' && filter.committee_id) {
      const c = committees.find(cm => cm.id === filter.committee_id);
      return c ? c.name : 'Committee';
    }
    if (audience === 'status' && filter.status) {
      const labels: Record<string, string> = { submitted: 'Submitted', accepted: 'Accepted', assigned: 'Assigned', paid: 'Paid', unpaid: 'Unpaid' };
      return `${labels[filter.status as string] ?? filter.status} applicants`;
    }
    if (audience === 'unpaid') return 'Unpaid';
    if (audience === 'unallocated') return 'Unallocated';
    if (audience === 'not_attending') return 'Not attending';
    if (audience === 'delegation' && filter.society_id) {
      const s = societies.find(so => so.id === filter.society_id);
      return s ? s.name : 'Delegation';
    }
    return 'All participants';
  }

  // New combinable-filters shape.
  const parts: string[] = [];
  const roles = (filter.roles as string[] | undefined) ?? [];
  if (roles.length) parts.push(roles.map(r => ROLE_OPTIONS.find(o => o.value === r)?.label ?? r).join('/'));
  const pay = (filter.paymentStatuses as string[] | undefined) ?? [];
  if (pay.length) parts.push(pay.map(p => PAYMENT_OPTIONS.find(o => o.value === p)?.label ?? p).join('/'));
  const delegationIds = (filter.delegationIds as string[] | undefined) ?? [];
  const includeIndependents = !!filter.includeIndependents;
  if (delegationIds.length || includeIndependents) {
    const names = delegationIds.map(id => societies.find(s => s.id === id)?.name ?? 'Delegation');
    if (includeIndependents) names.push('Independents');
    parts.push(names.join(', '));
  }
  const attendance = (filter.attendance as string[] | undefined) ?? [];
  if (attendance.length) parts.push(attendance.map(a => (a === 'attending' ? 'Attending' : 'Not attending')).join('/'));
  const appStatus = (filter.applicationStatuses as string[] | undefined) ?? [];
  if (appStatus.length) parts.push(appStatus.map(s => APP_STATUS_OPTIONS.find(o => o.value === s)?.label ?? s).join('/'));
  const aidStatuses = (filter.aidStatuses as string[] | undefined) ?? [];
  if (aidStatuses.length) parts.push(aidStatuses.map(s => AID_OPTIONS.find(o => o.value === s)?.label ?? s).join('/'));
  const committeeIds = (filter.committeeIds as string[] | undefined) ?? [];
  if (committeeIds.length) {
    parts.push(committeeIds.map(id => {
      const c = committees.find(cm => cm.id === id);
      return c ? (c.abbreviation ?? c.name) : 'Committee';
    }).join('/'));
  }

  let base = parts.length ? parts.join(' · ') : 'All participants';
  const manualCount = Number(filter.manualCount ?? 0);
  const excludedCount = Number(filter.excludedCount ?? 0);
  if (manualCount) base += ` +${manualCount} manual`;
  if (excludedCount) base += ` −${excludedCount} excluded`;
  return base;
}

function looksLikeHtmlDoc(s: string | null): boolean {
  return !!s && /<!doctype html|<html[\s>]/i.test(s);
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

// Dots keep their status hues; TEXT uses the inks that actually pass on the
// tinted chip surfaces (see ../live/tokens for the measurements — #3D7A52 is
// 4.30:1 and #B6871F 2.72:1, both fail as text).
const STATUS_COLORS: Record<string, { dot: string; text: string; bg: string }> = {
  sent:      { dot: '#3D7A52', text: GREEN_INK, bg: 'rgba(61,122,82,0.1)' },
  scheduled: { dot: '#B6871F', text: AMBER_INK, bg: 'rgba(182,135,31,0.1)' },
  draft:     { dot: '#DDD4C0', text: SOFT, bg: 'rgba(154,138,120,0.1)' },
  failed:    { dot: '#8B2020', text: RED, bg: 'rgba(139,32,32,0.1)' },
  pending:   { dot: '#B6871F', text: AMBER_INK, bg: 'rgba(182,135,31,0.1)' },
};

function outboxStatusColor(status: string) {
  return STATUS_COLORS[status] ?? STATUS_COLORS.draft;
}

// ── Small shared bits ─────────────────────────────────────────────────────────

function PillToggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="relative flex-shrink-0 focus:outline-none"
      style={{
        width: 34, height: 19, borderRadius: 9999,
        backgroundColor: value ? '#1B3828' : '#DDD4C0',
        transition: 'background-color 200ms ease',
        border: 'none', cursor: 'pointer',
      }}
    >
      <span
        className="absolute rounded-full transition-all duration-200"
        style={{ width: 15, height: 15, backgroundColor: 'white', top: 2, left: value ? 17 : 2, boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}
      />
    </button>
  );
}

function TabPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="focus:outline-none transition-colors"
      style={{
        padding: '7px 20px', borderRadius: 8, fontSize: 11, fontFamily: OUTFIT, fontWeight: 700,
        letterSpacing: '0.06em', border: 'none',
        backgroundColor: active ? '#1B3828' : 'transparent',
        color: active ? '#EED98A' : SOFT,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function MultiChipGroup({
  label, options, selected, onToggle, counts, maxHeight,
}: {
  label: string; options: { value: string; label: string }[]; selected: Set<string>; onToggle: (v: string) => void;
  /** Per-choice live reach, keyed by option value — rendered as "Unpaid (61)". */
  counts?: Record<string, number>;
  maxHeight?: number;
}) {
  return (
    <div className="mb-3">
      <p className="text-xs font-bold mb-1.5" style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.06em' }}>
        {label.toUpperCase()}
      </p>
      <div className="flex flex-wrap gap-1.5" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
        {options.map(o => {
          const active = selected.has(o.value);
          const count = counts?.[o.value];
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              className="rounded-full px-2.5 py-1 text-xs font-semibold focus:outline-none transition-colors"
              style={{
                border: active ? '1px solid #1B3828' : `1px solid ${BORDER}`,
                backgroundColor: active ? '#1B3828' : 'transparent',
                color: active ? '#EED98A' : '#4A4238',
                fontFamily: OUTFIT,
              }}
            >
              {o.label}
              {count !== undefined && (
                <span style={{ fontVariantNumeric: 'tabular-nums', color: active ? 'rgba(238,217,138,0.8)' : SOFT }}>
                  {' '}({count})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const COLOR_PALETTE = ['#1B3828', '#8A6614', '#8B2020', '#2A4B7C', '#5C3A72', '#1C1410'];
const BUTTON_COLOR_PALETTE = ['#EED98A', '#F3E3A1', '#B6871F', '#9AC6A8', '#DCEAF5', '#F5D6C6'];

function ColorField({
  label, value, onChange, palette,
}: {
  label: string; value: string; onChange: (v: string) => void; palette: string[];
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-bold mb-1.5" style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.06em' }}>
        {label.toUpperCase()}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {palette.map(c => {
          const active = value.toLowerCase() === c.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              title={c}
              className="flex-shrink-0 rounded-full focus:outline-none"
              style={{
                width: 26, height: 26, backgroundColor: c,
                border: active ? '2.5px solid #1B3828' : '1px solid rgba(0,0,0,0.15)',
                boxShadow: active ? '0 0 0 2px rgba(238,217,138,0.55)' : 'none',
              }}
            />
          );
        })}
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="#000000"
          className="rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
          style={{ border: `1px solid ${BORDER}`, color: '#1C1410', fontFamily: OUTFIT, width: 92 }}
        />
      </div>
    </div>
  );
}

function SegButton({
  active, onClick, icon: Icon, children,
}: {
  active: boolean; onClick: () => void; icon: typeof ChevronDown; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none transition-colors"
      style={{
        border: active ? '1px solid #1B3828' : `1px solid ${BORDER}`,
        backgroundColor: active ? '#1B3828' : 'transparent',
        color: active ? '#EED98A' : '#4A4238',
        fontFamily: OUTFIT,
      }}
    >
      <Icon size={13} /> {children}
    </button>
  );
}

/** Quiet bordered action — the landing's secondary button. Hairline edge,
 *  forest wash on hover, scale-on-press. */
function GhostBtn({
  onClick, children, title: btnTitle, danger = false, disabled = false,
}: {
  onClick: () => void; children: React.ReactNode; title?: string; danger?: boolean; disabled?: boolean;
}) {
  const ink = danger ? RED : '#1C1410';
  return (
    <button
      type="button"
      onClick={onClick}
      title={btnTitle}
      disabled={disabled}
      className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none active:scale-[0.96] disabled:opacity-50"
      style={{
        border: danger ? '1px solid rgba(139,32,32,0.3)' : CARD_BORDER,
        color: ink, backgroundColor: 'transparent', fontFamily: OUTFIT,
        letterSpacing: '0.03em', cursor: disabled ? 'default' : 'pointer', minHeight: 32,
        transitionProperty: 'background-color, transform', transitionDuration: '180ms', transitionTimingFunction: EASE,
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.backgroundColor = danger ? 'rgba(139,32,32,0.06)' : 'rgba(27,56,40,0.05)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      {children}
    </button>
  );
}

/** The landing's primary action. One step past the live page's forest buttons:
 *  a two-stop forest gradient, an inner top highlight so it reads extruded,
 *  gold ink (#EED98A on #1B3828 is 8.9:1), lift on hover, 0.96 press. */
function PrimaryBtn({
  onClick, children, icon: Icon, disabled = false,
}: {
  onClick: () => void; children: React.ReactNode; icon?: typeof Plus; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-xl px-4 text-xs font-bold focus:outline-none active:scale-[0.96] disabled:opacity-60"
      style={{
        minHeight: 40,
        background: 'linear-gradient(160deg, #24513A 0%, #1B3828 62%)',
        color: '#EED98A', fontFamily: OUTFIT, letterSpacing: '0.05em',
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 4px 5px 12px rgba(27,56,40,0.28), -3px -3px 8px rgba(255,255,255,0.7)',
        transitionProperty: 'box-shadow, filter, transform', transitionDuration: '180ms', transitionTimingFunction: EASE,
      }}
      onMouseEnter={e => {
        if (disabled) return;
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.22), 6px 7px 16px rgba(27,56,40,0.34), -4px -4px 10px rgba(255,255,255,0.8)';
        el.style.filter = 'brightness(1.06)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.18), 4px 5px 12px rgba(27,56,40,0.28), -3px -3px 8px rgba(255,255,255,0.7)';
        el.style.filter = 'none';
      }}
    >
      {Icon && <Icon size={14} strokeWidth={2.5} />} {children}
    </button>
  );
}

/** One card on the "Coming up" rail. Gold-tinted when it is a recommendation;
 *  otherwise the same ivory panel as everything else. Exactly one action. */
function RailCard({
  icon: Icon, title, sub, gold = false, live = false,
  actionLabel, onAction, onDismiss,
}: {
  icon: typeof Bell; title: string; sub?: string; gold?: boolean; live?: boolean;
  actionLabel?: string; onAction?: () => void; onDismiss?: () => void;
}) {
  return (
    <div
      className="relative flex items-start gap-3 rounded-2xl px-4 py-3"
      style={{
        ...PANEL,
        ...(gold ? {
          background: 'linear-gradient(135deg, rgba(238,217,138,0.35), rgba(238,217,138,0.10)), #F0EBDD',
          border: '1px solid rgba(182,135,31,0.38)',
        } : {}),
        minWidth: 230, maxWidth: 340, flex: '1 1 240px',
      }}
    >
      <span
        className="flex items-center justify-center flex-shrink-0 rounded-xl"
        style={{
          width: 34, height: 34, marginTop: 1,
          background: gold ? 'linear-gradient(150deg, rgba(182,135,31,0.22), rgba(182,135,31,0.08))' : 'rgba(27,56,40,0.07)',
          border: gold ? '1px solid rgba(182,135,31,0.35)' : '1px solid rgba(27,56,40,0.12)',
        }}
      >
        <Icon size={16} strokeWidth={2} style={{ color: gold ? AMBER_INK : '#1B3828' }} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT, lineHeight: 1.3, textWrap: 'pretty' }}>
          {live && <span className="inline-block rounded-full animate-pulse flex-shrink-0" style={{ width: 7, height: 7, backgroundColor: '#B8844A' }} />}
          {title}
        </p>
        {sub && (
          <p className="text-xs mt-0.5" style={{ color: SOFT, fontFamily: OUTFIT, lineHeight: 1.45, textWrap: 'pretty' }}>
            {sub}
          </p>
        )}
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-1 mt-1.5 text-xs font-bold focus:outline-none active:scale-[0.96]"
            style={{
              color: '#1B3828', background: 'none', border: 'none', padding: '4px 0',
              fontFamily: OUTFIT, letterSpacing: '0.04em', cursor: 'pointer',
              transitionProperty: 'transform', transitionDuration: '150ms', transitionTimingFunction: EASE,
            }}
          >
            {actionLabel} <ArrowRight size={12} strokeWidth={2.5} />
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          title="Dismiss for now"
          aria-label={`Dismiss "${title}" for now`}
          className="absolute focus:outline-none"
          style={{
            top: 4, right: 4, padding: 7, border: 'none', background: 'none',
            color: SOFT, cursor: 'pointer', lineHeight: 0, borderRadius: 8,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = SOFT; }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// ── CommunicationsPage ────────────────────────────────────────────────────────

function CommunicationsPageInner() {
  const { conference, refreshConferenceQuiet } = useManage();
  const { user, session, profile } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Ticks the dashboard's "Explore emails" set-up item. Client-local by design
  // — see src/lib/emailsExplored.ts for why it is not a DB flag.
  useEffect(() => {
    if (conference?.id) markEmailsExplored(conference.id);
  }, [conference?.id]);

  // ── Data state ──
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [applications, setApplications] = useState<AppRow[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [roleConfigs, setRoleConfigs] = useState<RoleFeeConfig[]>([]);
  const [emailSends, setEmailSends] = useState<EmailSend[]>([]);
  const [outboxPending, setOutboxPending] = useState(0);
  const [outboxFeed, setOutboxFeed] = useState<OutboxFeedRow[]>([]);
  const [draftStatusRows, setDraftStatusRows] = useState<DraftStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  // ── View state ──
  // The landing is one screen (Coming up · Sent · Inbox); 'automatic' is the
  // registry of self-sending emails, one click off the landing. Below 1024px
  // the inbox column collapses into its own tab.
  const [view, setView] = useState<'landing' | 'automatic'>('landing');
  const [mobileTab, setMobileTab] = useState<'sent' | 'inbox'>('sent');
  const [historyExpandedId, setHistoryExpandedId] = useState<string | null>(null);
  const [recipientsExpandedId, setRecipientsExpandedId] = useState<string | null>(null);
  const [autoExpandedKey, setAutoExpandedKey] = useState<string | null>(null);
  const [expandedEventKeys, setExpandedEventKeys] = useState<Set<string>>(new Set());
  const [worklistOpen, setWorklistOpen] = useState(true);
  const [dismissedRail, setDismissedRail] = useState<Record<string, number>>({});
  const [outboxBySend, setOutboxBySend] = useState<Record<string, OutboxDetailRow[] | 'loading'>>({});

  // ── Inbox state ──
  const [inboxRequests, setInboxRequests] = useState<InboxRequest[]>([]);
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [inboxProfiles, setInboxProfiles] = useState<Map<string, InboxProfile>>(new Map());
  const [inboxRoles, setInboxRoles] = useState<Map<string, string>>(new Map());
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  // Filters, same semantics as the Applications page's FILTERS popover:
  // chips within a section OR together, sections AND together, empty
  // section = no constraint. Search stays outside the popover.
  const [inboxStatusFilter, setInboxStatusFilter] = useState<Set<string>>(new Set());
  const [inboxKindFilter, setInboxKindFilter] = useState<Set<string>>(new Set());
  const [inboxDateFrom, setInboxDateFrom] = useState('');
  const [inboxDateTo, setInboxDateTo] = useState('');
  const [inboxSearch, setInboxSearch] = useState('');
  const [inboxPage, setInboxPage] = useState(1);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState('');
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [swapActing, setSwapActing] = useState(false);
  const [swapError, setSwapError] = useState('');
  const [deletingThread, setDeletingThread] = useState(false);
  const { draftNotices, pushDraftNotice, dismissDraftNotice } = useDraftNotices();

  // ── Builder state ──
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderEventKey, setBuilderEventKey] = useState<string | null>(null);
  const [builderTemplateId, setBuilderTemplateId] = useState<string | null>(null);
  const [builderName, setBuilderName] = useState('');
  const [builderSubject, setBuilderSubject] = useState('');
  const [builderBlocks, setBuilderBlocks] = useState<EmailBlock[]>([]);
  const [builderDelivery, setBuilderDelivery] = useState<'immediate' | 'manual'>('manual');
  const [builderError, setBuilderError] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [sending, setSending] = useState(false);
  const [openingSend, setOpeningSend] = useState(false);
  const [duplicatingIds, setDuplicatingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  // ── Gallery (the fork before the editor) ──
  const [galleryOpen, setGalleryOpen] = useState(false);
  // Seed card currently showing its Gavelling-template / write-custom choice.
  const [forkSeedId, setForkSeedId] = useState<string | null>(null);
  // Busy set for the Notifications registry toggle when it has to create the
  // stub row first (never-configured event -> TURN ON), an insert, unlike
  // the instant optimistic flip for an already-existing template row.
  const [togglingEventKeys, setTogglingEventKeys] = useState<Set<string>>(new Set());
  const { confirm: confirmDelete, modal: deleteConfirmModal } = useConfirmModal();
  // Restored a saved audience (email_templates.audience) into the picker below.
  const [audienceRestored, setAudienceRestored] = useState(false);

  // ── Notifications: PREVIEW DEFAULT modal ──
  const [previewDefaultKey, setPreviewDefaultKey] = useState<string | null>(null);

  // ── Design section (conferences.email_theme) ──
  const [designOpen, setDesignOpen] = useState(false);
  const [themeDraft, setThemeDraft] = useState<Required<EmailTheme>>(resolveEmailTheme(null));
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeSaved, setThemeSaved] = useState(false);
  const [themeError, setThemeError] = useState('');
  const themeSeededRef = useRef(false);
  // Last theme value actually confirmed on the conference row (seeded on
  // load, updated after every successful save). The autosave effect below
  // bails whenever themeDraft is deep-equal to this, so re-seeding after a
  // refresh (quiet or otherwise) can never itself trigger a write.
  const lastSavedThemeRef = useRef<Required<EmailTheme> | null>(null);
  // Flipped true only by patchTheme, the single mutator every design control
  // goes through. Autosave never fires before a real user edit, closing off
  // the seed-effect entirely as a write trigger, independent of the
  // deep-equal check above.
  const themeTouchedRef = useRef(false);

  // ── Audience state (ad-hoc only) ──
  const [selRoles, setSelRoles] = useState<Set<string>>(new Set());
  const [selPayment, setSelPayment] = useState<Set<string>>(new Set());
  const [selDelegations, setSelDelegations] = useState<Set<string>>(new Set());
  const [selCommittees, setSelCommittees] = useState<Set<string>>(new Set());
  const [selAttendance, setSelAttendance] = useState<Set<string>>(new Set());
  const [selStatus, setSelStatus] = useState<Set<string>>(new Set());
  const [selAid, setSelAid] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [manuallyAddedIds, setManuallyAddedIds] = useState<Set<string>>(new Set());
  const [manualSearch, setManualSearch] = useState('');
  // Expanded groups in the "who gets it" recipient summary.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // ── Send confirmation ──
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [sendConfirmText, setSendConfirmText] = useState('');

  const builderJustOpenedRef = useRef(false);
  // Serialized subject+blocks as they were when the builder opened. The
  // autosave effect skips while current content still equals this, so
  // opening a gallery seed (which arrives with full content, unlike a blank
  // draft) and backing out never creates a template row — EmailComposer
  // re-reports the opened content once on mount with fresh array identity,
  // which the justOpened flag alone can't tell apart from a real edit.
  const builderInitialRef = useRef('');

  /* Outcome feedback goes to the corner notification stack — the same cards the
     live committee session raises — instead of a strip above the tabs. Same
     call shape as before, so every showFlash() site is untouched; the store
     owns the countdown, so there is no local timeout to leak. */
  function showFlash(kind: 'ok' | 'err', msg: string) {
    if (kind === 'ok') notifyOk(msg, 'communications');
    else notifyErr(msg, 'communications');
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  // All load functions are "silent": none of them touch the page-level
  // `loading` flag (only the initial mount effect does), so post-action
  // refetches never wipe the page. Each load carries a stale-response guard:
  // a per-key sequence number bumped at call start; after every await the
  // load bails if a newer call for the same key has since started, so an
  // out-of-order response can never clobber fresher (or optimistic) state.
  const loadSeqs = useRef<Record<string, number>>({});
  const beginLoad = useCallback((key: string) => {
    const seq = (loadSeqs.current[key] ?? 0) + 1;
    loadSeqs.current[key] = seq;
    return () => loadSeqs.current[key] === seq;
  }, []);

  const loadTemplates = useCallback(async () => {
    if (!conference || !session) return;
    const fresh = beginLoad('templates');
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('email_templates')
      .select('id, conference_id, event_key, name, subject, body, body_blocks, enabled, delivery, lifecycle, updated_at, audience')
      .eq('conference_id', conference.id);
    if (!fresh()) return;
    setTemplates((data ?? []) as EmailTemplate[]);
  }, [conference?.id, session?.access_token, beginLoad]);

  const loadApplications = useCallback(async () => {
    if (!conference || !session) return;
    const fresh = beginLoad('applications');
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('applications')
      .select(`
        id, user_id, role, status, payment_status, attending, society_id,
        societies (name),
        assigned_committee_id,
        assigned_committee:conference_committees!assigned_committee_id (abbreviation, name, session_code),
        assigned_country_name,
        profiles (display_name, email, notify_email_marketing, avatar_url),
        invited_email, invited_name, aid_status
      `)
      .eq('conference_id', conference.id);
    if (!fresh()) return;
    setApplications((data ?? []) as unknown as AppRow[]);
  }, [conference?.id, session?.access_token, beginLoad]);

  const loadCommittees = useCallback(async () => {
    if (!conference || !session) return;
    const fresh = beginLoad('committees');
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('conference_committees')
      .select('id, name, abbreviation, study_guides_publish_at, study_guides_notified_at')
      .eq('conference_id', conference.id)
      .order('name', { ascending: true });
    if (!fresh()) return;
    setCommittees((data ?? []) as Committee[]);
  }, [conference?.id, session?.access_token, beginLoad]);

  const loadSocieties = useCallback(async () => {
    if (!conference || !session) return;
    const fresh = beginLoad('societies');
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('societies')
      .select('id, name')
      .eq('conference_id', conference.id)
      .order('name', { ascending: true });
    if (!fresh()) return;
    setSocieties((data ?? []) as Society[]);
  }, [conference?.id, session?.access_token, beginLoad]);

  const loadRoleConfigs = useCallback(async () => {
    if (!conference || !session) return;
    const fresh = beginLoad('roleConfigs');
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('application_role_configs')
      .select('role, fee_amount, fee_currency, fee_phases')
      .eq('conference_id', conference.id);
    if (!fresh()) return;
    setRoleConfigs((data ?? []) as unknown as RoleFeeConfig[]);
  }, [conference?.id, session?.access_token, beginLoad]);

  const loadEmailSends = useCallback(async () => {
    if (!conference || !session) return;
    const fresh = beginLoad('emailSends');
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('email_sends')
      .select('id, subject, recipient_filter, recipient_count, scheduled_at, sent_at, status, created_at, body_html')
      .eq('conference_id', conference.id)
      .order('created_at', { ascending: false });
    if (!fresh()) return;
    setEmailSends((data ?? []) as unknown as EmailSend[]);
  }, [conference?.id, session?.access_token, beginLoad]);

  const loadOutboxPending = useCallback(async () => {
    if (!conference || !session) return;
    const fresh = beginLoad('outboxPending');
    const supabase = getAuthedClient(session.access_token);
    const { count } = await supabase
      .from('email_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('conference_id', conference.id)
      .eq('status', 'pending');
    if (!fresh()) return;
    setOutboxPending(count ?? 0);
  }, [conference?.id, session?.access_token, beginLoad]);

  // The whole outbox, summary columns only (no bodies) — feeds the Sent band's
  // automatic-send groups, the delivered/failed splits and the fire counts on
  // the Automatic emails registry. READ ONLY: this page stays a writer of
  // pending rows + the delivery kicker; the cron jobs own everything else.
  const loadOutboxFeed = useCallback(async () => {
    if (!conference || !session) return;
    const fresh = beginLoad('outboxFeed');
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('email_outbox')
      .select('id, template_id, email_send_id, recipient_application_id, recipient_email, subject, status, error, sent_at, created_at, send_after')
      .eq('conference_id', conference.id)
      .order('created_at', { ascending: false })
      .limit(4000);
    if (!fresh()) return;
    setOutboxFeed((data ?? []) as OutboxFeedRow[]);
  }, [conference?.id, session?.access_token, beginLoad]);

  // In-progress application drafts, via the security-barrier status view (the
  // raw table is not organiser-readable). Failure here just leaves the
  // "reminders due" rail card off — nothing else depends on it.
  const loadDraftStatus = useCallback(async () => {
    if (!conference || !session) return;
    const fresh = beginLoad('draftStatus');
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('application_draft_status')
      .select('id, updated_at, reminders_sent, reminder_opt_out')
      .eq('conference_id', conference.id);
    if (!fresh()) return;
    setDraftStatusRows((data ?? []) as DraftStatusRow[]);
  }, [conference?.id, session?.access_token, beginLoad]);

  // All requests + all their messages in two queries, modest for a single
  // conference's Q&R volume, and lets the list snippet / unread rule compute
  // "last message from participant" client-side without an N+1.
  const loadInbox = useCallback(async () => {
    if (!conference || !session) return;
    const fresh = beginLoad('inbox');
    const supabase = getAuthedClient(session.access_token);
    const { data: reqData } = await supabase
      .from('conference_requests')
      .select('id, user_id, application_id, subject, status, kind, metadata, seen_by_organizer, organizer_seen_at, created_at, last_message_at')
      .eq('conference_id', conference.id)
      .order('created_at', { ascending: false });
    if (!fresh()) return;
    const requests = (reqData ?? []) as InboxRequest[];
    setInboxRequests(requests);

    const requestIds = requests.map(r => r.id);
    const userIds = Array.from(new Set(requests.map(r => r.user_id)));
    if (requestIds.length === 0) {
      setInboxMessages([]);
      setInboxProfiles(new Map());
      setInboxRoles(new Map());
      return;
    }

    const [msgRes, profileRes, appRes] = await Promise.all([
      supabase
        .from('conference_request_messages')
        .select('id, request_id, sender_user_id, is_organizer, body, created_at')
        .in('request_id', requestIds)
        .order('created_at', { ascending: true }),
      supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds),
      supabase.from('applications').select('user_id, role').eq('conference_id', conference.id).in('user_id', userIds),
    ]);
    if (!fresh()) return;
    setInboxMessages((msgRes.data ?? []) as InboxMessage[]);
    setInboxProfiles(new Map(((profileRes.data ?? []) as ({ id: string } & InboxProfile)[]).map(p => [p.id, p])));
    const roleMap = new Map<string, string>();
    for (const a of ((appRes.data ?? []) as { user_id: string; role: string }[])) {
      if (!roleMap.has(a.user_id)) roleMap.set(a.user_id, a.role);
    }
    setInboxRoles(roleMap);
  }, [conference?.id, session?.access_token, beginLoad]);

  useEffect(() => {
    if (!conference) return;
    setLoading(true);
    Promise.all([loadTemplates(), loadApplications(), loadCommittees(), loadSocieties(), loadRoleConfigs(), loadEmailSends(), loadOutboxPending(), loadOutboxFeed(), loadDraftStatus(), loadInbox()])
      .finally(() => setLoading(false));
    // conference?.id, not conference: every load callback above is itself
    // keyed on conference?.id, so this only re-fires when the id genuinely
    // changes, a background refresh (quiet or otherwise) that swaps in a new
    // conference object with the same id must never restart the page load.
  }, [conference?.id, loadTemplates, loadApplications, loadCommittees, loadSocieties, loadRoleConfigs, loadEmailSends, loadOutboxPending, loadOutboxFeed, loadDraftStatus, loadInbox]);

  // Load the rail-card 24h snoozes for this conference (client-local).
  useEffect(() => {
    if (!conference?.id) return;
    try {
      const raw = window.localStorage.getItem(railDismissKey(conference.id));
      setDismissedRail(raw ? (JSON.parse(raw) as Record<string, number>) : {});
    } catch { setDismissedRail({}); }
  }, [conference?.id]);

  const dismissRailCard = useCallback((id: string) => {
    setDismissedRail(prev => {
      const next = { ...prev, [id]: Date.now() };
      try { if (conference?.id) window.localStorage.setItem(railDismissKey(conference.id), JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }, [conference?.id]);

  const railCardVisible = useCallback(
    (id: string) => !dismissedRail[id] || Date.now() - dismissedRail[id] > 24 * 3600 * 1000,
    [dismissedRail]
  );

  // Seed the design draft from the conference's saved theme once (not on
  // every refreshConferenceQuiet(), that would clobber an in-progress edit).
  // Records the seeded value as "last saved" so the autosave effect below
  // sees no real change and never writes it straight back.
  useEffect(() => {
    if (!conference || themeSeededRef.current) return;
    themeSeededRef.current = true;
    const seeded = resolveEmailTheme(conference.email_theme);
    lastSavedThemeRef.current = seeded;
    setThemeDraft(seeded);
  }, [conference?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sweep the outbox once on mount: retries anything still pending from an
  // earlier session (a page that closed before delivery fired, a prior sweep
  // that hit the edge function's per-invocation batch cap, etc).
  const sweptRef = useRef(false);
  useEffect(() => {
    if (sweptRef.current || !conference || !session) return;
    sweptRef.current = true;
    triggerEmailDelivery(getAuthedClient(session.access_token)).then(() => {
      loadOutboxPending();
      loadEmailSends();
      loadOutboxFeed();
    });
  }, [conference?.id, session?.access_token, loadOutboxPending, loadEmailSends, loadOutboxFeed]);

  // ── Inbox derived data ───────────────────────────────────────────────────

  const inboxMessagesByRequest = useMemo(() => {
    const map = new Map<string, InboxMessage[]>();
    for (const m of inboxMessages) {
      const list = map.get(m.request_id) ?? [];
      list.push(m);
      map.set(m.request_id, list);
    }
    return map;
  }, [inboxMessages]);

  function lastMessageOf(requestId: string): InboxMessage | null {
    const list = inboxMessagesByRequest.get(requestId);
    return list && list.length > 0 ? list[list.length - 1] : null;
  }

  // Last activity = the greater of the thread's own created_at and its
  // newest message's created_at — a new message from either side bumps the
  // thread to the top; a status-only change with no message never moves it.
  function lastActivityOf(r: InboxRequest): string {
    const last = lastMessageOf(r.id);
    return last && last.created_at > r.created_at ? last.created_at : r.created_at;
  }

  // Unread = messages from the participant side (is_organizer false) newer
  // than organizer_seen_at; every message counts when the stamp is null
  // (never opened). Independent of `status` — a closed thread can still
  // carry unread messages.
  function unreadCountOf(r: InboxRequest): number {
    const msgs = inboxMessagesByRequest.get(r.id) ?? [];
    return msgs.filter(m => !m.is_organizer && (!r.organizer_seen_at || m.created_at > r.organizer_seen_at)).length;
  }

  const filteredInboxRequests = useMemo(() => {
    const q = inboxSearch.trim().toLowerCase();
    return inboxRequests
      .filter(r => (inboxStatusFilter.size === 0 ? true : inboxStatusFilter.has(r.status)))
      .filter(r => (inboxKindFilter.size === 0 ? true : inboxKindFilter.has(r.kind)))
      .filter(r => (q ? r.subject.toLowerCase().includes(q) : true))
      .filter(r => (inboxDateFrom ? r.created_at.slice(0, 10) >= inboxDateFrom : true))
      .filter(r => (inboxDateTo ? r.created_at.slice(0, 10) <= inboxDateTo : true))
      // Last-activity-wins (see lastActivityOf) — a status change alone
      // (approved, denied, closed) never reorders the list.
      .sort((a, b) => lastActivityOf(b).localeCompare(lastActivityOf(a)));
  }, [inboxRequests, inboxStatusFilter, inboxKindFilter, inboxSearch, inboxDateFrom, inboxDateTo, inboxMessagesByRequest]);

  // Changing any filter resets to page one.
  useEffect(() => { setInboxPage(1); }, [inboxStatusFilter, inboxKindFilter, inboxSearch, inboxDateFrom, inboxDateTo]);

  const INBOX_PAGE_SIZE = 15;
  const inboxTotalPages = Math.max(1, Math.ceil(filteredInboxRequests.length / INBOX_PAGE_SIZE));
  const pagedInboxRequests = filteredInboxRequests.slice((inboxPage - 1) * INBOX_PAGE_SIZE, inboxPage * INBOX_PAGE_SIZE);
  const inboxActiveFilterCount =
    (inboxStatusFilter.size > 0 ? 1 : 0) +
    (inboxKindFilter.size > 0 ? 1 : 0) +
    (inboxDateFrom || inboxDateTo ? 1 : 0);
  // Threads-with-unread count, over the whole inbox (unaffected by the
  // active filters) — the INBOX tab badge and header count.
  const inboxUnreadThreadCount = inboxRequests.filter(r => unreadCountOf(r) > 0).length;
  // MARK ALL READ only ever acts on the current page ("currently visible").
  const inboxVisibleUnreadCount = pagedInboxRequests.filter(r => unreadCountOf(r) > 0).length;

  const selectedRequest = inboxRequests.find(r => r.id === selectedRequestId) ?? null;
  const selectedMessages = selectedRequestId ? inboxMessagesByRequest.get(selectedRequestId) ?? [] : [];
  const selectedKindChip = selectedRequest ? (KIND_CHIP[selectedRequest.kind] ?? KIND_CHIP.question) : null;

  // ── Derived data ──────────────────────────────────────────────────────────

  const templatesByEvent = useMemo(() => {
    const map = new Map<string, EmailTemplate>();
    for (const t of templates) if (t.event_key) map.set(t.event_key, t);
    return map;
  }, [templates]);

  const templateById = useMemo(() => new Map(templates.map(t => [t.id, t])), [templates]);
  const appById = useMemo(() => new Map(applications.map(a => [a.id, a])), [applications]);

  // ── Sent feed: automatic outbox traffic grouped by event + day ────────────
  // Rows tied to an email_sends row surface through History; everything else
  // is automatic traffic (queueEventEmail / the cron jobs) and — before this
  // feed — had no visible history at all. Rows whose template is an ad-hoc one
  // but which predate email_send_id are skipped rather than double-shown.
  const autoGroups = useMemo<AutoSendGroup[]>(() => {
    const map = new Map<string, AutoSendGroup>();
    for (const r of outboxFeed) {
      if (r.email_send_id) continue;
      const t = r.template_id ? templateById.get(r.template_id) : undefined;
      if (t && !t.event_key) continue; // legacy ad-hoc rows without a send id
      const eventKey = t?.event_key ?? null;
      const day = r.created_at.slice(0, 10);
      const key = `${eventKey ?? `s:${r.subject}`}|${day}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key, eventKey, day, latestAt: r.created_at,
          label: eventKey ? getEventLabel(eventKey) : (r.subject || '(No subject)'),
          count: 0, delivered: 0, failed: 0, pending: 0, rows: [],
        };
        map.set(key, g);
      }
      g.count += 1;
      if (r.status === 'sent') g.delivered += 1;
      else if (r.status === 'failed') g.failed += 1;
      else g.pending += 1;
      if (r.created_at > g.latestAt) g.latestAt = r.created_at;
      g.rows.push(r);
    }
    return [...map.values()].sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  }, [outboxFeed, templateById]);

  /** Delivered/failed split per ad-hoc send, from the same feed rows. */
  const splitBySendId = useMemo(() => {
    const m = new Map<string, { delivered: number; failed: number; pending: number }>();
    for (const r of outboxFeed) {
      if (!r.email_send_id) continue;
      const s = m.get(r.email_send_id) ?? { delivered: 0, failed: 0, pending: 0 };
      if (r.status === 'sent') s.delivered += 1;
      else if (r.status === 'failed') s.failed += 1;
      else s.pending += 1;
      m.set(r.email_send_id, s);
    }
    return m;
  }, [outboxFeed]);

  type FeedItem =
    | { kind: 'adhoc'; at: string; send: EmailSend }
    | { kind: 'auto'; at: string; group: AutoSendGroup };

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [
      ...emailSends.map(send => ({ kind: 'adhoc' as const, at: send.sent_at ?? send.created_at, send })),
      ...autoGroups.map(group => ({ kind: 'auto' as const, at: group.latestAt, group })),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }, [emailSends, autoGroups]);

  const failedTotal = useMemo(() => outboxFeed.filter(r => r.status === 'failed').length, [outboxFeed]);

  /** How many times each automatic event has actually fired, from the outbox. */
  const fireCountByEvent = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of outboxFeed) {
      const ev = r.template_id ? templateById.get(r.template_id)?.event_key : null;
      if (ev) m.set(ev, (m.get(ev) ?? 0) + 1);
    }
    return m;
  }, [outboxFeed, templateById]);

  // The draft→ready lifecycle is gone as a UI concept: autosave makes every
  // ad-hoc email a draft, and SEND is always available from the editor. The
  // `lifecycle` column is left untouched on existing rows (and still written
  // as 'draft' on inserts) so nothing downstream breaks — the UI just no
  // longer reads it.
  const adhocTemplates = useMemo(
    () => templates.filter(t => !t.event_key).sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [templates]
  );

  const eligibleApplications = useMemo(
    () => applications.filter(a => a.status !== 'rejected' && a.status !== 'withdrawn'),
    [applications]
  );

  // Empty delegations (an import typo, or a society nobody ever actually
  // joined) are silently dropped from the audience picker, `applications`
  // here is unfiltered by status, so this reflects membership at any stage.
  const nonEmptySocietyIds = useMemo(
    () => new Set(applications.filter(a => a.society_id).map(a => a.society_id as string)),
    [applications]
  );
  const delegationOptions = useMemo(
    () => [
      ...societies.filter(s => nonEmptySocietyIds.has(s.id)).map(s => ({ value: s.id, label: s.name })),
      { value: INDEPENDENT_KEY, label: 'Independents' },
    ],
    [societies, nonEmptySocietyIds]
  );

  // Committees an applicant can actually be assigned to (audience chips).
  const committeeOptions = useMemo(
    () => committees.map(c => ({ value: c.id, label: c.abbreviation ?? c.name })),
    [committees]
  );

  const currentFilterSets = useMemo<AudienceFilterSets>(() => ({
    roles: selRoles, payment: selPayment, delegations: selDelegations,
    committees: selCommittees, attendance: selAttendance, status: selStatus, aid: selAid,
  }), [selRoles, selPayment, selDelegations, selCommittees, selAttendance, selStatus, selAid]);

  const filterMatched = useMemo(
    () => eligibleApplications.filter(a => appMatchesAudience(a, currentFilterSets)),
    [eligibleApplications, currentFilterSets]
  );

  // Per-choice live counts. THE MARGINAL-COUNT CHOICE: each chip shows how
  // many people IT would reach given the other sections' current filters —
  // its own section is evaluated as if only that chip were selected, every
  // other section keeps its live selection. Chips inside a section OR
  // together, so this is the chip's own contribution ("Unpaid (61)" = 61
  // unpaid people pass all the OTHER active filters), not a running total of
  // the whole audience. All applications are client-side, so this is a pure
  // recompute — no queries.
  const chipCounts = useMemo(() => {
    const out: Record<string, number> = {};
    const countFor = (section: keyof AudienceFilterSets, value: string) => {
      const hypo: AudienceFilterSets = { ...currentFilterSets, [section]: new Set([value]) };
      let n = 0;
      for (const a of eligibleApplications) if (appMatchesAudience(a, hypo)) n += 1;
      return n;
    };
    for (const o of ROLE_OPTIONS) out[`roles:${o.value}`] = countFor('roles', o.value);
    for (const o of PAYMENT_OPTIONS) out[`payment:${o.value}`] = countFor('payment', o.value);
    for (const o of delegationOptions) out[`delegations:${o.value}`] = countFor('delegations', o.value);
    for (const o of committeeOptions) out[`committees:${o.value}`] = countFor('committees', o.value);
    for (const o of ATTENDANCE_OPTIONS) out[`attendance:${o.value}`] = countFor('attendance', o.value);
    for (const o of APP_STATUS_OPTIONS) out[`status:${o.value}`] = countFor('status', o.value);
    for (const o of AID_OPTIONS) out[`aid:${o.value}`] = countFor('aid', o.value);
    return out;
  }, [eligibleApplications, currentFilterSets, delegationOptions, committeeOptions]);

  const countsFor = useCallback(
    (section: keyof AudienceFilterSets, options: { value: string }[]) => {
      const rec: Record<string, number> = {};
      for (const o of options) rec[o.value] = chipCounts[`${section}:${o.value}`] ?? 0;
      return rec;
    },
    [chipCounts]
  );

  const matchedRecipients = useMemo(() => {
    const byId = new Map(applications.map(a => [a.id, a]));
    const result: AppRow[] = [];
    const seen = new Set<string>();
    for (const a of filterMatched) {
      if (excludedIds.has(a.id)) continue;
      result.push(a);
      seen.add(a.id);
    }
    for (const id of manuallyAddedIds) {
      if (seen.has(id)) continue;
      const a = byId.get(id);
      if (a) { result.push(a); seen.add(id); }
    }
    return result;
  }, [filterMatched, excludedIds, manuallyAddedIds, applications]);

  // GDPR: registered recipients who opted out of marketing emails (Account ->
  // notify_email_marketing) never receive an ad-hoc/broadcast send, manual
  // add can't override that consent. Imported/unclaimed applicants (no
  // profiles row) have no preference to honour yet, so they stay eligible.
  // `finalRecipients` is the actual send list; the excluded count is
  // surfaced to the organizer as a "N opted out" note.
  const finalRecipients = useMemo(
    () => matchedRecipients.filter(a => a.profiles?.notify_email_marketing !== false),
    [matchedRecipients]
  );
  const optedOutCount = matchedRecipients.length - finalRecipients.length;

  // ── Recipient summary groups ─────────────────────────────────────────────
  // 685 applications don't read as a flat list, so the audience renders as
  // grouped summary rows. Grouping rule: when the audience is filtered by
  // delegation, delegations are the organiser's mental model, so group by
  // delegation; otherwise delegates group by committee and everyone else by
  // role. Opted-out members stay VISIBLE inside their group (greyed, counted
  // in the header) — consent exclusions are surfaced, never silent.
  interface RecipientGroup {
    key: string;
    label: string;
    members: AppRow[];
    optedOut: number;
  }
  const recipientGroups = useMemo<RecipientGroup[]>(() => {
    const byDelegation = selDelegations.size > 0;
    const map = new Map<string, RecipientGroup>();
    for (const a of matchedRecipients) {
      let key: string;
      let label: string;
      if (byDelegation) {
        key = a.society_id ? `soc:${a.society_id}` : 'soc:independent';
        label = a.societies?.name ?? 'Independents';
      } else if (a.role === 'delegate') {
        key = a.assigned_committee_id ? `com:${a.assigned_committee_id}` : 'com:none';
        label = a.assigned_committee
          ? (a.assigned_committee.abbreviation ?? a.assigned_committee.name)
          : 'No committee yet';
      } else {
        key = `role:${a.role}`;
        label = `${roleLabel(a.role)}s`;
      }
      let g = map.get(key);
      if (!g) { g = { key, label, members: [], optedOut: 0 }; map.set(key, g); }
      g.members.push(a);
      if (a.profiles?.notify_email_marketing === false) g.optedOut += 1;
    }
    return [...map.values()].sort((a, b) => b.members.length - a.members.length || a.label.localeCompare(b.label));
  }, [matchedRecipients, selDelegations]);

  const manualMatches = useMemo(() => {
    if (!manualSearch.trim()) return [];
    const q = manualSearch.trim().toLowerCase();
    const alreadyIn = new Set(matchedRecipients.map(a => a.id));
    return applications
      .filter(a => !alreadyIn.has(a.id) && (
        (a.profiles?.display_name ?? a.invited_name ?? '').toLowerCase().includes(q) ||
        (a.profiles?.email ?? a.invited_email ?? '').toLowerCase().includes(q)
      ))
      .slice(0, 8);
  }, [applications, manualSearch, matchedRecipients]);

  // Role- and phase-aware {{fee}}, mirrors queueEventEmail's own resolution
  // (src/lib/emailEvents.ts) so a preview/test-send never shows a different
  // number than the real send that follows it. Falls back to the retired
  // conference-level fee_amount only when the role has no config row.
  function resolveFeeToken(role: string): string | null {
    if (!conference) return null;
    const config = roleConfigs.find(rc => rc.role === role);
    if (config) {
      const { amount } = activePhaseFee({ fee_amount: config.fee_amount, fee_phases: config.fee_phases });
      return formatFee(amount, config.fee_currency ?? conference.fee_currency);
    }
    return conference.fee_amount ? formatFee(conference.fee_amount, conference.fee_currency) : null;
  }

  function buildContext(app: AppRow): EmailTokenContext {
    if (!conference) return {};
    return {
      delegate_name: app.profiles?.display_name ?? app.invited_name ?? null,
      role: roleLabel(app.role),
      delegation_name: app.societies?.name ?? (app.society_id == null ? 'Independent' : null),
      committee: app.assigned_committee?.abbreviation ?? app.assigned_committee?.name ?? null,
      country: app.assigned_country_name ?? null,
      payment_status: paymentStatusLabel(app.payment_status),
      conference_name: conference.full_name,
      conference_dates: formatDateRange(conference.start_date, conference.end_date),
      fee: resolveFeeToken(app.role),
      // From the assigned committee's row — lets the session-codes gallery
      // seed actually resolve per delegate. Mirrored in queueAdHocEmail so
      // the preview and the real send agree.
      session_code: app.assigned_committee?.session_code ?? null,
    };
  }

  const previewCandidates: PreviewCandidate[] = useMemo(
    () => applications.map(a => ({ id: a.id, label: a.profiles?.display_name ?? a.invited_name ?? 'Unknown', ctx: buildContext(a) })),
    [applications, conference, roleConfigs] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Sample context for "Send test to me": organizer-derived values where we
  // have them (name, conference details), `[Label]` placeholders for tokens
  // that only make sense against a real applicant (role, committee, etc).
  // No applicant is selected here, so {{fee}} resolves against the delegate
  // role's config specifically (the most representative default), same
  // role- and phase-aware resolution as buildContext/queueEventEmail.
  const testSendContext: EmailTokenContext = useMemo(() => {
    if (!conference) return {};
    const known: Partial<Record<EmailTokenKey, string | null>> = {
      delegate_name: profile?.display_name ?? null,
      conference_name: conference.full_name,
      conference_dates: formatDateRange(conference.start_date, conference.end_date),
      fee: resolveFeeToken('delegate'),
    };
    const ctx: EmailTokenContext = {};
    for (const key of EMAIL_TOKEN_KEYS) {
      const v = known[key];
      ctx[key] = v && v.trim() ? v : `[${EMAIL_TOKEN_LABELS[key]}]`;
    }
    return ctx;
  }, [conference, profile, roleConfigs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live shell preview for the Design section, a representative sample
  // (allocation_assigned) rendered through the in-progress theme draft, not
  // yet-saved conference.email_theme.
  const designPreviewHtml = useMemo(() => {
    if (!conference) return '';
    const sample = getDefaultEventEmail('allocation_assigned');
    if (!sample) return '';
    return renderEmailHtml({
      blocks: sample.blocks,
      conference: { ...conference, email_theme: themeDraft },
      ctx: testSendContext,
    });
  }, [conference, themeDraft, testSendContext]);

  function buildRecipientFilterPayload() {
    return {
      roles: [...selRoles],
      paymentStatuses: [...selPayment],
      delegationIds: [...selDelegations].filter(id => id !== INDEPENDENT_KEY),
      includeIndependents: selDelegations.has(INDEPENDENT_KEY),
      attendance: [...selAttendance],
      applicationStatuses: [...selStatus],
      aidStatuses: [...selAid],
      committeeIds: [...selCommittees],
      manualCount: manuallyAddedIds.size,
      excludedCount: excludedIds.size,
    };
  }

  /** Full restorable audience selection, filters re-resolve live, manual adds/exclusions restore by id. */
  function buildAudienceState(): SavedAudience {
    return {
      roles: [...selRoles],
      paymentStatuses: [...selPayment],
      delegationIds: [...selDelegations].filter(id => id !== INDEPENDENT_KEY),
      includeIndependents: selDelegations.has(INDEPENDENT_KEY),
      attendance: [...selAttendance],
      applicationStatuses: [...selStatus],
      aidStatuses: [...selAid],
      committeeIds: [...selCommittees],
      manualIds: [...manuallyAddedIds],
      excludedIds: [...excludedIds],
    };
  }

  // ── Builder open/close ────────────────────────────────────────────────────

  function resetAudience() {
    setSelRoles(new Set());
    setSelPayment(new Set());
    setSelDelegations(new Set());
    setSelCommittees(new Set());
    setSelAttendance(new Set());
    setSelStatus(new Set());
    setSelAid(new Set());
    setExcludedIds(new Set());
    setManuallyAddedIds(new Set());
    setManualSearch('');
    setExpandedGroups(new Set());
    setAudienceRestored(false);
  }

  /** Restores a saved audience by id/value against CURRENT data, filters
   *  re-resolve naturally; manual adds/exclusions silently drop ids that no
   *  longer resolve to a live application. */
  function restoreAudience(saved: SavedAudience) {
    setSelRoles(new Set(saved.roles ?? []));
    setSelPayment(new Set(saved.paymentStatuses ?? []));
    const delegations = new Set(saved.delegationIds ?? []);
    if (saved.includeIndependents) delegations.add(INDEPENDENT_KEY);
    setSelDelegations(delegations);
    setSelCommittees(new Set(saved.committeeIds ?? []));
    setSelAttendance(new Set(saved.attendance ?? []));
    setSelStatus(new Set(saved.applicationStatuses ?? []));
    setSelAid(new Set(saved.aidStatuses ?? []));
    const liveIds = new Set(applications.map(a => a.id));
    setManuallyAddedIds(new Set((saved.manualIds ?? []).filter(id => liveIds.has(id))));
    setExcludedIds(new Set((saved.excludedIds ?? []).filter(id => liveIds.has(id))));
    setManualSearch('');
    const hasAnySelection =
      (saved.roles?.length ?? 0) > 0 || (saved.paymentStatuses?.length ?? 0) > 0 ||
      (saved.delegationIds?.length ?? 0) > 0 || saved.includeIndependents ||
      (saved.attendance?.length ?? 0) > 0 || (saved.applicationStatuses?.length ?? 0) > 0 ||
      (saved.aidStatuses?.length ?? 0) > 0 || (saved.committeeIds?.length ?? 0) > 0 ||
      (saved.manualIds?.length ?? 0) > 0 || (saved.excludedIds?.length ?? 0) > 0;
    setAudienceRestored(hasAnySelection);
  }

  const openBuilderForEvent = useCallback((ev: EventDef) => {
    const existing = templatesByEvent.get(ev.key);
    const initialSubject = existing?.subject ?? '';
    const initialBlocks = normalizeBlocks(existing?.body_blocks, existing?.body ?? '');
    setBuilderEventKey(ev.key);
    setBuilderTemplateId(existing?.id ?? null);
    setBuilderName(ev.label);
    setBuilderSubject(initialSubject);
    setBuilderBlocks(initialBlocks);
    setBuilderDelivery(existing?.delivery ?? ev.defaultDelivery);
    resetAudience();
    setBuilderError('');
    builderJustOpenedRef.current = true;
    builderInitialRef.current = JSON.stringify({ subject: initialSubject, blocks: initialBlocks });
    setGalleryOpen(false);
    setBuilderOpen(true);
  }, [templatesByEvent]);

  function openBuilderForAdHoc(template?: EmailTemplate) {
    const initialSubject = template?.subject ?? '';
    const initialBlocks = normalizeBlocks(template?.body_blocks, template?.body ?? '');
    setBuilderEventKey(null);
    setBuilderTemplateId(template?.id ?? null);
    setBuilderName(template?.name ?? '');
    setBuilderSubject(initialSubject);
    setBuilderBlocks(initialBlocks);
    setBuilderDelivery('manual');
    resetAudience();
    if (template?.audience) restoreAudience(template.audience);
    setBuilderError('');
    builderJustOpenedRef.current = true;
    builderInitialRef.current = JSON.stringify({ subject: initialSubject, blocks: initialBlocks });
    setGalleryOpen(false);
    setBuilderOpen(true);
  }

  /** Opens the editor pre-filled from a gallery seed — the same pre-fill path
   *  openBuilderForAdHoc uses, just fed static content instead of a DB row.
   *  Nothing persists until the first edit/save (the normal autosave flow). */
  function openBuilderForSeed(content: SeedContent) {
    const initialBlocks = content.blocks.map(b => ({ ...b }));
    setBuilderEventKey(null);
    setBuilderTemplateId(null);
    setBuilderName(content.name);
    setBuilderSubject(content.subject);
    setBuilderBlocks(initialBlocks);
    builderInitialRef.current = JSON.stringify({ subject: content.subject, blocks: initialBlocks });
    setBuilderDelivery('manual');
    resetAudience();
    if (content.audience) restoreAudience({ ...EMPTY_SAVED_AUDIENCE, ...content.audience });
    // The preset is a suggestion, not a restored save — the chips themselves
    // show what is selected, so the "Saved audience loaded" affordance stays off.
    setAudienceRestored(false);
    setBuilderError('');
    builderJustOpenedRef.current = true;
    setGalleryOpen(false);
    setBuilderOpen(true);
  }

  function openGallery() {
    setForkSeedId(null);
    setGalleryOpen(true);
  }

  function closeBuilder() {
    setBuilderOpen(false);
  }

  // Deep link: ?event=<key> opens the Automatic-emails view with that event's
  // composer; ?inbox=<requestId> opens the Inbox on that thread (the target
  // of the 'request_received' email's button). The inbox is a permanent column
  // on desktop, so opening the thread is enough there; below 1024px the same
  // state shows through the INBOX tab.
  useEffect(() => {
    if (loading || deepLinkHandled) return;
    setDeepLinkHandled(true);
    const inboxId = searchParams.get('inbox');
    if (inboxId) {
      setView('landing');
      setMobileTab('inbox');
      setSelectedRequestId(inboxId);
      return;
    }
    const ev = searchParams.get('event');
    if (!ev) return;
    const def = EVENT_REGISTRY.find(e => e.key === ev);
    if (def) {
      setView('automatic');
      openBuilderForEvent(def);
    }
  }, [loading, deepLinkHandled, searchParams, openBuilderForEvent]);

  // ── Builder mutations ─────────────────────────────────────────────────────

  function handleComposerChange(value: { subject: string; blocks: EmailBlock[] }) {
    setBuilderSubject(value.subject);
    setBuilderBlocks(value.blocks);
  }

  async function persistTemplate(subject: string, blocks: EmailBlock[], opts: { silent: boolean }): Promise<string | null> {
    if (!conference || !session) return null;
    const isAdHoc = builderEventKey === null;
    const eventDef = builderEventKey ? EVENT_REGISTRY.find(e => e.key === builderEventKey) : null;
    const name = isAdHoc ? builderName.trim() : (eventDef?.label ?? builderEventKey ?? '');
    if (isAdHoc && !name) { if (!opts.silent) setBuilderError('Name is required.'); return null; }
    if (!subject.trim() || blocks.length === 0) { if (!opts.silent) setBuilderError('Subject and message are required.'); return null; }

    const supabase = getAuthedClient(session.access_token);
    const payload: Record<string, unknown> = {
      subject,
      body: flattenBlocksToPlainText(blocks, conference),
      body_blocks: blocks,
      delivery: builderDelivery,
      name,
      updated_at: new Date().toISOString(),
    };
    if (isAdHoc) payload.audience = buildAudienceState();

    if (builderTemplateId) {
      const { error } = await supabase.from('email_templates').update(payload).eq('id', builderTemplateId);
      if (error) { if (!opts.silent) setBuilderError(error.message); return null; }
      void loadTemplates(); // silent background refresh, never blocks the builder
      return builderTemplateId;
    }

    const { data, error } = await supabase.from('email_templates').insert({
      conference_id: conference.id,
      event_key: builderEventKey,
      ...payload,
    }).select('id').single();
    if (error) { if (!opts.silent) setBuilderError(error.message); return null; }
    const newId = (data as { id: string }).id;
    setBuilderTemplateId(newId);
    void loadTemplates(); // silent background refresh, never blocks the builder
    return newId;
  }

  // Debounced autosave: silently persists body_blocks + the flattened body as the chair edits.
  useEffect(() => {
    if (!builderOpen) return;
    if (builderJustOpenedRef.current) { builderJustOpenedRef.current = false; return; }
    // Not-an-edit guard: skip while content still equals what the builder
    // opened with (see builderInitialRef) — the composer's mount echo, or a
    // seed browsed and abandoned, must not write a row.
    if (JSON.stringify({ subject: builderSubject, blocks: builderBlocks }) === builderInitialRef.current) return;
    const t = setTimeout(() => { persistTemplate(builderSubject, builderBlocks, { silent: true }); }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builderSubject, builderBlocks, builderOpen]);

  async function handleSaveAndClose() {
    setSavingTemplate(true);
    setBuilderError('');
    const id = await persistTemplate(builderSubject, builderBlocks, { silent: false });
    setSavingTemplate(false);
    if (id) {
      showFlash('ok', 'Template saved.');
      closeBuilder();
    }
  }

  // Toggling ON an event with no template row yet creates the stub (F:
  // three-state events), an awaited insert, busy-scoped to that row's
  // toggle. Toggling an existing row (either direction) stays the instant
  // optimistic flip.
  function handleToggleEnabled(ev: EventDef, template: EmailTemplate | undefined) {
    if (!session || !conference) return;

    if (!template) {
      if (togglingEventKeys.has(ev.key)) return;
      setTogglingEventKeys(s => new Set(s).add(ev.key));
      const supabase = getAuthedClient(session.access_token);
      (async () => {
        const res = await turnOnDefaultEmail(supabase, conference.id, ev.key);
        if (!res.ok) throw new Error(res.error ?? 'Could not turn this on.');
        void loadTemplates();
      })()
        .catch((e: unknown) => {
          showFlash('err', e instanceof Error ? e.message : 'Could not turn this on.');
        })
        .finally(() => setTogglingEventKeys(s => { const next = new Set(s); next.delete(ev.key); return next; }));
      return;
    }

    const prev = template.enabled;
    const next = !prev;
    // Optimistic: flip the pill immediately; roll back only this row on failure.
    setTemplates(ts => ts.map(t => (t.id === template.id ? { ...t, enabled: next } : t)));
    const supabase = getAuthedClient(session.access_token);
    (async () => {
      const { error } = await supabase.from('email_templates').update({ enabled: next }).eq('id', template.id);
      if (error) throw error;
    })().catch((e: unknown) => {
      setTemplates(ts => ts.map(t => (t.id === template.id ? { ...t, enabled: prev } : t)));
      showFlash('err', e instanceof Error ? e.message : 'Could not update the notification toggle.');
    });
  }

  async function handleDuplicateTemplate(t: EmailTemplate) {
    if (!conference || !session || duplicatingIds.has(t.id)) return;
    // Creation flow: the new row needs its real DB id (Edit/autosave target it),
    // so the insert stays awaited, busy-state on this row's Copy button only.
    setDuplicatingIds(prev => new Set(prev).add(t.id));
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.from('email_templates').insert({
      conference_id: conference.id,
      event_key: null,
      name: `Copy of ${t.name}`,
      subject: t.subject,
      body: t.body,
      body_blocks: t.body_blocks,
      delivery: 'manual',
      lifecycle: 'draft',
      enabled: false,
      updated_at: new Date().toISOString(),
    }).select('id, conference_id, event_key, name, subject, body, body_blocks, enabled, delivery, lifecycle, updated_at, audience').single();
    setDuplicatingIds(prev => { const nextSet = new Set(prev); nextSet.delete(t.id); return nextSet; });
    if (error || !data) { showFlash('err', error?.message ?? 'Could not duplicate the template.'); return; }
    setTemplates(prev => [...prev, data as EmailTemplate]);
    showFlash('ok', 'Duplicated as a new draft.');
  }

  async function handleDeleteTemplate(t: EmailTemplate) {
    if (!session || deletingIds.has(t.id)) return;
    const { confirmed } = await confirmDelete({
      title: `Delete "${t.name}"? This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    setDeletingIds(s => new Set(s).add(t.id));
    const snapshot = templates;
    setTemplates(ts => ts.filter(x => x.id !== t.id));
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase.from('email_templates').delete().eq('id', t.id);
    setDeletingIds(s => { const next = new Set(s); next.delete(t.id); return next; });
    if (error) {
      setTemplates(snapshot);
      showFlash('err', error.message);
      return;
    }
    showFlash('ok', 'Deleted.');
  }

  // The one and only mutator for themeDraft's user-facing controls, marks
  // this a real edit so the autosave effect below is allowed to fire.
  function patchTheme(patch: Partial<EmailTheme>) {
    themeTouchedRef.current = true;
    setThemeDraft(t => ({ ...t, ...patch }));
  }

  // Debounced autosave to conferences.email_theme, same pattern as the
  // builder's body autosave. renderEmailHtml reads the theme with
  // current-look defaults, so every send/preview path picks this up with no
  // content migration once it lands.
  //
  // Two independent guards keep the seeding effect from ever causing a
  // write: themeTouchedRef only flips inside patchTheme (a real control
  // interaction), and the deep-equal check below is a second line of
  // defense against saving a draft that already matches the DB. Either one
  // alone would be sufficient; both together mean this can't regress into
  // the reload loop even if one of them is ever bypassed.
  useEffect(() => {
    if (!conference || !session || !themeTouchedRef.current) return;
    if (JSON.stringify(themeDraft) === JSON.stringify(lastSavedThemeRef.current)) return;
    const t = setTimeout(async () => {
      setThemeSaving(true);
      setThemeError('');
      const supabase = getAuthedClient(session.access_token);
      const { error } = await supabase.from('conferences').update({ email_theme: themeDraft }).eq('id', conference.id);
      setThemeSaving(false);
      if (error) { setThemeError(error.message); return; }
      lastSavedThemeRef.current = themeDraft;
      setThemeSaved(true);
      setTimeout(() => setThemeSaved(false), 2000);
      // Quiet: swaps the conference row in without flipping the layout's
      // loading flag, a full refreshConference() here would unmount and
      // remount this entire page on every autosave.
      void refreshConferenceQuiet();
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeDraft]);

  function handleExcludeRecipient(id: string) {
    if (manuallyAddedIds.has(id)) {
      setManuallyAddedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    } else {
      setExcludedIds(prev => new Set(prev).add(id));
    }
  }

  async function handleOpenSendConfirm() {
    if (!conference || !session || openingSend) return;
    setBuilderError('');
    if (finalRecipients.length === 0) { setBuilderError('No recipients selected.'); return; }
    // Awaited on purpose: we must have the real template id + a validated save
    // before offering to send. Busy-state is scoped to the SEND button only.
    setOpeningSend(true);
    const id = await persistTemplate(builderSubject, builderBlocks, { silent: false });
    setOpeningSend(false);
    if (!id) return;
    setSendConfirmText('');
    setSendConfirmOpen(true);
  }

  async function handleConfirmSend() {
    // `sending` doubles as the double-send lock: while a send is in flight the
    // confirm button is busy AND re-entry is rejected here, so queueing the
    // same email twice is impossible.
    if (!conference || !session || !user || !builderTemplateId || sending) return;
    setSending(true);
    const supabase = getAuthedClient(session.access_token);
    const recipientFilterPayload = buildRecipientFilterPayload();

    // ONE send implementation: the shared queueAdHocEmail pipeline
    // (email_sends summary → per-recipient outbox rows → delivery trigger),
    // the same one the Applications bulk bar uses. The consent gate runs in
    // there through recipientAllowsCategory('marketing') — this page passes
    // the PRE-consent match list and lets the shared predicate drop
    // opt-outs, instead of reading notify_email_marketing itself. (The
    // sidebar's `finalRecipients` preview applies the same `!== false`
    // semantics, so the numbers agree; the shared path is authoritative.)
    const result = await queueAdHocEmail(supabase, {
      conferenceId: conference.id,
      sentBy: user.id,
      subject: builderSubject,
      blocks: builderBlocks,
      applicationIds: matchedRecipients.map(a => a.id),
      recipientFilter: recipientFilterPayload,
    });

    if (result.error) {
      setBuilderError(result.error);
      setSending(false);
      setSendConfirmOpen(false);
      return;
    }
    if (result.queued === 0) {
      setBuilderError(result.optedOut > 0
        ? `Nothing was sent — every matched recipient (${result.optedOut}) has opted out of marketing emails.`
        : 'Nothing was sent — no eligible recipients.');
      setSending(false);
      setSendConfirmOpen(false);
      return;
    }

    // Optimistic: History and the Outbox Pending medallion update instantly
    // from values we already know; the silent refetches below reconcile with
    // the server (delivery may already have drained some of the outbox).
    if (result.emailSendId) {
      const sentAtIso = new Date().toISOString();
      setEmailSends(prev => [{
        id: result.emailSendId!,
        subject: builderSubject,
        recipient_filter: recipientFilterPayload,
        recipient_count: result.queued,
        scheduled_at: null,
        sent_at: sentAtIso,
        status: 'sent' as const,
        created_at: sentAtIso,
        body_html: renderEmailHtml({ blocks: builderBlocks, conference, ctx: {} }),
      }, ...prev]);
    }
    setOutboxPending(p => p + result.queued);

    setSending(false);
    setSendConfirmOpen(false);
    setSendConfirmText('');
    closeBuilder();
    showFlash('ok', `Queued ${result.queued} email${result.queued === 1 ? '' : 's'}, sending now.`);
    void loadTemplates();
    void loadEmailSends();
    void loadOutboxPending();
    void loadOutboxFeed();
  }

  async function toggleRecipientsExpanded(sendId: string) {
    if (recipientsExpandedId === sendId) { setRecipientsExpandedId(null); return; }
    setRecipientsExpandedId(sendId);
    if (outboxBySend[sendId] || !session) return;
    setOutboxBySend(prev => ({ ...prev, [sendId]: 'loading' }));
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('email_outbox')
      .select('id, recipient_email, status, error, sent_at, recipient_application_id')
      .eq('email_send_id', sendId);
    setOutboxBySend(prev => ({ ...prev, [sendId]: (data ?? []) as OutboxDetailRow[] }));
  }

  // ── "Explore emails" walkthrough ──────────────────────────────────────────
  //
  // The tour drives `setView` / `setMobileTab` between steps — no router
  // involvement at all. Each step's
  // `before()` puts the page into the state the step describes; the overlay
  // then waits for that step's `data-tutorial` target to exist before measuring
  // it, and falls back to a centred bubble if it never appears.

  const tourSteps: WalkthroughStep[] = useMemo(() => [
    {
      id: 'intro',
      image: OTTER_INTRO,
      text: (
        <>
          This is <strong>Communications</strong> — every email your conference sends, and every
          message it gets back. One screen: what is <TourGreen>coming up</TourGreen>, everything{' '}
          <TourGreen>sent</TourGreen>, and the <TourGreen>inbox</TourGreen> for replies. Let me
          show you around.
        </>
      ),
    },
    {
      id: 'coming-up',
      targets: ['comms-coming-up'],
      radius: 16,
      before: () => { setView('landing'); setSelectedRequestId(null); },
      text: (
        <>
          <TourGold>Coming up</TourGold> is what the system is about to do — emails draining,
          scheduled releases, reminders that are due — plus the occasional gold suggestion when
          something is waiting on you. Each card has one action; dismiss what you do not need.
        </>
      ),
    },
    {
      id: 'sent-feed',
      targets: ['comms-sent-feed'],
      radius: 16,
      before: () => { setView('landing'); setMobileTab('sent'); },
      text: (
        <>
          <TourGreen>Sent</TourGreen> is the full record — emails you wrote yourself AND the
          automatic ones the platform sent for you, with delivered/failed per recipient. Hit{' '}
          <TourGold>NEW EMAIL</TourGold> to pick a template or start blank, write with a live
          preview beside you, and choose exactly who gets it — all on one screen.{' '}
          <strong>Design</strong> below sets the look every email inherits.
        </>
      ),
    },
    {
      id: 'inbox',
      targets: ['comms-inbox'],
      radius: 16,
      before: () => { setView('landing'); setMobileTab('inbox'); setSelectedRequestId(null); },
      text: (
        <>
          <TourGold>Inbox</TourGold> is the other direction: questions and allocation swap
          requests from advisors, head delegates and delegates land here as threads. Filter them,
          reply in place, and approve or decline a swap without leaving the page.
        </>
      ),
    },
    {
      id: 'automatic',
      targets: ['comms-automatic'],
      radius: 16,
      before: () => { setView('automatic'); },
      text: (
        <>
          <TourGold>Automatic emails</TourGold> send themselves. Each is tied to a moment — an
          application accepted, a payment received, an allocation released — so people hear from
          you the second it happens. Turn one <TourGreen>on</TourGreen> and our default copy goes
          out; draft your own and it sends instead. Hundreds of emails you never write again.
        </>
      ),
    },
    {
      id: 'outro',
      image: OTTER_OUTRO,
      before: () => { setView('landing'); },
      text: (
        <>
          That is the whole system. Turn a couple of <TourGreen>automatic emails</TourGreen> on
          and your conference starts writing its own. Come back any time — the tour lives under{' '}
          <strong>Take the tour</strong> in the header 🎉
        </>
      ),
    },
  ], []);

  const [tourOpen, setTourOpen] = useState(false);

  // Auto-start once per browser for an organiser who has never seen it. The flag
  // is written in `closeTour` (i.e. on finish OR skip), never on open, so a
  // mis-click cannot burn it.
  useEffect(() => {
    if (loading || builderOpen || tourOpen) return;
    try {
      if (window.localStorage.getItem(COMMS_TOUR_SEEN_KEY) === '1') return;
    } catch {
      return; // private mode — never nag
    }
    setTourOpen(true);
    // Intentionally not depending on `tourOpen`: this must only ever fire on the
    // transition into a loaded page, not when the tour is dismissed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, builderOpen]);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    try { window.localStorage.setItem(COMMS_TOUR_SEEN_KEY, '1'); } catch { /* private mode */ }
    if (conference?.id) markEmailsExplored(conference.id);
  }, [conference?.id]);

  if (!conference) return null;

  // ── Derived cadence: everything the "Coming up" rail knows ────────────────
  // There is no cadence data model; every card below is derived read-only from
  // state already on this page.

  const enabledCount = templates.filter(t => t.event_key && t.enabled).length;
  const autoDefaultCount = templates.filter(t => t.event_key && t.enabled && !templateHasContent(t)).length;

  // Open threads no organizer has EVER replied to — the strongest signal on
  // the page (and what the request_received digest keeps nudging about).
  // swap_notice threads are informational records, not questions, so they
  // never count as "waiting on a reply".
  const neverAnsweredCount = inboxRequests.filter(
    r => r.status === 'open' && r.kind !== 'swap_notice'
      && !(inboxMessagesByRequest.get(r.id) ?? []).some(m => m.is_organizer)
  ).length;

  const scheduledRows = outboxFeed.filter(
    r => r.status === 'pending' && r.send_after && new Date(r.send_after).getTime() > Date.now()
  );
  const drainingCount = Math.max(0, outboxPending - scheduledRows.length);
  const earliestScheduled = scheduledRows.length
    ? scheduledRows.reduce((min, r) => (r.send_after! < min ? r.send_after! : min), scheduledRows[0].send_after!)
    : null;

  const draftRemindersDue = draftStatusRows.filter(
    d => !d.reminder_opt_out && (d.reminders_sent ?? 0) < 3
      && new Date(d.updated_at).getTime() < Date.now() - 3 * 86400e3
  ).length;

  const upcomingGuideReleases = committees
    .filter(
      c => c.study_guides_publish_at && !c.study_guides_notified_at
        && new Date(c.study_guides_publish_at).getTime() > Date.now()
    )
    // Earliest release first — the rail card says "Next on {date}".
    .sort((a, b) => a.study_guides_publish_at!.localeCompare(b.study_guides_publish_at!));

  const daysToStart = conference.start_date
    ? Math.ceil((new Date(conference.start_date).getTime() - Date.now()) / 86400e3)
    : null;
  const hasAllocations = applications.some(a => a.assigned_committee_id);
  const joinInvitesSent = outboxFeed.some(
    r => r.template_id && templateById.get(r.template_id)?.event_key === 'session_join_invite'
  );
  const sessionCodesNudge = daysToStart !== null && daysToStart >= 0 && daysToStart <= 30 && hasAllocations && !joinInvitesSent;

  // Superset rule: no request_received row still means the default digest
  // sends; only an explicit OFF row silences it.
  const requestReceivedRow = templatesByEvent.get('request_received');
  const digestOn = !requestReceivedRow || requestReceivedRow.enabled;

  // Gold budget: at most two recommendation-tinted cards at once, in priority
  // order. Everything past the budget renders as a plain card instead.
  let goldBudget = 2;
  const takeGold = (want: boolean) => {
    if (!want || goldBudget === 0) return false;
    goldBudget -= 1;
    return true;
  };
  const goldUnanswered = takeGold(neverAnsweredCount > 0 && railCardVisible('unanswered'));
  const goldDefaults = takeGold(autoDefaultCount > 0);
  const goldSessionCodes = takeGold(sessionCodesNudge && railCardVisible('session-codes'));

  const railHasCards =
    drainingCount > 0 || scheduledRows.length > 0
    || (neverAnsweredCount > 0 && railCardVisible('unanswered'))
    || (draftRemindersDue > 0 && railCardVisible('draft-reminders'))
    || upcomingGuideReleases.length > 0
    || (sessionCodesNudge && railCardVisible('session-codes'));

  const eventDef = builderEventKey ? EVENT_REGISTRY.find(e => e.key === builderEventKey) ?? null : null;
  const requireTypedConfirm = finalRecipients.length > 200;
  const confirmDisabled = requireTypedConfirm && sendConfirmText.trim().toUpperCase() !== 'SEND';
  const namesPreview = finalRecipients.slice(0, 5).map(a => a.profiles?.display_name ?? a.invited_name ?? 'Unknown').join(', ');

  // ── Row renderer for ad-hoc templates (all drafts now — the draft→ready
  // lifecycle is retired; SEND lives in the editor, always visible) ─────────

  function renderAdHocRow(t: EmailTemplate) {
    return (
      <div
        key={t.id}
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl px-4 py-3"
        style={PANEL}
      >
        <div className="min-w-0 flex-1" style={{ minWidth: 180 }}>
          <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{t.name}</p>
          <p className="text-xs truncate mt-0.5" style={{ color: SOFT, fontFamily: OUTFIT }}>
            {t.subject || '(No subject)'} · Edited {formatDate(t.updated_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <GhostBtn onClick={() => handleDuplicateTemplate(t)} title="Duplicate" disabled={duplicatingIds.has(t.id)}>
            <Copy size={13} />
          </GhostBtn>
          <GhostBtn onClick={() => openBuilderForAdHoc(t)}>EDIT</GhostBtn>
          <button
            onClick={() => openBuilderForAdHoc(t)}
            className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none active:scale-[0.96]"
            style={{
              background: 'linear-gradient(160deg, #24513A 0%, #1B3828 62%)', color: '#EED98A', fontFamily: OUTFIT,
              border: 'none', cursor: 'pointer', minHeight: 32, letterSpacing: '0.04em',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 3px 4px 9px rgba(27,56,40,0.26)',
              transitionProperty: 'filter, transform', transitionDuration: '160ms', transitionTimingFunction: EASE,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.07)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = 'none'; }}
          >
            SEND
          </button>
          <GhostBtn onClick={() => handleDeleteTemplate(t)} title="Delete" danger disabled={deletingIds.has(t.id)}>
            <X size={13} />
          </GhostBtn>
        </div>
      </div>
    );
  }

  // ── Shared recipient row (avatar + name + delivery state) ─────────────────
  // One renderer for both ad-hoc recipient breakdowns (lazy-fetched per send)
  // and automatic groups (already loaded via the feed).
  function renderRecipientRow(r: OutboxDetailRow) {
    const rc = outboxStatusColor(r.status);
    const app = r.recipient_application_id ? appById.get(r.recipient_application_id) : undefined;
    const name = app?.profiles?.display_name ?? app?.invited_name ?? null;
    const avatarUrl = app?.profiles?.avatar_url ?? null;
    const sentLabel = formatSentAt(r.sent_at);
    return (
      <div
        key={r.id}
        className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid rgba(27,56,40,0.09)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ProfileLink userId={app?.user_id} name={name}>
            <span className="flex items-center gap-2 min-w-0">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="rounded-full object-cover flex-shrink-0"
                  style={{ width: 24, height: 24, outline: '1px solid rgba(0,0,0,0.1)', outlineOffset: -1 }}
                />
              ) : (
                <span
                  className="flex items-center justify-center rounded-full flex-shrink-0"
                  style={{ width: 24, height: 24, backgroundColor: 'rgba(27,56,40,0.1)', color: '#1B3828', fontSize: 11, fontWeight: 700, fontFamily: OUTFIT }}
                >
                  {(name ?? r.recipient_email ?? '?').charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                {name && (
                  <span className="block text-xs font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{name}</span>
                )}
                <span className="block truncate" style={{ fontSize: name ? 10.5 : 12, color: name ? SOFT : '#1C1410', fontFamily: OUTFIT }}>
                  {r.recipient_email ?? '—'}
                </span>
              </span>
            </span>
          </ProfileLink>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {r.status === 'failed' && r.error && (() => {
            const failure = friendlyDeliveryError(r.error, r.recipient_email);
            return (
              <>
                <span className="text-xs truncate" style={{ color: RED, fontFamily: OUTFIT, maxWidth: 300 }} title={r.error}>
                  {failure.text}
                </span>
                {failure.fixable && (
                  <Link
                    href={`/manage/${conference?.slug}/import?tab=imported${r.recipient_application_id ? `&fix=${r.recipient_application_id}` : ''}`}
                    className="inline-flex items-center gap-1 rounded-lg py-1 px-2.5 text-xs font-bold flex-shrink-0 focus:outline-none"
                    style={{ border: '1px solid rgba(139,32,32,0.35)', color: RED, backgroundColor: 'rgba(139,32,32,0.06)', fontFamily: OUTFIT, textDecoration: 'none', whiteSpace: 'nowrap' }}
                  >
                    <Wrench size={11} /> FIX IT NOW
                  </Link>
                )}
              </>
            );
          })()}
          {sentLabel && (
            <span className="text-xs flex-shrink-0" style={{ color: SOFT, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
              {sentLabel}
            </span>
          )}
          <span
            className="rounded-md px-2 py-0.5 flex-shrink-0"
            style={{ fontSize: 10, fontWeight: 700, fontFamily: OUTFIT, backgroundColor: rc.bg, color: rc.text, border: `1px solid ${rc.dot}55` }}
          >
            {r.status}
          </span>
        </div>
      </div>
    );
  }

  // ── Inbox actions ────────────────────────────────────────────────────────

  function handleOpenThread(id: string) {
    setSelectedRequestId(id);
    setReplyText('');
    setReplyError('');
    setSwapError('');
    const req = inboxRequests.find(r => r.id === id);
    // Optimistic mark-read: the unread badge clears instantly. mark_request_seen
    // (SECURITY DEFINER) stamps organizer_seen_at, fire-and-forget on a FRESH
    // client (not a token captured in this closure at page mount) — separate
    // from the legacy seen_by_organizer flag below, which other pages
    // (DelegationsView's unseen-society tracking) and the sidebar's inbox
    // badge still read, so it's kept in sync too rather than replaced.
    setInboxRequests(prev => prev.map(r => (r.id === id ? { ...r, organizer_seen_at: new Date().toISOString() } : r)));
    void (async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase) return;
      const { error } = await supabase.rpc('mark_request_seen', { p_request_id: id });
      if (error) console.error('[communications] mark_request_seen failed:', error);
    })();
    if (!req || req.seen_by_organizer || !session) return;
    const supabase = getAuthedClient(session.access_token);
    setInboxRequests(prev => prev.map(r => (r.id === id ? { ...r, seen_by_organizer: true } : r)));
    (async () => {
      const { error } = await supabase.from('conference_requests').update({ seen_by_organizer: true }).eq('id', id);
      if (error) throw error;
    })().then(() => {
      // The sidebar's inbox badge counts seen_by_organizer=false rows and
      // only loads once on mount, so it needs an explicit nudge to refetch.
      window.dispatchEvent(new CustomEvent('gv-inbox-read-changed'));
    }).catch(() => {
      setInboxRequests(prev => prev.map(r => (r.id === id ? { ...r, seen_by_organizer: false } : r)));
      showFlash('err', 'Could not mark this thread as read.');
    });
  }

  async function handleMarkAllInboxRead() {
    if (!session || markingAllRead) return;
    const unreadIds = pagedInboxRequests.filter(r => unreadCountOf(r) > 0).map(r => r.id);
    if (unreadIds.length === 0) return;
    setMarkingAllRead(true);
    const supabase = getAuthedClient(session.access_token);
    const nowIso = new Date().toISOString();
    setInboxRequests(prev => prev.map(r => (unreadIds.includes(r.id) ? { ...r, organizer_seen_at: nowIso } : r)));
    await Promise.all(unreadIds.map(id => supabase.rpc('mark_request_seen', { p_request_id: id })));
    setMarkingAllRead(false);
    window.dispatchEvent(new CustomEvent('gv-inbox-read-changed'));
  }

  // Reply posts regardless of whether the notification email drafts, a
  // missing/disabled 'request_reply' template just nudges via DraftNotice.
  function handleInboxReply() {
    if (!session || !conference || !selectedRequest || !replyText.trim()) return;
    const req = selectedRequest;
    const body = replyText.trim();
    const tempId = `temp-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const prevReq = { last_message_at: req.last_message_at, seen_by_organizer: req.seen_by_organizer };

    // Optimistic: the bubble appears and the input clears instantly. Clearing
    // the input is also the double-send lock, a second Enter/click has no
    // text, so the trim() guard above rejects it.
    setInboxMessages(prev => [...prev, {
      id: tempId, request_id: req.id, sender_user_id: user!.id, is_organizer: true, body, created_at: nowIso,
    }]);
    setInboxRequests(prev => prev.map(r => (r.id === req.id ? { ...r, last_message_at: nowIso, seen_by_organizer: true } : r)));
    setReplyText('');
    setReplyError('');

    const supabase = getAuthedClient(session.access_token);
    (async () => {
      const { error: msgError } = await supabase.from('conference_request_messages').insert({
        request_id: req.id,
        sender_user_id: user!.id,
        is_organizer: true,
        body,
      });
      if (msgError) throw msgError;
      const { error: reqError } = await supabase.from('conference_requests').update({
        last_message_at: new Date().toISOString(),
        seen_by_organizer: true,
      }).eq('id', req.id);
      if (reqError) throw reqError;

      if (req.application_id) {
        // Secondary effect: failure surfaces inline but never rolls back the
        // already-posted reply.
        try {
          const result = await queueEventEmail(supabase, conference.id, 'request_reply', [req.application_id], {
            request_subject: req.subject,
          });
          notifyIfNeeded(result, pushDraftNotice);
        } catch {
          setReplyError('Reply posted, but the notification email could not be queued.');
        }
      }

      // Silent refetch swaps the temp message for the real server row.
      void loadInbox();
    })().catch((e: unknown) => {
      // Rollback: remove only the optimistic bubble, restore this request's
      // prior fields, and put the draft back so the text isn't lost.
      setInboxMessages(prev => prev.filter(m => m.id !== tempId));
      setInboxRequests(prev => prev.map(r => (r.id === req.id ? { ...r, ...prevReq } : r)));
      setReplyText(cur => (cur ? cur : body));
      setReplyError(e instanceof Error ? e.message : 'Could not send the reply.');
    });
  }

  function handleCloseReopen(close: boolean) {
    if (!session || !selectedRequest) return;
    const req = selectedRequest;
    const prevReq = { status: req.status, seen_by_organizer: req.seen_by_organizer };
    const nextStatus = close ? 'closed' : 'open';

    // Optimistic: the chip flips and the modal closes instantly.
    setInboxRequests(prev => prev.map(r => (r.id === req.id ? { ...r, status: nextStatus, seen_by_organizer: true } : r)));
    setCloseConfirmOpen(false);

    const supabase = getAuthedClient(session.access_token);
    (async () => {
      const { error } = await supabase.from('conference_requests').update({
        status: nextStatus,
        seen_by_organizer: true,
      }).eq('id', req.id);
      if (error) throw error;
    })().catch((e: unknown) => {
      setInboxRequests(prev => prev.map(r => (r.id === req.id ? { ...r, ...prevReq } : r)));
      showFlash('err', e instanceof Error ? e.message : `Could not ${close ? 'close' : 'reopen'} the thread.`);
    });
  }

  // Organizer-only: hard-deletes a thread and its messages. Participants
  // never see this action, they keep only close/reopen.
  async function handleDeleteThread() {
    if (!session || !selectedRequest || deletingThread) return;
    const req = selectedRequest;
    const { confirmed } = await confirmDelete({
      title: 'Delete this thread?',
      body: 'The thread and every message in it are permanently deleted. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    setDeletingThread(true);
    const supabase = getAuthedClient(session.access_token);
    const { error: msgError } = await supabase.from('conference_request_messages').delete().eq('request_id', req.id);
    if (msgError) { showFlash('err', msgError.message); setDeletingThread(false); return; }
    const { error } = await supabase.from('conference_requests').delete().eq('id', req.id);
    setDeletingThread(false);
    if (error) { showFlash('err', error.message); return; }

    setInboxRequests(prev => prev.filter(r => r.id !== req.id));
    setInboxMessages(prev => prev.filter(m => m.request_id !== req.id));
    setSelectedRequestId(null);
    showFlash('ok', 'Thread deleted.');
  }

  async function handleSwapDecision(approve: boolean) {
    if (!session || !conference || !selectedRequest || swapActing) return;
    const req = selectedRequest;
    const { app_a, app_b } = req.metadata;
    setSwapError('');
    const supabase = getAuthedClient(session.access_token);

    if (approve) {
      // The swap itself is a server-computed RPC whose ok/error result gates
      // everything else, so it stays awaited, busy-state on the Approve/
      // Decline buttons only (swapActing).
      if (!app_a || !app_b) { setSwapError('This request is missing the application ids to swap.'); return; }
      setSwapActing(true);
      const { data, error } = await supabase.rpc('perform_delegation_swap', { p_app_a: app_a, p_app_b: app_b });
      if (error) { setSwapError(error.message || 'Could not perform the swap.'); setSwapActing(false); return; }
      const result = data as { ok: boolean; error?: string };
      if (!result.ok) { setSwapError(result.error ?? 'Could not perform the swap.'); setSwapActing(false); return; }
      setSwapActing(false);
    }

    // Optimistic: the decision message and CLOSED state appear instantly
    // (closing also hides the Approve/Decline buttons, which is the
    // double-click lock for the decline path).
    const decisionBody = approve ? 'Swap approved and applied.' : 'Swap declined.';
    const tempId = `temp-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const prevReq = { status: req.status, last_message_at: req.last_message_at, seen_by_organizer: req.seen_by_organizer };
    setInboxMessages(prev => [...prev, {
      id: tempId, request_id: req.id, sender_user_id: user!.id, is_organizer: true, body: decisionBody, created_at: nowIso,
    }]);
    setInboxRequests(prev => prev.map(r => (r.id === req.id ? { ...r, status: 'closed', last_message_at: nowIso, seen_by_organizer: true } : r)));

    (async () => {
      const { error: msgError } = await supabase.from('conference_request_messages').insert({
        request_id: req.id,
        sender_user_id: user!.id,
        is_organizer: true,
        body: decisionBody,
      });
      if (msgError) throw msgError;
      const { error: reqError } = await supabase.from('conference_requests').update({
        status: 'closed',
        last_message_at: new Date().toISOString(),
        seen_by_organizer: true,
      }).eq('id', req.id);
      if (reqError) throw reqError;

      // Consolidation: delegation_swap only fires on APPROVE. Nothing was
      // actually swapped on decline, so no swap email goes out for it. If the
      // organizer wants to notify a decline, the normal reply flow (request_reply)
      // carries that news instead.
      if (approve && app_a && app_b) {
        // Secondary effect: inline error, no rollback of the decision.
        try {
          const result = await queueEventEmail(supabase, conference.id, 'delegation_swap', [app_a, app_b]);
          notifyIfNeeded(result, pushDraftNotice);
        } catch {
          setSwapError('Decision recorded, but the notification email could not be queued.');
        }
      }

      void loadInbox();
    })().catch((e: unknown) => {
      // Rollback the thread bookkeeping only, an approved swap itself (RPC)
      // has already been applied and is not undone here.
      setInboxMessages(prev => prev.filter(m => m.id !== tempId));
      setInboxRequests(prev => prev.map(r => (r.id === req.id ? { ...r, ...prevReq } : r)));
      setSwapError(e instanceof Error ? e.message : 'Could not record the decision.');
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 md:px-10 py-8">

      {/* ── Header ── */}
      {!builderOpen && (
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs mb-1" style={{ color: SOFT, fontFamily: OUTFIT, fontWeight: 700, letterSpacing: '0.12em' }}>
              {conference.acronym} / Communications
            </p>
            <h1 className="font-black text-2xl" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              Communications
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setTourOpen(true)}
            className="flex-shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 focus:outline-none transition-colors"
            style={{
              fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em',
              color: '#1B3828', backgroundColor: 'transparent', border: `1px solid ${BORDER}`,
              cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Compass size={13} /> TAKE THE TOUR
          </button>
        </div>
      )}

      {/* ── Builder header ── */}
      {builderOpen && (
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={closeBuilder}
            className="text-sm font-semibold focus:outline-none transition-colors"
            style={{ color: '#9A8A78', backgroundColor: 'transparent', border: 'none', fontFamily: OUTFIT }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
          >
            ← BACK
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleSaveAndClose}
              disabled={savingTemplate}
              className="rounded-xl py-2 px-4 text-sm font-bold focus:outline-none transition-colors disabled:opacity-60"
              style={{ border: `1px solid ${BORDER}`, color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT }}
              onMouseEnter={e => { if (!savingTemplate) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              {savingTemplate ? 'SAVING...' : 'SAVE'}
            </button>
            {/* No lifecycle ceremony: SEND is always here, and always routes
                through the confirm modal (typed SEND above 200 recipients). */}
            {builderEventKey === null && (
              <button
                onClick={handleOpenSendConfirm}
                disabled={sending || openingSend}
                className="rounded-xl py-2 px-4 text-sm font-bold focus:outline-none transition-colors disabled:opacity-60"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, minHeight: 40 }}
                onMouseEnter={e => { if (!(sending || openingSend)) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                {sending ? 'QUEUEING...' : openingSend ? 'SAVING...' : `SEND${finalRecipients.length > 0 ? ` TO ${finalRecipients.length}` : ''}`}
              </button>
            )}
          </div>
        </div>
      )}

      {!builderOpen && (
        <DraftNoticeList
          notices={draftNotices}
          conferenceSlug={conference.slug}
          onDismiss={dismissDraftNotice}
          onTurnOn={async (eventKey) => {
            if (!session) return;
            const supabase = getAuthedClient(session.access_token);
            await turnOnDefaultEmail(supabase, conference.id, eventKey);
            void loadTemplates();
          }}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN VIEW — one landing (Coming up · Sent · Inbox), plus the
          Automatic-emails registry one click away. No tabs on the first
          screen; below 1024px the inbox column becomes its own tab.
      ════════════════════════════════════════════════════════════════════════ */}
      {!builderOpen && loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      )}

      {/* ═══ AUTOMATIC EMAILS — the registry, grouped by lifecycle stage ═══ */}
      {!builderOpen && !galleryOpen && !loading && view === 'automatic' && (
        <section data-tutorial="comms-automatic">
          <button
            onClick={() => setView('landing')}
            className="text-xs font-bold mb-4 focus:outline-none"
            style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = SOFT; }}
          >
            ← BACK TO COMMUNICATIONS
          </button>

          <div className="mb-6">
            <h2 className="font-black text-xl" style={{ color: '#1C1410', fontFamily: OUTFIT, textWrap: 'balance' }}>
              Automatic emails
            </h2>
            <p className="text-sm mt-1" style={{ color: SOFT, fontFamily: OUTFIT, textWrap: 'pretty', maxWidth: 640 }}>
              Each one is tied to a moment in the conference lifecycle and sends itself the second
              that moment happens. Turned on without a draft, it sends our default copy — draft your
              own and that sends instead.
            </p>
            <p className="text-xs mt-1.5 font-bold" style={{ color: SOFT, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>
              {enabledCount} ON{autoDefaultCount > 0 ? ` · ${autoDefaultCount} SENDING OUR DEFAULT COPY` : ''}
            </p>
          </div>

          {STAGE_ORDER.map(stage => {
            const evs = (EVENT_REGISTRY as readonly EventDef[]).filter(e => EVENT_STAGE[e.key as EventKey] === stage);
            if (evs.length === 0) return null;
            return (
              <div key={stage} className="mb-7">
                <p className="mb-2" style={{ color: SOFT, fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em' }}>
                  {stage.toUpperCase()}
                </p>
                <div className="flex flex-col gap-2">
                  {evs.map((ev: EventDef) => {
                    const template = templatesByEvent.get(ev.key);
                    const hasDraft = templateHasContent(template);
                    const togglingStub = togglingEventKeys.has(ev.key);
                    const fired = fireCountByEvent.get(ev.key) ?? 0;
                    const expanded = expandedEventKeys.has(ev.key);
                    // ONE primary state, in words. The toggle stays because it IS
                    // the TURN ON semantic (an enabled empty row sends the default;
                    // stub rows are never deleted or auto-filled).
                    const state = ev.functional
                      ? { text: 'Always sends', color: GREEN_INK }
                      : togglingStub
                        ? { text: 'Turning on…', color: AMBER_INK }
                        : !template
                          ? { text: 'Not set up', color: SOFT }
                          : template.enabled && hasDraft
                            ? { text: 'On — sends your draft', color: GREEN_INK }
                            : template.enabled
                              ? { text: 'On — sends our default', color: AMBER_INK }
                              : { text: 'Off', color: SOFT };
                    return (
                      <div key={ev.key} className="rounded-2xl px-4 py-3" style={PANEL}>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <button
                            type="button"
                            onClick={() => setExpandedEventKeys(s => toggleInSet(s, ev.key))}
                            aria-expanded={expanded}
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left focus:outline-none"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', minWidth: 200 }}
                          >
                            <ChevronDown
                              size={14}
                              className="flex-shrink-0"
                              style={{ color: SOFT, transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transitionProperty: 'transform', transitionDuration: '200ms', transitionTimingFunction: EASE }}
                            />
                            <span className="min-w-0">
                              <span className="block font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                                {ev.label}
                              </span>
                              <span className="block text-xs mt-0.5 truncate" style={{ fontFamily: OUTFIT }}>
                                <span style={{ color: state.color, fontWeight: 700 }}>{state.text}</span>
                                {fired > 0 && (
                                  <span style={{ color: SOFT, fontVariantNumeric: 'tabular-nums' }}>
                                    {' '}· Sent {fired} time{fired === 1 ? '' : 's'}
                                  </span>
                                )}
                              </span>
                            </span>
                          </button>
                          <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                            {!ev.functional && (
                              <PillToggle
                                value={template?.enabled ?? false}
                                onChange={togglingStub ? () => {} : () => handleToggleEnabled(ev, template)}
                              />
                            )}
                            <GhostBtn onClick={() => setPreviewDefaultKey(ev.key)}>PREVIEW DEFAULT</GhostBtn>
                            <GhostBtn onClick={() => openBuilderForEvent(ev)}>{hasDraft ? 'EDIT' : 'DRAFT'}</GhostBtn>
                          </div>
                        </div>
                        {expanded && (
                          <p className="text-sm mt-2" style={{ color: '#1C1410', fontFamily: OUTFIT, lineHeight: 1.55, textWrap: 'pretty', maxWidth: 720, paddingLeft: 24 }}>
                            {ev.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ═══ TEMPLATE GALLERY — the fork before the editor ═══ */}
      {!builderOpen && galleryOpen && !loading && (
        <section>
          <button
            onClick={() => setGalleryOpen(false)}
            className="text-xs font-bold mb-4 focus:outline-none"
            style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = SOFT; }}
          >
            ← BACK TO COMMUNICATIONS
          </button>

          <div className="mb-6">
            <h2 className="font-black text-xl" style={{ color: '#1C1410', fontFamily: OUTFIT, textWrap: 'balance' }}>
              Start an email
            </h2>
            <p className="text-sm mt-1" style={{ color: SOFT, fontFamily: OUTFIT, textWrap: 'pretty', maxWidth: 640 }}>
              Pick a template for the emails conferences usually send, reuse one of your own, or
              start from nothing. Everything opens in the same editor — write, see the live
              preview, choose who gets it.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {AD_HOC_SEEDS.map(seed => {
              const Icon = seed.icon;
              const forked = forkSeedId === seed.id;
              return (
                <div key={seed.id} className="relative rounded-2xl p-4 flex flex-col" style={PANEL}>
                  <div className="flex items-start gap-3">
                    <span
                      className="flex items-center justify-center flex-shrink-0 rounded-xl"
                      style={{ width: 36, height: 36, background: 'rgba(27,56,40,0.07)', border: '1px solid rgba(27,56,40,0.12)' }}
                    >
                      <Icon size={17} strokeWidth={2} style={{ color: '#1B3828' }} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT, lineHeight: 1.3, textWrap: 'pretty' }}>
                        {seed.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: SOFT, fontFamily: OUTFIT, lineHeight: 1.45, textWrap: 'pretty' }}>
                        {seed.blurb}
                      </p>
                    </div>
                  </div>
                  {seed.tokens.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {seed.tokens.map(tk => (
                        <span
                          key={tk}
                          className="rounded-full px-2 py-0.5"
                          style={{ fontSize: 10, fontWeight: 700, fontFamily: OUTFIT, backgroundColor: 'rgba(238,217,138,0.3)', color: '#8A6614', border: '1px solid rgba(182,135,31,0.35)' }}
                        >
                          {EMAIL_TOKEN_LABELS[tk]}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto pt-3">
                    {!forked ? (
                      <button
                        type="button"
                        onClick={() => (seed.options.length === 1 ? openBuilderForSeed(seed.options[0].content) : setForkSeedId(seed.id))}
                        className="w-full rounded-xl px-3 text-xs font-bold focus:outline-none active:scale-[0.97]"
                        style={{
                          minHeight: 40, border: CARD_BORDER, color: '#1B3828', backgroundColor: 'transparent',
                          fontFamily: OUTFIT, letterSpacing: '0.04em', cursor: 'pointer',
                          transitionProperty: 'background-color, transform', transitionDuration: '160ms', transitionTimingFunction: EASE,
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        USE THIS
                      </button>
                    ) : (
                      // The owner's fork, inline on the card (no popover to clip):
                      // Gavelling's polished default copy, or a blank custom start
                      // with the same name + audience preset.
                      <div className="flex flex-col gap-1.5">
                        {seed.options.map(opt => (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => openBuilderForSeed(opt.content)}
                            className="w-full rounded-xl px-3 text-xs font-bold focus:outline-none active:scale-[0.97]"
                            style={{
                              minHeight: 40,
                              background: opt.label.startsWith('Use') ? 'linear-gradient(160deg, #24513A 0%, #1B3828 62%)' : 'transparent',
                              color: opt.label.startsWith('Use') ? '#EED98A' : '#1B3828',
                              border: opt.label.startsWith('Use') ? 'none' : CARD_BORDER,
                              fontFamily: OUTFIT, letterSpacing: '0.04em', cursor: 'pointer',
                            }}
                          >
                            {opt.label.toUpperCase()}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setForkSeedId(null)}
                          className="text-xs font-semibold focus:outline-none"
                          style={{ color: SOFT, background: 'none', border: 'none', fontFamily: OUTFIT, cursor: 'pointer', padding: '6px 0' }}
                        >
                          Never mind
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Start blank */}
            <div className="rounded-2xl p-4 flex flex-col" style={PANEL}>
              <div className="flex items-start gap-3">
                <span
                  className="flex items-center justify-center flex-shrink-0 rounded-xl"
                  style={{ width: 36, height: 36, background: 'linear-gradient(150deg, rgba(182,135,31,0.18), rgba(182,135,31,0.06))', border: '1px solid rgba(182,135,31,0.3)' }}
                >
                  <PenLine size={17} strokeWidth={2} style={{ color: AMBER_INK }} />
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT, lineHeight: 1.3 }}>
                    Start blank
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: SOFT, fontFamily: OUTFIT, lineHeight: 1.45, textWrap: 'pretty' }}>
                    An empty email — write anything, to anyone.
                  </p>
                </div>
              </div>
              <div className="mt-auto pt-3">
                <button
                  type="button"
                  onClick={() => openBuilderForAdHoc()}
                  className="w-full rounded-xl px-3 text-xs font-bold focus:outline-none active:scale-[0.97]"
                  style={{
                    minHeight: 40, background: 'linear-gradient(160deg, #24513A 0%, #1B3828 62%)', color: '#EED98A',
                    border: 'none', fontFamily: OUTFIT, letterSpacing: '0.04em', cursor: 'pointer',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 3px 4px 9px rgba(27,56,40,0.26)',
                  }}
                >
                  START BLANK
                </button>
              </div>
            </div>
          </div>

          {/* The conference's own saved ad-hoc emails */}
          {adhocTemplates.length > 0 && (
            <div className="mt-8">
              <p className="mb-2" style={{ color: SOFT, fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em' }}>
                YOUR SAVED EMAILS
              </p>
              <div className="flex flex-col gap-2">
                {adhocTemplates.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openBuilderForAdHoc(t)}
                    className="w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left focus:outline-none active:scale-[0.995]"
                    style={{ ...PANEL, cursor: 'pointer' }}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{t.name}</span>
                      <span className="block text-xs truncate mt-0.5" style={{ color: SOFT, fontFamily: OUTFIT }}>
                        {t.subject || '(No subject)'} · Edited {formatDate(t.updated_at)}
                      </span>
                    </span>
                    <ArrowRight size={14} className="flex-shrink-0" style={{ color: '#1B3828' }} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ═══ LANDING ═══ */}
      {!builderOpen && !galleryOpen && !loading && view === 'landing' && (
        <>
          {/* ── Band 1 · Coming up ── */}
          <section className="mb-8" data-tutorial="comms-coming-up">
            <p className="mb-2" style={{ color: SOFT, fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em' }}>
              COMING UP
            </p>
            {railHasCards ? (
              <div className="flex flex-wrap items-stretch gap-3">
                {drainingCount > 0 && (
                  <RailCard
                    icon={Zap}
                    live
                    title={`${drainingCount} email${drainingCount === 1 ? '' : 's'} sending now`}
                    sub="Queued and being delivered — large sends take a few minutes to drain."
                  />
                )}
                {scheduledRows.length > 0 && earliestScheduled && (
                  <RailCard
                    icon={Clock}
                    title={`${scheduledRows.length} email${scheduledRows.length === 1 ? '' : 's'} scheduled`}
                    sub={`First goes out ${formatSentAt(earliestScheduled)}.`}
                  />
                )}
                {neverAnsweredCount > 0 && railCardVisible('unanswered') && (
                  <RailCard
                    icon={MessageSquare}
                    gold={goldUnanswered}
                    title={`${neverAnsweredCount} thread${neverAnsweredCount === 1 ? '' : 's'} never answered`}
                    sub={digestOn
                      ? 'A reminder digest keeps nudging your team while these wait.'
                      : 'Still waiting on a first reply from your team.'}
                    actionLabel="Answer them"
                    onAction={() => {
                      setInboxStatusFilter(new Set(['open']));
                      setMobileTab('inbox');
                      setSelectedRequestId(null);
                      document.getElementById('comms-inbox-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    onDismiss={() => dismissRailCard('unanswered')}
                  />
                )}
                {draftRemindersDue > 0 && railCardVisible('draft-reminders') && (
                  <RailCard
                    icon={PenLine}
                    title={`${draftRemindersDue} unfinished application${draftRemindersDue === 1 ? '' : 's'} can be nudged`}
                    sub="Started over three days ago and never submitted."
                    actionLabel="Send reminders"
                    onAction={() => router.push(`/manage/${conference.slug}/applications`)}
                    onDismiss={() => dismissRailCard('draft-reminders')}
                  />
                )}
                {upcomingGuideReleases.length > 0 && (
                  <RailCard
                    icon={BookOpen}
                    title={`${upcomingGuideReleases.length} study guide${upcomingGuideReleases.length === 1 ? '' : 's'} scheduled to release`}
                    sub={`Next on ${formatDate(upcomingGuideReleases[0].study_guides_publish_at!)} — delegates are emailed automatically.`}
                    actionLabel="View committees"
                    onAction={() => router.push(`/manage/${conference.slug}/committees`)}
                  />
                )}
                {sessionCodesNudge && railCardVisible('session-codes') && (
                  <RailCard
                    icon={KeyRound}
                    gold={goldSessionCodes}
                    title="Session codes haven't gone out"
                    sub={`The conference starts ${daysToStart === 0 ? 'today' : `in ${daysToStart} day${daysToStart === 1 ? '' : 's'}`} and allocated delegates have no join invite yet.`}
                    actionLabel="Send join invites"
                    onAction={() => {
                      const def = EVENT_REGISTRY.find(e => e.key === 'session_join_invite');
                      if (def) { setView('automatic'); openBuilderForEvent(def); }
                    }}
                    onDismiss={() => dismissRailCard('session-codes')}
                  />
                )}
                <RailCard
                  icon={Bell}
                  gold={goldDefaults}
                  title="Automatic emails"
                  sub={`${enabledCount} on${autoDefaultCount > 0 ? ` · ${autoDefaultCount} sending our default copy` : ''}`}
                  actionLabel={autoDefaultCount > 0 ? 'Review them' : 'Open'}
                  onAction={() => setView('automatic')}
                />
              </div>
            ) : (
              // Nothing pending — collapse to one quiet line, never dead space.
              <p className="text-sm flex flex-wrap items-center gap-x-2" style={{ color: SOFT, fontFamily: OUTFIT }}>
                Nothing queued or scheduled.
                <button
                  type="button"
                  onClick={() => setView('automatic')}
                  className="inline-flex items-center gap-1 font-bold focus:outline-none"
                  style={{ color: '#1B3828', background: 'none', border: 'none', padding: '6px 0', fontFamily: OUTFIT, fontSize: 13, cursor: 'pointer' }}
                >
                  Automatic emails: {enabledCount} on{autoDefaultCount > 0 ? `, ${autoDefaultCount} sending our default` : ''}
                  <ArrowRight size={12} strokeWidth={2.5} />
                </button>
              </p>
            )}
          </section>

          {/* Below 1024px the inbox collapses into a tab. */}
          <div className="inline-flex rounded-xl p-1 mb-5 lg:hidden" style={{ border: CARD_BORDER, backgroundColor: '#F0EBDD' }}>
            <TabPill active={mobileTab === 'sent'} onClick={() => setMobileTab('sent')}>SENT</TabPill>
            <TabPill active={mobileTab === 'inbox'} onClick={() => setMobileTab('inbox')}>
              INBOX{inboxUnreadThreadCount > 0 ? ` (${inboxUnreadThreadCount})` : ''}
            </TabPill>
          </div>

          <div className="lg:grid lg:items-start lg:gap-8" style={{ gridTemplateColumns: 'minmax(0,1fr) 400px' }}>

            {/* ── Band 2 · Sent ── */}
            <div className={`${mobileTab === 'sent' ? '' : 'hidden'} lg:block min-w-0`}>
              <section data-tutorial="comms-sent-feed">
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <h2 className="font-black text-lg" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Sent</h2>
                  {failedTotal > 0 && (
                    <span
                      className="rounded-full px-2.5 py-0.5"
                      style={{ fontSize: 11, fontWeight: 800, fontFamily: OUTFIT, backgroundColor: 'rgba(139,32,32,0.1)', color: RED, border: '1px solid rgba(139,32,32,0.3)', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {failedTotal} failed
                    </span>
                  )}
                  {drainingCount > 0 && (
                    <span
                      className="rounded-full px-2.5 py-0.5"
                      style={{ fontSize: 11, fontWeight: 800, fontFamily: OUTFIT, backgroundColor: 'rgba(182,135,31,0.12)', color: AMBER_INK, border: '1px solid rgba(182,135,31,0.35)', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {drainingCount} sending
                    </span>
                  )}
                  <span className="ml-auto">
                    <PrimaryBtn icon={Plus} onClick={openGallery}>NEW EMAIL</PrimaryBtn>
                  </span>
                </div>
                <p className="text-sm mb-5" style={{ color: SOFT, fontFamily: OUTFIT, textWrap: 'pretty' }}>
                  Everything this conference has sent — broadcasts you wrote, and the automatic
                  emails the platform sent for you.
                </p>

                {/* In-the-works strip: drafts + ready-to-send, tucked above the feed. */}
                {adhocTemplates.length > 0 && (
                  <div className="mb-6">
                    <button
                      type="button"
                      onClick={() => setWorklistOpen(v => !v)}
                      aria-expanded={worklistOpen}
                      className="flex items-center gap-2 focus:outline-none"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
                    >
                      <ChevronDown size={15} style={{ color: '#1C1410', transform: worklistOpen ? 'rotate(180deg)' : 'rotate(0)', transitionProperty: 'transform', transitionDuration: '200ms', transitionTimingFunction: EASE }} />
                      <span className="font-semibold text-base" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                        In the works
                      </span>
                      <span className="text-xs font-bold" style={{ color: SOFT, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                        {adhocTemplates.length} draft{adhocTemplates.length === 1 ? '' : 's'}
                      </span>
                    </button>
                    {worklistOpen && (
                      <div className="flex flex-col gap-2 mt-2">
                        {adhocTemplates.map(t => renderAdHocRow(t))}
                      </div>
                    )}
                  </div>
                )}

                {/* The feed */}
                {feedItems.length === 0 ? (
                  <div className="flex flex-col items-center py-16">
                    <Mail size={40} style={{ color: SOFT, marginBottom: 16 }} />
                    <p className="font-semibold text-lg mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT, textWrap: 'balance' }}>
                      Nothing sent yet
                    </p>
                    <p className="text-sm" style={{ color: SOFT, fontFamily: OUTFIT }}>
                      Broadcasts and automatic emails will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {feedItems.map(item => {
                      if (item.kind === 'auto') {
                        const g = item.group;
                        const isOpen = autoExpandedKey === g.key;
                        return (
                          <div key={`auto-${g.key}`} className="rounded-2xl p-5" style={PANEL}>
                            <div className="flex items-center gap-3">
                              <span
                                className="flex items-center justify-center flex-shrink-0 rounded-xl"
                                style={{ width: 30, height: 30, background: 'linear-gradient(150deg, rgba(182,135,31,0.2), rgba(182,135,31,0.07))', border: '1px solid rgba(182,135,31,0.3)' }}
                              >
                                <Bell size={14} style={{ color: AMBER_INK }} />
                              </span>
                              <p className="font-semibold text-sm flex-1 truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                                {g.label}
                              </p>
                              <span
                                className="flex-shrink-0 rounded-md px-2 py-0.5"
                                style={{ fontSize: 10, fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.06em', backgroundColor: 'rgba(182,135,31,0.12)', color: AMBER_INK, border: '1px solid rgba(182,135,31,0.3)' }}
                              >
                                AUTOMATIC
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5" style={{ fontSize: 12, color: SOFT, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                              <span>{g.count} recipient{g.count === 1 ? '' : 's'}</span>
                              {g.delivered > 0 && <span style={{ color: GREEN_INK, fontWeight: 700 }}>{g.delivered} delivered</span>}
                              {g.failed > 0 && <span style={{ color: RED, fontWeight: 700 }}>{g.failed} failed</span>}
                              {g.pending > 0 && <span style={{ color: AMBER_INK, fontWeight: 700 }}>{g.pending} sending</span>}
                              <span className="ml-auto flex-shrink-0">{formatDate(g.latestAt)}</span>
                            </div>
                            <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(27,56,40,0.09)' }}>
                              <div>
                                <button
                                  onClick={() => setAutoExpandedKey(isOpen ? null : g.key)}
                                  className="text-xs font-bold focus:outline-none"
                                  style={{ color: '#1B3828', backgroundColor: 'transparent', border: 'none', fontFamily: OUTFIT, cursor: 'pointer', padding: '4px 0' }}
                                >
                                  {isOpen ? 'HIDE RECIPIENTS' : 'RECIPIENTS'}
                                </button>
                              </div>
                              {isOpen && (
                                <div className="flex flex-col gap-1" style={{ maxHeight: 280, overflowY: 'auto' }}>
                                  {g.rows.map(r => renderRecipientRow(r))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      const email = item.send;
                      const sc = STATUS_COLORS[email.status] ?? STATUS_COLORS.draft;
                      const isExpanded = historyExpandedId === email.id;
                      const filterText = formatFilter(email.recipient_filter, societies, committees);
                      const isHtml = looksLikeHtmlDoc(email.body_html);
                      const split = splitBySendId.get(email.id);

                      return (
                        <div key={email.id} className="rounded-2xl p-5" style={PANEL}>
                          <div className="flex items-center gap-3">
                            <span
                              className="flex items-center justify-center flex-shrink-0 rounded-xl"
                              style={{ width: 30, height: 30, background: 'rgba(27,56,40,0.08)', border: '1px solid rgba(27,56,40,0.14)' }}
                            >
                              <Send size={13} style={{ color: '#1B3828' }} />
                            </span>
                            <p className="font-semibold text-sm flex-1 truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                              {email.subject || '(No subject)'}
                            </p>
                            <span
                              className="flex-shrink-0 rounded-md px-2.5 py-0.5"
                              style={{ fontSize: 11, fontFamily: OUTFIT, fontWeight: 700, backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.dot}55` }}
                            >
                              {email.status.charAt(0).toUpperCase() + email.status.slice(1)}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5" style={{ fontSize: 12, color: SOFT, fontFamily: OUTFIT }}>
                            <span className="truncate" style={{ maxWidth: 340 }}>
                              {filterText}
                              {email.recipient_count > 0 ? ` · ${email.recipient_count} recipient${email.recipient_count === 1 ? '' : 's'}` : ''}
                            </span>
                            {split && split.delivered > 0 && <span style={{ color: GREEN_INK, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{split.delivered} delivered</span>}
                            {split && split.failed > 0 && <span style={{ color: RED, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{split.failed} failed</span>}
                            {split && split.pending > 0 && <span style={{ color: AMBER_INK, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{split.pending} sending</span>}
                            <span className="ml-auto flex-shrink-0">
                              {email.sent_at ? `Sent ${formatDate(email.sent_at)}` : `${formatDate(email.created_at)}`}
                            </span>
                          </div>

                          <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(27,56,40,0.09)' }}>
                            <div className="flex items-center gap-4">
                              {email.body_html && (
                                <button
                                  onClick={() => setHistoryExpandedId(isExpanded ? null : email.id)}
                                  className="text-xs font-bold focus:outline-none"
                                  style={{ color: '#1B3828', backgroundColor: 'transparent', border: 'none', fontFamily: OUTFIT, cursor: 'pointer', padding: '4px 0' }}
                                >
                                  {isExpanded ? 'HIDE' : 'VIEW'}
                                </button>
                              )}
                              <button
                                onClick={() => toggleRecipientsExpanded(email.id)}
                                className="text-xs font-bold focus:outline-none"
                                style={{ color: '#1B3828', backgroundColor: 'transparent', border: 'none', fontFamily: OUTFIT, cursor: 'pointer', padding: '4px 0' }}
                              >
                                {recipientsExpandedId === email.id ? 'HIDE RECIPIENTS' : 'RECIPIENTS'}
                              </button>
                            </div>

                            {isExpanded && email.body_html && (
                              isHtml ? (
                                <iframe
                                  srcDoc={email.body_html}
                                  sandbox="allow-same-origin"
                                  title="Sent email"
                                  style={{ width: '100%', height: 480, border: `1px solid ${BORDER}`, borderRadius: 8, backgroundColor: '#FFFFFF' }}
                                />
                              ) : (
                                <p
                                  className="text-sm leading-relaxed"
                                  style={{ color: '#1C1410', fontFamily: OUTFIT, whiteSpace: 'pre-wrap' }}
                                >
                                  {email.body_html}
                                </p>
                              )
                            )}

                            {recipientsExpandedId === email.id && (() => {
                              const detail = outboxBySend[email.id];
                              if (detail === 'loading') {
                                return <p className="text-xs" style={{ color: SOFT, fontFamily: OUTFIT }}>Loading…</p>;
                              }
                              if (!detail || detail.length === 0) {
                                return (
                                  <p className="text-xs" style={{ color: SOFT, fontFamily: OUTFIT }}>
                                    No per-recipient delivery data recorded for this send.
                                  </p>
                                );
                              }
                              return (
                                <div className="flex flex-col gap-1" style={{ maxHeight: 280, overflowY: 'auto' }}>
                                  {detail.map(r => renderRecipientRow(r))}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Design, inherited by every email ── */}
                <section className="mt-10" data-tutorial="comms-email-design">
                  <button
                    type="button"
                    onClick={() => setDesignOpen(v => !v)}
                    aria-expanded={designOpen}
                    className="flex items-center gap-2 focus:outline-none"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
                  >
                    <ChevronDown size={15} style={{ color: '#1C1410', transform: designOpen ? 'rotate(180deg)' : 'rotate(0)', transitionProperty: 'transform', transitionDuration: '200ms', transitionTimingFunction: EASE }} />
                    <p className="font-semibold text-base" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Design</p>
                  </button>
                  <p className="text-sm mt-0.5 mb-3" style={{ color: SOFT, fontFamily: OUTFIT, textWrap: 'pretty' }}>
                    How every email from this conference looks — header, colors, logo, and footer.
                  </p>
                  {designOpen && (
                    <div className="rounded-2xl p-5 flex flex-col md:flex-row gap-6" style={PANEL}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold mb-1.5" style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.06em' }}>
                          HEADER STYLE
                        </p>
                        <div className="flex gap-2 mb-4">
                          <SegButton active={themeDraft.headerStyle === 'banner'} onClick={() => patchTheme({ headerStyle: 'banner' })} icon={ImageIcon}>
                            BANNER IMAGE
                          </SegButton>
                          <SegButton active={themeDraft.headerStyle === 'solid'} onClick={() => patchTheme({ headerStyle: 'solid' })} icon={Palette}>
                            SOLID BAR
                          </SegButton>
                        </div>

                        <ColorField label="Accent color" value={themeDraft.accentColor} onChange={c => patchTheme({ accentColor: c })} palette={COLOR_PALETTE} />
                        <ColorField label="Button color" value={themeDraft.buttonColor} onChange={c => patchTheme({ buttonColor: c })} palette={BUTTON_COLOR_PALETTE} />

                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm font-semibold" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Show logo</span>
                          <PillToggle value={themeDraft.showLogo} onChange={() => patchTheme({ showLogo: !themeDraft.showLogo })} />
                        </div>

                        <p className="text-xs font-bold mb-1.5" style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.06em' }}>
                          CUSTOM FOOTER LINE
                        </p>
                        <input
                          value={themeDraft.footerLine}
                          onChange={e => patchTheme({ footerLine: e.target.value })}
                          placeholder="Optional, shown above the standard footer"
                          className="w-full rounded-xl px-3.5 py-2 text-sm focus:outline-none mb-2"
                          style={{ border: `1px solid ${BORDER}`, color: '#1C1410', backgroundColor: '#FFFFFF', fontFamily: OUTFIT }}
                        />

                        <p className="text-xs font-semibold" style={{ color: themeError ? RED : GREEN_INK, fontFamily: OUTFIT, minHeight: 16 }}>
                          {themeError || (themeSaving ? 'Saving…' : themeSaved ? 'Saved ✓' : '')}
                        </p>
                      </div>

                      <div className="flex-1 min-w-0 flex justify-center">
                        <iframe
                          srcDoc={designPreviewHtml}
                          sandbox="allow-same-origin"
                          title="Design preview"
                          style={{ width: '100%', maxWidth: 420, height: 460, border: `1px solid ${BORDER}`, borderRadius: 12, backgroundColor: '#FFFFFF' }}
                        />
                      </div>
                    </div>
                  )}
                </section>
              </section>
            </div>

            {/* ── Band 3 · Inbox — a permanent column on desktop ── */}
            <aside id="comms-inbox-panel" className={`${mobileTab === 'inbox' ? '' : 'hidden'} lg:block min-w-0 mt-8 lg:mt-0`}>
              <section className="rounded-2xl p-4" style={PANEL} data-tutorial="comms-inbox">
                {!selectedRequest ? (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-black text-lg" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Inbox</h2>
                      {inboxUnreadThreadCount > 0 && (
                        <span
                          className="inline-flex items-center justify-center"
                          style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999, backgroundColor: '#EED98A', color: '#1B3828', fontFamily: OUTFIT, fontSize: 11, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}
                        >
                          {inboxUnreadThreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mb-3" style={{ color: SOFT, fontFamily: OUTFIT, textWrap: 'pretty' }}>
                      Questions and swap requests from advisors, head delegates, and delegates.
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <input
                        value={inboxSearch}
                        onChange={e => setInboxSearch(e.target.value)}
                        placeholder="Search subjects..."
                        className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none"
                        style={{ border: CARD_BORDER, backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: OUTFIT, minWidth: 130 }}
                      />
                      {inboxVisibleUnreadCount > 0 && (
                        <button
                          onClick={handleMarkAllInboxRead}
                          disabled={markingAllRead}
                          className="focus:outline-none"
                          style={{
                            fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                            color: markingAllRead ? SOFT : '#1B3828',
                            background: 'none', border: 'none', cursor: markingAllRead ? 'default' : 'pointer', padding: '8px 2px',
                          }}
                        >
                          {markingAllRead ? 'MARKING…' : 'MARK ALL READ'}
                        </button>
                      )}
                      <FilterPopoverShell
                        title="Filter threads"
                        activeCount={inboxActiveFilterCount}
                        onClearAll={() => { setInboxStatusFilter(new Set()); setInboxKindFilter(new Set()); setInboxDateFrom(''); setInboxDateTo(''); }}
                      >
                        <FilterGroup
                          title="State" icon={BadgeCheck} options={INBOX_STATE_OPTIONS} selected={inboxStatusFilter}
                          onToggle={v => setInboxStatusFilter(s => toggleIn(s, v))}
                          onAll={() => setInboxStatusFilter(new Set(INBOX_STATE_OPTIONS.map(o => o.value)))}
                          onNone={() => setInboxStatusFilter(new Set())}
                        />
                        <FilterGroup
                          title="Kind" icon={MessageSquare} options={INBOX_KIND_OPTIONS} selected={inboxKindFilter}
                          onToggle={v => setInboxKindFilter(s => toggleIn(s, v))}
                          onAll={() => setInboxKindFilter(new Set(INBOX_KIND_OPTIONS.map(o => o.value)))}
                          onNone={() => setInboxKindFilter(new Set())}
                        />
                        <div>
                          <div className="mb-2">
                            <FilterHeading icon={CalendarDays}>Submitted between</FilterHeading>
                          </div>
                          <div className="flex items-center gap-2">
                            <div style={{ flex: 1 }}>
                              <DatePicker value={inboxDateFrom} max={inboxDateTo || undefined} onChange={setInboxDateFrom} placeholder="From" />
                            </div>
                            <ArrowRight size={13} style={{ color: SOFT, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <DatePicker value={inboxDateTo} min={inboxDateFrom || undefined} onChange={setInboxDateTo} placeholder="To" />
                            </div>
                          </div>
                        </div>
                      </FilterPopoverShell>
                    </div>

                    {filteredInboxRequests.length === 0 ? (
                      <p className="text-sm py-6 text-center" style={{ color: SOFT, fontFamily: OUTFIT }}>
                        No threads match these filters.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {pagedInboxRequests.map(r => {
                          const threadProfile = inboxProfiles.get(r.user_id);
                          const role = inboxRoles.get(r.user_id);
                          const last = lastMessageOf(r.id);
                          const unread = unreadCountOf(r);
                          const attention = unread > 0;
                          const kindChip = KIND_CHIP[r.kind] ?? KIND_CHIP.question;
                          const name = threadProfile?.display_name ?? 'Unknown';
                          return (
                            <button
                              key={r.id}
                              onClick={() => handleOpenThread(r.id)}
                              className="w-full flex items-start gap-2.5 rounded-xl p-3 text-left focus:outline-none active:scale-[0.99]"
                              style={{
                                backgroundColor: attention ? 'rgba(238,217,138,0.16)' : '#FAF8F3',
                                border: attention ? '1px solid rgba(182,135,31,0.45)' : '1px solid rgba(27,56,40,0.09)',
                                cursor: 'pointer',
                                transitionProperty: 'background-color, border-color, transform',
                                transitionDuration: '160ms', transitionTimingFunction: EASE,
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(27,56,40,0.35)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = attention ? 'rgba(182,135,31,0.45)' : 'rgba(27,56,40,0.09)'; }}
                            >
                              {threadProfile?.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={threadProfile.avatar_url} alt={name} className="rounded-full object-cover flex-shrink-0" style={{ width: 32, height: 32, outline: '1px solid rgba(0,0,0,0.1)', outlineOffset: -1 }} />
                              ) : (
                                <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 32, height: 32, backgroundColor: '#1B3828', color: '#EED98A', fontSize: 13, fontWeight: 700, fontFamily: OUTFIT }}>
                                  {name.charAt(0)}
                                </span>
                              )}
                              <span className="min-w-0 flex-1 block">
                                <span className="flex items-center gap-1.5">
                                  <span className="text-xs truncate" style={{ color: '#1C1410', fontFamily: OUTFIT, fontWeight: attention ? 800 : 600 }}>
                                    {name}
                                  </span>
                                  {role && (
                                    <span className="text-xs flex-shrink-0" style={{ color: SOFT, fontFamily: OUTFIT, fontSize: 10.5 }}>{roleLabel(role)}</span>
                                  )}
                                  {attention && (
                                    <span
                                      className="inline-flex items-center justify-center flex-shrink-0"
                                      style={{ minWidth: 17, height: 17, padding: '0 5px', borderRadius: 999, backgroundColor: '#EED98A', color: '#1B3828', fontFamily: OUTFIT, fontSize: 10, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}
                                    >
                                      {unread}
                                    </span>
                                  )}
                                  <span className="ml-auto flex-shrink-0" style={{ fontSize: 10.5, color: SOFT, fontFamily: OUTFIT }}>
                                    {formatDate(r.last_message_at)}
                                  </span>
                                </span>
                                <span className="block text-sm truncate mt-0.5" style={{ color: '#1C1410', fontFamily: OUTFIT, fontWeight: attention ? 700 : 500 }}>
                                  {r.subject}
                                </span>
                                <span className="flex items-center gap-1.5 mt-0.5">
                                  <span
                                    className="rounded-full px-1.5 py-0.5 flex-shrink-0"
                                    style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', fontFamily: OUTFIT, backgroundColor: kindChip.bg, color: kindChip.color }}
                                  >
                                    {kindChip.label}
                                  </span>
                                  {last && (
                                    <span className="text-xs truncate" style={{ color: SOFT, fontFamily: OUTFIT }}>
                                      {last.is_organizer ? 'You: ' : ''}{last.body}
                                    </span>
                                  )}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {filteredInboxRequests.length > INBOX_PAGE_SIZE && (
                      <div className="flex items-center justify-center gap-3 mt-4">
                        <button
                          onClick={() => setInboxPage(p => Math.max(1, p - 1))}
                          disabled={inboxPage <= 1}
                          aria-label="Previous page"
                          className="flex items-center justify-center rounded-full focus:outline-none"
                          style={{
                            width: 28, height: 28, border: CARD_BORDER,
                            backgroundColor: '#FAF8F3',
                            color: inboxPage <= 1 ? '#C8BEA8' : '#1C1410',
                            cursor: inboxPage <= 1 ? 'default' : 'pointer',
                          }}
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: SOFT, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                          PAGE {inboxPage} OF {inboxTotalPages}
                        </span>
                        <button
                          onClick={() => setInboxPage(p => Math.min(inboxTotalPages, p + 1))}
                          disabled={inboxPage >= inboxTotalPages}
                          aria-label="Next page"
                          className="flex items-center justify-center rounded-full focus:outline-none"
                          style={{
                            width: 28, height: 28, border: CARD_BORDER,
                            backgroundColor: '#FAF8F3',
                            color: inboxPage >= inboxTotalPages ? '#C8BEA8' : '#1C1410',
                            cursor: inboxPage >= inboxTotalPages ? 'default' : 'pointer',
                          }}
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setSelectedRequestId(null)}
                      className="text-xs font-bold mb-3 focus:outline-none"
                      style={{ color: SOFT, fontFamily: OUTFIT, letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = SOFT; }}
                    >
                      ← BACK TO INBOX
                    </button>

                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="rounded-full px-2 py-0.5 flex-shrink-0"
                            style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', fontFamily: OUTFIT, backgroundColor: selectedKindChip!.bg, color: selectedKindChip!.color }}
                          >
                            {selectedKindChip!.label}
                          </span>
                          <span
                            className="rounded-full px-2 py-0.5 flex-shrink-0"
                            style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', fontFamily: OUTFIT, backgroundColor: selectedRequest.status === 'open' ? 'rgba(61,122,82,0.13)' : 'rgba(154,138,120,0.16)', color: selectedRequest.status === 'open' ? GREEN_INK : '#6B5F52' }}
                          >
                            {selectedRequest.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="font-black text-base" style={{ color: '#1C1410', fontFamily: OUTFIT, textWrap: 'balance' }}>{selectedRequest.subject}</p>
                        {/* Thread author → their public MUN CV, so an organiser reading a
                            request can see who is asking. No `nested`: this header sits in a
                            plain div (the BACK control and the CLOSE/DELETE buttons are
                            siblings), so there is no ancestor onClick to swallow. */}
                        <p className="text-xs" style={{ color: SOFT, fontFamily: OUTFIT }}>
                          <ProfileLink
                            userId={selectedRequest.user_id}
                            name={inboxProfiles.get(selectedRequest.user_id)?.display_name}
                          >
                            {inboxProfiles.get(selectedRequest.user_id)?.display_name ?? 'Unknown'}
                          </ProfileLink>
                          {inboxRoles.get(selectedRequest.user_id) ? ` · ${roleLabel(inboxRoles.get(selectedRequest.user_id)!)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <GhostBtn onClick={() => (selectedRequest.status === 'open' ? setCloseConfirmOpen(true) : handleCloseReopen(false))}>
                          {selectedRequest.status === 'open' ? 'CLOSE' : 'REOPEN'}
                        </GhostBtn>
                        <GhostBtn onClick={handleDeleteThread} title="Delete this thread" danger disabled={deletingThread}>
                          <Trash2 size={13} />
                        </GhostBtn>
                      </div>
                    </div>

                    {/* Swap details */}
                    {(selectedRequest.kind === 'swap_request' || selectedRequest.kind === 'swap_notice') && (
                      <div className="rounded-xl p-3.5 mt-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid rgba(27,56,40,0.09)' }}>
                        <p className="text-xs font-bold mb-1.5" style={{ color: AMBER_INK, fontFamily: OUTFIT, letterSpacing: '0.08em' }}>
                          SWAP DETAILS
                        </p>
                        <p className="text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                          {selectedRequest.metadata.member_a ?? 'Member A'}: {selectedRequest.metadata.before?.a ?? '—'} → {selectedRequest.metadata.after?.a ?? '—'}
                        </p>
                        <p className="text-sm mt-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                          {selectedRequest.metadata.member_b ?? 'Member B'}: {selectedRequest.metadata.before?.b ?? '—'} → {selectedRequest.metadata.after?.b ?? '—'}
                        </p>
                        {swapError && (
                          <p className="text-xs mt-3" style={{ color: RED, fontFamily: OUTFIT }}>{swapError}</p>
                        )}
                        {selectedRequest.kind === 'swap_request' && selectedRequest.status === 'open' && (
                          <div className="flex gap-2 mt-3">
                            <GhostBtn onClick={() => handleSwapDecision(false)} danger disabled={swapActing}>
                              DECLINE
                            </GhostBtn>
                            <button
                              onClick={() => handleSwapDecision(true)}
                              disabled={swapActing}
                              className="rounded-lg py-2 px-4 text-xs font-bold focus:outline-none active:scale-[0.96]"
                              style={{
                                backgroundColor: swapActing ? '#DDD4C0' : '#1B3828',
                                color: swapActing ? SOFT : '#EED98A',
                                border: 'none', fontFamily: OUTFIT, letterSpacing: '0.05em',
                                cursor: swapActing ? 'default' : 'pointer',
                                transitionProperty: 'transform', transitionDuration: '160ms', transitionTimingFunction: EASE,
                              }}
                            >
                              {swapActing ? 'PROCESSING...' : 'APPROVE'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Messages */}
                    <div className="flex flex-col gap-3 mt-4" style={{ maxHeight: 440, overflowY: 'auto' }}>
                      {selectedMessages.map(m => {
                        const mine = m.is_organizer;
                        const senderName = mine ? 'You' : (inboxProfiles.get(m.sender_user_id)?.display_name ?? 'Participant');
                        return (
                          <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                            {/* Sender label → that participant's public MUN CV. Only for
                                incoming messages: `mine` renders as "You" with no user to
                                link to. No `nested` — the message column is a plain div with
                                no click handler of its own. */}
                            {!mine && (
                              <span className="mb-1" style={{ fontSize: 10, fontWeight: 700, color: AMBER_INK, fontFamily: OUTFIT, letterSpacing: '0.06em' }}>
                                <ProfileLink userId={m.sender_user_id} name={senderName}>
                                  {senderName.toUpperCase()}
                                </ProfileLink>
                              </span>
                            )}
                            <div
                              className="rounded-2xl px-4 py-2.5"
                              style={{ maxWidth: '85%', backgroundColor: mine ? '#1B3828' : '#FAF8F3', border: mine ? 'none' : '1px solid rgba(27,56,40,0.09)', color: mine ? '#EED98A' : '#1C1410' }}
                            >
                              <p className="text-sm" style={{ fontFamily: OUTFIT, whiteSpace: 'pre-wrap', lineHeight: 1.55, margin: 0 }}>{m.body}</p>
                            </div>
                            <span className="mt-1" style={{ fontSize: 10, color: SOFT, fontFamily: OUTFIT }}>
                              {formatDate(m.created_at)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Reply */}
                    {selectedRequest.status === 'open' && (
                      <div className="flex gap-2 mt-4">
                        <input
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleInboxReply(); }}
                          placeholder="Write a reply..."
                          className="flex-1 min-w-0 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
                          style={{ border: CARD_BORDER, backgroundColor: '#FFFFFF', color: '#1C1410', fontFamily: OUTFIT }}
                        />
                        <button
                          onClick={handleInboxReply}
                          disabled={!replyText.trim()}
                          className="rounded-xl px-4 text-xs font-bold focus:outline-none flex-shrink-0 active:scale-[0.96]"
                          style={{
                            backgroundColor: !replyText.trim() ? '#DDD4C0' : '#1B3828',
                            color: !replyText.trim() ? SOFT : '#EED98A',
                            border: 'none', fontFamily: OUTFIT, letterSpacing: '0.05em',
                            cursor: !replyText.trim() ? 'default' : 'pointer', minHeight: 40,
                            transitionProperty: 'transform, background-color', transitionDuration: '160ms', transitionTimingFunction: EASE,
                          }}
                        >
                          SEND
                        </button>
                      </div>
                    )}
                    {replyError && (
                      <p className="text-xs mt-2" style={{ color: RED, fontFamily: OUTFIT }}>{replyError}</p>
                    )}

                    {closeConfirmOpen && (
                      <ConfirmModal
                        title="Close this thread?"
                        body="The participant will see it as closed. You can reopen it later."
                        confirmLabel="Close Thread"
                        danger
                        onConfirm={() => handleCloseReopen(true)}
                        onCancel={() => setCloseConfirmOpen(false)}
                      />
                    )}
                  </>
                )}
              </section>
            </aside>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          BUILDER
      ════════════════════════════════════════════════════════════════════════ */}
      {builderOpen && (
        <div>
          {builderError && (
            <div
              className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4 text-sm"
              style={{ backgroundColor: 'rgba(182,135,31,0.08)', border: '1px solid rgba(182,135,31,0.2)', color: AMBER_INK, fontFamily: OUTFIT }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              {builderError}
            </div>
          )}

          {/* Event templates share this builder but have NO audience step —
              their audience is fixed by the event. About + the delivery radio
              ride above the editor instead of in a sidebar. */}
          {builderEventKey !== null && (
            <div className="rounded-2xl p-5 mb-5 flex flex-col md:flex-row md:items-start gap-6" style={PANEL}>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                  About this notification
                </p>
                <p className="text-xs leading-relaxed" style={{ color: SOFT, fontFamily: OUTFIT, maxWidth: 620, textWrap: 'pretty' }}>
                  {eventDef?.description}
                </p>
                <p className="text-xs mt-2" style={{ color: AMBER_INK, fontFamily: OUTFIT, textWrap: 'pretty' }}>
                  Its audience is fixed by the event — turn it on from Automatic emails once you&apos;re happy with the draft.
                </p>
              </div>
              <div className="flex-shrink-0" style={{ minWidth: 220 }}>
                <p className="font-semibold text-sm mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                  Delivery
                </p>
                <div className="flex flex-col gap-1">
                  {(['immediate', 'manual'] as const).map(d => (
                    <div
                      key={d}
                      onClick={() => setBuilderDelivery(d)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
                      style={{
                        backgroundColor: builderDelivery === d ? 'rgba(27,56,40,0.06)' : 'transparent',
                        border: builderDelivery === d ? '1px solid rgba(27,56,40,0.15)' : '1px solid transparent',
                      }}
                    >
                      <div
                        className="flex-shrink-0 flex items-center justify-center rounded-full"
                        style={{
                          width: 16, height: 16,
                          border: builderDelivery === d ? 'none' : '1.5px solid #DDD4C0',
                          backgroundColor: builderDelivery === d ? '#1B3828' : 'transparent',
                        }}
                      >
                        {builderDelivery === d && <div className="rounded-full" style={{ width: 6, height: 6, backgroundColor: 'white' }} />}
                      </div>
                      <span className="text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                        {d === 'immediate' ? 'Send automatically' : 'Manual trigger only'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {builderEventKey === null && (
            <div className="mb-4">
              <label className="block font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                Name
              </label>
              <input
                type="text"
                value={builderName}
                onChange={e => setBuilderName(e.target.value)}
                placeholder="e.g. Welcome pack reminder"
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ border: `1px solid ${BORDER}`, color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: OUTFIT, maxWidth: 560 }}
              />
            </div>
          )}

          <EmailComposer
              key={builderTemplateId ?? builderEventKey ?? 'new-adhoc'}
              conference={conference}
              conferenceId={conference.id}
              initialSubject={builderSubject}
              initialBlocks={builderBlocks}
              previewCandidates={previewCandidates}
              onChange={handleComposerChange}
              testSendContext={testSendContext}
              accessToken={session?.access_token ?? null}
              organizerEmail={profile?.email ?? null}
            />

          {/* ── The "who" step — an explicit panel, not a buried sidebar ── */}
          {builderEventKey === null && (
            <section className="mt-8">
              <div className="rounded-2xl p-5" style={PANEL}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                  <h3 className="font-black text-base" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                    Who gets it
                  </h3>
                  <p
                    className="text-xs font-bold"
                    style={{ color: finalRecipients.length === 0 ? AMBER_INK : GREEN_INK, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}
                  >
                    Sending to {finalRecipients.length}
                  </p>
                  {optedOutCount > 0 && (
                    <p className="text-xs" style={{ color: AMBER_INK, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                      {optedOutCount} opted out of marketing emails — excluded automatically.
                    </p>
                  )}
                  {audienceRestored && (
                    <span className="ml-auto flex items-center gap-2">
                      <span style={{ fontSize: 10.5, color: SOFT, fontFamily: OUTFIT, fontWeight: 600 }}>
                        Saved audience loaded
                      </span>
                      <button
                        type="button"
                        onClick={resetAudience}
                        className="text-xs font-bold focus:outline-none"
                        style={{ color: '#1B3828', backgroundColor: 'transparent', border: 'none', fontFamily: OUTFIT, cursor: 'pointer', padding: '6px 0' }}
                      >
                        CLEAR
                      </button>
                    </span>
                  )}
                </div>
                <p className="text-xs mb-4" style={{ color: SOFT, fontFamily: OUTFIT, textWrap: 'pretty' }}>
                  No filters means everyone. Each count shows who that chip reaches with your other
                  filters applied.
                </p>

                <div className="lg:grid lg:items-start lg:gap-8" style={{ gridTemplateColumns: 'minmax(0,5fr) minmax(0,7fr)' }}>
                  {/* Filters */}
                  <div>
                    <MultiChipGroup label="Roles" options={ROLE_OPTIONS} selected={selRoles} onToggle={v => setSelRoles(s => toggleInSet(s, v))} counts={countsFor('roles', ROLE_OPTIONS)} />
                    <MultiChipGroup label="Payment status" options={PAYMENT_OPTIONS} selected={selPayment} onToggle={v => setSelPayment(s => toggleInSet(s, v))} counts={countsFor('payment', PAYMENT_OPTIONS)} />
                    {committeeOptions.length > 0 && (
                      <MultiChipGroup label="Committees" options={committeeOptions} selected={selCommittees} onToggle={v => setSelCommittees(s => toggleInSet(s, v))} counts={countsFor('committees', committeeOptions)} maxHeight={140} />
                    )}
                    <MultiChipGroup label="Delegations" options={delegationOptions} selected={selDelegations} onToggle={v => setSelDelegations(s => toggleInSet(s, v))} counts={countsFor('delegations', delegationOptions)} maxHeight={140} />
                    <MultiChipGroup label="Attendance" options={ATTENDANCE_OPTIONS} selected={selAttendance} onToggle={v => setSelAttendance(s => toggleInSet(s, v))} counts={countsFor('attendance', ATTENDANCE_OPTIONS)} />
                    <MultiChipGroup label="Application status" options={APP_STATUS_OPTIONS} selected={selStatus} onToggle={v => setSelStatus(s => toggleInSet(s, v))} counts={countsFor('status', APP_STATUS_OPTIONS)} />
                    <MultiChipGroup label="Financial aid" options={AID_OPTIONS} selected={selAid} onToggle={v => setSelAid(s => toggleInSet(s, v))} counts={countsFor('aid', AID_OPTIONS)} />
                  </div>

                  {/* Recipients, grouped */}
                  <div className="mt-4 lg:mt-0">
                    <div className="relative mb-2">
                      <input
                        value={manualSearch}
                        onChange={e => setManualSearch(e.target.value)}
                        placeholder="Add anyone by name or email..."
                        className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                        style={{ border: `1px solid ${BORDER}`, color: '#1C1410', backgroundColor: '#FFFFFF', fontFamily: OUTFIT, minHeight: 36 }}
                      />
                      {manualMatches.length > 0 && (
                        <div
                          className="absolute left-0 right-0 rounded-xl shadow-lg overflow-y-auto"
                          style={{ top: 'calc(100% + 4px)', maxHeight: 200, backgroundColor: '#FFFFFF', border: `1px solid ${BORDER}`, zIndex: 10 }}
                        >
                          {manualMatches.map(a => (
                            <button
                              key={a.id}
                              onClick={() => {
                                setManuallyAddedIds(prev => new Set(prev).add(a.id));
                                setManualSearch('');
                              }}
                              className="w-full text-left px-3 py-2 text-xs focus:outline-none"
                              style={{ color: '#1C1410', fontFamily: OUTFIT }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                            >
                              {a.profiles?.display_name ?? a.invited_name ?? 'Unknown'}
                              <span style={{ color: SOFT }}> · {a.profiles?.email ?? a.invited_email ?? '—'}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5" style={{ maxHeight: 440, overflowY: 'auto' }}>
                      {recipientGroups.length === 0 && (
                        <p className="text-xs py-2" style={{ color: SOFT, fontFamily: OUTFIT }}>
                          No recipients match yet. Adjust filters or add someone manually.
                        </p>
                      )}
                      {recipientGroups.map(g => {
                        const open = expandedGroups.has(g.key);
                        return (
                          <div key={g.key} className="rounded-xl" style={{ backgroundColor: '#FAF8F3', border: '1px solid rgba(27,56,40,0.09)' }}>
                            <button
                              type="button"
                              onClick={() => setExpandedGroups(s => toggleInSet(s, g.key))}
                              aria-expanded={open}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-left focus:outline-none"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', minHeight: 40 }}
                            >
                              <ChevronDown
                                size={13}
                                className="flex-shrink-0"
                                style={{ color: SOFT, transform: open ? 'rotate(180deg)' : 'rotate(0)', transitionProperty: 'transform', transitionDuration: '200ms', transitionTimingFunction: EASE }}
                              />
                              <span className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                                {g.label}
                              </span>
                              <span className="text-xs flex-shrink-0" style={{ color: SOFT, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                                — {g.members.length}
                              </span>
                              {g.optedOut > 0 && (
                                <span className="text-xs flex-shrink-0" style={{ color: AMBER_INK, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                                  · {g.optedOut} opted out
                                </span>
                              )}
                            </button>
                            {open && (
                              <div className="flex flex-col gap-1 px-2.5 pb-2.5">
                                {g.members.map(a => {
                                  const optedOut = a.profiles?.notify_email_marketing === false;
                                  const name = a.profiles?.display_name ?? a.invited_name ?? 'Unknown';
                                  const detail = [
                                    roleLabel(a.role),
                                    a.assigned_committee ? (a.assigned_committee.abbreviation ?? a.assigned_committee.name) : null,
                                    a.assigned_country_name,
                                  ].filter(Boolean).join(' · ');
                                  return (
                                    <div
                                      key={a.id}
                                      className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5"
                                      style={{ backgroundColor: '#FFFFFF', border: '1px solid #F0EDE6' }}
                                      title={a.profiles?.email ?? a.invited_email ?? undefined}
                                    >
                                      <ProfileLink userId={a.user_id} name={name}>
                                        <span className="flex items-center gap-2 min-w-0">
                                          {a.profiles?.avatar_url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                              src={a.profiles.avatar_url}
                                              alt=""
                                              className="rounded-full object-cover flex-shrink-0"
                                              style={{ width: 24, height: 24, outline: '1px solid rgba(0,0,0,0.1)', outlineOffset: -1 }}
                                            />
                                          ) : (
                                            <span
                                              className="flex items-center justify-center rounded-full flex-shrink-0"
                                              style={{ width: 24, height: 24, backgroundColor: 'rgba(27,56,40,0.1)', color: '#1B3828', fontSize: 11, fontWeight: 700, fontFamily: OUTFIT }}
                                            >
                                              {name.charAt(0).toUpperCase()}
                                            </span>
                                          )}
                                          <span className="min-w-0">
                                            <span className="block text-xs font-semibold truncate" style={{ color: optedOut ? SOFT : '#1C1410', fontFamily: OUTFIT }}>
                                              {name}
                                              {!a.profiles && (
                                                <span className="ml-1.5 rounded px-1.5 py-0.5" style={{ fontSize: 9, fontWeight: 700, backgroundColor: 'rgba(154,138,120,0.14)', color: SOFT }}>
                                                  NOT REGISTERED
                                                </span>
                                              )}
                                              {manuallyAddedIds.has(a.id) && (
                                                <span className="ml-1.5 rounded px-1.5 py-0.5" style={{ fontSize: 9, fontWeight: 700, backgroundColor: 'rgba(182,135,31,0.14)', color: AMBER_INK }}>
                                                  MANUAL
                                                </span>
                                              )}
                                            </span>
                                            <span className="block truncate" style={{ fontSize: 10.5, color: SOFT, fontFamily: OUTFIT }}>
                                              {detail || (a.profiles?.email ?? a.invited_email ?? '—')}
                                            </span>
                                          </span>
                                        </span>
                                      </ProfileLink>
                                      {optedOut ? (
                                        <span
                                          className="flex-shrink-0 rounded-md px-1.5 py-0.5"
                                          style={{ fontSize: 9, fontWeight: 700, fontFamily: OUTFIT, backgroundColor: 'rgba(182,135,31,0.12)', color: AMBER_INK, border: '1px solid rgba(182,135,31,0.3)' }}
                                        >
                                          OPTED OUT
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => handleExcludeRecipient(a.id)}
                                          title={manuallyAddedIds.has(a.id) ? 'Remove manual add' : 'Exclude from this send'}
                                          className="flex-shrink-0 rounded-md p-1 focus:outline-none"
                                          style={{ border: '1px solid rgba(139,32,32,0.25)', backgroundColor: 'transparent', cursor: 'pointer' }}
                                        >
                                          <X size={11} style={{ color: RED }} />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4" style={{ borderTop: '1px solid rgba(27,56,40,0.09)' }}>
                  <p className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: '#1C1410', fontFamily: OUTFIT, maxWidth: 480, textWrap: 'pretty' }}>
                    <AlertTriangle size={14} style={{ color: AMBER_INK, flexShrink: 0, marginTop: 1 }} />
                    Sending queues one email per recipient and starts delivery immediately. Large
                    sends may take a few minutes to fully drain.
                  </p>
                  <PrimaryBtn
                    icon={Send}
                    onClick={handleOpenSendConfirm}
                    disabled={sending || openingSend || finalRecipients.length === 0}
                  >
                    {sending ? 'QUEUEING...' : openingSend ? 'SAVING...' : `SEND TO ${finalRecipients.length}`}
                  </PrimaryBtn>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Send confirmation */}
      {sendConfirmOpen && (
        <ConfirmModal
          title="Send this email?"
          body={
            <div className="flex flex-col gap-2">
              <p><strong>{builderName || eventDef?.label || '(untitled)'}</strong></p>
              <p>{finalRecipients.length} recipient{finalRecipients.length !== 1 ? 's' : ''}{namesPreview ? `: ${namesPreview}${finalRecipients.length > 5 ? `, +${finalRecipients.length - 5} more` : ''}` : ''}</p>
              {requireTypedConfirm && (
                <div className="mt-1">
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#1C1410' }}>
                    Type SEND to confirm sending to {finalRecipients.length} people
                  </label>
                  <input
                    autoFocus
                    value={sendConfirmText}
                    onChange={e => setSendConfirmText(e.target.value)}
                    placeholder="SEND"
                    className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                    style={{ border: `1px solid ${BORDER}`, color: '#1C1410', backgroundColor: '#FFFFFF', fontFamily: OUTFIT }}
                  />
                </div>
              )}
            </div>
          }
          confirmLabel={sending ? 'Sending' : 'Send'}
          cancelLabel="Cancel"
          loading={sending}
          confirmDisabled={confirmDisabled}
          onConfirm={handleConfirmSend}
          onCancel={() => { if (!sending) setSendConfirmOpen(false); }}
        />
      )}
      {deleteConfirmModal}
      {previewDefaultKey && (
        <DefaultEmailPreviewModal
          eventKey={previewDefaultKey}
          eventLabel={getEventLabel(previewDefaultKey)}
          conference={conference}
          conferenceId={conference.id}
          previewCandidates={previewCandidates}
          accessToken={session?.access_token ?? null}
          organizerEmail={profile?.email ?? null}
          testSendContext={testSendContext}
          onClose={() => setPreviewDefaultKey(null)}
        />
      )}

      {tourOpen && !builderOpen && (
        <GuidedWalkthrough
          steps={tourSteps}
          onClose={closeTour}
          label="Explore emails walkthrough"
        />
      )}
    </div>
  );
}

export default function CommunicationsPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 md:px-10 py-8 flex justify-center">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      }
    >
      <CommunicationsPageInner />
    </Suspense>
  );
}
