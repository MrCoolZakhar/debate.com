'use client';

// Shared committee editor modal, extracted from manage/[slug]/committees/page.tsx
// so the organiser committees tab and the public conference page can share it.
// Exposes: CommitteeEditorModal (create + edit, with built-in type picker for the
// create flow), MonogramMedallion (fallback emblem), ModalOverlay (house modal
// backdrop) and mintConferenceSession (session minting for conference committees).

import { useState, useEffect } from 'react';
import { X, Globe, Users, Landmark, Scale, Zap } from 'lucide-react';
import { NEU, NEU_GRADIENTS, OUTFIT, type NeuGradient } from '@/components/neu';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { getCountryByName } from '@/lib/countries';
import {
  ConferenceRosterPicker,
  ConferenceCommitteeNameInput,
  entry,
  type RosterEntry,
} from '@/components/ConferenceRosterPicker';
import { PRESET_EMBLEM_PICKS, matchPresetEmblem } from '@/lib/presetNames';
import Portal from '@/components/Portal';

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

// Committee type governs rostering: GA + Specialised roster by country slots;
// Crisis rosters free-text character names. Only Crisis takes the character
// path, every non-crisis type falls through to countries.
export type CommitteeType = 'general-assembly' | 'specialised' | 'crisis';

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

// ── Fallback emblem, gradient monogram disc with grain, matching the public card

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
  // Portal'd to document.body/#fit-root: the manage layout's content wrapper
  // establishes its own stacking context (`relative z-10`), which traps
  // `position: fixed` descendants below the header (z-30) and sidebar (z-25).
  // Portaling out of that subtree is the only way the dim backdrop covers them.
  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      >
        <div onClick={e => e.stopPropagation()}>{children}</div>
      </div>
    </Portal>
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
  // Names (countries or characters) flagged as observers. Mirrors the standalone
  // session flow: delegates.is_observer carries the flag on the live session, so
  // the chair/roll-call/voting views treat these rows as observers identically.
  observers: string[] = [],
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
      if (sErr.code === '23505') continue; // code collision, try a new code
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
      const observerSet = new Set(observers.map((o) => o.toLowerCase()));
      await supabase.from('delegates').insert(
        countries.map((country) => ({ committee_id: sessionRow.id, country, status: 'absent', is_observer: observerSet.has(country.toLowerCase()) }))
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

function CommitteeEditor({ conferenceId, committeeType, existing, initialRoster, onClose, onSaved }: {
  conferenceId: string;
  committeeType: CommitteeType;
  existing?: EditableCommittee | null;
  initialRoster?: RosterEntry[];
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
  const [roster, setRoster] = useState<RosterEntry[]>(initialRoster ?? []);
  const [baselineRoster] = useState<RosterEntry[]>(initialRoster ?? []);
  const [pendingRemovalCount, setPendingRemovalCount] = useState<number | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(existing?.logo_url ?? null);
  const [logoUploading, setLogoUploading] = useState(false);
  // Once the organiser uploads, clears, or picks an emblem, we stop auto-filling
  // the default from the name. An existing committee that already has an emblem
  // counts as manually set.
  const [emblemManuallySet, setEmblemManuallySet] = useState<boolean>(!!existing?.logo_url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Auto-assign a preset emblem as the default when the committee's name /
  // abbreviation matches a known body (UNSC, DISEC, WHO, …) and the organiser
  // has not set their own. Never overrides a manual choice.
  useEffect(() => {
    if (emblemManuallySet) return;
    setLogoUrl(matchPresetEmblem(name, abbreviation));
  }, [name, abbreviation, emblemManuallySet]);

  // Mirrors the conference logo upload in manage/[slug]/settings, same bucket, own folder.
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
    setEmblemManuallySet(true);
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
      total_slots: roster.length,
      notification_email: null,
      logo_url: logoUrl,
    }).select('id').single();
    if (err || !created) { setError(err?.message ?? 'Failed to create committee.'); return false; }
    await supabase.from('committee_country_slots').insert(
      roster.map((r) => ({
        conference_committee_id: created.id,
        country_code: getCountryByName(r.name)?.code ?? r.name,
        country_name: r.name,
        delegation_size: 1,
        importance: r.importance,
        is_observer: !!r.isObserver,
      }))
    );
    await mintConferenceSession(
      supabase, created.id, name.trim(), topics[0] ?? '',
      roster.map((r) => r.name),
      roster.filter((r) => r.isObserver).map((r) => r.name),
    );
    return true;
  }

  async function doEdit(supabase: ReturnType<typeof getAuthedClient>, force: boolean): Promise<'ok' | 'needs_confirm' | 'fail'> {
    const ex = existing!;
    const baseNames = baselineRoster.map(r => r.name);
    const nextNames = roster.map(r => r.name);
    const baseTier = new Map(baselineRoster.map(r => [r.name, r.importance]));
    const baseObs = new Map(baselineRoster.map(r => [r.name, !!r.isObserver]));
    const added = roster.filter(r => !baseNames.includes(r.name));
    const removed = baseNames.filter(c => !nextNames.includes(c));
    // Rows kept across the edit whose importance tier the organiser changed.
    const retiered = roster.filter(r => baseTier.has(r.name) && baseTier.get(r.name) !== r.importance);
    // Rows kept across the edit whose observer flag the organiser toggled.
    const reobserved = roster.filter(r => baseObs.has(r.name) && baseObs.get(r.name) !== !!r.isObserver);

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
        added.map((r) => ({
          conference_committee_id: ex.id,
          country_code: getCountryByName(r.name)?.code ?? r.name,
          country_name: r.name,
          delegation_size: 1,
          importance: r.importance,
          is_observer: !!r.isObserver,
        }))
      );
      if (ex.session_id) {
        await supabase.from('delegates').insert(
          added.map((r) => ({ committee_id: ex.session_id, country: r.name, status: 'absent', is_observer: !!r.isObserver }))
        );
      }
    }
    // Persist tier-only changes on existing slots (the allocator reads this column).
    for (const r of retiered) {
      await supabase.from('committee_country_slots')
        .update({ importance: r.importance })
        .eq('conference_committee_id', ex.id)
        .eq('country_name', r.name);
    }
    // Persist observer-flag changes on kept rows, on both the slot (edit-prefill
    // home) and the live session delegate (so the session treats it identically).
    for (const r of reobserved) {
      await supabase.from('committee_country_slots')
        .update({ is_observer: !!r.isObserver })
        .eq('conference_committee_id', ex.id)
        .eq('country_name', r.name);
      if (ex.session_id) {
        await supabase.from('delegates')
          .update({ is_observer: !!r.isObserver })
          .eq('committee_id', ex.session_id)
          .eq('country', r.name);
      }
    }
    await supabase.from('conference_committees').update({
      name: name.trim(),
      abbreviation: abbreviation.trim() || null,
      topics,
      difficulty,
      total_slots: roster.length,
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
    if (roster.length === 0) { setError(isCrisis ? 'Add at least one character.' : 'Add at least one country.'); return; }
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
              <ConferenceCommitteeNameInput
                value={name}
                onChange={setName}
                onPresetSelect={(p) => { setName(p.name); setAbbreviation(p.acronym); if (!isEdit) setRoster(p.members.map((m) => entry(m))); }}
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
                      onClick={() => { setLogoUrl(null); setEmblemManuallySet(true); }}
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
            {/* Preset emblem picker, one-click seals for common committees. */}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span style={{ ...labelStyle, marginBottom: 0, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Presets</span>
              {PRESET_EMBLEM_PICKS.map((p) => {
                const active = logoUrl === p.logo;
                return (
                  <button
                    key={p.key}
                    onClick={() => { setLogoUrl(p.logo); setEmblemManuallySet(true); }}
                    title={p.label}
                    className="flex items-center justify-center rounded-lg focus:outline-none"
                    style={{
                      width: 34, height: 34, flexShrink: 0,
                      border: active ? '1.5px solid #1B3828' : '1px solid #DDD4C0',
                      backgroundColor: active ? 'rgba(27,56,40,0.06)' : '#FAF8F3',
                      cursor: 'pointer', transition: `all 200ms ${EASE}`,
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = '#B6871F'; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
                  >
                    <img src={p.logo} alt={p.label} style={{ width: 22, height: 22, objectFit: 'contain' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  </button>
                );
              })}
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
          <div className="flex items-center mb-3">
            <p className="flex items-center gap-1.5 text-sm font-bold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
              {isCrisis ? <Users size={15} style={{ color: '#B6871F' }} /> : <Globe size={15} style={{ color: '#B6871F' }} />}
              {isCrisis ? 'Committee Characters' : 'Committee Countries'}
            </p>
          </div>
          <ConferenceRosterPicker mode={isCrisis ? 'character' : 'country'} value={roster} onChange={setRoster} />
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

// ── Committee-type picker card (neumorphic) ───────────────────────────────────
// One extruded ivory card per type. Selected = forest ring + gold-tinted seat +
// gradient icon disc lit; unselected = calm surface + soft-tinted icon seat.
// Hover lifts the card. Used only in the create flow's three-up type chooser.

const TYPE_OPTIONS: {
  type: CommitteeType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  gradient: NeuGradient;
}[] = [
  { type: 'general-assembly', label: 'General Assembly', desc: 'Large committees, country delegates, formal debate.', icon: Landmark, gradient: NEU_GRADIENTS.forest },
  { type: 'specialised', label: 'Specialised', desc: 'Mid-size expert bodies (ECOSOC, HRC, legal).', icon: Scale, gradient: NEU_GRADIENTS.sage },
  { type: 'crisis', label: 'Crisis', desc: 'Fast-paced, character roles, live crises.', icon: Zap, gradient: NEU_GRADIENTS.amber },
];

function TypeCard({ opt, onSelect }: { opt: (typeof TYPE_OPTIONS)[number]; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);
  const { label, desc, icon: Icon, gradient } = opt;
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-3.5 text-left focus:outline-none w-full"
      style={{
        padding: '14px 16px',
        borderRadius: 18,
        border: `1.5px solid ${hovered ? NEU.forest : 'transparent'}`,
        backgroundColor: NEU.surface,
        boxShadow: hovered ? NEU.outHover : NEU.out,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: `box-shadow 260ms ${EASE}, transform 260ms ${EASE}, border-color 200ms ${EASE}`,
        cursor: 'pointer',
      }}
    >
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: 44, height: 44, borderRadius: 14,
          background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
          boxShadow: `0 4px 10px ${gradient[0]}44, ${NEU.outSm}`,
        }}
      >
        <Icon size={21} strokeWidth={2.2} style={{ color: '#FFFFFF' }} />
      </span>
      <span className="flex flex-col min-w-0">
        <span style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 800, color: NEU.ink, letterSpacing: '0.01em' }}>{label}</span>
        <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 500, color: NEU.muted, lineHeight: 1.35, marginTop: 2 }}>{desc}</span>
      </span>
    </button>
  );
}

// ── CommitteeEditorModal, public API ─────────────────────────────────────────
// committee = null → create flow (opens with the GA / Specialised / Crisis
// type picker); committee set → edit flow (self-loads the committee's slots).

export function CommitteeEditorModal({ conference, committee, onSaved, onClose }: {
  conference: { id: string };
  committee: EditableCommittee | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const isEdit = !!committee;
  const [pendingType, setPendingType] = useState<CommitteeType | null>(
    committee ? (committee.committee_type as CommitteeType) : null
  );
  // Edit flow: null until the committee's current slots are fetched.
  const [initialRoster, setInitialRoster] = useState<RosterEntry[] | null>(committee ? null : []);

  useEffect(() => {
    if (!committee || !session) return;
    let cancelled = false;
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data } = await supabase
        .from('committee_country_slots')
        .select('country_name, importance, is_observer')
        .eq('conference_committee_id', committee.id);
      if (!cancelled) {
        setInitialRoster(
          (data ?? []).map((r: { country_name: string; importance: string | null; is_observer: boolean | null }) => ({
            name: r.country_name,
            importance: (r.importance as RosterEntry['importance']) ?? 'standard',
            isObserver: r.is_observer ?? false,
          }))
        );
      }
    })();
    return () => { cancelled = true; };
  }, [committee, session]);

  // Create flow, choose committee type first (GA / Specialised / Crisis).
  if (!isEdit && !pendingType) {
    return (
      <ModalOverlay onClose={onClose}>
        <div className="rounded-2xl p-7 flex flex-col gap-5" style={{ backgroundColor: NEU.base, border: '1px solid #DDD4C0', width: 400 }}>
          <div className="flex items-center justify-between">
            <p className="text-base font-bold" style={{ color: NEU.ink, fontFamily: OUTFIT }}>Choose committee type</p>
            <button onClick={onClose} className="focus:outline-none" style={{ color: NEU.muted }}><X size={18} /></button>
          </div>
          <div className="flex flex-col gap-3.5 w-full">
            {TYPE_OPTIONS.map((opt) => (
              <TypeCard key={opt.type} opt={opt} onSelect={() => setPendingType(opt.type)} />
            ))}
          </div>
        </div>
      </ModalOverlay>
    );
  }

  // Edit flow, brief spinner while the current slots load.
  if (isEdit && initialRoster === null) {
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
      initialRoster={initialRoster ?? []}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
