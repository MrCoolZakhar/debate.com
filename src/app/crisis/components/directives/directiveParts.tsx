'use client';
// Gavelling Crisis: small pieces shared by the backroom queue rows and the directive detail
// (the cabinet logo, a small tag, a backroomer's picture).

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
