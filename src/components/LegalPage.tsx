'use client';

// Shared furniture for the legal pages (/terms, /privacy) so they read as part
// of the site rather than two stray documents: the standard ivory + grain shell,
// SiteNav, the forest gradient banner used elsewhere on marketing pages, and a
// neumorphic disclosure ("slider") for long role-specific sections.

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import FooterLegal from '@/components/FooterLegal';

export const OUTFIT = "'Outfit', sans-serif";
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`;

/** Full page frame: grain + SiteNav + forest banner + content well + footer. */
export function LegalShell({
  title,
  italicWord,
  effectiveDate,
  intro,
  children,
}: {
  /** Leading words of the banner headline, e.g. 'Terms of'. */
  title: string;
  /** Final word, set in italic Playfair gold — matches the About banner. */
  italicWord: string;
  effectiveDate: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#EDE7D8] flex flex-col relative overflow-x-hidden">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: GRAIN, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }}
      />

      <SiteNav />

      {/* Banner — same forest gradient + Playfair accent as the About page. */}
      <section
        className="relative z-10 w-full flex items-end"
        style={{
          minHeight: 240,
          background: 'linear-gradient(135deg, #1B3828 0%, #2A5A3C 50%, #1B3828 100%)',
          borderBottom: '1px solid rgba(27,56,40,0.3)',
        }}
      >
        <div className="relative z-10 w-full max-w-4xl mx-auto px-6 md:px-8 pb-10 pt-14">
          <p
            className="uppercase mb-3"
            style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.2em', color: 'rgba(238,217,138,0.75)' }}
          >
            Legal
          </p>
          <h1
            className="font-black text-white tracking-tight leading-none"
            style={{ fontSize: 'clamp(34px, 5vw, 60px)' }}
          >
            {title}{' '}
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 400, color: '#EED98A' }}>
              {italicWord}
            </span>
          </h1>
          <p className="mt-4" style={{ color: 'rgba(237,231,216,0.6)', fontFamily: OUTFIT, fontSize: 13.5 }}>
            Effective {effectiveDate}
          </p>
        </div>
      </section>

      <main className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-6 md:px-8 py-14">
        {intro && (
          <div
            className="mb-12 rounded-2xl"
            style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', padding: '22px 24px' }}
          >
            <div className="text-sm leading-relaxed" style={{ color: '#3A2E26', fontFamily: OUTFIT }}>
              {intro}
            </div>
          </div>
        )}
        <div className="space-y-12">{children}</div>
      </main>

      <footer
        className="relative z-10 px-6 py-10"
        style={{ borderTop: '1px solid rgba(221,212,192,0.8)', backgroundColor: '#EDE7D8' }}
      >
        <div className="max-w-4xl mx-auto">
          <p className="text-xs text-center" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            © {new Date().getFullYear()} Gavelling. Built for the MUN community.
          </p>
          <FooterLegal tone="ivory" />
        </div>
      </footer>
    </div>
  );
}

/** A numbered top-level section. */
export function LegalSection({
  n,
  title,
  id,
  children,
}: {
  n: number;
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={id ? 'scroll-mt-24' : undefined}>
      <div className="flex items-baseline gap-3 mb-4">
        <span
          style={{
            fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 700,
            color: '#B6871F', fontVariantNumeric: 'tabular-nums',
          }}
        >
          {String(n).padStart(2, '0')}
        </span>
        <h2 className="font-black" style={{ color: '#1B3828', fontFamily: OUTFIT, fontSize: 21, letterSpacing: '-0.01em' }}>
          {title}
        </h2>
      </div>
      <div className="text-sm leading-relaxed space-y-3" style={{ color: '#3A2E26', fontFamily: OUTFIT }}>
        {children}
      </div>
    </section>
  );
}

/**
 * Neumorphic disclosure — the "slider" for role-specific terms. Collapsed by
 * default so the page stays scannable; each panel expands to the detail for one
 * audience (e.g. "Sessions · if you're a chair or delegate").
 *
 * Content stays MOUNTED and is hidden with max-height + visibility rather than
 * unmounted, so in-page search (Cmd-F) and crawlers still see every clause —
 * legal terms must never be hidden from the reader who goes looking for them.
 */
export function Disclosure({
  eyebrow,
  title,
  defaultOpen = false,
  children,
}: {
  eyebrow?: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: open ? '#FAF8F3' : 'rgba(250,248,243,0.6)',
        border: `1px solid ${open ? '#C9BEA6' : '#DDD4C0'}`,
        boxShadow: open ? '0 6px 20px rgba(27,56,40,0.06)' : 'none',
        transition: 'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center gap-3 text-left focus:outline-none"
        style={{ padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span className="flex-1 min-w-0">
          {eyebrow && (
            <span
              className="block uppercase mb-1"
              style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.16em', color: '#B6871F', fontWeight: 700 }}
            >
              {eyebrow}
            </span>
          )}
          <span className="block font-extrabold" style={{ color: '#1C1410', fontFamily: OUTFIT, fontSize: 15 }}>
            {title}
          </span>
        </span>
        <span
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 28, height: 28, borderRadius: 9999,
            backgroundColor: open ? '#1B3828' : 'rgba(27,56,40,0.06)',
            transition: 'background-color 180ms ease, transform 220ms cubic-bezier(0.2,0,0,1)',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        >
          <ChevronDown size={15} strokeWidth={2.6} style={{ color: open ? '#EED98A' : '#1B3828' }} />
        </span>
      </button>

      <div
        id={panelId}
        style={{
          maxHeight: open ? 4000 : 0,
          opacity: open ? 1 : 0,
          visibility: open ? 'visible' : 'hidden',
          overflow: 'hidden',
          transition: 'max-height 300ms cubic-bezier(0.2,0,0,1), opacity 200ms ease, visibility 300ms',
        }}
      >
        <div
          className="text-sm leading-relaxed space-y-3"
          style={{ color: '#3A2E26', fontFamily: OUTFIT, padding: '0 18px 18px', borderTop: '1px solid rgba(221,212,192,0.7)', paddingTop: 16 }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
