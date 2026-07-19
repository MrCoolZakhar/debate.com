'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Star, X, Megaphone, ClipboardCheck, FileText, BellRing, TrendingUp, ArrowRight, Camera, Globe2, Sparkles, Cake, Mail, User, Bell, ShieldAlert, MapPin, GraduationCap, School } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { UN_COUNTRIES, getCountryByName, getFlagUrl } from '@/lib/countries';
import { deriveExperienceLevel, experienceProgress } from '@/lib/munExperience';
import { ageAt } from '@/lib/age';
import { Eyebrow, GlassCard, PillToggle, Pill, ExperienceInfo, LevelInsignia, OUTFIT } from '../accountUi';
import { NEU, NeuIconDisc, NEU_GRADIENTS } from '@/components/neu';
import { ConfirmModal } from '@/components/ConfirmModal';
import { DatePicker } from '@/components/DatePicker';
import Portal from '@/components/Portal';

interface ReviewableConference {
  id: string;
  slug: string;
  acronym: string;
  full_name: string;
  end_date: string | null;
  start_date: string | null;
}

const NOTIFICATION_ROWS = [
  { field: 'notify_email_marketing'    as const, Icon: Megaphone,      label: 'Marketing & Newsletter', desc: 'Updates about new Gavelling features and MUN news' },
  { field: 'notify_email_applications' as const, Icon: ClipboardCheck, label: 'Application Updates',    desc: 'Acceptance, rejection, and assignment notifications' },
  { field: 'notify_email_documents'    as const, Icon: FileText,       label: 'Document Notifications', desc: 'Study guide releases and position paper feedback' },
  { field: 'notify_email_reminders'    as const, Icon: BellRing,       label: 'Conference Reminders',   desc: 'Reminders before conferences you\'re attending' },
];

type NotifFields = {
  notify_email_marketing:    boolean;
  notify_email_applications: boolean;
  notify_email_documents:    boolean;
  notify_email_reminders:    boolean;
};

const inputStyle: React.CSSProperties = {
  border: '1px solid #DDD4C0',
  backgroundColor: 'rgba(250,248,243,0.9)',
  color: '#1C1410',
  fontFamily: OUTFIT,
};

// Folds the forest/ivory neumorphic surface into the existing GlassCard usages:
// opaque parchment surface + soft extruded dual-shadow (no hard border), so the
// profile reads like the rest of the neu dashboard.
const NEU_CARD_STYLE: React.CSSProperties = {
  backgroundColor: NEU.surface,
  border: 'none',
  boxShadow: NEU.out,
};

export default function ProfilePage() {
  const { user, session, profile, signOut, loading: authLoading } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [nationality, setNationality] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [dobError, setDobError] = useState('');
  const [notifications, setNotifications] = useState<NotifFields>({
    notify_email_marketing:    true,
    notify_email_applications: true,
    notify_email_documents:    true,
    notify_email_reminders:    true,
  });
  const [educationLevel, setEducationLevel] = useState<string | null>(null);
  const [cvCount, setCvCount]         = useState<number | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);

  // Avatar
  const [avatarUrl, setAvatarUrl]         = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError]     = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Nationality autocomplete — the menu is rendered through a Portal at fixed
  // viewport coordinates so no card boundary can clip it.
  const [natOpen, setNatOpen] = useState(false);
  const natWrapRef = useRef<HTMLDivElement | null>(null);
  const natInputRef = useRef<HTMLInputElement | null>(null);
  const natMenuRef = useRef<HTMLDivElement | null>(null);
  const [natPos, setNatPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);

  const placeNat = useCallback(() => {
    const el = natInputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const menuH = 232; // matches maxHeight + a little padding
    const below = vh - r.bottom;
    const up = below < menuH + 12 && r.top > below; // flip up only when tight below and roomier above
    setNatPos({
      top: up ? r.top - 6 : r.bottom + 6,
      left: r.left,
      width: r.width,
      up,
    });
  }, []);

  // Review prompts — conferences the user attended but hasn't reviewed
  const [reviewable, setReviewable]         = useState<ReviewableConference[]>([]);
  const [reviewFormFor, setReviewFormFor]   = useState<string | null>(null);
  const [reviewRating, setReviewRating]     = useState(0);
  const [reviewHover, setReviewHover]       = useState(0);
  const [reviewText, setReviewText]         = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError]       = useState('');

  // Delete account
  const [deleteOpen, setDeleteOpen]         = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting]             = useState(false);
  const [deleteError, setDeleteError]       = useState('');
  const [soleOwnerConferences, setSoleOwnerConferences] = useState<{ slug: string; full_name: string }[] | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);

    supabase
      .from('profiles')
      .select('display_name, nationality, date_of_birth, education_level, mun_experience_level, notify_email_marketing, notify_email_applications, notify_email_documents, notify_email_reminders')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name ?? '');
          setNationality(data.nationality ?? '');
          setDateOfBirth(data.date_of_birth ?? '');
          setEducationLevel(data.education_level ?? null);
          setNotifications({
            notify_email_marketing:    data.notify_email_marketing    ?? true,
            notify_email_applications: data.notify_email_applications ?? true,
            notify_email_documents:    data.notify_email_documents    ?? true,
            notify_email_reminders:    data.notify_email_reminders    ?? true,
          });
        }
        setDataLoading(false);

        // Experience level is derived from the MUN CV. Self-heal the stored
        // column if it has drifted (application flows read it).
        supabase
          .from('mun_cv_entries')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .then(({ count }) => {
            const n = count ?? 0;
            setCvCount(n);
            const derived = deriveExperienceLevel(n);
            if (data && data.mun_experience_level !== derived) {
              supabase.from('profiles').update({ mun_experience_level: derived }).eq('id', user.id).then(() => {});
            }
          });
      });

    loadReviewable(supabase);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, session?.access_token]);

  // Close the nationality autocomplete on outside click (the menu lives in a
  // Portal, so check both the wrapper and the menu), and keep it anchored to
  // the input while scrolling / resizing.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (natWrapRef.current?.contains(t) || natMenuRef.current?.contains(t)) return;
      setNatOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!natOpen) return;
    placeNat();
    const onReflow = () => placeNat();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [natOpen, placeNat]);

  async function loadReviewable(supabase: ReturnType<typeof getAuthedClient>) {
    if (!user) return;
    // Attended = application with status assigned or checked-in
    const { data: apps } = await supabase
      .from('applications')
      .select('conference_id, status, conferences ( id, slug, acronym, full_name, end_date, start_date )')
      .eq('user_id', user.id)
      .in('status', ['assigned', 'checked-in']);
    // Only prompt for conferences that have actually taken place. A conference
    // has concluded once its end_date (or start_date, if it has no end) is in
    // the past — never before the event.
    const today = new Date().toISOString().slice(0, 10);
    const hasConcluded = (c: ReviewableConference) => {
      const done = c.end_date ?? c.start_date;
      return !!done && done < today;
    };
    const attendedConfs: ReviewableConference[] = [];
    const seen = new Set<string>();
    for (const row of ((apps ?? []) as unknown as { conference_id: string; conferences: ReviewableConference | ReviewableConference[] | null }[])) {
      const conf = Array.isArray(row.conferences) ? row.conferences[0] : row.conferences;
      if (!conf || seen.has(conf.id)) continue;
      seen.add(conf.id);
      if (!hasConcluded(conf)) continue;
      attendedConfs.push(conf);
    }
    if (attendedConfs.length === 0) { setReviewable([]); return; }
    // Exclude conferences already reviewed or dismissed
    const { data: myReviews } = await supabase
      .from('conference_reviews')
      .select('conference_id')
      .eq('user_id', user.id);
    const reviewedIds = new Set(((myReviews ?? []) as { conference_id: string }[]).map(r => r.conference_id));
    const remaining = attendedConfs.filter(c => {
      if (reviewedIds.has(c.id)) return false;
      try { return localStorage.getItem(`review-prompt-${c.id}`) !== 'dismissed'; } catch { return true; }
    });
    setReviewable(remaining);
  }

  function dismissReviewPrompt(conferenceId: string) {
    try { localStorage.setItem(`review-prompt-${conferenceId}`, 'dismissed'); } catch { /* ignore */ }
    setReviewable(prev => prev.filter(c => c.id !== conferenceId));
    if (reviewFormFor === conferenceId) setReviewFormFor(null);
  }

  function openReviewForm(conferenceId: string) {
    setReviewFormFor(prev => (prev === conferenceId ? null : conferenceId));
    setReviewRating(0);
    setReviewHover(0);
    setReviewText('');
    setReviewError('');
  }

  async function handleSubmitReview(conf: ReviewableConference) {
    if (!user || !session || reviewRating < 1 || reviewSubmitting) return;
    setReviewSubmitting(true);
    setReviewError('');
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase.from('conference_reviews').insert({
      conference_id: conf.id,
      user_id: user.id,
      rating: reviewRating,
      review_text: reviewText.trim() || null,
      display_name: profile?.display_name ?? (displayName || null),
    });
    setReviewSubmitting(false);
    if (error) {
      setReviewError('Your review could not be saved.');
      return;
    }
    setReviewFormFor(null);
    setReviewable(prev => prev.filter(c => c.id !== conf.id));
  }

  async function handleSave() {
    if (!user) return;
    setDobError('');
    if (dateOfBirth) {
      const age = ageAt(dateOfBirth);
      if (age === null || age < 0 || age > 120) {
        setDobError('That date of birth doesn’t look right. Please double-check it.');
        return;
      }
      if (age < 13) {
        setDobError('Gavelling accounts require you to be at least 13 years old.');
        return;
      }
    }
    setSaving(true);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        nationality:  nationality || null,
        date_of_birth: dateOfBirth || null,
      })
      .eq('id', user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleAvatarUpload(file: File) {
    if (!user || !session) return;
    setAvatarError('');
    if (!file.type.startsWith('image/')) { setAvatarError('Please choose an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setAvatarError('Image must be under 5MB.'); return; }
    setAvatarUploading(true);
    try {
      const supabase = getAuthedClient(session.access_token);
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `avatars/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('conference-assets')
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) { setAvatarError('Upload failed. Please try again.'); setAvatarUploading(false); return; }
      const { data: urlData } = supabase.storage.from('conference-assets').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      setAvatarUrl(publicUrl);
      setAvatarUploading(false);
      // Reload so the sidebar avatar (driven by AuthProvider's profile) syncs.
      setTimeout(() => window.location.reload(), 400);
    } catch {
      setAvatarError('Upload failed. Please try again.');
      setAvatarUploading(false);
    }
  }

  function handleToggle(field: keyof NotifFields, value: boolean) {
    setNotifications((prev) => ({ ...prev, [field]: value }));
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    supabase.from('profiles').update({ [field]: value }).eq('id', user!.id);
  }

  // Education level — where the delegate does MUN. Meaningful downstream: it is
  // surfaced as their level when they apply to conferences. Persist immediately
  // with an optimistic update, matching the notification-toggle pattern. Values
  // must match what onboarding writes: 'high_school' | 'university'.
  function handleEducationChange(value: 'high_school' | 'university') {
    if (value === educationLevel) return;
    const prev = educationLevel;
    setEducationLevel(value);
    if (!session || !user) return;
    const supabase = getAuthedClient(session.access_token);
    supabase
      .from('profiles')
      .update({ education_level: value })
      .eq('id', user.id)
      .then(({ error }) => { if (error) setEducationLevel(prev); });
  }

  async function handleSignOut() {
    await signOut();
    window.location.href = '/';
  }

  function openDeleteAccount() {
    setDeleteError('');
    setSoleOwnerConferences(null);
    setDeleteConfirmText('');
    setDeleteOpen(true);
  }

  // Calls the deployed `delete-account` edge function (verify_jwt on, reads
  // the caller off their own session token). It blocks with
  // {ok:false, reason:'sole_owner', conferences, message} if the account
  // solely owns any conference, otherwise it deletes the user and everything
  // cascades server-side, nothing else to clean up client-side.
  async function handleConfirmDeleteAccount() {
    if (!session || deleting) return;
    setDeleting(true);
    setDeleteError('');
    const supabase = getAuthedClient(session.access_token);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account');
      if (error) {
        let body: { ok?: boolean; reason?: string; conferences?: { slug: string; full_name: string }[]; message?: string } | null = null;
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === 'function') {
          try { body = await ctx.json(); } catch { /* non-JSON error body */ }
        }
        if (body?.reason === 'sole_owner') {
          setSoleOwnerConferences(body.conferences ?? []);
          setDeleteError(body.message ?? 'You are the sole owner of one or more conferences. Transfer or archive them first.');
        } else {
          setDeleteError(body?.message ?? 'Could not delete your account. Please try again.');
        }
        setDeleting(false);
        return;
      }
      const result = data as { ok?: boolean; reason?: string; conferences?: { slug: string; full_name: string }[]; message?: string } | null;
      if (result && result.ok === false) {
        if (result.reason === 'sole_owner') {
          setSoleOwnerConferences(result.conferences ?? []);
          setDeleteError(result.message ?? 'You are the sole owner of one or more conferences. Transfer or archive them first.');
        } else {
          setDeleteError(result.message ?? 'Could not delete your account. Please try again.');
        }
        setDeleting(false);
        return;
      }
      await signOut();
      window.location.href = '/?accountDeleted=1';
    } catch {
      setDeleteError('Could not delete your account. Please try again.');
      setDeleting(false);
    }
  }

  const natCountry = getCountryByName(nationality);
  const natFlag = natCountry ? getFlagUrl(natCountry.code) : null;
  const natMatches = useMemo(() => {
    const q = nationality.trim().toLowerCase();
    if (!q) return UN_COUNTRIES;
    return UN_COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [nationality]);

  const exp = experienceProgress(cvCount ?? 0);

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  const displayAvatar = avatarUrl ?? profile?.avatar_url ?? null;
  const headerAge = (() => {
    const a = ageAt(dateOfBirth);
    return a !== null && a >= 0 && a <= 120 ? a : null;
  })();

  return (
    <div
      className="relative rounded-[24px] p-5 md:p-7"
      style={{
        backgroundColor: NEU.surface,
        borderRadius: 24,
        boxShadow: '-6px -6px 16px rgba(255,255,255,0.8), 8px 8px 24px rgba(27,56,40,0.14)',
      }}
    >
      {/* Decorative bleed — a low-opacity globe drifting off the top-right of the
          page panel for depth. Negative z keeps it under the opaque cards; the
          small offset keeps it from ever forcing a horizontal scrollbar. */}
      <Globe2
        aria-hidden
        size={150}
        strokeWidth={1}
        className="pointer-events-none absolute"
        style={{ top: '-38px', right: '-16px', color: 'rgba(27,56,40,0.055)', zIndex: -1 }}
      />

      <div className="relative pb-5 mb-7" style={{ borderBottom: '2px solid rgba(182,135,31,0.35)', zIndex: 1 }}>
        <Eyebrow className="mb-2" size="lg">My Profile</Eyebrow>
        <h1
          className="font-black text-[26px] md:text-[30px] mb-1 flex items-baseline gap-2 flex-wrap"
          style={{ color: '#1C1410', fontFamily: OUTFIT, letterSpacing: '-0.01em' }}
        >
          <span>{displayName || 'Your Profile'}</span>
          {headerAge !== null && (
            <span
              className="inline-flex items-center gap-1"
              style={{ fontFamily: OUTFIT, fontSize: '20px', fontWeight: 700, color: '#B6871F', letterSpacing: '0', fontVariantNumeric: 'tabular-nums' }}
            >
              <Cake size={17} strokeWidth={2.2} style={{ color: '#B6871F', transform: 'translateY(1px)' }} />
              ({headerAge})
            </span>
          )}
        </h1>
        <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT, margin: 0 }}>
          Manage your Gavelling account details.
        </p>
      </div>

      {/* Big level banner — the visual centrepiece */}
      <Link
        href="/account/cv"
        className="relative block mb-7 rounded-[20px] focus:outline-none"
        style={{ textDecoration: 'none', zIndex: 1 }}
      >
        <div
          className="relative overflow-hidden rounded-[20px] px-6 py-6 md:px-8 md:py-7 transition-transform"
          style={{
            background: 'linear-gradient(135deg, #1B3828 0%, #24492F 55%, #2A5A3C 100%)',
            border: '1.5px solid rgba(238,217,138,0.45)',
            boxShadow: '0 14px 40px rgba(27,56,40,0.3)',
          }}
        >
          {/* soft gold glow */}
          <div
            className="pointer-events-none absolute"
            style={{ top: '-60px', right: '-40px', width: '220px', height: '220px', borderRadius: '9999px', background: 'radial-gradient(circle, rgba(238,217,138,0.30), transparent 70%)' }}
          />
          {/* decorative insignia ghost bleeding off the bottom-right, low opacity */}
          <Sparkles
            aria-hidden
            size={130}
            strokeWidth={1}
            className="pointer-events-none absolute"
            style={{ bottom: '-34px', right: '-18px', color: 'rgba(238,217,138,0.10)' }}
          />
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              {/* MUN rank insignia — the same tiered glyph used across the app */}
              <span
                className="inline-flex items-center justify-center flex-shrink-0"
                style={{
                  width: '78px', height: '78px', borderRadius: '9999px',
                  background: 'radial-gradient(circle at 34% 30%, rgba(250,248,243,0.20), rgba(238,217,138,0.12) 55%, rgba(27,56,40,0.25))',
                  border: '1.5px solid rgba(238,217,138,0.55)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px rgba(27,56,40,0.35)',
                }}
              >
                <LevelInsignia level={exp.level} size={48} />
              </span>
              <div>
                <span
                  className="inline-flex items-center gap-2"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                >
                  <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: '12.5px', letterSpacing: '0.18em', color: '#EED98A', margin: 0, textTransform: 'uppercase' }}>
                    Your MUN Rank
                  </p>
                  <ExperienceInfo tone="gold" align="left" currentLevel={exp.level} />
                </span>
                <p
                  className="font-black"
                  style={{ fontFamily: OUTFIT, fontSize: '50px', lineHeight: 1.02, color: '#FAF8F3', letterSpacing: '-0.02em', margin: '4px 0 0 0' }}
                >
                  {exp.label}
                </p>
              </div>
            </div>
            <div
              className="inline-flex items-center gap-2 rounded-full"
              style={{ padding: '6px 12px', backgroundColor: 'rgba(250,248,243,0.10)', border: '1px solid rgba(238,217,138,0.28)' }}
            >
              <TrendingUp size={16} strokeWidth={2.4} style={{ color: '#EED98A' }} />
              <span style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '12px', color: 'rgba(250,248,243,0.92)', fontVariantNumeric: 'tabular-nums' }}>
                {cvCount ?? 0} conference{(cvCount ?? 0) === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative mt-5">
            <div className="w-full rounded-full overflow-hidden" style={{ height: '9px', backgroundColor: 'rgba(250,248,243,0.16)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.round(exp.progress * 100)}%`, background: 'linear-gradient(90deg, #EED98A, #B6871F)', transition: 'width 500ms ease' }}
              />
            </div>
            <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
              <span style={{ fontFamily: OUTFIT, fontSize: '13px', fontWeight: 600, color: 'rgba(250,248,243,0.92)' }}>
                {exp.nextLabel
                  ? `Attend more conferences to increase your rank`
                  : `Top tier reached. You're an Expert delegate`}
              </span>
              <span
                className="inline-flex items-center gap-1.5"
                style={{ fontFamily: OUTFIT, fontSize: '12.5px', fontWeight: 700, color: '#EED98A' }}
              >
                {exp.nextLabel
                  ? `Add conferences to your MUN CV to rank up`
                  : `View your MUN CV`}
                <ArrowRight size={14} strokeWidth={2.4} />
              </span>
            </div>
          </div>
        </div>
      </Link>

      {/* Review prompts — conferences attended but not yet reviewed */}
      {reviewable.length > 0 && (
        <div className="flex flex-col gap-3 mb-6">
          {reviewable.map((conf) => {
            const formOpen = reviewFormFor === conf.id;
            return (
              <div
                key={conf.id}
                className="rounded-2xl px-5 py-4"
                style={{
                  backgroundColor: 'rgba(250,248,243,0.86)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1.5px solid rgba(182,135,31,0.4)',
                  boxShadow: '0 8px 24px rgba(27,56,40,0.07)',
                }}
              >
                <div className="flex items-center gap-4">
                  <span
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ width: '36px', height: '36px', borderRadius: '11px', backgroundColor: 'rgba(182,135,31,0.12)' }}
                  >
                    <Star size={16} strokeWidth={2} style={{ color: '#B6871F', fill: '#B6871F' }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}>
                      How was {conf.acronym}?
                    </p>
                    <p className="text-[12px] truncate" style={{ color: '#9A8A78', fontFamily: OUTFIT, margin: '1px 0 0 0' }}>
                      Leave a review of{' '}
                      <Link
                        href={`/conferences/${conf.slug}`}
                        style={{ color: '#B6871F', textDecoration: 'none', fontWeight: 600 }}
                      >
                        {conf.full_name}
                      </Link>
                    </p>
                  </div>
                  <button
                    onClick={() => openReviewForm(conf.id)}
                    className="flex-shrink-0 rounded-xl py-2 px-4 text-[11px] font-bold focus:outline-none transition-colors"
                    style={{ backgroundColor: formOpen ? 'transparent' : '#1B3828', color: formOpen ? '#1B3828' : '#EED98A', border: formOpen ? '1px solid #DDD4C0' : '1px solid #1B3828', fontFamily: OUTFIT, letterSpacing: '0.08em', cursor: 'pointer' }}
                  >
                    {formOpen ? 'CLOSE' : 'LEAVE A REVIEW'}
                  </button>
                  <button
                    onClick={() => dismissReviewPrompt(conf.id)}
                    aria-label={`Dismiss review prompt for ${conf.acronym}`}
                    className="flex items-center justify-center flex-shrink-0 rounded-full focus:outline-none transition-colors"
                    style={{ width: '26px', height: '26px', border: 'none', backgroundColor: 'transparent', color: '#9A8A78', cursor: 'pointer' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1C1410'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
                  >
                    <X size={14} />
                  </button>
                </div>

                {formOpen && (
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(221,212,192,0.6)' }}>
                    <div className="flex items-center gap-1.5 mb-3" onMouseLeave={() => setReviewHover(0)}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <button
                          key={i}
                          onClick={() => setReviewRating(i)}
                          onMouseEnter={() => setReviewHover(i)}
                          aria-label={`Rate ${i} out of 5`}
                          className="focus:outline-none"
                          style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer' }}
                        >
                          <Star
                            size={24}
                            strokeWidth={1.6}
                            style={{
                              color: i <= (reviewHover || reviewRating) ? '#B6871F' : 'rgba(154,138,120,0.45)',
                              fill: i <= (reviewHover || reviewRating) ? '#B6871F' : 'none',
                              transition: 'color 120ms ease',
                            }}
                          />
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      rows={3}
                      placeholder="What should future delegates know about this conference?"
                      className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                      style={{ ...inputStyle, lineHeight: 1.7 }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
                    />
                    {reviewError && (
                      <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: OUTFIT, margin: '8px 0 0 0' }}>
                        {reviewError}
                      </p>
                    )}
                    <button
                      onClick={() => handleSubmitReview(conf)}
                      disabled={reviewRating < 1 || reviewSubmitting}
                      className="mt-3 rounded-xl py-2.5 px-6 font-bold text-[13px] focus:outline-none transition-colors"
                      style={{
                        backgroundColor: reviewRating < 1 || reviewSubmitting ? '#DDD4C0' : '#1B3828',
                        color: reviewRating < 1 || reviewSubmitting ? '#9A8A78' : '#EED98A',
                        fontFamily: OUTFIT,
                        letterSpacing: '0.06em',
                        border: 'none',
                        cursor: reviewRating < 1 || reviewSubmitting ? 'default' : 'pointer',
                      }}
                    >
                      {reviewSubmitting ? 'SAVING...' : 'SUBMIT REVIEW'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Card 1 — Basic Info */}
      <GlassCard className="relative mb-6" style={NEU_CARD_STYLE}>
        {/* decorative bleed off the left edge */}
        <User
          aria-hidden
          size={118}
          strokeWidth={1}
          className="pointer-events-none absolute"
          style={{ bottom: '-26px', left: '-30px', color: 'rgba(27,56,40,0.045)', zIndex: 0 }}
        />

        <div className="relative flex items-center gap-2.5 mb-6" style={{ zIndex: 1 }}>
          <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={User} size={30} />
          <Eyebrow size="lg">Basic Information</Eyebrow>
        </div>

        {/* Avatar — roughly double the previous size, upload affordance intact */}
        <div className="relative flex items-center gap-5 mb-7" style={{ zIndex: 1 }}>
          <div className="relative flex-shrink-0">
            {displayAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayAvatar}
                alt="Profile"
                className="rounded-full object-cover"
                style={{ width: '144px', height: '144px', border: '3px solid #FAF8F3', boxShadow: NEU.out }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center font-black"
                style={{ width: '144px', height: '144px', fontSize: '52px', background: 'linear-gradient(150deg, rgba(27,56,40,0.14), rgba(27,56,40,0.08))', border: '3px solid #FAF8F3', color: '#1B3828', fontFamily: OUTFIT, boxShadow: NEU.out }}
              >
                {(displayName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
              </div>
            )}
            {/* Camera affordance — click anywhere on the avatar to change it */}
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              aria-label={displayAvatar ? 'Change photo' : 'Upload photo'}
              className="absolute flex items-center justify-center focus:outline-none"
              style={{
                right: '4px', bottom: '4px', width: '40px', height: '40px', borderRadius: '9999px',
                background: 'linear-gradient(150deg, #24492F, #1B3828)', border: '3px solid #F0EBDD',
                color: '#EED98A', cursor: avatarUploading ? 'default' : 'pointer',
                boxShadow: '0 4px 10px rgba(27,56,40,0.35)',
              }}
            >
              <Camera size={17} strokeWidth={2.3} />
            </button>
            {avatarUploading && (
              <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(27,56,40,0.45)' }}>
                <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#EED98A', borderTopColor: 'transparent' }} />
              </div>
            )}
          </div>
          <div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold focus:outline-none"
              style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, border: 'none', cursor: avatarUploading ? 'default' : 'pointer', boxShadow: NEU.outSm }}
            >
              <Camera size={14} strokeWidth={2.2} />
              {displayAvatar ? 'Change photo' : 'Upload photo'}
            </button>
            <p className="text-[11px] mt-2" style={{ color: avatarError ? '#8B2020' : '#9A8A78', fontFamily: OUTFIT }}>
              {avatarError || 'JPG or PNG, up to 5MB.'}
            </p>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.currentTarget.value = ''; }}
            />
          </div>
        </div>

        <div className="relative space-y-5" style={{ zIndex: 1 }}>
          {/* Display Name */}
          <div>
            <label
              className="flex items-center gap-1.5 text-[13px] font-semibold mb-1.5"
              style={{ color: '#1C1410', fontFamily: OUTFIT }}
            >
              <User size={13} strokeWidth={2.3} style={{ color: '#B6871F' }} />
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label
              className="flex items-center gap-1.5 text-[13px] font-semibold mb-1.5"
              style={{ color: '#1C1410', fontFamily: OUTFIT }}
            >
              <Mail size={13} strokeWidth={2.3} style={{ color: '#B6871F' }} />
              Email
            </label>
            <input
              type="email"
              value={profile?.email ?? user?.email ?? ''}
              readOnly
              className="w-full rounded-xl px-4 py-3 text-sm"
              style={{
                border: '1px solid #DDD4C0',
                backgroundColor: 'rgba(0,0,0,0.03)',
                color: 'rgba(28,20,16,0.4)',
                fontFamily: OUTFIT,
                cursor: 'not-allowed',
              }}
            />
            <p className="text-xs mt-1" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
              Email cannot be changed here.
            </p>
          </div>

          {/* Nationality + Date of Birth — one row, two columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Nationality — autocomplete with flag. The menu is portalled so no
                card boundary can clip it, and it flips above near the bottom edge. */}
            <div ref={natWrapRef} className="relative">
              <label
                className="flex items-center gap-1.5 text-[13px] font-semibold mb-1.5"
                style={{ color: '#1C1410', fontFamily: OUTFIT }}
              >
                <MapPin size={13} strokeWidth={2.3} style={{ color: '#B6871F' }} />
                Nationality
              </label>
              <div className="relative">
                {natFlag ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={natFlag}
                    alt={nationality}
                    className="absolute pointer-events-none"
                    style={{ left: '14px', top: '50%', transform: 'translateY(-50%)', width: '22px', height: '15px', objectFit: 'cover', borderRadius: '2.5px', boxShadow: '0 1px 3px rgba(27,56,40,0.25)' }}
                  />
                ) : (
                  <Globe2
                    size={17}
                    strokeWidth={2}
                    className="absolute pointer-events-none"
                    style={{ left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#9A8A78' }}
                  />
                )}
                <input
                  ref={natInputRef}
                  type="text"
                  value={nationality}
                  placeholder="Start typing a country..."
                  onChange={(e) => { setNationality(e.target.value); setNatOpen(true); }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; setNatOpen(true); }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
                  className="w-full rounded-xl py-3 text-sm focus:outline-none"
                  style={{ ...inputStyle, paddingLeft: '44px', paddingRight: '16px' }}
                />
              </div>
              {natOpen && natMatches.length > 0 && natPos && (
                <Portal>
                  <div
                    ref={natMenuRef}
                    className="rounded-xl overflow-y-auto"
                    style={{
                      position: 'fixed',
                      top: natPos.top,
                      left: natPos.left,
                      width: natPos.width,
                      transform: natPos.up ? 'translateY(-100%)' : 'none',
                      zIndex: 9999,
                      maxHeight: '224px',
                      backgroundColor: 'rgba(250,248,243,0.98)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      border: '1px solid #DDD4C0',
                      boxShadow: '0 16px 40px rgba(27,56,40,0.16)',
                    }}
                  >
                    {natMatches.slice(0, 40).map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setNationality(c.name); setNatOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm focus:outline-none"
                        style={{ background: 'none', border: 'none', color: '#1C1410', fontFamily: OUTFIT, cursor: 'pointer' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getFlagUrl(c.code)}
                          alt=""
                          style={{ width: '20px', height: '14px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }}
                        />
                        {c.name}
                      </button>
                    ))}
                  </div>
                </Portal>
              )}
            </div>

            {/* Date of birth + derived age */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  className="flex items-center gap-1.5 text-[13px] font-semibold"
                  style={{ color: '#1C1410', fontFamily: OUTFIT }}
                >
                  <Cake size={13} strokeWidth={2.3} style={{ color: '#B6871F' }} />
                  Date of Birth
                </label>
                {headerAge !== null && (
                  <Pill tone="gold" size="sm" icon={<Cake size={11} strokeWidth={2.4} />}>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>Age {headerAge}</span>
                  </Pill>
                )}
              </div>
              <DatePicker
                value={dateOfBirth}
                onChange={(iso) => { setDateOfBirth(iso); setDobError(''); }}
                max={new Date().toISOString().slice(0, 10)}
                initialView="2005-06-15"
                placeholder="Select your date of birth"
              />
              {dobError ? (
                <p className="text-xs mt-1" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
                  {dobError}
                </p>
              ) : (
                <p className="text-xs mt-1" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                  Your age is calculated automatically.
                </p>
              )}
            </div>
          </div>

          {/* Education — where they do MUN. Editable two-state switch; the value
              is shown as the delegate's level when they apply to conferences, so
              it saves immediately (optimistic) on toggle. */}
          <div>
            <label
              className="flex items-center gap-1.5 text-[13px] font-semibold mb-1.5"
              style={{ color: '#1C1410', fontFamily: OUTFIT }}
            >
              <GraduationCap size={13} strokeWidth={2.3} style={{ color: '#B6871F' }} />
              Education
            </label>
            {(() => {
              const OPTIONS = [
                { key: 'high_school' as const, label: 'High School', Icon: School },
                { key: 'university'  as const, label: 'University',  Icon: GraduationCap },
              ];
              const selectedIdx = OPTIONS.findIndex((o) => o.key === educationLevel);
              return (
                <div
                  role="radiogroup"
                  aria-label="Education level"
                  className="relative grid grid-cols-2 gap-1 rounded-full p-1 select-none"
                  style={{
                    maxWidth: '340px',
                    backgroundColor: 'rgba(27,56,40,0.06)',
                    boxShadow: NEU.inSm,
                  }}
                >
                  {/* Sliding forest thumb — only rendered once a side is chosen. */}
                  {selectedIdx >= 0 && (
                    <span
                      aria-hidden
                      className="absolute rounded-full"
                      style={{
                        top: '4px',
                        bottom: '4px',
                        left: selectedIdx === 0 ? '4px' : 'calc(50% + 2px)',
                        width: 'calc(50% - 6px)',
                        background: 'linear-gradient(150deg, #24492F, #1B3828)',
                        boxShadow: '0 4px 12px rgba(27,56,40,0.3), inset 0 1px 0 rgba(238,217,138,0.25)',
                        border: '1px solid rgba(238,217,138,0.35)',
                        transition: 'left 260ms cubic-bezier(0.4,0,0.2,1)',
                      }}
                    />
                  )}
                  {OPTIONS.map((o) => {
                    const active = educationLevel === o.key;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => handleEducationChange(o.key)}
                        className="relative z-[1] inline-flex items-center justify-center gap-2 rounded-full py-2.5 px-3 text-[13px] font-bold focus:outline-none"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: active ? '#EED98A' : '#6B5D4A',
                          fontFamily: OUTFIT,
                          letterSpacing: '0.01em',
                          transition: 'color 200ms ease',
                        }}
                      >
                        <o.Icon size={16} strokeWidth={2.2} style={{ color: active ? '#EED98A' : '#9A8A78', transition: 'color 200ms ease' }} />
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            <p className="text-xs mt-1.5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
              Shown as your level when you apply to conferences.
            </p>
          </div>
        </div>

        <div className="relative mt-7 flex items-center gap-4" style={{ zIndex: 1 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full py-2.5 px-6 font-bold text-[13px] focus:outline-none transition-colors"
            style={{
              backgroundColor: saving ? '#DDD4C0' : '#1B3828',
              color: saving ? '#9A8A78' : '#EED98A',
              fontFamily: OUTFIT,
              letterSpacing: '0.08em',
              border: 'none',
              cursor: saving ? 'default' : 'pointer',
              boxShadow: saving ? 'none' : NEU.outSm,
            }}
            onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { if (!saving) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            {saving ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
          {saved && (
            <span className="text-sm font-semibold" style={{ color: '#3D7A52', fontFamily: OUTFIT }}>
              Saved ✓
            </span>
          )}
        </div>
      </GlassCard>

      {/* Card 2 — Notification Preferences */}
      <GlassCard className="relative mb-6" style={NEU_CARD_STYLE}>
        {/* decorative bleed off the right edge */}
        <Bell
          aria-hidden
          size={112}
          strokeWidth={1}
          className="pointer-events-none absolute"
          style={{ top: '-24px', right: '-14px', color: 'rgba(27,56,40,0.045)', zIndex: 0 }}
        />
        <div className="relative flex items-center gap-2.5 mb-1.5" style={{ zIndex: 1 }}>
          <NeuIconDisc gradient={NEU_GRADIENTS.amber} icon={Bell} size={30} />
          <Eyebrow size="lg">Notification Preferences</Eyebrow>
        </div>
        <p className="relative text-[13px] mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT, zIndex: 1 }}>
          Control which emails Gavelling sends you.
        </p>

        <div className="relative" style={{ zIndex: 1 }}>
          {NOTIFICATION_ROWS.map((row, i) => (
            <div
              key={row.field}
              className="flex items-center gap-4 py-3.5"
              style={{ borderBottom: i < NOTIFICATION_ROWS.length - 1 ? '1px solid rgba(221,212,192,0.55)' : 'none' }}
            >
              <span
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '11px',
                  backgroundColor: notifications[row.field] ? 'rgba(27,56,40,0.09)' : 'rgba(154,138,120,0.1)',
                  border: `1px solid ${notifications[row.field] ? 'rgba(27,56,40,0.22)' : 'rgba(154,138,120,0.2)'}`,
                  transition: 'background-color 200ms ease, border-color 200ms ease',
                }}
              >
                <row.Icon
                  size={16}
                  strokeWidth={1.9}
                  style={{ color: notifications[row.field] ? '#1B3828' : '#9A8A78', transition: 'color 200ms ease' }}
                />
              </span>
              <div className="flex-1 min-w-0 pr-2">
                <p className="font-semibold text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}>
                  {row.label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#9A8A78', fontFamily: OUTFIT, margin: '2px 0 0 0' }}>
                  {row.desc}
                </p>
              </div>
              <PillToggle
                value={notifications[row.field]}
                onChange={(v) => handleToggle(row.field, v)}
              />
            </div>
          ))}
        </div>
        {/* Functional emails (chair/import invites, replies to your own
           requests) aren't gated by these toggles, see ALWAYS_SEND_EVENTS
           in src/lib/emailEvents.ts, opting out would break the product. */}
        <p className="text-xs mt-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          Essential emails about invitations and your requests are always sent.
        </p>
      </GlassCard>

      {/* Card 3 — Account */}
      <GlassCard style={{ ...NEU_CARD_STYLE, boxShadow: `${NEU.out}, inset 0 0 0 1.5px rgba(139,32,32,0.22)` }}>
        <div className="flex items-center gap-2.5 mb-4">
          <span
            className="inline-flex items-center justify-center flex-shrink-0"
            style={{ width: 30, height: 30, borderRadius: 10, background: 'linear-gradient(135deg, rgba(139,32,32,0.16), rgba(139,32,32,0.08))', border: '1px solid rgba(139,32,32,0.3)' }}
          >
            <ShieldAlert size={16} strokeWidth={2.2} style={{ color: '#8B2020' }} />
          </span>
          <Eyebrow size="lg" color="#8B2020">Account</Eyebrow>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSignOut}
            className="flex-1 rounded-full py-2.5 font-semibold text-[13px] focus:outline-none transition-colors"
            style={{
              border: '1px solid rgba(139,32,32,0.3)',
              color: '#8B2020',
              backgroundColor: 'transparent',
              fontFamily: OUTFIT,
              letterSpacing: '0.06em',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.05)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            SIGN OUT
          </button>
          <button
            onClick={openDeleteAccount}
            className="flex-1 rounded-full py-2.5 font-semibold text-[13px] focus:outline-none transition-colors"
            style={{
              border: '1px solid #8B2020',
              color: '#FFFFFF',
              backgroundColor: '#8B2020',
              fontFamily: OUTFIT,
              letterSpacing: '0.06em',
              cursor: 'pointer',
              boxShadow: NEU.outSm,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#701919'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#8B2020'; }}
          >
            DELETE ACCOUNT
          </button>
        </div>
      </GlassCard>

      {deleteOpen && (
        <ConfirmModal
          title="Delete your account?"
          danger
          loading={deleting}
          confirmDisabled={deleteConfirmText.trim() !== 'DELETE'}
          confirmLabel="Delete account"
          onCancel={() => { if (!deleting) setDeleteOpen(false); }}
          onConfirm={handleConfirmDeleteAccount}
          body={
            <div>
              <p>
                Your profile, applications, allocations, documents and requests are permanently removed. This cannot be undone.
              </p>
              {deleteError && (
                <div className="mt-3">
                  <p className="font-semibold" style={{ color: '#8B2020' }}>{deleteError}</p>
                  {soleOwnerConferences && soleOwnerConferences.length > 0 && (
                    <ul className="mt-1.5 ml-4 list-disc">
                      {soleOwnerConferences.map((c) => (
                        <li key={c.slug}>
                          <Link
                            href={`/manage/${c.slug}/settings`}
                            className="underline"
                            style={{ color: '#8B2020' }}
                          >
                            {c.full_name || c.slug}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="mt-4">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                  Type DELETE to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  disabled={deleting}
                  autoFocus
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={inputStyle}
                />
              </div>
            </div>
          }
        />
      )}
    </div>
  );
}
