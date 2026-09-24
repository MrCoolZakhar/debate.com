import type { Metadata } from 'next';
import { Suspense } from 'react';
import { pageMetadata } from '@/lib/seo';
import AdvisorBoard from './board/AdvisorBoard';

// The Faculty Advisor board: every student an advisor follows, across every room, with
// a reminder before each speech. Private to the device (noindex by the /advisor header
// rule in next.config.ts as well).
export const metadata: Metadata = pageMetadata({
  title: 'My delegates',
  description: 'Follow your delegates across every committee room and be there when they speak.',
  path: '/advisor',
  robots: { index: false, follow: true },
});

export default function AdvisorBoardPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" style={{ backgroundColor: '#EDE7D8' }} />}>
      <AdvisorBoard />
    </Suspense>
  );
}
