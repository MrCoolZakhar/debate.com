'use client';

// Keeps where this visitor first came from for the conference `slug`, on the
// very first render of ANY page under /conferences/<slug> (the page, apply,
// pay, role pages, papers ...), before any page can send them to sign in.
// Judged by the landing document, so an auth round trip or an in-app hop can
// never overwrite or invent it (src/lib/trafficSource.ts). Stores a category
// and one word in localStorage; sends nothing and counts nothing.

import { useLayoutEffect, useEffect } from 'react';
import { ensureFirstTouch } from '@/lib/trafficSource';

// useLayoutEffect runs before a child's useEffect can router.replace; on the
// server it would warn, so fall back to useEffect there (it never runs anyway).
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export default function FirstTouchCapture({ slug }: { slug: string }) {
  useIsoLayoutEffect(() => { ensureFirstTouch(slug); }, [slug]);
  return null;
}
