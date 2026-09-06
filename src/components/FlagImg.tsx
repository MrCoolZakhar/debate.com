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
}

export function FlagImg({ code, size = 24, className = '', logoUrl, label }: FlagImgProps) {
  if (logoUrl) {
    return (
      <span
        className={`inline-flex items-center justify-center flex-shrink-0 ${className}`}
        style={{ width: size, height: size, borderRadius: 5, backgroundColor: 'rgba(250,248,243,0.85)', overflow: 'hidden' }}
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
      style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block' }}
      className={className}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  );
}
