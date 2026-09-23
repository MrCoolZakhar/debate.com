'use client';

// Payment tab of the applicant pop-up: this person's invoices and every
// payment against them, read from the ledger (invoices + payments +
// payment_batches), never from applications.payment_status (CLAUDE.md §3).
// Approving or rejecting a proof stays on Financials → Invoices, which owns
// that review flow; this tab links there. Mark paid / reminder / mark unpaid
// are the page's own PaymentMenu, rendered here unchanged.

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, CircleCheck, CircleDashed, Clock, CreditCard, FileImage, HandCoins, HeartHandshake, Landmark,
  RefreshCw, Receipt, Undo2, Users, XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { centsToFee, invoiceLabel } from '@/lib/invoices';
import { formatFee } from '@/lib/utils';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr } from '@/lib/appNotify';
import type { ApplicantApp, Ledger, LedgerInvoice, LedgerPayment, LedgerTotals } from './data';
import { proofUrl } from './data';
import { MoneyStrip } from './tabs';
import { C, OUTFIT, NUM, SectionTitle, Empty, Spinner, ErrorLine, fmtDay, fmtDateTime } from './kit';

export interface AidInfo {
  status: string | null;
  statement: string | null;
  requestedAmount: number | null;
  grantedAmount: number | null;
  currency: string;
}

const INVOICE_STATE: Record<string, { label: string; icon: LucideIcon; tint: string }> = {
  open: { label: 'Unpaid', icon: CircleDashed, tint: C.red },
  partial: { label: 'Part paid', icon: Clock, tint: C.goldInk },
  settled: { label: 'Paid', icon: CircleCheck, tint: C.forestLight },
  waived: { label: 'Waived', icon: Undo2, tint: C.inkSoft },
};

const KIND_NAME: Record<string, string> = {
  role_fee: 'Registration', app_fee: 'Application fee', addon: 'Add-on',
  pledge_spot: 'Delegation spot', advisor_spot: 'Advisor ticket',
};

/** Where a payment came from, in words, with the icon that says it faster. */
function provenance(p: LedgerPayment): { label: string; icon: LucideIcon; tint: string; muted?: boolean } {
  const ok = p.status === 'succeeded';
  if (p.method === 'stripe') {
    return ok
      ? { label: 'Paid by card through Gavelling', icon: CreditCard, tint: C.forestLight }
      : { label: 'Card checkout started, not finished', icon: CircleDashed, tint: C.inkSoft, muted: true };
  }
  if (p.type === 'manual_proof') {
    if (ok) return { label: 'Proof of payment approved', icon: FileImage, tint: C.goldInk };
    if (p.batch?.status === 'rejected') return { label: 'Proof of payment rejected', icon: XCircle, tint: C.red, muted: true };
    return { label: 'Proof of payment waiting for review', icon: Clock, tint: C.amber };
  }
  return ok
    ? { label: 'Marked paid by the organisers', icon: HandCoins, tint: C.goldInk }
    : { label: 'Recorded, not confirmed', icon: CircleDashed, tint: C.inkSoft, muted: true };
}

function ProofButton({ path, accessToken }: { path: string; accessToken: string | null }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy || !accessToken}
      onClick={async () => {
        if (!accessToken) return;
        // Open the tab inside the click so a popup blocker never eats it,
        // then point it at the signed link once it exists.
        const win = window.open('', '_blank');
        if (win) win.opener = null;
        setBusy(true);
        try {
          const url = await proofUrl(accessToken, path);
          if (win) win.location.href = url; else window.open(url, '_blank', 'noopener,noreferrer');
        } catch (e) {
          win?.close();
          notifyErr(friendlyError(e, 'Could not open the proof. Try again.'));
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex items-center gap-1 focus:outline-none"
      style={{
        padding: '4px 10px', borderRadius: 999, border: `1.5px solid ${C.parchment}`, background: C.cream,
        color: C.forest, fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, cursor: busy ? 'wait' : 'pointer',
      }}
    >
      <FileImage size={13} aria-hidden /> {busy ? 'Opening' : 'View proof'}
    </button>
  );
}

function PaymentLine({ p, accessToken }: { p: LedgerPayment; accessToken: string | null }) {
  const pv = provenance(p);
  const Icon = pv.icon;
  return (
    <li className="flex items-center gap-3 flex-wrap" style={{ padding: '8px 0', borderTop: `1px dashed ${C.parchment}`, opacity: pv.muted ? 0.75 : 1 }}>
      <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 26, height: 26, borderRadius: 999, background: `${pv.tint}1A`, border: `1.5px solid ${pv.tint}55` }}>
        <Icon size={13} strokeWidth={2.4} style={{ color: pv.tint }} aria-hidden />
      </span>
      <div className="min-w-0" style={{ flex: '1 1 200px' }}>
        <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: C.ink }}>{pv.label}</p>
        <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: C.inkSoft, ...NUM }}>
          {fmtDateTime(p.batch?.paid_at && p.status === 'succeeded' ? p.batch.paid_at : p.created_at)}
          {p.note ? ` · ${p.note}` : ''}
        </p>
      </div>
      {p.batch?.proof_path && <ProofButton path={p.batch.proof_path} accessToken={accessToken} />}
      <span style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: pv.muted ? C.inkSoft : C.ink, textDecoration: pv.muted ? 'line-through' : 'none', ...NUM }}>
        {centsToFee(p.amount_cents, p.currency)}
      </span>
    </li>
  );
}

function InvoiceCard({ inv, appId, accessToken }: { inv: LedgerInvoice; appId: string; accessToken: string | null }) {
  const st = INVOICE_STATE[inv.status] ?? INVOICE_STATE.open;
  const StIcon = st.icon;
  const due = Math.max(0, inv.amount_cents - inv.amount_paid_cents);
  const coveredByDelegation = inv.covers_application_id === appId && inv.application_id !== appId;
  // Abandoned card checkouts pile up (one per click on Pay). Show the real
  // events and fold the unfinished checkouts into one line.
  const real = inv.payments.filter(p => !(p.method === 'stripe' && p.status !== 'succeeded'));
  const abandoned = inv.payments.length - real.length;
  return (
    <li style={{ borderRadius: 18, border: `1.5px solid ${C.parchment}`, background: '#FFFFFF', padding: '14px 16px' }}>
      <div className="flex items-start gap-3 flex-wrap">
        <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, borderRadius: 12, background: C.ivory }}>
          {coveredByDelegation ? <Users size={17} style={{ color: C.forest }} aria-hidden /> : <Receipt size={17} style={{ color: C.forest }} aria-hidden />}
        </span>
        <div className="min-w-0" style={{ flex: '1 1 180px' }}>
          <p style={{ fontFamily: OUTFIT, fontSize: 14.5, fontWeight: 800, color: C.ink, overflowWrap: 'anywhere' }}>
            {invoiceLabel(inv)}{(inv.quantity ?? 1) > 1 ? ` x ${inv.quantity}` : ''}
          </p>
          <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: C.inkSoft }}>
            {[KIND_NAME[inv.kind] && KIND_NAME[inv.kind] !== invoiceLabel(inv) ? KIND_NAME[inv.kind] : null,
              coveredByDelegation ? 'Billed to their delegation' : null,
              `Issued ${fmtDay(inv.created_at)}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="text-end">
          <p style={{ fontFamily: OUTFIT, fontSize: 18, fontWeight: 900, color: C.ink, lineHeight: 1.1, ...NUM }}>{centsToFee(inv.amount_cents, inv.currency)}</p>
          <p className="inline-flex items-center gap-1 mt-0.5" style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, color: st.tint }}>
            <StIcon size={13} strokeWidth={2.5} aria-hidden /> {st.label}
          </p>
        </div>
      </div>

      {(inv.amount_paid_cents > 0 || (inv.aid_applied_cents ?? 0) > 0 || due > 0) && inv.status !== 'waived' && (
        <div className="mt-3">
          <div style={{ height: 8, borderRadius: 999, background: C.track, overflow: 'hidden' }} aria-hidden>
            <div style={{
              height: '100%', borderRadius: 999,
              width: `${inv.amount_cents > 0 ? Math.min(100, (inv.amount_paid_cents / inv.amount_cents) * 100) : 100}%`,
              background: `linear-gradient(90deg, ${C.forestLight}, ${C.forestMid})`,
            }} />
          </div>
          <p className="mt-1.5 flex flex-wrap gap-x-3" style={{ fontFamily: OUTFIT, fontSize: 12, color: C.inkSoft, ...NUM }}>
            <span><strong style={{ color: C.ink }}>{centsToFee(inv.amount_paid_cents, inv.currency)}</strong> paid</span>
            {due > 0 && <span><strong style={{ color: C.red }}>{centsToFee(due, inv.currency)}</strong> due</span>}
            {(inv.aid_applied_cents ?? 0) > 0 && <span><strong style={{ color: C.ink }}>{centsToFee(inv.aid_applied_cents, inv.currency)}</strong> aid applied</span>}
          </p>
        </div>
      )}

      {(real.length > 0 || abandoned > 0) && (
        <ul className="mt-2">
          {real.map(p => <PaymentLine key={p.id} p={p} accessToken={accessToken} />)}
          {abandoned > 0 && (
            <li className="flex items-center gap-2" style={{ padding: '8px 0', borderTop: `1px dashed ${C.parchment}`, fontFamily: OUTFIT, fontSize: 12, color: C.inkSoft }}>
              <CircleDashed size={14} aria-hidden />
              {abandoned} card {abandoned === 1 ? 'checkout was' : 'checkouts were'} started and not finished. No money moved.
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

export default function PaymentTab({
  app, ledger, totals, loading, refreshing, error, onReload, accessToken, conferenceSlug, paymentControls, feeCharged, aid,
}: {
  app: ApplicantApp;
  ledger: Ledger | undefined;
  totals: LedgerTotals | null;
  loading: boolean;
  refreshing: boolean;
  error: string | undefined;
  onReload: () => void;
  accessToken: string | null;
  conferenceSlug: string;
  paymentControls: ReactNode;
  feeCharged: boolean;
  aid: AidInfo | null;
}) {
  const aidTint = aid?.status === 'approved' ? C.forestLight : aid?.status === 'denied' ? C.inkSoft : C.amber;
  return (
    <div className="flex flex-col" style={{ gap: 24 }}>
      <div className="flex items-center gap-2 flex-wrap">
        {paymentControls}
        <span className="flex-1" />
        <button
          type="button"
          onClick={onReload}
          disabled={loading || refreshing}
          aria-label="Refresh payments"
          title="Refresh payments"
          className="inline-flex items-center justify-center focus:outline-none"
          style={{ width: 34, height: 34, borderRadius: 999, border: `1.5px solid ${C.parchment}`, background: C.cream, color: C.forest, cursor: 'pointer' }}
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : undefined} aria-hidden />
        </button>
        <Link
          href={`/manage/${conferenceSlug}/financials/invoices`}
          className="inline-flex items-center gap-1 focus:outline-none"
          style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 800, color: C.forest, textDecoration: 'none' }}
        >
          Financials <ArrowUpRight size={14} aria-hidden />
        </Link>
      </div>

      {error ? (
        <ErrorLine text={error} onRetry={onReload} />
      ) : loading || !ledger ? (
        <Spinner label="Reading their payments" />
      ) : ledger.invoices.length === 0 ? (
        <Empty
          icon={Landmark}
          title={feeCharged ? 'No invoice yet' : 'Nothing to pay'}
          body={feeCharged ? 'An invoice appears once their role fee applies to them.' : 'This role is free at this conference.'}
        />
      ) : (
        <>
          {totals && <MoneyStrip totals={totals} />}
          {totals && totals.pendingProofs > 0 && (
            <p className="inline-flex items-center gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: C.inkSoft }}>
              <Clock size={14} style={{ color: C.amber }} aria-hidden />
              Proofs are approved or rejected in
              <Link href={`/manage/${conferenceSlug}/financials/invoices`} style={{ color: C.forest, fontWeight: 800 }}>Financials</Link>.
            </p>
          )}
          <section aria-labelledby="apd-invoices">
            <SectionTitle icon={Receipt} tint={C.goldDeep} aside={`${ledger.invoices.length} ${ledger.invoices.length === 1 ? 'invoice' : 'invoices'}`}>
              <span id="apd-invoices">Invoices</span>
            </SectionTitle>
            <ul className="flex flex-col" style={{ gap: 12 }}>
              {ledger.invoices.map(inv => <InvoiceCard key={inv.id} inv={inv} appId={app.id} accessToken={accessToken} />)}
            </ul>
          </section>
        </>
      )}

      {aid && (
        <section aria-labelledby="apd-aid" style={{ padding: '14px 16px', borderRadius: 18, border: `1.5px solid ${aidTint}55`, background: `${aidTint}0F` }}>
          <SectionTitle
            icon={HeartHandshake}
            tint={aidTint}
            aside={aid.status ? <span style={{ color: aidTint, fontWeight: 800 }}>{aid.status.charAt(0).toUpperCase() + aid.status.slice(1)}</span> : undefined}
          >
            <span id="apd-aid">Financial aid</span>
          </SectionTitle>
          {aid.requestedAmount != null && (
            <p style={{ fontFamily: OUTFIT, fontSize: 13, color: C.ink, ...NUM }}>
              Asked for <strong>{formatFee(aid.requestedAmount, aid.currency)}</strong>
              {aid.status === 'approved' && aid.grantedAmount != null && <> · granted <strong>{formatFee(aid.grantedAmount, aid.currency)}</strong></>}
            </p>
          )}
          <p className="mt-1.5 whitespace-pre-wrap" style={{ fontFamily: OUTFIT, fontSize: 13.5, lineHeight: 1.6, color: aid.statement ? C.ink : C.inkSoft, fontStyle: aid.statement ? 'normal' : 'italic', overflowWrap: 'anywhere', maxWidth: '68ch' }}>
            {aid.statement || 'No statement given.'}
          </p>
          <p className="mt-2" style={{ fontFamily: OUTFIT, fontSize: 12, color: C.inkSoft }}>
            Decide on it in <Link href={`/manage/${conferenceSlug}/financial-aid`} style={{ color: C.forest, fontWeight: 800 }}>Financial aid</Link>.
          </p>
        </section>
      )}
    </div>
  );
}
