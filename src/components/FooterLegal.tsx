import Link from 'next/link';
import { companyLegalLines, TRADING_NAME } from '@/lib/companyDetails';

/**
 * Shared legal / GDPR strip rendered at the bottom of every site footer.
 *
 * Deliberately hook-free and handler-free so it can be dropped into both server
 * components (e.g. /privacy) and client components. Hover states are static
 * Tailwind classes rather than inline JS so no 'use client' boundary is needed.
 *
 * Only links to routes that exist: the two public hubs (/conferences/explore,
 * /blog), the organiser landing page (/organisers), /terms, /privacy (and its #your-rights anchor). Do NOT add a
 * /cookies link here until that page actually exists.
 */

type Tone = 'ivory' | 'forest';

const TONE = {
  ivory: {
    text: '#9A8A78',
    rule: '#DDD4C0',
    link: 'text-[#9A8A78] hover:text-[#1B3828] transition-colors',
  },
  forest: {
    text: 'rgba(238,217,138,0.45)',
    rule: 'rgba(238,217,138,0.14)',
    link: 'text-[rgba(238,217,138,0.55)] hover:text-[#EED98A] transition-colors',
  },
} satisfies Record<Tone, { text: string; rule: string; link: string }>;

export default function FooterLegal({
  tone = 'ivory',
  /**
   * Most footers already render their own "© {year} Gavelling …" tagline, so this
   * defaults to off. Set true on any footer that has no copyright line of its own.
   */
  showCopyright = false,
  className = '',
}: {
  tone?: Tone;
  showCopyright?: boolean;
  className?: string;
}) {
  const t = TONE[tone];
  const companyLines = companyLegalLines();
  const year = new Date().getFullYear();

  // These five are 11.5px text, which gave them a 17px-tall hit area — a third
  // of the 44px tap-target floor, on a row where "Terms of Service" and
  // "Privacy Policy" sit two pixels apart. Padding the anchor (rather than
  // growing the type) makes each one thumb-sized on a phone and leaves the
  // desktop footer exactly as it was.
  const hubLink = `${t.link} inline-flex items-center px-1.5 min-h-[38px] md:min-h-0 md:px-0`;

  return (
    <div
      className={`mx-auto mt-6 flex w-full max-w-5xl flex-col items-center gap-1.5 border-t pt-5 text-center ${className}`}
      style={{ borderColor: t.rule, fontFamily: "var(--font-brand), sans-serif" }}
    >
      <nav
        aria-label="Legal"
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
        style={{ fontSize: '11.5px' }}
      >
        {/* Hub links: every public footer is a crawl path to the two hubs
            that list everything else (CLAUDE.md §4, indexability). */}
        <Link href="/conferences/explore" className={hubLink}>
          Explore Conferences
        </Link>
        <span aria-hidden="true" style={{ color: t.text, opacity: 0.5 }}>·</span>
        <Link href="/blog" className={hubLink}>
          MUN Guides
        </Link>
        <span aria-hidden="true" style={{ color: t.text, opacity: 0.5 }}>·</span>
        {/* The organiser landing page (server-rendered, in the sitemap). An
            information link, as the footer rule allows (CLAUDE.md §4). */}
        <Link href="/organisers" className={hubLink}>
          List your conference
        </Link>
        <span aria-hidden="true" style={{ color: t.text, opacity: 0.5 }}>·</span>
        <Link href="/terms" className={hubLink}>
          Terms of Service
        </Link>
        <span aria-hidden="true" style={{ color: t.text, opacity: 0.5 }}>·</span>
        <Link href="/privacy" className={hubLink}>
          Privacy Policy
        </Link>
        <span aria-hidden="true" style={{ color: t.text, opacity: 0.5 }}>·</span>
        <Link href="/privacy#your-rights" className={hubLink}>
          Your Data &amp; GDPR Rights
        </Link>
      </nav>

      <p style={{ color: t.text, fontSize: '11px', lineHeight: 1.6 }}>
        We process personal data under the UK GDPR and EU GDPR. To access, correct,
        export or delete your data, see{' '}
        <Link href="/privacy#your-rights" className={t.link}>
          Your Rights
        </Link>{' '}
        or email{' '}
        <a href="mailto:wearegavelling@gmail.com" className={t.link}>
          wearegavelling@gmail.com
        </a>
        .
      </p>

      {/*
        Company registration details render only once VERIFIED Companies House
        values have been filled into src/lib/companyDetails.ts. Until then this
        block renders nothing at all — never a placeholder, never a guess.
      */}
      {companyLines.length > 0 && (
        <p style={{ color: t.text, fontSize: '11px', lineHeight: 1.6 }}>
          {companyLines.join(' · ')}
        </p>
      )}

      {showCopyright && (
        <p style={{ color: t.text, fontSize: '11px' }}>
          © {year} {TRADING_NAME}
        </p>
      )}
    </div>
  );
}
