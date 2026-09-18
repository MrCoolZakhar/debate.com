'use client';

// Live / Reconnecting / Offline, drawn in notification glass (src/components/notifications/glass.ts).
//
// Fed by startSessionSync's onConnection (src/lib/sessionSync.ts). Deliberately quiet:
//  * live collapses to a small green dot (the label appears on hover or focus);
//  * reconnecting only shows once it has lasted RECONNECTING_GRACE_MS, so the normal
//    initial subscribe and a one-second socket blip never flash anything;
//  * offline shows at once.
// It never blocks a click: the pill is the only interactive part and it does nothing.

import { useEffect, useState } from 'react';
import { useT } from '@/contexts/LanguageContext';
import type { ConnectionState } from '@/lib/sessionSync';
import { GLASS, glassSurface, glassFallbackCss } from '@/components/notifications/glass';

const RECONNECTING_GRACE_MS = 1500;

const DOT: Record<ConnectionState, string> = {
  live: '#3D7A52',
  reconnecting: '#B6871F',
  offline: '#8B2020',
};

export default function ConnectionPill({
  state,
  placement = 'bottom-start',
}: {
  state: ConnectionState;
  placement?: 'bottom-start' | 'bottom-end' | 'top-end';
}) {
  const t = useT();
  // `reconnecting` is held back for a grace period; the grace restarts on every change.
  const [prevState, setPrevState] = useState(state);
  const [graceDone, setGraceDone] = useState(false);
  const [hover, setHover] = useState(false);
  if (state !== prevState) { setPrevState(state); setGraceDone(false); }

  useEffect(() => {
    if (state !== 'reconnecting') return;
    const id = setTimeout(() => setGraceDone(true), RECONNECTING_GRACE_MS);
    return () => clearTimeout(id);
  }, [state]);

  const shown: ConnectionState = state === 'reconnecting' && !graceDone ? 'live' : state;

  const expanded = shown !== 'live' || hover;
  const label = shown === 'live' ? t('conn_live') : shown === 'offline' ? t('conn_offline') : t('conn_reconnecting');
  const hint = shown === 'offline' ? t('conn_offline_hint') : shown === 'reconnecting' ? t('conn_reconnecting_hint') : t('conn_live');

  const bottom = 'calc(12px + env(safe-area-inset-bottom, 0px))';
  const pos: React.CSSProperties = placement === 'top-end'
    ? { top: 12, insetInlineEnd: 12 }
    : placement === 'bottom-end'
      ? { bottom, insetInlineEnd: 12 }
      : { bottom, insetInlineStart: 12 };

  return (
    <>
      <style>{`${glassFallbackCss('.gv-conn-pill')}
@keyframes gv-conn-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
@media (prefers-reduced-motion: reduce) { .gv-conn-dot { animation: none !important } }`}</style>
      <div
        role="status"
        aria-live="polite"
        tabIndex={0}
        title={hint}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        className="gv-conn-pill fixed flex items-center gap-1.5 focus:outline-none select-none"
        style={{
          ...glassSurface,
          ...pos,
          zIndex: 60,
          borderRadius: 999,
          padding: expanded ? '4px 10px 4px 8px' : 5,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.02em',
          color: GLASS.inkSoft,
          opacity: shown === 'live' && !hover ? 0.75 : 1,
          transition: 'opacity 200ms ease, padding 200ms ease',
        }}
      >
        <span
          className="gv-conn-dot"
          aria-hidden
          style={{
            width: 8, height: 8, borderRadius: 999, flexShrink: 0,
            backgroundColor: DOT[shown],
            animation: shown === 'reconnecting' ? 'gv-conn-pulse 1.2s ease-in-out infinite' : undefined,
          }}
        />
        {expanded ? <span style={{ whiteSpace: 'nowrap' }}>{label}</span> : <span className="sr-only">{label}</span>}
      </div>
    </>
  );
}
