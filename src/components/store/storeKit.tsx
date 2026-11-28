'use client';

// ── The Gavelling Store kit (prompt 85, 27 Nov 2026) ────────────────────────
//
// The Store is permanently BLACK (owner, 27 Nov 2026; the approved canvas
// "Motion to Save: Store and Black Friday"): a black page, forest green and
// cream accents, capitals Inter 900 titles, no ivory and no gold. The one
// exception to the ivory page rule (CLAUDE.md section 8), for /store and
// /store/credits only.
//
// Here: the palette, the shared styles (STORE_CSS, mounted once by the
// layout), the sticky StoreBar (StoreTabs and the credit balance), the sale
// Countdown, WaitlistButton, the COMING SOON chip, a section header and the
// Got a question box that closes every Store page.

import { useCallback, useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowDown } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useCredits } from '@/hooks/useCredits';
import { openAuth } from '@/lib/authModal';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { useSaleCountdown } from '@/lib/storeSale';

export const S = {
  black: '#0E0F0D',
  cream: '#F6F2E8',
  soft: '#BDB7A8',
  card: '#161815',
  line: '#2A2D27',
  edge: '#22251F',
  forest: '#1B3828',
  forestLight: '#2A5A3C',
  pale: '#A8C9B2',
} as const;

export const STORE_FONT = 'var(--font-brand), sans-serif';

export const STORE_CSS = `
.gv-s{background:${S.black};color:${S.cream};font-family:${STORE_FONT}}
.gv-s-navband{position:relative;z-index:30;height:72px;background:${S.black}}
.gv-s-wrap{width:100%;max-width:1360px;margin:0 auto;padding-left:52px;padding-right:52px;box-sizing:border-box}
@media (max-width:1023px){.gv-s-wrap{padding-left:32px;padding-right:32px}}
@media (max-width:639px){.gv-s-wrap{padding-left:20px;padding-right:20px}}
.gv-s-caps{margin:0;font-weight:900;text-transform:uppercase;letter-spacing:-0.05em;line-height:.86;color:${S.cream}}
.gv-s-label{margin:0;font-size:12.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${S.pale}}
.gv-s-line{margin:0;font-size:17px;line-height:1.5;color:${S.soft}}
.gv-s-a{color:${S.cream};font-weight:800;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1.5px}
.gv-s-a:hover{color:#FFFFFF}
.gv-s-a:focus{outline:none}
.gv-s-a:focus-visible{outline:2px solid ${S.cream};outline-offset:3px;border-radius:4px}
.gv-s-card{background:${S.card};border:1px solid ${S.line};border-radius:18px}

.gv-s-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:0 22px;border-radius:12px;border:none;cursor:pointer;font:inherit;font-size:16px;font-weight:800;letter-spacing:-0.01em;text-decoration:none;white-space:nowrap;transition:background-color 160ms ease-out,box-shadow 160ms ease-out,color 160ms ease-out}
.gv-s-btn:focus{outline:none}
.gv-s-btn:focus-visible{outline:2px solid ${S.cream};outline-offset:3px}
.gv-s-big{min-height:58px;padding:0 28px;font-size:17px}
.gv-s-small{min-height:44px;padding:0 16px;font-size:14.5px}
.gv-s-cream{background:${S.cream};color:${S.black}}
.gv-s-cream:hover{background:#FFFFFF}
.gv-s-outline{background:transparent;color:${S.cream};box-shadow:inset 0 0 0 1.5px rgba(246,242,232,.55)}
.gv-s-outline:hover{box-shadow:inset 0 0 0 1.5px ${S.cream};background:rgba(246,242,232,.06)}
.gv-s-btn[disabled]{cursor:default}
.gv-s-btn.gv-s-outline[disabled]:hover{background:transparent;box-shadow:inset 0 0 0 1.5px rgba(246,242,232,.55)}

.gv-s-skel{display:block;max-width:100%;border-radius:10px;background:rgba(246,242,232,0.08);animation:gvSSkel 1.4s ease-in-out infinite}
.gv-s-skel-in{display:inline-block;vertical-align:middle}
@keyframes gvSSkel{0%,100%{opacity:1}50%{opacity:.55}}
@media (prefers-reduced-motion:reduce){.gv-s-skel{animation:none}}
.gv-s-soon{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:8px;background:${S.cream};color:${S.black};font-size:11.5px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}

.gv-s-bar{position:sticky;top:0;z-index:20;background:${S.black};border-bottom:1px solid ${S.edge}}
@media (min-width:1024px){.gv-s-bar{top:calc(var(--gv-sale-bar-offset, 0px) + 72px)}}
.gv-s-cue{position:absolute;right:52px;bottom:20px;z-index:2;display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 14px;border-radius:12px;border:none;background:rgba(14,15,13,0.55);color:${S.cream};box-shadow:inset 0 0 0 1.5px rgba(246,242,232,.55);font:inherit;font-size:13.5px;font-weight:800;cursor:pointer;transition:opacity 200ms ease-out,box-shadow 160ms ease-out}
.gv-s-cue:hover{box-shadow:inset 0 0 0 1.5px ${S.cream}}
.gv-s-cue:focus{outline:none}
.gv-s-cue:focus-visible{outline:2px solid ${S.cream};outline-offset:3px}
.gv-s-cue[data-hidden="true"]{opacity:0;pointer-events:none}
@media (max-width:1023px){.gv-s-cue{right:32px}}
@media (max-width:639px){.gv-s-cue{right:20px;bottom:14px}}
@media (prefers-reduced-motion:reduce){.gv-s-cue{transition:none}}
.gv-s-bar-in{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:76px;flex-wrap:wrap;padding-top:12px;padding-bottom:12px}
.gv-s-tabs{display:inline-flex;gap:4px;padding:4px;border-radius:14px;border:1px solid ${S.line};background:${S.card}}
.gv-s-tab{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:10px;font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;color:${S.soft};transition:background-color 160ms ease-out,color 160ms ease-out}
.gv-s-tab:hover{color:${S.cream}}
.gv-s-tab:focus{outline:none}
.gv-s-tab:focus-visible{outline:2px solid ${S.cream};outline-offset:2px}
.gv-s-tab[aria-current="page"]{background:${S.cream};color:${S.black}}
.gv-s-bal{display:inline-flex;align-items:center;gap:8px;font-size:15px;color:${S.soft}}
.gv-s-bal b{color:${S.cream};font-weight:900;font-variant-numeric:tabular-nums}
@media (max-width:639px){.gv-s-tab{padding:0 12px;font-size:12px;letter-spacing:.06em}}

.gv-s-cd{display:flex;gap:10px;flex-wrap:wrap}
.gv-s-cd-box{min-width:84px;padding:12px 10px 10px;border-radius:14px;background:${S.card};border:1px solid ${S.line};text-align:center}
.gv-s-cd-n{display:block;font-size:38px;font-weight:900;line-height:1;letter-spacing:-0.03em;font-variant-numeric:tabular-nums;color:${S.cream}}
.gv-s-cd-w{display:block;margin-top:6px;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${S.soft}}
@media (max-width:639px){.gv-s-cd-box{min-width:68px}.gv-s-cd-n{font-size:30px}}

.gv-s-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px 32px;flex-wrap:wrap;padding-bottom:20px;border-bottom:1px solid ${S.line};margin-bottom:24px}
.gv-s-h2{font-size:clamp(40px,4.6vw,72px);line-height:.9}

.gv-s-ask{display:flex;align-items:center;justify-content:space-between;gap:20px 32px;flex-wrap:wrap;padding:36px}
.gv-s-ask-t{font-size:clamp(32px,3.4vw,52px);line-height:.9}
@media (max-width:639px){.gv-s-ask{padding:24px}}
@media (prefers-reduced-motion:reduce){.gv-s-btn,.gv-s-tab{transition:none}}
`;

/** The shared styles, mounted once by the Store layout (a server component cannot read STORE_CSS from this client module). */
export function StoreStyles() {
  return <style>{STORE_CSS}</style>;
}

// ── The sticky bar: the two tabs and the balance ────────────────────────────

const TABS = [
  { href: '/store', label: 'Store' },
  { href: '/store/credits', label: 'Credits and Unlimited' },
];

export function StoreTabs() {
  const pathname = usePathname() ?? '';
  return (
    <nav className="gv-s-tabs" aria-label="Store">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className="gv-s-tab" aria-current={pathname === t.href ? 'page' : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

const TABS_ANCHOR = 'gv-store-tabs';

export function StoreBar() {
  const { user } = useAuth();
  const { balance } = useCredits();
  return (
    <>
    {/* Where the bar sits before it sticks: the hero's scroll cue lands here. */}
    <div id={TABS_ANCHOR} aria-hidden />
    <div className="gv-s-bar">
      <div className="gv-s-wrap gv-s-bar-in">
        <StoreTabs />
        {user && balance !== null && (
          <span className="gv-s-bal">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/credit-token.webp" alt="" width={20} height={20} aria-hidden />
            <span>You have <b>{balance.toLocaleString('en-US')}</b> {balance === 1 ? 'credit' : 'credits'}</span>
          </span>
        )}
      </div>
    </div>
    </>
  );
}

/** "See the whole store" at the bottom right of a hero (prompt 90): scrolls to the
 *  tabs (smoothly unless reduced motion is asked for) and hides once the hero is
 *  scrolled out of view. Mount it inside the hero (position: relative). */
export function HeroScrollCue({ heroId }: { heroId: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const hero = document.getElementById(heroId);
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    // Hidden as soon as the hero's bottom part has left the screen.
    const io = new IntersectionObserver(([e]) => setHidden(!e.isIntersecting), { rootMargin: '0px 0px -85% 0px' });
    io.observe(hero);
    return () => io.disconnect();
  }, [heroId]);
  const go = () => {
    const anchor = document.getElementById(TABS_ANCHOR);
    if (!anchor) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pill = window.matchMedia('(min-width: 1024px)').matches ? 72 : 0;
    const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gv-sale-bar-offset')) || 0;
    const top = anchor.getBoundingClientRect().top + window.scrollY - pill - offset;
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  };
  return (
    <button type="button" className="gv-s-cue" onClick={go} data-hidden={hidden ? 'true' : undefined} tabIndex={hidden ? -1 : undefined} aria-hidden={hidden || undefined}>
      See the whole store
      <ArrowDown size={16} strokeWidth={1.75} aria-hidden />
    </button>
  );
}

// ── The sale countdown ──────────────────────────────────────────────────────

export function Countdown({ endsAt }: { endsAt: string }) {
  const cd = useSaleCountdown(endsAt);
  if (!cd) return null;
  const boxes: [string, string][] = [[cd.d, 'Days'], [cd.h, 'Hours'], [cd.m, 'Minutes'], [cd.s, 'Seconds']];
  return (
    <div className="gv-s-cd" role="timer" aria-label={`Ends in ${Number(cd.d)} days, ${Number(cd.h)} hours and ${Number(cd.m)} minutes`}>
      {boxes.map(([n, w]) => (
        <span key={w} className="gv-s-cd-box" aria-hidden>
          <span className="gv-s-cd-n">{n}</span>
          <span className="gv-s-cd-w">{w}</span>
        </span>
      ))}
    </div>
  );
}

// ── The waitlist (join_store_waitlist / my_store_waitlist) ──────────────────

export type WaitlistItem = 'mun_archive' | 'gift_credits' | 'social_feature' | 'email_feature' | 'external_applications';

// One read of my_store_waitlist() per signed-in user and page load, shared by every button.
let wlUser: string | null = null;
let wlItems: ReadonlySet<string> = new Set();
let wlLoading = false;
const wlListeners = new Set<() => void>();

function wlSet(items: ReadonlySet<string>) {
  wlItems = items;
  wlListeners.forEach((l) => l());
}

function wlLoad(uid: string) {
  if (wlUser === uid || wlLoading) return;
  wlUser = uid;
  wlLoading = true;
  void (async () => {
    try {
      const client = await getFreshAuthedClient();
      if (!client) return;
      const { data, error } = await client.rpc('my_store_waitlist');
      if (!error && Array.isArray(data) && wlUser === uid) wlSet(new Set(data.filter((x): x is string => typeof x === 'string')));
    } catch {
      /* the button starts as Join the waitlist; joining twice is harmless */
    } finally {
      wlLoading = false;
    }
  })();
}

function wlSubscribe(l: () => void) {
  wlListeners.add(l);
  return () => { wlListeners.delete(l); };
}

export function WaitlistButton({ item }: { item: WaitlistItem }) {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const items = useSyncExternalStore(wlSubscribe, () => wlItems, () => wlItems);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (uid) wlLoad(uid);
  }, [uid]);

  const on = !!uid && wlUser === uid && items.has(item);

  const join = useCallback(async () => {
    if (!uid) { openAuth({}); return; }
    if (busy || on) return;
    setBusy(true);
    try {
      const client = await getFreshAuthedClient();
      if (!client) { openAuth({}); return; }
      const { data, error } = await client.rpc('join_store_waitlist', { p_item: item });
      if (error) throw error;
      const a = (data ?? {}) as { ok?: boolean; reason?: string };
      if (a.ok === true) {
        const next = new Set(wlItems);
        next.add(item);
        wlSet(next);
        notifyOk("You're on the waitlist");
      } else if (a.reason === 'signed_out') {
        openAuth({});
      } else {
        notifyErr('We could not add you to the waitlist. Please try again.');
      }
    } catch (e) {
      notifyErr(friendlyError(e, 'We could not add you to the waitlist. Please try again.'));
    } finally {
      setBusy(false);
    }
  }, [uid, busy, on, item]);

  if (on) {
    return <button type="button" className="gv-s-btn gv-s-small gv-s-outline" disabled>On the waitlist</button>;
  }
  return (
    <button type="button" className="gv-s-btn gv-s-small gv-s-cream" onClick={() => { void join(); }} aria-busy={busy || undefined}>
      Join the waitlist
    </button>
  );
}

// ── Small pieces ────────────────────────────────────────────────────────────

/** A soft grey bar where words go while the sale read has not answered (prompt 94). */
export function Skel({ w, h = 16, inline = false, style }: { w: number | string; h?: number; inline?: boolean; style?: CSSProperties }) {
  return <span className={`gv-s-skel${inline ? ' gv-s-skel-in' : ''}`} aria-hidden style={{ width: w, height: h, ...style }} />;
}

export function ComingSoon() {
  return <span className="gv-s-soon">Coming soon</span>;
}

export function StoreSectionHead({ title, line, id }: { title: string; line: ReactNode; id?: string }) {
  return (
    <div className="gv-s-head">
      <h2 id={id} className="gv-s-caps gv-s-h2">{title}</h2>
      <p className="gv-s-line" style={{ maxWidth: 520 }}>{line}</p>
    </div>
  );
}

/** The close of every Store page. */
export function GotAQuestion() {
  return (
    <section className="gv-s-wrap" style={{ paddingTop: 24, paddingBottom: 72 }} aria-labelledby="gv-s-ask">
      <div className="gv-s-card gv-s-ask">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 id="gv-s-ask" className="gv-s-caps gv-s-ask-t">Got a question?</h2>
          <p className="gv-s-line">
            Every pricing answer lives in the <Link href="/help#pricing" className="gv-s-a">Help Center</Link>
          </p>
        </div>
        <Link href="/contact" className="gv-s-btn gv-s-cream">Contact us</Link>
      </div>
    </section>
  );
}
