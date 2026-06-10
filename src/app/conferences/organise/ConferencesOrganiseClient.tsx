'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

type StatusFilter = 'ALL' | 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

interface OrgConference {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  city: string;
  country: string;
  start_date: string;
  end_date: string;
  is_public: boolean;
  status: string;
  logo_url: string | null;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}–${e.getDate()} ${months[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${s.getDate()} ${months[s.getMonth()]} – ${e.getDate()} ${months[e.getMonth()]} ${e.getFullYear()}`;
}

function ConferenceManageCard({ conf }: { conf: OrgConference }) {
  const isLive = conf.is_public;
  const isDraft = conf.status === 'private' && !conf.is_public;
  const isArchived = conf.status === 'archived';

  const statusLabel = isLive ? 'LIVE' : isArchived ? 'ARCHIVED' : 'DRAFT';
  const statusStyle = isLive
    ? { backgroundColor: 'rgba(61,122,82,0.12)', color: '#1B3828' }
    : isArchived
    ? { backgroundColor: 'rgba(154,138,120,0.15)', color: '#9A8A78' }
    : { backgroundColor: 'rgba(238,217,138,0.2)', color: '#B8844A' };

  const stripStyle = isLive
    ? { background: 'linear-gradient(to right, #1B3828, #3D7A52)' }
    : isArchived
    ? { backgroundColor: '#9A8A78' }
    : { backgroundColor: '#DDD4C0' };

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#1B3828';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(27,56,40,0.10)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      {/* Top accent strip */}
      <div style={{ height: '6px', ...stripStyle }} />

      <div className="p-5">
        {/* Row 1: acronym + status pill */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px]" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>{conf.acronym}</span>
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full"
            style={{ ...statusStyle, fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em' }}
          >
            {statusLabel}
          </span>
        </div>

        {/* Row 2: full name */}
        <p
          className="text-sm font-semibold mb-1 leading-snug"
          style={{
            color: '#1C1410', fontFamily: "'Outfit', sans-serif",
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {conf.full_name}
        </p>

        {/* Row 3: city + country */}
        <p className="text-xs mb-1" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          {conf.city}, {conf.country}
        </p>

        {/* Row 4: date range */}
        <p className="text-xs mb-3" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
          {formatDateRange(conf.start_date, conf.end_date)}
        </p>

        {/* Row 5: action buttons */}
        <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid #DDD4C0' }}>
          <Link
            href={`/manage/${conf.slug}`}
            className="flex-1 text-center rounded-lg py-1.5 px-4 text-xs font-bold transition-colors focus:outline-none"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", textDecoration: 'none', letterSpacing: '0.04em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            MANAGE →
          </Link>
          <Link
            href={`/conferences/${conf.slug}`}
            className="flex-1 text-center rounded-lg py-1.5 px-4 text-xs font-semibold transition-colors focus:outline-none"
            style={{ backgroundColor: 'transparent', color: '#1C1410', border: '1px solid #DDD4C0', fontFamily: "'Outfit', sans-serif", textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
          >
            VIEW PAGE
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ConferencesOrganiseClient() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();

  const [conferences, setConferences] = useState<OrgConference[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/signin?next=/conferences/organise');
    }
  }, [authLoading, user, router]);

  // Fetch my conferences
  useEffect(() => {
    if (!user) return;

    async function fetchConferences() {
      setLoading(true);
      if (!session) return;
      const supabase = getAuthedClient(session.access_token);
      let query = supabase
        .from('conferences')
        .select('id, slug, full_name, acronym, city, country, start_date, end_date, is_public, status, logo_url')
        .eq('organizer_id', user!.id)
        .order('start_date', { ascending: true });

      if (statusFilter === 'ACTIVE') {
        query = query.eq('is_public', true);
      } else if (statusFilter === 'DRAFT') {
        query = query.eq('status', 'private');
      } else if (statusFilter === 'ARCHIVED') {
        query = query.eq('status', 'archived');
      }

      const { data } = await query;
      setConferences((data as OrgConference[]) ?? []);
      setLoading(false);
    }

    fetchConferences();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, statusFilter, session?.access_token]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const publicConfs = conferences.filter(c => c.is_public);
  const privateConfs = conferences.filter(c => !c.is_public);

  const filters: StatusFilter[] = ['ALL', 'ACTIVE', 'DRAFT', 'ARCHIVED'];

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8' }}>
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <SiteNav />

        {/* Hero bar */}
        <div className="px-6 md:px-14 py-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4" style={{ backgroundColor: '#1B3828' }}>
          <div>
            <p className="text-[10px] tracking-[0.2em] mb-1" style={{ color: '#EED98A', fontFamily: "'DM Mono', monospace" }}>MY CONFERENCES</p>
            <h1 className="font-black text-3xl text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>Your Conferences</h1>
          </div>
          <Link
            href="/conferences/new"
            className="self-start md:self-auto rounded-xl py-2.5 px-6 font-bold text-sm tracking-widest transition-colors focus:outline-none"
            style={{ backgroundColor: '#EED98A', color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em', textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'white'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EED98A'; }}
          >
            CREATE A CONFERENCE →
          </Link>
        </div>

        {/* Filter bar */}
        <div className="px-6 md:px-14 py-3 flex items-center gap-3 flex-wrap" style={{ backgroundColor: '#FAF8F3', borderBottom: '1px solid #DDD4C0' }}>
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className="px-4 py-1.5 rounded-full text-xs font-bold transition-all focus:outline-none"
              style={{
                backgroundColor: statusFilter === f ? '#1B3828' : 'transparent',
                color: statusFilter === f ? '#EED98A' : '#1C1410',
                border: statusFilter === f ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                fontFamily: "'DM Mono', monospace",
                letterSpacing: '0.06em',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Main content */}
        <main className="flex-1 px-6 md:px-14 py-10">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl animate-pulse" style={{ height: '200px', backgroundColor: '#DDD4C0' }} />
              ))}
            </div>
          ) : conferences.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <h2 className="font-semibold text-lg mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>No conferences yet</h2>
              <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", maxWidth: '440px' }}>
                Create your first conference and start managing registrations, allocations, and sessions.
              </p>
              <Link
                href="/conferences/new"
                className="rounded-xl py-3 px-6 font-bold text-sm tracking-widest transition-colors focus:outline-none"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em', textDecoration: 'none' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                CREATE A CONFERENCE →
              </Link>
            </div>
          ) : (
            <>
              {publicConfs.length > 0 && (
                <>
                  <p className="text-[10px] tracking-widest mb-3 mt-6 first:mt-0" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>PUBLIC</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {publicConfs.map(conf => <ConferenceManageCard key={conf.id} conf={conf} />)}
                  </div>
                </>
              )}
              {privateConfs.length > 0 && (
                <>
                  <p className="text-[10px] tracking-widest mb-3 mt-6" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>PRIVATE</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {privateConfs.map(conf => <ConferenceManageCard key={conf.id} conf={conf} />)}
                  </div>
                </>
              )}
            </>
          )}
        </main>

        {/* Footer */}
        <footer
          className="relative z-10 border-t border-[#DDD4C0] px-6 py-8"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='0.18'/%3E%3C/svg%3E")`,
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
                style={{ color: '#9A8A78', transition: 'color 0.15s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#1B3828'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#9A8A78'; }}
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
            <p className="text-xs font-semibold text-[#1B3828] md:text-right">© {new Date().getFullYear()} Gavelling. Built for the MUN community.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
