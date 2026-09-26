'use client';

// storeKit.tsx — the Conference Store's visual kit. Ivory page, white cards
// with a soft forest-tinted shadow, forest and gold as accents only. Buttons
// UPPERCASE. The balances copy the header credit chip (CreditCoin + number).
// The Transfer pop-up reuses the purchase kit's panel (PURCHASE_CSS is
// mounted by the page while any Store pop-up is open).

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { CreditCoin } from '@/components/CreditCoin';
import { OUTFIT } from '@/components/neu';
import { InfoHint } from '../settings/applicationsUi';
import { PurchaseShell, ErrorLine, GoldButton } from '@/components/purchase/purchaseKit';
import { authedClient, messageOf, readStoreState, type StoreAnswer, type StoreState } from './storeApi';
import { friendlyError } from '@/lib/friendlyError';
import { refreshCreditsEverywhere } from '@/hooks/useCredits';

export const INK = '#1C1410';
export const INK_SOFT = '#5A5046';
export const FOREST = '#1B3828';
export const GOLD = '#EED98A';
export const DEEP_GOLD = '#B6871F';
export const IVORY = '#FAF8F3';
export const LINE = 'rgba(27,56,40,0.12)';
export const DANGER = '#8B2020';

export const STORE_CSS = `
.gv-st{font-family:${OUTFIT};color:${INK}}
.gv-st-card{position:relative;background:#FFFFFF;border-radius:20px;padding:22px 22px 20px;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 18px 40px -32px rgba(27,56,40,0.35)}
.gv-st-card-head{display:flex;align-items:center;gap:8px;margin:0 0 4px}
.gv-st-card-title{margin:0;font-size:17px;font-weight:800;letter-spacing:-0.01em;color:${INK}}
.gv-st-card-line{margin:0 0 14px;font-size:13.5px;line-height:1.5;color:${INK_SOFT}}
.gv-st-sec{margin:0 0 4px;font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${INK}}
.gv-st-sec-line{margin:0 0 14px;font-size:14px;color:${INK_SOFT}}
.gv-st-big{font-size:34px;font-weight:900;letter-spacing:-0.03em;line-height:1;font-variant-numeric:tabular-nums;color:${FOREST}}
.gv-st-big-cap{display:block;margin-top:4px;font-size:12.5px;font-weight:600;color:${INK_SOFT}}
.gv-st-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 18px;border-radius:12px;border:none;cursor:pointer;font-family:${OUTFIT};font-size:13.5px;font-weight:700;letter-spacing:0.01em;text-decoration:none;transition:background-color 140ms ease,transform 120ms ease,opacity 140ms ease}
.gv-st-btn:active{transform:scale(0.985)}
.gv-st-btn:disabled{opacity:0.55;cursor:default;transform:none}
.gv-st-btn:focus{outline:none}
.gv-st-btn:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-st-forest{background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%);color:${GOLD}}
.gv-st-forest:hover:not(:disabled){background:linear-gradient(90deg,#234a35 0%,#33694a 100%)}
.gv-st-outline{background:#FFFFFF;color:${INK};box-shadow:inset 0 0 0 1.5px ${INK}}
.gv-st-outline:hover:not(:disabled){background:${IVORY}}
.gv-st-link{background:none;border:none;padding:0;font-family:${OUTFIT};font-size:13.5px;font-weight:700;color:${FOREST};text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.gv-st-link:focus{outline:none}
.gv-st-link:focus-visible{outline:2px solid ${FOREST};outline-offset:2px;border-radius:4px}
.gv-st-quiet{margin:0;font-size:13px;line-height:1.5;color:${INK_SOFT}}
.gv-st-err{margin:8px 0 0;font-size:13px;line-height:1.5;color:${DANGER}}
.gv-st-ok{margin:8px 0 0;font-size:13px;font-weight:600;line-height:1.5;color:#2A5A3C}

/* Balances, top right: two chips like the header's credit counter */
.gv-st-bal{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap}
.gv-st-bal-cell{display:flex;flex-direction:column;align-items:center;gap:5px}
.gv-st-bal-chip{display:inline-flex;align-items:center;gap:8px;min-height:42px;padding:0 16px 0 12px;border-radius:999px;border:none;background:${FOREST};color:#FFFFFF;font-family:${OUTFIT};font-size:16px;font-weight:800;font-variant-numeric:tabular-nums;cursor:pointer;transition:background-color 140ms ease,transform 120ms ease;box-shadow:0 6px 16px -10px rgba(27,56,40,0.6)}
.gv-st-bal-chip:hover{background:#2A5A3C}
.gv-st-bal-chip:active{transform:scale(0.97)}
.gv-st-bal-chip:focus{outline:none}
.gv-st-bal-chip:focus-visible{outline:2px solid ${DEEP_GOLD};outline-offset:2px}
.gv-st-bal-cap{font-size:11.5px;font-weight:600;line-height:1.25;text-align:center;color:${INK_SOFT}}
.gv-st-bal-transfer{min-height:40px;padding:0 14px;align-self:flex-start;margin-top:1px}
.gv-st-bal-link{align-self:center;margin-top:6px}

/* Product cards: a picture, the name UPPERCASE and bold, the price */
.gv-st-products{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.gv-st-product{position:relative;display:flex;flex-direction:column;border-radius:22px;overflow:hidden;background:#14301F;cursor:pointer;text-align:left;border:none;padding:0;font-family:${OUTFIT};box-shadow:0 18px 32px -22px rgba(27,56,40,0.7);transition:transform 200ms cubic-bezier(0.22,1,0.36,1)}
.gv-st-product:hover{transform:translateY(-3px)}
.gv-st-product:focus{outline:none}
.gv-st-product:focus-visible{box-shadow:0 0 0 3px #FFFFFF,0 0 0 7px ${FOREST}}
.gv-st-product-img{position:relative;aspect-ratio:4/3;overflow:hidden}
.gv-st-product-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;transition:transform 400ms cubic-bezier(0.22,1,0.36,1)}
.gv-st-product:hover .gv-st-product-img img{transform:scale(1.04)}
.gv-st-product-scrim{position:absolute;inset:0;background:linear-gradient(to top,rgba(8,20,13,0.9) 0%,rgba(8,20,13,0.35) 45%,rgba(8,20,13,0) 70%)}
.gv-st-product-name{position:absolute;left:16px;right:16px;bottom:14px;font-size:20px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#FFFFFF;text-shadow:0 2px 12px rgba(0,0,0,0.45)}
.gv-st-product-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px 14px;background:#FFFFFF}
.gv-st-product-price{font-size:15px;font-weight:800;color:${INK};font-variant-numeric:tabular-nums}
.gv-st-product-price small{display:block;font-size:12px;font-weight:600;color:${INK_SOFT}}
.gv-st-product-was{font-size:13px;color:${INK_SOFT};text-decoration:line-through;font-variant-numeric:tabular-nums;margin-left:6px}
.gv-st-product-note{padding:0 16px 14px;background:#FFFFFF;font-size:12.5px;line-height:1.45;color:${INK_SOFT}}
.gv-st-flag{position:absolute;top:12px;left:12px;font-size:10.5px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;padding:4px 9px;border-radius:999px;background:${GOLD};color:${INK};box-shadow:0 2px 6px rgba(0,0,0,0.25)}
.gv-st-product-hint{position:absolute;top:12px;right:12px;z-index:2}

/* Meter */
.gv-st-meter{height:8px;border-radius:999px;background:rgba(27,56,40,0.1);overflow:hidden}
.gv-st-meter > span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#1B3828,#2A5A3C)}

/* Your spotlights */
.gv-st-rows{display:flex;flex-direction:column;gap:10px}
.gv-st-row{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:flex-start;justify-content:space-between;padding:14px 16px;border-radius:14px;background:${IVORY}}
.gv-st-row-title{margin:0;font-size:15.5px;font-weight:800;color:${INK}}
.gv-st-row-sub{margin:2px 0 0;font-size:13px;color:${INK_SOFT};line-height:1.5;overflow-wrap:anywhere}
.gv-st-status{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700}
.gv-st-stat{font-size:13px;color:${INK_SOFT}}
.gv-st-stat b{font-size:15px;font-weight:800;color:${INK};font-variant-numeric:tabular-nums}

/* Small dialog (Transfer): the purchase panel, one column, narrow */
.gv-buy-panel.gv-st-small{max-width:460px;min-height:0}
.gv-buy-panel.gv-st-small .gv-buy-body{flex-direction:column}
.gv-buy-panel.gv-st-small .gv-buy-left{flex:1 1 auto}
.gv-buy-panel.gv-st-small .gv-buy-gold{text-transform:none;letter-spacing:0.01em}
.gv-st-dir{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.gv-st-dir button{min-height:44px;border-radius:12px;border:1.5px solid rgba(27,56,40,0.28);background:transparent;color:${INK};font-family:${OUTFIT};font-size:13.5px;font-weight:700;cursor:pointer}
.gv-st-dir button[aria-checked="true"]{background:${FOREST};color:${GOLD};border-color:${FOREST}}
.gv-st-field{width:100%;height:52px;border-radius:12px;border:1.5px solid rgba(27,56,40,0.28);background:${IVORY};color:${INK};font-family:${OUTFIT};font-size:20px;font-weight:800;text-align:center;font-variant-numeric:tabular-nums;-moz-appearance:textfield}
.gv-st-field::-webkit-outer-spin-button,.gv-st-field::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.gv-st-field:focus{outline:none;border-color:${FOREST};box-shadow:0 0 0 3px #FFFFFF,0 0 0 6px ${FOREST}}
.gv-st-ba{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.gv-st-ba-cell{padding:12px 14px;border-radius:12px;background:${IVORY}}
.gv-st-ba-cap{margin:0 0 6px;font-size:11.5px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT}}
.gv-st-ba-nums{display:flex;align-items:center;gap:8px;font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;color:${INK}}
.gv-st-ba-nums .after{color:${FOREST}}

@media (min-width:860px){
  .gv-st-products{grid-template-columns:repeat(4,minmax(0,1fr))}
  .gv-st-products.gv-st-two{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (prefers-reduced-motion:reduce){.gv-st-product,.gv-st-product-img img{transition:none}.gv-st-product:hover{transform:none}.gv-st-product:hover .gv-st-product-img img{transform:none}}
`;

export function StoreCard({ title, line, hint, children, style }: {
  title: string; line?: string; hint: string; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <section className="gv-st-card" aria-label={title} style={style}>
      <div className="gv-st-card-head">
        <h3 className="gv-st-card-title">{title}</h3>
        <InfoHint label={`About ${title}`} text={hint} size={16} />
      </div>
      {line ? <p className="gv-st-card-line">{line}</p> : null}
      {children}
    </section>
  );
}

export function Big({ n, cap }: { n: number | string; cap: string }) {
  return (
    <div>
      <span className="gv-st-big">{n}</span>
      <span className="gv-st-big-cap">{cap}</span>
    </div>
  );
}

/** The two balances, top right (25 Sep 2026): each coin pill opens the
 *  organizer credits pop-up (Conference preselects "Add to this conference",
 *  Your Credits "Add to my account"); Transfer between them is a real button. */
export function Balances({ state, onTransfer, onAdd }: {
  state: StoreState;
  onTransfer: () => void;
  onAdd: (where: 'conference' | 'account') => void;
}) {
  return (
    <div className="gv-st-bal" aria-label="Credit balances">
      <div className="gv-st-bal-cell">
        <button type="button" className="gv-st-bal-chip" onClick={() => onAdd('conference')} aria-label={`Conference credits: ${state.conference_credits}. Add credits to this conference`}>
          <CreditCoin size={18} />{state.conference_credits}
        </button>
        <span className="gv-st-bal-cap">Conference<br />Credits</span>
      </div>
      <button type="button" className="gv-st-btn gv-st-outline gv-st-bal-transfer" onClick={onTransfer}>Transfer</button>
      <div className="gv-st-bal-cell">
        <button type="button" className="gv-st-bal-chip" onClick={() => onAdd('account')} aria-label={`Your credits: ${state.your_credits}. Add credits to your account`}>
          <CreditCoin size={18} />{state.your_credits}
        </button>
        <span className="gv-st-bal-cap">Your<br />Credits</span>
      </div>
    </div>
  );
}

// ── Transfer pop-up ────────────────────────────────────────────────────────

export function TransferDialog({ conferenceId, state, onClose, onChanged }: {
  conferenceId: string; state: StoreState; onClose: () => void; onChanged: (s: StoreState) => void;
}) {
  const [dir, setDir] = useState<'in' | 'out'>('in');
  const [text, setText] = useState('10');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);

  const qty = Math.max(0, Math.min(1000, parseInt(text, 10) || 0));
  const cap = dir === 'in' ? state.your_credits : state.mine_in_conference;
  const confAfter = dir === 'in' ? state.conference_credits + qty : state.conference_credits - qty;
  const yourAfter = dir === 'in' ? state.your_credits - qty : state.your_credits + qty;
  const invalid = qty < 1 || qty > cap;

  const go = useCallback(async () => {
    if (busyRef.current || invalid) return;
    busyRef.current = true;
    setBusy(true);
    setErr('');
    try {
      const client = await authedClient();
      const { data, error } = await client.rpc(dir === 'in' ? 'store_transfer_in' : 'store_transfer_out', { p_conf: conferenceId, p_qty: qty });
      if (error) throw error;
      const a = data as StoreAnswer;
      const next = readStoreState(a);
      if (!next) {
        setErr(messageOf(a, 'The transfer could not be made. Try again in a moment.'));
        return;
      }
      refreshCreditsEverywhere();
      onChanged(next);
      onClose();
    } catch (e) {
      setErr(friendlyError(e, 'The transfer could not be made. Try again in a moment.'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [conferenceId, dir, qty, invalid, onChanged, onClose]);

  useEffect(() => {
    // A direction switch resets the amount to something that fits.
    setText(String(Math.min(10, Math.max(1, cap))));
  }, [dir, cap]);

  return (
      <PurchaseShell tone="light" label="Transfer credits" onClose={onClose} testId="store-transfer" panelClass="gv-st-small">
        <div className="gv-buy-left" style={{ gap: 16 }}>
          <div>
            <h2 className="gv-buy-rtitle" style={{ fontSize: 24 }}>Transfer Credits</h2>
            <p className="gv-buy-sub" style={{ marginTop: 6 }}>Credits in the conference are spent by the whole team</p>
          </div>
          <div className="gv-st-dir" role="radiogroup" aria-label="Direction">
            <button type="button" role="radio" aria-checked={dir === 'in'} onClick={() => setDir('in')}>Into the conference</button>
            <button type="button" role="radio" aria-checked={dir === 'out'} onClick={() => setDir('out')}>Back to me</button>
          </div>
          <div>
            <label htmlFor="gv-st-transfer-qty" className="gv-st-ba-cap" style={{ display: 'block' }}>Amount</label>
            <input
              id="gv-st-transfer-qty"
              type="number"
              inputMode="numeric"
              min={1}
              max={Math.max(1, cap)}
              value={text}
              onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              className="gv-st-field"
              aria-invalid={invalid}
            />
            <p className="gv-st-quiet" style={{ marginTop: 8 }}>
              {dir === 'out'
                ? `You can take back up to ${state.mine_in_conference}, the credits you put in that nobody used`
                : `You have ${state.your_credits} ${state.your_credits === 1 ? 'credit' : 'credits'} to move`}
            </p>
          </div>
          <div className="gv-st-ba" aria-live="polite">
            <div className="gv-st-ba-cell">
              <p className="gv-st-ba-cap">Conference</p>
              <div className="gv-st-ba-nums">
                <span>{state.conference_credits}</span>
                <ArrowRight size={16} strokeWidth={2.6} aria-hidden style={{ color: FOREST }} />
                <span className="after">{invalid ? state.conference_credits : confAfter}</span>
              </div>
            </div>
            <div className="gv-st-ba-cell">
              <p className="gv-st-ba-cap">Your credits</p>
              <div className="gv-st-ba-nums">
                <span>{state.your_credits}</span>
                <ArrowRight size={16} strokeWidth={2.6} aria-hidden style={{ color: FOREST }} />
                <span className="after">{invalid ? state.your_credits : yourAfter}</span>
              </div>
            </div>
          </div>
          {err ? <ErrorLine>{err}</ErrorLine> : null}
          <GoldButton onClick={() => { void go(); }} busy={busy} busyText="Moving…" disabled={invalid}>
            {dir === 'in' ? `Move ${qty} into the conference` : `Take ${qty} back`}
          </GoldButton>
        </div>
      </PurchaseShell>
  );
}
