import Link from 'next/link';
import { Clock, Lock } from 'lucide-react';
import GuideIcon from '@/components/premiumGuides/GuideIcon';
import type { GuideMeta } from '@/lib/premiumGuides/types';

/** A premium guide card: one plain <a>, so crawlers follow it. */
export default function GuideCard({ guide, headingLevel = 3 }: { guide: GuideMeta; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <Link href={`/guides/${guide.slug}`} className="gvg-card">
      <span className="gvg-card-top">
        <GuideIcon name={guide.icon} size={18} />
        For {guide.audience.toLowerCase()}
      </span>
      <H className="gvg-card-title">{guide.title}</H>
      <p className="gvg-card-promise">{guide.promise}</p>
      <span className="gvg-card-foot">
        <span><Clock size={14} strokeWidth={2.2} aria-hidden="true" />{guide.readingMinutes} min read</span>
        <span><Lock size={14} strokeWidth={2.2} aria-hidden="true" />Included with Unlimited</span>
      </span>
    </Link>
  );
}
