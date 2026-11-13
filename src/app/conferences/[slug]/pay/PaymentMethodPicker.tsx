'use client';

// PaymentMethodPicker — "Select Your Payment Method" (prompt 31). Shown on Pay
// only when the conference has extra payment methods beside its main one (for
// example UPI for Indian delegates and a SWIFT transfer for international
// ones). One row per method, its name big and its kind small. Each pick runs
// inside the click, so a payment link can still open its tab first; the page
// closes this pop-up and opens the method's own pop-up in its place.

import { ChevronRight } from 'lucide-react';
import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { DANGER, INK_SOFT } from './payKit';
import type { PayWay } from './payApi';

export const KIND_LABEL: Record<PayWay['manual_kind'] | 'card', string> = {
  card: 'Card',
  bank: 'Bank transfer',
  qr: 'QR code',
  link: 'Payment link',
  phone: 'Phone',
  in_person: 'In person',
};

const PICK_CSS = `
.gv-pmp-list{display:flex;flex-direction:column;gap:10px}
.gv-pmp-row{display:flex;align-items:center;gap:12px;width:100%;padding:16px 18px;border-radius:14px;border:none;background:#FFFFFF;color:#1C1410;font-family:inherit;text-align:left;cursor:pointer;box-shadow:inset 0 0 0 1.5px color-mix(in srgb, var(--gv-main) 14%, transparent);transition:box-shadow 160ms ease}
.gv-pmp-row:hover:not(:disabled){box-shadow:inset 0 0 0 1.5px color-mix(in srgb, var(--gv-main) 45%, transparent)}
.gv-pmp-row:disabled{cursor:default;opacity:0.6}
.gv-pmp-row:focus{outline:none}
.gv-pmp-row:focus-visible{box-shadow:0 0 0 3px var(--gv-main)}
.gv-pmp-row b{display:block;font-size:17px;font-weight:800;letter-spacing:-0.01em;overflow-wrap:anywhere}
.gv-pmp-row small{display:block;margin-top:2px;font-size:13px;color:${INK_SOFT}}
`;

export default function PaymentMethodPicker({ mainName, mainKind, showMain, ways, busy, error, onPickMain, onPickWay, onClose }: {
  mainName: string | null;
  /** The main method's kind label: "Card" for card, else its manual kind. */
  mainKind: string;
  /** False when the main method cannot take this step (card, while uploading a proof). */
  showMain: boolean;
  ways: PayWay[];
  busy: boolean;
  error: string;
  onPickMain: () => void;
  onPickWay: (way: PayWay) => void;
  onClose: () => void;
}) {
  return (
    <>
      <style>{PURCHASE_CSS}</style>
      <style>{PICK_CSS}</style>
      <PurchaseShell tone="light" label="Select Your Payment Method" onClose={onClose} panelClass="gv-pay-small" testId="pay-method-picker">
        <div style={{ padding: '26px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
          <h2 style={{ margin: 0, paddingRight: 40, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Select Your Payment Method</h2>
          <div className="gv-pmp-list">
            {showMain && (
              <button type="button" className="gv-pmp-row" disabled={busy} onClick={onPickMain}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{mainName || 'Main payment method'}</b>
                  <small>{mainKind}</small>
                </span>
                <ChevronRight size={18} strokeWidth={2.2} aria-hidden style={{ color: INK_SOFT, flexShrink: 0 }} />
              </button>
            )}
            {ways.map(w => (
              <button key={w.id} type="button" className="gv-pmp-row" disabled={busy} onClick={() => onPickWay(w)}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{w.name}</b>
                  <small>{KIND_LABEL[w.manual_kind]}</small>
                </span>
                <ChevronRight size={18} strokeWidth={2.2} aria-hidden style={{ color: INK_SOFT, flexShrink: 0 }} />
              </button>
            ))}
          </div>
          {error && <p role="alert" style={{ margin: 0, fontSize: 14, color: DANGER }}>{error}</p>}
        </div>
      </PurchaseShell>
    </>
  );
}
