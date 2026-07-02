'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Check } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { getFlagUrl } from '@/lib/countries';

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
  profiles: { id: string; display_name: string; email: string; nationality: string | null } | null;
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

interface SlotRow {
  id: string;
  country_code: string;
  country_name: string;
  delegation_size: number;
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

// ── Fit score ─────────────────────────────────────────────────────────────────

function calcFitScore(app: AcceptedApp, committeeId: string, committeeDifficulty: string): number {
  let score = 0;
  const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order);
  const matchIdx = prefs.findIndex(p => p.conference_committee_id === committeeId);
  if (matchIdx === 0) score += 3;
  else if (matchIdx === 1) score += 2;
  else if (matchIdx === 2) score += 1;
  const exp = (app.experience_level ?? '').toLowerCase();
  const diff = committeeDifficulty.toLowerCase();
  if (exp && diff && exp === diff) score += 1;
  return score;
}

function fitColor(score: number) {
  if (score >= 4) return '#3D7A52';
  if (score >= 2) return '#B6871F';
  return '#9A8A78';
}

// ── ModalOverlay ──────────────────────────────────────────────────────────────

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

  // Sort unassigned by fit score desc
  const sortedApps = [...unassigned].sort((a, b) => calcFitScore(b, committee.id, committee.difficulty) - calcFitScore(a, committee.id, committee.difficulty));

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

  const appFitScore = selectedApp ? calcFitScore(selectedApp, committee.id, committee.difficulty) : null;
  const appPrefs = selectedApp
    ? [...(selectedApp.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order)
    : [];

  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-black text-base" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            Assign Delegate
          </h2>
          <button onClick={onClose} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={18} /></button>
        </div>

        <p className="text-xs font-semibold mb-2" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em' }}>
          COMMITTEE
        </p>
        <p className="text-sm font-semibold mb-4" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
          {committee.name}
        </p>

        {/* Applicant picker (if not pre-selected) */}
        <div className="mb-4">
          <p className="text-xs font-semibold mb-2" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em' }}>APPLICANT</p>
          {preSelectedApp ? (
            <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(27,56,40,0.05)', border: '1px solid rgba(27,56,40,0.15)' }}>
              <p className="font-semibold text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{preSelectedApp.profiles?.display_name}</p>
              <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{preSelectedApp.role} · {preSelectedApp.experience_level ?? 'n/a'}</p>
            </div>
          ) : (
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #DDD4C0', borderRadius: 12 }}>
              {sortedApps.length === 0 ? (
                <p className="text-sm p-3" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>No unassigned applicants.</p>
              ) : sortedApps.map((app, idx) => {
                const score = calcFitScore(app, committee.id, committee.difficulty);
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
                      <p className="text-sm font-semibold truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{app.profiles?.display_name}</p>
                      <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{app.role} · {app.experience_level ?? 'n/a'}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {blocked ? (
                        <span style={{ fontSize: 9, color: '#B8844A', fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>PENDING PAYMENT</span>
                      ) : (
                        <>
                          {idx < 3 && score >= 2 && (
                            <span style={{ fontSize: 9, color: '#B6871F', fontFamily: "'DM Mono', monospace" }}>★ BEST</span>
                          )}
                          <span style={{ fontSize: 10, fontWeight: 700, color: fitColor(score), fontFamily: "'DM Mono', monospace" }}>{score}</span>
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
            <p className="text-xs font-semibold mb-1" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em' }}>PREFERENCES</p>
            <div className="flex flex-col gap-1">
              {appPrefs.slice(0, 3).map(p => (
                <p key={p.preference_order} className="text-xs" style={{ color: p.conference_committee_id === committee.id ? '#1B3828' : '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                  {p.preference_order}. {p.conference_committees?.name ?? 'Unknown'} — {p.country_name}
                  {p.conference_committee_id === committee.id && ' ✓'}
                </p>
              ))}
            </div>
            {appFitScore !== null && (
              <p className="text-xs mt-1 font-bold" style={{ color: fitColor(appFitScore), fontFamily: "'DM Mono', monospace" }}>
                FIT SCORE: {appFitScore}/4
              </p>
            )}
          </div>
        )}

        {/* Country picker */}
        <div className="mb-5">
          <p className="text-xs font-semibold mb-2" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em' }}>COUNTRY</p>
          {preSelectedSlot ? (
            <div className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: 'rgba(27,56,40,0.05)', border: '1px solid rgba(27,56,40,0.15)' }}>
              <img src={getFlagUrl(preSelectedSlot.country_code)} style={{ width: 24, height: 17, borderRadius: 3, objectFit: 'cover' }} alt={preSelectedSlot.country_name} />
              <p className="text-sm font-semibold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{preSelectedSlot.country_name}</p>
            </div>
          ) : (
            <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #DDD4C0', borderRadius: 12 }}>
              {emptySlots.length === 0 ? (
                <p className="text-sm p-3" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>All slots filled.</p>
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
                    <p className="text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{slot.country_name}</p>
                    {selected && <Check size={13} style={{ color: '#3D7A52', marginLeft: 'auto' }} />}
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
          <span className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            Send allocation email immediately after assigning
          </span>
        </label>

        {error && <p className="text-xs mb-3" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}>
            CANCEL
          </button>
          <button
            onClick={handleAssign}
            disabled={saving || !selectedApp || !selectedSlot}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none"
            style={{
              backgroundColor: saving || !selectedApp || !selectedSlot ? '#DDD4C0' : '#1B3828',
              color: saving || !selectedApp || !selectedSlot ? '#9A8A78' : '#EED98A',
              fontFamily: "'Outfit', sans-serif",
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
  const { session } = useAuth();
  const [accepted, setAccepted] = useState<AcceptedApp[]>([]);
  const [committees, setCommittees] = useState<CommitteeData[]>([]);
  const [roleConfigs, setRoleConfigs] = useState<RoleConfigLite[]>([]);
  const [chairApps, setChairApps] = useState<ChairApp[]>([]);
  const [mode, setMode] = useState<'delegates' | 'chairs'>('delegates');
  const [loading, setLoading] = useState(true);
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [assignModal, setAssignModal] = useState<{
    preSlot?: SlotRow;
    preApp?: AcceptedApp;
  } | null>(null);
  const [sendingAll, setSendingAll] = useState(false);

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
          profiles (id, display_name, email, nationality),
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
          committee_country_slots (id, country_code, country_name, delegation_size),
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
  }, [conference, selectedCommitteeId, session?.access_token]);

  useEffect(() => { loadData(); }, [loadData]);

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

  async function handleRemoveAllocation(allocation: AllocationRow, committeeId: string) {
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

  if (!conference) return null;

  const selectedCommittee = committees.find(c => c.id === selectedCommitteeId) ?? null;

  const allocatedCodes = new Set(selectedCommittee?.conference_allocations.map(a => a.country_code) ?? []);

  const unassignedForCommittee = accepted.filter(app => {
    const name = app.profiles?.display_name ?? '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  // Compute fit scores and top 3
  const withScores = unassignedForCommittee.map(app => ({
    app,
    score: selectedCommittee ? calcFitScore(app, selectedCommittee.id, selectedCommittee.difficulty) : 0,
  }));
  withScores.sort((a, b) => b.score - a.score);
  const top3Ids = new Set(withScores.slice(0, 3).filter(x => x.score >= 2).map(x => x.app.id));

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
          <p className="text-xs mb-1" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
            {conference.acronym} / Assignment
          </p>
          <h1 className="font-black text-2xl" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Assignment</h1>
        </div>
        {mode === 'delegates' && (
          <button
            onClick={handleSendAllAllocations}
            disabled={sendingAll}
            className="rounded-xl py-2.5 px-5 font-bold text-sm focus:outline-none transition-colors"
            style={{ backgroundColor: sendingAll ? '#DDD4C0' : '#1B3828', color: sendingAll ? '#9A8A78' : '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}
            onMouseEnter={e => { if (!sendingAll) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={e => { if (!sendingAll) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            {sendingAll ? 'SENDING...' : 'SEND ALL ALLOCATIONS'}
          </button>
        )}
      </div>

      {/* Mode toggle: Delegates | Chairs (Phase 2 #2b) */}
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
              fontFamily: "'DM Mono', monospace",
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

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      )}

      {!loading && committees.length === 0 && (
        <div className="text-center py-16">
          <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>No committees yet</p>
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>Add committees first before assigning delegates.</p>
        </div>
      )}

      {!loading && committees.length > 0 && (
        <>
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
                    fontFamily: "'DM Mono', monospace",
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
              <div style={{ width: 320, flexShrink: 0 }}>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-semibold tracking-widest" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
                    UNASSIGNED
                  </p>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: 'rgba(27,56,40,0.1)', color: '#1B3828', fontFamily: "'DM Mono', monospace", fontSize: 10 }}
                  >
                    {unassignedForCommittee.length}
                  </span>
                </div>

                {/* Search */}
                <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3" style={{ border: '1px solid #DDD4C0' }}>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search applicants..."
                    className="flex-1 text-sm outline-none"
                    style={{ backgroundColor: 'transparent', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                  />
                </div>

                {unassignedForCommittee.length === 0 ? (
                  <p className="text-sm py-6 text-center" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                    {accepted.length === 0 ? 'No accepted applicants yet.' : 'No applicants match your search.'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {withScores.map(({ app, score }) => {
                      const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order);
                      const commPrefs = prefs.filter(p => p.conference_committee_id === selectedCommittee.id);
                      const isBest = top3Ids.has(app.id);
                      const blocked = isAllocationBlocked(app, roleConfigs);
                      return (
                        <div
                          key={app.id}
                          className="rounded-xl p-3 transition-colors"
                          style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', cursor: blocked ? 'not-allowed' : 'pointer', opacity: blocked ? 0.6 : 1 }}
                          onClick={() => { if (!blocked) setAssignModal({ preApp: app }); }}
                          onMouseEnter={e => { if (!blocked) (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                                {app.profiles?.display_name ?? 'Unknown'}
                              </p>
                              <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                                {app.role} · {app.experience_level ?? 'n/a'}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              {blocked ? (
                                <span style={{ fontSize: 9, color: '#B8844A', fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>PENDING PAYMENT</span>
                              ) : (
                                <>
                                  {isBest && (
                                    <span style={{ fontSize: 9, color: '#B6871F', fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>★ BEST FIT</span>
                                  )}
                                  <span style={{ fontSize: 11, fontWeight: 700, color: fitColor(score), fontFamily: "'DM Mono', monospace" }}>
                                    {score}/4
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
                                  style={{ fontSize: 9, backgroundColor: 'rgba(27,56,40,0.1)', color: '#1B3828', fontFamily: "'DM Mono', monospace" }}
                                >
                                  #{p.preference_order} {p.country_name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right panel — country slots */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-base" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                    {selectedCommittee.name}
                  </p>
                  <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
                    {totalSlots} slots · {filledCount} filled
                  </p>
                </div>

                {selectedCommittee.committee_country_slots.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>No country slots configured for this committee.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedCommittee.committee_country_slots.map(slot => {
                      const allocation = selectedCommittee.conference_allocations.find(a => a.country_code === slot.country_code);
                      const filled = !!allocation;
                      return (
                        <div
                          key={slot.id}
                          className="rounded-xl p-3 flex flex-col"
                          style={{ backgroundColor: '#FAF8F3', border: `1px solid ${filled ? 'rgba(27,56,40,0.2)' : '#DDD4C0'}` }}
                        >
                          <img
                            src={getFlagUrl(slot.country_code)}
                            style={{ width: 28, height: 20, borderRadius: 4, objectFit: 'cover' }}
                            alt={slot.country_name}
                          />
                          <p className="font-medium text-sm mt-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                            {slot.country_name}
                          </p>
                          {filled && allocation ? (
                            <>
                              <p className="text-xs font-semibold mt-0.5" style={{ color: '#3D7A52', fontFamily: "'Outfit', sans-serif" }}>
                                {allocation.profiles?.display_name ?? 'Assigned'}
                              </p>
                              <button
                                onClick={() => handleRemoveAllocation(allocation, selectedCommittee.id)}
                                className="mt-2 rounded-lg py-1 px-3 text-xs font-semibold focus:outline-none transition-colors self-start"
                                style={{ border: '1px solid rgba(139,32,32,0.2)', color: '#8B2020', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.06)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                              >
                                REMOVE
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setAssignModal({ preSlot: slot })}
                              className="mt-2 rounded-lg py-1 px-3 text-xs font-semibold focus:outline-none transition-colors self-start"
                              style={{ backgroundColor: 'rgba(27,56,40,0.07)', color: '#1B3828', border: 'none', fontFamily: "'Outfit', sans-serif" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.12)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.07)'; }}
                            >
                              ASSIGN →
                            </button>
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
              <p className="text-xs font-semibold tracking-widest mb-3" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
                CURRENT CHAIRS
              </p>
              {currentChairs.length === 0 ? (
                <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                  No chairs assigned to {selectedCommittee.name} yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2 mb-6">
                  {currentChairs.map(ch => (
                    <div key={ch.userId} className="flex items-center justify-between rounded-xl p-3" style={{ backgroundColor: '#FAF8F3', border: '1px solid rgba(27,56,40,0.2)' }}>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{ch.name}</p>
                        {ch.email && <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{ch.email}</p>}
                      </div>
                      <button
                        onClick={() => handleRemoveChair(ch.userId, selectedCommittee)}
                        className="rounded-lg py-1 px-3 text-xs font-semibold focus:outline-none transition-colors flex-shrink-0"
                        style={{ border: '1px solid rgba(139,32,32,0.2)', color: '#8B2020', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}
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
                <p className="text-xs font-semibold tracking-widest" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
                  CHAIR APPLICANTS
                </p>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(27,56,40,0.1)', color: '#1B3828', fontFamily: "'DM Mono', monospace", fontSize: 10 }}>
                  {assignableChairs.length}
                </span>
              </div>
              {assignableChairs.length === 0 ? (
                <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                  No unassigned chair applicants. Accept a chair application first, or invite a chair directly (coming soon).
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {assignableChairs.map(ca => (
                    <div key={ca.id} className="flex items-center justify-between rounded-xl p-3" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{ca.profiles?.display_name ?? 'Unknown'}</p>
                        <p className="text-xs truncate" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>chair · {ca.experience_level ?? 'n/a'}</p>
                      </div>
                      <button
                        onClick={() => handleAssignChair(ca, selectedCommittee)}
                        className="rounded-lg py-1.5 px-4 text-xs font-bold focus:outline-none transition-colors flex-shrink-0"
                        style={{ backgroundColor: '#1B3828', color: '#EED98A', border: 'none', fontFamily: "'Outfit', sans-serif" }}
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
