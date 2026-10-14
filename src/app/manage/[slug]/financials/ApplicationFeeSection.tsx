'use client';

/**
 * Conference Registration Fee — editor for the ONE application_surcharges row
 * per conference (kind='app_fee' on the invoices it seeds via
 * sync_participant_invoices). Always payable pre-acceptance; gates_acceptance
 * (default off) controls whether it blocks acceptance until paid (see PART 7,
 * applications/page.tsx). Creates the row on first save if none exists yet;
 * every later save updates it in place.
 */

import { useState, useEffect, useRef } from 'react';
import { notifyErr, clearErr } from '@/lib/appNotify';
import { ShieldAlert } from 'lucide-react';
import type { Conference } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { CurrencyChip, ConferenceCurrencyLine } from '@/components/ConferenceCurrency';
import { PillToggle } from '@/app/account/accountUi';
import {
  NEU, NEU_GRADIENTS, OUTFIT, NeuCard, NeuButton, NeuIconDisc, NeuPill,
} from '@/components/neu';
import { useConfirmModal } from '@/components/ConfirmModal';
import { inputStyle, fieldLabelStyle } from './shared';
import { InfoHint } from '../settings/applicationsUi';

// The house confirm sits at z-index 50; this section also lives inside the
// Financials pop-ups (z-index 9090), so while the turn-off question is open
// its backdrop is lifted above them.
const RAISE_CONFIRM_CSS = '.gv-modal-backdrop{z-index:9300 !important}';

interface SurchargeRow {
  id: string;
  label: string;
  description: string;
  amount_cents: number;
  currency: string;
  applies_to: 'per_delegation' | 'per_delegate';
  active: boolean;
  gates_acceptance: boolean;
}

export default function ApplicationFeeSection({ conference, bare = false }: {
  conference: Conference;
  /** Inside a pop-up (prompt 94): no section header and no top margin. */
  bare?: boolean;
}) {
  const { session } = useAuth();
  const [existing, setExisting] = useState<SurchargeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [label, setLabel] = useState('Conference Registration Fee');
  const [description, setDescription] = useState('A registration charge, collected in addition to any conference fees.');
  const [amount, setAmount] = useState('');
  const [appliesTo, setAppliesTo] = useState<'per_delegation' | 'per_delegate'>('per_delegation');
  // A NEW fee starts Inactive (prompt 106); a saved row keeps its own value below.
  const [active, setActive] = useState(false);
  const [gatesAcceptance, setGatesAcceptance] = useState(false);
  const { confirm, modal: confirmModal } = useConfirmModal();
  const askingRef = useRef(false);

  useEffect(() => {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    (async () => {
      const { data } = await supabase
        .from('application_surcharges')
        .select('id, label, description, amount_cents, currency, applies_to, active, gates_acceptance')
        .eq('conference_id', conference.id)
        .maybeSingle();
      const row = data as SurchargeRow | null;
      setExisting(row);
      if (row) {
        setLabel(row.label);
        setDescription(row.description ?? '');
        setAmount(row.amount_cents ? String(row.amount_cents / 100) : '');
        setAppliesTo(row.applies_to);
        setActive(row.active);
        setGatesAcceptance(row.gates_acceptance);
      }
      setLoading(false);
    })();
  }, [conference.id, !!session]); // eslint-disable-line react-hooks/exhaustive-deps

  // A fee of 0 can never be settled, so a zero-amount gate would block every
  // applicant with no way through. The DB enforces this too, via the
  // application_surcharges_gate_needs_amount check constraint.
  const amountMinor = Math.round(Number(amount) * 100);
  const amountIsPositive = Number.isFinite(amountMinor) && amountMinor > 0;

  async function handleSave() {
    if (!session || saving || askingRef.current) return;
    const amt = Number(amount);
    if (!label.trim()) { setError('Give the fee a label.'); return; }
    if (!Number.isFinite(amt) || amt < 0) { setError('Enter an amount of 0 or more.'); return; }
    if (gatesAcceptance && Math.round(amt * 100) <= 0) {
      setError('A fee of 0 cannot block acceptance. Enter an amount above 0, or turn acceptance gating off.');
      return;
    }
    // Turning a live fee off cancels pending Registration Fee invoices on the
    // server (owner, 8 Oct 2026), so ask first. Only when the SAVED fee is on
    // and this save turns it off: never on first setup, never when already off.
    if (existing?.active && !active) {
      askingRef.current = true;
      const { confirmed } = await confirm({
        title: 'Turn Off Registration Fee?',
        body: 'Turning off registration fee will cancel any pending Registration Fee invoices from applicants. Do you wish to continue?',
        confirmLabel: 'Turn off',
        cancelLabel: 'Keep it on',
        danger: true,
      });
      askingRef.current = false;
      if (!confirmed) { setActive(true); return; }
    }
    setError('');
    clearErr('financials-fee');
    setSaving(true);
    const supabase = getAuthedClient(session.access_token);
    const payload = {
      conference_id: conference.id,
      label: label.trim(),
      description: description.trim(),
      amount_cents: Math.round(amt * 100),
      // No currency: the database gives a new fee the conference's currency
      // and a fee is never moved off it from here (prompt 126).
      applies_to: appliesTo,
      active,
      // Default-off is guaranteed by useState(false) above, so the toggle's
      // current value is always the organizer's actual intent, on create and
      // on update alike.
      gates_acceptance: gatesAcceptance,
    };
    const { data, error: writeError } = existing
      ? await supabase.from('application_surcharges').update(payload).eq('id', existing.id).select('id').single()
      : await supabase.from('application_surcharges').insert(payload).select('id').single();
    setSaving(false);
    if (writeError || !data) {
      notifyErr('Could not save the application fee. Please try again.', 'financials-fee');
      return;
    }
    // Keep what is saved in step with the form, so the next turn-off asks again only when the fee is on.
    setExisting(prev => ({ ...(prev ?? {}), id: (data as { id: string }).id, ...payload } as SurchargeRow));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <section className={bare ? undefined : 'mt-8'}>
      {confirmModal && <><style>{RAISE_CONFIRM_CSS}</style>{confirmModal}</>}
      {!bare && (
      <div className="flex items-center gap-3 mb-4">
          <NeuIconDisc gradient={NEU_GRADIENTS.amber} icon={ShieldAlert} emoji="Locked" size={36} />
          <div>
            <h2 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 18, color: NEU.ink, lineHeight: 1.15 }}>
              Conference Registration Fee
            </h2>
            <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted }}>
              A registration charge collected alongside conference fees. Set whether it must be paid before you can accept an applicant.
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs font-semibold mb-3" style={{ color: '#8B2020', fontFamily: OUTFIT }}>{error}</p>
      )}

      {loading ? (
        <div className="rounded-[22px] animate-pulse" style={{ height: 160, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
      ) : (
        <NeuCard style={{ padding: bare ? '14px 18px' : '18px 20px' }}>
          {/* The switch comes first (prompt 106): everything below is what it turns on. */}
          <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: bare ? 10 : 14 }}>
            <div className="flex items-center gap-3">
              <span style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: NEU.ink }}>Charge a registration fee</span>
              <PillToggle value={active} onChange={setActive} size="sm" />
              <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: active ? '#2A5A3C' : NEU.muted }}>
                {active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5" style={{
              fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: '#7A5A10',
              background: 'rgba(238,217,138,0.4)', borderRadius: 999, padding: '4px 6px 4px 10px',
            }}>
              Different than Conference Fee
              <InfoHint label="About the registration fee" size={14}
                text="This is charged once on top of the ticket price, for example a deposit. Ticket prices are set for each role in Settings." />
            </span>
          </div>

          {/* Faded and locked while Inactive, but still there to see. */}
          <fieldset
            disabled={!active}
            aria-disabled={!active}
            style={{ border: 'none', margin: 0, padding: 0, minWidth: 0, opacity: active ? 1 : 0.5, transition: 'opacity 160ms ease', pointerEvents: active ? undefined : 'none' }}
          >
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${bare ? 'gap-3' : 'gap-4'}`}>
            <div>
              <label htmlFor="appfee-label" style={fieldLabelStyle}>Label</label>
              <input
                id="appfee-label"
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Conference Registration Fee"
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="appfee-amount" style={fieldLabelStyle}>Amount</label>
              <div className="flex items-stretch gap-2">
                <input
                  id="appfee-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={e => {
                    setAmount(e.target.value);
                    const nextMinor = Math.round(Number(e.target.value) * 100);
                    if (!Number.isFinite(nextMinor) || nextMinor <= 0) setGatesAcceptance(false);
                  }}
                  placeholder="25.00"
                  style={inputStyle}
                />
                <CurrencyChip code={existing?.currency || conference.fee_currency} width={118} />
              </div>
              <ConferenceCurrencyLine code={existing?.currency || conference.fee_currency} slug={conference.slug} style={{ marginTop: 6 }} />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="appfee-desc" style={fieldLabelStyle}>Description</label>
              <textarea
                id="appfee-desc"
                rows={bare ? 1 : 2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Shown to applicants on the invoice detail"
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>

            <div>
              <span style={fieldLabelStyle}>Charged per</span>
              <div className="flex items-center gap-2" style={{ paddingTop: 3 }}>
                <NeuPill active={appliesTo === 'per_delegation'} gradient={NEU_GRADIENTS.forest} onClick={() => setAppliesTo('per_delegation')}>
                  Delegation
                </NeuPill>
                <NeuPill active={appliesTo === 'per_delegate'} gradient={NEU_GRADIENTS.forest} onClick={() => setAppliesTo('per_delegate')}>
                  Delegate
                </NeuPill>
              </div>
            </div>

            <div>
              <span style={fieldLabelStyle}>Acceptance gating</span>
              <div className="flex items-center gap-3" style={{ paddingTop: 3 }}>
                <PillToggle
                  value={gatesAcceptance}
                  onChange={setGatesAcceptance}
                  size="sm"
                  disabled={!amountIsPositive || !active}
                />
                <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: amountIsPositive ? NEU.ink : NEU.muted }}>
                  {gatesAcceptance ? 'Must be paid before acceptance' : "Doesn't block acceptance"}
                </span>
              </div>
              <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, marginTop: 4 }}>
                {amountIsPositive
                  ? "When on, applicants can't be accepted until this fee is paid."
                  : 'Set an amount above 0 to use acceptance gating.'}
              </p>
            </div>
          </div>
          </fieldset>

          <div className="flex items-center justify-end gap-3 flex-wrap" style={{ marginTop: bare ? 12 : 16 }}>
            <NeuButton onClick={handleSave} disabled={saving} gradient={saved ? NEU_GRADIENTS.green : NEU_GRADIENTS.forest}>
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
            </NeuButton>
          </div>
        </NeuCard>
      )}
    </section>
  );
}
