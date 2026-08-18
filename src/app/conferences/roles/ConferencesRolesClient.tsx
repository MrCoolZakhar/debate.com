'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search, Briefcase, X, Gavel, Users, ClipboardList,
  Banknote, Plane, HeartHandshake, Clock, MapPin, Check, ArrowRight,
  CalendarDays, ChevronDown, CheckCircle2, ScrollText,
} from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import FooterLegal from '@/components/FooterLegal';
import DecorativeBleed from '@/components/DecorativeBleed';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase as anonSupabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { getCountryByName } from '@/lib/countries';
import { LogoDisc } from '@/components/LogoDisc';
import { FlagImg } from '@/components/FlagImg';
import Portal from '@/components/Portal';
import { formatConferenceDates, MONTHS_SHORT_EN_GB } from '@/lib/conferenceDates';
import {
  NEU, NEU_GRADIENTS, NeuCard, NeuInset, NeuIconDisc, NeuButton, NeuPill,
  Emoji3D, OUTFIT, EASE, type NeuGradient,
} from '@/components/neu';

// ── Constants ──────────────────────────────────────────────────────────────

// Feature flag: the live job board (postings, filters, apply flow) is
// temporarily hidden behind a friendly "coming soon" screen. Flip this to
// `true` to restore the full board exactly as it was — nothing below has
// been deleted, only gated.
const JOB_BOARD_ENABLED: boolean = false;

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

const FOREST = NEU.forest;
const FOREST_MID = '#2A5A3C';
const GOLD = NEU.gold;
const GOLD_DEEP = NEU.deepGold;
const AMBER = NEU.amber;
const INK = NEU.ink;
const MUTED = NEU.muted;
const BORDER = '#DDD4C0';
const DANGER = '#8B2020';

type LucideIcon = typeof Gavel;

// Category metadata, canonical lowercase keys matching the DB values.
// Each carries a Fluent 3D emoji glyph + neu gradient seat, with a lucide
// fallback for when the CDN image fails to load.
//   chairs → hammer/gavel (gold)  ·  secretariat → clipboard (sage)
//   staff  → people (forest)
const CATEGORY_META: Record<string, {
  label: string; single: string;
  emoji: string; icon: LucideIcon; gradient: NeuGradient;
}> = {
  chairs: {
    label: 'CHAIRS', single: 'CHAIRING',
    emoji: 'Hammer', icon: Gavel, gradient: NEU_GRADIENTS.gold,
  },
  secretariat: {
    label: 'SECRETARIAT', single: 'SECRETARIAT',
    emoji: 'Clipboard', icon: ClipboardList, gradient: NEU_GRADIENTS.sage,
  },
  staff: {
    label: 'STAFF', single: 'STAFF',
    emoji: 'Busts in silhouette', icon: Users, gradient: NEU_GRADIENTS.forest,
  },
};

const CATEGORY_ORDER = ['chairs', 'secretariat', 'staff'] as const;

// Compensation metadata, canonical lowercase-hyphenated keys matching the DB.
//   paid → money bag (gold)  ·  travel-covered → airplane (sage)
//   unpaid/volunteer → handshake (amber)
const COMP_META: Record<string, {
  label: string; emoji: string; icon: LucideIcon; gradient: NeuGradient; gold: boolean;
}> = {
  'paid':           { label: 'PAID',           emoji: 'Money bag', icon: Banknote,       gradient: NEU_GRADIENTS.gold, gold: true },
  'travel-covered': { label: 'TRAVEL COVERED', emoji: 'Airplane',  icon: Plane,          gradient: NEU_GRADIENTS.sage, gold: true },
  'unpaid':         { label: 'VOLUNTEER',      emoji: 'Handshake', icon: HeartHandshake, gradient: NEU_GRADIENTS.amber, gold: false },
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

// This page rendered its dates through `toLocaleDateString('en-GB', …)`, which
// spells September "Sept" — so it keeps MONTHS_SHORT_EN_GB to stay visually
// identical. It also parsed `new Date('2026-08-30')` as UTC midnight, showing
// the previous day to every viewer west of UTC; the shared helper is date-only.
function formatDateRange(start: string | null, end: string | null): string {
  return formatConferenceDates(start, end, {
    style: 'dmy',
    months: MONTHS_SHORT_EN_GB,
    fallback: '',
  });
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

// ── Glyph chip: 3D emoji seat + label, extruded on the ivory surface ────────

function GlyphChip({
  emoji, icon, gradient, label, tone = 'ink',
}: {
  emoji: string; icon: LucideIcon; gradient: NeuGradient; label: string;
  tone?: 'ink' | 'gold' | 'muted';
}) {
  const color = tone === 'gold' ? GOLD_DEEP : tone === 'muted' ? '#6B5D4B' : NEU.ink;
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        padding: '4px 11px 4px 5px',
        borderRadius: 999,
        backgroundColor: NEU.surface,
        boxShadow: NEU.outSm,
      }}
    >
      <NeuIconDisc gradient={gradient} emoji={emoji} icon={icon} size={22} />
      <span
        style={{
          fontFamily: OUTFIT, fontSize: 10, fontWeight: 800,
          letterSpacing: '0.09em', color,
        }}
      >
        {label}
      </span>
    </span>
  );
}

// ── Filter pill ────────────────────────────────────────────────────────────

function FilterPill({
  label, active, onClick, emoji, icon, gradient = NEU_GRADIENTS.forest,
}: {
  label: string; active: boolean; onClick: () => void;
  emoji?: string; icon?: LucideIcon; gradient?: NeuGradient;
}) {
  return (
    <NeuPill
      active={active}
      gradient={gradient}
      onClick={onClick}
      style={{ fontSize: 10, letterSpacing: '0.07em', padding: '6px 13px 6px 8px', flexShrink: 0 }}
    >
      {emoji && (
        <Emoji3D name={emoji} size={15} fallback={icon} fallbackColor={active ? '#FFFFFF' : FOREST} />
      )}
      {label}
    </NeuPill>
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

  const compKey = normalizeKey(posting.compensation);
  const comp = COMP_META[compKey] ?? {
    label: (posting.compensation || 'UNSPECIFIED').toUpperCase(),
    emoji: 'Briefcase', icon: Briefcase, gradient: NEU_GRADIENTS.forest, gold: false,
  };

  const countryObj = conf?.country ? getCountryByName(conf.country) : null;
  const checklist = posting.requirements ? requirementItems(posting.requirements) : [];
  const hasDetail = !!posting.description || checklist.length > 0 || !!posting.compensation_note;

  const deadlineDays = posting.deadline ? daysUntil(posting.deadline) : null;
  const deadlineUrgent = deadlineDays !== null && deadlineDays > 0 && deadlineDays <= 14;
  const deadlineCritical = deadlineDays !== null && deadlineDays > 0 && deadlineDays <= 5;
  const deadlineColor = deadlineCritical ? DANGER : deadlineUrgent ? AMBER : MUTED;

  let applyBtn: React.ReactNode;
  if (myApp) {
    const tone =
      myApp.status === 'accepted'
        ? { color: NEU.green }
        : myApp.status === 'rejected'
        ? { color: DANGER }
        : { color: FOREST };
    const label =
      myApp.status === 'accepted' ? 'ACCEPTED' :
      myApp.status === 'rejected' ? 'REJECTED' :
      'APPLIED';
    applyBtn = (
      <NeuInset
        small
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '11px', borderRadius: 14,
          fontFamily: OUTFIT, fontWeight: 800, fontSize: 12, letterSpacing: '0.06em', ...tone,
        }}
      >
        {myApp.status !== 'rejected' && <Check size={14} strokeWidth={2.6} />}
        {label}
      </NeuInset>
    );
  } else if (!isSignedIn) {
    applyBtn = (
      <NeuButton
        onClick={onSignIn}
        gradient={NEU_GRADIENTS.gold}
        textColor={FOREST}
        style={{ width: '100%', padding: '12px 20px' }}
      >
        SIGN IN TO APPLY
        <ArrowRight size={14} strokeWidth={2.6} />
      </NeuButton>
    );
  } else {
    applyBtn = (
      <NeuButton
        onClick={() => onApply(posting)}
        gradient={NEU_GRADIENTS.forest}
        style={{ width: '100%', padding: '12px 20px' }}
      >
        APPLY
        <ArrowRight size={14} strokeWidth={2.6} />
      </NeuButton>
    );
  }

  return (
    <NeuCard hover style={{ padding: 18 }}>
      {/* ── Logo + title block ── */}
      <div className="flex items-start gap-3.5">
        <Link
          href={conf ? `/conferences/${conf.slug}` : '#'}
          className="flex-shrink-0 focus:outline-none"
          style={{ textDecoration: 'none' }}
          aria-label={conf?.full_name ?? 'Conference'}
        >
          <LogoDisc
            src={conf?.logo_url}
            alt={conf?.acronym}
            size={60}
            fallbackText={(conf?.acronym ?? '?').slice(0, 3)}
          />
        </Link>

        <div className="min-w-0 flex-1">
          <h3
            className="leading-snug"
            style={{ color: INK, fontFamily: OUTFIT, fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}
          >
            {posting.role_name}
          </h3>
          {conf && (
            <div style={{ marginTop: 3 }}>
              <Link
                href={`/conferences/${conf.slug}`}
                className="focus:outline-none transition-colors"
                style={{ color: FOREST, textDecoration: 'none', fontFamily: OUTFIT, fontWeight: 800, fontSize: 13.5, letterSpacing: '0.02em' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = GOLD_DEEP; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = FOREST; }}
              >
                {conf.acronym}
              </Link>
              <p className="truncate" style={{ color: MUTED, fontFamily: OUTFIT, fontSize: 11.5, margin: 0, marginTop: 1 }}>
                {conf.full_name}
              </p>
            </div>
          )}
          {posting.conference_committees?.name && (
            <p className="truncate" style={{ color: '#8A7D6C', fontFamily: OUTFIT, fontSize: 11, margin: 0, marginTop: 2 }}>
              {posting.conference_committees.name}
            </p>
          )}
        </div>
      </div>

      {/* ── Glyph chips: category + compensation ── */}
      <div className="mt-3.5 flex items-center gap-2 flex-wrap">
        <GlyphChip emoji={cat.emoji} icon={cat.icon} gradient={cat.gradient} label={cat.single} tone={catKey === 'chairs' ? 'gold' : 'ink'} />
        <GlyphChip emoji={comp.emoji} icon={comp.icon} gradient={comp.gradient} label={comp.label} tone={comp.gold ? 'gold' : 'muted'} />
      </div>

      {/* ── Meta well ── */}
      <NeuInset style={{ marginTop: 14, padding: '11px 14px', borderRadius: 14 }}>
        <div className="flex flex-col gap-[7px]">
          {(conf?.city || conf?.country) && (
            <div className="flex items-center gap-2">
              <MapPin size={13} strokeWidth={2.2} style={{ color: FOREST_MID, flexShrink: 0 }} />
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="text-[12px] font-bold truncate" style={{ color: '#4A4238', fontFamily: OUTFIT }}>
                  {[conf?.city, conf?.country].filter(Boolean).join(', ')}
                </span>
                {countryObj && <FlagImg code={countryObj.code} size={15} />}
              </span>
            </div>
          )}
          {dateRange && (
            <div className="flex items-center gap-2">
              <CalendarDays size={13} strokeWidth={2.2} style={{ color: FOREST_MID, flexShrink: 0 }} />
              <span className="text-[12px] font-semibold" style={{ color: '#5A4F42', fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                {dateRange}
              </span>
            </div>
          )}
          {rolesAtConference > 1 && (
            <div className="flex items-center gap-2">
              <Users size={13} strokeWidth={2.2} style={{ color: FOREST_MID, flexShrink: 0 }} />
              <span className="text-[12px] font-semibold" style={{ color: '#5A4F42', fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
                {rolesAtConference} open roles at this conference
              </span>
            </div>
          )}
          {/* Recency + deadline line, urgency-tinted */}
          <div className="flex items-center gap-2">
            <Clock size={13} strokeWidth={2.2} style={{ color: deadlineColor, flexShrink: 0 }} />
            <span className="text-[12px] font-semibold" style={{ color: '#5A4F42', fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums' }}>
              {postedAgo(posting.created_at)}
              {posting.deadline ? (
                <>
                  <span style={{ color: MUTED }}> · </span>
                  <span className="font-bold" style={{ color: deadlineColor }}>
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
      </NeuInset>

      {/* ── Expandable detail ── */}
      {hasDetail && (
        <>
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-3 flex items-center gap-1 focus:outline-none transition-colors"
            style={{ color: expanded ? FOREST : '#8A7D6C', fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = FOREST; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = expanded ? FOREST : '#8A7D6C'; }}
            aria-expanded={expanded}
          >
            ROLE DETAILS
            <ChevronDown
              size={13}
              strokeWidth={2.6}
              style={{ transition: `transform 0.2s ${EASE}`, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>

          {expanded && (
            <NeuInset small style={{ marginTop: 10, padding: '13px 15px', borderRadius: 14 }}>
              {posting.description && (
                <p className="text-[12px] leading-relaxed" style={{ color: '#5A4F42', fontFamily: OUTFIT, margin: 0 }}>
                  {posting.description}
                </p>
              )}
              {checklist.length > 0 && (
                <div style={{ marginTop: posting.description ? 12 : 0 }}>
                  <p
                    style={{ color: GOLD_DEEP, fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', margin: 0, marginBottom: 7 }}
                  >
                    LOOKING FOR
                  </p>
                  <ul className="flex flex-col gap-1.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {checklist.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 size={14} strokeWidth={2.4} style={{ color: NEU.green, flexShrink: 0, marginTop: 1.5 }} />
                        <span className="text-[12px] leading-snug" style={{ color: '#4A4238', fontFamily: OUTFIT }}>
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
                    fontFamily: OUTFIT,
                    margin: 0,
                    marginTop: (posting.description || checklist.length > 0) ? 12 : 0,
                  }}
                >
                  <comp.icon size={13} strokeWidth={2.3} style={{ color: comp.gold ? GOLD_DEEP : MUTED, flexShrink: 0, marginTop: 2 }} />
                  <span>{posting.compensation_note}</span>
                </p>
              )}
            </NeuInset>
          )}
        </>
      )}

      {/* ── Dominant action ── */}
      <div className="mt-4">
        {applyBtn}
      </div>
    </NeuCard>
  );
}

// ── Column / section header ────────────────────────────────────────────────

function GroupHeader({ catKey, count }: { catKey: string; count: number }) {
  const cat = CATEGORY_META[catKey] ?? CATEGORY_META.staff;
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <NeuIconDisc gradient={cat.gradient} emoji={cat.emoji} icon={cat.icon} size={32} />
      <h2
        style={{ color: INK, fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 800, letterSpacing: '0.14em', margin: 0 }}
      >
        {cat.label}
      </h2>
      <NeuPill style={{ padding: '2px 10px', fontSize: 11 }}>{count}</NeuPill>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(27,56,40,0.16), transparent)' }} />
    </div>
  );
}

// ── Stat fragment chip ─────────────────────────────────────────────────────

function StatFragment({ value, label, gold = false }: { value: string; label: string; gold?: boolean }) {
  return (
    <NeuInset
      small
      className="inline-flex items-baseline gap-1.5"
      style={{ padding: '6px 13px', borderRadius: 999 }}
    >
      <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 15, color: gold ? GOLD_DEEP : FOREST, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.1em', color: '#6B5D4B' }}>
        {label}
      </span>
    </NeuInset>
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
    <Portal>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{ backgroundColor: 'rgba(28,20,16,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <NeuCard
          className="relative"
          style={{
            padding: 24,
            maxWidth: 448,
            width: 'calc(100% - 32px)',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex items-center justify-center focus:outline-none"
            style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm, color: MUTED }}
            aria-label="Close"
          >
            <X size={16} strokeWidth={2.4} />
          </button>

          {/* Header */}
          <div className="flex items-start gap-3 pr-8">
            <LogoDisc
              src={posting.conferences?.logo_url}
              alt={posting.conferences?.acronym}
              size={44}
              fallbackText={(posting.conferences?.acronym ?? '?').slice(0, 3)}
            />
            <div className="min-w-0">
              <p style={{ color: INK, fontFamily: OUTFIT, fontWeight: 800, fontSize: 16, margin: 0 }}>
                {posting.role_name}
              </p>
              <p style={{ color: MUTED, fontFamily: OUTFIT, fontSize: 12.5, margin: 0, marginTop: 2 }}>
                <span style={{ color: FOREST, fontWeight: 800 }}>{posting.conferences?.acronym}</span>
                {posting.conferences?.full_name ? ` · ${posting.conferences.full_name}` : ''}
              </p>
            </div>
          </div>

          {/* MUN CV summary */}
          <NeuInset small style={{ padding: 13, borderRadius: 14, marginTop: 18 }}>
            <p className="text-xs" style={{ color: '#5A4F42', fontFamily: OUTFIT }}>
              Your MUN CV has{' '}
              <span className="font-black" style={{ color: INK, fontVariantNumeric: 'tabular-nums' }}>{cvCount}</span>
              {' '}entr{cvCount === 1 ? 'y' : 'ies'}.
            </p>
            {cvCount === 0 && (
              <div
                className="mt-2 rounded-lg p-2.5"
                style={{ backgroundColor: 'rgba(238,217,138,0.18)', border: '1px solid rgba(238,217,138,0.34)' }}
              >
                <p className="text-xs" style={{ color: GOLD_DEEP, fontFamily: OUTFIT }}>
                  Consider adding entries to your MUN CV to strengthen your application.{' '}
                  <Link href="/account/cv" className="font-bold underline focus:outline-none" style={{ color: GOLD_DEEP }}>
                    Add now →
                  </Link>
                </p>
              </div>
            )}
          </NeuInset>

          {/* Cover note */}
          <div style={{ marginTop: 18 }}>
            <label
              className="block"
              style={{ color: MUTED, fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', marginBottom: 8 }}
            >
              COVER NOTE (OPTIONAL)
            </label>
            <NeuInset small style={{ borderRadius: 12, padding: 2 }}>
              <textarea
                rows={4}
                value={coverNote}
                onChange={e => setCoverNote(e.target.value)}
                placeholder="Tell the conference team why you'd be a great fit for this role..."
                className="w-full text-sm focus:outline-none"
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: INK,
                  fontFamily: OUTFIT,
                  padding: '10px 12px',
                  resize: 'vertical',
                  lineHeight: 1.6,
                }}
              />
            </NeuInset>
          </div>

          {/* Submit */}
          <NeuButton
            onClick={() => onSubmit(coverNote)}
            disabled={applying}
            gradient={NEU_GRADIENTS.forest}
            style={{ width: '100%', marginTop: 18, padding: '13px 22px' }}
          >
            {applying ? 'SUBMITTING…' : 'SUBMIT APPLICATION'}
          </NeuButton>
        </NeuCard>
      </div>
    </Portal>
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
      <FooterLegal tone="ivory" />
    </footer>
  );
}

// ── Coming-soon screen ───────────────────────────────────────────────────
// Rendered in place of the live board while JOB_BOARD_ENABLED is false.
// Reuses the same page shell (ambient washes, grain, SiteNav, Footer) so the
// experience stays cohesive with the rest of the conferences surface.

function ComingSoonScreen() {
  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: NEU.base, overflowX: 'clip' }}>
      {/* Decorative bleed — faded forest glyphs off the page edges. */}
      <DecorativeBleed
        items={[
          { Icon: Briefcase, size: 168, top: '-40px', left: '-46px', opacity: 0.05 },
          { Icon: Gavel, size: 150, bottom: '-38px', right: '-30px', opacity: 0.045, rotate: -12 },
          { Icon: ScrollText, size: 120, top: '46%', left: '-30px', opacity: 0.04 },
        ]}
      />
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

      {/* Soft ambient washes */}
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

        <main className="flex-1 flex items-center justify-center px-6 py-16 md:py-24">
          <NeuCard
            className="w-full text-center"
            style={{ maxWidth: 520, padding: '40px 28px 44px' }}
          >
            {/* Otter-in-construction, seated in a soft neu inset */}
            <div className="flex justify-center">
              <NeuInset
                className="inline-flex items-center justify-center"
                style={{ borderRadius: 28, padding: 18 }}
              >
                <img
                  src="/WIP.png"
                  alt="Gavelling otter in a hard hat, hard at work"
                  style={{ width: 'clamp(200px, 52vw, 280px)', height: 'auto', display: 'block' }}
                />
              </NeuInset>
            </div>

            {/* Eyebrow */}
            <p
              className="mt-7"
              style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.15em', color: GOLD_DEEP }}
            >
              CHAIR &amp; STAFF BOARD
            </p>

            {/* Headline */}
            <h1
              className="mt-2"
              style={{
                fontFamily: OUTFIT, fontWeight: 900,
                fontSize: 'clamp(28px, 5.5vw, 40px)', lineHeight: 1.05, color: INK, margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              Opportunities are{' '}
              <span style={{ color: FOREST }}>coming soon</span>
              <span style={{ color: GOLD_DEEP }}>.</span>
            </h1>

            {/* Subcopy */}
            <p
              className="mt-4 mx-auto"
              style={{ fontFamily: OUTFIT, fontSize: 14.5, color: '#6B5D4B', maxWidth: 400, lineHeight: 1.65 }}
            >
              This is where{' '}
              <span style={{ color: INK, fontWeight: 700 }}>chairing</span>,{' '}
              <span style={{ color: INK, fontWeight: 700 }}>secretariat</span>, and{' '}
              <span style={{ color: INK, fontWeight: 700 }}>staff</span>{' '}
              opportunities across conferences will live. We&rsquo;re putting the
              finishing touches on it — check back soon.
            </p>

            {/* Category glyph chips — a quiet preview of what's coming */}
            <div className="mt-7 flex items-center justify-center gap-2 flex-wrap">
              {CATEGORY_ORDER.map(key => (
                <GlyphChip
                  key={key}
                  emoji={CATEGORY_META[key].emoji}
                  icon={CATEGORY_META[key].icon}
                  gradient={CATEGORY_META[key].gradient}
                  label={CATEGORY_META[key].single}
                  tone={key === 'chairs' ? 'gold' : 'ink'}
                />
              ))}
            </div>
          </NeuCard>
        </main>

        <Footer />
      </div>
    </div>
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

  // While the board is disabled, show only the friendly coming-soon screen.
  // (All hooks above have already run, so this early return is hook-safe.)
  if (!JOB_BOARD_ENABLED) {
    return <ComingSoonScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: NEU.base, overflowX: 'clip' }}>
      {/* Decorative bleed — faded forest job-board glyphs off the page edges,
          behind the z-10 content column. */}
      <DecorativeBleed
        items={[
          { Icon: Briefcase, size: 168, top: '-40px', left: '-46px', opacity: 0.05 },
          { Icon: Gavel, size: 150, bottom: '-38px', right: '-30px', opacity: 0.045, rotate: -12 },
          { Icon: ScrollText, size: 120, top: '46%', left: '-30px', opacity: 0.04 },
        ]}
      />
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
            style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 10, letterSpacing: '0.15em', color: GOLD_DEEP }}
          >
            CHAIR &amp; STAFF BOARD
          </p>
          <h1
            style={{
              fontFamily: OUTFIT, fontWeight: 900,
              fontSize: 'clamp(36px, 4.5vw, 60px)', lineHeight: 1.02, color: INK, margin: 0,
            }}
          >
            Find Your Next{' '}
            <span style={{ color: FOREST }}>Role</span>
            <span style={{ color: GOLD_DEEP }}>.</span>
          </h1>
          <p
            className="mt-3"
            style={{ fontFamily: OUTFIT, fontSize: 14, color: '#8A7D6C', maxWidth: 460, lineHeight: 1.6 }}
          >
            Open positions for chairs, secretariat, and staff across MUN conferences worldwide.
          </p>

          {/* Stat fragments */}
          {!loading && (
            <div className="mt-5 flex items-center gap-2.5 flex-wrap">
              <StatFragment value={pad(totalOpen)} label={`OPEN ROLE${totalOpen === 1 ? '' : 'S'}`} />
              <StatFragment value={pad(conferencesHiring)} label={`CONFERENCE${conferencesHiring === 1 ? '' : 'S'} HIRING`} />
              <StatFragment value={pad(fundedRoles)} label="WITH REWARDS" gold />
            </div>
          )}
        </header>

        {/* ── Sticky neu filter bar. Sticks BELOW the fixed 72px desktop nav
            pill (md:top-[84px]) so it never slides under it on scroll. ── */}
        <div className="sticky z-30 px-4 md:px-10 top-3 md:top-[84px]">
          <NeuCard style={{ borderRadius: 26 }}>
            <div className="flex items-center gap-2.5 px-3 py-2.5 flex-wrap">
              {/* Search */}
              <NeuInset small className="flex items-center flex-1" style={{ minWidth: 180, borderRadius: 999, padding: '0 6px' }}>
                <Search size={15} className="ml-2 flex-shrink-0 pointer-events-none" style={{ color: MUTED }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search roles, conferences, cities…"
                  className="w-full py-2 pl-2.5 pr-3 text-sm focus:outline-none"
                  style={{ border: 'none', backgroundColor: 'transparent', color: INK, fontFamily: OUTFIT }}
                />
              </NeuInset>

              <div className="hidden md:block w-px h-6 flex-shrink-0" style={{ backgroundColor: 'rgba(221,212,192,0.9)' }} />

              {/* Category pills, toggle on/off */}
              {CATEGORY_ORDER.map(key => (
                <FilterPill
                  key={key}
                  label={CATEGORY_META[key].label}
                  emoji={CATEGORY_META[key].emoji}
                  icon={CATEGORY_META[key].icon}
                  gradient={CATEGORY_META[key].gradient}
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
                  emoji={COMP_META[key].emoji}
                  icon={COMP_META[key].icon}
                  gradient={COMP_META[key].gradient}
                  active={compensationFilter === key}
                  onClick={() => setCompensationFilter(f => f === key ? '' : key)}
                />
              ))}

              {/* Count / clear */}
              <div className="ml-auto flex items-center gap-2.5 flex-shrink-0">
                {hasActiveFilters && (
                  <button
                    onClick={() => { setSearchQuery(''); setCategoryFilter(''); setCompensationFilter(''); }}
                    className="flex items-center gap-1 focus:outline-none transition-colors"
                    style={{ color: MUTED, fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = DANGER; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = MUTED; }}
                  >
                    <X size={11} strokeWidth={2.5} />
                    CLEAR
                  </button>
                )}
                <p
                  style={{ color: '#6B5D4B', fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', margin: 0, fontVariantNumeric: 'tabular-nums' }}
                >
                  {filtered.length} ROLE{filtered.length !== 1 ? 'S' : ''}
                </p>
              </div>
            </div>
          </NeuCard>
        </div>

        {/* ── Main content ─────────────────────────────────────────── */}
        <main className="flex-1 px-6 md:px-14 pt-10 pb-14">
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {Array.from({ length: 3 }).map((_, col) => (
                <div key={col}>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="animate-pulse" style={{ width: 32, height: 32, borderRadius: 11, backgroundColor: '#E4DCCB' }} />
                    <div className="animate-pulse rounded-full" style={{ width: 110, height: 12, backgroundColor: '#E4DCCB' }} />
                  </div>
                  <div className="flex flex-col gap-4">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <NeuCard key={i} style={{ padding: 18 }}>
                        <div className="flex items-start gap-3.5">
                          <div className="animate-pulse rounded-full flex-shrink-0" style={{ width: 60, height: 60, backgroundColor: '#EDE7D8' }} />
                          <div className="flex-1">
                            <div className="animate-pulse rounded-lg mb-2" style={{ width: '75%', height: 16, backgroundColor: '#EDE7D8' }} />
                            <div className="animate-pulse rounded-full" style={{ width: '55%', height: 11, backgroundColor: '#EDE7D8' }} />
                          </div>
                        </div>
                        <div className="animate-pulse rounded-xl mt-4" style={{ width: '100%', height: 62, backgroundColor: '#F0EBDD' }} />
                        <div className="animate-pulse rounded-xl mt-4" style={{ width: '100%', height: 42, backgroundColor: '#F0EBDD' }} />
                      </NeuCard>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <NeuIconDisc gradient={NEU_GRADIENTS.forest} emoji="Briefcase" icon={Briefcase} size={64} style={{ marginBottom: 18 }} />
              {postings.length === 0 ? (
                <>
                  <h2 style={{ color: INK, fontFamily: OUTFIT, fontWeight: 800, fontSize: 19, marginBottom: 8 }}>
                    No positions open yet
                  </h2>
                  <p className="text-sm mb-6" style={{ color: MUTED, fontFamily: OUTFIT, maxWidth: 440 }}>
                    Conferences will post open positions here. Check back soon.
                  </p>
                  <NeuButton onClick={() => router.push('/my-conferences')} gradient={NEU_GRADIENTS.forest}>
                    LIST YOUR CONFERENCE
                    <ArrowRight size={14} strokeWidth={2.6} />
                  </NeuButton>
                </>
              ) : (
                <>
                  <h2 style={{ color: INK, fontFamily: OUTFIT, fontWeight: 800, fontSize: 19, marginBottom: 12 }}>
                    No positions match your filters
                  </h2>
                  <button
                    onClick={() => { setSearchQuery(''); setCategoryFilter(''); setCompensationFilter(''); }}
                    className="focus:outline-none"
                    style={{ color: FOREST, fontFamily: OUTFIT, fontWeight: 700, fontSize: 13, textDecoration: 'underline' }}
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
