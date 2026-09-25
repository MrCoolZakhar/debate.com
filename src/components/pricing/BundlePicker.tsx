'use client';

// ── Bundles: the centrepiece of /pricing/credits ─────────────────────────────
//
// Left: the selected bundle by name, the quantity huge, the per-credit price,
// the saving in plain type, the quantity chips (1, 10, 25, 50, 100, Custom), the nudge
// ("1 more credit saves you $4.20") and the confirm button, which opens the
// credits pop-up with that quantity preselected.
// Right: six large cards, 3 + 3 on desktop: five photo cards with a dark
// scrim and the quantity huge in white, and a white Custom card with a number field
// you can type into straight away. Card and chip are two views of one choice.
//
// Every number comes from the server's price table (useCreditPriceTable).
// While it loads the numbers read "…" and the confirm button waits.

import { useCallback, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, Flag, Minus, Plus } from 'lucide-react';
import { OUTFIT } from '@/components/neu';
import { GoldWord } from '@/components/BrandHeading';
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
import { FOCUS_RING, P } from './pricingKit';

const BUNDLES = CREDIT_BUNDLES.pricing;
const DEFAULT_CUSTOM = 15;

// One photo per bundle, from the site's own library. All are landscape, so
// each names where the crop should sit inside a tall frame.
const PHOTOS: Record<number, { src: string; position: string; name: string }> = {
  1: { src: '/onboarding/podium-01.jpg', position: '46% 42%', name: 'One application' },
  10: { src: '/onboarding/handshake-01.jpg', position: '50% 50%', name: 'A season of applying' },
  25: { src: '/onboarding/hall-01.jpg', position: '52% 62%', name: 'A whole delegation' },
  50: { src: '/landing/podium-speaker.jpg', position: '30% 45%', name: 'A big society' },
  100: { src: '/onboarding/globe-01.jpg', position: '50% 55%', name: 'A year of conferences' },
};

type Choice = number | 'custom';

function creditsWord(n: number) {
  return n === 1 ? 'credit' : 'credits';
}

export default function BundlePicker() {
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

  const takeNudge = () => {
    if (!nudge) return;
    setCustom(nudge.qty);
  };

  const confirm = () => {
    if (!table) return;
    openCreditsPopup({ context: 'pricing', preselect: qty });
  };

  // Roving focus for the two radiogroups: arrow keys move and select.
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

  const selectedName = choice === 'custom' ? 'Your own number' : PHOTOS[choice]?.name ?? `${choice} credits`;
  const nudgeLabel = nudge
    ? `${nudge.extra} more ${creditsWord(nudge.extra)} ${nudge.extra === 1 ? 'saves' : 'save'} you ${formatUsd(nudge.saves)}`
    : '';

  return (
    <section className="gv-bp gv-p-open" aria-labelledby="gv-bp-title" style={{ fontFamily: OUTFIT }}>
      <style>{`
        .gv-bp{container-type:inline-size;padding:20px 0 8px;scroll-margin-top:96px}
        .gv-bp-head{margin-bottom:28px}
        .gv-bp-grid{display:grid;grid-template-columns:1fr;gap:28px}
        .gv-bp-left{min-width:0}
        .gv-bp-panel{background:${P.white};border-radius:24px;padding:26px 24px 24px;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 18px 40px -32px rgba(27,56,40,0.35)}
        .gv-bp-pick-name{margin:0;font-size:12.5px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${P.goldDeep}}
        .gv-bp-big{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-top:6px}
        .gv-bp-num{font-size:clamp(64px,8vw,88px);font-weight:900;letter-spacing:-0.045em;line-height:0.95;color:${P.forest};font-variant-numeric:tabular-nums}
        .gv-bp-unit{font-size:22px;font-weight:700;color:${P.inkSoft};letter-spacing:-0.01em}
        .gv-bp-facts{display:flex;align-items:center;flex-wrap:wrap;gap:10px 14px;margin-top:14px;min-height:32px}
        .gv-bp-save{font-size:16px;font-weight:800;color:${P.goldDeep};white-space:nowrap}
        .gv-bp-each{font-size:16px;font-weight:600;color:${P.ink};font-variant-numeric:tabular-nums}
        .gv-bp-each b{font-weight:800}
        .gv-bp-was{font-size:14px;color:${P.inkSoft};text-decoration:line-through;font-variant-numeric:tabular-nums}
        .gv-bp-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
        .gv-bp-chip{display:inline-flex;align-items:center;justify-content:center;min-width:52px;min-height:44px;padding:0 16px;border-radius:999px;border:2px solid rgba(27,56,40,0.28);background:transparent;color:${P.ink};font-family:${OUTFIT};font-size:15.5px;font-weight:700;cursor:pointer;font-variant-numeric:tabular-nums;transition:background-color 140ms ease-out,color 140ms ease-out,border-color 140ms ease-out}
        .gv-bp-chip:hover{background:rgba(27,56,40,0.07);border-color:${P.forest}}
        .gv-bp-chip[aria-checked="true"]{background:${P.forest};color:${P.gold};border-color:${P.forest}}
        .gv-bp-nudge{display:inline-flex;align-items:center;gap:8px;margin-top:16px;min-height:44px;padding:0 16px 0 12px;border-radius:12px;border:none;background:${P.gold};color:${P.ink};font-family:${OUTFIT};font-size:14.5px;font-weight:700;cursor:pointer;box-shadow:0 10px 22px -16px rgba(182,135,31,0.8);transition:background-color 140ms ease-out,transform 140ms ease-out}
        .gv-bp-nudge:hover{background:#F3E2A0;transform:translateY(-1px)}
        .gv-bp-confirm{width:100%;margin-top:22px;min-height:60px;font-size:15px}
        .gv-bp-err{margin:16px 0 0;padding:12px 14px;border-radius:12px;background:rgba(27,56,40,0.07);color:${P.ink};font-size:14px;line-height:1.5}
        .gv-bp-err button{margin-left:8px;background:none;border:none;padding:0;color:${P.forest};font-family:${OUTFIT};font-weight:800;font-size:14px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
        .gv-bp-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .gv-bp-card{position:relative;aspect-ratio:4/5;min-height:200px;border-radius:22px;overflow:hidden;cursor:pointer;container-type:inline-size;background:${P.forestDeep};outline:none;transition:transform 200ms cubic-bezier(0.22,1,0.36,1),box-shadow 200ms ease-out;box-shadow:0 18px 32px -22px rgba(27,56,40,0.7)}
        .gv-bp-card:hover{transform:translateY(-3px)}
        .gv-bp-card[aria-checked="true"],.gv-bp-card[data-checked="true"]{box-shadow:0 0 0 3px ${P.cream},0 0 0 7px ${P.goldDeep},0 18px 32px -22px rgba(27,56,40,0.7)}
        .gv-bp-card:focus-visible{box-shadow:0 0 0 3px ${P.cream},0 0 0 7px ${P.forest}}
        .gv-bp-card[aria-checked="true"]:focus-visible{box-shadow:0 0 0 3px ${P.cream},0 0 0 7px ${P.forest},0 0 0 10px ${P.goldDeep}}
        .gv-bp-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;transition:transform 400ms cubic-bezier(0.22,1,0.36,1)}
        .gv-bp-card:hover .gv-bp-photo{transform:scale(1.04)}
        .gv-bp-scrim{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(8,20,13,0.66) 0%,rgba(8,20,13,0.18) 34%,rgba(8,20,13,0) 50%),linear-gradient(to top,rgba(8,20,13,0.95) 0%,rgba(8,20,13,0.7) 36%,rgba(8,20,13,0) 62%)}
        .gv-bp-top{position:absolute;top:0;left:0;right:0;padding:14px 14px 0}
        .gv-bp-pillrow{display:flex;justify-content:flex-end;min-height:28px}
        .gv-bp-card-save{display:inline-flex;align-items:center;min-height:28px;font-size:15px;font-weight:800;color:${P.gold};white-space:nowrap;text-shadow:0 1px 8px rgba(0,0,0,0.55)}
        .gv-bp-custom .gv-bp-card-save{color:${P.goldDeep};text-shadow:none}
        .gv-bp-card-num{display:block;margin-top:6px;font-size:clamp(56px,34cqw,72px);font-weight:900;letter-spacing:-0.05em;line-height:0.9;color:#FFFFFF;font-variant-numeric:tabular-nums;text-shadow:0 2px 14px rgba(0,0,0,0.4)}
        .gv-bp-card-unit{display:block;margin-top:6px;font-size:13px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.9)}
        .gv-bp-bottom{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding:0 14px 16px}
        .gv-bp-card-each{font-size:clamp(22px,14cqw,30px);font-weight:800;letter-spacing:-0.02em;line-height:1;color:#FFFFFF;font-variant-numeric:tabular-nums}
        .gv-bp-card-each small{display:block;margin-top:5px;font-size:13px;font-weight:600;letter-spacing:0.02em;color:rgba(255,255,255,0.9)}
        .gv-bp-card-total{display:block;margin-top:6px;font-size:14px;font-weight:700;color:#FFFFFF;font-variant-numeric:tabular-nums}
        .gv-bp-disc{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:rgba(250,248,243,0.94);color:${P.forest};transition:background-color 160ms ease-out,color 160ms ease-out}
        .gv-bp-card[aria-checked="true"] .gv-bp-disc{background:${P.forest};color:${P.gold}}
        .gv-bp-custom{cursor:default;grid-column:1/-1;aspect-ratio:auto;min-height:230px;background:${P.white};box-shadow:0 1px 0 rgba(27,56,40,0.08),0 18px 40px -32px rgba(27,56,40,0.35)}
        .gv-bp-custom .gv-bp-card-each,.gv-bp-custom .gv-bp-card-total{color:${P.ink}}
        .gv-bp-custom .gv-bp-card-each small{color:${P.inkSoft}}
        .gv-bp-custom .gv-bp-disc{background:rgba(27,56,40,0.08)}
        .gv-bp-custom-body{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:14px 14px 16px}
        .gv-bp-custom-word{font-size:13px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${P.goldDeep}}
        .gv-bp-custom-field{display:flex;align-items:center;gap:8px;margin-top:10px}
        .gv-bp-step{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:44px;height:44px;border-radius:12px;border:1.5px solid ${P.ink};background:transparent;color:${P.ink};cursor:pointer;transition:background-color 140ms ease-out}
        .gv-bp-step:hover{background:rgba(27,56,40,0.07)}
        .gv-bp-step:disabled{opacity:0.4;cursor:not-allowed}
        .gv-bp-input{flex:1 1 auto;min-width:0;width:100%;height:52px;border-radius:12px;border:1.5px solid rgba(27,56,40,0.28);background:${P.ivory};color:${P.ink};font-family:${OUTFIT};font-size:20px;font-weight:800;text-align:center;font-variant-numeric:tabular-nums;-moz-appearance:textfield}
        .gv-bp-input::-webkit-outer-spin-button,.gv-bp-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
        .gv-bp-input:focus{outline:none;border-color:${P.forest};box-shadow:0 0 0 3px ${P.white},0 0 0 6px ${P.forest}}
        .gv-bp-custom-max{margin:8px 0 0;font-size:13px;font-weight:600;color:${P.inkSoft}}
        .gv-bp-custom-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:8px}
        .gv-bp-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
        @container (min-width:560px){
          .gv-bp-cards{gap:16px}
          .gv-bp-card{border-radius:24px}
          .gv-bp-custom{grid-column:auto;aspect-ratio:4/5}
          .gv-bp-top{padding:18px 18px 0}
          .gv-bp-bottom{padding:0 18px 20px}
          .gv-bp-custom-body{padding:18px 18px 20px}
        }
        @container (min-width:1000px){
          .gv-bp-grid{grid-template-columns:300px minmax(0,1fr);gap:32px;align-items:start}
          .gv-bp-cards{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
          .gv-bp-card{min-height:260px}
        }
        @media (prefers-reduced-motion:reduce){
          .gv-bp-card,.gv-bp-photo,.gv-bp-chip,.gv-bp-disc,.gv-bp-nudge{transition:none}
          .gv-bp-card:hover,.gv-bp-nudge:hover{transform:none}
          .gv-bp-card:hover .gv-bp-photo{transform:none}
        }
      `}</style>

      <div className="gv-bp-head">
        <h2 id="gv-bp-title" className="gv-p-h2">Pick Your <GoldWord tone="light">Bundle</GoldWord></h2>
        <p className="gv-p-line">Bigger bundles cost less a credit</p>
      </div>

      <div className="gv-bp-grid">
        {/* LEFT: the choice, in words and numbers */}
        <div className="gv-bp-left">
          <div className="gv-bp-panel">
            <div aria-live="polite">
              <p className="gv-bp-pick-name">{selectedName}</p>
              <div className="gv-bp-big">
                <span className="gv-bp-num">{qty}</span>
                <span className="gv-bp-unit">{creditsWord(qty)}</span>
              </div>
              <div className="gv-bp-facts">
                {priced && priced.pct > 0 && <span className="gv-bp-save">Save {priced.pct}%</span>}
                <span className="gv-bp-each">
                  <b>{priced ? formatUsd(priced.each) : '…'}</b> a credit
                </span>
                {priced && priced.pct > 0 && (
                  <span className="gv-bp-was" aria-label={`${formatUsd(priced.list)} at full price`}>{formatUsd(priced.list)}</span>
                )}
              </div>
            </div>

            <div
              className="gv-bp-chips"
              role="radiogroup"
              aria-label="How many credits"
            >
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
                    className={`gv-bp-chip ${FOCUS_RING}`}
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
                className={`gv-bp-chip ${FOCUS_RING}`}
                onClick={pickCustom}
              >
                Custom
              </button>
            </div>

            {nudge && (
              <button type="button" className={`gv-bp-nudge ${FOCUS_RING}`} onClick={takeNudge}>
                <Flag size={16} strokeWidth={2.6} aria-hidden />
                {nudgeLabel}
              </button>
            )}

            <button
              type="button"
              className={`gv-p-btn gv-p-btn-forest gv-bp-confirm ${FOCUS_RING}`}
              onClick={confirm}
              disabled={!priced}
              aria-disabled={!priced}
            >
              Buy {qty} {creditsWord(qty)} for {priced ? formatUsd(priced.total) : '…'}
            </button>

            {error && (
              <p className="gv-bp-err" role="alert">
                We could not load the prices just now.
                <button type="button" onClick={retry}>Try again</button>
              </p>
            )}
          </div>
        </div>

        {/* RIGHT: five photo cards and the Custom card */}
        <div className="gv-bp-cards">
          <div role="radiogroup" aria-label="Bundles" style={{ display: 'contents' }}>
            {BUNDLES.map((n, i) => {
              const photo = PHOTOS[n];
              const checked = choice === n;
              const pct = table ? discountPctFor(n, table) : null;
              const each = table ? formatUsd(perCreditCents(n, table)) : '…';
              const total = table ? formatUsd(priceCentsFor(n, table)) : '…';
              const tabbable = checked || (choice === 'custom' && i === 0);
              return (
                <div
                  key={n}
                  ref={(el) => { cardRefs.current[i] = el; }}
                  role="radio"
                  aria-checked={checked}
                  tabIndex={tabbable ? 0 : -1}
                  aria-label={`${n} ${creditsWord(n)}, ${each} a credit, ${total} in total${pct ? `, save ${pct}%` : ''}`}
                  className="gv-bp-card"
                  onClick={() => setChoice(n)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setChoice(n); return; }
                    onGroupKey(e, BUNDLES, cardRefs.current, i);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.src}
                    alt=""
                    aria-hidden
                    width={600}
                    height={750}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="gv-bp-photo"
                    style={{ objectPosition: photo.position }}
                  />
                  <div className="gv-bp-scrim" aria-hidden />
                  <div className="gv-bp-top" aria-hidden>
                    <div className="gv-bp-pillrow">
                      {pct ? <span className="gv-bp-card-save">Save {pct}%</span> : null}
                    </div>
                    <span className="gv-bp-card-num">{n}</span>
                    <span className="gv-bp-card-unit">{creditsWord(n)}</span>
                  </div>
                  <div className="gv-bp-bottom" aria-hidden>
                    <div>
                      <span className="gv-bp-card-each">
                        {each}
                        <small>a credit</small>
                      </span>
                      <span className="gv-bp-card-total">{total} in total</span>
                    </div>
                    <span className="gv-bp-disc">
                      {checked ? <Check size={20} strokeWidth={3} /> : <Plus size={20} strokeWidth={2.6} />}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CUSTOM: type a number straight into the card */}
          <div className="gv-bp-card gv-bp-custom" data-checked={choice === 'custom' ? 'true' : 'false'}>
            <div className="gv-bp-custom-body">
              <div>
                <div className="gv-bp-pillrow">
                  {choice === 'custom' && priced && priced.pct > 0 ? <span className="gv-bp-card-save">Save {priced.pct}%</span> : null}
                </div>
                <span className="gv-bp-custom-word">Custom</span>
                <div className="gv-bp-custom-field">
                  <button
                    type="button"
                    className={`gv-bp-step ${FOCUS_RING}`}
                    aria-label="One credit fewer"
                    onClick={() => stepCustom(-1)}
                    disabled={customQty <= 1}
                  >
                    <Minus size={18} strokeWidth={2.6} aria-hidden />
                  </button>
                  <input
                    ref={customInputRef}
                    className="gv-bp-input"
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
                  <button
                    type="button"
                    className={`gv-bp-step ${FOCUS_RING}`}
                    aria-label="One credit more"
                    onClick={() => stepCustom(1)}
                    disabled={maxQty !== null && customQty >= maxQty}
                  >
                    <Plus size={18} strokeWidth={2.6} aria-hidden />
                  </button>
                </div>
                <p className="gv-bp-custom-max">{maxQty ? `Up to ${maxQty}` : '…'}</p>
              </div>
              <div className="gv-bp-custom-foot" aria-hidden>
                <div>
                  <span className="gv-bp-card-each">
                    {table ? formatUsd(perCreditCents(customQty, table)) : '…'}
                    <small>a credit</small>
                  </span>
                  <span className="gv-bp-card-total">{table ? formatUsd(priceCentsFor(customQty, table)) : '…'} in total</span>
                </div>
                <span className="gv-bp-disc" style={choice === 'custom' ? { background: P.forest, color: P.gold } : undefined}>
                  {choice === 'custom' ? <Check size={20} strokeWidth={3} /> : <Plus size={20} strokeWidth={2.6} />}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="gv-bp-live" role="status">
        {priced ? `${qty} ${creditsWord(qty)} for ${formatUsd(priced.total)}` : ''}
      </p>
    </section>
  );
}
