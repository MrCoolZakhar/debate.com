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
  const [pack, setPack] = useState<Pack | 'custom'>(email?.unlimited ? '500' : initial);
  // Another amount, in groups of 100, 100 to 5,000 (1 credit per 100).
  const [customQty, setCustomQty] = useState(300);
  const [customText, setCustomText] = useState('300');
  const clampHundreds = (n: number) => Math.min(5000, Math.max(100, Math.round((Number.isFinite(n) ? n : 300) / 100) * 100));
  const setCustom = (n: number) => { const c = clampHundreds(n); setCustomQty(c); setCustomText(String(c)); };
  const [err, setErr] = useState('');
  const { busy, run, ownOffer, acceptOwn } = useStoreBuy(yourCredits);
  const chosen = pack === 'custom'
    ? { id: String(customQty), qty: customQty.toLocaleString('en-US'), unit: 'more emails', price: customQty / 100 }
    : PACKS.find(p => p.id === pack)!;
  // What buy_email_pack receives: 'unlimited' or a multiple of 100 as text.
  const packValue = pack === 'custom' ? String(customQty) : pack;

  const buy = () => {
    setErr('');
    run(rpcCall('buy_email_pack', { p_conf: conferenceId, p_pack: packValue }), {
      onDone: (a) => {
        notifyOk(pack === 'unlimited' ? 'Unlimited emails are on for this conference.' : `${Number(packValue).toLocaleString('en-US')} more emails added.`, 'store');
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
          <div
            role="radio"
            aria-checked={pack === 'custom'}
            tabIndex={0}
            className="gv-buy-chip gv-sp-chip-light"
            style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
            onClick={() => { setPack('custom'); setErr(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPack('custom'); } }}
          >
            <span className="gv-buy-chip-unit" style={{ fontSize: 14, minWidth: 110 }}>Another amount</span>
            <span className="flex items-center gap-1.5" onClick={(e) => { e.stopPropagation(); setPack('custom'); }}>
              <button type="button" className="gv-em-step" aria-label="100 fewer" disabled={customQty <= 100} onClick={() => setCustom(customQty - 100)}>−</button>
              <input
                type="number"
                inputMode="numeric"
                min={100}
                max={5000}
                step={100}
                value={customText}
                aria-label="How many emails, in groups of 100"
                className="gv-em-in"
                onFocus={() => setPack('custom')}
                onChange={(e) => setCustomText(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                onBlur={() => setCustom(parseInt(customText, 10))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setCustom(parseInt(customText, 10)); } }}
              />
              <button type="button" className="gv-em-step" aria-label="100 more" disabled={customQty >= 5000} onClick={() => setCustom(customQty + 100)}>+</button>
            </span>
            <span className="gv-buy-chip-price" style={{ marginTop: 0, paddingTop: 0, marginLeft: 'auto' }}>{creditsWord(customQty / 100)}</span>
          </div>
        </div>
        {err ? <ErrorLine>{err}</ErrorLine> : null}
        {ownOffer !== null && (
          <p className="gv-buy-note">The conference is short by {creditsWord(ownOffer)}. <button type="button" onClick={acceptOwn}>Use {ownOffer} of your own</button> and buy now.</p>
        )}
        <GoldButton onClick={buy} busy={busy} busyText="One moment…" disabled={pack === 'unlimited' && !!email?.unlimited}>
          {pack === 'unlimited' ? `Go Unlimited for ${chosen.price} credits` : `Buy ${chosen.qty} more for ${creditsWord(chosen.price)}`}
        </GoldButton>
      </div>
      <style>{LIGHT_CHIP_CSS}{`
.gv-em-step{width:34px;height:34px;border-radius:999px;border:1.5px solid rgba(27,56,40,0.28);background:#FFFFFF;color:#1C1410;font-size:18px;font-weight:700;line-height:1;cursor:pointer}
.gv-em-step:disabled{opacity:0.4;cursor:default}
.gv-em-in{width:84px;height:36px;border-radius:10px;border:1.5px solid rgba(27,56,40,0.28);background:#FFFFFF;text-align:center;font-family:inherit;font-size:16px;font-weight:700;color:#1C1410;font-variant-numeric:tabular-nums;-moz-appearance:textfield}
.gv-em-in::-webkit-outer-spin-button,.gv-em-in::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.gv-em-in:focus{outline:none;border-color:#1B3828}
`}</style>
    </PurchaseShell>
  );
}
