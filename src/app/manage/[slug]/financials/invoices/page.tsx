'use client';

/** Financials Invoices — stub. Conference invoices aren't built yet. */

import { Receipt } from 'lucide-react';
import { NEU, NEU_GRADIENTS, OUTFIT, NeuInset, NeuIconDisc } from '@/components/neu';
import { mutedCaption } from '../shared';

export default function FinancialsInvoicesPage() {
  return (
    <NeuInset className="flex flex-col items-center text-center px-6 py-14">
      <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Receipt} emoji="Receipt" size={44} />
      <h2 className="mt-4" style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 18, color: NEU.ink }}>
        Invoices
      </h2>
      <p className="mt-1 max-w-sm" style={mutedCaption}>
        Conference invoices will live here once the new invoicing system ships.
      </p>
    </NeuInset>
  );
}
