'use client';

// ── ChairDeviceKickModal ─────────────────────────────────────────────────────
//
// Shown on a chair (or voting) page when the SAME signed-in account opened this committee
// on another device more recently (src/lib/useChairDeviceLock.ts). It cannot be dismissed:
// no close button, no Escape, no backdrop click. The page behind it renders nothing
// interactive. "Use this device instead" is the only way back; "Leave" goes elsewhere.

import { useEffect, useRef, useState } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import Portal from './Portal';
import { useT } from '@/contexts/LanguageContext';

const OUTFIT = "'Outfit', sans-serif";

export default function ChairDeviceKickModal({ onUseThisDevice, onLeave }: {
  onUseThisDevice: () => Promise<boolean>;
  onLeave: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => { primaryRef.current?.focus(); }, []);

  const useHere = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await onUseThisDevice();
    setBusy(false);
    if (!ok) setFailed(true);
  };

  return (
    <Portal>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cdk-title"
        aria-describedby="cdk-body"
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
          background: 'rgba(27,56,40,0.45)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          fontFamily: OUTFIT,
        }}
      >
        <div
          style={{
            width: '100%', maxWidth: 420,
            borderRadius: 20,
            background: '#F0EBDD',
            border: '1px solid #DDD4C0',
            boxShadow: '0 24px 60px rgba(27,56,40,0.28)',
            padding: '28px 24px 22px',
            textAlign: 'center',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 48, height: 48, borderRadius: 14, margin: '0 auto 14px',
              display: 'grid', placeItems: 'center',
              background: 'linear-gradient(135deg, #1B3828, #2A5A3C)', color: '#EED98A',
            }}
          >
            <MonitorSmartphone size={22} strokeWidth={2.2} />
          </span>
          <h2 id="cdk-title" style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#1B3828', textWrap: 'balance' }}>
            {t('chair_device_kick_title')}
          </h2>
          <p id="cdk-body" style={{ margin: '10px 0 20px', fontSize: 14, lineHeight: 1.5, color: '#48423D', textWrap: 'pretty' }}>
            {t('chair_device_kick_body')}
          </p>
          {failed && (
            <p role="status" style={{ margin: '-8px 0 14px', fontSize: 13, fontWeight: 600, color: '#8B2020' }}>
              {t('chair_device_kick_failed')}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              ref={primaryRef}
              type="button"
              onClick={useHere}
              disabled={busy}
              className="w-full rounded-xl px-5 py-3 text-sm font-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F0EBDD] active:scale-[0.97] disabled:opacity-60"
              style={{ background: '#1B3828', color: '#EED98A', transition: 'transform 120ms ease-out', letterSpacing: '0.02em' }}
            >
              {busy ? '…' : t('chair_device_kick_use_here')}
            </button>
            <button
              type="button"
              onClick={onLeave}
              className="w-full rounded-xl px-5 py-3 text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F0EBDD] active:scale-[0.97]"
              style={{ background: 'transparent', color: '#1B3828', border: '1px solid #DDD4C0', transition: 'transform 120ms ease-out' }}
            >
              {t('chair_device_kick_leave')}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
