'use client';
// Gavelling Crisis: the thank-you gift (owner, 22 Nov 2026; docs/crisis/sql/055). A delegate with a personal voucher in
// crisis_gifts gets one pop-up on any page: Peter's note, the 24 December launch, a scratch-off voucher for 2 months of
// Unlimited with the benefits under the foil, Activate now (crisis_activate_gift) or Save for later (the code stays
// redeemable on the Promo code page for a year). ONE read on load, no live subscription. Never over another dialog.
// GiftCard is also shown on every Gavelling page by src/components/CrisisGiftGate.tsx for a signed-in account (part 56).

import { useCallback, useEffect, useRef, useState } from 'react';
import Portal from '@/components/Portal';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { activateGift, crisisError, myGift, saveGift, type CrisisGift } from '@/lib/crisis/api';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';

const EMOJI = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets';
const IMG = {
  gift: `${EMOJI}/Wrapped%20gift/3D/wrapped_gift_3d.png`,
  cal: `${EMOJI}/Calendar/3D/calendar_3d.png`,
  rocket: `${EMOJI}/Rocket/3D/rocket_3d.png`,
  chat: `${EMOJI}/Speech%20balloon/3D/speech_balloon_3d.png`,
};

function otherDialogOpen(): boolean {
  return !!document.querySelector('[aria-modal="true"]:not([data-gift]), [role="dialog"]:not([data-gift])');
}

const CSS = `
.cg{position:fixed;inset:0;z-index:232;display:grid;place-items:center;padding:64px 16px 24px;overflow-y:auto;font-family:var(--font-brand),Inter,system-ui,sans-serif;color:#1C1410}
.cg-scrim{position:fixed;inset:0;background:rgba(58,14,15,.5)}
.cg-dlg{position:relative;width:min(520px,100%);animation:cgRise .55s cubic-bezier(.2,.9,.25,1.1) both}
@keyframes cgRise{from{transform:translateY(26px) scale(.97);opacity:0}}
.cg-banner{position:relative;z-index:2;margin:0 auto -14px;width:max-content;max-width:92%;display:flex;align-items:center;gap:8px;padding:10px 20px;border-radius:999px;background:linear-gradient(165deg,#9A2A2A 0%,#6A1919 52%,#3A0E0F 100%);color:#FFF4E6;font-weight:800;font-size:15px;box-shadow:0 10px 24px rgba(58,14,15,.25)}
.cg-banner svg{width:20px;height:20px;stroke:#EED98A;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.cg-card{position:relative;background:linear-gradient(180deg,#FBEDE7 0%,#FFFFFF 150px);border-radius:22px;border-top:4px solid #8E2424;box-shadow:inset 0 1px 0 rgba(255,255,255,.75),0 0 0 1px rgba(27,56,40,.07),0 24px 60px rgba(58,14,15,.4);padding:14px 18px 18px;display:flex;flex-direction:column;gap:14px}
.cg-photo{position:absolute;left:-12px;top:-26px;width:76px;height:76px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 4px #fff,0 8px 18px rgba(58,14,15,.3)}
.cg-rocket{position:absolute;right:14px;top:10px;width:46px;height:46px;pointer-events:none}
.cg-who{padding-left:78px;min-height:44px}
.cg-who small{display:block;font-size:11.5px;font-weight:800;color:#8E2424}
.cg-who b{display:block;margin-top:2px;font-size:16px;font-weight:800}
.cg-who span{display:block;margin-top:2px;font-size:12.5px;font-weight:600;color:#4E463C}
.cg-note{margin:0;font-size:14px;line-height:1.55;color:#4E463C}
.cg-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:14px;background:rgba(142,36,36,.055);font-size:13.5px;line-height:1.45;color:#4E463C}
.cg-row img{width:36px;height:36px;flex:none}.cg-row b{color:#1C1410}
.cg-row code{font:600 13px ui-monospace,Menlo,monospace;color:#1C1410;user-select:all}
.cg-v{position:relative;border-radius:18px;overflow:hidden;user-select:none;touch-action:none;background:#fff;box-shadow:0 0 0 1.5px #B8952E inset}
.cg-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 18px 12px;background:linear-gradient(135deg,rgba(238,217,138,.35),rgba(238,217,138,.08));border-bottom:1.5px dashed #B8952E}
.cg-top .g{display:flex;align-items:center;gap:12px}.cg-top img{width:48px;height:48px;flex:none}
.cg-top small{display:block;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#B8952E}
.cg-top strong{display:block;font-size:26px;font-weight:800;line-height:1.1;color:#8E2424}
.cg-top .r{font-size:12px;font-weight:600;color:#4E463C;text-align:right}
.cg-top .r code{display:block;margin-top:3px;font:700 12.5px ui-monospace,Menlo,monospace;letter-spacing:.06em;color:#1C1410;user-select:all}
.cg-perks{list-style:none;margin:0;padding:12px 18px 14px;display:flex;flex-direction:column;gap:9px}
.cg-perks li{display:flex;gap:10px;align-items:center;font-size:13.5px;line-height:1.35}
.cg-perks svg{flex:none;width:20px;height:20px;stroke:#8E2424;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.cg-perks b{font-weight:700}.cg-perks em{font-style:normal;color:#4E463C}
.cg-perks .more{color:#857A6C;font-size:12.5px;padding-left:30px}
.cg-scratch{position:absolute;inset:0;width:100%;height:100%;cursor:grab;transition:opacity .6s;z-index:2}
.cg-scratch.gone{opacity:0;pointer-events:none}
.cg-coin{position:absolute;z-index:3;left:18%;top:30%;width:44px;height:44px;pointer-events:none;filter:drop-shadow(0 4px 6px rgba(58,14,15,.35));animation:cgRub 2.4s ease-in-out infinite;transition:opacity .3s}
.cg-coin.off{opacity:0}
@keyframes cgRub{0%{transform:translate(0,0) rotate(-20deg)}20%{transform:translate(55px,30px) rotate(10deg)}40%{transform:translate(110px,-5px) rotate(-15deg)}60%{transform:translate(165px,35px) rotate(12deg)}80%{transform:translate(220px,5px) rotate(-10deg)}100%{transform:translate(0,0) rotate(-20deg)}}
@media (prefers-reduced-motion:reduce){.cg-coin,.cg-dlg{animation:none}}
.cg-hint{margin:-6px 0 0;text-align:center;font-size:12.5px;color:#857A6C}
.cg-actions{display:flex;gap:10px;flex-wrap:wrap}
.cg-btn{flex:1;min-width:140px;border:0;border-radius:12px;padding:12px 16px;font:700 14px var(--font-brand),Inter,sans-serif;cursor:pointer}
.cg-btn:focus{outline:none}.cg-btn:focus-visible{outline:2px solid #1B3828;outline-offset:2px}
.cg-btn.main{background:linear-gradient(180deg,#A83030,#741C1C);color:#FFF4E6}
.cg-btn.ghost{background:rgba(142,36,36,.055);color:#1C1410;box-shadow:inset 0 0 0 1px rgba(28,20,16,.1)}
.cg-btn:disabled{opacity:.45;cursor:not-allowed}
.cg-fx{position:fixed;inset:0;pointer-events:none;z-index:233}
`;

export default function GiftPrompt() {
  const { ref } = useCrisis();
  const [gift, setGift] = useState<CrisisGift | null>(null);
  useEffect(() => {
    let off = false;
    void myGift(ref).then((g) => { if (!off) setGift(g); });
    return () => { off = true; };
  }, [ref]);
  const activate = useCallback(async () => {
    try {
      const r = await activateGift(ref);
      if (!r.ok) { notifyErr(r.message ?? 'Could not activate your voucher. Try again.'); return false; }
      notifyOk('Activated. Enjoy two months of Unlimited');
      return true;
    } catch (e) { notifyErr(crisisError(e, 'Could not activate your voucher. Try again.')); return false; }
  }, [ref]);
  const later = useCallback(() => {
    notifyOk('Saved. Activate it any time on Manage account, Promo code');
    void saveGift(ref).catch(() => { /* it shows again next visit */ });
  }, [ref]);
  if (!gift || gift.activated || gift.saved) return null;
  return <GiftCard code={gift.code} activate={activate} onLater={later} />;
}

/** `platform`: a platform gift (crisis_id null, owner 25 Nov 2026): Peter's headline and the gift's own length, and no
 *  crisis or event wording. The scratch-off, Activate now and Save for later stay exactly the same. */
export function GiftCard({ code, activate, onLater, platform }: {
  code: string; activate: () => Promise<boolean>; onLater: () => void; platform?: { headline: string; length: string };
}) {
  const [blocked, setBlocked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const watch = () => setBlocked(otherDialogOpen());
    watch();
    const t = window.setInterval(watch, 1500);
    return () => window.clearInterval(t);
  }, []);
  const shown = !gone;
  const boxRef = useRef<HTMLDivElement>(null);
  // The scratch canvas as STATE, not a ref: Portal mounts its children a microtask after the first commit, so a ref is
  // still null when the effect first runs. Keyed on the element, the scratch layer is set up once the card is in the DOM
  // (before this, no foil was painted, scratching did nothing and Activate never unlocked; 25 Nov 2026).
  const [cv, setCv] = useState<HTMLCanvasElement | null>(null);
  const coinRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);

  // The scratch layer, the coin hint, the falling foil and the confetti. Canvas only, no React state per frame.
  useEffect(() => {
    if (!shown) return undefined;
    const box = boxRef.current, coin = coinRef.current, fx = fxRef.current;
    if (!cv || !box || !coin || !fx) return undefined;
    const ctx = cv.getContext('2d'), fc = fx.getContext('2d');
    if (!ctx || !fc) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let down = false, last: { x: number; y: number } | null = null, done = false, moves = 0, demo = true, dl: { x: number; y: number } | null = null, alive = true;
    type Flake = { x: number; y: number; vx: number; vy: number; s: number; r: number; vr: number; c: string; life: number; conf?: boolean };
    const flakes: Flake[] = []; let fxOn = false;
    const dpr = window.devicePixelRatio || 1;
    const sizeFx = () => { fx.width = innerWidth * dpr; fx.height = innerHeight * dpr; fc.setTransform(dpr, 0, 0, dpr, 0, 0); };
    sizeFx();
    const fcols = ['#F6E7A8', '#E3C562', '#C9A640', '#B8952E', '#FFF3C4'];
    const stepFx = () => {
      fc.clearRect(0, 0, innerWidth, innerHeight);
      for (let i = flakes.length - 1; i >= 0; i--) {
        const f = flakes[i]; f.vy += f.conf ? 0.35 : 0.22; f.vx *= 0.99; f.x += f.vx; f.y += f.vy; f.r += f.vr; f.life++;
        if (f.y > innerHeight + 20 || f.life > 240) { flakes.splice(i, 1); continue; }
        fc.save(); fc.translate(f.x, f.y); fc.rotate(f.r); fc.fillStyle = f.c; fc.globalAlpha = Math.min(1, (240 - f.life) / 60);
        fc.fillRect(-f.s / 2, -f.s / 3, f.s, f.s * 0.66); fc.restore();
      }
      if (flakes.length && alive) requestAnimationFrame(stepFx); else { fxOn = false; fc.clearRect(0, 0, innerWidth, innerHeight); }
    };
    const kick = () => { if (!fxOn) { fxOn = true; requestAnimationFrame(stepFx); } };
    const spawn = (cx: number, cy: number, n: number) => {
      if (reduce) return;
      for (let i = 0; i < n; i++) flakes.push({ x: cx + (Math.random() - 0.5) * 26, y: cy + (Math.random() - 0.5) * 14, vx: (Math.random() - 0.5) * 2.2, vy: Math.random() * 1.5 - 1.2, s: Math.random() * 3.5 + 1.5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: fcols[(Math.random() * 5) | 0], life: 0 });
      kick();
    };
    const confetti = () => {
      if (reduce) return;
      const cols = ['#EED98A', '#8E2424', '#B8952E', '#1B3828', '#F6E7A8'];
      for (let i = 0; i < 140; i++) flakes.push({ x: innerWidth / 2, y: innerHeight / 2, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, s: Math.random() * 6 + 3, r: Math.random() * 6, vr: 0.2, c: cols[(Math.random() * 5) | 0], life: 60, conf: true });
      kick();
    };
    const paint = () => {
      const r = box.getBoundingClientRect();
      cv.width = r.width * dpr; cv.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createLinearGradient(0, 0, r.width, r.height);
      g.addColorStop(0, '#C9A640'); g.addColorStop(0.3, '#F6E7A8'); g.addColorStop(0.5, '#D9B852'); g.addColorStop(0.75, '#F2DE92'); g.addColorStop(1, '#B8952E');
      ctx.fillStyle = g; ctx.fillRect(0, 0, r.width, r.height);
      for (let i = 0; i < 1600; i++) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? 255 : 120},${Math.random() < 0.5 ? 240 : 90},${Math.random() < 0.5 ? 180 : 30},${Math.random() * 0.25})`; ctx.fillRect(Math.random() * r.width, Math.random() * r.height, 1.4, 1.4); }
      ctx.font = '700 20px Inter, sans-serif'; ctx.fillStyle = 'rgba(110,26,26,.14)'; ctx.textAlign = 'center';
      for (let x = 24; x < r.width; x += 64) for (let y = 28; y < r.height; y += 44) ctx.fillText('G', x, y);
      ctx.fillStyle = 'rgba(110,26,26,.85)'; ctx.font = '800 16px Inter, sans-serif'; ctx.fillText('SCRATCH HERE', r.width / 2, r.height / 2 + 6);
    };
    const check = () => {
      const { data } = ctx.getImageData(0, 0, cv.width, cv.height); let n = 0;
      for (let i = 3; i < data.length; i += 64) if (data[i] === 0) n++;
      if (n / (data.length / 64) > 0.5 && !done) { done = true; cv.classList.add('gone'); setRevealed(true); confetti(); }
    };
    const tick = () => {
      if (!demo || !alive) return;
      const vb = box.getBoundingClientRect(), cb = coin.getBoundingClientRect();
      const p = { x: cb.left - vb.left + cb.width * 0.3, y: cb.top - vb.top + cb.height * 0.75 };
      ctx.globalCompositeOperation = 'destination-out'; ctx.lineCap = 'round'; ctx.lineWidth = 10; ctx.globalAlpha = 0.06;
      ctx.beginPath(); ctx.moveTo((dl ?? p).x, (dl ?? p).y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.globalAlpha = 1;
      if (Math.random() < 0.35) spawn(vb.left + p.x, vb.top + p.y, 1);
      dl = p; requestAnimationFrame(tick);
    };
    const pos = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const scratch = (p: { x: number; y: number }) => {
      ctx.globalCompositeOperation = 'destination-out'; ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = 36;
      ctx.beginPath(); ctx.moveTo((last ?? p).x, (last ?? p).y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p; const r = cv.getBoundingClientRect(); spawn(r.left + p.x, r.top + p.y, 4);
      if (++moves % 12 === 0) check();
    };
    const onDown = (e: PointerEvent) => {
      if (done) return; coin.classList.add('off');
      if (demo) { demo = false; paint(); }
      down = true; last = null; cv.setPointerCapture(e.pointerId); scratch(pos(e));
    };
    const onMove = (e: PointerEvent) => { if (down && !done) scratch(pos(e)); };
    const onUp = () => { down = false; last = null; if (!done) check(); };
    const onResize = () => { sizeFx(); if (!done && !demo) paint(); };
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp); window.addEventListener('resize', onResize);
    const start = () => { if (!alive) return; paint(); if (!reduce) requestAnimationFrame(tick); else coin.classList.add('off'); };
    if (document.fonts) void document.fonts.ready.then(start); else start();
    return () => {
      alive = false;
      cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp); window.removeEventListener('resize', onResize);
    };
  }, [shown, cv]);

  const onActivate = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try { if (await activate()) setGone(true); } finally { setBusy(false); }
  }, [busy, activate]);
  const later = useCallback(() => { setGone(true); onLater(); }, [onLater]);

  if (!shown) return null;

  return (
    <Portal>
      <style>{CSS}</style>
      <canvas ref={fxRef} className="cg-fx" aria-hidden />
      <div className="cg" style={{ display: blocked ? 'none' : undefined }}>
        <div className="cg-scrim" aria-hidden />
        <div className="cg-dlg" data-gift="" role="dialog" aria-modal="true" aria-label="A gift from Gavelling">
          <div className="cg-banner">
            <svg viewBox="0 0 24 24" aria-hidden><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" /></svg>
            A Gift For You
          </div>
          <div className="cg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="cg-photo" alt="Peter Zakhar" src="/PeterPic.jpg" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="cg-rocket" alt="" src={IMG.rocket} />
            <div className="cg-who"><small>From the Gavelling team</small><b>Peter Zakhar</b><span>Founder, Gavelling</span></div>
            {platform ? (
              <p className="cg-note"><b style={{ display: 'block', marginBottom: 4, fontSize: 17, lineHeight: 1.3, color: '#1C1410' }}>{platform.headline}</b>Thank you for being part of Gavelling.</p>
            ) : (
              <p className="cg-note">Thank you for trying out Gavelling Crisis with us. We are sorry for the outages and bugs you ran into, and we are fixing every one of them. We hope you still enjoyed the race to space.</p>
            )}
            {!platform && <div className="cg-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" src={IMG.cal} />
              <span><b>Gavelling Crisis launches on 24 December.</b> You were one of the very first to use it.</span>
            </div>}
            <div className="cg-v" ref={boxRef}>
              <div className="cg-top">
                <div className="g">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" src={IMG.gift} />
                  <div><small>Gavelling Unlimited</small><strong>{platform ? platform.length : '2 months'} free</strong></div>
                </div>
                <span className="r">Use any time<br />in the next year<code>{code}</code></span>
              </div>
              <ul className="cg-perks">
                <li><svg viewBox="0 0 24 24" aria-hidden><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg><span><b>Discounted conferences</b> <em>across Gavelling</em></span></li>
                <li><svg viewBox="0 0 24 24" aria-hidden><path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2Z" /><path d="M9 7h7M9 11h5" /></svg><span><b>Premium articles</b> <em>on debate, crisis and chairing</em></span></li>
                <li><svg viewBox="0 0 24 24" aria-hidden><path d="m14 13-8.5 8.5a2.1 2.1 0 0 1-3-3L11 10" /><path d="m16 16 6-6M8 8l6-6M9 7l8 8" /></svg><span><b>Paid chairing opportunities</b> <em>on the Job Board</em></span></li>
                <li className="more">And more on the way</li>
              </ul>
              <div className="cg-coin" ref={coinRef} aria-hidden>
                <svg viewBox="0 0 44 44" width="44" height="44"><defs><radialGradient id="cg-coin" cx=".35" cy=".3"><stop offset="0" stopColor="#FFF6CF" /><stop offset=".6" stopColor="#E3C562" /><stop offset="1" stopColor="#A9852A" /></radialGradient></defs><circle cx="22" cy="22" r="20" fill="url(#cg-coin)" stroke="#8E6E1E" strokeWidth="1.5" /><circle cx="22" cy="22" r="14" fill="none" stroke="#8E6E1E" strokeWidth="1" opacity=".6" /><text x="22" y="28" textAnchor="middle" fontFamily="Inter,sans-serif" fontWeight="800" fontSize="16" fill="#6E1A1A">G</text></svg>
              </div>
              <canvas ref={setCv} className="cg-scratch" aria-label="Scratch to reveal your voucher" />
            </div>
            <p className="cg-hint">{revealed ? (platform ? `${platform.length} of Unlimited ${/^1 /.test(platform.length) ? 'is' : 'are'} yours` : 'Two months of Unlimited are yours') : 'Scratch the gold to reveal your voucher'}</p>
            {!platform && <div className="cg-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" src={IMG.chat} />
              <span><b>Enjoyed it? Tell your friends.</b> If your conference wants to run a crisis on Gavelling, get in touch at <code>info@gavelling.com</code></span>
            </div>}
            <div className="cg-actions">
              <button type="button" className="cg-btn main" disabled={!revealed || busy} onClick={() => void onActivate()}>Activate now</button>
              <button type="button" className="cg-btn ghost" disabled={busy} onClick={later}>Save for later</button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
