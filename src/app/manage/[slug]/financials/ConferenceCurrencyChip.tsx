'use client';

// ConferenceCurrencyChip — the currency chip in the Financials header and on
// its sub-pages (prompt 136). It IS the conference's one currency
// (conferences.fee_currency), never a display currency: there is no
// conversion any more. Choosing another currency changes the conference's
// currency through set_conference_currency:
//   - no prices yet: saved at once;
//   - prices exist: a confirm first ("Change your currency to {CODE}?");
//   - payments already made (locked): the chip is fixed, with an "i".
// Every save is verified (the state is read again) and then the conference is
// refreshed, so every figure, the Settings Payments row and the role prices
// show the new code without a reload.

import { useEffect, useRef, useState } from 'react';
import { useManage } from '@/app/manage/[slug]/layout';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CircleFlag } from '@/components/CircleFlag';
import { OUTFIT } from '@/components/neu';
import { findCurrency } from '@/lib/currencies';
import { loadFxRates } from '@/lib/fxRates';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { InfoHint } from '../settings/applicationsUi';
import { readCurrencyState, setConferenceCurrency, type CurrencyState } from './onboarding/paymentApi';

export default function ConferenceCurrencyChip({ onChanged }: {
  /** After a change landed (the page re-reads its figures). */
  onChanged?: () => void;
}) {
  const { conference, financialsReadOnly, refreshConferenceQuiet } = useManage();
  const conferenceId = conference?.id ?? null;
  const [state, setState] = useState<CurrencyState | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [ask, setAsk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  // Read on mount (and for another conference), plus the currencies the day's rates know.
  useEffect(() => {
    if (!conferenceId) return;
    let alive = true;
    void Promise.all([readCurrencyState(conferenceId), loadFxRates().catch(() => new Map<string, number>())]).then(([st, rates]) => {
      if (!alive) return;
      if (!('error' in st)) setState(st);
      setCodes([...rates.keys()].map(k => k.toUpperCase()));
    });
    return () => { alive = false; };
  }, [conferenceId]);

  const current = (state?.currency ?? conference?.fee_currency ?? '').toUpperCase();

  async function save(code: string) {
    if (!conferenceId || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await setConferenceCurrency(conferenceId, code);
      if (!res.ok) { notifyErr(res.error, 'financials-currency'); return; }
      // Verified: what the database now holds is what the chip shows.
      const st = await readCurrencyState(conferenceId);
      if ('error' in st) { notifyErr(st.error, 'financials-currency'); return; }
      setState(st);
      if (st.currency.toUpperCase() !== code.toUpperCase()) {
        notifyErr('Your currency could not be changed. Try again in a moment.', 'financials-currency');
        return;
      }
      notifyOk(`Your conference's currency is now ${st.currency.toUpperCase()}`, 'financials-currency');
      await refreshConferenceQuiet();
      onChanged?.();
    } finally {
      busyRef.current = false;
      setBusy(false);
      setAsk(null);
    }
  }

  function choose(code: string) {
    const next = code.toUpperCase();
    if (!next || next === current || busy) return;
    if (state?.priced) { setAsk(next); return; }
    void save(next);
  }

  if (!conference) return null;

  // Payments already made: the currency stays. A fixed chip, no chevron.
  if (state?.locked || financialsReadOnly) {
    const cur = findCurrency(current);
    return (
      <span className="inline-flex items-center gap-2" aria-label="Conference currency"
        style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.02em', color: '#1C1410', background: '#F0EBDD', borderRadius: 999, padding: '8px 14px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(27,56,40,0.12), 0 3px 7px -2px rgba(27,56,40,0.17)' }}>
        {cur?.country && <CircleFlag code={cur.country} size={18} decorative />}
        <span>{current}{cur ? <span style={{ color: '#5B4F42', fontWeight: 600 }}> · {cur.name}</span> : null}</span>
        {state?.locked && (
          <InfoHint label="About your currency" text={`Payments have already been made in ${current}, so ${current} stays your conference's currency`} size={15} />
        )}
      </span>
    );
  }

  const options = codes && codes.length > 0
    ? [current, ...codes.filter(c => c !== current)]
    : [current];

  return (
    <>
      <CurrencyPicker
        value={current}
        onChange={choose}
        options={options}
        variant="pill"
        showName
        disabled={busy || options.length <= 1}
        ariaLabel="Conference currency"
      />
      {ask && (
        <ConfirmModal
          title={`Change your currency to ${ask}?`}
          body={<p>Your prices keep their numbers and will be shown in {ask}</p>}
          confirmLabel="Change currency"
          cancelLabel="Cancel"
          loading={busy}
          onConfirm={() => { void save(ask); }}
          onCancel={() => { if (!busy) setAsk(null); }}
        />
      )}
    </>
  );
}
