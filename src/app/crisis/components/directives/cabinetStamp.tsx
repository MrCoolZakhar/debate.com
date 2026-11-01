'use client';
// Gavelling Crisis: the look of a CABINET directive, in one place (owner, 1 Nov 2026: "I like the cabinet stamp, use pretty much
// design B but the cabinet stamp big and going out"). A cabinet directive is a white card framed in its cabinet's own colour,
// the cabinet's seal small at the top left with the cabinet's name in its colour and the number, the TITLE large, and the person
// who sent it only as a small muted line ("From John F. Kennedy · Sent 4 min ago"). On top of it a big red rubber stamp
// "CABINET" in the display face, tilted, overlapping the card's top right edge and poking OUT of the card. Personal and joint
// directives keep their own look, so a cabinet one stands out.
//
// The card that wears the stamp must NOT clip it (overflow visible) and leaves room for it (margin on top and on the right);
// `stampRoom` says how much each size needs. The stamp never takes a click.

import type { CSSProperties, ReactNode } from 'react';
import { Landmark } from 'lucide-react';
import type { Cabinet, Directive } from '@/lib/crisis/types';
import { Avatar, CK } from '../../crisisKit';
import { crisisDisplay } from '../../displayFont';
import { CharacterLink, CharacterName } from '../character/CharacterProfileHost';
import { NumberBadge } from './directiveParts';

export const STAMP_RED = '#A3412F';

/** A cabinet directive (the others are personal and joint ones; old press and communique rows count as theirs). */
export const isCabinetDirective = (d: Pick<Directive, 'kind'>): boolean => d.kind === 'committee';

/** The cabinet's own colour, red when there is no cabinet. */
export const cabinetColorOf = (cabinet?: Pick<Cabinet, 'color'> | null): string => cabinet?.color ?? CK.red;

/**
 * The three sizes of the stamp: `pop` in the big pop-ups (about twice a normal badge), `card` on the big reader cards, `row` in lists.
 * `top` and `right` say how far it hangs past the card's top and right edges (negative = outside the card).
 */
const SIZES = {
  pop: { font: 34, pad: '6px 16px 2px', border: 3, radius: 9, spacing: '0.12em', top: -30, right: -14 },
  card: { font: 26, pad: '5px 13px 2px', border: 3, radius: 8, spacing: '0.12em', top: -14, right: -12 },
  row: { font: 14, pad: '3px 8px 1px', border: 2.5, radius: 6, spacing: '0.12em', top: -9, right: -8 },
} as const;
export type StampSize = keyof typeof SIZES;

/** How much empty space a card needs on its top and right so the stamp it wears is never cut off by what holds it. */
export function stampRoom(size: StampSize): { top: number; right: number } {
  return { top: Math.abs(SIZES[size].top) + 2, right: Math.abs(SIZES[size].right) + 2 };
}

/**
 * The red rubber stamp. Absolutely positioned: put it inside the (position: relative, overflow: visible) card. On a dark pop-up
 * scrim a cream fill keeps the part that hangs outside readable; on a light list it is see-through ink (multiply).
 */
export function CabinetStamp({ size = 'row', onDark = false, style }: { size?: StampSize; /** The part outside the card is over a dark scrim. */ onDark?: boolean; style?: CSSProperties }) {
  const s = SIZES[size];
  return (
    <span
      aria-hidden
      className={crisisDisplay.className}
      style={{
        position: 'absolute', zIndex: 4, top: s.top, right: s.right, pointerEvents: 'none', userSelect: 'none',
        transform: 'rotate(-9deg)', transformOrigin: 'center', whiteSpace: 'nowrap', lineHeight: 1.1,
        fontSize: s.font, letterSpacing: s.spacing, padding: s.pad, borderRadius: s.radius,
        border: `${s.border}px solid ${STAMP_RED}`, color: STAMP_RED,
        background: onDark ? 'rgba(255,244,230,0.96)' : 'transparent',
        opacity: onDark ? 0.97 : 0.9, mixBlendMode: onDark ? 'normal' : 'multiply',
        boxShadow: onDark ? '0 6px 16px rgba(42,10,12,0.35)' : undefined,
        ...style,
      }}
    >
      CABINET
    </span>
  );
}

/** The box-shadow ring in the cabinet's colour that frames the card (3px in a pop-up, 2px in a list), then any shadow after it. */
export function cabinetRing(color: string, width = 3, after?: string): string {
  return `0 0 0 ${width}px ${color}${after ? `, ${after}` : ''}`;
}

/** The cabinet's seal: its logo in a round near-white disc, else a disc in the cabinet's colour with a landmark. */
export function CabinetSeal({ cabinet, size = 32, style }: { cabinet?: Pick<Cabinet, 'name' | 'color' | 'logo_url'> | null; size?: number; style?: CSSProperties }) {
  const color = cabinetColorOf(cabinet);
  if (cabinet?.logo_url) {
    return (
      <span aria-hidden style={{ width: size, height: size, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', overflow: 'hidden', background: '#FDFCF9', border: '0.5px solid rgba(221,212,192,0.7)', boxShadow: '0 2px 7px rgba(27,56,40,0.2)', ...style }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cabinet.logo_url} alt="" draggable={false} style={{ width: '82%', height: '82%', objectFit: 'contain', display: 'block' }} />
      </span>
    );
  }
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 68%, #000))`, color: '#FFF4E6', boxShadow: '0 2px 7px rgba(27,56,40,0.2)', ...style }}>
      <Landmark size={Math.round(size * 0.52)} strokeWidth={1.5} />
    </span>
  );
}

/** The top left of the card: the seal, the cabinet's name in its colour and the "No. 23" badge. `after` goes at the far end. */
export function CabinetHead({ cabinet, n, sealSize = 32, nameSize = 13.5, after }: {
  cabinet?: Pick<Cabinet, 'name' | 'color' | 'logo_url'> | null; n: number; sealSize?: number; nameSize?: number; after?: ReactNode;
}) {
  const color = cabinetColorOf(cabinet);
  return (
    <span className="flex items-center" style={{ gap: 9, minWidth: 0, fontFamily: CK.font }}>
      <CabinetSeal cabinet={cabinet} size={sealSize} />
      <b style={{ fontSize: nameSize, fontWeight: 800, color, lineHeight: 1.2, overflowWrap: 'anywhere', minWidth: 0 }}>{cabinet?.name ?? 'Cabinet'}</b>
      <NumberBadge n={n} color={color} style={{ flex: 'none' }} />
      {after}
    </span>
  );
}

/** Who sent it, small and muted: "From John F. Kennedy · Sent 4 min ago". The portrait is optional and tiny; with `characterId` the
 *  portrait and the name open that character (leave it out inside a button). */
export function SubmitterLine({ name, picture, color, when, size = 22, extra, characterId }: {
  name: string; picture?: string | null; color?: string; when?: string; size?: number; extra?: ReactNode; characterId?: string | null;
}) {
  const portrait = size > 0 ? <Avatar name={name} src={picture} size={size} color={color ?? CK.red} /> : null;
  return (
    <span className="flex items-center flex-wrap" style={{ gap: '3px 7px', fontSize: 12.5, fontWeight: 600, color: CK.muted, fontFamily: CK.font, lineHeight: 1.3 }}>
      {portrait && (characterId ? <CharacterLink id={characterId} style={{ borderRadius: '50%', lineHeight: 0 }}>{portrait}</CharacterLink> : portrait)}
      <span style={{ overflowWrap: 'anywhere', minWidth: 0 }}>
        From {characterId ? <CharacterName id={characterId}>{name}</CharacterName> : name}{when ? ` · ${when}` : ''}
      </span>
      {extra}
    </span>
  );
}
