'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { BadgeCheck, ImagePlus, Pencil, Trash2, X, Check } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase as anonClient } from '@/lib/supabase';
import { getCountryByName, getFlagUrl } from '@/lib/countries';
import { experienceProgress, syncExperienceLevel } from '@/lib/munExperience';
import {
  Eyebrow, GlassCard, AwardChip, AwardArtwork, AWARD_LIST,
  getCommitteeLogo, monogramFor, OUTFIT, MONO,
} from '../accountUi';

interface CVEntry {
  id: string;
  conference_name: string;
  committee: string;
  allocation: string;
  expertise_level: string | null;
  award: string;
  awards: string[];
  photos: string[];
  logo_url: string | null;
  conference_id: string | null;
  source: 'gavelling_verified' | 'manual';
  created_at: string;
}

interface ConferenceSuggestion {
  kind: 'gavelling' | 'community';
  name: string;
  acronym: string | null;
  logoUrl: string | null;
  conferenceId: string | null;
}

const EXPERTISE_LEVELS_MODAL = ['beginner', 'intermediate', 'advanced', 'expert'];
const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const inputStyle: React.CSSProperties = {
  border: '1px solid #DDD4C0',
  backgroundColor: 'rgba(250,248,243,0.9)',
  color: '#1C1410',
  fontFamily: OUTFIT,
};

// ── Logo tile ──────────────────────────────────────────────────────────────

function LogoTile({ entry, size = 52 }: { entry: Pick<CVEntry, 'logo_url' | 'committee' | 'conference_name'>; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = entry.logo_url || getCommitteeLogo(entry.committee);

  if (src && !failed) {
    return (
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '14px',
          backgroundColor: 'rgba(250,248,243,0.9)',
          border: '1px solid rgba(221,212,192,0.9)',
          boxShadow: '0 2px 8px rgba(27,56,40,0.06)',
          padding: '7px',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={entry.conference_name}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '14px',
        backgroundColor: '#1B3828',
        boxShadow: '0 2px 8px rgba(27,56,40,0.18)',
      }}
    >
      <span style={{ color: '#EED98A', fontFamily: OUTFIT, fontWeight: 800, fontSize: `${Math.round(size * 0.3)}px`, letterSpacing: '0.04em' }}>
        {monogramFor(entry.conference_name)}
      </span>
    </div>
  );
}

// ── Add / Edit modal ───────────────────────────────────────────────────────

function CVEntryModal({
  existing,
  onClose,
  onSaved,
  userId,
}: {
  existing: CVEntry | null;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
}) {
  const { session } = useAuth();
  const isVerified = existing?.source === 'gavelling_verified';

  const [conferenceName, setConferenceName] = useState(existing?.conference_name ?? '');
  const [committee, setCommittee]           = useState(existing?.committee ?? '');
  const [allocation, setAllocation]         = useState(existing?.allocation ?? '');
  const [expertiseLevel, setExpertiseLevel] = useState(existing?.expertise_level ?? '');
  const [awards, setAwards]                 = useState<string[]>(existing?.awards ?? []);
  const [photos, setPhotos]                 = useState<string[]>(existing?.photos ?? []);
  const [logoUrl, setLogoUrl]               = useState<string | null>(existing?.logo_url ?? null);
  const [conferenceId, setConferenceId]     = useState<string | null>(existing?.conference_id ?? null);
  const [submitting, setSubmitting]         = useState(false);
  const [uploading, setUploading]           = useState(false);
  const [error, setError]                   = useState('');

  // Conference suggestions
  const [suggestions, setSuggestions]       = useState<ConferenceSuggestion[]>([]);
  const [suggestOpen, setSuggestOpen]       = useState(false);
  const suppressSuggest = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const q = conferenceName.trim();
    if (isVerified || suppressSuggest.current || q.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const like = `%${q.replace(/[%_,()]/g, '')}%`;
        const [confRes, cvRes] = await Promise.all([
          anonClient
            .from('conferences')
            .select('id, full_name, acronym, logo_url')
            .or(`full_name.ilike.${like},acronym.ilike.${like}`)
            .limit(5),
          anonClient
            .from('mun_cv_entries')
            .select('conference_name, logo_url')
            .ilike('conference_name', like)
            .neq('user_id', userId)
            .limit(20),
        ]);

        const results: ConferenceSuggestion[] = [];
        const seen = new Set<string>();

        for (const c of (confRes.data ?? []) as { id: string; full_name: string; acronym: string | null; logo_url: string | null }[]) {
          const key = c.full_name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          results.push({ kind: 'gavelling', name: c.full_name, acronym: c.acronym, logoUrl: c.logo_url, conferenceId: c.id });
        }
        for (const r of (cvRes.data ?? []) as { conference_name: string; logo_url: string | null }[]) {
          const key = r.conference_name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          results.push({ kind: 'community', name: r.conference_name, acronym: null, logoUrl: r.logo_url, conferenceId: null });
          if (results.length >= 8) break;
        }
        setSuggestions(results);
        setSuggestOpen(results.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conferenceName, isVerified, userId]);

  function pickSuggestion(s: ConferenceSuggestion) {
    suppressSuggest.current = true;
    setConferenceName(s.name);
    setLogoUrl(s.logoUrl);
    setConferenceId(s.conferenceId);
    setSuggestions([]);
    setSuggestOpen(false);
  }

  function toggleAward(name: string) {
    setAwards((prev) => (prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]));
  }

  async function handlePhotoFiles(files: FileList | null) {
    if (!files || files.length === 0 || !session) return;
    setError('');
    const room = MAX_PHOTOS - photos.length;
    const selected = Array.from(files).slice(0, room);
    if (selected.length === 0) return;

    for (const file of selected) {
      if (!file.type.startsWith('image/')) {
        setError('Only image files can be attached.');
        return;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setError('Photos must be under 5 MB each.');
        return;
      }
    }

    setUploading(true);
    const supabase = getAuthedClient(session.access_token);
    const uploaded: string[] = [];
    for (const file of selected) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `cv/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('conference-assets')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        setError('A photo could not be uploaded. Please try again.');
        continue;
      }
      const { data } = supabase.storage.from('conference-assets').getPublicUrl(path);
      if (data?.publicUrl) uploaded.push(data.publicUrl);
    }
    setPhotos((prev) => [...prev, ...uploaded].slice(0, MAX_PHOTOS));
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removePhoto(url: string) {
    setPhotos((prev) => prev.filter((p) => p !== url));
    if (!session) return;
    // Best-effort storage cleanup for files under this user's cv/ prefix.
    const marker = '/conference-assets/';
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      const path = decodeURIComponent(url.slice(idx + marker.length));
      if (path.startsWith(`cv/${userId}/`)) {
        getAuthedClient(session.access_token).storage.from('conference-assets').remove([path]).then(() => {});
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!conferenceName || !committee || !allocation) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!session) return;
    setSubmitting(true);
    setError('');
    const supabase = getAuthedClient(session.access_token);

    const payload = {
      conference_name: conferenceName,
      committee,
      allocation,
      expertise_level: expertiseLevel || null,
      awards,
      award:           awards[0] ?? 'None', // keep legacy column in sync for compat
      photos,
      logo_url:        logoUrl,
      conference_id:   conferenceId,
    };

    let dbErr;
    if (existing) {
      ({ error: dbErr } = await supabase.from('mun_cv_entries').update(payload).eq('id', existing.id));
    } else {
      ({ error: dbErr } = await supabase.from('mun_cv_entries').insert({ ...payload, user_id: userId, source: 'manual' }));
    }
    setSubmitting(false);
    if (dbErr) {
      setError(dbErr.message);
      return;
    }
    onSaved();
    onClose();
  }

  const allocCountry = getCountryByName(allocation);
  const allocFlag = allocCountry ? getFlagUrl(allocCountry.code) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto"
      style={{ backgroundColor: 'rgba(28,20,16,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-[20px] p-6 md:p-7 my-auto"
        style={{
          backgroundColor: 'rgba(250,248,243,0.97)',
          border: '1px solid #DDD4C0',
          boxShadow: '0 24px 64px rgba(28,20,16,0.24)',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Eyebrow className="mb-1.5">{existing ? 'Edit Entry' : 'Add Conference'}</Eyebrow>
        <h2 className="font-black text-lg mb-5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          {existing ? existing.conference_name : 'New CV entry'}
        </h2>

        {error && (
          <p
            className="text-xs mb-3 px-3 py-2 rounded-xl"
            style={{ backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.2)', color: '#8B2020', fontFamily: OUTFIT }}
          >
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Conference name + suggestions */}
          <div className="relative">
            <label className="block text-[13px] font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              Conference Name
            </label>
            <div className="flex items-center gap-2.5">
              {logoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={logoUrl}
                  alt=""
                  className="flex-shrink-0"
                  style={{ width: '34px', height: '34px', objectFit: 'contain', borderRadius: '9px', border: '1px solid rgba(221,212,192,0.9)', backgroundColor: '#FAF8F3', padding: '3px' }}
                />
              )}
              <input
                type="text"
                required
                disabled={isVerified}
                value={conferenceName}
                onChange={(e) => {
                  suppressSuggest.current = false;
                  setConferenceName(e.target.value);
                  setConferenceId(null);
                }}
                placeholder="e.g. Harvard WorldMUN 2026"
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                style={{ ...inputStyle, opacity: isVerified ? 0.55 : 1, cursor: isVerified ? 'not-allowed' : 'text' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; setTimeout(() => setSuggestOpen(false), 150); }}
              />
            </div>
            {suggestOpen && suggestions.length > 0 && (
              <div
                className="absolute z-30 left-0 right-0 mt-1.5 rounded-xl overflow-hidden"
                style={{
                  backgroundColor: 'rgba(250,248,243,0.98)',
                  border: '1px solid #DDD4C0',
                  boxShadow: '0 16px 40px rgba(27,56,40,0.16)',
                }}
              >
                {suggestions.map((s) => (
                  <button
                    key={`${s.kind}-${s.name}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggestion(s)}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left focus:outline-none"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    {s.logoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={s.logoUrl} alt="" style={{ width: '26px', height: '26px', objectFit: 'contain', borderRadius: '7px', flexShrink: 0 }} />
                    ) : (
                      <span
                        className="flex items-center justify-center flex-shrink-0"
                        style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, fontWeight: 800, fontSize: '10px' }}
                      >
                        {monogramFor(s.name)}
                      </span>
                    )}
                    <span className="flex-1 min-w-0 truncate text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT, fontWeight: 500 }}>
                      {s.name}
                      {s.acronym && (
                        <span style={{ color: '#9A8A78', fontFamily: MONO, fontSize: '10px', marginLeft: '8px' }}>{s.acronym}</span>
                      )}
                    </span>
                    <span
                      className="flex-shrink-0 rounded-full px-2 py-0.5"
                      style={{
                        backgroundColor: s.kind === 'gavelling' ? 'rgba(27,56,40,0.1)' : 'rgba(154,138,120,0.12)',
                        border: `1px solid ${s.kind === 'gavelling' ? 'rgba(27,56,40,0.25)' : 'rgba(154,138,120,0.25)'}`,
                        color: s.kind === 'gavelling' ? '#1B3828' : '#9A8A78',
                        fontFamily: MONO,
                        fontSize: '8.5px',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {s.kind === 'gavelling' ? 'ON GAVELLING' : 'COMMUNITY'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Committee */}
          <div>
            <label className="block text-[13px] font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              Committee
            </label>
            <input
              type="text"
              required
              disabled={isVerified}
              value={committee}
              onChange={(e) => setCommittee(e.target.value)}
              placeholder="e.g. UN Security Council"
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ ...inputStyle, opacity: isVerified ? 0.55 : 1, cursor: isVerified ? 'not-allowed' : 'text' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
            />
          </div>

          {/* Allocation */}
          <div>
            <label className="block text-[13px] font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              Country / Portfolio / Allocation
            </label>
            <div className="relative">
              {allocFlag && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={allocFlag}
                  alt={allocation}
                  className="absolute pointer-events-none"
                  style={{ left: '14px', top: '50%', transform: 'translateY(-50%)', width: '22px', height: '15px', objectFit: 'cover', borderRadius: '2.5px', boxShadow: '0 1px 3px rgba(27,56,40,0.25)' }}
                />
              )}
              <input
                type="text"
                required
                disabled={isVerified}
                value={allocation}
                onChange={(e) => setAllocation(e.target.value)}
                placeholder="e.g. China, EU Observer"
                className="w-full rounded-xl py-3 text-sm focus:outline-none"
                style={{ ...inputStyle, paddingLeft: allocFlag ? '46px' : '16px', paddingRight: '16px', opacity: isVerified ? 0.55 : 1, cursor: isVerified ? 'not-allowed' : 'text' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
              />
            </div>
          </div>

          {/* Expertise level */}
          <div>
            <label className="block text-[13px] font-semibold mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              Expertise Level
            </label>
            <div className="flex gap-2 flex-wrap">
              {EXPERTISE_LEVELS_MODAL.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setExpertiseLevel(expertiseLevel === lvl ? '' : lvl)}
                  className="rounded-full px-3.5 py-1.5 text-[11px] font-bold focus:outline-none transition-all"
                  style={{
                    border: expertiseLevel === lvl ? '1px solid rgba(27,56,40,0.4)' : '1px solid #DDD4C0',
                    backgroundColor: expertiseLevel === lvl ? 'rgba(27,56,40,0.09)' : 'transparent',
                    color: expertiseLevel === lvl ? '#1B3828' : '#9A8A78',
                    fontFamily: OUTFIT,
                    letterSpacing: '0.06em',
                    cursor: 'pointer',
                  }}
                >
                  {lvl.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Awards multi-select */}
          <div>
            <label className="block text-[13px] font-semibold mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              Awards
              <span className="ml-2 font-normal" style={{ color: '#9A8A78', fontSize: '11px' }}>select all that apply</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {AWARD_LIST.map((name) => {
                const active = awards.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleAward(name)}
                    className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-3 py-1 text-[11px] font-semibold focus:outline-none transition-all"
                    style={{
                      border: active ? '1px solid rgba(182,135,31,0.55)' : '1px solid #DDD4C0',
                      backgroundColor: active ? 'rgba(238,217,138,0.28)' : 'transparent',
                      color: active ? '#7A5A20' : '#9A8A78',
                      fontFamily: OUTFIT,
                      cursor: 'pointer',
                    }}
                  >
                    <AwardArtwork name={name} size={20} />
                    {name}
                    {active && <Check size={11} strokeWidth={3} style={{ color: '#B6871F' }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="block text-[13px] font-semibold mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              Conference Photos
              <span className="ml-2 font-normal" style={{ color: '#9A8A78', fontSize: '11px' }}>up to 3, max 5 MB each</span>
            </label>
            <div className="flex gap-2.5 flex-wrap">
              {photos.map((url) => (
                <div key={url} className="relative" style={{ width: '76px', height: '76px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Conference photo"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px', border: '1px solid rgba(221,212,192,0.9)' }}
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(url)}
                    aria-label="Remove photo"
                    className="absolute flex items-center justify-center focus:outline-none"
                    style={{
                      top: '-6px', right: '-6px', width: '20px', height: '20px',
                      borderRadius: '9999px', backgroundColor: '#8B2020', color: '#FAF8F3',
                      border: '2px solid #FAF8F3', cursor: 'pointer',
                    }}
                  >
                    <X size={10} strokeWidth={3} />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex flex-col items-center justify-center gap-1 focus:outline-none transition-colors"
                  style={{
                    width: '76px', height: '76px', borderRadius: '12px',
                    border: '1.5px dashed #DDD4C0', backgroundColor: 'transparent',
                    color: '#9A8A78', cursor: uploading ? 'default' : 'pointer',
                  }}
                  onMouseEnter={(e) => { if (!uploading) { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; (e.currentTarget as HTMLElement).style.color = '#1B3828'; } }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                >
                  <ImagePlus size={18} strokeWidth={1.8} />
                  <span style={{ fontFamily: MONO, fontSize: '8.5px', letterSpacing: '0.1em' }}>
                    {uploading ? 'UPLOADING' : 'ADD'}
                  </span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handlePhotoFiles(e.target.files)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl py-2.5 font-semibold text-[13px] focus:outline-none"
              style={{ border: '1px solid #DDD4C0', color: '#9A8A78', backgroundColor: 'transparent', fontFamily: OUTFIT, cursor: 'pointer' }}
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="flex-1 rounded-xl py-2.5 font-bold text-[13px] focus:outline-none transition-colors"
              style={{
                backgroundColor: submitting || uploading ? '#DDD4C0' : '#1B3828',
                color: submitting || uploading ? '#9A8A78' : '#EED98A',
                fontFamily: OUTFIT,
                letterSpacing: '0.08em',
                border: 'none',
                cursor: submitting || uploading ? 'default' : 'pointer',
              }}
            >
              {submitting ? 'SAVING...' : existing ? 'SAVE CHANGES' : 'ADD ENTRY'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Entry card ─────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onEdit,
  onDelete,
  deleting,
}: {
  entry: CVEntry;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const isVerified = entry.source === 'gavelling_verified';
  const date = new Date(entry.created_at);
  const dateStr = date.toLocaleDateString('en', { month: 'short', year: 'numeric' });

  const allocCountry = entry.allocation ? getCountryByName(entry.allocation) : null;
  const allocFlag = allocCountry ? getFlagUrl(allocCountry.code) : null;

  const displayAwards = entry.awards.length > 0
    ? entry.awards
    : (entry.award && entry.award !== 'None' ? [entry.award] : []);

  return (
    <GlassCard className="!p-5 md:!p-6">
      <div className="flex gap-4">
        <LogoTile entry={entry} />

        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-start justify-between gap-3">
            <p className="font-bold text-[15px] leading-snug" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}>
              {entry.conference_name}
            </p>
            <span
              className="flex-shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5"
              style={
                isVerified
                  ? { backgroundColor: 'rgba(27,56,40,0.09)', border: '1px solid rgba(27,56,40,0.28)', color: '#1B3828', fontFamily: MONO, fontSize: '8.5px', letterSpacing: '0.08em' }
                  : { backgroundColor: 'rgba(154,138,120,0.1)', border: '1px solid rgba(154,138,120,0.25)', color: '#9A8A78', fontFamily: MONO, fontSize: '8.5px', letterSpacing: '0.08em' }
              }
            >
              {isVerified && <BadgeCheck size={10} strokeWidth={2.4} />}
              {isVerified ? 'VERIFIED' : 'SELF-REPORTED'}
            </span>
          </div>

          {/* Committee · allocation */}
          <p className="text-[13px] mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: '#9A8A78', fontFamily: OUTFIT, margin: '4px 0 0 0' }}>
            {entry.committee}
            {entry.allocation && (
              <>
                <span style={{ color: '#DDD4C0' }}>·</span>
                <span className="inline-flex items-center gap-1.5" style={{ color: '#1C1410', fontWeight: 600 }}>
                  {allocFlag && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={allocFlag}
                      alt=""
                      style={{ width: '18px', height: '12px', objectFit: 'cover', borderRadius: '2px', boxShadow: '0 1px 2px rgba(27,56,40,0.2)' }}
                    />
                  )}
                  {entry.allocation}
                </span>
              </>
            )}
          </p>

          {/* Awards */}
          {displayAwards.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mt-2.5">
              {displayAwards.map((a) => <AwardChip key={a} name={a} />)}
            </div>
          )}

          {/* Photo strip */}
          {entry.photos.length > 0 && (
            <div className="flex gap-2 mt-3">
              {entry.photos.map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Conference photo"
                    style={{ width: '84px', height: '60px', objectFit: 'cover', borderRadius: '10px', border: '1px solid rgba(221,212,192,0.9)', boxShadow: '0 2px 8px rgba(27,56,40,0.08)' }}
                  />
                </a>
              ))}
            </div>
          )}

          {/* Footer: date, expertise, actions */}
          <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(221,212,192,0.5)' }}>
            <div className="flex items-center gap-2.5">
              <span className="text-xs" style={{ color: '#9A8A78', fontFamily: MONO }}>
                {dateStr}
              </span>
              {entry.expertise_level && (
                <span
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: 'rgba(27,56,40,0.06)', border: '1px solid rgba(27,56,40,0.16)', color: '#1B3828', fontFamily: MONO, fontSize: '8.5px', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                >
                  {entry.expertise_level}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onEdit}
                aria-label="Edit entry"
                className="flex items-center justify-center rounded-lg focus:outline-none transition-colors"
                style={{ width: '28px', height: '28px', background: 'none', border: 'none', color: '#9A8A78', cursor: 'pointer' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.07)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <Pencil size={13} strokeWidth={1.9} />
              </button>
              {!isVerified && (
                <button
                  onClick={onDelete}
                  disabled={deleting}
                  aria-label="Delete entry"
                  className="flex items-center justify-center rounded-lg focus:outline-none transition-colors"
                  style={{ width: '28px', height: '28px', background: 'none', border: 'none', color: deleting ? '#DDD4C0' : '#9A8A78', cursor: 'pointer' }}
                  onMouseEnter={(e) => { if (!deleting) { (e.currentTarget as HTMLElement).style.color = '#8B2020'; (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.07)'; } }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <Trash2 size={13} strokeWidth={1.9} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function CVPage() {
  const { user, session, loading: authLoading } = useAuth();
  const [entries, setEntries]       = useState<CVEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modalEntry, setModalEntry] = useState<CVEntry | null>(null);
  const [modalOpen, setModalOpen]   = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('mun_cv_entries')
      .select('id, conference_name, committee, allocation, expertise_level, award, awards, photos, logo_url, conference_id, source, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    const rows = ((data as CVEntry[]) ?? []).map((r) => ({
      ...r,
      awards: r.awards ?? [],
      photos: r.photos ?? [],
    }));
    setEntries(rows);
    setLoading(false);
    // Keep profiles.mun_experience_level in sync with the CV count.
    syncExperienceLevel(supabase, user.id, rows.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, session?.access_token]);

  useEffect(() => {
    if (authLoading) return;
    fetchEntries();
  }, [authLoading, fetchEntries]);

  async function handleDelete(id: string) {
    if (!session || !user) return;
    setDeletingId(id);
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('mun_cv_entries').delete().eq('id', id);
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    setDeletingId(null);
    syncExperienceLevel(supabase, user.id, next.length);
  }

  const totalConferences = entries.length;
  const totalAwards = entries.reduce((sum, e) => {
    if (e.awards.length > 0) return sum + e.awards.length;
    return sum + (e.award && e.award !== 'None' ? 1 : 0);
  }, 0);
  const totalVerified = entries.filter((e) => e.source === 'gavelling_verified').length;
  const exp = experienceProgress(totalConferences);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <Eyebrow className="mb-2">Delegate Record</Eyebrow>
          <h1
            className="font-black text-[26px] mb-1"
            style={{ color: '#1C1410', fontFamily: OUTFIT, letterSpacing: '-0.01em' }}
          >
            MUN CV
          </h1>
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT, margin: 0 }}>
            Your Model UN conference history — typeset, verified, and yours.
          </p>
        </div>
        <button
          onClick={() => { setModalEntry(null); setModalOpen(true); }}
          className="flex-shrink-0 rounded-xl py-2.5 px-5 font-bold text-[12px] focus:outline-none transition-colors"
          style={{
            backgroundColor: '#1B3828',
            color: '#EED98A',
            fontFamily: OUTFIT,
            letterSpacing: '0.08em',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
        >
          ADD ENTRY
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'CONFERENCES', value: String(totalConferences) },
          { label: 'AWARDS', value: String(totalAwards) },
          { label: 'VERIFIED', value: String(totalVerified) },
          { label: 'EXPERIENCE', value: exp.label },
        ].map((stat) => (
          <GlassCard key={stat.label} className="!p-4 text-center">
            <p
              className="font-black"
              style={{ color: '#1C1410', fontFamily: stat.label === 'EXPERIENCE' ? OUTFIT : MONO, fontSize: stat.label === 'EXPERIENCE' ? '17px' : '24px', lineHeight: 1.3, margin: 0 }}
            >
              {stat.value}
            </p>
            <p className="mt-1" style={{ color: '#B6871F', fontFamily: MONO, fontSize: '8.5px', letterSpacing: '0.22em', margin: '4px 0 0 0' }}>
              {stat.label}
            </p>
          </GlassCard>
        ))}
      </div>

      {/* Experience progress hint */}
      <div
        className="rounded-2xl px-5 py-3.5 mb-8 flex items-center gap-4"
        style={{
          backgroundColor: 'rgba(238,217,138,0.14)',
          border: '1px solid rgba(182,135,31,0.28)',
        }}
      >
        <div className="flex-1 min-w-0">
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: '5px', backgroundColor: 'rgba(221,212,192,0.6)' }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.round(exp.progress * 100)}%`, background: 'linear-gradient(90deg, #B6871F, #EED98A)', transition: 'width 400ms ease' }}
            />
          </div>
        </div>
        <p className="flex-shrink-0" style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.1em', color: '#7A5A20', margin: 0 }}>
          {exp.nextLabel
            ? `${exp.remaining} MORE CONFERENCE${exp.remaining === 1 ? '' : 'S'} TO ${exp.nextLabel.toUpperCase()}`
            : 'EXPERT — TOP TIER REACHED'}
        </p>
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <GlassCard className="text-center !py-14">
          <p className="text-lg font-bold mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            No entries yet
          </p>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.7 }}>
            Add your past conferences manually — or they&apos;ll appear automatically when you attend Gavelling-verified conferences.
          </p>
          <button
            onClick={() => { setModalEntry(null); setModalOpen(true); }}
            className="rounded-xl py-2.5 px-6 font-bold text-[13px] focus:outline-none transition-colors"
            style={{
              backgroundColor: '#1B3828',
              color: '#EED98A',
              fontFamily: OUTFIT,
              letterSpacing: '0.08em',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            ADD YOUR FIRST ENTRY →
          </button>
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-3.5">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              deleting={deletingId === entry.id}
              onEdit={() => { setModalEntry(entry); setModalOpen(true); }}
              onDelete={() => handleDelete(entry.id)}
            />
          ))}
        </div>
      )}

      {modalOpen && user && (
        <CVEntryModal
          existing={modalEntry}
          userId={user.id}
          onClose={() => { setModalOpen(false); setModalEntry(null); }}
          onSaved={fetchEntries}
        />
      )}
    </div>
  );
}
