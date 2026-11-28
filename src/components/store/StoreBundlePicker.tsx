'use client';

// ── Pick Your Bundle, the black Store version (prompt 86, 27 Nov 2026) ──────
//
// The behaviour of src/components/pricing/BundlePicker.tsx in the Store's
// black: a sticky panel (the caption for the amount picked, the amount huge,
// the price a credit with the full price struck through, the amount chips,
// the nudge to the next tier and the buy button that opens the credits pop-up
// with that amount; 380px, not sticky since prompt 90) beside six smaller cards (five photo bundles and Custom, with
// steppers around a number field). Card and chip are two views of one choice.
//
// Every price, saving and the maximum come from the server price table
// (useCreditPriceTable). The doubling during a buy one, get one free sale is
// DISPLAY ONLY: the database adds the free credits after the purchase (a
// trigger on credit_lots), so the pop-up and Stripe charge the normal price.

import { useCallback, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import {
  CREDIT_BUNDLES,
  clampQty,
  discountPctFor,
  formatUsd,
  listCentsFor,
  nextTierNudge,
  perCreditCents,
  priceCentsFor,
  useCreditPriceTable,
} from '@/lib/creditPricing';
import { openCreditsPopup } from '@/lib/purchasePopup';
import { Skel } from './storeKit';

const BUNDLES = CREDIT_BUNDLES.pricing;
const DEFAULT_CUSTOM = 15;

const PHOTOS: Record<number, { src: string; position: string; caption: string }> = {
  1: { src: '/onboarding/podium-01.jpg', position: '46% 42%', caption: 'One more application' },
  10: { src: '/onboarding/handshake-01.jpg', position: '50% 50%', caption: 'A season of applying' },
  25: { src: '/onboarding/hall-02.jpg', position: '50% 55%', caption: 'A year of conferences' },
  50: { src: '/landing/podium-speaker.jpg', position: '30% 45%', caption: 'For a whole delegation' },
  100: { src: '/onboarding/globe-01.jpg', position: '50% 55%', caption: 'For your society' },
};
const CUSTOM_CAPTION = 'Your own number';

type Choice = number | 'custom';

function creditsWord(n: number) {
  return n === 1 ? 'credit' : 'credits';
}

export default function StoreBundlePicker({ bogo, known = true }: {
  bogo: boolean;
  /** False until the sale read answers (prompt 94): sale-dependent words are grey bars until then. */
  known?: boolean;
}) {
  const { table, error, retry } = useCreditPriceTable();
  const [choice, setChoice] = useState<Choice>(10);
  const [customQty, setCustomQty] = useState(DEFAULT_CUSTOM);
  const [customText, setCustomText] = useState(String(DEFAULT_CUSTOM));
  const customInputRef = useRef<HTMLInputElement>(null);

  const qty = choice === 'custom' ? customQty : choice;
  const maxQty = table?.maxQty ?? null;

  const priced = useMemo(() => {
    if (!table) return null;
    return {
      total: priceCentsFor(qty, table),
      list: listCentsFor(qty, table),
      pct: discountPctFor(qty, table),
      each: perCreditCents(qty, table),
    };
  }, [qty, table]);

  const nudge = useMemo(() => (choice === 'custom' && table ? nextTierNudge(qty, table) : null), [choice, qty, table]);

  const setCustom = useCallback((n: number) => {
    setCustomQty(n);
    setCustomText(String(n));
  }, []);

  const commitCustom = useCallback((raw: string) => {
    setCustom(clampQty(parseInt(raw, 10), table));
  }, [table, setCustom]);

  const stepCustom = (delta: number) => {
    setChoice('custom');
    setCustom(clampQty(customQty + delta, table));
  };

  const pickCustom = () => {
    setChoice('custom');
    customInputRef.current?.focus();
    customInputRef.current?.select();
  };

  const confirm = () => {
    if (!table) return;
    openCreditsPopup({ context: 'pricing', preselect: qty });
  };

  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const onGroupKey = (e: KeyboardEvent, items: number[], refs: (HTMLElement | null)[], current: number) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % items.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setChoice(items[next]);
    refs[next]?.focus();
  };

  const caption = choice === 'custom' ? CUSTOM_CAPTION : PHOTOS[choice]?.caption ?? CUSTOM_CAPTION;
  const total = priced ? formatUsd(priced.total) : '…';
  const buyLabel = bogo ? `Buy ${qty}, get ${qty * 2} for ${total}` : `Buy ${qty} ${creditsWord(qty)} for ${total}`;
  const nudgeLabel = nudge
    ? `${nudge.extra} more ${creditsWord(nudge.extra)} ${nudge.extra === 1 ? 'saves' : 'save'} you ${formatUsd(nudge.saves)}`
    : '';

  return (
    <div className="gv-sbp">
      <style>{CSS}</style>
      <div className="gv-sbp-grid">
        <div className="gv-sbp-left">
          <div className="gv-s-card gv-sbp-panel">
            <div aria-live="polite">
              <p className="gv-s-label">{caption}</p>
              <div className="gv-sbp-big">
                <span className="gv-sbp-num">{qty}</span>
                <span className="gv-sbp-unit">{creditsWord(qty)}</span>
              </div>
              {!known ? <Skel w={170} h={30} style={{ marginTop: 14, borderRadius: 8 }} /> : bogo && <span className="gv-sbp-free">+{qty} free · {qty * 2} in total</span>}
              <div className="gv-sbp-facts">
                <span className="gv-sbp-each"><b>{priced ? formatUsd(priced.each) : '…'}</b> a credit</span>
                {priced && priced.pct > 0 && (
                  <s className="gv-sbp-was"><span className="sr-only">full price </span>{formatUsd(priced.list)}</s>
                )}
              </div>
            </div>

            <div className="gv-sbp-chips" role="radiogroup" aria-label="How many credits">
              {BUNDLES.map((c, i) => {
                const checked = c === choice;
                return (
                  <button
                    key={c}
                    ref={(el) => { chipRefs.current[i] = el; }}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    tabIndex={checked || (choice === 'custom' && i === 0) ? 0 : -1}
                    className="gv-sbp-chip"
                    onClick={() => setChoice(c)}
                    onKeyDown={(e) => onGroupKey(e, BUNDLES, chipRefs.current, i)}
                  >
                    {c}
                  </button>
                );
              })}
              <button
                type="button"
                role="radio"
                aria-checked={choice === 'custom'}
                tabIndex={choice === 'custom' ? 0 : -1}
                className="gv-sbp-chip"
                onClick={pickCustom}
              >
                Custom
              </button>
            </div>

            {nudge && (
              <button type="button" className="gv-sbp-nudge" onClick={() => setCustom(nudge.qty)}>{nudgeLabel}</button>
            )}

            <button type="button" className="gv-s-btn gv-s-big gv-s-cream gv-sbp-buy" onClick={confirm} disabled={!priced} aria-disabled={!priced}>
              {known ? buyLabel : <Skel w={200} h={18} inline style={{ background: 'rgba(14,15,13,0.12)' }} />}
            </button>
            {known && bogo && <p className="gv-sbp-fine">Free credits never expire</p>}

            {error && (
              <p className="gv-sbp-err" role="alert">
                We could not load the prices just now.
                <button type="button" onClick={retry}>Try again</button>
              </p>
            )}
          </div>
        </div>

        <div className="gv-sbp-cards">
          <div role="radiogroup" aria-label="Bundles" style={{ display: 'contents' }}>
            {BUNDLES.map((n, i) => {
              const photo = PHOTOS[n];
              const checked = choice === n;
              const pct = table ? discountPctFor(n, table) : null;
              const each = table ? formatUsd(perCreditCents(n, table)) : '…';
              const sum = table ? formatUsd(priceCentsFor(n, table)) : '…';
              const tabbable = checked || (choice === 'custom' && i === 0);
              return (
                <div
                  key={n}
                  ref={(el) => { cardRefs.current[i] = el; }}
                  role="radio"
                  aria-checked={checked}
                  tabIndex={tabbable ? 0 : -1}
                  aria-label={`${n} ${creditsWord(n)}, ${each} a credit, ${sum} in total${bogo ? `, get ${n * 2}` : pct ? `, save ${pct}%` : ''}`}
                  className="gv-sbp-card"
                  onClick={() => setChoice(n)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setChoice(n); return; }
                    onGroupKey(e, BUNDLES, cardRefs.current, i);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.src} alt="" aria-hidden width={600} height={750} loading="lazy" decoding="async" draggable={false} className="gv-sbp-photo" style={{ objectPosition: photo.position }} />
                  <div className="gv-sbp-scrim" aria-hidden />
                  <div className="gv-sbp-top" aria-hidden>
                    <div className="gv-sbp-toprow">
                      <span className="gv-sbp-cap">{photo.caption}</span>
                      {!known ? <Skel w={64} h={26} style={{ flexShrink: 0, borderRadius: 8 }} /> : bogo ? <span className="gv-sbp-tag">+{n} free</span> : pct ? <span className="gv-sbp-save">Save {pct}%</span> : null}
                    </div>
                    <span className="gv-sbp-card-num">{n}</span>
                    <span className="gv-sbp-card-unit">{creditsWord(n)}</span>
                  </div>
                  <div className="gv-sbp-bottom" aria-hidden>
                    <div>
                      <span className="gv-sbp-card-each">{each}<small>a credit</small></span>
                      {known ? <span className="gv-sbp-card-total">{bogo ? `${sum} · get ${n * 2}` : `${sum} in total`}</span> : <Skel w={90} h={13} style={{ marginTop: 6 }} />}
                    </div>
                    <span className="gv-sbp-disc">
                      {checked ? <Check size={20} strokeWidth={2.6} /> : <Plus size={20} strokeWidth={2.2} />}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="gv-sbp-card gv-sbp-custom" data-checked={choice === 'custom' ? 'true' : 'false'}>
            <div className="gv-sbp-custom-body">
              <div>
                <div className="gv-sbp-toprow">
                  <span className="gv-sbp-cap" style={{ color: '#A8C9B2' }}>{CUSTOM_CAPTION}</span>
                  {!known ? <Skel w={64} h={26} style={{ flexShrink: 0, borderRadius: 8 }} /> : bogo ? <span className="gv-sbp-tag">+{customQty} free</span> : null}
                </div>
                <div className="gv-sbp-custom-field">
                  <button type="button" className="gv-sbp-step" aria-label="One credit fewer" onClick={() => stepCustom(-1)} disabled={customQty <= 1}>
                    <Minus size={18} strokeWidth={2.2} aria-hidden />
                  </button>
                  <input
                    ref={customInputRef}
                    className="gv-sbp-input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={maxQty ?? undefined}
                    step={1}
                    value={customText}
                    aria-label="Number of credits"
                    onFocus={() => setChoice('custom')}
                    onChange={(e) => {
                      setChoice('custom');
                      setCustomText(e.target.value);
                      const n = parseInt(e.target.value, 10);
                      if (Number.isFinite(n) && n >= 1) setCustomQty(clampQty(n, table));
                    }}
                    onBlur={(e) => commitCustom(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitCustom((e.target as HTMLInputElement).value); }}
                  />
                  <button type="button" className="gv-sbp-step" aria-label="One credit more" onClick={() => stepCustom(1)} disabled={maxQty !== null && customQty >= maxQty}>
                    <Plus size={18} strokeWidth={2.2} aria-hidden />
                  </button>
                </div>
                <p className="gv-sbp-custom-max">{maxQty && known ? `Up to ${maxQty}${bogo ? ', doubled too' : ''}` : '…'}</p>
              </div>
              <div className="gv-sbp-bottom gv-sbp-bottom-static" aria-hidden>
                <div>
                  <span className="gv-sbp-card-each">{table ? formatUsd(perCreditCents(customQty, table)) : '…'}<small>a credit</small></span>
                  <span className="gv-sbp-card-total">
                    {table && known ? (bogo ? `${formatUsd(priceCentsFor(customQty, table))} · get ${customQty * 2}` : `${formatUsd(priceCentsFor(customQty, table))} in total`) : '…'}
                  </span>
                </div>
                <span className="gv-sbp-disc" data-on={choice === 'custom' ? 'true' : undefined}>
                  {choice === 'custom' ? <Check size={20} strokeWidth={2.6} /> : <Plus size={20} strokeWidth={2.2} />}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="sr-only" role="status">
        {priced ? `${qty} ${creditsWord(qty)} for ${formatUsd(priced.total)}${bogo ? `, ${qty * 2} in total with the free credits` : ''}` : ''}
      </p>
    </div>
  );
}

const CSS = `
.gv-sbp-grid{display:grid;grid-template-columns:1fr;gap:24px}
.gv-sbp-left{min-width:0}
.gv-sbp-panel{padding:26px}
.gv-sbp-big{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-top:8px}
.gv-sbp-num{font-size:96px;font-weight:900;letter-spacing:-0.05em;line-height:.9;color:#F6F2E8;font-variant-numeric:tabular-nums}
.gv-sbp-unit{font-size:22px;font-weight:800;color:#BDB7A8}
.gv-sbp-free{display:inline-flex;align-items:center;margin-top:14px;height:30px;padding:0 12px;border-radius:8px;background:#F6F2E8;color:#0E0F0D;font-size:12.5px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;font-variant-numeric:tabular-nums}
.gv-sbp-facts{display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;margin-top:14px;min-height:28px}
.gv-sbp-each{font-size:16px;color:#BDB7A8;font-variant-numeric:tabular-nums}
.gv-sbp-each b{color:#F6F2E8;font-weight:900}
.gv-sbp-was{font-size:14.5px;color:#8F8A7E;font-variant-numeric:tabular-nums}
.gv-sbp-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
.gv-sbp-chip{display:inline-flex;align-items:center;justify-content:center;min-width:52px;min-height:44px;padding:0 16px;border-radius:999px;border:1.5px solid rgba(246,242,232,.55);background:transparent;color:#F6F2E8;font:inherit;font-size:15.5px;font-weight:800;cursor:pointer;font-variant-numeric:tabular-nums;transition:background-color 140ms ease-out,color 140ms ease-out,border-color 140ms ease-out}
.gv-sbp-chip:hover{border-color:#F6F2E8}
.gv-sbp-chip:focus{outline:none}
.gv-sbp-chip:focus-visible{outline:2px solid #F6F2E8;outline-offset:3px}
.gv-sbp-chip[aria-checked="true"]{background:#F6F2E8;color:#0E0F0D;border-color:#F6F2E8}
.gv-sbp-nudge{display:inline-flex;align-items:center;margin-top:14px;min-height:44px;padding:0 14px;border-radius:12px;border:1px dashed rgba(168,201,178,.6);background:transparent;color:#A8C9B2;font:inherit;font-size:14.5px;font-weight:800;cursor:pointer}
.gv-sbp-nudge:hover{border-style:solid}
.gv-sbp-nudge:focus{outline:none}
.gv-sbp-nudge:focus-visible{outline:2px solid #F6F2E8;outline-offset:3px}
.gv-sbp-buy{width:100%;margin-top:22px;white-space:normal;text-align:center;padding-top:8px;padding-bottom:8px}
.gv-sbp-buy[disabled]{opacity:.6}
.gv-sbp-fine{margin:12px 0 0;font-size:14px;font-weight:700;color:#A8C9B2;text-align:center}
.gv-sbp-err{margin:16px 0 0;padding:12px 14px;border-radius:12px;background:#22251F;color:#F6F2E8;font-size:14px;line-height:1.5}
.gv-sbp-err button{margin-left:8px;background:none;border:none;padding:0;color:#F6F2E8;font:inherit;font-weight:800;cursor:pointer;text-decoration:underline;text-underline-offset:3px}

.gv-sbp-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.gv-sbp-card{position:relative;min-height:200px;border-radius:18px;overflow:hidden;cursor:pointer;background:#161815;border:1px solid #2A2D27;outline:none;transition:transform 200ms cubic-bezier(0.22,1,0.36,1),box-shadow 200ms ease-out}
.gv-sbp-card:hover{transform:translateY(-3px)}
.gv-sbp-card[aria-checked="true"],.gv-sbp-card[data-checked="true"]{box-shadow:0 0 0 2px #F6F2E8}
.gv-sbp-card:focus-visible{box-shadow:0 0 0 2px #0E0F0D,0 0 0 4px #F6F2E8}
.gv-sbp-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;transition:transform 400ms cubic-bezier(0.22,1,0.36,1)}
.gv-sbp-card:hover .gv-sbp-photo{transform:scale(1.04)}
.gv-sbp-scrim{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(14,15,13,0.78) 0%,rgba(14,15,13,0.25) 36%,rgba(14,15,13,0) 52%),linear-gradient(to top,rgba(14,15,13,0.96) 0%,rgba(14,15,13,0.72) 36%,rgba(14,15,13,0) 62%)}
.gv-sbp-top{position:absolute;top:0;left:0;right:0;padding:12px 14px 0}
.gv-sbp-toprow{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;min-height:26px}
.gv-sbp-cap{font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:rgba(246,242,232,.92);line-height:1.3;padding-top:5px}
.gv-sbp-tag{flex-shrink:0;display:inline-flex;align-items:center;height:26px;padding:0 9px;border-radius:8px;background:#F6F2E8;color:#0E0F0D;font-size:11.5px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;font-variant-numeric:tabular-nums}
.gv-sbp-save{flex-shrink:0;padding-top:4px;font-size:14px;font-weight:800;color:#A8C9B2;white-space:nowrap}
.gv-sbp-card-num{display:block;margin-top:4px;font-size:52px;font-weight:900;letter-spacing:-0.05em;line-height:.9;color:#FFFFFF;font-variant-numeric:tabular-nums}
.gv-sbp-card-unit{display:block;margin-top:4px;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.9)}
.gv-sbp-bottom{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding:0 14px 14px}
.gv-sbp-bottom-static{position:static;padding:0}
.gv-sbp-card-each{font-size:24px;font-weight:900;letter-spacing:-0.03em;line-height:1;color:#FFFFFF;font-variant-numeric:tabular-nums}
.gv-sbp-card-each small{display:block;margin-top:3px;font-size:12.5px;font-weight:700;letter-spacing:0;color:rgba(255,255,255,.85)}
.gv-sbp-card-total{display:block;margin-top:4px;font-size:13px;font-weight:700;color:#F6F2E8;font-variant-numeric:tabular-nums}
.gv-sbp-disc{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:rgba(246,242,232,.14);color:#F6F2E8;box-shadow:inset 0 0 0 1.5px rgba(246,242,232,.55);transition:background-color 160ms ease-out,color 160ms ease-out}
.gv-sbp-card[aria-checked="true"] .gv-sbp-disc,.gv-sbp-disc[data-on="true"]{background:#F6F2E8;color:#0E0F0D;box-shadow:none}
.gv-sbp-custom{cursor:default;grid-column:1/-1;min-height:220px}
.gv-sbp-custom:hover{transform:none}
.gv-sbp-custom-body{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;gap:8px;padding:12px 14px 14px}
.gv-sbp-custom-field{display:flex;align-items:center;gap:8px;margin-top:8px}
.gv-sbp-step{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:44px;height:44px;border-radius:12px;border:1.5px solid rgba(246,242,232,.55);background:transparent;color:#F6F2E8;cursor:pointer}
.gv-sbp-step:hover{border-color:#F6F2E8}
.gv-sbp-step:focus{outline:none}
.gv-sbp-step:focus-visible{outline:2px solid #F6F2E8;outline-offset:2px}
.gv-sbp-step:disabled{opacity:.4;cursor:not-allowed}
.gv-sbp-input{flex:1 1 auto;min-width:0;width:100%;height:48px;border-radius:12px;border:1.5px solid #2A2D27;background:#0E0F0D;color:#F6F2E8;font:inherit;font-size:24px;font-weight:900;text-align:center;font-variant-numeric:tabular-nums;-moz-appearance:textfield}
.gv-sbp-input::-webkit-outer-spin-button,.gv-sbp-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.gv-sbp-input:focus{outline:none;border-color:#F6F2E8}
.gv-sbp-custom-max{margin:6px 0 0;font-size:13.5px;font-weight:700;color:#BDB7A8}
@media (min-width:640px){
  .gv-sbp-cards{gap:14px}
  .gv-sbp-custom{grid-column:auto}
}
@media (min-width:1100px){
  /* The panel is wider and not sticky; the two rows of three match its height (prompt 90). */
  .gv-sbp-grid{grid-template-columns:380px minmax(0,1fr);gap:28px;align-items:stretch}
  .gv-sbp-cards{grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:minmax(200px,1fr)}
}
@media (prefers-reduced-motion:reduce){
  .gv-sbp-card,.gv-sbp-photo,.gv-sbp-chip,.gv-sbp-disc{transition:none}
  .gv-sbp-card:hover,.gv-sbp-card:hover .gv-sbp-photo{transform:none}
}
`;
