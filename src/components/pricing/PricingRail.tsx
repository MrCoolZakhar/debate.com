'use client';

// ── The pricing section's two tabs ───────────────────────────────────────────
// A sticky rail beside the content from 1024px, a segmented control above it
// below that. The active tab is weight plus a forest fill, never a side stripe.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { OUTFIT } from '@/components/neu';

const TABS = [
  { href: '/pricing/credits', label: 'Credits', hint: 'A dollar an application' },
  { href: '/pricing/subscription', label: 'Subscription', hint: 'Unlimited, monthly or yearly' },
] as const;

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2';

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
                className={`gv-pr-tab ${FOCUS}`}
                data-active={active ? 'true' : 'false'}
              >
                <span className="gv-pr-tab-label">{t.label}</span>
                <span className="gv-pr-tab-hint">{t.hint}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="gv-pr-rail-note">Organisers pay nothing. Credits and Unlimited are for the people who apply.</p>
    </nav>
  );
}
