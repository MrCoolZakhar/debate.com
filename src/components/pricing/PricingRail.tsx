'use client';

// ── The pricing section's two tabs ───────────────────────────────────────────
// A sticky rail beside the content from 1024px (position sticky, top 96px),
// a segmented control above it below that. The active tab is a forest fill
// with gold type, never a side stripe.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { OUTFIT } from '@/components/neu';

const TABS = [
  { href: '/pricing/credits', label: 'Credits' },
  { href: '/pricing/subscription', label: 'Subscription' },
] as const;

export default function PricingRail() {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Pricing" className="gv-pr-rail" style={{ fontFamily: OUTFIT }}>
      <p className="gv-pr-rail-eyebrow">Pricing</p>
      <ul className="gv-pr-tabs" role="list">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className="gv-pr-tab"
                data-active={active ? 'true' : 'false'}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
