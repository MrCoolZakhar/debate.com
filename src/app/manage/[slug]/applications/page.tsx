'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowRight, BadgeCheck, Building2, Cake, CalendarDays, Check, CircleCheck, Clock,
  Download, Eye, Filter, Gavel, Globe, GraduationCap, HandCoins, Inbox, LogOut, MapPin,
  MessageSquareText, RotateCcw, SlidersHorizontal, Trash2, Undo2, User, UserRoundCheck,
  Users, X,
} from 'lucide-react';
import Link from 'next/link';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { queueEventEmail, notifyIfNeeded, turnOnDefaultEmail } from '@/lib/emailEvents';
import { useDraftNotices, DraftNoticeList } from '@/components/DraftNotice';
import { useConfirmModal } from '@/components/ConfirmModal';
import { FlagImg } from '@/components/FlagImg';
import { LogoDisc } from '@/components/LogoDisc';
import Portal from '@/components/Portal';
import { getCountryByName } from '@/lib/countries';
import { ageAt } from '@/lib/age';
import { checkInApplication, undoCheckIn } from '@/lib/checkIn';
import {
  NEU, NEU_GRADIENTS, OUTFIT, NeuCard, NeuStatTile, NeuIconDisc,
} from '@/components/neu';
import {
  poolForRole, fillFreeSpots, releasePoolSpot, POOL_SPOTS_COLUMN, MemberAvatar,
} from '@/app/manage/[slug]/assignment/delegationShared';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppPreference {
  preference_order: number;
  conference_committee_id: string;
  country_code: string;
  country_name: string;
  conference_committees: { name: string; abbreviation: string | null; logo_url: string | null } | null;
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
  checked_in_at: string | null;
  organizer_note: string | null;
  resubmitted_at: string | null;
  custom_answers: Record<string, string> | null;
  assigned_committee_id: string | null;
  assigned_country_code: string | null;
  assigned_country_name: string | null;
  assigned_committee: { name: string; abbreviation: string | null; topics: string[] | null; logo_url: string | null } | null;
  profiles: { display_name: string; email: string; avatar_url: string | null; nationality: string | null; date_of_birth: string | null; mun_experience_level: string | null } | null;
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
    : status === 'checked-in' ? UserRoundCheck
    : status === 'rejected' ? X
    : status === 'withdrawn' ? LogOut
    : Clock;
  return <Icon size={size} strokeWidth={2.5} />;
}

/** Full committee label, "Full Name - ACRONYM" when an abbreviation is set and
 *  differs from the name, else just the name. Used in the row's allocation cell
 *  alongside the LogoDisc emblem. */
function committeeFull(c: { name: string; abbreviation: string | null } | null | undefined): string {
  if (!c) return '';
  if (c.abbreviation && c.abbreviation.toUpperCase() !== c.name.toUpperCase()) {
    return `${c.name} - ${c.abbreviation}`;
  }
  return c.name;
}

/** Forest/ivory tone triplet for each status pill. checked-in gets its own
 *  distinct teal so a filled committee reads apart from a plain assignment. */
const STATUS_TONES: Record<string, { bg: string; color: string; border: string }> = {
  submitted:    { bg: 'rgba(184,132,74,0.16)', color: '#9A6B2F', border: 'rgba(184,132,74,0.42)' },
  accepted:     { bg: 'rgba(61,122,82,0.17)',  color: '#2A5A3C', border: 'rgba(61,122,82,0.45)' },
  assigned:     { bg: 'rgba(238,217,138,0.35)', color: '#7A5A10', border: 'rgba(182,135,31,0.45)' },
  'checked-in': { bg: 'rgba(31,110,82,0.16)',  color: '#1F6E52', border: 'rgba(31,110,82,0.45)' },
  rejected:     { bg: 'rgba(139,32,32,0.12)',  color: '#8B2020', border: 'rgba(139,32,32,0.35)' },
  withdrawn:    { bg: 'rgba(154,138,120,0.14)', color: '#6B5F52', border: 'rgba(154,138,120,0.38)' },
};

function statusTone(status: string) {
  return STATUS_TONES[status] ?? { bg: 'rgba(154,138,120,0.12)', color: '#9A8A78', border: 'rgba(154,138,120,0.35)' };
}

/** Short relative-ish timestamp for the "Checked in …" line. */
function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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

const STATUS_OPTIONS = [
  { label: 'Submitted', value: 'submitted' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Assigned', value: 'assigned' },
  { label: 'Checked In', value: 'checked-in' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Withdrawn', value: 'withdrawn' },
];

const ROLE_OPTIONS = [
  { label: 'Delegates', value: 'delegate' },
  { label: 'Chairs', value: 'chair' },
  { label: 'Head Delegates', value: 'head-delegate' },
  { label: 'Faculty Advisors', value: 'faculty-advisor' },
  { label: 'Observers', value: 'observer' },
];

const PAYMENT_OPTIONS = [
  { label: 'Paid', value: 'paid' },
  { label: 'Unpaid', value: 'unpaid' },
  { label: 'Waived', value: 'waived' },
];

// ── Filter panel ──────────────────────────────────────────────────────────────
// Peter: "the filters could be more of a hover and they appear". A single
// neumorphic FILTERS control reveals the whole rich set on hover (and can be
// pinned open with a click); empty selections mean "no constraint" so a fresh
// page shows everything.

interface FilterState {
  status: Set<string>;
  role: Set<string>;
  payment: Set<string>;
  dateFrom: string;
  dateTo: string;
}

function toggleIn(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

/** A small pressed-in checkbox chip inside the filter panel. */
function CheckChip({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 focus:outline-none"
      style={{
        padding: '5px 11px',
        borderRadius: 999,
        fontFamily: OUTFIT,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.02em',
        color: checked ? '#FFFFFF' : NEU.ink,
        background: checked ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : NEU.surface,
        boxShadow: checked ? `0 3px 8px ${NEU_GRADIENTS.forest[0]}44, ${NEU.outSm}` : NEU.outSm,
        border: 'none',
        cursor: 'pointer',
        transition: `box-shadow 180ms ${EASE_LOCAL}`,
      }}
    >
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: 13, height: 13, borderRadius: 4,
          background: checked ? 'rgba(255,255,255,0.9)' : NEU.base,
          boxShadow: checked ? 'none' : NEU.inSm,
        }}
      >
        {checked && <Check size={10} strokeWidth={3.5} style={{ color: NEU.forest }} />}
      </span>
      {label}
    </button>
  );
}

const EASE_LOCAL = 'cubic-bezier(0.22,1,0.36,1)';

function FilterGroup({
  title, options, selected, onToggle, onAll, onNone,
}: {
  title: string;
  options: { label: string; value: string }[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onAll: () => void;
  onNone: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: NEU.muted, textTransform: 'uppercase' }}>
          {title}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={onAll} className="focus:outline-none" style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color: NEU.forest, background: 'none', border: 'none', cursor: 'pointer' }}>ALL</button>
          <span style={{ color: NEU.muted, opacity: 0.5 }}>·</span>
          <button onClick={onNone} className="focus:outline-none" style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color: NEU.muted, background: 'none', border: 'none', cursor: 'pointer' }}>NONE</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <CheckChip key={o.value} label={o.label} checked={selected.has(o.value)} onClick={() => onToggle(o.value)} />
        ))}
      </div>
    </div>
  );
}

function FilterPanel({
  filters, setFilters, activeCount,
}: {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = open || pinned;
  const clearTimer = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } };
  const scheduleClose = () => { clearTimer(); closeTimer.current = setTimeout(() => setOpen(false), 160); };

  const dateInputStyle: React.CSSProperties = {
    fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600, color: NEU.ink,
    backgroundColor: NEU.base, boxShadow: NEU.inSm, borderRadius: 10,
    border: 'none', padding: '7px 10px', outline: 'none', width: '100%',
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => { clearTimer(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <button
        onClick={() => setPinned(p => !p)}
        className="inline-flex items-center gap-2 focus:outline-none"
        style={{
          padding: '9px 16px',
          borderRadius: 999,
          fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.03em',
          color: show ? '#FFFFFF' : NEU.ink,
          background: show ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : NEU.surface,
          boxShadow: show ? `0 4px 10px ${NEU_GRADIENTS.forest[0]}44, ${NEU.outSm}` : NEU.outSm,
          border: 'none', cursor: 'pointer',
          transition: `box-shadow 200ms ${EASE_LOCAL}`,
        }}
      >
        <SlidersHorizontal size={14} strokeWidth={2.5} />
        FILTERS
        {activeCount > 0 && (
          <span
            className="inline-flex items-center justify-center"
            style={{
              minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
              fontFamily: OUTFIT, fontSize: 10, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
              color: show ? NEU.forest : '#FFFFFF',
              background: show ? NEU.gold : NEU.forest,
            }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {show && (
        <div
          className="absolute z-40"
          style={{
            top: 'calc(100% + 10px)', left: 0, width: 340,
            backgroundColor: NEU.surface, borderRadius: 20, boxShadow: NEU.out,
            padding: 18,
            animation: `neuFadeIn 200ms ${EASE_LOCAL}`,
          }}
        >
          <style>{`@keyframes neuFadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Filter} size={26} />
              <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 900, color: NEU.ink }}>Filter applications</p>
            </div>
            {activeCount > 0 && (
              <button
                onClick={() => setFilters({ status: new Set(), role: new Set(), payment: new Set(), dateFrom: '', dateTo: '' })}
                className="focus:outline-none"
                style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: '#8B2020', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                CLEAR ALL
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <FilterGroup
              title="Status" options={STATUS_OPTIONS} selected={filters.status}
              onToggle={v => setFilters(f => ({ ...f, status: toggleIn(f.status, v) }))}
              onAll={() => setFilters(f => ({ ...f, status: new Set(STATUS_OPTIONS.map(o => o.value)) }))}
              onNone={() => setFilters(f => ({ ...f, status: new Set() }))}
            />
            <FilterGroup
              title="Participants" options={ROLE_OPTIONS} selected={filters.role}
              onToggle={v => setFilters(f => ({ ...f, role: toggleIn(f.role, v) }))}
              onAll={() => setFilters(f => ({ ...f, role: new Set(ROLE_OPTIONS.map(o => o.value)) }))}
              onNone={() => setFilters(f => ({ ...f, role: new Set() }))}
            />
            <FilterGroup
              title="Payment" options={PAYMENT_OPTIONS} selected={filters.payment}
              onToggle={v => setFilters(f => ({ ...f, payment: toggleIn(f.payment, v) }))}
              onAll={() => setFilters(f => ({ ...f, payment: new Set(PAYMENT_OPTIONS.map(o => o.value)) }))}
              onNone={() => setFilters(f => ({ ...f, payment: new Set() }))}
            />
            <div>
              <p className="mb-2" style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: NEU.muted, textTransform: 'uppercase' }}>
                Submitted between
              </p>
              <div className="flex items-center gap-2">
                <input type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} style={dateInputStyle} />
                <ArrowRight size={13} style={{ color: NEU.muted, flexShrink: 0 }} />
                <input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} style={dateInputStyle} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ApplicationsPage ──────────────────────────────────────────────────────────

export default function ApplicationsPage() {
  const { conference } = useManage();
  const { session } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    status: new Set(), role: new Set(), payment: new Set(), dateFrom: '', dateTo: '',
  });
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
          payment_status, submitted_at, checked_in_at, organizer_note, resubmitted_at, custom_answers,
          assigned_committee_id, assigned_country_code, assigned_country_name,
          self_paid, attending, pledge_type, spots_pledged, pledge_confirmed_at, society_id,
          assigned_committee:conference_committees!assigned_committee_id (name, abbreviation, topics, logo_url),
          profiles (display_name, email, avatar_url, nationality, date_of_birth, mun_experience_level),
          societies (name),
          application_preferences (
            preference_order, conference_committee_id, country_code, country_name,
            conference_committees (name, abbreviation, logo_url)
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

  // ── Check-in (on-site attendance) ──────────────────────────────────────────
  // Optimistic like every other row action: flip to 'checked-in' immediately,
  // write via the shared checkIn helper, exact rollback on error. checked_in_at
  // is set to a client timestamp for the instant "Checked in …" line; the
  // helper computes its own server-side value, close enough for display.
  function handleCheckIn(app: Application) {
    if (!session || busyIds.has(app.id)) return;
    const prevRow = applications.find(a => a.id === app.id) ?? app;

    setActionError('');
    markBusy(app.id, true);
    applyRow(app.id, { status: 'checked-in', checked_in_at: new Date().toISOString() });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await checkInApplication(supabase, app.id);
      if (error) throw new Error(error);
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not check in that attendee. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(app.id, false));
  }

  function handleUndoCheckIn(app: Application) {
    if (!session || busyIds.has(app.id)) return;
    const prevRow = applications.find(a => a.id === app.id) ?? app;
    // Restore whichever state they were in before arriving: assigned when they
    // hold a committee allocation, otherwise accepted.
    const revertTo: 'assigned' | 'accepted' = app.assigned_committee_id ? 'assigned' : 'accepted';

    setActionError('');
    markBusy(app.id, true);
    applyRow(app.id, { status: revertTo, checked_in_at: null });

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error } = await undoCheckIn(supabase, app.id, revertTo);
      if (error) throw new Error(error);
    })()
      .catch(() => {
        restoreRow(prevRow);
        setActionError('Could not undo that check-in. The change was reverted. Please try again.');
      })
      .finally(() => markBusy(app.id, false));
  }

  function handleExportCSV() {
    const headers = ['Name', 'Email', 'Age', 'Nationality', 'Role', 'Status', 'Payment', 'Experience', 'Society', 'Head Delegate', 'Submitted', 'Checked In', 'Assigned Committee', 'Assigned Country'];
    const rows = applications.map(a => [
      a.profiles?.display_name ?? a.invited_name ?? '',
      a.profiles?.email ?? a.invited_email ?? '',
      ageAt(a.profiles?.date_of_birth) ?? '',
      a.profiles?.nationality ?? '',
      roleLabel(a.role),
      a.status,
      a.payment_status ?? '',
      a.experience_level ?? '',
      a.societies?.name ?? '',
      a.is_head_delegate ? 'Yes' : 'No',
      a.submitted_at ? formatDate(a.submitted_at) : '',
      a.checked_in_at ? formatDate(a.checked_in_at) : '',
      a.assigned_committee?.name ?? '',
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

  // Empty selection = no constraint on that dimension (fresh page shows all).
  const filtered = applications.filter(a => {
    if (filters.status.size > 0 && !filters.status.has(a.status)) return false;
    if (filters.role.size > 0 && !filters.role.has(a.role)) return false;
    if (filters.payment.size > 0) {
      const ps = a.payment_status;
      const match =
        (filters.payment.has('paid') && ps === 'paid') ||
        (filters.payment.has('waived') && ps === 'waived') ||
        (filters.payment.has('unpaid') && (ps === 'unpaid' || ps == null));
      if (!match) return false;
    }
    if (filters.dateFrom && a.submitted_at && a.submitted_at.slice(0, 10) < filters.dateFrom) return false;
    if (filters.dateTo && a.submitted_at && a.submitted_at.slice(0, 10) > filters.dateTo) return false;
    return true;
  });

  const activeFilterCount =
    (filters.status.size > 0 ? 1 : 0) +
    (filters.role.size > 0 ? 1 : 0) +
    (filters.payment.size > 0 ? 1 : 0) +
    (filters.dateFrom || filters.dateTo ? 1 : 0);

  const stats = {
    total: applications.length,
    submitted: applications.filter(a => a.status === 'submitted').length,
    accepted: applications.filter(a => a.status === 'accepted').length,
    assigned: applications.filter(a => a.status === 'assigned').length,
    checkedIn: applications.filter(a => a.status === 'checked-in').length,
    paid: applications.filter(a => a.payment_status === 'paid').length,
  };

  const statItems: { label: string; value: number; emoji: string; icon: typeof Inbox; gradient: [string, string] }[] = [
    { label: 'Total',      value: stats.total,     emoji: 'Card index',            icon: Users,          gradient: NEU_GRADIENTS.forest },
    { label: 'Submitted',  value: stats.submitted, emoji: 'Inbox tray',            icon: Inbox,          gradient: NEU_GRADIENTS.amber },
    { label: 'Accepted',   value: stats.accepted,  emoji: 'Check mark button',     icon: Check,          gradient: NEU_GRADIENTS.green },
    { label: 'Assigned',   value: stats.assigned,  emoji: 'Round pushpin',         icon: BadgeCheck,     gradient: NEU_GRADIENTS.gold },
    { label: 'Checked in', value: stats.checkedIn, emoji: 'Person raising hand',   icon: UserRoundCheck, gradient: NEU_GRADIENTS.sage },
    { label: 'Paid',       value: stats.paid,      emoji: 'Money bag',             icon: CircleCheck,    gradient: NEU_GRADIENTS.green },
  ];

  return (
    <div className="px-6 md:px-10 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <p className="mb-1" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: NEU.deepGold, textTransform: 'uppercase' }}>
            {conference.acronym} · Applications
          </p>
          <h1 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 26, color: NEU.ink, letterSpacing: '-0.01em' }}>Applications</h1>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <FilterPanel filters={filters} setFilters={setFilters} activeCount={activeFilterCount} />
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 focus:outline-none"
            style={{
              padding: '9px 16px', borderRadius: 999,
              fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.03em',
              color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm, border: 'none', cursor: 'pointer',
            }}
          >
            <Download size={14} strokeWidth={2.5} />
            EXPORT CSV
          </button>
        </div>
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
        <p className="text-xs font-semibold mb-3" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
          {actionError}
        </p>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
        {statItems.map(s => (
          <NeuStatTile key={s.label} emoji={s.emoji} icon={s.icon} gradient={s.gradient} value={s.value} label={s.label} compact />
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <NeuCard style={{ padding: '48px 24px' }}>
          <div className="flex flex-col items-center text-center">
            <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Inbox} emoji="Inbox tray" size={48} />
            <p className="mt-4" style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 15, color: NEU.ink }}>
              {applications.length === 0 ? 'No applications yet' : 'No applications match these filters'}
            </p>
            <p className="mt-1" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted }}>
              {applications.length === 0 ? 'Applications will appear here once delegates apply.' : 'Try adjusting your filters.'}
            </p>
          </div>
        </NeuCard>
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

            const sc = statusTone(app.status);
            const paid = app.payment_status === 'paid';
            const waived = app.payment_status === 'waived';
            const expLabel = app.experience_level ?? app.profiles?.mun_experience_level ?? null;
            const confCount = app.user_id ? cvCounts[app.user_id] : undefined;
            const age = ageAt(app.profiles?.date_of_birth);
            const nationality = app.profiles?.nationality ?? null;

            const pledgeLine = app.pledge_type === 'delegation'
              ? `Pledged ${app.spots_pledged ?? 0} delegation spots`
              : null;
            const rowBusy = busyIds.has(app.id);
            const busyStyle: React.CSSProperties = rowBusy ? { opacity: 0.5, pointerEvents: 'none' } : {};
            const hasAllocation = !!app.assigned_committee && (app.status === 'assigned' || app.status === 'checked-in');
            const canCheckIn = app.status === 'accepted' || app.status === 'assigned';

            const factStyle: React.CSSProperties = {
              fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600, color: NEU.muted,
              fontVariantNumeric: 'tabular-nums',
            };
            const chip = (bg: string, color: string, border: string): React.CSSProperties => ({
              fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
              padding: '3px 9px', borderRadius: 999, backgroundColor: bg, color, border: `1px solid ${border}`,
              whiteSpace: 'nowrap',
            });

            return (
              <NeuCard key={app.id} hover style={{ padding: 0, overflow: 'hidden' }}>
                <div className="flex flex-col lg:flex-row lg:items-stretch">

                  {/* LEFT · identity + facts */}
                  <div className="flex items-start gap-3.5 p-4 lg:p-5" style={{ flex: '1.1 1 300px', minWidth: 0 }}>
                    <MemberAvatar name={name} url={app.profiles?.avatar_url ?? null} size={50} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: NEU.ink, maxWidth: '100%' }}>{name}</p>
                        {!app.user_id && <NotRegisteredChip />}
                        {app.is_head_delegate && (
                          <span className="inline-flex items-center gap-1" style={chip('rgba(27,56,40,0.1)', NEU.forest, 'rgba(27,56,40,0.2)')}>
                            <Users size={9} strokeWidth={2.5} />
                            HEAD DEL.
                          </span>
                        )}
                      </div>
                      {email && <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted, marginTop: 1 }}>{email}</p>}

                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                        {age !== null && (
                          <span className="inline-flex items-center gap-1" style={factStyle}>
                            <Cake size={12} strokeWidth={2.2} style={{ color: NEU.deepGold }} />
                            {age} yrs old
                          </span>
                        )}
                        {nationality && (
                          <span className="inline-flex items-center gap-1" style={factStyle} title={nationality}>
                            <CountryFlag name={nationality} size={13} />
                            <span className="truncate" style={{ maxWidth: 120 }}>{nationality}</span>
                          </span>
                        )}
                        {app.submitted_at && (
                          <span className="inline-flex items-center gap-1" style={factStyle}>
                            <CalendarDays size={12} strokeWidth={2.2} style={{ color: NEU.muted }} />
                            {formatDate(app.submitted_at)}
                          </span>
                        )}
                        {app.societies?.name && (
                          <span className="inline-flex items-center gap-1" style={factStyle} title={app.societies.name}>
                            <Building2 size={12} strokeWidth={2.2} style={{ color: NEU.muted }} />
                            <span className="truncate" style={{ maxWidth: 150 }}>{app.societies.name}</span>
                          </span>
                        )}
                      </div>

                      {(expLabel || pledgeLine) && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {expLabel && (
                            <span
                              className="inline-flex items-center gap-1"
                              title={confCount !== undefined ? `${confCount} conference${confCount === 1 ? '' : 's'} on their MUN CV` : undefined}
                              style={{ ...chip('rgba(238,217,138,0.28)', '#7A5A10', 'rgba(182,135,31,0.35)'), textTransform: 'capitalize', fontVariantNumeric: 'tabular-nums' }}
                            >
                              <GraduationCap size={10} strokeWidth={2.5} />
                              {expLabel}{confCount !== undefined ? ` · ${confCount}` : ''}
                            </span>
                          )}
                          {pledgeLine && (
                            <span className="inline-flex items-center gap-1" style={{ ...chip('rgba(27,56,40,0.06)', NEU.forest, 'rgba(27,56,40,0.14)'), fontVariantNumeric: 'tabular-nums' }}>
                              <HandCoins size={10} strokeWidth={2.5} />
                              {pledgeLine}{app.pledge_confirmed_at ? ' · received' : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* MIDDLE · role + allocation / preferences */}
                  <div
                    className="p-4 lg:p-5 flex flex-col justify-center gap-2.5 border-t lg:border-t-0 lg:border-l"
                    style={{ flex: '1 1 260px', minWidth: 0, borderColor: 'rgba(221,212,192,0.6)' }}
                  >
                    <span className="inline-flex items-center gap-1 self-start" style={chip(roleTone.bg, roleTone.color, roleTone.border)}>
                      <RoleIcon role={app.role} />
                      {roleLabel(app.role).toUpperCase()}
                    </span>
                    {hasAllocation ? (
                      <div className="flex items-center gap-2.5 min-w-0">
                        <LogoDisc src={app.assigned_committee!.logo_url} size={32} fallbackText={committeeAbbr(app.assigned_committee)} alt={app.assigned_committee!.name} />
                        <div className="min-w-0">
                          <p className="truncate" title={committeeFull(app.assigned_committee)} style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink }}>
                            {committeeFull(app.assigned_committee)}
                          </p>
                          {app.assigned_country_name && (
                            <span className="inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: NEU.muted }}>
                              <CountryFlag name={app.assigned_country_name} code={app.assigned_country_code} size={14} />
                              {app.assigned_country_name}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : isDelegate && prefs.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        <p style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: NEU.muted, textTransform: 'uppercase' }}>Preferences</p>
                        <div className="flex flex-wrap gap-1.5">
                          {prefs.slice(0, 3).map(p => (
                            <span
                              key={p.preference_order}
                              className="inline-flex items-center gap-1.5"
                              title={`${p.conference_committees?.name ?? 'Unknown'} · ${p.country_name}`}
                              style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: NEU.ink, backgroundColor: NEU.base, boxShadow: NEU.inSm, borderRadius: 999, padding: '3px 9px', fontVariantNumeric: 'tabular-nums' }}
                            >
                              <span style={{ color: NEU.muted }}>{p.preference_order}.</span>
                              {committeeAbbr(p.conference_committees)}
                              <CountryFlag name={p.country_name} code={p.country_code} size={13} />
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontStyle: 'italic', color: NEU.muted }}>
                        {isDelegate ? 'Not yet assigned' : '—'}
                      </span>
                    )}

                    {app.status === 'rejected' && app.organizer_note && (
                      <span className="truncate" title={app.organizer_note} style={{ fontFamily: OUTFIT, fontSize: 11, fontStyle: 'italic', color: NEU.muted }}>
                        &ldquo;{app.organizer_note}&rdquo;
                      </span>
                    )}
                  </div>

                  {/* RIGHT · status/payment + actions */}
                  <div
                    className="p-4 lg:p-5 flex flex-col lg:items-end gap-2.5 justify-center border-t lg:border-t-0 lg:border-l"
                    style={{ flex: '0 0 auto', borderColor: 'rgba(221,212,192,0.6)' }}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap lg:justify-end">
                      <span className="inline-flex items-center gap-1" style={chip(sc.bg, sc.color, sc.border)}>
                        <StatusIcon status={app.status} />
                        {app.status.replace('-', ' ').toUpperCase()}
                      </span>
                      {app.resubmitted_at && (
                        <span
                          className="inline-flex items-center gap-1"
                          title="The applicant edited and resubmitted this application"
                          style={chip('rgba(182,135,31,0.18)', '#8A6614', 'rgba(182,135,31,0.4)')}
                        >
                          <RotateCcw size={10} strokeWidth={2.5} />
                          RESUBMITTED {formatDate(app.resubmitted_at)}
                        </span>
                      )}
                      {waived ? (
                        <span className="inline-flex items-center gap-1" style={chip('rgba(184,132,74,0.16)', '#9A6B2F', 'rgba(184,132,74,0.42)')}>
                          <HandCoins size={10} strokeWidth={2.5} />
                          WAIVED
                        </span>
                      ) : paid ? (
                        <span className="inline-flex items-center gap-1" style={chip('rgba(61,122,82,0.17)', '#2A5A3C', 'rgba(61,122,82,0.45)')}>
                          <CircleCheck size={10} strokeWidth={2.5} />
                          PAID
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1" style={chip('rgba(184,132,74,0.12)', '#9A6B2F', 'rgba(184,132,74,0.3)')}>
                          <Clock size={10} strokeWidth={2.5} />
                          UNPAID
                        </span>
                      )}
                    </div>

                    {app.status === 'checked-in' && app.checked_in_at && (
                      <span className="inline-flex items-center gap-1" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 600, color: '#1F6E52', fontVariantNumeric: 'tabular-nums' }}>
                        <UserRoundCheck size={11} strokeWidth={2.5} />
                        Checked in {formatDateTime(app.checked_in_at)}
                      </span>
                    )}

                    <div className="flex items-center gap-1.5 flex-wrap lg:justify-end">
                      {canCheckIn && (
                        <button
                          onClick={() => handleCheckIn(app)}
                          disabled={rowBusy}
                          className="inline-flex items-center gap-1.5 focus:outline-none"
                          style={{
                            padding: '7px 14px', borderRadius: 999,
                            fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                            color: '#FFFFFF',
                            background: `linear-gradient(135deg, ${NEU_GRADIENTS.sage[0]}, ${NEU_GRADIENTS.sage[1]})`,
                            boxShadow: `0 3px 8px ${NEU_GRADIENTS.sage[0]}44, ${NEU.outSm}`,
                            border: 'none', cursor: 'pointer', ...busyStyle,
                          }}
                        >
                          <UserRoundCheck size={13} strokeWidth={2.6} />
                          CHECK IN
                        </button>
                      )}
                      {app.status === 'checked-in' && (
                        <button
                          onClick={() => handleUndoCheckIn(app)}
                          disabled={rowBusy}
                          className="inline-flex items-center gap-1.5 focus:outline-none"
                          style={{
                            padding: '7px 13px', borderRadius: 999,
                            fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                            color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm, border: 'none', cursor: 'pointer', ...busyStyle,
                          }}
                        >
                          <Undo2 size={12} strokeWidth={2.5} />
                          UNDO
                        </button>
                      )}
                      <button
                        onClick={() => setReviewId(app.id)}
                        className="inline-flex items-center gap-1.5 focus:outline-none"
                        style={{
                          padding: '7px 14px', borderRadius: 999,
                          fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                          color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm, border: 'none', cursor: 'pointer',
                        }}
                      >
                        <Eye size={13} strokeWidth={2.5} />
                        REVIEW
                      </button>
                      {!app.user_id && (
                        <button
                          onClick={() => openDeleteRowConfirm(app)}
                          disabled={rowBusy}
                          title="Delete this unregistered applicant's row"
                          className="inline-flex items-center justify-center focus:outline-none"
                          style={{
                            width: 32, height: 32, borderRadius: 999,
                            color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.2)',
                            cursor: rowBusy ? 'default' : 'pointer', ...busyStyle,
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </NeuCard>
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

        const showPaymentControls = app.status === 'accepted' || app.status === 'assigned' || app.status === 'submitted' || app.status === 'checked-in';
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

        // Check-in controls: mark on-site attendance (accepted/assigned) or
        // reverse it (checked-in). Same optimistic handlers as the row buttons.
        const checkInControls = (app.status === 'accepted' || app.status === 'assigned') ? (
          <button
            onClick={() => handleCheckIn(app)}
            disabled={rowBusy}
            className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
            style={{ backgroundColor: 'rgba(61,122,82,0.12)', color: '#2F6644', border: '1px solid rgba(61,122,82,0.3)', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
          >
            <UserRoundCheck size={13} />
            CHECK IN
          </button>
        ) : app.status === 'checked-in' ? (
          <button
            onClick={() => handleUndoCheckIn(app)}
            disabled={rowBusy}
            className="inline-flex items-center gap-1.5 rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
            style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", ...busyStyle }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Undo2 size={13} />
            UNDO CHECK-IN
          </button>
        ) : null;

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
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold" style={{ fontSize: 9, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', backgroundColor: statusTone(app.status).bg, color: statusTone(app.status).color, border: `1px solid ${statusTone(app.status).border}` }}>
                      <StatusIcon status={app.status} />
                      {app.status.replace('-', ' ').toUpperCase()}
                    </span>
                    {app.resubmitted_at && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold"
                        title="The applicant edited and resubmitted this application"
                        style={{ fontSize: 9, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', backgroundColor: 'rgba(182,135,31,0.18)', color: '#8A6614', border: '1px solid rgba(182,135,31,0.4)' }}
                      >
                        <RotateCcw size={10} strokeWidth={2.5} />
                        RESUBMITTED {formatDate(app.resubmitted_at)}
                      </span>
                    )}
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

              {/* Assignment (assigned or checked-in) */}
              {(app.status === 'assigned' || app.status === 'checked-in') && app.assigned_country_name && (
                <p className="flex items-center gap-2 text-xs mb-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                  <BadgeCheck size={12} />
                  <span style={{ fontWeight: 700, letterSpacing: '0.12em' }}>ASSIGNED</span>
                  <span style={{ color: '#1C1410' }}>
                    {[app.assigned_committee?.name, (app.assigned_committee?.topics ?? []).join(', ')].filter(Boolean).join('  ·  ')}
                  </span>
                  <CountryFlag name={app.assigned_country_name} code={app.assigned_country_code} size={14} />
                </p>
              )}

              {/* Checked in */}
              {app.status === 'checked-in' && app.checked_in_at && (
                <p className="flex items-center gap-2 text-xs mb-4" style={{ color: '#1F6E52', fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                  <UserRoundCheck size={12} strokeWidth={2.5} />
                  <span style={{ fontWeight: 700, letterSpacing: '0.12em' }}>CHECKED IN</span>
                  <span>{formatDateTime(app.checked_in_at)}</span>
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
                    {checkInControls}
                    {paymentControls}
                    {rejectControls}
                    {withdrawControls}
                  </>
                )}

                {app.status === 'assigned' && (
                  <>
                    {checkInControls}
                    {paymentControls}
                    {withdrawControls}
                  </>
                )}

                {app.status === 'checked-in' && (
                  <>
                    {checkInControls}
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
