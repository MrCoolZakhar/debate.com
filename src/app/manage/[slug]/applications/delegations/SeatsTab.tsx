'use client';

// The delegation pop-up's Seats tab (taste board 3A, one tap): how many paid
// spots have a seat, ONE suggested set of countries that fits the spots still
// needing one exactly, then every country with its free committees and
// "Give N", and a link to the allocation page for picking seats one by one.
//
// Seats are block seats: the delegation holds them until a leader places a
// person (seatWrites.ts). The free-seat rules are societySeats.ts.

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import type { DelegationMemberLite } from '../delegationRows';
import type { DelegationsData, DelegationView } from './useDelegationsData';
import { countrySeats, societyAllocations, suggestSeats, type FreeSlot } from './societySeats';
import { giveSocietySeats } from './seatWrites';
import type { DelegationPopupConference, PopupStep } from './DelegationPopup';
import {
  BTN_CLASS, CommitteeTag, FONT, FOREST, HAIRLINE, INK, INK_SOFT, LIFT_SHADOW, STROKE,
  linkStyle, plural, primaryBtn, smallSecondaryBtn,
} from './kit';

export default function SeatsTab<M extends DelegationMemberLite>({ conference, row, data, onStep }: {
  conference: DelegationPopupConference;
  row: DelegationView<M>;
  data: DelegationsData<M>;
  onStep: (step: PopupStep | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const countries = useMemo(() => (data.committees ? countrySeats(data.committees) : []), [data.committees]);
  const suggestion = useMemo(() => suggestSeats(countries, row.needSeats), [countries, row.needSeats]);

  const held = useMemo(() => {
    if (!data.committees) return [];
    const ids = new Set(row.members.map(m => m.id));
    const nameByApp = new Map(row.members.map(m => [m.id, m.profiles?.display_name || m.invited_name || m.invited_email || ''] as const));
    return societyAllocations(data.committees, row.id, ids)
      .map(({ committee, allocation }) => ({
        id: allocation.id,
        committee,
        countryCode: allocation.country_code,
        countryName: allocation.country_name || committee.committee_country_slots.find(s => s.country_code === allocation.country_code)?.country_name || allocation.country_code,
        person: allocation.application_id ? nameByApp.get(allocation.application_id) || 'A delegate' : null,
      }))
      .sort((a, b) => a.countryName.localeCompare(b.countryName) || a.committee.name.localeCompare(b.committee.name));
  }, [data.committees, row.id, row.members]);

  const visibleCountries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return countries
      .filter(c => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q)
      .sort((a, b) => b.free - a.free || a.name.localeCompare(b.name));
  }, [countries, query]);

  async function give(slots: FreeSlot[], what: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const r = await giveSocietySeats({ conferenceId: conference.id, societyId: row.id, slots });
    busyRef.current = false;
    setBusy(false);
    if (!r.ok) {
      notifyErr(r.error, 'applications');
    } else {
      notifyOk(`${plural(r.given, 'seat')}${what ? ` ${what}` : ''} given to ${row.name}.`, 'applications');
      onStep(null);
    }
    void data.reload();
  }

  const allocationHref = `/manage/${conference.slug}/assignment?mode=delegation-seats&society=${encodeURIComponent(row.id)}`;
  const progress = row.paid > 0 ? Math.min(100, Math.round((row.seatsGiven / row.paid) * 100)) : 0;

  function openSuggestionSeats() {
    onStep({
      title: `The ${plural(suggestion.total, 'seat')} in the suggestion`,
      body: (
        <div className="flex flex-col" style={{ gap: 14 }}>
          {suggestion.countries.map(c => (
            <div key={c.code} className="flex flex-col" style={{ gap: 8, padding: '12px 14px', borderRadius: 14, border: `1px solid ${HAIRLINE}` }}>
              <span className="flex items-center gap-2.5">
                <CircleFlag code={c.code} country={c.name} size={24} decorative />
                <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>{c.name}</span>
              </span>
              <div className="flex flex-wrap" style={{ gap: '6px 14px' }}>
                {c.slots.map(s => (
                  <span key={`${s.committeeId}:${s.countryCode}`} className="inline-flex items-center gap-1.5">
                    <CommitteeTag name={s.committeeName} abbreviation={s.abbreviation} logoUrl={s.logoUrl} size={18} fontSize={13} />
                    {s.size >= 2 && <span style={{ fontFamily: FONT, fontSize: 12, color: INK_SOFT }}>2 seats</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <button type="button" disabled={busy} className={BTN_CLASS}
            onClick={() => { void give(suggestion.countries.flatMap(c => c.slots), ''); }}
            style={{ ...primaryBtn, alignSelf: 'flex-start', opacity: busy ? 0.7 : 1 }}>
            Give these {suggestion.total} seats
          </button>
        </div>
      ),
    });
  }

  if (data.seatsUnavailable && !data.committees) {
    return <p style={{ padding: '24px 28px', fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>The committees could not be read just now. Close this and open it again.</p>;
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
      {/* Left: progress, the suggestion, what is held */}
      <div className="flex flex-col md:overflow-y-auto md:w-[400px] md:flex-none"
        style={{ padding: '26px 28px', gap: 22, background: '#FCFAF6', borderRight: `1px solid ${HAIRLINE}` }}>
        <div className="flex flex-col" style={{ gap: 10 }}>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span style={{ fontFamily: FONT, fontSize: 40, fontWeight: 600, letterSpacing: '-0.02em', color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{row.seatsGiven}</span>
            <span style={{ fontFamily: FONT, fontSize: 16, color: INK_SOFT }}>of {row.paid} paid {row.paid === 1 ? 'spot has' : 'spots have'} a seat</span>
          </div>
          <div aria-hidden style={{ height: 10, borderRadius: 99, background: '#EAE4D6', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: FOREST, borderRadius: 99 }} />
          </div>
        </div>

        {row.needSeats > 0 && suggestion.total > 0 && (
          <div className="flex flex-col" style={{ background: '#FFFFFF', borderRadius: 18, padding: 20, gap: 14, boxShadow: LIFT_SHADOW }}>
            <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: FOREST }}>Suggested</span>
            <div className="flex flex-col" style={{ gap: 10 }}>
              {suggestion.countries.map(c => (
                <div key={c.code} className="flex items-center gap-3">
                  <CircleFlag code={c.code} country={c.name} size={24} decorative />
                  <span className="flex-1 min-w-0 [overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: INK }}>{c.name}</span>
                  <span style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>{plural(c.n, 'seat')}</span>
                </div>
              ))}
            </div>
            <span style={{ fontFamily: FONT, fontSize: 14, color: '#3E352E' }}>
              {suggestion.exact
                ? `Exactly ${plural(suggestion.total, 'seat')}, every one free today`
                : `${plural(suggestion.total, 'free seat')} today, ${row.needSeats} still needed`}
            </span>
            <button type="button" disabled={busy} className={BTN_CLASS}
              onClick={() => { void give(suggestion.countries.flatMap(c => c.slots), ''); }}
              style={{ ...primaryBtn, width: '100%', opacity: busy ? 0.7 : 1 }}>
              Give these {suggestion.total} seats
            </button>
            <button type="button" onClick={openSuggestionSeats} className={BTN_CLASS} style={{ ...linkStyle, alignSelf: 'flex-start', fontSize: 13 }}>
              See which seats
            </button>
          </div>
        )}
        {row.needSeats > 0 && suggestion.total === 0 && (
          <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>No country has a free seat right now.</p>
        )}
        {row.needSeats === 0 && row.paid > 0 && (
          <p style={{ fontFamily: FONT, fontSize: 14, color: INK }}>Every paid spot has a seat.</p>
        )}
        {row.paid === 0 && (
          <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>No spots are paid for yet. You can still give seats below.</p>
        )}

        {held.length > 0 && (
          <div className="flex flex-col" style={{ gap: 8 }}>
            <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: INK }}>Seats given</span>
            {held.map(h => (
              <div key={h.id} className="flex items-center gap-2.5 flex-wrap" style={{ fontFamily: FONT, fontSize: 13 }}>
                <CircleFlag code={h.countryCode} country={h.countryName} size={18} decorative />
                <span className="[overflow-wrap:anywhere]" style={{ color: INK }}>{h.countryName}</span>
                <CommitteeTag name={h.committee.name} abbreviation={h.committee.abbreviation} logoUrl={h.committee.logo_url} size={18} fontSize={13} />
                <span className="[overflow-wrap:anywhere]" style={{ color: h.person ? INK : INK_SOFT }}>{h.person ?? 'Open'}</span>
              </div>
            ))}
          </div>
        )}

        <Link href={allocationHref} className={BTN_CLASS} style={{ ...linkStyle, fontSize: 14, marginTop: 'auto' }}>
          Pick seats one by one on the allocation page
        </Link>
      </div>

      {/* Right: every country with its free committees */}
      <div className="flex-1 min-w-0 flex flex-col" style={{ padding: '22px 28px', gap: 12 }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: INK }}>Or choose countries</span>
          <label className="flex items-center gap-2" style={{ height: 36, padding: '0 12px', borderRadius: 10, background: '#F6F2EA', color: INK_SOFT, width: 200 }}>
            <Search size={16} strokeWidth={STROKE} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search countries"
              aria-label="Search countries"
              className="flex-1 min-w-0 bg-transparent focus:outline-none"
              style={{ border: 'none', fontFamily: FONT, fontSize: 14, color: INK }}
            />
          </label>
        </div>
        <div className="flex flex-col md:flex-1 md:min-h-0 md:overflow-y-auto" style={{ gap: 10, paddingBottom: 4 }}>
          {countries.length === 0 && (
            <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>No committee has country seats yet. Add them in Committees.</p>
          )}
          {countries.length > 0 && visibleCountries.length === 0 && (
            <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>No country matches that search.</p>
          )}
          {visibleCountries.map(c => (
            <div key={c.code} className="flex items-center gap-3.5" style={{ padding: '12px 14px', borderRadius: 14, border: `1px solid ${HAIRLINE}` }}>
              <CircleFlag code={c.code} country={c.name} size={24} decorative />
              <div className="flex flex-col flex-1 min-w-0" style={{ gap: 5 }}>
                <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>{c.name}</span>
                <div className="flex flex-wrap" style={{ gap: '4px 10px' }}>
                  {c.committees.map(m => (
                    <CommitteeTag key={m.committeeId} name={m.name} abbreviation={m.abbreviation} logoUrl={m.logoUrl} size={18} fontSize={12} struck={!m.free} />
                  ))}
                </div>
              </div>
              {c.free > 0 ? (
                <button type="button" disabled={busy} className={BTN_CLASS}
                  onClick={() => { void give(c.freeSlots, `in ${c.name}`); }}
                  style={{ ...smallSecondaryBtn, opacity: busy ? 0.7 : 1 }}>
                  Give {c.free}
                </button>
              ) : (
                <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, whiteSpace: 'nowrap' }}>No free seats</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
