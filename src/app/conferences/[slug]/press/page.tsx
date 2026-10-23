'use client';

// /conferences/[slug]/press — the Press Desk (owner's first draft, 12 Oct 2026).
//
// A read-only live view of every committee room of the conference, for the press (seat
// holders and chairs of a committee_type = 'press' committee) and the conference's accepted
// observers. The press can also send a short press release to every room's Everyone chat.
// Linked from the conference page's You tab (participant/PressDeskEntry.tsx). Noindex by
// header (next.config.ts). The database decides who may read it (press_desk); this page only
// asks.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import Loader from '@/components/Loader';
import AuthLink from '@/components/auth/AuthLink';
import { useAuth } from '@/components/AuthProvider';
import { GoldWord } from '@/components/BrandHeading';
import { OUTFIT } from '@/components/neu';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { themeCssVars, type ConferenceTheme } from '@/lib/theme';
import PressDesk from './PressDesk';
import { CARD_SHADOW, INK, INK_SOFT } from './pressKit';

interface ConferenceHead {
  id: string; full_name: string; acronym: string | null; theme: ConferenceTheme | null;
  /** The conference days: press releases are sent only during them (owner, 23 Oct 2026). */
  start_date: string | null; end_date: string | null; dates_tbd: boolean | null; timezone: string | null;
}

export default function PressDeskPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [conference, setConference] = useState<ConferenceHead | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');

  // Keyed on the user id, never the token (CLAUDE.md: no page reloads by itself).
  useEffect(() => {
    if (!userId || !slug) return;
    let alive = true;
    (async () => {
      const supabase = await getFreshAuthedClient();
      if (!supabase) { if (alive) setState('missing'); return; }
      const { data } = await supabase.from('conferences').select('id, full_name, acronym, theme, start_date, end_date, dates_tbd, timezone').eq('slug', slug).maybeSingle();
      if (!alive) return;
      if (data) { setConference(data as ConferenceHead); setState('ok'); } else setState('missing');
    })();
    return () => { alive = false; };
  }, [userId, slug]);

  return (
    <div className="min-h-screen flex flex-col" style={{ ...themeCssVars(conference?.theme ?? {}), backgroundColor: 'var(--gv-bg)' }}>
      <SiteNav />
      <main className="flex-1 w-full max-w-[1320px] mx-auto px-4 sm:px-6 pt-8 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        <Link
          href={`/conferences/${slug}/role`}
          className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)] rounded"
          style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, color: 'var(--gv-main)', textDecoration: 'underline', marginBottom: 8 }}
        >
          <ArrowLeft size={15} strokeWidth={2.4} aria-hidden /> Back to conference
        </Link>
        <h1 style={{ fontFamily: OUTFIT, fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 800, color: INK, margin: '4px 0 2px 0', lineHeight: 1.15 }}>
          Press <GoldWord style={{ color: 'var(--gv-accent)' }}>Desk</GoldWord>
        </h1>
        {conference && (
          <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 15, color: INK_SOFT, margin: '0 0 22px 0' }}>
            {conference.acronym ? `${conference.acronym} · ${conference.full_name}` : conference.full_name}
          </p>
        )}

        {authLoading || (userId && state === 'loading') ? (
          <div className="flex items-center justify-center py-20"><Loader size={64} label="Opening the Press Desk" /></div>
        ) : !userId ? (
          <div className="rounded-[20px] p-7 text-center mt-6" style={{ backgroundColor: '#FFFFFF', boxShadow: CARD_SHADOW }}>
            <p style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 800, color: INK, margin: 0 }}>Sign in to open the Press Desk</p>
            <AuthLink
              next={`/conferences/${slug}/press`}
              className="mt-4 inline-flex items-center justify-center rounded-[10px] px-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-accent)]"
              style={{ minHeight: 44, background: 'linear-gradient(90deg, var(--gv-main) 0%, var(--gv-main-mid) 100%)', color: 'var(--gv-on-main)', fontFamily: OUTFIT, fontSize: 15, fontWeight: 700 }}
            >
              Sign in
            </AuthLink>
          </div>
        ) : state === 'missing' || !conference ? (
          <div className="rounded-[20px] p-7 text-center mt-6" style={{ backgroundColor: '#FFFFFF', boxShadow: CARD_SHADOW }}>
            <p style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 800, color: INK, margin: 0 }}>Conference not found</p>
          </div>
        ) : (
          <PressDesk conferenceId={conference.id} dates={conference} />
        )}
      </main>
    </div>
  );
}
