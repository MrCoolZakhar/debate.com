'use client';

// SpotlightPopup — booking a Gavelling Spotlight, one placement or a bundle.
//
// The panel is the purchase kit's (PurchaseShell). Four placement bookmarks
// hang OUTSIDE it on its left edge (the shell's `aside`); the selected one
// pops out and shows its name. Switching a bookmark changes the whole pop-up.
// LEFT sells the placement: where it shows, who sees it and the report, the
// expected visits from spotlight_reach (nothing numeric until `ready`), and
// the price read from spotlight_placements. RIGHT is the steps: dates (a
// calendar from spotlight_calendar, full days struck through, several ranges,
// up to 28 days, never before today or past the conference's last day), then
// the description (120 characters, the conference's own banner as preview).
// A total bar stays at the bottom: dates, days, credits (the server's rule,
// spotlightPrice) and the conference credits after.
//
// Bundle mode walks one step per placement ("Pick 7 days for Homepage"), then
// the description, then book_spotlight_bundle at the bundle price.
//
// Short on credits: useStoreBuy opens the credits pop-up for the difference
// and finishes the SAME booking once after payment.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Compass, Flag, Globe, Home, X } from 'lucide-react';
import { GoldWord } from '@/components/BrandHeading';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { notifyOk } from '@/lib/appNotify';
import { PurchaseShell, ErrorLine, GoldButton, Eyebrow, INK, INK_SOFT, FOREST, GOLD, IVORY } from '@/components/purchase/purchaseKit';
import {
  addDays, authedClient, credits as creditsWord, CONTINENT_LABELS, daysBetween, fmtDay, isoDay, PLACEMENTS,
  rangeDays, rpcCall, sortRanges, spotlightPrice, totalDays, useStoreBuy, weeksLabel,
  type BundleDef, type CalendarDay, type Placement, type PlacementPrice, type Range, type Reach, type StoreAnswer,
} from './storeApi';
import { OUTFIT } from '@/components/neu';

const MAX_DAYS = 28;
const DESC_MAX = 120;
/** The database's own sentence for a link, an email or profanity; the client checks links and emails first. */
const DESC_REFUSAL = 'Message is not valid. Description does not allow links or profanity.';

export interface SpotlightConference {
  id: string;
  full_name: string;
  acronym: string;
  banner_url: string | null;
  country: string;
  start_date: string | null;
  end_date: string | null;
  dates_tbd: boolean;
  is_public: boolean;
}

const ICONS: Record<Placement, typeof Home> = { homepage: Home, explore: Compass, region: Globe, country: Flag };
const NAMES: Record<Placement, string> = { homepage: 'Homepage', explore: 'Explore', region: 'Region', country: 'Country' };

function targetFor(p: Placement, conf: SpotlightConference, continent: string | null): string | null {
  if (p === 'region') return continent;
  if (p === 'country') return conf.country?.trim() || null;
  return '';
}

function sell(p: Placement, conf: SpotlightConference, continent: string | null): { tag: string; where: string; who: string } {
  const region = continent ? CONTINENT_LABELS[continent] ?? continent : 'your region';
  const country = conf.country?.trim() || 'your country';
  switch (p) {
    case 'homepage':
      return {
        tag: 'The first thing every visitor sees',
        where: 'Front and centre in the featured row on gavelling.com, the page every visitor lands on.',
        who: 'Delegates, advisors and chairs looking for their next conference, before they search for anything.',
      };
    case 'explore':
      return {
        tag: 'Where people go to pick a conference',
        where: 'The featured row at the top of Explore, plus the Conference Spotlight pop-up visitors see when they land there.',
        who: 'Everyone browsing conferences, at the moment they are choosing one.',
      };
    case 'region':
      return {
        tag: `First in ${region}`,
        where: `First when Explore is filtered to ${region}.`,
        who: `Delegates who already know they want a conference in ${region}.`,
      };
    default:
      return {
        tag: `First in ${country}`,
        where: `First at the top of Explore's ${country} filter.`,
        who: `Delegates who are looking for a conference in ${country}, the ones most likely to come.`,
      };
  }
}

// ── Calendar ───────────────────────────────────────────────────────────────

type DayState = 'ok' | 'full' | 'off' | 'mine';

function Calendar({
  month, onMonth, minDay, maxDay, fullDays, mineDays, loading, ranges, pending, onPick,
}: {
  month: string; // YYYY-MM-01
  onMonth: (next: string) => void;
  minDay: string; maxDay: string;
  fullDays: Set<string>;
  /** Days this conference already has this placement booked: "Yours". */
  mineDays: Set<string>;
  loading: boolean;
  ranges: Range[];
  pending: string | null;
  onPick: (day: string) => void;
}) {
  const first = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const prevMonth = isoDay(new Date(first.getFullYear(), first.getMonth() - 1, 1));
  const nextMonth = isoDay(new Date(first.getFullYear(), first.getMonth() + 1, 1));
  const canPrev = prevMonth.slice(0, 7) >= minDay.slice(0, 7);
  const canNext = nextMonth.slice(0, 7) <= maxDay.slice(0, 7);
  const inRange = (d: string) => ranges.some(r => d >= r.from && d <= r.to);
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => isoDay(new Date(first.getFullYear(), first.getMonth(), i + 1)))];

  return (
    <div className="gv-sp-cal" aria-busy={loading}>
      <div className="gv-sp-cal-head">
        <button type="button" className="gv-sp-cal-nav" onClick={() => onMonth(prevMonth)} disabled={!canPrev} aria-label="Previous month"><ChevronLeft size={18} /></button>
        <span>{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
        <button type="button" className="gv-sp-cal-nav" onClick={() => onMonth(nextMonth)} disabled={!canNext} aria-label="Next month"><ChevronRight size={18} /></button>
      </div>
      <div className="gv-sp-cal-grid" role="grid">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="gv-sp-cal-dow" aria-hidden>{d}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const state: DayState = d < minDay || d > maxDay ? 'off' : mineDays.has(d) ? 'mine' : fullDays.has(d) ? 'full' : 'ok';
          const sel = inRange(d);
          const isPending = pending === d;
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              className="gv-sp-day"
              data-state={state}
              data-sel={sel || undefined}
              data-pending={isPending || undefined}
              disabled={state !== 'ok'}
              aria-selected={sel}
              aria-label={`${fmtDay(d, true)}${state === 'mine' ? ', already yours' : state === 'full' ? ', taken' : sel ? ', chosen' : ''}`}
              title={state === 'mine' ? 'Yours: your conference already has this spotlight on this day' : undefined}
              onClick={() => onPick(d)}
            >
              {Number(d.slice(8, 10))}
              {state === 'mine' && <span className="gv-sp-day-mine" aria-hidden>Yours</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── The pop-up ─────────────────────────────────────────────────────────────

export interface SpotlightPopupProps {
  conference: SpotlightConference;
  continent: string | null;
  prices: Record<string, PlacementPrice>;
  conferenceCredits: number;
  yourCredits: number;
  /** Single mode opens on this placement; bundle mode on the bundle. */
  placement?: Placement;
  bundle?: BundleDef;
  onClose: () => void;
  onBooked: () => void;
}

export default function SpotlightPopup(props: SpotlightPopupProps) {
  const { conference, continent, prices, conferenceCredits, yourCredits, bundle, onClose, onBooked } = props;
  const today = isoDay(new Date());
  const lastDay = conference.end_date || conference.start_date || today;

  // Steps: one per placement (bundle) or one placement (single), then the description.
  const items = useMemo(() => bundle ? bundle.items : [{ placement: props.placement ?? 'homepage', days: 0 }], [bundle, props.placement]);
  const [stepIx, setStepIx] = useState(0);
  const [placementIx, setPlacementIx] = useState(0); // single mode: which bookmark
  const onDescription = stepIx >= items.length;
  const current = bundle ? items[Math.min(stepIx, items.length - 1)] : items[0];
  const placement: Placement = bundle ? current.placement : PLACEMENTS[placementIx];
  const price = prices[placement];

  const [ranges, setRanges] = useState<Record<string, Range[]>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [month, setMonth] = useState(today.slice(0, 7) + '-01');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState('');
  const [descErr, setDescErr] = useState('');
  const [extraFull, setExtraFull] = useState<Set<string>>(() => new Set());

  // ── 10-minute date holds (25 Sep 2026) ───────────────────────────────────
  // Moving on to Customise holds the chosen days with hold_spotlight_days,
  // ONE hold per placement (a single spotlight has one, a bundle one per
  // placement); the countdown shows the earliest expiry at the top right;
  // closing, going back to a dates step, switching placement or running out
  // releases every hold. book_spotlight takes the hold as p_hold,
  // book_spotlight_bundle takes all of them as p_holds.
  const [hold, setHold] = useState<{ byPlacement: Record<string, string>; expiresAt: number } | null>(null);
  const holdRef = useRef<Record<string, string>>({});
  holdRef.current = hold?.byPlacement ?? {};
  const [holdBusy, setHoldBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const releaseHolds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    void (async () => {
      try {
        const client = await authedClient();
        await Promise.all(ids.map(id => client.rpc('release_spotlight_hold', { p_hold: id })));
      } catch { /* a hold expires by itself in 10 minutes */ }
    })();
  }, []);
  const dropHold = useCallback(() => {
    releaseHolds(Object.values(holdRef.current));
    holdRef.current = {};
    setHold(null);
  }, [releaseHolds]);
  // Release on unmount (the pop-up closing any way at all).
  useEffect(() => () => { releaseHolds(Object.values(holdRef.current)); }, [releaseHolds]);
  // The countdown: one tick a second, only while a hold is live.
  useEffect(() => {
    if (!hold) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hold]);
  const holdLeftMs = hold ? Math.max(0, hold.expiresAt - nowMs) : 0;
  const holdExpired = !!hold && holdLeftMs <= 0;
  useEffect(() => {
    if (!holdExpired) return;
    const t = setTimeout(() => {
      dropHold();
      setStepIx(0);
      setErr('Your 10 minutes ran out, so the days were released. Pick them again.');
    }, 0);
    return () => clearTimeout(t);
  }, [holdExpired, dropHold]);
  const holdClock = `${String(Math.floor(holdLeftMs / 60000)).padStart(2, '0')}:${String(Math.floor((holdLeftMs % 60000) / 1000)).padStart(2, '0')}`;

  // Calendar and reach caches, keyed by placement (+ month for the calendar).
  const [calendar, setCalendar] = useState<Record<string, CalendarDay[]>>({});
  const [calLoading, setCalLoading] = useState(false);
  const [reach, setReach] = useState<Record<string, Reach>>({});
  const target = targetFor(placement, conference, continent);

  const calKey = `${placement}|${month}`;
  useEffect(() => {
    if (target === null || onDescription) return;
    if (calendar[calKey]) return;
    let cancelled = false;
    const from = month > today ? month : today;
    const monthEnd = isoDay(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));
    const to = monthEnd < lastDay ? monthEnd : lastDay;
    if (to < from) { setCalendar(c => ({ ...c, [calKey]: [] })); return; }
    setCalLoading(true);
    (async () => {
      try {
        const client = await authedClient();
        const { data } = await client.rpc('spotlight_calendar', {
          p_placement: placement, p_target: target, p_from: from, p_to: to,
          p_conf: conference.id, p_hold: holdRef.current[placement] ?? null,
        });
        if (cancelled) return;
        setCalendar(c => ({ ...c, [calKey]: Array.isArray(data) ? (data as CalendarDay[]) : [] }));
      } finally {
        if (!cancelled) setCalLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [calKey, placement, target, month, today, lastDay, calendar, onDescription, conference.id]);

  useEffect(() => {
    if (reach[placement]) return;
    let cancelled = false;
    (async () => {
      const client = await authedClient();
      const { data } = await client.rpc('spotlight_reach', { p_placement: placement });
      if (cancelled || !data) return;
      setReach(r => ({ ...r, [placement]: data as Reach }));
    })();
    return () => { cancelled = true; };
  }, [placement, reach]);

  const fullDays = useMemo(() => {
    const s = new Set<string>();
    for (const key of Object.keys(calendar)) {
      if (!key.startsWith(placement + '|')) continue;
      for (const row of calendar[key]) if (row.taken >= row.capacity) s.add(row.day.slice(0, 10));
    }
    for (const d of extraFull) if (d.startsWith(placement + '|')) s.add(d.slice(placement.length + 1));
    return s;
  }, [calendar, placement, extraFull]);
  const mineDays = useMemo(() => {
    const s = new Set<string>();
    for (const key of Object.keys(calendar)) {
      if (!key.startsWith(placement + '|')) continue;
      for (const row of calendar[key]) if (row.mine) s.add(row.day.slice(0, 10));
    }
    return s;
  }, [calendar, placement]);

  const chosen = useMemo(() => ranges[placement] ?? [], [ranges, placement]);
  const chosenDays = totalDays(chosen);
  const needDays = bundle ? current.days : 0;

  const pick = useCallback((day: string) => {
    setErr('');
    const inside = chosen.find(r => day >= r.from && day <= r.to);
    if (inside) {
      setRanges(rs => ({ ...rs, [placement]: chosen.filter(r => r !== inside) }));
      setPending(null);
      return;
    }
    if (!pending) { setPending(day); return; }
    const from = day < pending ? day : pending;
    const to = day < pending ? pending : day;
    // A stretch cannot cross a taken day or a day already chosen.
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (fullDays.has(d)) { setErr(`${fmtDay(d)} is taken, so that stretch does not fit. Pick around it.`); setPending(null); return; }
      if (chosen.some(r => d >= r.from && d <= r.to)) { setErr('That stretch overlaps days you already chose.'); setPending(null); return; }
    }
    const cap = bundle ? needDays : MAX_DAYS;
    if (chosenDays + daysBetween(from, to) + 1 > cap) {
      setErr(bundle ? `${NAMES[placement]} needs exactly ${needDays} days in this bundle.` : `One booking can cover up to ${MAX_DAYS} days.`);
      setPending(null);
      return;
    }
    setRanges(rs => ({ ...rs, [placement]: sortRanges([...chosen, { from, to }]) }));
    setPending(null);
  }, [chosen, pending, placement, fullDays, chosenDays, needDays, bundle]);

  const removeRange = (r: Range) => setRanges(rs => ({ ...rs, [placement]: chosen.filter(x => x !== r) }));

  // Price and totals
  const total = bundle
    ? bundle.price
    : spotlightPrice(price, chosenDays);
  const after = total === null ? null : conferenceCredits - total;
  const allChosen = bundle
    ? bundle.items.every(it => totalDays(ranges[it.placement] ?? []) === it.days)
    : chosenDays > 0;
  const stepReady = bundle ? (onDescription || chosenDays === needDays) : true;

  const summary = useMemo(() => {
    const list = bundle ? bundle.items.map(it => ({ p: it.placement, r: ranges[it.placement] ?? [] })) : [{ p: placement, r: chosen }];
    return list.filter(x => x.r.length > 0).map(x => {
      const first = x.r[0].from; const last = x.r[x.r.length - 1].to;
      return `${NAMES[x.p]} ${fmtDay(first)} to ${fmtDay(last)}`;
    });
  }, [bundle, ranges, placement, chosen]);
  const summaryDays = bundle ? bundle.items.reduce((n, it) => n + totalDays(ranges[it.placement] ?? []), 0) : chosenDays;

  // Booking
  const { busy, run, ownOffer, acceptOwn } = useStoreBuy(yourCredits);
  const bookedRef = useRef(false);

  const descProblem = (d: string): string => {
    const t = d.trim();
    if (t.length < 1) return 'Write a line about your conference first.';
    if (t.length > DESC_MAX) return `Keep it to ${DESC_MAX} characters.`;
    if (/https?:\/\/|www\.|@/i.test(t)) return DESC_REFUSAL;
    return '';
  };

  const book = () => {
    if (busy || bookedRef.current) return;
    const p = descProblem(description);
    if (p) { setDescErr(p); return; }
    setErr('');
    setDescErr('');
    const call = bundle
      ? rpcCall('book_spotlight_bundle', {
          p_conf: conference.id, p_kind: bundle.kind,
          p_items: bundle.items.map(it => ({ placement: it.placement, ranges: ranges[it.placement] ?? [] })),
          p_description: description.trim(),
          p_holds: Object.values(holdRef.current),
        })
      : rpcCall('book_spotlight', { p_conf: conference.id, p_placement: placement, p_ranges: chosen, p_description: description.trim(), p_hold: holdRef.current[placement] ?? null });
    run(call, {
      onDone: () => {
        bookedRef.current = true;
        // The booking removed its holds itself; nothing to release.
        holdRef.current = {};
        notifyOk(bundle ? `${bundle.name} booked. Your spotlights are on the way.` : `${NAMES[placement]} Spotlight booked for ${weeksLabel(chosenDays)}.`, 'store');
        onBooked();
        onClose();
      },
      onRefused: (message: string, a: StoreAnswer) => {
        if (a.field === 'description') { setDescErr(message); setStepIx(items.length); return; }
        if (Array.isArray(a.taken_days) && a.taken_days.length > 0) {
          // Mark them full for the placement whose step holds them and go there.
          const takenSet = new Set(a.taken_days.map(d => d.slice(0, 10)));
          const ix = bundle ? bundle.items.findIndex(it => (ranges[it.placement] ?? []).some(r => a.taken_days!.some(d => d >= r.from && d <= r.to))) : 0;
          const pl = bundle && ix >= 0 ? bundle.items[ix].placement : placement;
          setExtraFull(prev => { const n = new Set(prev); takenSet.forEach(d => n.add(`${pl}|${d}`)); return n; });
          setRanges(rs => ({ ...rs, [pl]: (rs[pl] ?? []).filter(r => !a.taken_days!.some(d => d >= r.from && d <= r.to)) }));
          setStepIx(Math.max(0, ix));
        }
        setErr(message);
      },
    });
  };

  /** Hold every placement's chosen days for 10 minutes (one hold per
   *  placement), then Customise. A refusal releases whatever was already
   *  held, marks the taken days on that placement's step and goes there. */
  const goCustomise = async () => {
    if (holdBusy) return;
    if (bundle && !allChosen) {
      // A bundle holds all of its placements at once: send them to the first
      // placement that still needs its days.
      const ix = bundle.items.findIndex(it => totalDays(ranges[it.placement] ?? []) !== it.days);
      setStepIx(Math.max(0, ix));
      if (ix >= 0) setErr(`${NAMES[bundle.items[ix].placement]} needs exactly ${bundle.items[ix].days} days in this bundle.`);
      return;
    }
    setHoldBusy(true);
    setErr('');
    const list: { p: Placement; r: Range[]; ix: number }[] = bundle
      ? bundle.items.map((it, ix) => ({ p: it.placement, r: ranges[it.placement] ?? [], ix }))
      : [{ p: placement, r: chosen, ix: 0 }];
    const got: Record<string, string> = {};
    let earliest = Infinity;
    try {
      const client = await authedClient();
      for (const item of list) {
        const { data, error } = await client.rpc('hold_spotlight_days', { p_conf: conference.id, p_placement: item.p, p_ranges: item.r });
        if (error) throw error;
        const a = (data ?? {}) as { ok?: boolean; hold_id?: string; expires_at?: string; message?: string; taken_days?: string[] };
        if (a.ok === true && a.hold_id && a.expires_at) {
          got[item.p] = a.hold_id;
          earliest = Math.min(earliest, new Date(a.expires_at).getTime());
          continue;
        }
        releaseHolds(Object.values(got));
        if (Array.isArray(a.taken_days) && a.taken_days.length > 0) {
          const takenSet = new Set(a.taken_days.map(d => d.slice(0, 10)));
          setExtraFull(prev => { const n = new Set(prev); takenSet.forEach(d => n.add(`${item.p}|${d}`)); return n; });
          setRanges(rs => ({ ...rs, [item.p]: (rs[item.p] ?? []).filter(rg => !a.taken_days!.some(d => d >= rg.from && d <= rg.to)) }));
        }
        if (bundle) setStepIx(item.ix);
        setErr(plainOrFallback(a.message, 'Those days could not be saved. Try again in a moment.'));
        return;
      }
      setNowMs(Date.now());
      setHold({ byPlacement: got, expiresAt: earliest });
      setStepIx(items.length);
      setPending(null);
    } catch (e) {
      releaseHolds(Object.values(got));
      setErr(friendlyError(e, 'Those days could not be saved. Try again in a moment.'));
    } finally {
      setHoldBusy(false);
    }
  };

  const r = reach[placement];
  const s = sell(placement, conference, continent);
  const needsTarget = target === null;
  const bookable = conference.is_public && !conference.dates_tbd && !!conference.start_date && lastDay >= today;

  const stepTitle = onDescription
    ? 'Customise your spotlight'
    : bundle ? `Pick ${needDays} days for ${NAMES[placement]}` : 'Pick your days';

  const bookmarks = (
    <div className="gv-sp-tabs" role="tablist" aria-label="Spotlight placements" aria-orientation="vertical">
      {(bundle ? bundle.items.map(it => it.placement) : PLACEMENTS).map((p) => {
        const Icon = ICONS[p];
        const active = p === placement;
        return (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={active}
            className="gv-sp-tab"
            data-active={active || undefined}
            onClick={() => {
              // Back to a dates step: every hold is let go.
              if (bundle) { dropHold(); setStepIx(bundle.items.findIndex(it => it.placement === p)); }
              else {
                if (p !== placement) dropHold();
                if (hold && p === placement) return;
                setPlacementIx(PLACEMENTS.indexOf(p)); setStepIx(0);
              }
              setPending(null); setErr('');
            }}
          >
            <span className="gv-sp-tab-icon" aria-hidden><Icon size={22} strokeWidth={2} fill="rgba(238,217,138,0.55)" /></span>
            <span className="gv-sp-tab-name">{NAMES[p]}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <PurchaseShell tone="light" label={bundle ? `Book the ${bundle.name} bundle` : `Book a ${NAMES[placement]} Spotlight`} onClose={onClose} panelClass="gv-sp" aside={bookmarks} testId="store-spotlight">
      <style>{SPOT_CSS}</style>
      {/* LEFT: the sell */}
      <div className="gv-buy-left gv-sp-left">
        <div className="gv-sp-tabs-row">{bookmarks}</div>
        <div>
          <h2 className="gv-buy-title" style={{ fontSize: 32 }}>
            {bundle ? <>{bundle.name} <GoldWord tone="light">Bundle</GoldWord></> : <>{NAMES[placement]} <GoldWord tone="light">Spotlight</GoldWord></>}
          </h2>
          <p className="gv-buy-sub">{bundle ? bundle.items.map(it => `${weeksLabel(it.days)} ${NAMES[it.placement]}`).join(', ') + (bundle.unlimitedEmails ? ', unlimited emails' : '') + (bundle.extraCredits ? `, ${bundle.extraCredits} extra credits` : '') : s.tag}</p>
        </div>
        <div>
          <Eyebrow>Where it shows</Eyebrow>
          <p className="gv-sp-p">{s.where}</p>
        </div>
        <div>
          <Eyebrow>Who sees it</Eyebrow>
          <p className="gv-sp-p">{s.who} You get a report of views and clicks, day by day, in your Store.</p>
        </div>
        <div>
          <Eyebrow>Expected visits</Eyebrow>
          {r?.ready && r.views_per_week !== null
            ? <p className="gv-sp-p"><b className="gv-sp-reach">{Math.round(r.views_per_week).toLocaleString('en-US')}</b> visits a week to this page, over the last 30 days</p>
            : <p className="gv-sp-p">Views are being counted. Your report will show yours.</p>}
        </div>
        <div className="gv-sp-price">
          {bundle ? (
            <>
              <span className="gv-sp-price-big">{bundle.price}</span>
              <span className="gv-sp-price-unit">credits{bundle.cancellable ? '' : ', cannot be cancelled'}</span>
            </>
          ) : (
            <>
              <span className="gv-sp-price-big">{price ? price.week_price : '…'}</span>
              <span className="gv-sp-price-unit">credits a week{price && price.day_price * 7 > price.week_price ? `, or ${price.day_price} a day` : ''}</span>
            </>
          )}
        </div>
      </div>

      {/* RIGHT: the steps and the total bar */}
      <div className="gv-buy-right gv-sp-right">
        <div className="gv-sp-steps">
          <div className="gv-sp-stepline" aria-label="Steps">
            {[...items.map((it, i) => ({ k: `p${i}`, label: bundle ? NAMES[it.placement] : 'Dates', done: bundle ? totalDays(ranges[it.placement] ?? []) === it.days : chosenDays > 0, ix: i })),
              { k: 'd', label: 'Customise', done: description.trim().length > 0, ix: items.length }].map(st => (
              <button key={st.k} type="button" className="gv-sp-step" data-active={st.ix === stepIx || undefined} data-done={st.done || undefined} onClick={() => {
                if (st.ix === stepIx) return;
                if (st.ix < items.length) dropHold();
                else if (!hold) { if (allChosen) void goCustomise(); return; }
                setStepIx(st.ix); setPending(null); setErr('');
              }}>
                <span className="gv-sp-step-dot">{st.done ? <Check size={12} strokeWidth={3} /> : st.ix + 1}</span>
                {st.label}
              </button>
            ))}
          </div>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <h3 className="gv-buy-rtitle">{stepTitle}</h3>
            {hold && onDescription && !holdExpired && (
              <span className="gv-sp-hold" role="timer" aria-live="off" aria-label={`Dates saved for ${holdClock}`}>
                Dates saved for <b>{holdClock}</b>
              </span>
            )}
          </div>

          {!bookable ? (
            <p className="gv-buy-note">Publish your conference with its dates before booking a spotlight.</p>
          ) : needsTarget && !onDescription ? (
            <p className="gv-buy-note">{placement === 'country' ? 'Add your conference’s country in Settings first.' : 'We could not match your conference’s country to a region yet.'}</p>
          ) : onDescription ? (
            <div className="gv-sp-desc">
              {conference.banner_url ? (
                <div className="gv-sp-banner" aria-label="Your conference banner, as it will show">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={conference.banner_url} alt="" />
                  <span className="gv-sp-banner-name">{conference.acronym || conference.full_name}</span>
                </div>
              ) : (
                <p className="gv-buy-note">Your spotlight uses your conference banner. Add one in Settings for a fuller card.</p>
              )}
              <label htmlFor="gv-sp-desc" className="gv-sp-label">A brief description of your conference</label>
              <textarea
                id="gv-sp-desc"
                className="gv-sp-textarea"
                value={description}
                maxLength={DESC_MAX + 20}
                rows={3}
                placeholder="Three days of debate in the heart of the city, for 400 delegates"
                onChange={(e) => { setDescription(e.target.value); setDescErr(''); }}
                onBlur={() => { const pr = descProblem(description); if (pr === DESC_REFUSAL) setDescErr(pr); }}
                aria-describedby="gv-sp-count"
                aria-invalid={!!descErr}
              />
              <p id="gv-sp-count" className="gv-sp-count" data-over={description.length > DESC_MAX || undefined}>{description.length} of {DESC_MAX}</p>
              {descErr ? <p role="alert" className="gv-sp-desc-err">{descErr}</p> : null}
            </div>
          ) : (
            <>
              <p className="gv-sp-hint">
                {pending ? `Now pick the last day (${fmtDay(pending)} again for one day)` : 'Pick the first day of a stretch, then the last. Add as many stretches as you like.'}
              </p>
              <Calendar
                month={month}
                onMonth={setMonth}
                minDay={today}
                maxDay={lastDay}
                fullDays={fullDays}
                mineDays={mineDays}
                loading={calLoading}
                ranges={chosen}
                pending={pending}
                onPick={pick}
              />
              {chosen.length > 0 && (
                <ul className="gv-sp-ranges" aria-label="Chosen days">
                  {chosen.map(rg => (
                    <li key={rg.from}>
                      <span>{rg.from === rg.to ? fmtDay(rg.from) : `${fmtDay(rg.from)} to ${fmtDay(rg.to)}`}, {rangeDays(rg)} {rangeDays(rg) === 1 ? 'day' : 'days'}</span>
                      <button type="button" aria-label={`Remove ${fmtDay(rg.from)} to ${fmtDay(rg.to)}`} onClick={() => removeRange(rg)}><X size={14} strokeWidth={2.6} /></button>
                    </li>
                  ))}
                </ul>
              )}
              {bundle && <p className="gv-sp-hint">{chosenDays} of {needDays} days chosen</p>}
            </>
          )}
          {err ? <ErrorLine>{err}</ErrorLine> : null}
          {ownOffer !== null && (
            <p className="gv-buy-note">
              The conference is short by {creditsWord(ownOffer)}. <button type="button" onClick={acceptOwn}>Use {ownOffer} of your own</button> and book now.
            </p>
          )}
        </div>

        {/* Total bar */}
        <div className="gv-sp-total">
          <div className="gv-sp-total-facts">
            <p className="gv-sp-total-dates">{summary.length > 0 ? summary.join(' · ') : 'No days chosen yet'}</p>
            <p className="gv-sp-total-meta">
              {summaryDays > 0 ? `${summaryDays} ${summaryDays === 1 ? 'day' : 'days'}` : ''}
              {after !== null && summaryDays > 0 ? ` · ${after >= 0 ? `${after} conference credits after` : `${-after} more credits needed`}` : ''}
            </p>
          </div>
          <div className="gv-sp-total-price" aria-live="polite">
            <span className="gv-sp-total-big">{total ?? '…'}</span>
            <span className="gv-sp-total-unit">credits</span>
          </div>
          {onDescription ? (
            <GoldButton onClick={book} busy={busy} busyText="Booking…" disabled={!bookable || !allChosen || descProblem(description) !== '' || !!descErr}>
              {`Book for ${total ?? '…'} credits`}
            </GoldButton>
          ) : (
            <GoldButton
              onClick={() => {
                if (stepIx + 1 >= items.length) { void goCustomise(); return; }
                setStepIx(stepIx + 1); setPending(null); setErr('');
              }}
              busy={holdBusy}
              busyText="Saving your dates…"
              disabled={!bookable || !stepReady || chosenDays === 0}
            >
              {stepIx + 1 < items.length ? `Next: ${NAMES[items[stepIx + 1].placement]}` : 'Next: customise'}
            </GoldButton>
          )}
        </div>
      </div>
    </PurchaseShell>
  );
}

const SPOT_CSS = `
.gv-buy-panel.gv-sp{max-width:980px}
.gv-buy-panel.gv-sp .gv-buy-gold{text-transform:none;letter-spacing:0.01em}
.gv-sp-left{gap:18px}
.gv-sp-right{padding-bottom:0!important;display:flex;flex-direction:column}
.gv-sp-steps{flex:1 1 auto;display:flex;flex-direction:column;gap:12px;padding-bottom:16px}
.gv-sp-p{margin:0;font-size:14px;line-height:1.55;color:${INK_SOFT}}
.gv-sp-reach{font-size:22px;font-weight:800;color:${INK};font-variant-numeric:tabular-nums}
.gv-sp-price{margin-top:auto;padding-top:16px;border-top:1px solid rgba(28,20,16,0.12);display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.gv-sp-price-big{font-size:46px;font-weight:800;letter-spacing:-0.03em;line-height:1;font-variant-numeric:tabular-nums;color:${FOREST}}
.gv-sp-price-unit{font-size:14px;font-weight:600;color:${INK_SOFT}}
/* Bookmarks OUTSIDE the panel, on its left edge (desktop); a row inside on phones */
/* Bookmarks ATTACHED to the panel's left edge (25 Sep 2026): the column is
   a fixed 132px wide and right-aligned, so every tab's right edge touches the
   panel; the selected tab grows LEFTWARD to show its name, never over it. */
.gv-sp-tabs{display:flex;flex-direction:column;align-items:flex-end;gap:6px;align-self:center;width:132px;flex:0 0 132px;margin-right:-1px;z-index:1}
.gv-sp-tab{display:flex;align-items:center;justify-content:flex-start;gap:8px;width:56px;height:56px;padding:0 17px 0 12px;border:none;border-radius:16px 0 0 16px;background:${IVORY};color:${FOREST};cursor:pointer;box-shadow:-6px 0 18px -12px rgba(0,0,0,0.5);font-family:${OUTFIT};font-size:12.5px;font-weight:800;letter-spacing:0.02em;transition:width 200ms cubic-bezier(0.2,0.8,0.2,1),background-color 140ms ease;overflow:hidden;white-space:nowrap;flex-direction:row-reverse}
.gv-sp-tab:hover{background:#FFFFFF}
.gv-sp-tab[data-active]{width:132px;background:#FFFFFF;color:${INK}}
.gv-sp-tab-icon{display:inline-flex;flex-shrink:0}
.gv-sp-tab-name{opacity:0;transition:opacity 160ms ease}
.gv-sp-tab[data-active] .gv-sp-tab-name{opacity:1}
.gv-sp-tab:focus{outline:none}
.gv-sp-tab:focus-visible{outline:2px solid ${FOREST};outline-offset:-3px}
.gv-sp-tabs-row{display:none}
/* Steps */
.gv-sp-stepline{display:flex;flex-wrap:wrap;gap:6px}
.gv-sp-step{display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:0 12px 0 6px;border-radius:999px;border:1px solid rgba(27,56,40,0.2);background:transparent;color:${INK_SOFT};font-family:${OUTFIT};font-size:12.5px;font-weight:700;cursor:pointer}
.gv-sp-step[data-active]{border-color:${FOREST};color:${INK};background:rgba(27,56,40,0.06)}
.gv-sp-step-dot{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:999px;background:rgba(27,56,40,0.1);color:${FOREST};font-size:11px;font-weight:800}
.gv-sp-step[data-done] .gv-sp-step-dot{background:${FOREST};color:${GOLD}}
.gv-sp-hint{margin:0;font-size:13px;line-height:1.5;color:${INK_SOFT}}
/* Calendar */
.gv-sp-cal{border-radius:16px;background:#FFFFFF;padding:12px;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 18px 40px -32px rgba(27,56,40,0.35)}
.gv-sp-cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-size:14px;font-weight:800;color:${INK}}
.gv-sp-cal-nav{width:34px;height:34px;border-radius:999px;border:1px solid rgba(27,56,40,0.2);background:transparent;color:${FOREST};display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.gv-sp-cal-nav:disabled{opacity:0.3;cursor:default}
.gv-sp-cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.gv-sp-cal-dow{text-align:center;font-size:11px;font-weight:800;color:${INK_SOFT};padding:4px 0}
.gv-sp-day{height:38px;border-radius:10px;border:none;background:transparent;font-family:${OUTFIT};font-size:14px;font-weight:700;color:${INK};cursor:pointer;font-variant-numeric:tabular-nums}
.gv-sp-day:hover:not(:disabled){background:rgba(27,56,40,0.08)}
.gv-sp-day[data-state="off"]{color:rgba(28,20,16,0.25);cursor:default}
.gv-sp-day{position:relative}
.gv-sp-day[data-state="mine"]{background:rgba(238,217,138,0.28);color:#6B4F12;cursor:not-allowed}
.gv-sp-day-mine{position:absolute;left:0;right:0;bottom:1px;font-size:8px;font-weight:800;letter-spacing:0.02em;line-height:1;color:#8A6414}
.gv-sp-hold{display:inline-flex;align-items:center;gap:4px;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(238,217,138,0.25);font-size:12.5px;font-weight:600;color:${INK};font-variant-numeric:tabular-nums;margin-right:40px}
.gv-sp-hold b{font-weight:800}
.gv-sp-desc-err{margin:0;font-size:13.5px;line-height:1.45;font-weight:600;color:#8B2020}
.gv-sp-day[data-state="full"]{color:rgba(28,20,16,0.4);text-decoration:line-through;cursor:not-allowed;background:repeating-linear-gradient(135deg,transparent 0 4px,rgba(28,20,16,0.06) 4px 6px)}
.gv-sp-day[data-sel]{background:${FOREST};color:${GOLD}}
.gv-sp-day[data-pending]{box-shadow:inset 0 0 0 2px ${FOREST}}
.gv-sp-day:focus{outline:none}
.gv-sp-day:focus-visible{box-shadow:0 0 0 2px #FFFFFF,0 0 0 4px ${FOREST}}
.gv-sp-ranges{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.gv-sp-ranges li{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px 8px 12px;border-radius:10px;background:${IVORY};font-size:13.5px;font-weight:600;color:${INK}}
.gv-sp-ranges button{width:28px;height:28px;border-radius:999px;border:none;background:transparent;color:${INK_SOFT};display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.gv-sp-ranges button:hover{background:rgba(27,56,40,0.1);color:${INK}}
/* Description */
.gv-sp-desc{display:flex;flex-direction:column;gap:8px}
.gv-sp-banner{position:relative;aspect-ratio:3/1;border-radius:14px;overflow:hidden;background:#14301F}
.gv-sp-banner img{width:100%;height:100%;object-fit:cover;display:block}
.gv-sp-banner-name{position:absolute;left:14px;bottom:10px;font-size:18px;font-weight:900;color:#FFFFFF;text-shadow:0 2px 12px rgba(0,0,0,0.5)}
.gv-sp-label{font-size:13px;font-weight:700;color:${INK};margin-top:4px}
.gv-sp-textarea{width:100%;border-radius:12px;border:1.5px solid rgba(27,56,40,0.28);background:#FFFFFF;padding:12px;font-family:${OUTFIT};font-size:16px;line-height:1.45;color:${INK};resize:vertical}
.gv-sp-textarea:focus{outline:none;border-color:${FOREST};box-shadow:0 0 0 3px #FFFFFF,0 0 0 6px ${FOREST}}
.gv-sp-count{margin:0;text-align:right;font-size:12px;font-weight:600;color:${INK_SOFT};font-variant-numeric:tabular-nums}
.gv-sp-count[data-over]{color:#9E2A12}
/* Total bar */
.gv-sp-total{position:sticky;bottom:0;margin:0 -36px;padding:14px 36px calc(16px + env(safe-area-inset-bottom));background:#FFFFFF;border-top:1px solid rgba(28,20,16,0.12);display:grid;grid-template-columns:1fr auto;grid-template-areas:"facts price" "btn btn";gap:10px 16px;align-items:center}
.gv-sp-total-facts{grid-area:facts;min-width:0}
.gv-sp-total-dates{margin:0;font-size:13.5px;font-weight:700;color:${INK};overflow-wrap:anywhere}
.gv-sp-total-meta{margin:2px 0 0;font-size:12.5px;color:${INK_SOFT}}
.gv-sp-total-price{grid-area:price;display:flex;align-items:baseline;gap:6px}
.gv-sp-total-big{font-size:30px;font-weight:800;letter-spacing:-0.02em;line-height:1;font-variant-numeric:tabular-nums;color:${FOREST}}
.gv-sp-total-unit{font-size:12.5px;font-weight:600;color:${INK_SOFT}}
.gv-sp-total .gv-buy-gold{grid-area:btn}
@media (max-width:859px){
  .gv-sp-tabs{display:none}
  .gv-sp-tabs-row{display:block}
  .gv-sp-tabs-row .gv-sp-tabs{display:flex;flex-direction:row;align-self:flex-start;margin:0;gap:6px}
  .gv-sp-tabs-row .gv-sp-tab{border-radius:14px;box-shadow:none;background:#FFFFFF}
  .gv-sp-tabs-row .gv-sp-tab[data-active]{background:${FOREST};color:${GOLD}}
  .gv-sp-price{margin-top:0}
  .gv-sp-total{margin:0 -20px;padding-left:20px;padding-right:20px}
}
`;
