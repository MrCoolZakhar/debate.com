'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { guideCover } from '@/lib/premiumGuides/covers';
import type { GuideMeta } from '@/lib/premiumGuides/types';
import type { GuideAccess } from '@/lib/guideAccess';
import { useGuideAccess } from '@/lib/useGuideAccess';
import GuideOwnedMark from '@/components/premiumGuides/GuideOwnedMark';

/** A premium guide card. Locked: a cover photo under frosted glass, the lock
 *  and the gold "Unlock with Unlimited". Readable (Unlimited, or unlocked for
 *  1 credit; 26 Sep 2026): a plain post card, photo on top and text below,
 *  with the "Yours" / "Included" mark and no lock. One plain <a> either way,
 *  so crawlers follow it; the server always renders the locked card. */
export default function GuideCard({ guide, headingLevel = 3, access }: {
  guide: GuideMeta; headingLevel?: 2 | 3;
  /** Pass when the list already read it; else the card reads its own. */
  access?: GuideAccess | null;
}) {
  const own = useGuideAccess(guide.slug);
  const a = access === undefined ? own : access;
  const H = headingLevel === 2 ? 'h2' : 'h3';

  if (a?.can_read) {
    return (
      <Link href={`/guides/${guide.slug}`} className="gvg-card-open">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={guideCover(guide.slug)} alt="" aria-hidden="true" loading="lazy" className="gvg-card-open-cover" />
        <span className="gvg-card-open-body">
          <span className="gvg-card-top">
            Premium guide · For {guide.audience.toLowerCase()}
            <GuideOwnedMark slug={guide.slug} access={a} />
          </span>
          <H className="gvg-card-title">{guide.title}</H>
          <span className="gvg-card-promise">{guide.promise}</span>
          <span className="gvg-card-read">Read</span>
        </span>
      </Link>
    );
  }

  return (
    <Link href={`/guides/${guide.slug}`} className="gvg-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={guideCover(guide.slug)} alt="" aria-hidden="true" loading="lazy" className="gvg-card-cover" />
      <span className="gvg-card-glass">
        <span className="gvg-card-top">
          <Lock size={14} strokeWidth={2.4} aria-hidden="true" />
          Premium guide · For {guide.audience.toLowerCase()}
        </span>
        <H className="gvg-card-title">{guide.title}</H>
        <span className="gvg-card-promise">{guide.promise}</span>
        <span className="gvg-gold">
          <Lock size={15} strokeWidth={2.5} aria-hidden="true" />
          Unlock with Unlimited
        </span>
      </span>
    </Link>
  );
}
