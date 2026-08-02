'use client';

// Route-level error boundary. Catches an unhandled throw in any page/component
// beneath the root layout and replaces the crashed subtree with a branded,
// recoverable card — instead of the browser's raw "This page couldn't load".
//
// The root layout (nav, fonts, background) still renders around this, so the
// user stays on Gavelling and can retry or navigate away.

import { useEffect } from 'react';
import Link from 'next/link';
import { reportCrash } from '@/lib/reportCrash';

const OUTFIT = "'Outfit', sans-serif";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { reportCrash(error); }, [error]);

  return (
    <div className="flex items-center justify-center px-6" style={{ minHeight: '70vh' }}>
      <div
        className="w-full text-center"
        style={{
          maxWidth: 460, backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0',
          borderRadius: 20, padding: '40px 32px',
        }}
      >
        <div
          className="flex items-center justify-center mx-auto mb-5"
          style={{
            width: 56, height: 56, borderRadius: 9999,
            backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.20)',
          }}
        >
          <span aria-hidden style={{ fontSize: 26 }}>⚠️</span>
        </div>

        <h2 className="font-black mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT, fontSize: 21, letterSpacing: '-0.01em' }}>
          Something went wrong
        </h2>
        <p className="text-sm mb-6" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.7 }}>
          This part of the page failed to load. The team has been alerted automatically — try again, or head back to safety.
        </p>

        <div className="flex items-center justify-center gap-2.5 flex-wrap">
          <button
            onClick={reset}
            className="rounded-full focus:outline-none"
            style={{
              padding: '12px 22px', backgroundColor: '#1B3828', color: '#EED98A',
              fontFamily: OUTFIT, fontWeight: 800, fontSize: 13.5, letterSpacing: '0.04em',
              border: 'none', cursor: 'pointer',
            }}
          >
            TRY AGAIN
          </button>
          <Link
            href="/"
            className="rounded-full focus:outline-none"
            style={{
              padding: '12px 22px', border: '1px solid #DDD4C0', color: '#1C1410',
              fontFamily: OUTFIT, fontWeight: 700, fontSize: 13.5, textDecoration: 'none',
            }}
          >
            Go home
          </Link>
        </div>

        {error?.digest && (
          <p className="mt-5" style={{ color: '#B6A88E', fontFamily: 'ui-monospace, monospace', fontSize: 10.5 }}>
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
