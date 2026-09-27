'use client';

// ── SaveStatusToast ────────────────────────────────────────────────────────
//
// The chair page's ONE "did that save?" notice (audit R-5). Every session write in
// committeeService reports through src/lib/writeStatus.ts; this renders the aggregate, so a
// burst of failures on bad venue Wi-Fi is one toast, not ten.
//
//   retrying  -> "Not saved. Retrying..."             (automatic, backoff, max 3 attempts)
//   failed    -> "Not saved. Check your connection."  + Retry (+ Dismiss)
//   parked    -> "Offline. Your changes will save when you're back."  (offline resilience:
//                idempotent writes wait for the connection instead of failing; no buttons,
//                it clears by itself when they land. Shown from the FIRST network-class
//                failure, not after a "Retrying..." flash. It never hides a real failure:
//                with both, the failure card shows and the offline line sits under it.)
//
// Drawn in the notification glass (./glass), same as GlassToast. Bottom-centre so it never
// fights the gavel toast and the notification stack under the header.

import { useEffect, useState } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { GLASS, glassFallbackCss, SPRING_BEZIER, SPRING_LINEAR } from './glass';
import {
  subscribeWriteStatus,
  retryFailedWrites,
  dismissFailedWrites,
  type WriteStatusState,
} from '@/lib/writeStatus';

const OUTFIT = "var(--font-brand), sans-serif";

export default function SaveStatusToast() {
  const t = useT();
  const [state, setState] = useState<WriteStatusState>({ retrying: false, failed: [], parked: false });
  useEffect(() => subscribeWriteStatus(setState), []);

  const failed = state.failed.length > 0;
  const parked = state.parked;
  if (!failed && !state.retrying && !parked) return null;
  // A real failure ALWAYS shows (D2): parked writes never hide it; the offline line then sits
  // under it. A retry in flight wins over an older failure: the room is mid-recovery.
  // Without a failure, parked writes read calmly as "Offline" (no Retrying flash, D7).
  const showFailed = failed && !state.retrying;
  const offlineOnly = parked && !showFailed;
  const canRetry = state.failed.some((f) => f.retryable);

  return (
    <div
      role={showFailed ? 'alert' : 'status'}
      aria-live={showFailed ? 'assertive' : 'polite'}
      className="dss-toast"
      style={{
        position: 'fixed', zIndex: 60, left: '50%', bottom: '1.25rem',
        transform: 'translateX(-50%)', maxWidth: 'calc(100vw - 2rem)',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 8px 8px 8px',
        borderRadius: GLASS.radius,
        background: GLASS.fill,
        backdropFilter: GLASS.blur,
        WebkitBackdropFilter: GLASS.blur,
        border: GLASS.border,
        boxShadow: GLASS.shadow,
        color: GLASS.ink,
        fontFamily: OUTFIT,
      }}
    >
      <style>{`
        @keyframes dss-in {
          from { opacity: 0; transform: translate3d(-50%, 14px, 0) scale(0.95) }
          to   { opacity: 1; transform: translate3d(-50%, 0, 0) }
        }
        @keyframes dss-spin { to { transform: rotate(360deg) } }
        .dss-toast {
          animation: dss-in 520ms ${SPRING_BEZIER} both;
          animation-timing-function: ${SPRING_LINEAR};
          -webkit-font-smoothing: antialiased;
        }
        .dss-spin { animation: dss-spin 1s linear infinite }
        ${glassFallbackCss('.dss-toast')}
        @media (prefers-reduced-motion: reduce) {
          .dss-toast { animation: none }
          .dss-spin { animation: none }
        }
      `}</style>
      <span
        aria-hidden="true"
        style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          display: 'grid', placeItems: 'center',
          background: offlineOnly
            ? 'linear-gradient(160deg, #3D7A52 0%, #1B3828 100%)'
            : showFailed
              ? 'linear-gradient(160deg, #B23A3A 0%, #8B2020 100%)'
              : 'linear-gradient(160deg, #C99A62 0%, #8A5A2E 100%)',
          color: '#FAF8F3',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.26), 0 1px 3px rgba(27,56,40,0.22)',
        }}
      >
        {offlineOnly || showFailed
          ? <CloudOff size={15} strokeWidth={2.3} />
          : <RefreshCw size={15} strokeWidth={2.3} className="dss-spin" />}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingRight: showFailed ? 2 : 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap' }}>
          {showFailed ? t('session_save_failed') : offlineOnly ? t('session_save_offline') : t('session_save_retrying')}
        </span>
        {showFailed && parked && (
          <span style={{ fontSize: 11.5, fontWeight: 500, lineHeight: 1.3, whiteSpace: 'nowrap', color: GLASS.inkSoft }}>
            {t('session_save_offline')}
          </span>
        )}
      </span>
      {showFailed && canRetry && (
        <button
          type="button"
          onClick={retryFailedWrites}
          className="focus:outline-none"
          style={{
            fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.02em',
            padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: '#1B3828', color: '#EED98A',
          }}
        >
          {t('session_save_retry')}
        </button>
      )}
      {showFailed && (
        <button
          type="button"
          onClick={dismissFailedWrites}
          className="focus:outline-none"
          style={{
            fontFamily: OUTFIT, fontSize: 12, fontWeight: 700,
            padding: '6px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'transparent', color: GLASS.inkSoft,
          }}
        >
          {t('session_save_dismiss')}
        </button>
      )}
    </div>
  );
}
