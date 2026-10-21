'use client';

// The delegation pop-up's Allocations tab.
//
// Owner, 21 Oct 2026: "the organiser allocation in the Delegations tab should
// show all possible countries, not only those free in all committees; search
// first; show which committees each country is available in; add and remove
// simply."
//
//   * Left: how many allocations the delegation holds (big number + word), the
//     conference's seat limit when it has one (readDelegationSettings), and every
//     allocation it holds as a compact list (flag + country, committee emblem +
//     acronym, the person or "Open allocation"), with Take back on an empty one.
//   * Right: "Search countries" first (focused on open), then EVERY country that
//     is a delegate slot in any committee, A to Z, filtered by name or code with
//     accents ignored (societySeats.countryMatrix). Each country shows one chip
//     per committee seat, A to Z by acronym (a double is Seat 1 and Seat 2):
//       free    one tap gives that one seat (organiser_give_society_seats with
//               that single seat), optimistic then verified;
//       mine    a check; an empty one asks in place "Take back X in Y?"
//               (organiser_take_back_society_seat); one with a person shows
//               their name and offers no take back (People tab: Unallocate);
//       taken   greyed, the hover title says by whom, not pressable.
//     "Give in all free committees" on a country with 2+ free seats.
//
// Every write runs through data.trackWrite (the 10 s live re-read stands down
// and a read that started before the write is dropped) and re-reads inside it;
// an open confirm holds the re-read back (data.holdLive). A refusal shows the
// server's sentence and the chip goes back.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import type { DelegationMemberLite } from '../delegationRows';
import { memberName } from '../delegationRows';
import type { DelegationsData, DelegationView } from './useDelegationsData';
import { countryMatrix, foldForSearch, type CountryRow, type SeatChip } from './societySeats';
import { giveExactSeats, takeBackOneSeat } from './seatWrites';
import { readDelegationSettings, type SeatLimit } from './v2';
import InPlaceConfirm from '@/app/conferences/[slug]/participant/delegation/seat/InPlaceConfirm';
import type { DelegationPopupConference, PopupStep } from './DelegationPopup';
import {
  BTN_CLASS, CommitteeDisc, FONT, FOREST, HAIRLINE, INK, INK_SOFT, STROKE,
  committeeEmblemSrc, committeeShort, plural, smallSecondaryBtn,
} from './kit';

interface Ask {
  anchor: HTMLElement;
  chip: SeatChip;
}

type Pending = 'give' | 'back';

function seatLabel(c: SeatChip): string {
  return `${c.countryName} in ${c.committeeLabel}${c.slotSize > 1 ? `, seat ${c.seat}` : ''}`;
}

export default function SeatsTab<M extends DelegationMemberLite>({ conference, row, data }: {
  conference: DelegationPopupConference;
  row: DelegationView<M>;
  data: DelegationsData<M>;
  onStep?: (step: PopupStep | null) => void;
  onChanged?: () => void;
}) {
  const { trackWrite, holdLive, reload, committees } = data;
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Map<string, Pending>>(() => new Map());
  const [ask, setAsk] = useState<Ask | null>(null);
  const closeAsk = useCallback(() => setAsk(null), []);
  const [limit, setLimit] = useState<SeatLimit>('none');

  // Search first: focused when the tab opens, on a laptop only (a phone would
  // throw its keyboard over the list).
  useEffect(() => {
    try {
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) searchRef.current?.focus({ preventScroll: true });
    } catch { /* focus is a nicety */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void readDelegationSettings(conference.id).then(s => { if (!cancelled && s) setLimit(s.limit); });
    return () => { cancelled = true; };
  }, [conference.id]);

  // An open confirm holds the live re-read back.
  useEffect(() => { holdLive('seats-tab', !!ask); }, [holdLive, ask]);
  useEffect(() => () => holdLive('seats-tab', false), [holdLive]);

  const memberIds = useMemo(() => new Set(row.members.map(m => m.id)), [row.members]);
  const memberById = useMemo(() => new Map(row.members.map(m => [m.id, m] as const)), [row.members]);

  // Who holds a seat that is not this delegation's: a delegation's name, else an individual.
  const holderOf = useMemo(() => {
    const societyName = new Map<string, string>();
    const appSociety = new Map<string, string>();
    for (const r of data.rows) {
      societyName.set(r.id, r.name);
      for (const m of r.members) appSociety.set(m.id, r.name);
    }
    return (c: SeatChip): string => {
      if (c.holderSocietyId && societyName.has(c.holderSocietyId)) return societyName.get(c.holderSocietyId)!;
      if (c.applicationId && appSociety.has(c.applicationId)) return appSociety.get(c.applicationId)!;
      if (c.holderSocietyId) return 'another delegation';
      return 'an individual delegate';
    };
  }, [data.rows]);

  // Every country with its seats, this tab's own writes laid over the read until they land.
  const countries = useMemo<CountryRow[]>(() => {
    if (!committees) return [];
    const base = countryMatrix(committees, row.id, memberIds, committeeShort);
    if (pending.size === 0) return base;
    return base.map(r => ({
      ...r,
      chips: r.chips.map(c => {
        const p = pending.get(c.key);
        if (p === 'give') return { ...c, state: 'mine' as const, block: true, filled: false, applicationId: null };
        if (p === 'back') return { ...c, state: 'free' as const, block: false, filled: false, allocationId: null, applicationId: null };
        return c;
      }),
    }));
  }, [committees, row.id, memberIds, pending]);

  const visible = useMemo(() => {
    const q = foldForSearch(query);
    if (!q) return countries;
    return countries.filter(c => foldForSearch(c.name).includes(q) || c.code.toLowerCase().includes(q));
  }, [countries, query]);

  const held = useMemo(() => countries
    .flatMap(c => c.chips.filter(ch => ch.state === 'mine'))
    .sort((a, b) => a.committeeLabel.localeCompare(b.committeeLabel, undefined, { sensitivity: 'base' })
      || a.countryName.localeCompare(b.countryName, undefined, { sensitivity: 'base' })
      || a.seat - b.seat), [countries]);

  const mark = (keys: string[], p: Pending | null) => setPending(prev => {
    const next = new Map(prev);
    for (const k of keys) { if (p) next.set(k, p); else next.delete(k); }
    return next;
  });

  async function give(chips: SeatChip[]) {
    const free = chips.filter(c => c.state === 'free' && !pending.has(c.key));
    if (free.length === 0) return;
    const keys = free.map(c => c.key);
    mark(keys, 'give');
    const r = await trackWrite(async () => {
      const res = await giveExactSeats(row.id, free.map(c => ({ conference_committee_id: c.committeeId, country_code: c.countryCode, seat: c.seat })));
      if (res.ok) { try { await reload(); } catch { /* the next read corrects it */ } }
      return res;
    });
    mark(keys, null);
    if (!r.ok) notifyErr(r.error, 'applications');
    else if (free.length > 1) notifyOk(`${plural(free.length, 'allocation')} in ${free[0].countryName} given to ${row.name}`, 'applications');
  }

  async function takeBack(chip: SeatChip) {
    const id = chip.allocationId;
    if (!id) return;
    mark([chip.key], 'back');
    const r = await trackWrite(async () => {
      const res = await takeBackOneSeat(id);
      if (res.ok) { try { await reload(); } catch { /* the next read corrects it */ } }
      return res;
    });
    mark([chip.key], null);
    if (!r.ok) notifyErr(r.error, 'applications');
  }

  const canTakeBack = (c: SeatChip) => c.state === 'mine' && c.block && !c.filled && !!c.allocationId && !pending.has(c.key);

  function askBack(chip: SeatChip, anchor: HTMLElement) {
    if (!canTakeBack(chip)) return;
    setAsk({ anchor, chip });
  }

  if (data.seatsUnavailable && !committees) {
    return <p style={{ padding: '24px 28px', fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>The committees could not be read just now. Close this and open it again.</p>;
  }

  const given = held.length;
  const cap = limit === 'paid' ? row.paid : limit === 'expected' ? row.expected : null;
  const limitLine = limit === 'none'
    ? null
    : cap == null
      ? 'Limit: their expected size'
      : `Limit ${cap}, ${limit === 'paid' ? 'the tickets paid for' : 'their expected size'}. ${Math.max(0, cap - given) === 0 ? 'No more can be given.' : `${Math.max(0, cap - given)} more can be given.`}`;

  return (
    <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
      {/* Left: what the delegation holds */}
      <div className="flex flex-col md:overflow-y-auto md:w-[360px] md:flex-none"
        style={{ padding: '24px 24px', gap: 18, background: '#FCFAF6', borderRight: `1px solid ${HAIRLINE}` }}>
        <div className="flex flex-col" style={{ gap: 6 }}>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span style={{ fontFamily: FONT, fontSize: 40, fontWeight: 600, letterSpacing: '-0.02em', color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{given}</span>
            <span style={{ fontFamily: FONT, fontSize: 16, color: INK_SOFT }}>{given === 1 ? 'allocation given' : 'allocations given'}</span>
          </div>
          {limitLine && <span style={{ fontFamily: FONT, fontSize: 13.5, color: INK_SOFT, lineHeight: 1.45 }}>{limitLine}</span>}
        </div>

        {held.length === 0 ? (
          <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, lineHeight: 1.5 }}>None yet. Search a country and tap a committee to give it.</p>
        ) : (
          <div className="flex flex-col" style={{ gap: 6 }}>
            {held.map(h => {
              const person = h.applicationId ? memberById.get(h.applicationId) : undefined;
              const busy = pending.has(h.key);
              const who = person ? memberName(person) : h.filled ? 'Someone is in this allocation' : 'Open allocation';
              return (
                <div key={h.key} className="flex items-center gap-3"
                  style={{ padding: '8px 10px', borderRadius: 12, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(27,56,40,0.06)', opacity: busy ? 0.6 : 1 }}>
                  <CircleFlag code={h.countryCode} country={h.countryName} size={28} decorative />
                  <div className="flex flex-col flex-1 min-w-0" style={{ gap: 2 }}>
                    <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK }}>{h.countryName}</span>
                    <span className="inline-flex items-center gap-1.5 flex-wrap" style={{ fontFamily: FONT, fontSize: 12.5, color: INK_SOFT }}>
                      <span className="inline-flex items-center gap-1.5" title={h.committeeName}>
                        <CommitteeDisc src={committeeEmblemSrc(h.logoUrl, h.committeeName, h.abbreviation)} size={16} />
                        <span style={{ color: INK }}>{h.committeeLabel}{h.slotSize > 1 ? `, seat ${h.seat}` : ''}</span>
                      </span>
                      <span aria-hidden>·</span>
                      <span className="[overflow-wrap:anywhere]" style={{ color: person ? INK : INK_SOFT }}>{who}</span>
                    </span>
                  </div>
                  {canTakeBack(h) && (
                    <button type="button" className={BTN_CLASS} onClick={e => askBack(h, e.currentTarget)}
                      style={{ ...smallSecondaryBtn, height: 32, padding: '0 10px' }}>
                      Take back
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: search first, then every country */}
      <div className="flex-1 min-w-0 flex flex-col" style={{ padding: '20px 24px', gap: 12 }}>
        <label className="flex items-center gap-2.5" style={{ height: 46, padding: '0 14px', borderRadius: 12, background: '#FFFFFF', border: '1px solid rgba(27,56,40,0.18)', color: INK_SOFT }}>
          <Search size={18} strokeWidth={STROKE} aria-hidden />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search countries"
            aria-label="Search countries"
            className="flex-1 min-w-0 bg-transparent focus:outline-none"
            style={{ border: 'none', fontFamily: FONT, fontSize: 15, color: INK }}
          />
        </label>
        <div className="flex flex-col md:flex-1 md:min-h-0 md:overflow-y-auto" style={{ gap: 8, paddingBottom: 4 }}>
          {countries.length === 0 && (
            <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>No committee has countries yet. Add them in Committees.</p>
          )}
          {countries.length > 0 && visible.length === 0 && (
            <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>No country matches that search.</p>
          )}
          {visible.map(c => {
            const free = c.chips.filter(ch => ch.state === 'free' && !pending.has(ch.key));
            return (
              <div key={c.code} className="flex flex-col" style={{ padding: '12px 14px', gap: 10, borderRadius: 14, border: `1px solid ${HAIRLINE}`, background: '#FFFFFF' }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <CircleFlag code={c.code} country={c.name} logoUrl={c.logoUrl} label={c.name} size={28} decorative />
                  <span className="flex-1 min-w-0 [overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>{c.name}</span>
                  {free.length >= 2 && (
                    <button type="button" className={BTN_CLASS} onClick={() => { void give(free); }}
                      style={{ ...smallSecondaryBtn, height: 32, padding: '0 10px' }}>
                      Give in all free committees
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap" style={{ gap: 6, paddingLeft: 40 }}>
                  {c.chips.map(ch => (
                    <Chip key={ch.key} chip={ch} busy={pending.has(ch.key)}
                      person={ch.applicationId ? memberById.get(ch.applicationId) : undefined}
                      holder={ch.state === 'taken' ? holderOf(ch) : null}
                      delegationName={row.name}
                      canTakeBack={canTakeBack(ch)}
                      onGive={() => { void give([ch]); }}
                      onAskBack={el => askBack(ch, el)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {ask && (
        <InPlaceConfirm anchor={ask.anchor} align="end"
          title={`Take back ${seatLabel(ask.chip)}?`}
          line="It is free to give again."
          yes="Take back" danger
          onYes={() => { const chip = ask.chip; setAsk(null); void takeBack(chip); }}
          onCancel={closeAsk} />
      )}
    </div>
  );
}

function Chip<M extends DelegationMemberLite>({ chip, busy, person, holder, delegationName, canTakeBack, onGive, onAskBack }: {
  chip: SeatChip;
  busy: boolean;
  person: M | undefined;
  holder: string | null;
  delegationName: string;
  canTakeBack: boolean;
  onGive: () => void;
  onAskBack: (anchor: HTMLElement) => void;
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '4px 10px', borderRadius: 10,
    fontFamily: FONT, fontSize: 13, color: INK, textAlign: 'left',
  };
  const tag = (
    <>
      <CommitteeDisc src={committeeEmblemSrc(chip.logoUrl, chip.committeeName, chip.abbreviation)} size={18} />
      <span className="[overflow-wrap:anywhere]">{chip.committeeLabel}</span>
      {chip.slotSize > 1 && <span style={{ fontSize: 12, color: INK_SOFT }}>Seat {chip.seat}</span>}
    </>
  );

  if (chip.state === 'taken') {
    return (
      <span title={`Taken by ${holder ?? 'someone else'}`}
        style={{ ...base, border: `1px dashed ${HAIRLINE}`, background: '#F6F2EA', opacity: 0.55 }}>
        {tag}
      </span>
    );
  }

  if (chip.state === 'free') {
    return (
      <button type="button" disabled={busy} onClick={onGive} className={`${BTN_CLASS} hover:bg-[#F6F2EA]`}
        title={`Give ${seatLabel(chip)} to ${delegationName}`}
        aria-label={`Give ${seatLabel(chip)} to ${delegationName}`}
        style={{ ...base, border: '1px solid rgba(27,56,40,0.18)', background: '#FFFFFF', cursor: busy ? 'progress' : 'pointer', opacity: busy ? 0.6 : 1 }}>
        <Plus size={14} strokeWidth={STROKE} aria-hidden style={{ color: INK_SOFT }} />
        {tag}
      </button>
    );
  }

  // This delegation's.
  const mineStyle: React.CSSProperties = { ...base, border: `1.5px solid ${FOREST}`, background: '#F3F7F4', opacity: busy ? 0.6 : 1 };
  const inner = (
    <>
      <Check size={14} strokeWidth={2} aria-hidden style={{ color: FOREST }} />
      {tag}
      {person && <span className="[overflow-wrap:anywhere]" style={{ fontSize: 12, color: INK_SOFT }}>· {memberName(person)}</span>}
      {!person && chip.filled && <span style={{ fontSize: 12, color: INK_SOFT }}>· Someone is in it</span>}
    </>
  );
  if (canTakeBack) {
    return (
      <button type="button" onClick={e => onAskBack(e.currentTarget)} className={BTN_CLASS}
        title={`Take back ${seatLabel(chip)}`} aria-label={`${seatLabel(chip)}, given to ${delegationName}. Take back`}
        style={{ ...mineStyle, cursor: 'pointer' }}>
        {inner}
      </button>
    );
  }
  return (
    <span title={person ? `${memberName(person)} is in this allocation` : `Given to ${delegationName}`} style={mineStyle}>
      {inner}
    </span>
  );
}
