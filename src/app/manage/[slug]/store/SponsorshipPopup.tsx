'use client';

// SponsorshipPopup — the conference pays applicants' Gavelling credit.
// The credits pop-up's layout: what it is on the left, the amount on the
// right, covered now → after, ADD. store_add_sponsorship(p_conf, p_qty,
// p_top_up); short on credits goes through useStoreBuy.

import { useState } from 'react';
import { ArrowRight, Heart, Search, Undo2, Users } from 'lucide-react';
import { notifyOk } from '@/lib/appNotify';
import { OUTFIT } from '@/components/neu';
import { PurchaseShell, BrandTitle, Eyebrow, BenefitList, ErrorLine, GoldButton, FOREST, INK, INK_SOFT, type Benefit } from '@/components/purchase/purchaseKit';
import { credits as creditsWord, rpcCall, useStoreBuy, type StoreAnswer } from './storeApi';

const CHIPS = [10, 25, 50, 100];
const MAX = 1000;

const POINTS: Benefit[] = [
  { emoji: 'Ticket', fallback: Users, title: 'Applying is free for them', note: 'Delegates, head delegates, faculty advisors and observers pay no credit to apply.', live: true },
  { emoji: 'Red heart', fallback: Heart, title: 'The Credit sponsored mark', note: 'A heart on your conference page and on your card.', live: true },
  { emoji: 'Magnifying glass tilted left', fallback: Search, title: 'Found by the filter', note: 'Listed under Credit sponsored in Explore.', live: true },
  { emoji: 'Counterclockwise arrows button', fallback: Undo2, title: 'Nothing wasted', note: 'A rejected or withdrawn applicant’s credit comes back to the pool.', live: true },
];

export default function SponsorshipPopup({ conferenceId, available, used, conferenceCredits, yourCredits, onClose, onDone }: {
  conferenceId: string; available: number; used: number; conferenceCredits: number; yourCredits: number;
  onClose: () => void; onDone: (a: StoreAnswer) => void;
}) {
  const [qty, setQty] = useState(25);
  const [custom, setCustom] = useState(false);
  const [typed, setTyped] = useState('25');
  const [err, setErr] = useState('');
  const { busy, run, ownOffer, acceptOwn } = useStoreBuy(yourCredits);

  const commit = (raw: string) => {
    setTyped(raw);
    const n = Math.max(1, Math.min(MAX, parseInt(raw, 10) || 0));
    if (raw.trim() !== '') setQty(n);
  };

  const add = () => {
    setErr('');
    run(rpcCall('store_add_sponsorship', { p_conf: conferenceId, p_qty: qty }), {
      onDone: (a) => {
        notifyOk(`${qty} more ${qty === 1 ? 'applicant' : 'applicants'} covered.`, 'store');
        onDone(a);
        onClose();
      },
      onRefused: (m) => setErr(m),
    });
  };

  return (
    <PurchaseShell tone="light" label="Sponsor your delegates' credits" onClose={onClose} testId="store-sponsorship">
      <div className="gv-buy-left">
        <BrandTitle word="Sponsorship" tone="light" sub={<>Your conference pays the credit, so applying costs your delegates nothing</>} />
        <div>
          <Eyebrow>What you get</Eyebrow>
          <BenefitList items={POINTS} tone="light" />
        </div>
        <div className="gv-buy-balance">
          <Eyebrow>Covered so far</Eyebrow>
          <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: 14, color: INK_SOFT }}>
            <b style={{ fontSize: 22, fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums' }}>{used}</b> {used === 1 ? 'applicant has' : 'applicants have'} applied on the conference&rsquo;s credit
          </p>
        </div>
      </div>
      <div className="gv-buy-right">
        <h3 className="gv-buy-rtitle">How many applicants to cover</h3>
        <div className="gv-buy-grid" role="radiogroup" aria-label="How many applicants" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
          {CHIPS.map((n) => (
            <button key={n} type="button" role="radio" aria-checked={!custom && qty === n} className="gv-buy-chip gv-sp-chip-light" onClick={() => { setCustom(false); setQty(n); setErr(''); }}>
              <span className="gv-buy-chip-qty">{n}</span>
              <span className="gv-buy-chip-unit">applicants</span>
              <span className="gv-buy-chip-price">{creditsWord(n)}</span>
            </button>
          ))}
          <button type="button" role="radio" aria-checked={custom} className="gv-buy-chip gv-sp-chip-light" onClick={() => { setCustom(true); setTyped(String(qty)); }}>
            <span className="gv-buy-chip-unit">Another amount</span>
            {custom ? (
              <input
                type="number" inputMode="numeric" min={1} max={MAX} value={typed}
                onChange={(e) => commit(e.target.value)}
                className="gv-buy-stepin gv-sp-in-light" aria-label="How many applicants"
                onClick={(e) => e.stopPropagation()}
              />
            ) : <span className="gv-buy-chip-qty">…</span>}
          </button>
        </div>
        <div className="gv-buy-balance" aria-live="polite" style={{ marginTop: 6 }}>
          <Eyebrow>Applicants covered</Eyebrow>
          <div className="gv-buy-balance-row">
            <div className="gv-buy-balance-cell"><span className="gv-buy-balance-big">{available}</span><span className="gv-buy-balance-cap">now</span></div>
            <ArrowRight size={24} strokeWidth={2.4} className="gv-buy-balance-arrow" style={{ color: FOREST }} aria-hidden />
            <div className="gv-buy-balance-cell"><span className="gv-buy-balance-big gv-buy-after">{available + qty}</span><span className="gv-buy-balance-cap">after</span></div>
          </div>
        </div>
        <p className="gv-buy-fine" style={{ textAlign: 'left' }}>
          Uses {creditsWord(qty)} of the conference&rsquo;s {conferenceCredits}. Unused sponsorship can be sent back any time.
        </p>
        {err ? <ErrorLine>{err}</ErrorLine> : null}
        {ownOffer !== null && (
          <p className="gv-buy-note">The conference is short by {creditsWord(ownOffer)}. <button type="button" onClick={acceptOwn}>Use {ownOffer} of your own</button> and add now.</p>
        )}
        <GoldButton onClick={add} busy={busy} busyText="ADDING…">{`ADD ${qty} ${qty === 1 ? 'APPLICANT' : 'APPLICANTS'}`}</GoldButton>
      </div>
      <style>{LIGHT_CHIP_CSS}</style>
    </PurchaseShell>
  );
}

/** The kit's bundle chips are drawn for forest; these sit on cream. */
export const LIGHT_CHIP_CSS = `
.gv-buy-chip.gv-sp-chip-light{border-color:rgba(27,56,40,0.28);color:${INK}}
.gv-buy-chip.gv-sp-chip-light:hover{border-color:${FOREST}}
.gv-buy-chip.gv-sp-chip-light[aria-checked="true"]{border-color:${FOREST};box-shadow:inset 0 0 0 1.5px ${FOREST};background:rgba(27,56,40,0.06)}
.gv-buy-chip.gv-sp-chip-light .gv-buy-chip-qty{color:${INK}}
.gv-buy-chip.gv-sp-chip-light .gv-buy-chip-unit,.gv-buy-chip.gv-sp-chip-light .gv-buy-chip-price{color:${INK_SOFT}}
.gv-buy-stepin.gv-sp-in-light{background:#FFFFFF;color:${INK};border-color:rgba(27,56,40,0.28);width:100%;margin-top:6px}
`;
