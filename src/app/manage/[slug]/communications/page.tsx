'use client';

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, AlertTriangle, Send, Bell, Inbox, Copy, X } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  resolveTokens, EMAIL_TOKEN_KEYS, EMAIL_TOKEN_LABELS,
  type EmailTokenContext, type EmailTokenKey,
} from '@/lib/emailTokens';
import { EVENT_REGISTRY, type EventDef } from '@/lib/emailEvents';
import { type EmailBlock, normalizeBlocks, flattenBlocksToPlainText } from '@/lib/emailBlocks';
import { renderEmailHtml } from '@/lib/emailHtml';
import { triggerEmailDelivery } from '@/lib/emailDelivery';
import EmailComposer, { type PreviewCandidate } from '@/components/EmailComposer';
import { formatFee } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

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
}

interface AppRow {
  id: string;
  role: string;
  status: string;
  payment_status: string | null;
  attending: boolean;
  is_independent: boolean;
  society_id: string | null;
  societies: { name: string } | null;
  assigned_committee_id: string | null;
  assigned_committee: { abbreviation: string | null; name: string } | null;
  assigned_country_name: string | null;
  profiles: { display_name: string; email: string | null } | null;
}

interface Committee {
  id: string;
  name: string;
  abbreviation: string | null;
}

interface Society {
  id: string;
  name: string;
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
}

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

// ── Helpers ───────────────────────────────────────────────────────────────────

const OUTFIT = "'Outfit', sans-serif";
const CARD_SHADOW = '0 2px 8px rgba(27,56,40,0.05), 0 12px 32px rgba(27,56,40,0.06)';
const BORDER = '#DDD4C0';
const CARD_STYLE = { backgroundColor: '#FAF8F3', border: `1.5px solid #D8CDB6`, boxShadow: CARD_SHADOW };

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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

const STATUS_COLORS: Record<string, { dot: string; text: string; bg: string }> = {
  sent:      { dot: '#3D7A52', text: '#3D7A52', bg: 'rgba(61,122,82,0.1)' },
  scheduled: { dot: '#B6871F', text: '#B6871F', bg: 'rgba(182,135,31,0.1)' },
  draft:     { dot: '#DDD4C0', text: '#9A8A78', bg: 'rgba(154,138,120,0.1)' },
  failed:    { dot: '#8B2020', text: '#8B2020', bg: 'rgba(139,32,32,0.1)' },
  pending:   { dot: '#B6871F', text: '#B6871F', bg: 'rgba(182,135,31,0.1)' },
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
        color: active ? '#EED98A' : '#9A8A78',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function MultiChipGroup({
  label, options, selected, onToggle,
}: {
  label: string; options: { value: string; label: string }[]; selected: Set<string>; onToggle: (v: string) => void;
}) {
  return (
    <div className="mb-3">
      <p className="text-xs font-bold mb-1.5" style={{ color: '#9A8A78', fontFamily: OUTFIT, letterSpacing: '0.06em' }}>
        {label.toUpperCase()}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => {
          const active = selected.has(o.value);
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
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── CommunicationsPage ────────────────────────────────────────────────────────

function CommunicationsPageInner() {
  const { conference } = useManage();
  const { user, session, profile } = useAuth();
  const searchParams = useSearchParams();

  // ── Data state ──
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [applications, setApplications] = useState<AppRow[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [societies, setSocieties] = useState<Society[]>([]);
  const [emailSends, setEmailSends] = useState<EmailSend[]>([]);
  const [outboxPending, setOutboxPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  // ── View state ──
  const [activeTab, setActiveTab] = useState<'emails' | 'notifications'>('emails');
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [historyExpandedId, setHistoryExpandedId] = useState<string | null>(null);
  const [recipientsExpandedId, setRecipientsExpandedId] = useState<string | null>(null);
  const [outboxBySend, setOutboxBySend] = useState<Record<string, OutboxDetailRow[] | 'loading'>>({});

  // ── Builder state ──
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderEventKey, setBuilderEventKey] = useState<string | null>(null);
  const [builderTemplateId, setBuilderTemplateId] = useState<string | null>(null);
  const [builderName, setBuilderName] = useState('');
  const [builderSubject, setBuilderSubject] = useState('');
  const [builderBlocks, setBuilderBlocks] = useState<EmailBlock[]>([]);
  const [builderDelivery, setBuilderDelivery] = useState<'immediate' | 'manual'>('manual');
  const [builderLifecycle, setBuilderLifecycle] = useState<'draft' | 'ready'>('draft');
  const [builderError, setBuilderError] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [sending, setSending] = useState(false);

  // ── Audience state (ad-hoc only) ──
  const [selRoles, setSelRoles] = useState<Set<string>>(new Set());
  const [selPayment, setSelPayment] = useState<Set<string>>(new Set());
  const [selDelegations, setSelDelegations] = useState<Set<string>>(new Set());
  const [selAttendance, setSelAttendance] = useState<Set<string>>(new Set());
  const [selStatus, setSelStatus] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [manuallyAddedIds, setManuallyAddedIds] = useState<Set<string>>(new Set());
  const [manualSearch, setManualSearch] = useState('');

  // ── Send confirmation ──
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [sendConfirmText, setSendConfirmText] = useState('');

  const builderJustOpenedRef = useRef(false);

  function showFlash(kind: 'ok' | 'err', msg: string) {
    setFlash({ kind, msg });
    setTimeout(() => setFlash(f => (f?.msg === msg ? null : f)), 4500);
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('email_templates')
      .select('id, conference_id, event_key, name, subject, body, body_blocks, enabled, delivery, lifecycle, updated_at')
      .eq('conference_id', conference.id);
    setTemplates((data ?? []) as EmailTemplate[]);
  }, [conference, session?.access_token]);

  const loadApplications = useCallback(async () => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('applications')
      .select(`
        id, role, status, payment_status, attending, is_independent, society_id,
        societies (name),
        assigned_committee_id,
        assigned_committee:conference_committees!assigned_committee_id (abbreviation, name),
        assigned_country_name,
        profiles (display_name, email)
      `)
      .eq('conference_id', conference.id);
    setApplications((data ?? []) as unknown as AppRow[]);
  }, [conference, session?.access_token]);

  const loadCommittees = useCallback(async () => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('conference_committees')
      .select('id, name, abbreviation')
      .eq('conference_id', conference.id)
      .order('name', { ascending: true });
    setCommittees((data ?? []) as Committee[]);
  }, [conference, session?.access_token]);

  const loadSocieties = useCallback(async () => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('societies')
      .select('id, name')
      .eq('conference_id', conference.id)
      .order('name', { ascending: true });
    setSocieties((data ?? []) as Society[]);
  }, [conference, session?.access_token]);

  const loadEmailSends = useCallback(async () => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('email_sends')
      .select('id, subject, recipient_filter, recipient_count, scheduled_at, sent_at, status, created_at, body_html')
      .eq('conference_id', conference.id)
      .order('created_at', { ascending: false });
    setEmailSends((data ?? []) as unknown as EmailSend[]);
  }, [conference, session?.access_token]);

  const loadOutboxPending = useCallback(async () => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { count } = await supabase
      .from('email_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('conference_id', conference.id)
      .eq('status', 'pending');
    setOutboxPending(count ?? 0);
  }, [conference, session?.access_token]);

  useEffect(() => {
    if (!conference) return;
    setLoading(true);
    Promise.all([loadTemplates(), loadApplications(), loadCommittees(), loadSocieties(), loadEmailSends(), loadOutboxPending()])
      .finally(() => setLoading(false));
  }, [conference, loadTemplates, loadApplications, loadCommittees, loadSocieties, loadEmailSends, loadOutboxPending]);

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
    });
  }, [conference, session, loadOutboxPending, loadEmailSends]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const templatesByEvent = useMemo(() => {
    const map = new Map<string, EmailTemplate>();
    for (const t of templates) if (t.event_key) map.set(t.event_key, t);
    return map;
  }, [templates]);

  const adhocTemplates = useMemo(
    () => templates.filter(t => !t.event_key).sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [templates]
  );
  const draftTemplates = useMemo(() => adhocTemplates.filter(t => (t.lifecycle ?? 'draft') !== 'ready'), [adhocTemplates]);
  const readyTemplates = useMemo(() => adhocTemplates.filter(t => t.lifecycle === 'ready'), [adhocTemplates]);

  const eligibleApplications = useMemo(
    () => applications.filter(a => a.status !== 'rejected' && a.status !== 'withdrawn'),
    [applications]
  );

  const delegationOptions = useMemo(
    () => [...societies.map(s => ({ value: s.id, label: s.name })), { value: INDEPENDENT_KEY, label: 'Independents' }],
    [societies]
  );

  function matchesAudienceFilters(a: AppRow): boolean {
    if (selRoles.size > 0 && !selRoles.has(a.role)) return false;
    if (selPayment.size > 0) {
      const ok = [...selPayment].some(p => {
        if (p === 'paid') return a.payment_status === 'paid' || a.payment_status === 'waived';
        if (p === 'unpaid') return a.payment_status === 'unpaid';
        if (p === 'waived') return a.payment_status === 'waived';
        return false;
      });
      if (!ok) return false;
    }
    if (selDelegations.size > 0) {
      const wantsIndependent = selDelegations.has(INDEPENDENT_KEY);
      const societyIds = [...selDelegations].filter(id => id !== INDEPENDENT_KEY);
      const ok = (wantsIndependent && a.is_independent) || (a.society_id != null && societyIds.includes(a.society_id));
      if (!ok) return false;
    }
    if (selAttendance.size > 0) {
      const ok = [...selAttendance].some(v => (v === 'attending' ? a.attending !== false : a.attending === false));
      if (!ok) return false;
    }
    if (selStatus.size > 0 && !selStatus.has(a.status)) return false;
    return true;
  }

  const filterMatched = useMemo(
    () => eligibleApplications.filter(matchesAudienceFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eligibleApplications, selRoles, selPayment, selDelegations, selAttendance, selStatus]
  );

  const finalRecipients = useMemo(() => {
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

  const manualMatches = useMemo(() => {
    if (!manualSearch.trim()) return [];
    const q = manualSearch.trim().toLowerCase();
    const alreadyIn = new Set(finalRecipients.map(a => a.id));
    return applications
      .filter(a => !alreadyIn.has(a.id) && (
        (a.profiles?.display_name ?? '').toLowerCase().includes(q) ||
        (a.profiles?.email ?? '').toLowerCase().includes(q)
      ))
      .slice(0, 8);
  }, [applications, manualSearch, finalRecipients]);

  function buildContext(app: AppRow): EmailTokenContext {
    if (!conference) return {};
    return {
      delegate_name: app.profiles?.display_name ?? null,
      role: roleLabel(app.role),
      delegation_name: app.societies?.name ?? (app.is_independent ? 'Independent' : null),
      committee: app.assigned_committee?.abbreviation ?? app.assigned_committee?.name ?? null,
      country: app.assigned_country_name ?? null,
      payment_status: paymentStatusLabel(app.payment_status),
      conference_name: conference.full_name,
      conference_dates: formatDateRange(conference.start_date, conference.end_date),
      fee: conference.fee_amount ? formatFee(conference.fee_amount, conference.fee_currency) : null,
    };
  }

  const previewCandidates: PreviewCandidate[] = useMemo(
    () => applications.map(a => ({ id: a.id, label: a.profiles?.display_name ?? 'Unknown', ctx: buildContext(a) })),
    [applications, conference] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Sample context for "Send test to me": organizer-derived values where we
  // have them (name, conference details), `[Label]` placeholders for tokens
  // that only make sense against a real applicant (role, committee, etc).
  const testSendContext: EmailTokenContext = useMemo(() => {
    if (!conference) return {};
    const known: Partial<Record<EmailTokenKey, string | null>> = {
      delegate_name: profile?.display_name ?? null,
      conference_name: conference.full_name,
      conference_dates: formatDateRange(conference.start_date, conference.end_date),
      fee: conference.fee_amount ? formatFee(conference.fee_amount, conference.fee_currency) : null,
    };
    const ctx: EmailTokenContext = {};
    for (const key of EMAIL_TOKEN_KEYS) {
      const v = known[key];
      ctx[key] = v && v.trim() ? v : `[${EMAIL_TOKEN_LABELS[key]}]`;
    }
    return ctx;
  }, [conference, profile]);

  function buildRecipientFilterPayload() {
    return {
      roles: [...selRoles],
      paymentStatuses: [...selPayment],
      delegationIds: [...selDelegations].filter(id => id !== INDEPENDENT_KEY),
      includeIndependents: selDelegations.has(INDEPENDENT_KEY),
      attendance: [...selAttendance],
      applicationStatuses: [...selStatus],
      manualCount: manuallyAddedIds.size,
      excludedCount: excludedIds.size,
    };
  }

  // ── Builder open/close ────────────────────────────────────────────────────

  function resetAudience() {
    setSelRoles(new Set());
    setSelPayment(new Set());
    setSelDelegations(new Set());
    setSelAttendance(new Set());
    setSelStatus(new Set());
    setExcludedIds(new Set());
    setManuallyAddedIds(new Set());
    setManualSearch('');
  }

  const openBuilderForEvent = useCallback((ev: EventDef) => {
    const existing = templatesByEvent.get(ev.key);
    setBuilderEventKey(ev.key);
    setBuilderTemplateId(existing?.id ?? null);
    setBuilderName(ev.label);
    setBuilderSubject(existing?.subject ?? '');
    setBuilderBlocks(normalizeBlocks(existing?.body_blocks, existing?.body ?? ''));
    setBuilderDelivery(existing?.delivery ?? ev.defaultDelivery);
    setBuilderLifecycle(existing?.lifecycle ?? 'draft');
    resetAudience();
    setBuilderError('');
    builderJustOpenedRef.current = true;
    setBuilderOpen(true);
  }, [templatesByEvent]);

  function openBuilderForAdHoc(template?: EmailTemplate) {
    setBuilderEventKey(null);
    setBuilderTemplateId(template?.id ?? null);
    setBuilderName(template?.name ?? '');
    setBuilderSubject(template?.subject ?? '');
    setBuilderBlocks(normalizeBlocks(template?.body_blocks, template?.body ?? ''));
    setBuilderDelivery('manual');
    setBuilderLifecycle(template?.lifecycle ?? 'draft');
    resetAudience();
    setBuilderError('');
    builderJustOpenedRef.current = true;
    setBuilderOpen(true);
  }

  function closeBuilder() {
    setBuilderOpen(false);
  }

  // Deep link: ?event=<key> opens the Notifications tab with that event's composer.
  useEffect(() => {
    if (loading || deepLinkHandled) return;
    setDeepLinkHandled(true);
    const ev = searchParams.get('event');
    if (!ev) return;
    const def = EVENT_REGISTRY.find(e => e.key === ev);
    if (def) {
      setActiveTab('notifications');
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
    const payload = {
      subject,
      body: flattenBlocksToPlainText(blocks, conference),
      body_blocks: blocks,
      delivery: builderDelivery,
      name,
      updated_at: new Date().toISOString(),
    };

    if (builderTemplateId) {
      const { error } = await supabase.from('email_templates').update(payload).eq('id', builderTemplateId);
      if (error) { if (!opts.silent) setBuilderError(error.message); return null; }
      await loadTemplates();
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
    await loadTemplates();
    return newId;
  }

  // Debounced autosave: silently persists body_blocks + the flattened body as the chair edits.
  useEffect(() => {
    if (!builderOpen) return;
    if (builderJustOpenedRef.current) { builderJustOpenedRef.current = false; return; }
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

  async function handleToggleLifecycle() {
    const next: 'draft' | 'ready' = builderLifecycle === 'ready' ? 'draft' : 'ready';
    let id = builderTemplateId;
    if (!id) {
      id = await persistTemplate(builderSubject, builderBlocks, { silent: false });
      if (!id) return;
    }
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase.from('email_templates').update({ lifecycle: next }).eq('id', id);
    if (error) { setBuilderError(error.message); return; }
    setBuilderLifecycle(next);
    await loadTemplates();
  }

  async function handleToggleEnabled(template: EmailTemplate) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('email_templates').update({ enabled: !template.enabled }).eq('id', template.id);
    await loadTemplates();
  }

  async function handleDuplicateTemplate(t: EmailTemplate) {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase.from('email_templates').insert({
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
    });
    if (error) { showFlash('err', error.message); return; }
    showFlash('ok', 'Duplicated as a new draft.');
    await loadTemplates();
  }

  function handleExcludeRecipient(id: string) {
    if (manuallyAddedIds.has(id)) {
      setManuallyAddedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    } else {
      setExcludedIds(prev => new Set(prev).add(id));
    }
  }

  async function handleOpenSendConfirm() {
    if (!conference || !session) return;
    setBuilderError('');
    if (finalRecipients.length === 0) { setBuilderError('No recipients selected.'); return; }
    const id = await persistTemplate(builderSubject, builderBlocks, { silent: false });
    if (!id) return;
    setSendConfirmText('');
    setSendConfirmOpen(true);
  }

  async function handleConfirmSend() {
    if (!conference || !session || !builderTemplateId) return;
    setSending(true);
    const supabase = getAuthedClient(session.access_token);
    const flatBody = flattenBlocksToPlainText(builderBlocks, conference);
    const recipients = finalRecipients;
    const snapshotHtml = renderEmailHtml({ blocks: builderBlocks, conference, ctx: {} });

    // Insert the send summary first so each outbox row can be tagged with
    // its real id, letting History show a per-recipient delivery breakdown.
    const { data: sendData, error: sendError } = await supabase
      .from('email_sends')
      .insert({
        conference_id: conference.id,
        sent_by: user?.id ?? null,
        subject: builderSubject,
        body_html: snapshotHtml,
        recipient_filter: buildRecipientFilterPayload(),
        recipient_count: recipients.length,
        scheduled_at: null,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (sendError || !sendData) {
      setBuilderError(sendError?.message ?? 'Failed to record this send.');
      setSending(false);
      setSendConfirmOpen(false);
      return;
    }
    const emailSendId = (sendData as { id: string }).id;

    const rows = recipients.map(app => {
      const ctx = buildContext(app);
      return {
        conference_id: conference.id,
        template_id: builderTemplateId,
        email_send_id: emailSendId,
        recipient_application_id: app.id,
        recipient_email: app.profiles?.email ?? null,
        subject: resolveTokens(builderSubject, ctx),
        body: resolveTokens(flatBody, ctx),
        body_html: renderEmailHtml({ blocks: builderBlocks, conference, ctx }),
        status: 'pending',
      };
    });
    const { error: outboxError } = await supabase.from('email_outbox').insert(rows);
    if (outboxError) { setBuilderError(outboxError.message); setSending(false); setSendConfirmOpen(false); return; }

    triggerEmailDelivery(supabase);

    setSending(false);
    setSendConfirmOpen(false);
    setSendConfirmText('');
    closeBuilder();
    showFlash('ok', `Queued ${rows.length} email${rows.length === 1 ? '' : 's'} — sending now.`);
    await Promise.all([loadTemplates(), loadEmailSends(), loadOutboxPending()]);
  }

  async function toggleRecipientsExpanded(sendId: string) {
    if (recipientsExpandedId === sendId) { setRecipientsExpandedId(null); return; }
    setRecipientsExpandedId(sendId);
    if (outboxBySend[sendId] || !session) return;
    setOutboxBySend(prev => ({ ...prev, [sendId]: 'loading' }));
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('email_outbox')
      .select('id, recipient_email, status, error')
      .eq('email_send_id', sendId);
    setOutboxBySend(prev => ({ ...prev, [sendId]: (data ?? []) as OutboxDetailRow[] }));
  }

  if (!conference) return null;

  // ── Stats ─────────────────────────────────────────────────────────────────

  const sentCount = emailSends.filter(e => e.status === 'sent').length;
  const enabledCount = templates.filter(t => t.event_key && t.enabled).length;

  const eventDef = builderEventKey ? EVENT_REGISTRY.find(e => e.key === builderEventKey) ?? null : null;
  const requireTypedConfirm = finalRecipients.length > 200;
  const confirmDisabled = requireTypedConfirm && sendConfirmText.trim().toUpperCase() !== 'SEND';
  const namesPreview = finalRecipients.slice(0, 5).map(a => a.profiles?.display_name ?? 'Unknown').join(', ');

  // ── Row renderer for ad-hoc templates (drafts + ready) ───────────────────

  function renderAdHocRow(t: EmailTemplate, ready: boolean) {
    return (
      <div
        key={t.id}
        className="flex items-center justify-between gap-4 rounded-2xl p-4"
        style={CARD_STYLE}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {!ready && (
              <span
                className="rounded-md px-2 py-0.5 flex-shrink-0"
                style={{ fontSize: 10, fontWeight: 700, fontFamily: OUTFIT, backgroundColor: 'rgba(182,135,31,0.12)', color: '#B6871F', border: '1px solid rgba(182,135,31,0.35)' }}
              >
                DRAFT
              </span>
            )}
            <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{t.name}</p>
          </div>
          <p className="text-xs truncate mt-0.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            {t.subject || '(No subject)'} · Edited {formatDate(t.updated_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => handleDuplicateTemplate(t)}
            title="Duplicate"
            className="rounded-lg p-1.5 focus:outline-none transition-colors"
            style={{ border: `1px solid ${BORDER}`, color: '#1C1410', backgroundColor: 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Copy size={13} />
          </button>
          <button
            onClick={() => openBuilderForAdHoc(t)}
            className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none transition-colors"
            style={{ border: `1px solid ${BORDER}`, color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            EDIT
          </button>
          {ready && (
            <button
              onClick={() => openBuilderForAdHoc(t)}
              className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none transition-colors"
              style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              SEND
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 md:px-10 py-8">

      {/* ── Header ── */}
      {!builderOpen && (
        <div className="mb-6">
          <p className="text-xs mb-1" style={{ color: '#9A8A78', fontFamily: OUTFIT, fontWeight: 700, letterSpacing: '0.12em' }}>
            {conference.acronym} / Communications
          </p>
          <h1 className="font-black text-2xl" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            Communications
          </h1>
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
            {builderEventKey === null && (
              <button
                onClick={handleToggleLifecycle}
                className="rounded-xl py-2 px-4 text-sm font-bold focus:outline-none transition-colors"
                style={{ border: `1px solid ${BORDER}`, color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                {builderLifecycle === 'ready' ? 'BACK TO DRAFT' : 'MARK READY'}
              </button>
            )}
            {builderEventKey === null && builderLifecycle === 'ready' && (
              <button
                onClick={handleOpenSendConfirm}
                disabled={sending}
                className="rounded-xl py-2 px-4 text-sm font-bold focus:outline-none transition-colors disabled:opacity-60"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT }}
                onMouseEnter={e => { if (!sending) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                {sending ? 'QUEUEING...' : 'SEND'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Flash */}
      {flash && (
        <div
          className="rounded-xl px-4 py-2.5 mb-5 text-sm"
          style={{
            backgroundColor: flash.kind === 'ok' ? 'rgba(61,122,82,0.10)' : 'rgba(139,32,32,0.08)',
            border: `1px solid ${flash.kind === 'ok' ? 'rgba(61,122,82,0.35)' : 'rgba(139,32,32,0.3)'}`,
            color: flash.kind === 'ok' ? '#3D7A52' : '#8B2020',
            fontFamily: OUTFIT, fontWeight: 600,
          }}
        >
          {flash.msg}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN VIEW — tabs
      ════════════════════════════════════════════════════════════════════════ */}
      {!builderOpen && (
        <>
          {/* Stat medallions */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Emails Sent', value: sentCount, Icon: Send, accent: '#1B3828', primary: true },
              { label: 'Notifications On', value: enabledCount, Icon: Bell, accent: '#B6871F', primary: false },
              { label: 'Outbox Pending', value: outboxPending, Icon: Inbox, accent: '#4A7896', primary: false },
            ].map(s => (
              <div
                key={s.label}
                className="rounded-2xl p-4 flex items-center gap-3.5"
                style={{
                  backgroundColor: '#FAF8F3',
                  border: `1.5px solid ${s.primary ? 'rgba(27,56,40,0.35)' : '#D8CDB6'}`,
                  boxShadow: CARD_SHADOW,
                  borderTop: s.primary ? '2.5px solid #1B3828' : '1.5px solid #D8CDB6',
                }}
              >
                <span
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `linear-gradient(150deg, ${s.accent}22, ${s.accent}0F)`,
                    border: `1px solid ${s.accent}44`,
                  }}
                >
                  <s.Icon size={20} strokeWidth={2} style={{ color: s.accent }} />
                </span>
                <div className="min-w-0">
                  <p className="font-black leading-none" style={{ color: '#1C1410', fontFamily: OUTFIT, fontSize: 26 }}>
                    {s.value}
                  </p>
                  <p className="mt-1" style={{ fontSize: 12, color: '#9A8A78', fontFamily: OUTFIT, fontWeight: 600 }}>
                    {s.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Tab switcher */}
          <div className="inline-flex rounded-xl p-1 mb-6" style={{ border: `1px solid ${BORDER}`, backgroundColor: '#FAF8F3' }}>
            <TabPill active={activeTab === 'emails'} onClick={() => setActiveTab('emails')}>EMAILS</TabPill>
            <TabPill active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')}>NOTIFICATIONS</TabPill>
          </div>

          {loading && (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
            </div>
          )}

          {/* ═══ EMAILS TAB ═══ */}
          {!loading && activeTab === 'emails' && (
            <>
              <section className="mb-10">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-base" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                    Drafts
                  </p>
                  <button
                    onClick={() => openBuilderForAdHoc()}
                    className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none transition-colors"
                    style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                  >
                    + NEW EMAIL
                  </button>
                </div>
                <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                  Being written. Mark one ready when it&apos;s good to send.
                </p>
                {draftTemplates.length === 0 ? (
                  <p className="text-sm py-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No drafts yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">{draftTemplates.map(t => renderAdHocRow(t, false))}</div>
                )}
              </section>

              <section className="mb-10">
                <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                  Ready to Send
                </p>
                <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                  Approved and waiting for you to pick an audience.
                </p>
                {readyTemplates.length === 0 ? (
                  <p className="text-sm py-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>Nothing ready yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">{readyTemplates.map(t => renderAdHocRow(t, true))}</div>
                )}
              </section>

              <section>
                <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                  History
                </p>
                <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                  Past sends, read-only.
                </p>

                {emailSends.length === 0 ? (
                  <div className="flex flex-col items-center py-16">
                    <Mail size={40} style={{ color: '#9A8A78', marginBottom: 16 }} />
                    <p className="font-semibold text-lg mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                      No emails yet
                    </p>
                    <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                      Sent emails will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {emailSends.map(email => {
                      const sc = STATUS_COLORS[email.status] ?? STATUS_COLORS.draft;
                      const isExpanded = historyExpandedId === email.id;
                      const filterText = formatFilter(email.recipient_filter, societies, committees);
                      const isHtml = looksLikeHtmlDoc(email.body_html);

                      return (
                        <div
                          key={email.id}
                          className="rounded-2xl p-5 transition-colors"
                          style={CARD_STYLE}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D8CDB6'; }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 rounded-full" style={{ width: 8, height: 8, backgroundColor: sc.dot }} />
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

                          <div className="flex items-center gap-4 mt-1" style={{ fontSize: 12, color: '#9A8A78', fontFamily: OUTFIT }}>
                            <span>
                              {filterText}
                              {email.recipient_count > 0 ? ` · ${email.recipient_count} recipients` : ''}
                            </span>
                            <span className="ml-auto flex-shrink-0">
                              {email.sent_at ? `Sent ${formatDate(email.sent_at)}` : `${formatDate(email.created_at)}`}
                            </span>
                          </div>

                          <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: '1px solid #F0EDE6' }}>
                            <div className="flex items-center gap-4">
                              {email.body_html && (
                                <button
                                  onClick={() => setHistoryExpandedId(isExpanded ? null : email.id)}
                                  className="text-xs font-bold focus:outline-none"
                                  style={{ color: '#1B3828', backgroundColor: 'transparent', border: 'none', fontFamily: OUTFIT }}
                                >
                                  {isExpanded ? 'HIDE' : 'VIEW'}
                                </button>
                              )}
                              <button
                                onClick={() => toggleRecipientsExpanded(email.id)}
                                className="text-xs font-bold focus:outline-none"
                                style={{ color: '#1B3828', backgroundColor: 'transparent', border: 'none', fontFamily: OUTFIT }}
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
                                return <p className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>Loading…</p>;
                              }
                              if (!detail || detail.length === 0) {
                                return (
                                  <p className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                                    No per-recipient delivery data recorded for this send.
                                  </p>
                                );
                              }
                              return (
                                <div className="flex flex-col gap-1" style={{ maxHeight: 280, overflowY: 'auto' }}>
                                  {detail.map(r => {
                                    const rc = outboxStatusColor(r.status);
                                    return (
                                      <div
                                        key={r.id}
                                        className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5"
                                        style={{ backgroundColor: '#FFFFFF', border: '1px solid #F0EDE6' }}
                                      >
                                        <span className="text-xs truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                                          {r.recipient_email ?? '—'}
                                        </span>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          {r.status === 'failed' && r.error && (
                                            <span className="text-xs truncate" style={{ color: '#8B2020', fontFamily: OUTFIT, maxWidth: 260 }} title={r.error}>
                                              {r.error}
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
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          {/* ═══ NOTIFICATIONS TAB ═══ */}
          {!loading && activeTab === 'notifications' && (
            <section>
              <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                Conference Notifications
              </p>
              <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                Automatic emails triggered by application events. Draft one, then switch it on when you&apos;re ready.
              </p>
              <div className="flex flex-col gap-2">
                {EVENT_REGISTRY.map(ev => {
                  const template = templatesByEvent.get(ev.key);
                  return (
                    <div
                      key={ev.key}
                      className="flex items-center justify-between gap-4 rounded-2xl p-4"
                      style={CARD_STYLE}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{ev.label}</p>
                        <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{ev.description}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {!template ? (
                          <span
                            className="rounded-md px-2.5 py-0.5"
                            style={{ fontSize: 11, fontWeight: 700, fontFamily: OUTFIT, backgroundColor: STATUS_COLORS.draft.bg, color: STATUS_COLORS.draft.text, border: `1px solid ${STATUS_COLORS.draft.dot}55` }}
                          >
                            NOT DRAFTED
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 10, color: '#9A8A78', fontFamily: OUTFIT, fontWeight: 700, letterSpacing: '0.06em' }}>
                              {template.delivery === 'immediate' ? 'AUTO-SEND' : 'MANUAL'}
                            </span>
                            <span
                              className="rounded-md px-2.5 py-0.5"
                              style={{ fontSize: 11, fontWeight: 700, fontFamily: OUTFIT, backgroundColor: 'rgba(61,122,82,0.1)', color: '#3D7A52', border: '1px solid rgba(61,122,82,0.35)' }}
                            >
                              DRAFTED
                            </span>
                            <PillToggle value={template.enabled} onChange={() => handleToggleEnabled(template)} />
                            <span style={{ fontSize: 10, color: '#9A8A78', fontFamily: OUTFIT, fontWeight: 700, letterSpacing: '0.06em' }}>
                              {template.enabled ? 'ON' : 'OFF'}
                            </span>
                          </div>
                        )}
                        <button
                          onClick={() => openBuilderForEvent(ev)}
                          className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none transition-colors"
                          style={{ border: `1px solid ${BORDER}`, color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                        >
                          {template ? 'EDIT' : 'DRAFT'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          BUILDER
      ════════════════════════════════════════════════════════════════════════ */}
      {builderOpen && (
        <div className="flex flex-col md:flex-row gap-6">

          {/* ── Left: main composer ── */}
          <div className="flex-1 min-w-0">
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
                  style={{ border: `1px solid ${BORDER}`, color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: OUTFIT }}
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
          </div>

          {/* ── Right sidebar ── */}
          <div className={builderEventKey === null ? 'md:w-[380px] flex-shrink-0' : 'md:w-[300px] flex-shrink-0'}>
            {builderError && (
              <div
                className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4 text-sm"
                style={{ backgroundColor: 'rgba(182,135,31,0.08)', border: '1px solid rgba(182,135,31,0.2)', color: '#B6871F', fontFamily: OUTFIT }}
              >
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                {builderError}
              </div>
            )}

            {builderEventKey === null ? (
              <>
                {/* Audience filters */}
                <div className="rounded-2xl p-5 mb-4" style={CARD_STYLE}>
                  <p className="font-semibold text-sm mb-3" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                    Recipients
                  </p>
                  <MultiChipGroup label="Roles" options={ROLE_OPTIONS} selected={selRoles} onToggle={v => setSelRoles(s => toggleInSet(s, v))} />
                  <MultiChipGroup label="Payment status" options={PAYMENT_OPTIONS} selected={selPayment} onToggle={v => setSelPayment(s => toggleInSet(s, v))} />
                  <div className="mb-3">
                    <p className="text-xs font-bold mb-1.5" style={{ color: '#9A8A78', fontFamily: OUTFIT, letterSpacing: '0.06em' }}>DELEGATIONS</p>
                    <div className="flex flex-wrap gap-1.5" style={{ maxHeight: 140, overflowY: 'auto' }}>
                      {delegationOptions.map(o => {
                        const active = selDelegations.has(o.value);
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => setSelDelegations(s => toggleInSet(s, o.value))}
                            className="rounded-full px-2.5 py-1 text-xs font-semibold focus:outline-none transition-colors"
                            style={{
                              border: active ? '1px solid #1B3828' : `1px solid ${BORDER}`,
                              backgroundColor: active ? '#1B3828' : 'transparent',
                              color: active ? '#EED98A' : '#4A4238',
                              fontFamily: OUTFIT,
                            }}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <MultiChipGroup label="Attendance" options={ATTENDANCE_OPTIONS} selected={selAttendance} onToggle={v => setSelAttendance(s => toggleInSet(s, v))} />
                  <MultiChipGroup label="Application status" options={APP_STATUS_OPTIONS} selected={selStatus} onToggle={v => setSelStatus(s => toggleInSet(s, v))} />
                </div>

                {/* Live recipients */}
                <div className="rounded-2xl p-5 mb-4" style={CARD_STYLE}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                      Live Recipients
                    </p>
                    <p
                      className="text-xs font-bold"
                      style={{ color: finalRecipients.length === 0 ? '#B6871F' : '#3D7A52', fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}
                    >
                      Sending to {finalRecipients.length}
                    </p>
                  </div>

                  <div className="relative mb-2">
                    <input
                      value={manualSearch}
                      onChange={e => setManualSearch(e.target.value)}
                      placeholder="Add anyone by name or email..."
                      className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                      style={{ border: `1px solid ${BORDER}`, color: '#1C1410', backgroundColor: '#FFFFFF', fontFamily: OUTFIT }}
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
                            {a.profiles?.display_name ?? 'Unknown'}
                            <span style={{ color: '#9A8A78' }}> · {a.profiles?.email ?? '—'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1" style={{ maxHeight: 280, overflowY: 'auto' }}>
                    {finalRecipients.length === 0 && (
                      <p className="text-xs py-2" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                        No recipients match yet — adjust filters or add someone manually.
                      </p>
                    )}
                    {finalRecipients.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5"
                        style={{ backgroundColor: '#FFFFFF', border: '1px solid #F0EDE6' }}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                            {a.profiles?.display_name ?? 'Unknown'}
                            {manuallyAddedIds.has(a.id) && (
                              <span
                                className="ml-1.5 rounded px-1.5 py-0.5"
                                style={{ fontSize: 9, fontWeight: 700, backgroundColor: 'rgba(182,135,31,0.12)', color: '#B6871F' }}
                              >
                                MANUAL
                              </span>
                            )}
                          </p>
                          <p className="truncate" style={{ fontSize: 11, color: '#9A8A78', fontFamily: OUTFIT }}>
                            {a.profiles?.email ?? '—'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleExcludeRecipient(a.id)}
                          className="flex-shrink-0 rounded-md p-1 focus:outline-none"
                          style={{ border: '1px solid rgba(139,32,32,0.25)', backgroundColor: 'transparent' }}
                        >
                          <X size={11} style={{ color: '#8B2020' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: 'rgba(238,217,138,0.08)', border: '1px solid rgba(238,217,138,0.2)' }}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} style={{ color: '#B6871F', flexShrink: 0, marginTop: 1 }} />
                    <p className="text-xs leading-relaxed" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                      Sending queues one email per recipient and starts delivery immediately. Large sends may take a few minutes to fully drain.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl p-5 mb-4" style={CARD_STYLE}>
                  <p className="font-semibold text-sm mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                    About this notification
                  </p>
                  <p className="text-xs leading-relaxed mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                    {eventDef?.description}
                  </p>
                  <p className="font-semibold text-sm mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                    Delivery
                  </p>
                  <div className="flex flex-col gap-1">
                    {(['immediate', 'manual'] as const).map(d => (
                      <div
                        key={d}
                        onClick={() => setBuilderDelivery(d)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer mb-1 transition-colors"
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

                <div
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: 'rgba(238,217,138,0.08)', border: '1px solid rgba(238,217,138,0.2)' }}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} style={{ color: '#B6871F', flexShrink: 0, marginTop: 1 }} />
                    <p className="text-xs leading-relaxed" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                      Turn this on from the Conference Notifications list once you&apos;re happy with the draft.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
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
