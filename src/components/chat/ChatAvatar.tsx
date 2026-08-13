'use client';

import { getCountryByName } from '@/lib/countries';
import { FlagImg } from '@/components/FlagImg';
import { NEU, NEU_GRADIENTS, OUTFIT } from '@/components/neu';
import { CHAT } from './chatTokens';

export type AvatarKind = 'everyone' | 'dais' | 'chair' | 'delegate';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * One avatar rule for the whole chat.
 *
 * - delegate → the country's flag, resolved Delegate.country → getCountryByName(...)?.code →
 *   FlagImg, exactly as the chair page Waiting Room does it.
 * - chair → forest gradient disc with initials (chairs have no flag).
 * - everyone → announce glyph for the public thread.
 */
export function ChatAvatar({
  kind,
  name,
  size = 22,
}: {
  kind: AvatarKind;
  /** Country name for a delegate, chair name for a chair. Unused for 'everyone'. */
  name?: string;
  /** Flag/glyph size. The surrounding disc is sized from it. */
  size?: number;
}) {
  const disc = Math.round(size * 1.55);
  const base: React.CSSProperties = {
    width: disc,
    height: disc,
    borderRadius: 999,
    flexShrink: 0,
  };

  if (kind === 'everyone') {
    return (
      <span
        className="inline-flex items-center justify-center"
        style={{
          ...base,
          background: `linear-gradient(135deg, ${NEU_GRADIENTS.gold[0]}, ${NEU_GRADIENTS.gold[1]})`,
          boxShadow: NEU.outSm,
          fontSize: Math.round(size * 0.72),
          lineHeight: 1,
        }}
        aria-hidden
      >
        📢
      </span>
    );
  }

  if (kind === 'dais') {
    // The delegate-side "Chairs" thread — the dais collectively, not one named chair.
    return (
      <span
        className="inline-flex items-center justify-center"
        style={{
          ...base,
          background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
          boxShadow: NEU.outSm,
          fontSize: Math.round(size * 0.66),
          lineHeight: 1,
        }}
        aria-hidden
      >
        🪑
      </span>
    );
  }

  if (kind === 'chair') {
    return (
      <span
        className="inline-flex items-center justify-center"
        style={{
          ...base,
          background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
          boxShadow: NEU.outSm,
          color: NEU.gold,
          fontFamily: OUTFIT,
          fontWeight: 900,
          fontSize: Math.round(size * 0.55),
          letterSpacing: '0.02em',
        }}
        aria-hidden
      >
        {initials(name ?? '')}
      </span>
    );
  }

  const code = name ? getCountryByName(name)?.code : undefined;
  return (
    <span
      className="inline-flex items-center justify-center overflow-hidden"
      style={{
        ...base,
        backgroundColor: CHAT.bubbleIn,
        boxShadow: NEU.outSm,
      }}
      aria-hidden
    >
      <FlagImg code={code ?? ''} size={size} />
    </span>
  );
}

export function avatarKindFor(key: string, chairNames: string[]): AvatarKind {
  if (key === 'everyone') return 'everyone';
  if (key === 'chairs') return 'dais';
  return chairNames.includes(key) ? 'chair' : 'delegate';
}
