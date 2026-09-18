'use client';

// ─────────────────────────────────────────────────────────────────────────────
// SessionCodePresenter: the session code, shown to the room.
//
// Clicking the session code in the chair top bar opens this full-screen layer: the
// six-character code as large as the viewport allows, the join address, a QR code for
// the same address, and a Copy button. It grows out of the button it was opened from
// (transform + opacity only) and shrinks back into it on close; with
// `prefers-reduced-motion` it only fades. Click anywhere or press Escape to close.
//
// It is given ONLY the session code. The chair code (code + suffix) is the write
// credential and must never be shown to a room, so this component has no way to
// receive it.
//
// Portaled straight to <body>, not to #fit-root: fit-root carries a transform: scale(),
// which would make `position: fixed` and vw/vh units lie. The QR is drawn locally
// (src/lib/qrCode.ts), so presenting the code makes no third-party request.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, X } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { encodeQr } from '@/lib/qrCode';

const OUTFIT = "'Outfit', sans-serif";
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const OPEN_MS = 320;
const CLOSE_MS = 220;
const JOIN_HOST = 'gavelling.com';

function QrSvg({ text, size }: { text: string; size: number }) {
  const matrix = useMemo(() => encodeQr(text), [text]);
  if (!matrix) return null;
  const n = matrix.length;
  const quiet = 3;
  const dim = n + quiet * 2;
  let d = '';
  matrix.forEach((row, y) => row.forEach((dark, x) => { if (dark) d += `M${x + quiet} ${y + quiet}h1v1h-1z`; }));
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${dim} ${dim}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      style={{ display: 'block', borderRadius: 14, backgroundColor: '#FFFFFF' }}
    >
      <path d={d} fill="#1C1410" />
    </svg>
  );
}

export default function SessionCodePresenter({
  code,
  origin,
  onClose,
}: {
  /** The six-character SESSION code. Never the chair code. */
  code: string;
  /** The button it grows from, for the animation's origin. */
  origin: DOMRect | null;
  onClose: () => void;
}) {
  const t = useT();
  const [phase, setPhase] = useState<'enter' | 'open' | 'exit'>('enter');
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const joinUrl = `https://${JOIN_HOST}/join?code=${encodeURIComponent(code)}`;

  // Start from the button, then settle on the next frame so the transition runs.
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('open')));
    return () => cancelAnimationFrame(id);
  }, []);

  // Fit the code to the screen (17 Sep 2026: "some session codes still go way off screen").
  // A fixed min(24vw, 44vh) assumed six narrow characters; WWMMWW, or a custom code of up to
  // 20 characters, ran far past both edges. Measure the text at 100px and scale it so it fills
  // at most the width left inside the padding, and never more than 44% of the height. Written
  // straight to the node (no state), again on resize and once the web font has loaded.
  // scrollWidth is layout width, so the grow-in transform does not disturb the measurement.
  useLayoutEffect(() => {
    const el = codeRef.current;
    if (!el) return;
    const fit = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const avail = Math.max(120, w - 2 * Math.max(16, w * 0.03) - 8);
      el.style.fontSize = '100px';
      const at100 = el.scrollWidth || 1;
      const byWidth = (avail / at100) * 100;
      el.style.fontSize = `${Math.max(12, Math.floor(Math.min(byWidth, h * 0.44)))}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    let alive = true;
    void document.fonts?.ready.then(() => { if (alive) fit(); });
    return () => { alive = false; window.removeEventListener('resize', fit); };
  }, [code]);

  const close = useCallback(() => {
    setPhase('exit');
  }, []);

  useEffect(() => {
    if (phase !== 'exit') return;
    const id = setTimeout(onClose, reduced ? 120 : CLOSE_MS);
    return () => clearTimeout(id);
  }, [phase, onClose, reduced]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      previous?.focus?.({ preventScroll: true });
    };
  }, [close]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  // Transform origin = the button's centre, so the layer grows out of it.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1;
  const ox = origin ? origin.left + origin.width / 2 : vw / 2;
  const oy = origin ? origin.top + origin.height / 2 : 0;
  const startScale = origin ? Math.max(0.04, Math.min(origin.width / vw, origin.height / vh)) : 0.9;
  const shown = phase === 'open';
  const ms = phase === 'exit' ? CLOSE_MS : OPEN_MS;

  const layerStyle: React.CSSProperties = reduced
    ? { opacity: shown ? 1 : 0, transition: 'opacity 120ms linear' }
    : {
        opacity: shown ? 1 : 0,
        transform: shown ? 'scale(1)' : `scale(${startScale})`,
        transformOrigin: `${ox}px ${oy}px`,
        transition: `transform ${ms}ms ${EASE}, opacity ${phase === 'exit' ? CLOSE_MS : 180}ms ${EASE}`,
        willChange: 'transform, opacity',
      };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('code_present_title', { code })}
      onClick={close}
      className="fixed inset-0 flex flex-col items-center justify-center cursor-zoom-out select-none"
      style={{ zIndex: 400, backgroundColor: '#1B3828', color: '#EDE7D8', paddingInline: 'max(16px, 3vw)', paddingBlock: '3vh', ...layerStyle }}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); close(); }}
        aria-label={t('code_present_close')}
        title={t('code_present_close')}
        className="absolute top-4 end-4 inline-flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] transition-[background-color] duration-150 hover:bg-white/10 active:scale-[0.96]"
        style={{ width: 48, height: 48, color: '#EDE7D8' }}
      >
        <X size={26} strokeWidth={2.2} aria-hidden />
      </button>

      <p className="uppercase text-center" style={{ fontFamily: OUTFIT, fontWeight: 700, letterSpacing: '0.18em', fontSize: 'clamp(14px, 1.6vw, 22px)', color: '#EED98A' }}>
        {t('code_present_eyebrow')}
      </p>

      <div
        ref={codeRef}
        className="tabular-nums text-center"
        style={{
          fontFamily: OUTFIT,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: '0.06em',
          // A first guess for SSR; the layout effect above fits the real text to the screen.
          fontSize: 'min(14vw, 44vh)',
          maxWidth: '100%',
          color: '#FFFFFF',
          marginBlock: '2vh',
          whiteSpace: 'nowrap',
        }}
      >
        {code}
      </div>

      <div className="flex flex-wrap items-center justify-center" style={{ gap: 'clamp(16px, 3vw, 48px)' }}>
        <div className="text-center">
          <p style={{ fontFamily: OUTFIT, fontWeight: 600, fontSize: 'clamp(14px, 1.5vw, 22px)', color: 'rgba(237,231,216,0.8)' }}>
            {t('code_present_join_at')}
          </p>
          <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 'clamp(22px, 3.4vw, 54px)', color: '#EDE7D8', letterSpacing: '0.01em', overflowWrap: 'anywhere' }}>
            {JOIN_HOST}/join
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-3 inline-flex items-center gap-2 rounded-xl px-5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1B3828] transition-[background-color] duration-150 hover:bg-[#F4E4A6] active:scale-[0.96]"
            style={{ height: 48, backgroundColor: '#EED98A', color: '#1B3828', fontFamily: OUTFIT, fontWeight: 800, fontSize: 16 }}
          >
            {copied ? <Check size={18} strokeWidth={3} aria-hidden /> : <Copy size={17} strokeWidth={2.4} aria-hidden />}
            <span aria-live="polite">{copied ? t('code_present_copied') : t('code_present_copy')}</span>
          </button>
        </div>
        <div aria-label={t('code_present_qr', { url: `${JOIN_HOST}/join` })} role="img" style={{ lineHeight: 0 }}>
          <QrSvg text={joinUrl} size={Math.round(Math.max(120, Math.min(vh * 0.26, 260)))} />
        </div>
      </div>

      <p className="text-center" style={{ marginTop: '2.5vh', fontFamily: OUTFIT, fontSize: 14, color: 'rgba(237,231,216,0.7)' }}>
        {t('code_present_hint')}
      </p>
    </div>,
    document.body,
  );
}
