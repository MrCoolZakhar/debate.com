'use client';

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, AlertTriangle, Send, Bell, Inbox } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import {
  EMAIL_TOKEN_KEYS, EMAIL_TOKEN_LABELS, resolveTokens, splitResolvedText,
  type EmailTokenContext,
} from '@/lib/emailTokens';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventDef {
  key: string;
  label: string;
  description: string;
  defaultDelivery: 'immediate' | 'manual';
}

interface EmailTemplate {
  id: string;
  conference_id: string;
  event_key: string | null;
  name: string;
  subject: string;
  body: string;
  enabled: boolean;
  delivery: 'immediate' | 'manual';
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
  profiles: { display_name: string } | null;
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
  recipient_filter: Record<string, string>;
  recipient_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  created_at: string;
  body_html: string | null;
}

type AudienceType = 'all' | 'role' | 'committee' | 'status' | 'unpaid' | 'unallocated' | 'not_attending' | 'delegation';

// ── Event registry ────────────────────────────────────────────────────────────

const EVENT_REGISTRY: EventDef[] = [
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
  { key: 'session_chair_invite', label: 'Session Chair Invite', description: 'Sent to committee chairs with their session code and chair password.', defaultDelivery: 'manual' },
  { key: 'session_join_invite', label: 'Session Join Invite', description: 'Sent to committee participants inviting them to join the live session.', defaultDelivery: 'manual' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const OUTFIT = "'Outfit', sans-serif";
const CARD_SHADOW = '0 2px 8px rgba(27,56,40,0.05), 0 12px 32px rgba(27,56,40,0.06)';

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

function currencySymbol(currency: string): string {
  const map: Record<string, string> = {
    GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$',
    CHF: 'CHF ', JPY: '¥', CNY: '¥', INR: '₹', BRL: 'R$', MXN: 'MX$',
  };
  return map[currency?.toUpperCase()] ?? (currency + ' ');
}

function formatFilter(filter: Record<string, string> | null, committees: Committee[], societies: Society[]): string {
  if (!filter || !filter.audience || filter.audience === 'all') return 'All participants';
  if (filter.audience === 'role' && filter.role) {
    const labels: Record<string, string> = {
      delegate: 'Delegates', chair: 'Chairs', 'head-delegate': 'Head Delegates',
      'faculty-advisor': 'Faculty Advisors', observer: 'Observers',
    };
    return labels[filter.role] ?? filter.role;
  }
  if (filter.audience === 'committee' && filter.committee_id) {
    const c = committees.find(cm => cm.id === filter.committee_id);
    return c ? c.name : 'Committee';
  }
  if (filter.audience === 'status' && filter.status) {
    const labels: Record<string, string> = {
      submitted: 'Submitted', accepted: 'Accepted', assigned: 'Assigned',
      paid: 'Paid', unpaid: 'Unpaid',
    };
    return `${labels[filter.status] ?? filter.status} applicants`;
  }
  if (filter.audience === 'unpaid') return 'Unpaid';
  if (filter.audience === 'unallocated') return 'Unallocated';
  if (filter.audience === 'not_attending') return 'Not attending';
  if (filter.audience === 'delegation' && filter.society_id) {
    const s = societies.find(so => so.id === filter.society_id);
    return s ? s.name : 'Delegation';
  }
  return 'All participants';
}

const STATUS_COLORS: Record<string, { dot: string; text: string; bg: string }> = {
  sent:      { dot: '#3D7A52', text: '#3D7A52', bg: 'rgba(61,122,82,0.1)' },
  scheduled: { dot: '#B6871F', text: '#B6871F', bg: 'rgba(182,135,31,0.1)' },
  draft:     { dot: '#DDD4C0', text: '#9A8A78', bg: 'rgba(154,138,120,0.1)' },
  failed:    { dot: '#8B2020', text: '#8B2020', bg: 'rgba(139,32,32,0.1)' },
};

// ── Small shared bits ─────────────────────────────────────────────────────────

function RadioRow({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer mb-1 transition-colors"
      style={{
        backgroundColor: selected ? 'rgba(27,56,40,0.06)' : 'transparent',
        border: selected ? '1px solid rgba(27,56,40,0.15)' : '1px solid transparent',
      }}
    >
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-full"
        style={{
          width: 16, height: 16,
          border: selected ? 'none' : '1.5px solid #DDD4C0',
          backgroundColor: selected ? '#1B3828' : 'transparent',
        }}
      >
        {selected && <div className="rounded-full" style={{ width: 6, height: 6, backgroundColor: 'white' }} />}
      </div>
      <span className="text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{children}</span>
    </div>
  );
}

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

function HighlightedText({ text }: { text: string }) {
  const segments = splitResolvedText(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.unresolved ? (
          <span
            key={i}
            style={{ backgroundColor: 'rgba(182,135,31,0.18)', color: '#8A6614', padding: '0 3px', borderRadius: 3, fontWeight: 600 }}
          >
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

// ── CommunicationsPage ────────────────────────────────────────────────────────

function CommunicationsPageInner() {
  const { conference } = useManage();
  const { user, session } = useAuth();
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
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [historyExpandedId, setHistoryExpandedId] = useState<string | null>(null);

  // ── Builder state ──
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderEventKey, setBuilderEventKey] = useState<string | null>(null);
  const [builderTemplateId, setBuilderTemplateId] = useState<string | null>(null);
  const [builderName, setBuilderName] = useState('');
  const [builderSubject, setBuilderSubject] = useState('');
  const [builderBody, setBuilderBody] = useState('');
  const [builderDelivery, setBuilderDelivery] = useState<'immediate' | 'manual'>('manual');
  const [builderPreviewing, setBuilderPreviewing] = useState(false);
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewAppId, setPreviewAppId] = useState<string | null>(null);
  const [builderError, setBuilderError] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [sending, setSending] = useState(false);

  // ── Audience state (ad-hoc only) ──
  const [audienceType, setAudienceType] = useState<AudienceType>('all');
  const [audienceRole, setAudienceRole] = useState('');
  const [audienceCommitteeId, setAudienceCommitteeId] = useState('');
  const [audienceStatus, setAudienceStatus] = useState('');
  const [audienceSocietyId, setAudienceSocietyId] = useState('');

  const bodyRef = useRef<HTMLTextAreaElement>(null);

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
      .select('id, conference_id, event_key, name, subject, body, enabled, delivery, updated_at')
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
        profiles (display_name)
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

  const eligibleApplications = useMemo(
    () => applications.filter(a => a.status !== 'rejected' && a.status !== 'withdrawn'),
    [applications]
  );

  const audienceRecipients = useMemo(() => {
    let filtered = eligibleApplications;
    switch (audienceType) {
      case 'all': break;
      case 'role': if (audienceRole) filtered = filtered.filter(a => a.role === audienceRole); break;
      case 'committee': if (audienceCommitteeId) filtered = filtered.filter(a => a.assigned_committee_id === audienceCommitteeId); break;
      case 'status':
        if (audienceStatus === 'paid') filtered = filtered.filter(a => a.payment_status === 'paid');
        else if (audienceStatus === 'unpaid') filtered = filtered.filter(a => a.payment_status === 'unpaid' && (a.status === 'accepted' || a.status === 'assigned'));
        else if (audienceStatus) filtered = filtered.filter(a => a.status === audienceStatus);
        break;
      case 'unpaid': filtered = filtered.filter(a => a.payment_status === 'unpaid'); break;
      case 'unallocated': filtered = filtered.filter(a => !a.assigned_committee_id && (a.role === 'delegate' || a.role === 'head-delegate')); break;
      case 'not_attending': filtered = filtered.filter(a => a.attending === false); break;
      case 'delegation': if (audienceSocietyId) filtered = filtered.filter(a => a.society_id === audienceSocietyId); break;
    }
    return filtered;
  }, [eligibleApplications, audienceType, audienceRole, audienceCommitteeId, audienceStatus, audienceSocietyId]);

  const previewResults = useMemo(() => {
    if (!previewSearch.trim()) return [];
    const q = previewSearch.trim().toLowerCase();
    return applications.filter(a => (a.profiles?.display_name ?? '').toLowerCase().includes(q)).slice(0, 6);
  }, [applications, previewSearch]);

  const previewApp = previewAppId ? applications.find(a => a.id === previewAppId) ?? null : null;

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
      fee: conference.fee_amount ? `${currencySymbol(conference.fee_currency)}${conference.fee_amount}` : null,
    };
  }

  // ── Builder open/close ────────────────────────────────────────────────────

  function resetAudience() {
    setAudienceType('all');
    setAudienceRole('');
    setAudienceCommitteeId('');
    setAudienceStatus('');
    setAudienceSocietyId('');
  }

  const openBuilderForEvent = useCallback((ev: EventDef) => {
    const existing = templatesByEvent.get(ev.key);
    setBuilderEventKey(ev.key);
    setBuilderTemplateId(existing?.id ?? null);
    setBuilderName(ev.label);
    setBuilderSubject(existing?.subject ?? '');
    setBuilderBody(existing?.body ?? '');
    setBuilderDelivery(existing?.delivery ?? ev.defaultDelivery);
    resetAudience();
    setBuilderPreviewing(false);
    setPreviewAppId(null);
    setPreviewSearch('');
    setBuilderError('');
    setBuilderOpen(true);
  }, [templatesByEvent]);

  function openBuilderForAdHoc(template?: EmailTemplate) {
    setBuilderEventKey(null);
    setBuilderTemplateId(template?.id ?? null);
    setBuilderName(template?.name ?? '');
    setBuilderSubject(template?.subject ?? '');
    setBuilderBody(template?.body ?? '');
    setBuilderDelivery('manual');
    resetAudience();
    setBuilderPreviewing(false);
    setPreviewAppId(null);
    setPreviewSearch('');
    setBuilderError('');
    setBuilderOpen(true);
  }

  function closeBuilder() {
    setBuilderOpen(false);
  }

  // Deep link: ?event=<key> opens the builder bound to that event on load.
  useEffect(() => {
    if (loading || deepLinkHandled) return;
    setDeepLinkHandled(true);
    const ev = searchParams.get('event');
    if (!ev) return;
    const def = EVENT_REGISTRY.find(e => e.key === ev);
    if (def) openBuilderForEvent(def);
  }, [loading, deepLinkHandled, searchParams, openBuilderForEvent]);

  // ── Builder mutations ─────────────────────────────────────────────────────

  function insertToken(key: string) {
    const ta = bodyRef.current;
    const token = `{{${key}}}`;
    if (!ta) { setBuilderBody(b => b + token); return; }
    const s = ta.selectionStart ?? builderBody.length;
    const e = ta.selectionEnd ?? builderBody.length;
    const newText = builderBody.substring(0, s) + token + builderBody.substring(e);
    setBuilderBody(newText);
    setTimeout(() => {
      ta.focus();
      const cursor = s + token.length;
      ta.setSelectionRange(cursor, cursor);
    }, 0);
  }

  async function handleSaveTemplate(): Promise<string | null> {
    if (!conference || !session) return null;
    const isAdHoc = builderEventKey === null;
    if (isAdHoc && !builderName.trim()) { setBuilderError('Name is required.'); return null; }
    if (!builderSubject.trim() || !builderBody.trim()) { setBuilderError('Subject and message are required.'); return null; }

    const supabase = getAuthedClient(session.access_token);
    const eventDef = builderEventKey ? EVENT_REGISTRY.find(e => e.key === builderEventKey) : null;
    const payload = {
      subject: builderSubject,
      body: builderBody,
      delivery: builderDelivery,
      name: isAdHoc ? builderName.trim() : (eventDef?.label ?? builderEventKey ?? ''),
      updated_at: new Date().toISOString(),
    };

    if (builderTemplateId) {
      const { error } = await supabase.from('email_templates').update(payload).eq('id', builderTemplateId);
      if (error) { setBuilderError(error.message); return null; }
      await loadTemplates();
      return builderTemplateId;
    }

    const { data, error } = await supabase.from('email_templates').insert({
      conference_id: conference.id,
      event_key: builderEventKey,
      ...payload,
    }).select('id').single();
    if (error) { setBuilderError(error.message); return null; }
    const newId = (data as { id: string }).id;
    setBuilderTemplateId(newId);
    await loadTemplates();
    return newId;
  }

  async function handleSaveAndClose() {
    setSavingTemplate(true);
    setBuilderError('');
    const id = await handleSaveTemplate();
    setSavingTemplate(false);
    if (id) {
      showFlash('ok', 'Template saved.');
      closeBuilder();
    }
  }

  async function handleQueueSend() {
    if (!conference || !session) return;
    setBuilderError('');
    if (audienceRecipients.length === 0) { setBuilderError('No recipients match this audience.'); return; }
    setSending(true);
    const id = await handleSaveTemplate();
    if (!id) { setSending(false); return; }
    const supabase = getAuthedClient(session.access_token);

    const rows = audienceRecipients.map(app => {
      const ctx = buildContext(app);
      return {
        conference_id: conference.id,
        template_id: id,
        recipient_application_id: app.id,
        subject: resolveTokens(builderSubject, ctx),
        body: resolveTokens(builderBody, ctx),
        status: 'pending',
      };
    });
    const { error: outboxError } = await supabase.from('email_outbox').insert(rows);
    if (outboxError) { setBuilderError(outboxError.message); setSending(false); return; }

    const recipientFilter: Record<string, string> = { audience: audienceType };
    if (audienceType === 'role') recipientFilter.role = audienceRole;
    if (audienceType === 'committee') recipientFilter.committee_id = audienceCommitteeId;
    if (audienceType === 'status') recipientFilter.status = audienceStatus;
    if (audienceType === 'delegation') recipientFilter.society_id = audienceSocietyId;

    await supabase.from('email_sends').insert({
      conference_id: conference.id,
      sent_by: user?.id ?? null,
      subject: builderSubject,
      body_html: builderBody,
      recipient_filter: recipientFilter,
      recipient_count: rows.length,
      scheduled_at: null,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    setSending(false);
    closeBuilder();
    showFlash('ok', `Queued ${rows.length} email${rows.length === 1 ? '' : 's'} — delivery engine coming next.`);
    await Promise.all([loadTemplates(), loadEmailSends(), loadOutboxPending()]);
  }

  async function handleToggleEnabled(template: EmailTemplate) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('email_templates').update({ enabled: !template.enabled }).eq('id', template.id);
    await loadTemplates();
  }

  if (!conference) return null;

  // ── Stats ─────────────────────────────────────────────────────────────────

  const sentCount = emailSends.filter(e => e.status === 'sent').length;
  const enabledCount = templates.filter(t => t.event_key && t.enabled).length;

  const eventDef = builderEventKey ? EVENT_REGISTRY.find(e => e.key === builderEventKey) ?? null : null;

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
              style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT }}
              onMouseEnter={e => { if (!savingTemplate) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              {savingTemplate ? 'SAVING...' : 'SAVE'}
            </button>
            {builderEventKey === null && (
              <button
                onClick={handleQueueSend}
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
          MAIN VIEW — registry, ad-hoc list, history
      ════════════════════════════════════════════════════════════════════════ */}
      {!builderOpen && (
        <>
          {/* Stat medallions */}
          <div className="grid grid-cols-3 gap-4 mb-8">
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

          {loading && (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
            </div>
          )}

          {!loading && (
            <>
              {/* ── Section 1: Conference Notifications ── */}
              <section className="mb-10">
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
                        style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', boxShadow: CARD_SHADOW }}
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
                            style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT }}
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

              {/* ── Section 2: Your Emails ── */}
              <section className="mb-10">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-base" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                    Your Emails
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
                  One-off emails you compose and send to a chosen audience.
                </p>
                {adhocTemplates.length === 0 ? (
                  <p className="text-sm py-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No ad-hoc emails yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {adhocTemplates.map(t => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-4 rounded-2xl p-4"
                        style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', boxShadow: CARD_SHADOW }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{t.name}</p>
                          <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{t.subject || '(No subject)'}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => openBuilderForAdHoc(t)}
                            className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none transition-colors"
                            style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                          >
                            EDIT
                          </button>
                          <button
                            onClick={() => openBuilderForAdHoc(t)}
                            className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none transition-colors"
                            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                          >
                            SEND
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Section 3: History ── */}
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
                      const filterText = formatFilter(email.recipient_filter, committees, societies);

                      return (
                        <div
                          key={email.id}
                          className="rounded-2xl p-5 transition-colors"
                          style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', boxShadow: CARD_SHADOW }}
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

                          {email.body_html && (
                            <div className="mt-3 pt-3" style={{ borderTop: '1px solid #F0EDE6' }}>
                              <button
                                onClick={() => setHistoryExpandedId(isExpanded ? null : email.id)}
                                className="text-xs font-bold focus:outline-none"
                                style={{ color: '#1B3828', backgroundColor: 'transparent', border: 'none', fontFamily: OUTFIT }}
                              >
                                {isExpanded ? 'HIDE MESSAGE' : 'VIEW MESSAGE'}
                              </button>
                              {isExpanded && (
                                <p
                                  className="mt-2 text-sm leading-relaxed"
                                  style={{ color: '#1C1410', fontFamily: OUTFIT, whiteSpace: 'pre-wrap' }}
                                >
                                  {email.body_html}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
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
                  style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: OUTFIT }}
                />
              </div>
            )}

            <div className="mb-4">
              <label className="block font-semibold text-sm mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                Subject
              </label>
              <input
                type="text"
                value={builderSubject}
                onChange={e => setBuilderSubject(e.target.value)}
                placeholder="e.g. Your allocation for TEIMUN 2026 is confirmed"
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: OUTFIT }}
              />
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-semibold text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                  Message
                </label>
                <select
                  value=""
                  onChange={e => { if (e.target.value) insertToken(e.target.value); }}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none"
                  style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: OUTFIT, cursor: 'pointer' }}
                >
                  <option value="">INSERT FIELD...</option>
                  {EMAIL_TOKEN_KEYS.map(k => (
                    <option key={k} value={k}>{EMAIL_TOKEN_LABELS[k]}</option>
                  ))}
                </select>
              </div>

              {!builderPreviewing ? (
                <>
                  <textarea
                    ref={bodyRef}
                    value={builderBody}
                    onChange={e => setBuilderBody(e.target.value)}
                    placeholder="Write your message here..."
                    rows={12}
                    className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-y"
                    style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: OUTFIT, minHeight: 260 }}
                  />
                  <p className="mt-2 text-xs leading-relaxed" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                    Available fields: {EMAIL_TOKEN_KEYS.map(k => `{{${k}}}`).join('  ')}
                  </p>
                </>
              ) : (
                <div
                  className="rounded-xl px-4 py-4"
                  style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', minHeight: 260 }}
                >
                  <div className="relative mb-3">
                    <input
                      value={previewSearch}
                      onChange={e => { setPreviewSearch(e.target.value); setPreviewAppId(null); }}
                      placeholder="Search applicants to preview as..."
                      className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                      style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FFFFFF', fontFamily: OUTFIT }}
                    />
                    {previewSearch.trim() && !previewApp && previewResults.length > 0 && (
                      <div
                        className="absolute left-0 right-0 rounded-xl shadow-lg overflow-y-auto"
                        style={{ top: 'calc(100% + 4px)', maxHeight: 200, backgroundColor: '#FFFFFF', border: '1px solid #DDD4C0', zIndex: 10 }}
                      >
                        {previewResults.map(a => (
                          <button
                            key={a.id}
                            onClick={() => { setPreviewAppId(a.id); setPreviewSearch(a.profiles?.display_name ?? ''); }}
                            className="w-full text-left px-4 py-2.5 text-sm focus:outline-none"
                            style={{ color: '#1C1410', fontFamily: OUTFIT }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                          >
                            {a.profiles?.display_name ?? 'Unknown'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {previewApp ? (
                    <div className="rounded-xl p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #F0EDE6' }}>
                      <p className="font-semibold text-sm mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                        <HighlightedText text={resolveTokens(builderSubject, buildContext(previewApp))} />
                      </p>
                      <p className="text-sm leading-relaxed" style={{ color: '#1C1410', fontFamily: OUTFIT, whiteSpace: 'pre-wrap' }}>
                        <HighlightedText text={resolveTokens(builderBody, buildContext(previewApp))} />
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                      Search and select an applicant above to preview with resolved fields.
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={() => setBuilderPreviewing(v => !v)}
                className="mt-2 text-xs font-semibold focus:outline-none"
                style={{ color: '#1B3828', backgroundColor: 'transparent', border: 'none', fontFamily: OUTFIT }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
              >
                {builderPreviewing ? '← EDIT' : 'PREVIEW →'}
              </button>
            </div>
          </div>

          {/* ── Right sidebar ── */}
          <div className="md:w-[300px] flex-shrink-0">
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
                {/* Audience card */}
                <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', boxShadow: CARD_SHADOW }}>
                  <p className="font-semibold text-sm mb-4" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                    Recipients
                  </p>

                  <RadioRow selected={audienceType === 'all'} onClick={() => setAudienceType('all')}>All participants</RadioRow>

                  <RadioRow selected={audienceType === 'role'} onClick={() => setAudienceType('role')}>By role</RadioRow>
                  {audienceType === 'role' && (
                    <select
                      value={audienceRole}
                      onChange={e => setAudienceRole(e.target.value)}
                      className="w-full mt-1 mb-1 rounded-xl px-3 py-2 text-sm focus:outline-none"
                      style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: OUTFIT }}
                    >
                      <option value="">Select role...</option>
                      <option value="delegate">Delegates</option>
                      <option value="chair">Chairs</option>
                      <option value="head-delegate">Head Delegates</option>
                      <option value="faculty-advisor">Faculty Advisors</option>
                      <option value="observer">Observers</option>
                    </select>
                  )}

                  <RadioRow selected={audienceType === 'committee'} onClick={() => setAudienceType('committee')}>By committee</RadioRow>
                  {audienceType === 'committee' && (
                    <select
                      value={audienceCommitteeId}
                      onChange={e => setAudienceCommitteeId(e.target.value)}
                      className="w-full mt-1 mb-1 rounded-xl px-3 py-2 text-sm focus:outline-none"
                      style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: OUTFIT }}
                    >
                      <option value="">Select committee...</option>
                      {committees.map(c => (
                        <option key={c.id} value={c.id}>{c.name}{c.abbreviation ? ` (${c.abbreviation})` : ''}</option>
                      ))}
                    </select>
                  )}

                  <RadioRow selected={audienceType === 'status'} onClick={() => setAudienceType('status')}>By status</RadioRow>
                  {audienceType === 'status' && (
                    <select
                      value={audienceStatus}
                      onChange={e => setAudienceStatus(e.target.value)}
                      className="w-full mt-1 mb-1 rounded-xl px-3 py-2 text-sm focus:outline-none"
                      style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: OUTFIT }}
                    >
                      <option value="">Select status...</option>
                      <option value="submitted">Submitted (pending)</option>
                      <option value="accepted">Accepted</option>
                      <option value="assigned">Assigned</option>
                      <option value="paid">Paid</option>
                      <option value="unpaid">Unpaid (accepted/assigned)</option>
                    </select>
                  )}

                  <p className="text-xs font-bold mt-3 mb-1" style={{ color: '#B6871F', fontFamily: OUTFIT, letterSpacing: '0.1em' }}>
                    SMART AUDIENCES
                  </p>

                  <RadioRow selected={audienceType === 'unpaid'} onClick={() => setAudienceType('unpaid')}>Unpaid</RadioRow>
                  <RadioRow selected={audienceType === 'unallocated'} onClick={() => setAudienceType('unallocated')}>Unallocated</RadioRow>
                  <RadioRow selected={audienceType === 'not_attending'} onClick={() => setAudienceType('not_attending')}>Not attending</RadioRow>
                  <RadioRow selected={audienceType === 'delegation'} onClick={() => setAudienceType('delegation')}>Specific delegation</RadioRow>
                  {audienceType === 'delegation' && (
                    <select
                      value={audienceSocietyId}
                      onChange={e => setAudienceSocietyId(e.target.value)}
                      className="w-full mt-1 mb-1 rounded-xl px-3 py-2 text-sm focus:outline-none"
                      style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: OUTFIT }}
                    >
                      <option value="">Select delegation...</option>
                      {societies.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}

                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid #F0EDE6' }}>
                    <p style={{ fontSize: 11, color: audienceRecipients.length === 0 ? '#B6871F' : '#9A8A78', fontFamily: OUTFIT, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {audienceRecipients.length} recipient{audienceRecipients.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <div
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: 'rgba(238,217,138,0.08)', border: '1px solid rgba(238,217,138,0.2)' }}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} style={{ color: '#B6871F', flexShrink: 0, marginTop: 1 }} />
                    <p className="text-xs leading-relaxed" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                      Sending queues one email per recipient in the outbox. The delivery engine that actually dispatches them is coming next.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: '#FAF8F3', border: '1.5px solid #D8CDB6', boxShadow: CARD_SHADOW }}>
                  <p className="font-semibold text-sm mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                    About this notification
                  </p>
                  <p className="text-xs leading-relaxed mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                    {eventDef?.description}
                  </p>
                  <p className="font-semibold text-sm mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                    Delivery
                  </p>
                  <RadioRow selected={builderDelivery === 'immediate'} onClick={() => setBuilderDelivery('immediate')}>
                    Send automatically
                  </RadioRow>
                  <RadioRow selected={builderDelivery === 'manual'} onClick={() => setBuilderDelivery('manual')}>
                    Manual trigger only
                  </RadioRow>
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
