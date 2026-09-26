'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Star, X, Check, Megaphone, MessageSquare, ClipboardCheck, FileText, CreditCard, Camera, Globe2, Sparkles, Cake, Mail, User, Bell, ShieldAlert, MapPin, GraduationCap, School, Layers, Landmark, Trophy, Coins, Infinity as InfinityIcon } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { UN_COUNTRIES, getCountryByName, countryMatchRank } from '@/lib/countries';
import { CircleFlag } from '@/components/CircleFlag';
import { deriveExperienceLevel, experienceProgress } from '@/lib/munExperience';
import { ageAt } from '@/lib/age';
import { conferenceAcronymLabel } from '@/lib/conferenceLabels';
import { useCredits } from '@/hooks/useCredits';
import { useUnlimitedStatus, isUnlimited } from '@/lib/unlimitedStatus';
import { GoldWord } from '@/components/BrandHeading';
import { PillToggle, ExperienceInfo, LevelInsignia, OUTFIT, T } from '../accountUi';
import { AccountHero, HeroOverlap, RaisedCard, CardHead, StatBlock, EmojiDisc, RAISED, INSET } from '../accountShell';
import { ConfirmModal } from '@/components/ConfirmModal';
import { DatePicker } from '@/components/DatePicker';
import Portal from '@/components/Portal';
import Loader from '@/components/Loader';
import { plainOrFallback } from '@/lib/friendlyError';

interface ReviewableConference {
  id: string;
  slug: string;
  acronym: string;
  full_name: string;
  end_date: string | null;
  start_date: string | null;
}

const NOTIFICATION_ROWS = [
  { field: 'notify_email_applications' as const, Icon: ClipboardCheck, label: 'Application & Status Updates', desc: 'Acceptance, rejection, allocation, and committee assignment emails' },
  { field: 'notify_email_payments'     as const, Icon: CreditCard,     label: 'Payment & Billing',            desc: 'Invoices, receipts, fee waivers, and payment reminders' },
  { field: 'notify_email_documents'    as const, Icon: FileText,       label: 'Documents & Deadlines',        desc: "Study guide releases, position paper feedback, and submission deadlines" },
  { field: 'notify_email_marketing'    as const, Icon: Megaphone,      label: 'Conference Announcements',     desc: 'Broadcast announcements and general updates sent by conferences you applied to' },
  // Organizer-side. Harmless for a delegate who never organizes anything —
  // nothing sends against it unless you're on an organizing team.
  { field: 'notify_email_reminders'    as const, Icon: MessageSquare,   label: 'Questions & Reminders',        desc: "For conferences you organize: a heads-up when a participant asks your team a question, and a reminder every 3 days while questions are still waiting on a reply" },
];

type NotifFields = {
  notify_email_applications: boolean;
  notify_email_payments:     boolean;
  notify_email_documents:    boolean;
  notify_email_marketing:    boolean;
  notify_email_reminders:    boolean;
};

// Every hint, field note and description on this page used to be `#9A8A78`,
// which is the `muted` token: a 3.15:1 wash that neu.tsx says in as many words
// must NEVER carry body copy (it is for rules, disabled glyphs and
// placeholders). Half of what this page asks a person to READ was painted in
// it, at 12px. Size alone would not have fixed that, so the hints changed
// colour as well as size: `#6E5F4E` is the warm secondary ink the account
// pills already use, about 6.4:1 on the cream card.
const HINT = '#6E5F4E';

const inputStyle: React.CSSProperties = {
  border: '1px solid #DDD4C0',
  backgroundColor: '#FFFFFF',
  color: '#1C1410',
  // 14px is the floor for anything typed into (T.body) and also the point
  // below which iOS zooms the page on focus; the inputs were `text-sm`, i.e.
  // exactly 14, so this only states it rather than changing it.
  fontSize: T.body,
  fontFamily: OUTFIT,
};

export default function ProfilePage() {
  const { user, session, profile, signOut, loading: authLoading } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [nationality, setNationality] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [dobError, setDobError] = useState('');
  const [notifications, setNotifications] = useState<NotifFields>({
    notify_email_applications: true,
    notify_email_payments:     true,
    notify_email_documents:    true,
    notify_email_marketing:    true,
    notify_email_reminders:    true,
  });
  const [educationLevel, setEducationLevel] = useState<string | null>(null);
  const [cvCount, setCvCount]         = useState<number | null>(null);
  // Awards on the MUN CV, for the stat card (read only, counted the way the
  // CV page counts them: the awards list, else the single legacy award).
  const [awardCount, setAwardCount]   = useState<number | null>(null);
  const { balance: creditBalance }    = useCredits();
  const unlimitedStatus               = useUnlimitedStatus();
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [saveError, setSaveError]     = useState('');

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
      .select('display_name, nationality, date_of_birth, education_level, mun_experience_level, notify_email_marketing, notify_email_applications, notify_email_documents, notify_email_payments, notify_email_reminders')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name ?? '');
          setNationality(data.nationality ?? '');
          setDateOfBirth(data.date_of_birth ?? '');
          setEducationLevel(data.education_level ?? null);
          setNotifications({
            notify_email_applications: data.notify_email_applications ?? true,
            notify_email_payments:     data.notify_email_payments     ?? true,
            notify_email_documents:    data.notify_email_documents    ?? true,
            notify_email_marketing:    data.notify_email_marketing    ?? true,
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

    supabase
      .from('mun_cv_entries')
      .select('award, awards')
      .eq('user_id', user.id)
      .then(({ data: cvRows }) => {
        const rows = (cvRows ?? []) as { award: string | null; awards: string[] | null }[];
        setAwardCount(rows.reduce((n, r) => n + ((r.awards?.length ?? 0) > 0 ? r.awards!.length : (r.award && r.award !== 'None' ? 1 : 0)), 0));
      });
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
      setReviewError('Your review could not be saved. Please try again.');
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
    setSaveError('');
    // Guard BEFORE the spinner latches: returning after setSaving(true) would
    // leave the button reading SAVING… with nothing left to clear it.
    if (!session) {
      setSaveError('Your session has expired. Please refresh the page and sign in again.');
      return;
    }
    // Nationality and date of birth are REQUIRED here, not merely accepted.
    // Sign-up asks for both, the OAuth callback walls anyone missing them, and
    // an application now refuses to proceed without them, because allocation
    // places delegates by country and conferences enforce age limits. This
    // form used to write `value || null`, so it was the one door that could
    // put an account back into the broken state those three guards exist to
    // prevent. It can still CHANGE them; it can no longer empty them.
    const country = getCountryByName(nationality);
    if (!country) {
      setSaveError('Please choose your nationality from the list.');
      return;
    }
    if (!dateOfBirth) {
      setSaveError('Please enter your date of birth.');
      return;
    }
    const age = ageAt(dateOfBirth);
    if (age === null || age < 0 || age > 120) {
      setSaveError('That date of birth does not look right.');
      return;
    }
    if (age < 13) {
      setSaveError('You need to be at least 13 to use Gavelling.');
      return;
    }

    setSaving(true);
    const supabase = getAuthedClient(session.access_token);
    // These are the fields every conference application reads back, so a
    // silently dropped write (RLS, a constraint) is not something the delegate
    // can be told "Saved" about. supabase-js RESOLVES on a PostgREST error, so
    // the result has to be destructured and checked, exactly as the education
    // and notification writes below do.
    //
    // `.select('id')` for the second half of that: an update matching ZERO
    // rows comes back with error === null, so without it a write that changed
    // nothing would still show "Saved".
    const { data, error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        nationality:  country.name,
        date_of_birth: dateOfBirth,
      })
      .eq('id', user.id)
      .select('id');
    setSaving(false);
    if (error || !data || data.length === 0) {
      setSaveError('We could not save your profile. Please check your connection and try again.');
      return;
    }
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
  // must match what onboarding writes: 'high_school' | 'university' | 'both'.
  function handleEducationChange(value: 'high_school' | 'university' | 'both') {
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
          setDeleteError(plainOrFallback(body.message, 'You are the sole owner of one or more conferences. Transfer or archive them first.'));
        } else {
          setDeleteError(plainOrFallback(body?.message, 'Could not delete your account. Please try again.'));
        }
        setDeleting(false);
        return;
      }
      const result = data as { ok?: boolean; reason?: string; conferences?: { slug: string; full_name: string }[]; message?: string } | null;
      if (result && result.ok === false) {
        if (result.reason === 'sole_owner') {
          setSoleOwnerConferences(result.conferences ?? []);
          setDeleteError(plainOrFallback(result.message, 'You are the sole owner of one or more conferences. Transfer or archive them first.'));
        } else {
          setDeleteError(plainOrFallback(result.message, 'Could not delete your account. Please try again.'));
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
  // Accent-folded + alias-aware ranking — see THE FOLDING RULE in countries.ts.
  // The old `.includes()` could not find "Türkiye" from "Tu".
  const natMatches = useMemo(() => {
    const q = nationality.trim();
    if (!q) return UN_COUNTRIES;
    return UN_COUNTRIES
      .map((c) => ({ c, rank: countryMatchRank(c.name, q, 'en') }))
      .filter((x): x is { c: typeof UN_COUNTRIES[number]; rank: number } => x.rank !== null)
      .sort((a, b) => a.rank - b.rank || a.c.name.localeCompare(b.c.name))
      .map((x) => x.c);
  }, [nationality]);


  const exp = experienceProgress(cvCount ?? 0);

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader size={56} label="Loading your profile" />
      </div>
    );
  }

  const displayAvatar = avatarUrl ?? profile?.avatar_url ?? null;
  const headerAge = (() => {
    const a = ageAt(dateOfBirth);
    return a !== null && a >= 0 && a <= 120 ? a : null;
  })();
  const educationWord = EDUCATION_WORD[educationLevel ?? ''] ?? null;
  const unlimited = isUnlimited(unlimitedStatus);

  const label = (Icon: typeof User, text: string) => (
    <span className="flex items-center gap-1.5 font-semibold" style={{ fontSize: T.body, color: '#1C1410', fontFamily: OUTFIT }}>
      <Icon size={14} strokeWidth={2.2} style={{ color: '#B6871F' }} aria-hidden />
      {text}
    </span>
  );

  return (
    <div>
      {/* iOS Safari zooms the whole page when a focused field is under 16px,
          so every field is 16px on a phone only; the 14px desktop field is
          unchanged. `!important` because the size comes from a utility class
          and, on the nationality field, an inline style. (18 Sep 2026 phone
          audit.) The two tap growers enlarge small hit areas on a phone. */}
      <style>{`
@media (max-width:743px){
  .gv-acct-input{font-size:16px!important}
  .gv-tap44>button::after{content:'';position:absolute;top:-11px;bottom:-11px;left:-8px;right:-8px}
  .gv-tap20::after{content:'';position:absolute;top:-12px;bottom:-12px;left:-12px;right:-12px}
}
.gv-acct-input:focus{border-color:#1B3828!important;box-shadow:0 0 0 3px rgba(27,56,40,0.10)}`}</style>

      <AccountHero
        label="Your profile"
        title={<>Your <GoldWord>Profile</GoldWord></>}
        line="The details every conference reads when you apply"
        emoji="Bust in silhouette"
        fallback={User}
      />

      <HeroOverlap>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
          {/* ── Identity card ── */}
          <RaisedCard className="lg:col-span-5 flex flex-col">
            <div className="flex flex-col items-center text-center">
              <div className="relative flex-shrink-0">
                {displayAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayAvatar}
                    alt="Profile"
                    className="rounded-full object-cover"
                    style={{ width: 128, height: 128, boxShadow: '0 0 0 4px #FFFFFF, 0 0 0 5px rgba(27,56,40,0.10), 0 12px 26px -8px rgba(27,56,40,0.35)' }}
                  />
                ) : (
                  <div
                    className="rounded-full flex items-center justify-center font-black"
                    style={{
                      width: 128, height: 128, fontSize: 50, color: '#1B3828', fontFamily: OUTFIT,
                      background: 'linear-gradient(150deg, rgba(238,217,138,0.55), rgba(238,217,138,0.22))',
                      boxShadow: '0 0 0 4px #FFFFFF, 0 0 0 5px rgba(27,56,40,0.10), 0 12px 26px -8px rgba(27,56,40,0.35)',
                    }}
                  >
                    {(displayName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
                  </div>
                )}
                {/* Camera: the soft round rimmed disc */}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  aria-label={displayAvatar ? 'Change photo' : 'Upload photo'}
                  className="gv-acct-rim absolute"
                  style={{ right: -2, bottom: 2, width: 42, height: 42 }}
                >
                  <Camera size={18} strokeWidth={2.2} aria-hidden />
                </button>
                {avatarUploading && (
                  <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(27,56,40,0.45)' }}>
                    <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#EED98A', borderTopColor: 'transparent' }} />
                  </div>
                )}
              </div>

              <h2
                className="[overflow-wrap:anywhere]"
                style={{ margin: '18px 0 0', fontFamily: OUTFIT, fontWeight: 800, fontSize: 'clamp(24px, 5vw, 30px)', lineHeight: 1.15, letterSpacing: '-0.02em', color: '#1C1410' }}
              >
                {displayName || 'Your name'}
              </h2>
              <p className="[overflow-wrap:anywhere]" style={{ margin: '4px 0 0', fontFamily: OUTFIT, fontSize: T.body, color: HINT }}>
                {profile?.email ?? user?.email ?? ''}
              </p>
              <p className="inline-flex items-center gap-1.5" style={{ margin: '10px 0 0', fontFamily: OUTFIT, fontSize: T.body, fontWeight: 700, color: unlimited ? '#1B3828' : HINT }}>
                {unlimited
                  ? <InfinityIcon size={16} strokeWidth={2.4} style={{ color: '#B6871F' }} aria-hidden />
                  : <Sparkles size={15} strokeWidth={2.2} style={{ color: '#B6871F' }} aria-hidden />}
                {unlimited ? 'Unlimited' : 'Free plan'}
              </p>
            </div>

            {/* Facts: icon + plain words, one per row */}
            <ul className="mt-5 flex flex-col gap-2" style={{ listStyle: 'none', padding: 0, margin: '20px 0 0' }}>
              <FactRow
                icon={natCountry ? <CircleFlag code={natCountry.code} size={26} decorative /> : <Globe2 size={18} strokeWidth={2} style={{ color: '#9A8A78' }} aria-hidden />}
                label="Nationality"
                value={natCountry?.name ?? 'Not set'}
              />
              <FactRow
                icon={<Cake size={18} strokeWidth={2} style={{ color: '#B6871F' }} aria-hidden />}
                label="Age"
                value={headerAge !== null ? String(headerAge) : 'Not set'}
              />
              <FactRow
                icon={<GraduationCap size={18} strokeWidth={2} style={{ color: '#B6871F' }} aria-hidden />}
                label="Education"
                value={educationWord ?? 'Not set'}
              />
            </ul>

            <div className="mt-5 flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="gv-acct-btn2 w-full"
              >
                <Camera size={16} strokeWidth={2.2} aria-hidden />
                {displayAvatar ? 'Change photo' : 'Upload photo'}
              </button>
              <p style={{ margin: 0, fontSize: T.caption, color: avatarError ? '#8B2020' : HINT, fontFamily: OUTFIT }}>
                {avatarError || 'JPG or PNG, up to 5MB'}
              </p>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.currentTarget.value = ''; }}
              />
            </div>
          </RaisedCard>

          {/* ── Stats + rank ── */}
          <div className="lg:col-span-7 flex flex-col gap-4 md:gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatBlock
                emoji="Classical building"
                fallback={Landmark}
                value={cvCount ?? 0}
                word={(cvCount ?? 0) === 1 ? 'conference' : 'conferences'}
                note="On your MUN CV"
                href="/account/cv"
              />
              <StatBlock
                emoji="Trophy"
                fallback={Trophy}
                value={awardCount ?? 0}
                word={(awardCount ?? 0) === 1 ? 'award' : 'awards'}
                note="Across your conferences"
                href="/account/cv"
              />
              <StatBlock
                emoji="Coin"
                fallback={Coins}
                value={unlimited ? '∞' : (creditBalance ?? '…')}
                word={unlimited ? 'Unlimited' : creditBalance === 1 ? 'credit' : 'credits'}
                note={unlimited ? 'Apply as often as you like' : 'One credit, one application'}
                href="/account/manage/credits"
              />
            </div>

            {/* Rank: a white card, the insignia large, a gold progress line */}
            <Link
              href="/account/cv"
              className="gv-acct-card-link block rounded-[22px] p-5 md:p-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2"
              style={{ textDecoration: 'none', background: 'linear-gradient(180deg, #FFFFFF 0%, #FDFBF7 100%)', boxShadow: RAISED }}
            >
              <div className="flex items-center gap-4 min-w-0">
                <span
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 76, height: 76, borderRadius: 9999,
                    background: 'radial-gradient(circle at 34% 30%, #FFFFFF, rgba(238,217,138,0.42) 70%)',
                    boxShadow: 'inset 0 1px 0 #FFFFFF, 0 0 0 1px rgba(182,135,31,0.30), 0 0 0 5px rgba(238,217,138,0.25), 0 8px 18px -6px rgba(27,56,40,0.30)',
                  }}
                >
                  <LevelInsignia level={exp.level} size={46} />
                </span>
                <div className="min-w-0 flex-1">
                  <span
                    className="inline-flex items-center gap-2"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  >
                    <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: T.caption, letterSpacing: '0.14em', color: '#B6871F', textTransform: 'uppercase' }}>
                      Your MUN rank
                    </span>
                    <ExperienceInfo tone="light" align="left" currentLevel={exp.level} />
                  </span>
                  <p className="break-words" style={{ margin: '4px 0 0', fontFamily: OUTFIT, fontWeight: 800, fontSize: 'clamp(28px, 6vw, 40px)', lineHeight: 1.05, letterSpacing: '-0.02em', color: '#1C1410' }}>
                    {exp.label}
                  </p>
                </div>
              </div>
              <div className="mt-5 w-full rounded-full overflow-hidden" style={{ height: 10, backgroundColor: 'rgba(27,56,40,0.06)', boxShadow: 'inset 1px 1px 3px rgba(27,56,40,0.12)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(4, Math.round(exp.progress * 100))}%`, background: 'linear-gradient(90deg, #EED98A, #B6871F)', transition: 'width 500ms ease' }}
                />
              </div>
              <p className="flex flex-wrap items-center justify-between gap-2" style={{ margin: '12px 0 0', fontFamily: OUTFIT, fontSize: T.body }}>
                <span style={{ color: HINT }}>
                  {exp.nextLabel
                    ? `${exp.remaining} more ${exp.remaining === 1 ? 'conference' : 'conferences'} to ${exp.nextLabel}`
                    : 'Top tier reached'}
                </span>
                <span className="gv-acct-link">
                  {exp.nextLabel ? 'Add to your MUN CV' : 'View your MUN CV'}
                </span>
              </p>
            </Link>
          </div>
        </div>
      </HeroOverlap>

      {/* Review prompts: conferences attended but not yet reviewed */}
      {reviewable.length > 0 && (
        <div className="flex flex-col gap-3 mt-6 px-2 sm:px-4 md:px-6">
          {reviewable.map((conf) => {
            const formOpen = reviewFormFor === conf.id;
            return (
              <RaisedCard key={conf.id} className="!p-4 md:!p-5">
                <div className="flex items-center gap-4">
                  <EmojiDisc emoji="Glowing star" fallback={Star} size={42} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold" style={{ fontSize: T.body + 1, color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}>
                      How was {conferenceAcronymLabel(conf)}?
                    </p>
                    <p className="[overflow-wrap:anywhere]" style={{ fontSize: T.caption + 1, color: HINT, fontFamily: OUTFIT, margin: '2px 0 0 0' }}>
                      Leave a review of{' '}
                      <Link href={`/conferences/${conf.slug}`} className="gv-acct-link">
                        {conf.full_name}
                      </Link>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openReviewForm(conf.id)}
                    className={`${formOpen ? 'gv-acct-btn2' : 'gv-acct-btn'} flex-shrink-0`}
                    style={{ minHeight: 40, padding: '0 16px', fontSize: T.body }}
                  >
                    {formOpen ? 'Close' : 'Leave a review'}
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissReviewPrompt(conf.id)}
                    aria-label={`Dismiss review prompt for ${conferenceAcronymLabel(conf)}`}
                    className="gv-acct-rim flex-shrink-0"
                    style={{ width: 32, height: 32, color: '#5A5046' }}
                  >
                    <X size={14} aria-hidden />
                  </button>
                </div>

                {formOpen && (
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(221,212,192,0.6)' }}>
                    <div className="flex items-center gap-1.5 mb-3" onMouseLeave={() => setReviewHover(0)}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setReviewRating(i)}
                          onMouseEnter={() => setReviewHover(i)}
                          aria-label={`Rate ${i} out of 5`}
                          className="focus:outline-none"
                          style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer' }}
                        >
                          <Star
                            size={26}
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
                      className="gv-acct-input w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                      style={{ ...inputStyle, lineHeight: 1.7 }}
                    />
                    {reviewError && (
                      <p style={{ fontSize: T.caption, color: '#8B2020', fontFamily: OUTFIT, margin: '8px 0 0 0' }}>
                        {reviewError}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSubmitReview(conf)}
                      disabled={reviewRating < 1 || reviewSubmitting}
                      className="gv-acct-btn mt-3"
                    >
                      {reviewSubmitting ? 'Saving…' : 'Submit review'}
                    </button>
                  </div>
                )}
              </RaisedCard>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5 mt-6 px-2 sm:px-4 md:px-6">
        {/* ── Your details (editable) ── */}
        <RaisedCard className="lg:col-span-7">
          <CardHead emoji="Pencil" fallback={User} title="Your details" sub="Nationality and date of birth are required to apply" />

          <div className="space-y-5">
            {/* Display name */}
            <label className="block">
              <span className="block mb-1.5">{label(User, 'Display name')}</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="gv-acct-input w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                style={inputStyle}
              />
            </label>

            {/* Email (read-only) */}
            <div>
              <span className="block mb-1.5">{label(Mail, 'Email')}</span>
              <input
                type="email"
                value={profile?.email ?? user?.email ?? ''}
                readOnly
                aria-label="Email"
                className="gv-acct-input w-full rounded-xl px-4 py-3 text-sm"
                style={{
                  border: '1px solid #DDD4C0',
                  backgroundColor: 'rgba(27,56,40,0.03)',
                  color: '#6E5F4E',
                  fontFamily: OUTFIT,
                  cursor: 'not-allowed',
                }}
              />
              <p className="mt-1" style={{ fontSize: T.caption, color: HINT, fontFamily: OUTFIT }}>
                Email cannot be changed here
              </p>
            </div>

            {/* Nationality + Date of Birth: one row, two columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Nationality: autocomplete with flag. The menu is portalled so no
                  card boundary can clip it, and it flips above near the bottom edge. */}
              <div ref={natWrapRef} className="relative">
                <span className="block mb-1.5">{label(MapPin, 'Nationality')}</span>
                <div className="relative">
                  {natCountry ? (
                    <span
                      className="absolute pointer-events-none inline-flex"
                      style={{ left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                    >
                      <CircleFlag code={natCountry.code} size={20} label={nationality} />
                    </span>
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
                    aria-label="Nationality"
                    placeholder="Start typing a country..."
                    onChange={(e) => { setNationality(e.target.value); setNatOpen(true); }}
                    onFocus={() => setNatOpen(true)}
                    className="gv-acct-input w-full rounded-xl py-3 text-sm focus:outline-none"
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
                        backgroundColor: 'rgba(255,255,255,0.98)',
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
                          <CircleFlag code={c.code} size={20} decorative style={{ flexShrink: 0 }} />
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
                  {label(Cake, 'Date of birth')}
                  {headerAge !== null && (
                    <span style={{ fontFamily: OUTFIT, fontSize: T.body, fontWeight: 700, color: '#B6871F', fontVariantNumeric: 'tabular-nums' }}>
                      Age {headerAge}
                    </span>
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
                  <p className="mt-1" style={{ fontSize: T.caption, color: '#8B2020', fontFamily: OUTFIT }}>
                    {dobError}
                  </p>
                ) : (
                  <p className="mt-1" style={{ fontSize: T.caption, color: HINT, fontFamily: OUTFIT }}>
                    Your age is calculated automatically
                  </p>
                )}
              </div>
            </div>

            {/* Education: where they do MUN. Saves on its own when picked
                (optimistic), because it is shown as the delegate's level when
                they apply to conferences. */}
            <div>
              <span className="block mb-1.5">{label(GraduationCap, 'Education')}</span>
              {(() => {
                const OPTIONS = [
                  { key: 'high_school' as const, label: 'High school', Icon: School },
                  { key: 'university'  as const, label: 'University',  Icon: GraduationCap },
                  { key: 'both'        as const, label: 'Both',        Icon: Layers },
                ];
                const selectedIdx = OPTIONS.findIndex((o) => o.key === educationLevel);
                return (
                  <div
                    role="radiogroup"
                    aria-label="Education level"
                    className="gv-edu-seg relative grid gap-1 rounded-[14px] p-1 select-none"
                    style={{ maxWidth: '480px', backgroundColor: 'rgba(27,56,40,0.05)', boxShadow: INSET }}
                  >
                    {/* Under 520px the three options stack and the thumb
                        slides down instead of across. Position lives in CSS so
                        one media query moves both the buttons and the thumb. */}
                    <style>{`
.gv-edu-seg{grid-template-columns:repeat(3,minmax(0,1fr))}
.gv-edu-thumb{top:4px;bottom:4px;left:4px;width:calc((100% - 16px) / 3)}
.gv-edu-thumb[data-idx="1"]{left:calc((100% - 16px) / 3 + 8px)}
.gv-edu-thumb[data-idx="2"]{left:calc((100% - 16px) * 2 / 3 + 12px)}
@media (max-width:520px){
  .gv-edu-seg{grid-template-columns:1fr;max-width:none}
  .gv-edu-seg>button{min-height:48px}
  .gv-edu-thumb{left:4px;right:4px;width:auto;top:4px;bottom:auto;height:calc((100% - 16px) / 3)}
  .gv-edu-thumb[data-idx="1"]{left:4px;top:calc((100% - 16px) / 3 + 8px)}
  .gv-edu-thumb[data-idx="2"]{left:4px;top:calc((100% - 16px) * 2 / 3 + 12px)}
}
@media (prefers-reduced-motion:reduce){.gv-edu-thumb{transition:none}}
                    `}</style>
                    {/* A raised white thumb, only once a side is chosen. */}
                    {selectedIdx >= 0 && (
                      <span
                        aria-hidden
                        data-idx={selectedIdx}
                        className="gv-edu-thumb absolute rounded-[11px]"
                        style={{
                          background: 'linear-gradient(180deg, #FFFFFF, #F8F4EB)',
                          boxShadow: 'inset 0 1px 0 #FFFFFF, 0 0 0 1.5px rgba(27,56,40,0.55), 0 4px 10px -4px rgba(27,56,40,0.3)',
                          transition: 'left 260ms cubic-bezier(0.4,0,0.2,1), top 260ms cubic-bezier(0.4,0,0.2,1)',
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
                          className="relative z-[1] inline-flex items-center justify-center gap-2 rounded-[11px] py-2.5 px-3 font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                          style={{
                            fontSize: T.body,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: active ? '#1B3828' : '#5A5046',
                            fontFamily: OUTFIT,
                            transition: 'color 200ms ease',
                          }}
                        >
                          <o.Icon size={16} strokeWidth={2} fill={active ? 'rgba(238,217,138,0.7)' : 'none'} style={{ color: active ? '#1B3828' : '#9A8A78', transition: 'color 200ms ease' }} />
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
              <p className="mt-1.5" style={{ fontSize: T.caption, color: HINT, fontFamily: OUTFIT }}>
                Shown as your level when you apply to conferences
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button type="button" onClick={handleSave} disabled={saving} className="gv-acct-btn">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && !saveError && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: '#2A5A3C', fontFamily: OUTFIT }}>
                <Check size={15} strokeWidth={2.6} aria-hidden />
                Saved
              </span>
            )}
            {saveError && (
              <span role="alert" className="text-sm font-semibold" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
                {saveError}
              </span>
            )}
          </div>
        </RaisedCard>

        <div className="lg:col-span-5 flex flex-col gap-4 md:gap-5">
          {/* ── Emails ── */}
          <RaisedCard>
            <CardHead emoji="Bell" fallback={Bell} title="Emails" sub="Choose what Gavelling sends you" />
            <div>
              {NOTIFICATION_ROWS.map((row, i) => {
                const on = notifications[row.field];
                return (
                  <div
                    key={row.field}
                    className="flex items-center gap-3.5 py-3"
                    style={{ borderTop: i > 0 ? '1px solid rgba(221,212,192,0.55)' : 'none' }}
                  >
                    <span
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 36, height: 36, borderRadius: 12,
                        background: on ? 'linear-gradient(135deg, rgba(238,217,138,0.45), rgba(238,217,138,0.2))' : 'rgba(154,138,120,0.10)',
                        transition: 'background-color 200ms ease',
                      }}
                    >
                      <row.Icon
                        size={17}
                        strokeWidth={2}
                        fill={on ? 'rgba(255,255,255,0.7)' : 'none'}
                        style={{ color: on ? '#1B3828' : '#9A8A78', transition: 'color 200ms ease' }}
                      />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold" style={{ fontSize: T.body, color: '#1C1410', fontFamily: OUTFIT, margin: 0 }} title={row.desc}>
                        {row.label}
                      </p>
                      <p style={{ fontSize: T.caption, lineHeight: 1.45, color: HINT, fontFamily: OUTFIT, margin: '2px 0 0 0' }}>
                        {row.desc}
                      </p>
                    </div>
                    {/* The switch is 40x22; the wrapper grows its phone hit
                        area to 44px tall with a pseudo-element. */}
                    <span className="gv-tap44 flex-shrink-0 inline-flex">
                      <PillToggle value={on} onChange={(v) => handleToggle(row.field, v)} />
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Functional emails (chair/import invites, replies to your own
               requests) aren't gated by these toggles, see ALWAYS_SEND_EVENTS
               in src/lib/emailEvents.ts, opting out would break the product. */}
            <p className="mt-3" style={{ fontSize: T.caption, lineHeight: 1.5, color: HINT, fontFamily: OUTFIT, margin: '12px 0 0' }}>
              Invitations and direct replies to your messages are always sent
            </p>
          </RaisedCard>

          {/* ── Account ── */}
          <RaisedCard>
            <CardHead emoji="Key" fallback={ShieldAlert} title="Account" />
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={handleSignOut} className="gv-acct-btn2 flex-1" style={{ minWidth: 150 }}>
                Sign out
              </button>
              <button
                type="button"
                onClick={openDeleteAccount}
                className="gv-acct-btn2 flex-1"
                style={{ minWidth: 150, color: '#8B2020', borderColor: '#8B2020' }}
              >
                Delete account
              </button>
            </div>
          </RaisedCard>
        </div>
      </div>

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
                            className="underline font-bold"
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
                <label className="block font-semibold mb-1.5" style={{ fontSize: T.body, color: '#1C1410', fontFamily: OUTFIT }}>
                  Type DELETE to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  disabled={deleting}
                  autoFocus
                  className="gv-acct-input w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
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

const EDUCATION_WORD: Record<string, string> = {
  high_school: 'High school',
  university: 'University',
  both: 'High school and university',
};

/** One fact on the identity card: icon, the label small, the value in ink. */
function FactRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <li
      className="flex items-center gap-3 rounded-[14px] px-3 py-2.5"
      style={{ backgroundColor: 'rgba(27,56,40,0.035)' }}
    >
      <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28 }}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block" style={{ fontFamily: OUTFIT, fontSize: T.caption, color: HINT }}>{label}</span>
        <span className="block [overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: T.body + 1, fontWeight: 700, color: '#1C1410', lineHeight: 1.3 }}>{value}</span>
      </span>
    </li>
  );
}
