'use client';

// The delegate's own honours, shown on their conference page ONLY once the
// secretariat has published the awards (conferences.awards_published_at set
// and the rows flipped to 'published', which is also all the RLS exposes).
// Matching is by the delegate's allocation: committee id + country code,
// which is how a double delegation's two seat-holders both see the honour;
// a row stamped with this user's id is accepted too as a belt-and-braces
// match. No award, or not yet published: renders nothing. There is no
// consolation card on purpose.

import { useState, useEffect, useMemo } from 'react';
import { Share2, Link2, Check, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { AwardChip } from '@/app/account/accountUi';
import { ShareAchievementModal } from '@/components/ShareAchievementModal';
import { cvShareUrl } from '@/lib/cvLink';
import type { CVEntry } from '@/components/CVEntryModal';
import { loadPublishedAwards } from '@/lib/awardsService';
import type { ConferenceAwardRow } from '@/lib/awards';
import { SectionCard, OUTFIT } from './shared';
import type { ParticipantAllocation } from './types';

interface ConferenceBits {
  full_name: string;
  acronym: string | null;
  logo_url: string | null;
  awards_published_at: string | null;
  end_date: string | null;
}

export default function MyAwardsCard({ conferenceId, conferenceSlug, myAllocation }: {
  conferenceId: string;
  conferenceSlug: string;
  myAllocation: ParticipantAllocation | null;
}) {
  const { user, session, profile } = useAuth();
  const [conference, setConference] = useState<ConferenceBits | null>(null);
  const [rows, setRows] = useState<ConferenceAwardRow[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session || !myAllocation) return;
    let cancelled = false;
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data } = await supabase
        .from('conferences')
        .select('full_name, acronym, logo_url, awards_published_at, end_date')
        .eq('id', conferenceId)
        .maybeSingle();
      if (cancelled) return;
      const conf = (data ?? null) as ConferenceBits | null;
      setConference(conf);
      if (!conf?.awards_published_at) return;
      const published = await loadPublishedAwards(supabase, conferenceId);
      if (cancelled) return;
      setRows(published);
    })();
    return () => { cancelled = true; };
  }, [session, conferenceId, myAllocation]);

  const mine = useMemo(() => {
    if (!myAllocation) return [];
    return rows.filter(r =>
      r.conference_committee_id === myAllocation.conference_committee_id
      && (r.country_code === myAllocation.country_code || (!!user && r.user_id === user.id)),
    );
  }, [rows, myAllocation, user]);

  if (!myAllocation || !conference?.awards_published_at || mine.length === 0) return null;

  const committeeName = myAllocation.conference_committees?.name ?? 'your committee';
  const honourRollPath = `/conferences/${conferenceSlug}/awards`;
  const honourRollUrl = typeof window !== 'undefined' ? `${window.location.origin}${honourRollPath}` : honourRollPath;

  // A CV-entry-shaped object for the share card. The real verified entry
  // was minted by publish_conference_awards(); this only feeds the card's
  // text, so a synthetic id is fine and nothing is written.
  const shareEntry: CVEntry = {
    id: `award-${mine[0].id}`,
    entry_type: 'delegate',
    conference_name: conference.full_name || conference.acronym || 'Conference',
    committee: committeeName,
    allocation: myAllocation.country_name,
    expertise_level: null,
    award: mine[0].award_label,
    awards: mine.map(r => r.award_label),
    photos: [],
    description: null,
    logo_url: conference.logo_url,
    conference_id: conferenceId,
    event_date: conference.end_date,
    source: 'gavelling_verified',
    created_at: mine[0].published_at ?? mine[0].created_at,
  };

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(honourRollUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy the honour roll link:', honourRollUrl);
    }
  }

  return (
    <>
      <SectionCard className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(120% 80% at 100% 0%, rgba(238,217,138,0.35), rgba(238,217,138,0) 60%)' }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={13} style={{ color: '#B6871F' }} />
            <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.14em', color: '#B6871F', margin: 0 }}>
              YOUR AWARDS
            </p>
          </div>
          <h3 className="font-black text-[22px] leading-tight" style={{ color: '#1C1410', fontFamily: OUTFIT, margin: 0 }}>
            Congratulations
          </h3>
          <p className="text-[13px] mt-1.5" style={{ color: '#6B5F52', fontFamily: OUTFIT, margin: '6px 0 0 0', lineHeight: 1.55 }}>
            The {conference.acronym || conference.full_name} secretariat has announced the awards for {committeeName}.
          </p>

          <div className="flex flex-wrap gap-2 mt-4">
            {mine.map(r => (
              <AwardChip key={r.id} name={r.award_label} />
            ))}
          </div>

          <p className="text-[12.5px] mt-4" style={{ color: '#2E2820', fontFamily: OUTFIT, margin: '16px 0 0 0', lineHeight: 1.6 }}>
            This is now a verified entry on your MUN CV.{' '}
            <Link href="/account/cv" style={{ color: '#2A5A3C', fontWeight: 700, textDecoration: 'none' }}>Open your CV</Link>
            {' '}or see the{' '}
            <Link href={honourRollPath} style={{ color: '#2A5A3C', fontWeight: 700, textDecoration: 'none' }}>public honour roll</Link>.
          </p>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 focus:outline-none transition-colors"
              style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, fontWeight: 800, fontSize: 12, letterSpacing: '0.06em', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              <Share2 size={13} /> SHARE
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 focus:outline-none"
              style={{ backgroundColor: 'transparent', color: '#1C1410', fontFamily: OUTFIT, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', border: '1px solid #DDD4C0', cursor: 'pointer' }}
            >
              {copied ? <Check size={13} style={{ color: '#3D7A52' }} /> : <Link2 size={13} />} {copied ? 'COPIED' : 'COPY HONOUR ROLL LINK'}
            </button>
          </div>
        </div>
      </SectionCard>

      <ShareAchievementModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        entry={shareEntry}
        profileName={profile?.display_name ?? ''}
        cvShareUrl={cvShareUrl(user?.id, profile?.display_name)}
      />
    </>
  );
}
