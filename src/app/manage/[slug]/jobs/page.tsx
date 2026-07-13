'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Building2, CreditCard, Clock, Users, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';

// ── Types ──────────────────────────────────────────────────────────────────

interface Committee { id: string; name: string; }

interface JobPosting {
  id: string;
  category: string;
  role_name: string;
  description: string | null;
  requirements: string | null;
  compensation: string;
  compensation_note: string | null;
  deadline: string | null;
  is_open: boolean;
  created_at: string;
  conference_committees: Committee | null;
}

interface Application {
  id: string;
  cover_note: string | null;
  status: string;
  submitted_at: string;
  profiles: { display_name: string; email: string; avatar_url: string | null; } | null;
}

// ── Constants ──────────────────────────────────────────────────────────────

const FOREST = '#1B3828';
const GOLD = '#EED98A';
const INK = '#1C1410';
const MUTED = '#9A8A78';
const CARD_BG = '#FAF8F3';
const BORDER = '#DDD4C0';
const DIVIDER = '#F0EDE6';
const AMBER_TEXT = '#B6871F';

// ── Helper: category badge style ───────────────────────────────────────────

function categoryBadgeStyle(cat: string) {
  if (cat === 'CHAIRS')      return { backgroundColor: 'rgba(27,56,40,0.1)',   color: FOREST };
  if (cat === 'SECRETARIAT') return { backgroundColor: 'rgba(238,217,138,0.15)', color: AMBER_TEXT };
  return                             { backgroundColor: 'rgba(154,138,120,0.1)', color: MUTED };
}

// ── Helper: format date ────────────────────────────────────────────────────

function fmtDeadline(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Helper: avatar initials ────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Ghost button ───────────────────────────────────────────────────────────

function GhostBtn({
  onClick, children, danger, disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs font-semibold transition-all focus:outline-none disabled:opacity-40"
      style={{
        color: danger ? '#DC3545' : MUTED,
        background: 'none',
        border: 'none',
        padding: '2px 4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
    >
      {children}
    </button>
  );
}

// ── Inline applications panel ──────────────────────────────────────────────

function ApplicationsPanel({
  postingId,
  onStatusChange,
}: {
  postingId: string;
  onStatusChange: () => void;
}) {
  const { session } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelError, setPanelError] = useState('');
  // App ids with a write in flight, hides that row's Accept/Reject (double-click guard).
  const [busyAppIds, setBusyAppIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    supabase
      .from('job_applications')
      .select('id, cover_note, status, submitted_at, profiles (display_name, email, avatar_url)')
      .eq('job_posting_id', postingId)
      .order('submitted_at', { ascending: false })
      .then(({ data }) => {
        setApps((data as unknown as Application[]) ?? []);
        setLoading(false);
      });
  }, [postingId]);

  function handleStatus(appId: string, newStatus: string) {
    if (!session || busyAppIds.has(appId)) return;
    // Optimistic: flip the status immediately, persist in the background,
    // roll back only this row + show an inline error if the write fails.
    const prevStatus = apps.find(a => a.id === appId)?.status ?? 'submitted';
    setApps(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
    setPanelError('');
    setBusyAppIds(prev => new Set(prev).add(appId));
    const supabase = getAuthedClient(session.access_token);
    supabase.from('job_applications').update({ status: newStatus }).eq('id', appId).then(({ error }) => {
      setBusyAppIds(prev => { const next = new Set(prev); next.delete(appId); return next; });
      if (error) {
        setApps(prev => prev.map(a => a.id === appId ? { ...a, status: prevStatus } : a));
        setPanelError("Couldn't update that application. The change was reverted.");
        return;
      }
      onStatusChange();
    });
  }

  if (loading) {
    return (
      <div
        className="rounded-xl p-4 mt-3"
        style={{ background: 'rgba(27,56,40,0.03)', border: '1px solid rgba(27,56,40,0.08)' }}
      >
        <p className="text-xs text-center py-2" style={{ color: MUTED, fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>Loading…</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-4 mt-3"
      style={{ background: 'rgba(27,56,40,0.03)', border: '1px solid rgba(27,56,40,0.08)' }}
    >
      {panelError && (
        <p className="text-xs mb-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>
          {panelError}
        </p>
      )}
      {apps.length === 0 ? (
        <p className="text-xs text-center py-2" style={{ color: MUTED, fontFamily: "'Outfit', sans-serif" }}>
          No applications yet
        </p>
      ) : (
        apps.map((app, i) => {
          const profile = app.profiles;
          const isLast = i === apps.length - 1;
          const statusStyle =
            app.status === 'accepted' ? { backgroundColor: 'rgba(27,56,40,0.12)', color: FOREST } :
            app.status === 'rejected' ? { backgroundColor: 'rgba(220,53,69,0.1)', color: '#DC3545' } :
                                        { backgroundColor: 'rgba(238,217,138,0.15)', color: AMBER_TEXT };

          return (
            <div
              key={app.id}
              className="flex items-center gap-3 py-2"
              style={{ borderBottom: isLast ? 'none' : `1px solid ${DIVIDER}` }}
            >
              {/* Avatar */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold overflow-hidden"
                style={{ backgroundColor: 'rgba(27,56,40,0.12)', color: FOREST }}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  initials(profile?.display_name ?? profile?.email ?? '?')
                )}
              </div>

              {/* Name + email */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: INK, fontFamily: "'Outfit', sans-serif" }}>
                  {profile?.display_name ?? 'Unknown'}
                </p>
                <p className="text-xs truncate" style={{ color: MUTED, fontFamily: "'Outfit', sans-serif" }}>
                  {profile?.email ?? ''}
                </p>
              </div>

              {/* Status badge */}
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ ...statusStyle, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em' }}
              >
                {app.status.toUpperCase()}
              </span>

              {/* Accept / Reject (only if submitted) */}
              {app.status === 'submitted' && (
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleStatus(app.id, 'accepted')}
                    className="text-xs font-semibold focus:outline-none transition-all"
                    style={{ color: FOREST }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                  >
                    ACCEPT
                  </button>
                  <span style={{ color: BORDER }}>·</span>
                  <button
                    onClick={() => handleStatus(app.id, 'rejected')}
                    className="text-xs font-semibold focus:outline-none transition-all"
                    style={{ color: '#DC3545' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                  >
                    REJECT
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Posting card ───────────────────────────────────────────────────────────

function PostingCard({
  posting,
  appCount,
  busy,
  onEdit,
  onToggleOpen,
  onDelete,
  onRefreshCount,
}: {
  posting: JobPosting;
  appCount: number;
  busy: boolean;
  onEdit: (p: JobPosting) => void;
  onToggleOpen: (p: JobPosting) => void;
  onDelete: (p: JobPosting) => void;
  onRefreshCount: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const catStyle = categoryBadgeStyle(posting.category);
  const openStyle = posting.is_open
    ? { backgroundColor: 'rgba(61,122,82,0.12)', color: FOREST }
    : { backgroundColor: 'rgba(154,138,120,0.1)', color: MUTED };

  return (
    <div
      className="rounded-2xl p-5 transition-all"
      style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}` }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = FOREST;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = BORDER;
      }}
    >
      {/* Row 1: category + role + open/closed */}
      <div className="flex items-center gap-3">
        <span
          className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ ...catStyle, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em' }}
        >
          {posting.category}
        </span>
        <p className="font-semibold text-base flex-1 min-w-0" style={{ color: INK, fontFamily: "'Outfit', sans-serif" }}>
          {posting.role_name}
        </p>
        <span
          className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ ...openStyle, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em' }}
        >
          {posting.is_open ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      {/* Row 2: meta */}
      <div className="mt-1.5 flex flex-wrap gap-3">
        {posting.conference_committees && (
          <span className="flex items-center gap-1 text-xs" style={{ color: MUTED, fontFamily: "'Outfit', sans-serif" }}>
            <Building2 size={12} />
            {posting.conference_committees.name}
          </span>
        )}
        <span className="flex items-center gap-1 text-xs" style={{ color: MUTED, fontFamily: "'Outfit', sans-serif" }}>
          <CreditCard size={12} />
          {posting.compensation === 'OTHER' && posting.compensation_note
            ? posting.compensation_note
            : posting.compensation}
        </span>
        {posting.deadline && (
          <span className="flex items-center gap-1 text-xs" style={{ color: MUTED, fontFamily: "'Outfit', sans-serif" }}>
            <Clock size={12} />
            Closes {fmtDeadline(posting.deadline)}
          </span>
        )}
        <span className="flex items-center gap-1 text-xs" style={{ color: MUTED, fontFamily: "'Outfit', sans-serif" }}>
          <Users size={12} />
          {appCount} application{appCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Row 3: description preview */}
      {posting.description && (
        <p
          className="mt-2 text-xs leading-relaxed"
          style={{
            color: MUTED,
            fontFamily: "'Outfit', sans-serif",
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {posting.description}
        </p>
      )}

      {/* Row 4: actions */}
      <div
        className="mt-3 pt-3 flex items-center gap-1 flex-wrap"
        style={{ borderTop: `1px solid ${DIVIDER}` }}
      >
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-xs font-semibold focus:outline-none transition-all"
          style={{ color: MUTED }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = INK; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = MUTED; }}
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          VIEW APPLICATIONS ({appCount})
        </button>

        <div className="flex-1" />

        <GhostBtn onClick={() => onEdit(posting)}>EDIT</GhostBtn>
        <GhostBtn onClick={() => onToggleOpen(posting)} disabled={busy}>
          {posting.is_open ? 'CLOSE' : 'REOPEN'}
        </GhostBtn>
        <GhostBtn onClick={() => onDelete(posting)} danger disabled={busy}>DELETE</GhostBtn>
      </div>

      {/* Inline applications */}
      {expanded && (
        <ApplicationsPanel postingId={posting.id} onStatusChange={onRefreshCount} />
      )}
    </div>
  );
}

// ── Posting modal (create + edit) ──────────────────────────────────────────

function PostingModal({
  conferenceId,
  committees,
  posting,
  saving,
  errorText,
  onSave,
  onClose,
}: {
  conferenceId: string;
  committees: Committee[];
  posting: JobPosting | null;
  saving: boolean;
  errorText?: string;
  onSave: (data: {
    category: string;
    role_name: string;
    committee_id: string | null;
    description: string;
    requirements: string;
    compensation: string;
    compensation_note: string;
    deadline: string;
  }) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState(posting?.category ?? 'CHAIRS');
  const [roleName, setRoleName] = useState(posting?.role_name ?? '');
  const [committeeId, setCommitteeId] = useState(posting?.conference_committees?.id ?? '');
  const [description, setDescription] = useState(posting?.description ?? '');
  const [requirements, setRequirements] = useState(posting?.requirements ?? '');
  const [compensation, setCompensation] = useState(posting?.compensation ?? 'UNPAID');
  const [compensationNote, setCompensationNote] = useState(posting?.compensation_note ?? '');
  const [deadline, setDeadline] = useState(
    posting?.deadline ? posting.deadline.slice(0, 16) : ''
  );

  const isEdit = posting !== null;

  const inputStyle = {
    border: `1px solid ${BORDER}`,
    backgroundColor: '#fff',
    color: INK,
    fontFamily: "'Outfit', sans-serif",
    borderRadius: '10px',
    padding: '10px 12px',
    fontSize: '14px',
    width: '100%',
    outline: 'none',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    marginBottom: '6px',
    color: MUTED,
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '0.05em',
  };

  function ToggleGroup({
    options, value, onChange,
  }: { options: string[]; value: string; onChange: (v: string) => void }) {
    return (
      <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: '#F0EDE6' }}>
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all focus:outline-none"
            style={{
              fontFamily: "'Outfit', sans-serif",
              backgroundColor: value === opt ? FOREST : 'transparent',
              color: value === opt ? GOLD : MUTED,
              letterSpacing: '0.04em',
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative overflow-y-auto"
        style={{
          backgroundColor: CARD_BG,
          borderRadius: '20px',
          padding: '24px',
          maxWidth: '512px',
          width: 'calc(100% - 32px)',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-black text-lg" style={{ color: INK, fontFamily: "'Outfit', sans-serif" }}>
            {isEdit ? 'Edit Position' : 'Post a Position'}
          </h2>
          <button onClick={onClose} className="focus:outline-none" style={{ color: MUTED }}>
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Category */}
          <div>
            <span style={labelStyle}>CATEGORY</span>
            <ToggleGroup options={['CHAIRS', 'SECRETARIAT', 'STAFF']} value={category} onChange={setCategory} />
          </div>

          {/* Role name */}
          <div>
            <label style={labelStyle}>ROLE NAME</label>
            <input
              type="text"
              value={roleName}
              onChange={e => setRoleName(e.target.value)}
              placeholder="e.g. Director, Under-Secretary-General, Press Corps"
              style={inputStyle}
              onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = FOREST; }}
              onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
            />
          </div>

          {/* Committee */}
          <div>
            <label style={labelStyle}>COMMITTEE (OPTIONAL)</label>
            <select
              value={committeeId}
              onChange={e => setCommitteeId(e.target.value)}
              style={{ ...inputStyle, appearance: 'none' }}
            >
              <option value="">Not committee-specific</option>
              {committees.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>DESCRIPTION</label>
            <textarea
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the role and what you're looking for..."
              style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
              onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = FOREST; }}
              onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
            />
          </div>

          {/* Requirements */}
          <div>
            <label style={labelStyle}>REQUIREMENTS</label>
            <textarea
              rows={3}
              value={requirements}
              onChange={e => setRequirements(e.target.value)}
              placeholder="Experience, skills, or qualifications required..."
              style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }}
              onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = FOREST; }}
              onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
            />
          </div>

          {/* Compensation */}
          <div>
            <span style={labelStyle}>COMPENSATION</span>
            <ToggleGroup
              options={['UNPAID', 'PAID', 'TRAVEL COVERED', 'OTHER']}
              value={compensation}
              onChange={setCompensation}
            />
          </div>

          {/* Compensation note (when OTHER) */}
          {compensation === 'OTHER' && (
            <div>
              <label style={labelStyle}>COMPENSATION NOTE</label>
              <input
                type="text"
                value={compensationNote}
                onChange={e => setCompensationNote(e.target.value)}
                placeholder="e.g. Accommodation provided"
                style={inputStyle}
                onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = FOREST; }}
                onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
              />
            </div>
          )}

          {/* Deadline */}
          <div>
            <label style={labelStyle}>APPLICATION DEADLINE (OPTIONAL)</label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              style={inputStyle}
              onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = FOREST; }}
              onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
            />
          </div>

          {/* Submit */}
          {errorText && (
            <p className="text-xs" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>
              {errorText}
            </p>
          )}
          <button
            onClick={() =>
              onSave({
                category,
                role_name: roleName,
                committee_id: committeeId || null,
                description,
                requirements,
                compensation,
                compensation_note: compensationNote,
                deadline,
              })
            }
            disabled={!roleName.trim() || saving}
            className="w-full rounded-xl py-3 font-bold text-sm focus:outline-none transition-all mt-1 disabled:opacity-50"
            style={{
              backgroundColor: FOREST,
              color: GOLD,
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.05em',
            }}
            onMouseEnter={(e) => {
              if (!saving) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = FOREST;
            }}
          >
            {saving
              ? 'SAVING…'
              : isEdit
              ? 'SAVE CHANGES'
              : 'POST POSITION'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

const CATEGORIES = ['ALL', 'CHAIRS', 'SECRETARIAT', 'STAFF'] as const;
type CategoryTab = typeof CATEGORIES[number];

export default function JobBoardPage() {
  const { conference } = useManage();
  const { user, session } = useAuth();

  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [appCounts, setAppCounts] = useState<Record<string, number>>({});
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryTab, setCategoryTab] = useState<CategoryTab>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [editPosting, setEditPosting] = useState<JobPosting | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [createError, setCreateError] = useState('');
  // Posting ids with a write in flight, disables that row's controls (double-click guard).
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  // Stale-response guard for background refetches.
  const fetchSeq = useRef(0);

  function markBusy(id: string, busy: boolean) {
    setBusyIds(prev => {
      const next = new Set(prev);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  }

  const fetchAll = useCallback(async () => {
    if (!conference) return;
    if (!session) return;
    const seq = ++fetchSeq.current;
    const supabase = getAuthedClient(session.access_token);

    const [{ data: postingsData }, { data: committeesData }] = await Promise.all([
      supabase
        .from('job_postings')
        .select(`
          id, category, role_name, description, requirements,
          compensation, compensation_note, deadline, is_open, created_at,
          conference_committees (id, name)
        `)
        .eq('conference_id', conference.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('conference_committees')
        .select('id, name')
        .eq('conference_id', conference.id),
    ]);

    if (seq !== fetchSeq.current) return; // stale response, a newer fetch superseded this one

    const ps = (postingsData as unknown as JobPosting[]) ?? [];
    setPostings(ps);
    setCommittees((committeesData as Committee[]) ?? []);

    // Batch fetch app counts
    if (ps.length > 0) {
      const counts = await Promise.all(
        ps.map(p =>
          supabase
            .from('job_applications')
            .select('*', { count: 'exact', head: true })
            .eq('job_posting_id', p.id)
        )
      );
      if (seq !== fetchSeq.current) return;
      const countMap: Record<string, number> = {};
      ps.forEach((p, i) => { countMap[p.id] = counts[i].count ?? 0; });
      setAppCounts(countMap);
    }

    setLoading(false);
  }, [conference]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleCreate(data: {
    category: string; role_name: string; committee_id: string | null;
    description: string; requirements: string; compensation: string;
    compensation_note: string; deadline: string;
  }) {
    if (!conference || !user || saving) return;
    if (!session) return;
    // Creation needs the real DB row (id) back, so the insert stays awaited —
    // but only the modal's save button is busy; the page stays interactive.
    setSaving(true);
    setCreateError('');
    const supabase = getAuthedClient(session.access_token);
    const { data: created, error } = await supabase.from('job_postings').insert({
      conference_id: conference.id,
      posted_by: user.id,
      category: data.category,
      role_name: data.role_name,
      committee_id: data.committee_id || null,
      description: data.description || null,
      requirements: data.requirements || null,
      compensation: data.compensation,
      compensation_note: data.compensation_note || null,
      deadline: data.deadline || null,
      is_open: true,
    }).select(`
      id, category, role_name, description, requirements,
      compensation, compensation_note, deadline, is_open, created_at,
      conference_committees (id, name)
    `).single();
    setSaving(false);
    if (error || !created) {
      setCreateError("Couldn't post the position. Please try again.");
      return;
    }
    const row = created as unknown as JobPosting;
    setPostings(prev => [row, ...prev]);
    setAppCounts(prev => ({ ...prev, [row.id]: 0 }));
    setCreateOpen(false);
  }

  function handleEdit(posting: JobPosting, data: {
    category: string; role_name: string; committee_id: string | null;
    description: string; requirements: string; compensation: string;
    compensation_note: string; deadline: string;
  }) {
    if (!session || busyIds.has(posting.id)) return;
    // Optimistic: patch the posting locally and close the modal at once; the
    // write runs in the background and rolls back on failure.
    const committee = data.committee_id ? committees.find(c => c.id === data.committee_id) ?? null : null;
    setPostings(prev => prev.map(p => p.id === posting.id ? {
      ...p,
      category: data.category,
      role_name: data.role_name,
      description: data.description || null,
      requirements: data.requirements || null,
      compensation: data.compensation,
      compensation_note: data.compensation_note || null,
      deadline: data.deadline || null,
      conference_committees: committee,
    } : p));
    setEditPosting(null);
    setActionError('');
    markBusy(posting.id, true);
    const supabase = getAuthedClient(session.access_token);
    supabase.from('job_postings').update({
      category: data.category,
      role_name: data.role_name,
      committee_id: data.committee_id || null,
      description: data.description || null,
      requirements: data.requirements || null,
      compensation: data.compensation,
      compensation_note: data.compensation_note || null,
      deadline: data.deadline || null,
    }).eq('id', posting.id).then(({ error }) => {
      markBusy(posting.id, false);
      if (error) {
        // Restore only this row to its exact pre-edit values.
        setPostings(prev => prev.map(p => p.id === posting.id ? posting : p));
        setActionError("Couldn't save the position. The change was reverted.");
      }
    });
  }

  function handleToggleOpen(posting: JobPosting) {
    if (!session || busyIds.has(posting.id)) return;
    // Optimistic flip; roll back only this row on failure.
    setPostings(prev => prev.map(p => p.id === posting.id ? { ...p, is_open: !p.is_open } : p));
    setActionError('');
    markBusy(posting.id, true);
    const supabase = getAuthedClient(session.access_token);
    supabase.from('job_postings').update({ is_open: !posting.is_open }).eq('id', posting.id).then(({ error }) => {
      markBusy(posting.id, false);
      if (error) {
        setPostings(prev => prev.map(p => p.id === posting.id ? { ...p, is_open: posting.is_open } : p));
        setActionError("Couldn't update the posting. The change was reverted.");
      }
    });
  }

  async function handleDelete(posting: JobPosting) {
    if (!session || busyIds.has(posting.id)) return;
    if (!confirm(`Delete "${posting.role_name}"? This cannot be undone.`)) return;
    // Optimistic removal; re-insert at its prior index + inline error if either delete fails.
    const removedIndex = postings.findIndex(p => p.id === posting.id);
    setPostings(prev => prev.filter(p => p.id !== posting.id));
    setActionError('');
    markBusy(posting.id, true);
    const supabase = getAuthedClient(session.access_token);
    const { error: appsErr } = await supabase.from('job_applications').delete().eq('job_posting_id', posting.id);
    const { error: postErr } = appsErr
      ? { error: appsErr }
      : await supabase.from('job_postings').delete().eq('id', posting.id);
    markBusy(posting.id, false);
    if (postErr) {
      setPostings(prev => {
        const next = prev.filter(p => p.id !== posting.id);
        next.splice(Math.min(Math.max(removedIndex, 0), next.length), 0, posting);
        return next;
      });
      setActionError("Couldn't delete the posting. It was restored.");
    }
  }

  // ── Derived stats ──────────────────────────────────────────────────────

  const openCount = postings.filter(p => p.is_open).length;
  const totalApps = Object.values(appCounts).reduce((s, n) => s + n, 0);
  const categoriesActive = new Set(postings.map(p => p.category)).size;

  const visible = categoryTab === 'ALL'
    ? postings
    : postings.filter(p => p.category === categoryTab);

  if (loading) {
    return (
      <div className="px-6 md:px-10 py-8">
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="rounded-2xl animate-pulse"
              style={{ height: '120px', backgroundColor: BORDER }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 md:px-10 py-8">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p
            className="text-xs tracking-widest mb-1"
            style={{ color: MUTED, fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}
          >
            {conference?.acronym} / Job Board
          </p>
          <h1 className="text-2xl font-black" style={{ color: INK, fontFamily: "'Outfit', sans-serif" }}>
            Job Board
          </h1>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="rounded-xl py-2.5 px-5 font-bold text-sm focus:outline-none transition-all"
          style={{
            backgroundColor: FOREST,
            color: GOLD,
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '0.04em',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = FOREST; }}
        >
          POST A POSITION
        </button>
      </div>

      {actionError && (
        <p
          className="rounded-xl px-4 py-2.5 mb-5 text-xs"
          style={{ color: '#8B2020', backgroundColor: 'rgba(139,32,32,0.06)', border: '1px solid rgba(139,32,32,0.2)', fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}
        >
          {actionError}
        </p>
      )}

      {/* Stats row */}
      <div className="flex gap-4 mb-6 flex-wrap">
        {[
          { value: openCount, label: 'Open positions' },
          { value: totalApps, label: 'Total applications' },
          { value: categoriesActive, label: 'Categories active' },
        ].map(({ value, label }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-xl px-5 py-3"
            style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}` }}
          >
            <span className="font-black text-xl" style={{ color: INK, fontFamily: "'Outfit', sans-serif" }}>
              {value}
            </span>
            <span className="text-xs" style={{ color: MUTED, fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryTab(cat)}
            className="px-3 py-1.5 rounded-full text-xs font-bold tracking-widest transition-all focus:outline-none"
            style={{
              backgroundColor: categoryTab === cat ? FOREST : 'transparent',
              color: categoryTab === cat ? GOLD : INK,
              border: categoryTab === cat ? `1.5px solid ${FOREST}` : `1.5px solid ${BORDER}`,
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.07em',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Postings list */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-semibold text-base mb-2" style={{ color: INK, fontFamily: "'Outfit', sans-serif" }}>
            {postings.length === 0 ? 'No positions posted yet' : 'No positions in this category'}
          </p>
          <p className="text-sm mb-4" style={{ color: MUTED, fontFamily: "'Outfit', sans-serif" }}>
            {postings.length === 0
              ? 'Click "Post a Position" to start recruiting chairs and staff.'
              : 'Try selecting a different category above.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map(posting => (
            <PostingCard
              key={posting.id}
              posting={posting}
              appCount={appCounts[posting.id] ?? 0}
              busy={busyIds.has(posting.id)}
              onEdit={(p) => setEditPosting(p)}
              onToggleOpen={handleToggleOpen}
              onDelete={handleDelete}
              onRefreshCount={fetchAll}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {createOpen && (
        <PostingModal
          conferenceId={conference!.id}
          committees={committees}
          posting={null}
          saving={saving}
          errorText={createError || undefined}
          onSave={handleCreate}
          onClose={() => { setCreateOpen(false); setCreateError(''); }}
        />
      )}

      {/* Edit modal */}
      {editPosting && (
        <PostingModal
          conferenceId={conference!.id}
          committees={committees}
          posting={editPosting}
          saving={saving}
          onSave={(data) => handleEdit(editPosting, data)}
          onClose={() => setEditPosting(null)}
        />
      )}
    </div>
  );
}
