'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Copy, Search, Check } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { UN_COUNTRIES, getFlagUrl } from '@/lib/countries';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommitteeRow {
  id: string;
  name: string;
  abbreviation: string | null;
  topics: string[] | null;
  difficulty: string;
  committee_type: string;
  total_slots: number;
  session_code: string | null;
  session_id: string | null;
  pp_submissions_enabled: boolean;
  position_paper_deadline: string | null;
  notification_email: string | null;
}

// Mint a real, joinable session for a conference committee and link it back.
// committees/current_speaker carry a public read/write RLS policy, so the authed
// organizer client can write them directly. Generates a unique 6-char code,
// retrying on a code-uniqueness collision. Returns the code, or null on failure.
async function mintConferenceSession(
  supabase: ReturnType<typeof getAuthedClient>,
  confCommitteeId: string,
  name: string,
  topic: string,
): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const chairJoinSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    const { data: sessionRow, error: sErr } = await supabase
      .from('committees')
      .insert({
        code,
        name,
        topic: topic || 'TBD',
        chair_names: [],
        phase: 'pre-session',
        speaker_time_limit: 90,
        settings: { chairJoinSuffix, separateChairCode: true },
        session_origin: 'conference',
      })
      .select('id')
      .single();
    if (sErr) {
      if (sErr.code === '23505') continue; // code collision — try a new code
      console.error('Error minting conference session:', sErr);
      return null;
    }
    await supabase.from('current_speaker').insert({
      committee_id: sessionRow.id,
      delegate_id: null,
      country: null,
      time_remaining: 90,
    });
    await supabase
      .from('conference_committees')
      .update({ session_id: sessionRow.id, session_code: code })
      .eq('id', confCommitteeId);
    return code;
  }
  return null;
}

interface Committee extends CommitteeRow {
  slotCount: number;
}

interface SlotRow {
  id: string;
  country_code: string;
  country_name: string;
  delegation_size: number;
}

// ── Design constants ──────────────────────────────────────────────────────────

const DIFF_COLOR: Record<string, string> = {
  BEGINNER: '#3D7A52',
  INTERMEDIATE: '#B6871F',
  ADVANCED: '#8B2020',
  EXPERT: '#8B2020',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #DDD4C0',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  color: '#1C1410',
  backgroundColor: '#FAF8F3',
  outline: 'none',
  fontFamily: "'Outfit', sans-serif",
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: '#9A8A78',
  fontFamily: "'DM Mono', monospace",
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 4,
};

// ── Shared modal overlay ──────────────────────────────────────────────────────

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

// ── Difficulty toggle row (reused in Add + Edit) ──────────────────────────────

function DifficultyToggle({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap mt-1">
      {(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const).map(d => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className="focus:outline-none"
          style={{
            padding: '5px 12px',
            borderRadius: 8,
            fontSize: 10,
            fontFamily: "'DM Mono', monospace",
            fontWeight: 700,
            border: value === d ? 'none' : '1px solid #DDD4C0',
            backgroundColor: value === d ? DIFF_COLOR[d] : 'transparent',
            color: value === d ? 'white' : '#9A8A78',
            cursor: 'pointer',
            letterSpacing: '0.06em',
          }}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

// ── Committee form fields (shared) ────────────────────────────────────────────

interface FormState {
  name: string; setName: (v: string) => void;
  abbreviation: string; setAbbreviation: (v: string) => void;
  topic1: string; setTopic1: (v: string) => void;
  topic2: string; setTopic2: (v: string) => void;
  topic3: string; setTopic3: (v: string) => void;
  difficulty: string; setDifficulty: (v: string) => void;
  committeeType: string; setCommitteeType: (v: string) => void;
  totalSlots: string; setTotalSlots: (v: string) => void;
  notificationEmail: string; setNotificationEmail: (v: string) => void;
}

function CommitteeFormFields({ f }: { f: FormState }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label style={labelStyle}>Committee Name *</label>
        <input value={f.name} onChange={e => f.setName(e.target.value)} placeholder="e.g. UN Security Council" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Abbreviation</label>
        <input value={f.abbreviation} onChange={e => f.setAbbreviation(e.target.value)} placeholder="e.g. UNSC, UNHRC" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Topic 1</label>
        <input value={f.topic1} onChange={e => f.setTopic1(e.target.value)} placeholder="Enter topic..." style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Topic 2 (optional)</label>
        <input value={f.topic2} onChange={e => f.setTopic2(e.target.value)} placeholder="Enter topic..." style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Topic 3 (optional)</label>
        <input value={f.topic3} onChange={e => f.setTopic3(e.target.value)} placeholder="Enter topic..." style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Difficulty</label>
        <DifficultyToggle value={f.difficulty} onChange={f.setDifficulty} />
      </div>
      <div>
        <label style={labelStyle}>Committee Type</label>
        <select value={f.committeeType} onChange={e => f.setCommitteeType(e.target.value)} style={inputStyle}>
          {['General Assembly', 'Security Council', 'Specialised', 'Crisis', 'Other'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Total Delegate Slots</label>
        <input type="number" min={1} value={f.totalSlots} onChange={e => f.setTotalSlots(e.target.value)} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Notification Email</label>
        <input value={f.notificationEmail} onChange={e => f.setNotificationEmail(e.target.value)} placeholder="Leave blank to use your account email" type="email" style={inputStyle} />
      </div>
    </div>
  );
}

// ── AddCommitteeModal ─────────────────────────────────────────────────────────

function AddCommitteeModal({ conferenceId, onClose, onSaved }: {
  conferenceId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [topic1, setTopic1] = useState('');
  const [topic2, setTopic2] = useState('');
  const [topic3, setTopic3] = useState('');
  const [difficulty, setDifficulty] = useState('INTERMEDIATE');
  const [committeeType, setCommitteeType] = useState('General Assembly');
  const [totalSlots, setTotalSlots] = useState('40');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim()) { setError('Committee name is required.'); return; }
    setSaving(true);
    setError('');
    const topics = [topic1, topic2, topic3].filter(Boolean);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data: created, error: err } = await supabase.from('conference_committees').insert({
      conference_id: conferenceId,
      name: name.trim(),
      abbreviation: abbreviation.trim() || null,
      topics,
      difficulty,
      committee_type: committeeType,
      total_slots: parseInt(totalSlots) || 40,
      notification_email: notificationEmail.trim() || null,
    }).select('id').single();
    if (err || !created) { setSaving(false); setError(err?.message ?? 'Failed to create committee.'); return; }
    // Creating a committee mints its real, joinable session (GA and crisis alike).
    await mintConferenceSession(supabase, created.id, name.trim(), topics[0] ?? '');
    setSaving(false);
    onSaved();
    onClose();
  }

  const f: FormState = {
    name, setName, abbreviation, setAbbreviation,
    topic1, setTopic1, topic2, setTopic2, topic3, setTopic3,
    difficulty, setDifficulty, committeeType, setCommitteeType,
    totalSlots, setTotalSlots, notificationEmail, setNotificationEmail,
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-black text-lg" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Add Committee</h2>
          <button onClick={onClose} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={18} /></button>
        </div>
        <CommitteeFormFields f={f} />
        {error && <p className="text-xs mt-3" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{error}</p>}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}>
            CANCEL
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ backgroundColor: saving ? '#DDD4C0' : '#1B3828', color: saving ? '#9A8A78' : '#EED98A', fontFamily: "'Outfit', sans-serif" }}>
            {saving ? 'SAVING...' : 'ADD COMMITTEE'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── EditCommitteeModal ────────────────────────────────────────────────────────

function EditCommitteeModal({ committee, onClose, onSaved }: {
  committee: Committee;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAuth();
  const topics = committee.topics ?? [];
  const [name, setName] = useState(committee.name);
  const [abbreviation, setAbbreviation] = useState(committee.abbreviation ?? '');
  const [topic1, setTopic1] = useState(topics[0] ?? '');
  const [topic2, setTopic2] = useState(topics[1] ?? '');
  const [topic3, setTopic3] = useState(topics[2] ?? '');
  const [difficulty, setDifficulty] = useState(committee.difficulty);
  const [committeeType, setCommitteeType] = useState(committee.committee_type);
  const [totalSlots, setTotalSlots] = useState(String(committee.total_slots));
  const [notificationEmail, setNotificationEmail] = useState(committee.notification_email ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim()) { setError('Committee name is required.'); return; }
    setSaving(true);
    setError('');
    const topicsArr = [topic1, topic2, topic3].filter(Boolean);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { error: err } = await supabase.from('conference_committees').update({
      name: name.trim(),
      abbreviation: abbreviation.trim() || null,
      topics: topicsArr,
      difficulty,
      committee_type: committeeType,
      total_slots: parseInt(totalSlots) || 40,
      notification_email: notificationEmail.trim() || null,
    }).eq('id', committee.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
    onClose();
  }

  const f: FormState = {
    name, setName, abbreviation, setAbbreviation,
    topic1, setTopic1, topic2, setTopic2, topic3, setTopic3,
    difficulty, setDifficulty, committeeType, setCommitteeType,
    totalSlots, setTotalSlots, notificationEmail, setNotificationEmail,
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-black text-lg" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Edit Committee</h2>
          <button onClick={onClose} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={18} /></button>
        </div>
        <CommitteeFormFields f={f} />
        {error && <p className="text-xs mt-3" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{error}</p>}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}>
            CANCEL
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ backgroundColor: saving ? '#DDD4C0' : '#1B3828', color: saving ? '#9A8A78' : '#EED98A', fontFamily: "'Outfit', sans-serif" }}>
            {saving ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── CountrySlotsModal ─────────────────────────────────────────────────────────

function CountrySlotsModal({ committee, onClose }: {
  committee: Committee;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [search, setSearch] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(true);

  const loadSlots = useCallback(async () => {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('committee_country_slots')
      .select('id, country_code, country_name, delegation_size')
      .eq('conference_committee_id', committee.id)
      .order('country_name', { ascending: true });
    setSlots((data ?? []) as SlotRow[]);
    setLoadingSlots(false);
  }, [committee.id]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const addedCodes = new Set(slots.map(s => s.country_code));
  const filteredCountries = UN_COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAddCountry(code: string, name: string) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('committee_country_slots').insert({
      conference_committee_id: committee.id,
      country_code: code,
      country_name: name,
      delegation_size: 1,
    });
    await loadSlots();
  }

  async function handleRemoveSlot(slotId: string) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('committee_country_slots').delete().eq('id', slotId);
    await loadSlots();
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-2xl rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            {committee.name} — Countries
          </h2>
          <button onClick={onClose} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={18} /></button>
        </div>

        <div className="flex gap-6">
          {/* Left: current countries */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold mb-3" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em' }}>
              {slots.length} COUNTRIES ADDED
            </p>
            {loadingSlots ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm py-4" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>No countries added yet.</p>
            ) : (
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {slots.map(slot => (
                  <div key={slot.id} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid #F0EDE6' }}>
                    <img src={getFlagUrl(slot.country_code)} style={{ width: 24, height: 17, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} alt={slot.country_name} />
                    <span className="flex-1 text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{slot.country_name}</span>
                    <span className="text-xs" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>×{slot.delegation_size}</span>
                    <button
                      onClick={() => handleRemoveSlot(slot.id)}
                      className="focus:outline-none ml-1 transition-colors"
                      style={{ color: '#9A8A78' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: add countries */}
          <div style={{ width: 240, flexShrink: 0 }}>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-2" style={{ border: '1px solid #DDD4C0' }}>
              <Search size={14} style={{ color: '#9A8A78', flexShrink: 0 }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search countries..."
                className="flex-1 text-sm outline-none"
                style={{ backgroundColor: 'transparent', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
              />
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {filteredCountries.map(c => {
                const added = addedCodes.has(c.code);
                return (
                  <div
                    key={c.code}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors"
                    style={{ cursor: added ? 'default' : 'pointer' }}
                    onClick={() => { if (!added) handleAddCountry(c.code, c.name); }}
                    onMouseEnter={e => { if (!added) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <img src={getFlagUrl(c.code)} style={{ width: 20, height: 14, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }} alt={c.name} />
                    <span className="flex-1 text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{c.name}</span>
                    {added && <Check size={12} style={{ color: '#3D7A52', flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-5">
          <button
            onClick={onClose}
            className="rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none transition-colors"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            DONE
          </button>
        </div>
      </div>
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
  const [editingCommittee, setEditingCommittee] = useState<Committee | null>(null);
  const [slotsCommittee, setSlotsCommittee] = useState<Committee | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const loadCommittees = useCallback(async () => {
    if (!conference) return;
    setLoading(true);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('conference_committees')
      .select('id, name, abbreviation, topics, difficulty, committee_type, total_slots, session_code, session_id, position_paper_deadline, notification_email, pp_submissions_enabled')
      .eq('conference_id', conference.id)
      .order('name', { ascending: true });

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

    setCommittees(rows.map((c, i) => ({ ...c, slotCount: slotCounts[i] })));
    setLoading(false);
  }, [conference]);

  useEffect(() => { loadCommittees(); }, [loadCommittees]);

  async function togglePPSubmissions(committeeId: string, current: boolean) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase
      .from('conference_committees')
      .update({ pp_submissions_enabled: !current })
      .eq('id', committeeId);
    await loadCommittees();
  }

  async function generateSessionCode(committee: CommitteeRow) {
    if (!session) return;
    if (committee.session_id) return; // already linked to a real session
    const supabase = getAuthedClient(session.access_token);
    await mintConferenceSession(supabase, committee.id, committee.name, (committee.topics ?? [])[0] ?? '');
    await loadCommittees();
  }

  function handleCopyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  if (!conference) return null;

  return (
    <div className="px-6 md:px-10 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs mb-1" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
            {conference.acronym} / Committees
          </p>
          <h1 className="font-black text-2xl" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            Committees
          </h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-xl py-2.5 px-5 font-bold text-sm focus:outline-none transition-colors"
          style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
        >
          <Plus size={15} />
          ADD COMMITTEE
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      )}

      {!loading && committees.length === 0 && (
        <div className="text-center py-16">
          <p className="font-semibold text-base mb-1" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>No committees yet</p>
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>Add your first committee to get started.</p>
        </div>
      )}

      {!loading && committees.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {committees.map(c => {
            const diffColor = DIFF_COLOR[c.difficulty] ?? '#9A8A78';
            const topics = c.topics ?? [];
            const ghostBtn: React.CSSProperties = { border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" };
            return (
              <div
                key={c.id}
                className="rounded-2xl overflow-hidden transition-colors"
                style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
              >
                {/* Difficulty strip */}
                <div style={{ height: 5, backgroundColor: diffColor }} />

                <div className="p-5">
                  {/* Row 1: name + difficulty badge */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-base" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{c.name}</p>
                    <span
                      className="flex-shrink-0 px-2 py-0.5 rounded-full font-bold"
                      style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", backgroundColor: `${diffColor}20`, color: diffColor, letterSpacing: '0.06em', marginTop: 2 }}
                    >
                      {c.difficulty}
                    </span>
                  </div>

                  {c.abbreviation && (
                    <p className="mt-0.5 text-xs" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>{c.abbreviation}</p>
                  )}

                  {topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {topics.map((t, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full" style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", backgroundColor: 'rgba(27,56,40,0.07)', color: '#1B3828' }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats row */}
                  <div className="flex flex-wrap items-center gap-4 mt-3 pt-3" style={{ borderTop: '1px solid #F0EDE6' }}>
                    <span className="text-xs" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
                      {c.slotCount} countries
                    </span>
                    {c.session_code && (
                      <button
                        onClick={() => handleCopyCode(c.session_code!)}
                        className="flex items-center gap-1 focus:outline-none"
                        style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", fontSize: 12, cursor: 'pointer' }}
                      >
                        {copiedCode === c.session_code ? (
                          <>
                            <Check size={11} style={{ color: '#3D7A52' }} />
                            <span style={{ color: '#3D7A52' }}>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            {c.session_code}
                          </>
                        )}
                      </button>
                    )}
                    {c.position_paper_deadline && (
                      <span className="text-xs" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
                        PP due {new Date(c.position_paper_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>

                  {/* PP Submissions toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid #EDE7D8' }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Position Paper Submissions</p>
                      <p style={{ fontSize: 11, color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>Allow delegates to submit position papers</p>
                    </div>
                    <button
                      onClick={() => togglePPSubmissions(c.id, c.pp_submissions_enabled)}
                      className="focus:outline-none flex-shrink-0"
                      style={{
                        width: 40, height: 22, borderRadius: 9999, border: 'none', cursor: 'pointer',
                        backgroundColor: c.pp_submissions_enabled ? '#1B3828' : '#DDD4C0',
                        position: 'relative', transition: 'background-color 0.2s', marginLeft: 12,
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 3, left: c.pp_submissions_enabled ? 21 : 3,
                        width: 16, height: 16, borderRadius: '50%', backgroundColor: '#FAF8F3',
                        transition: 'left 0.2s',
                      }} />
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() => setEditingCommittee(c)}
                      className="rounded-lg py-1.5 px-4 text-xs font-semibold focus:outline-none transition-colors"
                      style={ghostBtn}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                      EDIT
                    </button>
                    <button
                      onClick={() => setSlotsCommittee(c)}
                      className="rounded-lg py-1.5 px-4 text-xs font-semibold focus:outline-none transition-colors"
                      style={ghostBtn}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                      COUNTRIES
                    </button>
                    {!c.session_code && (
                      <button
                        onClick={() => generateSessionCode(c)}
                        className="rounded-lg py-1.5 px-4 text-xs font-semibold focus:outline-none transition-colors"
                        style={ghostBtn}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        GENERATE CODE
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddCommitteeModal
          conferenceId={conference.id}
          onClose={() => setShowAdd(false)}
          onSaved={loadCommittees}
        />
      )}
      {editingCommittee && (
        <EditCommitteeModal
          committee={editingCommittee}
          onClose={() => setEditingCommittee(null)}
          onSaved={loadCommittees}
        />
      )}
      {slotsCommittee && (
        <CountrySlotsModal
          committee={slotsCommittee}
          onClose={() => setSlotsCommittee(null)}
        />
      )}
    </div>
  );
}
