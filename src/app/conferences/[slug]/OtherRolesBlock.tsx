'use client';

// Several roles per person (owner, 9 Nov 2026): under "Your application" on the
// conference page, the other roles this person can still apply for. A role
// they already applied to reads "Applied" and opens their role page. Since
// 16 Nov 2026 every other role is offered, also to someone who HOLDS a role:
// accepting a role that does not combine removes the old one
// (src/lib/roleCombos.ts; the database decides). Since 18 Nov 2026 (owner)
// it also shows after a rejection or a withdrawal: a role never applied to is
// offered, the person's own turned-down role is resubmitted from its role page.

import Link from 'next/link';
import { RoleApplyCards, type RoleTile } from './RoleApplyCards';
import { HOLDING_STATUSES, LIVE_STATUSES, roleWithArticle } from '@/lib/roleCombos';

const FONT = 'var(--font-brand), sans-serif';

export default function OtherRolesBlock({ slug, apps, tiles, primaryRole, onPick, tone = 'main' }: {
  slug: string;
  /** Every application of this person at this conference. */
  apps: { role: string; status: string }[];
  /** One tile per enabled role, as the page builds them for a newcomer. */
  tiles: RoleTile[];
  /** The application the card above already shows. */
  primaryRole: string;
  onPick: (role: string) => void;
  /** 'main' on the conference-colour You card (default); 'light' on a white
   *  card, such as the role page after a turn-down (prompt 83). */
  tone?: 'main' | 'light';
}) {
  const light = tone === 'light';
  const live = apps.filter(a => LIVE_STATUSES.has(a.status));
  const appliedRoles = new Set(live.map(a => a.role));
  // One application per (conference, person, role): a role applied to in any
  // status can never get a second one, so it is never offered.
  const everApplied = new Set(apps.map(a => a.role));
  const held = live.find(a => HOLDING_STATUSES.has(a.status)) ?? null;
  const underReview = live.find(a => a.status === 'submitted') ?? null;
  const offered = tiles.filter(t => !everApplied.has(t.role));
  const appliedOthers = [...appliedRoles].filter(r => r !== primaryRole);
  const line = held
    ? offered.length > 0
      ? `You are ${roleWithArticle(held.role)} at this conference. You can apply for another role too.`
      : `You are ${roleWithArticle(held.role)} at this conference.`
    : underReview && offered.length > 0
      ? `You applied as ${roleWithArticle(underReview.role)}. You can apply for another role too.`
      : offered.length > 0
        ? 'You can still apply for another role.'
        : null;
  if (!line && offered.length === 0 && appliedOthers.length === 0) return null;
  const labelOf = (role: string) => tiles.find(t => t.role === role)?.label ?? role.replace(/-/g, ' ');

  return (
    <div className="mt-4 pt-4 flex flex-col gap-2.5" style={{ borderTop: light ? '1px solid var(--gv-border)' : '1px solid color-mix(in srgb, var(--gv-on-main) 18%, transparent)' }}>
      {line && (
        <p className="text-xs [overflow-wrap:anywhere]" style={{ margin: 0, color: light ? '#6B5F52' : 'color-mix(in srgb, var(--gv-on-main) 78%, transparent)', fontFamily: FONT, lineHeight: 1.55 }}>
          {line}
        </p>
      )}
      {appliedOthers.map(r => (
        <Link
          key={r}
          href={`/conferences/${slug}/role/${encodeURIComponent(r)}`}
          className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 focus:outline-none"
          style={light
            ? { backgroundColor: '#FFFFFF', border: '1px solid var(--gv-border)', color: 'var(--gv-main)', textDecoration: 'none', fontFamily: FONT }
            : { backgroundColor: 'color-mix(in srgb, var(--gv-accent-light) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--gv-accent-light) 22%, transparent)', color: 'var(--gv-on-main)', textDecoration: 'none', fontFamily: FONT }}
        >
          <span className="text-sm font-bold [overflow-wrap:anywhere]">{labelOf(r)}</span>
          <span className="text-xs font-semibold">Applied</span>
        </Link>
      ))}
      {offered.length > 0 && <RoleApplyCards tiles={offered} onPick={onPick} />}
    </div>
  );
}
