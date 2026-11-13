'use client';

/**
 * Add-ons — optional extra-cost items (t-shirts, socials tickets, etc.) that
 * seed kind='addon' invoices via sync_participant_invoices, never gating
 * acceptance. Same optimistic list pattern as VouchersSection: temp-id
 * insert swapped for the real row, exact rollback on failure.
 */

import { useState, useEffect } from 'react';
import { notifyErr, clearErr } from '@/lib/appNotify';
import { Package, Plus } from 'lucide-react';
import type { Conference } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { CurrencyChip, ConferenceCurrencyLine } from '@/components/ConferenceCurrency';
import GSelect from '@/components/GSelect';
import {
  NEU, NEU_GRADIENTS, OUTFIT, NeuCard, NeuButton, NeuIconDisc,
} from '@/components/neu';
import { inputStyle, fieldLabelStyle, formatMoney } from './shared';

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

export default function AddonsSection({ conference, bare = false, renderStats, soldFor }: {
  /** How many bought it (financials_addon_stats); undefined while not read. Delete shows only at 0. */
  soldFor?: (addonId: string) => number | undefined;
  conference: Conference;
  /** Inside a pop-up (prompt 94): no section header and no top margin. */
  bare?: boolean;
  /** Extra numbers drawn under each add-on (bought, not paid yet, revenue). */
  renderStats?: (addonId: string) => React.ReactNode;
}) {
  const { session } = useAuth();
  // The row asking "Delete …?" in place, and the row being edited in place.
  const [askingId, setAskingId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editErr, setEditErr] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [appliesTo, setAppliesTo] = useState<string>('per_delegate');
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
  }, [conference.id, !!session]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleCreate() {
    if (!session || creating) return;
    const amt = Number(amount);
    if (!label.trim()) { setError('Give the add-on a label.'); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setError('Enter an amount greater than zero.'); return; }
    setError('');
    clearErr('financials-addons');
    setCreating(true);

    const tempId = `temp-${Date.now()}`;
    const optimistic: Addon = {
      id: tempId, label: label.trim(), description: description.trim() || null,
      amount_cents: Math.round(amt * 100), currency: conference.fee_currency,
      // New add-ons are always offered (prompt 106): there is no active switch.
      applies_to: appliesTo, active: true, created_at: new Date().toISOString(),
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
          // No currency: the database gives a new add-on the conference's
          // currency (prompt 126).
          applies_to: optimistic.applies_to,
          active: optimistic.active,
        })
        .select('id, label, description, amount_cents, currency, applies_to, active, created_at')
        .single();
      if (insertError || !data) throw insertError ?? new Error('insert returned no row');
      setAddons(cur => cur.map(a => (a.id === tempId ? (data as Addon) : a)));
      setLabel(''); setDescription(''); setAmount(''); setAppliesTo('per_delegate');
    })()
      .catch(() => {
        setAddons(cur => cur.filter(a => a.id !== tempId));
        notifyErr('Could not create the add-on, it was removed from the list. Please try again.', 'financials-addons');
      })
      .finally(() => setCreating(false));
  }

  function handleToggleActive(a: Addon) {
    if (!session || busyIds.has(a.id) || a.id.startsWith('temp-')) return;
    const prev = a.active;
    setError('');
    clearErr('financials-addons');
    markBusy(a.id, true);
    setAddons(cur => cur.map(x => (x.id === a.id ? { ...x, active: !prev } : x)));

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data, error: updateError } = await supabase
        .from('addons')
        .update({ active: !prev })
        .eq('id', a.id)
        .eq('conference_id', conference.id)
        .select('id');
      if (updateError || !data || data.length !== 1) throw updateError ?? new Error('add-on not updated');
    })()
      .catch(() => {
        setAddons(cur => cur.map(x => (x.id === a.id ? { ...x, active: prev } : x)));
        notifyErr(`Could not update ${a.label}, the change was reverted.`, 'financials-addons');
      })
      .finally(() => markBusy(a.id, false));
  }

  function startEdit(a: Addon) {
    setAskingId(null);
    setEditId(a.id);
    setEditLabel(a.label);
    setEditDesc(a.description ?? '');
    setEditAmount((a.amount_cents / 100).toFixed(2));
    setEditErr('');
  }

  /** Edit in place (prompt 38): open unpaid picks move to the new price (trigger zz_addon_reprice_open). */
  async function saveEdit(a: Addon) {
    if (!session || editBusy) return;
    const amt = Number(editAmount);
    if (!editLabel.trim()) { setEditErr('Give the add-on a label.'); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setEditErr('Enter an amount greater than zero.'); return; }
    setEditBusy(true);
    setEditErr('');
    try {
      const supabase = getAuthedClient(session.access_token);
      const patch = { label: editLabel.trim(), description: editDesc.trim() || null, amount_cents: Math.round(amt * 100) };
      const { data, error: updateError } = await supabase
        .from('addons')
        .update(patch)
        .eq('id', a.id)
        .eq('conference_id', conference.id)
        .select('id');
      if (updateError || !data || data.length !== 1) { setEditErr(friendlyError(updateError, `Could not save ${a.label}. Please try again.`)); return; }
      setAddons(cur => cur.map(x => (x.id === a.id ? { ...x, ...patch } : x)));
      setEditId(null);
    } catch (e) {
      setEditErr(friendlyError(e, `Could not save ${a.label}. Please try again.`));
    } finally {
      setEditBusy(false);
    }
  }

  function handleDelete(a: Addon) {
    if (!session || busyIds.has(a.id) || a.id.startsWith('temp-')) return;
    setAskingId(null);
    setError('');
    clearErr('financials-addons');
    markBusy(a.id, true);
    setAddons(cur => cur.filter(x => x.id !== a.id));

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data, error: deleteError } = await supabase
        .from('addons')
        .delete()
        .eq('id', a.id)
        .eq('conference_id', conference.id)
        .select('id');
      if (deleteError) throw deleteError;
      if (!data || data.length !== 1) throw new Error('add-on not deleted');
    })()
      .catch((e: unknown) => {
        setAddons(cur => [a, ...cur.filter(x => x.id !== a.id)]);
        // The database refuses an add-on someone bought, with its own sentence (hint addon_in_use).
        notifyErr(friendlyError(e, `Could not delete ${a.label}. Please try again.`), 'financials-addons');
      })
      .finally(() => markBusy(a.id, false));
  }

  const canCreate = label.trim().length > 0 && Number(amount) > 0 && !creating;

  return (
    <section className={bare ? undefined : 'mt-8'}>
      {!bare && (
      <div className="flex items-center gap-3 mb-4">
          <NeuIconDisc gradient={NEU_GRADIENTS.sage} icon={Package} emoji="Package" size={36} />
          <div>
            <h2 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 18, color: NEU.ink, lineHeight: 1.15 }}>
              Add-ons
            </h2>
            <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted }}>
              Optional extras applicants can pay for from their invoices. Never required, never gates acceptance.
            </p>
          </div>
        </div>
      )}

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
            <div className="flex items-stretch gap-2">
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
              <CurrencyChip code={conference.fee_currency} width={118} />
            </div>
            <ConferenceCurrencyLine code={conference.fee_currency} slug={conference.slug} style={{ marginTop: 6 }} />
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="addon-target" style={fieldLabelStyle}>Offered to</label>
            <GSelect
              id="addon-target"
              value={appliesTo}
              onChange={setAppliesTo}
              style={inputStyle}
              options={TARGET_OPTIONS}
            />
          </div>

          <div className="flex items-end justify-end gap-3">
            <NeuButton icon={Plus} onClick={handleCreate} disabled={!canCreate}>
              {creating ? 'Creating…' : 'Add'}
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
              const sold = soldFor ? soldFor(a.id) : undefined;
              const linkBtn: React.CSSProperties = { border: 'none', background: 'none', padding: 0, cursor: busy ? 'default' : 'pointer', color: NEU.forest, fontFamily: OUTFIT, fontWeight: 700, fontSize: 12.5, textDecoration: 'underline', textUnderlineOffset: 3 };
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-x-3 gap-y-2 flex-wrap px-5 py-3"
                  style={{ ...(i > 0 ? { borderTop: '1px solid rgba(221,212,192,0.55)' } : {}), opacity: busy ? 0.6 : 1 }}
                >
                  {/* A stopped add-on is faded and marked Stopped, with Sell again (prompt 38). */}
                  <div className="min-w-0" style={{ flex: '1 1 200px', opacity: a.active ? 1 : 0.5 }}>
                    <p className="[overflow-wrap:anywhere]" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.ink }}>
                      {a.label}
                    </p>
                    <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted }}>
                      {targetLabel(a.applies_to)}{!a.active ? ' · Stopped' : ''}
                    </p>
                    {renderStats ? renderStats(a.id) : null}
                  </div>
                  <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', opacity: a.active ? 1 : 0.5 }}>
                    {formatMoney(a.amount_cents / 100, a.currency)}
                  </span>
                  {askingId === a.id ? (
                    <div role="alertdialog" aria-label={`Delete ${a.label}`} className="flex items-center gap-3 flex-wrap" style={{ flexBasis: '100%', fontFamily: OUTFIT, fontSize: 13 }}>
                      <span className="[overflow-wrap:anywhere]" style={{ color: NEU.ink }}>Delete {a.label}? Anyone who picked it and has not paid loses it from their list.</span>
                      <button type="button" disabled={busy} onClick={() => handleDelete(a)} className="focus:outline-none" style={{ ...linkBtn, color: '#8B2020' }}>Delete</button>
                      <button type="button" onClick={() => setAskingId(null)} className="focus:outline-none" style={linkBtn}>Cancel</button>
                    </div>
                  ) : editId !== a.id && (
                    <span className="flex items-center gap-3 flex-wrap">
                      <button type="button" disabled={busy} onClick={() => startEdit(a)} className="focus:outline-none" style={linkBtn}>Edit</button>
                      <button type="button" disabled={busy} onClick={() => handleToggleActive(a)} className="focus:outline-none" style={linkBtn}>
                        {a.active ? 'Stop selling' : 'Sell again'}
                      </button>
                      {sold === 0 && (
                        <button type="button" disabled={busy} onClick={() => { setEditId(null); setAskingId(a.id); }} className="focus:outline-none" style={{ ...linkBtn, color: '#8B2020' }}>Delete</button>
                      )}
                    </span>
                  )}
                  {editId === a.id && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ flexBasis: '100%' }}>
                      <div>
                        <label htmlFor={`addon-edit-label-${a.id}`} style={fieldLabelStyle}>Label</label>
                        <input id={`addon-edit-label-${a.id}`} type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label htmlFor={`addon-edit-desc-${a.id}`} style={fieldLabelStyle}>Description · optional</label>
                        <input id={`addon-edit-desc-${a.id}`} type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)} style={inputStyle} />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor={`addon-edit-amount-${a.id}`} style={fieldLabelStyle}>Amount</label>
                        <div className="flex items-stretch gap-2" style={{ maxWidth: 360 }}>
                          <input id={`addon-edit-amount-${a.id}`} type="number" min={0.01} step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)} style={inputStyle} />
                          <CurrencyChip code={conference.fee_currency} width={118} />
                        </div>
                        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, marginTop: 6 }}>People who picked it and have not paid yet move to the new price. Paid ones keep theirs.</p>
                      </div>
                      {editErr && <p role="alert" className="sm:col-span-2" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, color: '#8B2020', margin: 0 }}>{editErr}</p>}
                      <div className="sm:col-span-2 flex items-center gap-3">
                        <NeuButton onClick={() => { void saveEdit(a); }} disabled={editBusy}>{editBusy ? 'Saving' : 'Save'}</NeuButton>
                        <button type="button" onClick={() => setEditId(null)} className="focus:outline-none" style={linkBtn}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </NeuCard>
        )}
      </div>
    </section>
  );
}
