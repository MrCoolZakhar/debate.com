'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Globe, MessageCircle, Music } from 'lucide-react';
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

interface Committee {
  id: string;
  name: string;
  abbreviation: string | null;
  topics: string[] | null;
  difficulty: string;
  committee_type: string;
  total_slots: number | null;
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
        .select('id, name, abbreviation, topics, difficulty, committee_type, total_slots')
        .eq('conference_id', conf.id)
        .order('name', { ascending: true }),
      supabase
        .from('application_role_configs')
        .select('role, is_enabled, applications_open_at, applications_close_at, fee_amount, fee_currency, auto_accept')
        .eq('conference_id', conf.id),
    ]);

    setCommittees((committeesRes.data as Committee[]) ?? []);
    setRoleConfigs((roleConfigsRes.data as RoleConfig[]) ?? []);

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
          style={{ height: 'clamp(260px, 30vw, 340px)' }}
        >
          {conference.banner_url ? (
            <>
              <img
                src={conference.banner_url}
                alt={conference.full_name}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div
                style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to bottom, rgba(27,56,40,0.3) 0%, rgba(27,56,40,0.7) 100%)',
                }}
              />
            </>
          ) : (
            <>
              <div style={{ position: 'absolute', inset: 0, backgroundColor: '#1B3828' }} />
              <div
                style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: GRAIN,
                  backgroundRepeat: 'repeat',
                  backgroundSize: '300px 300px',
                  mixBlendMode: 'overlay',
                  opacity: 0.07,
                }}
              />
            </>
          )}

          {/* Top-right pills */}
          <div className="absolute top-4 right-6 md:right-14 flex gap-2 z-10">
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '10px',
                color: 'white',
                backgroundColor: 'rgba(0,0,0,0.35)',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '4px 12px',
                borderRadius: '9999px',
              }}
            >
              {conference.format.toUpperCase().replace('-', ' ')}
            </span>
          </div>

          {/* Bottom-left content */}
          <div className="absolute bottom-0 left-0 px-8 md:px-14 pb-8 z-10">
            {conference.logo_url && (
              <img
                src={conference.logo_url}
                alt={conference.acronym}
                style={{
                  width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover',
                  border: '2px solid rgba(255,255,255,0.2)', marginBottom: '12px', display: 'block',
                }}
              />
            )}
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'rgba(238,217,138,0.7)', letterSpacing: '0.18em', marginBottom: '4px' }}>
              {conference.acronym}
            </p>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, color: 'white', fontSize: 'clamp(24px, 3.5vw, 48px)', lineHeight: 1.1, marginBottom: '8px' }}>
              {conference.full_name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              {!isOnline && flagUrl && (
                <img
                  src={flagUrl}
                  alt={conference.country}
                  style={{ width: '20px', height: '14px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0 }}
                />
              )}
              <span style={{ fontSize: '14px', color: 'rgba(237,231,216,0.8)', fontFamily: "'Outfit', sans-serif" }}>
                {isOnline ? 'Online' : `${conference.city}, ${conference.country}`}
              </span>
            </div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'rgba(237,231,216,0.6)' }}>
              {formatDateRange(conference.start_date, conference.end_date)}
            </p>
          </div>
        </div>

        {/* ── Main content ───────────────────────────────────────────── */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }} className="px-6 md:px-14 py-10 flex-1">
          <div className="flex flex-col md:flex-row gap-8">

            {/* Left column */}
            <div className="flex-1 min-w-0">

              {/* Tab bar */}
              <div className="flex gap-2 mb-6">
                {(['overview', 'documents'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="px-4 py-1.5 rounded-full text-sm font-semibold focus:outline-none"
                    style={
                      activeTab === tab
                        ? { backgroundColor: '#1B3828', color: '#EED98A', fontFamily: "'Outfit', sans-serif" }
                        : { backgroundColor: 'transparent', color: '#9A8A78', border: '1px solid #DDD4C0', fontFamily: "'Outfit', sans-serif" }
                    }
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* About */}
              {activeTab === 'overview' && conference.description && (
                <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
                  <h2 className="font-semibold text-base mb-3" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>About</h2>
                  <p className="text-sm leading-relaxed" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", whiteSpace: 'pre-wrap' }}>
                    {conference.description}
                  </p>
                </div>
              )}

              {/* Committees */}
              {activeTab === 'overview' && (
                <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="font-semibold text-base" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Committees</h2>
                    <span
                      className="px-2 py-0.5 rounded-full"
                      style={{ fontSize: '10px', fontFamily: "'DM Mono', monospace", backgroundColor: 'rgba(27,56,40,0.08)', color: '#1B3828' }}
                    >
                      {committees.length}
                    </span>
                  </div>
                  {committees.length === 0 ? (
                    <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                      Committees will be announced soon.
                    </p>
                  ) : (
                    <div style={{ borderTop: '1px solid #F0EDE6' }}>
                      {committees.map(c => {
                        const diff = c.difficulty?.toLowerCase() ?? '';
                        const diffStyle =
                          diff === 'beginner'
                            ? { backgroundColor: 'rgba(61,122,82,0.12)', color: '#1B3828' }
                            : diff === 'intermediate'
                            ? { backgroundColor: 'rgba(238,217,138,0.2)', color: '#B8844A' }
                            : { backgroundColor: 'rgba(139,32,32,0.1)', color: '#8B2020' };

                        return (
                          <div key={c.id} className="py-3 flex items-start gap-4" style={{ borderBottom: '1px solid #F0EDE6' }}>
                            {c.difficulty && (
                              <span
                                className="flex-shrink-0 px-2 py-0.5 rounded-full mt-0.5"
                                style={{ ...diffStyle, fontSize: '9px', fontFamily: "'DM Mono', monospace", letterSpacing: '0.05em' }}
                              >
                                {c.difficulty.toUpperCase()}
                              </span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{c.name}</p>
                              {c.abbreviation && (
                                <p className="text-xs" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>{c.abbreviation}</p>
                              )}
                              {c.topics && c.topics.length > 0 && (
                                <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                                  {c.topics.join(' · ')}
                                </p>
                              )}
                            </div>
                            {c.total_slots != null && (
                              <span className="flex-shrink-0 text-xs" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
                                {c.total_slots} slots
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Organiser */}
              {activeTab === 'overview' && (
                <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
                  <h2 className="font-semibold text-base mb-3" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Organised by</h2>
                  <p className="font-medium text-sm" style={{ color: '#1C1410', fontFamily: "'DM Mono', monospace" }}>{conference.acronym}</p>
                  {conference.contact_email && (
                    <a
                      href={`mailto:${conference.contact_email}`}
                      className="block text-xs mt-1 transition-all"
                      style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", textDecoration: 'none' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                    >
                      {conference.contact_email}
                    </a>
                  )}
                  {(conference.instagram_url || conference.facebook_url || conference.tiktok_url || conference.whatsapp_url || conference.website_url) && (
                    <div className="flex gap-3 mt-3">
                      {conference.instagram_url && (
                        <a
                          href={conference.instagram_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#9A8A78', transition: 'color 0.15s' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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
                          style={{ color: '#9A8A78', transition: 'color 0.15s' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                        >
                          <Globe size={18} />
                        </a>
                      )}
                      {conference.tiktok_url && (
                        <a
                          href={conference.tiktok_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#9A8A78', transition: 'color 0.15s' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                        >
                          <Music size={18} />
                        </a>
                      )}
                      {conference.whatsapp_url && (
                        <a
                          href={conference.whatsapp_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#9A8A78', transition: 'color 0.15s' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                        >
                          <MessageCircle size={18} />
                        </a>
                      )}
                      {conference.website_url && (
                        <a
                          href={conference.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#9A8A78', transition: 'color 0.15s' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                        >
                          <Globe size={18} />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Documents tab */}
              {activeTab === 'documents' && (
                <div className="flex flex-col gap-6">
                  {/* Study Guides */}
                  <div className="rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
                    <h2 className="font-semibold text-base mb-4" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Study Guides</h2>
                    {studyGuidesLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
                      </div>
                    ) : !myAllocation ? (
                      <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                        Study guides are available once you are allocated to a committee.
                      </p>
                    ) : studyGuides.length === 0 ? (
                      <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                        No study guides have been published yet.
                      </p>
                    ) : (
                      <div style={{ borderTop: '1px solid #F0EDE6' }}>
                        {studyGuides.map(sg => (
                          <a
                            key={sg.id}
                            href={sg.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 py-3"
                            style={{ borderBottom: '1px solid #F0EDE6', textDecoration: 'none' }}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sg.title}</p>
                              <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{sg.file_name}</p>
                            </div>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#9A8A78', flexShrink: 0 }}>
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                              <polyline points="7 10 12 15 17 10"/>
                              <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

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
                      <div style={{ background: '#FAF8F3', border: '1px solid #DDD4C0', borderRadius: 16, padding: 24 }}>
                        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 15, color: '#1C1410', marginBottom: 4 }}>
                          Position Paper
                        </h2>
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
                                style={{ border: '2px dashed #DDD4C0', borderRadius: 12, padding: '24px 12px', textAlign: 'center', cursor: 'pointer', marginBottom: 12, transition: 'border-color 0.15s' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
                              >
                                <p style={{ fontSize: 13, color: '#9A8A78', fontFamily: "'Outfit', sans-serif", marginBottom: 2 }}>Click to select PDF</p>
                                <p style={{ fontSize: 11, color: '#C8BFB0', fontFamily: "'Outfit', sans-serif" }}>Max 5MB</p>
                              </div>
                            ) : (
                              <div style={{ border: '1px solid rgba(61,122,82,0.3)', borderRadius: 10, padding: '10px 14px', backgroundColor: 'rgba(61,122,82,0.04)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
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
                                style={{ flex: 1, border: 'none', borderRadius: 12, padding: '10px 0', fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 13, backgroundColor: !ppFile || ppUploading ? '#DDD4C0' : '#1B3828', color: !ppFile || ppUploading ? '#9A8A78' : '#EED98A', cursor: !ppFile || ppUploading ? 'default' : 'pointer' }}
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
                              <div style={{ backgroundColor: 'rgba(27,56,40,0.04)', borderLeft: '3px solid #DDD4C0', padding: '8px 12px', borderRadius: '0 6px 6px 0', marginBottom: 12 }}>
                                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: '#1C1410', fontStyle: 'italic' }}>
                                  {myPositionPaper.chair_feedback}
                                </p>
                              </div>
                            )}
                            <button
                              onClick={() => setShowPPWarning(true)}
                              className="focus:outline-none"
                              style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: '#9A8A78', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                            >
                              REPLACE
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Replace warning modal */}
              {showPPWarning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ backgroundColor: 'rgba(28,20,16,0.5)' }}>
                  <div className="rounded-2xl p-6 max-w-sm w-full" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
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

            {/* Right column */}
            <div className="w-full md:w-[340px] md:flex-shrink-0 flex flex-col gap-4">

                {/* Key Info */}
                <div className="rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
                  <div>
                    {[
                      { label: 'Dates', value: formatDateRange(conference.start_date, conference.end_date) },
                      {
                        label: 'Location',
                        value: isOnline ? 'Online' : `${conference.city}, ${conference.country}`,
                      },
                      { label: 'Format', value: capitalize(conference.format.replace('-', ' ')) },
                      { label: 'Level', value: capitalize(conference.student_level) },
                      { label: 'Expected Delegates', value: conference.expected_delegates.toLocaleString() },
                    ].map((row, i) => (
                      <div
                        key={row.label}
                        className="py-3 flex justify-between items-center text-sm"
                        style={{
                          borderTop: i === 0 ? 'none' : '1px solid #F0EDE6',
                        }}
                      >
                        <span className="font-medium" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>{row.label}</span>
                        <span className="font-semibold text-right ml-4" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fee */}
                <div className="rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
                  {conference.fee_amount === 0 ? (
                    <>
                      <p className="font-black text-2xl" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>FREE</p>
                      <p className="text-xs mt-1" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                        No registration fee for this conference.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs tracking-wide mb-1" style={{ color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>REGISTRATION FEE</p>
                      <p className="font-black text-2xl" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                        {currencySymbol(conference.fee_currency)}{conference.fee_amount.toFixed(0)}
                      </p>
                      <div className="group relative inline-block mt-1">
                        <span className="text-xs cursor-help" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                          + 5% Gavelling surcharge
                        </span>
                        <span
                          className="absolute bottom-full left-0 mb-1.5 px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{
                            backgroundColor: '#1C1410',
                            color: 'white',
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: '11px',
                            zIndex: 10,
                          }}
                        >
                          Waived with Gavelling Unlimited
                        </span>
                      </div>
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
                    </>
                  )}
                </div>

                {/* Application Windows */}
                <div className="rounded-2xl p-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
                  <h3 className="font-semibold text-base mb-4" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>Applications</h3>
                  {enabledRoles.length === 0 ? (
                    <p className="text-sm" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                      Application details coming soon.
                    </p>
                  ) : (
                    <div>
                      {enabledRoles.map((r, i) => {
                        const windowStatus = getRoleWindowStatus(r);
                        const myApp = myApplications.find(a => a.role === r.role);
                        const roleName = r.role.replace(/-/g, ' ');

                        const windowPill = (() => {
                          if (windowStatus === 'open' || windowStatus === 'open-always') {
                            return (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(61,122,82,0.12)', color: '#1B3828', fontFamily: "'DM Mono', monospace" }}>
                                OPEN
                              </span>
                            );
                          }
                          if (windowStatus === 'closed') {
                            return (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(154,138,120,0.15)', color: '#9A8A78', fontFamily: "'DM Mono', monospace" }}>
                                CLOSED
                              </span>
                            );
                          }
                          return (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(238,217,138,0.15)', color: '#B8844A', fontFamily: "'DM Mono', monospace" }}>
                              OPENS {r.applications_open_at ? formatShortDate(r.applications_open_at) : ''}
                            </span>
                          );
                        })();

                        return (
                          <div
                            key={r.role}
                            className={i < enabledRoles.length - 1 ? 'mb-3' : ''}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}>
                                {capitalize(roleName)}
                              </span>
                              {myApp ? <ApplicationStatusBadge status={myApp.status} /> : windowPill}
                            </div>
                            {r.fee_amount != null && r.fee_amount > 0 && (
                              <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}>
                                {currencySymbol(r.fee_currency ?? conference.fee_currency)}{r.fee_amount.toFixed(0)} registration fee
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Apply CTA */}
                <div className="rounded-2xl p-6" style={{ backgroundColor: '#1B3828' }}>
                  {!user ? (
                    <>
                      <p className="font-semibold text-sm mb-1 text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>Sign in to apply</p>
                      <p className="text-xs mb-4" style={{ color: 'rgba(237,231,216,0.7)', fontFamily: "'Outfit', sans-serif" }}>
                        Create a free account to apply for this conference.
                      </p>
                      <button
                        onClick={() => router.push(`/auth/signin?next=/conferences/${slug}`)}
                        className="w-full rounded-xl py-3 font-bold text-sm tracking-widest transition-colors focus:outline-none"
                        style={{ backgroundColor: '#EED98A', color: '#1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'white'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#EED98A'; }}
                      >
                        SIGN IN TO APPLY →
                      </button>
                    </>
                  ) : !hasOpenRoles ? (
                    <>
                      <p className="font-semibold text-sm text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>No open applications</p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(237,231,216,0.7)', fontFamily: "'Outfit', sans-serif" }}>
                        Check back when applications open.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-sm mb-1 text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>Apply to this Conference</p>
                      <p className="text-xs mb-4" style={{ color: 'rgba(237,231,216,0.7)', fontFamily: "'Outfit', sans-serif" }}>
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
                            className="w-full mb-2 last:mb-0 rounded-xl py-2.5 px-4 text-sm font-bold tracking-wide transition-colors focus:outline-none"
                            style={
                              hasApplied
                                ? {
                                    backgroundColor: 'rgba(238,217,138,0.15)',
                                    color: 'rgba(238,217,138,0.5)',
                                    cursor: 'default',
                                    fontFamily: "'Outfit', sans-serif",
                                  }
                                : {
                                    backgroundColor: '#EED98A',
                                    color: '#1B3828',
                                    fontFamily: "'Outfit', sans-serif",
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
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
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
