'use client';

// PromotePopup — promote one Job Board listing for 7, 14 or 28 days, with
// the homepage as an extra. The Store pop-ups' layout: what it buys on the
// left, the choice and the total on the right.
//
// Prices are never typed here: every number comes from job_promote_quote
// (promoteQuote). A short answer is handed to the parent (onShort) with the
// SAME call ready to re-run with p_top_up true; the parent closes this
// pop-up before it opens the credits pop-up, so no pop-up sits on another.
//
// PromoteContent is the two columns without a shell, so the posting pop-up
// can show it inside its own PurchaseShell after "Publish and promote".

import { useEffect, useRef, useState } from 'react';
import { BarChart3, BellRing, Briefcase, Star } from 'lucide-react';
import {
  PurchaseShell, Eyebrow, BenefitList, ErrorLine, GoldButton, PURCHASE_CSS,
  FOREST, INK, INK_SOFT, IVORY, type Benefit,
} from '@/components/purchase/purchaseKit';
import { LIGHT_CHIP_CSS } from '../store/SponsorshipPopup';
import { promoteListing, promoteQuote, plural, dayLabel, type PromoteOption, type PromoteQuote, type Refusal } from './jobsApi';

type Days = 7 | 14 | 28;

export interface PromoteProps {
  listingId: string;
  listingTitle: string;
  conferenceCredits: number;
  onClose: () => void;
  onDone: (endsOn: string | null) => void;
  onShort: (req: { need: number; retry: () => Promise<{ ok: true } | Refusal> }) => void;
  /** Replaces the line under the title ("Your listing is live"). */
  heading?: string;
  /** Whose credits pay: the conference's (default) or the poster's own (a standalone listing on /jobs). */
  payer?: 'conference' | 'you';
}

const POINTS: Benefit[] = [
  { emoji: 'Glowing star', fallback: Star, title: 'First on the Job Board', note: 'In every filter it matches, with a gold edge and a Promoted tag', live: true },
  { emoji: 'Briefcase', fallback: Briefcase, title: 'The Hiring mark on Explore', note: 'Your conference card shows people you are hiring', live: true },
  { emoji: 'Bell', fallback: BellRing, title: 'First in job alert emails', note: 'Unlimited members see promoted listings at the top', live: true },
  { emoji: 'Chart increasing', fallback: BarChart3, title: 'Views and clicks, day by day', note: 'See what the promotion brings in', live: true },
];

// ── Dates, in the browser's own calendar ──────────────────────────────────

function isoOf(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoOf(new Date(y, m - 1, d + n));
}

/** A date-only value is kept as it is; a timestamp is read in local time. */
function localDay(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : isoOf(d);
}

function fullSentence(days: string[]): string {
  if (days.length === 1) return `The homepage is full on ${dayLabel(days[0])}`;
  return `The homepage is full on ${days.length} of these days`;
}

function activeEnd(active: unknown): string | null {
  if (!active || typeof active !== 'object') return null;
  const e = (active as { ends_on?: unknown }).ends_on;
  return typeof e === 'string' && e ? e : null;
}

export function PromoteContent({ listingId, listingTitle, conferenceCredits, onClose, onDone, onShort, heading, payer = 'conference' }: PromoteProps) {
  const [quote, setQuote] = useState<PromoteQuote | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [days, setDays] = useState<Days>(7);
  const [homepage, setHomepage] = useState(false);
  // A homepage_full refusal: the days it named, for the length it was asked for.
  const [refusedFull, setRefusedFull] = useState<{ days: Days; taken: string[] } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void promoteQuote(listingId).then((r) => {
      if (cancelled) return;
      if (r.ok) { setQuote(r); setLoadErr(''); } else { setLoadErr(r.message); }
    });
    return () => { cancelled = true; };
  }, [listingId, attempt]);

  const tryAgain = () => { setLoadErr(''); setQuote(null); setAttempt((n) => n + 1); };

  const options: PromoteOption[] = quote ? [...quote.options].sort((a, b) => a.days - b.days) : [];
  const opt = options.find((o) => o.days === days) ?? options[0] ?? null;
  const extra = quote ? Math.max(0, Number(quote.homepage_extra) || 0) : 0;
  const fullDays = opt
    ? (opt.homepage_full_days.length > 0 ? opt.homepage_full_days : (refusedFull && refusedFull.days === opt.days ? refusedFull.taken : []))
    : [];
  const homeBlocked = !!opt && (opt.homepage_full_days.length > 0 || (!!refusedFull && refusedFull.days === opt.days));
  const withHome = homepage && !homeBlocked;
  const total = opt ? opt.credits + (withHome ? extra : 0) : 0;
  const after = conferenceCredits - total;

  const today = isoOf(new Date());
  const closes = localDay(quote?.closes_at ?? null);
  const plannedEnd = opt ? addDays(today, opt.days - 1) : today;
  const closesFirst = !!closes && closes < plannedEnd;
  const endDay = closesFirst && closes ? closes : plannedEnd;
  const promotedUntil = activeEnd(quote?.active);

  const pick = (d: Days) => {
    setDays(d);
    setErr('');
    const o = options.find((x) => x.days === d);
    if (o && (o.homepage_full_days.length > 0 || (refusedFull && refusedFull.days === d))) setHomepage(false);
  };

  const promote = async () => {
    if (busyRef.current || !opt) return;
    busyRef.current = true;
    setBusy(true);
    setErr('');
    const chosen = opt.days;
    const home = withHome;
    try {
      const r = await promoteListing(listingId, chosen, home, false);
      if (r.ok) { onDone(r.ends_on ?? null); return; }
      if ((r.need_credits ?? 0) > 0 || r.code === 'short') {
        onShort({ need: Math.max(1, r.need_credits ?? 1), retry: () => promoteListing(listingId, chosen, home, true) });
        return;
      }
      if (r.code === 'homepage_full') {
        setRefusedFull({ days: chosen, taken: Array.isArray(r.taken_days) ? r.taken_days : [] });
        setHomepage(false);
        return;
      }
      setErr(r.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <div className="gv-buy-left">
        <div>
          <h2 className="gv-buy-title">Promote Your Listing</h2>
          <p className="gv-buy-sub">{heading ?? 'Shown first to everyone looking for a role'}</p>
        </div>
        <div className="gv-pr-listing">
          <Eyebrow>Listing</Eyebrow>
          <p className="gv-pr-listing-title">{listingTitle}</p>
          {promotedUntil ? <p className="gv-pr-listing-note">Promoted until {dayLabel(promotedUntil)}</p> : null}
        </div>
        <div>
          <Eyebrow>What you get</Eyebrow>
          <BenefitList items={POINTS} tone="light" />
        </div>
      </div>

      <div className="gv-buy-right">
        <h3 className="gv-buy-rtitle">How Long to Promote</h3>

        {!quote && !loadErr ? (
          <div aria-busy="true" aria-label="Reading prices">
            <div className="gv-buy-grid">
              {[0, 1, 2].map((i) => <span key={i} className="gv-pr-skel" style={{ height: 94 }} />)}
            </div>
            <span className="gv-pr-skel" style={{ height: 22, width: '70%', marginTop: 16 }} />
            <span className="gv-pr-skel" style={{ height: 110, marginTop: 16 }} />
          </div>
        ) : null}

        {loadErr ? (
          <>
            <ErrorLine>{loadErr}</ErrorLine>
            <div><button type="button" className="gv-buy-swapbtn" onClick={tryAgain}>Try again</button></div>
          </>
        ) : null}

        {quote && opt ? (
          <>
            <div className="gv-buy-grid" role="radiogroup" aria-label="How long to promote">
              {options.map((o) => (
                <button
                  key={o.days}
                  type="button"
                  role="radio"
                  aria-checked={o.days === opt.days}
                  className="gv-buy-chip gv-sp-chip-light"
                  onClick={() => pick(o.days)}
                >
                  <span className="gv-buy-chip-qty">{o.days}</span>
                  <span className="gv-buy-chip-unit">days</span>
                  <span className="gv-buy-chip-price">{plural(o.credits, 'credit')}</span>
                </button>
              ))}
            </div>

            <label className={`gv-pr-tick${homeBlocked ? ' gv-pr-tick-off' : ''}`}>
              <input
                type="checkbox"
                checked={withHome}
                disabled={homeBlocked}
                onChange={(e) => { setHomepage(e.target.checked); setErr(''); }}
              />
              <span>Also show it on the homepage (+{plural(extra, 'credit')})</span>
            </label>
            {homeBlocked && fullDays.length > 0 ? <p className="gv-pr-fine">{fullSentence(fullDays)}</p> : null}
            {homeBlocked && fullDays.length === 0 ? <p className="gv-pr-fine">The homepage is full on some of these days</p> : null}

            <div className="gv-pr-total" aria-live="polite">
              <div className="gv-pr-total-row">
                <div className="gv-pr-total-cell">
                  <Eyebrow>{plural(opt.days, 'day')}{withHome ? ', with the homepage' : ''}</Eyebrow>
                  <span className="gv-pr-total-dates">{dayLabel(today)} to {dayLabel(endDay)}</span>
                </div>
                <div className="gv-pr-total-cell gv-pr-total-end">
                  <Eyebrow>Total</Eyebrow>
                  <span className="gv-pr-total-big">{total}</span>
                  <span className="gv-pr-total-cap">{total === 1 ? 'credit' : 'credits'}</span>
                </div>
              </div>
              {closesFirst && closes ? (
                <p className="gv-pr-fine">Your listing closes on {dayLabel(closes)}, so the promotion stops then</p>
              ) : null}
              <p className="gv-pr-fine">
                {after >= 0
                  ? <>{payer === 'you' ? 'Your credits' : 'Conference credits'} after paying: <b>{after}</b></>
                  : payer === 'you'
                    ? <>You have {plural(conferenceCredits, 'credit')}, so you buy {plural(-after, 'more credit')} next</>
                    : <>The conference has {plural(conferenceCredits, 'credit')}, so you buy {plural(-after, 'more credit')} next</>}
              </p>
            </div>

            <p className="gv-pr-fine">Promotion starts today and can&rsquo;t be refunded</p>
            {err ? <ErrorLine>{err}</ErrorLine> : null}
            <div className="gv-pr-cta">
              <GoldButton onClick={() => { void promote(); }} busy={busy} busyText="Promoting…">
                {`Promote for ${plural(total, 'credit')}`}
              </GoldButton>
            </div>
            <div className="gv-pr-not-now">
              <button type="button" className="gv-buy-swapbtn" onClick={onClose}>Not now</button>
            </div>
          </>
        ) : null}

        {quote && !opt ? (
          <>
            <ErrorLine>This listing can&rsquo;t be promoted right now</ErrorLine>
            <div className="gv-pr-not-now">
              <button type="button" className="gv-buy-swapbtn" onClick={onClose}>Not now</button>
            </div>
          </>
        ) : null}
      </div>
      <style>{LIGHT_CHIP_CSS}{PROMOTE_CSS}</style>
    </>
  );
}

export default function PromotePopup(props: PromoteProps) {
  return (
    <PurchaseShell tone="light" label="Promote your listing" onClose={props.onClose} testId="job-promote" panelClass="gv-st-pop gv-pr-pop">
      <style>{PURCHASE_CSS}</style>
      <PromoteContent {...props} />
    </PurchaseShell>
  );
}

const PROMOTE_CSS = `
.gv-pr-cta .gv-buy-gold{text-transform:none;letter-spacing:0.01em}
.gv-pr-listing{padding:14px 16px;border-radius:14px;background:${IVORY};border:1px solid rgba(28,20,16,0.08)}
.gv-pr-listing .gv-buy-eyebrow{margin-bottom:6px}
.gv-pr-listing-title{margin:0;font-size:16px;font-weight:700;line-height:1.35;color:${INK};overflow-wrap:anywhere}
.gv-pr-listing-note{margin:4px 0 0;font-size:13px;color:${INK_SOFT}}
.gv-pr-tick{display:flex;align-items:center;gap:10px;min-height:44px;font-size:14.5px;font-weight:600;color:${INK};cursor:pointer}
.gv-pr-tick input{width:18px;height:18px;accent-color:${FOREST};cursor:pointer;flex-shrink:0}
.gv-pr-tick-off{color:${INK_SOFT};cursor:default}
.gv-pr-tick-off input{cursor:default}
.gv-pr-fine{margin:0;font-size:13px;line-height:1.5;color:${INK_SOFT}}
.gv-pr-fine b{color:${INK};font-weight:800;font-variant-numeric:tabular-nums}
.gv-pr-total{display:flex;flex-direction:column;gap:8px;padding:16px 18px;border-radius:16px;background:#FFFFFF;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 14px 30px -26px rgba(27,56,40,0.45)}
.gv-pr-total .gv-buy-eyebrow{margin-bottom:6px}
.gv-pr-total-row{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
.gv-pr-total-cell{display:flex;flex-direction:column;min-width:0}
.gv-pr-total-end{align-items:flex-end;text-align:right}
.gv-pr-total-dates{font-size:18px;font-weight:700;color:${INK};font-variant-numeric:tabular-nums}
.gv-pr-total-big{font-size:36px;font-weight:800;letter-spacing:-0.03em;line-height:1;color:${FOREST};font-variant-numeric:tabular-nums}
.gv-pr-total-cap{margin-top:3px;font-size:12.5px;font-weight:600;color:${INK_SOFT}}
.gv-pr-not-now{display:flex;justify-content:center}
.gv-pr-skel{display:block;width:100%;border-radius:14px;background:rgba(28,20,16,0.08);animation:gvPrPulse 1.2s ease-in-out infinite}
@keyframes gvPrPulse{0%,100%{opacity:1}50%{opacity:0.55}}
@media (prefers-reduced-motion:reduce){.gv-pr-skel{animation:none}}
`;
