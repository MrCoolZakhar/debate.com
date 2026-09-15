'use client';

import { Megaphone, Gavel, Users } from 'lucide-react';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { NEU, OUTFIT } from '@/components/neu';
import type { ChatEntryKind } from '@/lib/chatConversations';

export type AvatarKind = ChatEntryKind;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * One avatar rule for the whole chat. `size` is the DIAMETER of the disc.
 *
 * - delegate → the seat's round flag (crest → flag → monogram) through SeatCircleFlag
 * - chair    → forest disc with gold initials (chairs have no flag)
 * - everyone → gold disc, megaphone
 * - dais     → forest disc, gavel (the delegate-side "Chairs" thread, the dais as a whole)
 * - group    → sage disc, people glyph
 *
 * Flat discs with a hairline, no neumorphic shadow: a list of forty of these re-rasterises
 * every time the dialog animates, and a soft shadow on each one is what made it expensive.
 */
export function ChatAvatar({
  kind,
  name,
  size = 40,
}: {
  kind: AvatarKind;
  /** Country name for a delegate, chair name for a chair. Unused for the rest. */
  name?: string;
  size?: number;
}) {
  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 999,
    flexShrink: 0,
    boxShadow: 'inset 0 0 0 1px rgba(28,20,16,0.08)',
  };
  const icon = Math.round(size * 0.46);

  if (kind === 'delegate') {
    return <SeatCircleFlag country={name ?? ''} size={size} decorative />;
  }

  if (kind === 'chair') {
    return (
      <span
        aria-hidden
        className="inline-flex items-center justify-center"
        style={{
          ...base,
          background: `linear-gradient(135deg, ${NEU.forest}, ${NEU.green})`,
          color: NEU.gold,
          fontFamily: OUTFIT,
          fontWeight: 800,
          fontSize: Math.max(10, Math.round(size * 0.36)),
          letterSpacing: '0.02em',
        }}
      >
        {initials(name ?? '')}
      </span>
    );
  }

  const tone = kind === 'everyone'
    ? { bg: `linear-gradient(135deg, ${NEU.gold}, ${NEU.deepGold})`, fg: NEU.forest, Icon: Megaphone }
    : kind === 'dais'
      ? { bg: `linear-gradient(135deg, ${NEU.forest}, ${NEU.green})`, fg: NEU.gold, Icon: Gavel }
      : { bg: 'linear-gradient(135deg, #CFDCCB, #A9C2A6)', fg: NEU.forest, Icon: Users };

  return (
    <span aria-hidden className="inline-flex items-center justify-center" style={{ ...base, background: tone.bg, color: tone.fg }}>
      <tone.Icon size={icon} strokeWidth={2.2} />
    </span>
  );
}
