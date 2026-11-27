'use client';

// ── The Motion to Save pop-up (prompt 87) ───────────────────────────────────
//
// Once per browser per sale (localStorage gv-sale-seen-<key>, stamped when it
// opens), 4 seconds after the page loads, while a Store sale runs. Never on
// the session runtimes, the crisis, auth, apply, /pay, /manage or /store, and
// never over another gate: it waits on useBasicsGateBlocking() (the auth modal,
// CompleteBasicsGate, NameGate), the purchase pop-up, and any other dialog on
// screen (aria-modal / role=dialog), checked every second until clear, like
// CrisisGiftGate and LiveRoomsGate. Escape, the backdrop, the close button,
// "Maybe later" and "Go to the Store" close it. Focus is trapped while open and
// returns to where it was.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import Portal from '@/components/Portal';
import { useBasicsGateBlocking } from '@/lib/basicsGateState';
import { isPurchasePopupOpen, usePurchasePopup } from '@/lib/purchasePopup';
import { saleEndLabel, useRunningSale, useSaleCountdown, type StoreSale } from '@/lib/storeSale';
import { isLiveRoomsExcludedPath } from '@/components/liveRooms/LiveRoomsGate';
import { unlimitedPricing } from '@/lib/payments';
import { formatUsd } from '@/lib/creditPricing';
import { MotionPlacards } from './MotionPlacards';
import { saleBarExcluded, saleFirstYearPrice } from './SaleBar';

const DELAY_MS = 4000;
const seenKey = (key: string) => `gv-sale-seen-${key}`;

function wasSeen(key: string): boolean {
  try { return window.localStorage.getItem(seenKey(key)) === '1'; } catch { return false; }
}
function markSeen(key: string) {
  try { window.localStorage.setItem(seenKey(key), '1'); } catch { /* once per page visit then */ }
}

function excludedPath(pathname: string | null): boolean {
  if (!pathname) return true;
  if (saleBarExcluded(pathname) || isLiveRoomsExcludedPath(pathname)) return true;
  return pathname === '/manage' || pathname.startsWith('/manage/');
}

/** Another modal layer on screen (ours excluded). */
function otherDialogOpen(): boolean {
  if (isPurchasePopupOpen()) return true;
  return !!document.querySelector('[aria-modal="true"]:not([data-gv-sale-popup]), [role="dialog"]:not([data-gv-sale-popup])');
}

const POP_CSS = `
.gv-sp-back{position:fixed;inset:0;z-index:90;background:rgba(14,15,13,0.62);display:flex;align-items:center;justify-content:center;padding:16px;font-family:var(--font-brand),sans-serif}
.gv-sp{position:relative;width:100%;max-width:840px;max-height:calc(100dvh - 32px);overflow:auto;border-radius:28px;background:#FFFFFF;display:flex;box-shadow:0 30px 80px rgba(14,15,13,0.45)}
.gv-sp-left{flex:0 0 46%;background:#0E0F0D;color:#F6F2E8;display:flex;flex-direction:column;padding:34px 30px 0;min-height:460px;box-sizing:border-box}
.gv-sp-eyebrow{margin:0;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#A8C9B2}
.gv-sp-caps{margin:12px 0 0;font-size:64px;font-weight:900;text-transform:uppercase;letter-spacing:-0.05em;line-height:.86;color:#F6F2E8}
.gv-sp-art{flex:1 1 auto;min-height:200px;margin:18px -30px 0;display:flex;align-items:flex-end}
.gv-sp-right{flex:1 1 auto;padding:34px 32px 28px;display:flex;flex-direction:column;gap:16px;color:#0E0F0D;min-width:0}
.gv-sp-title{margin:0;font-size:20px;font-weight:700;line-height:1.25;padding-right:36px}
.gv-sp-offer{display:flex;gap:16px;align-items:flex-start}
.gv-sp-big{flex:0 0 92px;font-size:38px;font-weight:900;letter-spacing:-0.04em;line-height:1;font-variant-numeric:tabular-nums}
.gv-sp-oname{margin:0;font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.gv-sp-oline{margin:4px 0 0;font-size:14.5px;line-height:1.45;color:#4A4C44}
.gv-sp-rule{height:1px;background:#E4DCCB;border:0;margin:0}
.gv-sp-ends{margin:4px 0 0;font-size:12.5px;font-weight:700;color:#4A4C44}
.gv-sp-cd{display:flex;gap:8px}
.gv-sp-cd-box{flex:1 1 0;min-width:0;padding:10px 6px 8px;border-radius:12px;background:#1B3828;color:#F6F2E8;text-align:center}
.gv-sp-cd-n{display:block;font-size:26px;font-weight:900;line-height:1;font-variant-numeric:tabular-nums}
.gv-sp-cd-w{display:block;margin-top:5px;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.8}
.gv-sp-go{display:flex;align-items:center;justify-content:center;height:52px;border-radius:14px;background:#0E0F0D;color:#F6F2E8;font-size:16px;font-weight:800;text-decoration:none;margin-top:4px}
.gv-sp-go:hover{background:#22251F}
.gv-sp-later{align-self:center;background:none;border:0;padding:4px;font-size:14px;font-weight:600;color:#4A4C44;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.gv-sp-later:hover{color:#0E0F0D}
.gv-sp-x{position:absolute;top:16px;right:16px;width:36px;height:36px;border-radius:999px;border:0;background:#F0EBDD;color:#0E0F0D;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;z-index:1}
.gv-sp-x:hover{background:#E4DCCB}
.gv-sp :is(a,button):focus{outline:none}
.gv-sp :is(a,button):focus-visible{outline:2px solid #1B3828;outline-offset:3px}
@media (max-width:719px){
  .gv-sp{flex-direction:column;border-radius:24px}
  .gv-sp-left{flex:none;min-height:0;padding:26px 22px 0}
  .gv-sp-caps{font-size:46px}
  .gv-sp-art{min-height:0;height:170px;margin:12px -22px 0}
  .gv-sp-right{padding:24px 22px 22px}
  .gv-sp-x{background:rgba(246,242,232,0.14);color:#F6F2E8}
  .gv-sp-big{flex-basis:76px;font-size:32px}
}
`;

export default function SalePopupGate() {
  const pathname = usePathname();
  const sale = useRunningSale();
  const blocking = useBasicsGateBlocking();
  const purchase = usePurchasePopup();
  const [open, setOpen] = useState<StoreSale | null>(null);
  const [loadedAt] = useState(() => Date.now());

  const excluded = excludedPath(pathname);

  useEffect(() => {
    if (open || !sale || excluded || blocking || purchase.open || wasSeen(sale.key)) return undefined;
    let timer = 0;
    const tryOpen = () => {
      if (otherDialogOpen()) { timer = window.setTimeout(tryOpen, 1000); return; }
      markSeen(sale.key);
      setOpen(sale);
    };
    timer = window.setTimeout(tryOpen, Math.max(0, loadedAt + DELAY_MS - Date.now()));
    return () => window.clearTimeout(timer);
  }, [open, sale, excluded, blocking, purchase.open, loadedAt]);

  const close = useCallback(() => setOpen(null), []);

  if (!open || excluded) return null;
  return <SalePopup sale={open} onClose={close} />;
}

function SalePopup({ sale, onClose }: { sale: StoreSale; onClose: () => void }) {
  const cd = useSaleCountdown(sale.ends_at);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Focus in, trapped, Escape closes, focus back where it was.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!dialogRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      try { before?.focus(); } catch { /* the element left the page */ }
    };
  }, [onClose]);

  // The countdown reached zero: the sale is over, nothing to offer.
  useEffect(() => { if (!cd) onClose(); }, [cd, onClose]);

  const first = saleFirstYearPrice(sale.unlimited_year_first_cents);
  const yearPrice = first ?? formatUsd(Math.round(unlimitedPricing(null).yearly * 100));
  const boxes: [string, string][] = cd ? [[cd.d, 'Days'], [cd.h, 'Hours'], [cd.m, 'Minutes'], [cd.s, 'Seconds']] : [];

  return (
    <Portal>
      <style>{POP_CSS}</style>
      <div className="gv-sp-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div
          ref={dialogRef}
          className="gv-sp"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gv-sp-title"
          data-gv-sale-popup=""
        >
          <button ref={closeRef} type="button" className="gv-sp-x" aria-label="Close" onClick={onClose}>
            <X size={18} strokeWidth={2} aria-hidden />
          </button>

          <div className="gv-sp-left">
            <p className="gv-sp-eyebrow">BLACK FRIDAY</p>
            <h2 className="gv-sp-caps">MOTION<br />TO SAVE</h2>
            <div className="gv-sp-art">
              <MotionPlacards right={yearPrice} label={`Double your credits and a year of Unlimited for ${yearPrice}`} />
            </div>
          </div>

          <div className="gv-sp-right">
            <h3 id="gv-sp-title" className="gv-sp-title">Discounts all weekend on Gavelling</h3>
            {sale.credits_bogo ? (
              <div className="gv-sp-offer">
                <span className="gv-sp-big">×2</span>
                <div>
                  <p className="gv-sp-oname">DOUBLE YOUR MUN</p>
                  <p className="gv-sp-oline">Buy one, get one free on all credit purchases, with no expiry on usage.</p>
                </div>
              </div>
            ) : null}
            {sale.credits_bogo && first ? <hr className="gv-sp-rule" /> : null}
            {first ? (
              <div className="gv-sp-offer">
                <span className="gv-sp-big">{first}</span>
                <div>
                  <p className="gv-sp-oname">UNLIMITED FOR {first}</p>
                  <p className="gv-sp-oline">Unlimited applications, guides and MUN for a year. Never spend a credit to apply.</p>
                </div>
              </div>
            ) : null}

            <div>
              <p className="gv-sp-ends">Ends {saleEndLabel(sale.ends_at)}</p>
              {cd ? (
                <div className="gv-sp-cd" role="timer" aria-label={`Ends in ${Number(cd.d)} days, ${Number(cd.h)} hours and ${Number(cd.m)} minutes`} style={{ marginTop: 8 }}>
                  {boxes.map(([n, w]) => (
                    <span key={w} className="gv-sp-cd-box" aria-hidden>
                      <span className="gv-sp-cd-n">{n}</span>
                      <span className="gv-sp-cd-w">{w}</span>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <Link href="/store" className="gv-sp-go" onClick={onClose}>Go to the Store</Link>
            <button type="button" className="gv-sp-later" onClick={onClose}>Maybe later</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
