'use client';

// ── The Motion to Save bar (prompt 87) ──────────────────────────────────────
//
// A thin black bar above SiteNav on every page while a Store sale runs
// (useRunningSale(), or ?sale_preview=<key>). Never on the session runtimes,
// the crisis, /create or /store (the Store has its own hero). The X hides it
// for this browser tab (sessionStorage gv-sale-bar-<key>).
//
// It sits in the normal flow at the top of <body>, so pages (overlay navs
// included, which live inside their own positioned wrappers) move down by its
// 40px. SiteNav's desktop pill is position:fixed at the top, so while the bar
// is on screen it publishes how much of it is still visible as
// --gv-sale-bar-offset on <html> (40px at scroll top, 0 once scrolled past),
// written on scroll in one rAF, never React state; the pill reads it as its top.

import { useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { useRunningSale, useSaleCountdown } from '@/lib/storeSale';
import { unlimitedPricing } from '@/lib/payments';
import { formatUsd } from '@/lib/creditPricing';

const BAR_H = 40;
const OFFSET_VAR = '--gv-sale-bar-offset';

const EXCLUDED = ['/chair', '/delegate', '/advisor', '/voting', '/join', '/create', '/crisis', '/store', '/manage'];

export function saleBarExcluded(pathname: string | null): boolean {
  if (!pathname) return true;
  return EXCLUDED.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/** The sale's first-year Unlimited price, formatted; null when the sale has none below the yearly price. */
export function saleFirstYearPrice(firstCents: number | null | undefined): string | null {
  const yearlyCents = Math.round(unlimitedPricing(null).yearly * 100);
  return firstCents != null && firstCents < yearlyCents ? formatUsd(firstCents) : null;
}

// ── Hidden for this tab ─────────────────────────────────────────────────────

const hiddenListeners = new Set<() => void>();
const hideKey = (key: string) => `gv-sale-bar-${key}`;

function isHidden(key: string): boolean {
  try { return window.sessionStorage.getItem(hideKey(key)) === '1'; } catch { return false; }
}

function hide(key: string) {
  try { window.sessionStorage.setItem(hideKey(key), '1'); } catch { /* hidden for this page view only */ }
  hiddenMemo.add(key);
  hiddenListeners.forEach((l) => l());
}

const hiddenMemo = new Set<string>();

function subscribeHidden(l: () => void) {
  hiddenListeners.add(l);
  return () => { hiddenListeners.delete(l); };
}

const BAR_CSS = `
.gv-salebar{position:relative;z-index:31;height:${BAR_H}px;background:#0E0F0D;color:#F6F2E8;font-family:var(--font-brand),sans-serif;font-size:14px;display:flex;align-items:center;justify-content:center;padding:0 44px;box-sizing:border-box;overflow:hidden}
.gv-salebar-in{display:flex;align-items:center;gap:14px;white-space:nowrap;min-width:0}
.gv-salebar-brand{font-weight:900;letter-spacing:.14em}
.gv-salebar-cd{color:#A8C9B2;font-weight:700;font-variant-numeric:tabular-nums}
.gv-salebar-a{color:#F6F2E8;font-weight:800;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1.5px}
.gv-salebar-a:hover{color:#FFFFFF}
.gv-salebar-a:focus{outline:none}
.gv-salebar-a:focus-visible{outline:2px solid #F6F2E8;outline-offset:3px;border-radius:4px}
.gv-salebar-x{position:absolute;right:10px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;color:#BDB7A8;background:transparent;border:0;cursor:pointer}
.gv-salebar-x:hover{color:#FFFFFF;background:rgba(246,242,232,0.1)}
.gv-salebar-x:focus{outline:none}
.gv-salebar-x:focus-visible{outline:2px solid #F6F2E8}
@media (max-width:1099px){.gv-salebar-line{display:none}}
@media (max-width:639px){.gv-salebar{font-size:12.5px;padding:0 40px 0 12px}.gv-salebar-in{gap:10px}.gv-salebar-brand{letter-spacing:.1em}}
.gv-salebar-short{display:none}
@media (max-width:479px){.gv-salebar-long,.gv-salebar-secs{display:none}.gv-salebar-short{display:inline}}
`;

export default function SaleBar() {
  const pathname = usePathname();
  const sale = useRunningSale();
  const cd = useSaleCountdown(sale?.ends_at ?? null);
  const key = sale?.key ?? '';
  const hidden = useSyncExternalStore(
    subscribeHidden,
    () => (key ? hiddenMemo.has(key) || isHidden(key) : true),
    () => true,
  );
  const show = !!sale && !!cd && !hidden && !saleBarExcluded(pathname);

  // The fixed desktop pill in SiteNav follows the bar's visible height.
  useEffect(() => {
    if (!show) return undefined;
    const root = document.documentElement;
    let raf = 0;
    const write = () => {
      raf = 0;
      root.style.setProperty(OFFSET_VAR, `${Math.max(0, BAR_H - window.scrollY)}px`);
    };
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(write); };
    write();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
      root.style.removeProperty(OFFSET_VAR);
    };
  }, [show]);

  if (!show || !sale || !cd) return null;
  const first = saleFirstYearPrice(sale.unlimited_year_first_cents);
  return (
    <div className="gv-salebar" role="region" aria-label="Motion to Save sale">
      <style>{BAR_CSS}</style>
      <div className="gv-salebar-in">
        <span className="gv-salebar-brand">MOTION TO SAVE</span>
        <span className="gv-salebar-line">
          {first ? `Double your credits and a year of Unlimited for ${first}` : 'Double your credits'}
        </span>
        {/* phones: no "Ends in", no seconds and a shorter link, so nothing slides under the X */}
        <span className="gv-salebar-cd" role="timer"><span className="gv-salebar-long">Ends in </span>{Number(cd.d)}d {cd.h}h {cd.m}m<span className="gv-salebar-secs"> {cd.s}s</span></span>
        <Link href="/store" className="gv-salebar-a"><span className="gv-salebar-long">Go to the </span><span className="gv-salebar-short">To the </span>Store</Link>
      </div>
      <button type="button" className="gv-salebar-x" aria-label="Hide" onClick={() => hide(sale.key)}>
        <X size={15} strokeWidth={2.2} aria-hidden />
      </button>
    </div>
  );
}
