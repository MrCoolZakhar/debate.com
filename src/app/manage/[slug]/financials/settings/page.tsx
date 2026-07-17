'use client';

/**
 * Financials Settings — Onboard payments (Stripe Connect + manual payment
 * page, mutually-exclusive active method, each keeps its own setup dormant
 * while inactive, see src/lib/payments.ts's isPaymentsLive()) plus voucher
 * management underneath. No payment writes happen elsewhere on financials;
 * marking paid stays on the Applications page.
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  CircleCheck, CreditCard, Receipt, TriangleAlert, Wallet,
} from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { extractFunctionErrorMessage, isStripeCountrySupported } from '@/lib/payments';
import { FlagImg } from '@/components/FlagImg';
import { getCountryByName, UN_COUNTRIES } from '@/lib/countries';
import { PillToggle } from '@/app/account/accountUi';
import {
  NEU, NEU_GRADIENTS, OUTFIT,
  NeuCard, NeuButton, NeuIconDisc,
  type NeuGradient,
} from '@/components/neu';
import {
  type ConnectStatus, inputStyle, fieldLabelStyle, MAX_PAYMENT_NOTE_LENGTH, mutedCaption,
  useFinancialsCurrency,
} from '../shared';
import VouchersSection from '../VouchersSection';

const stepLabelStyle: React.CSSProperties = {
  fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
  color: NEU.muted, textTransform: 'uppercase',
};

const backLinkStyle: React.CSSProperties = {
  border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
  fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700,
  color: NEU.muted, textDecoration: 'underline', textUnderlineOffset: 3,
};

/** Collapsible row for the steady-state (State B) method list. Exactly one of
 *  the two is ever active — clicking the active row's toggle is a no-op,
 *  only the inactive toggle can act (and it always activates, never
 *  deactivates), so payment_method can never fall back to null. */
function MethodRow({
  active, disabled = false, onActivate, gradient, icon: Icon, title, children,
}: {
  active: boolean;
  disabled?: boolean;
  onActivate: () => void;
  gradient: NeuGradient;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <NeuCard style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: active ? 14 : 0 }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <NeuIconDisc gradient={gradient} icon={Icon} size={38} />
          <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14.5, color: NEU.ink }}>{title}</p>
        </div>
        <PillToggle value={active} onChange={() => { if (!active && !disabled) onActivate(); }} />
      </div>
      {active && <div className="flex flex-col gap-3">{children}</div>}
    </NeuCard>
  );
}

export default function FinancialsSettingsPage() {
  const { conference, refreshConferenceQuiet } = useManage();
  const { session } = useAuth();
  const router = useRouter();
  const { displayCurrency } = useFinancialsCurrency();

  // ── Stripe Connect payouts card ──────────────────────────────────────────
  const [connectStatus, setConnectStatus] = useState<ConnectStatus>('none');
  const [connectBusy, setConnectBusy] = useState<'start' | 'status' | null>(null);
  const [connectError, setConnectError] = useState('');

  useEffect(() => {
    if (!conference) return;
    const s = conference.connect_onboarding_status;
    setConnectStatus(s === 'pending' || s === 'complete' ? s : 'none');
  }, [conference?.connect_onboarding_status]);

  // ?connect=return|refresh, the redirect back from Stripe's hosted
  // onboarding flow: check status once, then strip the param so a refresh
  // doesn't re-fire it.
  useEffect(() => {
    if (!conference || !session) return;
    const connectParam = new URLSearchParams(window.location.search).get('connect');
    if (connectParam !== 'return' && connectParam !== 'refresh') return;
    (async () => {
      const supabase = await getFreshAuthedClient();
      if (supabase) {
        const { data } = await supabase.functions.invoke('connect-onboard', {
          body: { conferenceId: conference.id, action: 'status' },
        });
        const result = data as { ok?: boolean; status?: ConnectStatus } | null;
        if (result?.ok && result.status) {
          setConnectStatus(result.status);
          refreshConferenceQuiet();
        }
      }
      router.replace(`/manage/${conference.slug}/financials/settings`);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conference?.id, session?.access_token]);

  async function startConnectOnboarding(overrideCountryCode?: string) {
    if (!conference || connectBusy) return;
    setConnectBusy('start');
    setConnectError('');
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setConnectBusy(null);
      setConnectError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const countryCode = overrideCountryCode || getCountryByName(conference.country)?.code;
    const { data, error } = await supabase.functions.invoke('connect-onboard', {
      body: {
        conferenceId: conference.id,
        action: 'start',
        ...(countryCode ? { country: countryCode } : {}),
      },
    });
    if (error) {
      setConnectBusy(null);
      setConnectError(await extractFunctionErrorMessage(error));
      return;
    }
    const result = data as { ok?: boolean; url?: string; error?: string } | null;
    if (!result?.ok || !result.url) {
      setConnectBusy(null);
      setConnectError(result?.error || 'Could not start onboarding. Please try again.');
      return;
    }
    window.location.assign(result.url);
  }

  async function checkConnectStatus() {
    if (!conference || connectBusy) return;
    setConnectBusy('status');
    setConnectError('');
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setConnectBusy(null);
      setConnectError('Your session has expired, please refresh and sign in again.');
      return;
    }
    const { data, error } = await supabase.functions.invoke('connect-onboard', {
      body: { conferenceId: conference.id, action: 'status' },
    });
    setConnectBusy(null);
    if (error) {
      setConnectError(await extractFunctionErrorMessage(error));
      return;
    }
    const result = data as { ok?: boolean; status?: ConnectStatus; error?: string } | null;
    if (!result?.ok || !result.status) {
      setConnectError(result?.error || 'Could not check status. Please try again.');
      return;
    }
    setConnectStatus(result.status);
    refreshConferenceQuiet();
  }

  // ── Onboard payments: payout-country picker (drives Stripe-vs-manual) ────
  // The bank-account country is independent of the conference's own
  // location (conference.country), so it gets its own persisted column.
  // Defaults to any previously-saved payout_country, else a best-effort
  // guess from the conference's general country field.
  const [payoutCountry, setPayoutCountry] = useState('');
  const [editingPayoutCountry, setEditingPayoutCountry] = useState(false);
  const [payoutCountrySaving, setPayoutCountrySaving] = useState(false);
  const allCountryOptions = useMemo(
    () => [...UN_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  useEffect(() => {
    if (!conference) return;
    setPayoutCountry(conference.payout_country || getCountryByName(conference.country)?.code || '');
  }, [conference?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function selectPayoutCountry(code: string) {
    if (!code || !conference) return;
    setPayoutCountry(code);
    setEditingPayoutCountry(false);
    setPayoutCountrySaving(true);
    const supabase = await getFreshAuthedClient();
    if (supabase) {
      await supabase.from('conferences').update({ payout_country: code }).eq('id', conference.id);
      refreshConferenceQuiet();
    }
    setPayoutCountrySaving(false);
  }

  // ── Active payment method: 'stripe' | 'manual', mutually exclusive but each
  // keeps its own setup (Stripe account, payment link/note) dormant while
  // inactive, so switching back and forth is a single write, never a re-setup.
  const [activeMethod, setActiveMethodState] = useState<string | null>(null);

  useEffect(() => {
    if (!conference) return;
    setActiveMethodState(conference.payment_method ?? null);
  }, [conference?.payment_method]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setActiveMethod(method: 'stripe' | 'manual') {
    if (!conference) return;
    setActiveMethodState(method);
    const supabase = await getFreshAuthedClient();
    if (supabase) {
      await supabase.from('conferences').update({ payment_method: method }).eq('id', conference.id);
      refreshConferenceQuiet();
    }
  }

  // ── First-time onboarding wizard (State A) ──────────────────────────────
  // 0 = intro card (not yet entered), 1-4 = the stepped flow. Stays mounted
  // through step 4 even after activeMethod gets set mid-flow (manual setup
  // sets it on "Complete setup"), so the success screen still shows — the
  // page only falls through to the steady state (State B) once the wizard
  // is explicitly exited back to step 0.
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardMethod, setWizardMethod] = useState<'stripe' | 'manual' | null>(null);
  const showWizard = activeMethod === null || wizardStep > 0;

  // ── Own payment page (manual-payments fallback) ─────────────────────────
  const [paymentUrl, setPaymentUrl] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentUrlError, setPaymentUrlError] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentSaveError, setPaymentSaveError] = useState('');

  useEffect(() => {
    if (!conference) return;
    setPaymentUrl(conference.external_payment_url ?? '');
    setPaymentNote(conference.external_payment_note ?? '');
  }, [conference?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function savePaymentPage(): Promise<boolean> {
    if (!conference || paymentSaving) return false;
    const trimmedUrl = paymentUrl.trim();
    if (trimmedUrl && !trimmedUrl.startsWith('https://')) {
      setPaymentUrlError('The link must start with https://');
      return false;
    }
    setPaymentUrlError('');
    setPaymentSaveError('');
    setPaymentSaving(true);
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setPaymentSaving(false);
      setPaymentSaveError('Your session has expired, please refresh and sign in again.');
      return false;
    }
    const { data, error } = await supabase
      .from('conferences')
      .update({
        external_payment_url: trimmedUrl || null,
        external_payment_note: paymentNote.trim() || null,
        // Saving the manual payment page also makes manual the active method
        // — one write, no separate "switch" step needed right after saving.
        payment_method: 'manual',
      })
      .eq('id', conference.id)
      .select('id');
    setPaymentSaving(false);
    if (error || !data || data.length === 0) {
      setPaymentSaveError('Could not save your payment page. Please try again.');
      return false;
    }
    setActiveMethodState('manual');
    refreshConferenceQuiet();
    return true;
  }

  if (!conference) return null;

  // Onboard payments: whether Stripe Connect is offered for the picked
  // payout country (gates the Stripe card), and its name for copy.
  const payoutStripeSupported = isStripeCountrySupported(payoutCountry);
  const payoutCountryName = allCountryOptions.find(c => c.code === payoutCountry)?.name ?? payoutCountry;
  const showPayoutCountryPicker = !payoutCountry || editingPayoutCountry;

  // Shared manual-payments form fields (link + instructions), reused by the
  // wizard's setup step and the steady-state Manual row.
  const manualFormFields = (
    <>
      <div>
        <label htmlFor="external-payment-url" style={fieldLabelStyle}>Payment page link · optional</label>
        <input
          id="external-payment-url"
          type="url"
          value={paymentUrl}
          onChange={e => { setPaymentUrl(e.target.value); if (paymentUrlError) setPaymentUrlError(''); }}
          placeholder="https://..."
          style={inputStyle}
        />
        {paymentUrlError && (
          <p className="mt-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, color: '#8B2020' }}>
            {paymentUrlError}
          </p>
        )}
      </div>
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <label htmlFor="external-payment-note" style={{ ...fieldLabelStyle, marginBottom: 0 }}>
            Payment instructions · optional
          </label>
          <span style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 700, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
            {paymentNote.length}/{MAX_PAYMENT_NOTE_LENGTH}
          </span>
        </div>
        <textarea
          id="external-payment-note"
          rows={2}
          maxLength={MAX_PAYMENT_NOTE_LENGTH}
          value={paymentNote}
          onChange={e => setPaymentNote(e.target.value.slice(0, MAX_PAYMENT_NOTE_LENGTH))}
          placeholder="UPI: yourconference@okaxis. Send your payment screenshot to treasurer@yourmun.org"
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
      </div>
      {paymentSaveError && (
        <p style={{ fontFamily: OUTFIT, fontSize: 11, color: '#8B2020' }}>
          {paymentSaveError}
        </p>
      )}
    </>
  );

  return (
    <>
      {/* Onboard payments — first-time wizard (State A) until a method is set, then the steady state (State B) */}
      {showWizard ? (
        <div className="mb-6 flex flex-col gap-4">
          {wizardStep === 0 && (
            <div
              className="rounded-[20px] px-5 py-5 flex items-center gap-4 flex-wrap"
              style={{
                background: 'linear-gradient(150deg, #16301F 0%, #1B3828 52%, #2A5A3C 100%)',
                boxShadow: '0 2px 8px rgba(27,56,40,0.14), 0 16px 40px rgba(27,56,40,0.22)',
              }}
            >
              <span
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{
                  width: 44, height: 44,
                  background: 'radial-gradient(circle at 50% 36%, rgba(238,217,138,0.34) 0%, rgba(27,56,40,0) 74%)',
                  border: '1.5px solid rgba(238,217,138,0.5)',
                }}
              >
                <Wallet size={20} strokeWidth={2} style={{ color: NEU.gold }} />
              </span>
              <div className="flex-1 min-w-[220px]">
                <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14, color: '#FAF8F3', lineHeight: 1.3 }}>
                  Onboard payments
                </p>
                <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: 'rgba(250,248,243,0.68)', lineHeight: 1.5 }}>
                  Choose how you get paid — takes about a minute, and applications can&apos;t open until it&apos;s done.
                </p>
              </div>
              <NeuButton gradient={NEU_GRADIENTS.gold} onClick={() => setWizardStep(1)}>
                FINANCIAL ONBOARDING
              </NeuButton>
            </div>
          )}

          {wizardStep === 1 && (
            <NeuCard style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={stepLabelStyle}>Step 1 of 3</p>
              <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 15, color: NEU.ink }}>
                Which country is your bank account in?
              </p>
              <select
                value={payoutCountry}
                onChange={e => selectPayoutCountry(e.target.value)}
                disabled={payoutCountrySaving}
                style={{
                  padding: '9px 12px', borderRadius: 12, border: 'none', outline: 'none',
                  backgroundColor: NEU.base, boxShadow: NEU.inSm, color: NEU.ink,
                  fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', minWidth: 220, alignSelf: 'flex-start',
                }}
              >
                <option value="">Select a country…</option>
                {allCountryOptions.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
              <div className="flex justify-end">
                <NeuButton gradient={NEU_GRADIENTS.forest} disabled={!payoutCountry} onClick={() => setWizardStep(2)}>
                  NEXT
                </NeuButton>
              </div>
            </NeuCard>
          )}

          {wizardStep === 2 && (
            <>
              <p style={stepLabelStyle}>Step 2 of 3</p>
              {!payoutStripeSupported && (
                <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted, lineHeight: 1.5 }}>
                  Stripe isn&apos;t available for {payoutCountryName} yet — continue with manual payments.
                </p>
              )}
              <div className={`grid grid-cols-1 ${payoutStripeSupported ? 'md:grid-cols-2' : ''} gap-4 items-stretch`}>
                {payoutStripeSupported && (
                  <NeuCard
                    hover
                    onClick={() => { setWizardMethod('stripe'); setWizardStep(3); }}
                    style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}
                  >
                    <div className="flex items-center gap-3">
                      <NeuIconDisc gradient={NEU_GRADIENTS.gold} icon={CreditCard} size={38} />
                      <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14.5, color: NEU.ink }}>
                        Stripe Payments
                      </p>
                    </div>
                    <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.ink, lineHeight: 1.6 }}>
                      Payments are processed automatically and marked paid on Gavelling instantly. Money lands directly in your own bank account — no manual tracking.
                    </p>
                    <p style={mutedCaption}>
                      Stripe&apos;s standard processing fee applies, since your conference is the merchant of record. Gavelling charges nothing.
                    </p>
                  </NeuCard>
                )}
                <NeuCard
                  hover
                  onClick={() => { setWizardMethod('manual'); setWizardStep(3); }}
                  style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  <div className="flex items-center gap-3">
                    <NeuIconDisc gradient={NEU_GRADIENTS.sage} icon={Receipt} size={38} />
                    <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14.5, color: NEU.ink }}>
                      Manual Payments
                    </p>
                  </div>
                  <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.ink, lineHeight: 1.6 }}>
                    A payment link is optional — paste one and delegates are redirected to it to pay, or just leave instructions and mark each payment as received yourself.
                  </p>
                  <p style={mutedCaption}>
                    No processing fee, but everything is tracked manually.
                  </p>
                </NeuCard>
              </div>
              <div>
                <button type="button" onClick={() => setWizardStep(1)} className="focus:outline-none" style={backLinkStyle}>
                  Back
                </button>
              </div>
            </>
          )}

          {wizardStep === 3 && wizardMethod === 'manual' && (
            <NeuCard style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={stepLabelStyle}>Step 3 of 3</p>
              <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 15, color: NEU.ink }}>
                Set up manual payments
              </p>
              <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, color: '#EED98A', backgroundColor: '#1B3828', borderRadius: 10, padding: '10px 12px', lineHeight: 1.5 }}>
                Running a free conference? Write &quot;This conference is free&quot; in the instructions — you still need a method set before applications can open.
              </p>
              {manualFormFields}
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setWizardStep(2)} className="focus:outline-none" style={backLinkStyle}>
                  Back
                </button>
                <NeuButton
                  gradient={NEU_GRADIENTS.forest}
                  disabled={paymentSaving}
                  onClick={async () => { if (await savePaymentPage()) setWizardStep(4); }}
                >
                  {paymentSaving ? 'SAVING…' : 'COMPLETE SETUP'}
                </NeuButton>
              </div>
            </NeuCard>
          )}

          {wizardStep === 3 && wizardMethod === 'stripe' && (
            <NeuCard style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={stepLabelStyle}>Step 3 of 3</p>
              <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 15, color: NEU.ink }}>
                Connect your Stripe account
              </p>
              <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.ink, lineHeight: 1.6 }}>
                You&apos;ll be redirected to Stripe to enter your bank and business details, then brought back here.
              </p>
              {connectError && (
                <p className="flex items-start gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, color: '#8B2020', lineHeight: 1.5 }}>
                  <TriangleAlert size={12} strokeWidth={2.4} style={{ marginTop: 2, flexShrink: 0 }} />
                  {connectError}
                </p>
              )}
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setWizardStep(2)} className="focus:outline-none" style={backLinkStyle}>
                  Back
                </button>
                <NeuButton
                  icon={CreditCard}
                  gradient={NEU_GRADIENTS.gold}
                  disabled={connectBusy !== null}
                  onClick={() => { startConnectOnboarding(payoutCountry); setActiveMethod('stripe'); }}
                >
                  {connectBusy === 'start' ? 'CONNECTING…' : 'CONNECT WITH STRIPE'}
                </NeuButton>
              </div>
            </NeuCard>
          )}

          {wizardStep === 4 && (
            <NeuCard style={{ padding: '32px 26px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
              <NeuIconDisc gradient={NEU_GRADIENTS.green} icon={CircleCheck} size={48} />
              <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 16, color: NEU.ink }}>
                Payments are set up.
              </p>
              <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted, lineHeight: 1.6, maxWidth: 360 }}>
                You&apos;re ready to start accepting applications.
              </p>
              <NeuButton
                gradient={NEU_GRADIENTS.gold}
                onClick={() => router.push(`/manage/${conference.slug}/settings`)}
                style={{ marginTop: 8 }}
              >
                SET UP APPLICATIONS
              </NeuButton>
              <button type="button" onClick={() => setWizardStep(0)} className="focus:outline-none" style={{ ...backLinkStyle, marginTop: 4 }}>
                Back to Financial settings
              </button>
            </NeuCard>
          )}
        </div>
      ) : (
        <div className="mb-6 flex flex-col gap-4">
          {/* Banking-country row, always present and editable */}
          <div
            className="rounded-[20px] px-5 py-4"
            style={{
              background: 'linear-gradient(150deg, #16301F 0%, #1B3828 52%, #2A5A3C 100%)',
              boxShadow: '0 2px 8px rgba(27,56,40,0.14), 0 16px 40px rgba(27,56,40,0.22)',
            }}
          >
            <div className="flex items-center gap-4 flex-wrap">
              <span
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{
                  width: 44, height: 44,
                  background: 'radial-gradient(circle at 50% 36%, rgba(238,217,138,0.34) 0%, rgba(27,56,40,0) 74%)',
                  border: '1.5px solid rgba(238,217,138,0.5)',
                }}
              >
                <Wallet size={20} strokeWidth={2} style={{ color: NEU.gold }} />
              </span>
              <div className="flex-1 min-w-[220px]">
                <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14, color: '#FAF8F3', lineHeight: 1.3 }}>
                  Onboard payments
                </p>
                <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: 'rgba(250,248,243,0.68)', lineHeight: 1.5 }}>
                  Choose how you get paid — switch between Stripe and manual any time, each keeps its own setup ready.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: 'rgba(250,248,243,0.75)', display: 'block', marginBottom: 8 }}>
                Which country is the bank account that will receive payments in?
              </label>
              {showPayoutCountryPicker ? (
                <select
                  value={payoutCountry}
                  onChange={e => selectPayoutCountry(e.target.value)}
                  disabled={payoutCountrySaving}
                  style={{
                    padding: '9px 12px', borderRadius: 12, border: 'none', outline: 'none',
                    backgroundColor: NEU.base, boxShadow: NEU.inSm, color: NEU.ink,
                    fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', minWidth: 220,
                  }}
                >
                  <option value="">Select a country…</option>
                  {allCountryOptions.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
                    style={{ backgroundColor: 'rgba(250,248,243,0.1)', border: '1px solid rgba(250,248,243,0.22)' }}
                  >
                    <FlagImg code={payoutCountry} size={16} />
                    <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: '#FAF8F3' }}>
                      {payoutCountryName}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingPayoutCountry(true)}
                    className="focus:outline-none"
                    style={{
                      border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
                      fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700,
                      color: 'rgba(250,248,243,0.7)', textDecoration: 'underline', textUnderlineOffset: 3,
                    }}
                  >
                    Change
                  </button>
                </div>
              )}
            </div>
          </div>

          {payoutCountry && !payoutStripeSupported && (
            <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted, lineHeight: 1.5 }}>
              Stripe isn&apos;t available for {payoutCountryName} — using manual payments.
            </p>
          )}

          {/* Method rows — stacked, exactly one active/expanded at a time */}
          <div className="flex flex-col gap-4">
            {payoutStripeSupported && (
              <MethodRow
                active={activeMethod === 'stripe'}
                onActivate={() => setActiveMethod('stripe')}
                gradient={NEU_GRADIENTS.gold}
                icon={CreditCard}
                title="Stripe Payments"
              >
                {connectStatus === 'complete' ? (
                  <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.ink, lineHeight: 1.6 }}>
                    Stripe connected — delegate payments go directly to your Stripe account.
                  </p>
                ) : connectStatus === 'pending' ? (
                  <>
                    <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.ink, lineHeight: 1.6 }}>
                      Finish your Stripe onboarding — Stripe still needs a few details before payouts can start.
                    </p>
                    {connectError && (
                      <p className="flex items-start gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, color: '#8B2020', lineHeight: 1.5 }}>
                        <TriangleAlert size={12} strokeWidth={2.4} style={{ marginTop: 2, flexShrink: 0 }} />
                        {connectError}
                      </p>
                    )}
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={checkConnectStatus}
                        disabled={connectBusy !== null}
                        className="focus:outline-none"
                        style={{
                          border: 'none', background: 'transparent',
                          cursor: connectBusy !== null ? 'default' : 'pointer',
                          fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                          color: NEU.muted,
                          textDecoration: connectBusy !== null ? 'none' : 'underline', textUnderlineOffset: 3,
                        }}
                      >
                        {connectBusy === 'status' ? 'CHECKING…' : 'CHECK STATUS'}
                      </button>
                      <NeuButton
                        icon={CreditCard}
                        gradient={NEU_GRADIENTS.gold}
                        disabled={connectBusy !== null}
                        onClick={() => startConnectOnboarding()}
                      >
                        {connectBusy === 'start' ? 'CONNECTING…' : 'FINISH ONBOARDING'}
                      </NeuButton>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.ink, lineHeight: 1.6 }}>
                      Payments are processed automatically and marked paid on Gavelling instantly. Money lands directly in your own bank account — no manual tracking.
                    </p>
                    <p style={mutedCaption}>
                      Stripe&apos;s standard processing fee applies, since your conference is the merchant of record. Gavelling charges nothing.
                    </p>
                    {connectError && (
                      <p className="flex items-start gap-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, color: '#8B2020', lineHeight: 1.5 }}>
                        <TriangleAlert size={12} strokeWidth={2.4} style={{ marginTop: 2, flexShrink: 0 }} />
                        {connectError}
                      </p>
                    )}
                    <NeuButton
                      icon={CreditCard}
                      gradient={NEU_GRADIENTS.gold}
                      disabled={connectBusy !== null}
                      onClick={() => startConnectOnboarding(payoutCountry)}
                    >
                      {connectBusy === 'start' ? 'CONNECTING…' : 'CONNECT STRIPE'}
                    </NeuButton>
                  </>
                )}
              </MethodRow>
            )}

            <MethodRow
              active={activeMethod === 'manual' || !payoutStripeSupported}
              disabled={!payoutStripeSupported}
              onActivate={() => setActiveMethod('manual')}
              gradient={NEU_GRADIENTS.sage}
              icon={Receipt}
              title="Manual Payments"
            >
              <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.ink, lineHeight: 1.6 }}>
                A payment link is optional — paste one below and delegates are redirected to it to pay, or just leave instructions and mark each payment as received yourself from the Financials or Applications screens.
              </p>
              <p style={mutedCaption}>
                No processing fee, but everything is tracked manually.
              </p>
              <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, color: '#EED98A', backgroundColor: '#1B3828', borderRadius: 10, padding: '10px 12px', lineHeight: 1.5 }}>
                Running a free conference? Choose Manual and write &quot;This conference is free&quot; in the instructions — you still need a method set before applications can open.
              </p>
              {manualFormFields}
              <NeuButton
                gradient={NEU_GRADIENTS.forest}
                disabled={paymentSaving}
                onClick={savePaymentPage}
              >
                {paymentSaving ? 'SAVING…' : 'SAVE'}
              </NeuButton>
            </MethodRow>
          </div>
        </div>
      )}

      {/* ── Vouchers ── */}
      <VouchersSection conference={conference} displayCurrency={displayCurrency} />
    </>
  );
}
