'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, ArrowRight, TicketCheck, BadgePercent, RotateCcw } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import Portal from '@/components/Portal';
import { useScrollLock } from '@/hooks/useScrollLock';

const WELL_ROWS = [
  { Icon: TicketCheck, bold: '1 credit covers 1 application', muted: 'to any conference' },
  { Icon: BadgePercent, bold: 'No processing fees', muted: 'on anything you pay' },
  { Icon: RotateCcw, bold: 'Refunded', muted: 'if your application is not accepted' },
];

// Expansion around the measured navbar credits chip before it's punched out
// of the backdrop, so the spotlight hole reads as breathing room around the
// chip rather than a tight outline traced right on its edge.
const CHIP_HOLE_PADDING = 6;

interface Rect { top: number; left: number; width: number; height: number; }

// ── "Introducing Credits" onboarding modal ──────────────────────────────────
// Richer successor to the old one-time welcome-token pop-up, mounted globally
// (see CreditsWelcomeGate) rather than only on the profile page, so it can
// greet a fresh signup wherever postOnboardingDest sends them.
export default function CreditsWelcomeModal({ onClose }: { onClose: () => void }) {
  // Spotlight hole over the navbar credits chip (data-credits-chip in
  // SiteNav.tsx), so it stays crisp and unblurred while the rest of the page
  // dims. Null when the chip isn't in the DOM, or is hidden below the
  // desktop breakpoint (a display:none element measures a 0×0 rect).
  const [hole, setHole] = useState<Rect | null>(null);

  // Modal: whatever page this greets a fresh signup on must not scroll behind it.
  useScrollLock(true);

  useEffect(() => {
    function measure() {
      const el = document.querySelector('[data-credits-chip]');
      if (!el) { setHole(null); return; }
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) { setHole(null); return; }
      setHole({
        top: r.top - CHIP_HOLE_PADDING,
        left: r.left - CHIP_HOLE_PADDING,
        width: r.width + CHIP_HOLE_PADDING * 2,
        height: r.height + CHIP_HOLE_PADDING * 2,
      });
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const holeRadius = hole ? hole.height / 2 : 0;
  // A pill-shaped SVG rect as the second mask layer: mask-composite: exclude
  // (xor in the legacy -webkit- syntax) subtracts its opaque area from the
  // full-page layer, cutting a real hole through both the dim color and the
  // backdrop-filter blur so the chip underneath shows through untouched.
  const holeMaskLayer = hole
    ? `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='${hole.width}' height='${hole.height}'><rect width='${hole.width}' height='${hole.height}' rx='${holeRadius}' ry='${holeRadius}' fill='#000'/></svg>`
      )}")`
    : null;

  const holeMaskStyle: React.CSSProperties = hole
    ? {
        WebkitMaskImage: `linear-gradient(#000,#000), ${holeMaskLayer}`,
        maskImage: `linear-gradient(#000,#000), ${holeMaskLayer}`,
        WebkitMaskSize: `100% 100%, ${hole.width}px ${hole.height}px`,
        maskSize: `100% 100%, ${hole.width}px ${hole.height}px`,
        WebkitMaskPosition: `0 0, ${hole.left}px ${hole.top}px`,
        maskPosition: `0 0, ${hole.left}px ${hole.top}px`,
        WebkitMaskRepeat: 'no-repeat, no-repeat',
        maskRepeat: 'no-repeat, no-repeat',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
      }
    : {};

  return (
    <Portal>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[2147483000] flex items-center justify-center px-4"
        style={{
          backgroundColor: 'rgba(28,20,16,0.42)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          animation: 'gvWelcomeFade 220ms ease',
          ...holeMaskStyle,
        }}
      >
        <style>{`@keyframes gvWelcomeFade{from{opacity:0}to{opacity:1}}@keyframes gvWelcomePop{from{opacity:0;transform:translateY(10px) scale(0.97)}to{opacity:1;transform:none}}@keyframes gvChipRingPulse{0%,100%{box-shadow:0 0 0 2px #EED98A, 0 0 8px rgba(238,217,138,0.25)}50%{box-shadow:0 0 0 4px rgba(238,217,138,0.6), 0 0 20px rgba(238,217,138,0.35)}}`}</style>

        {hole && (
          <div
            aria-hidden
            className="fixed pointer-events-none"
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
              borderRadius: holeRadius,
              animation: 'gvChipRingPulse 1.6s ease-in-out infinite',
            }}
          />
        )}

        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full text-center"
          style={{ maxWidth: 420, borderRadius: 26, backgroundColor: NEU.surface, boxShadow: NEU.out, padding: '0 30px 30px', animation: 'gvWelcomePop 260ms cubic-bezier(0.2,0.7,0.2,1)' }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute flex items-center justify-center"
            style={{ top: 14, right: 14, width: 30, height: 30, borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm, border: 'none', color: NEU.muted, cursor: 'pointer' }}
          >
            <X size={15} strokeWidth={2.4} />
          </button>

          {/* Gavin, arms wide open — overlapping the top edge for delight */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Otter.Tutorial.Intro.png"
            alt=""
            aria-hidden
            style={{ width: 190, height: 'auto', display: 'block', margin: '-46px auto -4px', filter: 'drop-shadow(0 10px 22px rgba(27,56,40,0.24))' }}
          />

          <h2 style={{ margin: '0 0 12px', lineHeight: 1.12, letterSpacing: '-0.01em' }}>
            <span style={{ fontFamily: OUTFIT, fontSize: 26, fontWeight: 900, color: NEU.ink }}>Introducing </span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 400, fontSize: 26, color: NEU.amber }}>Credits</span>
          </h2>
          <p style={{ fontFamily: OUTFIT, fontSize: 14, lineHeight: 1.6, color: NEU.muted, margin: '0 0 20px' }}>
            Credits are how applying works on Gavelling. They keep the site free of processing fees and automate every step for your organizers.
          </p>

          <div style={{ borderRadius: 18, backgroundColor: NEU.base, boxShadow: NEU.in, padding: '4px 16px', marginBottom: 18, textAlign: 'left' }}>
            {WELL_ROWS.map((row, i) => (
              <div
                key={row.bold}
                className="flex items-center"
                style={{ gap: 12, padding: '12px 0', borderTop: i > 0 ? '1px solid #DDD4C0' : 'none' }}
              >
                <span
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
                >
                  <row.Icon size={16} strokeWidth={2.2} style={{ color: NEU.forest }} />
                </span>
                <p style={{ fontFamily: OUTFIT, fontSize: 13, lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 700, color: NEU.ink }}>{row.bold}</span>{' '}
                  <span style={{ color: NEU.muted }}>{row.muted}</span>
                </p>
              </div>
            ))}
          </div>

          <p style={{ fontFamily: OUTFIT, fontSize: 13.5, marginBottom: 20 }}>
            <span style={{ fontWeight: 800, color: NEU.ink }}>The first credit is on us.</span>{' '}
            <span style={{ fontWeight: 700, color: NEU.deepGold }}>Apply to a conference today!</span>
          </p>

          <Link
            href="/conferences/explore"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 w-full"
            style={{ borderRadius: 14, padding: '13px 18px', backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, fontWeight: 800, fontSize: 14, letterSpacing: '0.04em', textTransform: 'uppercase', textDecoration: 'none', boxShadow: NEU.outSm }}
          >
            Explore conferences <ArrowRight size={16} strokeWidth={2.4} />
          </Link>
          <button
            onClick={onClose}
            style={{ marginTop: 12, background: 'none', border: 'none', color: NEU.muted, fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </Portal>
  );
}
