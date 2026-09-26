'use client';

// ── The Credits pop-up ───────────────────────────────────────────────────────
//
// LEFT, cream: "Gavelling Credits", what they are for (the uses that fit the
// context), and at the foot "Your credits": the balance now and the balance
// after this purchase, two big numbers with an arrow between them, following
// the selection live. There is ONE balance in every context, the signed-in
// person's own.
//
// RIGHT, forest: a short title, at most five bundles plus "Another amount",
// the total with the saving (and, on a custom amount, the nudge to the next
// tier when it is cheaper), then the gold PAY button. Pressing it asks the
// edge function for an embedded Checkout session (priced server-side) and
// Stripe's own white card form takes the bundle grid's place in an inset well,
// with a "Change" link back. With no publishable key the button sends the
// person to Stripe's hosted page instead, and the site's return handler
// finishes the job when they land back.
//
// Owner's rules: no "USD 1 a credit" and no "never expires" anywhere here.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Briefcase, Loader2, Minus, Plus, Sparkles, Ticket, Users } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { useCredits, pollCreditsUntilChanged, refreshCreditsEverywhere } from '@/hooks/useCredits';
import {
  CREDIT_BUNDLES, DEFAULT_BUNDLE, clampQty, discountPctFor, formatUsd, listCentsFor, nextTierNudge, priceCentsFor, useCreditPriceTable,
  type CreditsContext,
} from '@/lib/creditPricing';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { closePurchasePopup, swapToUnlimited, type CreditsPopupRequest } from '@/lib/purchasePopup';
import { EMBEDDED_CHECKOUT_AVAILABLE, checkoutErrorText, startCreditsCheckout } from '@/lib/purchaseCheckout';
import { notifyOk } from '@/lib/appNotify';
import { StripeEmbeddedForm } from './StripeEmbedded';
import { BenefitList, BrandTitle, ErrorLine, Eyebrow, FOREST, GoldButton, INK, PurchaseShell, SwapLine, type Benefit } from './purchaseKit';

const USE_APPLY: Benefit = { emoji: 'Ticket', fallback: Ticket, title: 'Apply to conferences', note: 'One credit per conference, however many times you edit.', live: true };
const USE_IMPORT: Benefit = { emoji: 'Busts in silhouette', fallback: Users, title: 'Importing your delegates', note: 'Bring a whole delegation in at once.', live: false };
const USE_IMPORT_LIVE: Benefit = { emoji: 'Busts in silhouette', fallback: Users, title: 'Importing your delegates', note: 'One credit per delegate you import', live: true };
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
  const { context, conferenceName, preselect, purpose, delegationName, destination } = request;
  const [dest, setDest] = useState<'conference' | 'account'>(destination?.initial ?? 'account');
  // The move into the conference runs once per purchase, however often the
  // completion fires.
  const movedRef = useRef(false);
  const forImport = purpose === 'import';
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
  // Only on the "Another amount" path, and only from the table.
  const nudge = custom && table ? nextTierNudge(qty, table) : null;

  const uses = useMemo(() => (forImport ? [USE_IMPORT_LIVE, USE_APPLY] : usesFor(context)), [context, forImport]);

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
  /** The nudge: jump to the tier's quantity, staying in custom mode. */
  function takeNudge(n: number) {
    setQty(n);
    setTyped(String(n));
    setErr('');
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
    void pollCreditsUntilChanged(prev).then(async (now) => {
      if (destination && dest === 'conference' && !movedRef.current) {
        movedRef.current = true;
        const client = await getFreshAuthedClient();
        const moved = client
          ? await client.rpc('store_transfer_in', { p_conf: destination.conferenceId, p_qty: q })
          : null;
        const answer = (moved?.data ?? null) as { ok?: boolean; message?: string } | null;
        if (moved && !moved.error && answer?.ok === true) {
          notifyOk(`${q} ${plural(q)} added to this conference.`, 'purchase');
        } else {
          notifyOk(`${q} ${plural(q)} are in your account. Move them into the conference with Transfer.`, 'purchase');
        }
        refreshCreditsEverywhere();
      } else if (now !== null) {
        notifyOk(`${q} ${plural(q)} added. You now have ${now}.`, 'purchase');
      }
      request.onComplete?.();
    });
  }, [checkout, qty, request, destination, dest]);

  // The table can only fail on a network hiccup; try once more by itself.
  useEffect(() => {
    if (!tableError) return;
    const t = setTimeout(retry, 2500);
    return () => clearTimeout(t);
  }, [tableError, retry]);

  const signedOut = !authLoading && !user;
  const label = forImport
    ? (delegationName ? `Buy credits to import delegates into ${delegationName}` : 'Buy credits to import your delegates')
    : context === 'apply' && conferenceName ? `Buy credits for ${conferenceName}` : 'Buy Gavelling credits';

  return (
    <PurchaseShell tone="light" label={label} onClose={closePurchasePopup} testId="credits-popup">
      <div className="gv-buy-left">
        <BrandTitle
          word="Credits"
          tone="light"
          sub={forImport || purpose === 'store'
            ? <>It seems you don&apos;t have enough credits for this</>
            : context === 'apply' && conferenceName
            ? <>For your application to <strong style={{ fontWeight: 600, color: INK }}>{conferenceName}</strong></>
            : undefined}
        />
        <div>
          <Eyebrow>What they&apos;re for</Eyebrow>
          <BenefitList items={uses} tone="light" />
        </div>
        <div className="gv-buy-balance">
          <Eyebrow>Your credits</Eyebrow>
          <div className="gv-buy-balance-row" aria-live="polite">
            <div className="gv-buy-balance-cell">
              <span className="gv-buy-balance-big">{balance === null ? '–' : balance}</span>
              <span className="gv-buy-balance-cap">now</span>
            </div>
            <ArrowRight size={24} strokeWidth={2.4} className="gv-buy-balance-arrow" style={{ color: FOREST }} aria-hidden />
            <div className="gv-buy-balance-cell">
              <span className="gv-buy-balance-big gv-buy-after">{balance === null ? '–' : balance + qty}</span>
              <span className="gv-buy-balance-cap">after this purchase</span>
            </div>
          </div>
        </div>
      </div>

      <div className="gv-buy-right gv-buy-dark">
        {signedOut ? (
          <>
            <h3 className="gv-buy-rtitle">Log in to buy credits</h3>
            <p className="gv-buy-sub" style={{ margin: 0 }}>Credits live on your account, so we need to know whose they are.</p>
            <GoldButton onClick={() => { closePurchasePopup(); openAuth(); }}>LOG IN OR SIGN UP</GoldButton>
          </>
        ) : stage === 'pay' && checkout ? (
          <>
            <h3 className="gv-buy-rtitle">Pay with Card</h3>
            <div className="gv-buy-change">
              <span><strong>{checkout.quantity} {plural(checkout.quantity)}</strong> for <strong>{formatUsd(checkout.amountCents)}</strong></span>
              <button type="button" className="gv-buy-changebtn" onClick={() => { setStage('choose'); setCheckout(null); }}>Change</button>
            </div>
            <div className="gv-buy-formwell">
              <div className="gv-buy-form">
                <StripeEmbeddedForm clientSecret={checkout.clientSecret} onComplete={onComplete} />
              </div>
            </div>
          </>
        ) : (
          <>
            <h3 className="gv-buy-rtitle">{RIGHT_TITLE[context]}</h3>

            {destination && (
              <div className="gv-buy-plans" role="radiogroup" aria-label="Where the credits go" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <button type="button" role="radio" aria-checked={dest === 'conference'} className="gv-buy-plan" style={{ minHeight: 0, padding: '12px 14px' }} onClick={() => setDest('conference')}>
                  <span className="gv-buy-plan-name">Add to this conference</span>
                  <span className="gv-buy-plan-per">Conference credits, still yours to move back</span>
                </button>
                <button type="button" role="radio" aria-checked={dest === 'account'} className="gv-buy-plan" style={{ minHeight: 0, padding: '12px 14px' }} onClick={() => setDest('account')}>
                  <span className="gv-buy-plan-name">Add to my account</span>
                  <span className="gv-buy-plan-per">Your own credits</span>
                </button>
              </div>
            )}

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
                <span className="gv-buy-chip-price">{custom && table ? formatUsd(priceCentsFor(qty, table)) : ' '}</span>
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

            {nudge ? (
              <button type="button" className="gv-buy-nudge" onClick={() => takeNudge(nudge.qty)} data-testid="credits-nudge">
                <Sparkles size={15} strokeWidth={2.2} aria-hidden />
                <span>
                  <b>{nudge.extra}</b> more {plural(nudge.extra)} {nudge.extra === 1 ? 'saves' : 'save'} you <b>{formatUsd(nudge.saves)}</b>
                </span>
              </button>
            ) : null}

            {tableError && !table ? (
              <ErrorLine>We could not load prices just now. Trying again…</ErrorLine>
            ) : null}
            {err ? <ErrorLine>{err}</ErrorLine> : null}

            <GoldButton onClick={pay} busy={busy} busyText="PREPARING YOUR PAYMENT…" disabled={!table || price === null} testId="credits-pay">
              {price === null ? 'LOADING PRICES…' : `PAY ${formatUsd(price)}`}
            </GoldButton>
            {busy && !EMBEDDED_CHECKOUT_AVAILABLE ? (
              <p className="gv-buy-wait"><Loader2 size={15} className="animate-spin" aria-hidden /> Taking you to Stripe…</p>
            ) : null}
            <SwapLine lead="Need more Gavelling?" action="Go Unlimited" onClick={swapToUnlimited} />
          </>
        )}
      </div>
    </PurchaseShell>
  );
}
