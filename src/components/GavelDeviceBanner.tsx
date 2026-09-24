'use client';

// ── GavelDeviceBanner ──────────────────────────────────────────────────────
//
// Shown on a chair device whose NAME holds the gavel while ANOTHER device is recorded as
// the Moderator (src/lib/gavelDevice.ts). This device is a Commenter until the chair taps
// "Use this device", which is the ONLY way it takes the gavel back: re-checks never do.
// Persistent (not a toast) because the state lasts until someone acts.

import { Gavel } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { GLASS, glassFallbackCss } from './notifications/glass';

const OUTFIT = "var(--font-brand), sans-serif";

export default function GavelDeviceBanner({ onUseThisDevice }: { onUseThisDevice: () => void }) {
  const t = useT();
  return (
    <div
      role="status"
      aria-live="polite"
      className="gdb-banner"
      style={{
        position: 'fixed', zIndex: 50,
        top: 'calc(3.75rem + var(--dgn-stack-shift, 0px))',
        left: '50%', transform: 'translateX(-50%)',
        maxWidth: 'calc(100vw - 2rem)',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 6px 6px 8px',
        borderRadius: GLASS.radius,
        background: GLASS.fill,
        backdropFilter: GLASS.blur,
        WebkitBackdropFilter: GLASS.blur,
        border: GLASS.border,
        boxShadow: GLASS.shadow,
        color: GLASS.ink,
        fontFamily: OUTFIT,
        transition: 'top 240ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <style>{glassFallbackCss('.gdb-banner')}</style>
      <span
        aria-hidden="true"
        style={{
          width: 28, height: 28, borderRadius: 9, flexShrink: 0,
          display: 'grid', placeItems: 'center',
          background: 'linear-gradient(160deg, #C99A62 0%, #8A5A2E 100%)', color: '#FAF8F3',
        }}
      >
        <Gavel size={14} strokeWidth={2.3} />
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>{t('gavel_device_elsewhere')}</span>
      <button
        type="button"
        onClick={onUseThisDevice}
        className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-black focus:outline-none active:scale-[0.97]"
        style={{ background: 'linear-gradient(135deg, #1B3828, #2A5A3C)', color: '#EED98A', transition: 'transform 120ms ease-out' }}
      >
        {t('gavel_use_this_device')}
      </button>
    </div>
  );
}
