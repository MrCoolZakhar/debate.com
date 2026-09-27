'use client';

// Gavelling staff → Data → Where our users are from (admin_user_origin,
// platform admins only). Confirmed = the nationality people set; estimated =
// the country they applied to most (then their first MUN country) for people
// who never set one. Estimates live here only: they are never written to
// profiles and never shown on a profile. Raw errors are fine here.

import { useEffect, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuCard, NeuIconDisc } from '@/components/neu';
import { CircleFlag } from '@/components/CircleFlag';
import { int, NUM } from './staffBits';

interface UserOrigin {
  total: number;
  confirmed: number;
  estimated: number;
  unknown: number;
  countries: { country: string; confirmed: number; estimated: number }[];
}

const SOLID = `linear-gradient(90deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`;
const HATCH = 'repeating-linear-gradient(135deg, rgba(27,56,40,0.42) 0 3px, rgba(27,56,40,0.14) 3px 6px)';

export default function UserOriginCard() {
  const { session, loading: authLoading } = useAuth();
  const [o, setO] = useState<UserOrigin | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !session) return;
    let alive = true;
    const supabase = getAuthedClient(session.access_token);
    void supabase.rpc('admin_user_origin', { p_limit: 20 }).then(({ data, error: e }) => {
      if (!alive) return;
      if (e) { setError(e.message); return; }
      setO(data as UserOrigin);
    });
    return () => { alive = false; };
  }, [authLoading, session]);

  const top = Math.max(1, ...(o?.countries ?? []).map(c => c.confirmed + c.estimated));

  return (
    <NeuCard style={{ padding: '18px 20px 20px' }}>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Globe2} size={36} />
        <div className="min-w-0 flex-1">
          <h2 style={{ fontFamily: OUTFIT, fontSize: 15.5, fontWeight: 900, color: NEU.ink, letterSpacing: '-0.01em' }}>Where our users are from</h2>
          <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft, marginTop: 1 }}>
            Estimates use the conferences people applied to, then the countries they&apos;ve done MUN in. They are never shown on profiles.
          </p>
        </div>
      </div>
      {error ? (
        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#8B2020' }}>{error}</p>
      ) : !o ? (
        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>Reading…</p>
      ) : (
        <>
          <div className="flex items-center gap-x-5 gap-y-2 flex-wrap mb-4">
            <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.ink, ...NUM }}>
              {int(o.confirmed)} confirmed, {int(o.estimated)} estimated, {int(o.unknown)} unknown
            </p>
            <div className="flex items-center gap-4" aria-hidden>
              <span className="flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft }}>
                <span style={{ width: 14, height: 9, borderRadius: 3, background: SOLID }} />Confirmed
              </span>
              <span className="flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft }}>
                <span style={{ width: 14, height: 9, borderRadius: 3, background: HATCH }} />Estimated
              </span>
            </div>
          </div>
          {o.countries.length === 0 ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>No countries yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {o.countries.map(c => {
                const sum = c.confirmed + c.estimated;
                return (
                  <li
                    key={c.country}
                    className="flex items-center gap-2.5"
                    aria-label={`${c.country}: ${c.confirmed} confirmed, ${c.estimated} estimated`}
                  >
                    <CircleFlag country={c.country} size={20} decorative />
                    <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.ink, width: 150, flexShrink: 0, overflowWrap: 'anywhere' }}>{c.country}</span>
                    <span className="flex-1 flex" style={{ minWidth: 40, height: 10, borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm, overflow: 'hidden' }}>
                      <span style={{ display: 'flex', height: '100%', width: `max(${((sum / top) * 100).toFixed(1)}%, 10px)`, transition: `width 600ms ${EASE}` }}>
                        {c.confirmed > 0 && <span style={{ height: '100%', flexGrow: c.confirmed, flexBasis: 0, background: SOLID }} />}
                        {c.estimated > 0 && <span style={{ height: '100%', flexGrow: c.estimated, flexBasis: 0, background: HATCH }} />}
                      </span>
                    </span>
                    <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, color: NEU.ink, width: 90, textAlign: 'end', flexShrink: 0, ...NUM }}>
                      {int(c.confirmed)}
                      {c.estimated > 0 && <span style={{ color: NEU.inkSoft, fontWeight: 700 }}> +{int(c.estimated)}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </NeuCard>
  );
}
