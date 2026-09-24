'use client';

// ── ClockSkewHint ──────────────────────────────────────────────────────────
//
// Tells the dais when THIS device's clock disagrees with the database by more than 5 s
// (audit T-1). Nothing is broken when it shows: every session clock is already corrected
// through src/lib/serverClock.ts. It exists so a chair who notices their laptop's
// wall clock is wrong knows the timers are not.

import { useEffect, useState } from 'react';
import { Clock, X } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { GLASS, glassFallbackCss } from './notifications/glass';
import { serverClockMeasured, subscribeServerClock } from '@/lib/serverClock';

const THRESHOLD_MS = 5000;
const OUTFIT = "var(--font-brand), sans-serif";

export default function ClockSkewHint() {
  const t = useT();
  const [offset, setOffset] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => subscribeServerClock((ms) => { if (serverClockMeasured()) setOffset(ms); }), []);

  if (dismissed || Math.abs(offset) <= THRESHOLD_MS) return null;
  const seconds = Math.round(Math.abs(offset) / 1000);

  return (
    <div
      role="status"
      className="dcs-hint"
      style={{
        position: 'fixed', zIndex: 55, left: '0.85rem', bottom: '1.25rem', maxWidth: '20rem',
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 10px',
        borderRadius: 14, background: GLASS.fill, backdropFilter: GLASS.blur,
        WebkitBackdropFilter: GLASS.blur, border: GLASS.border, boxShadow: GLASS.shadow,
        color: GLASS.inkSoft, fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, lineHeight: 1.3,
      }}
    >
      <style>{glassFallbackCss('.dcs-hint')}</style>
      <Clock size={14} strokeWidth={2.3} aria-hidden="true" style={{ flexShrink: 0, color: GLASS.goldInk }} />
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{t('session_clock_skew', { n: seconds })}</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t('session_save_dismiss')}
        className="focus:outline-none"
        style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 7, border: 'none', background: 'transparent', color: GLASS.inkFaint, cursor: 'pointer', flexShrink: 0 }}
      >
        <X size={13} strokeWidth={2.4} />
      </button>
    </div>
  );
}
