'use client';

// ── "N team applicants waiting in Team" (Job Board prompt 3; Team, 14 Nov 2026)
//
// Chair, secretariat and staff applicants are decided only in Team, so the
// Applications page never lists them. This one slim line says where they
// went. Nothing when there are none.

import Link from 'next/link';
import { NEU, OUTFIT } from '@/components/neu';

export default function TeamApplicantsLine({ count, slug }: { count: number; slug: string }) {
  if (count <= 0) return null;
  const one = count === 1;
  return (
    <p style={{ fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 500, color: NEU.inkSoft, margin: '0 0 12px', lineHeight: 1.5 }}>
      <Link
        href={`/manage/${slug}/team`}
        className="focus:outline-none"
        style={{ fontWeight: 700, color: NEU.forest, textDecoration: 'underline', textUnderlineOffset: 3 }}
      >
        {count} team applicant{one ? '' : 's'} waiting in Team
      </Link>
    </p>
  );
}
