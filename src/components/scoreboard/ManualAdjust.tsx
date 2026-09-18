'use client';

// ─────────────────────────────────────────────────────────────────────────────
// src/components/scoreboard/ManualAdjust.tsx
//
// THE MODERATOR'S PLUS / MINUS. One line at the foot of a delegation's profile:
// a minus button, the pending change, a plus button, an optional reason, Apply.
//
// It replaced a boxed form (Award / Deduct toggle, an amount field, a required
// reason field and an Apply button on three lines), which the owner called
// messy. The write is unchanged: ONE `logEvent` of type `manual-award` or
// `manual-deduct` with the absolute value and the reason as its note, exactly
// what the old form wrote, so every reader of the ledger is unaffected. The
// only relaxation is that the reason is optional now; without one the ledger
// row keeps the scoring layer's own label for a bare award or deduction.
//
// Mounted only for the Moderator (`ScoreboardPanel` passes it as the profile's
// `extra` when `!isViewOnly`). A UI gate, not a permission (AGENTS.md rule 15).
// Keyed by the row in the caller, so a half-set change never follows the chair
// to another delegation.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import { SOFT, RED, CARD_BORDER_COLOR } from '@/components/scoreboardTokens';
import { useT } from '@/contexts/LanguageContext';

const STEP_LIMIT = 99;

export default function ManualAdjust({ onApply }: {
  /** Receives the signed change (never 0) and the trimmed reason (may be ''). */
  onApply: (delta: number, reason: string) => void;
}) {
  const t = useT();
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');

  const bump = (by: number) => setDelta((d) => Math.max(-STEP_LIMIT, Math.min(STEP_LIMIT, d + by)));
  const apply = () => {
    if (delta === 0) return;
    onApply(delta, reason.trim());
    setDelta(0);
    setReason('');
  };

  const stepBtn = (by: number, label: string, Icon: typeof Plus) => (
    <button
      type="button"
      onClick={() => bump(by)}
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.96]"
      style={{
        width: 32, height: 32, flexShrink: 0, border: 'none', cursor: 'pointer',
        backgroundColor: by > 0 ? NEU.forest : 'rgba(139,32,32,0.09)',
        color: by > 0 ? NEU.gold : RED,
        transitionProperty: 'transform', transitionDuration: '120ms', transitionTimingFunction: EASE,
      }}
    >
      <Icon size={15} strokeWidth={2.6} aria-hidden />
    </button>
  );

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        marginBlockStart: 14, paddingBlockStart: 12, borderBlockStart: `1px solid ${CARD_BORDER_COLOR}`,
      }}
    >
      <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.forest, marginInlineEnd: 2 }}>
        {t('sb_adjust_label')}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {stepBtn(-1, t('sb_adjust_less'), Minus)}
        <span
          aria-live="polite"
          style={{
            minWidth: 38, textAlign: 'center', fontFamily: OUTFIT, fontWeight: 800, fontSize: 15,
            fontVariantNumeric: 'tabular-nums',
            color: delta > 0 ? NEU.forest : delta < 0 ? RED : SOFT,
          }}
        >
          {delta > 0 ? `+${delta}` : delta}
        </span>
        {stepBtn(1, t('sb_adjust_more'), Plus)}
      </span>
      {delta !== 0 && (
        <>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') apply(); }}
            placeholder={t('sb_adjust_reason')}
            aria-label={t('sb_adjust_reason')}
            maxLength={120}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{
              flex: '1 1 160px', minWidth: 0, height: 32, fontFamily: OUTFIT, fontSize: 12.5,
              color: NEU.ink, backgroundColor: NEU.surface, borderRadius: 999,
              border: `1px solid ${CARD_BORDER_COLOR}`, paddingInline: 12,
            }}
          />
          <button
            type="button"
            onClick={apply}
            className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.96] gv-lift"
            style={{
              height: 32, paddingInline: 14, border: 'none', cursor: 'pointer',
              fontFamily: OUTFIT, fontSize: 12, fontWeight: 800,
              backgroundColor: NEU.gold, color: NEU.forest,
              transitionProperty: 'transform', transitionDuration: '120ms', transitionTimingFunction: EASE,
            }}
          >
            {t('sb_apply')}
          </button>
        </>
      )}
    </div>
  );
}
