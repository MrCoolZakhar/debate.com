'use client';

import { sortCvEntries } from '@/lib/cvOrder';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Share2, Check, ScrollText, EyeOff } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { syncExperienceLevel } from '@/lib/munExperience';
import { cvHref } from '@/lib/cvLink';
import { CVEntryModal, type CVEntry } from '@/components/CVEntryModal';
import { ShareAchievementModal } from '@/components/ShareAchievementModal';
import Loader from '@/components/Loader';
import { LevelBadge, OUTFIT, T } from '../accountUi';
import { TimelineEntry } from './CVTimeline';
import { AccountHero, HeroOverlap, RaisedCard, EmojiDisc, FOREST, INK, INK_SOFT, DEEP_GOLD } from '../accountShell';
import { GoldWord } from '@/components/BrandHeading';
import { CircleFlag } from '@/components/CircleFlag';
import VerifiedCheck from '@/components/VerifiedCheck';
import { getCountryByName } from '@/lib/countries';
import { experienceProgress } from '@/lib/munExperience';
import CVPrivacyPanel, { type CvPrivacy } from './CVPrivacyPanel';
import { friendlyError } from '@/lib/friendlyError';

// ── Page ───────────────────────────────────────────────────────────────────

export default function CVPage() {
  const { user, session, profile, loading: authLoading } = useAuth();
  const [entries, setEntries]       = useState<CVEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modalEntry, setModalEntry] = useState<CVEntry | null>(null);
  const [modalOpen, setModalOpen]   = useState(false);
  const [copied, setCopied]         = useState(false);
  // Spotify-Wrapped celebration — set only when a NEW entry is added.
  const [shareEntry, setShareEntry] = useState<CVEntry | null>(null);
  // Who can see the CV (profiles.cv_private / cv_hide_nationality). Enforced by
  // get_public_cv() and the mun_cv_entries SELECT policy, never by this page.
  const [privacy, setPrivacy] = useState<CvPrivacy>({ cvPrivate: false, hideNationality: false });
  const [privSaving, setPrivSaving] = useState(false);
  const [privError, setPrivError] = useState<string | null>(null);
  // Shown on the person card only (the owner's own view).
  const [nationality, setNationality] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('mun_cv_entries')
      .select('id, entry_type, conference_name, committee, allocation, expertise_level, award, awards, photos, description, logo_url, conference_id, event_date, source, created_at, is_private')
      .eq('user_id', user.id);
    const rows = ((data as CVEntry[]) ?? []).map((r) => ({
      ...r,
      entry_type: r.entry_type ?? 'delegate',
      awards: r.awards ?? [],
      photos: r.photos ?? [],
    }));
    // Timeline order: dated first, then year-in-name, undated at the bottom (src/lib/cvOrder.ts).
    const ordered = sortCvEntries(rows);
    setEntries(ordered);
    setLoading(false);
    // Keep profiles.mun_experience_level in sync with the CV count.
    syncExperienceLevel(supabase, user.id, rows.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, session?.access_token]);

  useEffect(() => {
    if (authLoading) return;
    fetchEntries();
  }, [authLoading, fetchEntries]);

  useEffect(() => {
    if (authLoading || !user || !session) return;
    let cancelled = false;
    getAuthedClient(session.access_token)
      .from('profiles')
      .select('cv_private, cv_hide_nationality, nationality')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setPrivacy({ cvPrivate: !!data.cv_private, hideNationality: !!data.cv_hide_nationality });
        setNationality(data.nationality ?? null);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, session?.access_token]);

  // Optimistic, then checked: supabase-js resolves with no error on a refused
  // or zero-row update, so the rows are counted and the old value comes back
  // when nothing landed.
  const changePrivacy = useCallback(async (patch: Partial<CvPrivacy>) => {
    if (!user || !session) return;
    const before = privacy;
    const next = { ...privacy, ...patch };
    setPrivacy(next);
    setPrivSaving(true);
    setPrivError(null);
    const { data, error } = await getAuthedClient(session.access_token)
      .from('profiles')
      .update({ cv_private: next.cvPrivate, cv_hide_nationality: next.hideNationality })
      .eq('id', user.id)
      .select('id');
    setPrivSaving(false);
    if (error || !data || data.length === 0) {
      setPrivacy(before);
      setPrivError(friendlyError(error, 'Could not save who can see your CV. Try again.'));
    }
  }, [user, session, privacy]);

  const toggleEntryPrivate = useCallback(async (entry: CVEntry) => {
    if (!session) return;
    const nextVal = !entry.is_private;
    setPrivError(null);
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, is_private: nextVal } : e)));
    const { data, error } = await getAuthedClient(session.access_token)
      .from('mun_cv_entries')
      .update({ is_private: nextVal })
      .eq('id', entry.id)
      .select('id');
    if (error || !data || data.length === 0) {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, is_private: !nextVal } : e)));
      setPrivError(friendlyError(error, `Could not ${nextVal ? 'hide' : 'show'} ${entry.conference_name}. Try again.`));
    }
  }, [session]);

  const handleDelete = useCallback(async (id: string) => {
    if (!session || !user) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('mun_cv_entries').delete().eq('id', id);
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      syncExperienceLevel(supabase, user.id, next.length);
      return next;
    });
  }, [session, user]);

  // Human-readable share link: name slug + first 8 chars of the UUID, e.g.
  // /cv/hrehaan-vora-8f0376f2. Old raw-UUID links keep working (page resolves
  // both forms). Falls back to the bare short id if there's no display name.
  const buildCvShareUrl = useCallback(() => {
    if (!user) return '';
    const slug = (profile?.display_name ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const shortId = user.id.slice(0, 8);
    const path = slug ? `${slug}-${shortId}` : shortId;
    return `${window.location.origin}/cv/${path}`;
  }, [user, profile?.display_name]);

  // The same /cv/… path as a relative href, for the "see what visitors see"
  // link. Uses the shared cvHref rather than a second slug builder, and is
  // null before auth resolves (so the link simply isn't rendered yet).
  const publicHref = cvHref(user?.id, profile?.display_name);

  // After a save: refresh the timeline, and — only for a brand-new entry —
  // fire the Spotify-Wrapped congratulations card.
  const handleSaved = useCallback((added?: CVEntry) => {
    fetchEntries();
    if (added) setShareEntry(added);
  }, [fetchEntries]);

  function handleShare() {
    if (!user) return;
    const url = buildCvShareUrl();
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2200); };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => {
        window.prompt('Copy your public CV link:', url);
      });
    } else {
      window.prompt('Copy your public CV link:', url);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader size={56} label="Loading your CV" />
      </div>
    );
  }

  // The three figures of the person card (Strava-like): conferences, awards
  // (the awards list, else the single legacy award), and distinct committees.
  const totalAwards = entries.reduce((sum, e) => sum + (e.awards.length > 0 ? e.awards.length : (e.award && e.award !== 'None' ? 1 : 0)), 0);
  const totalCommittees = new Set(entries.map((e) => (e.committee ?? '').trim().toLowerCase()).filter(Boolean)).size;
  const totalVerified = entries.filter((e) => e.source === 'gavelling_verified').length;
  const exp = experienceProgress(entries.length);
  const natCountry = nationality ? getCountryByName(nationality) : undefined;
  const name = profile?.display_name ?? user?.email?.split('@')[0] ?? '';
  const openAdd = () => { setModalEntry(null); setModalOpen(true); };

  return (
    <div>
      <AccountHero
        label="Delegate record"
        title={<>Your MUN <GoldWord>CV</GoldWord></>}
        line="Every Model UN conference you have taken part in, in one record"
        emoji="Scroll"
        fallback={ScrollText}
        aside={
          <>
            {/* Share: copies a public read-only link to this CV */}
            <button
              type="button"
              onClick={handleShare}
              disabled={privacy.cvPrivate}
              aria-label={privacy.cvPrivate ? 'Your CV is private, so there is no public link to share' : 'Copy a public link to your CV'}
              title={privacy.cvPrivate ? 'Your CV is private. Make it public to share it.' : copied ? 'Link copied' : 'Share your CV'}
              className="gv-acct-btn2"
            >
              {copied ? <Check size={16} strokeWidth={2.6} style={{ color: '#2A5A3C' }} aria-hidden /> : <Share2 size={16} strokeWidth={2.2} aria-hidden />}
              {copied ? 'Copied' : 'Share'}
            </button>
            <button type="button" onClick={openAdd} className="gv-acct-btn" aria-label="Add a conference to your CV">
              <Plus size={18} strokeWidth={2.6} aria-hidden />
              Add conference
            </button>
          </>
        }
      >
        {/* Who can see the CV: one small toggle, the rest behind its gear */}
        <CVPrivacyPanel
          value={privacy}
          onChange={changePrivacy}
          saving={privSaving}
          error={privError}
          publicHref={publicHref}
          hiddenCount={entries.filter((e) => e.is_private).length}
        />
      </AccountHero>

      <HeroOverlap>
        {/* ── The person, with three big numbers ── */}
        <RaisedCard className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-4 min-w-0 md:flex-1">
            <span className="relative flex-shrink-0">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="rounded-full object-cover"
                  style={{ width: 84, height: 84, boxShadow: '0 0 0 4px #FFFFFF, 0 0 0 5px rgba(27,56,40,0.10), 0 10px 22px -8px rgba(27,56,40,0.35)' }}
                />
              ) : (
                <span
                  aria-hidden
                  className="rounded-full flex items-center justify-center"
                  style={{
                    width: 84, height: 84, fontFamily: OUTFIT, fontWeight: 800, fontSize: 34, color: FOREST,
                    background: 'linear-gradient(150deg, rgba(238,217,138,0.55), rgba(238,217,138,0.22))',
                    boxShadow: '0 0 0 4px #FFFFFF, 0 0 0 5px rgba(27,56,40,0.10), 0 10px 22px -8px rgba(27,56,40,0.35)',
                  }}
                >
                  {(name[0] ?? '?').toUpperCase()}
                </span>
              )}
              {natCountry && (
                <span className="absolute" style={{ right: -4, bottom: -2 }} title={privacy.hideNationality ? `${natCountry.name}, hidden on your public CV` : natCountry.name}>
                  <CircleFlag code={natCountry.code} size={30} label={natCountry.name} style={{ boxShadow: '0 0 0 3px #FFFFFF, 0 3px 8px rgba(27,56,40,0.25)', opacity: privacy.hideNationality ? 0.55 : 1 }} />
                </span>
              )}
            </span>
            <div className="min-w-0">
              <p className="[overflow-wrap:anywhere]" style={{ margin: 0, fontFamily: OUTFIT, fontWeight: 800, fontSize: 'clamp(22px, 4.5vw, 28px)', lineHeight: 1.15, letterSpacing: '-0.02em', color: INK }}>
                {name}
              </p>
              {natCountry && (
                <p className="inline-flex items-center gap-1.5 [overflow-wrap:anywhere]" style={{ margin: '3px 0 0', fontFamily: OUTFIT, fontSize: T.body, color: INK_SOFT }}>
                  {natCountry.name}
                  {privacy.hideNationality && <EyeOff size={13} strokeWidth={2.3} aria-label="Hidden on your public CV" />}
                </p>
              )}
              <div className="mt-2.5">
                <LevelBadge level={exp.level} size="sm" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 md:gap-3 md:flex-shrink-0" style={{ minWidth: 0 }}>
            {[
              { value: entries.length, word: entries.length === 1 ? 'Conference' : 'Conferences' },
              { value: totalAwards, word: totalAwards === 1 ? 'Award' : 'Awards' },
              { value: totalCommittees, word: totalCommittees === 1 ? 'Committee' : 'Committees' },
            ].map((s) => (
              <div
                key={s.word}
                className="rounded-[18px] px-3 py-3 md:px-5 md:py-4 text-center"
                style={{ backgroundColor: 'rgba(27,56,40,0.035)', minWidth: 0 }}
              >
                <p style={{ margin: 0, fontFamily: OUTFIT, fontWeight: 800, fontSize: 'clamp(30px, 6vw, 44px)', lineHeight: 1, letterSpacing: '-0.03em', color: FOREST, fontVariantNumeric: 'tabular-nums' }}>
                  {s.value}
                </p>
                <p className="[overflow-wrap:anywhere]" style={{ margin: '6px 0 0', fontFamily: OUTFIT, fontWeight: 600, fontSize: T.caption + 1, color: INK_SOFT }}>
                  {s.word}
                </p>
              </div>
            ))}
          </div>
        </RaisedCard>
      </HeroOverlap>

      {totalVerified > 0 && (
        <p className="inline-flex items-center gap-1.5 mt-4 px-2 sm:px-4 md:px-6" style={{ fontFamily: OUTFIT, fontSize: T.body, color: INK_SOFT }}>
          <VerifiedCheck verified size={16} />
          <span><strong style={{ color: INK, fontVariantNumeric: 'tabular-nums' }}>{totalVerified}</strong> verified by Gavelling</span>
        </p>
      )}

      <div className="mt-6 px-2 sm:px-4 md:px-6">
        {/* Entries: vertical timeline */}
        <div className="flex items-baseline gap-2.5 mb-5">
          <h2 style={{ margin: 0, fontFamily: OUTFIT, fontWeight: 800, fontSize: T.section, letterSpacing: '-0.01em', color: INK }}>
            Timeline
          </h2>
          {entries.length > 0 && (
            <span style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: T.section, color: DEEP_GOLD, fontVariantNumeric: 'tabular-nums' }}>{entries.length}</span>
          )}
        </div>

        {entries.length === 0 ? (
          <RaisedCard className="text-center !py-12">
            <div className="flex justify-center mb-4"><EmojiDisc emoji="Scroll" fallback={ScrollText} size={56} /></div>
            <p style={{ margin: '0 0 18px', fontFamily: OUTFIT, fontSize: T.body + 2, fontWeight: 700, color: INK }}>
              Add the conferences you have taken part in
            </p>
            <button type="button" onClick={openAdd} className="gv-acct-btn" aria-label="Add your first conference">
              <Plus size={18} strokeWidth={2.6} aria-hidden />
              Add your first conference
            </button>
          </RaisedCard>
        ) : (
          <div className="flex flex-col">
            {entries.map((entry, i) => (
              <TimelineEntry
                key={entry.id}
                entry={entry}
                isLast={i === entries.length - 1}
                onEdit={() => { setModalEntry(entry); setModalOpen(true); }}
                onTogglePrivate={() => toggleEntryPrivate(entry)}
              />
            ))}
          </div>
        )}
      </div>

      {modalOpen && user && (
        <CVEntryModal
          existing={modalEntry}
          userId={user.id}
          onClose={() => { setModalOpen(false); setModalEntry(null); }}
          onSaved={handleSaved}
          onDelete={handleDelete}
        />
      )}

      {/* Spotify-Wrapped celebration — opens only after a NEW conference is added */}
      <ShareAchievementModal
        open={!!shareEntry}
        entry={shareEntry}
        profileName={profile?.display_name ?? ''}
        cvShareUrl={buildCvShareUrl()}
        onClose={() => setShareEntry(null)}
      />
    </div>
  );
}

