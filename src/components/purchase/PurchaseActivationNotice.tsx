'use client';

// While a payment's result is on its way (26 Sep 2026): a small glass notice
// top right. "Activating Unlimited" (or "Adding your credits") with a spinner,
// then, past 30 seconds, the plain sentence that it can take a minute and the
// page updates by itself. It disappears the moment the plan or balance lands.

import { Loader2 } from 'lucide-react';
import { useActivation } from '@/lib/purchaseActivation';

const FONT = "var(--font-brand), sans-serif";

export default function PurchaseActivationNotice() {
  const a = useActivation();
  if (!a) return null;
  const title = a.kind === 'unlimited' ? 'Activating Unlimited' : 'Adding your credits';
  const slow = a.kind === 'unlimited'
    ? 'Your payment went through. Unlimited can take a minute to switch on; this page will update by itself.'
    : 'Your payment went through. Your credits can take a minute to arrive; this page will update by itself.';
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', zIndex: 1200, right: 16, top: 'calc(88px + env(safe-area-inset-top, 0px))',
        maxWidth: 'min(360px, calc(100vw - 32px))', display: 'flex', gap: 12, alignItems: 'flex-start',
        padding: '14px 16px', borderRadius: 16, fontFamily: FONT, color: '#1C1410',
        background: 'rgba(255,253,248,0.86)', backdropFilter: 'blur(16px) saturate(1.2)', WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.7), 0 12px 32px rgba(27,56,40,0.18)',
      }}
    >
      <Loader2 size={20} className="animate-spin" style={{ color: '#1B3828', flexShrink: 0, marginTop: 1 }} aria-hidden />
      <div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{title}</p>
        {a.phase === 'slow' && <p style={{ margin: '4px 0 0', fontSize: 13.5, lineHeight: 1.45, color: '#4A4238' }}>{slow}</p>}
      </div>
    </div>
  );
}
