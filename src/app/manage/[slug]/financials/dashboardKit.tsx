'use client';

// dashboardKit.tsx — the Financials dashboard's look (1 Oct 2026), built on the
// Conference Store's kit: white cards on ivory, big numbers with a caption, one
// or two buttons a card, an "i" hint on every card. STORE_CSS is mounted by the
// page; DASH_CSS adds only what the Store does not have. The four settings
// cards are separate components with an `onOpen` prop, so prompt 94 only swaps
// the handler for a pop-up.

import { CreditCard, Gift, ReceiptText, Ticket, type LucideIcon } from 'lucide-react';
import { OUTFIT, Emoji3D } from '@/components/neu';
import { InfoHint } from '../settings/applicationsUi';
import { INK, INK_SOFT, FOREST, GOLD, DEEP_GOLD, IVORY, LINE, DANGER } from '../store/storeKit';
import type { FinancialsDashboard } from './financialsApi';

export { INK, INK_SOFT, FOREST, GOLD, DEEP_GOLD, IVORY, LINE, DANGER };

/** The two tints behind a card's icon (9 Oct 2026, "missing icons and colours"):
 *  a pale forest for money and people, a pale gold for paperwork and settings. */
export const TINT_GREEN = 'linear-gradient(150deg, rgba(61,122,82,0.20), rgba(61,122,82,0.08))';
export const TINT_GOLD = 'linear-gradient(150deg, rgba(238,217,138,0.70), rgba(238,217,138,0.30))';
/** Outstanding money: the manage layout's gold ink, 5.3:1 on white. */
export const OWED = '#7A5A10';

export const READ_ONLY_LINE = 'You can view Financials but not change them';

export const DASH_CSS = `
.gv-fd-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
.gv-fd-two{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
.gv-fd-three{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
@media (min-width:700px){.gv-fd-three{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (min-width:1100px){.gv-fd-three{grid-template-columns:repeat(3,minmax(0,1fr))}}
.gv-fd-four{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
@media (min-width:860px){
  .gv-fd-grid{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)}
  .gv-fd-two{grid-template-columns:repeat(2,minmax(0,1fr))}
  .gv-fd-four{grid-template-columns:repeat(4,minmax(0,1fr))}
}
@media (max-width:420px){.gv-fd-four{grid-template-columns:minmax(0,1fr)}}

/* Header numbers, top right, in the Store balances' place */
.gv-fd-head-nums{display:flex;align-items:flex-start;gap:22px;flex-wrap:wrap}
.gv-fd-head-cell{display:flex;flex-direction:column;align-items:flex-end;gap:2px;min-width:0}
.gv-fd-head-big{font-size:26px;font-weight:900;letter-spacing:-0.02em;line-height:1.05;font-variant-numeric:tabular-nums;color:${FOREST}}
.gv-fd-head-big.gv-fd-owed{color:${INK}}
.gv-fd-head-cap{font-size:12px;font-weight:600;color:${INK_SOFT}}
.gv-fd-other{margin:8px 0 0;font-size:12.5px;line-height:1.45;color:${INK_SOFT};text-align:right}
@media (max-width:639px){.gv-fd-head-cell{align-items:flex-start}.gv-fd-other{text-align:left}}

.gv-fd-card{display:flex;flex-direction:column}
/* The icon disc beside a card's title, and a soft wash of the same tint in the card's top corner */
.gv-fd-disc{width:44px;height:44px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:inset 0 1px 0 rgba(255,255,255,0.75),0 6px 14px -10px rgba(27,56,40,0.45)}
.gv-fd-card .gv-st-card-head.gv-fd-head{gap:12px;margin-bottom:10px}
.gv-fd-wash-green{background:radial-gradient(120% 90% at 100% 0%,rgba(61,122,82,0.07) 0%,rgba(61,122,82,0) 55%),#FFFFFF!important}
.gv-fd-wash-gold{background:radial-gradient(120% 90% at 100% 0%,rgba(238,217,138,0.22) 0%,rgba(238,217,138,0) 55%),#FFFFFF!important}
.gv-fd-in{color:${FOREST}}
.gv-fd-owe{color:${OWED}!important}
.gv-fd-dot{display:inline-block;width:8px;height:8px;border-radius:999px;margin-right:6px;vertical-align:1px}
/* Welcome to Financials: words left, a photo right (above on phones) */
.gv-fd-welcome{display:grid;grid-template-columns:minmax(0,1fr);overflow:hidden;padding:0!important}
.gv-fd-welcome-photo{position:relative;min-height:150px;background:#E4DCCA}
.gv-fd-welcome-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.gv-fd-welcome-body{padding:30px 28px}
@media (min-width:760px){.gv-fd-welcome{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)}.gv-fd-welcome-photo{order:2;min-height:240px}}
.gv-fd-card .gv-fd-foot{margin-top:auto;padding-top:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.gv-fd-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.gv-fd-review{margin:14px 0 0;font-size:13.5px;font-weight:600;color:${DEEP_GOLD}}

/* Things to do: the anchor. A gold edge while there is work, a quiet one when not. */
.gv-fd-todo{box-shadow:0 0 0 2px ${GOLD},0 0 0 3px rgba(182,135,31,0.35),0 18px 40px -26px rgba(182,135,31,0.65)!important}
.gv-fd-todo-num{font-size:64px;font-weight:900;letter-spacing:-0.04em;line-height:0.95;font-variant-numeric:tabular-nums;color:${FOREST}}
.gv-fd-todo-word{margin-left:10px;font-size:19px;font-weight:800;color:${INK}}
.gv-fd-todo-line{margin:10px 0 0;font-size:14px;line-height:1.5;color:${INK_SOFT}}
.gv-fd-clear{display:flex;align-items:center;gap:12px;margin-top:6px}
.gv-fd-clear-disc{width:52px;height:52px;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;background:${TINT_GREEN};color:${FOREST};flex-shrink:0}
.gv-fd-clear-text{font-size:18px;font-weight:800;color:${INK}}

/* Small settings cards */
.gv-fd-set{padding:16px 16px 14px!important}
.gv-fd-set-icon{width:42px;height:42px;border-radius:13px;display:inline-flex;align-items:center;justify-content:center;color:${FOREST};margin-bottom:10px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.75),0 6px 14px -10px rgba(27,56,40,0.45)}
.gv-fd-set-fact{margin:2px 0 0;font-size:15px;font-weight:800;line-height:1.3;color:${INK};overflow-wrap:anywhere}
.gv-fd-set-sub{margin:3px 0 0;font-size:12.5px;line-height:1.45;color:${INK_SOFT}}
.gv-fd-set .gv-st-btn{min-height:38px;padding:0 14px;font-size:13px}

/* Placeholders while reading */
.gv-fd-ph{border-radius:20px;background:#FFFFFF;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 18px 40px -32px rgba(27,56,40,0.35);position:relative;overflow:hidden}
.gv-fd-ph::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(27,56,40,0.05) 50%,rgba(255,255,255,0) 100%);animation:gvFdShimmer 1.4s ease-in-out infinite}
.gv-fd-bar{display:block;height:12px;border-radius:6px;background:rgba(27,56,40,0.08)}
@keyframes gvFdShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
@media (prefers-reduced-motion:reduce){.gv-fd-ph::after{animation:none}}

/* Pop-ups: a wide panel, and the rows of a breakdown */
.gv-buy-panel.gv-fd-wide{max-width:1040px}
.gv-buy-panel.gv-fd-mid{max-width:620px}
/* A pop-up as small as its content (the cleared Things to do): no 560px minimum, a bottom sheet on phones. */
.gv-buy-panel.gv-fd-small{max-width:440px;min-height:0}
.gv-buy-panel.gv-fd-small .gv-buy-body{flex-direction:column}
@media (max-width:743px){.gv-buy-panel.gv-fd-small{height:auto;max-height:92dvh;margin-top:auto;border-radius:22px 22px 0 0}}
.gv-fd-pop{flex:1 1 auto;min-width:0;width:100%;padding:30px 28px 26px;display:flex;flex-direction:column;gap:18px}
.gv-fd-pop-title{margin:0;padding-right:40px;font-size:28px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;color:${INK}}
.gv-fd-sect{margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT}}
.gv-fd-rows{display:flex;flex-direction:column;border-radius:14px;background:#FFFFFF;padding:4px 14px}
.gv-fd-row{display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:10px 0;font-size:14px;color:${INK}}
.gv-fd-row + .gv-fd-row{border-top:1px solid ${LINE}}
.gv-fd-row-label{min-width:0;overflow-wrap:anywhere}
.gv-fd-row-label small{display:block;font-size:12.5px;color:${INK_SOFT}}
.gv-fd-row-amt{flex-shrink:0;font-weight:700;font-variant-numeric:tabular-nums}
.gv-fd-row.gv-fd-total{font-weight:800}
.gv-fd-row.gv-fd-total .gv-fd-row-amt{font-weight:900;color:${FOREST}}
.gv-fd-minus{color:${DANGER}}
.gv-fd-note{margin:0;font-size:13px;line-height:1.5;color:${INK_SOFT}}
.gv-fd-links{display:flex;gap:18px;flex-wrap:wrap}
/* A footer that stays at the bottom of a pop-up while the content above scrolls. */
.gv-fd-footbar{position:sticky;bottom:0;z-index:2;display:flex;gap:10px;flex-wrap:wrap;margin:6px -28px -26px;padding:14px 28px calc(16px + env(safe-area-inset-bottom,0px));background:#F6F3EC;box-shadow:0 -1px 0 ${LINE}}
@media (max-width:480px){.gv-fd-footbar .gv-st-btn{flex:1 1 140px}}

/* Fields in the pop-ups */
.gv-fd-label{display:block;margin:0 0 6px;font-size:13.5px;font-weight:700;color:${INK}}
.gv-fd-text{width:100%;min-height:96px;padding:12px 14px;border-radius:12px;border:1.5px solid rgba(27,56,40,0.28);background:#FFFFFF;color:${INK};font-family:${OUTFIT};font-size:15px;line-height:1.5;resize:vertical}
.gv-fd-text:focus{outline:none;border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.12)}
.gv-fd-count{margin:4px 0 0;font-size:12px;color:${INK_SOFT};text-align:right;font-variant-numeric:tabular-nums}
.gv-fd-seg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.gv-fd-seg button{min-height:44px;border-radius:12px;border:1.5px solid rgba(27,56,40,0.28);background:#FFFFFF;color:${INK};font-family:${OUTFIT};font-size:13.5px;font-weight:700;cursor:pointer}
.gv-fd-seg button[aria-checked="true"]{background:${FOREST};color:${GOLD};border-color:${FOREST}}
.gv-fd-check{display:flex;align-items:flex-start;gap:12px;padding:12px 0;cursor:pointer}
.gv-fd-check + .gv-fd-check{border-top:1px solid ${LINE}}
.gv-fd-check input{width:20px;height:20px;margin-top:1px;accent-color:${FOREST};flex-shrink:0}
.gv-fd-warn{padding:12px 14px;border-radius:12px;background:rgba(238,217,138,0.35);font-size:13.5px;line-height:1.5;color:${INK}}
`;

/** A dashboard card: the Store's white card with the title, an "i" hint, and an optional line. */
export function DashCard({ title, hint, line, children, className, style, icon }: {
  title: string; hint: string; line?: string; children: React.ReactNode; className?: string; style?: React.CSSProperties;
  /** A Fluent 3D emoji in a tinted disc before the title, with a lucide fallback,
   *  and the same tint washed faintly into the card's top corner. */
  icon?: CardIcon;
}) {
  const wash = icon ? (icon.tint === TINT_GOLD ? ' gv-fd-wash-gold' : ' gv-fd-wash-green') : '';
  return (
    <section className={`gv-st-card gv-fd-card${wash}${className ? ` ${className}` : ''}`} aria-label={title} style={style}>
      <div className={`gv-st-card-head${icon ? ' gv-fd-head' : ''}`}>
        {icon ? <IconDisc icon={icon} /> : null}
        <h2 className="gv-st-card-title">{title}</h2>
        <InfoHint label={`About ${title}`} text={hint} size={16} />
      </div>
      {line ? <p className="gv-st-card-line">{line}</p> : null}
      {children}
    </section>
  );
}

export type CardIcon = { emoji: string; lucide: LucideIcon; tint: string };

/** The tinted disc with a Fluent 3D emoji (lucide in forest if the image fails). */
export function IconDisc({ icon, size = 44 }: { icon: CardIcon; size?: number }) {
  return (
    <span className="gv-fd-disc" aria-hidden style={{ background: icon.tint, width: size, height: size, borderRadius: Math.round(size * 0.32) }}>
      <Emoji3D name={icon.emoji} size={Math.round(size * 0.62)} fallback={icon.lucide} fallbackColor={FOREST} />
    </span>
  );
}

/** Card-shaped placeholders while financials_dashboard is read. */
export function DashboardPlaceholder() {
  const bars = (w: string[]) => (
    <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {w.map((x, i) => <span key={i} className="gv-fd-bar" style={{ width: x, height: i === 1 ? 30 : 12 }} />)}
    </div>
  );
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Reading your Financials">
      <div className="gv-fd-grid">
        <div className="gv-fd-ph" style={{ minHeight: 200 }}>{bars(['30%', '55%', '40%'])}</div>
        <div className="gv-fd-ph" style={{ minHeight: 200 }}>{bars(['35%', '25%', '60%'])}</div>
      </div>
      <div className="gv-fd-two">
        <div className="gv-fd-ph" style={{ minHeight: 140 }}>{bars(['30%', '45%'])}</div>
        <div className="gv-fd-ph" style={{ minHeight: 140 }}>{bars(['40%', '60%'])}</div>
      </div>
      <div className="gv-fd-four">
        {[0, 1, 2, 3].map(i => <div key={i} className="gv-fd-ph" style={{ minHeight: 132 }}>{bars(['50%', '70%'])}</div>)}
      </div>
    </div>
  );
}

// ── The four settings cards ───────────────────────────────────────────────

type S = FinancialsDashboard['settings'];

function SettingCard({ title, hint, icon, fact, sub, onOpen, readOnly }: {
  title: string; hint: string; icon: CardIcon; fact: string; sub?: string; onOpen: () => void; readOnly: boolean;
}) {
  return (
    <section className="gv-st-card gv-fd-card gv-fd-set" aria-label={title}>
      <span className="gv-fd-set-icon" aria-hidden style={{ background: icon.tint }}>
        <Emoji3D name={icon.emoji} size={26} fallback={icon.lucide} fallbackColor={FOREST} />
      </span>
      <div className="gv-st-card-head">
        <h3 className="gv-st-card-title" style={{ fontSize: 15 }}>{title}</h3>
        <InfoHint label={`About ${title}`} text={hint} size={15} />
      </div>
      <p className="gv-fd-set-fact">{fact}</p>
      {sub ? <p className="gv-fd-set-sub">{sub}</p> : null}
      <div className="gv-fd-foot">
        {/* A read-only organizer can still look at the settings page, which is itself read-only. */}
        <button type="button" className="gv-st-btn gv-st-outline" onClick={onOpen}>{readOnly ? 'View' : 'Change'}</button>
      </div>
    </section>
  );
}

export function PaymentMethodCard({ s, onOpen, readOnly }: { s: S; onOpen: () => void; readOnly: boolean }) {
  let fact = 'Not set up yet';
  let sub: string | undefined = 'Choose how people pay before you accept anyone';
  if (s.platform_collects) {
    fact = 'Card payments (Stripe)';
    sub = 'Gavelling collects payments for you';
  } else if (s.payment_method === 'stripe') {
    fact = 'Card payments (Stripe)';
    sub = s.connect_status === 'complete' ? 'Ready' : 'Stripe needs a few more details';
  } else if (s.payment_method === 'manual') {
    fact = 'Manual payments';
    sub = 'Payers upload a proof for you to review';
  }
  return (
    <SettingCard
      title="Payment Method" icon={{ emoji: 'Credit card', lucide: CreditCard, tint: TINT_GREEN }}
      hint="How participants pay you. Card payments go straight to your own Stripe account. Manual payments are bank transfers or cash, and the payer uploads a proof for you to check."
      fact={fact} sub={sub} onOpen={onOpen} readOnly={readOnly}
    />
  );
}

export function RegistrationFeeCard({ s, onOpen, readOnly, formatCents }: {
  s: S; onOpen: () => void; readOnly: boolean; formatCents: (cents: number, currency: string) => string;
}) {
  const f = s.registration_fee;
  const on = !!f && f.active;
  const per = f?.applies_to === 'delegation' ? 'per delegation' : 'per delegate';
  return (
    <SettingCard
      title="Registration Fee" icon={{ emoji: 'Receipt', lucide: ReceiptText, tint: TINT_GOLD }}
      hint="A fee charged once on top of the ticket, for example to cover a deposit. Leave it off if your ticket price already covers everything."
      fact={on ? formatCents(f!.amount_cents, f!.currency) : 'None'}
      sub={on ? (f!.label ? `${f!.label}, ${per}` : per) : undefined}
      onOpen={onOpen} readOnly={readOnly}
    />
  );
}

export function AddonsCard({ s, onOpen, readOnly }: { s: S; onOpen: () => void; readOnly: boolean }) {
  const any = s.addons_active > 0 || s.addons_sold > 0;
  return (
    <SettingCard
      title="Add-ons" icon={{ emoji: 'Wrapped gift', lucide: Gift, tint: TINT_GOLD }}
      hint="Extras people can buy with their ticket, like a social night or merchandise. Each one is billed as its own item."
      fact={any ? `${s.addons_active} on sale` : 'None yet'}
      sub={any ? `${s.addons_sold} bought` : undefined}
      onOpen={onOpen} readOnly={readOnly}
    />
  );
}

export function VouchersCard({ s, onOpen, readOnly }: { s: S; onOpen: () => void; readOnly: boolean }) {
  const any = s.vouchers_active > 0 || s.vouchers_used > 0;
  return (
    <SettingCard
      title="Vouchers" icon={{ emoji: 'Ticket', lucide: Ticket, tint: TINT_GREEN }}
      hint="Discount codes you hand out, for partner schools or early supporters. A code takes money off the ticket when someone applies."
      fact={any ? `${s.vouchers_active} active code${s.vouchers_active === 1 ? '' : 's'}` : 'None yet'}
      sub={any ? `Used ${s.vouchers_used} time${s.vouchers_used === 1 ? '' : 's'}` : undefined}
      onOpen={onOpen} readOnly={readOnly}
    />
  );
}

/** One breakdown line: a label (with an optional small line under it) and its amount. */
export function Row({ label, sub, amount, minus, total }: {
  label: React.ReactNode; sub?: string; amount: string; minus?: boolean; total?: boolean;
}) {
  return (
    <div className={`gv-fd-row${total ? ' gv-fd-total' : ''}`}>
      <span className="gv-fd-row-label">{label}{sub ? <small>{sub}</small> : null}</span>
      <span className={`gv-fd-row-amt${minus ? ' gv-fd-minus' : ''}`}>{minus ? `minus ${amount}` : amount}</span>
    </div>
  );
}

/**
 * A big amount's font size so it stays on ONE line (prompt 100): the base size
 * up to 11 characters, then smaller in step with its length, never below 60%
 * of the base. "≈ TRY 82,457.14" shrinks instead of wrapping or being cut.
 */
export function moneyFontSize(text: string, base: number): number {
  const len = text.length;
  if (len <= 11) return base;
  return Math.max(Math.round(base * 0.6), Math.round((base * 11) / len));
}

/** The Store's Big (same classes), on one line and sized to fit by moneyFontSize. */
export function FitBig({ n, cap, tone }: { n: string; cap: string; tone?: 'in' | 'owed' }) {
  return (
    <div style={{ minWidth: 0 }}>
      <span className={`gv-st-big${tone === 'owed' ? ' gv-fd-owe' : ''}`} style={{ whiteSpace: 'nowrap', fontSize: moneyFontSize(n, 34) }}>{n}</span>
      <span className="gv-st-big-cap">
        {tone ? <span className="gv-fd-dot" aria-hidden style={{ background: tone === 'owed' ? '#D9B44A' : '#3D7A52' }} /> : null}
        {cap}
      </span>
    </div>
  );
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** On since prompt 98: the Generate invoices card opens Invoices and Receipts.
 *  Lives here rather than in page.tsx because a Next page may only export its
 *  default and route config. */
export const GENERATE_INVOICES_READY = true;
