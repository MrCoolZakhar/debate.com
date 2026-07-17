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
import {
  NEU, NEU_GRADIENTS, OUTFIT,
  NeuCard, NeuButton, NeuIconDisc, NeuPill,
} from '@/components/neu';
import {
  type ConnectStatus, inputStyle, fieldLabelStyle, MAX_PAYMENT_NOTE_LENGTH, mutedCaption,
  useFinancialsCurrency,
} from '../shared';
import VouchersSection from '../VouchersSection';

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

  async function savePaymentPage() {
    if (!conference || paymentSaving) return;
    const trimmedUrl = paymentUrl.trim();
    if (trimmedUrl && !trimmedUrl.startsWith('https://')) {
      setPaymentUrlError('The link must start with https://');
      return;
    }
    setPaymentUrlError('');
    setPaymentSaveError('');
    setPaymentSaving(true);
    const supabase = await getFreshAuthedClient();
    if (!supabase) {
      setPaymentSaving(false);
      setPaymentSaveError('Your session has expired, please refresh and sign in again.');
      return;
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
      return;
    }
    setActiveMethodState('manual');
    refreshConferenceQuiet();
  }

  if (!conference) return null;

  // Onboard payments: whether Stripe Connect is offered for the picked
  // payout country (gates the Stripe card), and its name for copy.
  const payoutStripeSupported = isStripeCountrySupported(payoutCountry);
  const payoutCountryName = allCountryOptions.find(c => c.code === payoutCountry)?.name ?? payoutCountry;
  const showPayoutCountryPicker = !payoutCountry || editingPayoutCountry;

  return (
    <>
      {/* Onboard payments — always visible, switchable Stripe/Manual (payments.ts + connect-onboard) */}
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
            Stripe isn&apos;t available for {payoutCountryName} yet — set up manual payments below.
          </p>
        )}

        <div className={`grid grid-cols-1 ${payoutStripeSupported ? 'md:grid-cols-2' : ''} gap-4 items-stretch`}>
          {payoutStripeSupported && (
            <NeuCard style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <NeuIconDisc gradient={NEU_GRADIENTS.gold} icon={CreditCard} size={38} />
                  <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14.5, color: NEU.ink }}>
                    Onboard with Stripe
                  </p>
                </div>
                {activeMethod === 'stripe' && connectStatus === 'complete' && (
                  <NeuPill active gradient={NEU_GRADIENTS.green}>
                    <CircleCheck size={11} strokeWidth={2.6} />
                    ACTIVE
                  </NeuPill>
                )}
              </div>

              {connectStatus === 'complete' ? (
                <>
                  <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.ink, lineHeight: 1.6 }}>
                    Stripe connected — delegate payments go directly to your Stripe account.
                  </p>
                  {activeMethod !== 'stripe' && (
                    <NeuButton
                      gradient={NEU_GRADIENTS.gold}
                      onClick={() => setActiveMethod('stripe')}
                      style={{ marginTop: 'auto' }}
                    >
                      SWITCH TO STRIPE
                    </NeuButton>
                  )}
                </>
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
                  <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 'auto' }}>
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
                      onClick={() => { startConnectOnboarding(); setActiveMethod('stripe'); }}
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
                    onClick={() => { startConnectOnboarding(payoutCountry); setActiveMethod('stripe'); }}
                    style={{ marginTop: 'auto' }}
                  >
                    {connectBusy === 'start' ? 'CONNECTING…' : 'CONNECT STRIPE'}
                  </NeuButton>
                </>
              )}
            </NeuCard>
          )}

          {/* Manual payments — absorbs the "own payment page" fields */}
          <NeuCard style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <NeuIconDisc gradient={NEU_GRADIENTS.sage} icon={Receipt} size={38} />
                <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14.5, color: NEU.ink }}>
                  Manual payments
                </p>
              </div>
              {activeMethod === 'manual' ? (
                <NeuPill active gradient={NEU_GRADIENTS.green}>
                  <CircleCheck size={11} strokeWidth={2.6} />
                  ACTIVE
                </NeuPill>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveMethod('manual')}
                  className="focus:outline-none flex-shrink-0"
                  style={{
                    border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
                    fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                    color: NEU.forest, textDecoration: 'underline', textUnderlineOffset: 3,
                  }}
                >
                  SWITCH TO MANUAL
                </button>
              )}
            </div>
            <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.ink, lineHeight: 1.6 }}>
              A payment link is optional — paste one below and delegates are redirected to it to pay, or just leave instructions and mark each payment as received yourself from the Financials or Applications screens.
            </p>
            <p style={mutedCaption}>
              No processing fee, but everything is tracked manually.
            </p>
            <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 600, color: '#EED98A', backgroundColor: '#1B3828', borderRadius: 10, padding: '10px 12px', lineHeight: 1.5 }}>
              Running a free conference? Choose Manual and write &quot;This conference is free&quot; in the instructions — you still need a method set before applications can open.
            </p>

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

            <NeuButton
              gradient={NEU_GRADIENTS.forest}
              disabled={paymentSaving}
              onClick={savePaymentPage}
              style={{ marginTop: 'auto' }}
            >
              {paymentSaving ? 'SAVING…' : 'SAVE'}
            </NeuButton>
          </NeuCard>
        </div>
      </div>

      {/* ── Vouchers ── */}
      <VouchersSection conference={conference} displayCurrency={displayCurrency} />
    </>
  );
}
