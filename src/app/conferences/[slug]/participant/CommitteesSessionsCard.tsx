'use client';

// Committees card, advisor/observer view: every committee in the
// conference, with a View session button from the conference's first day
// (owner, 23 Oct 2026: the start date in the conference's time zone is the
// only gate; the old advisor release date is not read) until its last day.
// The button opens the advisor board, which already follows every room of the
// conference for an advisor without a delegation and for an observer.
// Advisors/observers aren't allocated to a specific committee, so unlike the
// delegate ENTER SESSION gate (AllocationCard), the committee LIST itself
// must come from an anon-readable fetch (the same fields the public
// conference page already shows) — under row-level RLS a viewer who isn't
// allocated anywhere may not get session_code back at all. session_code is
// therefore fetched separately and merged in only where it actually came
// back, so a committee always renders even when its button can't.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { useNow } from '@/lib/useNow';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase as anonSupabase } from '@/lib/supabase';
import { conferenceWindow, formatStartDay, type ConferenceDates } from '@/lib/advisorBoard/conferenceWindow';
import { OUTFIT } from './shared';
import { DashCard, CardHeading, TwoRowName, committeeShort, INK, INK_SOFT } from './dashboardKit';
import { BTN_CLASS, CommitteeDisc, committeeEmblemSrc, secondaryBtn, STROKE } from './delegation/leaderKit';

interface SessionCommittee {
  id: string;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
  session_code: string | null;
}

export default function CommitteesSessionsCard({ conferenceId, conferenceStartDate }: {
  conferenceId: string;
  conferenceStartDate: string | null;
}) {
  const now = useNow();
  const { user, session } = useAuth();
  const userId = user?.id ?? null;
  // Keyed on the user id, never the token (CLAUDE.md §5): the client below
  // sends the SDK's current token whatever this ref holds.
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);
  const [committees, setCommittees] = useState<SessionCommittee[] | null>(null);
  const [dates, setDates] = useState<ConferenceDates | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: baseData }, { data: confData }] = await Promise.all([
        anonSupabase
          .from('conference_committees')
          .select('id, name, abbreviation, logo_url')
          .eq('conference_id', conferenceId)
          .order('name', { ascending: true }),
        anonSupabase
          .from('conferences')
          .select('start_date, end_date, timezone, dates_tbd')
          .eq('id', conferenceId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const conf = confData as { start_date?: string | null; end_date?: string | null; timezone?: string | null; dates_tbd?: boolean | null } | null;
      setDates(conf
        ? { startDate: conf.start_date ?? null, endDate: conf.end_date ?? null, timezone: conf.timezone ?? null, datesTbd: conf.dates_tbd === true }
        : { startDate: conferenceStartDate, endDate: null, timezone: null, datesTbd: false });

      const base = (baseData ?? []) as Omit<SessionCommittee, 'session_code'>[];
      let codeById = new Map<string, string | null>();
      const live = sessionRef.current;
      if (live) {
        const authed = getAuthedClient(live.access_token);
        const { data: codeData } = await authed
          .from('conference_committees')
          .select('id, session_code')
          .eq('conference_id', conferenceId);
        codeById = new Map(((codeData ?? []) as { id: string; session_code: string | null }[]).map(r => [r.id, r.session_code]));
      }
      if (cancelled) return;
      setCommittees(base.map(c => ({ ...c, session_code: codeById.get(c.id) ?? null })));
    })();
    return () => { cancelled = true; };
  }, [conferenceId, userId, conferenceStartDate]);

  if (!committees) return null;

  const live = conferenceWindow(dates ?? { startDate: conferenceStartDate, endDate: null }, now);
  const released = live.state === 'open';

  return (
    <DashCard>
      <CardHeading
        stackedHide
        title="Committees"
        aside={committees.length > 0 ? (
          <span style={{ fontFamily: OUTFIT, fontSize: 13, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>
            <b style={{ color: INK, fontSize: 17 }}>{committees.length}</b> {committees.length === 1 ? 'room' : 'rooms'}
          </span>
        ) : undefined}
      />

      {committees.length === 0 ? (
        <p className="text-sm" style={{ color: INK_SOFT, fontFamily: OUTFIT, margin: 0 }}>The organisers have not added committees yet.</p>
      ) : live.state === 'before' ? (
        <p className="text-sm mb-4" style={{ color: INK, fontFamily: OUTFIT }}>
          Sessions open on {formatStartDay(live.startDate, 'en-GB')}, the first day of the conference
        </p>
      ) : live.state === 'tbd' ? (
        <p className="text-sm mb-4" style={{ color: INK, fontFamily: OUTFIT }}>
          Sessions open when the conference starts
        </p>
      ) : null}

      <div className="flex flex-col">
        {committees.map((c, i) => (
          <div
            key={c.id}
            className="flex items-center gap-3 py-3"
            style={i > 0 ? { borderTop: '1px solid color-mix(in srgb, var(--gv-main) 7%, transparent)' } : undefined}
          >
            <CommitteeDisc src={committeeEmblemSrc(c.logo_url, c.name, c.abbreviation)} size={40} />
            <div className="flex-1 min-w-0">
              <TwoRowName short={committeeShort(c.name, c.abbreviation)} full={c.name} size={15} />
            </div>
            {released && c.session_code && (
              <Link href="/advisor" className={`${BTN_CLASS} flex-shrink-0`} style={secondaryBtn}>
                <Eye size={16} strokeWidth={STROKE} aria-hidden />
                View session
              </Link>
            )}
          </div>
        ))}
      </div>
    </DashCard>
  );
}
