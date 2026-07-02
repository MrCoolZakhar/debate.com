'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Globe, MessageCircle, Music, CalendarDays, MapPin, Users, GraduationCap, Monitor, Mail, FileText, Download, Landmark, Lock, ChevronDown, Check, Megaphone } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase as anonSupabase } from '@/lib/supabase';
import { getFlagUrl, getCountryByName } from '@/lib/countries';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

// ── Types ──────────────────────────────────────────────────────────────────

interface Conference {
  id: string;
  slug: string;
  full_name: string;
  acronym: string;
  country: string;
  city: string;
  format: string;
  student_level: string;
  start_date: string;
  end_date: string;
  fee_amount: number;
  fee_currency: string;
  expected_delegates: number;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  is_public: boolean;
  status: string;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  whatsapp_url: string | null;
  website_url: string | null;
  contact_email: string | null;
  organizer_id: string;
}

interface DisplayChair {
  name: string;
  avatar_url: string | null;
}

interface Committee {
  id: string;
  name: string;
  abbreviation: string | null;
  topics: string[] | null;
  difficulty: string;
  committee_type: string;
  total_slots: number | null;
  display_chairs: DisplayChair[] | null;
}

interface CommitteeSlot {
  country_code: string;
  country_name: string;
}

interface RoleConfig {
  role: string;
  is_enabled: boolean;
  applications_open_at: string | null;
  applications_close_at: string | null;
  fee_amount: number | null;
  fee_currency: string | null;
  auto_accept: boolean;
}

interface MyApplication {
  id: string;
  role: string;
  status: string;
  payment_status: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} – ${e.getDate()} ${months[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${s.getDate()} ${months[s.getMonth()]} – ${e.getDate()} ${months[e.getMonth()]} ${e.getFullYear()}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function currencySymbol(currency: string): string {
  const map: Record<string, string> = {
    GBP: '£', USD: '$', EUR: '€', CAD: 'CA$', AUD: 'A$',
    CHF: 'CHF ', JPY: '¥', CNY: '¥', INR: '₹', BRL: 'R$', MXN: 'MX$',
  };
  return map[currency?.toUpperCase()] ?? (currency + ' ');
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const DIFFICULTY_STYLES: Record<string, { bg: string; color: string }> = {
  beginner:     { bg: 'rgba(61,122,82,0.13)',   color: '#2A5A3C' },
  intermediate: { bg: 'rgba(238,217,138,0.35)', color: '#8A6614' },
  advanced:     { bg: 'rgba(184,132,74,0.16)',  color: '#B8844A' },
  expert:       { bg: 'rgba(139,32,32,0.1)',    color: '#8B2020' },
};

// ── Sub-components ────────────────────────────────────────────────────────

function ApplicationStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    submitted: { bg: 'rgba(238,217,138,0.2)',  color: '#B8844A' },
    accepted:  { bg: 'rgba(61,122,82,0.12)',   color: '#1B3828' },
    assigned:  { bg: 'rgba(238,217,138,0.15)', color: '#B6871F' },
    rejected:  { bg: 'rgba(139,32,32,0.1)',    color: '#8B2020' },
  };
  const s = styles[status.toLowerCase()] ?? styles.submitted;
  return (
    <span
      className="text-[9px] font-bold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: s.bg, color: s.color, fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em' }}
    >
      {status.toUpperCase()}
    </span>
  );
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[20px] p-6 md:p-7 ${className}`}
      style={{
        backgroundColor: '#FAF8F3',
        border: '1px solid #DDD4C0',
        boxShadow: '0 1px 3px rgba(27,56,40,0.04)',
      }}
    >
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function ConferenceDetailClient() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const { user, session, profile, loading: authLoading } = useAuth();

  const [conference, setConference] = useState<Conference | null>(null);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>([]);
  const [myApplications, setMyApplications] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [myAllocation, setMyAllocation] = useState<any>(null);
  const [myPositionPaper, setMyPositionPaper] = useState<any>(null);
  const [ppFile, setPPFile] = useState<File | null>(null);
  const [ppUploading, setPPUploading] = useState(false);
  const [ppError, setPPError] = useState('');
  const [ppNotify, setPPNotify] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents'>('overview');
  const [studyGuides, setStudyGuides] = useState<{ id: string; title: string; file_url: string; file_name: string; is_published: boolean }[]>([]);
  const [studyGuidesLoading, setStudyGuidesLoading] = useState(false);
  const [ppEnabled, setPpEnabled] = useState(false);
  const [showPPWarning, setShowPPWarning] = useState(false);
  const ppFileInputRef = useRef<HTMLInputElement>(null);
  // Committee roster / occupancy / chair-recruitment (public reads)
  const [committeeSlots, setCommitteeSlots] = useState<Record<string, CommitteeSlot[]>>({});
  const [committeeOccupied, setCommitteeOccupied] = useState<Record<string, string[]>>({});
  const [chairJobs, setChairJobs] = useState<Record<string, string>>({});
  const [expandedRoster, setExpandedRoster] = useState<string | null>(null);
  const [pricingOpen, setPricingOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, authLoading, user?.id]);

  async function fetchAll() {
    setLoading(true);
    const supabase = anonSupabase;

    let { data: confData } = await supabase
      .from('conferences')
      .select(`
        id, slug, full_name, acronym, country, city, format, student_level,
        start_date, end_date, fee_amount, fee_currency, expected_delegates,
        description, logo_url, banner_url, is_public, status,
        instagram_url, facebook_url, tiktok_url, whatsapp_url, website_url,
        contact_email, organizer_id
      `)
      .eq('slug', slug)
      .single();

    if (!confData) {
      // Retry with authed client — may be a private conference the logged-in user owns
      if (session) {
        const authedRetry = getAuthedClient(session.access_token);
        const { data: privateConfData } = await authedRetry
          .from('conferences')
          .select(`
            id, slug, full_name, acronym, country, city, format, student_level,
            start_date, end_date, fee_amount, fee_currency, expected_delegates,
            description, logo_url, banner_url, is_public, status,
            instagram_url, facebook_url, tiktok_url, whatsapp_url, website_url,
            contact_email, organizer_id
          `)
          .eq('slug', slug)
          .single();
        if (!privateConfData) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        // Continue with privateConfData — reassign and fall through
        confData = privateConfData;
      } else {
        setNotFound(true);
        setLoading(false);
        return;
      }
    }

    const conf = confData as Conference;
    const isOrganizer = user?.id === conf.organizer_id;

    if (!conf.is_public && !isOrganizer) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setConference(conf);

    const [committeesRes, roleConfigsRes] = await Promise.all([
      supabase
        .from('conference_committees')
        .select('id, name, abbreviation, topics, difficulty, committee_type, total_slots, display_chairs')
        .eq('conference_id', conf.id)
        .order('name', { ascending: true }),
      supabase
        .from('application_role_configs')
        .select('role, is_enabled, applications_open_at, applications_close_at, fee_amount, fee_currency, auto_accept')
        .eq('conference_id', conf.id),
    ]);

    setCommittees((committeesRes.data as Committee[]) ?? []);
    setRoleConfigs((roleConfigsRes.data as RoleConfig[]) ?? []);

    // Public committee extras: full rosters, live occupancy, open chair postings
    const ccIds = ((committeesRes.data as Committee[]) ?? []).map(c => c.id);
    if (ccIds.length > 0) {
      const [slotsRes, occRes, jobsRes] = await Promise.all([
        supabase
          .from('committee_country_slots')
          .select('conference_committee_id, country_code, country_name')
          .in('conference_committee_id', ccIds)
          .order('country_name', { ascending: true }),
        supabase.rpc('get_committee_occupancy', { p_committee_ids: ccIds }),
        supabase
          .from('job_postings')
          .select('id, committee_id')
          .eq('conference_id', conf.id)
          .eq('category', 'chairs')
          .eq('is_open', true),
      ]);
      const slotsMap: Record<string, CommitteeSlot[]> = {};
      for (const row of ((slotsRes.data ?? []) as (CommitteeSlot & { conference_committee_id: string })[])) {
        (slotsMap[row.conference_committee_id] ??= []).push({ country_code: row.country_code, country_name: row.country_name });
      }
      const occMap: Record<string, string[]> = {};
      for (const row of ((occRes.data ?? []) as { conference_committee_id: string; country_code: string }[])) {
        (occMap[row.conference_committee_id] ??= []).push(row.country_code);
      }
      const jobsMap: Record<string, string> = {};
      for (const row of ((jobsRes.data ?? []) as { id: string; committee_id: string | null }[])) {
        if (row.committee_id) jobsMap[row.committee_id] = row.id;
      }
      setCommitteeSlots(slotsMap);
      setCommitteeOccupied(occMap);
      setChairJobs(jobsMap);
    }

    if (user && session) {
      const authedSupabase = getAuthedClient(session.access_token);
      const { data: appsData } = await authedSupabase
        .from('applications')
        .select('id, role, status, payment_status')
        .eq('conference_id', conf.id)
        .eq('user_id', user.id);
      setMyApplications((appsData as MyApplication[]) ?? []);

      const committeeIds = (committeesRes.data as Committee[] ?? []).map(c => c.id);
      if (committeeIds.length > 0) {
        const { data: allocData } = await authedSupabase
          .from('conference_allocations')
          .select('id, country_code, country_name, conference_committee_id, conference_committees (name, position_paper_deadline)')
          .eq('user_id', user.id)
          .in('conference_committee_id', committeeIds)
          .maybeSingle();
        setMyAllocation(allocData ?? null);
        if (allocData) {
          const { data: ppData } = await authedSupabase
            .from('position_papers')
            .select('id, status, chair_feedback, submitted_at, file_name, notify_on_feedback')
            .eq('conference_committee_id', (allocData as any).conference_committee_id)
            .eq('user_id', user.id)
            .maybeSingle();
          setMyPositionPaper(ppData ?? null);
        }
      }
    }

    setLoading(false);
  }

  const loadDocumentsData = useCallback(async () => {
    if (!myAllocation || !session) return;
    setStudyGuidesLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const { data: sgData } = await supabase
      .from('study_guides')
      .select('id, title, file_url, file_name, is_published')
      .eq('conference_committee_id', myAllocation.conference_committee_id)
      .order('created_at', { ascending: true });
    setStudyGuides((sgData ?? []) as typeof studyGuides);
    const { data: ccData } = await supabase
      .from('conference_committees')
      .select('pp_submissions_enabled')
      .eq('id', myAllocation.conference_committee_id)
      .single();
    setPpEnabled((ccData as any)?.pp_submissions_enabled ?? false);
    setStudyGuidesLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myAllocation?.conference_committee_id, session?.access_token]);

  useEffect(() => { loadDocumentsData(); }, [loadDocumentsData]);

  const loadMyPositionPaper = useCallback(async () => {
    if (!user || !myAllocation || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('position_papers')
      .select('id, status, chair_feedback, submitted_at, file_name, notify_on_feedback')
      .eq('conference_committee_id', myAllocation.conference_committee_id)
      .eq('user_id', user.id)
      .maybeSingle();
    setMyPositionPaper(data ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, myAllocation?.conference_committee_id, session?.access_token]);

  function handlePPFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { setPPError('Only PDF files are accepted.'); return; }
    if (file.size > 5 * 1024 * 1024) { setPPError('File must be under 5MB.'); return; }
    setPPError('');
    setPPFile(file);
  }

  async function handlePPSubmit() {
    if (!ppFile || !myAllocation || !user || !conference || !session) return;
    setPPUploading(true);
    const supabase = getAuthedClient(session.access_token);
    if (myPositionPaper) {
      await supabase.from('position_papers').delete().eq('id', myPositionPaper.id);
    }
    const path = `${conference.id}/${myAllocation.conference_committee_id}/${user.id}_${Date.now()}.pdf`;
    const { error: storageError } = await supabase.storage.from('position-papers').upload(path, ppFile, { contentType: 'application/pdf' });
    if (storageError) { setPPError('Upload failed.'); setPPUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('position-papers').getPublicUrl(path);
    await supabase.from('position_papers').insert({
      conference_committee_id: myAllocation.conference_committee_id,
      user_id: user.id,
      country_code: myAllocation.country_code,
      country_name: myAllocation.country_name,
      file_url: publicUrl,
      file_name: ppFile.name,
      file_size_bytes: ppFile.size,
      status: 'submitted',
      notify_on_feedback: ppNotify,
    });
    setPPUploading(false);
    setPPFile(null);
    setIsReplacing(false);
    await loadMyPositionPaper();
  }

  // Loading
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  // 404
  if (notFound || !conference) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EDE7D8' }}>
        <SiteNav />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <p className="text-xs font-mono tracking-widest mb-4" style={{ color: '#9A8A78' }}>404</p>
          <h1 className="font-black text-2xl mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Conference Not Found</h1>
          <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>This conference may be private or doesn&apos;t exist.</p>
          <Link
            href="/conferences/explore"
            className="rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none"
            style={{ backgroundColor: '#1B3828', color: '#EED98A', textDecoration: 'none', fontFamily: "'Outfit', sans-serif" }}
          >
            EXPLORE CONFERENCES →
          </Link>
        </div>
      </div>
    );
  }

  // Derived
  const isOrganizer = user?.id === conference.organizer_id;
  const countryObj = getCountryByName(conference.country);
  const flagUrl = countryObj ? getFlagUrl(countryObj.code) : null;
  const hasUnlimited = profile?.unlimited_status && profile.unlimited_status !== 'none';
  const enabledRoles = roleConfigs.filter(r => r.is_enabled);
  const now = new Date();

  function getRoleWindowStatus(r: RoleConfig): 'open' | 'closed' | 'opens-soon' | 'open-always' {
    if (!r.applications_open_at && !r.applications_close_at) return 'open-always';
    const openAt = r.applications_open_at ? new Date(r.applications_open_at) : null;
    const closeAt = r.applications_close_at ? new Date(r.applications_close_at) : null;
    if (closeAt && now > closeAt) return 'closed';
    if (openAt && now < openAt) return 'opens-soon';
    return 'open';
  }

  function isRoleOpen(r: RoleConfig): boolean {
    const s = getRoleWindowStatus(r);
    return s === 'open' || s === 'open-always';
  }

  const openRoles = enabledRoles.filter(isRoleOpen);
  const hasOpenRoles = openRoles.length > 0;

  const isOnline = conference.format === 'online';

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#EDE7D8' }}>
      {/* Grain */}
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

        {/* ── Hero ───────────────────────────────────────────────────── */}
        <div
          className="relative w-full overflow-hidden flex-shrink-0"
          style={{ height: 'clamp(320px, 38vw, 440px)' }}
        >
          {conference.banner_url ? (
            <>
              <img
                src={conference.banner_url}
                alt={conference.full_name}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {/* Layered scrim — deep at the base, airy on top */}
              <div
                style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to top, rgba(16,28,21,0.88) 0%, rgba(20,36,27,0.45) 42%, rgba(20,36,27,0.18) 75%, rgba(20,36,27,0.3) 100%)',
                }}
              />
              <div
                style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(100deg, rgba(16,28,21,0.55) 0%, transparent 55%)',
                }}
              />
            </>
          ) : (
            <>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #16301F 0%, #1B3828 55%, #234A31 100%)' }} />
              <div
                style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: GRAIN,
                  backgroundRepeat: 'repeat',
                  backgroundSize: '300px 300px',
                  mixBlendMode: 'overlay',
                  opacity: 0.08,
                }}
              />
              <span
                aria-hidden
                style={{
                  position: 'absolute', right: '4%', bottom: '-24px',
                  fontFamily: "'DM Mono', monospace", fontSize: 'clamp(120px, 18vw, 240px)', lineHeight: 1,
                  color: 'rgba(238,217,138,0.07)', userSelect: 'none', pointerEvents: 'none',
                }}
              >
                {conference.acronym.slice(0, 5)}
              </span>
            </>
          )}

          {/* Top-right pills */}
          <div className="absolute top-4 right-6 md:right-14 flex gap-2 z-10">
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.12em',
                color: 'white',
                backgroundColor: 'rgba(16,28,21,0.4)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.18)',
                padding: '5px 14px',
                borderRadius: '9999px',
              }}
            >
              {conference.format.toUpperCase().replace('-', ' ')}
            </span>
          </div>

          {/* Bottom-left content */}
          <div className="absolute bottom-0 left-0 right-0 px-6 md:px-14 z-10" style={{ paddingBottom: '68px' }}>
            <div className="flex items-end gap-5">
              {conference.logo_url && (
                <img
                  src={conference.logo_url}
                  alt={conference.acronym}
                  className="hidden sm:block flex-shrink-0"
                  style={{
                    width: '84px', height: '84px', borderRadius: '20px', objectFit: 'contain', padding: '8px',
                    border: '1px solid rgba(255,255,255,0.28)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                    backgroundColor: 'rgba(250,248,243,0.88)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                  }}
                />
              )}
              <div className="min-w-0">
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#EED98A', letterSpacing: '0.24em', marginBottom: '6px' }}>
                  {conference.acronym}
                </p>
                <h1 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, color: 'white', fontSize: 'clamp(26px, 4vw, 54px)', lineHeight: 1.05, marginBottom: '10px', textShadow: '0 2px 24px rgba(0,0,0,0.3)' }}>
                  {conference.full_name}
                </h1>
                <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5">
                  <span className="flex items-center gap-2">
                    {!isOnline && flagUrl && (
                      <img
                        src={flagUrl}
                        alt={conference.country}
                        style={{ width: '20px', height: '14px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
                      />
                    )}
                    <span style={{ fontSize: '14px', color: 'rgba(237,231,216,0.92)', fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>
                      {isOnline ? 'Online' : `${conference.city}, ${conference.country}`}
                    </span>
                  </span>
                  <span aria-hidden style={{ color: 'rgba(238,217,138,0.5)', fontSize: '10px' }}>◆</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: 'rgba(237,231,216,0.78)' }}>
                    {formatDateRange(conference.start_date, conference.end_date)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Glass stat strip — overlaps the hero ───────────────────── */}
        <div className="relative z-20 px-6 md:px-14" style={{ marginTop: '-44px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div
              className="grid grid-cols-2 md:grid-cols-5"
              style={{
                backgroundColor: 'rgba(250,248,243,0.78)',
                backdropFilter: 'blur(20px) saturate(1.5)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
                border: '1px solid rgba(221,212,192,0.9)',
                borderRadius: '20px',
                boxShadow: '0 20px 48px rgba(16,28,21,0.18), 0 1px 0 rgba(255,255,255,0.65) inset',
                overflow: 'hidden',
              }}
            >
              {[
                { icon: CalendarDays, label: 'DATES', value: formatDateRange(conference.start_date, conference.end_date) },
                { icon: MapPin, label: 'LOCATION', value: isOnline ? 'Online' : `${conference.city}, ${conference.country}` },
                { icon: Monitor, label: 'FORMAT', value: capitalize(conference.format.replace('-', ' ')) },
                { icon: GraduationCap, label: 'LEVEL', value: capitalize(conference.student_level) },
                { icon: Users, label: 'DELEGATES', value: conference.expected_delegates.toLocaleString() },
              ].map((cell, i) => {
                const Icon = cell.icon;
                return (
                  <div
                    key={cell.label}
                    className="px-5 py-4"
                    style={{
                      borderLeft: i > 0 ? '1px solid rgba(221,212,192,0.6)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon size={11} style={{ color: '#B6871F', flexShrink: 0 }} />
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.18em', color: '#9A8A78' }}>
                        {cell.label}
                      </span>
                    </div>
                    <p className="text-[13px] font-semibold truncate" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
                      {cell.value}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Main content ───────────────────────────────────────────── */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }} className="px-6 md:px-14 pt-10 pb-14 flex-1">
          <div className="flex flex-col md:flex-row gap-8">

            {/* Left column */}
            <div className="flex-1 min-w-0">

              {/* Floating glass tab pill */}
              <div className="sticky z-30 mb-7" style={{ top: '12px' }}>
                <div
                  className="inline-flex items-center gap-1 p-1"
                  style={{
                    backgroundColor: 'rgba(250,248,243,0.72)',
                    backdropFilter: 'blur(18px) saturate(1.5)',
                    WebkitBackdropFilter: 'blur(18px) saturate(1.5)',
                    border: '1px solid rgba(221,212,192,0.85)',
                    borderRadius: '9999px',
                    boxShadow: '0 8px 28px rgba(27,56,40,0.1)',
                  }}
                >
                  {([
                    { key: 'overview' as const, label: 'Overview', icon: Landmark },
                    { key: 'documents' as const, label: 'Documents', icon: FileText },
                  ]).map(({ key, label, icon: TabIcon }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      aria-label={label}
                      title={label}
                      className="relative flex items-center justify-center rounded-full transition-all focus:outline-none"
                      style={
                        activeTab === key
                          ? { width: '72px', height: '46px', backgroundColor: '#1B3828', color: '#EED98A', boxShadow: '0 2px 10px rgba(27,56,40,0.32)' }
                          : { width: '72px', height: '46px', backgroundColor: 'transparent', color: '#8A7D6C' }
                      }
                    >
                      <TabIcon size={21} strokeWidth={1.9} />
                      {key === 'documents' && !myAllocation && (
                        <span
                          className="absolute flex items-center justify-center rounded-full"
                          style={{
                            top: '7px', right: '13px', width: '15px', height: '15px',
                            backgroundColor: activeTab === key ? '#EED98A' : '#DDD4C0',
                            color: '#1B3828',
                          }}
                        >
                          <Lock size={9} strokeWidth={2.4} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* About */}
              {activeTab === 'overview' && conference.description && (
                <SectionCard className="mb-6">
                  <p className="text-[15px]" style={{ color: '#3B342C', fontFamily: "'Outfit', sans-serif", whiteSpace: 'pre-wrap', lineHeight: 1.9 }}>
                    {conference.description}
                  </p>
                </SectionCard>
              )}

              {/* Committees */}
              {activeTab === 'overview' && (
                <div className="flex flex-col gap-4 mb-6">
                  {committees.length === 0 ? (
                    <SectionCard>
                      <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                        Committees will be announced soon.
                      </p>
                    </SectionCard>
                  ) : (
                    committees.map(c => {
                      const diff = c.difficulty?.toLowerCase() ?? '';
                      const diffStyle = DIFFICULTY_STYLES[diff] ?? DIFFICULTY_STYLES.intermediate;
                      const isCrisis = c.committee_type === 'crisis';
                      const monogram = (c.abbreviation || c.name).replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
                      const chairs = c.display_chairs ?? [];
                      const slots = committeeSlots[c.id] ?? [];
                      const occupied = new Set(committeeOccupied[c.id] ?? []);
                      const capacity = slots.length || c.total_slots || 0;
                      const taken = occupied.size;
                      const pct = capacity > 0 ? Math.min(100, Math.round((taken / capacity) * 100)) : 0;
                      const hasChairAd = !!chairJobs[c.id];
                      const isExpanded = expandedRoster === c.id;

                      return (
                        <div
                          key={c.id}
                          className="rounded-[22px] overflow-hidden"
                          style={{
                            backgroundColor: '#FAF8F3',
                            border: '1px solid #DDD4C0',
                            boxShadow: '0 2px 8px rgba(27,56,40,0.05)',
                          }}
                        >
                          <div className="p-5 md:p-6">
                            <div className="flex items-start gap-4">
                              {/* Emblem */}
                              <div
                                className="flex-shrink-0 relative flex items-center justify-center overflow-hidden"
                                style={{
                                  width: '64px', height: '64px', borderRadius: '18px',
                                  background: isCrisis
                                    ? 'linear-gradient(135deg, #3C1414 0%, #6E1E1E 100%)'
                                    : 'linear-gradient(135deg, #16301F 0%, #2A5A3C 100%)',
                                  boxShadow: '0 8px 20px rgba(27,56,40,0.22)',
                                }}
                              >
                                <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: GRAIN, backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.12 }} />
                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: monogram.length > 4 ? '10px' : '13px', fontWeight: 700, color: '#EED98A', letterSpacing: '0.04em' }}>
                                  {monogram}
                                </span>
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-bold text-[16px] leading-snug" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>{c.name}</h3>
                                    {isCrisis && (
                                      <span
                                        className="px-2 py-0.5 rounded-full flex-shrink-0"
                                        style={{ fontSize: '8px', fontFamily: "'DM Mono', monospace", letterSpacing: '0.14em', backgroundColor: 'rgba(110,30,30,0.1)', color: '#8B2020', fontWeight: 700 }}
                                      >
                                        CRISIS
                                      </span>
                                    )}
                                  </div>
                                  {c.difficulty && (
                                    <span
                                      className="px-2.5 py-1 rounded-full flex-shrink-0"
                                      style={{ ...diffStyle, fontSize: '9px', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em', fontWeight: 700 }}
                                    >
                                      {c.difficulty.toUpperCase()}
                                    </span>
                                  )}
                                </div>

                                {/* Chairs */}
                                {chairs.length > 0 && (
                                  <div className="flex items-center gap-2.5 mt-2.5">
                                    <div className="flex flex-shrink-0">
                                      {chairs.map((ch, i) => (
                                        ch.avatar_url ? (
                                          <img
                                            key={ch.name}
                                            src={ch.avatar_url}
                                            alt={ch.name}
                                            style={{
                                              width: '30px', height: '30px', borderRadius: '9999px', objectFit: 'cover',
                                              border: '2px solid #FAF8F3', marginLeft: i > 0 ? '-9px' : 0,
                                              boxShadow: '0 2px 6px rgba(27,56,40,0.2)', position: 'relative', zIndex: chairs.length - i,
                                              backgroundColor: '#EDE7D8',
                                            }}
                                          />
                                        ) : (
                                          <span
                                            key={ch.name}
                                            className="flex items-center justify-center"
                                            style={{
                                              width: '30px', height: '30px', borderRadius: '9999px',
                                              border: '2px solid #FAF8F3', marginLeft: i > 0 ? '-9px' : 0,
                                              backgroundColor: '#1B3828', color: '#EED98A',
                                              fontSize: '11px', fontWeight: 700, fontFamily: "'Outfit', sans-serif",
                                              position: 'relative', zIndex: chairs.length - i,
                                            }}
                                          >
                                            {ch.name.charAt(0)}
                                          </span>
                                        )
                                      ))}
                                    </div>
                                    <p className="text-[12px] leading-tight" style={{ color: '#6B5F52', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
                                      Chaired by{' '}
                                      <span style={{ color: '#1C1410', fontWeight: 600 }}>
                                        {chairs.map(ch => ch.name).join(' & ')}
                                      </span>
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Agenda */}
                            {c.topics && c.topics.length > 0 && (
                              <div
                                className="mt-4 rounded-2xl px-4 py-3"
                                style={{ backgroundColor: 'rgba(237,231,216,0.45)', border: '1px solid rgba(221,212,192,0.6)' }}
                              >
                                <p className="mb-1.5" style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', letterSpacing: '0.24em', color: '#B6871F', margin: '0 0 6px 0' }}>
                                  AGENDA
                                </p>
                                {c.topics.map(topic => (
                                  <div key={topic} className="flex items-start gap-2.5 py-1">
                                    <span aria-hidden style={{ color: '#B6871F', fontSize: '8px', lineHeight: '20px', flexShrink: 0 }}>◆</span>
                                    <span className="text-[13.5px] font-medium" style={{ color: '#2E2820', fontFamily: "'Outfit', sans-serif", lineHeight: 1.5 }}>
                                      {topic}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Chair recruitment ad */}
                            {hasChairAd && (
                              <Link
                                href="/conferences/roles"
                                className="mt-3 flex items-center gap-2.5 rounded-xl px-4 py-2.5 transition-all"
                                style={{
                                  background: 'linear-gradient(100deg, rgba(238,217,138,0.35) 0%, rgba(238,217,138,0.15) 100%)',
                                  border: '1px solid rgba(182,135,31,0.35)',
                                  textDecoration: 'none',
                                }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#B6871F'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(182,135,31,0.35)'; }}
                              >
                                <Megaphone size={15} style={{ color: '#8A6614', flexShrink: 0 }} />
                                <span className="flex-1 text-[12px] font-semibold" style={{ color: '#6E5410', fontFamily: "'Outfit', sans-serif" }}>
                                  This committee is recruiting chairs
                                </span>
                                <span className="text-[10px] font-bold flex-shrink-0" style={{ color: '#8A6614', fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em' }}>
                                  APPLY →
                                </span>
                              </Link>
                            )}
                          </div>

                          {/* Capacity bar + roster toggle */}
                          <button
                            onClick={() => setExpandedRoster(isExpanded ? null : c.id)}
                            className="w-full px-5 md:px-6 py-3.5 flex items-center gap-3 focus:outline-none transition-colors"
                            style={{
                              borderTop: '1px solid rgba(221,212,192,0.6)',
                              backgroundColor: isExpanded ? 'rgba(27,56,40,0.045)' : 'transparent',
                              cursor: 'pointer',
                            }}
                          >
                            <div className="flex-1 rounded-full overflow-hidden" style={{ height: '7px', backgroundColor: 'rgba(221,212,192,0.65)' }}>
                              <div
                                style={{
                                  width: `${pct}%`, height: '100%', borderRadius: '9999px',
                                  background: 'linear-gradient(to right, #2A5A3C, #3D7A52)',
                                  transition: 'width 500ms cubic-bezier(0.22,1,0.36,1)',
                                }}
                              />
                            </div>
                            <span className="flex-shrink-0 text-[10.5px]" style={{ color: '#6B5F52', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em' }}>
                              {taken}/{capacity} {isCrisis ? 'ROLES' : 'SEATS'} FILLED
                            </span>
                            <ChevronDown
                              size={15}
                              style={{
                                color: '#9A8A78', flexShrink: 0,
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                transition: 'transform 240ms ease',
                              }}
                            />
                          </button>

                          {/* Roster */}
                          {isExpanded && (
                            <div
                              className="px-5 md:px-6 py-4 flex flex-wrap gap-2"
                              style={{ borderTop: '1px solid rgba(221,212,192,0.5)', backgroundColor: 'rgba(237,231,216,0.35)' }}
                            >
                              {slots.length === 0 ? (
                                <span className="text-xs" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                                  The {isCrisis ? 'character' : 'country'} roster will be announced soon.
                                </span>
                              ) : (
                                slots.map(s => {
                                  const isTaken = occupied.has(s.country_code);
                                  const co = getCountryByName(s.country_name);
                                  const flag = co ? getFlagUrl(co.code) : null;
                                  return (
                                    <span
                                      key={s.country_code}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
                                      style={
                                        isTaken
                                          ? { backgroundColor: '#1B3828', border: '1px solid #1B3828' }
                                          : { backgroundColor: 'rgba(250,248,243,0.9)', border: '1px solid rgba(221,212,192,0.9)' }
                                      }
                                    >
                                      {flag && (
                                        <img
                                          src={flag}
                                          alt=""
                                          style={{ width: '16px', height: '11px', borderRadius: '2px', objectFit: 'cover', flexShrink: 0, opacity: isTaken ? 0.85 : 1 }}
                                        />
                                      )}
                                      <span className="text-[11px] font-medium" style={{ color: isTaken ? '#EDE7D8' : '#4A4238', fontFamily: "'Outfit', sans-serif" }}>
                                        {s.country_name}
                                      </span>
                                      {isTaken && <Check size={11} strokeWidth={2.6} style={{ color: '#EED98A', flexShrink: 0 }} />}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Organiser */}
              {activeTab === 'overview' && (
                <SectionCard className="mb-6">
                  <p className="mb-3" style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.26em', color: '#B6871F', margin: '0 0 12px 0' }}>
                    ORGANISED BY
                  </p>
                  <div className="flex items-center gap-4">
                    {conference.logo_url && (
                      <img
                        src={conference.logo_url}
                        alt={conference.acronym}
                        style={{ width: '58px', height: '58px', borderRadius: '15px', objectFit: 'contain', border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF', padding: '4px', flexShrink: 0 }}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-[15px]" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>{conference.full_name}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", margin: 0 }}>{conference.acronym}</p>
                      {conference.contact_email && (
                        <a
                          href={`mailto:${conference.contact_email}`}
                          className="flex items-center gap-1.5 text-xs mt-1 transition-all"
                          style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", textDecoration: 'none' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                        >
                          <Mail size={12} />
                          {conference.contact_email}
                        </a>
                      )}
                    </div>
                  </div>
                  {(conference.instagram_url || conference.facebook_url || conference.tiktok_url || conference.whatsapp_url || conference.website_url) && (
                    <div className="flex gap-2 mt-4 pt-4" style={{ borderTop: '1px solid rgba(221,212,192,0.6)' }}>
                      {conference.instagram_url && (
                        <a
                          href={conference.instagram_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center rounded-full transition-colors"
                          style={{ width: '34px', height: '34px', border: '1px solid #DDD4C0', color: '#9A8A78' }}
                          onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#EED98A'; el.style.backgroundColor = '#1B3828'; el.style.borderColor = '#1B3828'; }}
                          onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#9A8A78'; el.style.backgroundColor = 'transparent'; el.style.borderColor = '#DDD4C0'; }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                          </svg>
                        </a>
                      )}
                      {conference.facebook_url && (
                        <a
                          href={conference.facebook_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center rounded-full transition-colors"
                          style={{ width: '34px', height: '34px', border: '1px solid #DDD4C0', color: '#9A8A78' }}
                          onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#EED98A'; el.style.backgroundColor = '#1B3828'; el.style.borderColor = '#1B3828'; }}
                          onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#9A8A78'; el.style.backgroundColor = 'transparent'; el.style.borderColor = '#DDD4C0'; }}
                        >
                          <Globe size={15} />
                        </a>
                      )}
                      {conference.tiktok_url && (
                        <a
                          href={conference.tiktok_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center rounded-full transition-colors"
                          style={{ width: '34px', height: '34px', border: '1px solid #DDD4C0', color: '#9A8A78' }}
                          onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#EED98A'; el.style.backgroundColor = '#1B3828'; el.style.borderColor = '#1B3828'; }}
                          onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#9A8A78'; el.style.backgroundColor = 'transparent'; el.style.borderColor = '#DDD4C0'; }}
                        >
                          <Music size={15} />
                        </a>
                      )}
                      {conference.whatsapp_url && (
                        <a
                          href={conference.whatsapp_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center rounded-full transition-colors"
                          style={{ width: '34px', height: '34px', border: '1px solid #DDD4C0', color: '#9A8A78' }}
                          onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#EED98A'; el.style.backgroundColor = '#1B3828'; el.style.borderColor = '#1B3828'; }}
                          onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#9A8A78'; el.style.backgroundColor = 'transparent'; el.style.borderColor = '#DDD4C0'; }}
                        >
                          <MessageCircle size={15} />
                        </a>
                      )}
                      {conference.website_url && (
                        <a
                          href={conference.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center rounded-full transition-colors"
                          style={{ width: '34px', height: '34px', border: '1px solid #DDD4C0', color: '#9A8A78' }}
                          onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#EED98A'; el.style.backgroundColor = '#1B3828'; el.style.borderColor = '#1B3828'; }}
                          onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#9A8A78'; el.style.backgroundColor = 'transparent'; el.style.borderColor = '#DDD4C0'; }}
                        >
                          <Globe size={15} />
                        </a>
                      )}
                    </div>
                  )}
                </SectionCard>
              )}

              {/* Documents tab — locked until allocation */}
              {activeTab === 'documents' && !myAllocation && (
                <SectionCard>
                  <div className="flex flex-col items-center text-center py-10">
                    <div
                      className="flex items-center justify-center mb-5"
                      style={{
                        width: '64px', height: '64px', borderRadius: '9999px',
                        backgroundColor: 'rgba(27,56,40,0.07)', border: '1px solid rgba(27,56,40,0.14)',
                      }}
                    >
                      <Lock size={24} strokeWidth={1.8} style={{ color: '#1B3828' }} />
                    </div>
                    <p className="text-[15px] font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                      Documents are locked
                    </p>
                    <p className="text-[13px] max-w-[340px]" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.7 }}>
                      Study guides and position paper submissions unlock once you receive your committee allocation.
                    </p>
                  </div>
                </SectionCard>
              )}

              {/* Documents tab */}
              {activeTab === 'documents' && myAllocation && (
                <div className="flex flex-col gap-6">
                  {/* Study Guides */}
                  <SectionCard>
                    <p className="mb-3" style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.26em', color: '#B6871F', margin: '0 0 12px 0' }}>
                      STUDY GUIDES
                    </p>
                    {studyGuidesLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
                      </div>
                    ) : studyGuides.length === 0 ? (
                      <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                        No study guides have been published yet.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {studyGuides.map(sg => (
                          <a
                            key={sg.id}
                            href={sg.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3.5 rounded-2xl px-4 py-3 transition-colors"
                            style={{ border: '1px solid rgba(221,212,192,0.7)', backgroundColor: 'rgba(237,231,216,0.25)', textDecoration: 'none' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.05)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(237,231,216,0.25)'; }}
                          >
                            <div
                              className="flex-shrink-0 flex items-center justify-center"
                              style={{ width: '38px', height: '38px', borderRadius: '11px', backgroundColor: 'rgba(27,56,40,0.07)' }}
                            >
                              <FileText size={16} style={{ color: '#1B3828' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{sg.title}</p>
                              <p className="text-[11px] mt-0.5" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace", margin: 0 }}>{sg.file_name}</p>
                            </div>
                            <Download size={15} style={{ color: '#9A8A78', flexShrink: 0 }} />
                          </a>
                        ))}
                      </div>
                    )}
                  </SectionCard>

                  {/* Position Paper */}
                  {myAllocation && (() => {
                    const deadline = myAllocation.conference_committees?.position_paper_deadline as string | null;
                    const deadlineSoon = deadline ? (new Date(deadline).getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000 && new Date(deadline) > new Date() : false;
                    const showUploadForm = !myPositionPaper || isReplacing;
                    const ppStatusMap: Record<string, { bg: string; color: string }> = {
                      submitted: { bg: 'rgba(238,217,138,0.2)',  color: '#B8844A' },
                      reviewed:  { bg: 'rgba(154,138,120,0.15)', color: '#9A8A78' },
                      approved:  { bg: 'rgba(61,122,82,0.12)',   color: '#3D7A52' },
                      rejected:  { bg: 'rgba(139,32,32,0.1)',    color: '#8B2020' },
                    };
                    const ppMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    const fmtDate = (iso: string) => {
                      const d = new Date(iso);
                      return `${ppMonths[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
                    };
                    return (
                      <SectionCard>
                        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.26em', color: '#B6871F', margin: '0 0 6px 0' }}>
                          POSITION PAPER
                        </p>
                        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#9A8A78', marginBottom: 16 }}>
                          {myAllocation.conference_committees?.name} · {myAllocation.country_name}
                        </p>

                        {!ppEnabled ? (
                          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: '#9A8A78' }}>
                            Position paper submissions are not yet open for your committee.
                          </p>
                        ) : showUploadForm ? (
                          <>
                            {deadline && (
                              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: deadlineSoon ? '#B8844A' : '#9A8A78', marginBottom: 14 }}>
                                Due {fmtDate(deadline)}
                              </p>
                            )}
                            <input type="file" accept="application/pdf" onChange={handlePPFileSelect} className="hidden" ref={ppFileInputRef} />
                            {!ppFile ? (
                              <div
                                onClick={() => ppFileInputRef.current?.click()}
                                style={{ border: '1.5px dashed rgba(154,138,120,0.6)', borderRadius: 14, padding: '28px 12px', textAlign: 'center', cursor: 'pointer', marginBottom: 12, transition: 'border-color 0.15s, background-color 0.15s', backgroundColor: 'rgba(237,231,216,0.25)' }}
                                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#1B3828'; el.style.backgroundColor = 'rgba(27,56,40,0.04)'; }}
                                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(154,138,120,0.6)'; el.style.backgroundColor = 'rgba(237,231,216,0.25)'; }}
                              >
                                <p style={{ fontSize: 13, color: '#4A4238', fontFamily: "'Outfit', sans-serif", marginBottom: 2, fontWeight: 600 }}>Click to select PDF</p>
                                <p style={{ fontSize: 11, color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>MAX 5MB</p>
                              </div>
                            ) : (
                              <div style={{ border: '1px solid rgba(61,122,82,0.3)', borderRadius: 12, padding: '10px 14px', backgroundColor: 'rgba(61,122,82,0.05)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <FileText size={15} style={{ color: '#2A5A3C', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontSize: 13, color: '#1C1410', fontFamily: "'Outfit', sans-serif", fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ppFile.name}</p>
                                </div>
                                <button onClick={() => ppFileInputRef.current?.click()} className="focus:outline-none" style={{ fontSize: 11, color: '#9A8A78', fontFamily: "'Outfit', sans-serif", textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', flexShrink: 0 }}>
                                  Change
                                </button>
                              </div>
                            )}
                            {ppError && <p style={{ fontSize: 11, color: '#8B2020', fontFamily: "'Outfit', sans-serif", marginBottom: 8 }}>{ppError}</p>}
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 14 }}>
                              <input type="checkbox" checked={ppNotify} onChange={e => setPPNotify(e.target.checked)} style={{ accentColor: '#1B3828' }} />
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: '#9A8A78' }}>
                                Notify me via email when my position paper receives feedback
                              </span>
                            </label>
                            <div style={{ display: 'flex', gap: 8 }}>
                              {isReplacing && (
                                <button onClick={() => { setIsReplacing(false); setPPFile(null); setPPError(''); }} className="focus:outline-none" style={{ border: '1px solid #DDD4C0', borderRadius: 12, padding: '10px 16px', fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, color: '#1C1410', backgroundColor: 'transparent', cursor: 'pointer' }}>
                                  CANCEL
                                </button>
                              )}
                              <button
                                onClick={handlePPSubmit}
                                disabled={!ppFile || ppUploading}
                                className="focus:outline-none"
                                style={{ flex: 1, border: 'none', borderRadius: 12, padding: '10px 0', fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: '0.06em', backgroundColor: !ppFile || ppUploading ? '#DDD4C0' : '#1B3828', color: !ppFile || ppUploading ? '#9A8A78' : '#EED98A', cursor: !ppFile || ppUploading ? 'default' : 'pointer' }}
                              >
                                {ppUploading ? 'UPLOADING...' : 'SUBMIT POSITION PAPER'}
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#9A8A78', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {myPositionPaper.file_name}
                              </span>
                              {(() => {
                                const s = ppStatusMap[myPositionPaper.status] ?? ppStatusMap.submitted;
                                return (
                                  <span style={{ backgroundColor: s.bg, color: s.color, fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, letterSpacing: '0.08em', flexShrink: 0 }}>
                                    {myPositionPaper.status.toUpperCase()}
                                  </span>
                                );
                              })()}
                            </div>
                            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: '#9A8A78', marginBottom: 10 }}>
                              Submitted {fmtDate(myPositionPaper.submitted_at)}
                            </p>
                            {myPositionPaper.chair_feedback && (
                              <div style={{ backgroundColor: 'rgba(27,56,40,0.04)', borderLeft: '3px solid #B6871F', padding: '10px 14px', borderRadius: '0 10px 10px 0', marginBottom: 12 }}>
                                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: '#1C1410', fontStyle: 'italic', lineHeight: 1.6 }}>
                                  {myPositionPaper.chair_feedback}
                                </p>
                              </div>
                            )}
                            <button
                              onClick={() => setShowPPWarning(true)}
                              className="focus:outline-none"
                              style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#9A8A78', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                            >
                              REPLACE
                            </button>
                          </>
                        )}
                      </SectionCard>
                    );
                  })()}
                </div>
              )}

              {/* Replace warning modal */}
              {showPPWarning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ backgroundColor: 'rgba(28,20,16,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
                  <div className="rounded-[20px] p-6 max-w-sm w-full" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: '0 24px 64px rgba(16,28,21,0.35)' }}>
                    <h3 className="font-semibold text-base mb-2" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Replace Position Paper?</h3>
                    <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                      Your current submission will be deleted and replaced. This action cannot be undone.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowPPWarning(false)}
                        className="flex-1 rounded-xl py-2.5 text-sm font-bold focus:outline-none"
                        style={{ border: '1px solid #DDD4C0', color: '#1C1410', fontFamily: "'Outfit', sans-serif", backgroundColor: 'transparent' }}
                      >
                        CANCEL
                      </button>
                      <button
                        onClick={() => { setShowPPWarning(false); setIsReplacing(true); setPPFile(null); setPPError(''); }}
                        className="flex-1 rounded-xl py-2.5 text-sm font-bold focus:outline-none"
                        style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif" }}
                      >
                        REPLACE
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Right column — sticky rail */}
            <div className="w-full md:w-[340px] md:flex-shrink-0">
              <div className="flex flex-col gap-4 md:sticky" style={{ top: '12px' }}>

                {/* Apply CTA — always first */}
                <div
                  className="relative rounded-[20px] p-6 overflow-hidden"
                  style={{ backgroundColor: '#1B3828', boxShadow: '0 16px 40px rgba(27,56,40,0.28)' }}
                >
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px', mixBlendMode: 'overlay', opacity: 0.07 }}
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute"
                    style={{
                      top: '-60px', right: '-40px', width: '200px', height: '200px',
                      background: 'radial-gradient(circle, rgba(238,217,138,0.14) 0%, transparent 65%)',
                    }}
                  />
                  <div className="relative">
                    {!user ? (
                      <>
                        <p className="font-bold text-base mb-1 text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>Sign in to apply</p>
                        <p className="text-xs mb-4" style={{ color: 'rgba(237,231,216,0.7)', fontFamily: "'Outfit', sans-serif", lineHeight: 1.6 }}>
                          Create a free account to apply for this conference.
                        </p>
                        <button
                          onClick={() => router.push(`/auth/signin?next=/conferences/${slug}`)}
                          className="w-full rounded-xl py-3 font-bold text-sm transition-all focus:outline-none"
                          style={{ backgroundColor: '#EED98A', color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'white'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EED98A'; }}
                        >
                          SIGN IN TO APPLY →
                        </button>
                      </>
                    ) : !hasOpenRoles ? (
                      <>
                        <p className="font-bold text-base text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>No open applications</p>
                        <p className="text-xs mt-1" style={{ color: 'rgba(237,231,216,0.7)', fontFamily: "'Outfit', sans-serif" }}>
                          Check back when applications open.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-base mb-1 text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>Apply to this Conference</p>
                        <p className="text-xs mb-4" style={{ color: 'rgba(237,231,216,0.7)', fontFamily: "'Outfit', sans-serif", lineHeight: 1.6 }}>
                          Select your role to begin your application.
                        </p>
                        {openRoles.map(r => {
                          const myApp = myApplications.find(a => a.role === r.role);
                          const hasApplied = !!myApp;
                          const label = r.role.replace(/-/g, ' ').toUpperCase();
                          return (
                            <button
                              key={r.role}
                              disabled={hasApplied}
                              onClick={() => {
                                if (!hasApplied) router.push(`/conferences/${slug}/apply?role=${r.role}`);
                              }}
                              className="w-full mb-2 last:mb-0 rounded-xl py-2.5 px-4 text-sm font-bold transition-all focus:outline-none"
                              style={
                                hasApplied
                                  ? {
                                      backgroundColor: 'rgba(238,217,138,0.12)',
                                      color: 'rgba(238,217,138,0.5)',
                                      cursor: 'default',
                                      fontFamily: "'Outfit', sans-serif",
                                      letterSpacing: '0.05em',
                                      border: '1px solid rgba(238,217,138,0.15)',
                                    }
                                  : {
                                      backgroundColor: '#EED98A',
                                      color: '#1B3828',
                                      fontFamily: "'Outfit', sans-serif",
                                      letterSpacing: '0.05em',
                                      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                                    }
                              }
                              onMouseEnter={(e) => {
                                if (!hasApplied) (e.currentTarget as HTMLElement).style.backgroundColor = 'white';
                              }}
                              onMouseLeave={(e) => {
                                if (!hasApplied) (e.currentTarget as HTMLElement).style.backgroundColor = '#EED98A';
                              }}
                            >
                              {hasApplied ? 'Applied ✓' : `APPLY AS ${label} →`}
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>

                {/* Pricing medallion */}
                <SectionCard>
                  <div className="flex flex-col items-center pt-2">
                    <div
                      className="relative flex flex-col items-center justify-center"
                      style={{
                        width: '150px', height: '150px', borderRadius: '9999px',
                        background: 'radial-gradient(circle at 50% 36%, rgba(238,217,138,0.3) 0%, rgba(250,248,243,0) 72%)',
                        border: '1.5px solid rgba(182,135,31,0.42)',
                        boxShadow: '0 10px 30px rgba(27,56,40,0.1), 0 0 0 8px rgba(238,217,138,0.12)',
                      }}
                    >
                      {conference.fee_amount === 0 ? (
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: '30px', color: '#1B3828', lineHeight: 1 }}>FREE</span>
                      ) : (
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: '38px', color: '#1C1410', lineHeight: 1 }}>
                          {currencySymbol(conference.fee_currency)}{conference.fee_amount.toFixed(0)}
                        </span>
                      )}
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8.5px', letterSpacing: '0.22em', color: '#9A8A78', marginTop: '7px' }}>
                        PER DELEGATE
                      </span>
                    </div>

                    <button
                      onClick={() => setPricingOpen(v => !v)}
                      className="mt-4 flex items-center gap-1.5 text-[11px] font-bold focus:outline-none transition-colors"
                      style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.12em', background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#B6871F'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                    >
                      PRICING DETAILS
                      <ChevronDown
                        size={13}
                        style={{ transform: pricingOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 240ms ease' }}
                      />
                    </button>

                    {pricingOpen && (
                      <div className="w-full mt-4 pt-3" style={{ borderTop: '1px solid rgba(221,212,192,0.6)' }}>
                        {enabledRoles.map((r, i) => (
                          <div
                            key={r.role}
                            className="flex items-center justify-between py-2"
                            style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(221,212,192,0.4)' }}
                          >
                            <span className="text-[13px] font-medium" style={{ color: '#4A4238', fontFamily: "'Outfit', sans-serif" }}>
                              {capitalize(r.role.replace(/-/g, ' '))}
                            </span>
                            <span className="text-[13px] font-bold" style={{ color: '#1C1410', fontFamily: "'DM Mono', monospace" }}>
                              {r.fee_amount != null && r.fee_amount > 0
                                ? `${currencySymbol(r.fee_currency ?? conference.fee_currency)}${r.fee_amount.toFixed(0)}`
                                : 'Free'}
                            </span>
                          </div>
                        ))}
                        <p className="text-[10.5px] mt-3" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", lineHeight: 1.65 }}>
                          A 5% Gavelling surcharge applies at checkout — waived with{' '}
                          <span style={{ color: '#B6871F', fontWeight: 600 }}>Gavelling Unlimited</span>.
                        </p>
                        {hasUnlimited && (
                          <div className="mt-2">
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: 'rgba(238,217,138,0.15)',
                                color: '#B6871F',
                                fontFamily: "'DM Mono', monospace",
                              }}
                            >
                              ✦ Surcharge waived with your Unlimited plan
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* Application Windows */}
                <SectionCard>
                  <p className="mb-3" style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', letterSpacing: '0.26em', color: '#B6871F', margin: '0 0 12px 0' }}>
                    APPLICATION WINDOWS
                  </p>
                  {enabledRoles.length === 0 ? (
                    <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                      Application details coming soon.
                    </p>
                  ) : (
                    <div className="flex flex-col">
                      {enabledRoles.map((r, i) => {
                        const windowStatus = getRoleWindowStatus(r);
                        const myApp = myApplications.find(a => a.role === r.role);
                        const roleName = r.role.replace(/-/g, ' ');

                        const windowPill = (() => {
                          if (windowStatus === 'open' || windowStatus === 'open-always') {
                            return (
                              <span className="flex items-center gap-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(61,122,82,0.12)', color: '#1B3828', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#3D7A52' }} />
                                OPEN
                              </span>
                            );
                          }
                          if (windowStatus === 'closed') {
                            return (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(154,138,120,0.15)', color: '#9A8A78', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>
                                CLOSED
                              </span>
                            );
                          }
                          return (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(238,217,138,0.15)', color: '#B8844A', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>
                              OPENS {r.applications_open_at ? formatShortDate(r.applications_open_at).toUpperCase() : ''}
                            </span>
                          );
                        })();

                        return (
                          <div
                            key={r.role}
                            className="py-2.5"
                            style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(221,212,192,0.5)' }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                                {capitalize(roleName)}
                              </span>
                              {myApp ? <ApplicationStatusBadge status={myApp.status} /> : windowPill}
                            </div>
                            {r.fee_amount != null && r.fee_amount > 0 && (
                              <p className="text-[11px] mt-0.5" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
                                {currencySymbol(r.fee_currency ?? conference.fee_currency)}{r.fee_amount.toFixed(0)} registration fee
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>

              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer
          className="relative z-10 border-t border-[#DDD4C0] px-6 py-8"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='0.18'/%3E%3C/svg%3E")`,
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
                style={{ color: '#9A8A78', transition: 'color 0.15s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#1B3828'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#9A8A78'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </a>
              <span aria-label="LinkedIn (coming soon)" style={{ color: '#C8BFB0', cursor: 'default' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                  <rect x="2" y="9" width="4" height="12"/>
                  <circle cx="4" cy="4" r="2"/>
                </svg>
              </span>
            </div>
            <p className="text-xs font-semibold text-[#1B3828] md:text-right">
              © {new Date().getFullYear()} Gavelling. Built for the MUN community.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
