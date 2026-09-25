'use client';

// A small "Yours" mark on a premium guide card the signed-in reader has
// unlocked (bought for 1 credit, or on Unlimited). Renders nothing until
// guide_access says so, so the server-rendered card never shifts for a
// visitor who is signed out.

import { useEffect, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { fetchGuideAccess } from '@/lib/guideAccess';

export default function GuideOwnedMark({ slug }: { slug: string }) {
  const { user, loading } = useAuth();
  const [owned, setOwned] = useState(false);
  const userId = user?.id ?? null;
  useEffect(() => {
    if (loading || !userId) return;
    let cancelled = false;
    void fetchGuideAccess(slug).then(a => { if (!cancelled) setOwned(!!a?.can_read); });
    return () => { cancelled = true; };
  }, [slug, userId, loading]);
  // Signed out (or a signed-out moment after a sign-out) shows nothing.
  if (!owned || !userId) return null;
  return (
    <span
      title="You can read the whole guide"
      className="inline-flex items-center gap-1"
      style={{
        fontFamily: 'var(--font-brand), sans-serif', fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
        color: '#1B3828', background: '#EED98A', padding: '2px 8px', borderRadius: 9999, marginLeft: 8,
      }}
    >
      <BadgeCheck size={12} strokeWidth={2.6} aria-hidden />
      Yours
    </span>
  );
}
