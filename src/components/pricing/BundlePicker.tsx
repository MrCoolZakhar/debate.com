'use client';

// ── Bundles: the centrepiece of /pricing/credits ─────────────────────────────
//
// Left: the title, the selected bundle as a huge numeral with its saving and
// per-credit price, the quantity chips (1, 10, 25, 50, 100, Custom) and the
// confirm button, which opens the credits pop-up with that quantity preselected.
// Right: one tall photo card per bundle. Card and chip are two views of one
// choice; selecting either updates the other.
//
// Every number on screen comes from the server's price table
// (useCreditPriceTable). While it loads the numbers read "…" and the confirm
// button waits, and the widths are reserved so nothing jumps when they land.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { OUTFIT } from '@/components/neu';
import {
  CREDIT_BUNDLES,
  clampQty,
  discountPctFor,
  formatUsd,
  listCentsFor,
  perCreditCents,
  priceCentsFor,
  useCreditPriceTable,
} from '@/lib/creditPricing';
import { openCreditsPopup } from '@/lib/purchasePopup';
import { FOCUS_RING, P } from './pricingKit';

const BUNDLES = CREDIT_BUNDLES.pricing;
const DEFAULT_CUSTOM = 15;

// One photo per bundle, from the site's own library. All are landscape, so
// each names where the crop should sit inside a 3:4 frame.
const PHOTOS: Record<number, { src: string; alt: string; position: string; name: string }> = {
  1: { src: '/onboarding/podium-01.jpg', alt: 'A single microphone on a stand, the room out of focus behind it', position: '46% 42%', name: 'One application' },
  10: { src: '/onboarding/handshake-01.jpg', alt: 'Two people shaking hands across a table', position: '50% 50%', name: 'A season of applying' },
  25: { src: '/onboarding/hall-01.jpg', alt: 'An audience seated in a dark hall, lit from the stage', position: '52% 62%', name: 'A whole delegation' },
  50: { src: '/landing/podium-speaker.jpg', alt: 'A speaker at a lectern with a raised fist, a full hall in front of them', position: '30% 45%', name: 'A big society' },
  100: { src: '/onboarding/globe-01.jpg', alt: 'The Earth at night from orbit, city lights glowing', position: '50% 55%', name: 'A year of conferences' },
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

  const priced = useMemo(() => {
    if (!table) return null;
    return {
      total: priceCentsFor(qty, table),
      list: listCentsFor(qty, table),
      pct: discountPctFor(qty, table),
      each: perCreditCents(qty, table),
    };
  }, [qty, table]);

  // Focus the custom field the moment the Custom chip is chosen.
  useEffect(() => {
    if (choice === 'custom') customInputRef.current?.focus();
  }, [choice]);

  const commitCustom = useCallback((raw: string) => {
    const n = clampQty(parseInt(raw, 10), table);
    setCustomQty(n);
    setCustomText(String(n));
  }, [table]);

  const stepCustom = (delta: number) => {
    const n = clampQty(customQty + delta, table);
    setCustomQty(n);
    setCustomText(String(n));
  };

  const confirm = () => {
    if (!table) return;
    openCreditsPopup({ context: 'pricing', preselect: qty });
  };

  // Roving focus for the two radiogroups: arrow keys move and select.
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const chipChoices: Choice[] = [...BUNDLES, 'custom'];

  const onGroupKey = (
    e: KeyboardEvent,
    items: Choice[],
    refs: RefObject<(HTMLElement | null)[]>,
    current: number,
  ) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % items.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setChoice(items[next]);
    refs.current[next]?.focus();
  };

  const selectedName = choice === 'custom' ? 'Your own number' : PHOTOS[choice]?.name ?? `${choice} credits`;
  const maxQty = table?.maxQty ?? null;

  return (
    <section className="gv-bp" aria-labelledby="gv-bp-title" style={{ fontFamily: OUTFIT }}>
      <style>{`
        .gv-bp{container-type:inline-size;padding-top:64px;scroll-margin-top:96px}
        .gv-bp-grid{display:grid;grid-template-columns:1fr;gap:32px}
        .gv-bp-left{min-width:0}
        .gv-bp-eyebrow{margin:0 0 10px;font-size:12.5px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${P.goldDeep}}
        .gv-bp-title{margin:0;font-size:clamp(30px,3.6vw,42px);font-weight:800;letter-spacing:-0.02em;line-height:1.05;color:${P.ink}}
        .gv-bp-lead{margin:12px 0 0;font-size:16px;line-height:1.55;color:${P.inkSoft};max-width:40ch}
        .gv-bp-pick{margin-top:28px;padding-top:24px;border-top:1px solid rgba(27,56,40,0.14)}
        .gv-bp-pick-name{margin:0;font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${P.inkSoft}}
        .gv-bp-big{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-top:4px}
        .gv-bp-num{font-size:clamp(64px,9vw,96px);font-weight:900;letter-spacing:-0.045em;line-height:0.95;color:${P.ink};font-variant-numeric:tabular-nums}
        .gv-bp-unit{font-size:22px;font-weight:700;color:${P.inkSoft};letter-spacing:-0.01em}
        .gv-bp-facts{display:flex;align-items:center;flex-wrap:wrap;gap:10px 14px;margin-top:14px;min-height:32px}
        .gv-bp-save{display:inline-flex;align-items:center;min-height:32px;padding:0 12px;border-radius:999px;background:${P.gold};color:${P.ink};font-size:13.5px;font-weight:800;letter-spacing:0.02em}
        .gv-bp-each{font-size:16px;font-weight:600;color:${P.ink};font-variant-numeric:tabular-nums}
        .gv-bp-each b{font-weight:800}
        .gv-bp-was{font-size:14px;color:${P.inkSoft};text-decoration:line-through;font-variant-numeric:tabular-nums}
        .gv-bp-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
        .gv-bp-chip{display:inline-flex;align-items:center;justify-content:center;min-width:52px;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid rgba(27,56,40,0.3);background:transparent;color:${P.ink};font-family:${OUTFIT};font-size:15.5px;font-weight:600;cursor:pointer;font-variant-numeric:tabular-nums;transition:background-color 140ms ease-out,color 140ms ease-out,border-color 140ms ease-out}
        .gv-bp-chip:hover{background:rgba(27,56,40,0.07);border-color:${P.forest}}
        .gv-bp-chip[aria-checked="true"]{background:${P.forest};color:#FAF8F3;border-color:${P.forest};font-weight:700}
        .gv-bp-stepper{display:flex;align-items:center;gap:8px;margin-top:14px}
        .gv-bp-step{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;border:1px solid rgba(27,56,40,0.3);background:${P.surface};color:${P.forest};cursor:pointer}
        .gv-bp-step:hover{background:rgba(27,56,40,0.07)}
        .gv-bp-step:disabled{opacity:0.45;cursor:not-allowed}
        .gv-bp-input{width:104px;height:44px;border-radius:12px;border:1px solid rgba(27,56,40,0.3);background:${P.surface};color:${P.ink};font-family:${OUTFIT};font-size:18px;font-weight:700;text-align:center;font-variant-numeric:tabular-nums;-moz-appearance:textfield}
        .gv-bp-input::-webkit-outer-spin-button,.gv-bp-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
        .gv-bp-stepper-hint{font-size:13.5px;color:${P.inkSoft};margin-left:4px}
        .gv-bp-confirm{width:100%;margin-top:22px;min-height:56px;font-size:17px}
        .gv-bp-confirm-note{margin:12px 0 0;font-size:13.5px;line-height:1.5;color:${P.inkSoft}}
        .gv-bp-err{margin:16px 0 0;padding:12px 14px;border-radius:12px;background:rgba(139,32,32,0.08);color:#6E1E1E;font-size:14px;line-height:1.5}
        .gv-bp-err button{margin-left:8px;background:none;border:none;padding:0;color:#6E1E1E;font-family:${OUTFIT};font-weight:700;font-size:14px;cursor:pointer;text-decoration:underline}
        .gv-bp-cards{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -20px;padding:6px 20px 14px;scrollbar-width:none}
        .gv-bp-cards::-webkit-scrollbar{display:none}
        .gv-bp-card{position:relative;flex:0 0 clamp(190px,58%,240px);aspect-ratio:3/4;border-radius:20px;overflow:hidden;scroll-snap-align:start;cursor:pointer;container-type:inline-size;background:${P.forestDeep};outline:none;transition:transform 200ms cubic-bezier(0.22,1,0.36,1),box-shadow 200ms ease-out}
        .gv-bp-card:hover{transform:translateY(-3px);box-shadow:0 18px 32px -18px rgba(27,56,40,0.6)}
        .gv-bp-card[aria-checked="true"]{box-shadow:0 0 0 3px ${P.ivory},0 0 0 6px ${P.goldDeep},0 18px 32px -18px rgba(27,56,40,0.6)}
        .gv-bp-card:focus-visible{box-shadow:0 0 0 3px ${P.ivory},0 0 0 6px ${P.forest}}
        .gv-bp-card[aria-checked="true"]:focus-visible{box-shadow:0 0 0 3px ${P.ivory},0 0 0 6px ${P.forest},0 0 0 9px ${P.goldDeep}}
        .gv-bp-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;transition:transform 400ms cubic-bezier(0.22,1,0.36,1)}
        .gv-bp-card:hover .gv-bp-photo{transform:scale(1.04)}
        .gv-bp-scrim{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(8,20,13,0.62) 0%,rgba(8,20,13,0.12) 34%,rgba(8,20,13,0) 48%),linear-gradient(to top,rgba(8,20,13,0.94) 0%,rgba(8,20,13,0.66) 34%,rgba(8,20,13,0) 60%)}
        .gv-bp-top{position:absolute;top:0;left:0;right:0;display:flex;align-items:flex-start;justify-content:space-between;gap:6px;padding:12cqw 10cqw 0}
        .gv-bp-card-num{font-size:clamp(34px,30cqw,64px);font-weight:900;letter-spacing:-0.05em;line-height:0.9;color:#FFFFFF;font-variant-numeric:tabular-nums;text-shadow:0 2px 12px rgba(0,0,0,0.35)}
        .gv-bp-card-unit{display:block;margin-top:5px;font-size:clamp(10px,7.5cqw,13px);font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.86)}
        .gv-bp-card-save{flex-shrink:0;display:inline-flex;align-items:center;min-height:26px;padding:0 9px;border-radius:999px;background:${P.gold};color:${P.ink};font-size:clamp(10.5px,7.5cqw,13px);font-weight:800;white-space:nowrap;margin-top:2px}
        .gv-bp-bottom{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding:0 10cqw 11cqw}
        .gv-bp-card-each{font-size:clamp(18px,15cqw,28px);font-weight:800;letter-spacing:-0.02em;line-height:1;color:#FFFFFF;font-variant-numeric:tabular-nums}
        .gv-bp-card-each small{display:block;margin-top:5px;font-size:clamp(10.5px,7.5cqw,13px);font-weight:600;letter-spacing:0.02em;color:rgba(255,255,255,0.88)}
        .gv-bp-card-total{display:block;margin-top:6px;font-size:clamp(11px,8cqw,13.5px);font-weight:600;color:rgba(255,255,255,0.88);font-variant-numeric:tabular-nums}
        .gv-bp-disc{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:clamp(32px,22cqw,42px);height:clamp(32px,22cqw,42px);border-radius:50%;background:rgba(250,248,243,0.94);color:${P.forest};transition:background-color 160ms ease-out,color 160ms ease-out}
        .gv-bp-card[aria-checked="true"] .gv-bp-disc{background:${P.forest};color:${P.gold}}
        .gv-bp-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
        @container (min-width:640px){
          .gv-bp-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;overflow:visible;margin:0;padding:0;scroll-snap-type:none}
          .gv-bp-card{flex:none}
        }
        @container (min-width:1000px){
          .gv-bp-grid{grid-template-columns:300px minmax(0,1fr);gap:44px;align-items:start}
          .gv-bp-cards{grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
          .gv-bp-card{border-radius:18px}
        }
        @media (prefers-reduced-motion:reduce){
          .gv-bp-card,.gv-bp-photo,.gv-bp-chip,.gv-bp-disc{transition:none}
          .gv-bp-card:hover{transform:none}
          .gv-bp-card:hover .gv-bp-photo{transform:none}
        }
      `}</style>

      <div className="gv-bp-grid">
        {/* LEFT: the choice, in words and numbers */}
        <div className="gv-bp-left">
          <p className="gv-bp-eyebrow">Bundles</p>
          <h2 id="gv-bp-title" className="gv-bp-title">Pick your bundle</h2>
          <p className="gv-bp-lead">Bigger bundles cost less a credit. Choose one, or type your own number.</p>

          <div className="gv-bp-pick" aria-live="polite">
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
            onKeyDown={(e) => onGroupKey(e, chipChoices, chipRefs, chipChoices.indexOf(choice))}
          >
            {chipChoices.map((c, i) => {
              const checked = c === choice;
              return (
                <button
                  key={String(c)}
                  ref={(el) => { chipRefs.current[i] = el; }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  className={`gv-bp-chip ${FOCUS_RING}`}
                  onClick={() => setChoice(c)}
                >
                  {c === 'custom' ? 'Custom' : c}
                </button>
              );
            })}
          </div>

          {choice === 'custom' && (
            <div className="gv-bp-stepper">
              <button
                type="button"
                className={`gv-bp-step ${FOCUS_RING}`}
                aria-label="One credit fewer"
                onClick={() => stepCustom(-1)}
                disabled={customQty <= 1}
              >
                <Minus size={18} strokeWidth={2.4} aria-hidden />
              </button>
              <input
                ref={customInputRef}
                className={`gv-bp-input ${FOCUS_RING}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={maxQty ?? undefined}
                step={1}
                value={customText}
                aria-label="Number of credits"
                onChange={(e) => {
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
                <Plus size={18} strokeWidth={2.4} aria-hidden />
              </button>
              <span className="gv-bp-stepper-hint">{maxQty ? `Up to ${maxQty}` : '…'}</span>
            </div>
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
          <p className="gv-bp-confirm-note">Payment opens right here, on this page. Your first credit is already free.</p>

          {error && (
            <p className="gv-bp-err" role="alert">
              We could not load the prices just now.
              <button type="button" onClick={retry}>Try again</button>
            </p>
          )}
        </div>

        {/* RIGHT: one photo card per bundle */}
        <div
          className="gv-bp-cards"
          role="radiogroup"
          aria-label="Bundles"
          onKeyDown={(e) => onGroupKey(e, BUNDLES, cardRefs, Math.max(0, BUNDLES.indexOf(qty)))}
        >
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
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setChoice(n); } }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src}
                  alt=""
                  aria-hidden
                  width={600}
                  height={800}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="gv-bp-photo"
                  style={{ objectPosition: photo.position }}
                />
                <div className="gv-bp-scrim" aria-hidden />
                <div className="gv-bp-top" aria-hidden>
                  <div>
                    <span className="gv-bp-card-num">{n}</span>
                    <span className="gv-bp-card-unit">{creditsWord(n)}</span>
                  </div>
                  {pct ? <span className="gv-bp-card-save">Save {pct}%</span> : null}
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
                    {checked ? <Check size={18} strokeWidth={3} /> : <Plus size={18} strokeWidth={2.6} />}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="gv-bp-live" role="status">
        {priced ? `${qty} ${creditsWord(qty)} for ${formatUsd(priced.total)}` : ''}
      </p>
    </section>
  );
}
