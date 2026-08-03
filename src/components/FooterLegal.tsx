import Link from 'next/link';
import { companyLegalLines, TRADING_NAME } from '@/lib/companyDetails';

/**
 * Shared legal / GDPR strip rendered at the bottom of every site footer.
 *
 * Deliberately hook-free and handler-free so it can be dropped into both server
 * components (e.g. /privacy) and client components. Hover states are static
 * Tailwind classes rather than inline JS so no 'use client' boundary is needed.
 *
 * Only links to routes that exist: /privacy (and its #your-rights anchor).
 * Do NOT add /terms or /cookies links here until those pages actually exist.
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

  return (
    <div
      className={`mx-auto mt-6 flex w-full max-w-5xl flex-col items-center gap-1.5 border-t pt-5 text-center ${className}`}
      style={{ borderColor: t.rule, fontFamily: "'Outfit', sans-serif" }}
    >
      <nav
        aria-label="Legal"
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
        style={{ fontSize: '11.5px' }}
      >
        <Link href="/privacy" className={t.link}>
          Privacy Policy
        </Link>
        <span aria-hidden="true" style={{ color: t.text, opacity: 0.5 }}>·</span>
        <Link href="/privacy#your-rights" className={t.link}>
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
