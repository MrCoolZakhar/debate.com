'use client';

// Small pieces the People table and the member pop-up share: the role in plain
// words and a word with its tone (payment, position paper).

import { AlertCircle, Check, Minus } from 'lucide-react';
import type { MemberRole } from '../v2';
import { FONT, INK_SOFT, OK_GREEN, OWE, STROKE } from '../leaderKit';

export type PayTone = 'ok' | 'owe' | 'soft';

export const ROLE_WORD: Record<MemberRole, string> = {
  'faculty-advisor': 'Faculty advisor',
  'head-delegate': 'Head delegate',
  delegate: 'Delegate',
};

const TONE_COLOR: Record<PayTone, string> = { ok: OK_GREEN, owe: OWE, soft: INK_SOFT };
const TONE_ICON = { ok: Check, owe: AlertCircle, soft: Minus } as const;

export function ToneWord({ word, tone }: { word: string; tone: PayTone }) {
  const Icon = TONE_ICON[tone];
  return (
    <span className="inline-flex items-center gap-1.5" style={{ fontFamily: FONT, fontSize: 14, color: TONE_COLOR[tone] }}>
      <Icon size={16} strokeWidth={STROKE} aria-hidden style={{ flexShrink: 0 }} />
      {word}
    </span>
  );
}
