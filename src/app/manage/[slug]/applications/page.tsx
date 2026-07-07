'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, Download, User } from 'lucide-react';
import Link from 'next/link';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';

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
  must_pay_before_allocation: boolean;
  custom_questions: CustomQuestion[];
}

interface Application {
  id: string;
  user_id: string;
  role: string;
  status: string;
  is_independent: boolean;
  is_head_delegate: boolean;
  experience_level: string | null;
  payment_status: string | null;
  submitted_at: string;
  organizer_note: string | null;
  custom_answers: Record<string, string> | null;
  assigned_committee_id: string | null;
  assigned_country_code: string | null;
  assigned_country_name: string | null;
  assigned_committee: { name: string; topics: string[] | null } | null;
  profiles: { display_name: string; email: string; avatar_url: string | null; nationality: string | null } | null;
  societies: { name: string } | null;
  application_preferences: AppPreference[];
}

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

const STATUS_FILTERS = [
  { label: 'ALL', value: 'all' },
  { label: 'SUBMITTED', value: 'submitted' },
  { label: 'ACCEPTED', value: 'accepted' },
  { label: 'ASSIGNED', value: 'assigned' },
  { label: 'REJECTED', value: 'rejected' },
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadApplications = useCallback(async () => {
    if (!conference) return;
    if (!session) return;
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const [appRes, cfgRes] = await Promise.all([
      supabase
        .from('applications')
        .select(`
          id, user_id, role, status, is_independent, is_head_delegate, experience_level,
          payment_status, submitted_at, organizer_note, custom_answers,
          assigned_committee_id, assigned_country_code, assigned_country_name,
          assigned_committee:conference_committees!assigned_committee_id (name, topics),
          profiles (display_name, email, avatar_url, nationality),
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
        .select('role, must_pay_before_allocation, custom_questions')
        .eq('conference_id', conference.id),
    ]);

    setApplications((appRes.data ?? []) as unknown as Application[]);
    setRoleConfigs((cfgRes.data ?? []) as unknown as RoleConfigLite[]);
    setLoading(false);
  }, [conference, session?.access_token]);

  useEffect(() => { loadApplications(); }, [loadApplications]);

  async function handleAccept(appId: string) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('applications').update({ status: 'accepted' }).eq('id', appId);
    await loadApplications();
  }

  async function handleReject(appId: string) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('applications').update({ status: 'rejected', organizer_note: rejectNote.trim() || null }).eq('id', appId);
    setRejectingId(null);
    setRejectNote('');
    await loadApplications();
  }

  async function handleReinstate(appId: string) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('applications').update({ status: 'submitted', organizer_note: null }).eq('id', appId);
    await loadApplications();
  }

  function handleExportCSV() {
    const headers = ['Name', 'Email', 'Role', 'Status', 'Payment', 'Experience', 'Society', 'Head Delegate', 'Submitted', 'Assigned Committee', 'Assigned Country'];
    const rows = applications.map(a => [
      a.profiles?.display_name ?? '',
      a.profiles?.email ?? '',
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
    if (paymentFilter === 'paid' && a.payment_status !== 'paid') return false;
    if (paymentFilter === 'unpaid' && a.payment_status === 'paid') return false;
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
            <p className="font-black text-lg" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{s.value}</p>
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
            const name = app.profiles?.display_name ?? 'Unknown';
            const email = app.profiles?.email ?? '';
            const isDelegate = app.role === 'delegate' || app.role === 'head-delegate';
            const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order);
            const isRejecting = rejectingId === app.id;

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
            const roleConfig = roleConfigs.find(rc => rc.role === app.role);
            const isPaidOrWaived = app.payment_status === 'paid' || app.payment_status === 'waived';
            const mustPayBlocked = !!roleConfig?.must_pay_before_allocation && !isPaidOrWaived;
            const questions = roleConfig?.custom_questions ?? [];
            const answers = app.custom_answers ?? {};
            const isExpanded = expandedId === app.id;

            return (
              <div
                key={app.id}
                className="rounded-2xl p-5 transition-colors"
                style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
              >
                {/* Row 1: avatar + name/email + badges */}
                <div className="flex items-center gap-3">
                  {app.profiles?.avatar_url ? (
                    <img src={app.profiles.avatar_url} alt={name} className="rounded-full object-cover flex-shrink-0" style={{ width: 36, height: 36 }} />
                  ) : (
                    <div className="flex-shrink-0 flex items-center justify-center rounded-full" style={{ width: 36, height: 36, backgroundColor: 'rgba(154,138,120,0.16)', border: '1px solid rgba(221,212,192,0.9)' }}>
                      <User size={17} strokeWidth={2} style={{ color: '#9A8A78' }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{name}</p>
                    <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span style={roleBadgeStyle}>{roleLabel(app.role).toUpperCase()}</span>
                    <span style={{ ...roleBadgeStyle, backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                      {app.status.toUpperCase()}
                    </span>
                    <span className="flex items-center gap-1 font-bold" style={{ fontSize: 10, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em', color: paid ? '#2A5A3C' : '#9A6B2F' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: paid ? '#3D7A52' : '#B6871F', display: 'inline-block' }} />
                      {paid ? 'PAID' : 'UNPAID'}
                    </span>
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
                    <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(27,56,40,0.08)', color: '#1B3828', fontSize: 10, fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.06em' }}>
                      HEAD DEL.
                    </span>
                  )}
                  {app.experience_level && (
                    <span style={{ textTransform: 'capitalize' }}>{app.experience_level}</span>
                  )}
                  {app.submitted_at && (
                    <span>Applied {formatDate(app.submitted_at)}</span>
                  )}
                </div>

                {/* Row 3: preferences (delegates only) */}
                {isDelegate && prefs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {prefs.slice(0, 2).map(p => (
                      <span
                        key={p.preference_order}
                        className="px-2 py-1 rounded-lg text-xs"
                        style={{ backgroundColor: 'rgba(27,56,40,0.06)', border: '1px solid rgba(27,56,40,0.1)', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                      >
                        {p.preference_order}. {p.conference_committees?.name ?? 'Unknown'} — {p.country_name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Row 4: actions */}
                <div className="flex flex-wrap gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #F0EDE6' }}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : app.id)}
                    className="rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                    style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: isExpanded ? 'rgba(27,56,40,0.06)' : 'transparent', fontFamily: "'Outfit', sans-serif" }}
                  >
                    {isExpanded ? 'HIDE REVIEW' : 'REVIEW'}
                  </button>
                  {app.status === 'submitted' && (
                    <>
                      <button
                        onClick={() => handleAccept(app.id)}
                        className="rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                        style={{ backgroundColor: 'rgba(61,122,82,0.12)', color: '#3D7A52', border: '1px solid rgba(61,122,82,0.3)', fontFamily: "'Outfit', sans-serif" }}
                      >
                        ACCEPT
                      </button>
                      {isRejecting ? (
                        <div className="flex items-start gap-2 flex-1">
                          <textarea
                            value={rejectNote}
                            onChange={e => setRejectNote(e.target.value)}
                            rows={2}
                            placeholder="Optional note to delegate..."
                            className="flex-1 rounded-lg px-3 py-2 text-xs outline-none resize-none"
                            style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: "'Outfit', sans-serif" }}
                          />
                          <button
                            onClick={() => handleReject(app.id)}
                            className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none"
                            style={{ backgroundColor: 'rgba(139,32,32,0.1)', color: '#8B2020', border: '1px solid rgba(139,32,32,0.2)', fontFamily: "'Outfit', sans-serif" }}
                          >
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
                          className="rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                          style={{ backgroundColor: 'rgba(139,32,32,0.08)', color: '#8B2020', border: '1px solid rgba(139,32,32,0.2)', fontFamily: "'Outfit', sans-serif" }}
                        >
                          REJECT
                        </button>
                      )}
                    </>
                  )}

                  {app.status === 'accepted' && (
                    <>
                      {isDelegate && mustPayBlocked && (
                        <span
                          title="This role must pay before allocation. Assignment is blocked until payment is marked paid or waived."
                          className="rounded-lg py-1.5 px-4 text-xs font-bold inline-flex items-center gap-1.5"
                          style={{ backgroundColor: 'rgba(184,132,74,0.12)', color: '#B8844A', border: '1px solid rgba(184,132,74,0.3)', fontFamily: "'Outfit', sans-serif", cursor: 'not-allowed' }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#B8844A', display: 'inline-block' }} />
                          PENDING PAYMENT
                        </span>
                      )}
                      {isDelegate && !mustPayBlocked && (
                        <Link
                          href={`/manage/${conference.slug}/assignment`}
                          className="rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none"
                          style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", textDecoration: 'none', display: 'inline-block' }}
                        >
                          ASSIGN →
                        </Link>
                      )}
                      {isRejecting ? (
                        <div className="flex items-start gap-2 flex-1">
                          <textarea
                            value={rejectNote}
                            onChange={e => setRejectNote(e.target.value)}
                            rows={2}
                            placeholder="Optional note to delegate..."
                            className="flex-1 rounded-lg px-3 py-2 text-xs outline-none resize-none"
                            style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: '#FAF8F3', fontFamily: "'Outfit', sans-serif" }}
                          />
                          <button
                            onClick={() => handleReject(app.id)}
                            className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none"
                            style={{ backgroundColor: 'rgba(139,32,32,0.1)', color: '#8B2020', border: '1px solid rgba(139,32,32,0.2)', fontFamily: "'Outfit', sans-serif" }}
                          >
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
                          className="rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                          style={{ backgroundColor: 'rgba(139,32,32,0.08)', color: '#8B2020', border: '1px solid rgba(139,32,32,0.2)', fontFamily: "'Outfit', sans-serif" }}
                        >
                          REJECT
                        </button>
                      )}
                    </>
                  )}

                  {app.status === 'assigned' && (
                    <>
                      {app.assigned_country_name && (
                        <span className="text-xs self-center" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                          {[app.assigned_committee?.name, (app.assigned_committee?.topics ?? []).join(', '), app.assigned_country_name].filter(Boolean).join('  ·  ')}
                        </span>
                      )}
                    </>
                  )}

                  {app.status === 'rejected' && (
                    <>
                      {app.organizer_note && (
                        <span className="text-xs italic self-center" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                          &ldquo;{app.organizer_note}&rdquo;
                        </span>
                      )}
                      <button
                        onClick={() => handleReinstate(app.id)}
                        className="rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors"
                        style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        REINSTATE
                      </button>
                    </>
                  )}
                </div>

                {/* Row 5: review panel */}
                {isExpanded && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid #F0EDE6' }}>
                    {app.profiles?.nationality && (
                      <p className="text-xs mb-3" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.12em' }}>NATIONALITY</span>{'  '}
                        <span style={{ color: '#1C1410' }}>{app.profiles.nationality}</span>
                      </p>
                    )}
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
