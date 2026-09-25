import Link from 'next/link';
import { Lock } from 'lucide-react';
import { guideCover } from '@/lib/premiumGuides/covers';
import type { GuideMeta } from '@/lib/premiumGuides/types';

/** A premium guide card: a cover photo under frosted glass, the lock, the
 *  title and promise, and the gold "Unlock with Unlimited" (the pricing page's
 *  gold button). One plain <a>, so crawlers follow it. */
export default function GuideCard({ guide, headingLevel = 3 }: { guide: GuideMeta; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
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
