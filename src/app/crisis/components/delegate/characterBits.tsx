'use client';
// Gavelling Crisis: the round character picture (picture, else initials on the red gradient).

import { CK } from '../../crisisKit';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function CharacterPicture({ name, url, size, ring }: { name: string; url: string | null; size: number; ring?: string }) {
  return (
    <span
      className="flex-shrink-0 grid place-items-center"
      style={{
        width: size, height: size, borderRadius: '50%', background: CK.redGrad, color: '#FFF4E6', fontWeight: 800, fontSize: Math.round(size * 0.34),
        overflow: 'hidden', boxShadow: `0 0 0 ${size > 120 ? 4 : 2}px ${ring ?? CK.gold}`,
      }}
    >
      {url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: 'cover' }} />
        : initials(name)}
    </span>
  );
}
