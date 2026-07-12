'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search, Briefcase, X, Gavel, Users, ClipboardList,
  Banknote, Plane, HeartHandshake, Clock, MapPin, Check, ArrowRight,
  CalendarDays, ChevronDown, CheckCircle2,
} from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase as anonSupabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import { LogoDisc } from '@/components/LogoDisc';

// ── Constants ──────────────────────────────────────────────────────────────

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

const FOREST = '#1B3828';
const FOREST_MID = '#2A5A3C';
const GOLD = '#EED98A';
const GOLD_DEEP = '#B6871F';
const AMBER = '#B8844A';
const INK = '#1C1410';
const MUTED = '#9A8A78';
const CARD_BG = '#FAF8F3';
const BORDER = '#DDD4C0';
const DANGER = '#8B2020';
const SLATE_BLUE = '#46617A';

// Category metadata — canonical lowercase keys matching the DB values.
// Chip colours: chairs = gold, secretariat = slate-blue, staff = forest-green.
const CATEGORY_META: Record<string, {
  label: string; single: string; icon: typeof Gavel;
  color: string; bg: string; border: string;
}> = {
  chairs: {
    label: 'CHAIRS', single: 'CHAIRING', icon: Gavel,
    color: '#8A6614', bg: 'rgba(238,217,138,0.32)', border: 'rgba(182,135,31,0.38)',
  },
  secretariat: {
    label: 'SECRETARIAT', single: 'SECRETARIAT', icon: ClipboardList,
    color: SLATE_BLUE, bg: 'rgba(70,97,122,0.12)', border: 'rgba(70,97,122,0.30)',
  },
  staff: {
    label: 'STAFF', single: 'STAFF', icon: Users,
    color: FOREST_MID, bg: 'rgba(42,90,60,0.12)', border: 'rgba(42,90,60,0.30)',
  },
};

const CATEGORY_ORDER = ['chairs', 'secretariat', 'staff'] as const;

// Compensation metadata — canonical lowercase-hyphenated keys matching the DB.
const COMP_META: Record<string, { label: string; icon: typeof Banknote; gold: boolean }> = {
  'paid':           { label: 'PAID',           icon: Banknote,       gold: true },
  'travel-covered': { label: 'TRAVEL COVERED', icon: Plane,          gold: true },
  'unpaid':         { label: 'VOLUNTEER',      icon: HeartHandshake, gold: false },
};

// ── Types ──────────────────────────────────────────────────────────────────

interface ConferenceInfo {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  banner_url: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface CommitteeInfo {
  name: string;
}

interface JobPosting {
  id: string;
  category: string;
  role_name: string;
  description: string | null;
  requirements: string | null;
  compensation: string;
  compensation_note: string | null;
  deadline: string | null;
  is_open: boolean;
  created_at: string;
  conferences: ConferenceInfo | null;
  conference_committees: CommitteeInfo | null;
}

interface MyApplication {
  job_posting_id: string;
  status: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Normalise a category/compensation value from the DB to a canonical
 *  lowercase-hyphenated key ('Travel Covered' → 'travel-covered'). */
function normalizeKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return '';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (!e || s.toDateString() === e.toDateString()) {
    return s.toLocaleDateString('en-GB', { ...opts, year: 'numeric' });
  }
  if (s.getFullYear() === e.getFullYear()) {
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()}–${e.getDate()} ${s.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;
    }
    return `${s.toLocaleDateString('en-GB', opts)} – ${e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
  }
  return `${s.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })} – ${e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function fmtDeadline(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "Posted today" / "Posted 3d ago" / "Posted 2w ago" */
function postedAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Posted today';
  if (days === 1) return 'Posted 1d ago';
  if (days < 14) return `Posted ${days}d ago`;
  if (days < 60) return `Posted ${Math.floor(days / 7)}w ago`;
  return `Posted ${Math.floor(days / 30)}mo ago`;
}

/** Split a free-text requirements field into short checklist items. */
function requirementItems(requirements: string): string[] {
  let parts = requirements.split(/[;\n•]+/);
  if (parts.length === 1) parts = requirements.split(/,\s*/);
  return parts
    .map(p => p.trim().replace(/\.+$/, '').replace(/^and\s+/i, ''))
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .slice(0, 6);
}

// ── Filter pill ────────────────────────────────────────────────────────────

function FilterPill({
  label, active, onClick, icon: Icon,
}: { label: string; active: boolean; onClick: () => void; icon?: typeof Gavel }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all focus:outline-none flex-shrink-0"
      style={{
        backgroundColor: active ? FOREST : 'transparent',
        color: active ? GOLD : '#4A4238',
        border: active ? `1px solid ${FOREST}` : '1px solid rgba(221,212,192,0.9)',
        fontFamily: "'Outfit', sans-serif",
        letterSpacing: '0.08em',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.borderColor = FOREST;
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(221,212,192,0.9)';
      }}
    >
      {Icon && <Icon size={11} strokeWidth={2.25} />}
      {label}
    </button>
  );
}

// ── Posting card ───────────────────────────────────────────────────────────

function PostingCard({
  posting,
  rolesAtConference,
  myApp,
  onApply,
  onSignIn,
  isSignedIn,
}: {
  posting: JobPosting;
  rolesAtConference: number;
  myApp: MyApplication | undefined;
  onApply: (posting: JobPosting) => void;
  onSignIn: () => void;
  isSignedIn: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const conf = posting.conferences;
  const dateRange = formatDateRange(conf?.start_date ?? null, conf?.end_date ?? null);

  const catKey = normalizeKey(posting.category);
  const cat = CATEGORY_META[catKey] ?? CATEGORY_META.staff;
  const CatIcon = cat.icon;

  const compKey = normalizeKey(posting.compensation);
  const comp = COMP_META[compKey] ?? { label: (posting.compensation || 'UNSPECIFIED').toUpperCase(), icon: Briefcase, gold: false };
  const CompIcon = comp.icon;

  const countryObj = conf?.country ? getCountryByName(conf.country) : null;
  const checklist = posting.requirements ? requirementItems(posting.requirements) : [];
  const hasDetail = !!posting.description || checklist.length > 0 || !!posting.compensation_note;

  const deadlineDays = posting.deadline ? daysUntil(posting.deadline) : null;
  const deadlineUrgent = deadlineDays !== null && deadlineDays > 0 && deadlineDays <= 14;
  const deadlineCritical = deadlineDays !== null && deadlineDays > 0 && deadlineDays <= 5;
  const deadlineColor = deadlineCritical ? DANGER : deadlineUrgent ? AMBER : MUTED;

  let applyBtn: React.ReactNode;
  if (myApp) {
    const btnStyle =
      myApp.status === 'accepted'
        ? { backgroundColor: 'rgba(61,122,82,0.12)', color: FOREST }
        : myApp.status === 'rejected'
        ? { backgroundColor: 'rgba(139,32,32,0.08)', color: DANGER }
        : { backgroundColor: 'rgba(27,56,40,0.08)', color: FOREST };
    const label =
      myApp.status === 'accepted' ? 'ACCEPTED' :
      myApp.status === 'rejected' ? 'REJECTED' :
      'APPLIED';
    applyBtn = (
      <button
        disabled
        className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-bold text-[12px] cursor-default focus:outline-none"
        style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em', ...btnStyle }}
      >
        {myApp.status !== 'rejected' && <Check size={13} strokeWidth={2.5} />}
        {label}
      </button>
    );
  } else if (!isSignedIn) {
    applyBtn = (
      <button
        onClick={onSignIn}
        className="group/btn w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-bold text-[12px] focus:outline-none transition-all"
        style={{
          fontFamily: "'Outfit', sans-serif",
          border: `1.5px solid ${BORDER}`,
          backgroundColor: 'transparent',
          color: '#6B5D4B',
          letterSpacing: '0.06em',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = FOREST;
          (e.currentTarget as HTMLElement).style.color = FOREST;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = BORDER;
          (e.currentTarget as HTMLElement).style.color = '#6B5D4B';
        }}
      >
        SIGN IN TO APPLY
        <ArrowRight size={13} strokeWidth={2.5} className="transition-transform group-hover/btn:translate-x-0.5" />
      </button>
    );
  } else {
    applyBtn = (
      <button
        onClick={() => onApply(posting)}
        className="group/btn w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-bold text-[12px] focus:outline-none transition-all"
        style={{
          fontFamily: "'Outfit', sans-serif",
          backgroundColor: FOREST,
          color: GOLD,
          letterSpacing: '0.06em',
          boxShadow: '0 4px 14px rgba(27,56,40,0.20)',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = FOREST_MID; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = FOREST; }}
      >
        APPLY
        <ArrowRight size={13} strokeWidth={2.5} className="transition-transform group-hover/btn:translate-x-0.5" />
      </button>
    );
  }

  return (
    <article
      className="rounded-2xl transition-all"
      style={{
        backgroundColor: CARD_BG,
        border: `1px solid ${BORDER}`,
        boxShadow: '0 2px 10px rgba(27,56,40,0.05)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = 'rgba(27,56,40,0.40)';
        el.style.boxShadow = '0 14px 36px rgba(27,56,40,0.13)';
        el.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = BORDER;
        el.style.boxShadow = '0 2px 10px rgba(27,56,40,0.05)';
        el.style.transform = 'translateY(0)';
      }}
    >
      <div className="p-4">
        {/* ── Logo tile + title block ── */}
        <div className="flex items-start gap-3">
          <Link
            href={conf ? `/conferences/${conf.slug}` : '#'}
            className="flex-shrink-0 focus:outline-none"
            style={{ textDecoration: 'none' }}
            aria-label={conf?.full_name ?? 'Conference'}
          >
            <LogoDisc
              src={conf?.logo_url}
              alt={conf?.acronym}
              size={56}
              fallbackText={(conf?.acronym ?? '?').slice(0, 3)}
            />
          </Link>

          <div className="min-w-0 flex-1">
            <h3
              className="font-bold leading-snug"
              style={{ color: INK, fontFamily: "'Outfit', sans-serif", fontSize: '16px', margin: 0 }}
            >
              {posting.role_name}
            </h3>
            {conf && (
              <p className="mt-0.5 text-[12px] leading-snug" style={{ fontFamily: "'Outfit', sans-serif", margin: 0, marginTop: '3px' }}>
                <Link
                  href={`/conferences/${conf.slug}`}
                  className="font-bold transition-colors focus:outline-none"
                  style={{ color: FOREST, textDecoration: 'none' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = GOLD_DEEP; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = FOREST; }}
                >
                  {conf.acronym}
                </Link>
                <span style={{ color: MUTED }}> · {conf.full_name}</span>
              </p>
            )}
            {posting.conference_committees?.name && (
              <p className="text-[11px]" style={{ color: MUTED, fontFamily: "'Outfit', sans-serif", margin: 0, marginTop: '2px' }}>
                {posting.conference_committees.name}
              </p>
            )}
          </div>
        </div>

        {/* ── Chips: category + compensation ── */}
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          <span
            className="flex items-center gap-1 px-2 py-[3px] rounded-full text-[9.5px] font-bold"
            style={{
              backgroundColor: cat.bg,
              border: `1px solid ${cat.border}`,
              color: cat.color,
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.09em',
            }}
          >
            <CatIcon size={10} strokeWidth={2.5} />
            {cat.single}
          </span>
          <span
            className="flex items-center gap-1 px-2 py-[3px] rounded-full text-[9.5px] font-bold"
            style={comp.gold
              ? {
                  backgroundColor: 'rgba(238,217,138,0.26)',
                  border: '1px solid rgba(182,135,31,0.34)',
                  color: GOLD_DEEP,
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '0.09em',
                }
              : {
                  backgroundColor: 'rgba(154,138,120,0.12)',
                  border: '1px solid rgba(154,138,120,0.30)',
                  color: '#6B5D4B',
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '0.09em',
                }}
          >
            <CompIcon size={10} strokeWidth={2.5} />
            {comp.label}
          </span>
        </div>

        {/* ── Icon meta rows ── */}
        <div className="mt-3 flex flex-col gap-[7px]">
          {(conf?.city || conf?.country) && (
            <div className="flex items-center gap-2">
              <MapPin size={13} strokeWidth={2} style={{ color: MUTED, flexShrink: 0 }} />
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="text-[12px] font-semibold truncate" style={{ color: '#4A4238', fontFamily: "'Outfit', sans-serif" }}>
                  {[conf?.city, conf?.country].filter(Boolean).join(', ')}
                </span>
                {countryObj && (
                  <img
                    src={getFlagUrl(countryObj.code)}
                    alt={conf?.country ?? ''}
                    style={{ width: '17px', height: '12px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0, boxShadow: '0 1px 3px rgba(28,20,16,0.25)' }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </span>
            </div>
          )}
          {dateRange && (
            <div className="flex items-center gap-2">
              <CalendarDays size={13} strokeWidth={2} style={{ color: MUTED, flexShrink: 0 }} />
              <span className="text-[12px]" style={{ color: '#6B5D4B', fontFamily: "'Outfit', sans-serif" }}>
                {dateRange}
              </span>
            </div>
          )}
          {rolesAtConference > 1 && (
            <div className="flex items-center gap-2">
              <Users size={13} strokeWidth={2} style={{ color: MUTED, flexShrink: 0 }} />
              <span className="text-[12px]" style={{ color: '#6B5D4B', fontFamily: "'Outfit', sans-serif" }}>
                {rolesAtConference} open roles at this conference
              </span>
            </div>
          )}
          {/* Recency + deadline line, urgency-tinted */}
          <div className="flex items-center gap-2">
            <Clock size={13} strokeWidth={2} style={{ color: deadlineColor, flexShrink: 0 }} />
            <span className="text-[12px]" style={{ color: '#6B5D4B', fontFamily: "'Outfit', sans-serif" }}>
              {postedAgo(posting.created_at)}
              {posting.deadline ? (
                <>
                  <span style={{ color: MUTED }}> · </span>
                  <span className="font-semibold" style={{ color: deadlineColor }}>
                    {deadlineCritical && deadlineDays !== null
                      ? `closes in ${deadlineDays === 1 ? '1 day' : `${deadlineDays} days`}`
                      : `closes ${fmtDeadline(posting.deadline)}`}
                  </span>
                </>
              ) : (
                <>
                  <span style={{ color: MUTED }}> · </span>
                  <span style={{ color: MUTED }}>rolling applications</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* ── Expandable detail ── */}
        {hasDetail && (
          <>
            <button
              onClick={() => setExpanded(v => !v)}
              className="mt-3 flex items-center gap-1 text-[11px] font-bold focus:outline-none transition-colors"
              style={{ color: expanded ? FOREST : '#8A7D6C', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.06em' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = FOREST; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = expanded ? FOREST : '#8A7D6C'; }}
              aria-expanded={expanded}
            >
              ROLE DETAILS
              <ChevronDown
                size={13}
                strokeWidth={2.5}
                style={{ transition: 'transform 0.18s ease', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>

            {expanded && (
              <div className="mt-2.5 rounded-xl px-3.5 py-3" style={{ backgroundColor: 'rgba(27,56,40,0.035)', border: '1px solid rgba(27,56,40,0.08)' }}>
                {posting.description && (
                  <p className="text-[12px] leading-relaxed" style={{ color: '#5A4F42', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
                    {posting.description}
                  </p>
                )}
                {checklist.length > 0 && (
                  <div style={{ marginTop: posting.description ? '12px' : 0 }}>
                    <p
                      className="text-[9px] font-bold"
                      style={{ color: GOLD_DEEP, fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.14em', margin: 0, marginBottom: '7px' }}
                    >
                      LOOKING FOR
                    </p>
                    <ul className="flex flex-col gap-1.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {checklist.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 size={14} strokeWidth={2.25} style={{ color: FOREST_MID, flexShrink: 0, marginTop: '1.5px' }} />
                          <span className="text-[12px] leading-snug" style={{ color: '#4A4238', fontFamily: "'Outfit', sans-serif" }}>
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {posting.compensation_note && (
                  <p
                    className="text-[11.5px] leading-snug flex items-start gap-1.5"
                    style={{
                      color: comp.gold ? '#7A5B18' : '#6B5D4B',
                      fontFamily: "'Outfit', sans-serif",
                      margin: 0,
                      marginTop: (posting.description || checklist.length > 0) ? '12px' : 0,
                    }}
                  >
                    <CompIcon size={13} strokeWidth={2.25} style={{ color: comp.gold ? GOLD_DEEP : MUTED, flexShrink: 0, marginTop: '2px' }} />
                    <span>{posting.compensation_note}</span>
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Dominant action ── */}
        <div className="mt-3.5">
          {applyBtn}
        </div>
      </div>
    </article>
  );
}

// ── Column / section header ────────────────────────────────────────────────

function GroupHeader({ catKey, count }: { catKey: string; count: number }) {
  const cat = CATEGORY_META[catKey] ?? CATEGORY_META.staff;
  const CatIcon = cat.icon;
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: '28px', height: '28px', borderRadius: '9px',
          backgroundColor: cat.bg, border: `1px solid ${cat.border}`,
        }}
      >
        <CatIcon size={14} strokeWidth={2.25} style={{ color: cat.color }} />
      </span>
      <h2
        className="font-extrabold text-[13px]"
        style={{ color: INK, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.14em', margin: 0 }}
      >
        {cat.label}
      </h2>
      <span
        className="flex items-center justify-center px-2 py-[1px] rounded-full text-[10px] font-bold"
        style={{
          backgroundColor: 'rgba(27,56,40,0.07)',
          border: '1px solid rgba(27,56,40,0.12)',
          color: FOREST,
          fontFamily: "'Outfit', sans-serif",
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {count}
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(221,212,192,0.8)' }} />
    </div>
  );
}

// ── Apply modal ────────────────────────────────────────────────────────────

function ApplyModal({
  posting,
  cvCount,
  applying,
  onSubmit,
  onClose,
}: {
  posting: JobPosting;
  cvCount: number;
  applying: boolean;
  onSubmit: (coverNote: string) => void;
  onClose: () => void;
}) {
  const [coverNote, setCoverNote] = useState('');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(28,20,16,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative"
        style={{
          backgroundColor: CARD_BG,
          border: `1px solid ${BORDER}`,
          borderRadius: '20px',
          padding: '24px',
          maxWidth: '448px',
          width: 'calc(100% - 32px)',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 64px rgba(27,56,40,0.25)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 focus:outline-none"
          style={{ color: MUTED }}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <p className="font-semibold text-base mb-0.5" style={{ color: INK, fontFamily: "'Outfit', sans-serif" }}>
          {posting.role_name}
        </p>
        <p className="text-sm mb-4" style={{ color: MUTED, fontFamily: "'Outfit', sans-serif" }}>
          {posting.conferences?.full_name}
          {posting.conferences?.acronym ? ` · ${posting.conferences.acronym}` : ''}
        </p>

        {/* MUN CV summary */}
        <div
          className="rounded-xl p-3 mb-4"
          style={{ backgroundColor: 'rgba(27,56,40,0.04)', border: '1px solid rgba(27,56,40,0.08)' }}
        >
          <p className="text-xs" style={{ color: MUTED, fontFamily: "'Outfit', sans-serif" }}>
            Your MUN CV has{' '}
            <span className="font-bold" style={{ color: INK }}>{cvCount}</span>
            {' '}entr{cvCount === 1 ? 'y' : 'ies'}.
          </p>
          {cvCount === 0 && (
            <div
              className="mt-2 rounded-lg p-2.5"
              style={{ backgroundColor: 'rgba(238,217,138,0.15)', border: '1px solid rgba(238,217,138,0.3)' }}
            >
              <p className="text-xs" style={{ color: GOLD_DEEP, fontFamily: "'Outfit', sans-serif" }}>
                Consider adding entries to your MUN CV to strengthen your application.{' '}
                <Link
                  href="/account/cv"
                  className="font-semibold underline focus:outline-none"
                  style={{ color: GOLD_DEEP }}
                >
                  Add now →
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* Cover note */}
        <div className="mb-4">
          <label
            className="block text-xs font-bold mb-1.5"
            style={{ color: MUTED, fontFamily: "'Outfit', sans-serif", fontWeight: 700, letterSpacing: '0.12em' }}
          >
            COVER NOTE (OPTIONAL)
          </label>
          <textarea
            rows={4}
            value={coverNote}
            onChange={e => setCoverNote(e.target.value)}
            placeholder="Tell the conference team why you'd be a great fit for this role..."
            className="w-full text-sm focus:outline-none"
            style={{
              border: `1px solid ${BORDER}`,
              backgroundColor: '#fff',
              color: INK,
              fontFamily: "'Outfit', sans-serif",
              borderRadius: '10px',
              padding: '10px 12px',
              resize: 'vertical',
              lineHeight: '1.6',
            }}
            onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = FOREST; }}
            onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
          />
        </div>

        {/* Submit */}
        <button
          onClick={() => onSubmit(coverNote)}
          disabled={applying}
          className="w-full rounded-xl py-3 font-bold text-sm focus:outline-none transition-all disabled:opacity-50"
          style={{
            backgroundColor: FOREST,
            color: GOLD,
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '0.05em',
          }}
          onMouseEnter={(e) => {
            if (!applying) (e.currentTarget as HTMLElement).style.backgroundColor = FOREST_MID;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = FOREST;
          }}
        >
          {applying ? 'SUBMITTING…' : 'SUBMIT APPLICATION'}
        </button>
      </div>
    </div>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────

const FOOTER_GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='0.18'/%3E%3C/svg%3E")`;

function Footer() {
  return (
    <footer
      className="relative z-10 border-t px-6 py-8"
      style={{
        borderColor: BORDER,
        backgroundImage: FOOTER_GRAIN,
        backgroundRepeat: 'repeat',
        backgroundSize: '300px 300px',
        backgroundColor: '#EDE7D8',
      }}
    >
      <div className="flex flex-col items-center gap-4 md:grid md:grid-cols-3 md:gap-0 md:items-center">
        <img
          src="/GavellingLogo.png"
          alt="Gavelling"
          className="h-7 w-auto"
          style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(25%) saturate(800%) hue-rotate(100deg) brightness(85%)' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="flex items-center justify-center gap-4">
          <a
            href="https://www.instagram.com/wearegavelling/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            style={{ color: MUTED, transition: 'color 0.15s' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = FOREST; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = MUTED; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
            </svg>
          </a>
          <span aria-label="LinkedIn (coming soon)" style={{ color: '#C8BFB0', cursor: 'default' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
            </svg>
          </span>
        </div>
        <p className="text-xs font-semibold md:text-right" style={{ color: FOREST }}>
          © {new Date().getFullYear()} Gavelling. Built for the MUN community.
        </p>
      </div>
    </footer>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

const COMP_FILTERS = [
  { key: 'paid', label: 'PAID' },
  { key: 'travel-covered', label: 'TRAVEL COVERED' },
  { key: 'unpaid', label: 'VOLUNTEER' },
] as const;

export default function ConferencesRolesClient() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();

  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [myApplications, setMyApplications] = useState<MyApplication[]>([]);
  const [cvCount, setCvCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [compensationFilter, setCompensationFilter] = useState('');
  const [selectedPosting, setSelectedPosting] = useState<JobPosting | null>(null);
  const [applying, setApplying] = useState(false);

  const loadMyApplications = useCallback(async () => {
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('job_applications')
      .select('job_posting_id, status')
      .eq('user_id', user.id);
    setMyApplications((data as MyApplication[]) ?? []);
  }, [user, session]);

  useEffect(() => {
    if (authLoading) return;

    async function fetchAll() {
      setLoading(true);
      const supabase = anonSupabase;

      const { data: postingsData } = await supabase
        .from('job_postings')
        .select(`
          id, category, role_name, description, requirements,
          compensation, compensation_note, deadline, is_open, created_at,
          conferences (id, slug, full_name, acronym, city, country, logo_url, banner_url, start_date, end_date),
          conference_committees (name)
        `)
        .eq('is_open', true)
        .order('created_at', { ascending: false });

      setPostings((postingsData as unknown as JobPosting[]) ?? []);

      if (user) {
        await loadMyApplications();

        // Fetch MUN CV count
        const { count } = await supabase
          .from('mun_cv_entries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        setCvCount(count ?? 0);
      }

      setLoading(false);
    }
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, session?.access_token]);

  // Both sides of every filter comparison are normalised to canonical
  // lowercase keys ('chairs', 'travel-covered').
  const filtered = postings.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      p.role_name.toLowerCase().includes(q) ||
      (p.conferences?.full_name ?? '').toLowerCase().includes(q) ||
      (p.conferences?.acronym ?? '').toLowerCase().includes(q) ||
      (p.conferences?.city ?? '').toLowerCase().includes(q) ||
      (p.conferences?.country ?? '').toLowerCase().includes(q) ||
      (p.requirements ?? '').toLowerCase().includes(q);
    const matchCategory = !categoryFilter || normalizeKey(p.category) === categoryFilter;
    const matchComp = !compensationFilter || normalizeKey(p.compensation) === compensationFilter;
    return matchSearch && matchCategory && matchComp;
  });

  const totalOpen = postings.length;
  const conferencesHiring = new Set(postings.map(p => p.conferences?.id).filter(Boolean)).size;
  const fundedRoles = postings.filter(p => {
    const k = normalizeKey(p.compensation);
    return k === 'paid' || k === 'travel-covered';
  }).length;

  // Open-role count per conference (from the full board, not the filtered view)
  const rolesByConference: Record<string, number> = {};
  for (const p of postings) {
    const cid = p.conferences?.id;
    if (cid) rolesByConference[cid] = (rolesByConference[cid] ?? 0) + 1;
  }

  // Group the filtered postings by category. Unknown categories fall back
  // into the staff group so nothing is ever silently dropped.
  const grouped = CATEGORY_ORDER.map(key => ({
    key,
    items: filtered.filter(p => {
      const k = normalizeKey(p.category);
      return k === key || (key === 'staff' && !CATEGORY_ORDER.includes(k as typeof CATEGORY_ORDER[number]));
    }),
  }));
  const visibleGroups = grouped.filter(g => g.items.length > 0);

  const hasActiveFilters = !!searchQuery || !!categoryFilter || !!compensationFilter;

  async function handleApply(coverNote: string) {
    if (!user || !selectedPosting) return;
    setApplying(true);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('job_applications').insert({
      job_posting_id: selectedPosting.id,
      user_id: user.id,
      cover_note: coverNote || null,
      status: 'submitted',
    });
    setApplying(false);
    setSelectedPosting(null);
    await loadMyApplications();
  }

  const appsByPostingId = Object.fromEntries(
    myApplications.map(a => [a.job_posting_id, a])
  );

  const pad = (n: number) => String(n).padStart(2, '0');

  const renderCard = (posting: JobPosting) => (
    <PostingCard
      key={posting.id}
      posting={posting}
      rolesAtConference={posting.conferences?.id ? (rolesByConference[posting.conferences.id] ?? 1) : 1}
      myApp={appsByPostingId[posting.id]}
      onApply={(p) => setSelectedPosting(p)}
      onSignIn={() => router.push('/auth/signin?next=/conferences/roles')}
      isSignedIn={!!user}
    />
  );

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8' }}>
      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: GRAIN,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          mixBlendMode: 'multiply',
          opacity: 0.18,
        }}
      />

      {/* Soft ambient washes behind the header */}
      <div
        aria-hidden
        className="pointer-events-none absolute z-0"
        style={{
          top: '-140px', left: '8%', width: '620px', height: '420px',
          background: 'radial-gradient(ellipse at center, rgba(238,217,138,0.22) 0%, transparent 65%)',
          filter: 'blur(48px)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute z-0"
        style={{
          top: '-80px', right: '4%', width: '520px', height: '380px',
          background: 'radial-gradient(ellipse at center, rgba(42,90,60,0.13) 0%, transparent 65%)',
          filter: 'blur(48px)',
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <SiteNav />

        {/* ── Editorial header ─────────────────────────────────────── */}
        <header className="px-6 md:px-14 pt-8 pb-8">
          <p
            className="mb-2"
            style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: '10px', letterSpacing: '0.15em', color: GOLD_DEEP }}
          >
            CHAIR &amp; STAFF BOARD
          </p>
          <h1
            style={{
              fontFamily: "'Outfit', sans-serif", fontWeight: 900,
              fontSize: 'clamp(36px, 4.5vw, 60px)', lineHeight: 1.02, color: INK, margin: 0,
            }}
          >
            Find Your Next{' '}
            <span style={{ color: FOREST }}>Role</span>
            <span style={{ color: GOLD_DEEP }}>.</span>
          </h1>
          <p
            className="mt-3"
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px', color: '#8A7D6C', maxWidth: '460px', lineHeight: 1.6 }}
          >
            Open positions for chairs, secretariat, and staff across MUN conferences worldwide.
          </p>

          {/* Stat fragments */}
          {!loading && (
            <p
              className="mt-5 flex items-center gap-2.5 flex-wrap"
              style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: '11px', letterSpacing: '0.08em', color: '#6B5D4B', margin: 0, marginTop: '20px', fontVariantNumeric: 'tabular-nums' }}
            >
              <span><span style={{ color: FOREST, fontWeight: 700 }}>{pad(totalOpen)}</span> OPEN ROLES</span>
              <span style={{ color: GOLD_DEEP, fontSize: '8px' }}>◆</span>
              <span><span style={{ color: FOREST, fontWeight: 700 }}>{pad(conferencesHiring)}</span> CONFERENCE{conferencesHiring === 1 ? '' : 'S'} HIRING</span>
              <span style={{ color: GOLD_DEEP, fontSize: '8px' }}>◆</span>
              <span><span style={{ color: GOLD_DEEP, fontWeight: 700 }}>{pad(fundedRoles)}</span> WITH REWARDS</span>
            </p>
          )}
        </header>

        {/* ── Floating glass filter pill bar ───────────────────────── */}
        <div className="sticky z-30 px-4 md:px-10" style={{ top: '12px' }}>
          <div
            style={{
              backgroundColor: 'rgba(250,248,243,0.72)',
              backdropFilter: 'blur(20px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
              border: '1px solid rgba(221,212,192,0.85)',
              borderRadius: '28px',
              boxShadow: '0 12px 40px rgba(27,56,40,0.12), 0 1px 0 rgba(255,255,255,0.6) inset',
            }}
          >
            <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
              {/* Search */}
              <div className="relative flex items-center flex-1" style={{ minWidth: '170px' }}>
                <Search size={15} className="absolute left-3 pointer-events-none" style={{ color: MUTED }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search roles, conferences, cities…"
                  className="w-full py-2 pl-9 pr-3 text-sm focus:outline-none"
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: INK,
                    fontFamily: "'Outfit', sans-serif",
                  }}
                />
              </div>

              <div className="hidden md:block w-px h-6 flex-shrink-0" style={{ backgroundColor: 'rgba(221,212,192,0.9)' }} />

              {/* Category pills — toggle on/off */}
              {CATEGORY_ORDER.map(key => (
                <FilterPill
                  key={key}
                  label={CATEGORY_META[key].label}
                  icon={CATEGORY_META[key].icon}
                  active={categoryFilter === key}
                  onClick={() => setCategoryFilter(f => f === key ? '' : key)}
                />
              ))}

              <div className="hidden md:block w-px h-6 flex-shrink-0" style={{ backgroundColor: 'rgba(221,212,192,0.9)' }} />

              {/* Compensation pills */}
              {COMP_FILTERS.map(({ key, label }) => (
                <FilterPill
                  key={key}
                  label={label}
                  active={compensationFilter === key}
                  onClick={() => setCompensationFilter(f => f === key ? '' : key)}
                />
              ))}

              {/* Count / clear */}
              <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                {hasActiveFilters && (
                  <button
                    onClick={() => { setSearchQuery(''); setCategoryFilter(''); setCompensationFilter(''); }}
                    className="flex items-center gap-1 text-[10px] font-bold focus:outline-none transition-colors"
                    style={{ color: MUTED, fontFamily: "'Outfit', sans-serif", letterSpacing: '0.12em' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = DANGER; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = MUTED; }}
                  >
                    <X size={11} />
                    CLEAR
                  </button>
                )}
                <p
                  className="text-[11px]"
                  style={{ color: MUTED, fontFamily: "'Outfit', sans-serif", fontWeight: 600, letterSpacing: '0.06em', margin: 0, fontVariantNumeric: 'tabular-nums' }}
                >
                  {filtered.length} ROLE{filtered.length !== 1 ? 'S' : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main content ─────────────────────────────────────────── */}
        <main className="flex-1 px-6 md:px-14 pt-10 pb-14">
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {Array.from({ length: 3 }).map((_, col) => (
                <div key={col}>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="animate-pulse rounded-lg" style={{ width: '28px', height: '28px', backgroundColor: '#E4DCCB' }} />
                    <div className="animate-pulse rounded-full" style={{ width: '110px', height: '12px', backgroundColor: '#E4DCCB' }} />
                  </div>
                  <div className="flex flex-col gap-4">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-2xl p-4"
                        style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}` }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="animate-pulse rounded-xl flex-shrink-0" style={{ width: '56px', height: '56px', backgroundColor: '#EDE7D8' }} />
                          <div className="flex-1">
                            <div className="animate-pulse rounded-lg mb-2" style={{ width: '75%', height: '15px', backgroundColor: '#EDE7D8' }} />
                            <div className="animate-pulse rounded-full" style={{ width: '55%', height: '11px', backgroundColor: '#EDE7D8' }} />
                          </div>
                        </div>
                        <div className="animate-pulse rounded-full mt-4" style={{ width: '65%', height: '10px', backgroundColor: '#F0EBDD' }} />
                        <div className="animate-pulse rounded-full mt-2" style={{ width: '50%', height: '10px', backgroundColor: '#F0EBDD' }} />
                        <div className="animate-pulse rounded-xl mt-4" style={{ width: '100%', height: '40px', backgroundColor: '#F0EBDD' }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Briefcase size={48} style={{ color: 'rgba(27,56,40,0.2)', marginBottom: '16px' }} />
              {postings.length === 0 ? (
                <>
                  <h2
                    className="font-semibold text-lg mb-2"
                    style={{ color: INK, fontFamily: "'Outfit', sans-serif" }}
                  >
                    No positions open yet
                  </h2>
                  <p
                    className="text-sm mb-6"
                    style={{ color: MUTED, fontFamily: "'Outfit', sans-serif", maxWidth: '440px' }}
                  >
                    Conferences will post open positions here. Check back soon.
                  </p>
                  <Link
                    href="/conferences/organise"
                    className="rounded-xl py-3 px-6 font-bold text-sm tracking-widest focus:outline-none"
                    style={{
                      backgroundColor: FOREST,
                      color: GOLD,
                      fontFamily: "'Outfit', sans-serif",
                      letterSpacing: '0.07em',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = FOREST_MID; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = FOREST; }}
                  >
                    LIST YOUR CONFERENCE →
                  </Link>
                </>
              ) : (
                <>
                  <h2
                    className="font-semibold text-lg mb-2"
                    style={{ color: INK, fontFamily: "'Outfit', sans-serif" }}
                  >
                    No positions match your filters
                  </h2>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('');
                      setCompensationFilter('');
                    }}
                    className="text-sm font-semibold focus:outline-none"
                    style={{ color: FOREST, textDecoration: 'underline' }}
                  >
                    CLEAR FILTERS
                  </button>
                </>
              )}
            </div>
          ) : visibleGroups.length === 1 ? (
            /* Single visible group (e.g. a category filter is active):
               use the full width with a responsive card grid. */
            <section>
              <GroupHeader catKey={visibleGroups[0].key} count={visibleGroups[0].items.length} />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
                {visibleGroups[0].items.map(renderCard)}
              </div>
            </section>
          ) : (
            /* Status-grouped board: labelled category columns on desktop,
               stacked sections on mobile. */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {visibleGroups.map(group => (
                <section key={group.key}>
                  <GroupHeader catKey={group.key} count={group.items.length} />
                  <div className="flex flex-col gap-4">
                    {group.items.map(renderCard)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>

        <Footer />
      </div>

      {/* Apply modal */}
      {selectedPosting && (
        <ApplyModal
          posting={selectedPosting}
          cvCount={cvCount}
          applying={applying}
          onSubmit={handleApply}
          onClose={() => setSelectedPosting(null)}
        />
      )}
    </div>
  );
}
