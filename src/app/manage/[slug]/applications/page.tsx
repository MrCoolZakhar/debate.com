'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowRight, BadgeCheck, Building2, Check, CircleCheck, Clock, Download, Eye,
  Gavel, Globe, GraduationCap, HandCoins, Inbox, LogOut, MapPin, MessageSquareText,
  RotateCcw, Trash2, User, Users, X,
} from 'lucide-react';
import Link from 'next/link';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { queueEventEmail, notifyIfNeeded, turnOnDefaultEmail } from '@/lib/emailEvents';
import { useDraftNotices, DraftNoticeList } from '@/components/DraftNotice';
import { useConfirmModal } from '@/components/ConfirmModal';
import { FlagImg } from '@/components/FlagImg';
import Portal from '@/components/Portal';
import { getCountryByName } from '@/lib/countries';
import {
  poolForRole, fillFreeSpots, releasePoolSpot, POOL_SPOTS_COLUMN,
} from '@/app/manage/[slug]/assignment/delegationShared';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppPreference {
  preference_order: number;
  conference_committee_id: string;
  country_code: string;
  country_name: string;
  conference_committees: { name: string; abbreviation: string | null } | null;
}

interface CustomQuestion {
  id: string;
  label: string;
  type: string;
  required: boolean;
}

interface RoleConfigLite {
  role: string;
  payment_timing: 'after_application' | 'after_acceptance' | 'anytime' | string;
  custom_questions: CustomQuestion[];
}

interface Application {
  id: string;
  user_id: string | null;
  invited_email: string | null;
  invited_name: string | null;
  role: string;
  status: string;
  is_head_delegate: boolean;
  experience_level: string | null;
  payment_status: string | null;
  submitted_at: string;
  organizer_note: string | null;
  custom_answers: Record<string, string> | null;
  assigned_committee_id: string | null;
  assigned_country_code: string | null;
  assigned_country_name: string | null;
  assigned_committee: { name: string; abbreviation: string | null; topics: string[] | null } | null;
  profiles: { display_name: string; email: string; avatar_url: string | null; nationality: string | null; mun_experience_level: string | null } | null;
  societies: { name: string } | null;
  application_preferences: AppPreference[];
  self_paid: boolean;
  attending: boolean;
  pledge_type: 'delegation' | null;
  spots_pledged: number | null;
  pledge_confirmed_at: string | null;
  society_id: string | null;
}

// Pool accounting (poolForRole, fillFreeSpots, releasePoolSpot, POOL_SPOTS_COLUMN)
// is imported from delegationShared.tsx, the canonical location (F: fillFreeSpots
// consolidation). This page no longer keeps its own copy.

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function roleLabel(role: string) {
  const map: Record<string, string> = {
    delegate: 'Delegate', chair: 'Chair', 'head-delegate': 'Head Delegate',
    'faculty-advisor': 'Faculty Advisor', observer: 'Observer',
  };
  return map[role] ?? role;
}

function RoleIcon({ role, size = 10 }: { role: string; size?: number }) {
  const Icon = role === 'chair' ? Gavel
    : role === 'head-delegate' ? Users
    : role === 'faculty-advisor' ? GraduationCap
    : role === 'observer' ? Eye
    : User;
  return <Icon size={size} strokeWidth={2.5} />;
}

/** Small muted chip for applications with no linked profile (user_id null), imported, unclaimed. */
function NotRegisteredChip() {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full font-bold flex-shrink-0"
      style={{ fontSize: 9, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', backgroundColor: 'rgba(154,138,120,0.12)', color: '#9A8A78', border: '1px solid rgba(154,138,120,0.3)' }}
    >
      NOT REGISTERED
    </span>
  );
}

function StatusIcon({ status, size = 10 }: { status: string; size?: number }) {
  const Icon = status === 'submitted' ? Inbox
    : status === 'accepted' ? Check
    : status === 'assigned' ? BadgeCheck
    : status === 'rejected' ? X
    : status === 'withdrawn' ? LogOut
    : Clock;
  return <Icon size={size} strokeWidth={2.5} />;
}

/** Committee shorthand, abbreviation when set, else a monogram of the name. */
function committeeAbbr(c: { name: string; abbreviation: string | null } | null | undefined): string {
  if (!c) return '—';
  if (c.abbreviation) return c.abbreviation;
  const mono = c.name
    .split(/\s+/)
    .filter(w => /^[A-Za-z0-9]/.test(w))
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
  return mono || c.name.slice(0, 4).toUpperCase();
}

/** Country rendered as a flag with the name kept as a tooltip. Falls back to
 *  plain text when no ISO code can be resolved from the name. */
function CountryFlag({ name, code, size = 14 }: { name: string | null | undefined; code?: string | null; size?: number }) {
  const resolved = code || (name ? getCountryByName(name)?.code : undefined);
  if (!resolved) return name ? <span>{name}</span> : null;
  return (
    <span title={name ?? resolved} className="inline-flex items-center" style={{ lineHeight: 0 }}>
      <FlagImg code={resolved} size={size} />
    </span>
  );
}

const STATUS_FILTERS = [
  { label: 'ALL', value: 'all' },
  { label: 'SUBMITTED', value: 'submitted' },
  { label: 'ACCEPTED', value: 'accepted' },
  { label: 'ASSIGNED', value: 'assigned' },
  { label: 'REJECTED', value: 'rejected' },
  { label: 'WITHDRAWN', value: 'withdrawn' },
];

const ROLE_FILTERS = [
  { label: 'ALL', value: 'all' },
  { label: 'DELEGATE', value: 'delegate' },
  { label: 'CHAIR', value: 'chair' },
  { label: 'HEAD DEL.', value: 'head-delegate' },
  { label: 'FA', value: 'faculty-advisor' },
  { label: 'OBSERVER', value: 'observer' },
];

const PAYMENT_FILTERS = [
  { label: 'ALL', value: 'all' },
  { label: 'PAID', value: 'paid' },
  { label: 'WAIVED', value: 'waived' },
  { label: 'UNPAID', value: 'unpaid' },
];

// ── Filter pill component ─────────────────────────────────────────────────────

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="focus:outline-none transition-colors"
      style={{
        padding: '6px 12px',
        borderRadius: 999,
        fontSize: 10,
        fontFamily: "'Outfit', sans-serif",
        fontWeight: 800,
        letterSpacing: '0.08em',
        border: active ? '1px solid #1B3828' : '1px solid rgba(221,212,192,0.9)',
        backgroundColor: active ? '#1B3828' : 'rgba(250,248,243,0.6)',
        color: active ? '#EED98A' : '#6B5F52',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

// ── ApplicationsPage ──────────────────────────────────────────────────────────

export default function ApplicationsPage() {
  const { conference } = useManage();
  const { session } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [roleConfigs, setRoleConfigs] = useState<RoleConfigLite[]>([]);
  const [reviewId, setReviewId] = useState<string | null>(null);
  // Conferences done in any capacity, per user, count of their mun_cv_entries
  // rows (the same source profiles.mun_experience_level is derived from).
  const [cvCounts, setCvCounts] = useState<Record<string, number>>({});
  const [actionError, setActionError] = useState('');
  // App ids with a write in flight, double-click guard for row actions.
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const { draftNotices, pushDraftNotice, dismissDraftNotice } = useDraftNotices();
  const { confirm, modal: confirmModal } = useConfirmModal();
  // Stale-response guard for background refetches.
  const loadSeq = useRef(0);

  function markBusy(id: string, busy: boolean) {
    setBusyIds(prev => {
      const next = new Set(prev);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  }

  // `silent` refetches never touch the page-level loading flag, they
  // reconcile local optimistic state with what the server actually computed
  // (fillFreeSpots promotions, etc) without wiping the list.
  const loadApplications = useCallback(async (opts?: { silent?: boolean }) => {
    if (!conference) return;
    if (!session) return;
    const seq = ++loadSeq.current;
    if (!opts?.silent) setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const [appRes, cfgRes] = await Promise.all([
      supabase
        .from('applications')
        .select(`
          id, user_id, invited_email, invited_name, role, status, is_head_delegate, experience_level,
          payment_status, submitted_at, organizer_note, custom_answers,
          assigned_committee_id, assigned_country_code, assigned_country_name,
          self_paid, attending, pledge_type, spots_pledged, pledge_confirmed_at, society_id,
          assigned_committee:conference_committees!assigned_committee_id (name, abbreviation, topics),
          profiles (display_name, email, avatar_url, nationality, mun_experience_level),
          societies (name),
          application_preferences (
            preference_order, conference_committee_id, country_code, country_name,
            conference_committees (name, abbreviation)
          )
        `)
        .eq('conference_id', conference.id)
        .order('submitted_at', { ascending: false }),
      supabase
        .from('application_role_configs')
        .select('role, payment_timing, custom_questions')
        .eq('conference_id', conference.id),
    ]);

    if (seq !== loadSeq.current) return; // stale response, a newer load superseded this one

    const apps = (appRes.data ?? []) as unknown as Application[];
    setApplications(apps);
    setRoleConfigs((cfgRes.data ?? []) as unknown as RoleConfigLite[]);
    setLoading(false);

    // Batched MUN-history counts, ONE query for every visible applicant.
    const userIds = Array.from(new Set(apps.map(a => a.user_id).filter((id): id is string => !!id)));
    if (userIds.length > 0) {
      const { data: cvRows } = await supabase
        .from('mun_cv_entries')
        .select('user_id')
        .in('user_id', userIds);
      if (seq !== loadSeq.current) return;
      const counts: Record<string, number> = {};
      for (const row of (cvRows ?? []) as { user_id: string }[]) {
        counts[row.user_id] = (counts[row.user_id] ?? 0) + 1;
      }
      setCvCounts(counts);
    } else {
      setCvCounts({});
    }
  }, [conference, session?.access_token]);

  useEffect(() => { loadApplications(); }, [loadApplications]);

  // ── Optimistic row helpers ──────────────────────────────────────────────────
  // Patch one application in place (the UI updates instantly), and restore the
  // exact prior row on rollback, never the whole list, so concurrent actions
  // on other rows are untouched.
  function applyRow(appId: string, patch: Partial<Application>) {
    setApplications(cur => cur.map(a => (a.id === appId ? { ...a, ...patch } : a)));
  }
  function restoreRow(row: Application) {
    setApplications(cur => cur.map(a => (a.id === row.id ? row : a)));
  }

  function handleAccept(appId: string) {
    if (!session || !conference || busyIds.has(appId)) return;
    const prevRow = applications.find(a => a.id === appId);
    if (!prevRow) return;

    setActionError('');
    markBusy(appId, true);
    // Optimistic: the card flips to ACCEPTED immediately.
    applyRow(appId, { status: 'accepted' });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await supabase.from('applications').update({ status: 'accepted' }).eq('id', appId);
      if (error) throw error;

      // Secondary effects, a failure here must NOT roll back the accept.
      try {
        const result = await queueEventEmail(supabase, conference.id, 'application_accepted', [appId]);
        notifyIfNeeded(result, pushDraftNotice);
        // Consolidation: application_accepted wins over payment_available.
        // payment_available only sends alone for this person when acceptance
        // actually resolved to nothing (off/unconfigured) for them.
        const acceptedIds = new Set(result.queuedApplicationIds ?? []);

        const roleConfig = roleConfigs.find(rc => rc.role === prevRow.role);
        if (roleConfig?.payment_timing === 'after_acceptance') {
          const payResult = await queueEventEmail(supabase, conference.id, 'payment_available', [appId], undefined, { suppressIds: acceptedIds });
          notifyIfNeeded(payResult, pushDraftNotice);
        }

        // F13: acceptance is when auto-cover runs, newly accepted pool members
        // absorb any free delegation-purchased spots, oldest-first. The fill
        // helper emails spot_received for whoever it covers, suppressing the
        // just-accepted person's own id so they don't get that on top of
        // application_accepted (rule one wins) if the same action covers them.
        const pool = poolForRole(prevRow.role);
        if (prevRow.society_id && pool) {
          await fillFreeSpots(supabase, conference.id, prevRow.society_id, pool, { suppressIds: acceptedIds });
        }
      } catch {
        setActionError('Accepted, but a follow-up step (email / auto-cover) failed. Refresh to verify.');
      }

      // Auto-cover may have promoted OTHER members to paid, reconcile silently.
      await loadApplications({ silent: true });
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not accept the application. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(appId, false));
  }

  function handleReject(appId: string) {
    if (!session || !conference || busyIds.has(appId)) return;
    const prevRow = applications.find(a => a.id === appId);
    if (!prevRow) return;
    const pool = poolForRole(prevRow.role);
    // F13: rejecting a pool-covered (not self-paid) paid member releases
    // their spot back to the delegation, it stays purchased, just open again.
    const releasesSpot = prevRow.payment_status === 'paid' && !prevRow.self_paid && !!prevRow.society_id && !!pool;

    const updates: { status: string; organizer_note: string | null; payment_status?: string } = {
      status: 'rejected',
      organizer_note: rejectNote.trim() || null,
    };
    if (releasesSpot) updates.payment_status = 'unpaid';

    setActionError('');
    markBusy(appId, true);
    // Optimistic: badge flips to REJECTED, reject UI closes instantly.
    applyRow(appId, updates as Partial<Application>);
    setRejectingId(null);
    setRejectNote('');

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await supabase.from('applications').update(updates).eq('id', appId);
      if (error) throw error;

      try {
        const result = await queueEventEmail(supabase, conference.id, 'application_rejected', [appId]);
        notifyIfNeeded(result, pushDraftNotice);
      } catch {
        setActionError('Rejected, but the rejection email could not be queued.');
      }
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not reject the application. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(appId, false));
  }

  async function openRejectConfirm(app: Application) {
    const pool = poolForRole(app.role);
    const releasesSpot = app.payment_status === 'paid' && !app.self_paid && !!app.society_id && !!pool;
    const { confirmed } = await confirm({
      title: 'Reject this application?',
      body: releasesSpot
        ? "Their payment used a delegation-purchased spot. Rejecting will release that spot back to the delegation as open."
        : "This rejects the application. You can reinstate it later if needed.",
      confirmLabel: 'Reject',
      danger: true,
    });
    if (!confirmed) return;
    handleReject(app.id);
  }

  function handleReinstate(appId: string) {
    if (!session || busyIds.has(appId)) return;
    const prevRow = applications.find(a => a.id === appId);
    if (!prevRow) return;

    setActionError('');
    markBusy(appId, true);
    applyRow(appId, { status: 'submitted', organizer_note: null });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await supabase.from('applications').update({ status: 'submitted', organizer_note: null }).eq('id', appId);
      if (error) throw error;
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not reinstate the application. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(appId, false));
  }

  // ── Withdraw from conference (accepted/assigned, unpaid or waived only) ────
  // Paid applications render this action disabled: refunds come with
  // finances, so payment must be handled first (Danger ConfirmModal spells
  // this out; the button itself is also disabled, see the review modal JSX).

  async function openWithdrawConfirm(app: Application) {
    const pool = poolForRole(app.role);
    const hasAllocation = !!app.assigned_committee_id;
    const inDelegation = !!app.society_id;
    const selfFundedPaidSpot = app.payment_status === 'paid' && !!app.self_paid;
    const parts: string[] = [];
    if (hasAllocation) parts.push('Their committee allocation will be removed.');
    if (inDelegation && pool) {
      parts.push(
        selfFundedPaidSpot
          ? "Their paid spot was self-funded, so it leaves with them: the delegation's purchased-spots count goes down by one."
          : app.payment_status === 'paid'
          ? "Their spot was covered by the delegation's purchased spots, so it stays behind: it will show as open."
          : 'They will leave their delegation.'
      );
    }
    if (app.role === 'chair') parts.push('If they chair a committee, they will be removed from its dais.');
    parts.push('This cannot be undone from here. Reinstating only restores their application to Accepted, nothing else.');

    const { confirmed } = await confirm({
      title: 'Remove from conference?',
      body: parts.join(' '),
      confirmLabel: 'Withdraw',
      danger: true,
    });
    if (!confirmed) return;
    handleWithdraw(app.id);
  }

  function handleWithdraw(appId: string) {
    if (!session || !conference || busyIds.has(appId)) return;
    const prevRow = applications.find(a => a.id === appId);
    if (!prevRow) return;

    setActionError('');
    markBusy(appId, true);
    // Optimistic: the card flips to WITHDRAWN immediately.
    applyRow(appId, {
      status: 'withdrawn',
      assigned_committee_id: null,
      assigned_country_code: null,
      assigned_country_name: null,
      society_id: null,
    });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { dropToUnpaid, error: releaseError } = await releasePoolSpot(supabase, prevRow);
      if (releaseError) throw new Error(releaseError);

      const updates: Record<string, unknown> = {
        status: 'withdrawn',
        assigned_committee_id: null,
        assigned_country_code: null,
        assigned_country_name: null,
        society_id: null,
      };
      if (dropToUnpaid) updates.payment_status = 'unpaid';

      const { error } = await supabase.from('applications').update(updates).eq('id', appId);
      if (error) throw error;

      if (prevRow.assigned_committee_id) {
        await supabase.from('conference_allocations').delete().eq('application_id', appId);
      }

      // If they chair any committee, drop them from its dais: mirrors
      // committees/page.tsx & assignment/page.tsx's handleRemoveChair.
      if (prevRow.role === 'chair' && prevRow.user_id) {
        const { data: chaired } = await supabase
          .from('conference_committees')
          .select('id, chair_user_ids')
          .eq('conference_id', conference.id)
          .contains('chair_user_ids', [prevRow.user_id]);
        for (const c of (chaired ?? []) as { id: string; chair_user_ids: string[] | null }[]) {
          const nextIds = (c.chair_user_ids ?? []).filter(id => id !== prevRow.user_id);
          await supabase.from('conference_committees').update({ chair_user_ids: nextIds }).eq('id', c.id);
        }
      }
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not withdraw the application. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(appId, false));
  }

  function handleReinstateFromWithdrawn(appId: string) {
    if (!session || busyIds.has(appId)) return;
    const prevRow = applications.find(a => a.id === appId);
    if (!prevRow) return;

    setActionError('');
    markBusy(appId, true);
    // Only the status is restored: nothing else (allocation, delegation,
    // dais seat) comes back automatically.
    applyRow(appId, { status: 'accepted' });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await supabase.from('applications').update({ status: 'accepted' }).eq('id', appId);
      if (error) throw error;
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not reinstate the application. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(appId, false));
  }

  // ── Delete row (imported/unregistered applicants only) ─────────────────────
  // No account exists for these rows (user_id null, invited_* carries the
  // data), so a hard delete is safe: nothing else references them. Distinct
  // from withdraw, which is for real users and preserves their history.
  async function openDeleteRowConfirm(app: Application) {
    const { confirmed } = await confirm({
      title: 'Delete this application?',
      body: "This applicant never created a Gavelling account, so nothing else is affected. Their application and any committee allocation are permanently deleted. This can't be undone.",
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    handleDeleteRow(app.id);
  }

  function handleDeleteRow(appId: string) {
    if (!session || busyIds.has(appId)) return;
    const prevIndex = applications.findIndex(a => a.id === appId);
    const prevRow = applications[prevIndex];
    if (!prevRow) return;

    setActionError('');
    markBusy(appId, true);
    // Optimistic: the row disappears immediately.
    setApplications(cur => cur.filter(a => a.id !== appId));
    setReviewId(cur => (cur === appId ? null : cur));

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      await supabase.from('conference_allocations').delete().eq('application_id', appId);
      const { error } = await supabase.from('applications').delete().eq('id', appId);
      if (error) throw error;
    })()
      .catch(() => {
        setApplications(cur => {
          if (cur.some(a => a.id === appId)) return cur;
          const next = [...cur];
          next.splice(Math.min(prevIndex, next.length), 0, prevRow);
          return next;
        });
        setActionError('Could not delete the application. Please try again.');
      })
      .finally(() => markBusy(appId, false));
  }

  function handleMarkPaid(app: Application) {
    if (!session || !conference || busyIds.has(app.id)) return;
    const prevRow = applications.find(a => a.id === app.id) ?? app;

    setActionError('');
    markBusy(app.id, true);
    // Optimistic: the PAID badge appears immediately.
    applyRow(app.id, { payment_status: 'paid', self_paid: true });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await supabase.from('applications').update({ payment_status: 'paid', self_paid: true }).eq('id', app.id);
      if (error) throw error;

      // Secondary effects, a failure here must NOT roll back the payment mark.
      try {
        const pool = poolForRole(app.role);
        if (app.society_id && pool) {
          const spotsColumn = POOL_SPOTS_COLUMN[pool];
          const { data: soc } = await supabase.from('societies').select(spotsColumn).eq('id', app.society_id).single();
          const current = (soc as Record<string, number> | null)?.[spotsColumn] ?? 0;
          await supabase.from('societies').update({ [spotsColumn]: current + 1 }).eq('id', app.society_id);
          await fillFreeSpots(supabase, conference.id, app.society_id, pool);
        }

        const result = await queueEventEmail(supabase, conference.id, 'payment_received', [app.id]);
        notifyIfNeeded(result, pushDraftNotice);
      } catch {
        setActionError('Marked paid, but a follow-up step (spot update / email) failed. Refresh to verify.');
      }

      // fillFreeSpots may have promoted OTHER members to paid, reconcile silently.
      await loadApplications({ silent: true });
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not mark the application paid. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(app.id, false));
  }

  async function handleMarkUnpaid(app: Application) {
    if (!session || busyIds.has(app.id)) return;
    const { confirmed } = await confirm({
      title: 'Mark this application unpaid?',
      body: 'If their payment opened a delegation spot, one spot will be removed.',
      confirmLabel: 'Mark Unpaid',
      danger: true,
    });
    if (!confirmed) return;
    const prevRow = applications.find(a => a.id === app.id) ?? app;

    setActionError('');
    markBusy(app.id, true);
    applyRow(app.id, { payment_status: 'unpaid', self_paid: false });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await supabase.from('applications').update({ payment_status: 'unpaid', self_paid: false }).eq('id', app.id);
      if (error) throw error;

      try {
        const pool = poolForRole(app.role);
        if (app.society_id && pool) {
          const spotsColumn = POOL_SPOTS_COLUMN[pool];
          const { data: soc } = await supabase.from('societies').select(spotsColumn).eq('id', app.society_id).single();
          const current = (soc as Record<string, number> | null)?.[spotsColumn] ?? 0;
          await supabase.from('societies').update({ [spotsColumn]: Math.max(0, current - 1) }).eq('id', app.society_id);
        }
      } catch {
        setActionError('Marked unpaid, but the delegation spot count could not be updated. Refresh to verify.');
      }
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not mark the application unpaid. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(app.id, false));
  }

  function handleWaive(app: Application) {
    if (!session || !conference || busyIds.has(app.id)) return;
    const prevRow = applications.find(a => a.id === app.id) ?? app;

    setActionError('');
    markBusy(app.id, true);
    applyRow(app.id, { payment_status: 'waived' });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await supabase.from('applications').update({ payment_status: 'waived' }).eq('id', app.id);
      if (error) throw error;

      try {
        const result = await queueEventEmail(supabase, conference.id, 'fee_waived', [app.id]);
        notifyIfNeeded(result, pushDraftNotice);
      } catch {
        setActionError('Waived, but the waiver email could not be queued.');
      }
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not waive the fee. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(app.id, false));
  }

  async function handleUndoWaive(app: Application) {
    if (!session || busyIds.has(app.id)) return;
    const { confirmed } = await confirm({
      title: 'Remove this fee waiver?',
      body: 'They will owe payment again.',
      confirmLabel: 'Remove Waiver',
      danger: true,
    });
    if (!confirmed) return;
    const prevRow = applications.find(a => a.id === app.id) ?? app;

    setActionError('');
    markBusy(app.id, true);
    applyRow(app.id, { payment_status: 'unpaid' });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await supabase.from('applications').update({ payment_status: 'unpaid' }).eq('id', app.id);
      if (error) throw error;
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not remove the waiver. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(app.id, false));
  }

  function handleExportCSV() {
    const headers = ['Name', 'Email', 'Role', 'Status', 'Payment', 'Experience', 'Society', 'Head Delegate', 'Submitted', 'Assigned Committee', 'Assigned Country'];
    const rows = applications.map(a => [
      a.profiles?.display_name ?? a.invited_name ?? '',
      a.profiles?.email ?? a.invited_email ?? '',
      roleLabel(a.role),
      a.status,
      a.payment_status ?? '',
      a.experience_level ?? '',
      a.societies?.name ?? '',
      a.is_head_delegate ? 'Yes' : 'No',
      a.submitted_at ? formatDate(a.submitted_at) : '',
      a.assigned_committee_id ?? '',
      a.assigned_country_name ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conference?.acronym ?? 'applications'}-applications.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!conference) return null;

  const filtered = applications.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (roleFilter !== 'all' && a.role !== roleFilter) return false;
    if (paymentFilter === 'paid' && a.payment_status !== 'paid' && a.payment_status !== 'waived') return false;
    if (paymentFilter === 'waived' && a.payment_status !== 'waived') return false;
    if (paymentFilter === 'unpaid' && a.payment_status !== 'unpaid') return false;
    return true;
  });

  const stats = {
    total: applications.length,
    submitted: applications.filter(a => a.status === 'submitted').length,
    accepted: applications.filter(a => a.status === 'accepted').length,
    assigned: applications.filter(a => a.status === 'assigned').length,
  };

  const statItems = [
    { label: 'Total', value: stats.total },
    { label: 'Submitted', value: stats.submitted },
    { label: 'Accepted', value: stats.accepted },
    { label: 'Assigned', value: stats.assigned },
  ];

  return (
    <div className="px-6 md:px-10 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs mb-1" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.12em' }}>
            {conference.acronym} / Applications
          </p>
          <h1 className="font-black text-2xl" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Applications</h1>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 rounded-xl py-2 px-4 text-xs font-bold focus:outline-none transition-colors"
          style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          <Download size={13} />
          EXPORT CSV
        </button>
      </div>

      <DraftNoticeList
        notices={draftNotices}
        conferenceSlug={conference.slug}
        onDismiss={dismissDraftNotice}
        onTurnOn={async (eventKey) => {
          if (!session) return;
          const supabase = getAuthedClient(session.access_token);
          await turnOnDefaultEmail(supabase, conference.id, eventKey);
        }}
      />

      {actionError && (
        <p className="text-xs font-semibold mb-3" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
          {actionError}
        </p>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_FILTERS.map(f => (
          <FilterPill key={f.value} label={f.label} active={statusFilter === f.value} onClick={() => setStatusFilter(f.value)} />
        ))}
        <div className="w-px self-stretch" style={{ backgroundColor: '#DDD4C0', margin: '0 4px' }} />
        {ROLE_FILTERS.map(f => (
          <FilterPill key={f.value} label={f.label} active={roleFilter === f.value} onClick={() => setRoleFilter(f.value)} />
        ))}
        <div className="w-px self-stretch" style={{ backgroundColor: '#DDD4C0', margin: '0 4px' }} />
        {PAYMENT_FILTERS.map(f => (
          <FilterPill key={f.value} label={f.label} active={paymentFilter === f.value} onClick={() => setPaymentFilter(f.value)} />
        ))}
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-3 mb-6">
        {statItems.map(s => (
          <div key={s.label} className="rounded-xl px-4 py-2 text-center" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
            <p className="font-black text-lg" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
            <p style={{ fontSize: 10, color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.12em' }}>{s.label.toUpperCase()}</p>
          </div>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            {applications.length === 0 ? 'No applications yet' : 'No applications match these filters'}
          </p>
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            {applications.length === 0 ? 'Applications will appear here once delegates apply.' : 'Try adjusting your filters.'}
          </p>
        </div>
      )}

      {/* Application list */}
      {!loading && filtered.length > 0 && (
        <div className="flex flex-col gap-3">
          {filtered.map(app => {
            const name = app.profiles?.display_name ?? app.invited_name ?? 'Unknown';
            const email = app.profiles?.email ?? app.invited_email ?? '';
            const isDelegate = app.role === 'delegate' || app.role === 'head-delegate';
            const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order);

            const roleTone = app.role === 'delegate' || app.role === 'head-delegate'
              ? { bg: 'rgba(42,90,60,0.14)',   color: '#2A5A3C', border: 'rgba(42,90,60,0.38)' }
              : app.role === 'chair'
              ? { bg: 'rgba(182,135,31,0.16)', color: '#8A6614', border: 'rgba(182,135,31,0.42)' }
              : { bg: 'rgba(90,110,160,0.13)', color: '#4A5A85', border: 'rgba(90,110,160,0.35)' };
            const roleBadgeStyle: React.CSSProperties = {
              fontSize: 9,
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 800,
              letterSpacing: '0.08em',
              padding: '3px 9px',
              borderRadius: 999,
              backgroundColor: roleTone.bg,
              color: roleTone.color,
              border: `1px solid ${roleTone.border}`,
            };

            const statusColors: Record<string, { bg: string; color: string; border: string }> = {
              submitted: { bg: 'rgba(184,132,74,0.16)', color: '#9A6B2F', border: 'rgba(184,132,74,0.42)' },
              accepted:  { bg: 'rgba(61,122,82,0.17)',  color: '#2A5A3C', border: 'rgba(61,122,82,0.45)' },
              assigned:  { bg: 'rgba(238,217,138,0.35)', color: '#7A5A10', border: 'rgba(182,135,31,0.45)' },
              rejected:  { bg: 'rgba(139,32,32,0.12)',  color: '#8B2020', border: 'rgba(139,32,32,0.35)' },
            };
            const sc = statusColors[app.status] ?? { bg: 'rgba(154,138,120,0.12)', color: '#9A8A78', border: 'rgba(154,138,120,0.35)' };

            const paid = app.payment_status === 'paid';
            const waived = app.payment_status === 'waived';
            const expLabel = app.experience_level ?? app.profiles?.mun_experience_level ?? null;
            const confCount = app.user_id ? cvCounts[app.user_id] : undefined;

            const pledgeLine = app.pledge_type === 'delegation'
              ? `Pledged: ${app.spots_pledged ?? 0} delegation spots`
              : null;
            const rowBusy = busyIds.has(app.id);

            return (
              <div
                key={app.id}
                className="rounded-2xl flex overflow-hidden transition-colors"
                style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
              >
                {/* Photo band, fills the full height of the card's left edge */}
                <div className="flex-shrink-0 relative" style={{ width: 80, minHeight: 96 }}>
                  {app.profiles?.avatar_url ? (
                    <img src={app.profiles.avatar_url} alt={name} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: '#1B3828' }}>
                      <span className="font-black" style={{ color: '#EED98A', fontSize: 26, fontFamily: "'Outfit', sans-serif" }}>
                        {name.trim().charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="flex-1 min-w-0 p-5">
                {/* Row 1: name/email + badges */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{name}</p>
                    <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!app.user_id && <NotRegisteredChip />}
                    <span className="inline-flex items-center gap-1" style={roleBadgeStyle}>
                      <RoleIcon role={app.role} />
                      {roleLabel(app.role).toUpperCase()}
                    </span>
                    <span className="inline-flex items-center gap-1" style={{ ...roleBadgeStyle, backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                      <StatusIcon status={app.status} />
                      {app.status.toUpperCase()}
                    </span>
                    {waived ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(184,132,74,0.16)', color: '#9A6B2F', border: '1px solid rgba(184,132,74,0.42)', fontSize: 9, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}>
                        <HandCoins size={10} strokeWidth={2.5} />
                        WAIVED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 font-bold" style={{ fontSize: 10, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em', color: paid ? '#2A5A3C' : '#9A6B2F' }}>
                        {paid ? <CircleCheck size={11} strokeWidth={2.5} /> : <Clock size={11} strokeWidth={2.5} />}
                        {paid ? 'PAID' : 'UNPAID'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 2: meta info */}
                <div className="flex flex-wrap gap-3 mt-2" style={{ fontSize: 12, color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                  {app.societies?.name && (
                    <span className="flex items-center gap-1">
                      <Building2 size={12} />
                      {app.societies.name}
                    </span>
                  )}
                  {app.is_head_delegate && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(27,56,40,0.08)', color: '#1B3828', fontSize: 10, fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.06em' }}>
                      <Users size={10} strokeWidth={2.5} />
                      HEAD DEL.
                    </span>
                  )}
                  {expLabel && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                      title={confCount !== undefined ? `${confCount} conference${confCount === 1 ? '' : 's'} on their MUN CV` : undefined}
                      style={{ backgroundColor: 'rgba(238,217,138,0.28)', color: '#7A5A10', border: '1px solid rgba(182,135,31,0.35)', fontSize: 10, fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.06em', textTransform: 'capitalize', fontVariantNumeric: 'tabular-nums' }}
                    >
                      <GraduationCap size={11} strokeWidth={2.5} />
                      {expLabel}{confCount !== undefined ? ` (${confCount})` : ''}
                    </span>
                  )}
                  {app.submitted_at && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      Applied {formatDate(app.submitted_at)}
                    </span>
                  )}
                </div>

                {/* Row 2b: pledge */}
                {pledgeLine && (
                  <p className="flex items-center gap-1 text-xs mt-1" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                    <HandCoins size={12} />
                    {pledgeLine}{app.pledge_confirmed_at ? ' · received' : ''}
                  </p>
                )}

                {/* Row 3: preferences (delegates only), committee acronym + country flag */}
                {isDelegate && prefs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {prefs.slice(0, 2).map(p => (
                      <span
                        key={p.preference_order}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
                        title={`${p.conference_committees?.name ?? 'Unknown'}, ${p.country_name}`}
                        style={{ backgroundColor: 'rgba(27,56,40,0.06)', border: '1px solid rgba(27,56,40,0.1)', color: '#1C1410', fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}
                      >
                        {p.preference_order}. <span className="font-semibold">{committeeAbbr(p.conference_committees)}</span>
                        <CountryFlag name={p.country_name} code={p.country_code} size={14} />
                      </span>
                    ))}
                  </div>
                )}

                {/* Row 3b: assignment (assigned only), acronym + flag, full detail in tooltip */}
                {app.status === 'assigned' && (app.assigned_committee || app.assigned_country_name) && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold"
                      title={[app.assigned_committee?.name, (app.assigned_committee?.topics ?? []).join(', '), app.assigned_country_name].filter(Boolean).join('  ·  ')}
                      style={{ backgroundColor: 'rgba(238,217,138,0.28)', border: '1px solid rgba(182,135,31,0.35)', color: '#7A5A10', fontFamily: "'Outfit', sans-serif" }}
                    >
                      <MapPin size={11} strokeWidth={2.5} />
                      {committeeAbbr(app.assigned_committee)}
                      <CountryFlag name={app.assigned_country_name} code={app.assigned_country_code} size={14} />
                    </span>
                  </div>
                )}

                {/* Row 4: footer, review opens the modal with details + all actions */}
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #F0EDE6' }}>
                  <button
                    onClick={() => setReviewId(app.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                    style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <Eye size={13} />
                    REVIEW
                  </button>
                  {!app.user_id && (
                    <button
                      onClick={() => openDeleteRowConfirm(app)}
                      disabled={rowBusy}
                      title="Delete this unregistered applicant's row"
                      className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                      style={{
                        backgroundColor: 'rgba(139,32,32,0.08)', color: '#8B2020', border: '1px solid rgba(139,32,32,0.2)',
                        fontFamily: "'Outfit', sans-serif", opacity: rowBusy ? 0.5 : 1, cursor: rowBusy ? 'default' : 'pointer',
                      }}
                    >
                      <Trash2 size={13} />
                      DELETE ROW
                    </button>
                  )}
                  {app.status === 'rejected' && app.organizer_note && (
                    <span className="text-xs italic self-center" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                      &ldquo;{app.organizer_note}&rdquo;
                    </span>
                  )}
                </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review modal, application details, custom answers and all actions.
          Rendered before confirmModal so confirm dialogs (same z-50) stack on top. */}
      {(() => {
        const app = applications.find(a => a.id === reviewId);
        if (!app) return null;
        const name = app.profiles?.display_name ?? app.invited_name ?? 'Unknown';
        const email = app.profiles?.email ?? app.invited_email ?? '';
        const isDelegate = app.role === 'delegate' || app.role === 'head-delegate';
        const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order);
        const isRejecting = rejectingId === app.id;
        const paid = app.payment_status === 'paid';
        const waived = app.payment_status === 'waived';
        const expLabel = app.experience_level ?? app.profiles?.mun_experience_level ?? null;
        const confCount = app.user_id ? cvCounts[app.user_id] : undefined;
        const roleConfig = roleConfigs.find(rc => rc.role === app.role);
        const questions = roleConfig?.custom_questions ?? [];
        const answers = app.custom_answers ?? {};
        const closeReview = () => { setReviewId(null); setRejectingId(null); setRejectNote(''); };
        // Double-click guard, the row's controls grey out while its write is in flight.
        const rowBusy = busyIds.has(app.id);
        const busyStyle: React.CSSProperties = rowBusy ? { opacity: 0.5, pointerEvents: 'none' } : {};

        const showPaymentControls = app.status === 'accepted' || app.status === 'assigned' || app.status === 'submitted';
        const paymentControls = showPaymentControls ? (
          <>
            {!paid ? (
              <button
                onClick={() => handleMarkPaid(app)}
                disabled={rowBusy}
                className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                style={{ backgroundColor: 'rgba(61,122,82,0.12)', color: '#3D7A52', border: '1px solid rgba(61,122,82,0.3)', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
              >
                <CircleCheck size={13} />
                MARK PAID
              </button>
            ) : (
              <button
                onClick={() => handleMarkUnpaid(app)}
                disabled={rowBusy}
                className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                style={{ backgroundColor: 'rgba(184,132,74,0.12)', color: '#B8844A', border: '1px solid rgba(184,132,74,0.3)', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
              >
                <RotateCcw size={13} />
                MARK UNPAID
              </button>
            )}
            {app.payment_status === 'unpaid' && (
              <button
                onClick={() => handleWaive(app)}
                disabled={rowBusy}
                className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <HandCoins size={13} />
                WAIVE
              </button>
            )}
            {waived && (
              <button
                onClick={() => handleUndoWaive(app)}
                disabled={rowBusy}
                className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <RotateCcw size={13} />
                UNDO WAIVE
              </button>
            )}
          </>
        ) : null;

        const rejectControls = isRejecting ? (
          <div className="flex items-start gap-2 flex-1" style={{ minWidth: 260 }}>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              rows={2}
              placeholder="Optional note to delegate..."
              className="flex-1 rounded-lg px-3 py-2 text-xs outline-none resize-none"
              style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: "'Outfit', sans-serif" }}
            />
            <button
              onClick={() => openRejectConfirm(app)}
              disabled={rowBusy}
              className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none"
              style={{ backgroundColor: 'rgba(139,32,32,0.1)', color: '#8B2020', border: '1px solid rgba(139,32,32,0.2)', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
            >
              <Check size={13} />
              CONFIRM
            </button>
            <button
              onClick={() => { setRejectingId(null); setRejectNote(''); }}
              className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none"
              style={{ border: '1px solid #DDD4C0', color: '#9A8A78', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}
            >
              CANCEL
            </button>
          </div>
        ) : (
          <button
            onClick={() => setRejectingId(app.id)}
            className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
            style={{ backgroundColor: 'rgba(139,32,32,0.08)', color: '#8B2020', border: '1px solid rgba(139,32,32,0.2)', fontFamily: "'Outfit', sans-serif" }}
          >
            <X size={13} />
            REJECT
          </button>
        );

        // Withdraw (F: PART 2 item 1): accepted/assigned only, and only when
        // payment_status is 'unpaid' or 'waived'. Paid applicants must have
        // their payment handled first (refunds come with finances).
        const canWithdraw = app.payment_status !== 'paid';
        const withdrawControls = (
          <button
            onClick={() => { if (canWithdraw) openWithdrawConfirm(app); }}
            disabled={rowBusy || !canWithdraw}
            title={!canWithdraw ? 'Handle their payment before removing' : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
            style={{
              backgroundColor: 'rgba(139,32,32,0.08)', color: '#8B2020', border: '1px solid rgba(139,32,32,0.2)',
              fontFamily: "'Outfit', sans-serif",
              opacity: !canWithdraw ? 0.4 : rowBusy ? 0.5 : 1,
              cursor: !canWithdraw ? 'not-allowed' : rowBusy ? 'default' : 'pointer',
              pointerEvents: rowBusy ? 'none' : undefined,
            }}
          >
            <LogOut size={13} />
            REMOVE FROM CONFERENCE
          </button>
        );

        return (
          <Portal><div
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            onClick={closeReview}
          >
            <div
              className="w-full max-w-2xl rounded-2xl p-8 overflow-y-auto"
              style={{ maxHeight: '85vh', backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start gap-4 mb-5">
                {app.profiles?.avatar_url ? (
                  <img src={app.profiles.avatar_url} alt={name} className="rounded-xl object-cover flex-shrink-0" style={{ width: 56, height: 56 }} />
                ) : (
                  <div className="flex-shrink-0 flex items-center justify-center rounded-xl" style={{ width: 56, height: 56, backgroundColor: '#1B3828' }}>
                    <span className="font-black" style={{ color: '#EED98A', fontSize: 22, fontFamily: "'Outfit', sans-serif" }}>
                      {name.trim().charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="font-black text-lg truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{name}</h2>
                  <p className="text-xs truncate mb-1.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{email}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {!app.user_id && <NotRegisteredChip />}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold" style={{ fontSize: 9, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', backgroundColor: 'rgba(27,56,40,0.08)', color: '#1B3828', border: '1px solid rgba(27,56,40,0.18)' }}>
                      <RoleIcon role={app.role} />
                      {roleLabel(app.role).toUpperCase()}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold" style={{ fontSize: 9, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', backgroundColor: 'rgba(154,138,120,0.12)', color: '#6B5F52', border: '1px solid rgba(154,138,120,0.35)' }}>
                      <StatusIcon status={app.status} />
                      {app.status.toUpperCase()}
                    </span>
                    {expLabel && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold"
                        title={confCount !== undefined ? `${confCount} conference${confCount === 1 ? '' : 's'} on their MUN CV` : undefined}
                        style={{ fontSize: 9, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', backgroundColor: 'rgba(238,217,138,0.28)', color: '#7A5A10', border: '1px solid rgba(182,135,31,0.35)', textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums' }}
                      >
                        <GraduationCap size={10} strokeWidth={2.5} />
                        {expLabel}{confCount !== undefined ? ` (${confCount})` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={closeReview}
                  aria-label="Close review"
                  className="flex-shrink-0 flex items-center justify-center rounded-lg focus:outline-none transition-colors"
                  style={{ width: 30, height: 30, border: '1px solid #DDD4C0', color: '#9A8A78', backgroundColor: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Nationality */}
              {app.profiles?.nationality && (
                <p className="flex items-center gap-2 text-xs mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                  <Globe size={12} />
                  <span style={{ fontWeight: 700, letterSpacing: '0.12em' }}>NATIONALITY</span>
                  <CountryFlag name={app.profiles.nationality} size={16} />
                </p>
              )}

              {/* Preferences (delegates), full list */}
              {isDelegate && prefs.length > 0 && (
                <div className="mb-4">
                  <p className="flex items-center gap-2 text-xs mb-2" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.12em' }}>
                    <MapPin size={12} />
                    PREFERENCES
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {prefs.map(p => (
                      <span
                        key={p.preference_order}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
                        title={`${p.conference_committees?.name ?? 'Unknown'}, ${p.country_name}`}
                        style={{ backgroundColor: 'rgba(27,56,40,0.06)', border: '1px solid rgba(27,56,40,0.1)', color: '#1C1410', fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}
                      >
                        {p.preference_order}. <span className="font-semibold">{committeeAbbr(p.conference_committees)}</span>
                        <CountryFlag name={p.country_name} code={p.country_code} size={14} />
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Assignment (assigned) */}
              {app.status === 'assigned' && app.assigned_country_name && (
                <p className="flex items-center gap-2 text-xs mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                  <BadgeCheck size={12} />
                  <span style={{ fontWeight: 700, letterSpacing: '0.12em' }}>ASSIGNED</span>
                  <span style={{ color: '#1C1410' }}>
                    {[app.assigned_committee?.name, (app.assigned_committee?.topics ?? []).join(', ')].filter(Boolean).join('  ·  ')}
                  </span>
                  <CountryFlag name={app.assigned_country_name} code={app.assigned_country_code} size={14} />
                </p>
              )}

              {/* Rejection note (rejected) */}
              {app.status === 'rejected' && app.organizer_note && (
                <p className="text-xs italic mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                  &ldquo;{app.organizer_note}&rdquo;
                </p>
              )}

              {/* Custom answers */}
              <div className="pt-4" style={{ borderTop: '1px solid #F0EDE6' }}>
                <p className="flex items-center gap-2 text-xs mb-3" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.12em' }}>
                  <MessageSquareText size={12} />
                  APPLICATION ANSWERS
                </p>
                {questions.length === 0 ? (
                  <p className="text-xs italic" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                    No custom questions configured for this role.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {questions.map(q => {
                      const ans = (answers[q.id] ?? '').trim();
                      return (
                        <div key={q.id}>
                          <p className="text-xs font-semibold mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{q.label}</p>
                          <p className="text-sm whitespace-pre-wrap" style={{ color: ans ? '#1C1410' : '#9A8A78', fontFamily: "'Outfit', sans-serif", fontStyle: ans ? 'normal' : 'italic' }}>
                            {ans || 'No answer provided.'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              {actionError && (
                <p className="text-xs font-semibold mt-4" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>
                  {actionError}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-4 pt-4" style={{ borderTop: '1px solid #F0EDE6' }}>
                {app.status === 'submitted' && (
                  <>
                    <button
                      onClick={() => handleAccept(app.id)}
                      disabled={rowBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                      style={{ backgroundColor: 'rgba(61,122,82,0.12)', color: '#3D7A52', border: '1px solid rgba(61,122,82,0.3)', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
                    >
                      <Check size={13} />
                      ACCEPT
                    </button>
                    {paymentControls}
                    {rejectControls}
                  </>
                )}

                {app.status === 'accepted' && (
                  <>
                    {isDelegate && (
                      <Link
                        href={`/manage/${conference.slug}/assignment`}
                        className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none"
                        style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", textDecoration: 'none' }}
                      >
                        ASSIGN
                        <ArrowRight size={13} />
                      </Link>
                    )}
                    {paymentControls}
                    {rejectControls}
                    {withdrawControls}
                  </>
                )}

                {app.status === 'assigned' && (
                  <>
                    {paymentControls}
                    {withdrawControls}
                  </>
                )}

                {app.status === 'rejected' && (
                  <button
                    onClick={() => handleReinstate(app.id)}
                    disabled={rowBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                    style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <RotateCcw size={13} />
                    REINSTATE
                  </button>
                )}

                {app.status === 'withdrawn' && (
                  <button
                    onClick={() => handleReinstateFromWithdrawn(app.id)}
                    disabled={rowBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                    style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <RotateCcw size={13} />
                    REINSTATE
                  </button>
                )}
              </div>
            </div>
          </div></Portal>
        );
      })()}

      {confirmModal}
    </div>
  );
}
