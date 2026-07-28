'use client';

// Skeleton.tsx, shared loading placeholders. One CSS-only shimmer primitive
// (SkeletonBlock) so every "data hasn't resolved yet" surface in the app
// shares one shimmer implementation instead of copy-pasted gradient markup.
// The actual sweep animation and its prefers-reduced-motion fallback live in
// the .neu-shimmer rule in globals.css.
//
// An empty state ("No open applications", "You haven't been assigned a
// committee yet") is a conclusion about data that has actually resolved. Use
// these while it hasn't, never render an empty state as a stand-in for
// "still loading."

import { NEU } from '@/components/neu';

export function SkeletonBlock({
  width = '100%', height = 14, radius = 8, tone = 'light', style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  /** 'light' for cream/ivory surfaces, 'dark' for a forest-green card. */
  tone?: 'light' | 'dark';
  style?: React.CSSProperties;
}) {
  const base = tone === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(154,138,120,0.16)';
  const sweep = tone === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)';
  return (
    <span
      aria-hidden
      className="neu-shimmer block flex-shrink-0"
      style={{
        width, height, borderRadius: radius,
        backgroundColor: base,
        backgroundImage: `linear-gradient(100deg, transparent 30%, ${sweep} 50%, transparent 70%)`,
        backgroundSize: '200% 100%',
        ...style,
      }}
    />
  );
}

/** Stands in for the dark "YOUR APPLICATION" sidebar card's inner content
 *  while it's still resolving. The caller keeps its own outer card (padding,
 *  background, border radius) and swaps only this in, so the box itself
 *  never changes size. */
export function SidebarCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <SkeletonBlock tone="dark" width="45%" height={9} radius={4} />
      <SkeletonBlock tone="dark" width="70%" height={18} radius={6} />
      <SkeletonBlock tone="dark" width="90%" height={12} radius={4} />
      <SkeletonBlock tone="dark" width="100%" height={44} radius={12} style={{ marginTop: 8 }} />
    </div>
  );
}

/** A raised neumorphic card, house style, standing in for a real section
 *  card in the participant column while its data resolves. */
export function SectionCardSkeleton() {
  return (
    <div
      className="rounded-[20px] p-6 md:p-7 flex flex-col gap-3"
      style={{ backgroundColor: NEU.surface, border: '1px solid #DDD4C0', boxShadow: NEU.outSm }}
    >
      <SkeletonBlock width="35%" height={11} radius={4} />
      <SkeletonBlock width="85%" height={16} radius={6} />
      <SkeletonBlock width="60%" height={13} radius={4} />
    </div>
  );
}
