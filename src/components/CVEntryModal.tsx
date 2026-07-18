'use client';

/**
 * CVEntryModal — the shared "add / edit a MUN CV entry" modal.
 *
 * Extracted from src/app/account/cv/page.tsx so the SAME add-entry experience
 * (entry-type picker, conference name + logo autocomplete, committee
 * autocomplete over the fuller preset list, country/allocation autocomplete,
 * month+year picker, description, expertise slider, award tiers + special
 * award, photo upload) can be reused verbatim by:
 *   - the profile MUN CV page (src/app/account/cv/page.tsx), and
 *   - the auth onboarding "add past conferences" step (/auth/onboarding).
 *
 * Both writes go to `mun_cv_entries` identically (source: 'manual'). Session is
 * read from useAuth() — the root layout wraps the whole app (including /auth)
 * in AuthProvider, so this works in both contexts.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ImagePlus, Trash2, X, Check, Star, MessageSquareText, User, UserRound, Gavel, Hammer, Briefcase, ClipboardList, Sparkles } from 'lucide-react';
import { Emoji3D, NEU } from '@/components/neu';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase as anonClient } from '@/lib/supabase';
import { UN_COUNTRIES, getCountryByName, getFlagUrl } from '@/lib/countries';
import { CONFERENCE_COMMITTEE_PRESETS } from '@/components/ConferenceRosterPicker';
import { LogoDisc } from '@/components/LogoDisc';
import Portal from '@/components/Portal';
import {
  Eyebrow, Pill, LevelBadge, LEVEL_ACCENT, AwardArtwork, AWARD_LIST, isCustomAward,
  monogramFor, OUTFIT, MONO,
} from '@/app/account/accountUi';

export type EntryType = 'delegate' | 'chair' | 'secretariat' | 'other';

export interface CVEntry {
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

export const ENTRY_TYPES: {
  key: EntryType;
  label: string;
  Icon: typeof Gavel;   // lucide fallback for the 3D emoji
  emoji: string;        // Fluent 3D emoji asset name (job-board icon language)
  bleedIcon: typeof Gavel; // faded, blended background silhouette (behind card)
  bleedRotate: number;  // slight tilt so the bleed reads as texture
  accent: string;     // icon / accent colour
  border: string;     // card border tint
  discBg: string;     // corner disc — soft tinted seat for the 3D emoji
  discGlyph: string;  // fallback glyph colour on the disc
  chipInk: string;    // readable role-chip text on the soft neu pill
  chipBg: string;     // solid role chip fill (legacy, retained for reference)
  chipText: string;   // role chip text colour
  chipBorder: string; // role chip border
}[] = [
  { key: 'delegate',    label: 'Delegate',    Icon: User,      emoji: 'Person raising hand', bleedIcon: UserRound,      bleedRotate: -6, accent: '#2A5A3C', border: '#C8BEA8',               discBg: 'linear-gradient(145deg, #2F6242 0%, #1B3828 100%)',              discGlyph: '#EED98A', chipInk: '#245234', chipBg: '#1B3828', chipText: '#EED98A', chipBorder: 'rgba(238,217,138,0.4)' },
  { key: 'chair',       label: 'Chair',       Icon: Gavel,     emoji: 'Hammer',              bleedIcon: Hammer,         bleedRotate: -10, accent: '#B6871F', border: 'rgba(182,135,31,0.6)',  discBg: 'linear-gradient(145deg, #F3E3A1 0%, #EED98A 45%, #C99A2A 100%)', discGlyph: '#4A3410', chipInk: '#7A5A20', chipBg: '#EED98A', chipText: '#5A4210', chipBorder: 'rgba(182,135,31,0.55)' },
  { key: 'secretariat', label: 'Secretariat', Icon: Briefcase, emoji: 'Clipboard',           bleedIcon: ClipboardList,  bleedRotate: -6, accent: '#8A6BA0', border: 'rgba(108,74,120,0.55)', discBg: 'linear-gradient(145deg, #9E7FB4 0%, #6C4A78 100%)',              discGlyph: '#FAF8F3', chipInk: '#5F4470', chipBg: '#8A6BA0', chipText: '#FAF8F3', chipBorder: 'rgba(108,74,120,0.55)' },
  { key: 'other',       label: 'Other',       Icon: Sparkles,  emoji: 'Sparkles',            bleedIcon: Sparkles,       bleedRotate: 0,  accent: '#6E5F4E', border: 'rgba(154,138,120,0.55)', discBg: 'linear-gradient(145deg, #A89880 0%, #7C6C58 100%)',             discGlyph: '#FAF8F3', chipInk: '#5C5140', chipBg: '#DDD4C0', chipText: '#5C5140', chipBorder: 'rgba(154,138,120,0.5)' },
];

export const ENTRY_TYPE_MAP: Record<EntryType, typeof ENTRY_TYPES[number]> =
  Object.fromEntries(ENTRY_TYPES.map((t) => [t.key, t])) as Record<EntryType, typeof ENTRY_TYPES[number]>;

// Committee suggestions — the SAME fuller list the conference committee picker
// offers (CONFERENCE_COMMITTEE_PRESETS), so the CV autocomplete surfaces DISEC,
// SPECPOL, SOCHUM, UNICEF, ICC, ICJ, FIFA, House of Commons, etc. — not just the
// short standalone-session list.
export const COMMITTEE_SUGGESTIONS = CONFERENCE_COMMITTEE_PRESETS.map((p) => ({ name: p.name, acronym: p.acronym, logoPath: p.logoPath }));

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

// Soft pressed-in well — borrows the neumorphic NeuInset feel (recessed field,
// forest-tinted inset shadow) without going full neu. Shared by every input in
// the modal for consistent field styling.
const inputStyle: React.CSSProperties = {
  border: '1px solid #E4DBC6',
  backgroundColor: '#F4EFE3',
  color: '#1C1410',
  fontFamily: OUTFIT,
  boxShadow: 'inset 2px 2px 5px rgba(27,56,40,0.10), inset -2px -2px 5px rgba(255,255,255,0.72)',
};

// ── Anchored dropdown (portaled, never clipped) ──────────────────────────────
// The Add/Edit modal is a scrollable overflow-y:auto box, so an in-flow
// `absolute` typeahead would be clipped by it. Every autocomplete here renders
// its menu through a Portal at fixed viewport coordinates measured from the
// trigger, repositioning on scroll/resize and flipping above the anchor when
// there isn't room below. (Mirrors ConferenceRosterPicker's useAnchoredDropdown.)
function useAnchoredDropdown<T extends HTMLElement>(
  open: boolean,
  anchorRef: React.RefObject<T | null>,
  estHeight = 280,
) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    let top = r.bottom + 6;
    if (top + estHeight > window.innerHeight - margin && r.top - 6 - estHeight > margin) {
      top = r.top - 6 - estHeight;
    }
    setPos({ top: Math.max(margin, top), left: r.left, width: r.width });
  }, [anchorRef, estHeight]);
  useEffect(() => {
    if (!open) { setPos(null); return; }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);
  return pos;
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
  const anchorRef = useRef<HTMLInputElement>(null);
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return COMMITTEE_SUGGESTIONS.filter((p) => p.name.toLowerCase().includes(q) || p.acronym.toLowerCase().includes(q)).slice(0, 6);
  }, [value]);
  const menuOpen = open && matches.length > 0;
  const pos = useAnchoredDropdown(menuOpen, anchorRef, 280);

  return (
    <div className="relative">
      <input
        ref={anchorRef}
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
      {menuOpen && pos && (
        <Portal>
          <div
            className="rounded-xl overflow-hidden"
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, backgroundColor: 'rgba(250,248,243,0.98)', border: '1px solid #DDD4C0', boxShadow: '0 16px 40px rgba(27,56,40,0.16)' }}
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
        </Portal>
      )}
    </div>
  );
}

// ── Country / allocation autocomplete (UN_COUNTRIES) ──────────────────────────

function AllocationAutocomplete({
  value, onChange, disabled,
}: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLInputElement>(null);
  const allocCountry = getCountryByName(value);
  const allocFlag = allocCountry ? getFlagUrl(allocCountry.code) : null;
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return UN_COUNTRIES.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [value]);
  const menuOpen = open && matches.length > 0;
  const pos = useAnchoredDropdown(menuOpen, anchorRef, 240);

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
        ref={anchorRef}
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
      {menuOpen && pos && (
        <Portal>
          <div
            className="rounded-xl overflow-y-auto"
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, maxHeight: '224px', backgroundColor: 'rgba(250,248,243,0.98)', border: '1px solid #DDD4C0', boxShadow: '0 16px 40px rgba(27,56,40,0.16)' }}
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
        </Portal>
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

// ── Expertise slider (beginner → intermediate → advanced → expert) ────────────
// A 4-stop neumorphic slider replacing the old pill buttons. Click a stop, drag
// the thumb, or use the arrow keys. Always resolves to one of the four levels
// (defaults to beginner) — the chosen tier renders as a LevelBadge on the card.

function ExpertiseSlider({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const n = EXPERTISE_LEVELS_MODAL.length;
  const cur = Math.max(0, EXPERTISE_LEVELS_MODAL.indexOf(value)); // unset → 0 (beginner)
  const accent = LEVEL_ACCENT[EXPERTISE_LEVELS_MODAL[cur]] ?? '#2A5A3C';
  const pct = (cur / (n - 1)) * 100;

  const setFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onChange(EXPERTISE_LEVELS_MODAL[Math.round(ratio * (n - 1))]);
  }, [n, onChange]);

  return (
    <div>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Expertise level"
        aria-valuemin={1}
        aria-valuemax={n}
        aria-valuenow={cur + 1}
        aria-valuetext={EXPERTISE_LEVELS_MODAL[cur]}
        onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setFromClientX(e.clientX); }}
        onPointerMove={(e) => { if (e.buttons === 1) setFromClientX(e.clientX); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(EXPERTISE_LEVELS_MODAL[Math.max(0, cur - 1)]); }
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(EXPERTISE_LEVELS_MODAL[Math.min(n - 1, cur + 1)]); }
        }}
        className="relative focus:outline-none"
        style={{ height: '34px', cursor: 'pointer', touchAction: 'none' }}
      >
        {/* Inset neu track */}
        <div
          className="absolute left-0 right-0"
          style={{ top: '50%', transform: 'translateY(-50%)', height: '8px', borderRadius: '9999px', backgroundColor: NEU.base, boxShadow: NEU.inSm }}
        />
        {/* Filled portion */}
        <div
          className="absolute"
          style={{ top: '50%', transform: 'translateY(-50%)', left: 0, width: `calc(${pct}% )`, height: '8px', borderRadius: '9999px', background: `linear-gradient(90deg, ${accent}CC, ${accent})`, transition: 'width 180ms cubic-bezier(0.22,1,0.36,1)' }}
        />
        {/* Stops */}
        {EXPERTISE_LEVELS_MODAL.map((lvl, i) => {
          const on = i <= cur;
          return (
            <button
              key={lvl}
              type="button"
              aria-label={lvl}
              onClick={() => onChange(lvl)}
              className="absolute focus:outline-none"
              style={{
                left: `${(i / (n - 1)) * 100}%`, top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '13px', height: '13px', borderRadius: '9999px',
                background: on ? accent : NEU.surface,
                border: `2px solid ${on ? '#FAF8F3' : '#DDD4C0'}`,
                boxShadow: NEU.outSm, cursor: 'pointer', padding: 0,
              }}
            />
          );
        })}
        {/* Thumb */}
        <span
          aria-hidden
          className="absolute"
          style={{
            left: `${pct}%`, top: '50%', transform: 'translate(-50%, -50%)',
            width: '22px', height: '22px', borderRadius: '9999px',
            background: `radial-gradient(120% 120% at 30% 25%, ${accent} 0%, ${accent}CC 70%)`,
            border: '2.5px solid #FAF8F3', boxShadow: `0 3px 8px ${accent}55, ${NEU.outSm}`,
            transition: 'left 180ms cubic-bezier(0.22,1,0.36,1)', pointerEvents: 'none',
          }}
        />
      </div>
      {/* Stop labels */}
      <div className="flex justify-between mt-1.5">
        {EXPERTISE_LEVELS_MODAL.map((lvl, i) => (
          <button
            key={lvl}
            type="button"
            onClick={() => onChange(lvl)}
            className="focus:outline-none"
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontFamily: OUTFIT, fontSize: '10.5px', textTransform: 'capitalize',
              fontWeight: i === cur ? 800 : 600,
              color: i === cur ? accent : '#9A8A78',
              flex: '1 1 0', textAlign: i === 0 ? 'left' : i === n - 1 ? 'right' : 'center',
            }}
          >
            {lvl}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Add / Edit modal ───────────────────────────────────────────────────────

export function CVEntryModal({
  existing,
  onClose,
  onSaved,
  onDelete,
  userId,
}: {
  existing: CVEntry | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete: (id: string) => Promise<void>;
  userId: string;
}) {
  const { session } = useAuth();
  const isVerified = existing?.source === 'gavelling_verified';
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!existing || isVerified || deleting) return;
    setDeleting(true);
    await onDelete(existing.id);
    onClose();
  }

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
  const [specialDraft, setSpecialDraft]     = useState('');
  const [photos, setPhotos]                 = useState<string[]>(existing?.photos ?? []);
  const [description, setDescription]       = useState(existing?.description ?? '');
  const [logoUrl, setLogoUrl]               = useState<string | null>(existing?.logo_url ?? null);
  const [conferenceId, setConferenceId]     = useState<string | null>(existing?.conference_id ?? null);
  const [submitting, setSubmitting]         = useState(false);
  const [uploading, setUploading]           = useState(false);
  const [uploadingLogo, setUploadingLogo]   = useState(false);
  const [error, setError]                   = useState('');

  const activeType     = ENTRY_TYPE_MAP[entryType] ?? ENTRY_TYPE_MAP.delegate;
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
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const suggestAnchorRef = useRef<HTMLDivElement>(null);
  const suggestMenuOpen = suggestOpen && suggestions.length > 0;
  const suggestPos = useAnchoredDropdown(suggestMenuOpen, suggestAnchorRef, 320);

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

  // The custom, free-text "special" honours the delegate typed in (anything not
  // in the AWARD_LIST presets). They live in the same `awards` array and render
  // in the green special tier.
  const customAwards = awards.filter((a) => isCustomAward(a));

  function addSpecialAward() {
    const name = specialDraft.trim();
    if (!name) return;
    setAwards((prev) => (prev.some((a) => a.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name]));
    setSpecialDraft('');
  }
  function removeAward(name: string) {
    setAwards((prev) => prev.filter((a) => a !== name));
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

  // Upload a custom conference logo for this entry (independent of the
  // name-match auto-import). Lets a delegate add or change the logo directly.
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    if (!file.type.startsWith('image/')) { setError('Logo must be an image.'); return; }
    if (file.size > MAX_PHOTO_BYTES) { setError('Logo must be under 5 MB.'); return; }
    setUploadingLogo(true);
    setError('');
    const supabase = getAuthedClient(session.access_token);
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path = `cv-logos/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('conference-assets')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setError('The logo could not be uploaded. Please try again.');
    } else {
      const { data } = supabase.storage.from('conference-assets').getPublicUrl(path);
      if (data?.publicUrl) setLogoUrl(data.publicUrl);
    }
    setUploadingLogo(false);
    if (logoInputRef.current) logoInputRef.current.value = '';
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
        <div className="flex items-center gap-3 mb-5">
          <span
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: '44px', height: '44px', borderRadius: '13px',
              background: `linear-gradient(145deg, ${activeType.accent}30, ${activeType.accent}18), #FAF8F3`,
              boxShadow: `0 3px 9px ${activeType.accent}2E, inset 0 1px 0 rgba(255,255,255,0.6)`,
            }}
          >
            <Emoji3D name={activeType.emoji} size={26} fallback={activeType.Icon} fallbackColor={activeType.accent} />
          </span>
          <div className="min-w-0">
            <Eyebrow className="mb-1">{existing ? 'Edit Entry' : 'Add Conference'}</Eyebrow>
            <h2 className="font-black text-lg leading-tight truncate" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              {existing ? existing.conference_name : 'New CV entry'}
            </h2>
          </div>
        </div>

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
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl py-3 focus:outline-none transition-all"
                    style={{
                      border: active ? `1.5px solid ${t.accent}` : '1px solid #E4DBC6',
                      background: active
                        ? `linear-gradient(160deg, ${t.accent}1F, ${t.accent}0D)`
                        : '#F4EFE3',
                      boxShadow: active
                        ? `0 4px 12px ${t.accent}2E`
                        : 'inset 2px 2px 5px rgba(27,56,40,0.08), inset -2px -2px 5px rgba(255,255,255,0.7)',
                      cursor: isVerified ? 'not-allowed' : 'pointer',
                      opacity: isVerified && !active ? 0.5 : 1,
                    }}
                  >
                    <Emoji3D
                      name={t.emoji}
                      size={26}
                      fallback={t.Icon}
                      fallbackColor={active ? t.accent : '#9A8A78'}
                      style={active ? undefined : { filter: 'grayscale(0.35) opacity(0.85)' }}
                    />
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
            <div ref={suggestAnchorRef} className="flex items-center gap-2.5">
              {isVerified ? (
                logoUrl && <LogoDisc src={logoUrl} size={40} fallbackText={monogramFor(conferenceName)} />
              ) : (
                <>
                  <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    title={logoUrl ? 'Change logo' : 'Add a logo'}
                    aria-label={logoUrl ? 'Change conference logo' : 'Add a conference logo'}
                    className="relative flex-shrink-0 rounded-full focus:outline-none"
                    style={{ width: 40, height: 40, padding: 0, border: 'none', background: 'none', cursor: uploadingLogo ? 'wait' : 'pointer', lineHeight: 0 }}
                  >
                    <LogoDisc src={logoUrl} size={40} fallbackText={monogramFor(conferenceName)} />
                    <span
                      className="absolute flex items-center justify-center rounded-full"
                      style={{
                        right: -3, bottom: -3, width: 19, height: 19,
                        background: 'radial-gradient(120% 120% at 30% 25%, #2A5A3C 0%, #1B3828 70%)',
                        color: '#EED98A', border: '1.5px solid #FAF8F3', boxShadow: '0 2px 6px rgba(27,56,40,0.3)',
                      }}
                    >
                      {uploadingLogo
                        ? <span className="rounded-full animate-spin" style={{ width: 9, height: 9, border: '1.5px solid #EED98A', borderTopColor: 'transparent' }} />
                        : <ImagePlus size={11} strokeWidth={2.4} />}
                    </span>
                  </button>
                </>
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
            {suggestMenuOpen && suggestPos && (
              <Portal>
                <div
                  className="rounded-xl overflow-hidden"
                  style={{
                    position: 'fixed', top: suggestPos.top, left: suggestPos.left, width: suggestPos.width, zIndex: 9999,
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
              </Portal>
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

          {/* Role title — secretariat + other. For "other", this is the actual
              name of the role (stored in the allocation column, shown on the card). */}
          {showRoleTitle && (
            <Field label={entryType === 'secretariat' ? 'Position / Title' : 'What was your role?'}>
              <input
                type="text"
                required
                disabled={isVerified}
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder={entryType === 'secretariat' ? 'e.g. Under-Secretary-General for Committees' : 'e.g. Press Corps, Photographer, Tech Team, Volunteer'}
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

          {/* Expertise level — delegate only. 4-stop slider. */}
          {showExpertise && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[13px] font-semibold" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                  Expertise Level
                </label>
                <LevelBadge level={expertiseLevel || 'beginner'} size="sm" />
              </div>
              <ExpertiseSlider value={expertiseLevel || 'beginner'} onChange={setExpertiseLevel} />
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

              {/* Special award — free-text, rendered in the green special tier */}
              <div className="mt-3">
                <label className="flex items-center gap-1.5 text-[12px] font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                  <Star size={12} strokeWidth={2.4} fill="#2A5A3C" style={{ color: '#2A5A3C' }} />
                  Special award
                  <span className="font-normal" style={{ color: '#9A8A78', fontSize: '11px' }}>a custom honour not listed above</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={specialDraft}
                    onChange={(e) => setSpecialDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSpecialAward(); } }}
                    placeholder="e.g. Best Speaker, Spirit of the Committee"
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                    style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#2A5A3C'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
                  />
                  <button
                    type="button"
                    onClick={addSpecialAward}
                    disabled={!specialDraft.trim()}
                    className="rounded-xl px-4 text-[12px] font-bold focus:outline-none"
                    style={{
                      background: specialDraft.trim() ? `linear-gradient(150deg, #2A5A3C, #1B3828)` : NEU.surface,
                      color: specialDraft.trim() ? '#EED98A' : '#9A8A78',
                      border: 'none', boxShadow: NEU.outSm,
                      fontFamily: OUTFIT, letterSpacing: '0.04em',
                      cursor: specialDraft.trim() ? 'pointer' : 'default',
                    }}
                  >
                    ADD
                  </button>
                </div>
                {customAwards.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-2.5">
                    {customAwards.map((a) => (
                      <span
                        key={a}
                        className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-1.5 py-[3px]"
                        style={{ backgroundColor: 'rgba(27,56,40,0.10)', border: '1px solid rgba(42,90,60,0.4)', color: '#1B3828', fontFamily: OUTFIT, fontSize: '11px', fontWeight: 600 }}
                      >
                        <AwardArtwork name={a} size={18} />
                        {a}
                        <button
                          type="button"
                          onClick={() => removeAward(a)}
                          aria-label={`Remove ${a}`}
                          className="flex items-center justify-center focus:outline-none"
                          style={{ width: '15px', height: '15px', borderRadius: '9999px', background: 'rgba(27,56,40,0.12)', border: 'none', color: '#1B3828', cursor: 'pointer', marginLeft: '2px' }}
                        >
                          <X size={9} strokeWidth={3} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
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
              style={{ color: '#6E5F4E', backgroundColor: NEU.surface, border: 'none', boxShadow: NEU.outSm, fontFamily: OUTFIT, cursor: 'pointer' }}
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="flex-1 rounded-xl py-2.5 font-bold text-[13px] focus:outline-none transition-colors"
              style={{
                background: submitting || uploading ? '#DDD4C0' : 'linear-gradient(150deg, #2A5A3C, #1B3828)',
                color: submitting || uploading ? '#9A8A78' : '#EED98A',
                fontFamily: OUTFIT,
                letterSpacing: '0.08em',
                border: 'none',
                boxShadow: submitting || uploading ? 'none' : `0 4px 10px rgba(27,56,40,0.28), ${NEU.outSm}`,
                cursor: submitting || uploading ? 'default' : 'pointer',
              }}
            >
              {submitting ? 'SAVING...' : existing ? 'SAVE CHANGES' : 'ADD ENTRY'}
            </button>
          </div>

          {/* Delete — only for manual (self-reported) entries. Verified entries
              are owned by the platform and cannot be removed from here. */}
          {existing && !isVerified && (
            <div className="pt-3 mt-1" style={{ borderTop: '1px solid rgba(221,212,192,0.6)' }}>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold text-[12px] focus:outline-none transition-colors"
                style={{
                  color: deleting ? '#C9A0A0' : '#8B2020',
                  backgroundColor: 'rgba(139,32,32,0.06)',
                  border: '1px solid rgba(139,32,32,0.28)',
                  fontFamily: OUTFIT, letterSpacing: '0.06em',
                  cursor: deleting ? 'default' : 'pointer',
                }}
                onMouseEnter={(e) => { if (!deleting) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.12)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.06)'; }}
              >
                <Trash2 size={13} strokeWidth={2.2} />
                {deleting ? 'DELETING…' : 'DELETE THIS ENTRY'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
