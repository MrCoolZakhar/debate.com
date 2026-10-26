'use client';
// Gavelling Crisis: small pieces shared by the backroom queue rows and the directive detail
// (the cabinet logo, a small tag, a backroomer's picture).

import { seatFitFontPx } from '@/lib/seatName';
import type { CSSProperties, ReactNode } from 'react';
import { UserRound } from 'lucide-react';
import type { Cabinet, Member } from '@/lib/crisis/types';
import { Avatar, CK, initialsOf } from '../../crisisKit';

/** A cabinet's logo in a round near-white disc; with no logo, a disc in the cabinet colour with the short name's initials. */
export function CabinetLogo({ cabinet, size = 20, style }: { cabinet?: Pick<Cabinet, 'name' | 'short_name' | 'color' | 'logo_url'> | null; size?: number; style?: CSSProperties }) {
  const color = cabinet?.color ?? CK.red;
  if (cabinet?.logo_url) {
    return (
      <span
        aria-hidden
        style={{
          width: size, height: size, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', overflow: 'hidden',
          background: '#FDFCF9', border: '0.5px solid rgba(221,212,192,0.6)', boxShadow: size < 24 ? '0 1px 3px rgba(27,56,40,0.18)' : '0 3px 9px rgba(27,56,40,0.15)', ...style,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cabinet.logo_url} alt="" draggable={false} style={{ width: '82%', height: '82%', objectFit: 'contain', display: 'block' }} />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center',
        background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 68%, #000))`, color: '#FFF4E6',
        fontWeight: 800, fontSize: Math.max(7, Math.round(size * 0.36)), letterSpacing: '0.02em', fontFamily: CK.font,
        border: '0.5px solid rgba(221,212,192,0.5)', boxShadow: size < 24 ? '0 1px 3px rgba(27,56,40,0.18)' : '0 3px 9px rgba(27,56,40,0.15)', ...style,
      }}
    >
      {initialsOf(cabinet?.short_name || cabinet?.name || '?')}
    </span>
  );
}

/** A staff member's picture; with no picture, initials. Nobody (unclaimed) is a dashed disc with a person icon. */
export function StaffPic({ member, size = 22 }: { member?: Pick<Member, 'display_name' | 'picture_url'> | null; size?: number }) {
  if (!member) {
    return (
      <span aria-hidden style={{ width: size, height: size, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', background: CK.card, color: CK.muted, border: `1px dashed ${CK.muted}` }}>
        <UserRound size={Math.round(size * 0.55)} strokeWidth={1.5} />
      </span>
    );
  }
  return <Avatar name={member.display_name} src={member.picture_url} size={size} color={CK.forest2} />;
}

/** A small tag: an icon and a few words (the details row in the character bar). */
export function Tag({ icon, children, color = CK.inkSoft, title, style }: { icon?: ReactNode; children: ReactNode; color?: string; title?: string; style?: CSSProperties }) {
  return (
    <span
      title={title}
      className="inline-flex items-center"
      style={{
        gap: 5, maxWidth: '100%', fontSize: 12, fontWeight: 700, color, background: CK.card, borderRadius: 9, padding: '3px 9px',
        boxShadow: `inset 0 0 0 1px ${CK.hair}`, overflowWrap: 'break-word', fontFamily: CK.font, ...style,
      }}
    >
      {icon && <span aria-hidden style={{ lineHeight: 0, flex: 'none' }}>{icon}</span>}
      <span style={{ minWidth: 0 }}>{children}</span>
    </span>
  );
}

/** The short form of a name: the surname (last word), "Dobrynin" for "Anatoly Dobrynin". One word stays whole. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : (parts[0] ?? name);
}

/** A name in two rows: the short form big, the full name smaller beneath (wraps, never cut). One word shows once. */
export function NameStack({ name, align = 'center', big = 12, small = 10.5, width = 76 }: { name: string; align?: 'center' | 'left'; big?: number; small?: number; /** The column's width in px: a long surname steps its font down to fit instead of breaking mid-word. */ width?: number }) {
  const short = shortName(name);
  const bigPx = seatFitFontPx(short, width, big, { lines: 1, minPx: Math.max(9, big * 0.7) });
  const same = short === name.trim();
  return (
    <span style={{ display: 'block', textAlign: align, minWidth: 0, fontFamily: CK.font }}>
      <span style={{ display: 'block', fontSize: bigPx, fontWeight: 800, lineHeight: 1.2, color: CK.ink, overflowWrap: 'normal', wordBreak: 'normal' }}>{short}</span>
      {!same && <span style={{ display: 'block', marginTop: 1, fontSize: small, fontWeight: 600, lineHeight: 1.25, color: CK.muted, overflowWrap: 'anywhere' }}>{name}</span>}
    </span>
  );
}

/** "No. 13": the small badge that overlaps a directive card's top edge (the caller positions it). */
export function NumberBadge({ n, color = CK.red, style }: { n: number; color?: string; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 8px', borderRadius: 9, background: color, color: '#FFF4E6',
        fontSize: 11, fontWeight: 800, letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        boxShadow: '0 2px 6px rgba(27,56,40,0.25)', fontFamily: CK.font, ...style,
      }}
    >
      No. {n}
    </span>
  );
}
