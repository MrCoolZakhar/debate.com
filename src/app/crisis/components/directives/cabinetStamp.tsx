// Gavelling Crisis: the look of a CABINET directive, in one place (owner, 1 Nov 2026). A cabinet directive is a card framed in its
// cabinet's own colour with a very faint wash of that colour over the whole card. Everything that matters hangs OVER the card's border,
// half outside, never clipped: the cabinet's SEAL (no border, no disc behind it, a soft drop shadow only) on the top left, the "No. 26"
// badge beside it, the red CABINET stamp (small, tilted, on a white ground) on the top border after the badge, the assigned staff
// person's avatar on the top right (Command only). The SUBMITTER is not drawn on a card at all (owner, 1 Nov 2026: no hanging portrait, no
// name); the icons and the wait sit on the card's bottom row (CabinetFoot).
//
// The card that wears them must not clip (overflow visible) and the thing holding it leaves `sealSize / 2` of room above it and a normal
// `CARD_GAP_BELOW` below it. The stamp never takes a click.

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

/** The sizes of the stamp (about 60% of the first design): `pop` in the big pop-ups, `card` on the big reader card, `row` in lists, `xs` in the tight rows. */
const SIZES = {
  pop: { font: 17, pad: '3px 8px 1px', border: 2, radius: 6, spacing: '0.12em' },
  card: { font: 13, pad: '2px 7px 0', border: 2, radius: 5, spacing: '0.12em' },
  row: { font: 10, pad: '2px 5px 0', border: 1.5, radius: 4, spacing: '0.12em' },
  xs: { font: 9, pad: '2px 4px 0', border: 1.5, radius: 4, spacing: '0.1em' },
} as const;
export type StampSize = keyof typeof SIZES;

/**
 * The red rubber stamp, on a WHITE ground so it reads over any card. It is placed by CabinetCrest, ON the card's top border (half outside,
 * tilted about -8 degrees). Used on its own it is an ordinary inline item.
 */
export function CabinetStamp({ size = 'row', style }: { size?: StampSize; /** Kept for old callers; the stamp now always has its white ground. */ onDark?: boolean; style?: CSSProperties }) {
  const s = SIZES[size];
  return (
    <span
      aria-hidden
      className={crisisDisplay.className}
      style={{
        position: 'relative', flex: 'none', display: 'inline-block', alignSelf: 'center', zIndex: 3, pointerEvents: 'none', userSelect: 'none',
        transform: 'rotate(-8deg)', transformOrigin: 'center', whiteSpace: 'nowrap', lineHeight: 1.1,
        fontSize: s.font, letterSpacing: s.spacing, padding: s.pad, borderRadius: s.radius,
        border: `${s.border}px solid ${STAMP_RED}`, color: STAMP_RED, background: '#FFFFFF',
        boxShadow: '0 2px 6px rgba(27,56,40,0.18)',
        ...style,
      }}
    >
      CABINET
    </span>
  );
}

/** A very faint wash of the cabinet's colour over the whole card (about 5%), still plain enough for dark text. */
export function cabinetWash(color: string, amount = 5): string {
  return `color-mix(in srgb, ${color} ${amount}%, ${CK.card})`;
}

/** The box-shadow ring in the cabinet's colour that frames the card (3px in a pop-up, 2px in a list), then any shadow after it. */
export function cabinetRing(color: string, width = 3, after?: string): string {
  return `0 0 0 ${width}px ${color}${after ? `, ${after}` : ''}`;
}

/** The cabinet's seal: its logo as it is (no border, no disc behind it), else a disc in the cabinet's colour with a landmark. A soft drop shadow only. */
export function CabinetSeal({ cabinet, size = 32, style }: { cabinet?: Pick<Cabinet, 'name' | 'color' | 'logo_url'> | null; size?: number; style?: CSSProperties }) {
  const color = cabinetColorOf(cabinet);
  if (cabinet?.logo_url) {
    return (
      <span aria-hidden style={{ width: size, height: size, flex: 'none', display: 'grid', placeItems: 'center', filter: 'drop-shadow(0 3px 6px rgba(27,56,40,0.3))', ...style }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cabinet.logo_url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      </span>
    );
  }
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 68%, #000))`, color: '#FFF4E6', boxShadow: '0 3px 10px rgba(27,56,40,0.3)', ...style }}>
      <Landmark size={Math.round(size * 0.52)} strokeWidth={1.5} />
    </span>
  );
}

/** The seal's size in a list row (about 1.5x the first design) and in a pop-up. */
export const SEAL_ROW = 48;
export const SEAL_POP = 64;

/** Space the seal takes beside the cabinet's name: the name's left padding when the crest's `left` equals the body's left padding. */
export const crestIndent = (sealSize: number): number => sealSize + 8;

/**
 * The crest on the card's top border: the seal (half outside, bigger, no ring) with the "No. 26" badge right beside it, and the small CABINET
 * stamp (`stamp`, white ground, tilted) after the badge, all ON the border. Absolutely positioned: put it as a child of the
 * (position: relative, overflow: visible) card. `sealTop` / `badgeTop` / `stampTop` override where they sit (a pop-up on a phone has no
 * outside to overlap into; `stampTop` is where the stamp's CENTRE sits, 0 = on the border).
 */
export function CabinetCrest({ cabinet, n, sealSize = SEAL_ROW, left = 14, sealTop, badgeTop = -9, stamp, stampTop = 0 }: {
  cabinet?: Pick<Cabinet, 'name' | 'color' | 'logo_url'> | null; n: number; sealSize?: number; left?: number;
  sealTop?: number | string; badgeTop?: number | string; stamp?: StampSize | false; stampTop?: number | string;
}) {
  const color = cabinetColorOf(cabinet);
  return (
    <>
      <CabinetSeal
        cabinet={cabinet}
        size={sealSize}
        style={{ position: 'absolute', zIndex: 3, top: sealTop ?? -Math.round(sealSize / 2), left, pointerEvents: 'none' }}
      />
      <NumberBadge n={n} color={color} style={{ position: 'absolute', zIndex: 3, top: badgeTop, left: left + sealSize + 6, pointerEvents: 'none' }} />
      {stamp && (
        <CabinetStamp size={stamp} style={{ position: 'absolute', zIndex: 3, top: stampTop, left: left + sealSize + 6 + 74, transform: 'translateY(-50%) rotate(-8deg)' }} />
      )}
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


/** The room under a cabinet card: only normal spacing, so the cards sit close together. */
export const CARD_GAP_BELOW = 4;

/**
 * The bottom of a cabinet card, in the flow: one row with `children` (theme icons, the wait) at the right. The submitter is NOT drawn on a
 * card any more (owner, 1 Nov 2026); the directive's pop-up and reader carry it as a small "From" fact next to "Waiting since".
 */
export function CabinetFoot({ marginTop = 8, children }: { marginTop?: number; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end" style={{ gap: '4px 9px', marginTop }}>
      {children}
    </div>
  );
}
