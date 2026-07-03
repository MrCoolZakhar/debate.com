'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Star, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { UN_COUNTRIES } from '@/lib/countries';

interface ReviewableConference {
  id: string;
  slug: string;
  acronym: string;
  full_name: string;
}

const EXPERIENCE_LEVELS = [
  { value: 'beginner',     label: 'BEGINNER',     sub: 'First or second conference' },
  { value: 'intermediate', label: 'INTERMEDIATE', sub: '3–10 conferences' },
  { value: 'advanced',     label: 'ADVANCED',     sub: '10–20 conferences' },
  { value: 'expert',       label: 'EXPERT',       sub: '20+ conferences' },
];

const NOTIFICATION_ROWS = [
  { field: 'notify_email_marketing'   as const, label: 'Marketing & Newsletter',   desc: 'Updates about new Gavelling features and MUN news' },
  { field: 'notify_email_applications' as const, label: 'Application Updates',     desc: 'Acceptance, rejection, and assignment notifications' },
  { field: 'notify_email_documents'   as const, label: 'Document Notifications',   desc: 'Study guide releases and position paper feedback' },
  { field: 'notify_email_reminders'   as const, label: 'Conference Reminders',     desc: 'Reminders before conferences you\'re attending' },
];

type NotifFields = {
  notify_email_marketing:    boolean;
  notify_email_applications: boolean;
  notify_email_documents:    boolean;
  notify_email_reminders:    boolean;
};

export default function ProfilePage() {
  const { user, session, profile, signOut, loading: authLoading } = useAuth();

  const [displayName, setDisplayName]       = useState('');
  const [nationality, setNationality]       = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [notifications, setNotifications]   = useState<NotifFields>({
    notify_email_marketing:    true,
    notify_email_applications: true,
    notify_email_documents:    true,
    notify_email_reminders:    true,
  });
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);

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
          setExperienceLevel(data.mun_experience_level ?? '');
          setNotifications({
            notify_email_marketing:    data.notify_email_marketing    ?? true,
            notify_email_applications: data.notify_email_applications ?? true,
            notify_email_documents:    data.notify_email_documents    ?? true,
            notify_email_reminders:    data.notify_email_reminders    ?? true,
          });
        }
        setDataLoading(false);
      });

    loadReviewable(supabase);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, session?.access_token]);

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
        display_name:        displayName,
        nationality:         nationality || null,
        mun_experience_level: experienceLevel || null,
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
      <h1
        className="font-black text-2xl mb-1"
        style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
      >
        My Profile
      </h1>
      <p
        className="text-sm mb-8"
        style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
      >
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
                style={{ backgroundColor: '#FAF8F3', border: '1px solid rgba(182,135,31,0.35)' }}
              >
                <div className="flex items-center gap-4">
                  <span
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ width: '36px', height: '36px', borderRadius: '11px', backgroundColor: 'rgba(182,135,31,0.12)' }}
                  >
                    <Star size={16} strokeWidth={2} style={{ color: '#B6871F', fill: '#B6871F' }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold" style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif", margin: 0 }}>
                      How was {conf.acronym}?
                    </p>
                    <p className="text-[12px] truncate" style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif", margin: '1px 0 0 0' }}>
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
                    style={{ backgroundColor: formOpen ? 'transparent' : '#1B3828', color: formOpen ? '#1B3828' : '#EED98A', border: formOpen ? '1px solid #DDD4C0' : '1px solid #1B3828', fontFamily: "'Outfit', sans-serif", letterSpacing: '0.08em', cursor: 'pointer' }}
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
                      style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif", lineHeight: 1.7 }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
                    />
                    {reviewError && (
                      <p className="text-xs mt-2" style={{ color: '#8B2020', fontFamily: "'Outfit', sans-serif", margin: '8px 0 0 0' }}>
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
                        fontFamily: "'Outfit', sans-serif",
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
      <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
        <h2
          className="font-semibold text-base mb-4"
          style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
        >
          Basic Information
        </h2>

        <div className="space-y-4">
          {/* Display Name */}
          <div>
            <label
              className="block text-sm font-semibold mb-1.5"
              style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
            >
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label
              className="block text-sm font-semibold mb-1.5"
              style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
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
                fontFamily: "'Outfit', sans-serif",
                cursor: 'not-allowed',
              }}
            />
            <p
              className="text-xs mt-1"
              style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
            >
              Email cannot be changed here.
            </p>
          </div>

          {/* Nationality */}
          <div>
            <label
              className="block text-sm font-semibold mb-1.5"
              style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
            >
              Nationality
            </label>
            <select
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#DDD4C0'; }}
            >
              <option value="">Select nationality</option>
              {UN_COUNTRIES.map((c) => (
                <option key={c.code} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* MUN Experience Level */}
          <div>
            <label
              className="block text-sm font-semibold mb-2"
              style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
            >
              MUN Experience Level
            </label>
            <div className="grid grid-cols-2 gap-3">
              {EXPERIENCE_LEVELS.map((lvl) => (
                <button
                  key={lvl.value}
                  onClick={() => setExperienceLevel(lvl.value)}
                  className="rounded-xl p-3 text-center focus:outline-none transition-all"
                  style={{
                    border: experienceLevel === lvl.value ? '1.5px solid #1B3828' : '1.5px solid #DDD4C0',
                    backgroundColor: experienceLevel === lvl.value ? 'rgba(27,56,40,0.06)' : 'transparent',
                  }}
                >
                  <p
                    className="font-semibold text-sm"
                    style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                  >
                    {lvl.label}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
                  >
                    {lvl.sub}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl py-2.5 px-6 font-bold text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: saving ? '#DDD4C0' : '#1B3828',
              color: saving ? '#9A8A78' : '#EED98A',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '0.06em',
            }}
            onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { if (!saving) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            {saving ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
          {saved && (
            <span
              className="text-sm font-semibold"
              style={{ color: '#3D7A52', fontFamily: "'Outfit', sans-serif" }}
            >
              Saved ✓
            </span>
          )}
        </div>
      </div>

      {/* Card 2 — Notification Preferences */}
      <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
        <h2
          className="font-semibold text-base mb-1"
          style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
        >
          Notification Preferences
        </h2>
        <p
          className="text-sm mb-4"
          style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
        >
          Control which emails Gavelling sends you.
        </p>

        <div>
          {NOTIFICATION_ROWS.map((row, i) => (
            <div
              key={row.field}
              className="flex items-center justify-between py-3"
              style={{ borderBottom: i < NOTIFICATION_ROWS.length - 1 ? '1px solid #F0EDE6' : 'none' }}
            >
              <div className="flex-1 min-w-0 pr-4">
                <p
                  className="font-semibold text-sm"
                  style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
                >
                  {row.label}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: '#9A8A78', fontFamily: "'Outfit', sans-serif" }}
                >
                  {row.desc}
                </p>
              </div>
              <button
                onClick={() => handleToggle(row.field, !notifications[row.field])}
                className="relative flex-shrink-0 focus:outline-none"
                style={{
                  width: '40px',
                  height: '22px',
                  borderRadius: '9999px',
                  backgroundColor: notifications[row.field] ? '#1B3828' : '#DDD4C0',
                  transition: 'background-color 200ms ease',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <span
                  className="absolute top-[3px] rounded-full"
                  style={{
                    width: '16px',
                    height: '16px',
                    backgroundColor: 'white',
                    left: notifications[row.field] ? '21px' : '3px',
                    transition: 'left 200ms ease',
                  }}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Card 3 — Danger Zone */}
      <div
        className="rounded-2xl p-6"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid rgba(139,32,32,0.2)' }}
      >
        <h2
          className="font-semibold text-base mb-4"
          style={{ color: '#1C1410', fontFamily: "'Outfit', sans-serif" }}
        >
          Account
        </h2>
        <button
          onClick={handleSignOut}
          className="w-full rounded-xl py-2.5 font-semibold text-sm focus:outline-none transition-colors"
          style={{
            border: '1px solid rgba(139,32,32,0.3)',
            color: '#8B2020',
            backgroundColor: 'transparent',
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '0.04em',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,32,32,0.05)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          SIGN OUT
        </button>
      </div>
    </div>
  );
}
