'use client';

// ─────────────────────────────────────────────────────────────────────────────
// CaucusProposer: "Raised by [round flag] France" for a running caucus (Oct 2026, owner: "add
// the flag of the country in the caucus of who raised it").
//
// `caucus.proposedBy` is the delegation that raised the motion: '' = nobody (renders nothing),
// '__chair__' = the chair (a gavel disc, the word from motion_card_chair), anything else a seat
// name drawn as a ROUND flag (crest, flag, then initials for a custom seat) with its localized
// name. One compact line; the name is never cut off: it wraps (CLAUDE.md §8). Presentation only.
// ─────────────────────────────────────────────────────────────────────────────

import { Gavel } from 'lucide-react';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { getCountryDisplayName } from '@/lib/countries';

const CHAIR_KEY = '__chair__';

export default function CaucusProposer({
  proposedBy,
  size = 24,
  tone = 'light',
  fontSize = 14,
  className = '',
  hideLabel = false,
}: {
  proposedBy: string | null | undefined;
  /** Flag diameter in px. */
  size?: number;
  /** light = on the ivory floor (ink text); dark = on a forest surface (ivory text). */
  tone?: 'light' | 'dark';
  fontSize?: number;
  className?: string;
  /** Drop the "Raised by" word (when the surrounding line already says it). */
  hideLabel?: boolean;
}) {
  const t = useT();
  const { language } = useLanguage();
  const who = (proposedBy ?? '').trim();
  if (!who) return null;
  const isChair = who === CHAIR_KEY;
  const name = isChair ? t('motion_card_chair') : getCountryDisplayName(who, language);
  const ink = tone === 'dark' ? '#EDE7D8' : '#1C1410';
  const soft = tone === 'dark' ? 'rgba(237,231,216,0.72)' : '#6A5A4A';
  return (
    <span
      className={`inline-flex items-center min-w-0 max-w-full ${className}`}
      style={{ gap: Math.max(6, Math.round(size * 0.3)), fontSize, lineHeight: 1.2 }}
      aria-label={t('caucus_raised_by_aria').replace('{name}', name)}
      role="note"
    >
      {!hideLabel && <span aria-hidden className="shrink-0 font-semibold" style={{ color: soft }}>{t('caucus_raised_by')}</span>}
      {isChair ? (
        <span aria-hidden className="inline-flex items-center justify-center rounded-full shrink-0"
          style={{ width: size, height: size, backgroundColor: '#1B3828', color: '#EED98A' }}>
          <Gavel size={Math.round(size * 0.52)} strokeWidth={2.2} />
        </span>
      ) : (
        <SeatCircleFlag
          country={who}
          size={size}
          decorative
          fallback="initials"
          monogramColors={{ bg: '#1B3828', fg: '#EED98A' }}
          style={{ boxShadow: '0 1px 3px rgba(28,20,16,0.18)' }}
        />
      )}
      <span aria-hidden className="min-w-0 font-extrabold [overflow-wrap:anywhere]" style={{ color: ink }}>{name}</span>
    </span>
  );
}
