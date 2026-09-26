'use client';

// The premium guide cards for /guides and /blog (26 Sep 2026). /guides lists
// every guide, the ones the reader can read first. /blog (`picks`) shows
// three: one for delegates, one for chairs, one for organisers, each the
// first guide of its audience, or the first one the reader can read. The
// server renders the default order; the reader's own guides move up once
// guide_access answers.

import type { GuideAudience, GuideMeta } from '@/lib/premiumGuides/types';
import { useGuideAccessMap } from '@/lib/useGuideAccess';
import GuideCard from './GuideCard';

const AUDIENCES: GuideAudience[] = ['Delegates', 'Chairs', 'Organisers'];

export default function GuideCardGrid({ guides, headingLevel = 3, picks = false }: {
  guides: GuideMeta[]; headingLevel?: 2 | 3; picks?: boolean;
}) {
  const access = useGuideAccessMap(guides.map(g => g.slug));
  const readable = (g: GuideMeta) => !!access[g.slug]?.can_read;

  let shown: GuideMeta[];
  if (picks) {
    shown = AUDIENCES
      .map(aud => {
        const of = guides.filter(g => g.audience === aud);
        return of.find(readable) ?? of[0];
      })
      .filter((g): g is GuideMeta => !!g);
  } else {
    // Stable: readable first, each group in the catalogue's own order.
    shown = [...guides.filter(readable), ...guides.filter(g => !readable(g))];
  }

  return (
    <div className="gvg-cards" style={picks ? undefined : { marginTop: 32 }}>
      {shown.map(g => (
        <GuideCard key={g.slug} guide={g} headingLevel={headingLevel} access={access[g.slug] ?? null} />
      ))}
    </div>
  );
}
