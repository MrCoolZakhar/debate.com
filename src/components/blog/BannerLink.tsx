'use client';

/**
 * A product banner's link (ProductBanners.tsx). It is a plain next/link, so the
 * server renders a real <a href> that crawlers follow; the only client work is
 * the click count. A press adds one to the anonymous site counter
 * (/api/site-view, page `banner/<top|middle|bottom>/<variant>`, source
 * `click`), so the owner can see which banner works. No cookie, no id, nothing
 * personal, and the navigation never waits for the count (the
 * SheetDownloadLink pattern).
 */

import Link from 'next/link';

/** Must match the counter's page rule: /^[a-z0-9][a-z0-9/_-]{0,59}$/. */
export type BannerCountKey = `banner/${'top' | 'middle' | 'bottom'}/${string}`;

export default function BannerLink({
  href,
  count,
  className,
  children,
}: {
  href: string;
  count: BannerCountKey;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        try {
          void fetch('/api/site-view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page: count, source: 'click' }),
            keepalive: true,
          }).catch(() => { /* counting never blocks the click */ });
        } catch { /* counting never blocks the click */ }
      }}
    >
      {children}
    </Link>
  );
}
