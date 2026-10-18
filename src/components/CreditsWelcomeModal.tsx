'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, ArrowRight, TicketCheck, BadgePercent, BookOpen, Users, Store } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import Portal from '@/components/Portal';
import { useScrollLock } from '@/hooks/useScrollLock';

// What credits are for (prompt 134), checked against what the site offers:
// the credits pop-up's "What they're for" (applying, the Store, guides), the
// delegation pool (fund_delegation_pool) and the refund on a rejection.
const WELL_ROWS = [
  { Icon: TicketCheck, bold: 'Apply to conferences', muted: '1 credit per conference, however many times you edit. Refunded if you are not accepted' },
  { Icon: BookOpen, bold: 'Unlock premium MUN guides', muted: '1 credit each, yours forever' },
  { Icon: Users, bold: 'Bring your delegation', muted: 'Head delegates and advisors can top up a delegation pool so their delegates apply free' },
  { Icon: Store, bold: 'Run your conference', muted: 'Organizers use credits in the Store for spotlights, bulk emails and sponsoring delegates' },
  { Icon: BadgePercent, bold: 'No processing fees', muted: 'Nothing extra on what you pay a conference' },
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
export default function CreditsWelcomeModal({
  onClose,
  /** Signed up with an address that had pre-registered. handle_new_user grants
   *  those accounts two credits instead of one and stamps
   *  profiles.pre_registered, so the modal can say the right number and thank
   *  them for it. Only ever true for a NEW signup, which is why nobody with an
   *  existing account gets an in-app nudge about the pre-registration credits:
   *  they are being emailed instead. */
  preRegistered = false,
}: { onClose: () => void; preRegistered?: boolean }) {
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
        className="fixed inset-0 z-[2147483000] flex items-center justify-center px-4 py-4"
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

        {/* This card is about 646px tall, so on a 667px phone it cleared the
            screen by ten pixels a side and on anything shorter (an SE at 568,
            or any phone with the URL bar down) it ran off both ends with no
            way to scroll to "Explore conferences". It is the first screen a
            new account sees, so it gets the same treatment as
            CompleteBasicsGate: a dvh cap and its own scroll.
            (18 Sep 2026 phone audit.) */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full text-center"
          style={{ maxWidth: 420, maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', borderRadius: 26, backgroundColor: NEU.surface, boxShadow: NEU.out, padding: '0 26px 22px', animation: 'gvWelcomePop 260ms cubic-bezier(0.2,0.7,0.2,1)' }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute flex items-center justify-center focus:outline-none"
            style={{ top: 7, right: 7, width: 44, height: 44, borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm, border: 'none', color: NEU.muted, cursor: 'pointer' }}
          >
            <X size={15} strokeWidth={2.4} />
          </button>

          {/* Gavin, arms wide open. He used to overlap the card's top edge
              (margin-top -46px), but the card scrolls (overflowY auto, for
              short phones), and a scroll container clips its content, so the
              top of his head was cut off at every size (owner, 23 Sep 2026).
              He now sits wholly inside the card: the PNG has ~10% clear space
              above the ears, so the head starts ~27px below the card's edge. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Otter.Tutorial.Intro.png"
            alt=""
            aria-hidden
            width={132}
            height={132}
            // Sized to the screen's height so the whole card fits a 390 x 844
            // phone and 1280 x 800 without its own scroll (prompt 134).
            style={{ width: 'clamp(80px, 13dvh, 132px)', height: 'clamp(80px, 13dvh, 132px)', display: 'block', margin: '6px auto -2px', filter: 'drop-shadow(0 10px 22px rgba(27,56,40,0.24))' }}
          />

          <h2 style={{ margin: '0 0 8px', lineHeight: 1.12, letterSpacing: '-0.01em', fontFamily: OUTFIT, fontSize: 26, fontWeight: 900, color: NEU.ink }}>
            Introducing Credits
          </h2>
          {/* inkSoft, not muted: muted is 2.7:1 on this surface and this is
              body copy, not a decorative label (rulebook section 3). */}
          <p style={{ fontFamily: OUTFIT, fontSize: 14, lineHeight: 1.5, color: NEU.inkSoft, margin: '0 0 14px' }}>
            Credits are how you apply and unlock things on Gavelling. One balance for everything
          </p>

          <div style={{ borderRadius: 18, backgroundColor: NEU.base, boxShadow: NEU.in, padding: '2px 14px', marginBottom: 14, textAlign: 'left' }}>
            {WELL_ROWS.map((row, i) => (
              <div
                key={row.bold}
                className="flex items-start"
                style={{ gap: 11, padding: '9px 0', borderTop: i > 0 ? '1px solid #DDD4C0' : 'none' }}
              >
                <span
                  className="inline-flex items-center justify-center flex-shrink-0"
                  style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: NEU.surface, boxShadow: NEU.outSm, marginTop: 1 }}
                >
                  <row.Icon size={15} strokeWidth={2.2} style={{ color: NEU.forest }} />
                </span>
                <p style={{ fontFamily: OUTFIT, fontSize: 12, lineHeight: 1.38, margin: 0, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 13.5, color: NEU.ink }}>{row.bold}</span>
                  <span style={{ display: 'block', color: NEU.inkSoft }}>{row.muted}</span>
                </p>
              </div>
            ))}
          </div>

          <p style={{ fontFamily: OUTFIT, fontSize: 13.5, lineHeight: 1.45, margin: '0 0 16px', padding: '10px 14px', borderRadius: 14, background: 'rgba(238,217,138,0.28)', boxShadow: 'inset 0 0 0 1px rgba(182,135,31,0.35)' }}>
            {preRegistered ? (
              <>
                <span style={{ fontWeight: 800, color: NEU.ink }}>Thank you for pre-registering. Your first two credits are on us.</span>{' '}
                <span style={{ fontWeight: 700, color: NEU.deepGold }}>Apply to a conference today!</span>
              </>
            ) : (
              <>
                <span style={{ fontWeight: 800, color: NEU.ink }}>Your first credit is on us.</span>{' '}
                <span style={{ fontWeight: 700, color: NEU.deepGold }}>Apply to a conference today!</span>
              </>
            )}
          </p>

          <Link
            href="/conferences/explore"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 w-full"
            style={{ borderRadius: 14, padding: '13px 18px', backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, fontWeight: 800, fontSize: 14.5, textDecoration: 'none', boxShadow: NEU.outSm }}
          >
            Explore conferences <ArrowRight size={16} strokeWidth={2.4} />
          </Link>
          <button
            onClick={onClose}
            style={{ marginTop: 8, minHeight: 36, background: 'none', border: 'none', color: NEU.muted, fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </Portal>
  );
}
