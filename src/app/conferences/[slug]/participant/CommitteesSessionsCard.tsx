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
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { supabase as anonSupabase } from '@/lib/supabase';
import { OUTFIT, effectiveReleaseTime, formatReleaseDate } from './shared';
import { DashCard, CardHeading, CommitteeEmblem, TwoRowName, ForestLink, committeeShort, INK, INK_SOFT } from './dashboardKit';

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

  if (!committees) return null;

  const releaseMs = effectiveReleaseTime(releaseAt, conferenceStartDate);
  const released = releaseMs !== null && releaseMs <= Date.now();

  return (
    <DashCard>
      <CardHeading
        title="Committees"
        aside={committees.length > 0 ? (
          <span style={{ fontFamily: OUTFIT, fontSize: 13, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>
            <b style={{ color: INK, fontSize: 17 }}>{committees.length}</b> {committees.length === 1 ? 'room' : 'rooms'}
          </span>
        ) : undefined}
      />

      {committees.length === 0 ? (
        <p className="text-sm" style={{ color: INK_SOFT, fontFamily: OUTFIT, margin: 0 }}>The organisers have not added committees yet.</p>
      ) : !released && releaseMs !== null ? (
        <p className="text-sm mb-4" style={{ color: INK, fontFamily: OUTFIT }}>
          Sessions open {formatReleaseDate(releaseMs)}
        </p>
      ) : null}

      <div className="flex flex-col">
        {committees.map((c, i) => (
          <div
            key={c.id}
            className="flex items-center gap-3 py-3"
            style={i > 0 ? { borderTop: '1px solid rgba(27,56,40,0.07)' } : undefined}
          >
            <CommitteeEmblem logoUrl={c.logo_url} name={c.name} abbreviation={c.abbreviation} size={40} />
            <div className="flex-1 min-w-0">
              <TwoRowName short={committeeShort(c.name, c.abbreviation)} full={c.name} size={15} />
            </div>
            {released && c.session_code && (
              <ForestLink href={`/advisor?add=${encodeURIComponent(c.session_code)}`} className="flex-shrink-0">
                View session
              </ForestLink>
            )}
          </div>
        ))}
      </div>
    </DashCard>
  );
}
