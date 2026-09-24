'use client';

/**
 * ProfileAvatar: the signed-in user's circle in the top-right of every
 * non-session top bar (SiteNav, the /manage bar, /join, /create, the public CV).
 *
 * Only the picture (`profiles.avatar_url`), or 1 to 2 initials on a calm
 * forest-tinted ground when there is none or it fails to load. A very faint
 * forest-green gradient ring sits around it, over a soft forest-tinted drop
 * shadow that lifts it off the bar. Nothing else: no name, no pill.
 *
 * SIZE (17 Sep 2026, owner: "increase the size by 100%"). The avatar is as large
 * as its bar allows: the rule is the bar's height less 12px of clearance, capped
 * at 80 (the doubled 40). No bar in the app is tall enough for the full 80 today,
 * so each call site passes the number that rule gives for its own bar:
 * 60 in SiteNav (72px) and the /create select bar,
 * 56 on the SiteNav phone row, 52 on /join (64px), 48 on the public CV (60px),
 * 44 in the /manage bar and the /create build bar (both 56px). Never pass a size
 * larger than the bar less 12: it overhangs the bar's own edge.
 *
 * `ProfileAvatarMenu` is the drop-in for a top bar: the avatar as the trigger of
 * the shared `ProfileDropdown` (hover-open, click-toggle, portaled panel), and
 * nothing at all while signed out, so each bar keeps its own Sign in button.
 *
 * THE ATTENTION BADGES (24 Sep 2026, owner: "RED for messages or drafts,
 * ORANGE for new applications, invites, accepted, allocated, any
 * notification"). Two counts from src/lib/myActivity.ts, as plain numerals,
 * 9+ past nine, each hidden at zero:
 *   RED    on the top corner: unread messages + unfinished application drafts.
 *   ORANGE: new applications (organiser), invites, accepted, allocated,
 *          payment due, reviews waiting, live rooms. On the top corner when it
 *          is the only one; on the BOTTOM corner beside the red one when both.
 * The accessible name lists both. The informational part clears once seen
 * (opening the menu, or the applications page for new applications).
 *
 * Never mount this on /chair, /delegate, /advisor or /voting.
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import ProfileDropdown from '@/components/ProfileDropdown';
import { useMyActivity, markActivityKeySeen, activityWeight } from '@/lib/myActivity';
import { useLiveRooms } from '@/lib/liveRooms';

const OUTFIT = "'Outfit', sans-serif";

/** 1 to 2 letters: first + last word of the display name, else the email's first letter. */
export function profileInitials(name: string | null | undefined, email?: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (Array.from(words[0])[0] + Array.from(words[words.length - 1])[0]).toUpperCase();
  }
  if (words.length === 1) {
    const chars = Array.from(words[0]);
    return chars[0].toUpperCase();
  }
  const e = (email ?? '').trim();
  return e ? Array.from(e)[0].toUpperCase() : '?';
}

export type ProfileAvatarTone = 'light' | 'dark';

/** A soft drop shadow, forest-tinted on ivory and plain dark on the forest bar.
 *  It grows with the circle, so a 44px avatar is not wearing a 60px avatar's lift. */
function avatarShadow(size: number, tone: ProfileAvatarTone): string {
  const y = Math.max(2, Math.round(size * 0.085));
  const blur = Math.max(6, Math.round(size * 0.26));
  return tone === 'dark'
    ? `0 1px 2px rgba(0,0,0,0.22), 0 ${y}px ${blur}px rgba(0,0,0,0.34)`
    : `0 1px 2px rgba(27,56,40,0.12), 0 ${y}px ${blur}px rgba(27,56,40,0.22)`;
}

const RING: Record<ProfileAvatarTone, string> = {
  // On ivory: a faint forest wash, a touch stronger at the top-left.
  light: 'linear-gradient(145deg, rgba(61,122,82,0.42) 0%, rgba(27,56,40,0.14) 100%)',
  // On the forest /manage bar: pale sage fading out.
  dark: 'linear-gradient(145deg, rgba(168,208,178,0.50) 0%, rgba(168,208,178,0.12) 100%)',
};

const GROUND: Record<ProfileAvatarTone, { bg: string; ink: string }> = {
  light: { bg: 'linear-gradient(150deg, #DDE5D6 0%, #C8D6C4 100%)', ink: '#1B3828' },
  dark: { bg: 'linear-gradient(150deg, #2E5A40 0%, #244A34 100%)', ink: '#EED98A' },
};

export function ProfileAvatar({
  url,
  name,
  email,
  size = 40,
  tone = 'light',
}: {
  url: string | null | undefined;
  name: string | null | undefined;
  email?: string | null;
  size?: number;
  tone?: ProfileAvatarTone;
}) {
  // Remember which URL failed, so a new picture gets a fresh chance.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = !!url && failedUrl !== url;
  const initials = profileInitials(name, email);
  // The ring keeps its weight relative to the circle, so a bigger avatar does not
  // look like a thin hairline around a big disc.
  const ring = Math.max(1.5, size * 0.04);
  const inner = size - ring * 2;

  return (
    <span
      aria-hidden
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, padding: ring, background: RING[tone], boxShadow: avatarShadow(size, tone) }}
    >
      {showImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={url!}
          alt=""
          draggable={false}
          onError={() => setFailedUrl(url!)}
          // A server-rendered <img> can fail before React attaches onError.
          ref={(node) => { if (node && node.complete && node.naturalWidth === 0) setFailedUrl(url!); }}
          className="block rounded-full object-cover"
          style={{ width: inner, height: inner }}
        />
      ) : (
        <span
          className="flex items-center justify-center rounded-full select-none"
          style={{
            width: inner,
            height: inner,
            background: GROUND[tone].bg,
            color: GROUND[tone].ink,
            fontFamily: OUTFIT,
            fontWeight: 700,
            fontSize: Math.round(size * (initials.length > 1 ? 0.36 : 0.42)),
            letterSpacing: initials.length > 1 ? '0.02em' : 0,
            lineHeight: 1,
          }}
        >
          {initials}
        </span>
      )}
    </span>
  );
}

const RED_BG = '#C81E1E';
const RED_INK = '#FFFFFF';
const ORANGE_BG = '#EA6A12';
const ORANGE_INK = '#1C1410';

/** One round counter on the avatar's edge. Plain numerals, 9+ past nine. */
function Counter({ n, bg, ink, size, ring, place }: {
  n: number; bg: string; ink: string; size: number; ring: string; place: 'top' | 'bottom';
}) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute flex items-center justify-center rounded-full"
      style={{
        ...(place === 'top' ? { top: 0 } : { bottom: 0 }),
        right: 0,
        minWidth: size,
        height: size,
        padding: '0 3px',
        backgroundColor: bg,
        color: ink,
        boxShadow: `0 0 0 2px ${ring}`,
        fontFamily: OUTFIT,
        fontWeight: 700,
        fontSize: Math.round(size * 0.62),
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}
    >
      {n > 9 ? '9+' : n}
    </span>
  );
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The avatar badges' accessible text, e.g. ", 2 messages or drafts, 5 new notifications". */
export function attentionLabel(red: number, orange: number): string {
  const parts: string[] = [];
  if (red > 0) parts.push(count(red, 'unread message or draft', 'unread messages or drafts'));
  if (orange > 0) parts.push(count(orange, 'new notification', 'new notifications'));
  return parts.length ? `, ${parts.join(', ')}` : '';
}

/** The signed-in user's avatar as the account-menu trigger. Renders nothing while signed out. */
export default function ProfileAvatarMenu({
  size = 40,
  tone = 'light',
  panelStyle,
}: {
  size?: number;
  tone?: ProfileAvatarTone;
  panelStyle?: React.CSSProperties;
}) {
  const { user, profile, session, loading } = useAuth();
  const uid = loading ? null : user?.id ?? null;
  const token = session?.access_token ?? null;
  const { items, counts, seen } = useMyActivity(uid, token);
  const { entries: live } = useLiveRooms(uid, token);

  // Opening a conference's applications page counts as seeing its new ones.
  const pathname = usePathname();
  const appsSlug = /^\/manage\/([^/]+)\/applications(?:\/|$)/.exec(pathname ?? '')?.[1] ?? null;
  const appsItem = appsSlug && items
    ? items.find((i) => i.kind === 'org_applications' && i.href.startsWith(`/manage/${appsSlug}/`)) ?? null
    : null;
  const appsKey = appsItem && activityWeight(appsItem, seen) > 0 ? appsItem.seenKey : null;
  useEffect(() => {
    if (uid && appsKey) markActivityKeySeen(uid, appsKey, token);
    // token is read at call time only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, appsKey]);

  if (!user) return null;
  const red = counts.red;
  const orange = counts.orange + (live?.length ?? 0);
  const name = profile?.display_name || null;
  const label = `Account menu${name ? `, ${name}` : ''}${attentionLabel(red, orange)}`;
  const badge = Math.max(16, Math.round(size * 0.34));
  const ring = tone === 'dark' ? '#1B3828' : '#EDE7D8';
  const offset = tone === 'dark' ? 'focus-visible:ring-offset-[#1B3828]' : 'focus-visible:ring-offset-[#EDE7D8]';

  return (
    <ProfileDropdown
      panelStyle={panelStyle}
      trigger={(open, toggle) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={label}
          aria-expanded={open}
          title={name ?? user.email ?? undefined}
          className={`relative flex flex-shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 ${offset} active:scale-[0.96] hover:brightness-[1.04]`}
          style={{ width: size, height: size, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', transitionProperty: 'transform, filter', transitionDuration: '150ms' }}
        >
          <ProfileAvatar url={profile?.avatar_url} name={name} email={profile?.email ?? user.email} size={size} tone={tone} />
          {red > 0 && <Counter n={red} bg={RED_BG} ink={RED_INK} size={badge} ring={ring} place="top" />}
          {orange > 0 && (
            <Counter
              n={orange}
              bg={ORANGE_BG}
              ink={ORANGE_INK}
              // Beside a red counter it is a size smaller, so red still reads first.
              size={red > 0 ? Math.max(14, Math.round(badge * 0.84)) : badge}
              ring={ring}
              place={red > 0 ? 'bottom' : 'top'}
            />
          )}
        </button>
      )}
    />
  );
}
