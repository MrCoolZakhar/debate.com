'use client';

// Several roles per person (owner, 9 Nov 2026): under "Your application" on the
// conference page, the other roles this person can still apply for. A role
// they already applied to reads "Applied" and opens their role page; a role
// they cannot combine with one they HOLD is not offered, with one line saying
// what they are. Team roles (chair, secretariat, staff) combine; participant
// roles combine with nothing (src/lib/roleCombos.ts; the database decides).

import Link from 'next/link';
import { RoleApplyCards, type RoleTile } from './RoleApplyCards';
import { HOLDING_STATUSES, LIVE_STATUSES, rolesCombine, roleWithArticle } from '@/lib/roleCombos';

const FONT = 'var(--font-brand), sans-serif';

export default function OtherRolesBlock({ slug, apps, tiles, primaryRole, onPick }: {
  slug: string;
  /** Every application of this person at this conference. */
  apps: { role: string; status: string }[];
  /** One tile per enabled role, as the page builds them for a newcomer. */
  tiles: RoleTile[];
  /** The application the card above already shows. */
  primaryRole: string;
  onPick: (role: string) => void;
}) {
  const live = apps.filter(a => LIVE_STATUSES.has(a.status));
  if (live.length === 0) return null;
  const appliedRoles = new Set(live.map(a => a.role));
  const held = live.find(a => HOLDING_STATUSES.has(a.status)) ?? null;
  const underReview = live.find(a => a.status === 'submitted') ?? null;
  const offered = tiles.filter(t => !appliedRoles.has(t.role)
    && !live.some(a => HOLDING_STATUSES.has(a.status) && !rolesCombine(a.role, t.role)));
  const appliedOthers = [...appliedRoles].filter(r => r !== primaryRole);
  const line = held
    ? `You are ${roleWithArticle(held.role)} at this conference.`
    : underReview && offered.length > 0
      ? `You applied as ${roleWithArticle(underReview.role)}. You can apply for another role too.`
      : null;
  if (!line && offered.length === 0 && appliedOthers.length === 0) return null;
  const labelOf = (role: string) => tiles.find(t => t.role === role)?.label ?? role.replace(/-/g, ' ');

  return (
    <div className="mt-4 pt-4 flex flex-col gap-2.5" style={{ borderTop: '1px solid color-mix(in srgb, var(--gv-on-main) 18%, transparent)' }}>
      {line && (
        <p className="text-xs [overflow-wrap:anywhere]" style={{ margin: 0, color: 'color-mix(in srgb, var(--gv-on-main) 78%, transparent)', fontFamily: FONT, lineHeight: 1.55 }}>
          {line}
        </p>
      )}
      {appliedOthers.map(r => (
        <Link
          key={r}
          href={`/conferences/${slug}/role/${encodeURIComponent(r)}`}
          className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 focus:outline-none"
          style={{ backgroundColor: 'color-mix(in srgb, var(--gv-accent-light) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--gv-accent-light) 22%, transparent)', color: 'var(--gv-on-main)', textDecoration: 'none', fontFamily: FONT }}
        >
          <span className="text-sm font-bold [overflow-wrap:anywhere]">{labelOf(r)}</span>
          <span className="text-xs font-semibold">Applied</span>
        </Link>
      ))}
      {offered.length > 0 && <RoleApplyCards tiles={offered} onPick={onPick} />}
    </div>
  );
}
