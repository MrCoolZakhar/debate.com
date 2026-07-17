'use client';

/**
 * Add-ons — optional extra-cost items (t-shirts, gala tickets, etc.) that
 * seed kind='addon' invoices via sync_participant_invoices, never gating
 * acceptance. Same optimistic list pattern as VouchersSection: temp-id
 * insert swapped for the real row, exact rollback on failure.
 */

import { useState, useEffect } from 'react';
import { Package, Plus, Trash2 } from 'lucide-react';
import type { Conference } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useConfirmModal } from '@/components/ConfirmModal';
import { currencyPickerGroups } from '@/lib/currencies';
import { formatFee } from '@/lib/finance';
import { PillToggle } from '@/app/account/accountUi';
import {
  NEU, NEU_GRADIENTS, OUTFIT, NeuCard, NeuButton, NeuIconDisc,
} from '@/components/neu';
import { inputStyle, fieldLabelStyle } from './shared';

const CURRENCY_GROUPS = currencyPickerGroups();

const TARGET_OPTIONS = [
  { value: 'per_delegate', label: 'Every delegate' },
  { value: 'per_delegation', label: 'Every delegation (advisor/head del.)' },
  { value: 'delegate', label: 'Delegates only' },
  { value: 'head-delegate', label: 'Head delegates only' },
  { value: 'chair', label: 'Chairs only' },
  { value: 'faculty-advisor', label: 'Faculty advisors only' },
  { value: 'observer', label: 'Observers only' },
] as const;

function targetLabel(value: string): string {
  return TARGET_OPTIONS.find(t => t.value === value)?.label ?? value;
}

interface Addon {
  id: string;
  label: string;
  description: string | null;
  amount_cents: number;
  currency: string;
  applies_to: string;
  active: boolean;
  created_at: string;
}

export default function AddonsSection({ conference }: { conference: Conference }) {
  const { session } = useAuth();
  const { confirm, modal: confirmModal } = useConfirmModal();

  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(conference.fee_currency ?? 'USD');
  const [appliesTo, setAppliesTo] = useState<string>('per_delegate');
  const [active, setActive] = useState(true);
  const [creating, setCreating] = useState(false);

  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  function markBusy(id: string, busy: boolean) {
    setBusyIds(prev => {
      const next = new Set(prev);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  }

  useEffect(() => {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    (async () => {
      const { data } = await supabase
        .from('addons')
        .select('id, label, description, amount_cents, currency, applies_to, active, created_at')
        .eq('conference_id', conference.id)
        .order('created_at', { ascending: false });
      setAddons((data ?? []) as Addon[]);
      setLoading(false);
    })();
  }, [conference.id, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleCreate() {
    if (!session || creating) return;
    const amt = Number(amount);
    if (!label.trim()) { setError('Give the add-on a label.'); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setError('Enter an amount greater than zero.'); return; }
    setError('');
    setCreating(true);

    const tempId = `temp-${Date.now()}`;
    const optimistic: Addon = {
      id: tempId, label: label.trim(), description: description.trim() || null,
      amount_cents: Math.round(amt * 100), currency: currency.toUpperCase(),
      applies_to: appliesTo, active, created_at: new Date().toISOString(),
    };
    setAddons(cur => [optimistic, ...cur]);

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data, error: insertError } = await supabase
        .from('addons')
        .insert({
          conference_id: conference.id,
          label: optimistic.label,
          description: optimistic.description,
          amount_cents: optimistic.amount_cents,
          currency: optimistic.currency,
          applies_to: optimistic.applies_to,
          active: optimistic.active,
        })
        .select('id, label, description, amount_cents, currency, applies_to, active, created_at')
        .single();
      if (insertError || !data) throw insertError ?? new Error('insert returned no row');
      setAddons(cur => cur.map(a => (a.id === tempId ? (data as Addon) : a)));
      setLabel(''); setDescription(''); setAmount(''); setAppliesTo('per_delegate'); setActive(true);
    })()
      .catch(() => {
        setAddons(cur => cur.filter(a => a.id !== tempId));
        setError('Could not create the add-on, it was removed from the list. Please try again.');
      })
      .finally(() => setCreating(false));
  }

  function handleToggleActive(a: Addon) {
    if (!session || busyIds.has(a.id) || a.id.startsWith('temp-')) return;
    const prev = a.active;
    setError('');
    markBusy(a.id, true);
    setAddons(cur => cur.map(x => (x.id === a.id ? { ...x, active: !prev } : x)));

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error: updateError } = await supabase
        .from('addons')
        .update({ active: !prev })
        .eq('id', a.id)
        .eq('conference_id', conference.id);
      if (updateError) throw updateError;
    })()
      .catch(() => {
        setAddons(cur => cur.map(x => (x.id === a.id ? { ...x, active: prev } : x)));
        setError(`Could not update ${a.label}, the change was reverted.`);
      })
      .finally(() => markBusy(a.id, false));
  }

  async function handleDelete(a: Addon) {
    if (!session || busyIds.has(a.id) || a.id.startsWith('temp-')) return;
    const { confirmed } = await confirm({
      title: `Delete ${a.label}?`,
      body: 'Existing invoices for this add-on are unaffected — this only stops it from being offered to new applicants.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    setError('');
    markBusy(a.id, true);
    setAddons(cur => cur.filter(x => x.id !== a.id));

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error: deleteError } = await supabase
        .from('addons')
        .delete()
        .eq('id', a.id)
        .eq('conference_id', conference.id);
      if (deleteError) throw deleteError;
    })()
      .catch(() => {
        setAddons(cur => [a, ...cur.filter(x => x.id !== a.id)]);
        setError(`Could not delete ${a.label}, it was restored. Please try again.`);
      })
      .finally(() => markBusy(a.id, false));
  }

  const canCreate = label.trim().length > 0 && Number(amount) > 0 && !creating;

  return (
    <section className="mt-8">
      <div className="flex items-center gap-3 mb-4">
        <NeuIconDisc gradient={NEU_GRADIENTS.sage} icon={Package} emoji="Package" size={36} />
        <div>
          <h2 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 18, color: NEU.ink, lineHeight: 1.15 }}>
            Add-ons
          </h2>
          <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted }}>
            Optional extras applicants can pay for from their invoices — never required, never gates acceptance.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs font-semibold mb-3" style={{ color: '#8B2020', fontFamily: OUTFIT }}>{error}</p>
      )}

      {/* ── Create card ── */}
      <NeuCard style={{ padding: '18px 20px' }}>
        <p style={{ ...fieldLabelStyle, color: NEU.deepGold, marginBottom: 12 }}>New add-on</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label htmlFor="addon-label" style={fieldLabelStyle}>Label</label>
            <input
              id="addon-label"
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Conference T-Shirt"
              style={inputStyle}
            />
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="addon-desc" style={fieldLabelStyle}>Description · optional</label>
            <input
              id="addon-desc"
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Shown to applicants on the invoice detail"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="addon-amount" style={fieldLabelStyle}>Amount</label>
            <div className="flex items-center gap-2">
              <input
                id="addon-amount"
                type="number"
                min={0.01}
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="15.00"
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

          <div className="lg:col-span-2">
            <label htmlFor="addon-target" style={fieldLabelStyle}>Offered to</label>
            <select
              id="addon-target"
              value={appliesTo}
              onChange={e => setAppliesTo(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {TARGET_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <span style={fieldLabelStyle}>Status</span>
              <div className="flex items-center gap-2" style={{ paddingTop: 3 }}>
                <PillToggle value={active} onChange={setActive} size="sm" />
                <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: NEU.ink }}>
                  {active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <NeuButton icon={Plus} onClick={handleCreate} disabled={!canCreate}>
              {creating ? 'CREATING…' : 'ADD'}
            </NeuButton>
          </div>
        </div>
      </NeuCard>

      {/* ── Add-ons list ── */}
      <div className="mt-4">
        {loading ? (
          <div className="rounded-[22px] animate-pulse" style={{ height: 100, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
        ) : addons.length === 0 ? (
          <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, textAlign: 'center', padding: '16px 0' }}>
            No add-ons yet.
          </p>
        ) : (
          <NeuCard style={{ padding: '6px 0', overflow: 'hidden' }}>
            {addons.map((a, i) => {
              const busy = busyIds.has(a.id) || a.id.startsWith('temp-');
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 flex-wrap px-5 py-3"
                  style={{ ...(i > 0 ? { borderTop: '1px solid rgba(221,212,192,0.55)' } : {}), opacity: busy ? 0.6 : 1 }}
                >
                  <div className="min-w-0" style={{ flex: '1 1 200px' }}>
                    <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.ink }}>
                      {a.label}
                    </p>
                    <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted }}>
                      {targetLabel(a.applies_to)}
                    </p>
                  </div>
                  <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
                    {formatFee(a.amount_cents / 100, a.currency)}
                  </span>
                  <PillToggle value={a.active} onChange={() => handleToggleActive(a)} size="sm" />
                  <button
                    onClick={() => handleDelete(a)}
                    disabled={busy}
                    className="focus:outline-none flex-shrink-0"
                    style={{ border: 'none', background: 'transparent', cursor: busy ? 'default' : 'pointer', color: '#8B2020', opacity: busy ? 0.5 : 1 }}
                    title="Delete"
                  >
                    <Trash2 size={15} strokeWidth={2.2} />
                  </button>
                </div>
              );
            })}
          </NeuCard>
        )}
      </div>
      {confirmModal}
    </section>
  );
}
