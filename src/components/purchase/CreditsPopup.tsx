'use client';

// ── The Credits pop-up ───────────────────────────────────────────────────────
//
// LEFT: "Gavelling Credits", what they are for (the uses that fit the
// context), and at the foot "Your credits": the balance now, and the balance
// after this purchase, following the selection live. There is ONE balance in
// every context, the signed-in person's own.
//
// RIGHT: a short title, at most five bundles plus "Another amount", the total
// with the saving, then the payment. Pressing the green button asks the edge
// function for an embedded Checkout session (priced server-side) and Stripe's
// own card form takes the bundle grid's place, with a "Change" link back. With
// no publishable key the button sends the person to Stripe's hosted page
// instead, and the site's return handler finishes the job when they land back.
//
// Owner's rules: no "USD 1 a credit" and no "never expires" anywhere here.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Briefcase, Loader2, Minus, Plus, Ticket, Users } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { GreenButton } from '@/components/auth/authModalKit';
import { useCredits, pollCreditsUntilChanged } from '@/hooks/useCredits';
import {
  CREDIT_BUNDLES, DEFAULT_BUNDLE, clampQty, discountPctFor, formatUsd, listCentsFor, priceCentsFor, useCreditPriceTable,
  type CreditsContext,
} from '@/lib/creditPricing';
import { closePurchasePopup, swapToUnlimited, type CreditsPopupRequest } from '@/lib/purchasePopup';
import { EMBEDDED_CHECKOUT_AVAILABLE, checkoutErrorText, startCreditsCheckout } from '@/lib/purchaseCheckout';
import { notifyOk } from '@/lib/appNotify';
import { StripeEmbeddedForm } from './StripeEmbedded';
import { BenefitList, BrandTitle, ErrorLine, Eyebrow, PurchaseShell, SecureLine, SwapLine, type Benefit } from './purchaseKit';

const USE_APPLY: Benefit = { emoji: 'Ticket', fallback: Ticket, title: 'Apply to conferences', note: 'One credit per conference, however many times you edit.', live: true };
const USE_IMPORT: Benefit = { emoji: 'Busts in silhouette', fallback: Users, title: 'Importing your delegates', note: 'Bring a whole delegation in at once.', live: false };
const USE_JOBS: Benefit = { emoji: 'Briefcase', fallback: Briefcase, title: 'The job board', note: 'Chair and staff roles across conferences.', live: false };

function usesFor(context: CreditsContext): Benefit[] {
  if (context === 'organizer') return [USE_IMPORT, USE_JOBS];
  if (context === 'apply' || context === 'pay') return [USE_APPLY, USE_JOBS];
  return [USE_APPLY, USE_IMPORT, USE_JOBS];
}

const RIGHT_TITLE: Record<CreditsContext, string> = {
  header: 'Pick a bundle',
  pricing: 'Pick a bundle',
  manage: 'Top up your credits',
  apply: 'Add credits and submit',
  pay: 'Credits for your delegation',
  organizer: 'Credits for your imports',
};

const plural = (n: number) => (n === 1 ? 'credit' : 'credits');

export default function CreditsPopup({ request }: { request: CreditsPopupRequest }) {
  const { context, conferenceName, preselect } = request;
  const { user, loading: authLoading } = useAuth();
  const { table, error: tableError, retry } = useCreditPriceTable();
  const { balance } = useCredits();
  const balanceRef = useRef<number | null>(null);
  balanceRef.current = balance;

  const bundles = CREDIT_BUNDLES[context];
  const initial = preselect ?? DEFAULT_BUNDLE[context];
  const [qty, setQty] = useState<number>(initial);
  const [custom, setCustom] = useState<boolean>(!bundles.includes(initial));
  const [typed, setTyped] = useState<string>(String(initial));

  const [stage, setStage] = useState<'choose' | 'pay'>('choose');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [checkout, setCheckout] = useState<{ clientSecret: string; quantity: number; amountCents: number } | null>(null);

  const price = table ? priceCentsFor(qty, table) : null;
  const list = table ? listCentsFor(qty, table) : null;
  const pct = table ? discountPctFor(qty, table) : 0;
  const saving = price !== null && list !== null ? list - price : 0;

  const uses = useMemo(() => usesFor(context), [context]);

  function pick(n: number) {
    setCustom(false);
    setQty(n);
    setErr('');
  }
  function pickCustom() {
    setCustom(true);
    setTyped(String(qty));
  }
  function commitTyped(raw: string) {
    setTyped(raw);
    const n = clampQty(parseInt(raw, 10), table);
    if (raw.trim() !== '') setQty(n);
  }
  function step(delta: number) {
    const n = clampQty(qty + delta, table);
    setQty(n);
    setTyped(String(n));
  }

  async function pay() {
    if (busy || !table) return;
    setBusy(true);
    setErr('');
    try {
      const result = await startCreditsCheckout(qty, EMBEDDED_CHECKOUT_AVAILABLE);
      if (result.kind === 'hosted') {
        window.location.assign(result.url);
        return; // stay busy while the page leaves
      }
      setCheckout({ clientSecret: result.clientSecret, quantity: result.quantity, amountCents: result.amountCents });
      setStage('pay');
    } catch (e) {
      setErr(checkoutErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  const onComplete = useCallback(() => {
    const q = checkout?.quantity ?? qty;
    const prev = balanceRef.current;
    closePurchasePopup();
    notifyOk(`Payment received. Adding ${q} ${plural(q)} to your account.`, 'purchase');
    void pollCreditsUntilChanged(prev).then((now) => {
      if (now !== null) notifyOk(`${q} ${plural(q)} added. You now have ${now}.`, 'purchase');
      request.onComplete?.();
    });
  }, [checkout, qty, request]);

  // The table can only fail on a network hiccup; try once more by itself.
  useEffect(() => {
    if (!tableError) return;
    const t = setTimeout(retry, 2500);
    return () => clearTimeout(t);
  }, [tableError, retry]);

  const signedOut = !authLoading && !user;
  const label = context === 'apply' && conferenceName ? `Buy credits for ${conferenceName}` : 'Buy Gavelling credits';

  return (
    <PurchaseShell tone="light" label={label} onClose={closePurchasePopup} testId="credits-popup">
      <div className="gv-buy-left">
        <BrandTitle
          word="Credits"
          sub={context === 'apply' && conferenceName
            ? <>For your application to <strong style={{ fontWeight: 600, color: '#222' }}>{conferenceName}</strong>.</>
            : 'Buy a few or a lot. They wait in your account until you apply.'}
        />
        <div>
          <Eyebrow>What they&apos;re for</Eyebrow>
          <BenefitList items={uses} />
        </div>
        <div className="gv-buy-balance">
          <Eyebrow>Your credits</Eyebrow>
          <div className="gv-buy-balance-row" aria-live="polite">
            <div className="gv-buy-balance-cell">
              <span className="gv-buy-balance-big">{balance === null ? '–' : balance}</span>
              <span className="gv-buy-balance-cap">now</span>
            </div>
            <ArrowRight size={18} strokeWidth={2.2} className="gv-buy-balance-arrow" aria-hidden />
            <div className="gv-buy-balance-cell">
              <span className="gv-buy-balance-big gv-buy-after">{balance === null ? '–' : balance + qty}</span>
              <span className="gv-buy-balance-cap">after this purchase</span>
            </div>
          </div>
        </div>
      </div>

      <div className="gv-buy-right">
        {signedOut ? (
          <>
            <h3 className="gv-buy-rtitle">Log in to buy credits</h3>
            <p className="gv-buy-sub" style={{ margin: 0 }}>Credits live on your account, so we need to know whose they are.</p>
            <GreenButton type="button" onClick={() => { closePurchasePopup(); openAuth(); }}>Log in or sign up</GreenButton>
          </>
        ) : stage === 'pay' && checkout ? (
          <>
            <h3 className="gv-buy-rtitle">Pay with card</h3>
            <div className="gv-buy-change">
              <span><strong>{checkout.quantity} {plural(checkout.quantity)}</strong> for <strong>{formatUsd(checkout.amountCents)}</strong></span>
              <button type="button" className="gv-buy-changebtn" onClick={() => { setStage('choose'); setCheckout(null); }}>Change</button>
            </div>
            <div className="gv-buy-form">
              <StripeEmbeddedForm clientSecret={checkout.clientSecret} onComplete={onComplete} />
            </div>
            <SecureLine />
          </>
        ) : (
          <>
            <h3 className="gv-buy-rtitle">{RIGHT_TITLE[context]}</h3>

            <div className="gv-buy-grid" role="radiogroup" aria-label="How many credits">
              {bundles.map((n) => {
                const on = !custom && qty === n;
                const p = table ? discountPctFor(n, table) : 0;
                return (
                  <button key={n} type="button" role="radio" aria-checked={on} className="gv-buy-chip" onClick={() => pick(n)}>
                    {p > 0 && <span className="gv-buy-save">Save {p}%</span>}
                    <span className="gv-buy-chip-qty">{n}</span>
                    <span className="gv-buy-chip-unit">{plural(n)}</span>
                    <span className="gv-buy-chip-price">{table ? formatUsd(priceCentsFor(n, table)) : '…'}</span>
                  </button>
                );
              })}
              <button type="button" role="radio" aria-checked={custom} className="gv-buy-chip" onClick={pickCustom}>
                <span className="gv-buy-chip-qty" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>Another amount</span>
                <span className="gv-buy-chip-unit">up to {table?.maxQty ?? 500}</span>
                <span className="gv-buy-chip-price">{custom && table ? formatUsd(priceCentsFor(qty, table)) : ' '}</span>
              </button>
            </div>

            {custom ? (
              <div className="gv-buy-stepper" style={{ justifyContent: 'center' }}>
                <button type="button" className="gv-buy-step" aria-label="Fewer credits" onClick={() => step(-1)} disabled={qty <= 1}><Minus size={15} strokeWidth={2.4} /></button>
                <input
                  className="gv-buy-stepin"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={table?.maxQty ?? 500}
                  value={typed}
                  aria-label="Number of credits"
                  onChange={(e) => commitTyped(e.target.value)}
                  onBlur={() => setTyped(String(qty))}
                />
                <button type="button" className="gv-buy-step" aria-label="More credits" onClick={() => step(1)} disabled={!!table && qty >= table.maxQty}><Plus size={15} strokeWidth={2.4} /></button>
              </div>
            ) : null}

            <div className="gv-buy-total" aria-live="polite">
              <div>
                <div className="gv-buy-total-label">{qty} {plural(qty)}</div>
                {saving > 0 && <div className="gv-buy-total-saving">Save {formatUsd(saving)} ({pct}% off)</div>}
              </div>
              <div className="gv-buy-total-amount">{price === null ? '…' : formatUsd(price)}</div>
            </div>

            {tableError && !table ? (
              <ErrorLine>We could not load prices just now. Trying again…</ErrorLine>
            ) : null}
            {err ? <ErrorLine>{err}</ErrorLine> : null}

            <GreenButton type="button" onClick={pay} busy={busy} busyText="Preparing your payment…" disabled={!table || price === null}>
              {price === null ? 'Loading prices…' : `Pay ${formatUsd(price)}`}
            </GreenButton>
            {busy && !EMBEDDED_CHECKOUT_AVAILABLE ? (
              <p className="gv-buy-wait"><Loader2 size={15} className="animate-spin" aria-hidden /> Taking you to Stripe…</p>
            ) : null}
            <SecureLine />
            <SwapLine lead="Need more Gavelling?" action="Go Unlimited" onClick={swapToUnlimited} />
          </>
        )}
      </div>
    </PurchaseShell>
  );
}
