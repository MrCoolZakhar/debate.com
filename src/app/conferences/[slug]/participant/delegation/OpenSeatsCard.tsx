'use client';

// The delegation's open allocations (block seats the organiser gave with
// nobody in them) and the reshuffle deadline. Rendered only while
// DELEGATIONS_V2_DB is on (my_delegation_open_seats and
// conferences.delegation_reshuffle_until).
// Owner, 21 Oct 2026: a compact LIST in the leader card's right column, right
// under Financials, titled "Open allocations" (the big number and the word,
// then one row per allocation: the country's round flag and name, the
// committee's emblem and acronym). No tiles, no invite links. An allocation the
// People table has just filled leaves at once and one it has just emptied
// shows at once (seat/pendingSeats), before the re-read lands. Committee
// acronym A to Z, then country A to Z, then seat number (seat/seatOrder).

import { Clock } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { committeeDisplayName } from '@/lib/presetNames';
import type { OpenSeat } from './v2';
import { usePendingOpenSeats } from './seat/pendingSeats';
import { sortOpenSeats } from './seat/seatOrder';
import { cardStyle, CommitteeDisc, committeeEmblemSrc, FONT, INK, INK_SOFT, LINE, STROKE } from './leaderKit';

export function OpenSeatsCard({ seats: read, societyId }: { seats: OpenSeat[]; societyId?: string }) {
  const seats = sortOpenSeats(usePendingOpenSeats(societyId, read) ?? []);
  if (seats.length === 0) return null;
  return (
    <section className="flex flex-col p-4 @[640px]:p-5" style={{ ...cardStyle, gap: 6 }} aria-label="Open allocations">
      {/* The title and the count on one line, then the list: compact on a phone too. */}
      <div className="flex items-baseline justify-between gap-3">
        <h2 style={{ fontFamily: FONT, fontSize: 17, fontWeight: 600, color: INK, margin: 0 }}>Open Allocations</h2>
        <span style={{ fontFamily: FONT, fontSize: 24, fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }} aria-label={`${seats.length} open ${seats.length === 1 ? 'allocation' : 'allocations'}`}>
          {seats.length}
        </span>
      </div>
      <ul className="flex flex-col" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {seats.map((s, i) => (
          <li
            key={`${s.allocation_id ?? ''}-${s.conference_committee_id}-${s.seat}-${i}`}
            className="flex items-center gap-3 min-w-0"
            style={{ padding: '7px 0', borderTop: i === 0 ? 'none' : `1px solid ${LINE}` }}
          >
            <span className="flex items-center gap-2 flex-1 min-w-0">
              <CircleFlag code={s.country_code} logoUrl={s.country_logo_url} label={s.country_name} size={22} decorative />
              <span className="min-w-0 [overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: INK, lineHeight: 1.3 }}>{s.country_name}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 flex-none max-w-[45%] [overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, lineHeight: 1.3 }} title={s.committee || undefined}>
              <CommitteeDisc src={s.emblem ?? committeeEmblemSrc(s.logo_url, s.committee, s.abbreviation)} size={20} />
              {(s.abbreviation ?? '').trim() || committeeDisplayName(s.committee, s.abbreviation)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReshuffleLine({ until }: { until: string }) {
  const d = new Date(until);
  if (Number.isNaN(d.getTime())) return null;
  const when = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="flex items-center gap-3" style={{ ...cardStyle, padding: '16px 20px' }}>
      <Clock size={22} strokeWidth={STROKE} aria-hidden style={{ color: 'var(--gv-main)', flexShrink: 0 }} />
      <span style={{ fontFamily: FONT, fontSize: 14, color: INK }}>You can reshuffle allocations until <b style={{ fontWeight: 600 }}>{when}</b></span>
    </div>
  );
}
