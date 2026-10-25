'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps, FocusEvent, MouseEvent, TouchEvent } from 'react';

type LinkProps = ComponentProps<typeof Link>;

/**
 * A Link that prefetches on INTENT: hover, touchstart or keyboard focus, never
 * on entering the viewport (25 Oct 2026). Explore draws 100+ conference cards;
 * a viewport prefetch of each would fire a request per card on load. With the
 * route fetched the moment a pointer rests on a card, the click navigates
 * client-side at once (the conference's own loading.tsx shows while anything
 * left streams). The router dedupes repeated prefetches of the same address.
 */
export default function IntentLink({ href, onMouseEnter, onTouchStart, onFocus, ...rest }: LinkProps) {
  const router = useRouter();
  const target = typeof href === 'string' ? href : null;
  const warm = () => {
    if (!target) return;
    try {
      router.prefetch(target);
    } catch {
      // A prefetch is an optimisation: the click still navigates.
    }
  };
  return (
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={(e: MouseEvent<HTMLAnchorElement>) => { warm(); onMouseEnter?.(e); }}
      onTouchStart={(e: TouchEvent<HTMLAnchorElement>) => { warm(); onTouchStart?.(e); }}
      onFocus={(e: FocusEvent<HTMLAnchorElement>) => { warm(); onFocus?.(e); }}
      {...rest}
    />
  );
}
