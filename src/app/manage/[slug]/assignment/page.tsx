'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Check, Sparkles, ChevronDown, ChevronUp, Award, Globe2, ArrowRight } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { getFlagUrl, getCountryByName } from '@/lib/countries';

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
  payment_status: string | null;
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

interface RoleConfigLite {
  role: string;
  must_pay_before_allocation: boolean;
}

function isAllocationBlocked(app: AcceptedApp, roleConfigs: RoleConfigLite[]): boolean {
  const cfg = roleConfigs.find(rc => rc.role === app.role);
  if (!cfg?.must_pay_before_allocation) return false;
  return app.payment_status !== 'paid' && app.payment_status !== 'waived';
}

interface AllocationRow {
  id: string;
  user_id: string;
  country_code: string;
  country_name: string;
  allocation_sent: boolean;
  application_id: string | null;
  profiles: { display_name: string } | null;
}

// Importance tiers. Mapping: green = HIGH importance to the committee,
// yellow/amber = MEDIUM, red = LOW. 'standard' = unrated (neutral).
type ImportanceTier = 'standard' | 'high' | 'medium' | 'low';
const TIER_CYCLE: ImportanceTier[] = ['standard', 'high', 'medium', 'low'];
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

interface CommitteeData {
  id: string;
  name: string;
  abbreviation: string | null;
  difficulty: string;
  total_slots: number;
  chair_user_ids: string[] | null;
  committee_country_slots: SlotRow[];
  conference_allocations: AllocationRow[];
}

interface ChairApp {
  id: string;
  user_id: string;
  status: string;
  assigned_committee_id: string | null;
  experience_level: string | null;
  profiles: { id: string; display_name: string; email: string } | null;
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
const MONO = "'DM Mono', monospace";

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
      <span style={{ fontSize: 9, fontWeight: 700, color: meta.color, fontFamily: MONO, letterSpacing: '0.08em' }}>
        {meta.label}
      </span>
    </button>
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
      <p style={{ fontSize: 8, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.14em', fontWeight: 500 }}>{label}</p>
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
        {stat('EXPERIENCE', exp ? exp.toUpperCase() : 'N/A')}
        {stat('CONFERENCES', history?.conferences ?? 0)}
        {stat('AWARDS', history?.awards ?? 0)}
      </div>

      {/* Award labels */}
      {history && history.awardLabels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          <Award size={11} style={{ color: '#B6871F', flexShrink: 0 }} />
          {history.awardLabels.slice(0, 4).map((lbl, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full" style={{ fontSize: 9, backgroundColor: 'rgba(182,135,31,0.12)', color: '#B6871F', fontFamily: MONO, border: '1px solid rgba(182,135,31,0.25)' }}>
              {lbl}
            </span>
          ))}
          {history.awardLabels.length > 4 && (
            <span style={{ fontSize: 9, color: '#9A8A78', fontFamily: MONO }}>+{history.awardLabels.length - 4}</span>
          )}
        </div>
      )}

      {/* Full preference list */}
      {(app.application_preferences ?? []).length > 0 && (
        <div>
          <p style={{ fontSize: 8, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.14em', fontWeight: 500, marginBottom: 4 }}>PREFERENCES</p>
          {[...(app.application_preferences ?? [])]
            .sort((a, b) => a.preference_order - b.preference_order)
            .map(p => (
              <div key={p.preference_order} className="flex items-center gap-2 py-0.5">
                <span style={{ fontSize: 10, fontWeight: 700, color: '#9A8A78', fontFamily: MONO, width: 12 }}>{p.preference_order}</span>
                <img src={getFlagUrl(p.country_code)} style={{ width: 16, height: 11, borderRadius: 2, objectFit: 'cover' }} alt={p.country_name} />
                <span className="truncate" style={{ fontSize: 11, color: '#1C1410', fontFamily: OUTFIT }}>
                  {p.conference_committees?.name ?? 'Unknown'} · {p.country_name}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ── AssignModal ───────────────────────────────────────────────────────────────

interface AssignModalProps {
  committee: CommitteeData;
  unassigned: AcceptedApp[];
  roleConfigs: RoleConfigLite[];
  preSelectedSlot?: SlotRow;
  preSelectedApp?: AcceptedApp;
  onClose: () => void;
  onAssigned: () => void;
}

function AssignModal({ committee, unassigned, roleConfigs, preSelectedSlot, preSelectedApp, onClose, onAssigned }: AssignModalProps) {
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
    if (isAllocationBlocked(selectedApp, roleConfigs)) {
      setError('This delegate must pay before allocation. Mark them paid or waived first.');
      return;
    }
    const userId = selectedApp.profiles?.id;
    if (!userId) { setError('Applicant profile not found.'); return; }
    setSaving(true);
    setError('');
    if (!session) return;
    if (!conference) { setError('Conference not loaded. Please refresh.'); setSaving(false); return; }
    const supabase = getAuthedClient(session.access_token);

    const { error: insertErr } = await supabase.from('conference_allocations').insert({
      conference_id: conference.id,
      conference_committee_id: committee.id,
      user_id: userId,
      country_code: selectedSlot.country_code,
      country_name: selectedSlot.country_name,
      application_id: selectedApp.id,
      allocation_sent: false,
    });
    if (insertErr) {
      if (insertErr.code === '23505') {
        setError(
          insertErr.message.includes('user_id')
            ? 'This delegate already has an allocation in this committee.'
            : insertErr.message.includes('country_code')
            ? 'This country is already allocated to another delegate.'
            : 'This allocation already exists.'
        );
      } else {
        setError(insertErr.message);
      }
      setSaving(false);
      return;
    }

    await supabase.from('applications').update({
      status: 'assigned',
      assigned_committee_id: committee.id,
      assigned_country_code: selectedSlot.country_code,
      assigned_country_name: selectedSlot.country_name,
    }).eq('id', selectedApp.id);

    if (sendEmail) {
      await supabase
        .from('conference_allocations')
        .update({ allocation_sent: true, allocation_sent_at: new Date().toISOString() })
        .eq('conference_committee_id', committee.id)
        .eq('user_id', userId);
    }

    setSaving(false);
    onAssigned();
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

        <p className="text-xs font-semibold mb-2" style={{ color: '#B6871F', fontFamily: MONO, letterSpacing: '0.12em', fontSize: 9 }}>
          COMMITTEE
        </p>
        <p className="text-sm font-semibold mb-4" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          {committee.name}
        </p>

        {/* Applicant picker (if not pre-selected) */}
        <div className="mb-4">
          <p className="text-xs font-semibold mb-2" style={{ color: '#B6871F', fontFamily: MONO, letterSpacing: '0.12em', fontSize: 9 }}>APPLICANT</p>
          {preSelectedApp ? (
            <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(27,56,40,0.05)', border: '1px solid rgba(27,56,40,0.15)' }}>
              <p className="font-semibold text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{preSelectedApp.profiles?.display_name}</p>
              <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{preSelectedApp.role} · {preSelectedApp.experience_level ?? 'n/a'}</p>
            </div>
          ) : (
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #DDD4C0', borderRadius: 12 }}>
              {scored.length === 0 ? (
                <p className="text-sm p-3" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No unassigned applicants.</p>
              ) : scored.map(({ app, score }, idx) => {
                const selected = selectedApp?.id === app.id;
                const blocked = isAllocationBlocked(app, roleConfigs);
                return (
                  <div
                    key={app.id}
                    className="flex items-center gap-3 px-3 py-2 transition-colors"
                    style={{
                      backgroundColor: selected ? 'rgba(27,56,40,0.08)' : 'transparent',
                      borderBottom: '1px solid #F0EDE6',
                      cursor: blocked ? 'not-allowed' : 'pointer',
                      opacity: blocked ? 0.55 : 1,
                    }}
                    onClick={() => { if (!blocked) setSelectedApp(app); }}
                    onMouseEnter={e => { if (!selected && !blocked) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                    onMouseLeave={e => { if (!selected && !blocked) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{app.profiles?.display_name}</p>
                      <p className="text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{app.role} · {app.experience_level ?? 'n/a'}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {blocked ? (
                        <span style={{ fontSize: 9, color: '#B8844A', fontFamily: MONO, fontWeight: 700 }}>PENDING PAYMENT</span>
                      ) : (
                        <>
                          {idx === 0 && score >= 20 && (
                            <span style={{ fontSize: 9, color: '#B6871F', fontFamily: MONO }}>BEST</span>
                          )}
                          <span style={{ fontSize: 10, fontWeight: 700, color: fitColor(score), fontFamily: MONO }}>{score}</span>
                        </>
                      )}
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
            <p className="text-xs font-semibold mb-1" style={{ color: '#B6871F', fontFamily: MONO, letterSpacing: '0.12em', fontSize: 9 }}>PREFERENCES</p>
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
          <p className="text-xs font-semibold mb-2" style={{ color: '#B6871F', fontFamily: MONO, letterSpacing: '0.12em', fontSize: 9 }}>COUNTRY</p>
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

// ── AssignmentPage ────────────────────────────────────────────────────────────

export default function AssignmentPage() {
  const { conference } = useManage();
  const { session, loading: authLoading } = useAuth();
  const [accepted, setAccepted] = useState<AcceptedApp[]>([]);
  const [committees, setCommittees] = useState<CommitteeData[]>([]);
  const [roleConfigs, setRoleConfigs] = useState<RoleConfigLite[]>([]);
  const [chairApps, setChairApps] = useState<ChairApp[]>([]);
  const [history, setHistory] = useState<Record<string, UserHistory>>({});
  const [mode, setMode] = useState<'delegates' | 'chairs'>('delegates');
  const [loading, setLoading] = useState(true);
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [assignModal, setAssignModal] = useState<{
    preSlot?: SlotRow;
    preApp?: AcceptedApp;
  } | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [quickAssigning, setQuickAssigning] = useState<string | null>(null); // suggestion key in flight
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  function showFlash(kind: 'ok' | 'err', msg: string) {
    setFlash({ kind, msg });
    setTimeout(() => setFlash(f => (f?.msg === msg ? null : f)), 4500);
  }

  const loadData = useCallback(async () => {
    if (!conference) return;
    if (!session) return;
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);

    const [appRes, commRes, cfgRes, chairRes] = await Promise.all([
      supabase
        .from('applications')
        .select(`
          id, role, experience_level, is_head_delegate, payment_status,
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
          id, name, abbreviation, difficulty, total_slots, chair_user_ids,
          committee_country_slots (id, country_code, country_name, delegation_size, importance),
          conference_allocations (id, user_id, country_code, country_name, allocation_sent, application_id, profiles (display_name))
        `)
        .eq('conference_id', conference.id)
        .order('name', { ascending: true }),
      supabase
        .from('application_role_configs')
        .select('role, must_pay_before_allocation')
        .eq('conference_id', conference.id),
      supabase
        .from('applications')
        .select(`
          id, user_id, status, assigned_committee_id, experience_level,
          profiles (id, display_name, email)
        `)
        .eq('conference_id', conference.id)
        .eq('role', 'chair')
        .in('status', ['accepted', 'assigned']),
    ]);

    const apps = (appRes.data ?? []) as unknown as AcceptedApp[];
    const comms = (commRes.data ?? []) as unknown as CommitteeData[];

    setAccepted(apps);
    setCommittees(comms);
    setRoleConfigs((cfgRes.data ?? []) as unknown as RoleConfigLite[]);
    setChairApps((chairRes.data ?? []) as unknown as ChairApp[]);
    if (comms.length > 0 && !selectedCommitteeId) {
      setSelectedCommitteeId(comms[0].id);
    }
    setLoading(false);

    // Enrich with MUN history (CV entries + platform awards) — non-blocking
    const userIds = Array.from(new Set(apps.map(a => a.profiles?.id).filter(Boolean))) as string[];
    if (userIds.length > 0) {
      const [cvRes, awRes] = await Promise.all([
        supabase.from('mun_cv_entries').select('user_id, award').in('user_id', userIds),
        supabase.from('conference_awards').select('user_id, award_label').in('user_id', userIds),
      ]);
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
  }, [conference, selectedCommitteeId, session?.access_token]);

  useEffect(() => {
    if (authLoading) return;
    loadData();
  }, [authLoading, loadData]);

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

  // ── One-click assign (used by suggestion cards) ─────────────────────────────
  async function quickAssign(sug: Suggestion) {
    if (!session || !conference) return;
    if (isAllocationBlocked(sug.app, roleConfigs)) {
      showFlash('err', 'This delegate must pay before allocation.');
      return;
    }
    const userId = sug.app.profiles?.id;
    if (!userId) { showFlash('err', 'Applicant profile not found.'); return; }
    const key = `${sug.app.id}-${sug.slot.id}`;
    setQuickAssigning(key);
    const supabase = getAuthedClient(session.access_token);

    const { error: insertErr } = await supabase.from('conference_allocations').insert({
      conference_id: conference.id,
      conference_committee_id: sug.committee.id,
      user_id: userId,
      country_code: sug.slot.country_code,
      country_name: sug.slot.country_name,
      application_id: sug.app.id,
      allocation_sent: false,
    });
    if (insertErr) {
      setQuickAssigning(null);
      if (insertErr.code === '23505') {
        showFlash('err', insertErr.message.includes('user_id')
          ? 'This delegate already has an allocation in this committee.'
          : insertErr.message.includes('country_code')
          ? 'This country is already allocated to another delegate.'
          : 'This allocation already exists.');
      } else {
        showFlash('err', insertErr.message);
      }
      await loadData();
      return;
    }

    await supabase.from('applications').update({
      status: 'assigned',
      assigned_committee_id: sug.committee.id,
      assigned_country_code: sug.slot.country_code,
      assigned_country_name: sug.slot.country_name,
    }).eq('id', sug.app.id);

    setQuickAssigning(null);
    showFlash('ok', `${sug.app.profiles?.display_name} assigned to ${sug.slot.country_name} in ${sug.committee.abbreviation ?? sug.committee.name}.`);
    await loadData();
  }

  async function handleSendAllAllocations() {
    if (!committees.length) return;
    setSendingAll(true);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const committeeIds = committees.map(c => c.id);
    await supabase
      .from('conference_allocations')
      .update({ allocation_sent: true, allocation_sent_at: new Date().toISOString() })
      .in('conference_committee_id', committeeIds)
      .eq('allocation_sent', false);
    setSendingAll(false);
    await loadData();
  }

  async function handleRemoveAllocation(allocation: AllocationRow) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('conference_allocations').delete().eq('id', allocation.id);
    if (allocation.application_id) {
      await supabase.from('applications').update({
        status: 'accepted',
        assigned_committee_id: null,
        assigned_country_code: null,
        assigned_country_name: null,
      }).eq('id', allocation.application_id);
    }
    await loadData();
  }

  async function handleAssignChair(chairApp: ChairApp, committee: CommitteeData) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const nextIds = Array.from(new Set([...(committee.chair_user_ids ?? []), chairApp.user_id]));
    await supabase.from('conference_committees').update({ chair_user_ids: nextIds }).eq('id', committee.id);
    await supabase.from('applications').update({ status: 'assigned', assigned_committee_id: committee.id }).eq('id', chairApp.id);
    await loadData();
  }

  async function handleRemoveChair(userId: string, committee: CommitteeData) {
    if (!session || !conference) return;
    const supabase = getAuthedClient(session.access_token);
    const nextIds = (committee.chair_user_ids ?? []).filter(id => id !== userId);
    await supabase.from('conference_committees').update({ chair_user_ids: nextIds }).eq('id', committee.id);
    await supabase.from('applications')
      .update({ status: 'accepted', assigned_committee_id: null })
      .eq('conference_id', conference.id)
      .eq('user_id', userId)
      .eq('role', 'chair');
    await loadData();
  }

  // ── Suggestions (global, across all committees) ─────────────────────────────
  const suggestions = useMemo<Suggestion[]>(() => {
    const candidates: Suggestion[] = [];
    for (const app of accepted) {
      if (isAllocationBlocked(app, roleConfigs)) continue;
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
  }, [accepted, committees, roleConfigs]);

  if (!conference) return null;

  const selectedCommittee = committees.find(c => c.id === selectedCommitteeId) ?? null;

  const unassignedForCommittee = accepted.filter(app => {
    const name = app.profiles?.display_name ?? '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  // Committee-level fit scores for the left panel
  const withScores = unassignedForCommittee.map(app => ({
    app,
    score: selectedCommittee ? scorePrefAndExp(app, selectedCommittee, null).score : 0,
  }));
  withScores.sort((a, b) => b.score - a.score);
  const bestIds = new Set(withScores.slice(0, 3).filter(x => x.score >= 20).map(x => x.app.id));

  // Per-slot SUGGESTED badges within the selected committee
  const slotSuggestions = new Map<string, Suggestion>(
    suggestions.filter(s => s.committee.id === selectedCommitteeId).map(s => [s.slot.id, s])
  );

  const filledCount = selectedCommittee?.conference_allocations.length ?? 0;
  const totalSlots = selectedCommittee?.total_slots ?? 0;

  const chairAppByUser = new Map(chairApps.map(ca => [ca.user_id, ca]));
  const currentChairIds = selectedCommittee?.chair_user_ids ?? [];
  const currentChairs = currentChairIds.map(uid => ({
    userId: uid,
    name: chairAppByUser.get(uid)?.profiles?.display_name ?? 'Chair',
    email: chairAppByUser.get(uid)?.profiles?.email ?? '',
  }));
  const assignableChairs = chairApps.filter(ca => ca.status === 'accepted' && !currentChairIds.includes(ca.user_id));

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
        )}
      </div>

      {/* Mode toggle: Delegates | Chairs */}
      <div className="inline-flex rounded-xl p-1 mb-6" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
        {(['delegates', 'chairs'] as const).map(m => (
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
            {m === 'delegates' ? 'DELEGATES' : 'CHAIRS'}
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
                <p style={{ fontSize: 10, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.16em', fontWeight: 500 }}>
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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                            {sug.app.profiles?.display_name}
                          </p>
                          <ArrowRight size={11} style={{ color: '#9A8A78', flexShrink: 0 }} />
                          <img src={getFlagUrl(sug.slot.country_code)} style={{ width: 17, height: 12, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }} alt={sug.slot.country_name} />
                          <p className="text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{sug.slot.country_name}</p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#1B3828', fontFamily: MONO }}>
                            {sug.committee.abbreviation ?? sug.committee.name}
                          </span>
                          {sug.reasons.slice(0, 2).map(r => (
                            <span key={r} className="px-1.5 py-0.5 rounded-full" style={{ fontSize: 8, backgroundColor: 'rgba(61,122,82,0.10)', color: '#3D7A52', fontFamily: MONO, letterSpacing: '0.04em' }}>
                              {r}
                            </span>
                          ))}
                          <span style={{ fontSize: 9, fontWeight: 700, color: fitColor(sug.score), fontFamily: MONO, marginLeft: 'auto' }}>
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

          {/* Committee tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 mb-6" style={{ scrollbarWidth: 'none' }}>
            {committees.map(c => {
              const filled = c.conference_allocations.length;
              const active = c.id === selectedCommitteeId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCommitteeId(c.id)}
                  className="flex-shrink-0 focus:outline-none transition-colors"
                  style={{
                    padding: '6px 16px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontFamily: MONO,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    border: active ? 'none' : '1px solid #DDD4C0',
                    backgroundColor: active ? '#1B3828' : 'transparent',
                    color: active ? '#EED98A' : '#9A8A78',
                    cursor: 'pointer',
                  }}
                >
                  {c.abbreviation ?? c.name} <span style={{ opacity: 0.7 }}>{filled}/{c.total_slots}</span>
                </button>
              );
            })}
          </div>

          {mode === 'delegates' && selectedCommittee && (
            <div className="flex gap-6" style={{ minHeight: 500 }}>
              {/* Left panel — unassigned applicants */}
              <div style={{ width: 340, flexShrink: 0 }}>
                <div className="flex items-center gap-2 mb-3">
                  <p style={{ fontSize: 10, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.16em', fontWeight: 500 }}>
                    UNASSIGNED
                  </p>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: 'rgba(27,56,40,0.1)', color: '#1B3828', fontFamily: MONO, fontSize: 10 }}
                  >
                    {unassignedForCommittee.length}
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

                {unassignedForCommittee.length === 0 ? (
                  <p className="text-sm py-6 text-center" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                    {accepted.length === 0 ? 'No accepted applicants yet.' : 'No applicants match your search.'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {withScores.map(({ app, score }) => {
                      const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order);
                      const commPrefs = prefs.filter(p => p.conference_committee_id === selectedCommittee.id);
                      const isBest = bestIds.has(app.id);
                      const blocked = isAllocationBlocked(app, roleConfigs);
                      const expanded = expandedAppId === app.id;
                      const userHistory = app.profiles ? history[app.profiles.id] : undefined;
                      return (
                        <div
                          key={app.id}
                          className="rounded-xl p-3 transition-colors"
                          style={{
                            backgroundColor: '#FAF8F3',
                            border: `1px solid ${expanded ? '#1B3828' : '#DDD4C0'}`,
                            opacity: blocked ? 0.65 : 1,
                            cursor: 'pointer',
                          }}
                          onClick={() => setExpandedAppId(expanded ? null : app.id)}
                          onMouseEnter={e => { if (!expanded) (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                          onMouseLeave={e => { if (!expanded) (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                                  {app.profiles?.display_name ?? 'Unknown'}
                                </p>
                                {expanded
                                  ? <ChevronUp size={12} style={{ color: '#9A8A78', flexShrink: 0 }} />
                                  : <ChevronDown size={12} style={{ color: '#9A8A78', flexShrink: 0 }} />}
                              </div>
                              <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                                {app.role} · {app.experience_level ?? 'n/a'}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              {blocked ? (
                                <span style={{ fontSize: 9, color: '#B8844A', fontFamily: MONO, fontWeight: 700 }}>PENDING PAYMENT</span>
                              ) : (
                                <>
                                  {isBest && (
                                    <span style={{ fontSize: 9, color: '#B6871F', fontFamily: MONO, fontWeight: 700 }}>BEST FIT</span>
                                  )}
                                  <span style={{ fontSize: 11, fontWeight: 700, color: fitColor(score), fontFamily: MONO }}>
                                    {score}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {commPrefs.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {commPrefs.map(p => (
                                <span
                                  key={p.preference_order}
                                  className="px-2 py-0.5 rounded-full"
                                  style={{ fontSize: 9, backgroundColor: 'rgba(27,56,40,0.1)', color: '#1B3828', fontFamily: MONO }}
                                >
                                  #{p.preference_order} {p.country_name}
                                </span>
                              ))}
                            </div>
                          )}

                          {expanded && (
                            <>
                              <DelegateDetail app={app} history={userHistory} />
                              {!blocked && (
                                <button
                                  onClick={e => { e.stopPropagation(); setAssignModal({ preApp: app }); }}
                                  className="mt-3 w-full rounded-lg py-2 text-xs font-bold focus:outline-none transition-colors"
                                  style={{ backgroundColor: '#1B3828', color: '#EED98A', border: 'none', fontFamily: OUTFIT, letterSpacing: '0.05em' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                                >
                                  ASSIGN TO {selectedCommittee.abbreviation ?? 'COMMITTEE'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right panel — country slots */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-base" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                    {selectedCommittee.name}
                  </p>
                  <p className="text-xs" style={{ color: '#9A8A78', fontFamily: MONO }}>
                    {totalSlots} slots · {filledCount} filled
                  </p>
                </div>
                <p className="text-xs mb-3" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                  Click a slot&apos;s tier chip to cycle its importance: <span style={{ color: TIER_META.high.color, fontWeight: 700 }}>green = high</span>, <span style={{ color: TIER_META.medium.color, fontWeight: 700 }}>amber = medium</span>, <span style={{ color: TIER_META.low.color, fontWeight: 700 }}>red = low</span>.
                </p>

                {selectedCommittee.committee_country_slots.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>No country slots configured for this committee.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedCommittee.committee_country_slots.map(slot => {
                      const allocation = selectedCommittee.conference_allocations.find(a => a.country_code === slot.country_code);
                      const filled = !!allocation;
                      const tier = TIER_META[slot.importance];
                      const slotSug = !filled ? slotSuggestions.get(slot.id) : undefined;
                      const sugKey = slotSug ? `${slotSug.app.id}-${slotSug.slot.id}` : null;
                      const sugBusy = sugKey !== null && quickAssigning === sugKey;
                      return (
                        <div
                          key={slot.id}
                          className="rounded-xl flex flex-col relative overflow-hidden"
                          style={{
                            backgroundColor: '#FAF8F3',
                            border: `1px solid ${filled ? 'rgba(27,56,40,0.2)' : '#DDD4C0'}`,
                            padding: '12px 12px 12px 15px',
                          }}
                        >
                          {/* Importance left bar */}
                          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: slot.importance === 'standard' ? '#DDD4C0' : tier.color, opacity: slot.importance === 'standard' ? 0.6 : 0.9 }} />

                          <div className="flex items-start justify-between gap-1">
                            <img
                              src={getFlagUrl(slot.country_code)}
                              style={{ width: 28, height: 20, borderRadius: 3, objectFit: 'cover', boxShadow: '0 1px 3px rgba(27,56,40,0.18)' }}
                              alt={slot.country_name}
                            />
                            <TierBadge tier={slot.importance} onCycle={() => handleCycleTier(slot)} />
                          </div>
                          <p className="font-medium text-sm mt-1" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                            {slot.country_name}
                          </p>
                          {filled && allocation ? (
                            <>
                              <p className="text-xs font-semibold mt-0.5" style={{ color: '#3D7A52', fontFamily: OUTFIT }}>
                                {allocation.profiles?.display_name ?? 'Assigned'}
                              </p>
                              <button
                                onClick={() => handleRemoveAllocation(allocation)}
                                className="mt-2 rounded-lg py-1 px-3 text-xs font-semibold focus:outline-none transition-colors self-start"
                                style={{ border: '1px solid rgba(139,32,32,0.2)', color: '#8B2020', backgroundColor: 'transparent', fontFamily: OUTFIT }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.06)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                              >
                                REMOVE
                              </button>
                            </>
                          ) : (
                            <>
                              {slotSug && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Sparkles size={10} style={{ color: '#B6871F', flexShrink: 0 }} />
                                  <span className="truncate" style={{ fontSize: 10, color: '#B6871F', fontFamily: MONO, fontWeight: 500 }}>
                                    {slotSug.app.profiles?.display_name}
                                  </span>
                                </div>
                              )}
                              <div className="flex gap-1.5 mt-2">
                                {slotSug && (
                                  <button
                                    onClick={() => quickAssign(slotSug)}
                                    disabled={sugBusy}
                                    className="rounded-lg py-1 px-2.5 text-xs font-bold focus:outline-none transition-colors"
                                    style={{ backgroundColor: sugBusy ? '#DDD4C0' : '#1B3828', color: sugBusy ? '#9A8A78' : '#EED98A', border: 'none', fontFamily: OUTFIT }}
                                    onMouseEnter={e => { if (!sugBusy) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                                    onMouseLeave={e => { if (!sugBusy) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                                  >
                                    {sugBusy ? '...' : 'ACCEPT'}
                                  </button>
                                )}
                                <button
                                  onClick={() => setAssignModal({ preSlot: slot })}
                                  className="rounded-lg py-1 px-2.5 text-xs font-semibold focus:outline-none transition-colors"
                                  style={{ backgroundColor: 'rgba(27,56,40,0.07)', color: '#1B3828', border: 'none', fontFamily: OUTFIT }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.12)'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.07)'; }}
                                >
                                  ASSIGN
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === 'chairs' && selectedCommittee && (
            <div style={{ maxWidth: 560 }}>
              <p style={{ fontSize: 10, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.16em', fontWeight: 500, marginBottom: 12 }}>
                CURRENT CHAIRS
              </p>
              {currentChairs.length === 0 ? (
                <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                  No chairs assigned to {selectedCommittee.name} yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2 mb-6">
                  {currentChairs.map(ch => (
                    <div key={ch.userId} className="flex items-center justify-between rounded-xl p-3" style={{ backgroundColor: '#FAF8F3', border: '1px solid rgba(27,56,40,0.2)' }}>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{ch.name}</p>
                        {ch.email && <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{ch.email}</p>}
                      </div>
                      <button
                        onClick={() => handleRemoveChair(ch.userId, selectedCommittee)}
                        className="rounded-lg py-1 px-3 text-xs font-semibold focus:outline-none transition-colors flex-shrink-0"
                        style={{ border: '1px solid rgba(139,32,32,0.2)', color: '#8B2020', backgroundColor: 'transparent', fontFamily: OUTFIT }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.06)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        REMOVE
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 mb-3">
                <p style={{ fontSize: 10, color: '#B6871F', fontFamily: MONO, letterSpacing: '0.16em', fontWeight: 500 }}>
                  CHAIR APPLICANTS
                </p>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(27,56,40,0.1)', color: '#1B3828', fontFamily: MONO, fontSize: 10 }}>
                  {assignableChairs.length}
                </span>
              </div>
              {assignableChairs.length === 0 ? (
                <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                  No unassigned chair applicants. Accept a chair application first, or invite a chair directly (coming soon).
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {assignableChairs.map(ca => (
                    <div key={ca.id} className="flex items-center justify-between rounded-xl p-3" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>{ca.profiles?.display_name ?? 'Unknown'}</p>
                        <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>chair · {ca.experience_level ?? 'n/a'}</p>
                      </div>
                      <button
                        onClick={() => handleAssignChair(ca, selectedCommittee)}
                        className="rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors flex-shrink-0"
                        style={{ backgroundColor: '#1B3828', color: '#EED98A', border: 'none', fontFamily: OUTFIT }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                      >
                        ASSIGN AS CHAIR
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {assignModal && selectedCommittee && (
        <AssignModal
          committee={selectedCommittee}
          unassigned={accepted}
          roleConfigs={roleConfigs}
          preSelectedSlot={assignModal.preSlot}
          preSelectedApp={assignModal.preApp}
          onClose={() => setAssignModal(null)}
          onAssigned={loadData}
        />
      )}
    </div>
  );
}
