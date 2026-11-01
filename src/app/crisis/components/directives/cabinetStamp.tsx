// Gavelling Crisis: the look of a CABINET directive, in one place (owner, 1 Nov 2026: "I like the cabinet stamp, use pretty much
// design B but the cabinet stamp big"; 1 Nov 2026 later: "stamps are broken, just put them on the actual card"). A cabinet directive
// is a white card framed in its cabinet's own colour. The cabinet's SEAL overlaps the card's top left border (half outside, with a white
// ring and a soft shadow) and the "No. 26" NUMBER badge sits on the same border right beside it (CabinetCrest). The cabinet's name is a
// small coloured label on one line inside the card above the title (CabinetName), the TITLE is large, and the red rubber stamp
// "CABINET" in the display face sits INSIDE the card, tilted, to the right of the title (CabinetStamp, an ordinary flex item: nothing
// hangs outside, nothing is clipped, it can never sit under a control in the card's corner). The author is a small round portrait with
// the name on the card's bottom line (SubmitterLine). Personal and joint directives keep their own look, so a cabinet one stands out.
//
// Only the seal and the number poke past the card's border: the card that wears them must not clip (overflow visible) and the thing
// holding it leaves `sealSize / 2` of room above it. The stamp never takes a click.

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

/** The sizes of the stamp: `pop` in the big pop-ups, `card` on the big reader card, `row` in lists, `xs` in the tight Command rows. */
const SIZES = {
  pop: { font: 28, pad: '5px 14px 1px', border: 3, radius: 9, spacing: '0.12em' },
  card: { font: 22, pad: '4px 11px 1px', border: 3, radius: 8, spacing: '0.12em' },
  row: { font: 14, pad: '3px 8px 1px', border: 2.5, radius: 6, spacing: '0.12em' },
  xs: { font: 12, pad: '2px 6px 0', border: 2, radius: 5, spacing: '0.1em' },
} as const;
export type StampSize = keyof typeof SIZES;

/**
 * The red rubber stamp. An ordinary flex item that sits INSIDE the card, to the right of the title (put it in a `flex items-center`
 * row with the title). On a light card it is see-through ink (multiply); `onDark` (the red band of a pop-up) gives it a cream fill.
 */
export function CabinetStamp({ size = 'row', onDark = false, style }: { size?: StampSize; /** It sits on a dark or red band. */ onDark?: boolean; style?: CSSProperties }) {
  const s = SIZES[size];
  return (
    <span
      aria-hidden
      className={crisisDisplay.className}
      style={{
        position: 'relative', flex: 'none', display: 'inline-block', alignSelf: 'center', margin: '2px 3px', zIndex: 2, pointerEvents: 'none', userSelect: 'none',
        transform: 'rotate(-9deg)', transformOrigin: 'center', whiteSpace: 'nowrap', lineHeight: 1.1,
        fontSize: s.font, letterSpacing: s.spacing, padding: s.pad, borderRadius: s.radius,
        border: `${s.border}px solid ${STAMP_RED}`, color: STAMP_RED,
        background: onDark ? 'rgba(255,244,230,0.96)' : 'transparent',
        opacity: onDark ? 0.97 : 0.9, mixBlendMode: onDark ? 'normal' : 'multiply',
        boxShadow: onDark ? '0 4px 12px rgba(42,10,12,0.3)' : undefined,
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

/** Space the seal takes beside the cabinet's name: the name's left padding when the crest's `left` equals the body's left padding. */
export const crestIndent = (sealSize: number): number => sealSize + 8;

/**
 * The crest on the card's top border: the seal (half outside, a white ring, a soft shadow) and the "No. 26" badge right beside it, also
 * on the border. Absolutely positioned: put it as a child of the (position: relative, overflow: visible) card. `sealTop` / `badgeTop`
 * override where they sit (a pop-up on a phone has no outside to overlap into).
 */
export function CabinetCrest({ cabinet, n, sealSize = 32, left = 14, sealTop, badgeTop = -9 }: {
  cabinet?: Pick<Cabinet, 'name' | 'color' | 'logo_url'> | null; n: number; sealSize?: number; left?: number;
  sealTop?: number | string; badgeTop?: number | string;
}) {
  const color = cabinetColorOf(cabinet);
  return (
    <>
      <CabinetSeal
        cabinet={cabinet}
        size={sealSize}
        style={{ position: 'absolute', zIndex: 3, top: sealTop ?? -Math.round(sealSize / 2), left, border: '3px solid #FFFFFF', boxShadow: '0 3px 10px rgba(27,56,40,0.28)', pointerEvents: 'none' }}
      />
      <NumberBadge n={n} color={color} style={{ position: 'absolute', zIndex: 3, top: badgeTop, left: left + sealSize + 6, pointerEvents: 'none' }} />
    </>
  );
}

/** The cabinet's name: a small label in its colour on ONE line (it wraps at spaces only, a very long single word breaks as a last resort). */
export function CabinetName({ cabinet, size = 13.5, indent = 0, style }: {
  cabinet?: Pick<Cabinet, 'name' | 'color'> | null; size?: number; /** Left padding that clears the seal beside it. */ indent?: number; style?: CSSProperties;
}) {
  return (
    <b style={{ display: 'block', paddingLeft: indent, fontSize: size, fontWeight: 800, color: cabinetColorOf(cabinet), lineHeight: 1.25, fontFamily: CK.font, overflowWrap: 'break-word', wordBreak: 'normal', ...style }}>
      {cabinet?.name ?? 'Cabinet'}
    </b>
  );
}

/** A plain inline head (seal, name, number) for places that are not the framed card, such as a step inside a pop-up. */
export function CabinetHead({ cabinet, n, sealSize = 32, nameSize = 13.5, after }: {
  cabinet?: Pick<Cabinet, 'name' | 'color' | 'logo_url'> | null; n: number; sealSize?: number; nameSize?: number; after?: ReactNode;
}) {
  const color = cabinetColorOf(cabinet);
  return (
    <span className="flex items-center flex-wrap" style={{ gap: '4px 9px', minWidth: 0, fontFamily: CK.font }}>
      <CabinetSeal cabinet={cabinet} size={sealSize} />
      <b style={{ fontSize: nameSize, fontWeight: 800, color, lineHeight: 1.2, overflowWrap: 'break-word', wordBreak: 'normal' }}>{cabinet?.name ?? 'Cabinet'}</b>
      <NumberBadge n={n} color={color} style={{ flex: 'none' }} />
      {after}
    </span>
  );
}

/** Who sent it: a small round portrait and the name ("Robert McNamara"), with "From" and the time ("From Robert McNamara · Sent 4 min ago")
 *  unless `from` is false. With `characterId` the portrait and the name open that character (leave it out inside a button). */
export function SubmitterLine({ name, picture, color, when, size = 22, extra, characterId, from = true }: {
  name: string; picture?: string | null; color?: string; when?: string; size?: number; extra?: ReactNode; characterId?: string | null; from?: boolean;
}) {
  const portrait = size > 0 ? <Avatar name={name} src={picture} size={size} color={color ?? CK.red} /> : null;
  return (
    <span className="flex items-center flex-wrap" style={{ gap: '3px 7px', fontSize: 12.5, fontWeight: 600, color: CK.muted, fontFamily: CK.font, lineHeight: 1.3 }}>
      {portrait && (characterId ? <CharacterLink id={characterId} style={{ borderRadius: '50%', lineHeight: 0 }}>{portrait}</CharacterLink> : portrait)}
      <span style={{ overflowWrap: 'break-word', minWidth: 0 }}>
        {from ? 'From ' : ''}{characterId ? <CharacterName id={characterId}>{name}</CharacterName> : name}{when ? ` · ${when}` : ''}
      </span>
      {extra}
    </span>
  );
}
