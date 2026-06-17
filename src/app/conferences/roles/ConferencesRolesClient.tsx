'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Briefcase, X } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase as anonSupabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { getFlagUrl, getCountryByName } from '@/lib/countries';

// ── Constants ──────────────────────────────────────────────────────────────

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

const FOREST = '#1B3828';
const GOLD = '#EED98A';
const INK = '#1C1410';
const MUTED = '#9A8A78';
const CARD_BG = '#FAF8F3';
const BORDER = '#DDD4C0';
const DIVIDER = '#F0EDE6';
const AMBER_TEXT = '#B6871F';

// ── Types ──────────────────────────────────────────────────────────────────

interface ConferenceInfo {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  city: string | null;
  country: string | null;
  logo_url: string | null;
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

function isDeadlineSoon(deadline: string): boolean {
  const ms = new Date(deadline).getTime() - Date.now();
  return ms > 0 && ms < 7 * 24 * 60 * 60 * 1000;
}

function fmtDeadline(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Filter pill ────────────────────────────────────────────────────────────

function FilterPill({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-bold tracking-widest transition-all focus:outline-none"
      style={{
        backgroundColor: active ? FOREST : 'transparent',
        color: active ? GOLD : INK,
        border: active ? `1.5px solid ${FOREST}` : `1.5px solid ${BORDER}`,
        fontFamily: "'DM Mono', monospace",
        letterSpacing: '0.07em',
      }}
    >
      {label}
    </button>
  );
}

// ── Posting card ───────────────────────────────────────────────────────────

function PostingCard({
  posting,
  myApp,
  onApply,
  onSignIn,
  isSignedIn,
}: {
  posting: JobPosting;
  myApp: MyApplication | undefined;
  onApply: (posting: JobPosting) => void;
  onSignIn: () => void;
  isSignedIn: boolean;
}) {
  const conf = posting.conferences;
  const dateRange = formatDateRange(conf?.start_date ?? null, conf?.end_date ?? null);

  const catColor =
    posting.category === 'CHAIRS' ? FOREST :
    posting.category === 'SECRETARIAT' ? AMBER_TEXT :
    MUTED;

  const catBg =
    posting.category === 'CHAIRS' ? 'rgba(27,56,40,0.1)' :
    posting.category === 'SECRETARIAT' ? 'rgba(238,217,138,0.15)' :
    'rgba(154,138,120,0.1)';

  const compStyle =
    posting.compensation === 'PAID'
      ? { backgroundColor: 'rgba(61,122,82,0.1)', color: FOREST }
      : posting.compensation === 'TRAVEL COVERED'
      ? { backgroundColor: 'rgba(238,217,138,0.15)', color: AMBER_TEXT }
      : { backgroundColor: 'rgba(154,138,120,0.12)', color: MUTED };

  const countryObj = conf?.country ? getCountryByName(conf.country) : null;

  let applyBtn: React.ReactNode;
  if (myApp) {
    const btnStyle =
      myApp.status === 'accepted'
        ? { backgroundColor: 'rgba(61,122,82,0.12)', color: FOREST }
        : myApp.status === 'rejected'
        ? { backgroundColor: 'rgba(220,53,69,0.08)', color: '#DC3545' }
        : { backgroundColor: 'rgba(27,56,40,0.08)', color: FOREST };
    const label =
      myApp.status === 'accepted' ? 'ACCEPTED ✓' :
      myApp.status === 'rejected' ? 'REJECTED' :
      'APPLIED ✓';
    applyBtn = (
      <button
        disabled
        className="w-full rounded-xl py-2.5 font-bold text-sm cursor-default focus:outline-none"
        style={{ fontFamily: "'Outfit', sans-serif", ...btnStyle }}
      >
        {label}
      </button>
    );
  } else if (!isSignedIn) {
    applyBtn = (
      <button
        onClick={onSignIn}
        className="w-full rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-all"
        style={{
          fontFamily: "'Outfit', sans-serif",
          border: `1.5px solid ${BORDER}`,
          backgroundColor: 'transparent',
          color: MUTED,
          letterSpacing: '0.04em',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = FOREST;
          (e.currentTarget as HTMLElement).style.color = FOREST;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = BORDER;
          (e.currentTarget as HTMLElement).style.color = MUTED;
        }}
      >
        SIGN IN TO APPLY →
      </button>
    );
  } else {
    applyBtn = (
      <button
        onClick={() => onApply(posting)}
        className="w-full rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-all"
        style={{
          fontFamily: "'Outfit', sans-serif",
          backgroundColor: FOREST,
          color: GOLD,
          letterSpacing: '0.04em',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = FOREST; }}
      >
        APPLY FOR THIS ROLE →
      </button>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col transition-all"
      style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}` }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = FOREST;
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(27,56,40,0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = BORDER;
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      {/* Top color strip */}
      <div style={{ height: '5px', backgroundColor: catColor }} />

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        {/* Row 1: category + compensation */}
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: catBg, color: catColor, fontFamily: "'DM Mono', monospace" }}
          >
            {posting.category}
          </span>
          <div className="flex-1" />
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full"
            style={{ ...compStyle, fontFamily: "'DM Mono', monospace" }}
          >
            {posting.compensation}
          </span>
        </div>

        {/* Role name */}
        <p className="mt-2 font-semibold text-base leading-snug" style={{ color: INK, fontFamily: "'Outfit', sans-serif" }}>
          {posting.role_name}
        </p>

        {/* Conference name */}
        {conf && (
          <div className="mt-1 flex items-center gap-2">
            {conf.logo_url ? (
              <img
                src={conf.logo_url}
                alt={conf.acronym}
                className="rounded object-cover flex-shrink-0"
                style={{ width: '20px', height: '20px' }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <span
                className="text-[10px] flex-shrink-0"
                style={{ color: MUTED, fontFamily: "'DM Mono', monospace" }}
              >
                {conf.acronym}
              </span>
            )}
            <p className="text-xs truncate" style={{ color: MUTED, fontFamily: "'Outfit', sans-serif" }}>
              {conf.full_name}
            </p>
          </div>
        )}

        {/* Location */}
        {conf?.country && (
          <div className="mt-0.5 flex items-center gap-1.5">
            {countryObj && (
              <img
                src={getFlagUrl(countryObj.code)}
                alt={conf.country}
                style={{ width: '14px', height: '10px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <p className="text-xs" style={{ color: MUTED, fontFamily: "'Outfit', sans-serif" }}>
              {[conf.city, conf.country].filter(Boolean).join(', ')}
            </p>
          </div>
        )}

        {/* Dates */}
        {dateRange && (
          <p className="mt-0.5 text-xs" style={{ color: MUTED, fontFamily: "'DM Mono', monospace" }}>
            {dateRange}
          </p>
        )}

        {/* Committee */}
        {posting.conference_committees?.name && (
          <p className="mt-0.5 text-xs" style={{ color: MUTED, fontFamily: "'Outfit', sans-serif" }}>
            · {posting.conference_committees.name}
          </p>
        )}

        {/* Description */}
        {posting.description && (
          <p
            className="mt-2 text-xs leading-relaxed flex-1"
            style={{
              color: INK,
              fontFamily: "'Outfit', sans-serif",
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {posting.description}
          </p>
        )}

        {/* Deadline */}
        {posting.deadline && (
          <p
            className="mt-2 text-xs font-semibold"
            style={{
              color: isDeadlineSoon(posting.deadline) ? '#B8844A' : MUTED,
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Closes {fmtDeadline(posting.deadline)}
          </p>
        )}

        {/* Apply button */}
        <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${DIVIDER}` }}>
          {applyBtn}
        </div>
      </div>
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
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative"
        style={{
          backgroundColor: CARD_BG,
          borderRadius: '20px',
          padding: '24px',
          maxWidth: '448px',
          width: 'calc(100% - 32px)',
          maxHeight: '90vh',
          overflowY: 'auto',
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
              <p className="text-xs" style={{ color: AMBER_TEXT, fontFamily: "'Outfit', sans-serif" }}>
                Consider adding entries to your MUN CV to strengthen your application.{' '}
                <Link
                  href="/account/cv"
                  className="font-semibold underline focus:outline-none"
                  style={{ color: AMBER_TEXT }}
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
            style={{ color: MUTED, fontFamily: "'DM Mono', monospace", letterSpacing: '0.05em' }}
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
            if (!applying) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C';
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
        backgroundColor: '#F6F1E9',
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

export default function ConferencesRolesClient() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();

  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [myApplications, setMyApplications] = useState<MyApplication[]>([]);
  const [cvCount, setCvCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [compensationFilter, setCompensationFilter] = useState('all');
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
          conferences (id, slug, full_name, acronym, city, country, logo_url, start_date, end_date),
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

  const filtered = postings.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      p.role_name.toLowerCase().includes(q) ||
      (p.conferences?.full_name ?? '').toLowerCase().includes(q) ||
      (p.conferences?.city ?? '').toLowerCase().includes(q);
    const matchCategory = categoryFilter === 'all' || p.category === categoryFilter;
    const matchComp = compensationFilter === 'all' || p.compensation === compensationFilter;
    return matchSearch && matchCategory && matchComp;
  });

  const totalOpen = postings.length;
  const conferencesHiring = new Set(postings.map(p => p.conferences?.id).filter(Boolean)).size;

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

  const categories = ['all', 'CHAIRS', 'SECRETARIAT', 'STAFF'];
  const compensations = ['all', 'PAID', 'UNPAID', 'TRAVEL COVERED'];

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

      <div className="relative z-10 flex flex-col min-h-screen">
        <SiteNav />

        {/* Hero bar */}
        <div className="px-6 md:px-14 py-10" style={{ backgroundColor: FOREST }}>
          <p
            className="text-[10px] tracking-[0.2em] mb-1"
            style={{ color: GOLD, fontFamily: "'DM Mono', monospace" }}
          >
            CHAIR &amp; STAFF BOARD
          </p>
          <h1
            className="font-black text-3xl text-white mb-2"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Find Your Next Role
          </h1>
          <p
            className="text-sm"
            style={{ color: 'rgba(237,231,216,0.7)', fontFamily: "'Outfit', sans-serif" }}
          >
            Open positions for chairs, secretariat, and staff across MUN conferences.
          </p>

          {/* Stats */}
          <div className="mt-6 flex gap-6 flex-wrap">
            {[
              { value: totalOpen, label: 'OPEN POSITIONS' },
              { value: conferencesHiring, label: 'CONFERENCES HIRING' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p
                  className="font-black text-2xl text-white"
                  style={{ fontFamily: "'Outfit', sans-serif" }}
                >
                  {value}
                </p>
                <p
                  className="text-xs"
                  style={{ color: 'rgba(238,217,138,0.6)', fontFamily: "'DM Mono', monospace" }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Filter bar */}
        <div
          className="px-6 md:px-14 py-3 flex flex-wrap gap-3 items-center sticky z-10"
          style={{
            top: '72px',
            backgroundColor: CARD_BG,
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          {/* Search */}
          <div className="relative flex-shrink-0">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: MUTED }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search roles or conferences..."
              className="rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none transition-colors"
              style={{
                width: '260px',
                border: `1px solid ${BORDER}`,
                backgroundColor: CARD_BG,
                color: INK,
                fontFamily: "'Outfit', sans-serif",
              }}
              onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = FOREST; }}
              onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
            />
          </div>

          <div className="w-px h-5 flex-shrink-0" style={{ backgroundColor: BORDER }} />

          {categories.map(c => (
            <FilterPill
              key={c}
              label={c === 'all' ? 'ALL' : c}
              active={categoryFilter === c}
              onClick={() => setCategoryFilter(c)}
            />
          ))}

          <div className="w-px h-5 flex-shrink-0" style={{ backgroundColor: BORDER }} />

          {compensations.map(c => (
            <FilterPill
              key={c}
              label={c === 'all' ? 'ALL' : c}
              active={compensationFilter === c}
              onClick={() => setCompensationFilter(c)}
            />
          ))}

          <p
            className="ml-auto text-xs flex-shrink-0"
            style={{ color: MUTED, fontFamily: "'DM Mono', monospace" }}
          >
            {filtered.length} position{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Main content */}
        <main className="flex-1 px-6 md:px-14 py-10">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl animate-pulse"
                  style={{ height: '160px', backgroundColor: BORDER }}
                />
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
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
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
                      setCategoryFilter('all');
                      setCompensationFilter('all');
                    }}
                    className="text-sm font-semibold focus:outline-none"
                    style={{ color: FOREST, textDecoration: 'underline' }}
                  >
                    CLEAR FILTERS
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(posting => (
                <PostingCard
                  key={posting.id}
                  posting={posting}
                  myApp={appsByPostingId[posting.id]}
                  onApply={(p) => setSelectedPosting(p)}
                  onSignIn={() => router.push('/auth/signin?next=/conferences/roles')}
                  isSignedIn={!!user}
                />
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
