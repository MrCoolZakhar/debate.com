'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Briefcase } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { createAuthClient } from '@/lib/supabase-auth';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

type CategoryFilter = 'ALL' | 'CHAIRS' | 'SECRETARIAT' | 'STAFF';
type CompensationFilter = 'ALL' | 'PAID' | 'UNPAID' | 'TRAVEL COVERED';

interface JobPosting {
  id: string;
  category: string;
  role_name: string;
  description: string | null;
  requirements: string | null;
  compensation: string | null;
  deadline: string | null;
  is_open: boolean;
  conferences: {
    full_name: string;
    acronym: string;
    city: string;
    country: string;
    logo_url: string | null;
    slug: string;
  } | null;
}

function FilterPill({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-bold tracking-widest transition-all focus:outline-none"
      style={{
        backgroundColor: active ? '#1B3828' : 'transparent',
        color: active ? '#EED98A' : '#1C1410',
        border: active ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
        fontFamily: "'DM Mono', monospace",
        letterSpacing: '0.07em',
      }}
    >
      {label}
    </button>
  );
}

function JobCard({ job }: { job: JobPosting }) {
  const categoryStyle =
    job.category === 'CHAIRS'
      ? { backgroundColor: 'rgba(27,56,40,0.1)', color: '#1B3828' }
      : job.category === 'SECRETARIAT'
      ? { backgroundColor: 'rgba(238,217,138,0.2)', color: '#B8844A' }
      : { backgroundColor: 'rgba(154,138,120,0.15)', color: '#9A8A78' };

  const compStyle =
    job.compensation === 'PAID'
      ? { backgroundColor: 'rgba(61,122,82,0.1)', color: '#1B3828' }
      : job.compensation === 'TRAVEL COVERED'
      ? { backgroundColor: 'rgba(238,217,138,0.2)', color: '#B8844A' }
      : { backgroundColor: 'rgba(154,138,120,0.12)', color: '#9A8A78' };

  return (
    <div
      className="rounded-2xl p-5 flex flex-col transition-all"
      style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#1B3828';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(27,56,40,0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      {/* Category pill */}
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full self-start mb-2" style={{ ...categoryStyle, fontFamily: "'DM Mono', monospace" }}>
        {job.category}
      </span>

      {/* Role name */}
      <p className="font-semibold text-base mb-0.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{job.role_name}</p>

      {/* Conference name */}
      {job.conferences && (
        <p className="text-xs mb-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{job.conferences.full_name}</p>
      )}

      {/* Location */}
      {job.conferences && (
        <p className="text-xs mb-3" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
          {job.conferences.city}, {job.conferences.country}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap mb-auto">
        {job.compensation && (
          <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ ...compStyle, fontFamily: "'DM Mono', monospace" }}>
            {job.compensation}
          </span>
        )}
        {job.deadline && (
          <span className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
            Closes {new Date(job.deadline + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>

      {/* Apply button */}
      <Link
        href={`/conferences/${job.conferences?.slug ?? ''}`}
        className="mt-4 w-full text-center rounded-lg py-2 px-4 text-xs font-bold transition-colors focus:outline-none"
        style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif', textDecoration: 'none", letterSpacing: '0.04em', textDecoration: 'none' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
      >
        APPLY →
      </Link>
    </div>
  );
}

export default function ConferencesRolesClient() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [compensationFilter, setCompensationFilter] = useState<CompensationFilter>('ALL');

  useEffect(() => {
    async function fetchJobs() {
      setLoading(true);
      const supabase = createAuthClient();
      const { data } = await supabase
        .from('job_postings')
        .select(`
          id, category, role_name, description, requirements, compensation, deadline, is_open,
          conferences (full_name, acronym, city, country, logo_url, slug)
        `)
        .eq('is_open', true)
        .order('created_at', { ascending: false });
      setJobs((data as unknown as JobPosting[]) ?? []);
      setLoading(false);
    }
    fetchJobs();
  }, []);

  const filtered = jobs.filter(j => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !j.role_name.toLowerCase().includes(q) &&
        !(j.conferences?.full_name.toLowerCase().includes(q)) &&
        !(j.conferences?.acronym.toLowerCase().includes(q))
      ) return false;
    }
    if (categoryFilter !== 'ALL' && j.category !== categoryFilter) return false;
    if (compensationFilter !== 'ALL' && j.compensation !== compensationFilter) return false;
    return true;
  });

  const categories: CategoryFilter[] = ['ALL', 'CHAIRS', 'SECRETARIAT', 'STAFF'];
  const compensations: CompensationFilter[] = ['ALL', 'PAID', 'UNPAID', 'TRAVEL COVERED'];

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
        <div className="px-6 md:px-14 py-10" style={{ backgroundColor: '#1B3828' }}>
          <p className="text-[10px] tracking-[0.2em] mb-1" style={{ color: '#EED98A', fontFamily: "'DM Mono', monospace" }}>CHAIR &amp; STAFF BOARD</p>
          <h1 className="font-black text-3xl text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>Find Your Next Role</h1>
          <p className="text-sm" style={{ color: 'rgba(237,231,216,0.7)', fontFamily: "'Outfit', sans-serif" }}>
            Open positions for chairs, secretariat, and staff across MUN conferences.
          </p>
        </div>

        {/* Filter bar */}
        <div className="px-6 md:px-14 py-3 flex items-center gap-3 flex-wrap" style={{ backgroundColor: '#FAF8F3', borderBottom: '1px solid #DDD4C0' }}>
          {/* Search */}
          <div className="relative" style={{ minWidth: 0 }}>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#9A8A78' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search roles..."
              className="w-[220px] rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none transition-colors"
              style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
              onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
              onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
            />
          </div>

          <div className="w-px h-5" style={{ backgroundColor: '#DDD4C0' }} />

          {categories.map(c => (
            <FilterPill key={c} label={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)} />
          ))}

          <div className="w-px h-5" style={{ backgroundColor: '#DDD4C0' }} />

          {compensations.map(c => (
            <FilterPill key={c} label={c} active={compensationFilter === c} onClick={() => setCompensationFilter(c)} />
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
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Briefcase size={48} style={{ color: 'rgba(27,56,40,0.2)', marginBottom: '16px' }} />
              <h2 className="font-semibold text-lg mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>No positions open yet</h2>
              <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", maxWidth: '440px' }}>
                Conferences will post open positions here. Check back soon or list your conference to start recruiting.
              </p>
              <Link
                href="/conferences/organise"
                className="rounded-xl py-3 px-6 font-bold text-sm tracking-widest transition-colors focus:outline-none"
                style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.07em', textDecoration: 'none' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                LIST YOUR CONFERENCE →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(job => <JobCard key={job.id} job={job} />)}
            </div>
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
