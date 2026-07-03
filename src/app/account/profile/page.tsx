'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { Star, X, Megaphone, ClipboardCheck, FileText, BellRing, TrendingUp } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { UN_COUNTRIES, getCountryByName, getFlagUrl } from '@/lib/countries';
import { deriveExperienceLevel, experienceProgress } from '@/lib/munExperience';
import { Eyebrow, GlassCard, PillToggle, OUTFIT, MONO } from '../accountUi';

interface ReviewableConference {
  id: string;
  slug: string;
  acronym: string;
  full_name: string;
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

export default function ProfilePage() {
  const { user, session, profile, signOut, loading: authLoading } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [nationality, setNationality] = useState('');
  const [notifications, setNotifications] = useState<NotifFields>({
    notify_email_marketing:    true,
    notify_email_applications: true,
    notify_email_documents:    true,
    notify_email_reminders:    true,
  });
  const [cvCount, setCvCount]         = useState<number | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);

  // Nationality autocomplete
  const [natOpen, setNatOpen] = useState(false);
  const natWrapRef = useRef<HTMLDivElement | null>(null);

  // Review prompts — conferences the user attended but hasn't reviewed
  const [reviewable, setReviewable]         = useState<ReviewableConference[]>([]);
  const [reviewFormFor, setReviewFormFor]   = useState<string | null>(null);
  const [reviewRating, setReviewRating]     = useState(0);
  const [reviewHover, setReviewHover]       = useState(0);
  const [reviewText, setReviewText]         = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError]       = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);

    supabase
      .from('profiles')
      .select('display_name, nationality, mun_experience_level, notify_email_marketing, notify_email_applications, notify_email_documents, notify_email_reminders')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name ?? '');
          setNationality(data.nationality ?? '');
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

  // Close nationality dropdown on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (natWrapRef.current && !natWrapRef.current.contains(e.target as Node)) {
        setNatOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function loadReviewable(supabase: ReturnType<typeof getAuthedClient>) {
    if (!user) return;
    // Attended = application with status assigned or checked-in
    const { data: apps } = await supabase
      .from('applications')
      .select('conference_id, status, conferences ( id, slug, acronym, full_name )')
      .eq('user_id', user.id)
      .in('status', ['assigned', 'checked-in']);
    const attendedConfs: ReviewableConference[] = [];
    const seen = new Set<string>();
    for (const row of ((apps ?? []) as unknown as { conference_id: string; conferences: ReviewableConference | ReviewableConference[] | null }[])) {
      const conf = Array.isArray(row.conferences) ? row.conferences[0] : row.conferences;
      if (!conf || seen.has(conf.id)) continue;
      seen.add(conf.id);
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
    setSaving(true);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        nationality:  nationality || null,
      })
      .eq('id', user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleToggle(field: keyof NotifFields, value: boolean) {
    setNotifications((prev) => ({ ...prev, [field]: value }));
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    supabase.from('profiles').update({ [field]: value }).eq('id', user!.id);
  }

  async function handleSignOut() {
    await signOut();
    window.location.href = '/';
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

  return (
    <div>
      <Eyebrow className="mb-2">My Profile</Eyebrow>
      <h1
        className="font-black text-[26px] mb-1"
        style={{ color: '#1C1410', fontFamily: OUTFIT, letterSpacing: '-0.01em' }}
      >
        {displayName || 'Your Profile'}
      </h1>
      <p className="text-sm mb-8" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        Manage your Gavelling account details.
      </p>

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
                  border: '1px solid rgba(182,135,31,0.35)',
                  boxShadow: '0 8px 24px rgba(27,56,40,0.06)',
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
      <GlassCard className="mb-6">
        <Eyebrow className="mb-5">Basic Information</Eyebrow>

        <div className="space-y-5">
          {/* Display Name */}
          <div>
            <label
              className="block text-[13px] font-semibold mb-1.5"
              style={{ color: '#1C1410', fontFamily: OUTFIT }}
            >
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
              className="block text-[13px] font-semibold mb-1.5"
              style={{ color: '#1C1410', fontFamily: OUTFIT }}
            >
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

          {/* Nationality — autocomplete with flag */}
          <div ref={natWrapRef} className="relative">
            <label
              className="block text-[13px] font-semibold mb-1.5"
              style={{ color: '#1C1410', fontFamily: OUTFIT }}
            >
              Nationality
            </label>
            <div className="relative">
              {natFlag && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={natFlag}
                  alt={nationality}
                  className="absolute pointer-events-none"
                  style={{ left: '14px', top: '50%', transform: 'translateY(-50%)', width: '22px', height: '15px', objectFit: 'cover', borderRadius: '2.5px', boxShadow: '0 1px 3px rgba(27,56,40,0.25)' }}
                />
              )}
              <input
                type="text"
                value={nationality}
                placeholder="Start typing a country..."
                onChange={(e) => { setNationality(e.target.value); setNatOpen(true); }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; setNatOpen(true); }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
                className="w-full rounded-xl py-3 text-sm focus:outline-none"
                style={{ ...inputStyle, paddingLeft: natFlag ? '46px' : '16px', paddingRight: '16px' }}
              />
            </div>
            {natOpen && natMatches.length > 0 && (
              <div
                className="absolute z-30 left-0 right-0 mt-1.5 rounded-xl overflow-y-auto"
                style={{
                  maxHeight: '224px',
                  backgroundColor: 'rgba(250,248,243,0.97)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid #DDD4C0',
                  boxShadow: '0 16px 40px rgba(27,56,40,0.14)',
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
            )}
          </div>
        </div>

        <div className="mt-7 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl py-2.5 px-6 font-bold text-[13px] focus:outline-none transition-colors"
            style={{
              backgroundColor: saving ? '#DDD4C0' : '#1B3828',
              color: saving ? '#9A8A78' : '#EED98A',
              fontFamily: OUTFIT,
              letterSpacing: '0.08em',
              border: 'none',
              cursor: saving ? 'default' : 'pointer',
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

      {/* Card 2 — MUN Experience (derived, read-only) */}
      <GlassCard className="mb-6">
        <Eyebrow className="mb-4">MUN Experience</Eyebrow>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5"
              style={{
                backgroundColor: 'rgba(27,56,40,0.09)',
                border: '1px solid rgba(27,56,40,0.28)',
                color: '#1B3828',
                fontFamily: OUTFIT,
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              <TrendingUp size={13} strokeWidth={2.4} />
              {exp.label.toUpperCase()}
            </span>
            <span style={{ fontFamily: MONO, fontSize: '11px', color: '#9A8A78' }}>
              {cvCount ?? 0} conference{(cvCount ?? 0) === 1 ? '' : 's'} on your CV
            </span>
          </div>
          {exp.nextLabel && (
            <span style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.08em', color: '#B6871F' }}>
              {exp.remaining} MORE TO {exp.nextLabel.toUpperCase()}
            </span>
          )}
        </div>

        {/* Progress toward next level */}
        <div className="mt-4">
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: '6px', backgroundColor: 'rgba(221,212,192,0.55)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round(exp.progress * 100)}%`,
                background: 'linear-gradient(90deg, #1B3828, #2A5A3C)',
                transition: 'width 400ms ease',
              }}
            />
          </div>
        </div>

        <p className="text-xs mt-3" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.7 }}>
          Your experience level is calculated automatically from your{' '}
          <Link href="/account/cv" style={{ color: '#1B3828', fontWeight: 600, textDecoration: 'none' }}>
            MUN CV
          </Link>
          {' '}— add more conferences to raise it. Conference organisers see this level on your applications.
        </p>
      </GlassCard>

      {/* Card 3 — Notification Preferences */}
      <GlassCard className="mb-6">
        <Eyebrow className="mb-1.5">Notification Preferences</Eyebrow>
        <p className="text-[13px] mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          Control which emails Gavelling sends you.
        </p>

        <div>
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
      </GlassCard>

      {/* Card 4 — Account */}
      <GlassCard style={{ border: '1px solid rgba(139,32,32,0.22)' }}>
        <Eyebrow className="mb-4" color="#8B2020">Account</Eyebrow>
        <button
          onClick={handleSignOut}
          className="w-full rounded-xl py-2.5 font-semibold text-[13px] focus:outline-none transition-colors"
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
      </GlassCard>
    </div>
  );
}
