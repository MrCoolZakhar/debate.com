'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, Copy, Check, Building2, CalendarClock, Trash2, ArrowDown, ArrowUp, ArrowUpDown, Send, LayoutGrid, LayoutList, Settings } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { sendChairInvite, findChairInviteRoleConflict } from '@/lib/chairInvites';
import { queueEventEmail, notifyIfNeeded, turnOnDefaultEmail } from '@/lib/emailEvents';
import { useDraftNotices, DraftNoticeList } from '@/components/DraftNotice';
import { useConfirmModal } from '@/components/ConfirmModal';
import { PillToggle, LevelInsignia, LEVEL_ACCENT } from '@/app/account/accountUi';
import { DatePicker } from '@/components/DatePicker';
import { NEU, NEU_GRADIENTS, OUTFIT, NeuButton, NeuCard, NeuInset, NeuPill } from '@/components/neu';
import {
  CommitteeEditorModal,
  MonogramMedallion,
  ModalOverlay,
  mintConferenceSession,
} from '@/components/CommitteeEditorModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DisplayChair {
  name: string;
  avatar_url: string | null;
}

interface CommitteeRow {
  id: string;
  name: string;
  abbreviation: string | null;
  topics: string[] | null;
  difficulty: string;
  committee_type: string;
  total_slots: number;
  delegation_size: number;
  session_code: string | null;
  session_id: string | null;
  pp_submissions_enabled: boolean;
  position_paper_deadline: string | null;
  notification_email: string | null;
  logo_url: string | null;
  chair_user_ids: string[] | null;
  display_chairs: DisplayChair[] | null;
  released_to_chairs_at: string | null;
  released_to_delegates_at: string | null;
}

interface Committee extends CommitteeRow {
  slotCount: number;
}

// Accepted chair applicant (AddChairModal list), same shape the assignment page reads.
interface ChairApplicant {
  id: string;
  user_id: string;
  status: string;
  assigned_committee_id: string | null;
  profiles: { id: string; display_name: string; email: string; avatar_url: string | null } | null;
}

// ── Design constants ──────────────────────────────────────────────────────────

const DIFF_ORDER: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2, expert: 3 };

const ROMAN = ['I', 'II', 'III'];

const EASE = 'cubic-bezier(0.22,1,0.36,1)';

function SortButton({ label, dir, onClick }: { label: string; dir: 'asc' | 'desc' | null; onClick: () => void }) {
  const active = dir !== null;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10.5px] font-bold transition-all focus:outline-none"
      style={{
        backgroundColor: active ? '#1B3828' : 'rgba(237,231,216,0.5)',
        color: active ? '#EED98A' : '#6B5F52',
        border: active ? '1px solid #1B3828' : '1px solid rgba(221,212,192,0.9)',
        fontFamily: "'Outfit', sans-serif",
        letterSpacing: '0.09em',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
    >
      {label}
      {dir === 'asc' ? (
        <ArrowDown size={12} strokeWidth={2.4} />
      ) : dir === 'desc' ? (
        <ArrowUp size={12} strokeWidth={2.4} />
      ) : (
        <ArrowUpDown size={12} strokeWidth={2} style={{ opacity: 0.5 }} />
      )}
    </button>
  );
}

// The canonical rank insignia (same glyph the CV + profile use), seated on a
// small neu tile tinted with the tier accent — replaces the old flat difficulty
// pill so the level reads as a real rank marker, not a coloured chip.
function DifficultyTile({ level, size = 'md' }: { level: string; size?: 'sm' | 'md' }) {
  const key = (level ?? '').toLowerCase();
  const label = key ? key.charAt(0).toUpperCase() + key.slice(1) : '';
  if (!label) return null;
  const accent = LEVEL_ACCENT[key] ?? NEU.muted;
  const disc = size === 'sm' ? 20 : 23;
  const glyph = size === 'sm' ? 14 : 16;
  return (
    <span
      className="inline-flex items-center flex-shrink-0"
      style={{
        gap: size === 'sm' ? 6 : 7,
        padding: size === 'sm' ? '3px 10px 3px 3px' : '3px 11px 3px 3px',
        borderRadius: 9,
        backgroundColor: NEU.surface,
        boxShadow: NEU.outSm,
      }}
    >
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: disc, height: disc, borderRadius: 9999,
          background: `linear-gradient(150deg, ${accent}26, ${accent}12)`,
          border: `1px solid ${accent}55`,
        }}
      >
        <LevelInsignia level={key} size={glyph} />
      </span>
      <span style={{ fontFamily: OUTFIT, fontSize: size === 'sm' ? 11 : 11.5, fontWeight: 700, color: NEU.ink, letterSpacing: '0.01em' }}>
        {label}
      </span>
    </span>
  );
}

// Segmented cards / list view switch — an inset track holding two pill options,
// the active one lifting on the neu surface (concentric radii, soft shadows).
function ViewToggle({ value, onChange }: { value: 'cards' | 'list'; onChange: (v: 'cards' | 'list') => void }) {
  const opts: { key: 'cards' | 'list'; label: string; Icon: typeof LayoutGrid }[] = [
    { key: 'cards', label: 'CARDS', Icon: LayoutGrid },
    { key: 'list', label: 'LIST', Icon: LayoutList },
  ];
  return (
    <div
      className="inline-flex items-center gap-1 flex-shrink-0"
      style={{ padding: 4, borderRadius: 9999, backgroundColor: NEU.base, boxShadow: NEU.inSm }}
    >
      {opts.map(({ key, label, Icon }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className="inline-flex items-center gap-1.5 focus:outline-none"
            style={{
              padding: '6px 13px',
              borderRadius: 9999,
              border: 'none',
              cursor: 'pointer',
              fontFamily: OUTFIT,
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: '0.09em',
              backgroundColor: active ? NEU.surface : 'transparent',
              color: active ? NEU.forest : NEU.muted,
              boxShadow: active ? NEU.outSm : 'none',
              transition: `color 200ms ${EASE}, box-shadow 200ms ${EASE}`,
            }}
          >
            <Icon size={13} strokeWidth={2.4} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Session release helpers ──────────────────────────────────────────────────

// Small gold uppercase eyebrow, the house convention for a section/field
// label (matches ADD CHAIR, ACCEPTED CHAIR APPLICANTS elsewhere in this file).
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, color: NEU.deepGold,
  fontFamily: OUTFIT, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8,
};

function fmtConferenceStart(startDate: string): string {
  return new Date(startDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// This is the organizer's "have I sent the invite" action tracker, a
// different question from the participant-side access gate (ChairParticipant
// SessionCard), which additionally falls back to the conference's start_date
// when the stamp is null. A null stamp here always means "never sent", full
// stop — the button to actually send/queue the email must stay available even
// once the conference's default release date has quietly passed on its own.
type ReleaseState = 'unreleased' | 'scheduled' | 'released';
function releaseStatus(releasedAt: string | null): ReleaseState {
  if (!releasedAt) return 'unreleased';
  return new Date(releasedAt).getTime() > Date.now() ? 'scheduled' : 'released';
}

// Splits an ISO timestamp into the local YYYY-MM-DD / HH:MM pair the picker
// below edits independently (a DatePicker for the date, a plain time input
// for the time — never a native date input per house rule).
function isoToDatePart(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function isoToTimePart(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// One release-time field: a DatePicker + time input, committing a verified
// write on every change (no optimistic display — a failed save reverts the
// shown value). Clearing the date nulls the whole timestamp.
function ReleaseTimePicker({ value, onSave, placeholder, disabled }: {
  value: string | null;
  onSave: (iso: string | null) => Promise<boolean>;
  placeholder: string;
  disabled?: boolean;
}) {
  const [datePart, setDatePart] = useState(isoToDatePart(value));
  const [timePart, setTimePart] = useState(isoToTimePart(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDatePart(isoToDatePart(value));
    setTimePart(isoToTimePart(value));
  }, [value]);

  async function commit(nextDate: string, nextTime: string) {
    const prevDate = datePart, prevTime = timePart;
    setDatePart(nextDate);
    setTimePart(nextTime);
    let iso: string | null = null;
    if (nextDate) {
      const [y, mo, da] = nextDate.split('-').map(Number);
      const [h, m] = (nextTime || '00:00').split(':').map(Number);
      iso = new Date(y, mo - 1, da, h, m).toISOString();
    }
    setSaving(true);
    setError('');
    const ok = await onSave(iso);
    setSaving(false);
    if (!ok) {
      setDatePart(prevDate);
      setTimePart(prevTime);
      setError("Couldn't save, please try again.");
    }
  }

  return (
    <div>
      <div className="flex gap-2 items-center">
        <div style={{ flex: 1, minWidth: 160 }}>
          <DatePicker
            value={datePart}
            onChange={iso => commit(iso, timePart || '00:00')}
            placeholder={placeholder}
            disabled={disabled || saving}
          />
        </div>
        <input
          type="time"
          value={timePart}
          onChange={e => commit(datePart, e.target.value)}
          disabled={disabled || saving || !datePart}
          className="focus:outline-none"
          style={{
            border: 'none', borderRadius: 12, padding: '11px 12px',
            fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 600,
            color: datePart ? NEU.ink : NEU.muted, backgroundColor: NEU.base, boxShadow: NEU.inSm,
          }}
        />
        {datePart && (
          <button
            type="button"
            onClick={() => commit('', '')}
            disabled={disabled || saving}
            title="Clear, falls back to the default"
            className="flex-shrink-0 focus:outline-none"
            style={{ color: NEU.muted, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        )}
      </div>
      {error && <p style={{ fontSize: 11, color: '#8B2020', fontFamily: OUTFIT, marginTop: 4 }}>{error}</p>}
    </div>
  );
}

// Compact right-of-row send action, used by the Settings tab's per-committee
// release list AND the overview card / list release affordances — three-state
// semantics: SEND (unreleased) / SCHEDULED / SENT+RESEND. The confirm dialog
// lives in handleSendToChairs / handleSendToParticipants themselves (same busy
// guard, same released/resend state).
function CompactSendButton({ releasedAt, busy, onSend }: {
  releasedAt: string | null;
  busy: boolean;
  onSend: () => void;
}) {
  const status = releaseStatus(releasedAt);

  if (status === 'scheduled') {
    return (
      <span
        className="inline-flex items-center flex-shrink-0 px-2.5 py-1 rounded-full"
        style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color: NEU.deepGold, backgroundColor: 'rgba(238,217,138,0.28)' }}
      >
        SCHEDULED
      </span>
    );
  }

  if (status === 'released') {
    return (
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full"
          style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color: NEU.green, backgroundColor: 'rgba(61,122,82,0.13)' }}
        >
          SENT
        </span>
        <button
          onClick={onSend}
          disabled={busy}
          className="flex-shrink-0 rounded-full focus:outline-none"
          style={{
            padding: '6px 12px', border: 'none',
            color: busy ? NEU.muted : NEU.ink, backgroundColor: NEU.surface, boxShadow: busy ? 'none' : NEU.outSm,
            fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy ? '...' : 'RESEND'}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onSend}
      disabled={busy}
      className="inline-flex items-center gap-1.5 flex-shrink-0 rounded-full focus:outline-none"
      style={{
        padding: '7px 14px', border: 'none',
        background: busy ? 'rgba(27,56,40,0.14)' : `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
        color: busy ? NEU.muted : NEU.gold,
        fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em',
        cursor: busy ? 'default' : 'pointer',
        boxShadow: busy ? 'none' : `0 3px 8px ${NEU_GRADIENTS.forest[0]}44, ${NEU.outSm}`,
      }}
    >
      <Send size={11} />
      {busy ? '...' : 'SEND'}
    </button>
  );
}

// ── AddChairModal, assign an accepted chair applicant, or invite by email ────

function AddChairModal({ conferenceId, committee, committees, onClose, onDone, onInvited, onAssign }: {
  conferenceId: string;
  committee: Committee;
  committees: Committee[];
  onClose: () => void;
  onDone: () => void;
  onInvited: (name: string) => void;
  // Optimistic path, the parent patches its list, closes this modal, and
  // persists in the background (AGENTS.md Rule 5).
  onAssign: (app: ChairApplicant) => void;
}) {
  const { session } = useAuth();
  const { confirm, modal: confirmModal } = useConfirmModal();
  const [applicants, setApplicants] = useState<ChairApplicant[] | null>(null);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data } = await supabase
        .from('applications')
        .select('id, user_id, status, assigned_committee_id, profiles (id, display_name, email, avatar_url)')
        .eq('conference_id', conferenceId)
        .eq('role', 'chair')
        .in('status', ['accepted', 'assigned']);
      if (!cancelled) setApplicants((data ?? []) as unknown as ChairApplicant[]);
    })();
    return () => { cancelled = true; };
  }, [session, conferenceId]);

  const currentIds = new Set(committee.chair_user_ids ?? []);
  const visible = (applicants ?? [])
    .filter(a => !currentIds.has(a.user_id))
    .sort((a, b) => {
      const ua = a.assigned_committee_id ? 1 : 0;
      const ub = b.assigned_committee_id ? 1 : 0;
      if (ua !== ub) return ua - ub; // unassigned first
      return (a.profiles?.display_name ?? '').localeCompare(b.profiles?.display_name ?? '');
    });

  async function handleInvite() {
    const em = email.trim();
    if (!em || !session) return;
    setInviting(true); setError('');
    const supabase = getAuthedClient(session.access_token);

    async function doSend() {
      const result = await sendChairInvite(supabase, {
        conferenceId,
        committeeId: committee.id,
        committeeName: committee.name,
        email: em,
      });
      if (!result.ok) {
        setError(result.error ?? 'Could not invite that chair.');
        return;
      }
      onInvited(result.invitedName ?? em);
      setEmail('');
      onDone();
    }

    // Two-roles warning: this email already holds an active application in
    // another role, confirm before giving them a second one. The confirm
    // dialog's own loading state (onConfirm) is the busy-state guard on
    // PROCEED here, so the outer `inviting` flag can drop immediately.
    const conflict = await findChairInviteRoleConflict(supabase, conferenceId, em);
    if (conflict) {
      setInviting(false);
      await confirm({
        title: 'This person already holds a role',
        body: `${conflict.displayName} already has an active ${conflict.role.replace(/-/g, ' ')} application at this conference. Accepting this chair invite will give them two roles.`,
        confirmLabel: 'Proceed',
        cancelLabel: 'Cancel',
        onConfirm: doSend,
      });
      return;
    }

    await doSend();
    setInviting(false);
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 460, maxWidth: 'calc(100vw - 32px)', maxHeight: '80vh', overflowY: 'auto' }}>
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: '#B6871F' }}>
              ADD CHAIR
            </p>
            <p className="font-bold text-[15px] mt-0.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              {committee.name}
            </p>
          </div>
          <button onClick={onClose} className="focus:outline-none flex-shrink-0" style={{ color: '#9A8A78' }}><X size={18} /></button>
        </div>

        {/* Accepted chair applicants */}
        <p style={{ margin: '0 0 8px 0', fontFamily: "'Outfit', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: '#6B5F52' }}>
          ACCEPTED CHAIR APPLICANTS
        </p>
        {applicants === null ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
          </div>
        ) : visible.length === 0 ? (
          <p className="text-xs py-3 text-center rounded-xl" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", border: '1px dashed #DDD4C0', backgroundColor: 'rgba(237,231,216,0.3)' }}>
            No accepted chair applicants available.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {visible.map(app => {
              const name = app.profiles?.display_name ?? 'Unknown';
              const assignedTo = app.assigned_committee_id
                ? committees.find(cc => cc.id === app.assigned_committee_id)
                : null;
              return (
                <div key={app.id} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ border: '1px solid #EDE7D8', backgroundColor: 'rgba(237,231,216,0.3)' }}>
                  {app.profiles?.avatar_url ? (
                    <img
                      src={app.profiles.avatar_url}
                      alt={name}
                      style={{ width: 30, height: 30, borderRadius: '9999px', objectFit: 'cover', backgroundColor: '#EDE7D8', flexShrink: 0 }}
                    />
                  ) : (
                    <span
                      className="flex items-center justify-center flex-shrink-0"
                      style={{ width: 30, height: 30, borderRadius: '9999px', backgroundColor: '#1B3828', color: '#EED98A', fontSize: 12, fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}
                    >
                      {name.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>{name}</p>
                    <p className="text-[11px] truncate" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", margin: 0 }}>{app.profiles?.email ?? ''}</p>
                  </div>
                  {app.assigned_committee_id && (
                    <span
                      className="px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', fontFamily: "'Outfit', sans-serif", backgroundColor: 'rgba(238,217,138,0.35)', color: '#8A6614', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {assignedTo ? `ON ${(assignedTo.abbreviation ?? assignedTo.name).toUpperCase()}` : 'ASSIGNED'}
                    </span>
                  )}
                  <button
                    onClick={() => onAssign(app)}
                    className="rounded-lg py-1.5 px-3 font-bold text-[10.5px] focus:outline-none flex-shrink-0"
                    style={{
                      backgroundColor: '#1B3828',
                      color: '#EED98A',
                      fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', cursor: 'pointer',
                      transition: `background-color 250ms ${EASE}`,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                  >
                    ASSIGN
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Invite by email */}
        <div className="mt-5 pt-5" style={{ borderTop: '1px solid #EDE7D8' }}>
          <p style={{ margin: '0 0 8px 0', fontFamily: "'Outfit', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: '#6B5F52' }}>
            INVITE BY EMAIL
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleInvite(); } }}
              placeholder="chair@example.com"
              style={{
                flex: 1, border: '1px solid #DDD4C0', borderRadius: 8, padding: '8px 12px',
                fontSize: 13, color: '#1C1410', backgroundColor: '#FAF8F3', outline: 'none',
                fontFamily: "'Outfit', sans-serif",
              }}
            />
            <button
              onClick={handleInvite}
              disabled={inviting || !email.trim()}
              className="rounded-lg px-4 font-bold text-[11px] focus:outline-none"
              style={{
                backgroundColor: inviting || !email.trim() ? '#DDD4C0' : '#1B3828',
                color: inviting || !email.trim() ? '#9A8A78' : '#EED98A',
                fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', cursor: 'pointer',
                transition: `background-color 250ms ${EASE}`, whiteSpace: 'nowrap',
              }}
            >
              {inviting ? 'INVITING…' : 'INVITE'}
            </button>
          </div>
          <p className="text-[11px] mt-2" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.45 }}>
            They must already have a Gavelling account. They&apos;ll get an email to accept before joining this dais.
          </p>
          {error && <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{error}</p>}
        </div>
      </div>
      {confirmModal}
    </ModalOverlay>
  );
}

// ── CommitteesPage ────────────────────────────────────────────────────────────

export default function CommitteesPage() {
  const { conference } = useManage();
  const { session } = useAuth();
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Committee | null>(null);
  const [addChairTarget, setAddChairTarget] = useState<Committee | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommitteeRow | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  // Cards (default) vs compact list view for the overview grid, remembered locally.
  const [view, setView] = useState<'cards' | 'list'>('cards');
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('committees-view') : null;
    if (saved === 'cards' || saved === 'list') setView(saved);
  }, []);
  const changeView = useCallback((v: 'cards' | 'list') => {
    setView(v);
    try { window.localStorage.setItem('committees-view', v); } catch { /* private mode */ }
  }, []);
  const [sortKey, setSortKey] = useState<'' | 'difficulty' | 'name' | 'type'>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [flash, setFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [sendingToChairs, setSendingToChairs] = useState<string | null>(null);
  const [sendingToParticipants, setSendingToParticipants] = useState<string | null>(null);
  const [sendingAllToParticipants, setSendingAllToParticipants] = useState(false);
  // Ids with a write in flight, disables only that control (double-click guard).
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  // Stale-response guard for background (silent) reloads.
  const loadSeq = useRef(0);
  const { draftNotices, pushDraftNotice, dismissDraftNotice } = useDraftNotices();
  const { confirm, modal: confirmModal } = useConfirmModal();

  // ── Session release settings (conferences-level toggles + advisor gate) ────
  const [releaseSameTime, setReleaseSameTime] = useState(true);
  const [releaseAllAtOnce, setReleaseAllAtOnce] = useState(true);
  const [releaseAdvisorsAt, setReleaseAdvisorsAt] = useState<string | null>(null);
  const [releaseSettingsLoaded, setReleaseSettingsLoaded] = useState(false);
  const [savingToggle, setSavingToggle] = useState<'sameTime' | 'allAtOnce' | null>(null);

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(f => (f === msg ? null : f)), 4500);
  }

  function markBusy(id: string, busy: boolean) {
    setBusyIds(prev => {
      const next = new Set(prev);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  }

  // `silent` skips the page-level loading flag so background refetches never
  // unmount the grid; the seq guard drops stale responses.
  const loadCommittees = useCallback(async (opts?: { silent?: boolean }) => {
    if (!conference || !session) return;
    const seq = ++loadSeq.current;
    if (!opts?.silent) setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('conference_committees')
      .select('id, name, abbreviation, topics, difficulty, committee_type, total_slots, delegation_size, session_code, session_id, position_paper_deadline, notification_email, pp_submissions_enabled, logo_url, chair_user_ids, display_chairs, released_to_chairs_at, released_to_delegates_at')
      .eq('conference_id', conference.id)
      .order('name', { ascending: true });
    if (seq !== loadSeq.current) return; // stale, a newer load superseded this one

    const rows = (data ?? []) as CommitteeRow[];

    const slotCounts = await Promise.all(
      rows.map(async c => {
        const { count } = await supabase
          .from('committee_country_slots')
          .select('*', { count: 'exact', head: true })
          .eq('conference_committee_id', c.id);
        return count ?? 0;
      })
    );
    if (seq !== loadSeq.current) return; // stale

    setCommittees(rows.map((c, i) => ({ ...c, slotCount: slotCounts[i] })));
    setLoading(false);
  }, [conference]);

  useEffect(() => { loadCommittees(); }, [loadCommittees]);

  const loadReleaseSettings = useCallback(async () => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('conferences')
      .select('session_release_same_time, session_release_all_at_once, session_release_advisors_at')
      .eq('id', conference.id)
      .single();
    const row = data as { session_release_same_time?: boolean | null; session_release_all_at_once?: boolean | null; session_release_advisors_at?: string | null } | null;
    setReleaseSameTime(row?.session_release_same_time ?? true);
    setReleaseAllAtOnce(row?.session_release_all_at_once ?? true);
    setReleaseAdvisorsAt(row?.session_release_advisors_at ?? null);
    setReleaseSettingsLoaded(true);
  }, [conference, session]);

  useEffect(() => { loadReleaseSettings(); }, [loadReleaseSettings]);

  async function saveSameTime(value: boolean) {
    if (!session || !conference || savingToggle) return;
    setSavingToggle('sameTime');
    setActionError('');
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.from('conferences').update({ session_release_same_time: value }).eq('id', conference.id).select('id');
    setSavingToggle(null);
    if (error || !data || data.length !== 1) { setActionError("Couldn't save, please try again."); return; }
    setReleaseSameTime(value);
  }

  async function saveAllAtOnce(value: boolean) {
    if (!session || !conference || savingToggle) return;
    setSavingToggle('allAtOnce');
    setActionError('');
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.from('conferences').update({ session_release_all_at_once: value }).eq('id', conference.id).select('id');
    setSavingToggle(null);
    if (error || !data || data.length !== 1) { setActionError("Couldn't save, please try again."); return; }
    setReleaseAllAtOnce(value);
  }

  async function saveAdvisorsAt(iso: string | null): Promise<boolean> {
    if (!session || !conference) return false;
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.from('conferences').update({ session_release_advisors_at: iso }).eq('id', conference.id).select('id');
    if (error || !data || data.length !== 1) return false;
    setReleaseAdvisorsAt(iso);
    return true;
  }

  // Deletes any still-unsent SCHEDULED rows (status pending, send_after set)
  // for this event + these exact recipients, so re-saving a schedule never
  // leaves a stale duplicate behind to fire alongside the new one.
  async function clearStaleScheduled(
    supabase: ReturnType<typeof getAuthedClient>,
    conferenceId: string,
    eventKey: string,
    applicationIds: string[],
  ) {
    if (applicationIds.length === 0) return;
    const { data: templateRow } = await supabase
      .from('email_templates')
      .select('id')
      .eq('conference_id', conferenceId)
      .eq('event_key', eventKey)
      .maybeSingle();
    if (!templateRow) return;
    await supabase
      .from('email_outbox')
      .delete()
      .eq('conference_id', conferenceId)
      .eq('template_id', (templateRow as { id: string }).id)
      .eq('status', 'pending')
      .not('send_after', 'is', null)
      .in('recipient_application_id', applicationIds);
  }

  // The recipients for a release invite event: chairs -> that committee's
  // chair applications, delegates -> every allocated delegate's application
  // in that committee.
  async function releaseRecipientIds(
    supabase: ReturnType<typeof getAuthedClient>,
    committeeId: string,
    chairUserIds: string[],
    eventKey: 'session_chair_invite' | 'session_join_invite',
  ): Promise<string[]> {
    if (!conference) return [];
    if (eventKey === 'session_chair_invite') {
      if (chairUserIds.length === 0) return [];
      const { data } = await supabase
        .from('applications')
        .select('id')
        .eq('conference_id', conference.id)
        .eq('role', 'chair')
        .in('user_id', chairUserIds);
      return ((data ?? []) as { id: string }[]).map(a => a.id);
    }
    const { data } = await supabase
      .from('conference_allocations')
      .select('application_id')
      .eq('conference_committee_id', committeeId)
      .not('application_id', 'is', null);
    return Array.from(new Set(((data ?? []) as { application_id: string }[]).map(a => a.application_id)));
  }

  // Writes one or both release columns to every committee in `targets`,
  // verified. Any change first clears a previously scheduled invite for that
  // committee/event (a fresh future value, an immediate past value, or
  // clearing back to null all invalidate an old schedule the same way — the
  // point is never leaving a stale queued row to fire later). A future value
  // then pre-queues the matching invite email per affected committee; a null
  // or past value never pre-queues (immediate sending is the Send Now
  // actions' job).
  async function saveReleaseTimestamp(
    fields: ('released_to_chairs_at' | 'released_to_delegates_at')[],
    targets: Committee[],
    isoValue: string | null,
  ): Promise<boolean> {
    if (!session || !conference || targets.length === 0) return false;
    const supabase = getAuthedClient(session.access_token);
    const ids = targets.map(t => t.id);
    const patch: Record<string, string | null> = {};
    for (const f of fields) patch[f] = isoValue;
    const { data, error } = await supabase.from('conference_committees').update(patch).in('id', ids).select('id');
    if (error || !data || data.length !== ids.length) return false;

    setCommittees(prev => prev.map(c => (ids.includes(c.id) ? { ...c, ...patch } : c)));

    const isFuture = isoValue !== null && new Date(isoValue).getTime() > Date.now();
    for (const f of fields) {
      const eventKey = f === 'released_to_chairs_at' ? 'session_chair_invite' : 'session_join_invite';
      for (const t of targets) {
        const applicationIds = await releaseRecipientIds(supabase, t.id, t.chair_user_ids ?? [], eventKey);
        if (applicationIds.length === 0) continue;
        await clearStaleScheduled(supabase, conference.id, eventKey, applicationIds);
        if (isFuture) {
          const extraCtx = eventKey === 'session_join_invite' ? { session_code: t.session_code } : undefined;
          await queueEventEmail(supabase, conference.id, eventKey, applicationIds, extraCtx, { sendAfter: isoValue! });
        }
      }
    }
    return true;
  }

  // Sibling of handleSendToChairs (below): stamps released_to_delegates_at =
  // now() on one committee and queues session_join_invite immediately to
  // every allocated delegate's application.
  async function handleSendToParticipants(c: Committee) {
    if (!session || !conference) return;
    const status = releaseStatus(c.released_to_delegates_at);
    const { confirmed } = await confirm({
      title: status === 'released' ? 'Resend to participants?' : 'Send to participants?',
      body: 'This notifies every delegate allocated to this committee.',
      confirmLabel: status === 'released' ? 'Resend' : 'Send',
    });
    if (!confirmed) return;

    const prevReleasedAt = c.released_to_delegates_at;
    const releasedAt = new Date().toISOString();
    setCommittees(prev => prev.map(x => (x.id === c.id ? { ...x, released_to_delegates_at: releasedAt } : x)));
    setActionError('');
    setSendingToParticipants(c.id);
    showFlash('Sent to participants.');
    const supabase = getAuthedClient(session.access_token);
    (async () => {
      const { error: primaryError } = await supabase.from('conference_committees').update({ released_to_delegates_at: releasedAt }).eq('id', c.id);
      if (primaryError) {
        setCommittees(prev => prev.map(x => (x.id === c.id ? { ...x, released_to_delegates_at: prevReleasedAt } : x)));
        setFlash(null);
        setActionError("Couldn't send to participants. The release was reverted.");
        return;
      }
      try {
        const { data: allocRows } = await supabase
          .from('conference_allocations')
          .select('application_id')
          .eq('conference_committee_id', c.id)
          .not('application_id', 'is', null);
        const appIds = Array.from(new Set(((allocRows ?? []) as { application_id: string }[]).map(a => a.application_id)));
        if (appIds.length > 0) {
          const result = await queueEventEmail(supabase, conference.id, 'session_join_invite', appIds, { session_code: c.session_code });
          notifyIfNeeded(result, pushDraftNotice);
        }
      } catch {
        setActionError('Released to participants, but the invite emails could not be queued.');
      }
    })().finally(() => setSendingToParticipants(cur => (cur === c.id ? null : cur)));
  }

  // Bulk variant of handleSendToParticipants, every committee at once.
  async function handleSendAllToParticipants() {
    if (!session || !conference || committees.length === 0 || sendingAllToParticipants) return;
    const { confirmed } = await confirm({
      title: 'Send all committee sessions to participants?',
      body: 'This notifies every delegate allocated across every committee.',
      confirmLabel: 'Send All',
    });
    if (!confirmed) return;

    const ids = committees.map(c => c.id);
    const prevReleasedAts = new Map(committees.map(c => [c.id, c.released_to_delegates_at]));
    const releasedAt = new Date().toISOString();
    setCommittees(prev => prev.map(c => ({ ...c, released_to_delegates_at: releasedAt })));
    setActionError('');
    setSendingAllToParticipants(true);
    showFlash('Sent to all participants.');
    const supabase = getAuthedClient(session.access_token);
    (async () => {
      const { error: primaryError } = await supabase.from('conference_committees').update({ released_to_delegates_at: releasedAt }).in('id', ids);
      if (primaryError) {
        setCommittees(prev => prev.map(c => ({ ...c, released_to_delegates_at: prevReleasedAts.get(c.id) ?? null })));
        setFlash(null);
        setActionError("Couldn't send to all participants. The release was reverted.");
        return;
      }
      try {
        const { data: allocRows } = await supabase
          .from('conference_allocations')
          .select('application_id, conference_committee_id')
          .in('conference_committee_id', ids)
          .not('application_id', 'is', null);
        // Queued per committee (not one merged call across every recipient) —
        // {{session_code}} has to resolve to THAT committee's own code, which
        // differs across committees.
        const appIdsByCommittee = new Map<string, Set<string>>();
        for (const row of ((allocRows ?? []) as { application_id: string; conference_committee_id: string }[])) {
          const set = appIdsByCommittee.get(row.conference_committee_id) ?? new Set<string>();
          set.add(row.application_id);
          appIdsByCommittee.set(row.conference_committee_id, set);
        }
        for (const c of committees) {
          const appIds = Array.from(appIdsByCommittee.get(c.id) ?? []);
          if (appIds.length === 0) continue;
          const result = await queueEventEmail(supabase, conference.id, 'session_join_invite', appIds, { session_code: c.session_code });
          notifyIfNeeded(result, pushDraftNotice);
        }
      } catch {
        setActionError('Released to all participants, but the invite emails could not be queued.');
      }
    })().finally(() => setSendingAllToParticipants(false));
  }

  // The session code is minted server-side, so this keeps its await, but the
  // busy state is scoped to this one button; the rest of the page stays live.
  async function generateSessionCode(committee: CommitteeRow) {
    if (!session) return;
    if (committee.session_id) return; // already linked to a real session
    const busyKey = `mint-${committee.id}`;
    if (busyIds.has(busyKey)) return;
    markBusy(busyKey, true);
    setActionError('');
    const supabase = getAuthedClient(session.access_token);
    const code = await mintConferenceSession(supabase, committee.id, committee.name, (committee.topics ?? [])[0] ?? '', []);
    markBusy(busyKey, false);
    if (!code) {
      setActionError("Couldn't generate a session code. Please try again.");
      return;
    }
    // Show the minted code immediately; a silent refetch syncs session_id.
    setCommittees(prev => prev.map(x => x.id === committee.id ? { ...x, session_code: code } : x));
    loadCommittees({ silent: true });
  }

  function handleCopyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  // Optimistic (AGENTS.md Rule 5): the card disappears immediately; the DB
  // deletes run in the background and the row is re-inserted on failure.
  function handleDeleteCommittee(c: CommitteeRow) {
    if (!session || busyIds.has(c.id)) return;
    const removedIndex = committees.findIndex(x => x.id === c.id);
    const removedRow = removedIndex >= 0 ? committees[removedIndex] : null;
    setCommittees(prev => prev.filter(x => x.id !== c.id));
    setDeleteTarget(null);
    setActionError('');
    markBusy(c.id, true);
    const supabase = getAuthedClient(session.access_token);
    (async () => {
      // Delete the linked session first, cascades all session children (delegates, speakers_list, current_speaker, motions, documents, messages, feedback).
      if (c.session_id) {
        const { error: sessionError } = await supabase.from('committees').delete().eq('id', c.session_id);
        if (sessionError) throw sessionError;
      }
      // Delete the conference committee, cascades slots, allocations, awards, position_papers, study_guides, application_preferences; sets applications/job_postings to null (preserved).
      const { error } = await supabase.from('conference_committees').delete().eq('id', c.id);
      if (error) throw error;
    })().catch(() => {
      if (removedRow) {
        setCommittees(prev => {
          const next = prev.filter(x => x.id !== c.id);
          next.splice(Math.min(removedIndex, next.length), 0, removedRow);
          return next;
        });
      }
      setActionError(`Couldn't delete "${c.name}". It was restored.`);
    }).finally(() => markBusy(c.id, false));
  }

  // Same semantics as assignment/page.tsx handleRemoveChair, filter the id out of
  // chair_user_ids and revert the chair's application to accepted. display_chairs
  // is recomputed by the DB trigger; never written client-side. The avatar→user_id
  // mapping relies on the trigger keeping display_chairs index-aligned with
  // chair_user_ids; on a mismatch (hand-seeded demo dais) fall back to profiles.
  async function handleRemoveChair(c: Committee, index: number, name: string) {
    if (!session || !conference || busyIds.has(c.id)) return;
    if (!window.confirm(`Remove ${name} from the ${c.abbreviation || c.name} dais?`)) return;
    const supabase = getAuthedClient(session.access_token);
    const ids = c.chair_user_ids ?? [];
    const dc = c.display_chairs ?? [];
    let userId: string | null = null;
    if (ids.length === dc.length) {
      userId = ids[index] ?? null;
    } else if (ids.length > 0) {
      const { data } = await supabase.from('profiles').select('id, display_name').in('id', ids);
      userId = ((data ?? []) as { id: string; display_name: string }[]).find(p => p.display_name === name)?.id ?? null;
    }
    if (!userId) {
      window.alert('This dais entry is not linked to a Gavelling account, so it cannot be removed here.');
      return;
    }
    // Optimistic: drop the chair from the card immediately; the trigger's
    // authoritative display_chairs arrives via the silent refetch.
    const prevIds = c.chair_user_ids;
    const prevDisplay = c.display_chairs;
    const nextIds = ids.filter(id => id !== userId);
    const nextDisplay = ids.length === dc.length ? dc.filter((_, i) => i !== index) : dc.filter(ch => ch.name !== name);
    setCommittees(prev => prev.map(x => x.id === c.id ? { ...x, chair_user_ids: nextIds, display_chairs: nextDisplay } : x));
    setActionError('');
    markBusy(c.id, true);
    (async () => {
      const { error: primaryError } = await supabase.from('conference_committees').update({ chair_user_ids: nextIds }).eq('id', c.id);
      if (primaryError) {
        // Primary write failed, restore exactly the fields we touched.
        setCommittees(prev => prev.map(x => x.id === c.id ? { ...x, chair_user_ids: prevIds, display_chairs: prevDisplay } : x));
        setActionError(`Couldn't remove ${name}. The dais was restored.`);
        return;
      }
      const { error: appError } = await supabase.from('applications')
        .update({ status: 'accepted', assigned_committee_id: null, decided_by: session.user.id, decided_at: new Date().toISOString() })
        .eq('conference_id', conference.id)
        .eq('user_id', userId)
        .eq('role', 'chair');
      if (appError) {
        // Secondary effect failed, surface it, but the removal stands.
        setActionError(`${name} was removed from the dais, but their application couldn't be reset to accepted.`);
      }
      loadCommittees({ silent: true });
    })().finally(() => markBusy(c.id, false));
  }

  // Optimistic assign (mirrors assignment/page.tsx handleAssignChair semantics):
  // dedup-append to chair_user_ids, patch the card at once, persist in the
  // background; the DB trigger recomputes display_chairs and the silent
  // refetch syncs the authoritative version.
  function handleAssignChair(c: Committee, app: ChairApplicant) {
    if (!session || busyIds.has(c.id)) return;
    const prevIds = c.chair_user_ids;
    const prevDisplay = c.display_chairs;
    const nextIds = Array.from(new Set([...(c.chair_user_ids ?? []), app.user_id]));
    const alreadyOnDais = (c.chair_user_ids ?? []).includes(app.user_id);
    const nextDisplay = alreadyOnDais
      ? (c.display_chairs ?? [])
      : [...(c.display_chairs ?? []), { name: app.profiles?.display_name ?? 'Unknown', avatar_url: app.profiles?.avatar_url ?? null }];
    setCommittees(prev => prev.map(x => x.id === c.id ? { ...x, chair_user_ids: nextIds, display_chairs: nextDisplay } : x));
    setAddChairTarget(null);
    setActionError('');
    markBusy(c.id, true);
    const supabase = getAuthedClient(session.access_token);
    (async () => {
      const { error: primaryError } = await supabase.from('conference_committees').update({ chair_user_ids: nextIds }).eq('id', c.id);
      if (primaryError) {
        setCommittees(prev => prev.map(x => x.id === c.id ? { ...x, chair_user_ids: prevIds, display_chairs: prevDisplay } : x));
        setActionError(`Couldn't add ${app.profiles?.display_name ?? 'that chair'} to the dais. The change was reverted.`);
        return;
      }
      const { error: appError } = await supabase.from('applications').update({ status: 'assigned', assigned_committee_id: c.id, decided_by: session.user.id, decided_at: new Date().toISOString() }).eq('id', app.id);
      if (appError) {
        setActionError(`${app.profiles?.display_name ?? 'The chair'} was added to the dais, but their application couldn't be marked assigned.`);
      }
      loadCommittees({ silent: true });
    })().finally(() => markBusy(c.id, false));
  }

  // Release the committee to its dais, always happens regardless of whether
  // the invite email drafts successfully (a missing template just nudges the
  // organizer via DraftNotice, it never blocks the release).
  async function handleSendToChairs(c: Committee) {
    if (!session || !conference) return;
    const dais = c.display_chairs ?? [];
    const { confirmed } = await confirm({
      title: c.released_to_chairs_at ? 'Resend to chairs?' : 'Send to chairs?',
      body: dais.length > 0
        ? `This notifies: ${dais.map(d => d.name).join(', ')}.`
        : 'This committee has no chairs on its dais yet.',
      confirmLabel: c.released_to_chairs_at ? 'Resend' : 'Send',
    });
    if (!confirmed) return;

    // Optimistic: stamp the release locally and confirm at once; the write and
    // the invite emails run in the background.
    const prevReleasedAt = c.released_to_chairs_at;
    const releasedAt = new Date().toISOString();
    setCommittees(prev => prev.map(x => x.id === c.id ? { ...x, released_to_chairs_at: releasedAt } : x));
    setActionError('');
    setSendingToChairs(c.id);
    showFlash(`Sent to ${dais.length} chair${dais.length === 1 ? '' : 's'}.`);
    const supabase = getAuthedClient(session.access_token);
    (async () => {
      const { error: primaryError } = await supabase.from('conference_committees').update({ released_to_chairs_at: releasedAt }).eq('id', c.id);
      if (primaryError) {
        // Primary write failed, restore only the release stamp.
        setCommittees(prev => prev.map(x => x.id === c.id ? { ...x, released_to_chairs_at: prevReleasedAt } : x));
        setFlash(null);
        setActionError("Couldn't send to chairs. The release was reverted.");
        return;
      }
      try {
        const chairIds = c.chair_user_ids ?? [];
        if (chairIds.length > 0) {
          const { data: chairApps } = await supabase
            .from('applications')
            .select('id')
            .eq('conference_id', conference.id)
            .eq('role', 'chair')
            .in('user_id', chairIds);
          const appIds = ((chairApps ?? []) as { id: string }[]).map(a => a.id);
          if (appIds.length > 0) {
            const result = await queueEventEmail(supabase, conference.id, 'session_chair_invite', appIds);
            notifyIfNeeded(result, pushDraftNotice);
          }
        }
      } catch {
        // Secondary effect failed, the release stands; just surface it.
        setActionError('Released to chairs, but the invite emails could not be queued.');
      }
    })().finally(() => setSendingToChairs(cur => (cur === c.id ? null : cur)));
  }

  if (!conference) return null;

  let sortedCommittees = committees;
  if (sortKey) {
    sortedCommittees = [...committees].sort((a, b) => {
      if (sortKey === 'name') {
        const cmp = a.name.localeCompare(b.name);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      let va = 0, vb = 0;
      if (sortKey === 'difficulty') {
        va = DIFF_ORDER[(a.difficulty ?? '').toLowerCase()] ?? 99;
        vb = DIFF_ORDER[(b.difficulty ?? '').toLowerCase()] ?? 99;
      } else {
        va = a.committee_type === 'crisis' ? 1 : 0;
        vb = b.committee_type === 'crisis' ? 1 : 0;
      }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }
  const cycleSort = (key: 'difficulty' | 'name' | 'type') => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
    else if (sortDir === 'asc') { setSortDir('desc'); }
    else { setSortKey(''); setSortDir('asc'); }
  };

  return (
    <div className="px-6 md:px-10 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs mb-1" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.12em' }}>
            {conference.acronym} / Committees
          </p>
          <h1 className="font-black text-2xl" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            Committees
          </h1>
        </div>
        <NeuButton icon={Plus} onClick={() => setShowAdd(true)}>
          ADD COMMITTEE
        </NeuButton>
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

      {flash && (
        <div
          className="rounded-xl px-4 py-2.5 mb-5 text-sm"
          style={{
            backgroundColor: 'rgba(61,122,82,0.10)',
            border: '1px solid rgba(61,122,82,0.35)',
            color: '#3D7A52',
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 600,
          }}
        >
          {flash}
        </div>
      )}

      {actionError && (
        <div
          className="rounded-xl px-4 py-2.5 mb-5 text-sm"
          style={{
            backgroundColor: 'rgba(139,32,32,0.06)',
            border: '1px solid rgba(139,32,32,0.2)',
            color: '#8B2020',
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 600,
          }}
        >
          {actionError}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      )}

      {!loading && committees.length === 0 && (
        <div
          className="flex flex-col items-center text-center py-16 px-6 rounded-2xl"
          style={{
            border: '1.5px dashed #C8BEA8',
            backgroundColor: 'rgba(250,248,243,0.6)',
          }}
        >
          <span
            className="flex items-center justify-center mb-4"
            style={{
              width: 56, height: 56, borderRadius: '9999px',
              background: 'linear-gradient(150deg, rgba(27,56,40,0.12), rgba(27,56,40,0.05))',
              border: '1.5px solid rgba(27,56,40,0.18)',
            }}
          >
            <Building2 size={24} style={{ color: '#1B3828' }} />
          </span>
          <p className="font-bold text-lg mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>No committees yet</p>
          <p className="text-sm mb-5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", maxWidth: 320 }}>
            Committees are where delegates debate. Add your first one to give applicants somewhere to be assigned.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-xl py-2.5 px-5 font-bold text-sm focus:outline-none transition-colors"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            <Plus size={15} />
            ADD YOUR FIRST COMMITTEE
          </button>
        </div>
      )}

      {!loading && committees.length > 0 && (
        <>
          {/* Tab switcher, same neumorphic pill pattern as Financials' sub-nav */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <NeuPill active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
              <LayoutGrid size={12} strokeWidth={2.5} />
              OVERVIEW
            </NeuPill>
            <NeuPill active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
              <Settings size={12} strokeWidth={2.5} />
              SETTINGS
            </NeuPill>
          </div>

          {/* Session release settings — neumorphic, matching Financials'
              settings tab: NEU surface card, gold uppercase eyebrows,
              inset wells for the time pickers, inset rows per committee. */}
          {activeTab === 'settings' && releaseSettingsLoaded && (
            <NeuCard style={{ padding: '26px 28px', marginBottom: 24 }}>
              <p style={{ margin: 0, fontFamily: OUTFIT, fontWeight: 700, fontSize: 10, letterSpacing: '0.16em', color: NEU.deepGold, textTransform: 'uppercase' }}>
                SESSION RELEASE
              </p>

              <div className="flex flex-col gap-4 mt-5">
                <div className="flex items-center justify-between gap-3">
                  <span style={{ fontFamily: OUTFIT, fontSize: 13.5, color: NEU.ink, fontWeight: 600 }}>
                    Chairs and delegates receive session codes at the same time
                  </span>
                  <PillToggle value={releaseSameTime} onChange={saveSameTime} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span style={{ fontFamily: OUTFIT, fontSize: 13.5, color: NEU.ink, fontWeight: 600 }}>
                    Release all committee sessions at once
                  </span>
                  <PillToggle value={releaseAllAtOnce} onChange={saveAllAtOnce} />
                </div>
              </div>

              <div className="mt-6 pt-6" style={{ borderTop: '1px solid rgba(27,56,40,0.08)' }}>
                {releaseAllAtOnce ? (
                  releaseSameTime ? (
                    <div>
                      <label style={labelStyle}>Release sessions at</label>
                      <ReleaseTimePicker
                        value={committees[0]?.released_to_chairs_at ?? null}
                        onSave={iso => saveReleaseTimestamp(['released_to_chairs_at', 'released_to_delegates_at'], committees, iso)}
                        placeholder={`Defaults to ${fmtConferenceStart(conference.start_date)}`}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label style={labelStyle}>Release to chairs at</label>
                        <ReleaseTimePicker
                          value={committees[0]?.released_to_chairs_at ?? null}
                          onSave={iso => saveReleaseTimestamp(['released_to_chairs_at'], committees, iso)}
                          placeholder={`Defaults to ${fmtConferenceStart(conference.start_date)}`}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Release to delegates at</label>
                        <ReleaseTimePicker
                          value={committees[0]?.released_to_delegates_at ?? null}
                          onSave={iso => saveReleaseTimestamp(['released_to_delegates_at'], committees, iso)}
                          placeholder={`Defaults to ${fmtConferenceStart(conference.start_date)}`}
                        />
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {committees.map(c => (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 flex-wrap rounded-xl px-4 py-3"
                        style={{ backgroundColor: NEU.base, boxShadow: NEU.inSm }}
                      >
                        <span className="truncate" style={{ width: 150, flexShrink: 0, fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 800, color: NEU.ink }}>
                          {c.abbreviation || c.name}
                        </span>
                        {releaseSameTime ? (
                          <div style={{ flex: 1, minWidth: 220 }}>
                            <ReleaseTimePicker
                              value={c.released_to_chairs_at}
                              onSave={iso => saveReleaseTimestamp(['released_to_chairs_at', 'released_to_delegates_at'], [c], iso)}
                              placeholder={`Defaults to ${fmtConferenceStart(conference.start_date)}`}
                            />
                          </div>
                        ) : (
                          <>
                            <div style={{ flex: 1, minWidth: 200 }}>
                              <ReleaseTimePicker
                                value={c.released_to_chairs_at}
                                onSave={iso => saveReleaseTimestamp(['released_to_chairs_at'], [c], iso)}
                                placeholder={`Chairs, defaults to ${fmtConferenceStart(conference.start_date)}`}
                              />
                            </div>
                            <div style={{ flex: 1, minWidth: 200 }}>
                              <ReleaseTimePicker
                                value={c.released_to_delegates_at}
                                onSave={iso => saveReleaseTimestamp(['released_to_delegates_at'], [c], iso)}
                                placeholder={`Delegates, defaults to ${fmtConferenceStart(conference.start_date)}`}
                              />
                            </div>
                          </>
                        )}
                        <CompactSendButton
                          releasedAt={c.released_to_delegates_at}
                          busy={sendingToParticipants === c.id}
                          onSend={() => handleSendToParticipants(c)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6" style={{ borderTop: '1px solid rgba(27,56,40,0.08)' }}>
                <label style={labelStyle}>Observer and advisor access</label>
                <ReleaseTimePicker
                  value={releaseAdvisorsAt}
                  onSave={saveAdvisorsAt}
                  placeholder={`Defaults to ${fmtConferenceStart(conference.start_date)}`}
                />
              </div>

              <div className="mt-6 pt-6" style={{ borderTop: '1px solid rgba(27,56,40,0.08)' }}>
                <NeuButton
                  icon={Send}
                  gradient={NEU_GRADIENTS.forest}
                  disabled={sendingAllToParticipants}
                  onClick={handleSendAllToParticipants}
                >
                  {sendingAllToParticipants ? 'SENDING...' : 'SEND ALL TO PARTICIPANTS'}
                </NeuButton>
              </div>
            </NeuCard>
          )}

          {activeTab === 'overview' && (
          <>
          {/* Sort bar + cards/list view toggle */}
          <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
            {committees.length > 1 ? (
              <div
                className="inline-flex flex-wrap items-center gap-1.5 rounded-full px-2 py-1.5"
                style={{
                  backgroundColor: 'rgba(250,248,243,0.72)',
                  backdropFilter: 'blur(16px) saturate(1.4)',
                  WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
                  border: '1px solid rgba(221,212,192,0.85)',
                  boxShadow: '0 6px 20px rgba(27,56,40,0.07)',
                }}
              >
                <SortButton label="DIFFICULTY" dir={sortKey === 'difficulty' ? sortDir : null} onClick={() => cycleSort('difficulty')} />
                <SortButton label="NAME" dir={sortKey === 'name' ? sortDir : null} onClick={() => cycleSort('name')} />
                <SortButton label="GA / CRISIS" dir={sortKey === 'type' ? sortDir : null} onClick={() => cycleSort('type')} />
              </div>
            ) : <span />}
            <ViewToggle value={view} onChange={changeView} />
          </div>

          {view === 'list' ? (
          /* ── Compact list view: one committee per row ─────────────────── */
          <div className="flex flex-col gap-2.5">
            {sortedCommittees.map(c => {
              const isCrisis = c.committee_type === 'crisis';
              const topics = c.topics ?? [];
              const seats = c.slotCount || c.total_slots;
              const copied = copiedCode === c.session_code && !!c.session_code;
              const dais = c.display_chairs ?? [];
              const minting = busyIds.has(`mint-${c.id}`);
              const seatLabel = !isCrisis && c.delegation_size === 2
                ? `${seats} countries · ${seats * 2} seats`
                : `${seats} ${isCrisis ? (seats === 1 ? 'role' : 'roles') : (seats === 1 ? 'seat' : 'seats')}`;
              return (
                <NeuCard key={c.id} hover style={{ padding: '13px 16px', borderRadius: 18 }}>
                  <div className="flex items-center gap-3.5 flex-wrap">
                    {/* Emblem */}
                    {c.logo_url ? (
                      <img
                        src={c.logo_url}
                        alt={c.abbreviation ?? c.name}
                        style={{ width: 46, height: 46, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 5px 10px rgba(27,56,40,0.24))' }}
                      />
                    ) : (
                      <MonogramMedallion text={c.abbreviation || c.name} isCrisis={isCrisis} size={46} />
                    )}

                    {/* Name + meta */}
                    <div className="min-w-0" style={{ flex: '1 1 240px' }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        {c.abbreviation && (
                          <span style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', color: NEU.deepGold, fontVariantNumeric: 'tabular-nums' }}>
                            {c.abbreviation.toUpperCase()}
                          </span>
                        )}
                        {isCrisis && (
                          <span style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: '#8B2020' }}>CRISIS</span>
                        )}
                      </div>
                      <h3 className="truncate font-bold" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 14.5, lineHeight: 1.25, margin: '1px 0 0 0' }}>
                        {c.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <DifficultyTile level={c.difficulty} size="sm" />
                        <span className="text-[11.5px] font-semibold" style={{ color: NEU.muted, fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                          {seatLabel}
                        </span>
                        {topics.length > 0 && (
                          <span className="text-[11.5px] font-semibold" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                            · {topics.length} topic{topics.length === 1 ? '' : 's'}
                          </span>
                        )}
                        {c.position_paper_deadline && (
                          <span className="inline-flex items-center gap-1" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: NEU.muted }}>
                            <CalendarClock size={11} style={{ color: NEU.deepGold, flexShrink: 0 }} />
                            {new Date(c.position_paper_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dais cluster */}
                    <div className="flex items-center flex-shrink-0" style={{ paddingLeft: 6 }}>
                      {dais.map((ch, chIdx) => (
                        <div key={`${ch.name}-${chIdx}`} className="group relative" style={{ marginLeft: chIdx === 0 ? 0 : -8 }} title={ch.name}>
                          {ch.avatar_url ? (
                            <img src={ch.avatar_url} alt={ch.name} style={{ width: 30, height: 30, borderRadius: 9999, objectFit: 'cover', border: '2px solid #F0EBDD', backgroundColor: '#EDE7D8' }} />
                          ) : (
                            <span className="flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 9999, border: '2px solid #F0EBDD', backgroundColor: NEU.forest, color: NEU.gold, fontSize: 12, fontWeight: 700, fontFamily: OUTFIT }}>
                              {ch.name.charAt(0)}
                            </span>
                          )}
                          <button
                            onClick={() => handleRemoveChair(c, chIdx, ch.name)}
                            title={`Remove ${ch.name} from the dais`}
                            className="absolute opacity-0 group-hover:opacity-100 flex items-center justify-center focus:outline-none"
                            style={{ top: -4, right: -4, width: 16, height: 16, borderRadius: 9999, backgroundColor: '#FAF8F3', border: '1px solid rgba(139,32,32,0.45)', color: '#8B2020', cursor: 'pointer', boxShadow: '0 2px 5px rgba(27,56,40,0.18)', transition: `opacity 200ms ${EASE}` }}
                          >
                            <X size={9} strokeWidth={2.6} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setAddChairTarget(c)}
                        title="Add chair"
                        className="flex items-center justify-center focus:outline-none"
                        style={{ width: 30, height: 30, marginLeft: dais.length ? -8 : 0, borderRadius: 9999, border: '1.5px dashed rgba(27,56,40,0.4)', color: NEU.forest, backgroundColor: '#F0EBDD', cursor: 'pointer', transition: `background-color 220ms ${EASE}, color 220ms ${EASE}` }}
                        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = NEU.forest; el.style.color = NEU.gold; el.style.borderStyle = 'solid'; }}
                        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#F0EBDD'; el.style.color = NEU.forest; el.style.borderStyle = 'dashed'; }}
                      >
                        <Plus size={15} strokeWidth={2.3} />
                      </button>
                    </div>

                    {/* Session code */}
                    {c.session_code ? (
                      <button
                        onClick={() => handleCopyCode(c.session_code!)}
                        title="Copy session code"
                        className="inline-flex items-center gap-1.5 flex-shrink-0 focus:outline-none"
                        style={{ padding: '6px 12px', borderRadius: 9999, backgroundColor: copied ? 'rgba(61,122,82,0.12)' : NEU.surface, boxShadow: copied ? 'none' : NEU.outSm, cursor: 'pointer', transition: `background-color 250ms ${EASE}` }}
                      >
                        {copied ? (
                          <>
                            <Check size={12} style={{ color: NEU.green }} />
                            <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: NEU.green }}>COPIED</span>
                          </>
                        ) : (
                          <>
                            <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.12em', color: NEU.forest, fontVariantNumeric: 'tabular-nums' }}>{c.session_code}</span>
                            <Copy size={11} style={{ color: 'rgba(27,56,40,0.55)' }} />
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => generateSessionCode(c)}
                        disabled={minting}
                        className="inline-flex items-center flex-shrink-0 focus:outline-none"
                        style={{ padding: '6px 13px', borderRadius: 9999, border: '1.5px dashed rgba(27,56,40,0.35)', color: minting ? NEU.muted : NEU.forest, backgroundColor: 'transparent', fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', cursor: minting ? 'default' : 'pointer' }}
                      >
                        {minting ? 'GENERATING…' : 'GENERATE CODE'}
                      </button>
                    )}

                    {/* Release actions */}
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      {(c.chair_user_ids?.length ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: NEU.muted }}>CHAIRS</span>
                          <CompactSendButton releasedAt={c.released_to_chairs_at} busy={sendingToChairs === c.id} onSend={() => handleSendToChairs(c)} />
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: NEU.muted }}>DELEGATES</span>
                        <CompactSendButton releasedAt={c.released_to_delegates_at} busy={sendingToParticipants === c.id} onSend={() => handleSendToParticipants(c)} />
                      </div>
                    </div>

                    {/* Edit / delete */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setEditTarget(c)}
                        className="focus:outline-none"
                        style={{ padding: '7px 14px', borderRadius: 9999, backgroundColor: NEU.surface, boxShadow: NEU.outSm, color: NEU.forest, fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', cursor: 'pointer' }}
                      >
                        EDIT
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        title="Delete committee"
                        className="flex items-center justify-center focus:outline-none"
                        style={{ width: 32, height: 32, borderRadius: 9999, backgroundColor: NEU.surface, boxShadow: NEU.outSm, color: '#8B2020', cursor: 'pointer', transition: `background-color 250ms ${EASE}, color 250ms ${EASE}` }}
                        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#8B2020'; el.style.color = '#FFFFFF'; el.style.boxShadow = 'none'; }}
                        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = NEU.surface; el.style.color = '#8B2020'; el.style.boxShadow = NEU.outSm; }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </NeuCard>
              );
            })}
          </div>
          ) : (
          /* ── Cards view (default) ─────────────────────────────────────── */
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
            {sortedCommittees.map(c => {
              const isCrisis = c.committee_type === 'crisis';
              const topics = c.topics ?? [];
              const seats = c.slotCount || c.total_slots;
              const copied = copiedCode === c.session_code && !!c.session_code;
              const dais = c.display_chairs ?? [];
              return (
                <article
                  key={c.id}
                  className="flex flex-col"
                  style={{
                    backgroundColor: NEU.surface,
                    borderRadius: 22,
                    boxShadow: NEU.out,
                    transition: `transform 300ms ${EASE}, box-shadow 300ms ${EASE}`,
                  }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = NEU.outHover; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(0)'; el.style.boxShadow = NEU.out; }}
                >
                  <div className="flex flex-col items-center px-4 pt-5 flex-1">
                    {/* Emblem, uploaded art or monogram medallion */}
                    {c.logo_url ? (
                      <img
                        src={c.logo_url}
                        alt={c.abbreviation ?? c.name}
                        style={{
                          width: '84px', height: '84px', objectFit: 'contain', flexShrink: 0,
                          filter: 'drop-shadow(0 8px 15px rgba(27,56,40,0.26))',
                        }}
                      />
                    ) : (
                      <MonogramMedallion text={c.abbreviation || c.name} isCrisis={isCrisis} size={78} />
                    )}

                    {/* Abbreviation eyebrow (when art carries the emblem, the monogram moves up here) */}
                    {c.abbreviation && (
                      <p style={{ margin: '12px 0 0 0', fontFamily: "'Outfit', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', color: '#B6871F', fontVariantNumeric: 'tabular-nums' }}>
                        {c.abbreviation.toUpperCase()}
                      </p>
                    )}

                    {/* Name */}
                    <h3
                      className="text-center font-bold text-[14.5px] leading-snug"
                      style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: c.abbreviation ? '4px 0 0 0' : '14px 0 0 0', minHeight: '2.4em' }}
                    >
                      {c.name}
                    </h3>

                    {/* Meta row — canonical rank insignia + seats */}
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                      <DifficultyTile level={c.difficulty} />
                      <span className="text-[12px] font-semibold" style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                        {!isCrisis && c.delegation_size === 2
                          ? `${seats} countries · ${seats * 2} seats`
                          : `${seats} ${isCrisis ? (seats === 1 ? 'role' : 'roles') : (seats === 1 ? 'seat' : 'seats')}`}
                      </span>
                      {isCrisis && (
                        <>
                          <span aria-hidden style={{ color: 'rgba(182,135,31,0.55)', fontSize: '7px' }}>◆</span>
                          <span className="text-[10px] font-bold" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.12em' }}>
                            CRISIS
                          </span>
                        </>
                      )}
                    </div>

                    {/* Topics, roman numerals */}
                    {topics.length > 0 && (
                      <div className="w-full mt-4 pt-3.5" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
                        {topics.map((topic, ti) => (
                          <div key={topic} className="flex items-start gap-2.5 py-1">
                            <span
                              className="flex-shrink-0 text-right"
                              style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '11px', color: '#B6871F', width: '18px', lineHeight: '19px' }}
                            >
                              {ROMAN[ti] ?? String(ti + 1)}.
                            </span>
                            <span className="text-[12.5px] font-medium" style={{ color: '#2E2820', fontFamily: "'Outfit', sans-serif", lineHeight: 1.55 }}>
                              {topic}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Dais + session code ticket + PP deadline, pinned to the card bottom */}
                    <div className="w-full mt-auto">
                      {/* Dais, the committee's chairs, editable in place */}
                      <div className="w-full mt-4 pt-3.5" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
                        <p className="text-center" style={{ margin: '0 0 8px 0', fontFamily: "'Outfit', sans-serif", fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: '#B6871F' }}>
                          DAIS
                        </p>
                        <div className="flex flex-wrap items-start justify-center gap-x-4 gap-y-3">
                          {dais.map((ch, chIdx) => (
                            <div key={`${ch.name}-${chIdx}`} className="group relative flex flex-col items-center text-center" style={{ width: 72 }}>
                              <div className="relative">
                                {ch.avatar_url ? (
                                  <img
                                    src={ch.avatar_url}
                                    alt={ch.name}
                                    style={{
                                      width: '44px', height: '44px', borderRadius: '9999px', objectFit: 'cover',
                                      boxShadow: '0 4px 10px rgba(27,56,40,0.2)',
                                      backgroundColor: '#EDE7D8',
                                    }}
                                  />
                                ) : (
                                  <span
                                    className="flex items-center justify-center"
                                    style={{
                                      width: '44px', height: '44px', borderRadius: '9999px',
                                      backgroundColor: '#1B3828', color: '#EED98A',
                                      fontSize: '15px', fontWeight: 700, fontFamily: "'Outfit', sans-serif",
                                    }}
                                  >
                                    {ch.name.charAt(0)}
                                  </span>
                                )}
                                <button
                                  onClick={() => handleRemoveChair(c, chIdx, ch.name)}
                                  title={`Remove ${ch.name} from the dais`}
                                  className="absolute opacity-0 group-hover:opacity-100 flex items-center justify-center focus:outline-none"
                                  style={{
                                    top: -4, right: -4, width: 16, height: 16, borderRadius: '9999px',
                                    backgroundColor: '#FAF8F3', border: '1px solid rgba(139,32,32,0.45)', color: '#8B2020',
                                    cursor: 'pointer', boxShadow: '0 2px 6px rgba(27,56,40,0.18)',
                                    transition: `opacity 200ms ${EASE}`,
                                  }}
                                >
                                  <X size={9} strokeWidth={2.6} />
                                </button>
                              </div>
                              <span className="text-[11px] font-semibold mt-1.5 leading-tight" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                                {ch.name}
                              </span>
                            </div>
                          ))}
                          <button
                            onClick={() => setAddChairTarget(c)}
                            className="flex flex-col items-center text-center focus:outline-none"
                            style={{ width: 72, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            <span
                              className="flex items-center justify-center"
                              style={{
                                width: '44px', height: '44px', borderRadius: '9999px',
                                border: '1.5px dashed rgba(27,56,40,0.4)',
                                color: '#1B3828',
                                backgroundColor: 'rgba(27,56,40,0.04)',
                                transition: `background-color 250ms ${EASE}, color 250ms ${EASE}, border-color 250ms ${EASE}`,
                              }}
                              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#1B3828'; el.style.color = '#EED98A'; el.style.borderStyle = 'solid'; }}
                              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'rgba(27,56,40,0.04)'; el.style.color = '#1B3828'; el.style.borderStyle = 'dashed'; }}
                            >
                              <Plus size={18} strokeWidth={2.2} />
                            </span>
                            <span className="text-[10px] font-bold mt-1.5" style={{ color: '#B6871F', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.12em' }}>
                              ADD CHAIR
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Combined session control — code + chair/participant
                          release + PP deadline, all in one pressed-in well
                          (replaces the three separate top-bordered chips). */}
                      <div className="w-full mt-4 pt-4" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
                        <NeuInset small style={{ padding: 12 }}>
                          {/* Session code */}
                          {c.session_code ? (
                            <button
                              onClick={() => handleCopyCode(c.session_code!)}
                              title="Copy session code"
                              className="w-full flex items-center justify-between gap-2 rounded-[11px] px-3 py-2 focus:outline-none"
                              style={{
                                backgroundColor: copied ? 'rgba(61,122,82,0.12)' : NEU.surface,
                                boxShadow: copied ? 'none' : NEU.outSm,
                                cursor: 'pointer',
                                transition: `background-color 300ms ${EASE}`,
                              }}
                            >
                              <span style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: NEU.muted }}>
                                SESSION CODE
                              </span>
                              {copied ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <Check size={12} style={{ color: NEU.green }} />
                                  <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: NEU.green }}>COPIED</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5">
                                  <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, letterSpacing: '0.13em', color: NEU.forest, fontVariantNumeric: 'tabular-nums' }}>
                                    {c.session_code}
                                  </span>
                                  <Copy size={11} style={{ color: 'rgba(27,56,40,0.55)' }} />
                                </span>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => generateSessionCode(c)}
                              disabled={busyIds.has(`mint-${c.id}`)}
                              className="w-full rounded-[11px] py-2 text-[10.5px] font-bold focus:outline-none"
                              style={{
                                border: '1.5px dashed rgba(27,56,40,0.35)',
                                color: busyIds.has(`mint-${c.id}`) ? NEU.muted : NEU.forest,
                                backgroundColor: 'transparent',
                                fontFamily: OUTFIT, letterSpacing: '0.09em',
                                cursor: busyIds.has(`mint-${c.id}`) ? 'default' : 'pointer',
                              }}
                            >
                              {busyIds.has(`mint-${c.id}`) ? 'GENERATING…' : 'GENERATE SESSION CODE'}
                            </button>
                          )}

                          {/* Release affordances */}
                          <div className="mt-2.5 pt-2.5 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(27,56,40,0.08)' }}>
                            {(c.chair_user_ids?.length ?? 0) > 0 && (
                              <div className="flex items-center justify-between gap-2">
                                <span style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', color: NEU.muted }}>CHAIRS</span>
                                <CompactSendButton releasedAt={c.released_to_chairs_at} busy={sendingToChairs === c.id} onSend={() => handleSendToChairs(c)} />
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-2">
                              <span style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', color: NEU.muted }}>DELEGATES</span>
                              <CompactSendButton releasedAt={c.released_to_delegates_at} busy={sendingToParticipants === c.id} onSend={() => handleSendToParticipants(c)} />
                            </div>
                          </div>

                          {/* Position-paper deadline */}
                          {c.position_paper_deadline && (
                            <div className="flex items-center gap-1.5 mt-2.5 pt-2.5" style={{ borderTop: '1px solid rgba(27,56,40,0.08)' }}>
                              <CalendarClock size={11} style={{ color: NEU.deepGold, flexShrink: 0 }} />
                              <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: '#6B5F52', fontVariantNumeric: 'tabular-nums' }}>
                                Position papers due {new Date(c.position_paper_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          )}
                        </NeuInset>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-4 pb-4 pt-3.5 flex gap-2">
                    <button
                      onClick={() => setEditTarget(c)}
                      className="flex-1 rounded-xl py-2.5 text-[11px] font-bold focus:outline-none"
                      style={{
                        backgroundColor: 'transparent', color: '#1B3828',
                        border: '1.5px solid rgba(27,56,40,0.35)',
                        fontFamily: "'Outfit', sans-serif", letterSpacing: '0.1em', cursor: 'pointer',
                        transition: `background-color 300ms ${EASE}, color 300ms ${EASE}`,
                      }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#1B3828'; el.style.color = '#EED98A'; }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'transparent'; el.style.color = '#1B3828'; }}
                    >
                      EDIT
                    </button>
                    <button
                      onClick={() => setDeleteTarget(c)}
                      title="Delete committee"
                      className="flex items-center justify-center rounded-xl px-3.5 focus:outline-none"
                      style={{
                        border: '1.5px solid rgba(139,32,32,0.32)', color: '#8B2020', backgroundColor: 'transparent',
                        cursor: 'pointer',
                        transition: `background-color 300ms ${EASE}, color 300ms ${EASE}`,
                      }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#8B2020'; el.style.color = '#FFFFFF'; }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'transparent'; el.style.color = '#8B2020'; }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          )}
          </>
          )}
        </>
      )}

      {showAdd && (
        <CommitteeEditorModal
          conference={conference}
          committee={null}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); loadCommittees({ silent: true }); }}
        />
      )}
      {editTarget && (
        <CommitteeEditorModal
          conference={conference}
          committee={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); loadCommittees({ silent: true }); }}
        />
      )}
      {addChairTarget && (
        <AddChairModal
          conferenceId={conference.id}
          committee={addChairTarget}
          committees={committees}
          onClose={() => setAddChairTarget(null)}
          onDone={() => { setAddChairTarget(null); loadCommittees({ silent: true }); }}
          onInvited={name => showFlash(`Invite sent to ${name}`)}
          onAssign={app => handleAssignChair(addChairTarget, app)}
        />
      )}
      {deleteTarget && (
        <ModalOverlay onClose={() => setDeleteTarget(null)}>
          <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 400 }}>
            <p className="text-sm font-bold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Delete &ldquo;{deleteTarget.name}&rdquo;?</p>
            <p className="text-xs" style={{ color: '#6B5D4F', fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}>
              This permanently removes the committee and its live session, including all delegates, documents, messages, country slots, and allocations. Applicants are kept but returned to unassigned. This cannot be undone.
            </p>
            <div className="flex gap-3 mt-1">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}>CANCEL</button>
              <button onClick={() => handleDeleteCommittee(deleteTarget)} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ backgroundColor: '#8B2020', color: '#FFFFFF', fontFamily: "'Outfit', sans-serif" }}>DELETE</button>
            </div>
          </div>
        </ModalOverlay>
      )}
      {confirmModal}
    </div>
  );
}
