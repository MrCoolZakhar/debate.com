// The site's own 404 (prompt 56, 21 Nov 2026). Every notFound() and every unknown address lands here instead of
// Next's plain default page. Next serves it with a 404 status and noindex; no metadata here changes that.
// The root layout renders no nav, so this page mounts SiteNav and SiteFooter like the other public pages.
// A short message card, centred and at most 480 px wide on every screen, in the same look as error.tsx.

import Link from 'next/link';
import { Compass, Home, MapPinOff } from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';

const BRAND = 'var(--font-brand), sans-serif';
const INK = '#1C1410';
const FOREST = '#1B3828';

export default function NotFound() {
  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', backgroundColor: '#EDE7D8' }}>
      <SiteNav />
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div
          className="w-full text-center"
          style={{
            maxWidth: 480, backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0',
            borderRadius: 20, padding: 'clamp(28px, 6vw, 40px) clamp(20px, 6vw, 32px)',
            boxShadow: '0 12px 32px -18px rgba(27,56,40,0.28)',
          }}
        >
          <MapPinOff aria-hidden size={30} strokeWidth={1.5} color={INK} className="mx-auto mb-5" />

          <h1 className="mb-2" style={{ color: INK, fontFamily: BRAND, fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>
            Page Not Found
          </h1>
          <p className="mb-6" style={{ color: '#5A5046', fontFamily: BRAND, fontSize: 14.5, lineHeight: 1.65 }}>
            This page doesn&apos;t exist, or the link was cut off when it was copied. Check the address, or start again from one of these.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <Link
              href="/conferences/explore"
              className="inline-flex items-center gap-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2"
              style={{
                padding: '12px 20px', background: 'linear-gradient(135deg, #1B3828 0%, #2A5A3C 100%)', color: '#FFFDF8',
                fontFamily: BRAND, fontWeight: 700, fontSize: 14, textDecoration: 'none',
              }}
            >
              <Compass aria-hidden size={17} strokeWidth={1.5} />
              Explore conferences
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2"
              style={{
                padding: '12px 20px', border: '1px solid #DDD4C0', color: INK, backgroundColor: '#FFFDF8',
                fontFamily: BRAND, fontWeight: 700, fontSize: 14, textDecoration: 'none',
              }}
            >
              <Home aria-hidden size={17} strokeWidth={1.5} />
              Go home
            </Link>
          </div>

          <p className="mt-5" style={{ color: '#5A5046', fontFamily: BRAND, fontSize: 13.5 }}>
            Still stuck? Visit the{' '}
            <Link href="/help" className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={{ color: FOREST, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Help Center
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
