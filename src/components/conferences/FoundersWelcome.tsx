'use client';

// The founders' thank-you (owner, 12 Oct 2026): shown ONCE, right after an
// organiser creates a conference. The wizard lands on /manage/[slug]?welcome=1;
// this reads the flag, strips it from the address (replaceUrlInPlace, no
// reload), remembers per conference that it was shown, and puts Peter's
// personal number in front of the organiser. The photo of Peter and Christian
// is a cut-out that rises out of the card's top edge.
//
// Portaled, role=dialog + aria-modal (so the other gates that wait for an open
// dialog stay out of its way), Escape and the backdrop close it, focus goes to
// the main button and back to the page on close. Writes nothing to the database.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Phone, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { OUTFIT } from '@/components/neu';
import { PlatformLogo } from '@/components/conferences/ApplicationSourceMark';
import { replaceUrlInPlace } from '@/lib/replaceUrlInPlace';

const PHONE_DISPLAY = '+44 7478 115292';
const PHONE_TEL = '+447478115292';
const WHATSAPP = 'https://wa.me/447478115292';
const PHOTO = '/founders/peter-christian.webp';

const seenKey = (id: string) => `gavelling-founders-welcome:${id}`;

export function FoundersWelcome({ conferenceId }: { conferenceId: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const mainRef = useRef<HTMLButtonElement>(null);
  const returnRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('welcome') !== '1') return;
    url.searchParams.delete('welcome');
    replaceUrlInPlace(url.pathname + url.search + url.hash);
    let seen = false;
    try { seen = window.localStorage.getItem(seenKey(conferenceId)) === '1'; } catch { /* storage blocked: show it */ }
    if (seen) return;
    try { window.localStorage.setItem(seenKey(conferenceId), '1'); } catch { /* ignore */ }
    returnRef.current = document.activeElement as HTMLElement | null;
    void Promise.resolve().then(() => setOpen(true));
  }, [conferenceId]);

  const close = useCallback(() => {
    setOpen(false);
    const el = returnRef.current;
    if (el && document.contains(el)) el.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => mainRef.current?.focus());
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    window.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PHONE_DISPLAY);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch { /* clipboard blocked: the number is on screen */ }
  };

  if (!open) return null;

  return (
    <Portal>
      <div
        className="gv-fw-back"
        onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      >
        <style>{CSS}</style>
        <div role="dialog" aria-modal="true" aria-labelledby="gv-fw-title" className="gv-fw">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PHOTO} alt="Peter and Christian, the founders of Gavelling" className="gv-fw-photo" draggable={false} />
          <button type="button" className="gv-fw-x" onClick={close} aria-label="Close">
            <X size={18} aria-hidden />
          </button>
          <div className="gv-fw-text">
            <h2 id="gv-fw-title" className="gv-fw-title">Thank You for Trusting Us</h2>
            <p className="gv-fw-body">
              We&apos;re Peter and Christian, and we build Gavelling ourselves, just the two of us.
              We want you to have the best experience, so here is Peter&apos;s personal number.
              Reach him any time.
            </p>
            <div className="gv-fw-phone">
              <a href={`tel:${PHONE_TEL}`} className="gv-fw-num">
                <Phone size={18} aria-hidden />
                {PHONE_DISPLAY}
              </a>
              <div className="gv-fw-ways">
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="gv-fw-way">
                  <PlatformLogo platform="whatsapp" size={16} />
                  WhatsApp
                </a>
                <button type="button" className="gv-fw-way" onClick={copy}>
                  {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <button ref={mainRef} type="button" className="gv-fw-go" onClick={close}>
              Go to my dashboard
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

const CSS = `
.gv-fw-back{position:fixed;inset:0;z-index:10060;display:flex;align-items:center;justify-content:center;padding:150px 16px 24px;background:rgba(28,20,16,0.45);font-family:${OUTFIT};animation:gv-fw-fade 180ms ease}
.gv-fw{position:relative;width:min(640px,100%);background:#FFFFFF;border-radius:24px;box-shadow:0 30px 70px -28px rgba(27,56,40,0.55),0 0 0 1px rgba(27,56,40,0.06);color:#1C1410;animation:gv-fw-rise 260ms cubic-bezier(0.22,1,0.36,1)}
.gv-fw-photo{position:absolute;right:6px;bottom:0;height:calc(100% + 120px);width:auto;max-width:46%;object-fit:contain;object-position:bottom right;pointer-events:none;user-select:none;filter:drop-shadow(0 18px 24px rgba(27,56,40,0.22))}
.gv-fw-text{position:relative;width:58%;padding:30px 8px 28px 30px;display:flex;flex-direction:column;gap:14px}
.gv-fw-title{margin:0;font-size:26px;font-weight:800;letter-spacing:-0.02em;line-height:1.15;color:#1C1410;text-wrap:balance}
.gv-fw-body{margin:0;font-size:15px;line-height:1.55;color:#544B3E;text-wrap:pretty}
.gv-fw-phone{display:flex;flex-direction:column;gap:8px;padding:14px 16px;border-radius:16px;background:#FAF8F3;box-shadow:inset 0 0 0 1px rgba(27,56,40,0.08)}
.gv-fw-num{display:inline-flex;align-items:center;gap:9px;font-size:21px;font-weight:800;letter-spacing:0.01em;color:#1B3828;text-decoration:none;font-variant-numeric:tabular-nums}
.gv-fw-num:hover{text-decoration:underline;text-underline-offset:4px}
.gv-fw-ways{display:flex;flex-wrap:wrap;gap:8px}
.gv-fw-way{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:10px;border:none;background:#FFFFFF;box-shadow:inset 0 0 0 1.5px rgba(27,56,40,0.18);font-family:${OUTFIT};font-size:13px;font-weight:700;color:#1B3828;text-decoration:none;cursor:pointer}
.gv-fw-way:hover{background:#F3F0E7}
.gv-fw-go{align-self:flex-start;min-height:44px;padding:0 22px;border-radius:12px;border:none;cursor:pointer;background-image:linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%);color:#FFFFFF;font-family:${OUTFIT};font-size:15px;font-weight:700;box-shadow:0 2px 4px rgba(27,56,40,0.16),0 10px 24px rgba(27,56,40,0.22);transition:transform 120ms ease}
.gv-fw-go:active{transform:scale(0.98)}
.gv-fw-x{position:absolute;top:12px;right:12px;z-index:2;width:38px;height:38px;border-radius:999px;border:none;background:rgba(255,255,255,0.92);color:#544B3E;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(27,56,40,0.14)}
.gv-fw-x:hover{background:#FFFFFF}
.gv-fw button:focus,.gv-fw a:focus{outline:none}
.gv-fw button:focus-visible,.gv-fw a:focus-visible{outline:2px solid #1B3828;outline-offset:2px}
@keyframes gv-fw-fade{from{opacity:0}to{opacity:1}}
@keyframes gv-fw-rise{from{opacity:0;transform:translateY(14px) scale(0.985)}to{opacity:1;transform:none}}
@media (max-width:600px){
  .gv-fw-back{align-items:flex-end;padding:180px 0 0}
  .gv-fw{border-radius:24px 24px 0 0;padding-top:120px}
  .gv-fw-photo{right:auto;left:50%;transform:translateX(-50%);bottom:auto;top:-160px;height:280px;max-width:none}
  .gv-fw-text{width:auto;padding:18px 20px calc(22px + env(safe-area-inset-bottom))}
  .gv-fw-title{font-size:23px}
  .gv-fw-go{align-self:stretch}
}
@media (prefers-reduced-motion:reduce){.gv-fw-back,.gv-fw{animation:none}}
`;
