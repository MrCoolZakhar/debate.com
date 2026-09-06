import type { CSSProperties } from 'react';
import { getFlagUrl } from '@/lib/countries';
import { Emoji } from '@/components/Emoji';

interface FlagImgProps {
  code: string;
  size?: number;
  className?: string;
  /** A seat's own crest or its group's crest (see `src/lib/slotGroups.ts`).
   *  When set it replaces the national flag: drawn as a square, never
   *  stretched to flag aspect, on a faint ivory disc so a transparent PNG
   *  still reads as one mark. Same box size the flag would have used. */
  logoUrl?: string | null;
  /** Accessible name for the logo (the seat or group name). */
  label?: string;
  /** Applied to the OUTER box in both branches — the <img> for a flag, the
   *  disc for a crest — and merged AFTER the defaults, so a call site keeps
   *  its own width/height/radius/ring while only the image source changes.
   *  A crest's inner <img> always stays `object-fit: contain`: cropping a
   *  crest to a flag's 3:2 box would cut the emblem. */
  style?: CSSProperties;
}

export function FlagImg({ code, size = 24, className = '', logoUrl, label, style }: FlagImgProps) {
  if (logoUrl) {
    return (
      <span
        className={`inline-flex items-center justify-center flex-shrink-0 ${className}`}
        style={{ width: size, height: size, borderRadius: 5, backgroundColor: 'rgba(250,248,243,0.85)', overflow: 'hidden', ...style }}
        title={label}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={label ?? code}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </span>
    );
  }
  if (!code) return <Emoji size={`${size}px`}>🌐</Emoji>;
  return (
    <img
      src={getFlagUrl(code)}
      alt={code}
      style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block', ...style }}
      className={className}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  );
}
