'use client';

// ── "N team applicants are in Settings > Team" (Job Board prompt 3) ──────
//
// Secretariat and staff applicants are decided only in Settings > Team, so
// the Applications page never lists them. This one slim line says where they
// went. Nothing when there are none.

import Link from 'next/link';
import { NEU, OUTFIT } from '@/components/neu';

export default function TeamApplicantsLine({ count, slug }: { count: number; slug: string }) {
  if (count <= 0) return null;
  const one = count === 1;
  return (
    <p style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 500, color: NEU.inkSoft, margin: '0 0 12px', lineHeight: 1.5 }}>
      {count} team applicant{one ? '' : 's'} {one ? 'is' : 'are'} in{' '}
      <Link
        href={`/manage/${slug}/settings?tab=team`}
        className="focus:outline-none"
        style={{ fontWeight: 700, color: NEU.forest, textDecoration: 'underline', textUnderlineOffset: 3 }}
      >
        Settings &gt; Team
      </Link>
    </p>
  );
}
