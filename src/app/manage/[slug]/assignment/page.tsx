'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, Check, Sparkles, ChevronDown, ChevronUp, Award, Globe2, ArrowRight, GripVertical, MousePointerClick, Plus } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import { LevelInsignia, LEVEL_ACCENT } from '@/app/account/accountUi';
import DelegationsView from '@/app/manage/[slug]/assignment/DelegationsView';
import IndependentsView from '@/app/manage/[slug]/assignment/IndependentsView';
import { queueEventEmail, notifyIfNeeded, turnOnDefaultEmail } from '@/lib/emailEvents';
import { sendChairInvite } from '@/lib/chairInvites';
import { useDraftNotices, DraftNoticeList } from '@/components/DraftNotice';
import { useConfirmModal } from '@/components/ConfirmModal';
import { NotRegisteredChip, MemberAvatar } from '@/app/manage/[slug]/assignment/delegationShared';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppPref {
  preference_order: number;
  country_code: string;
  country_name: string;
  conference_committee_id: string;
  conference_committees: { name: string } | null;
}

interface AcceptedApp {
  id: string;
  role: string;
  experience_level: string | null;
  is_head_delegate: boolean;
  society_id: string | null;
  payment_status: string | null;
  attending: boolean;
  invited_email: string | null;
  invited_name: string | null;
  profiles: {
    id: string;
    display_name: string;
    email: string;
    nationality: string | null;
    mun_experience_level: string | null;
    avatar_url: string | null;
  } | null;
  societies: { name: string } | null;
  application_preferences: AppPref[];
}

interface AllocationRow {
  id: string;
  user_id: string | null;
  country_code: string;
  country_name: string;
  allocation_sent: boolean;
  application_id: string | null;
  profiles: { display_name: string; avatar_url: string | null } | null;
  applications: { invited_name: string | null } | null;
}

// Importance tiers. Mapping: green = HIGH importance to the committee,
// yellow/amber = MEDIUM, red = LOW. 'standard' = unrated (neutral).
type ImportanceTier = 'standard' | 'high' | 'medium' | 'low';
const TIER_CYCLE: ImportanceTier[] = ['standard', 'high', 'medium', 'low'];
// Urgency order for the drop popup: high > medium > low > standard
const TIER_RANK: Record<ImportanceTier, number> = { high: 0, medium: 1, low: 2, standard: 3 };
const TIER_META: Record<ImportanceTier, { label: string; color: string; bg: string }> = {
  high:     { label: 'HIGH', color: '#3D7A52', bg: 'rgba(61,122,82,0.12)' },
  medium:   { label: 'MED',  color: '#B8844A', bg: 'rgba(184,132,74,0.14)' },
  low:      { label: 'LOW',  color: '#8B2020', bg: 'rgba(139,32,32,0.10)' },
  standard: { label: 'STD',  color: '#9A8A78', bg: 'rgba(154,138,120,0.12)' },
};

interface SlotRow {
  id: string;
  country_code: string;
  country_name: string;
  delegation_size: number;
  importance: ImportanceTier;
}

interface DisplayChair {
  name: string;
  avatar_url: string | null;
}

interface CommitteeData {
  id: string;
  name: string;
  abbreviation: string | null;
  difficulty: string;
  total_slots: number;
  logo_url: string | null;
  chair_user_ids: string[] | null;
  display_chairs: DisplayChair[] | null;
  committee_country_slots: SlotRow[];
  conference_allocations: AllocationRow[];
}

interface ChairApp {
  id: string;
  user_id: string;
  status: string;
  assigned_committee_id: string | null;
  experience_level: string | null;
  attending: boolean;
  profiles: { id: string; display_name: string; email: string; avatar_url: string | null } | null;
}

interface PendingChairInvite {
  id: string;
  committee_id: string;
  email: string;
  token: string;
  profiles: { display_name: string } | null;
}

// Per-user MUN history (from mun_cv_entries + conference_awards)
interface UserHistory {
  conferences: number;
  awards: number;
  awardLabels: string[];
}

// ── Scoring ───────────────────────────────────────────────────────────────────
// score(applicant, committee, slot) =
//   preference:  1st choice committee +50, 2nd +30, 3rd +15
//                +25 more if the slot is the exact country they asked for in that preference
//   experience:  15 - 6 * |experience level - committee difficulty|  (floor 0)
//   fullness:    12 * (1 - filled/total)  — nudges suggestions toward emptier committees

const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
function levelIdx(s: string | null | undefined): number {
  const i = LEVELS.indexOf((s ?? '').toLowerCase());
  return i === -1 ? 1 : i;
}

interface ScoreResult {
  score: number;
  reasons: string[];
}

function scorePrefAndExp(app: AcceptedApp, committee: CommitteeData, slot: SlotRow | null): ScoreResult {
  let score = 0;
  const reasons: string[] = [];
  const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order);
  const matchIdx = prefs.findIndex(p => p.conference_committee_id === committee.id);
  if (matchIdx === 0) { score += 50; reasons.push('1ST CHOICE'); }
  else if (matchIdx === 1) { score += 30; reasons.push('2ND CHOICE'); }
  else if (matchIdx === 2) { score += 15; reasons.push('3RD CHOICE'); }
  if (slot && matchIdx >= 0 && prefs[matchIdx].country_code === slot.country_code) {
    score += 25;
    reasons.push('COUNTRY PICK');
  }
  const gap = Math.abs(levelIdx(app.experience_level) - levelIdx(committee.difficulty));
  const expScore = Math.max(0, 15 - 6 * gap);
  score += expScore;
  if (gap === 0) reasons.push('EXP MATCH');
  return { score, reasons };
}

function scoreSlot(app: AcceptedApp, committee: CommitteeData, slot: SlotRow, filled: number, total: number): ScoreResult {
  const base = scorePrefAndExp(app, committee, slot);
  const fullness = Math.round(12 * (1 - filled / Math.max(total, 1)));
  base.score += fullness;
  if (total > 0 && filled / total < 0.34 && fullness > 0) base.reasons.push('NEEDS DELEGATES');
  return base;
}

function fitColor(score: number) {
  if (score >= 50) return '#3D7A52';
  if (score >= 20) return '#B6871F';
  return '#9A8A78';
}

interface Suggestion {
  app: AcceptedApp;
  committee: CommitteeData;
  slot: SlotRow;
  score: number;
  reasons: string[];
}

// ── Shared bits ───────────────────────────────────────────────────────────────

const OUTFIT = "'Outfit', sans-serif";
// Typography rule: no monospace on the conferences side — MONO now resolves to Outfit
// so every stamp/eyebrow/code that referenced it renders in Outfit (family swap only).
const MONO = "'Outfit', sans-serif";

// Single write path for every allocation on this page: insert into
// conference_allocations (incl. conference_id), friendly duplicate errors,
// then round-trip the application status to 'assigned'.
// Returns an error message, or null on success.
async function insertAllocation(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  committee: CommitteeData,
  app: AcceptedApp,
  slot: SlotRow,
): Promise<string | null> {
  const userId = app.profiles?.id;
  if (!userId) return 'Applicant profile not found.';

  const { error: insertErr } = await supabase.from('conference_allocations').insert({
    conference_id: conferenceId,
    conference_committee_id: committee.id,
    user_id: userId,
    country_code: slot.country_code,
    country_name: slot.country_name,
    application_id: app.id,
    allocation_sent: false,
  });
  if (insertErr) {
    if (insertErr.code === '23505') {
      return insertErr.message.includes('user_id')
        ? 'This delegate already has an allocation in this committee.'
        : insertErr.message.includes('country_code')
        ? 'This country is already allocated to another delegate.'
        : 'This allocation already exists.';
    }
    return insertErr.message;
  }

  await supabase.from('applications').update({
    status: 'assigned',
    assigned_committee_id: committee.id,
    assigned_country_code: slot.country_code,
    assigned_country_name: slot.country_name,
  }).eq('id', app.id);

  return null;
}

function TierBadge({ tier, onCycle }: { tier: ImportanceTier; onCycle?: () => void }) {
  const meta = TIER_META[tier];
  return (
    <button
      onClick={e => { e.stopPropagation(); onCycle?.(); }}
      title="Country importance to this committee. Click to cycle: standard, high, medium, low."
      className="focus:outline-none flex items-center gap-1.5"
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        border: `1px solid ${meta.color}40`,
        backgroundColor: meta.bg,
        cursor: onCycle ? 'pointer' : 'default',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: meta.color, display: 'inline-block' }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, fontFamily: MONO, letterSpacing: '0.06em' }}>
        {meta.label}
      </span>
    </button>
  );
}

function DelegationChip({ app }: { app: AcceptedApp }) {
  const indep = app.society_id == null;
  const label = indep ? 'Independent' : app.societies?.name ?? null;
  if (!label) return null;
  return (
    <span
      className="px-2 py-0.5 rounded-full truncate inline-block"
      style={{
        fontSize: 10,
        fontFamily: MONO,
        letterSpacing: '0.04em',
        maxWidth: 150,
        backgroundColor: indep ? 'rgba(154,138,120,0.14)' : 'rgba(27,56,40,0.08)',
        color: indep ? '#9A8A78' : '#1B3828',
        border: `1px solid ${indep ? 'rgba(154,138,120,0.3)' : 'rgba(27,56,40,0.18)'}`,
      }}
    >
      {label}
    </span>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

// ── Delegate detail panel ─────────────────────────────────────────────────────

function DelegateDetail({ app, history }: { app: AcceptedApp; history: UserHistory | undefined }) {
  const nationality = app.profiles?.nationality ?? null;
  const natCountry = nationality ? getCountryByName(nationality) : undefined;
  const exp = app.experience_level ?? app.profiles?.mun_experience_level ?? null;

  const stat = (label: string, value: React.ReactNode) => (
    <div className="flex-1 min-w-0 rounded-lg px-2.5 py-2" style={{ backgroundColor: 'rgba(27,56,40,0.04)', border: '1px solid rgba(221,212,192,0.8)' }}>
      <p style={{ fontSize: 10, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.12em', fontWeight: 600 }}>{label}</p>
      <p className="truncate" style={{ fontSize: 13, fontWeight: 700, color: '#1C1410', fontFamily: MONO, marginTop: 2 }}>{value}</p>
    </div>
  );

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px dashed #DDD4C0' }}>
      {/* Nationality row */}
      <div className="flex items-center gap-2 mb-2.5">
        {natCountry ? (
          <img src={getFlagUrl(natCountry.code)} style={{ width: 22, height: 15, borderRadius: 2, objectFit: 'cover', boxShadow: '0 1px 3px rgba(27,56,40,0.2)' }} alt={nationality ?? ''} />
        ) : (
          <Globe2 size={14} style={{ color: '#9A8A78' }} />
        )}
        <span style={{ fontSize: 12, color: '#1C1410', fontFamily: OUTFIT, fontWeight: 600 }}>
          {nationality ?? 'Nationality not set'}
        </span>
        <span className="truncate" style={{ fontSize: 11, color: '#9A8A78', fontFamily: OUTFIT, marginLeft: 'auto' }}>
          {app.profiles?.email}
        </span>
      </div>

      {/* Stats */}
      <div className="flex gap-2 mb-2.5">
        {stat('EXPERIENCE', exp ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{
                width: 18, height: 18, borderRadius: 9999,
                background: `linear-gradient(150deg, ${LEVEL_ACCENT[exp.toLowerCase()] ?? '#9A8A78'}22, ${LEVEL_ACCENT[exp.toLowerCase()] ?? '#9A8A78'}12)`,
                border: `1px solid ${LEVEL_ACCENT[exp.toLowerCase()] ?? '#9A8A78'}55`,
              }}
            >
              <LevelInsignia level={exp} size={12} />
            </span>
            {exp.toUpperCase()}
          </span>
        ) : 'N/A')}
        {stat('CONFERENCES', history?.conferences ?? 0)}
        {stat('AWARDS', history?.awards ?? 0)}
      </div>

      {/* Award labels */}
      {history && history.awardLabels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          <Award size={12} style={{ color: '#B6871F', flexShrink: 0 }} />
          {history.awardLabels.slice(0, 4).map((lbl, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full" style={{ fontSize: 10, backgroundColor: 'rgba(182,135,31,0.12)', color: '#B6871F', fontFamily: MONO, border: '1px solid rgba(182,135,31,0.25)' }}>
              {lbl}
            </span>
          ))}
          {history.awardLabels.length > 4 && (
            <span style={{ fontSize: 10, color: '#9A8A78', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>+{history.awardLabels.length - 4}</span>
          )}
        </div>
      )}

      {/* Full preference list */}
      {(app.application_preferences ?? []).length > 0 && (
        <div>
          <p style={{ fontSize: 10, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.12em', fontWeight: 600, marginBottom: 4 }}>PREFERENCES</p>
          {[...(app.application_preferences ?? [])]
            .sort((a, b) => a.preference_order - b.preference_order)
            .map(p => (
              <div key={p.preference_order} className="flex items-center gap-2 py-0.5">
                <span style={{ fontSize: 11, fontWeight: 700, color: '#9A8A78', fontFamily: MONO, width: 12, fontVariantNumeric: 'tabular-nums' }}>{p.preference_order}</span>
                <img src={getFlagUrl(p.country_code)} style={{ width: 18, height: 13, borderRadius: 2, objectFit: 'cover' }} alt={p.country_name} />
                <span className="truncate" style={{ fontSize: 12, color: '#1C1410', fontFamily: OUTFIT }}>
                  {p.conference_committees?.name ?? 'Unknown'} · {p.country_name}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ── DropAllocateModal ─────────────────────────────────────────────────────────
// Opens when an applicant is dropped on (or click-targeted at) a committee.
// Lists that committee's OPEN slots, most urgent first: importance tier order
// high > medium > low > standard, then suggestion score for this applicant.

interface DropAllocateModalProps {
  committee: CommitteeData;
  app: AcceptedApp;
  onClose: () => void;
  onAssigned: (slot: SlotRow, msg: string) => void;
}

function DropAllocateModal({ committee, app, onClose, onAssigned }: DropAllocateModalProps) {
  const { session } = useAuth();
  const { conference } = useManage();
  const [busySlotId, setBusySlotId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const allocatedCodes = new Set(committee.conference_allocations.map(a => a.country_code));
  const filled = committee.conference_allocations.length;
  const rows = committee.committee_country_slots
    .filter(s => !allocatedCodes.has(s.country_code))
    .map(slot => ({ slot, ...scoreSlot(app, committee, slot, filled, committee.total_slots) }))
    .sort((a, b) =>
      TIER_RANK[a.slot.importance] - TIER_RANK[b.slot.importance] || b.score - a.score
    );

  async function handleAllocate(slot: SlotRow) {
    if (!session) return;
    if (!conference) { setError('Conference not loaded. Please refresh.'); return; }
    setBusySlotId(slot.id);
    setError('');
    const supabase = getAuthedClient(session.access_token);
    const err = await insertAllocation(supabase, conference.id, committee, app, slot);
    setBusySlotId(null);
    if (err) { setError(err); return; }
    onAssigned(slot, `${app.profiles?.display_name ?? app.invited_name} allocated to ${slot.country_name} in ${committee.abbreviation ?? committee.name}.`);
    onClose();
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div
        className="rounded-2xl p-6"
        style={{
          width: 'min(92vw, 560px)',
          backgroundColor: 'rgba(250,248,243,0.94)',
          backdropFilter: 'blur(16px)',
          border: '1px solid #DDD4C0',
          maxHeight: '86vh',
          overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(27,56,40,0.25)',
        }}
      >
        <div className="flex items-start justify-between mb-1">
          <div className="min-w-0">
            <p style={{ fontSize: 9, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.14em', fontWeight: 500, marginBottom: 4 }}>
              ALLOCATE
            </p>
            <h2 className="font-black text-base flex items-center gap-2 flex-wrap" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              <MemberAvatar name={app.profiles?.display_name ?? app.invited_name ?? 'Unknown'} url={app.profiles?.avatar_url ?? null} size={28} />
              <span>{app.profiles?.display_name ?? app.invited_name}</span>
              <ArrowRight size={14} style={{ color: '#9A8A78' }} />
              <span>{committee.abbreviation ?? committee.name}</span>
            </h2>
          </div>
          <button onClick={onClose} className="focus:outline-none flex-shrink-0 mt-1" style={{ color: '#9A8A78' }}><X size={18} /></button>
        </div>
        <p className="text-xs mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          Open slots, most urgent first — importance tier, then fit for this delegate.
        </p>

        {error && (
          <p className="text-xs mb-3 rounded-lg px-3 py-2" style={{ color: '#8B2020', fontFamily: OUTFIT, backgroundColor: 'rgba(139,32,32,0.07)', border: '1px solid rgba(139,32,32,0.25)' }}>
            {error}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            All slots in this committee are filled.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {rows.map(({ slot, score, reasons }) => {
              const busy = busySlotId === slot.id;
              return (
                <div
                  key={slot.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
                >
                  <img src={getFlagUrl(slot.country_code)} style={{ width: 24, height: 17, borderRadius: 3, objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 3px rgba(27,56,40,0.18)' }} alt={slot.country_name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{slot.country_name}</p>
                      <TierBadge tier={slot.importance} />
                    </div>
                    {reasons.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {reasons.slice(0, 3).map(r => (
                          <span key={r} className="px-1.5 py-0.5 rounded-full" style={{ fontSize: 9, backgroundColor: 'rgba(61,122,82,0.10)', color: '#3D7A52', fontFamily: MONO, letterSpacing: '0.04em' }}>
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: fitColor(score), fontFamily: MONO, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
                  <button
                    onClick={() => handleAllocate(slot)}
                    disabled={busySlotId !== null}
                    className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none transition-colors flex-shrink-0"
                    style={{
                      backgroundColor: busySlotId !== null ? '#DDD4C0' : '#1B3828',
                      color: busySlotId !== null ? '#9A8A78' : '#EED98A',
                      border: 'none',
                      fontFamily: OUTFIT,
                      letterSpacing: '0.04em',
                    }}
                    onMouseEnter={e => { if (busySlotId === null) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                    onMouseLeave={e => { if (busySlotId === null) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                  >
                    {busy ? '...' : 'ALLOCATE'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

// ── AssignModal ───────────────────────────────────────────────────────────────
// Kept for the slot-first path: pick a specific open country, then choose the
// applicant (with fit scores). Reached from a panel's expanded slot list.

interface AssignModalProps {
  committee: CommitteeData;
  unassigned: AcceptedApp[];
  preSelectedSlot?: SlotRow;
  preSelectedApp?: AcceptedApp;
  onClose: () => void;
  onAssigned: (app: AcceptedApp, slot: SlotRow, sentEmail: boolean) => void;
}

function AssignModal({ committee, unassigned, preSelectedSlot, preSelectedApp, onClose, onAssigned }: AssignModalProps) {
  const { session } = useAuth();
  const { conference } = useManage();
  const [selectedApp, setSelectedApp] = useState<AcceptedApp | null>(preSelectedApp ?? null);
  const [selectedSlot, setSelectedSlot] = useState<SlotRow | null>(preSelectedSlot ?? null);
  const [sendEmail, setSendEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Empty slots = slots with no allocation
  const allocatedCodes = new Set(committee.conference_allocations.map(a => a.country_code));
  const emptySlots = committee.committee_country_slots.filter(s => !allocatedCodes.has(s.country_code));
  const filled = committee.conference_allocations.length;

  // Sort unassigned by score against the selected slot (or committee-level score)
  const scored = unassigned.map(app => ({
    app,
    score: selectedSlot
      ? scoreSlot(app, committee, selectedSlot, filled, committee.total_slots).score
      : scorePrefAndExp(app, committee, null).score,
  }));
  scored.sort((a, b) => b.score - a.score);

  async function handleAssign() {
    if (!selectedApp || !selectedSlot) { setError('Select an applicant and a country.'); return; }
    const userId = selectedApp.profiles?.id;
    if (!userId) { setError('Applicant profile not found.'); return; }
    setSaving(true);
    setError('');
    if (!session) return;
    if (!conference) { setError('Conference not loaded. Please refresh.'); setSaving(false); return; }
    const supabase = getAuthedClient(session.access_token);

    const insertErr = await insertAllocation(supabase, conference.id, committee, selectedApp, selectedSlot);
    if (insertErr) {
      setError(insertErr);
      setSaving(false);
      return;
    }

    if (sendEmail) {
      await supabase
        .from('conference_allocations')
        .update({ allocation_sent: true, allocation_sent_at: new Date().toISOString() })
        .eq('conference_committee_id', committee.id)
        .eq('user_id', userId);
    }

    setSaving(false);
    onAssigned(selectedApp, selectedSlot, sendEmail);
    onClose();
  }

  const appScore = selectedApp ? scorePrefAndExp(selectedApp, committee, selectedSlot).score : null;
  const appPrefs = selectedApp
    ? [...(selectedApp.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order)
    : [];

  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: 'rgba(250,248,243,0.94)', backdropFilter: 'blur(16px)', border: '1px solid #DDD4C0', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(27,56,40,0.25)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-black text-base" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            Assign Delegate
          </h2>
          <button onClick={onClose} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={18} /></button>
        </div>

        <p className="text-xs font-semibold mb-2" style={{ color: '#B6871F', fontFamily: MONO, letterSpacing: '0.1em', fontSize: 10 }}>
          COMMITTEE
        </p>
        <p className="text-sm font-semibold mb-4" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          {committee.name}
        </p>

        {/* Applicant picker (if not pre-selected) */}
        <div className="mb-4">
          <p className="text-xs font-semibold mb-2" style={{ color: '#B6871F', fontFamily: MONO, letterSpacing: '0.1em', fontSize: 10 }}>APPLICANT</p>
          {preSelectedApp ? (
            <div className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: 'rgba(27,56,40,0.05)', border: '1px solid rgba(27,56,40,0.15)' }}>
              <MemberAvatar name={preSelectedApp.profiles?.display_name ?? preSelectedApp.invited_name ?? 'Unknown'} url={preSelectedApp.profiles?.avatar_url ?? null} size={34} />
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{preSelectedApp.profiles?.display_name ?? preSelectedApp.invited_name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{preSelectedApp.role} · {preSelectedApp.experience_level ?? 'n/a'}</p>
              </div>
            </div>
          ) : (
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #DDD4C0', borderRadius: 12 }}>
              {scored.length === 0 ? (
                <p className="text-sm p-3" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No unassigned applicants.</p>
              ) : scored.map(({ app, score }, idx) => {
                const selected = selectedApp?.id === app.id;
                return (
                  <div
                    key={app.id}
                    className="flex items-center gap-3 px-3 py-2 transition-colors"
                    style={{
                      backgroundColor: selected ? 'rgba(27,56,40,0.08)' : 'transparent',
                      borderBottom: '1px solid #F0EDE6',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedApp(app)}
                    onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                    onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <MemberAvatar name={app.profiles?.display_name ?? app.invited_name ?? 'Unknown'} url={app.profiles?.avatar_url ?? null} size={30} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{app.profiles?.display_name ?? app.invited_name}</p>
                      <p className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{app.role} · {app.experience_level ?? 'n/a'}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {idx === 0 && score >= 20 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.04em' }}>BEST</span>
                      )}
                      <span style={{ fontSize: 11, fontWeight: 700, color: fitColor(score), fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Show selected applicant preferences */}
        {selectedApp && appPrefs.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold mb-1" style={{ color: '#B6871F', fontFamily: MONO, letterSpacing: '0.1em', fontSize: 10 }}>PREFERENCES</p>
            <div className="flex flex-col gap-1">
              {appPrefs.slice(0, 3).map(p => (
                <p key={p.preference_order} className="text-xs" style={{ color: p.conference_committee_id === committee.id ? '#1B3828' : '#9A8A78', fontFamily: OUTFIT }}>
                  {p.preference_order}. {p.conference_committees?.name ?? 'Unknown'} · {p.country_name}
                </p>
              ))}
            </div>
            {appScore !== null && (
              <p className="text-xs mt-1 font-bold" style={{ color: fitColor(appScore), fontFamily: MONO }}>
                FIT SCORE: {appScore}
              </p>
            )}
          </div>
        )}

        {/* Country picker */}
        <div className="mb-5">
          <p className="text-xs font-semibold mb-2" style={{ color: '#B6871F', fontFamily: MONO, letterSpacing: '0.1em', fontSize: 10 }}>COUNTRY</p>
          {preSelectedSlot ? (
            <div className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: 'rgba(27,56,40,0.05)', border: '1px solid rgba(27,56,40,0.15)' }}>
              <img src={getFlagUrl(preSelectedSlot.country_code)} style={{ width: 24, height: 17, borderRadius: 3, objectFit: 'cover' }} alt={preSelectedSlot.country_name} />
              <p className="text-sm font-semibold" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{preSelectedSlot.country_name}</p>
              <div style={{ marginLeft: 'auto' }}><TierBadge tier={preSelectedSlot.importance} /></div>
            </div>
          ) : (
            <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #DDD4C0', borderRadius: 12 }}>
              {emptySlots.length === 0 ? (
                <p className="text-sm p-3" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>All slots filled.</p>
              ) : emptySlots.map(slot => {
                const selected = selectedSlot?.id === slot.id;
                return (
                  <div
                    key={slot.id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors"
                    style={{ backgroundColor: selected ? 'rgba(27,56,40,0.08)' : 'transparent', borderBottom: '1px solid #F0EDE6' }}
                    onClick={() => setSelectedSlot(slot)}
                    onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                    onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <img src={getFlagUrl(slot.country_code)} style={{ width: 20, height: 14, borderRadius: 2, objectFit: 'cover' }} alt={slot.country_name} />
                    <p className="text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{slot.country_name}</p>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TierBadge tier={slot.importance} />
                      {selected && <Check size={13} style={{ color: '#3D7A52' }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Send email toggle */}
        <label className="flex items-center gap-3 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={e => setSendEmail(e.target.checked)}
            className="rounded"
            style={{ accentColor: '#1B3828', width: 16, height: 16 }}
          />
          <span className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            Send allocation email immediately after assigning
          </span>
        </label>

        {error && <p className="text-xs mb-3" style={{ color: '#8B2020', fontFamily: OUTFIT }}>{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT }}>
            CANCEL
          </button>
          <button
            onClick={handleAssign}
            disabled={saving || !selectedApp || !selectedSlot}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none"
            style={{
              backgroundColor: saving || !selectedApp || !selectedSlot ? '#DDD4C0' : '#1B3828',
              color: saving || !selectedApp || !selectedSlot ? '#9A8A78' : '#EED98A',
              fontFamily: OUTFIT,
            }}
          >
            {saving ? 'ASSIGNING...' : 'ASSIGN'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── CommitteeBoardPanel ───────────────────────────────────────────────────────
// One compact panel per committee — all committees visible at once. Acts as a
// drag-and-drop target for applicant cards and a click target when an
// applicant is selected.

interface CommitteeBoardPanelProps {
  committee: CommitteeData;
  dragging: boolean;
  isDropTarget: boolean;
  selectable: boolean;
  onDragOverPanel: () => void;
  onDragLeavePanel: () => void;
  onDropPanel: (appId: string) => void;
  onClickPanel: () => void;
  onRemoveAllocation: (a: AllocationRow) => void;
  onCycleTier: (slot: SlotRow) => void;
  onAssignSlot: (slot: SlotRow) => void;
}

function CommitteeBoardPanel({
  committee, dragging, isDropTarget, selectable,
  onDragOverPanel, onDragLeavePanel, onDropPanel, onClickPanel,
  onRemoveAllocation, onCycleTier, onAssignSlot,
}: CommitteeBoardPanelProps) {
  const [showSlots, setShowSlots] = useState(false);

  const filled = committee.conference_allocations.length;
  const total = committee.total_slots;
  const pct = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0;
  const allocatedCodes = new Set(committee.conference_allocations.map(a => a.country_code));
  const openSlots = committee.committee_country_slots.filter(s => !allocatedCodes.has(s.country_code));
  const openTierCounts: Record<ImportanceTier, number> = { high: 0, medium: 0, low: 0, standard: 0 };
  for (const s of openSlots) openTierCounts[s.importance] += 1;

  return (
    <div
      onDragOver={e => {
        if (!dragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOverPanel();
      }}
      onDragLeave={e => {
        if (dragging && !e.currentTarget.contains(e.relatedTarget as Node | null)) onDragLeavePanel();
      }}
      onDrop={e => {
        e.preventDefault();
        onDropPanel(e.dataTransfer.getData('text/plain'));
      }}
      onClick={() => { if (selectable) onClickPanel(); }}
      className="rounded-2xl p-4 flex flex-col transition-all"
      style={{
        backgroundColor: isDropTarget ? 'rgba(61,122,82,0.08)' : 'rgba(250,248,243,0.84)',
        backdropFilter: 'blur(10px)',
        border: isDropTarget
          ? '1.5px solid #1B3828'
          : dragging || selectable
          ? '1.5px dashed rgba(184,132,74,0.7)'
          : '1px solid #DDD4C0',
        boxShadow: isDropTarget ? '0 8px 28px rgba(27,56,40,0.18)' : '0 4px 18px rgba(27,56,40,0.06)',
        cursor: selectable ? 'pointer' : 'default',
      }}
    >
      {/* Header: emblem + name + fill count */}
      <div className="flex items-center gap-2.5">
        {committee.logo_url ? (
          <img src={committee.logo_url} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', border: '1px solid #DDD4C0', flexShrink: 0 }} />
        ) : (
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(27,56,40,0.08)', color: '#1B3828', fontFamily: MONO, fontSize: 11, fontWeight: 700 }}
          >
            {(committee.abbreviation ?? committee.name).slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1B3828', fontFamily: MONO, letterSpacing: '0.02em' }}>
            {committee.abbreviation ?? committee.name}
          </p>
          <p className="truncate" style={{ fontSize: 11, color: '#9A8A78', fontFamily: OUTFIT }}>{committee.name}</p>
        </div>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#1C1410', fontFamily: MONO, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {filled}<span style={{ color: '#9A8A78', fontWeight: 500 }}>/{total}</span>
        </p>
      </div>

      {/* Fill bar */}
      <div className="mt-2.5 rounded-full overflow-hidden" style={{ height: 4, backgroundColor: '#DDD4C0' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: pct >= 100 ? '#3D7A52' : '#1B3828', transition: 'width 0.3s' }} />
      </div>

      {/* Tier-colored open-slot summary */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
        {openSlots.length === 0 ? (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#3D7A52', fontFamily: MONO, letterSpacing: '0.06em' }}>FULLY ALLOCATED</span>
        ) : (
          (['high', 'medium', 'low', 'standard'] as ImportanceTier[]).map(t => {
            const n = openTierCounts[t];
            if (n === 0) return null;
            const meta = TIER_META[t];
            return (
              <span
                key={t}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: meta.bg, border: `1px solid ${meta.color}30` }}
              >
                <span style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: meta.color, display: 'inline-block' }} />
                <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 700, color: meta.color, letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>
                  {n} {meta.label} OPEN
                </span>
              </span>
            );
          })
        )}
      </div>

      {/* Allocated delegates */}
      {committee.conference_allocations.length > 0 && (
        <div className="mt-3">
          <p style={{ fontSize: 10, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.12em', fontWeight: 600, marginBottom: 4 }}>ALLOCATED</p>
          <div style={{ maxHeight: 136, overflowY: 'auto' }} className="flex flex-col gap-1 pr-0.5">
            {committee.conference_allocations.map(a => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ backgroundColor: 'rgba(27,56,40,0.04)' }}>
                <img src={getFlagUrl(a.country_code)} style={{ width: 20, height: 14, borderRadius: 2, objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 2px rgba(27,56,40,0.15)' }} alt={a.country_name} />
                <span className="truncate" style={{ fontSize: 12, color: '#1C1410', fontFamily: OUTFIT, fontWeight: 600 }}>
                  {a.country_name}
                </span>
                <div className="flex items-center gap-1.5 min-w-0" style={{ marginLeft: 'auto' }}>
                  <MemberAvatar name={a.profiles?.display_name ?? a.applications?.invited_name ?? 'Assigned'} url={a.profiles?.avatar_url ?? null} size={22} />
                  <span className="truncate" style={{ fontSize: 11, color: '#6B5D4A', fontFamily: OUTFIT }}>
                    {a.profiles?.display_name ?? a.applications?.invited_name ?? 'Assigned'}
                  </span>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); onRemoveAllocation(a); }}
                  title="Remove allocation"
                  className="focus:outline-none flex-shrink-0"
                  style={{ color: '#9A8A78', lineHeight: 0 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open slots toggle */}
      {openSlots.length > 0 && (
        <button
          onClick={e => { e.stopPropagation(); setShowSlots(v => !v); }}
          className="mt-3 flex items-center gap-1 focus:outline-none self-start"
          style={{ fontSize: 10, fontWeight: 700, color: '#9A8A78', fontFamily: MONO, letterSpacing: '0.08em', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontVariantNumeric: 'tabular-nums' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
        >
          {showSlots ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          OPEN SLOTS ({openSlots.length})
        </button>
      )}
      {showSlots && openSlots.length > 0 && (
        <div className="mt-2 flex flex-col gap-1" style={{ maxHeight: 190, overflowY: 'auto' }}>
          {[...openSlots]
            .sort((a, b) => TIER_RANK[a.importance] - TIER_RANK[b.importance] || a.country_name.localeCompare(b.country_name))
            .map(slot => (
              <div key={slot.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ border: '1px solid #F0EDE6' }}>
                <img src={getFlagUrl(slot.country_code)} style={{ width: 18, height: 13, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }} alt={slot.country_name} />
                <span className="truncate flex-1" style={{ fontSize: 12, color: '#1C1410', fontFamily: OUTFIT }}>{slot.country_name}</span>
                <TierBadge tier={slot.importance} onCycle={() => onCycleTier(slot)} />
                <button
                  onClick={e => { e.stopPropagation(); onAssignSlot(slot); }}
                  className="rounded-md py-0.5 px-2 focus:outline-none transition-colors flex-shrink-0"
                  style={{ fontSize: 10, fontWeight: 700, backgroundColor: 'rgba(27,56,40,0.07)', color: '#1B3828', border: 'none', fontFamily: OUTFIT, letterSpacing: '0.04em', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.14)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.07)'; }}
                >
                  ASSIGN
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ── InviteChairModal ──────────────────────────────────────────────────────────

function InviteChairModal({ conferenceId, committee, onClose, onInvited }: {
  conferenceId: string;
  committee: CommitteeData;
  onClose: () => void;
  onInvited: (name: string) => void;
}) {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');

  async function handleInvite() {
    const em = email.trim();
    if (!em || !session) return;
    setInviting(true);
    setError('');
    const supabase = getAuthedClient(session.access_token);
    const result = await sendChairInvite(supabase, {
      conferenceId,
      committeeId: committee.id,
      committeeName: committee.name,
      email: em,
    });
    setInviting(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not invite that chair.');
      return;
    }
    onInvited(result.invitedName ?? em);
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 400, maxWidth: 'calc(100vw - 32px)' }}>
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p style={{ margin: 0, fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: '#B6871F' }}>
              INVITE CHAIR
            </p>
            <p className="font-bold text-[15px] mt-0.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              {committee.name}
            </p>
          </div>
          <button onClick={onClose} className="focus:outline-none flex-shrink-0" style={{ color: '#9A8A78' }}><X size={18} /></button>
        </div>

        <p className="text-xs mb-3" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.45 }}>
          They must already have a Gavelling account. They&apos;ll get an email to accept before joining this dais.
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleInvite(); } }}
            placeholder="chair@example.com"
            autoFocus
            style={{
              flex: 1, border: '1px solid #DDD4C0', borderRadius: 8, padding: '8px 12px',
              fontSize: 13, color: '#1C1410', backgroundColor: '#FFFFFF', outline: 'none',
              fontFamily: OUTFIT,
            }}
          />
          <button
            onClick={handleInvite}
            disabled={inviting || !email.trim()}
            className="rounded-lg px-4 font-bold text-[11px] focus:outline-none"
            style={{
              backgroundColor: inviting || !email.trim() ? '#DDD4C0' : '#1B3828',
              color: inviting || !email.trim() ? '#9A8A78' : '#EED98A',
              fontFamily: OUTFIT, letterSpacing: '0.08em', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {inviting ? 'INVITING…' : 'INVITE'}
          </button>
        </div>
        {error && <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: OUTFIT }}>{error}</p>}
      </div>
    </ModalOverlay>
  );
}

// ── ChairBoardPanel ───────────────────────────────────────────────────────────
// Chairs' mirror of CommitteeBoardPanel: same drag/drop + click-to-select
// target semantics, but the payload is a dais (no country slots) plus the
// committee's pending invites.

interface ChairBoardPanelProps {
  committee: CommitteeData;
  invites: PendingChairInvite[];
  dragging: boolean;
  isDropTarget: boolean;
  selectable: boolean;
  onDragOverPanel: () => void;
  onDragLeavePanel: () => void;
  onDropPanel: (chairAppId: string) => void;
  onClickPanel: () => void;
  onRemoveChair: (userId: string, name: string) => void;
  onRevokeInvite: (invite: PendingChairInvite) => void;
  onInvite: () => void;
}

function ChairBoardPanel({
  committee, invites, dragging, isDropTarget, selectable,
  onDragOverPanel, onDragLeavePanel, onDropPanel, onClickPanel,
  onRemoveChair, onRevokeInvite, onInvite,
}: ChairBoardPanelProps) {
  const dais = committee.display_chairs ?? [];
  const chairIds = committee.chair_user_ids ?? [];
  const idAligned = chairIds.length === dais.length;

  return (
    <div
      onDragOver={e => {
        if (!dragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOverPanel();
      }}
      onDragLeave={e => {
        if (dragging && !e.currentTarget.contains(e.relatedTarget as Node | null)) onDragLeavePanel();
      }}
      onDrop={e => {
        e.preventDefault();
        onDropPanel(e.dataTransfer.getData('text/plain'));
      }}
      onClick={() => { if (selectable) onClickPanel(); }}
      className="rounded-2xl p-4 flex flex-col transition-all"
      style={{
        backgroundColor: isDropTarget ? 'rgba(61,122,82,0.08)' : 'rgba(250,248,243,0.84)',
        backdropFilter: 'blur(10px)',
        border: isDropTarget
          ? '1.5px solid #1B3828'
          : dragging || selectable
          ? '1.5px dashed rgba(184,132,74,0.7)'
          : '1px solid #DDD4C0',
        boxShadow: isDropTarget ? '0 8px 28px rgba(27,56,40,0.18)' : '0 4px 18px rgba(27,56,40,0.06)',
        cursor: selectable ? 'pointer' : 'default',
      }}
    >
      {/* Header: emblem + name */}
      <div className="flex items-center gap-2.5">
        {committee.logo_url ? (
          <img src={committee.logo_url} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', border: '1px solid #DDD4C0', flexShrink: 0 }} />
        ) : (
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(27,56,40,0.08)', color: '#1B3828', fontFamily: MONO, fontSize: 11, fontWeight: 700 }}
          >
            {(committee.abbreviation ?? committee.name).slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1B3828', fontFamily: MONO, letterSpacing: '0.02em' }}>
            {committee.abbreviation ?? committee.name}
          </p>
          <p className="truncate" style={{ fontSize: 11, color: '#9A8A78', fontFamily: OUTFIT }}>{committee.name}</p>
        </div>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#1C1410', fontFamily: MONO, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {chairIds.length}<span style={{ color: '#9A8A78', fontWeight: 500 }}> chair{chairIds.length === 1 ? '' : 's'}</span>
        </p>
      </div>

      {/* Dais */}
      <div className="mt-3">
        <p style={{ fontSize: 10, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.12em', fontWeight: 600, marginBottom: 4 }}>DAIS</p>
        {dais.length === 0 ? (
          <p style={{ fontSize: 11, color: '#9A8A78', fontFamily: OUTFIT }}>No chairs assigned yet.</p>
        ) : (
          <div className="flex flex-col gap-1 pr-0.5">
            {dais.map((ch, i) => {
              const userId = idAligned ? chairIds[i] : undefined;
              return (
                <div key={`${ch.name}-${i}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ backgroundColor: 'rgba(27,56,40,0.04)' }}>
                  <MemberAvatar name={ch.name} url={ch.avatar_url} size={24} />
                  <span className="truncate flex-1" style={{ fontSize: 12, color: '#1C1410', fontFamily: OUTFIT, fontWeight: 600 }}>
                    {ch.name}
                  </span>
                  {userId && (
                    <button
                      onClick={e => { e.stopPropagation(); onRemoveChair(userId, ch.name); }}
                      title={`Remove ${ch.name} from the dais`}
                      className="focus:outline-none flex-shrink-0"
                      style={{ color: '#9A8A78', lineHeight: 0 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="mt-3">
          <p style={{ fontSize: 10, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.12em', fontWeight: 600, marginBottom: 4 }}>PENDING</p>
          <div className="flex flex-col gap-1">
            {invites.map(inv => (
              <div key={inv.id} className="flex items-center gap-2 rounded-lg px-2 py-1" style={{ backgroundColor: 'rgba(238,217,138,0.16)', border: '1px solid rgba(182,135,31,0.3)' }}>
                <span
                  className="px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', fontFamily: MONO, backgroundColor: 'rgba(182,135,31,0.18)', color: '#8A6614' }}
                >
                  INVITED
                </span>
                <span className="truncate flex-1" style={{ fontSize: 12, color: '#1C1410', fontFamily: OUTFIT }}>
                  {inv.profiles?.display_name ?? inv.email}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); onRevokeInvite(inv); }}
                  title="Revoke invite"
                  className="focus:outline-none flex-shrink-0"
                  style={{ color: '#9A8A78', lineHeight: 0 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite */}
      <button
        onClick={e => { e.stopPropagation(); onInvite(); }}
        className="mt-3 rounded-lg py-1.5 text-xs font-bold focus:outline-none transition-colors flex items-center justify-center gap-1.5"
        style={{ border: '1.5px dashed rgba(27,56,40,0.35)', color: '#1B3828', backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: 'pointer' }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#1B3828'; el.style.color = '#EED98A'; el.style.borderStyle = 'solid'; }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'transparent'; el.style.color = '#1B3828'; el.style.borderStyle = 'dashed'; }}
      >
        <Plus size={12} strokeWidth={2.4} /> INVITE
      </button>
    </div>
  );
}

// ── AssignmentPage ────────────────────────────────────────────────────────────

export default function AssignmentPage() {
  const { conference } = useManage();
  const { session, loading: authLoading } = useAuth();
  const [accepted, setAccepted] = useState<AcceptedApp[]>([]);
  const [committees, setCommittees] = useState<CommitteeData[]>([]);
  const [chairApps, setChairApps] = useState<ChairApp[]>([]);
  const [chairInvites, setChairInvites] = useState<PendingChairInvite[]>([]);
  const [history, setHistory] = useState<Record<string, UserHistory>>({});
  const [mode, setMode] = useState<'delegates' | 'chairs' | 'delegations' | 'independents'>('delegates');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  // Delegates board interactions
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [dragAppId, setDragAppId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropModal, setDropModal] = useState<{ committeeId: string; appId: string } | null>(null);
  const [assignModal, setAssignModal] = useState<{ committeeId: string; preSlot?: SlotRow } | null>(null);
  // Chairs board interactions
  const [selectedChairAppId, setSelectedChairAppId] = useState<string | null>(null);
  const [dragChairAppId, setDragChairAppId] = useState<string | null>(null);
  const [chairDropTargetId, setChairDropTargetId] = useState<string | null>(null);
  const [inviteModalCommitteeId, setInviteModalCommitteeId] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingAllocationEmails, setSendingAllocationEmails] = useState(false);
  const [quickAssigning, setQuickAssigning] = useState<string | null>(null); // suggestion key in flight
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const { draftNotices, pushDraftNotice, dismissDraftNotice } = useDraftNotices();
  const { confirm, modal: confirmModal } = useConfirmModal();

  function showFlash(kind: 'ok' | 'err', msg: string) {
    setFlash({ kind, msg });
    setTimeout(() => setFlash(f => (f?.msg === msg ? null : f)), 4500);
  }

  // Monotonic sequence for loads — a slow older response never overwrites a
  // newer one (silent background refetches can race with each other and with
  // full loads).
  const loadSeq = useRef(0);

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!conference) return;
    if (!session) return;
    const seq = ++loadSeq.current;
    // silent: background refresh — never flips the page-level loading flag,
    // so the board stays mounted and interactive while fresh data arrives.
    if (!opts?.silent) setLoading(true);
    const supabase = getAuthedClient(session.access_token);

    const [appRes, commRes, chairRes, inviteRes] = await Promise.all([
      supabase
        .from('applications')
        .select(`
          id, role, experience_level, is_head_delegate, society_id, payment_status,
          attending, invited_email, invited_name,
          profiles (id, display_name, email, nationality, mun_experience_level, avatar_url),
          societies (name),
          application_preferences (
            preference_order, country_code, country_name, conference_committee_id,
            conference_committees (name)
          )
        `)
        .eq('conference_id', conference.id)
        .eq('status', 'accepted')
        .in('role', ['delegate', 'head-delegate']),
      supabase
        .from('conference_committees')
        .select(`
          id, name, abbreviation, difficulty, total_slots, logo_url, chair_user_ids, display_chairs,
          committee_country_slots (id, country_code, country_name, delegation_size, importance),
          conference_allocations (id, user_id, country_code, country_name, allocation_sent, application_id, profiles (display_name, avatar_url), applications:application_id (invited_name))
        `)
        .eq('conference_id', conference.id)
        .order('name', { ascending: true }),
      supabase
        .from('applications')
        .select(`
          id, user_id, status, assigned_committee_id, experience_level, attending,
          profiles (id, display_name, email, avatar_url)
        `)
        .eq('conference_id', conference.id)
        .eq('role', 'chair')
        .in('status', ['accepted', 'assigned']),
      supabase
        .from('conference_chair_invites')
        .select('id, committee_id, email, token, profiles (display_name)')
        .eq('conference_id', conference.id)
        .eq('status', 'pending'),
    ]);

    if (seq !== loadSeq.current) return; // stale response — a newer load superseded this one

    const apps = ((appRes.data ?? []) as unknown as AcceptedApp[]).filter(a => a.attending !== false);
    const comms = (commRes.data ?? []) as unknown as CommitteeData[];

    setAccepted(apps);
    setCommittees(comms);
    setChairApps((chairRes.data ?? []) as unknown as ChairApp[]);
    setChairInvites((inviteRes.data ?? []) as unknown as PendingChairInvite[]);
    setLoading(false);

    // Enrich with MUN history (CV entries + platform awards) — non-blocking
    const userIds = Array.from(new Set(apps.map(a => a.profiles?.id).filter(Boolean))) as string[];
    if (userIds.length > 0) {
      const [cvRes, awRes] = await Promise.all([
        supabase.from('mun_cv_entries').select('user_id, award').in('user_id', userIds),
        supabase.from('conference_awards').select('user_id, award_label').in('user_id', userIds),
      ]);
      if (seq !== loadSeq.current) return; // stale response
      const map: Record<string, UserHistory> = {};
      const ensure = (uid: string) => (map[uid] ??= { conferences: 0, awards: 0, awardLabels: [] });
      for (const row of (cvRes.data ?? []) as { user_id: string; award: string }[]) {
        const h = ensure(row.user_id);
        h.conferences += 1;
        if (row.award && row.award !== 'None') {
          h.awards += 1;
          h.awardLabels.push(row.award);
        }
      }
      for (const row of (awRes.data ?? []) as { user_id: string; award_label: string }[]) {
        const h = ensure(row.user_id);
        h.awards += 1;
        if (row.award_label) h.awardLabels.push(row.award_label);
      }
      setHistory(map);
    } else {
      setHistory({});
    }
  }, [conference, session?.access_token]);

  useEffect(() => {
    if (authLoading) return;
    loadData();
  }, [authLoading, loadData]);

  // F1: the delegates/chairs board lives inline in this component (unlike
  // DelegationsView/IndependentsView, which remount and refetch on every
  // switch into them) — so without this it keeps rendering data loaded at
  // page mount even after mutations made in the other two modes. Refetch
  // whenever a switch lands on delegates or chairs; the effect above already
  // covers the very first render.
  const modeMounted = useRef(false);
  useEffect(() => {
    if (!modeMounted.current) { modeMounted.current = true; return; }
    if (authLoading) return;
    // silent: keep showing the (possibly stale) board while fresh data loads
    // instead of wiping the whole page behind a spinner on every tab switch.
    if (mode === 'delegates' || mode === 'chairs') loadData({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ── Importance tier cycling (optimistic + fire-and-forget DB write) ────────
  function handleCycleTier(slot: SlotRow) {
    if (!session) return;
    const next = TIER_CYCLE[(TIER_CYCLE.indexOf(slot.importance) + 1) % TIER_CYCLE.length];
    setCommittees(prev => prev.map(c => ({
      ...c,
      committee_country_slots: c.committee_country_slots.map(s => s.id === slot.id ? { ...s, importance: next } : s),
    })));
    const supabase = getAuthedClient(session.access_token);
    supabase.from('committee_country_slots').update({ importance: next }).eq('id', slot.id).then(({ error }) => {
      if (error) {
        // Roll back on failure
        setCommittees(prev => prev.map(c => ({
          ...c,
          committee_country_slots: c.committee_country_slots.map(s => s.id === slot.id ? { ...s, importance: slot.importance } : s),
        })));
        showFlash('err', 'Could not save importance tier.');
      }
    });
  }

  // ── Optimistic allocation commit ────────────────────────────────────────────
  // Applies exactly the change the user made — the allocation appears in the
  // committee panel and the applicant leaves the unassigned rail — with a temp
  // row id. The real UUID arrives via a silent background refetch.
  function applyLocalAllocation(committee: CommitteeData, app: AcceptedApp, slot: SlotRow, sent = false): AllocationRow {
    const row: AllocationRow = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      user_id: app.profiles?.id ?? '',
      country_code: slot.country_code,
      country_name: slot.country_name,
      allocation_sent: sent,
      application_id: app.id,
      profiles: app.profiles ? { display_name: app.profiles.display_name, avatar_url: app.profiles.avatar_url } : null,
      applications: { invited_name: app.invited_name ?? null },
    };
    setCommittees(prev => prev.map(c =>
      c.id === committee.id ? { ...c, conference_allocations: [...c.conference_allocations, row] } : c
    ));
    setAccepted(prev => prev.filter(a => a.id !== app.id));
    return row;
  }

  // Restores exactly what applyLocalAllocation changed: drops the temp row and
  // puts the applicant back in the unassigned rail.
  function rollbackLocalAllocation(committeeId: string, app: AcceptedApp, tempRowId: string) {
    setCommittees(prev => prev.map(c =>
      c.id === committeeId ? { ...c, conference_allocations: c.conference_allocations.filter(a => a.id !== tempRowId) } : c
    ));
    setAccepted(prev => (prev.some(a => a.id === app.id) ? prev : [...prev, app]));
  }

  // ── One-click assign (used by suggestion cards) ─────────────────────────────
  // Optimistic: the suggestion card disappears and the allocation shows in the
  // committee panel immediately; the insert persists in the background.
  const inFlightAssignKeys = useRef(new Set<string>());
  function quickAssign(sug: Suggestion) {
    if (!session || !conference) return;
    const key = `${sug.app.id}-${sug.slot.id}`;
    if (inFlightAssignKeys.current.has(key)) return;
    inFlightAssignKeys.current.add(key);
    setQuickAssigning(key);
    const supabase = getAuthedClient(session.access_token);
    const conferenceId = conference.id;

    const tempRow = applyLocalAllocation(sug.committee, sug.app, sug.slot);
    showFlash('ok', `${sug.app.profiles?.display_name ?? sug.app.invited_name} assigned to ${sug.slot.country_name} in ${sug.committee.abbreviation ?? sug.committee.name}.`);

    (async () => {
      const err = await insertAllocation(supabase, conferenceId, sug.committee, sug.app, sug.slot);
      if (err) {
        rollbackLocalAllocation(sug.committee.id, sug.app, tempRow.id);
        showFlash('err', err);
        return;
      }
      loadData({ silent: true }); // swap the temp row for the real UUID
    })().catch(() => {
      rollbackLocalAllocation(sug.committee.id, sug.app, tempRow.id);
      showFlash('err', 'Could not save this assignment.');
    }).finally(() => {
      inFlightAssignKeys.current.delete(key);
      setQuickAssigning(prev => (prev === key ? null : prev));
    });
  }

  function handleSendAllAllocations() {
    if (!committees.length || sendingAll) return;
    if (!session) return;
    setSendingAll(true);
    const supabase = getAuthedClient(session.access_token);
    const committeeIds = committees.map(c => c.id);
    // Optimistic: flip every unsent allocation locally; remember which ones so
    // a failed write restores exactly those rows.
    const flippedIds = new Set(
      committees.flatMap(c => c.conference_allocations.filter(a => !a.allocation_sent).map(a => a.id))
    );
    setCommittees(prev => prev.map(c => ({
      ...c,
      conference_allocations: c.conference_allocations.map(a => (a.allocation_sent ? a : { ...a, allocation_sent: true })),
    })));

    (async () => {
      const { error } = await supabase
        .from('conference_allocations')
        .update({ allocation_sent: true, allocation_sent_at: new Date().toISOString() })
        .in('conference_committee_id', committeeIds)
        .eq('allocation_sent', false);
      if (error) {
        setCommittees(prev => prev.map(c => ({
          ...c,
          conference_allocations: c.conference_allocations.map(a => (flippedIds.has(a.id) ? { ...a, allocation_sent: false } : a)),
        })));
        showFlash('err', 'Could not send allocations.');
      }
    })().catch(() => {
      setCommittees(prev => prev.map(c => ({
        ...c,
        conference_allocations: c.conference_allocations.map(a => (flippedIds.has(a.id) ? { ...a, allocation_sent: false } : a)),
      })));
      showFlash('err', 'Could not send allocations.');
    }).finally(() => setSendingAll(false));
  }

  const inFlightRemoveIds = useRef(new Set<string>());
  // Double-click guards for chair-dais mutations (assign/remove share a
  // committee-id key; revoke uses the invite's own id).
  const inFlightChairIds = useRef(new Set<string>());
  const inFlightInviteIds = useRef(new Set<string>());
  function handleRemoveAllocation(allocation: AllocationRow) {
    if (!session || !conference) return;
    if (allocation.id.startsWith('temp-')) {
      showFlash('err', 'This allocation is still saving — try again in a moment.');
      return;
    }
    if (inFlightRemoveIds.current.has(allocation.id)) return;
    inFlightRemoveIds.current.add(allocation.id);
    const supabase = getAuthedClient(session.access_token);
    const conferenceId = conference.id;
    const committeeId = committees.find(c => c.conference_allocations.some(a => a.id === allocation.id))?.id ?? null;

    // Optimistic: the row leaves the committee panel immediately.
    setCommittees(prev => prev.map(c => ({
      ...c,
      conference_allocations: c.conference_allocations.filter(a => a.id !== allocation.id),
    })));

    const rollback = () => {
      if (!committeeId) return;
      setCommittees(prev => prev.map(c =>
        c.id === committeeId ? { ...c, conference_allocations: [...c.conference_allocations, allocation] } : c
      ));
    };

    (async () => {
      // Same ordering as before: delete first (awaited), then the application
      // status reset, then the email queue.
      const { error: delErr } = await supabase.from('conference_allocations').delete().eq('id', allocation.id);
      if (delErr) {
        rollback();
        showFlash('err', 'Could not remove this allocation.');
        return;
      }
      if (allocation.application_id) {
        await supabase.from('applications').update({
          status: 'accepted',
          assigned_committee_id: null,
          assigned_country_code: null,
          assigned_country_name: null,
        }).eq('id', allocation.application_id);

        try {
          const result = await queueEventEmail(supabase, conferenceId, 'allocation_removed', [allocation.application_id]);
          notifyIfNeeded(result, pushDraftNotice);
        } catch {
          // Email queueing is secondary — the removal stands.
          showFlash('err', 'Allocation removed, but the notification email could not be queued.');
        }
      }
      loadData({ silent: true }); // brings the delegate back into the unassigned rail
    })().catch(() => {
      rollback();
      showFlash('err', 'Could not remove this allocation.');
    }).finally(() => inFlightRemoveIds.current.delete(allocation.id));
  }

  // Batch-queue allocation_assigned (delivery: manual) for every currently
  // assigned application, derived from the committees already loaded here —
  // conference_allocations rows are only ever created for delegate/head-delegate
  // committee assignments, so this never includes chairs.
  async function handleSendAllocationEmails() {
    if (!session || !conference) return;
    const applicationIds = Array.from(new Set(
      committees.flatMap(c => c.conference_allocations.map(a => a.application_id)).filter((id): id is string => !!id)
    ));
    if (applicationIds.length === 0) {
      showFlash('err', 'No assigned delegates to email.');
      return;
    }
    const { confirmed } = await confirm({
      title: 'Queue allocation emails?',
      body: `Queue allocation emails for ${applicationIds.length} assigned delegate${applicationIds.length === 1 ? '' : 's'}?`,
      confirmLabel: 'Queue Emails',
    });
    if (!confirmed) return;

    setSendingAllocationEmails(true);
    const supabase = getAuthedClient(session.access_token);
    const result = await queueEventEmail(supabase, conference.id, 'allocation_assigned', applicationIds);
    setSendingAllocationEmails(false);
    notifyIfNeeded(result, pushDraftNotice);
    if (result.outcome === 'sent-custom' || result.outcome === 'sent-default') {
      showFlash('ok', `Queued ${result.queued ?? 0} allocation email${(result.queued ?? 0) === 1 ? '' : 's'}.`);
    }
  }

  async function handleAssignChair(chairApp: ChairApp, committee: CommitteeData) {
    const name = chairApp.profiles?.display_name ?? 'this applicant';
    const label = committee.abbreviation ?? committee.name;
    const { confirmed } = await confirm({
      title: 'Assign as chair?',
      body: `Assign ${name} as chair of ${label}?`,
      confirmLabel: 'Assign',
    });
    if (!confirmed) return;
    if (!session || inFlightChairIds.current.has(committee.id)) return;
    inFlightChairIds.current.add(committee.id);
    const supabase = getAuthedClient(session.access_token);
    const nextIds = Array.from(new Set([...(committee.chair_user_ids ?? []), chairApp.user_id]));

    // Optimistic: the chair appears on the dais (and leaves the unassigned
    // rail, which derives from chair_user_ids) immediately. avatar_url comes
    // in with the silent refetch.
    const prevIds = committee.chair_user_ids;
    const prevDisplay = committee.display_chairs;
    const prevStatus = chairApp.status;
    const prevAssignedCommitteeId = chairApp.assigned_committee_id;
    const alreadyOnDais = (committee.chair_user_ids ?? []).includes(chairApp.user_id);
    setCommittees(prev => prev.map(c =>
      c.id === committee.id
        ? {
            ...c,
            chair_user_ids: nextIds,
            display_chairs: alreadyOnDais
              ? c.display_chairs
              : [...(c.display_chairs ?? []), { name: chairApp.profiles?.display_name ?? 'Chair', avatar_url: null }],
          }
        : c
    ));
    if (chairApp.status === 'accepted') {
      setChairApps(prev => prev.map(ca =>
        ca.id === chairApp.id ? { ...ca, status: 'assigned', assigned_committee_id: committee.id } : ca
      ));
    }
    setSelectedChairAppId(null);
    showFlash('ok', `${name} assigned as chair of ${label}.`);

    const rollback = () => {
      setCommittees(prev => prev.map(c =>
        c.id === committee.id ? { ...c, chair_user_ids: prevIds, display_chairs: prevDisplay } : c
      ));
      setChairApps(prev => prev.map(ca =>
        ca.id === chairApp.id ? { ...ca, status: prevStatus, assigned_committee_id: prevAssignedCommitteeId } : ca
      ));
    };

    (async () => {
      const { error } = await supabase.from('conference_committees').update({ chair_user_ids: nextIds }).eq('id', committee.id);
      if (error) {
        rollback();
        showFlash('err', `Could not assign ${name} to ${label}.`);
        return;
      }
      if (chairApp.status === 'accepted') {
        await supabase.from('applications').update({ status: 'assigned', assigned_committee_id: committee.id }).eq('id', chairApp.id);
      }
      loadData({ silent: true });
    })().catch(() => {
      rollback();
      showFlash('err', `Could not assign ${name} to ${label}.`);
    }).finally(() => inFlightChairIds.current.delete(committee.id));
  }

  // Reverts the removed chair's application to 'accepted' only if they don't
  // chair any other committee — a chair on two daises stays 'assigned' after
  // losing one of them.
  async function handleRemoveChair(userId: string, committee: CommitteeData, name: string) {
    const label = committee.abbreviation ?? committee.name;
    const { confirmed } = await confirm({
      title: 'Remove chair?',
      body: `Remove ${name} from the ${label} dais?`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!confirmed) return;
    if (!session || !conference || inFlightChairIds.current.has(committee.id)) return;
    inFlightChairIds.current.add(committee.id);
    const supabase = getAuthedClient(session.access_token);
    const conferenceId = conference.id;
    const nextIds = (committee.chair_user_ids ?? []).filter(id => id !== userId);
    const chairsElsewhere = committees.some(c => c.id !== committee.id && (c.chair_user_ids ?? []).includes(userId));

    // Optimistic: drop the chair from the dais (display_chairs stays aligned
    // with chair_user_ids by removing the matching index) and, if they chair
    // nowhere else, put their application back in the unassigned rail.
    const prevIds = committee.chair_user_ids;
    const prevDisplay = committee.display_chairs;
    const prevChairApps = chairApps;
    setCommittees(prev => prev.map(c => {
      if (c.id !== committee.id) return c;
      const ids = c.chair_user_ids ?? [];
      const dais = c.display_chairs ?? [];
      const idx = ids.indexOf(userId);
      const nextDisplay = ids.length === dais.length && idx >= 0 ? dais.filter((_, i) => i !== idx) : c.display_chairs;
      return { ...c, chair_user_ids: ids.filter(id => id !== userId), display_chairs: nextDisplay };
    }));
    if (!chairsElsewhere) {
      setChairApps(prev => prev.map(ca =>
        ca.user_id === userId ? { ...ca, status: 'accepted', assigned_committee_id: null } : ca
      ));
    }
    showFlash('ok', `${name} removed from ${label}.`);

    const rollback = () => {
      setCommittees(prev => prev.map(c =>
        c.id === committee.id ? { ...c, chair_user_ids: prevIds, display_chairs: prevDisplay } : c
      ));
      setChairApps(prevChairApps);
    };

    (async () => {
      const { error } = await supabase.from('conference_committees').update({ chair_user_ids: nextIds }).eq('id', committee.id);
      if (error) {
        rollback();
        showFlash('err', `Could not remove ${name} from ${label}.`);
        return;
      }
      if (!chairsElsewhere) {
        await supabase.from('applications')
          .update({ status: 'accepted', assigned_committee_id: null })
          .eq('conference_id', conferenceId)
          .eq('user_id', userId)
          .eq('role', 'chair');
      }
      loadData({ silent: true });
    })().catch(() => {
      rollback();
      showFlash('err', `Could not remove ${name} from ${label}.`);
    }).finally(() => inFlightChairIds.current.delete(committee.id));
  }

  async function handleRevokeInvite(invite: PendingChairInvite, committee: CommitteeData) {
    const label = invite.profiles?.display_name ?? invite.email;
    const { confirmed } = await confirm({
      title: 'Revoke invite?',
      body: `Revoke the chair invite sent to ${label} for ${committee.abbreviation ?? committee.name}?`,
      confirmLabel: 'Revoke',
      danger: true,
    });
    if (!confirmed) return;
    if (!session || inFlightInviteIds.current.has(invite.id)) return;
    inFlightInviteIds.current.add(invite.id);
    const supabase = getAuthedClient(session.access_token);

    // Optimistic: the pending chip disappears immediately.
    setChairInvites(prev => prev.filter(i => i.id !== invite.id));
    showFlash('ok', `Invite to ${label} revoked.`);

    (async () => {
      const { error } = await supabase.from('conference_chair_invites').update({ status: 'revoked' }).eq('id', invite.id);
      if (error) {
        setChairInvites(prev => (prev.some(i => i.id === invite.id) ? prev : [...prev, invite]));
        showFlash('err', `Could not revoke the invite to ${label}.`);
      }
    })().catch(() => {
      setChairInvites(prev => (prev.some(i => i.id === invite.id) ? prev : [...prev, invite]));
      showFlash('err', `Could not revoke the invite to ${label}.`);
    }).finally(() => inFlightInviteIds.current.delete(invite.id));
  }

  function handleChairDropOnCommittee(committeeId: string, droppedChairAppId: string) {
    const chairAppId = droppedChairAppId || dragChairAppId;
    setDragChairAppId(null);
    setChairDropTargetId(null);
    if (!chairAppId) return;
    const chairApp = chairApps.find(ca => ca.id === chairAppId);
    const committee = committees.find(c => c.id === committeeId);
    if (!chairApp || !committee) return;
    handleAssignChair(chairApp, committee);
  }

  function handleChairClickOnCommittee(committee: CommitteeData) {
    if (!selectedChairAppId) return;
    const chairApp = chairApps.find(ca => ca.id === selectedChairAppId);
    if (!chairApp) return;
    handleAssignChair(chairApp, committee);
  }

  // ── Suggestions (global, across all committees) ─────────────────────────────
  const suggestions = useMemo<Suggestion[]>(() => {
    const candidates: Suggestion[] = [];
    for (const app of accepted) {
      let best: Suggestion | null = null;
      for (const c of committees) {
        const allocatedCodes = new Set(c.conference_allocations.map(a => a.country_code));
        const filled = c.conference_allocations.length;
        for (const slot of c.committee_country_slots) {
          if (allocatedCodes.has(slot.country_code)) continue;
          const r = scoreSlot(app, c, slot, filled, c.total_slots);
          if (!best || r.score > best.score) {
            best = { app, committee: c, slot, score: r.score, reasons: r.reasons };
          }
        }
      }
      if (best) candidates.push(best);
    }
    candidates.sort((a, b) => b.score - a.score);
    // Greedy dedupe: never suggest the same slot twice
    const takenSlots = new Set<string>();
    const out: Suggestion[] = [];
    for (const s of candidates) {
      if (takenSlots.has(s.slot.id)) continue;
      takenSlots.add(s.slot.id);
      out.push(s);
      if (out.length >= 6) break;
    }
    return out;
  }, [accepted, committees]);

  if (!conference) return null;

  const selectedApp = accepted.find(a => a.id === selectedAppId) ?? null;
  const dropModalCommittee = dropModal ? committees.find(c => c.id === dropModal.committeeId) ?? null : null;
  const dropModalApp = dropModal ? accepted.find(a => a.id === dropModal.appId) ?? null : null;
  const assignModalCommittee = assignModal ? committees.find(c => c.id === assignModal.committeeId) ?? null : null;

  // Board: open the drop popup for a committee + applicant (drag or click path)
  function openDropModal(committeeId: string, appId: string) {
    const app = accepted.find(a => a.id === appId);
    if (!app) return;
    setDropModal({ committeeId, appId });
  }

  function handleDropOnCommittee(committeeId: string, droppedAppId: string) {
    const appId = droppedAppId || dragAppId;
    setDragAppId(null);
    setDropTargetId(null);
    if (!appId) return;
    openDropModal(committeeId, appId);
  }

  // Left rail: search, alphabetical
  const filteredApps = [...accepted]
    .filter(app => (app.profiles?.display_name ?? app.invited_name ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.profiles?.display_name ?? a.invited_name ?? '').localeCompare(b.profiles?.display_name ?? b.invited_name ?? ''));

  // Chairs mode — unassigned pool is anyone not currently on any committee's
  // dais (chair_user_ids), mirroring how the delegates pool is everyone not
  // yet allocated a slot.
  const allChairIdsOnDais = new Set(committees.flatMap(c => c.chair_user_ids ?? []));
  const unassignedChairs = [...chairApps]
    .filter(ca => !allChairIdsOnDais.has(ca.user_id))
    .filter(ca => (ca.profiles?.display_name ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.profiles?.display_name ?? '').localeCompare(b.profiles?.display_name ?? ''));
  const invitesByCommittee = new Map<string, PendingChairInvite[]>();
  for (const inv of chairInvites) {
    const list = invitesByCommittee.get(inv.committee_id) ?? [];
    list.push(inv);
    invitesByCommittee.set(inv.committee_id, list);
  }
  const inviteModalCommittee = inviteModalCommitteeId ? committees.find(c => c.id === inviteModalCommitteeId) ?? null : null;

  return (
    <div className="px-6 md:px-10 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs mb-1" style={{ color: '#9A8A78', fontFamily: MONO }}>
            {conference.acronym} / Assignment
          </p>
          <h1 className="font-black text-2xl" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Assignment</h1>
        </div>
        {mode === 'delegates' && (
          <div className="flex gap-2">
            <button
              onClick={handleSendAllocationEmails}
              disabled={sendingAllocationEmails}
              className="rounded-xl py-2.5 px-5 font-bold text-sm focus:outline-none transition-colors"
              style={{ border: '1px solid #DDD4C0', color: sendingAllocationEmails ? '#9A8A78' : '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.05em' }}
              onMouseEnter={e => { if (!sendingAllocationEmails) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              {sendingAllocationEmails ? 'QUEUEING...' : 'SEND ALLOCATION EMAILS'}
            </button>
            <button
              onClick={handleSendAllAllocations}
              disabled={sendingAll}
              className="rounded-xl py-2.5 px-5 font-bold text-sm focus:outline-none transition-colors"
              style={{ backgroundColor: sendingAll ? '#DDD4C0' : '#1B3828', color: sendingAll ? '#9A8A78' : '#EED98A', fontFamily: OUTFIT, letterSpacing: '0.05em' }}
              onMouseEnter={e => { if (!sendingAll) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={e => { if (!sendingAll) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              {sendingAll ? 'SENDING...' : 'SEND ALL ALLOCATIONS'}
            </button>
          </div>
        )}
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

      {/* Mode toggle: Delegates | Chairs | Delegations | Independents */}
      <div className="inline-flex rounded-xl p-1 mb-6 flex-wrap" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
        {(['delegates', 'chairs', 'delegations', 'independents'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="focus:outline-none transition-colors"
            style={{
              padding: '6px 18px',
              borderRadius: 8,
              fontSize: 11,
              fontFamily: MONO,
              fontWeight: 700,
              letterSpacing: '0.06em',
              border: 'none',
              backgroundColor: mode === m ? '#1B3828' : 'transparent',
              color: mode === m ? '#EED98A' : '#9A8A78',
              cursor: 'pointer',
            }}
          >
            {m === 'delegates' ? 'DELEGATES' : m === 'chairs' ? 'CHAIRS' : m === 'delegations' ? 'DELEGATIONS' : 'INDEPENDENTS'}
          </button>
        ))}
      </div>

      {/* Flash banner */}
      {flash && (
        <div
          className="rounded-xl px-4 py-2.5 mb-5 text-sm"
          style={{
            backgroundColor: flash.kind === 'ok' ? 'rgba(61,122,82,0.10)' : 'rgba(139,32,32,0.08)',
            border: `1px solid ${flash.kind === 'ok' ? 'rgba(61,122,82,0.35)' : 'rgba(139,32,32,0.3)'}`,
            color: flash.kind === 'ok' ? '#3D7A52' : '#8B2020',
            fontFamily: OUTFIT,
            fontWeight: 600,
          }}
        >
          {flash.msg}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      )}

      {!loading && committees.length === 0 && (
        <div className="text-center py-16">
          <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>No committees yet</p>
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>Add committees first before assigning delegates.</p>
        </div>
      )}

      {!loading && committees.length > 0 && (
        <>
          {/* Suggested assignments strip */}
          {mode === 'delegates' && suggestions.length > 0 && (
            <div
              className="rounded-2xl p-4 mb-6"
              style={{
                backgroundColor: 'rgba(250,248,243,0.78)',
                backdropFilter: 'blur(14px)',
                border: '1px solid #DDD4C0',
                boxShadow: '0 6px 24px rgba(27,56,40,0.08)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={13} style={{ color: '#B6871F' }} />
                <p style={{ fontSize: 11, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.14em', fontWeight: 600 }}>
                  SUGGESTED ASSIGNMENTS
                </p>
                <p style={{ fontSize: 10, color: '#9A8A78', fontFamily: OUTFIT, marginLeft: 'auto' }}>
                  Ranked by preferences, experience fit and committee fill
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {suggestions.map(sug => {
                  const key = `${sug.app.id}-${sug.slot.id}`;
                  const busy = quickAssigning === key;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                      style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
                    >
                      <MemberAvatar name={sug.app.profiles?.display_name ?? sug.app.invited_name ?? 'Unknown'} url={sug.app.profiles?.avatar_url ?? null} size={30} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                            {sug.app.profiles?.display_name ?? sug.app.invited_name}
                          </p>
                          <ArrowRight size={12} style={{ color: '#9A8A78', flexShrink: 0 }} />
                          <img src={getFlagUrl(sug.slot.country_code)} style={{ width: 19, height: 13, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }} alt={sug.slot.country_name} />
                          <p className="text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{sug.slot.country_name}</p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#1B3828', fontFamily: MONO }}>
                            {sug.committee.abbreviation ?? sug.committee.name}
                          </span>
                          {sug.reasons.slice(0, 2).map(r => (
                            <span key={r} className="px-1.5 py-0.5 rounded-full" style={{ fontSize: 9, backgroundColor: 'rgba(61,122,82,0.10)', color: '#3D7A52', fontFamily: MONO, letterSpacing: '0.04em' }}>
                              {r}
                            </span>
                          ))}
                          <span style={{ fontSize: 10, fontWeight: 700, color: fitColor(sug.score), fontFamily: MONO, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                            {sug.score}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => quickAssign(sug)}
                        disabled={busy}
                        className="rounded-lg py-1.5 px-3 text-xs font-bold focus:outline-none transition-colors flex-shrink-0"
                        style={{ backgroundColor: busy ? '#DDD4C0' : '#1B3828', color: busy ? '#9A8A78' : '#EED98A', border: 'none', fontFamily: OUTFIT, letterSpacing: '0.04em' }}
                        onMouseEnter={e => { if (!busy) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                        onMouseLeave={e => { if (!busy) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                      >
                        {busy ? '...' : 'ASSIGN'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected-applicant banner (click path) */}
          {mode === 'delegates' && selectedApp && (
            <div
              className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 mb-5"
              style={{ backgroundColor: 'rgba(61,122,82,0.08)', border: '1px solid rgba(61,122,82,0.35)' }}
            >
              <MousePointerClick size={14} style={{ color: '#3D7A52', flexShrink: 0 }} />
              <p className="text-sm min-w-0 truncate" style={{ color: '#1B3828', fontFamily: OUTFIT }}>
                <span style={{ fontWeight: 700 }}>{selectedApp.profiles?.display_name ?? selectedApp.invited_name}</span> selected — click a committee panel to pick their country, or drag their card.
              </p>
              <button
                onClick={() => setSelectedAppId(null)}
                className="focus:outline-none flex-shrink-0"
                style={{ color: '#3D7A52', marginLeft: 'auto', lineHeight: 0 }}
                title="Clear selection"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {mode === 'delegates' && (
            <div className="flex flex-col xl:flex-row gap-6 items-start">
              {/* Left rail — unassigned applicants */}
              <div className="w-full xl:w-[320px] flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <p style={{ fontSize: 11, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.14em', fontWeight: 600 }}>
                    UNASSIGNED
                  </p>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: 'rgba(27,56,40,0.1)', color: '#1B3828', fontFamily: MONO, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {filteredApps.length}
                  </span>
                  <span style={{ fontSize: 10, color: '#9A8A78', fontFamily: MONO, marginLeft: 'auto', letterSpacing: '0.06em' }}>
                    DRAG ONTO A COMMITTEE
                  </span>
                </div>

                {/* Search */}
                <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search applicants..."
                    className="flex-1 text-sm outline-none"
                    style={{ backgroundColor: 'transparent', color: '#1C1410', fontFamily: OUTFIT }}
                  />
                </div>

                {filteredApps.length === 0 ? (
                  <p className="text-sm py-6 text-center" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                    {accepted.length === 0 ? 'No accepted applicants yet.' : 'No applicants match your search.'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {filteredApps.map(app => {
                      const expanded = expandedAppId === app.id;
                      const selected = selectedAppId === app.id;
                      const beingDragged = dragAppId === app.id;
                      const userHistory = app.profiles ? history[app.profiles.id] : undefined;
                      const nationality = app.profiles?.nationality ?? null;
                      const natCountry = nationality ? getCountryByName(nationality) : undefined;
                      const firstPref = [...(app.application_preferences ?? [])]
                        .sort((a, b) => a.preference_order - b.preference_order)[0];
                      return (
                        <div
                          key={app.id}
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData('text/plain', app.id);
                            e.dataTransfer.effectAllowed = 'move';
                            setDragAppId(app.id);
                          }}
                          onDragEnd={() => { setDragAppId(null); setDropTargetId(null); }}
                          onClick={() => setSelectedAppId(prev => (prev === app.id ? null : app.id))}
                          className="rounded-xl p-3 transition-colors"
                          style={{
                            backgroundColor: selected ? 'rgba(27,56,40,0.06)' : '#FAF8F3',
                            border: `1.5px solid ${selected ? '#1B3828' : expanded ? 'rgba(27,56,40,0.45)' : '#DDD4C0'}`,
                            opacity: beingDragged ? 0.45 : 1,
                            cursor: 'grab',
                          }}
                          onMouseEnter={e => { if (!selected && !expanded) (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                          onMouseLeave={e => { if (!selected && !expanded) (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical size={13} style={{ color: '#DDD4C0', flexShrink: 0, marginTop: 6 }} />
                            <MemberAvatar name={app.profiles?.display_name ?? app.invited_name ?? 'Unknown'} url={app.profiles?.avatar_url ?? null} size={34} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                {natCountry && (
                                  <img
                                    src={getFlagUrl(natCountry.code)}
                                    style={{ width: 20, height: 14, borderRadius: 2, objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 2px rgba(27,56,40,0.2)' }}
                                    alt={nationality ?? ''}
                                    title={nationality ?? ''}
                                  />
                                )}
                                <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                                  {app.profiles?.display_name ?? app.invited_name ?? 'Unknown'}
                                </p>
                                {!app.profiles && <NotRegisteredChip />}
                                {selected && <Check size={13} style={{ color: '#3D7A52', flexShrink: 0 }} />}
                              </div>
                              <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                                {app.role} · {app.experience_level ?? 'n/a'}
                              </p>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); setExpandedAppId(expanded ? null : app.id); }}
                              title={expanded ? 'Hide details' : 'Show details'}
                              className="focus:outline-none flex-shrink-0"
                              style={{ color: '#9A8A78', lineHeight: 0, marginTop: 3 }}
                            >
                              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <DelegationChip app={app} />
                          </div>

                          {firstPref && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.06em', flexShrink: 0 }}>1ST PREF</span>
                              <img src={getFlagUrl(firstPref.country_code)} style={{ width: 17, height: 12, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }} alt={firstPref.country_name} />
                              <span className="truncate" style={{ fontSize: 11, color: '#9A8A78', fontFamily: OUTFIT }}>
                                {firstPref.conference_committees?.name ?? 'Unknown'} · {firstPref.country_name}
                              </span>
                            </div>
                          )}

                          {expanded && <DelegateDetail app={app} history={userHistory} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Board — every committee visible at once */}
              <div className="flex-1 min-w-0 w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {committees.map(c => (
                    <CommitteeBoardPanel
                      key={c.id}
                      committee={c}
                      dragging={dragAppId !== null}
                      isDropTarget={dropTargetId === c.id}
                      selectable={selectedAppId !== null}
                      onDragOverPanel={() => setDropTargetId(c.id)}
                      onDragLeavePanel={() => setDropTargetId(prev => (prev === c.id ? null : prev))}
                      onDropPanel={appId => handleDropOnCommittee(c.id, appId)}
                      onClickPanel={() => { if (selectedAppId) openDropModal(c.id, selectedAppId); }}
                      onRemoveAllocation={handleRemoveAllocation}
                      onCycleTier={handleCycleTier}
                      onAssignSlot={slot => setAssignModal({ committeeId: c.id, preSlot: slot })}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chairs mode — mirrors delegates mode's anatomy: searchable
              unassigned rail on the left, drag/click-to-select committee
              cards on the right. No suggestions strip (no preference data). */}
          {mode === 'chairs' && (
            <div className="flex flex-col xl:flex-row gap-6 items-start">
              {/* Left rail — unassigned chair applicants */}
              <div className="w-full xl:w-[320px] flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <p style={{ fontSize: 11, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.14em', fontWeight: 600 }}>
                    UNASSIGNED
                  </p>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: 'rgba(27,56,40,0.1)', color: '#1B3828', fontFamily: MONO, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {unassignedChairs.length}
                  </span>
                  <span style={{ fontSize: 10, color: '#9A8A78', fontFamily: MONO, marginLeft: 'auto', letterSpacing: '0.06em' }}>
                    DRAG ONTO A COMMITTEE
                  </span>
                </div>

                {/* Search */}
                <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search applicants..."
                    className="flex-1 text-sm outline-none"
                    style={{ backgroundColor: 'transparent', color: '#1C1410', fontFamily: OUTFIT }}
                  />
                </div>

                {unassignedChairs.length === 0 ? (
                  <p className="text-sm py-6 text-center" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                    {chairApps.length === 0 ? 'No accepted chair applicants yet.' : 'No applicants match your search.'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {unassignedChairs.map(ca => {
                      const selected = selectedChairAppId === ca.id;
                      const beingDragged = dragChairAppId === ca.id;
                      return (
                        <div
                          key={ca.id}
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData('text/plain', ca.id);
                            e.dataTransfer.effectAllowed = 'move';
                            setDragChairAppId(ca.id);
                          }}
                          onDragEnd={() => { setDragChairAppId(null); setChairDropTargetId(null); }}
                          onClick={() => setSelectedChairAppId(prev => (prev === ca.id ? null : ca.id))}
                          className="rounded-xl p-3 transition-colors"
                          style={{
                            backgroundColor: selected ? 'rgba(27,56,40,0.06)' : '#FAF8F3',
                            border: `1.5px solid ${selected ? '#1B3828' : '#DDD4C0'}`,
                            opacity: beingDragged ? 0.45 : 1,
                            cursor: 'grab',
                          }}
                          onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                          onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical size={13} style={{ color: '#DDD4C0', flexShrink: 0, marginTop: 6 }} />
                            <MemberAvatar name={ca.profiles?.display_name ?? 'Unknown'} url={ca.profiles?.avatar_url ?? null} size={34} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                                  {ca.profiles?.display_name ?? 'Unknown'}
                                </p>
                                {selected && <Check size={13} style={{ color: '#3D7A52', flexShrink: 0 }} />}
                              </div>
                              <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                                chair · {ca.experience_level ?? 'n/a'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Board — every committee visible at once */}
              <div className="flex-1 min-w-0 w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {committees.map(c => (
                    <ChairBoardPanel
                      key={c.id}
                      committee={c}
                      invites={invitesByCommittee.get(c.id) ?? []}
                      dragging={dragChairAppId !== null}
                      isDropTarget={chairDropTargetId === c.id}
                      selectable={selectedChairAppId !== null}
                      onDragOverPanel={() => setChairDropTargetId(c.id)}
                      onDragLeavePanel={() => setChairDropTargetId(prev => (prev === c.id ? null : prev))}
                      onDropPanel={chairAppId => handleChairDropOnCommittee(c.id, chairAppId)}
                      onClickPanel={() => handleChairClickOnCommittee(c)}
                      onRemoveChair={(userId, name) => handleRemoveChair(userId, c, name)}
                      onRevokeInvite={invite => handleRevokeInvite(invite, c)}
                      onInvite={() => setInviteModalCommitteeId(c.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Selected-chair banner (click path) */}
      {mode === 'chairs' && selectedChairAppId && (() => {
        const selectedChairApp = chairApps.find(ca => ca.id === selectedChairAppId);
        if (!selectedChairApp) return null;
        return (
          <div
            className="fixed left-1/2 z-40 flex items-center gap-2.5 rounded-xl px-4 py-2.5"
            style={{ bottom: 24, transform: 'translateX(-50%)', backgroundColor: 'rgba(61,122,82,0.95)', border: '1px solid rgba(61,122,82,0.35)', boxShadow: '0 12px 30px rgba(27,56,40,0.3)' }}
          >
            <MousePointerClick size={14} style={{ color: '#EED98A', flexShrink: 0 }} />
            <p className="text-sm min-w-0" style={{ color: '#FFFFFF', fontFamily: OUTFIT }}>
              <span style={{ fontWeight: 700 }}>{selectedChairApp.profiles?.display_name}</span> selected — click a committee to assign, or drag their card.
            </p>
            <button
              onClick={() => setSelectedChairAppId(null)}
              className="focus:outline-none flex-shrink-0"
              style={{ color: '#EED98A', marginLeft: 4, lineHeight: 0 }}
              title="Clear selection"
            >
              <X size={15} />
            </button>
          </div>
        );
      })()}

      {inviteModalCommittee && conference && (
        <InviteChairModal
          conferenceId={conference.id}
          committee={inviteModalCommittee}
          onClose={() => setInviteModalCommitteeId(null)}
          onInvited={name => {
            setInviteModalCommitteeId(null);
            showFlash('ok', `Invite sent to ${name}`);
            // The invite row (id/token) is server-minted — fetch it silently
            // instead of wiping the board behind a spinner.
            loadData({ silent: true });
          }}
        />
      )}

      {/* Drop popup — open slots for the target committee, most urgent first */}
      {dropModal && dropModalCommittee && dropModalApp && (
        <DropAllocateModal
          committee={dropModalCommittee}
          app={dropModalApp}
          onClose={() => setDropModal(null)}
          onAssigned={(slot, msg) => {
            // The insert already succeeded inside the modal (its button was
            // the only busy control) — commit the same change locally and
            // swap in the real row id with a silent refetch.
            applyLocalAllocation(dropModalCommittee, dropModalApp, slot);
            showFlash('ok', msg);
            setSelectedAppId(null);
            loadData({ silent: true });
          }}
        />
      )}


      {mode === 'delegations' && (
        <DelegationsView conference={conference} showFlash={showFlash} />
      )}

      {mode === 'independents' && (
        <IndependentsView conference={conference} showFlash={showFlash} />
      )}

      {/* Slot-first assign modal (from a panel's expanded slot list) */}
      {assignModal && assignModalCommittee && (
        <AssignModal
          committee={assignModalCommittee}
          unassigned={accepted}
          preSelectedSlot={assignModal.preSlot}
          onClose={() => setAssignModal(null)}
          onAssigned={(app, slot, sentEmail) => {
            // Writes already succeeded inside the modal — commit the same
            // change locally and fetch the real row id silently.
            applyLocalAllocation(assignModalCommittee, app, slot, sentEmail);
            loadData({ silent: true });
          }}
        />
      )}

      {confirmModal}
    </div>
  );
}
