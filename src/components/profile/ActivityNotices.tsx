'use client';

/**
 * "Needs your attention": the top section of the profile menu (ProfileDropdown)
 * and of the SiteNav phone sheet. Every row is a link straight to the place the
 * thing is done: accept the invitation, pay, read the reply, finish the draft,
 * review the applications. Data and rules: src/lib/myActivity.ts.
 *
 * Renders nothing when there is nothing (or when the read failed: a missing
 * section is better than a broken one). At most six rows, then a quiet
 * "N more" line to /my-conferences.
 */

import Link from 'next/link';
import { useState } from 'react';
import {
  Gavel, UserPlus, Ticket, CreditCard, FileWarning, MessageSquareText, FileClock, MapPin,
  ClipboardList, Receipt, Inbox, HandCoins, ChevronRight, type LucideIcon,
} from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import type { ActivityItem, ActivityKind } from '@/lib/myActivity';

const FONT = "'Outfit', sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5C4A3A';

interface KindLook { icon: LucideIcon; fg: string; bg: string }
const LOOK: Record<ActivityKind, KindLook> = {
  chair_invite: { icon: Gavel, fg: '#2A5A3C', bg: 'rgba(61,122,82,0.14)' },
  organiser_invite: { icon: UserPlus, fg: '#2A5A3C', bg: 'rgba(61,122,82,0.14)' },
  import_invite: { icon: Ticket, fg: '#2A5A3C', bg: 'rgba(61,122,82,0.14)' },
  proof_rejected: { icon: FileWarning, fg: '#8B2020', bg: 'rgba(139,32,32,0.10)' },
  payment_due: { icon: CreditCard, fg: '#8B2020', bg: 'rgba(139,32,32,0.10)' },
  reply: { icon: MessageSquareText, fg: '#2F6076', bg: 'rgba(47,96,118,0.12)' },
  draft: { icon: FileClock, fg: '#8A6614', bg: 'rgba(182,135,31,0.16)' },
  allocation: { icon: MapPin, fg: '#2A5A3C', bg: 'rgba(61,122,82,0.14)' },
  org_applications: { icon: ClipboardList, fg: '#1B3828', bg: 'rgba(27,56,40,0.10)' },
  org_proofs: { icon: Receipt, fg: '#1B3828', bg: 'rgba(27,56,40,0.10)' },
  org_inbox: { icon: Inbox, fg: '#1B3828', bg: 'rgba(27,56,40,0.10)' },
  org_aid: { icon: HandCoins, fg: '#1B3828', bg: 'rgba(27,56,40,0.10)' },
};

/** Conference logo (or the allocated flag) with the kind's icon on its corner;
 *  the icon alone on its tinted disc when there is no picture. */
function Mark({ item, size }: { item: ActivityItem; size: number }) {
  const look = LOOK[item.kind];
  const Icon = look.icon;
  const [logoFailed, setLogoFailed] = useState(false);
  const badge = Math.round(size * 0.52);

  if (item.kind === 'allocation' && (item.countryCode || item.countryName)) {
    return (
      <span className="relative shrink-0" style={{ width: size, height: size }}>
        <CircleFlag code={item.countryCode} country={item.countryName} size={size} decorative />
      </span>
    );
  }

  if (item.logoUrl && !logoFailed) {
    return (
      <span className="relative shrink-0" style={{ width: size, height: size }}>
        <span
          className="flex items-center justify-center overflow-hidden rounded-full"
          style={{ width: size, height: size, backgroundColor: '#FFFEFA', boxShadow: 'inset 0 0 0 0.5px #E7E0CF' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.logoUrl} alt="" onError={() => setLogoFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />
        </span>
        <span
          aria-hidden
          className="absolute flex items-center justify-center rounded-full"
          style={{ width: badge, height: badge, right: -3, bottom: -3, backgroundColor: '#FAF8F3', boxShadow: '0 0 0 1.5px #FAF8F3' }}
        >
          <span className="flex items-center justify-center rounded-full" style={{ width: badge, height: badge, backgroundColor: look.bg }}>
            <Icon size={Math.round(badge * 0.62)} strokeWidth={2.4} style={{ color: look.fg }} />
          </span>
        </span>
      </span>
    );
  }

  return (
    <span className="flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, backgroundColor: look.bg }}>
      <Icon size={Math.round(size * 0.5)} strokeWidth={2.2} style={{ color: look.fg }} />
    </span>
  );
}

const MAX_ROWS = 6;

export default function ActivityNotices({
  items,
  onNavigate,
  variant = 'menu',
}: {
  /** Already filtered to what should show (isVisibleActivity). */
  items: ActivityItem[];
  onNavigate: () => void;
  /** `sheet` = the SiteNav phone sheet: 44px rows, no own background band. */
  variant?: 'menu' | 'sheet';
}) {
  if (items.length === 0) return null;
  const sheet = variant === 'sheet';
  const shown = items.slice(0, MAX_ROWS);
  const more = items.length - shown.length;

  return (
    <section
      aria-label="Needs your attention"
      className={sheet ? 'pb-1' : 'pt-2.5 pb-1.5'}
      style={{ fontFamily: FONT, backgroundColor: sheet ? 'transparent' : 'rgba(182,135,31,0.06)' }}
    >
      <p
        className="flex items-center gap-1.5 px-4 pb-1.5 font-bold"
        style={{ color: '#8A6614', fontSize: 10, letterSpacing: '0.08em' }}
      >
        <span aria-hidden className="inline-block rounded-full" style={{ width: 7, height: 7, backgroundColor: '#B6871F', boxShadow: '0 0 0 3px rgba(182,135,31,0.18)' }} />
        NEEDS YOUR ATTENTION
        <span className="ms-auto" style={{ color: '#8A6614', fontVariantNumeric: 'tabular-nums' }}>{items.length}</span>
      </p>
      <ul className="m-0 list-none p-0">
        {shown.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className="group flex items-center gap-2.5 px-4 focus:outline-none focus-visible:bg-[rgba(27,56,40,0.07)] hover:bg-[rgba(27,56,40,0.05)] transition-colors"
              style={{ textDecoration: 'none', minHeight: sheet ? 48 : 44, paddingTop: 6, paddingBottom: 6 }}
            >
              <Mark item={item} size={sheet ? 30 : 28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold" style={{ color: INK, fontSize: sheet ? 13.5 : 12.5, lineHeight: 1.25 }}>
                  {item.title}
                </span>
                <span className="block truncate" title={item.detail} style={{ color: INK_SOFT, fontSize: sheet ? 12 : 11, lineHeight: 1.3 }}>
                  {item.detail}
                </span>
              </span>
              <ChevronRight
                aria-hidden
                size={14}
                strokeWidth={2.2}
                className="shrink-0 transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
                style={{ color: '#9A8A78' }}
              />
            </Link>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <Link
          href="/my-conferences"
          onClick={onNavigate}
          className="block px-4 py-1.5 font-semibold focus:outline-none hover:underline"
          style={{ color: '#1B3828', fontSize: 11, textDecoration: 'none' }}
        >
          {more} more in My conferences
        </Link>
      )}
    </section>
  );
}
