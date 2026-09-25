'use client';

// EmailsPopup — "Gavelling Emails": more bulk emails for this conference.
// Left explains the email builder (some organisers meet it here first) and
// that automatic notifications are always free. Right: 100 more (1 credit),
// 500 more (5), Unlimited for this conference (20). buy_email_pack(p_conf,
// pack, p_top_up); short on credits goes through useStoreBuy.

import { useState } from 'react';
import { BellRing, Filter, History, Mail } from 'lucide-react';
import { notifyOk } from '@/lib/appNotify';
import { PurchaseShell, BrandTitle, Eyebrow, BenefitList, ErrorLine, GoldButton, type Benefit } from '@/components/purchase/purchaseKit';
import { credits as creditsWord, rpcCall, useStoreBuy, type EmailAllowance, type StoreAnswer } from './storeApi';
import { LIGHT_CHIP_CSS } from './SponsorshipPopup';

type Pack = '100' | '500' | 'unlimited';
const PACKS: { id: Pack; qty: string; unit: string; price: number }[] = [
  { id: '100', qty: '100', unit: 'more emails', price: 1 },
  { id: '500', qty: '500', unit: 'more emails', price: 5 },
  { id: 'unlimited', qty: '∞', unit: 'unlimited for this conference', price: 20 },
];

const POINTS: Benefit[] = [
  { emoji: 'E-mail', fallback: Mail, title: 'Designed emails to your applicants', note: 'Your own layout, your logo, sent from the builder.', live: true },
  { emoji: 'Control knobs', fallback: Filter, title: 'Filtered to the right people', note: 'By role, status, committee or delegation.', live: true },
  { emoji: 'Hourglass done', fallback: History, title: 'Scheduled or sent now', note: 'With a history of every send.', live: true },
  { emoji: 'Bell', fallback: BellRing, title: 'Notifications are always free', note: 'Confirmations, acceptances, allocations and reminders never count.', live: true },
];

export default function EmailsPopup({ conferenceId, email, yourCredits, initial = '500', onClose, onDone }: {
  conferenceId: string; email: EmailAllowance | null; yourCredits: number; initial?: Pack;
  onClose: () => void; onDone: (a: StoreAnswer) => void;
}) {
  const [pack, setPack] = useState<Pack>(email?.unlimited ? '500' : initial);
  const [err, setErr] = useState('');
  const { busy, run, ownOffer, acceptOwn } = useStoreBuy(yourCredits);
  const chosen = PACKS.find(p => p.id === pack)!;

  const buy = () => {
    setErr('');
    run(rpcCall('buy_email_pack', { p_conf: conferenceId, p_pack: pack }), {
      onDone: (a) => {
        notifyOk(pack === 'unlimited' ? 'Unlimited emails are on for this conference.' : `${pack} more emails added.`, 'store');
        onDone(a);
        onClose();
      },
      onRefused: (m) => setErr(m),
    });
  };

  const cap = email ? (email.unlimited ? null : email.free + email.extra) : null;

  return (
    <PurchaseShell tone="light" label="Buy more emails" onClose={onClose} testId="store-emails" panelClass="gv-st-pop">
      <div className="gv-buy-left">
        <BrandTitle word="Emails" tone="light" sub={<>Every conference sends 1,000 bulk emails free. Buy more when you need them</>} />
        <div>
          <Eyebrow>The email builder</Eyebrow>
          <BenefitList items={POINTS} tone="light" />
        </div>
        {email && (
          <div className="gv-buy-balance">
            <Eyebrow>Used so far</Eyebrow>
            <p className="gv-buy-sub" style={{ margin: 0 }}>
              <b style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{email.used.toLocaleString('en-US')}</b>
              {cap === null ? ' emails sent, unlimited' : ` of ${cap.toLocaleString('en-US')}`}
            </p>
          </div>
        )}
      </div>
      <div className="gv-buy-right">
        <h3 className="gv-buy-rtitle">Pick a Pack</h3>
        <div className="gv-buy-grid" role="radiogroup" aria-label="Email packs" style={{ gridTemplateColumns: '1fr' }}>
          {PACKS.map((p) => {
            const off = p.id === 'unlimited' && !!email?.unlimited;
            return (
              <button key={p.id} type="button" role="radio" aria-checked={pack === p.id} disabled={off} className="gv-buy-chip gv-sp-chip-light" style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: off ? 0.5 : 1 }} onClick={() => { setPack(p.id); setErr(''); }}>
                <span className="gv-buy-chip-qty" style={{ minWidth: 64 }}>{p.qty}</span>
                <span className="gv-buy-chip-unit" style={{ flex: 1, fontSize: 14 }}>{off ? 'Already on for this conference' : p.unit}</span>
                <span className="gv-buy-chip-price" style={{ marginTop: 0, paddingTop: 0 }}>{creditsWord(p.price)}</span>
              </button>
            );
          })}
        </div>
        {err ? <ErrorLine>{err}</ErrorLine> : null}
        {ownOffer !== null && (
          <p className="gv-buy-note">The conference is short by {creditsWord(ownOffer)}. <button type="button" onClick={acceptOwn}>Use {ownOffer} of your own</button> and buy now.</p>
        )}
        <GoldButton onClick={buy} busy={busy} busyText="One moment…" disabled={pack === 'unlimited' && !!email?.unlimited}>
          {pack === 'unlimited' ? `Go Unlimited for ${chosen.price} credits` : `Buy ${chosen.qty} more for ${creditsWord(chosen.price)}`}
        </GoldButton>
      </div>
      <style>{LIGHT_CHIP_CSS}</style>
    </PurchaseShell>
  );
}
