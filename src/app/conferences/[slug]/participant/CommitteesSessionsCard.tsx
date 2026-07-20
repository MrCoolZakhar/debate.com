'use client';

// Committees card, advisor/observer view: every committee in the
// conference, with a VIEW SESSION button once sessions have opened.
// Advisors/observers aren't allocated to a specific committee, so unlike the
// delegate ENTER SESSION gate (AllocationCard), the committee LIST itself
// must come from an anon-readable fetch (the same fields the public
// conference page already shows) — under row-level RLS a viewer who isn't
// allocated anywhere may not get session_code back at all. session_code is
// therefore fetched separately and merged in only where it actually came
// back, so a committee always renders even when its button can't.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase as anonSupabase } from '@/lib/supabase';
import { MonogramMedallion } from '@/components/CommitteeEditorModal';
import { SectionCard, OUTFIT, effectiveReleaseTime, formatReleaseDate } from './shared';

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
  const { session } = useAuth();
  const [committees, setCommittees] = useState<SessionCommittee[] | null>(null);
  const [releaseAt, setReleaseAt] = useState<string | null>(null);

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
          .select('session_release_advisors_at')
          .eq('id', conferenceId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setReleaseAt((confData as { session_release_advisors_at?: string | null } | null)?.session_release_advisors_at ?? null);

      const base = (baseData ?? []) as Omit<SessionCommittee, 'session_code'>[];
      let codeById = new Map<string, string | null>();
      if (session) {
        const authed = getAuthedClient(session.access_token);
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
  }, [conferenceId, session?.access_token]);

  if (!committees || committees.length === 0) return null;

  const releaseMs = effectiveReleaseTime(releaseAt, conferenceStartDate);
  const released = releaseMs !== null && releaseMs <= Date.now();

  return (
    <SectionCard>
      <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: '9px', letterSpacing: '0.16em', color: '#B6871F', margin: '0 0 14px 0' }}>
        COMMITTEES
      </p>

      {!released && releaseMs !== null && (
        <p className="text-sm mb-4" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
          Sessions open {formatReleaseDate(releaseMs)}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {committees.map(c => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            style={{ border: '1px solid rgba(221,212,192,0.7)' }}
          >
            {c.logo_url ? (
              <img src={c.logo_url} alt="" style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} />
            ) : (
              <MonogramMedallion text={c.abbreviation || c.name} isCrisis={false} size={32} />
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
                {c.abbreviation || c.name}
              </p>
              {c.abbreviation && (
                <p className="truncate text-xs" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>{c.name}</p>
              )}
            </div>
            {released && c.session_code && (
              <Link
                href={`/advisor/${c.session_code}`}
                className="flex-shrink-0 rounded-lg focus:outline-none"
                style={{
                  padding: '7px 14px', backgroundColor: '#1B3828', color: '#EED98A',
                  fontFamily: OUTFIT, fontWeight: 800, fontSize: 11, letterSpacing: '0.06em',
                  textTransform: 'uppercase', textDecoration: 'none',
                }}
              >
                View Session
              </Link>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
