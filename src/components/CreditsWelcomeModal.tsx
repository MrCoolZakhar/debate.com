'use client';

import Link from 'next/link';
import { X, ArrowRight, TicketCheck, BadgePercent, RotateCcw, Coins } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import Portal from '@/components/Portal';

const WELL_ROWS = [
  { Icon: TicketCheck, bold: '1 credit covers 1 application', muted: 'to any conference' },
  { Icon: BadgePercent, bold: 'No processing fees', muted: 'on anything you pay' },
  { Icon: RotateCcw, bold: 'Refunded', muted: 'if your application is not accepted' },
];

// ── "Introducing Credits" onboarding modal ──────────────────────────────────
// Richer successor to the old one-time welcome-token pop-up, mounted globally
// (see CreditsWelcomeGate) rather than only on the profile page, so it can
// greet a fresh signup wherever postOnboardingDest sends them.
export default function CreditsWelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <Portal>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[2147483000] flex items-center justify-center px-4"
        style={{ backgroundColor: 'rgba(28,20,16,0.42)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)', animation: 'gvWelcomeFade 220ms ease' }}
      >
        <style>{`@keyframes gvWelcomeFade{from{opacity:0}to{opacity:1}}@keyframes gvWelcomePop{from{opacity:0;transform:translateY(10px) scale(0.97)}to{opacity:1;transform:none}}`}</style>
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

          <span
            className="inline-flex items-center justify-center gap-2"
            style={{ borderRadius: 999, padding: '6px 14px', backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}
          >
            <Coins size={13} strokeWidth={2.4} />
            1 credit added to your account
          </span>

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
