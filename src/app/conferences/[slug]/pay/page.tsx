'use client';

// /conferences/[slug]/pay — Conference Payments (rebuilt in prompt 95).
// One screen answers "what do I owe, for what, and how do I pay it":
//   BalanceHeader   To pay (by type), Paid, Waiting for review
//   ItemList        every item with its state in words; tick to pay, X to remove
//   PayBar          the ticked items and one Pay button, pinned to the bottom
//   ReceiptsList    every payment as a receipt
//   ActionsColumn   only the actions that apply (aid, add-ons, tickets, credits)
// Everything shown comes from my_pay_overview (payApi.ts). Card payments run
// inside Gavelling (CardPayPopup); manual conferences keep the proof upload
// (payPanels.tsx) until prompt 96 replaces it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AuthLink from '@/components/auth/AuthLink';
import SiteNav from '@/components/SiteNav';
import Loader from '@/components/Loader';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { activePhaseFee } from '@/lib/finance';
import type { InvoiceRow } from '@/lib/invoices';
import { themeCssVars } from '@/lib/theme';
import { friendlyError } from '@/lib/friendlyError';
import { GoldWord } from '@/components/BrandHeading';
import { statusPriority } from '../participant/shared';
import {
  PaymentsNotSetUp,
  type ActiveAddon, type AidRequestRow, type PayConference, type PayRoleConfig,
} from './payPanels';
import { PAY_CSS, INK, INK_SOFT } from './payKit';
import { money, readPayOverview, removeAddon, removePledgedTicket, type PayItem, type PayOverview } from './payApi';
import BalanceHeader from './BalanceHeader';
import ItemList, { canTick } from './ItemList';
import PayBar from './PayBar';
import CardPayPopup from './CardPayPopup';
import ReceiptsList, { ReceiptPopup } from './ReceiptsList';
import ActionsColumn from './ActionsColumn';
import VoucherPanel from './VoucherPanel';
import { useSettleWait, SLOW_LINE, WAITING_LINE } from './settleWait';
import { cancelStartedPayment, proofLink, readStarted, startManualPayment, type StartedInfo, type StartedPayment } from './manualApi';
import ManualPayPopup, { type ManualMode } from './ManualPayPopup';
import StartedPayments from './StartedPayments';
import { LockPopup, NotReceivedPopup, RefundRequestPopup } from './SmallPopups';
import { readMyDocs, receiptFor, type MyDocs } from './payDocsApi';
import { DocViewPopup, DocumentsSection, MakeDocPopup, PAYDOCS_CSS, downloadById, type MakePreset } from './PayDocuments';

const INVOICE_SELECT = 'id, conference_id, kind, label, amount_cents, amount_paid_cents, currency, status, gates_acceptance, payable_before_acceptance, application_id, society_id, config_id, aid_applied_cents, quantity, created_at';

type RoleConfigRow = PayRoleConfig & { is_enabled: boolean | null };

export default function PayPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { user, session, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [conference, setConference] = useState<PayConference | null>(null);
  const [overview, setOverview] = useState<PayOverview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [roleConfigs, setRoleConfigs] = useState<RoleConfigRow[]>([]);
  const [addons, setAddons] = useState<ActiveAddon[]>([]);
  const [aidRequest, setAidRequest] = useState<AidRequestRow | null>(null);
  const [addonInvoices, setAddonInvoices] = useState<InvoiceRow[]>([]);
  const [attempt, setAttempt] = useState(0);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState('');
  const [paying, setPaying] = useState<'card' | null>(null);
  // Manual conferences (prompt 96): started payments, the pay / proof pop-up, locks, refunds.
  const [started, setStarted] = useState<StartedInfo | null>(null);
  const [manualPop, setManualPop] = useState<{ batchId: string; totalCents: number; currency: string; mode: ManualMode } | null>(null);
  const [lockFor, setLockFor] = useState<{ batchId: string; mine: boolean } | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [refundAsk, setRefundAsk] = useState<{ preselect: string | null } | null>(null);
  const [notReceived, setNotReceived] = useState<PayItem | null>(null);
  const [startBusy, setStartBusy] = useState(false);
  const [receiptKey, setReceiptKey] = useState<string | null>(null);
  const [returnWait, setReturnWait] = useState(false);
  // Invoices and receipts (prompt 98): nothing shows until the conference has its invoice details.
  const [myDocs, setMyDocs] = useState<MyDocs | null>(null);
  const [docsAttempt, setDocsAttempt] = useState(0);
  const [makeDoc, setMakeDoc] = useState<{ preset: MakePreset | null } | null>(null);
  const [viewDoc, setViewDoc] = useState<string | null>(null);
  const [docBusy, setDocBusy] = useState<string | null>(null);
  const [receiptPdfErr, setReceiptPdfErr] = useState('');
  const [docListErr, setDocListErr] = useState('');

  // ?payment=success&session_id: back from 3-D Secure, wait for the webhook.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    if (q.get('payment') !== 'success') return;
    void Promise.resolve().then(() => setReturnWait(true));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) { void Promise.resolve().then(() => setLoading(false)); return; }
    let cancelled = false;
    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data: confData } = await supabase
        .from('conferences')
        .select(`
          id, full_name, acronym, fee_currency, contact_email,
          payment_method, connect_onboarding_status, platform_collects, external_payment_url, external_payment_note,
          financial_aid_enabled, aid_questions, aid_intro, theme
        `)
        .eq('slug', slug)
        .single();
      if (cancelled) return;
      if (!confData) { setLoading(false); return; }
      const conf = confData as PayConference;
      setConference(conf);

      // Same sync as before: whatever this person newly owes is created first.
      const { data: appsData } = await supabase
        .from('applications').select('id, role, status, society_id')
        .eq('conference_id', conf.id).eq('user_id', user.id);
      const apps = (appsData ?? []) as { id: string; role: string; status: string; society_id: string | null }[];
      // No application here: nothing to read, the "No application on file" card says so.
      if (apps.length === 0) { setOverview(null); setLoading(false); return; }
      for (const a of apps.filter(x => x.status !== 'rejected' && x.status !== 'withdrawn')) {
        await supabase.rpc('sync_participant_invoices', { p_application_id: a.id });
      }
      if (cancelled) return;

      try {
        const [o, st, rc, ad] = await Promise.all([
          readPayOverview(conf.id),
          readStarted(conf.id).catch(() => ({ manual: false, payments: [], locked: {} }) as StartedInfo),
          supabase.from('application_role_configs').select('role, fee_amount, fee_currency, fee_phases, payment_timing, is_enabled').eq('conference_id', conf.id),
          supabase.from('addons').select('id, label, description, amount_cents, currency').eq('conference_id', conf.id).eq('active', true),
        ]);
        if (cancelled) return;
        setOverview(o);
        setStarted(st);
        setLoadError('');
        setRoleConfigs((rc.data as RoleConfigRow[]) ?? []);
        setAddons((ad.data as ActiveAddon[]) ?? []);
        const primary = [...o.me].sort((a, b) => statusPriority(a.status) - statusPriority(b.status))[0];
        if (primary) {
          const [aidRes, invRes] = await Promise.all([
            supabase.from('financial_aid_requests').select('status, granted_amount')
              .eq('application_id', primary.application_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
            supabase.from('invoices').select(INVOICE_SELECT).eq('application_id', primary.application_id).neq('status', 'void'),
          ]);
          if (cancelled) return;
          setAidRequest((aidRes.data as AidRequestRow | null) ?? null);
          setAddonInvoices((invRes.data as InvoiceRow[]) ?? []);
        }
      } catch (e) {
        if (!cancelled) setLoadError(friendlyError(e, 'Your payments could not be read. Try again in a moment.'));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, authLoading, user?.id, session?.access_token, attempt]);

  const reload = useCallback(() => setAttempt(a => a + 1), []);

  const docsConfId = conference?.id ?? null;
  useEffect(() => {
    if (!docsConfId || !user) return;
    let alive = true;
    // A failed read only hides the documents; paying is never blocked by it.
    readMyDocs(docsConfId).then(d => { if (alive) setMyDocs(d); }).catch(() => { if (alive) setMyDocs(null); });
    return () => { alive = false; };
  }, [docsConfId, user, docsAttempt, attempt]);

  // ?doc=<id> (the "Send to payer" email's link) opens that document once.
  const docParamDone = useRef(false);
  useEffect(() => {
    if (docParamDone.current || typeof window === 'undefined') return;
    const id = new URLSearchParams(window.location.search).get('doc');
    if (!id) return;
    docParamDone.current = true;
    void Promise.resolve().then(() => setViewDoc(id));
  }, []);

  const wait = useSettleWait(returnWait && !!conference, async () => {
    if (!conference) return false;
    const o = await readPayOverview(conference.id);
    setOverview(o);
    const recent = Date.now() - 15 * 60 * 1000;
    const nothingPending = !o.items.some(i => i.state === 'unpaid' && selected.has(i.invoice_id));
    return nothingPending && o.payments.some(p => p.how === 'card' && new Date(p.at).getTime() >= recent);
  });
  useEffect(() => {
    if (wait !== 'done' && wait !== 'gave_up') return;
    void Promise.resolve().then(() => {
      setReturnWait(false);
      setSelected(new Set());
      reload();
      const url = new URL(window.location.href);
      if (url.searchParams.has('payment')) {
        url.searchParams.delete('payment'); url.searchParams.delete('session_id');
        window.history.replaceState(window.history.state, '', url.pathname + (url.search || '') + url.hash);
      }
    });
  }, [wait, reload]);

  const items = useMemo(() => overview?.items ?? [], [overview]);
  const tickable = items.filter(i => canTick(i, started?.locked));
  const chosen = items.filter(i => selected.has(i.invoice_id));
  const chosenCur = chosen[0]?.currency ?? overview?.conference.currency ?? 'USD';
  const chosenTotal = chosen.reduce((s, i) => s + i.due_cents, 0);

  const toggle = (it: PayItem) => {
    setNotice('');
    const next = new Set(selected);
    if (next.has(it.invoice_id)) { next.delete(it.invoice_id); setSelected(next); return; }
    if (chosen.length > 0 && it.currency.toUpperCase() !== chosenCur.toUpperCase()) {
      setNotice('Items in different currencies are paid separately');
      return;
    }
    next.add(it.invoice_id);
    setSelected(next);
  };
  const selectAll = () => {
    setNotice('');
    const cur = (chosen[0] ?? tickable[0])?.currency;
    const same = tickable.filter(i => i.currency === cur);
    if (same.length < tickable.length) setNotice('Items in different currencies are paid separately');
    setSelected(new Set(same.map(i => i.invoice_id)));
  };

  if (!conference || !overview) {
    return (
      <Frame theme={conference?.theme} slug={slug}>
        {authLoading || loading ? (
          <div className="flex items-center justify-center py-24"><Loader size={72} label="Loading payment details" /></div>
        ) : !user ? (
          <div className="gv-pay-card" style={{ padding: 32, textAlign: 'center' }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>Sign in to continue</p>
            <p className="gv-pay-quiet" style={{ marginTop: 6 }}>You need to be signed in to pay or request financial aid</p>
            <AuthLink next={`/conferences/${slug}/pay`} className="gv-pay-btn gv-pay-forest" style={{ marginTop: 16 }}>Sign in</AuthLink>
          </div>
        ) : loadError ? (
          <div className="gv-pay-card" style={{ padding: 28 }}>
            <p className="gv-pay-err" role="alert">{loadError}</p>
            <button type="button" className="gv-pay-link" style={{ marginTop: 10 }} onClick={() => { setLoading(true); setLoadError(''); reload(); }}>Try again</button>
          </div>
        ) : (
          <div className="gv-pay-card" style={{ padding: 32, textAlign: 'center' }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{conference ? 'No application on file' : 'Conference not found'}</p>
            {conference && <p className="gv-pay-quiet" style={{ marginTop: 6 }}>You need an application to this conference before you can pay</p>}
          </div>
        )}
      </Frame>
    );
  }

  const c = overview.conference;
  const primary = [...overview.me].sort((a, b) => statusPriority(a.status) - statusPriority(b.status))[0] ?? null;
  const leaderMe = overview.me.find(m => m.is_leader && m.society_id) ?? null;
  const roleCfg = (role: string) => roleConfigs.find(r => r.role === role) ?? null;
  const canPay = c.ready && !!c.method;

  // The voucher discount on the person's own ticket, as the old page worked it out.
  const ownTicket = items.find(i => i.kind === 'role_fee' && i.owner_is_me);
  const primaryCfg = primary ? roleCfg(primary.role) : null;
  const { amount: phaseFee } = activePhaseFee({ fee_amount: primaryCfg?.fee_amount ?? 0, fee_phases: primaryCfg?.fee_phases ?? null });
  const granted = aidRequest?.status === 'approved' ? (aidRequest.granted_amount ?? 0) : 0;
  const preVoucher = Math.round(Math.max(0, (phaseFee ?? 0) - granted) * 100);
  const discount = ownTicket && ownTicket.paid_cents === 0 ? Math.max(0, preVoucher - ownTicket.amount_cents) : 0;

  const onRemove = async (it: PayItem): Promise<string | null> => {
    const r = it.kind === 'addon'
      ? (primary ? await removeAddon(primary.application_id, it.invoice_id) : { ok: false as const, error: 'This add-on could not be removed.' })
      : await removePledgedTicket(it.invoice_id);
    if (!r.ok) return r.error;
    setSelected(prev => { const n = new Set(prev); n.delete(it.invoice_id); return n; });
    reload();
    return null;
  };

  const receipt = receiptKey ? overview.payments.find(p => p.key === receiptKey) ?? null : null;
  const manual = c.method === 'manual';

  // Manual: start (or resume) a payment for these items, then the proof pop-up.
  const startManual = async (ids: string[], mode: ManualMode) => {
    if (startBusy || ids.length === 0) return;
    setStartBusy(true); setNotice('');
    const r = await startManualPayment(ids);
    setStartBusy(false);
    if (!r.ok) {
      if (r.code === 'item_in_started_payment' && r.startedBatchId) {
        const mine = !!started?.payments.some(p => p.batch_id === r.startedBatchId);
        setLockFor({ batchId: r.startedBatchId, mine });
      } else setNotice(r.error);
      return;
    }
    setManualPop({ batchId: r.batchId, totalCents: r.totalCents, currency: r.currency, mode });
    setSelected(new Set());
    reload();
  };

  const openLock = (invoiceId: string) => {
    const l = started?.locked[invoiceId];
    if (l) setLockFor({ batchId: l.batch_id, mine: l.mine });
  };

  const viewProof = async (path: string) => {
    const w = window.open('', '_blank');
    if (w) w.opener = null;
    const url = await proofLink(path);
    if (!url) { w?.close(); setNotice('The proof could not be opened. Try again in a moment.'); return; }
    if (w) w.location.href = url; else window.open(url, '_blank', 'noopener');
  };

  const onCancelStarted = async (p: StartedPayment): Promise<string | null> => {
    const r = await cancelStartedPayment(p.batch_id);
    if (!r.ok) return r.error;
    reload();
    return null;
  };

  const refundable = items.filter(i => i.state === 'paid' && i.can_request_refund);

  const docsReady = !!myDocs?.settings_ready;
  const openForInvoice = items.filter(i => i.due_cents > 0 && i.state !== 'covered' && i.state !== 'waived');
  const downloadDoc = async (id: string, onError: (msg: string) => void) => {
    if (docBusy) return;
    setDocBusy(id);
    const problem = await downloadById(id);
    setDocBusy(null);
    if (problem) onError(problem);
  };
  const receiptPdf = () => {
    if (!receipt || !myDocs) return;
    setReceiptPdfErr('');
    const existing = receiptFor(myDocs.documents, receipt.key);
    if (existing) { void downloadDoc(existing.document_id, setReceiptPdfErr); return; }
    setReceiptKey(null);
    setMakeDoc({ preset: { kind: 'receipt', keys: [receipt.key] } });
  };
  const closeViewDoc = () => {
    setViewDoc(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has('doc')) {
      url.searchParams.delete('doc');
      window.history.replaceState(window.history.state, '', url.pathname + (url.search || '') + url.hash);
    }
  };

  return (
    <Frame theme={conference.theme} slug={slug}>
      <h1 style={{ margin: 0, fontSize: 'clamp(28px, 3vw, 36px)', fontWeight: 900, letterSpacing: '-0.02em', color: INK }}>
        Conference <GoldWord tone="light">Payments</GoldWord>
      </h1>
      <p style={{ margin: '4px 0 22px', fontSize: 15, color: INK_SOFT, overflowWrap: 'anywhere' }}>{c.full_name}</p>

      {(wait === 'waiting' || wait === 'slow') && (
        <div className="gv-pay-card" role="status" style={{ marginBottom: 16, padding: '14px 18px', fontSize: 15, fontWeight: 700 }}>
          {wait === 'slow' ? SLOW_LINE : WAITING_LINE}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <div className="flex flex-col gap-5" style={{ minWidth: 0 }}>
          <BalanceHeader o={overview} />
          {!canPay && <PaymentsNotSetUp contactEmail={c.contact_email} />}
          <ItemList
            items={items}
            selected={selected}
            onToggle={toggle}
            onReceipt={setReceiptKey}
            onRemove={onRemove}
            locked={started?.locked}
            onLock={openLock}
            onRequestRefund={(it) => setRefundAsk({ preselect: it.invoice_id })}
            onNotReceived={setNotReceived}
            onViewProof={(path) => { void viewProof(path); }}
            below={(it) => (it.kind === 'role_fee' && it.owner_is_me && primary && (it.state === 'unpaid' || it.state === 'rejected'))
              ? <VoucherPanel conferenceId={c.id} applicationId={primary.application_id} discountCents={discount} currency={it.currency} onChanged={reload} />
              : null}
          />
          {canPay && tickable.length > 0 && (
            <PayBar
              count={chosen.length}
              totalLabel={money(chosenTotal, chosenCur)}
              allTicked={chosen.length > 0 && chosen.length >= tickable.filter(i => i.currency === chosenCur).length}
              onSelectAll={selectAll}
              onClear={() => { setSelected(new Set()); setNotice(''); }}
              onPay={() => { if (manual) void startManual(chosen.map(i => i.invoice_id), 'pay'); else setPaying('card'); }}
              busy={paying !== null || startBusy}
              notice={notice}
              extra={manual ? (
                <button type="button" className="gv-pay-btn gv-pay-outline" disabled={startBusy}
                  title="Already paid? Tick the items you paid for, then upload your proof"
                  onClick={() => {
                    if (chosen.length === 0) { setNotice('Tick the items you paid for first'); return; }
                    void startManual(chosen.map(i => i.invoice_id), 'upload');
                  }}>
                  Upload proof
                </button>
              ) : undefined}
            />
          )}
          {canPay && manual && started && (
            <StartedPayments
              payments={started.payments}
              highlight={highlight}
              onUpload={(p) => setManualPop({ batchId: p.batch_id, totalCents: p.total_cents, currency: p.currency, mode: 'upload' })}
              onDetails={(p) => setManualPop({ batchId: p.batch_id, totalCents: p.total_cents, currency: p.currency, mode: 'details' })}
              onCancel={onCancelStarted}
              onViewProof={(path) => { void viewProof(path); }}
              onReplace={(p) => setManualPop({ batchId: p.batch_id, totalCents: p.total_cents, currency: p.currency, mode: 'replace' })}
              onRestart={(p) => { void startManual(p.items.map(i => i.invoice_id), 'upload'); }}
            />
          )}
          <ReceiptsList payments={overview.payments} onOpen={key => { setReceiptPdfErr(''); setReceiptKey(key); }} />
          {docsReady && myDocs && (
            <DocumentsSection
              docs={myDocs.documents}
              canMake={overview.payments.length > 0 || openForInvoice.length > 0}
              onMake={() => setMakeDoc({ preset: null })}
              onOpen={setViewDoc}
              onDownload={id => { setDocListErr(''); void downloadDoc(id, setDocListErr); }}
              downloading={docBusy}
              error={docListErr}
            />
          )}
        </div>

        {primary && (
          <ActionsColumn
            conference={conference}
            aidOpen={c.aid_open}
            primaryAppId={primary.application_id}
            leader={leaderMe ? { id: leaderMe.application_id, society_id: leaderMe.society_id as string } : null}
            addons={addons}
            addonInvoices={addonInvoices}
            delegateConfig={roleCfg('delegate')}
            advisorConfig={roleCfg('faculty-advisor')}
            delegateOpen={!!roleCfg('delegate')?.is_enabled}
            advisorOpen={!!roleCfg('faculty-advisor')?.is_enabled}
            aidRequest={aidRequest}
            currency={c.currency}
            onChanged={reload}
            onAidSubmitted={reload}
          />
        )}
      </div>

      {paying === 'card' && (
        <CardPayPopup
          conferenceId={c.id}
          conferenceName={c.full_name}
          invoiceIds={chosen.map(i => i.invoice_id)}
          totalLabel={money(chosenTotal, chosenCur)}
          onClose={(stillWaiting) => { setPaying(null); if (stillWaiting) setReturnWait(true); else reload(); }}
          onSettled={() => { setPaying(null); setSelected(new Set()); reload(); }}
        />
      )}

      {manualPop && (
        <ManualPayPopup
          conference={c}
          batchId={manualPop.batchId}
          totalCents={manualPop.totalCents}
          currency={manualPop.currency}
          mode={manualPop.mode}
          onClose={() => { setManualPop(null); reload(); }}
          onDone={() => { setManualPop(null); reload(); }}
        />
      )}
      {lockFor && (
        <LockPopup
          mine={lockFor.mine}
          onClose={() => setLockFor(null)}
          onGo={() => {
            const id = lockFor.batchId;
            setLockFor(null);
            setHighlight(id);
            setTimeout(() => setHighlight(h => (h === id ? null : h)), 3500);
          }}
        />
      )}
      {refundAsk && refundable.length > 0 && (
        <RefundRequestPopup items={refundable} preselect={refundAsk.preselect} onClose={() => setRefundAsk(null)} onDone={() => { setRefundAsk(null); reload(); }} />
      )}
      {notReceived && (
        <NotReceivedPopup item={notReceived} onClose={() => setNotReceived(null)} onDone={() => { setNotReceived(null); reload(); }} />
      )}

      {receipt && (
        <ReceiptPopup
          payment={receipt}
          conferenceName={c.full_name}
          onClose={() => setReceiptKey(null)}
          pdf={docsReady ? { busy: docBusy !== null, error: receiptPdfErr, onDownload: receiptPdf } : null}
        />
      )}
      {(makeDoc || viewDoc) && <style>{PAYDOCS_CSS}</style>}
      {makeDoc && docsReady && myDocs && (
        <MakeDocPopup
          conferenceId={c.id}
          payments={overview.payments}
          openItems={openForInvoice}
          billing={myDocs.billing}
          preset={makeDoc.preset}
          onClose={() => setMakeDoc(null)}
          onMade={() => setDocsAttempt(a => a + 1)}
        />
      )}
      {viewDoc && <DocViewPopup documentId={viewDoc} onClose={closeViewDoc} />}
    </Frame>
  );
}

function Frame({ theme, slug, children }: { theme: PayConference['theme'] | undefined; slug: string; children: React.ReactNode }) {
  return (
    <div className="gv-pay min-h-screen flex flex-col" style={{ ...themeCssVars(theme ?? {}), backgroundColor: '#EDE7D8' }}>
      <style>{PAY_CSS}</style>
      <SiteNav />
      <div className="flex-1 w-full max-w-[1120px] mx-auto px-4 sm:px-6 pt-8 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        <Link href={`/conferences/${slug}/role`} className="gv-pay-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18, fontSize: 13.5 }}>
          <ArrowLeft size={15} strokeWidth={2.4} aria-hidden /> Back to conference
        </Link>
        {children}
      </div>
    </div>
  );
}
