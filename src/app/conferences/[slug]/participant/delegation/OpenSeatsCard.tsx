'use client';

// The delegation's open seats (block seats the organiser gave with nobody in
// them) and the reshuffle deadline. Rendered only while DELEGATIONS_V2_DB is
// on (my_delegation_open_seats and conferences.delegation_reshuffle_until).
// Every seat in columns: flag and country, the committee's emblem and acronym,
// a dashed tile. No invite links (taste board vote). A seat the People table
// has just filled leaves at once and a seat it has just emptied shows at once
// (seat/pendingSeats), before the re-read lands.

import { Clock } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { committeeDisplayName } from '@/lib/presetNames';
import type { OpenSeat } from './v2';
import { usePendingOpenSeats } from './seat/pendingSeats';
import { cardStyle, CommitteeDisc, committeeEmblemSrc, FONT, FOREST, INK, INK_SOFT, StatNumber, STROKE } from './leaderKit';

export function OpenSeatsCard({ seats: read, societyId }: { seats: OpenSeat[]; societyId?: string }) {
  const seats = usePendingOpenSeats(societyId, read) ?? [];
  if (seats.length === 0) return null;
  return (
    <section className="@container" style={{ ...cardStyle, padding: '22px 24px' }} aria-label="Open seats">
      <div style={{ marginBottom: 14 }}>
        <StatNumber n={seats.length} word={seats.length === 1 ? 'open seat' : 'open seats'} />
      </div>
      <div className="grid grid-cols-1 @[480px]:grid-cols-2 @[760px]:grid-cols-3 @[1000px]:grid-cols-4" style={{ gap: '10px 16px' }}>
        {seats.map((s, i) => (
          <div
            key={`${s.allocation_id ?? ''}-${s.conference_committee_id}-${s.seat}-${i}`}
            className="flex items-center gap-2.5 min-w-0"
            style={{ padding: '10px 12px', borderRadius: 12, border: '1.5px dashed rgba(27,56,40,0.22)' }}
          >
            <CircleFlag code={s.country_code} logoUrl={s.country_logo_url} label={s.country_name} size={22} decorative />
            <span className="flex-1 min-w-0 [overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: INK }}>{s.country_name}</span>
            <span className="inline-flex items-center gap-1.5 [overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>
              <CommitteeDisc src={s.emblem ?? committeeEmblemSrc(s.logo_url, s.committee, s.abbreviation)} size={20} />
              {(s.abbreviation ?? '').trim() || committeeDisplayName(s.committee, s.abbreviation)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ReshuffleLine({ until }: { until: string }) {
  const d = new Date(until);
  if (Number.isNaN(d.getTime())) return null;
  const when = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="flex items-center gap-3" style={{ ...cardStyle, padding: '16px 20px' }}>
      <Clock size={22} strokeWidth={STROKE} aria-hidden style={{ color: FOREST, flexShrink: 0 }} />
      <span style={{ fontFamily: FONT, fontSize: 14, color: INK }}>You can reshuffle seats until <b style={{ fontWeight: 600 }}>{when}</b></span>
    </div>
  );
}
