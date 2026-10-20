'use client';

// The delegation pop-up's Seats tab (taste board 3A, one tap): how many paid
// spots have a seat, ONE suggested set of countries that fits the spots still
// needing one exactly, then every country with its free committees and
// "Give N", and a link to the allocation page for picking seats one by one.
//
// Seats are block seats: the delegation holds them until a leader places a
// person (seatWrites.ts). The free-seat rules are societySeats.ts.
//
// Owner, 20 Oct 2026: "they should be able to add just one or two" and "there's
// no way to remove an allocation from the delegation":
//   * a country row opens to its free committees as toggles (emblem and
//     acronym); any subset is given with "Give N seats", "Give all" stays;
//   * "Seats given" lists every seat the delegation holds, A to Z by committee
//     (seatPeople.ts). An empty seat has "Take back" (assignment/
//     delegationSeatWrites takeBackSeats, the allocation page's own write: the
//     whole slot, both seats of a double); a seat with a person has "Take out"
//     first (seatWrites organiserTakeOutOfSeat), then it can be taken back.
//     Both are asked in place, shown at once, put back if refused.

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Search } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import type { DelegationMemberLite } from '../delegationRows';
import type { DelegationsData, DelegationView } from './useDelegationsData';
import { countrySeats, suggestSeats, type FreeSlot } from './societySeats';
import { giveSocietySeats, organiserTakeOutOfSeat } from './seatWrites';
import { heldSeats, seatWords, type HeldSeat } from './seatPeople';
import { takeBackSeats } from '@/app/manage/[slug]/assignment/delegationSeatWrites';
import InPlaceConfirm from '@/app/conferences/[slug]/participant/delegation/seat/InPlaceConfirm';
import { memberName } from '../delegationRows';
import type { DelegationPopupConference, PopupStep } from './DelegationPopup';
import {
  BTN_CLASS, CommitteeDisc, CommitteeTag, FONT, FOREST, HAIRLINE, INK, INK_SOFT, LIFT_SHADOW, STROKE,
  SeatMeter, linkStyle, plural, primaryBtn, smallPrimaryBtn, smallSecondaryBtn,
} from './kit';

interface Ask {
  anchor: HTMLElement;
  title: string;
  line: string | null;
  yes: string;
  onYes: () => void;
}

export default function SeatsTab<M extends DelegationMemberLite>({ conference, row, data, onStep, onChanged }: {
  conference: DelegationPopupConference;
  row: DelegationView<M>;
  data: DelegationsData<M>;
  onStep: (step: PopupStep | null) => void;
  /** A person was taken out of a seat: the caller re-reads the applications. */
  onChanged?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const countries = useMemo(() => (data.committees ? countrySeats(data.committees) : []), [data.committees]);
  const suggestion = useMemo(() => suggestSeats(countries, row.needSeats), [countries, row.needSeats]);

  // Every seat the delegation holds, A to Z by committee, with this tab's own
  // changes laid over the read until it lands: taken back (gone) or taken out (empty).
  const [gone, setGone] = useState<Set<string>>(() => new Set());
  const [emptied, setEmptied] = useState<Set<string>>(() => new Set());
  const [seatBusy, setSeatBusy] = useState<Set<string>>(() => new Set());
  const [ask, setAsk] = useState<Ask | null>(null);
  const closeAsk = useCallback(() => setAsk(null), []);
  const memberIds = useMemo(() => new Set(row.members.map(m => m.id)), [row.members]);
  const held = useMemo(() => heldSeats(data.committees, row.id, memberIds)
    .filter(h => !gone.has(h.allocationId))
    .map(h => (emptied.has(h.allocationId) ? { ...h, applicationId: null, filled: false } : h)), [data.committees, row.id, memberIds, gone, emptied]);
  const memberById = useMemo(() => new Map(row.members.map(m => [m.id, m] as const)), [row.members]);

  // Which free committees are ticked, per country (committee ids).
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<Map<string, Set<string>>>(() => new Map());

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
      setPicked(new Map());
    }
    void data.reload();
  }

  async function seatOp(h: HeldSeat, kind: 'back' | 'out') {
    // Taking back a double takes the whole slot: both of its seats leave the list.
    const keys = kind === 'back'
      ? held.filter(o => o.committeeId === h.committeeId && o.countryCode === h.countryCode && !o.filled).map(o => o.allocationId)
      : [h.allocationId];
    if (!keys.includes(h.allocationId)) keys.push(h.allocationId);
    const add = (prev: Set<string>) => { const next = new Set(prev); for (const k of keys) next.add(k); return next; };
    setSeatBusy(add);
    if (kind === 'back') setGone(add);
    else setEmptied(add);
    const person = h.applicationId ? memberById.get(h.applicationId) : undefined;
    const r = kind === 'back'
      ? await takeBackSeats({ societyId: row.id, allocationIds: [h.allocationId] })
      : person
        ? await organiserTakeOutOfSeat({
            conferenceId: conference.id, societyId: row.id,
            seat: { allocationId: h.allocationId, committeeId: h.committeeId, countryCode: h.countryCode, countryName: h.countryName },
            person: { id: person.id, user_id: person.user_id, status: person.status },
          })
        : { ok: false as const, error: 'That seat just changed. Close this and open it again.' };
    if (r.ok) {
      notifyOk(kind === 'back'
        ? `${seatWords(h)} is no longer held by ${row.name}.`
        : `${person ? memberName(person) : 'They'} ${person ? 'is' : 'are'} out of ${h.countryName}. The seat stays with ${row.name}.`, 'applications');
      if (kind === 'out') onChanged?.();
      try { await data.reload(); } catch { /* the next read corrects it */ }
    } else {
      notifyErr(r.error, 'applications');
    }
    const drop = (prev: Set<string>) => { const next = new Set(prev); for (const k of keys) next.delete(k); return next; };
    setGone(drop);
    setEmptied(drop);
    setSeatBusy(drop);
  }

  function askSeat(h: HeldSeat, kind: 'back' | 'out', anchor: HTMLElement) {
    const person = h.applicationId ? memberById.get(h.applicationId) : undefined;
    const double = kind === 'back' && held.some(o => o.allocationId !== h.allocationId && o.committeeId === h.committeeId && o.countryCode === h.countryCode);
    setAsk(kind === 'back'
      ? {
          anchor, title: `Take back ${seatWords(h)}?`,
          line: double ? 'Both seats of this double delegation go back, and it is free to give again.' : 'It is free to give again.',
          yes: 'Take back', onYes: () => { setAsk(null); void seatOp(h, 'back'); },
        }
      : {
          anchor, title: `Take ${person ? memberName(person) : 'them'} out of ${seatWords(h)}?`,
          line: 'The seat stays with the delegation as an open seat.',
          yes: 'Take out', onYes: () => { setAsk(null); void seatOp(h, 'out'); },
        });
  }

  function toggle(code: string, committeeId: string) {
    setPicked(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(code) ?? []);
      if (set.has(committeeId)) set.delete(committeeId); else set.add(committeeId);
      if (set.size === 0) next.delete(code); else next.set(code, set);
      return next;
    });
  }

  const allocationHref = `/manage/${conference.slug}/assignment?mode=delegation-seats&society=${encodeURIComponent(row.id)}`;

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
            <span style={{ fontFamily: FONT, fontSize: 16, color: INK_SOFT }}>of {row.paid} paid {row.paid === 1 ? 'ticket' : 'tickets'} {row.seatsGiven === 1 ? 'has' : 'have'} a seat</span>
          </div>
          <SeatMeter given={row.seatsGiven} filled={row.seatsFilled} paid={row.paid} height={10} />
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
          <p style={{ fontFamily: FONT, fontSize: 14, color: INK }}>Every paid ticket has a seat.</p>
        )}
        {row.paid === 0 && (
          <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>No tickets are paid for yet. You can still give seats.</p>
        )}

        {held.length > 0 && (
          <div className="flex flex-col" style={{ gap: 8 }}>
            <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK }}>Seats given</span>
            {held.map(h => {
              const person = h.applicationId ? memberById.get(h.applicationId) : undefined;
              const busyRow = seatBusy.has(h.allocationId);
              const other = h.filled && !person;
              return (
                <div key={h.allocationId} className="flex items-center gap-3"
                  style={{ padding: '10px 12px', borderRadius: 14, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(27,56,40,0.06)', opacity: busyRow ? 0.6 : 1 }}>
                  <CircleFlag code={h.countryCode} logoUrl={h.seat.seatLogo} label={h.countryName} size={36} decorative />
                  <div className="flex flex-col flex-1 min-w-0" style={{ gap: 3 }}>
                    <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK }}>{h.countryName}</span>
                    <span className="inline-flex items-center gap-1.5 flex-wrap" style={{ fontFamily: FONT, fontSize: 12.5, color: INK_SOFT }}>
                      <span className="inline-flex items-center gap-1.5" title={h.seat.committee_full ?? undefined}>
                        <CommitteeDisc src={h.seat.emblem} size={18} />
                        <span style={{ color: INK }}>{h.seat.committee_label}</span>
                      </span>
                      <span aria-hidden>·</span>
                      <span className="[overflow-wrap:anywhere]">{person ? memberName(person) : other ? 'Someone is in this seat' : 'Open'}</span>
                    </span>
                  </div>
                  {person ? (
                    <button type="button" disabled={busyRow} className={BTN_CLASS}
                      onClick={e => askSeat(h, 'out', e.currentTarget)}
                      style={{ ...smallSecondaryBtn, height: 34, padding: '0 12px', opacity: busyRow ? 0.6 : 1 }}>
                      Take out
                    </button>
                  ) : !other ? (
                    <button type="button" disabled={busyRow} className={BTN_CLASS}
                      onClick={e => askSeat(h, 'back', e.currentTarget)}
                      style={{ ...smallSecondaryBtn, height: 34, padding: '0 12px', opacity: busyRow ? 0.6 : 1 }}>
                      Take back
                    </button>
                  ) : null}
                </div>
              );
            })}
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
          {visibleCountries.map(c => {
            const expanded = open === c.code;
            const ticks = picked.get(c.code) ?? new Set<string>();
            const chosen = c.freeSlots.filter(f => ticks.has(f.committeeId));
            const chosenSeats = chosen.reduce((n, f) => n + f.size, 0);
            return (
              <div key={c.code} className="flex flex-col" style={{ borderRadius: 14, border: `1px solid ${expanded ? 'rgba(27,56,40,0.22)' : HAIRLINE}`, background: '#FFFFFF' }}>
                <div className="flex items-center gap-3.5" style={{ padding: '12px 14px' }}>
                  <button type="button" onClick={() => setOpen(expanded ? null : c.code)} aria-expanded={expanded}
                    disabled={c.free === 0}
                    className={`${BTN_CLASS} flex items-center gap-3.5 flex-1 min-w-0 text-left rounded-lg`}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: c.free > 0 ? 'pointer' : 'default' }}>
                    <CircleFlag code={c.code} country={c.name} size={28} decorative />
                    <div className="flex flex-col flex-1 min-w-0" style={{ gap: 5 }}>
                      <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>{c.name}</span>
                      {!expanded && (
                        <div className="flex flex-wrap" style={{ gap: '4px 10px' }}>
                          {c.committees.map(m => (
                            <CommitteeTag key={m.committeeId} name={m.name} abbreviation={m.abbreviation} logoUrl={m.logoUrl} size={18} fontSize={12} struck={!m.free} />
                          ))}
                        </div>
                      )}
                    </div>
                    {c.free > 0 && (
                      <ChevronDown size={18} strokeWidth={STROKE} aria-hidden
                        style={{ color: INK_SOFT, flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease' }} />
                    )}
                  </button>
                  {c.free > 0 ? (
                    <button type="button" disabled={busy} className={BTN_CLASS}
                      onClick={() => { void give(c.freeSlots, `in ${c.name}`); }}
                      style={{ ...smallSecondaryBtn, opacity: busy ? 0.7 : 1 }}>
                      Give all
                    </button>
                  ) : (
                    <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT, whiteSpace: 'nowrap' }}>No free seats</span>
                  )}
                </div>
                {expanded && c.free > 0 && (
                  <div className="flex flex-col" style={{ padding: '2px 14px 14px 56px', gap: 12 }}>
                    <div className="flex flex-wrap" style={{ gap: 8 }}>
                      {c.committees.map(m => {
                        const on = ticks.has(m.committeeId);
                        if (!m.free) {
                          return (
                            <span key={m.committeeId} className="inline-flex items-center gap-2" title={`${m.name} is taken`}
                              style={{ height: 40, padding: '0 12px', borderRadius: 10, border: `1px dashed ${HAIRLINE}`, opacity: 0.55 }}>
                              <CommitteeTag name={m.name} abbreviation={m.abbreviation} logoUrl={m.logoUrl} size={22} fontSize={13} struck />
                            </span>
                          );
                        }
                        return (
                          <button key={m.committeeId} type="button" role="switch" aria-checked={on} title={m.name}
                            onClick={() => toggle(c.code, m.committeeId)}
                            className={`${BTN_CLASS} inline-flex items-center gap-2`}
                            style={{
                              height: 40, padding: '0 12px', borderRadius: 10, cursor: 'pointer',
                              border: `1.5px solid ${on ? FOREST : 'rgba(27,56,40,0.16)'}`, background: on ? '#F3F7F4' : '#FFFFFF',
                            }}>
                            <span aria-hidden className="inline-flex items-center justify-center flex-shrink-0"
                              style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${on ? FOREST : 'rgba(27,56,40,0.35)'}`, background: on ? FOREST : '#FFFFFF' }}>
                              {on && <Check size={12} strokeWidth={2} color="#FFFFFF" aria-hidden />}
                            </span>
                            <CommitteeTag name={m.name} abbreviation={m.abbreviation} logoUrl={m.logoUrl} size={22} fontSize={13} />
                            {m.size >= 2 && <span style={{ fontFamily: FONT, fontSize: 12, color: INK_SOFT }}>2 seats</span>}
                          </button>
                        );
                      })}
                    </div>
                    <button type="button" disabled={busy || chosenSeats === 0} className={BTN_CLASS}
                      onClick={() => { void give(chosen, `in ${c.name}`); }}
                      style={{ ...smallPrimaryBtn, height: 38, alignSelf: 'flex-start', opacity: busy || chosenSeats === 0 ? 0.5 : 1, cursor: chosenSeats === 0 ? 'default' : 'pointer' }}>
                      {chosenSeats === 0 ? 'Choose committees' : `Give ${plural(chosenSeats, 'seat')}`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {ask && (
        <InPlaceConfirm anchor={ask.anchor} align="end" title={ask.title} line={ask.line} yes={ask.yes} danger onYes={ask.onYes} onCancel={closeAsk} />
      )}
    </div>
  );
}
