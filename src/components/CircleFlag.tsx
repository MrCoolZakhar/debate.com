'use client';

// ============================================================
// src/components/CircleFlag.tsx
//
// THE ONE ROUND FLAG. Every flag drawn inside a circle goes through here.
//
// WHY IT EXISTS. Our rectangular flags are Twemoji: a 3:2 flag floating in a
// transparent 36x36 box. Put that in a circle and no object-fit can save it,
// `contain` shows ivory bands above and below, `cover` shows the same bands
// because they are part of the image. MUNCommand's round flags look full
// because the artwork itself is drawn for a circle. So is ours now:
// `public/flags/1x1/xx.svg` (circle-flags, MIT, see the README there), square
// files whose emblems are re-centred for a disc, drawn `cover`.
//
// Rectangles (tables, chips, inputs, the speaker card) keep `getFlagUrl`.
//
// WHAT IT DRAWS, IN ORDER (the `effectiveSlotArt` precedence):
//   1. a crest (`logoUrl`, or `art.kind === 'logo'`), cover-fit and centred
//      on an ivory ground so a transparent PNG still reads as one mark
//   2. the country's circle flag (`code`, or `country` resolved by name)
//   3. a monogram of the label (observers, cabinet posts, press, anything
//      that is not a country), or your own `fallback`
// A crest or flag that fails to load drops to the next step, never to a
// broken image.
//
// THREE WAYS TO CALL IT
//   <CircleFlag code="JP" size={28} />                   ISO alpha-2
//   <CircleFlag country="Türkiye" size={28} />           name, alias-aware
//   <CircleFlag art={effectiveSlotArt(slot, groups)} label={slot.country_name} />
//   <SeatCircleFlag country={s.country} size={36} />     live session: the
//      crest is found through <SeatArtProvider>, exactly like <SeatFlag>
//
// GEOMETRY. The outer box is a fixed `size` x `size` span, so nothing shifts
// while the image loads. `style` and `className` land on that box (use them
// for a lift shadow, an outer ring, opacity, absolute positioning). The inner
// hairline ring is drawn ABOVE the image, so Japan and Poland keep an edge on
// an ivory page; pass `ring={false}` on a dark ground or inside your own ring.
// ============================================================

import { useState, type CSSProperties, type ReactNode } from 'react';
import { getCircleFlagUrl, getCountryByName } from '@/lib/countries';
import type { SlotArt } from '@/lib/slotGroups';
import { useSeatArt } from '@/components/SeatFlag';
import type { SessionSeat } from '@/lib/sessionFlags';

const OUTFIT = "'Outfit', sans-serif";
const RING_DEFAULT = 'rgba(28,20,16,0.14)';

export interface CircleFlagProps {
  /** ISO 3166-1 alpha-2. Wins over `country`. */
  code?: string | null;
  /** A country NAME ("Türkiye", "UK", "DR Congo"), resolved via `getCountryByName`. */
  country?: string | null;
  /** A seat's or group's crest. Wins over the flag. */
  logoUrl?: string | null;
  /** Pre-resolved art (`effectiveSlotArt`, `useSeatArt`). Wins over everything above. */
  art?: SlotArt | null;
  /** Diameter in px. Designed for 16 to 96; anything from 12 up renders. Default 24. */
  size?: number;
  /** Accessible name. Defaults to the crest label, the country name, or the code. */
  label?: string | null;
  /** Hover tooltip. Off by default. */
  title?: string;
  /** Purely decorative (a name sits right beside it): empty alt, aria-hidden. */
  decorative?: boolean;
  /** Inner hairline. `true` (default) = subtle ink ring, a string = that colour, `false` = none. */
  ring?: boolean | string;
  /** How a crest sits in the circle. Default `cover` (fills it). `contain` keeps a wide logo whole. */
  logoFit?: 'cover' | 'contain';
  /** Replaces the monogram when there is no crest and no flag. Rendered centred inside the disc. */
  fallback?: ReactNode;
  /** `lazy` by default. Use `eager` for an above-the-fold hero. */
  loading?: 'lazy' | 'eager';
  className?: string;
  style?: CSSProperties;
}

/** Two letters for a label: "European Commission" → "EC", "Observer" → "OB". */
export function flagMonogram(label: string, max = 2): string {
  const words = label.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const out = words.length === 1 ? words[0].slice(0, max) : words.slice(0, max).map((w) => w[0]).join('');
  return out.toUpperCase();
}

export function CircleFlag({
  code,
  country,
  logoUrl,
  art,
  size = 24,
  label,
  title,
  decorative = false,
  ring = true,
  logoFit = 'cover',
  fallback,
  loading = 'lazy',
  className = '',
  style,
}: CircleFlagProps) {
  const px = Math.max(12, Math.round(size));

  // ── Resolve what to draw ────────────────────────────────────────────────
  const resolvedCountry = country ? getCountryByName(country) : undefined;
  let crest: string | null = null;
  let iso: string | null = null;
  let name = label ?? '';
  if (art) {
    if (art.kind === 'logo') { crest = art.url; name = name || art.label; }
    else if (art.kind === 'flag') iso = art.code;
  } else {
    crest = logoUrl || null;
    iso = (code && code.trim()) || resolvedCountry?.code || null;
  }
  if (!name) name = resolvedCountry?.name || country || code || iso || '';

  const flagSrc = getCircleFlagUrl(iso);
  // Failures are remembered per URL, so a new seat on the same component
  // instance gets a fresh attempt.
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const markFailed = (src: string) => setFailed((prev) => {
    if (prev.has(src)) return prev;
    const next = new Set(prev); next.add(src); return next;
  });

  const src = crest && !failed.has(crest) ? crest : flagSrc && !failed.has(flagSrc) ? flagSrc : null;
  const isCrest = !!src && src === crest;

  const ringColor = ring === false ? null : typeof ring === 'string' ? ring : RING_DEFAULT;
  const ringWidth = px >= 56 ? 1.5 : 1;

  return (
    <span
      className={`inline-block flex-shrink-0 ${className}`}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name || undefined}
      aria-hidden={decorative ? true : undefined}
      title={title}
      style={{
        position: 'relative',
        width: px,
        height: px,
        minWidth: px,
        borderRadius: '50%',
        overflow: 'hidden',
        verticalAlign: 'middle',
        lineHeight: 0,
        backgroundColor: isCrest ? '#FAF8F3' : src ? 'transparent' : '#E6DFCE',
        ...style,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          width={px}
          height={px}
          loading={loading}
          decoding="async"
          draggable={false}
          onError={() => markFailed(src)}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: isCrest ? logoFit : 'cover', objectPosition: 'center',
            display: 'block',
          }}
        />
      ) : (
        <span
          aria-hidden
          style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: OUTFIT, fontWeight: 800, color: '#1B3828',
            fontSize: Math.max(7, Math.round(px * (px < 20 ? 0.5 : 0.36))), letterSpacing: '0.02em',
            lineHeight: 1,
          }}
        >
          {fallback ?? flagMonogram(name, px < 20 ? 1 : 2)}
        </span>
      )}
      {ringColor && (
        <span
          aria-hidden
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none',
            boxShadow: `inset 0 0 0 ${ringWidth}px ${ringColor}`,
          }}
        />
      )}
    </span>
  );
}

/**
 * The live-session twin of `<SeatFlag>`, round. Resolves the seat's crest from
 * the nearest `<SeatArtProvider>` (or the Delegate you pass), then its flag,
 * then a monogram of the seat name. Same precedence as `sessionSeatArt`.
 */
export function SeatCircleFlag({
  seat,
  country,
  logoUrl,
  ...rest
}: Omit<CircleFlagProps, 'art' | 'code' | 'country' | 'logoUrl'> & {
  /** The delegate, when the call site has one. Wins over `country`/`logoUrl`. */
  seat?: SessionSeat | null;
  /** The seat's country name, when that is all the call site has. */
  country?: string | null;
  /** An explicit crest. Overrides the roster index. */
  logoUrl?: string | null;
}) {
  const name = seat?.country ?? country ?? '';
  const art = useSeatArt(name, seat ? seat.logoUrl : logoUrl);
  return <CircleFlag {...rest} art={art} label={rest.label ?? name} />;
}
