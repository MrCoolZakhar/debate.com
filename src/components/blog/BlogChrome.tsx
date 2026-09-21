/**
 * The chrome every blog page wears: the site header at the top, a real footer
 * at the bottom, and the ivory page between them.
 *
 * WHY IT EXISTS. Until now a blog page had NO navigation at all. A reader
 * arriving from Google on "how to run a moderated caucus" reached a text column
 * with one link back to /blog and no way into the product, the conferences
 * directory, or anything else. That is the single biggest thing wrong with the
 * section (docs/ui-audit/00-DESIGN-RULEBOOK.md §8, item 2) and it is also an
 * indexability problem: CLAUDE.md §4 requires every sitemap URL to be reachable
 * by a plain server-rendered <a href> from another sitemap page, and the blog
 * was a leaf with one edge.
 *
 * `brand="conferences"` is stated rather than left to SiteNav's pathname
 * heuristic (which would read /blog as unknown). The blog is the top of the
 * whole funnel and Gavelling is conferences-first.
 */

import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import FooterLegal from '@/components/FooterLegal';
import { SHELVES, SHELF_ORDER } from './blogTaxonomy';

const C = {
  page: '#EDE7D8',
  forest: '#1B3828',
  inkSoft: '#55483C',
  muted: '#9A8A78',
  rule: '#DDD4C0',
};

/** One column of the footer's link grid. */
function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="m-0 text-[12.5px] font-bold" style={{ color: C.forest }}>
        {title}
      </p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[13.5px] no-underline transition-colors hover:text-[#1B3828]"
      style={{ color: C.inkSoft }}
    >
      {children}
    </Link>
  );
}

export default function BlogChrome({ children }: { children: React.ReactNode }) {
  const year = new Date().getFullYear();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.page, display: 'flex', flexDirection: 'column' }}>
      <SiteNav brand="conferences" />
      <main style={{ flex: 1 }}>{children}</main>

      <footer style={{ borderTop: `1.5px solid ${C.rule}`, marginTop: '72px' }}>
        <div className="mx-auto w-full max-w-5xl px-5 pt-12 pb-8 sm:px-8">
          <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-4">
            <FooterColumn title="Guides">
              {SHELF_ORDER.slice(0, 3).map((k) => (
                <FooterLink key={k} href={`/blog#${k}`}>
                  {SHELVES[k].label}
                </FooterLink>
              ))}
              <FooterLink href="/blog">All MUN guides</FooterLink>
            </FooterColumn>

            <FooterColumn title="Run a committee">
              <FooterLink href="/sessions">Gavelling Sessions</FooterLink>
              <FooterLink href="/create">Start a free session</FooterLink>
              <FooterLink href="/join">Join with a code</FooterLink>
            </FooterColumn>

            <FooterColumn title="Conferences">
              <FooterLink href="/conferences/explore">Explore conferences</FooterLink>
              <FooterLink href="/conferences/map">Conference map</FooterLink>
              <FooterLink href="/conferences/roles">Chair and staff roles</FooterLink>
            </FooterColumn>

            <FooterColumn title="Gavelling">
              <FooterLink href="/">Home</FooterLink>
              <FooterLink href="/about">About us</FooterLink>
              <FooterLink href="/contact">Contact</FooterLink>
            </FooterColumn>
          </div>

          <div
            className="mt-10 flex flex-col items-center gap-4 border-t pt-7 sm:flex-row sm:justify-between"
            style={{ borderColor: C.rule }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/GavellingLogo.webp"
              alt="Gavelling"
              width={132}
              height={33}
              loading="lazy"
              decoding="async"
              className="h-7 w-auto"
              style={{
                objectFit: 'contain',
                filter:
                  'brightness(0) saturate(100%) invert(18%) sepia(25%) saturate(800%) hue-rotate(100deg) brightness(85%)',
              }}
            />
            <div className="flex items-center gap-4">
              <a
                href="https://www.instagram.com/wearegavelling/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Gavelling on Instagram"
                className="inline-flex min-h-[38px] items-center px-1 transition-colors hover:text-[#1B3828]"
                style={{ color: C.muted }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <p className="m-0 text-xs font-semibold" style={{ color: C.forest }}>
                © {year} Gavelling. Built for the MUN community.
              </p>
            </div>
          </div>

          <FooterLegal tone="ivory" />
        </div>
      </footer>
    </div>
  );
}
