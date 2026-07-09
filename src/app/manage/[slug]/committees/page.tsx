'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Copy, Check, Building2, Globe, CalendarClock, Trash2, Users, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
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
  logo_url: string | null;
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

// Same recipe as the public conference detail page committee cards.
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

const DIFFICULTY_STYLES: Record<string, { backgroundColor: string; color: string }> = {
  beginner:     { backgroundColor: 'rgba(61,122,82,0.13)',   color: '#2A5A3C' },
  intermediate: { backgroundColor: 'rgba(238,217,138,0.35)', color: '#8A6614' },
  advanced:     { backgroundColor: 'rgba(184,132,74,0.16)',  color: '#B8844A' },
  expert:       { backgroundColor: 'rgba(139,32,32,0.1)',    color: '#8B2020' },
};

const DIFF_ORDER: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2, expert: 3 };

const ROMAN = ['I', 'II', 'III'];

const EASE = 'cubic-bezier(0.22,1,0.36,1)';

// Fallback emblem — gradient monogram disc with grain, matching the public card.
function MonogramMedallion({ text, isCrisis, size }: { text: string; isCrisis: boolean; size: number }) {
  const monogram = text.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || '—';
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: '9999px',
        background: isCrisis
          ? 'linear-gradient(135deg, #3C1414 0%, #6E1E1E 100%)'
          : 'linear-gradient(135deg, #16301F 0%, #2A5A3C 100%)',
        boxShadow: '0 10px 24px rgba(27,56,40,0.26)',
      }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.12 }} />
      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: monogram.length > 4 ? Math.round(size * 0.135) : Math.round(size * 0.167), fontWeight: 700, color: '#EED98A', letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums' }}>
        {monogram}
      </span>
    </div>
  );
}

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
  fontWeight: 700,
  color: '#6E5F4E',
  fontFamily: "'Outfit', sans-serif",
  letterSpacing: '0.01em',
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

function CommitteeEditor({ conferenceId, committeeType, existing, initialCountries, onClose, onSaved }: {
  conferenceId: string;
  committeeType: 'general-assembly' | 'crisis';
  existing?: CommitteeRow | null;
  initialCountries?: string[];
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
  const [countries, setCountries] = useState<string[]>(initialCountries ?? []);
  const [baselineCountries] = useState<string[]>(initialCountries ?? []);
  const [pendingRemovalCount, setPendingRemovalCount] = useState<number | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(existing?.logo_url ?? null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Mirrors the conference logo upload in manage/[slug]/settings — same bucket, own folder.
  async function handleEmblemUpload(file: File) {
    if (!session) return;
    if (file.size > 5 * 1024 * 1024) { setError('Emblem must be under 5MB.'); return; }
    setLogoUploading(true); setError('');
    const supabase = getAuthedClient(session.access_token);
    const ext = file.name.split('.').pop();
    const path = 'committee-emblems/' + conferenceId + '-' + Date.now() + '.' + ext;
    const { error: upErr } = await supabase.storage.from('conference-assets').upload(path, file, { contentType: file.type, upsert: true });
    if (upErr) { setError('Upload failed: ' + upErr.message); setLogoUploading(false); return; }
    const { data: urlData } = supabase.storage.from('conference-assets').getPublicUrl(path);
    setLogoUrl(urlData.publicUrl);
    setLogoUploading(false);
  }

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
      logo_url: logoUrl,
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

  async function doEdit(supabase: ReturnType<typeof getAuthedClient>, force: boolean): Promise<'ok' | 'needs_confirm' | 'fail'> {
    const ex = existing!;
    const added = countries.filter(c => !baselineCountries.includes(c));
    const removed = baselineCountries.filter(c => !countries.includes(c));

    if (removed.length > 0 && !force) {
      const { data: allocs } = await supabase
        .from('conference_allocations')
        .select('id')
        .eq('conference_committee_id', ex.id)
        .in('country_name', removed);
      if ((allocs?.length ?? 0) > 0) {
        setPendingRemovalCount(allocs!.length);
        return 'needs_confirm';
      }
    }

    if (removed.length > 0) {
      await supabase.from('conference_allocations').delete().eq('conference_committee_id', ex.id).in('country_name', removed);
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
      logo_url: logoUrl,
    }).eq('id', ex.id);
    if (ex.session_id) {
      await supabase.from('committees').update({ name: name.trim(), topic: topics[0] ?? 'TBD' }).eq('id', ex.session_id);
    }
    return 'ok';
  }

  async function handleSave(force = false) {
    if (!name.trim()) { setError('Committee name is required.'); return; }
    if (topics.length === 0) { setError('Add at least one topic.'); return; }
    if (countries.length === 0) { setError(isCrisis ? 'Add at least one character.' : 'Add at least one country.'); return; }
    if (!session) return;
    setSaving(true); setError('');
    const supabase = getAuthedClient(session.access_token);
    if (isEdit) {
      const res = await doEdit(supabase, force);
      setSaving(false);
      if (res === 'needs_confirm') return;
      if (res !== 'ok') return;
    } else {
      const ok = await doCreate(supabase);
      setSaving(false);
      if (!ok) return;
    }
    onSaved();
    onClose();
  }

  return (
    <>
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-2xl rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-end mb-2">
          <button onClick={onClose} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label style={labelStyle}>Committee Name *</label>
            {!isCrisis ? (
              <CommitteeNameInput
                value={name}
                onChange={setName}
                onPresetSelect={(p) => { setName(p.name); setAbbreviation(p.acronym); if (!isEdit) setCountries(p.members); }}
              />
            ) : (
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. The Cuban Missile Crisis, 1962" style={inputStyle} />
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
            <label style={labelStyle}>Committee Emblem</label>
            <div className="flex items-center gap-4 rounded-xl p-3" style={{ border: '1px solid #EDE7D8', backgroundColor: 'rgba(237,231,216,0.35)' }}>
              {logoUploading ? (
                <div className="flex items-center justify-center flex-shrink-0" style={{ width: 72, height: 72 }}>
                  <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
                </div>
              ) : logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Committee emblem"
                  style={{ width: 72, height: 72, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 6px 12px rgba(27,56,40,0.24))' }}
                />
              ) : (
                <MonogramMedallion text={abbreviation || name} isCrisis={isCrisis} size={72} />
              )}
              <div className="flex flex-col gap-2 min-w-0">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { if (!logoUploading) document.getElementById('committee-emblem-upload')?.click(); }}
                    className="rounded-lg py-1.5 px-3.5 font-bold text-[11px] focus:outline-none"
                    style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em', cursor: 'pointer', transition: `background-color 250ms ${EASE}` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                  >
                    {logoUploading ? 'UPLOADING...' : logoUrl ? 'REPLACE ART' : 'UPLOAD ART'}
                  </button>
                  {logoUrl && !logoUploading && (
                    <button
                      onClick={() => setLogoUrl(null)}
                      className="rounded-lg py-1.5 px-3.5 font-bold text-[11px] focus:outline-none"
                      style={{ border: '1.5px solid #DDD4C0', color: '#6E5F4E', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em', cursor: 'pointer', transition: `background-color 250ms ${EASE}` }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                      USE MONOGRAM
                    </button>
                  )}
                </div>
                <p className="text-[11px]" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.45 }}>
                  Square transparent PNG works best, max 5MB. Without art, the committee wears its monogram medallion.
                </p>
              </div>
              <input
                id="committee-emblem-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleEmblemUpload(f); e.target.value = ''; }}
              />
            </div>
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
          <p className="flex items-center gap-1.5 text-sm font-bold mb-3" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
            {isCrisis ? <Users size={15} style={{ color: '#B6871F' }} /> : <Globe size={15} style={{ color: '#B6871F' }} />}
            {isCrisis ? 'Committee Characters' : 'Committee Countries'}
          </p>
          <CountryMatrixPicker value={countries} onChange={setCountries} noun={isCrisis ? 'character' : 'country'} />
        </div>
        {error && <p className="text-xs mt-3" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif" }}>{error}</p>}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}>CANCEL</button>
          <button onClick={() => handleSave(false)} disabled={saving} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ backgroundColor: saving ? '#DDD4C0' : '#1B3828', color: saving ? '#9A8A78' : '#EED98A', fontFamily: "'Outfit', sans-serif" }}>{saving ? 'SAVING...' : (isEdit ? 'SAVE CHANGES' : 'ADD COMMITTEE')}</button>
        </div>
      </div>
    </ModalOverlay>
    {pendingRemovalCount !== null && (
      <ModalOverlay onClose={() => setPendingRemovalCount(null)}>
        <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 380 }}>
          <p className="text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}>
            {pendingRemovalCount} of the {isCrisis ? 'characters' : 'countries'} you removed {pendingRemovalCount === 1 ? 'has' : 'have'} an allocated delegate. Removing {pendingRemovalCount === 1 ? 'it' : 'them'} will return {pendingRemovalCount === 1 ? 'that delegate' : 'those delegates'} to the allocation pool. Proceed?
          </p>
          <div className="flex gap-3">
            <button onClick={() => setPendingRemovalCount(null)} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}>CANCEL</button>
            <button onClick={() => { setPendingRemovalCount(null); handleSave(true); }} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ backgroundColor: '#8B2020', color: '#FFFFFF', fontFamily: "'Outfit', sans-serif" }}>PROCEED</button>
          </div>
        </div>
      </ModalOverlay>
    )}
    </>
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
  const [editTarget, setEditTarget] = useState<{ committee: Committee; countries: string[] } | null>(null);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommitteeRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortKey, setSortKey] = useState<'' | 'difficulty' | 'name' | 'type'>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const loadCommittees = useCallback(async () => {
    if (!conference) return;
    setLoading(true);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('conference_committees')
      .select('id, name, abbreviation, topics, difficulty, committee_type, total_slots, session_code, session_id, position_paper_deadline, notification_email, pp_submissions_enabled, logo_url')
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

  async function handleDeleteCommittee(c: CommitteeRow) {
    if (!session) return;
    setDeleting(true);
    const supabase = getAuthedClient(session.access_token);
    // Delete the linked session first — cascades all session children (delegates, speakers_list, current_speaker, motions, documents, messages, feedback).
    if (c.session_id) {
      await supabase.from('committees').delete().eq('id', c.session_id);
    }
    // Delete the conference committee — cascades slots, allocations, awards, position_papers, study_guides, application_preferences; sets applications/job_postings to null (preserved).
    await supabase.from('conference_committees').delete().eq('id', c.id);
    setDeleting(false);
    setDeleteTarget(null);
    loadCommittees();
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
            onClick={() => { setPendingType(null); setShowAdd(true); }}
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
          {/* Sort bar — glass pill, same recipe as the public conference page */}
          {committees.length > 1 && (
            <div className="mb-5">
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
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
            {sortedCommittees.map(c => {
              const diff = (c.difficulty ?? '').toLowerCase();
              const diffStyle = DIFFICULTY_STYLES[diff] ?? DIFFICULTY_STYLES.intermediate;
              const diffLabel = diff ? diff.charAt(0).toUpperCase() + diff.slice(1) : '';
              const isCrisis = c.committee_type === 'crisis';
              const topics = c.topics ?? [];
              const seats = c.slotCount || c.total_slots;
              const copied = copiedCode === c.session_code && !!c.session_code;
              return (
                <article
                  key={c.id}
                  className="flex flex-col rounded-[24px]"
                  style={{
                    backgroundColor: 'rgba(250,248,243,0.82)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(221,212,192,0.95)',
                    boxShadow: '0 10px 30px rgba(27,56,40,0.08)',
                    transition: `transform 350ms ${EASE}, box-shadow 350ms ${EASE}`,
                  }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = '0 16px 40px rgba(27,56,40,0.13)'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(0)'; el.style.boxShadow = '0 10px 30px rgba(27,56,40,0.08)'; }}
                >
                  <div className="flex flex-col items-center px-5 pt-7 flex-1">
                    {/* Emblem — uploaded art or monogram medallion */}
                    {c.logo_url ? (
                      <img
                        src={c.logo_url}
                        alt={c.abbreviation ?? c.name}
                        style={{
                          width: '104px', height: '104px', objectFit: 'contain', flexShrink: 0,
                          filter: 'drop-shadow(0 10px 18px rgba(27,56,40,0.28))',
                        }}
                      />
                    ) : (
                      <MonogramMedallion text={c.abbreviation || c.name} isCrisis={isCrisis} size={96} />
                    )}

                    {/* Abbreviation eyebrow (when art carries the emblem, the monogram moves up here) */}
                    {c.abbreviation && (
                      <p style={{ margin: '16px 0 0 0', fontFamily: "'Outfit', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', color: '#B6871F', fontVariantNumeric: 'tabular-nums' }}>
                        {c.abbreviation.toUpperCase()}
                      </p>
                    )}

                    {/* Name */}
                    <h3
                      className="text-center font-bold text-[15.5px] leading-snug"
                      style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: c.abbreviation ? '4px 0 0 0' : '18px 0 0 0', minHeight: '2.6em' }}
                    >
                      {c.name}
                    </h3>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 mt-1.5">
                      {diffLabel && (
                        <span
                          className="px-2.5 py-0.5 rounded-full"
                          style={{ ...diffStyle, fontSize: '10px', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em', fontWeight: 700 }}
                        >
                          {diffLabel}
                        </span>
                      )}
                      <span aria-hidden style={{ color: 'rgba(182,135,31,0.55)', fontSize: '7px' }}>◆</span>
                      <span className="text-[12px] font-semibold" style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                        {seats} {isCrisis ? (seats === 1 ? 'role' : 'roles') : (seats === 1 ? 'seat' : 'seats')}
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

                    {/* Topics — roman numerals */}
                    {topics.length > 0 && (
                      <div className="w-full mt-5 pt-4" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
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

                    {/* Session code ticket + PP deadline — pinned to the card bottom */}
                    <div className="w-full mt-auto">
                      <div className="w-full mt-5 pt-4" style={{ borderTop: '1px solid rgba(221,212,192,0.55)' }}>
                        {c.session_code ? (
                          <button
                            onClick={() => handleCopyCode(c.session_code!)}
                            title="Copy session code"
                            className="w-full flex items-stretch overflow-hidden rounded-xl focus:outline-none"
                            style={{
                              border: copied ? '1px solid rgba(61,122,82,0.45)' : '1px solid rgba(27,56,40,0.22)',
                              backgroundColor: copied ? 'rgba(61,122,82,0.10)' : 'rgba(27,56,40,0.045)',
                              cursor: 'pointer',
                              transition: `background-color 300ms ${EASE}, border-color 300ms ${EASE}`,
                            }}
                          >
                            <span className="flex items-center justify-center py-2.5 px-3" style={{ width: '45%' }}>
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', color: '#6B5F52' }}>
                                SESSION CODE
                              </span>
                            </span>
                            {/* Ticket perforation seam */}
                            <span aria-hidden style={{ borderLeft: '1px dashed rgba(27,56,40,0.35)', margin: '5px 0' }} />
                            <span className="flex-1 flex items-center justify-center gap-1.5 py-2.5">
                              {copied ? (
                                <>
                                  <Check size={12} style={{ color: '#3D7A52' }} />
                                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#3D7A52' }}>COPIED</span>
                                </>
                              ) : (
                                <>
                                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 700, letterSpacing: '0.14em', color: '#1B3828', fontVariantNumeric: 'tabular-nums' }}>
                                    {c.session_code}
                                  </span>
                                  <Copy size={11} style={{ color: 'rgba(27,56,40,0.55)' }} />
                                </>
                              )}
                            </span>
                          </button>
                        ) : (
                          <button
                            onClick={() => generateSessionCode(c)}
                            className="w-full rounded-xl py-2.5 text-[11px] font-bold focus:outline-none"
                            style={{
                              border: '1.5px dashed rgba(27,56,40,0.35)', color: '#1B3828', backgroundColor: 'transparent',
                              fontFamily: "'Outfit', sans-serif", letterSpacing: '0.1em', cursor: 'pointer',
                              transition: `background-color 300ms ${EASE}, color 300ms ${EASE}, border-color 300ms ${EASE}`,
                            }}
                            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = '#1B3828'; el.style.color = '#EED98A'; el.style.borderStyle = 'solid'; }}
                            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.backgroundColor = 'transparent'; el.style.color = '#1B3828'; el.style.borderStyle = 'dashed'; }}
                          >
                            GENERATE SESSION CODE
                          </button>
                        )}

                        {c.position_paper_deadline && (
                          <div className="flex items-center justify-center gap-1.5 mt-3">
                            <CalendarClock size={11} style={{ color: '#B6871F', flexShrink: 0 }} />
                            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 600, color: '#6B5F52', fontVariantNumeric: 'tabular-nums' }}>
                              Position papers due {new Date(c.position_paper_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-5 pb-5 pt-4 flex gap-2">
                    <button
                      onClick={async () => {
                        if (!session) return;
                        setEditLoadingId(c.id);
                        const supabase = getAuthedClient(session.access_token);
                        const { data } = await supabase.from('committee_country_slots').select('country_name').eq('conference_committee_id', c.id);
                        setEditTarget({ committee: c, countries: (data ?? []).map((r: { country_name: string }) => r.country_name) });
                        setEditLoadingId(null);
                      }}
                      disabled={editLoadingId === c.id}
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
                      {editLoadingId === c.id ? 'LOADING…' : 'EDIT'}
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
        </>
      )}

      {showAdd && !pendingType && (
        <ModalOverlay onClose={() => setShowAdd(false)}>
          <div className="rounded-2xl p-8 flex flex-col items-center gap-5" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 360 }}>
            <div className="w-full flex justify-end">
              <button onClick={() => setShowAdd(false)} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={18} /></button>
            </div>
            <p className="text-base font-bold text-center" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Choose committee type</p>
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
      {editTarget && (
        <CommitteeEditor
          conferenceId={conference.id}
          committeeType={editTarget.committee.committee_type === 'crisis' ? 'crisis' : 'general-assembly'}
          existing={editTarget.committee}
          initialCountries={editTarget.countries}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); loadCommittees(); }}
        />
      )}
      {deleteTarget && (
        <ModalOverlay onClose={() => { if (!deleting) setDeleteTarget(null); }}>
          <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 400 }}>
            <p className="text-sm font-bold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Delete &ldquo;{deleteTarget.name}&rdquo;?</p>
            <p className="text-xs" style={{ color: '#6B5D4F', fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}>
              This permanently removes the committee and its live session — including all delegates, documents, messages, country slots, and allocations. Applicants are kept but returned to unassigned. This cannot be undone.
            </p>
            <div className="flex gap-3 mt-1">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: "'Outfit', sans-serif" }}>CANCEL</button>
              <button onClick={() => handleDeleteCommittee(deleteTarget)} disabled={deleting} className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none" style={{ backgroundColor: deleting ? '#DDD4C0' : '#8B2020', color: deleting ? '#9A8A78' : '#FFFFFF', fontFamily: "'Outfit', sans-serif" }}>{deleting ? 'DELETING...' : 'DELETE'}</button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
