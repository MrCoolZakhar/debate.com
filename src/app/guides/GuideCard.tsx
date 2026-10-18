'use client';

import Link from 'next/link';
import { Clock, Lock } from 'lucide-react';
import { guideCover } from '@/lib/premiumGuides/covers';
import type { GuideMeta } from '@/lib/premiumGuides/types';
import type { GuideAccess } from '@/lib/guideAccess';
import { useGuideAccess } from '@/lib/useGuideAccess';
import GuideOwnedMark from '@/components/premiumGuides/GuideOwnedMark';

/** A premium guide card, built like the blog's post card (18 Oct 2026): the
 *  cover photo on top, then a small "Premium" mark with the audience, the
 *  title, the one-line promise, a short preview from the PUBLIC opening (the
 *  teaser the guide page already shows), and the reading time with a quiet
 *  "Unlock with Unlimited", or "Read" with the "Yours" / "Included" mark when
 *  the reader can open it. One plain <a> either way, so crawlers follow it;
 *  the server always renders the locked card. */
export default function GuideCard({ guide, headingLevel = 3, access }: {
  guide: GuideMeta; headingLevel?: 2 | 3;
  /** Pass when the list already read it; else the card reads its own. */
  access?: GuideAccess | null;
}) {
  const own = useGuideAccess(guide.slug);
  const a = access === undefined ? own : access;
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const readable = !!a?.can_read;
  const cutShort = guide.preview !== guide.previewFull;

  return (
    <Link href={`/guides/${guide.slug}`} className="gvg-post">
      <span className="gvg-post-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={guideCover(guide.slug)} alt="" aria-hidden="true" loading="lazy" />
      </span>
      <span className="gvg-post-body">
        <span className="gvg-post-kind">
          {readable ? null : <Lock size={14} strokeWidth={2.4} aria-hidden="true" />}
          <span>Premium · For {guide.audience.toLowerCase()}</span>
          {readable ? <GuideOwnedMark slug={guide.slug} access={a} /> : null}
        </span>
        <H className="gvg-post-title">{guide.title}</H>
        <span className="gvg-post-promise">{guide.promise}</span>
        {guide.preview ? (
          <span className="gvg-post-preview" title={cutShort ? guide.previewFull : undefined}>
            {guide.preview}
          </span>
        ) : null}
        <span className="gvg-post-foot">
          <span className="gvg-post-time">
            <Clock size={14} strokeWidth={2.1} aria-hidden="true" />
            {guide.readingMinutes} min read
          </span>
          <span className="gvg-post-go">{readable ? 'Read' : 'Unlock with Unlimited'}</span>
        </span>
      </span>
    </Link>
  );
}
