'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ScrollText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getCountryByName, getFlagUrl } from '@/lib/countries';
import type { CVEntry } from '@/components/CVEntryModal';
import { CVStatsRow, TimelineEntry } from '../../account/cv/CVTimeline';
import { Eyebrow, OUTFIT, MONO } from '../../account/accountUi';

interface PublicProfile {
  id: string;
  display_name: string | null;
  nationality: string | null;
  education_level: string | null;
  mun_experience_level: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export default function PublicCVClient({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [entries, setEntries] = useState<CVEntry[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc('get_public_cv', { p_user_id: userId });
      if (!alive) return;
      const payload = data as { profile: PublicProfile | null; entries: CVEntry[] } | null;
      if (error || !payload || !payload.profile) { setState('notfound'); return; }
      const rows = ((payload.entries as CVEntry[]) ?? []).map((r) => ({
        ...r,
        entry_type: r.entry_type ?? 'delegate',
        awards: r.awards ?? [],
        photos: r.photos ?? [],
      }));
      setProfile(payload.profile);
      setEntries(rows);
      setState('ready');
    })();
    return () => { alive = false; };
  }, [userId]);

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (state === 'notfound' || !profile) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6" style={{ minHeight: '70vh' }}>
        <ScrollText size={44} strokeWidth={1.4} style={{ color: '#B6A88E' }} />
        <h1 className="mt-4 font-black text-[22px]" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
          This CV isn&apos;t available
        </h1>
        <p className="mt-2 text-sm max-w-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.7 }}>
          The link may be incorrect, or this delegate&apos;s record no longer exists.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-full"
          style={{ padding: '12px 20px', backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, fontWeight: 800, fontSize: 13.5, textDecoration: 'none' }}
        >
          Go to Gavelling <ArrowRight size={16} strokeWidth={2.4} />
        </Link>
      </div>
    );
  }

  const country = profile.nationality ? getCountryByName(profile.nationality) : undefined;
  const name = profile.display_name || 'Delegate';
  const initial = name.trim().charAt(0).toUpperCase() || 'D';

  return (
    <div className="min-h-full">
      {/* Slim public top bar */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 md:px-6"
        style={{ height: 60, backgroundColor: 'rgba(237,231,216,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(221,212,192,0.7)' }}
      >
        <Link href="/" style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 17, letterSpacing: '-0.01em', color: '#1B3828', textDecoration: 'none' }}>
          GAVELLING
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full"
          style={{ padding: '9px 15px', backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, fontWeight: 800, fontSize: 12.5, textDecoration: 'none' }}
        >
          Build your MUN CV <ArrowRight size={15} strokeWidth={2.5} />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 md:px-6 pb-20">
        {/* Hero: avatar + name + nationality */}
        <section className="flex items-center gap-4 md:gap-5 py-8">
          {profile.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={profile.avatar_url}
              alt={name}
              className="flex-shrink-0"
              style={{ width: 84, height: 84, borderRadius: '9999px', objectFit: 'cover', border: '2px solid #FDFCF9', boxShadow: '0 8px 22px rgba(27,56,40,0.20)' }}
            />
          ) : (
            <span
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 84, height: 84, borderRadius: '9999px',
                background: 'radial-gradient(120% 120% at 30% 25%, #2A5A3C 0%, #1B3828 70%)',
                color: '#EED98A', fontFamily: OUTFIT, fontWeight: 900, fontSize: 34,
                boxShadow: '0 8px 22px rgba(27,56,40,0.20)',
              }}
            >
              {initial}
            </span>
          )}
          <div className="min-w-0">
            <Eyebrow className="mb-1.5">Model UN CV</Eyebrow>
            <h1 className="font-black leading-tight" style={{ color: '#1C1410', fontFamily: OUTFIT, fontSize: 28, letterSpacing: '-0.015em', margin: 0 }}>
              {name}
            </h1>
            {country && (
              <div className="flex items-center gap-2 mt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getFlagUrl(country.code)} alt="" style={{ width: 22, height: 15, borderRadius: 3, objectFit: 'cover', border: '1px solid rgba(221,212,192,0.9)' }} />
                <span style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 14, color: '#5C5140' }}>{country.name}</span>
              </div>
            )}
          </div>
        </section>

        {/* Stats row — same showcase counts + rank as the private CV */}
        <CVStatsRow entries={entries} />
        <div className="mb-8" />

        {/* Read-only timeline (no edit affordances) */}
        {entries.length === 0 ? (
          <div
            className="text-center rounded-2xl"
            style={{ padding: '56px 24px', backgroundColor: '#FAF8F3', border: '1px solid rgba(221,212,192,0.95)' }}
          >
            <p className="text-lg font-bold mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
              No conferences yet
            </p>
            <p className="text-sm max-w-sm mx-auto" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.7 }}>
              {name} hasn&apos;t added any Model UN conferences to their record.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {entries.map((entry, i) => (
              <TimelineEntry key={entry.id} entry={entry} isLast={i === entries.length - 1} />
            ))}
          </div>
        )}

        {/* Footer CTA */}
        <div
          className="mt-10 flex flex-col items-center text-center rounded-2xl"
          style={{ padding: '28px 24px', backgroundColor: 'rgba(27,56,40,0.05)', border: '1px solid rgba(221,212,192,0.9)' }}
        >
          <p style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.16em', color: '#B6871F', margin: '0 0 6px' }}>
            POWERED BY GAVELLING
          </p>
          <p className="text-sm mb-4 max-w-md" style={{ color: '#5C5140', fontFamily: OUTFIT, lineHeight: 1.6, margin: '0 0 16px' }}>
            Keep your own verified Model UN record — conferences, committees, and awards, beautifully typeset.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full"
            style={{ padding: '12px 20px', backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, fontWeight: 800, fontSize: 13.5, textDecoration: 'none' }}
          >
            Build your MUN CV <ArrowRight size={16} strokeWidth={2.4} />
          </Link>
        </div>
      </main>
    </div>
  );
}
