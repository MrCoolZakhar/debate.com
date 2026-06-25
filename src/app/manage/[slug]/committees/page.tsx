'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Copy, Check } from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { getCountryByName } from '@/lib/countries';
import { CountryMatrixPicker } from '@/components/CountryMatrixPicker';
import { CommitteeNameInput } from '@/components/CommitteeNameInput';

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
  countries: string[],
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
    if (countries.length > 0) {
      await supabase.from('delegates').insert(
        countries.map((country) => ({ committee_id: sessionRow.id, country, status: 'absent' }))
      );
    }
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
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

// ── CommitteeEditor (create + edit) ───────────────────────────────────────────

function CommitteeEditor({ conferenceId, committeeType, existing, onClose, onSaved }: {
  conferenceId: string;
  committeeType: 'general-assembly' | 'crisis';
  existing?: CommitteeRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAuth();
  const isEdit = !!existing;
  const isCrisis = (existing ? existing.committee_type : committeeType) === 'crisis';
  const [name, setName] = useState(existing?.name ?? '');
  const [abbreviation, setAbbreviation] = useState(existing?.abbreviation ?? '');
  const [topics, setTopics] = useState<string[]>(existing?.topics ?? []);
  const [topicInput, setTopicInput] = useState('');
  const [difficulty, setDifficulty] = useState(existing?.difficulty ?? 'intermediate');
  const [countries, setCountries] = useState<string[]>([]);
  const [initialCountries, setInitialCountries] = useState<string[]>([]);
  const [loadingMatrix, setLoadingMatrix] = useState<boolean>(!!existing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!existing || !session) return;
    let cancelled = false;
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data } = await supabase
        .from('committee_country_slots')
        .select('country_name')
        .eq('conference_committee_id', existing.id);
      if (cancelled) return;
      const names = (data ?? []).map((r: { country_name: string }) => r.country_name);
      setCountries(names);
      setInitialCountries(names);
      setLoadingMatrix(false);
    })();
    return () => { cancelled = true; };
  }, [existing, session]);

  function addTopic() {
    const t = topicInput.trim();
    if (!t || topics.length >= 3 || topics.includes(t)) return;
    setTopics([...topics, t]);
    setTopicInput('');
  }

  async function doCreate(supabase: ReturnType<typeof getAuthedClient>): Promise<boolean> {
    const { data: created, error: err } = await supabase.from('conference_committees').insert({
      conference_id: conferenceId,
      name: name.trim(),
      abbreviation: abbreviation.trim() || null,
      topics,
      difficulty,
      committee_type: committeeType,
      total_slots: countries.length,
      notification_email: null,
    }).select('id').single();
    if (err || !created) { setError(err?.message ?? 'Failed to create committee.'); return false; }
    await supabase.from('committee_country_slots').insert(
      countries.map((country) => ({
        conference_committee_id: created.id,
        country_code: getCountryByName(country)?.code ?? country,
        country_name: country,
        delegation_size: 1,
      }))
    );
    await mintConferenceSession(supabase, created.id, name.trim(), topics[0] ?? '', countries);
    return true;
  }

  async function doEdit(supabase: ReturnType<typeof getAuthedClient>): Promise<boolean> {
    const ex = existing!;
    const added = countries.filter(c => !initialCountries.includes(c));
    const removed = initialCountries.filter(c => !countries.includes(c));

    if (removed.length > 0) {
      const { data: allocs } = await supabase
        .from('conference_allocations')
        .select('id')
        .eq('conference_committee_id', ex.id)
        .in('country_name', removed);
      const n = allocs?.length ?? 0;
      if (n > 0) {
        const ok = window.confirm(
          n + ' of the ' + (isCrisis ? 'characters' : 'countries') + ' you removed ' + (n === 1 ? 'has' : 'have') +
          ' an allocated delegate. Removing ' + (n === 1 ? 'it' : 'them') + ' will return ' +
          (n === 1 ? 'that delegate' : 'those delegates') + ' to the allocation pool. Proceed?'
        );
        if (!ok) return false;
        await supabase.from('conference_allocations').delete().eq('conference_committee_id', ex.id).in('country_name', removed);
      }
    }

    if (removed.length > 0) {
      await supabase.from('committee_country_slots').delete().eq('conference_committee_id', ex.id).in('country_name', removed);
      if (ex.session_id) {
        await supabase.from('delegates').delete().eq('committee_id', ex.session_id).in('country', removed);
      }
    }
    if (added.length > 0) {
      await supabase.from('committee_country_slots').insert(
        added.map((country) => ({
          conference_committee_id: ex.id,
          country_code: getCountryByName(country)?.code ?? country,
          country_name: country,
          delegation_size: 1,
        }))
      );
      if (ex.session_id) {
        await supabase.from('delegates').insert(
          added.map((country) => ({ committee_id: ex.session_id, country, status: 'absent' }))
        );
      }
    }
    await supabase.from('conference_committees').update({
      name: name.trim(),
      abbreviation: abbreviation.trim() || null,
      topics,
      difficulty,
      total_slots: countries.length,
    }).eq('id', ex.id);
    if (ex.session_id) {
      await supabase.from('committees').update({ name: name.trim(), topic: topics[0] ?? 'TBD' }).eq('id', ex.session_id);
    }
    return true;
  }

  async function handleSave() {
    if (!name.trim()) { setError('Committee name is required.'); return; }
    if (topics.length === 0) { setError('Add at least one topic.'); return; }
    if (countries.length === 0) { setError(isCrisis ? 'Add at least one character.' : 'Add at least one country.'); return; }
    if (!session) return;
    setSaving(true); setError('');
    const supabase = getAuthedClient(session.access_token);
    const ok = isEdit ? await doEdit(supabase) : await doCreate(supabase);
    setSaving(false);
    if (!ok) return;
    onSaved();
    onClose();
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-2xl rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-end mb-2">
          <button onClick={onClose} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label style={labelStyle}>Committee Name *</label>
            {(!isCrisis && !isEdit) ? (
              <CommitteeNameInput
                value={name}
                onChange={setName}
                onPresetSelect={(p) => { setName(p.name); setAbbreviation(p.acronym); setCountries(p.members); }}
              />
            ) : (
              <input value={name} onChange={e => setName(e.target.value)} placeholder={isCrisis ? 'e.g. The Cuban Missile Crisis, 1962' : 'e.g. UN Security Council'} style={inputStyle} />
            )}
          </div>
          <div>
            <label style={labelStyle}>Difficulty</label>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)} style={inputStyle}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Topics * (at least one, up to 3)</label>
            <div className="flex gap-2">
              <input value={topicInput} onChange={e => setTopicInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }} placeholder="Type a topic..." style={{ ...inputStyle, flex: 1 }} disabled={topics.length >= 3} />
              <button onClick={addTopic} disabled={topics.length >= 3} className="rounded-xl px-4 font-bold text-sm focus:outline-none" style={{ backgroundColor: topics.length >= 3 ? '#DDD4C0' : '#1B3828', color: topics.length >= 3 ? '#9A8A78' : '#EED98A', fontFamily: "'Outfit', sans-serif", whiteSpace: 'nowrap' }}>Add topic</button>
            </div>
            {topics.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {topics.map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs" style={{ backgroundColor: '#EDE7D8', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                    {t}
                    <button onClick={() => setTopics(topics.filter((_, j) => j !== i))} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 pt-5" style={{ borderTop: '1px solid #EDE7D8' }}>
          <p className="text-xs font-semibold mb-3" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {isCrisis ? 'Committee Characters' : 'Committee Countries'}
          </p>
          {loadingMatrix ? (
            <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>Loading current matrix…</p>
          ) : (
            <CountryMatrixPicker value={countries} onChange={setCountries} noun={isCrisis ? 'character' : 'country'} />
          )}
        </div>
        {error && <p className="text-xs mt-3" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{error}</p>}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}>CANCEL</button>
          <button onClick={handleSave} disabled={saving || loadingMatrix} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ backgroundColor: (saving || loadingMatrix) ? '#DDD4C0' : '#1B3828', color: (saving || loadingMatrix) ? '#9A8A78' : '#EED98A', fontFamily: "'Outfit', sans-serif" }}>{saving ? 'SAVING...' : (isEdit ? 'SAVE CHANGES' : 'ADD COMMITTEE')}</button>
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
  const [pendingType, setPendingType] = useState<'general-assembly' | 'crisis' | null>(null);
  const [editingCommittee, setEditingCommittee] = useState<Committee | null>(null);
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
    await mintConferenceSession(supabase, committee.id, committee.name, (committee.topics ?? [])[0] ?? '', []);
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
          onClick={() => { setPendingType(null); setShowAdd(true); }}
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
            const diffColor = DIFF_COLOR[c.difficulty.toUpperCase()] ?? '#9A8A78';
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

      {showAdd && !pendingType && (
        <ModalOverlay onClose={() => setShowAdd(false)}>
          <div className="rounded-2xl p-8 flex flex-col items-center gap-5" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 360 }}>
            <div className="w-full flex justify-end">
              <button onClick={() => setShowAdd(false)} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={18} /></button>
            </div>
            <p className="text-xs font-semibold text-center" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>Choose committee type</p>
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => setPendingType('general-assembly')}
                className="w-full rounded-xl py-4 font-black text-base focus:outline-none transition-colors"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.04em' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                GENERAL ASSEMBLY
              </button>
              <button
                onClick={() => setPendingType('crisis')}
                className="w-full rounded-xl py-4 font-black text-base focus:outline-none transition-colors"
                style={{ border: '2px solid #1B3828', color: '#1B3828', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.04em' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                CRISIS
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
      {showAdd && pendingType && (
        <CommitteeEditor
          conferenceId={conference.id}
          committeeType={pendingType}
          onClose={() => { setShowAdd(false); setPendingType(null); }}
          onSaved={() => { setShowAdd(false); setPendingType(null); loadCommittees(); }}
        />
      )}
      {editingCommittee && (
        <CommitteeEditor
          conferenceId={conference.id}
          committeeType={editingCommittee.committee_type === 'crisis' ? 'crisis' : 'general-assembly'}
          existing={editingCommittee}
          onClose={() => setEditingCommittee(null)}
          onSaved={() => { setEditingCommittee(null); loadCommittees(); }}
        />
      )}
    </div>
  );
}
