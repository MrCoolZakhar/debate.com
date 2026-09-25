import Link from 'next/link';
import { companyLegalLines, TRADING_NAME } from '@/lib/companyDetails';

/**
 * Shared legal / GDPR strip rendered at the bottom of every site footer.
 *
 * Deliberately hook-free and handler-free so it can be dropped into both server
 * components (e.g. /privacy) and client components. Hover states are static
 * Tailwind classes rather than inline JS so no 'use client' boundary is needed.
 *
 * Only links to routes that exist: the public hubs (/conferences/explore,
 * /conferences/all, /blog), the organiser landing page (/organisers), the two
 * session tools (/create, /join), /terms, /privacy (and its #your-rights
 * anchor). Do NOT add a /cookies link here until that page actually exists.
 *
 * Information links only (CLAUDE.md §4): never a list of conferences and never
 * a per-conference link. "All conferences" is a link TO the directory page,
 * which is the crawl path to every conference page and country hub.
 */

type Tone = 'ivory' | 'forest';

const TONE = {
  // Links were a light taupe the owner could not read (25 Sep 2026): now a
  // dark ink, forest and underlined on hover and focus.
  ivory: {
    text: '#5A5046',
    rule: '#DDD4C0',
    link: 'text-[#2B241E] font-semibold hover:text-[#1B3828] hover:underline focus-visible:underline underline-offset-[3px] transition-colors',
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

  // These links are 11.5px text, which gave them a 17px-tall hit area — a third
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
        {/* Hub links: every public footer is a crawl path to the hubs that
            list everything else (CLAUDE.md §4, indexability). /conferences/all
            is the server-rendered directory of every conference and country
            hub; the explore grid renders its links client-side. */}
        <Link href="/conferences/explore" className={hubLink}>
          Explore Conferences
        </Link>
        <span aria-hidden="true" style={{ color: t.text, opacity: 0.5 }}>·</span>
        <Link href="/conferences/all" className={hubLink}>
          All conferences
        </Link>
        <span aria-hidden="true" style={{ color: t.text, opacity: 0.5 }}>·</span>
        <Link href="/blog" className={hubLink}>
          MUN Guides
        </Link>
        <span aria-hidden="true" style={{ color: t.text, opacity: 0.5 }}>·</span>
        {/* "List your conference" goes straight into the creation wizard (owner,
            25 Sep 2026). "For organisers" keeps the organiser landing page
            (server-rendered, in the sitemap) reachable by a plain link, which the
            crawl rule needs (CLAUDE.md §4). */}
        <Link href="/conferences/new" className={hubLink}>
          List your conference
        </Link>
        <span aria-hidden="true" style={{ color: t.text, opacity: 0.5 }}>·</span>
        <Link href="/organisers" className={hubLink}>
          For organisers
        </Link>
        <span aria-hidden="true" style={{ color: t.text, opacity: 0.5 }}>·</span>
        {/* Pricing and the help center are public, indexable pages; this is
            their plain server-rendered crawl path from every public footer. */}
        <Link href="/pricing/credits" className={hubLink}>
          Pricing
        </Link>
        <span aria-hidden="true" style={{ color: t.text, opacity: 0.5 }}>·</span>
        <Link href="/help" className={hubLink}>
          Help
        </Link>
        <span aria-hidden="true" style={{ color: t.text, opacity: 0.5 }}>·</span>
        <Link href="/contact" className={hubLink}>
          Contact
        </Link>
        <span aria-hidden="true" style={{ color: t.text, opacity: 0.5 }}>·</span>
        <Link href="/about" className={hubLink}>
          About Gavelling
        </Link>
        <span aria-hidden="true" style={{ color: t.text, opacity: 0.5 }}>·</span>
        {/* The session tools, a plain server-rendered way in to both from
            every public page (the homepage's extra link row that carried them
            was removed on 24 Sep 2026). */}
        <Link href="/create/sessions" className={hubLink}>
          Create a committee
        </Link>
        <span aria-hidden="true" style={{ color: t.text, opacity: 0.5 }}>·</span>
        <Link href="/join" className={hubLink}>
          Join a session
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
