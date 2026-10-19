'use client';

// The delegation pop-up's Documents tab: read only. The position papers the
// delegation's members have handed in (`position_papers`, read under
// "Chairs read committee position papers", which lets the conference's
// organisers read every paper). Reviewing happens on the Documents page.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CircleFlag } from '@/components/CircleFlag';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { memberName, type DelegationMemberLite } from '../delegationRows';
import type { DelegationsData, DelegationView } from './useDelegationsData';
import { CommitteeTag, FONT, INK, INK_SOFT, OK_GREEN, OWE, ROW_LINE, SkeletonRows, linkStyle } from './kit';

interface PaperRow {
  id: string;
  user_id: string;
  conference_committee_id: string;
  country_code: string | null;
  file_name: string | null;
  status: string;
  submitted_at: string | null;
}

const STATUS: Record<string, { label: string; color: string }> = {
  submitted: { label: 'Waiting for review', color: OWE },
  approved: { label: 'Approved', color: OK_GREEN },
  rejected: { label: 'Sent back', color: OWE },
};

const GRID = 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 150px';

export default function DocumentsTab<M extends DelegationMemberLite>({ conferenceId, slug, row, data }: {
  conferenceId: string;
  slug: string;
  row: DelegationView<M>;
  data: DelegationsData<M>;
}) {
  const userIds = useMemo(() => row.members.map(m => m.user_id).filter((u): u is string => !!u), [row.members]);
  const userKey = userIds.join(',');
  const [papers, setPapers] = useState<PaperRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ids = userKey ? userKey.split(',') : [];
      if (ids.length === 0) { setPapers([]); return; }
      const c = await getFreshAuthedClient();
      if (!c || cancelled) return;
      const { data: rows, error } = await c.from('position_papers')
        .select('id, user_id, conference_committee_id, country_code, file_name, status, submitted_at')
        .eq('conference_id', conferenceId)
        .in('user_id', ids)
        .order('submitted_at', { ascending: false });
      if (cancelled) return;
      if (error) { friendlyError(error, 'The papers could not be read.'); setFailed(true); return; }
      setFailed(false);
      setPapers((rows ?? []) as PaperRow[]);
    })();
    return () => { cancelled = true; };
  }, [conferenceId, userKey]);

  const memberByUser = useMemo(() => new Map(row.members.filter(m => m.user_id).map(m => [m.user_id as string, m] as const)), [row.members]);
  const committeeById = useMemo(() => new Map((data.committees ?? []).map(c => [c.id, c] as const)), [data.committees]);

  if (failed) return <p style={{ padding: '24px 28px', fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>The papers could not be read just now. Close this and open it again.</p>;
  if (!papers) return <div style={{ padding: '24px 28px' }}><SkeletonRows rows={4} /></div>;

  return (
    <div className="flex-1 min-h-0 overflow-auto" style={{ padding: '6px 0 10px' }}>
      {papers.length === 0 ? (
        <p style={{ padding: '18px 28px', fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>No position papers from this delegation yet.</p>
      ) : (
        <div style={{ minWidth: 700 }}>
          <div className="grid" style={{ gridTemplateColumns: GRID, gap: 16, padding: '10px 28px' }}>
            {['Person', 'Seat', 'File', 'Status'].map(h => (
              <span key={h} style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: INK_SOFT }}>{h}</span>
            ))}
          </div>
          {papers.map(p => {
            const m = memberByUser.get(p.user_id);
            const com = committeeById.get(p.conference_committee_id);
            const countryName = com?.committee_country_slots.find(s => s.country_code === p.country_code)?.country_name ?? p.country_code ?? '';
            const st = STATUS[p.status] ?? { label: p.status, color: INK_SOFT };
            return (
              <div key={p.id} className="grid items-center" style={{ gridTemplateColumns: GRID, gap: 16, padding: '11px 28px', borderTop: `1px solid ${ROW_LINE}`, fontFamily: FONT, fontSize: 14 }}>
                <span className="[overflow-wrap:anywhere]" style={{ color: INK, fontWeight: 600 }}>{m ? memberName(m) : 'A member'}</span>
                <span className="flex items-center gap-2 flex-wrap min-w-0">
                  {p.country_code && <CircleFlag code={p.country_code} country={countryName} size={18} decorative />}
                  {countryName && <span className="[overflow-wrap:anywhere]" style={{ color: INK }}>{countryName}</span>}
                  {com && <CommitteeTag name={com.name} abbreviation={com.abbreviation} logoUrl={com.logo_url} size={18} fontSize={13} />}
                </span>
                <span className="[overflow-wrap:anywhere]" style={{ color: INK }}>{p.file_name || 'Position paper'}</span>
                <span style={{ color: st.color }}>{st.label}</span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ padding: '16px 28px 6px' }}>
        <Link href={`/manage/${slug}/documents`} style={{ ...linkStyle, fontSize: 14 }}>Review papers on the Documents page</Link>
      </div>
    </div>
  );
}
