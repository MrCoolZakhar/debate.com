'use client';

// "Get more emails": the one button the Communications builder and the
// Applications bulk Email bar show when a send does not fit the allowance.
// It opens the Store's Gavelling Emails pop-up (EmailsPopup, prompt 59) in
// place, reading the allowance and the buyer's credits when pressed, and
// tells the caller when a pack was bought so it can re-check and send.

import { useState } from 'react';
import { Mail } from 'lucide-react';
import { OUTFIT } from '@/components/neu';
import { PURCHASE_CSS } from '@/components/purchase/purchaseKit';
import { readEmailAllowance, type EmailAllowance } from '@/lib/emailAllowance';
import { authedClient, readStoreState, type StoreAnswer } from './storeApi';
import EmailsPopup from './EmailsPopup';

export default function GetMoreEmails({ conferenceId, onBought, initial = '500', compact = false }: {
  conferenceId: string;
  /** A pack landed: re-read the allowance and carry on. */
  onBought?: (allowance: EmailAllowance | null) => void;
  initial?: '100' | '500' | 'unlimited';
  compact?: boolean;
}) {
  const [open, setOpen] = useState<{ email: EmailAllowance | null; yourCredits: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function press() {
    if (busy) return;
    setBusy(true);
    try {
      const client = await authedClient();
      const [email, st] = await Promise.all([
        readEmailAllowance(client, conferenceId),
        client.rpc('my_store', { p_conf: conferenceId }),
      ]);
      const state = readStoreState(st.data as StoreAnswer);
      setOpen({ email, yourCredits: state?.your_credits ?? 0 });
    } catch {
      setOpen({ email: null, yourCredits: 0 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { void press(); }}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
        style={{
          minHeight: compact ? 36 : 42, padding: compact ? '0 12px' : '0 16px',
          background: 'linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%)', color: '#FFFFFF', border: 'none',
          fontFamily: OUTFIT, fontSize: compact ? 12.5 : 13.5, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.8 : 1,
        }}
      >
        <Mail size={14} strokeWidth={2.4} aria-hidden />
        Get more emails
      </button>
      {open && (
        <>
          <style>{PURCHASE_CSS}</style>
          <EmailsPopup
            conferenceId={conferenceId}
            email={open.email}
            yourCredits={open.yourCredits}
            initial={initial}
            onClose={() => setOpen(null)}
            onDone={() => {
              void (async () => {
                try {
                  const client = await authedClient();
                  onBought?.(await readEmailAllowance(client, conferenceId));
                } catch {
                  onBought?.(null);
                }
              })();
            }}
          />
        </>
      )}
    </>
  );
}
