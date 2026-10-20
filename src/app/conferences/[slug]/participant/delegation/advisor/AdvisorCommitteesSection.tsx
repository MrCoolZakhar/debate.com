'use client';

// The faculty advisor's Committees section on the You page (owner, 20 Oct
// 2026): only the committees the delegation sits in, most of its people first,
// then A to Z. Each committee is one white lifted card: the round logo, the
// acronym over the full name, the topics, a way to follow the live room once
// the organisers release codes to advisors, "Your People" (every member seated
// there and every open seat), and, only while DELEGATIONS_V2_DB, the whole
// committee list (my_committee_roster) with the delegation's own rows tinted.
// Two cards side by side from a wide content column, one column on a phone.
//
// An advisor with no delegation keeps the old all-committees card.

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Landmark, Radio } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { SkeletonBlock } from '@/components/Skeleton';
import { committeeDisplayName } from '@/lib/presetNames';
import { useNow } from '@/lib/useNow';
import CommitteesSessionsCard from '../../CommitteesSessionsCard';
import { effectiveReleaseTime, formatReleaseDate } from '../../shared';
import {
  BTN_CLASS, CommitteeDisc, FONT, FOREST, INK, INK_SOFT, RoundAvatar, STROKE, StatNumber,
  cardStyle, committeeEmblemSrc, linkStyle, primaryBtn,
} from '../leaderKit';
import { DELEGATIONS_V2_DB } from '../v2';
import { useCommitteeRoster } from '../committee/committeeRoster';
import { CardTitle, MINE_TINT, ROW_LINE, SOFT_PANEL, SmallLabel } from '../committee/youKit';
import { useAdvisorCommittees, type AdvisorCommittee, type AdvisorCommitteeSeat } from './useAdvisorCommittees';

const ROLE_LABEL: Record<string, string> = {
  delegate: 'Delegate',
  'head-delegate': 'Head delegate',
  'faculty-advisor': 'Faculty advisor',
};

export default function AdvisorCommitteesSection({ conferenceId, conferenceStartDate, societyId, onOpenDelegation }: {
  conferenceId: string;
  conferenceStartDate: string | null;
  societyId: string;
  /** Shows the Delegation section (seats are managed there). */
  onOpenDelegation: () => void;
}) {
  const now = useNow();
  const state = useAdvisorCommittees(conferenceId, societyId);

  if (state.kind === 'no-delegation') {
    return <CommitteesSessionsCard conferenceId={conferenceId} conferenceStartDate={conferenceStartDate} />;
  }

  if (state.kind === 'loading') {
    return (
      <div className="@container">
        <div className="grid grid-cols-1 @[900px]:grid-cols-2 gap-4 @[640px]:gap-6" aria-hidden>
          {[0, 1].map(i => (
            <div key={i} style={{ ...cardStyle, padding: 24 }} className="flex flex-col gap-4">
              <div className="flex items-center gap-3.5">
                <SkeletonBlock width={56} height={56} radius={28} />
                <div className="flex-1 flex flex-col gap-2">
                  <SkeletonBlock width="40%" height={18} />
                  <SkeletonBlock width="70%" height={12} />
                </div>
              </div>
              {[0, 1, 2].map(j => <SkeletonBlock key={j} height={44} radius={12} />)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div style={{ ...cardStyle, padding: 24 }} className="flex items-center gap-3" role="alert">
        <Landmark size={22} strokeWidth={STROKE} style={{ color: INK, flexShrink: 0 }} aria-hidden />
        <p style={{ fontFamily: FONT, fontSize: 15, color: INK_SOFT, margin: 0 }}>
          Your delegation&rsquo;s committees could not be read. Refresh the page to try again.
        </p>
      </div>
    );
  }

  if (state.committees.length === 0) {
    return (
      <div style={{ ...cardStyle, padding: 24 }} className="flex items-start gap-3">
        <Landmark size={22} strokeWidth={STROKE} style={{ color: INK, flexShrink: 0, marginTop: 1 }} aria-hidden />
        <div className="flex flex-col gap-2 min-w-0">
          <p style={{ fontFamily: FONT, fontSize: 15, color: INK, margin: 0 }}>
            Your delegation has no seats in a committee yet.
          </p>
          <button type="button" onClick={onOpenDelegation} className={BTN_CLASS} style={{ ...linkStyle, alignSelf: 'flex-start' }}>
            Go to Delegation
          </button>
        </div>
      </div>
    );
  }

  const releaseMs = effectiveReleaseTime(state.releaseAt, conferenceStartDate);
  const released = releaseMs !== null && releaseMs <= now;
  const count = state.committees.length;

  return (
    <div className="@container flex flex-col gap-4 @[640px]:gap-6">
      <StatNumber n={count} word={count === 1 ? 'committee with your delegation' : 'committees with your delegation'} />
      <div className="grid grid-cols-1 @[900px]:grid-cols-2 gap-4 @[640px]:gap-6 items-start">
        {state.committees.map(c => (
          <AdvisorCommitteeCard key={c.key} committee={c} released={released} releaseMs={releaseMs} />
        ))}
      </div>
    </div>
  );
}

// ── One committee ──────────────────────────────────────────────────────────

function AdvisorCommitteeCard({ committee: c, released, releaseMs }: {
  committee: AdvisorCommittee;
  released: boolean;
  releaseMs: number | null;
}) {
  const short = (c.abbreviation ?? '').trim() || committeeDisplayName(c.name, c.abbreviation);
  const showFull = c.name.trim() !== short.trim();
  // Two seats of one country (a double delegation) say which seat each is.
  const perCountry = new Map<string, number>();
  for (const s of c.seats) perCountry.set(s.countryName, (perCountry.get(s.countryName) ?? 0) + 1);

  return (
    <section style={cardStyle} className="flex flex-col gap-4 p-5 @[640px]:p-6 min-w-0" aria-label={c.name}>
      <div className="flex items-center gap-3.5">
        <CommitteeDisc src={committeeEmblemSrc(c.logoUrl, c.name, c.abbreviation)} size={56} />
        <div className="min-w-0 flex flex-col gap-0.5">
          <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 22, fontWeight: 600, color: INK, lineHeight: 1.15 }}>{short}</span>
          {showFull && (
            <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, lineHeight: 1.35 }}>{c.name}</span>
          )}
        </div>
      </div>

      {c.topics.length > 0 && (
        <div className="flex flex-col gap-2">
          <SmallLabel>{c.topics.length === 1 ? 'Topic' : 'Topics'}</SmallLabel>
          {c.topics.map((t, i) => (
            <div key={`${i}-${t}`} className="flex gap-2.5" style={{ fontFamily: FONT, fontSize: 14, lineHeight: 1.45, color: INK }}>
              <span style={{ fontWeight: 700, color: FOREST, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{i + 1}</span>
              <span className="min-w-0 [overflow-wrap:anywhere]">{t}</span>
            </div>
          ))}
        </div>
      )}

      {released && c.sessionCode ? (
        <Link
          href={`/advisor?add=${encodeURIComponent(c.sessionCode)}`}
          className={BTN_CLASS}
          style={{ ...primaryBtn, alignSelf: 'flex-start' }}
        >
          <Radio size={17} strokeWidth={STROKE} aria-hidden />
          Follow live
        </Link>
      ) : !released && releaseMs !== null ? (
        <div className="flex items-center gap-2.5" style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>
          <Radio size={17} strokeWidth={STROKE} style={{ color: INK, flexShrink: 0 }} aria-hidden />
          Live room opens on {formatReleaseDate(releaseMs)}
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5 pt-4" style={{ borderTop: ROW_LINE }}>
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <CardTitle>Your People</CardTitle>
          <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>
            <b style={{ color: INK, fontSize: 15, fontWeight: 600 }}>{c.people}</b> {c.people === 1 ? 'person' : 'people'}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {c.seats.map(s => (
            <SeatRow key={s.key} seat={s} showSeatNumber={(perCountry.get(s.countryName) ?? 0) > 1} />
          ))}
        </div>
      </div>

      {DELEGATIONS_V2_DB && c.id && <CommitteeList committeeId={c.id} />}
    </section>
  );
}

function SeatRow({ seat: s, showSeatNumber }: { seat: AdvisorCommitteeSeat; showSeatNumber: boolean }) {
  const country = (
    <span className="inline-flex items-center gap-1.5 min-w-0" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>
      <CircleFlag code={s.countryCode} country={s.countryName} size={18} decorative />
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {s.countryName}{showSeatNumber ? `, seat ${s.seat}` : ''}
      </span>
    </span>
  );

  if (!s.person) {
    return (
      <div
        className="flex items-center gap-3"
        style={{ padding: '10px 12px', borderRadius: 12, border: '1.5px dashed color-mix(in srgb, var(--gv-main) 22%, transparent)' }}
      >
        <CircleFlag code={s.countryCode} country={s.countryName} size={40} decorative />
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>Open seat</span>
          <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>
            {s.countryName}{showSeatNumber ? `, seat ${s.seat}` : ''}
          </span>
        </div>
      </div>
    );
  }

  const name = s.person.name ?? 'Name not added yet';
  const role = s.person.role ? ROLE_LABEL[s.person.role] ?? 'Delegate' : 'Delegate';
  return (
    <div className="flex items-center gap-3" style={{ padding: '10px 12px', borderRadius: 12, background: SOFT_PANEL }}>
      <RoundAvatar name={s.person.name ?? s.countryName} url={s.person.avatarUrl} size={40} seed={s.person.name ?? s.key} />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: s.person.name ? INK : INK_SOFT }}>{name}</span>
        {country}
      </div>
      <span className="text-right flex-shrink-0" style={{ fontFamily: FONT, fontSize: 12.5, color: INK_SOFT }}>{role}</span>
    </div>
  );
}

// ── The whole committee (my_committee_roster, DELEGATIONS_V2_DB only) ──────

function CommitteeList({ committeeId }: { committeeId: string }) {
  const [open, setOpen] = useState(false);
  const state = useCommitteeRoster(committeeId);
  const rows = state?.kind === 'ok'
    ? [...state.rows].sort((a, b) => a.country_name.localeCompare(b.country_name) || (a.seat ?? '').localeCompare(b.seat ?? ''))
    : [];

  return (
    <div className="flex flex-col gap-2 pt-4" style={{ borderTop: ROW_LINE }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className={`${BTN_CLASS} inline-flex items-center gap-2 rounded-lg`}
        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', alignSelf: 'flex-start', fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK }}
      >
        <ChevronDown size={16} strokeWidth={STROKE} aria-hidden style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 160ms ease' }} />
        {open ? 'Hide the committee list' : state?.kind === 'ok' ? `Show the committee list (${rows.length})` : 'Show the committee list'}
      </button>
      {open && (
        state === null ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map(i => <SkeletonBlock key={i} height={36} radius={10} />)}
          </div>
        ) : state.kind === 'error' ? (
          <p role="alert" style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: 0 }}>
            The committee list could not be read. Refresh the page to try again.
          </p>
        ) : rows.length === 0 ? (
          <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: 0 }}>No delegations in this committee yet.</p>
        ) : (
          <div className="flex flex-col">
            {rows.map((r, i) => (
              <div
                key={`${r.country_code ?? r.country_name}-${r.seat ?? ''}-${i}`}
                className="flex items-center gap-3"
                style={{ padding: '9px 10px', borderTop: i > 0 ? ROW_LINE : undefined, borderRadius: r.is_mine ? 10 : 0, background: r.is_mine ? MINE_TINT : 'transparent' }}
              >
                <CircleFlag code={r.country_code} country={r.country_name} size={26} decorative />
                <div className="flex-1 min-w-0 flex flex-col gap-px">
                  <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK }}>{r.country_name}</span>
                  <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 12.5, color: r.display_name ? '#3E352E' : INK_SOFT }}>
                    {r.display_name ?? 'Not filled yet'}
                  </span>
                </div>
                {r.society_name && (
                  <span className="text-right [overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 12, color: INK_SOFT, maxWidth: '40%' }}>{r.society_name}</span>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
