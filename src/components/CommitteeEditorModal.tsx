'use client';

// Shared committee editor modal — extracted from manage/[slug]/committees/page.tsx
// so the organiser committees tab and the public conference page can share it.
// Exposes: CommitteeEditorModal (create + edit, with built-in type picker for the
// create flow), MonogramMedallion (fallback emblem), ModalOverlay (house modal
// backdrop) and mintConferenceSession (session minting for conference committees).

import { useState, useEffect } from 'react';
import { X, Globe, Users } from 'lucide-react';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { getCountryByName } from '@/lib/countries';
import { CountryMatrixPicker } from '@/components/CountryMatrixPicker';
import { CommitteeNameInput } from '@/components/CommitteeNameInput';

// ── Design constants ──────────────────────────────────────────────────────────

// Same recipe as the public conference detail page committee cards.
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

const EASE = 'cubic-bezier(0.22,1,0.36,1)';

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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EditableCommittee {
  id: string;
  name: string;
  abbreviation: string | null;
  topics: string[] | null;
  difficulty: string;
  committee_type: string;
  session_id: string | null;
  logo_url: string | null;
}

// ── Fallback emblem — gradient monogram disc with grain, matching the public card

export function MonogramMedallion({ text, isCrisis, size }: { text: string; isCrisis: boolean; size: number }) {
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

// ── Shared modal overlay ──────────────────────────────────────────────────────

export function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
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

// ── Session minting ───────────────────────────────────────────────────────────

// Mint a real, joinable session for a conference committee and link it back.
// committees/current_speaker carry a public read/write RLS policy, so the authed
// organizer client can write them directly. Generates a unique 6-char code,
// retrying on a code-uniqueness collision. Returns the code, or null on failure.
export async function mintConferenceSession(
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

// ── CommitteeEditor (create + edit) ───────────────────────────────────────────

function CommitteeEditor({ conferenceId, committeeType, existing, initialCountries, onClose, onSaved }: {
  conferenceId: string;
  committeeType: 'general-assembly' | 'crisis';
  existing?: EditableCommittee | null;
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

// ── CommitteeEditorModal — public API ─────────────────────────────────────────
// committee = null → create flow (opens with the GA/Crisis type picker);
// committee set    → edit flow (self-loads the committee's country slots).

export function CommitteeEditorModal({ conference, committee, onSaved, onClose }: {
  conference: { id: string };
  committee: EditableCommittee | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const isEdit = !!committee;
  const [pendingType, setPendingType] = useState<'general-assembly' | 'crisis' | null>(
    committee ? (committee.committee_type === 'crisis' ? 'crisis' : 'general-assembly') : null
  );
  // Edit flow: null until the committee's current slots are fetched.
  const [initialCountries, setInitialCountries] = useState<string[] | null>(committee ? null : []);

  useEffect(() => {
    if (!committee || !session) return;
    let cancelled = false;
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data } = await supabase
        .from('committee_country_slots')
        .select('country_name')
        .eq('conference_committee_id', committee.id);
      if (!cancelled) setInitialCountries((data ?? []).map((r: { country_name: string }) => r.country_name));
    })();
    return () => { cancelled = true; };
  }, [committee, session]);

  // Create flow — choose committee type first.
  if (!isEdit && !pendingType) {
    return (
      <ModalOverlay onClose={onClose}>
        <div className="rounded-2xl p-8 flex flex-col items-center gap-5" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 360 }}>
          <div className="w-full flex justify-end">
            <button onClick={onClose} className="focus:outline-none" style={{ color: '#9A8A78' }}><X size={18} /></button>
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
    );
  }

  // Edit flow — brief spinner while the current slots load.
  if (isEdit && initialCountries === null) {
    return (
      <ModalOverlay onClose={onClose}>
        <div className="rounded-2xl p-10 flex items-center justify-center" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 200 }}>
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
        </div>
      </ModalOverlay>
    );
  }

  return (
    <CommitteeEditor
      conferenceId={conference.id}
      committeeType={pendingType ?? 'general-assembly'}
      existing={committee}
      initialCountries={initialCountries ?? []}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
