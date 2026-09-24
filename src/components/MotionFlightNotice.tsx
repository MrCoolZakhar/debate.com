'use client';

import React, { useEffect } from 'react';
import Portal from '@/components/Portal';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { getCountryDisplayName } from '@/lib/countries';
import { dismissMotionNotice, setMotionFlightClosed, useMotionNotice } from '@/lib/motionFlight';

/**
 * One-line notice for motions that fell when another passed (with Undo), a motion that
 * failed to save, or a delegation that already has a motion on the floor. Mounted by the
 * chair page so it survives MotionsModal closing. See src/lib/motionFlight.ts.
 */
export default function MotionFlightNotice({ committeeId, closed = false }: { committeeId: string; closed?: boolean }) {
  const t = useT();
  const { language } = useLanguage();
  const notice = useMotionNotice(committeeId);
  // V4: a suspended or ended committee never gets motions raised back by Undo.
  useEffect(() => { setMotionFlightClosed(committeeId, closed); }, [committeeId, closed]);
  if (!notice) return null;

  const text = notice.kind === 'fell'
    ? (notice.count === 1 ? t('motions_fell_one') : t('motions_fell_many', { count: notice.count }))
    : notice.kind === 'blocked'
      ? t('motions_proposer_has_motion', { country: getCountryDisplayName(notice.country, language) })
      : t('motions_save_failed');

  return (
    <Portal>
      <div
        role="status"
        aria-live="polite"
        className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[80] flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold max-w-[calc(100%-32px)]"
        style={{
          backgroundColor: notice.kind === 'fell' ? '#1B3828' : '#8B2020',
          color: notice.kind === 'fell' ? '#EED98A' : '#FAF8F3',
          boxShadow: '0 12px 32px rgba(27,56,40,0.28)',
          fontFamily: "var(--font-brand), sans-serif",
        }}
      >
        <span className="min-w-0">{text}</span>
        {notice.kind === 'fell' && notice.restore && !closed && (
          <button
            onClick={notice.restore}
            className="shrink-0 px-3 py-1 rounded-lg font-black text-xs uppercase tracking-wide focus:outline-none"
            style={{ backgroundColor: '#EED98A', color: '#1B3828' }}
          >
            {t('motions_undo')}
          </button>
        )}
        <button
          onClick={() => dismissMotionNotice(committeeId)}
          aria-label="Dismiss"
          className="shrink-0 opacity-70 hover:opacity-100 focus:outline-none"
        >
          ✕
        </button>
      </div>
    </Portal>
  );
}
