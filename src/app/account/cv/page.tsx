'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BadgeCheck, ImagePlus, Pencil, Trash2, X, Check, Plus, TrendingUp, User, Gavel, Briefcase, Sparkles, MessageSquareText } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase as anonClient } from '@/lib/supabase';
import { UN_COUNTRIES, getCountryByName, getFlagUrl } from '@/lib/countries';
import { experienceProgress, syncExperienceLevel } from '@/lib/munExperience';
import { COMMITTEE_PRESETS } from '@/components/CommitteeNameInput';
import { LogoDisc } from '@/components/LogoDisc';
import {
  Eyebrow, GlassCard, Pill, LevelBadge, LEVEL_TONE, AwardChip, AwardArtwork, AWARD_LIST,
  ExperienceInfo, getCommitteeLogo, monogramFor, OUTFIT, MONO,
} from '../accountUi';

type EntryType = 'delegate' | 'chair' | 'secretariat' | 'other';

interface CVEntry {
  id: string;
  entry_type: EntryType;
  conference_name: string;
  committee: string;
  allocation: string;
  expertise_level: string | null;
  award: string;
  awards: string[];
  photos: string[];
  description: string | null;
  logo_url: string | null;
  conference_id: string | null;
  event_date: string | null;
  source: 'gavelling_verified' | 'manual';
  created_at: string;
}

// ── Entry-type config ────────────────────────────────────────────────────────
// Each experience type has its own accent, corner-badge glyph, card border and
// role chip, so the timeline reads by role at a glance (delegate=forest,
// chair=gold, secretariat=plum, other=muted parchment).

const ENTRY_TYPES: {
  key: EntryType;
  label: string;
  Icon: typeof Gavel;
  accent: string;     // icon / accent colour
  border: string;     // card border tint
  discBg: string;     // corner disc — fully opaque tier fill (like landing gavel discs)
  discGlyph: string;  // glyph colour on the disc
  chipBg: string;     // solid role chip fill
  chipText: string;   // role chip text colour
  chipBorder: string; // role chip border
}[] = [
  { key: 'delegate',    label: 'Delegate',    Icon: User,      accent: '#2A5A3C', border: '#C8BEA8',               discBg: 'linear-gradient(145deg, #2F6242 0%, #1B3828 100%)',              discGlyph: '#EED98A', chipBg: '#1B3828', chipText: '#EED98A', chipBorder: 'rgba(238,217,138,0.4)' },
  { key: 'chair',       label: 'Chair',       Icon: Gavel,     accent: '#B6871F', border: 'rgba(182,135,31,0.6)',  discBg: 'linear-gradient(145deg, #F3E3A1 0%, #EED98A 45%, #C99A2A 100%)', discGlyph: '#4A3410', chipBg: '#EED98A', chipText: '#5A4210', chipBorder: 'rgba(182,135,31,0.55)' },
  { key: 'secretariat', label: 'Secretariat', Icon: Briefcase, accent: '#8A6BA0', border: 'rgba(108,74,120,0.55)', discBg: 'linear-gradient(145deg, #9E7FB4 0%, #6C4A78 100%)',              discGlyph: '#FAF8F3', chipBg: '#8A6BA0', chipText: '#FAF8F3', chipBorder: 'rgba(108,74,120,0.55)' },
  { key: 'other',       label: 'Other',       Icon: Sparkles,  accent: '#6E5F4E', border: 'rgba(154,138,120,0.55)', discBg: 'linear-gradient(145deg, #A89880 0%, #7C6C58 100%)',             discGlyph: '#FAF8F3', chipBg: '#DDD4C0', chipText: '#5C5140', chipBorder: 'rgba(154,138,120,0.5)' },
];

const ENTRY_TYPE_MAP: Record<EntryType, typeof ENTRY_TYPES[number]> =
  Object.fromEntries(ENTRY_TYPES.map((t) => [t.key, t])) as Record<EntryType, typeof ENTRY_TYPES[number]>;

// Committee suggestions shared with the conference setup flow.
const COMMITTEE_SUGGESTIONS = COMMITTEE_PRESETS.map((p) => ({ name: p.name, acronym: p.acronym, logoPath: p.logoPath }));

interface ConferenceSuggestion {
  kind: 'gavelling' | 'community';
  name: string;
  acronym: string | null;
  logoUrl: string | null;
  conferenceId: string | null;
  city: string | null;
  country: string | null;
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

// ── Logo tiles ─────────────────────────────────────────────────────────────

/** Large PRIMARY tile — the conference's own logo (logo_url) inside the
 *  universal LogoDisc treatment, monogram fallback. */
function ConferenceLogo({ entry, size = 64 }: { entry: Pick<CVEntry, 'logo_url' | 'conference_name'>; size?: number }) {
  return (
    <LogoDisc
      src={entry.logo_url}
      alt={entry.conference_name}
      size={size}
      fallbackText={monogramFor(entry.conference_name)}
    />
  );
}

/** Small SECONDARY committee logo shown inline beside the committee name. */
function CommitteeLogo({ committee, size = 18 }: { committee: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = getCommitteeLogo(committee);
  if (!src || failed) return null;
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '5px',
        backgroundColor: 'rgba(250,248,243,0.95)', border: '1px solid rgba(221,212,192,0.9)', padding: '2px',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </span>
  );
}

// ── Labelled field wrapper ───────────────────────────────────────────────────

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
        {label}
        {optional && <span className="ml-2 font-normal" style={{ color: '#9A8A78', fontSize: '11px' }}>optional</span>}
      </label>
      {children}
    </div>
  );
}

// ── Committee autocomplete (shares COMMITTEE_PRESETS with setup) ──────────────

function CommitteeAutocomplete({
  value, onChange, disabled, placeholder = 'e.g. UN Security Council',
}: { value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return COMMITTEE_SUGGESTIONS.filter((p) => p.name.toLowerCase().includes(q) || p.acronym.toLowerCase().includes(q)).slice(0, 6);
  }, [value]);

  return (
    <div className="relative">
      <input
        type="text"
        required
        disabled={disabled}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        placeholder={placeholder}
        className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
        style={{ ...inputStyle, opacity: disabled ? 0.55 : 1, cursor: disabled ? 'not-allowed' : 'text' }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; setOpen(true); }}
        onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; setTimeout(() => setOpen(false), 150); }}
      />
      {open && matches.length > 0 && (
        <div
          className="absolute z-30 left-0 right-0 mt-1.5 rounded-xl overflow-hidden"
          style={{ backgroundColor: 'rgba(250,248,243,0.98)', border: '1px solid #DDD4C0', boxShadow: '0 16px 40px rgba(27,56,40,0.16)' }}
        >
          {matches.map((p) => (
            <button
              key={p.name}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(p.name); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left focus:outline-none"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.logoPath} alt="" width={20} height={20} className="rounded-sm shrink-0 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
              <span className="flex-1 min-w-0 truncate text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT, fontWeight: 500 }}>{p.name}</span>
              <span style={{ color: '#1B3828', fontFamily: MONO, fontSize: '10px', fontWeight: 700 }}>{p.acronym}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Country / allocation autocomplete (UN_COUNTRIES) ──────────────────────────

function AllocationAutocomplete({
  value, onChange, disabled,
}: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const allocCountry = getCountryByName(value);
  const allocFlag = allocCountry ? getFlagUrl(allocCountry.code) : null;
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return UN_COUNTRIES.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [value]);

  return (
    <div className="relative">
      {allocFlag && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={allocFlag}
          alt={value}
          className="absolute pointer-events-none z-10"
          style={{ left: '14px', top: '22px', transform: 'translateY(-50%)', width: '22px', height: '15px', objectFit: 'cover', borderRadius: '2.5px', boxShadow: '0 1px 3px rgba(27,56,40,0.25)' }}
        />
      )}
      <input
        type="text"
        required
        disabled={disabled}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        placeholder="e.g. China, EU Observer"
        className="w-full rounded-xl py-3 text-sm focus:outline-none"
        style={{ ...inputStyle, paddingLeft: allocFlag ? '46px' : '16px', paddingRight: '16px', opacity: disabled ? 0.55 : 1, cursor: disabled ? 'not-allowed' : 'text' }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; setOpen(true); }}
        onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; setTimeout(() => setOpen(false), 150); }}
      />
      {open && matches.length > 0 && (
        <div
          className="absolute z-30 left-0 right-0 mt-1.5 rounded-xl overflow-y-auto"
          style={{ maxHeight: '224px', backgroundColor: 'rgba(250,248,243,0.98)', border: '1px solid #DDD4C0', boxShadow: '0 16px 40px rgba(27,56,40,0.16)' }}
        >
          {matches.map((c) => (
            <button
              key={c.code}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(c.name); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm focus:outline-none"
              style={{ background: 'none', border: 'none', color: '#1C1410', fontFamily: OUTFIT, cursor: 'pointer' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getFlagUrl(c.code)} alt="" style={{ width: '20px', height: '14px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }} />
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Month + Year picker (replaces the native date input) ──────────────────────

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function MonthYearPicker({ value, onChange }: { value: string; onChange: (isoDate: string) => void }) {
  // value is an ISO date string (YYYY-MM-DD) or ''. We edit month + year.
  const now = new Date();
  const currentYear = now.getFullYear();
  const selMonth = value ? Number(value.slice(5, 7)) - 1 : -1; // 0-based
  const selYear = value ? Number(value.slice(0, 4)) : -1;
  const years: number[] = [];
  for (let y = currentYear; y >= currentYear - 30; y--) years.push(y);

  function emit(monthIdx: number, year: number) {
    if (monthIdx < 0 || year < 0) { onChange(''); return; }
    const mm = String(monthIdx + 1).padStart(2, '0');
    onChange(`${year}-${mm}-01`); // store the 1st of the chosen month
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%239A8A78\' stroke-width=\'2.4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'/></svg>")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    cursor: 'pointer',
  };

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <select
        value={selMonth}
        onChange={(e) => emit(Number(e.target.value), selYear >= 0 ? selYear : currentYear)}
        className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
        style={selectStyle}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
      >
        <option value={-1}>Month</option>
        {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
      </select>
      <select
        value={selYear}
        onChange={(e) => emit(selMonth >= 0 ? selMonth : 0, Number(e.target.value))}
        className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
        style={selectStyle}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
      >
        <option value={-1}>Year</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

// ── Description textarea (LinkedIn-style short blurb) ──────────────────────────

const DESCRIPTION_MAX = 400;

function DescriptionField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          <MessageSquareText size={13} strokeWidth={2} style={{ color: '#B6871F' }} />
          Description
          <span className="font-normal" style={{ color: '#9A8A78', fontSize: '11px' }}>optional</span>
        </label>
        <span style={{ fontFamily: MONO, fontSize: '10px', color: value.length > DESCRIPTION_MAX ? '#8B2020' : '#9A8A78' }}>
          {value.length}/{DESCRIPTION_MAX}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, DESCRIPTION_MAX))}
        rows={3}
        placeholder={placeholder}
        className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
        style={{ ...inputStyle, lineHeight: 1.65 }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
      />
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

  const [entryType, setEntryType]           = useState<EntryType>(existing?.entry_type ?? 'delegate');
  const [conferenceName, setConferenceName] = useState(existing?.conference_name ?? '');
  const [committee, setCommittee]           = useState(existing?.committee ?? '');
  const [allocation, setAllocation]         = useState(existing?.allocation ?? '');
  const [roleTitle, setRoleTitle]           = useState(
    // Secretariat/other store their free-text title in the `allocation` column
    // (delegate=country, chair=n/a). Seed from allocation for those types.
    (existing && (existing.entry_type === 'secretariat' || existing.entry_type === 'other')) ? existing.allocation : '',
  );
  const [expertiseLevel, setExpertiseLevel] = useState(existing?.expertise_level ?? '');
  const [eventDate, setEventDate]           = useState(existing?.event_date ?? '');
  const [awards, setAwards]                 = useState<string[]>(existing?.awards ?? []);
  const [photos, setPhotos]                 = useState<string[]>(existing?.photos ?? []);
  const [description, setDescription]       = useState(existing?.description ?? '');
  const [logoUrl, setLogoUrl]               = useState<string | null>(existing?.logo_url ?? null);
  const [conferenceId, setConferenceId]     = useState<string | null>(existing?.conference_id ?? null);
  const [submitting, setSubmitting]         = useState(false);
  const [uploading, setUploading]           = useState(false);
  const [error, setError]                   = useState('');

  const showCommittee  = entryType === 'delegate' || entryType === 'chair';
  const showAllocation = entryType === 'delegate';
  const showAwards     = entryType === 'delegate';
  const showExpertise  = entryType === 'delegate';
  const showRoleTitle  = entryType === 'secretariat' || entryType === 'other';

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
            .select('id, full_name, acronym, logo_url, city, country')
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

        for (const c of (confRes.data ?? []) as { id: string; full_name: string; acronym: string | null; logo_url: string | null; city: string | null; country: string | null }[]) {
          const key = c.full_name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          results.push({ kind: 'gavelling', name: c.full_name, acronym: c.acronym, logoUrl: c.logo_url, conferenceId: c.id, city: c.city, country: c.country });
        }
        for (const r of (cvRes.data ?? []) as { conference_name: string; logo_url: string | null }[]) {
          const key = r.conference_name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          results.push({ kind: 'community', name: r.conference_name, acronym: null, logoUrl: r.logo_url, conferenceId: null, city: null, country: null });
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
    // Import the matched conference's logo as THIS entry's conference image.
    setLogoUrl(s.logoUrl);
    setConferenceId(s.conferenceId);
    setSuggestions([]);
    setSuggestOpen(false);
  }

  /**
   * When the user typed a name (and optionally a location in the committee /
   * allocation fields) that matches an existing Gavelling conference or a
   * community CV entry, resolve and import that conference's logo automatically.
   * Any conference matching the same name gets the same logo as the current
   * edition. Only fills in a logo when one is not already set.
   */
  async function resolveConferenceLogo(): Promise<string | null> {
    if (logoUrl || isVerified) return logoUrl;
    const name = conferenceName.trim();
    if (name.length < 2) return null;
    // Strip a trailing edition year / ordinal so "LIMUN 2023" resolves against
    // the LIMUN series and inherits whatever edition currently has a logo on
    // Gavelling (e.g. LIMUN 2027). The base is what identifies the conference
    // across editions; the year only picks an instance.
    const base = name
      .replace(/\b(19|20)\d{2}\b/g, '')
      .replace(/\b(x+|\d+(st|nd|rd|th))\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || name;
    const clean = (s: string) => s.replace(/[%_,()]/g, '');
    try {
      const like = `%${clean(base)}%`;
      const { data: confs } = await anonClient
        .from('conferences')
        .select('full_name, acronym, logo_url, city, country, start_date')
        .or(`full_name.ilike.${like},acronym.ilike.${like}`)
        .not('logo_url', 'is', null)
        .order('start_date', { ascending: false }) // newest edition's logo first
        .limit(12);
      const loc = `${committee} ${allocation}`.toLowerCase();
      const baseLc = base.toLowerCase();
      const rows = (confs ?? []) as { full_name: string; acronym: string | null; logo_url: string | null; city: string | null; country: string | null }[];
      // Prefer: same acronym → row located by city/country → newest match.
      const acronymMatch = rows.find((c) => c.acronym && baseLc.includes(c.acronym.toLowerCase()));
      const located = rows.find((c) =>
        (c.city && loc.includes(c.city.toLowerCase())) ||
        (c.country && loc.includes(c.country.toLowerCase())),
      );
      const pick = acronymMatch ?? located ?? rows[0];
      if (pick?.logo_url) return pick.logo_url;
      // Fall back to a matching community CV entry's logo.
      const { data: cv } = await anonClient
        .from('mun_cv_entries')
        .select('logo_url')
        .ilike('conference_name', `%${clean(base)}%`)
        .not('logo_url', 'is', null)
        .neq('user_id', userId)
        .limit(1);
      const cvRow = (cv ?? [])[0] as { logo_url: string | null } | undefined;
      return cvRow?.logo_url ?? null;
    } catch {
      return null;
    }
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
    // Required fields vary by type. `committee` / `allocation` are NOT NULL in
    // the DB, so we always send at least an empty string for types that omit
    // them (the free-text role title reuses the `allocation` column).
    if (!conferenceName.trim()) {
      setError('Please add the conference name.');
      return;
    }
    if (showCommittee && !committee.trim()) {
      setError(entryType === 'chair' ? 'Please add the committee you chaired.' : 'Please add the committee.');
      return;
    }
    if (showAllocation && !allocation.trim()) {
      setError('Please add your country / allocation.');
      return;
    }
    if (showRoleTitle && !roleTitle.trim()) {
      setError(entryType === 'secretariat' ? 'Please add your Secretariat position.' : 'Please add your role title.');
      return;
    }
    if (!session) return;
    setSubmitting(true);
    setError('');
    const supabase = getAuthedClient(session.access_token);

    // Auto-import a matching conference logo if the user typed a name without
    // picking a suggestion.
    const resolvedLogo = await resolveConferenceLogo();

    // Map per-type fields onto the shared columns.
    const committeeVal  = showCommittee ? committee : '';
    const allocationVal = showAllocation ? allocation : (showRoleTitle ? roleTitle : '');
    const awardsVal     = showAwards ? awards : [];

    const payload = {
      entry_type:      entryType,
      conference_name: conferenceName,
      committee:       committeeVal,
      allocation:      allocationVal,
      expertise_level: showExpertise ? (expertiseLevel || null) : null,
      event_date:      eventDate || null,
      awards:          awardsVal,
      award:           awardsVal[0] ?? 'None', // keep legacy column in sync for compat
      photos,
      description:     description.trim() || null,
      logo_url:        resolvedLogo,
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
          {/* Experience type selector */}
          <div>
            <label className="block text-[13px] font-semibold mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              Experience Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {ENTRY_TYPES.map((t) => {
                const active = entryType === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    disabled={isVerified}
                    onClick={() => setEntryType(t.key)}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl py-2.5 focus:outline-none transition-all"
                    style={{
                      border: active ? `1.5px solid ${t.accent}` : '1px solid #DDD4C0',
                      backgroundColor: active ? `${t.accent}14` : 'transparent',
                      cursor: isVerified ? 'not-allowed' : 'pointer',
                      opacity: isVerified && !active ? 0.5 : 1,
                    }}
                  >
                    <t.Icon size={17} strokeWidth={2} style={{ color: active ? t.accent : '#9A8A78' }} />
                    <span style={{ fontFamily: OUTFIT, fontSize: '11.5px', fontWeight: 700, color: active ? '#1C1410' : '#9A8A78' }}>
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conference name + suggestions */}
          <div className="relative">
            <label className="block text-[13px] font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              Conference Name
            </label>
            <div className="flex items-center gap-2.5">
              {logoUrl && (
                <LogoDisc src={logoUrl} size={34} fallbackText={monogramFor(conferenceName)} />
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
                      <LogoDisc src={s.logoUrl} size={26} fallbackText={monogramFor(s.name)} />
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
                    <span className="flex-shrink-0">
                      <Pill tone={s.kind === 'gavelling' ? 'forest' : 'neutral'} size="sm">
                        {s.kind === 'gavelling' ? 'On Gavelling' : 'Community'}
                      </Pill>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Committee — delegate + chair */}
          {showCommittee && (
            <Field label={entryType === 'chair' ? 'Committee Chaired' : 'Committee'}>
              <CommitteeAutocomplete
                value={committee}
                onChange={setCommittee}
                disabled={isVerified}
                placeholder={entryType === 'chair' ? 'e.g. UN Security Council' : 'e.g. UN Security Council'}
              />
            </Field>
          )}

          {/* Allocation — delegate only */}
          {showAllocation && (
            <Field label="Country / Portfolio / Allocation">
              <AllocationAutocomplete value={allocation} onChange={setAllocation} disabled={isVerified} />
            </Field>
          )}

          {/* Role title — secretariat + other */}
          {showRoleTitle && (
            <Field label={entryType === 'secretariat' ? 'Position / Title' : 'Role Title'}>
              <input
                type="text"
                required
                disabled={isVerified}
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder={entryType === 'secretariat' ? 'e.g. Under-Secretary-General for Committees' : 'e.g. Press Corps, Tech Team, Volunteer'}
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                style={{ ...inputStyle, opacity: isVerified ? 0.55 : 1, cursor: isVerified ? 'not-allowed' : 'text' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
              />
            </Field>
          )}

          {/* When was it? — Month + Year */}
          <div>
            <label className="block text-[13px] font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              When was it?
              <span className="ml-2 font-normal" style={{ color: '#9A8A78', fontSize: '11px' }}>optional</span>
            </label>
            <MonthYearPicker value={eventDate} onChange={setEventDate} />
            <p className="text-xs mt-1.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
              Used to order your CV timeline, most recent first.
            </p>
          </div>

          {/* Description — every type */}
          <DescriptionField
            value={description}
            onChange={setDescription}
            placeholder={
              entryType === 'chair'   ? 'What did your committee debate? Any standout moments?' :
              entryType === 'secretariat' ? 'What did you organise or oversee?' :
              entryType === 'other'   ? 'Describe what you did in this role.' :
              'Describe your role, the topic, and how you did.'
            }
          />

          {/* Expertise level — delegate only */}
          {showExpertise && (
            <div>
              <label className="block text-[13px] font-semibold mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                Expertise Level
              </label>
              <div className="flex gap-2 flex-wrap">
                {EXPERTISE_LEVELS_MODAL.map((lvl) => {
                  const active = expertiseLevel === lvl;
                  const tone = LEVEL_TONE[lvl] ?? 'forest';
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setExpertiseLevel(active ? '' : lvl)}
                      className="focus:outline-none transition-all"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', opacity: active ? 1 : 0.6 }}
                    >
                      <Pill tone={active ? tone : 'neutral'} size="sm">
                        <span style={{ textTransform: 'capitalize' }}>{lvl}</span>
                      </Pill>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Awards multi-select — delegate only (chairs award, not awarded) */}
          {showAwards && (
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
          )}

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

function TimelineEntry({
  entry,
  onEdit,
  onDelete,
  deleting,
  isLast,
}: {
  entry: CVEntry;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
  isLast: boolean;
}) {
  const isVerified = entry.source === 'gavelling_verified';
  const type = ENTRY_TYPE_MAP[entry.entry_type] ?? ENTRY_TYPE_MAP.delegate;
  // Date lives on the timeline rail (under the logo), not inside the card.
  // Undated entries show an em-dash rather than leaking created_at.
  const railDate = entry.event_date
    ? new Date(`${entry.event_date}T00:00:00`).toLocaleDateString('en', { month: 'short', year: 'numeric' }).toUpperCase()
    : '—';

  const allocCountry = entry.allocation ? getCountryByName(entry.allocation) : null;
  const allocFlag = allocCountry ? getFlagUrl(allocCountry.code) : null;

  // Awards only ever surface for delegate entries.
  const displayAwards = entry.entry_type === 'delegate'
    ? (entry.awards.length > 0 ? entry.awards : (entry.award && entry.award !== 'None' ? [entry.award] : []))
    : [];

  return (
    <div className="relative flex gap-4 md:gap-5">
      {/* Timeline rail: big conference logo + date + connecting line */}
      <div className="relative flex flex-col items-center flex-shrink-0" style={{ width: '64px' }}>
        <ConferenceLogo entry={entry} size={64} />
        <span
          className="mt-1.5 text-center whitespace-nowrap"
          style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.06em', color: '#8A7A66', lineHeight: 1.3 }}
        >
          {railDate}
        </span>
        {!isLast && (
          <div
            aria-hidden
            className="flex-1 mt-2"
            style={{ width: '2px', minHeight: '24px', background: 'linear-gradient(180deg, rgba(200,190,168,0.95), rgba(200,190,168,0.35))', borderRadius: '9999px' }}
          />
        )}
      </div>

      {/* Content card */}
      <div className="flex-1 min-w-0 pb-6">
        <GlassCard className="!p-5 md:!p-6 relative" style={{ border: `1.5px solid ${type.border}` }}>
          {/* Corner type badge — fully opaque tier disc, like the landing's gavel discs */}
          <span
            className="absolute flex items-center justify-center"
            title={type.label}
            style={{
              top: '-12px', right: '14px', width: '32px', height: '32px', borderRadius: '9999px',
              background: type.discBg,
              border: '2px solid #FAF8F3',
              boxShadow: `0 4px 12px ${type.accent}55, 0 0 0 1px ${type.accent}40`,
            }}
          >
            <type.Icon size={15} strokeWidth={2.2} style={{ color: type.discGlyph }} />
          </span>

          {/* Role chip + verification */}
          <div className="flex items-center justify-between gap-3 mb-2 pr-9">
            <span
              className="inline-flex items-center gap-1.5 flex-shrink-0"
              style={{
                padding: '3px 10px',
                borderRadius: '7px',
                backgroundColor: type.chipBg,
                border: `1px solid ${type.chipBorder}`,
                color: type.chipText,
                fontFamily: OUTFIT,
                fontSize: '10.5px',
                fontWeight: 800,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
              }}
            >
              <type.Icon size={11} strokeWidth={2.4} />
              {type.label}
            </span>
            <span className="flex-shrink-0">
              <Pill
                tone={isVerified ? 'forest' : 'neutral'}
                dot={!isVerified}
                icon={isVerified ? <BadgeCheck size={12} strokeWidth={2.4} /> : undefined}
                size="sm"
              >
                {isVerified ? 'Verified' : 'Self-reported'}
              </Pill>
            </span>
          </div>

          {/* Conference name — colored heading */}
          <h3
            className="font-black leading-tight"
            style={{ color: '#1B3828', fontFamily: OUTFIT, fontSize: '18px', letterSpacing: '-0.01em', margin: 0 }}
          >
            {entry.conference_name}
          </h3>

          {/* Role line — varies by type */}
          {entry.entry_type === 'delegate' && (
            <>
              <div className="flex items-center gap-1.5 flex-wrap mt-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                <User size={14} strokeWidth={2.2} style={{ color: type.accent, flexShrink: 0 }} />
                <span className="inline-flex items-center gap-1.5 text-[14px]" style={{ fontWeight: 600 }}>
                  {allocFlag && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={allocFlag}
                      alt=""
                      style={{ width: '20px', height: '13px', objectFit: 'cover', borderRadius: '2.5px', boxShadow: '0 1px 2px rgba(27,56,40,0.2)' }}
                    />
                  )}
                  {entry.allocation}
                </span>
              </div>
              {entry.committee && (
                <div className="flex items-center gap-1.5 mt-1.5 text-[13px]" style={{ color: '#6E5F4E', fontFamily: OUTFIT }}>
                  <CommitteeLogo committee={entry.committee} size={18} />
                  <span>{entry.committee}</span>
                </div>
              )}
            </>
          )}

          {entry.entry_type === 'chair' && entry.committee && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2 text-[14px]" style={{ color: '#1C1410', fontFamily: OUTFIT, fontWeight: 600 }}>
              <Gavel size={14} strokeWidth={2} style={{ color: type.accent, flexShrink: 0 }} />
              <CommitteeLogo committee={entry.committee} size={18} />
              <span>Chaired {entry.committee}</span>
            </div>
          )}

          {(entry.entry_type === 'secretariat' || entry.entry_type === 'other') && entry.allocation && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2 text-[14px]" style={{ color: '#1C1410', fontFamily: OUTFIT, fontWeight: 600 }}>
              <type.Icon size={14} strokeWidth={2} style={{ color: type.accent, flexShrink: 0 }} />
              <span>{entry.allocation}</span>
            </div>
          )}

          {/* Description — LinkedIn-style blurb */}
          {entry.description && (
            <p className="text-[13px] mt-2.5" style={{ color: '#4A4038', fontFamily: OUTFIT, lineHeight: 1.6, margin: '10px 0 0 0' }}>
              {entry.description}
            </p>
          )}

          {/* Awards + expertise (delegate only) */}
          {(displayAwards.length > 0 || (entry.entry_type === 'delegate' && entry.expertise_level)) && (
            <div className="flex gap-1.5 flex-wrap mt-3 items-center">
              {displayAwards.map((a) => <AwardChip key={a} name={a} />)}
              {entry.entry_type === 'delegate' && entry.expertise_level && <LevelBadge level={entry.expertise_level} size="sm" />}
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

          {/* Actions */}
          <div className="flex items-center justify-end gap-1 mt-3 pt-3" style={{ borderTop: '1px solid rgba(221,212,192,0.5)' }}>
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
        </GlassCard>
      </div>
    </div>
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
      .select('id, entry_type, conference_name, committee, allocation, expertise_level, award, awards, photos, description, logo_url, conference_id, event_date, source, created_at')
      .eq('user_id', user.id);
    const rows = ((data as CVEntry[]) ?? []).map((r) => ({
      ...r,
      entry_type: r.entry_type ?? 'delegate',
      awards: r.awards ?? [],
      photos: r.photos ?? [],
    }));
    // Timeline order: most recent first. Prefer event_date; fall back to
    // created_at so undated entries still sort sensibly (near the bottom).
    rows.sort((a, b) => {
      const da = new Date(a.event_date ? `${a.event_date}T00:00:00` : a.created_at).getTime();
      const db = new Date(b.event_date ? `${b.event_date}T00:00:00` : b.created_at).getTime();
      return db - da;
    });
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
            Your Model UN conference history: typeset, verified, and yours.
          </p>
        </div>
        <button
          onClick={() => { setModalEntry(null); setModalOpen(true); }}
          aria-label="Add a conference to your CV"
          title="Add conference"
          className="flex items-center justify-center flex-shrink-0 rounded-full focus:outline-none transition-all"
          style={{
            width: '58px',
            height: '58px',
            background: 'radial-gradient(120% 120% at 30% 25%, #2A5A3C 0%, #1B3828 70%)',
            color: '#EED98A',
            border: '1px solid rgba(238,217,138,0.4)',
            boxShadow: '0 8px 22px rgba(27,56,40,0.28), inset 0 1px 0 rgba(238,217,138,0.25)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.07)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 30px rgba(27,56,40,0.34), inset 0 1px 0 rgba(238,217,138,0.3)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 22px rgba(27,56,40,0.28), inset 0 1px 0 rgba(238,217,138,0.25)'; }}
        >
          <Plus size={26} strokeWidth={2.6} />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'CONFERENCES', value: String(totalConferences), isExp: false },
          { label: 'AWARDS', value: String(totalAwards), isExp: false },
          { label: 'VERIFIED', value: String(totalVerified), isExp: false },
          { label: 'EXPERIENCE', value: exp.label, isExp: true },
        ].map((stat) => (
          <GlassCard key={stat.label} className="!p-4 text-center">
            {stat.isExp ? (
              <div className="flex items-center justify-center" style={{ minHeight: '31px' }}>
                <LevelBadge level={exp.level} size="sm" />
              </div>
            ) : (
              <p
                className="font-black"
                style={{ color: '#1C1410', fontFamily: MONO, fontSize: '24px', lineHeight: 1.3, margin: 0 }}
              >
                {stat.value}
              </p>
            )}
            <p className="mt-1" style={{ color: '#B6871F', fontFamily: MONO, fontSize: '8.5px', letterSpacing: '0.22em', margin: '4px 0 0 0' }}>
              {stat.label}
            </p>
          </GlassCard>
        ))}
      </div>

      {/* Rank-up info panel — thresholds live behind the 'i' (ExperienceInfo). */}
      <div
        className="rounded-2xl px-5 py-4 mb-8"
        style={{ backgroundColor: 'rgba(238,217,138,0.14)', border: '1.5px solid rgba(182,135,31,0.35)' }}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} strokeWidth={2.4} style={{ color: '#B6871F' }} />
            <p className="font-bold text-[13px]" style={{ color: '#7A5A20', fontFamily: OUTFIT, margin: 0 }}>
              Your experience level
            </p>
          </div>
          <ExperienceInfo tone="light" align="right" currentLevel={exp.level} />
        </div>

        {/* Progress toward next rank */}
        <div className="w-full rounded-full overflow-hidden mb-1.5" style={{ height: '6px', backgroundColor: 'rgba(221,212,192,0.6)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.round(exp.progress * 100)}%`, background: 'linear-gradient(90deg, #B6871F, #EED98A)', transition: 'width 400ms ease' }}
          />
        </div>
        <p className="text-[12px]" style={{ color: '#7A5A20', fontFamily: OUTFIT, margin: 0 }}>
          {exp.nextLabel
            ? `You're ${exp.label}. Add ${exp.remaining} more conference${exp.remaining === 1 ? '' : 's'} to reach ${exp.nextLabel}.`
            : `You've reached Expert, the top tier. Keep adding conferences to grow your record.`}
        </p>
      </div>

      {/* Entries — vertical timeline */}
      {entries.length === 0 ? (
        <GlassCard className="text-center !py-14">
          <p className="text-lg font-bold mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            No entries yet
          </p>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.7 }}>
            Add your past conferences manually, or they&apos;ll appear automatically when you attend Gavelling-verified conferences.
          </p>
          <button
            onClick={() => { setModalEntry(null); setModalOpen(true); }}
            aria-label="Add your first conference"
            className="flex items-center justify-center rounded-full focus:outline-none transition-all mx-auto"
            style={{
              width: '58px',
              height: '58px',
              background: 'radial-gradient(120% 120% at 30% 25%, #2A5A3C 0%, #1B3828 70%)',
              color: '#EED98A',
              border: '1px solid rgba(238,217,138,0.4)',
              boxShadow: '0 8px 22px rgba(27,56,40,0.28), inset 0 1px 0 rgba(238,217,138,0.25)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.07)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
          >
            <Plus size={26} strokeWidth={2.6} />
          </button>
          <p className="text-[12px] mt-3" style={{ color: '#B6871F', fontFamily: MONO, letterSpacing: '0.1em', margin: '12px 0 0 0' }}>
            ADD YOUR FIRST ENTRY
          </p>
        </GlassCard>
      ) : (
        <div className="flex flex-col">
          {entries.map((entry, i) => (
            <TimelineEntry
              key={entry.id}
              entry={entry}
              isLast={i === entries.length - 1}
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
