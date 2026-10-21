'use client';

// Small pieces the seat board (SeatBoard.tsx) and its committee pop-up
// (SeatBoardPopup.tsx) share: names, dates, seat counts, the committee ring
// and the gold preference marker. Presentation only; nothing here writes.

import { NEU } from '@/components/neu';
import { groupAllocationsByCountry } from '@/lib/assignmentFit';
import {
  type AcceptedApp, type CommitteeData, CommitteeLogo, committeeLabels, OUTFIT,
} from '@/app/manage/[slug]/assignment/assignmentKit';

export const CARD_SHADOW = '0 1px 2px rgba(27,56,40,0.06), 0 8px 24px rgba(27,56,40,0.08)';
export const HAIRLINE = '#EFEAE0';
export const WELL = '#F4F0E6';

export function personName(app: Pick<AcceptedApp, 'profiles' | 'invited_name'>): string {
  return app.profiles?.display_name?.trim() || app.invited_name?.trim() || 'Unknown';
}

export function schoolName(app: Pick<AcceptedApp, 'society_id' | 'societies'>): string {
  if (app.society_id == null) return 'Independent';
  return app.societies?.name?.trim() || 'Delegation';
}

/** When the application was accepted; the submission time for rows that
 *  predate the stamp. */
export function acceptedAt(app: Pick<AcceptedApp, 'decided_at' | 'submitted_at'>): string | null {
  return app.decided_at || app.submitted_at || null;
}

export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function firstName(name: string): string {
  const clean = name.trim();
  if (!clean || clean.includes('@')) return clean;
  return clean.split(/\s+/)[0];
}

/** Seats (not countries): a double country is two seats. */
export function seatCounts(c: CommitteeData): { total: number; filled: number; open: number } {
  const byCountry = groupAllocationsByCountry(c.conference_allocations);
  let total = 0;
  let open = 0;
  for (const s of c.committee_country_slots) {
    total += s.delegation_size;
    open += Math.max(0, s.delegation_size - (byCountry.get(s.country_code)?.length ?? 0));
  }
  return { total, filled: total - open, open };
}

/** The person's first three committee choices: committee id → 1, 2 or 3. */
export function prefOrderByCommittee(app: Pick<AcceptedApp, 'application_preferences'> | null | undefined): Map<string, number> {
  const out = new Map<string, number>();
  if (!app) return out;
  const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order).slice(0, 3);
  prefs.forEach((p, i) => { if (!out.has(p.conference_committee_id)) out.set(p.conference_committee_id, i + 1); });
  return out;
}

export function ordinal(n: number): string {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}

/** The gold 1 / 2 / 3 on a committee ring or a country row. */
export function GoldMarker({ order, size = 20 }: { order: number; size?: number }) {
  return (
    <span
      aria-label={`${ordinal(order)} choice`}
      title={`${ordinal(order)} choice`}
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: 999,
        background: '#EED98A', color: '#1B3828',
        boxShadow: '0 0 0 2px #FFFFFF, 0 2px 6px rgba(182,135,31,0.35)',
        fontFamily: OUTFIT, fontSize: Math.round(size * 0.55), fontWeight: 700,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1,
      }}
    >
      {order}
    </span>
  );
}

/** A committee as a fill ring: logo inside, acronym and open seats beneath. */
export function CommitteeRing({ committee, size = 52, marker, lit }: {
  committee: CommitteeData;
  size?: number;
  /** The open person's 1st / 2nd / 3rd choice. */
  marker?: number;
  /** A drag is over it. */
  lit?: boolean;
}) {
  const { total, filled } = seatCounts(committee);
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const ring = Math.max(3, Math.round(size * 0.07));
  return (
    <span className="relative inline-flex flex-shrink-0" style={{ width: size, height: size }}>
      <span
        aria-hidden
        className="inline-flex items-center justify-center"
        style={{
          width: size, height: size, borderRadius: 999, padding: ring, boxSizing: 'border-box',
          background: `conic-gradient(${lit ? '#2A5039' : '#1B3828'} 0 ${pct}%, #E6DECB ${pct}% 100%)`,
        }}
      >
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: '100%', height: '100%', borderRadius: 999, boxSizing: 'border-box',
            background: lit ? '#FFFFFF' : '#F7F3EA', border: '2px solid #FFFFFF',
          }}
        >
          <CommitteeLogo committee={committee} size={Math.round(size * 0.56)} alt={committeeLabels(committee).big} />
        </span>
      </span>
      {marker ? (
        <span className="absolute" style={{ top: -4, right: -4 }}>
          <GoldMarker order={marker} size={Math.max(18, Math.round(size * 0.38))} />
        </span>
      ) : null}
    </span>
  );
}

export function BigCount({ n, word, size = 26 }: { n: number; word: string; size?: number }) {
  return (
    <span className="inline-flex items-baseline gap-1.5" style={{ fontFamily: OUTFIT }}>
      <span style={{ fontSize: size, fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{n}</span>
      <span style={{ fontSize: 13, color: NEU.inkSoft }}>{word}</span>
    </span>
  );
}
