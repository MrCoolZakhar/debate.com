'use client';

/**
 * Conference Registration Fee — editor for the ONE application_surcharges row
 * per conference (kind='app_fee' on the invoices it seeds via
 * sync_participant_invoices). Always payable pre-acceptance; gates_acceptance
 * (default off) controls whether it blocks acceptance until paid (see PART 7,
 * applications/page.tsx). Creates the row on first save if none exists yet;
 * every later save updates it in place.
 */

import { useState, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { Conference } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { currencyPickerGroups } from '@/lib/currencies';
import { PillToggle } from '@/app/account/accountUi';
import {
  NEU, NEU_GRADIENTS, OUTFIT, NeuCard, NeuButton, NeuIconDisc, NeuPill,
} from '@/components/neu';
import { inputStyle, fieldLabelStyle } from './shared';

const CURRENCY_GROUPS = currencyPickerGroups();

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

export default function ApplicationFeeSection({ conference }: { conference: Conference }) {
  const { session } = useAuth();
  const [existing, setExisting] = useState<SurchargeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [label, setLabel] = useState('Conference Registration Fee');
  const [description, setDescription] = useState('A registration charge, collected in addition to any conference fees.');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(conference.fee_currency ?? 'USD');
  const [appliesTo, setAppliesTo] = useState<'per_delegation' | 'per_delegate'>('per_delegation');
  const [active, setActive] = useState(true);
  const [gatesAcceptance, setGatesAcceptance] = useState(false);

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
        setCurrency(row.currency);
        setAppliesTo(row.applies_to);
        setActive(row.active);
        setGatesAcceptance(row.gates_acceptance);
      }
      setLoading(false);
    })();
  }, [conference.id, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!session || saving) return;
    const amt = Number(amount);
    if (!label.trim()) { setError('Give the fee a label.'); return; }
    if (!Number.isFinite(amt) || amt < 0) { setError('Enter an amount of 0 or more.'); return; }
    setError('');
    setSaving(true);
    const supabase = getAuthedClient(session.access_token);
    const payload = {
      conference_id: conference.id,
      label: label.trim(),
      description: description.trim(),
      amount_cents: Math.round(amt * 100),
      currency: currency.toUpperCase(),
      applies_to: appliesTo,
      active,
      gates_acceptance: gatesAcceptance,
    };
    const { data, error: writeError } = existing
      ? await supabase.from('application_surcharges').update(payload).eq('id', existing.id).select('id').single()
      : await supabase.from('application_surcharges').insert(payload).select('id').single();
    setSaving(false);
    if (writeError || !data) {
      setError('Could not save the application fee. Please try again.');
      return;
    }
    if (!existing) setExisting({ id: (data as { id: string }).id, ...payload } as SurchargeRow);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <section className="mt-8">
      <div className="flex items-center gap-3 mb-4">
        <NeuIconDisc gradient={NEU_GRADIENTS.amber} icon={ShieldAlert} emoji="Locked" size={36} />
        <div>
          <h2 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 18, color: NEU.ink, lineHeight: 1.15 }}>
            Conference Registration Fee
          </h2>
          <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted }}>
            A registration charge collected alongside conference fees — set whether it must be paid before you can accept an applicant.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs font-semibold mb-3" style={{ color: '#8B2020', fontFamily: OUTFIT }}>{error}</p>
      )}

      {loading ? (
        <div className="rounded-[22px] animate-pulse" style={{ height: 160, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
      ) : (
        <NeuCard style={{ padding: '18px 20px' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
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

            <div className="sm:col-span-2">
              <label htmlFor="appfee-desc" style={fieldLabelStyle}>Description</label>
              <textarea
                id="appfee-desc"
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Shown to applicants on the invoice detail"
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>

            <div>
              <label htmlFor="appfee-amount" style={fieldLabelStyle}>Amount</label>
              <div className="flex items-center gap-2">
                <input
                  id="appfee-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="25.00"
                  style={inputStyle}
                />
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  style={{ ...inputStyle, width: 96, cursor: 'pointer' }}
                >
                  {CURRENCY_GROUPS.pinned.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                  <option disabled>──────</option>
                  {CURRENCY_GROUPS.rest.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
              </div>
            </div>

            <div>
              <span style={fieldLabelStyle}>Charged per</span>
              <div className="flex items-center gap-2" style={{ paddingTop: 3 }}>
                <NeuPill active={appliesTo === 'per_delegation'} gradient={NEU_GRADIENTS.forest} onClick={() => setAppliesTo('per_delegation')}>
                  DELEGATION
                </NeuPill>
                <NeuPill active={appliesTo === 'per_delegate'} gradient={NEU_GRADIENTS.forest} onClick={() => setAppliesTo('per_delegate')}>
                  DELEGATE
                </NeuPill>
              </div>
            </div>

            <div>
              <span style={fieldLabelStyle}>Acceptance gating</span>
              <div className="flex items-center gap-3" style={{ paddingTop: 3 }}>
                <PillToggle value={gatesAcceptance} onChange={setGatesAcceptance} size="sm" />
                <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.ink }}>
                  {gatesAcceptance ? 'Must be paid before acceptance' : "Collected as a normal invoice (doesn't block acceptance)"}
                </span>
              </div>
              <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, marginTop: 4 }}>
                When on, applicants can&apos;t be accepted until this fee is paid.
              </p>
            </div>

            <div className="sm:col-span-2 flex items-center justify-between gap-3 flex-wrap pt-1">
              <div className="flex items-center gap-3">
                <PillToggle value={active} onChange={setActive} size="sm" />
                <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.ink }}>
                  {active ? 'Active — charged on applications' : 'Inactive — no fee charged'}
                </span>
              </div>
              <NeuButton onClick={handleSave} disabled={saving} gradient={saved ? NEU_GRADIENTS.green : NEU_GRADIENTS.forest}>
                {saving ? 'SAVING…' : saved ? 'SAVED ✓' : 'SAVE'}
              </NeuButton>
            </div>
          </div>
        </NeuCard>
      )}
    </section>
  );
}
