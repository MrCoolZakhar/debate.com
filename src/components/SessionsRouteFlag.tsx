'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { isSessionsPath } from '@/lib/sessionRoutes';

/** Keeps the lighter Inter weights (<style id="gv-lighter-weights">, added
 *  before first paint by the inline script in layout.tsx) off Sessions pages
 *  across client-side navigation. */
export default function SessionsRouteFlag() {
  const pathname = usePathname();
  useEffect(() => {
    const el = document.getElementById('gv-lighter-weights') as HTMLStyleElement | null;
    if (el) el.media = isSessionsPath(pathname) ? 'not all' : 'all';
  }, [pathname]);
  return null;
}
