'use client';

/**
 * ProfileAvatar: the signed-in user's circle in the top-right of every
 * non-session top bar (SiteNav, the /manage bar, /join, /create, the public CV).
 *
 * Only the picture (`profiles.avatar_url`), or 1 to 2 initials on a calm
 * forest-tinted ground when there is none or it fails to load. A very faint
 * forest-green gradient ring sits around it. Nothing else: no name, no pill.
 *
 * `ProfileAvatarMenu` is the drop-in for a top bar: the avatar as the trigger of
 * the shared `ProfileDropdown` (hover-open, click-toggle, portaled panel), and
 * nothing at all while signed out, so each bar keeps its own Sign in button.
 *
 * Never mount this on /chair, /delegate, /advisor or /voting.
 */

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import ProfileDropdown from '@/components/ProfileDropdown';

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
  const ring = 1.5;
  const inner = size - ring * 2;

  return (
    <span
      aria-hidden
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, padding: ring, background: RING[tone] }}
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
  const { user, profile } = useAuth();
  if (!user) return null;
  const name = profile?.display_name || null;
  const label = `Account menu${name ? `, ${name}` : ''}`;
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
          className={`flex flex-shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 ${offset} active:scale-[0.96] hover:brightness-[1.04]`}
          style={{ width: size, height: size, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', transitionProperty: 'transform, filter', transitionDuration: '150ms' }}
        >
          <ProfileAvatar url={profile?.avatar_url} name={name} email={profile?.email ?? user.email} size={size} tone={tone} />
        </button>
      )}
    />
  );
}
