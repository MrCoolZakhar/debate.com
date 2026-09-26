'use client';

// PayActionPopup — the one frame every action on /conferences/[slug]/pay
// opens in (25 Sep 2026): Apply for Financial Aid, Buy Add-ons, Add
// Delegation Spots, Buy Advisor Tickets, Pay for Your Delegates. The purchase
// pop-up shell used across the site (light, one column), a title, one short
// explanation line, then the action's own content, unchanged. The close
// control, Escape and the backdrop all go through `onClose`, which each caller
// guards with its own busy flag exactly as before.

import { PurchaseShell, PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { OUTFIT } from './shared';

export default function PayActionPopup({ title, line, onClose, children, width = 560, testId }: {
  title: string;
  line: string;
  onClose: () => void;
  children: React.ReactNode;
  /** The panel's max width in px. */
  width?: number;
  testId?: string;
}) {
  return (
    <PurchaseShell tone="light" label={title} onClose={onClose} panelClass="gv-payact" testId={testId}>
      <style>{PURCHASE_CSS}{`
        .gv-buy-panel.gv-payact{max-width:${width}px;min-height:0}
        .gv-buy-panel.gv-payact .gv-buy-body{flex-direction:column}
        .gv-payact-body{padding:30px 28px 26px;display:flex;flex-direction:column;gap:16px;font-family:${OUTFIT}}
        @media (max-width:743px){.gv-payact-body{padding:calc(22px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))}}
      `}</style>
      <div className="gv-payact-body">
        <div style={{ paddingRight: 40 }}>
          <h2 className="gv-buy-rtitle" style={{ fontSize: 24, fontWeight: 800 }}>{title}</h2>
          <p className="gv-buy-sub" style={{ marginTop: 6 }}>{line}</p>
        </div>
        {children}
      </div>
    </PurchaseShell>
  );
}
