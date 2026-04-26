'use client';

import React from 'react';
import { getTwemojiUrl } from '@/lib/countries';

/**
 * Maps emoji characters (including variation-selector forms) to their Twemoji SVG
 * codepoint path. Only UI-significant emoji are listed here — plain Unicode control
 * symbols (✕ ✓ ✗ ▲ ▼ ▶ ⏸ etc.) are intentionally omitted.
 */
const CODEPOINTS: Record<string, string> = {
  '🌐': '1f310',
  '🌍': '1f30d',
  '🌏': '1f30f',
  '🌎': '1f30e',
  '🗣':  '1f5e3',
  '🗣️': '1f5e3-fe0f',
  '⚡': '26a1',
  '🎙':  '1f399',
  '🎙️': '1f399-fe0f',
  '🎤': '1f3a4',
  '🔄': '1f504',
  '🏁': '1f3c1',
  '📢': '1f4e2',
  '💬': '1f4ac',
  '✏':  '270f',
  '✏️': '270f-fe0f',
  '💡': '1f4a1',
  '📋': '1f4cb',
  '📎': '1f4ce',
  '📖': '1f4d6',
  '❓': '2753',
  '🗑':  '1f5d1',
  '🗑️': '1f5d1-fe0f',
  '🗳':  '1f5f3',
  '🗳️': '1f5f3-fe0f',
  '📄': '1f4c4',
  '📜': '1f4dc',
  '🛡':  '1f6e1',
  '🛡️': '1f6e1-fe0f',
  '👁':  '1f441',
  '👁️': '1f441-fe0f',
  '🔍': '1f50d',
  '🚧': '1f6a7',
  '🚪': '1f6aa',
  '⏳': '23f3',
  '⏱':  '23f1',
  '⏱️': '23f1-fe0f',
  '🪑': '1fa91',
  '🤝': '1f91d',
  '🏅': '1f3c5',
};

function getEmojiUrl(emoji: string): string | null {
  const cp = CODEPOINTS[emoji];
  return cp ? getTwemojiUrl(cp) : null;
}

/**
 * Renders an emoji using Twemoji SVGs for cross-platform consistency.
 * Falls back to a plain <span> if the emoji isn't in the codepoint table.
 *
 * @param children  The emoji character (e.g. '🌐')
 * @param size      CSS size string or number (default '1em')
 * @param className Additional classes on the img/span
 * @param style     Additional inline styles merged onto the img
 */
export function Emoji({
  children,
  size = '1em',
  className = '',
  style,
}: {
  children: string;
  size?: string | number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const url = getEmojiUrl(children);
  if (!url) return <span className={className} style={style}>{children}</span>;
  return (
    <img
      src={url}
      alt={children}
      aria-hidden="true"
      className={`inline-block object-contain shrink-0 ${className}`}
      style={{ width: size, height: size, verticalAlign: '-0.125em', ...style }}
    />
  );
}

/**
 * Well-known institution logo URLs sourced from Wikimedia Commons.
 * Keyed by the committee acronym used in COMMITTEE_PRESETS / BUNDLES.
 */
const INSTITUTION_LOGOS: Record<string, string> = {
  UNSC:      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Flag_of_the_United_Nations.svg/120px-Flag_of_the_United_Nations.svg.png',
  UNGA:      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Flag_of_the_United_Nations.svg/120px-Flag_of_the_United_Nations.svg.png',
  'GA/UNGA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Flag_of_the_United_Nations.svg/120px-Flag_of_the_United_Nations.svg.png',
  UNHRC:     'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Flag_of_the_United_Nations.svg/120px-Flag_of_the_United_Nations.svg.png',
  UNEP:      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Flag_of_the_United_Nations.svg/120px-Flag_of_the_United_Nations.svg.png',
  ECOSOC:    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Flag_of_the_United_Nations.svg/120px-Flag_of_the_United_Nations.svg.png',
  WHO:       'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/World_Health_Organization_Logo.svg/120px-World_Health_Organization_Logo.svg.png',
  IMF:       'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/IMF_logo.svg/120px-IMF_logo.svg.png',
  NATO:      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Flag_of_NATO.svg/120px-Flag_of_NATO.svg.png',
  EU:        'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Flag_of_Europe.svg/120px-Flag_of_Europe.svg.png',
  AU:        'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Flag_of_the_African_Union.svg/120px-Flag_of_the_African_Union.svg.png',
  G20:       'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/G-20.svg/120px-G-20.svg.png',
  LAS:       'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Flag_of_the_Arab_League.svg/120px-Flag_of_the_Arab_League.svg.png',
  ASEAN:     'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Flag_of_ASEAN.svg/120px-Flag_of_ASEAN.svg.png',
};

/**
 * Renders an institution's logo fetched from Wikimedia CDN.
 * Silently hides itself via onError if the image fails to load.
 *
 * @param acronym  The committee acronym key (e.g. 'UNSC', 'WHO')
 * @param size     Pixel size for width and height (default 32)
 * @param className Additional classes
 */
export function InstitutionLogo({
  acronym,
  size = 32,
  className = '',
}: {
  acronym: string;
  size?: number;
  className?: string;
}) {
  const url = INSTITUTION_LOGOS[acronym];
  if (!url) return null;
  return (
    <img
      src={url}
      alt={acronym}
      width={size}
      height={size}
      className={`inline-block object-contain ${className}`}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}
