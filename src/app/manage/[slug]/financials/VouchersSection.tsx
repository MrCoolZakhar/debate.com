'use client';

/**
 * VouchersSection, conference-scoped voucher creation + management for the
 * organiser financials page. Neumorphic (neu.tsx primitives), house
 * optimistic pattern: instant UI, background write, exact rollback, inline
 * #8B2020 errors, control-level busy for the insert (we need the real UUID
 * back before row actions are enabled).
 *
 * Schema: public.vouchers (migration finance_vouchers_entitlements) —
 * organiser RLS is scope='conference' AND is_conference_organizer(conference_id),
 * so every read/write here pins both.
 */

import { useState, useEffect, useCallback } from 'react';
import { Dices, Plus, Ticket, Trash2 } from 'lucide-react';
import type { Conference } from '@/app/manage/[slug]/layout';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useConfirmModal } from '@/components/ConfirmModal';
import { currencySymbol, formatFeeAmount, roundMoney, USD_FX } from '@/lib/finance';
import {
  NEU, NEU_GRADIENTS, OUTFIT, EASE,
  NeuCard, NeuInset, NeuPill, NeuButton, NeuIconDisc, NeuProgress,
} from '@/components/neu';

/** Approximate conversion between two known currencies (via finance.ts's
 *  canonical USD_FX table, no local copy); null when either rate is
 *  missing (callers then fall back to the original amount). */
export function convertApprox(amount: number, from: string, to: string): number | null {
  const rf = USD_FX[from.toUpperCase()];
  const rt = USD_FX[to.toUpperCase()];
  if (!rf || !rt) return null;
  return roundMoney((amount / rf) * rt);
}

// ── Types ──────────────────────────────────────────────────────────────────

interface Voucher {
  id: string;
  code: string;
  kind: 'percent' | 'flat';
  amount: number;
  currency: string | null;
  max_redemptions: number | null;
  redeemed_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Random 8-char code, ambiguous glyphs (0/O, 1/I) excluded. */
function generateCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const rand = new Uint32Array(8);
  crypto.getRandomValues(rand);
  for (let i = 0; i < 8; i++) out += alphabet[rand[i] % alphabet.length];
  return out;
}

function sanitizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Voucher chip label, flat amounts re-display in the chosen currency
 *  (≈-prefixed) when it differs from the voucher's own currency. */
function discountLabel(v: Voucher, displayCurrency?: string): string {
  if (v.kind === 'percent') return `${formatFeeAmount(v.amount)}% OFF`;
  const vCur = v.currency ?? '';
  if (displayCurrency && vCur && displayCurrency.toUpperCase() !== vCur.toUpperCase()) {
    const conv = convertApprox(v.amount, vCur, displayCurrency);
    if (conv !== null) return `≈ ${currencySymbol(displayCurrency)}${formatFeeAmount(conv)} OFF`;
  }
  return `${currencySymbol(vCur)}${formatFeeAmount(v.amount)} OFF`;
}

// Neumorphic input well, pressed-in, transparent field inside.
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 12,
  border: 'none',
  outline: 'none',
  backgroundColor: NEU.base,
  boxShadow: NEU.inSm,
  color: NEU.ink,
  fontFamily: OUTFIT,
  fontSize: 13,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
};

const fieldLabelStyle: React.CSSProperties = {
  fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
  color: NEU.muted, textTransform: 'uppercase', display: 'block', marginBottom: 6,
};

// ── Section ────────────────────────────────────────────────────────────────

export default function VouchersSection({
  conference,
  displayCurrency,
}: {
  conference: Conference;
  /** Display-only currency for flat amounts in the list, creation stays in
   *  the conference currency regardless. */
  displayCurrency?: string;
}) {
  const { session, user } = useAuth();
  const { confirm, modal: confirmModal } = useConfirmModal();

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create form state
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<'percent' | 'flat'>('percent');
  const [amount, setAmount] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [expiry, setExpiry] = useState('');
  const [active, setActive] = useState(true);
  const [creating, setCreating] = useState(false);

  // Voucher ids with a write in flight, double-click guard for row actions.
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  function markBusy(id: string, busy: boolean) {
    setBusyIds(prev => {
      const next = new Set(prev);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  }

  const loadVouchers = useCallback(async () => {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('vouchers')
      .select('id, code, kind, amount, currency, max_redemptions, redeemed_count, expires_at, active, created_at')
      .eq('scope', 'conference')
      .eq('conference_id', conference.id)
      .order('created_at', { ascending: false });
    setVouchers((data ?? []) as Voucher[]);
    setLoading(false);
  }, [conference.id, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadVouchers(); }, [loadVouchers]);

  // ── Create, optimistic append (temp row), replace with the real UUID row
  // on success, remove exactly the temp row on failure. The CREATE button is
  // the busy control while the insert returns the id.
  function handleCreate() {
    if (!session || !user || creating) return;
    const trimmed = sanitizeCode(code.trim());
    const amt = Number(amount);
    if (trimmed.length < 3) { setError('Voucher codes need at least 3 characters.'); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setError('Enter a discount amount greater than zero.'); return; }
    if (kind === 'percent' && amt > 100) { setError('Percentage discounts can be at most 100%.'); return; }
    if (vouchers.some(v => v.code === trimmed)) { setError(`Code ${trimmed} already exists on this conference.`); return; }
    const maxRed = maxRedemptions.trim() === '' ? null : Math.floor(Number(maxRedemptions));
    if (maxRed !== null && (!Number.isFinite(maxRed) || maxRed < 1)) { setError('Max redemptions must be a whole number of at least 1.'); return; }
    const expiresAt = expiry ? new Date(`${expiry}T23:59:59`).toISOString() : null;

    setError('');
    setCreating(true);

    const tempId = `temp-${Date.now()}`;
    const optimistic: Voucher = {
      id: tempId, code: trimmed, kind, amount: amt,
      currency: kind === 'flat' ? conference.fee_currency : null,
      max_redemptions: maxRed, redeemed_count: 0,
      expires_at: expiresAt, active, created_at: new Date().toISOString(),
    };
    setVouchers(cur => [optimistic, ...cur]);

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { data, error: insertError } = await supabase
        .from('vouchers')
        .insert({
          scope: 'conference',
          conference_id: conference.id,
          code: trimmed,
          kind,
          amount: amt,
          currency: kind === 'flat' ? conference.fee_currency : null,
          max_redemptions: maxRed,
          expires_at: expiresAt,
          active,
          created_by: user.id,
        })
        .select('id, code, kind, amount, currency, max_redemptions, redeemed_count, expires_at, active, created_at')
        .single();
      if (insertError || !data) throw insertError ?? new Error('insert returned no row');

      // Swap the temp row for the real one (real UUID enables row actions).
      setVouchers(cur => cur.map(v => (v.id === tempId ? (data as Voucher) : v)));
      // Reset the form for the next code.
      setCode(''); setAmount(''); setMaxRedemptions(''); setExpiry(''); setActive(true);
    })()
      .catch((e: unknown) => {
        setVouchers(cur => cur.filter(v => v.id !== tempId));
        const isDuplicate = typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505';
        setError(isDuplicate
          ? `Code ${trimmed} is already taken, try another.`
          : 'Could not create the voucher, it was removed from the list. Please try again.');
      })
      .finally(() => setCreating(false));
  }

  // ── Toggle active, optimistic flip, exact revert on failure.
  function handleToggleActive(v: Voucher) {
    if (!session || busyIds.has(v.id) || v.id.startsWith('temp-')) return;
    const prev = v.active;
    setError('');
    markBusy(v.id, true);
    setVouchers(cur => cur.map(x => (x.id === v.id ? { ...x, active: !prev } : x)));

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error: updateError } = await supabase
        .from('vouchers')
        .update({ active: !prev })
        .eq('id', v.id)
        .eq('scope', 'conference')
        .eq('conference_id', conference.id);
      if (updateError) throw updateError;
    })()
      .catch(() => {
        setVouchers(cur => cur.map(x => (x.id === v.id ? { ...x, active: prev } : x)));
        setError(`Could not ${prev ? 'deactivate' : 'activate'} ${v.code}, the change was reverted.`);
      })
      .finally(() => markBusy(v.id, false));
  }

  // ── Delete, only at 0 redemptions (redeemed vouchers deactivate instead,
  // so redemption history stays intact). Confirm first, optimistic remove,
  // restore the exact row on failure.
  async function handleDelete(v: Voucher) {
    if (!session || busyIds.has(v.id) || v.id.startsWith('temp-') || v.redeemed_count > 0) return;
    const { confirmed } = await confirm({
      title: `Delete voucher ${v.code}?`,
      body: 'It has never been redeemed, so it can be removed permanently. Participants will no longer be able to apply it.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    setError('');
    markBusy(v.id, true);
    setVouchers(cur => cur.filter(x => x.id !== v.id));

    (async () => {
      const supabase = getAuthedClient(session.access_token);
      const { error: deleteError } = await supabase
        .from('vouchers')
        .delete()
        .eq('id', v.id)
        .eq('scope', 'conference')
        .eq('conference_id', conference.id)
        .eq('redeemed_count', 0); // server-side guard against a racing redemption
      if (deleteError) throw deleteError;
    })()
      .catch(() => {
        setVouchers(cur => [v, ...cur.filter(x => x.id !== v.id)]);
        setError(`Could not delete ${v.code}, it was restored. Please try again.`);
      })
      .finally(() => markBusy(v.id, false));
  }

  const symbol = currencySymbol(conference.fee_currency);
  const codeValid = sanitizeCode(code.trim()).length >= 3;
  const amountValid = Number(amount) > 0 && (kind !== 'percent' || Number(amount) <= 100);
  const canCreate = codeValid && amountValid && !creating;

  return (
    <section className="mt-8">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <NeuIconDisc gradient={NEU_GRADIENTS.gold} icon={Ticket} emoji="Ticket" size={36} />
        <div>
          <h2 style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 18, color: NEU.ink, lineHeight: 1.15 }}>
            Vouchers
          </h2>
          <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted }}>
            Discount codes participants can apply at signup, scoped to {conference.acronym} only.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs font-semibold mb-3" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
          {error}
        </p>
      )}

      {/* ── Create card ── */}
      <NeuCard style={{ padding: '18px 20px' }}>
        <p style={{ ...fieldLabelStyle, color: NEU.deepGold, marginBottom: 12 }}>New voucher</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Code + generate */}
          <div className="lg:col-span-2">
            <label htmlFor="voucher-code" style={fieldLabelStyle}>Code</label>
            <div className="flex items-center gap-2">
              <input
                id="voucher-code"
                type="text"
                value={code}
                onChange={e => setCode(sanitizeCode(e.target.value))}
                placeholder="EARLYBIRD"
                spellCheck={false}
                style={{ ...inputStyle, letterSpacing: '0.08em', fontWeight: 800 }}
              />
              <button
                type="button"
                onClick={() => setCode(generateCode())}
                title="Generate a random code"
                className="inline-flex items-center gap-1.5 flex-shrink-0 focus:outline-none"
                style={{
                  padding: '8px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  backgroundColor: NEU.surface, boxShadow: NEU.outSm, color: NEU.forest,
                  fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                  transition: `box-shadow 200ms ${EASE}`,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; }}
              >
                <Dices size={13} strokeWidth={2.4} />
                GENERATE
              </button>
            </div>
          </div>

          {/* Kind toggle */}
          <div>
            <span style={fieldLabelStyle}>Discount type</span>
            <div className="flex items-center gap-2" style={{ paddingTop: 3 }}>
              <NeuPill active={kind === 'percent'} gradient={NEU_GRADIENTS.forest} onClick={() => setKind('percent')}>
                PERCENT
              </NeuPill>
              <NeuPill active={kind === 'flat'} gradient={NEU_GRADIENTS.forest} onClick={() => setKind('flat')}>
                FLAT {conference.fee_currency}
              </NeuPill>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="voucher-amount" style={fieldLabelStyle}>
              {kind === 'percent' ? 'Amount (%)' : `Amount (${symbol || conference.fee_currency})`}
            </label>
            <div className="relative">
              <input
                id="voucher-amount"
                type="number"
                min={kind === 'percent' ? 1 : 0.01}
                max={kind === 'percent' ? 100 : undefined}
                step={kind === 'percent' ? 1 : 0.01}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={kind === 'percent' ? '20' : '10'}
                style={{ ...inputStyle, paddingRight: 34 }}
              />
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, color: NEU.muted }}
              >
                {kind === 'percent' ? '%' : symbol || conference.fee_currency}
              </span>
            </div>
          </div>

          {/* Max redemptions */}
          <div>
            <label htmlFor="voucher-max" style={fieldLabelStyle}>Max redemptions · optional</label>
            <input
              id="voucher-max"
              type="number"
              min={1}
              step={1}
              value={maxRedemptions}
              onChange={e => setMaxRedemptions(e.target.value)}
              placeholder="Unlimited"
              style={inputStyle}
            />
          </div>

          {/* Expiry */}
          <div>
            <label htmlFor="voucher-expiry" style={fieldLabelStyle}>Expiry date · optional</label>
            <input
              id="voucher-expiry"
              type="date"
              value={expiry}
              onChange={e => setExpiry(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Active toggle + create */}
          <div className="lg:col-span-2 flex items-end justify-between gap-3 flex-wrap">
            <div>
              <span style={fieldLabelStyle}>Status</span>
              <div className="flex items-center gap-2" style={{ paddingTop: 3 }}>
                <NeuPill active={active} gradient={NEU_GRADIENTS.green} onClick={() => setActive(true)}>
                  ACTIVE
                </NeuPill>
                <NeuPill active={!active} gradient={NEU_GRADIENTS.amber} onClick={() => setActive(false)}>
                  INACTIVE
                </NeuPill>
              </div>
            </div>
            <NeuButton icon={Plus} onClick={handleCreate} disabled={!canCreate}>
              {creating ? 'CREATING…' : 'CREATE VOUCHER'}
            </NeuButton>
          </div>
        </div>
      </NeuCard>

      {/* ── Voucher list ── */}
      <div className="mt-4">
        {loading ? (
          <NeuInset small className="animate-pulse" style={{ height: 64 }}><span /></NeuInset>
        ) : vouchers.length === 0 ? (
          <NeuInset className="flex flex-col items-center text-center px-6 py-8">
            <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.ink }}>
              No vouchers yet
            </p>
            <p className="mt-1 max-w-sm" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted, lineHeight: 1.55 }}>
              Create your first code above, early-bird discounts and partner codes are the usual starting points.
            </p>
          </NeuInset>
        ) : (
          <div className="flex flex-col gap-2.5">
            {vouchers.map(v => {
              const rowBusy = busyIds.has(v.id) || v.id.startsWith('temp-');
              const expired = !!v.expires_at && new Date(v.expires_at).getTime() < Date.now();
              const exhausted = v.max_redemptions !== null && v.redeemed_count >= v.max_redemptions;
              const live = v.active && !expired && !exhausted;
              return (
                <NeuCard key={v.id} style={{ padding: '12px 16px', opacity: rowBusy ? 0.6 : live ? 1 : 0.78 }}>
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Code */}
                    <span
                      style={{
                        fontFamily: OUTFIT, fontWeight: 900, fontSize: 14, color: NEU.ink,
                        letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums', minWidth: 110,
                      }}
                    >
                      {v.code}
                    </span>

                    {/* Kind/amount chip */}
                    <NeuPill gradient={NEU_GRADIENTS.gold} active>
                      {discountLabel(v, displayCurrency)}
                    </NeuPill>

                    {/* Redemptions */}
                    <span className="inline-flex items-center gap-2" style={{ minWidth: 120 }}>
                      <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 700, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
                        {v.redeemed_count}/{v.max_redemptions ?? '∞'}
                      </span>
                      {v.max_redemptions !== null && (
                        <NeuProgress
                          value={v.redeemed_count}
                          max={v.max_redemptions}
                          height={7}
                          gradient={exhausted ? NEU_GRADIENTS.amber : NEU_GRADIENTS.forest}
                          style={{ width: 64 }}
                        />
                      )}
                      {exhausted && (
                        <span style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: NEU.amber }}>
                          FULL
                        </span>
                      )}
                    </span>

                    {/* Expiry */}
                    <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: expired ? '#8B2020' : NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
                      {v.expires_at ? `${expired ? 'Expired' : 'Expires'} ${formatExpiry(v.expires_at)}` : 'No expiry'}
                    </span>

                    <span className="flex-1" />

                    {/* Active toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(v)}
                      disabled={rowBusy}
                      title={v.active
                        ? (v.redeemed_count > 0 ? 'Deactivate, redeemed vouchers are kept for history, not deleted' : 'Deactivate')
                        : 'Reactivate'}
                      className="focus:outline-none"
                      style={{
                        padding: '4px 12px', borderRadius: 999, border: 'none',
                        cursor: rowBusy ? 'default' : 'pointer',
                        fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                        background: v.active
                          ? `linear-gradient(135deg, ${NEU_GRADIENTS.green[0]}, ${NEU_GRADIENTS.green[1]})`
                          : NEU.base,
                        color: v.active ? '#FFFFFF' : NEU.muted,
                        boxShadow: v.active ? `0 3px 8px ${NEU_GRADIENTS.green[0]}55, ${NEU.outSm}` : NEU.inSm,
                        transition: `box-shadow 200ms ${EASE}`,
                      }}
                    >
                      {v.active ? 'ACTIVE' : 'INACTIVE'}
                    </button>

                    {/* Delete, only when never redeemed */}
                    {v.redeemed_count === 0 && (
                      <button
                        type="button"
                        onClick={() => handleDelete(v)}
                        disabled={rowBusy}
                        aria-label={`Delete voucher ${v.code}`}
                        title="Delete (never redeemed)"
                        className="inline-flex items-center justify-center focus:outline-none"
                        style={{
                          width: 28, height: 28, borderRadius: 10, border: 'none',
                          cursor: rowBusy ? 'default' : 'pointer',
                          backgroundColor: 'rgba(139,32,32,0.08)', color: '#8B2020',
                        }}
                      >
                        <Trash2 size={13} strokeWidth={2.2} />
                      </button>
                    )}
                  </div>
                </NeuCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Footnote */}
      <p className="mt-3" style={{ fontFamily: OUTFIT, fontSize: 10.5, color: NEU.muted, lineHeight: 1.6 }}>
        Discounts apply at signup.
      </p>

      {confirmModal}
    </section>
  );
}
