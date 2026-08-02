'use client';

// Root error boundary — the last line of defence. This one replaces the ENTIRE
// document (it renders its own <html>/<body>), because it catches throws in the
// root layout itself, where nav, fonts and providers may never have mounted.
//
// So it is deliberately self-contained: no imports from the design system, no
// webfont, no providers — only inline styles and system fonts. A fallback that
// depends on the thing that just broke is not a fallback.

import { useEffect } from 'react';
import { reportCrash } from '@/lib/reportCrash';

const SYSTEM_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { reportCrash(error); }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, backgroundColor: '#EDE7D8' }}>
        <div
          style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '24px', boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: '100%', maxWidth: 460, textAlign: 'center', backgroundColor: '#FAF8F3',
              border: '1px solid #DDD4C0', borderRadius: 20, padding: '40px 32px',
              fontFamily: SYSTEM_FONT,
            }}
          >
            <div
              style={{
                width: 56, height: 56, borderRadius: 9999, margin: '0 auto 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.20)',
                fontSize: 26,
              }}
            >
              <span aria-hidden>⚠️</span>
            </div>

            <h1 style={{ color: '#1C1410', fontSize: 21, fontWeight: 800, margin: '0 0 8px' }}>
              Gavelling hit a snag
            </h1>
            <p style={{ color: '#9A8A78', fontSize: 14, lineHeight: 1.7, margin: '0 0 24px' }}>
              The page couldn&apos;t load. The team has been alerted automatically — please try again in a moment.
            </p>

            <button
              onClick={reset}
              style={{
                padding: '12px 22px', backgroundColor: '#1B3828', color: '#EED98A',
                fontFamily: SYSTEM_FONT, fontWeight: 700, fontSize: 13.5, letterSpacing: '0.04em',
                border: 'none', borderRadius: 999, cursor: 'pointer',
              }}
            >
              TRY AGAIN
            </button>

            {error?.digest && (
              <p style={{ color: '#B6A88E', fontFamily: 'ui-monospace, monospace', fontSize: 10.5, marginTop: 20 }}>
                Reference: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
