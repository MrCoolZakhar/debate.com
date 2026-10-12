'use client';

// payPanels.tsx — the /pay page's existing pop-ups and panels, MOVED here
// unchanged from page.tsx in prompt 95 (their RPCs, validation, verified
// writes and busy guards are exactly as they were): AddonsModal,
// AddSpotsPanel, AdvisorTicketsModal, ProofUploadModal, ManualPayAction,
// PaymentsNotSetUp and the small helpers they share. The page around them was
// rebuilt on my_pay_overview.


import { useRef, useState } from 'react';
import { Clock, GraduationCap, ImageUp, Minus, Plus, Users2, X } from 'lucide-react';
import { getAuthedClient } from '@/lib/supabase-auth';
import { activePhaseFee, type FeePhase } from '@/lib/finance';
import { reportBlocked } from '@/lib/reportCrash';
import { type InvoiceRow, centsToFee, isInvoiceSettled } from '@/lib/invoices';
import { ModalOverlay, MODAL_PANEL_MAX_HEIGHT } from '@/components/CommitteeEditorModal';
import { NEU, NEU_GRADIENTS, OUTFIT, NeuCard, NeuIconDisc, type NeuGradient } from '@/components/neu';
import { type ConferenceTheme } from '@/lib/theme';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import PayActionPopup from '../participant/PayActionPopup';
import { safeStorageKey } from '@/lib/storageKey';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PayConference {
  id: string;
  full_name: string;
  acronym: string | null;
  fee_currency: string;
  contact_email: string | null;
  payment_method: string | null;
  connect_onboarding_status: string;
  /** Gavelling's own Stripe account collects card payments (no Connect). */
  platform_collects: boolean | null;
  external_payment_url: string | null;
  external_payment_note: string | null;
  financial_aid_enabled: boolean;
  aid_questions: unknown[];
  aid_intro: string | null;
  theme: ConferenceTheme | null;
}

export interface PayApplication {
  id: string;
  role: string;
  status: string;
  payment_status: string;
  amount_paid: number;
  society_id: string | null;
  pledge_type: 'delegation' | null;
  spots_pledged: number | null;
  pledge_confirmed_at: string | null;
}

export interface PayRoleConfig {
  role: string;
  fee_amount: number | null;
  fee_currency: string | null;
  fee_phases: FeePhase[] | null;
  payment_timing: string;
}

export interface AidRequestRow {
  status: 'pending' | 'approved' | 'denied';
  granted_amount: number | null;
}

export interface ActiveAddon {
  id: string;
  label: string;
  description: string | null;
  amount_cents: number;
  currency: string;
}



// State marks are an icon plus a plain word (CLAUDE.md §8): no pill, no capitals.



// ── Small shared pieces ──────────────────────────────────────────────────────


const NOTE_TONES = {
  amber: { color: '#B8844A', bg: 'rgba(184,132,74,0.1)', border: 'rgba(184,132,74,0.24)' },
  green: { color: '#2A5A3C', bg: 'rgba(61,122,82,0.1)', border: 'rgba(61,122,82,0.24)' },
  muted: { color: '#6E5F4E', bg: 'rgba(154,138,120,0.1)', border: 'rgba(154,138,120,0.24)' },
  red: { color: '#8B2020', bg: 'rgba(139,32,32,0.08)', border: 'rgba(139,32,32,0.22)' },
} as const;

export function Note({ tone, children }: { tone: keyof typeof NOTE_TONES; children: React.ReactNode }) {
  const t = NOTE_TONES[tone];
  return (
    <p
      className="text-[13px] rounded-xl px-4 py-3"
      style={{ color: t.color, fontFamily: OUTFIT, backgroundColor: t.bg, border: `1px solid ${t.border}`, lineHeight: 1.6 }}
    >
      {children}
    </p>
  );
}

// Shown wherever a delegate reaches a payable invoice but the organizer's
// financial setup isn't ready yet — grandfathered conferences may never
// finish this, so the copy points the delegate at the organizer rather than
// asking them to wait for something that might not arrive.
export function PaymentsNotSetUp({ contactEmail }: { contactEmail: string | null }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(184,132,74,0.1)', border: '1px solid rgba(184,132,74,0.24)' }}>
      <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: '#B8844A' }}>This conference has not set up payments yet</p>
      <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, marginTop: 4, lineHeight: 1.6 }}>
        The organizing team has not finished their payment setup, so there is nothing to pay here yet. Contact them and they can sort it out.
      </p>
      {contactEmail && (
        <a
          href={`mailto:${contactEmail}`}
          className="inline-block mt-2"
          style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: '#B8844A', textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          {contactEmail}
        </a>
      )}
    </div>
  );
}

type ActionIcon = React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;

export function ActionRow({
  icon: Icon, gradient, title, subtitle, dimmed = false, onClick,
}: {
  icon: ActionIcon;
  gradient: NeuGradient;
  title: string;
  subtitle?: string;
  /** Visually dimmed (unavailable), but still clickable — the click shows an
   *  explanatory message instead of opening the feature. Right-column
   *  buttons are never hidden, only dimmed. */
  dimmed?: boolean;
  onClick?: () => void;
}) {
  return (
    <NeuCard
      hover
      onClick={onClick}
      style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, opacity: dimmed ? 0.55 : 1 }}
    >
      <NeuIconDisc gradient={gradient} icon={Icon} size={38} />
      <div className="flex-1 min-w-0">
        <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 13.5, color: NEU.ink, margin: 0 }}>{title}</p>
        {subtitle && (
          <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, margin: '2px 0 0 0' }}>{subtitle}</p>
        )}
      </div>
    </NeuCard>
  );
}

// ── Manual payment action, shared by every manual-mode pay surface ─────────
// A manual-mode invoice (or the combined selected batch) either already has
// a proof under review — a quiet status chip, nothing to click — or it
// doesn't, in which case "I HAVE PAID, UPLOAD PROOF" is the one primary
// action; the organizing team's own payment page (when they've set one) is
// secondary guidance above it, not the dead end it used to be.

export function ManualPayAction({
  awaitingReview, externalPaymentUrl, externalPaymentNote, onUploadProof,
}: {
  awaitingReview: boolean;
  externalPaymentUrl: string | null;
  externalPaymentNote: string | null;
  onUploadProof: () => void;
}) {
  if (awaitingReview) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(184,132,74,0.1)', border: '1px solid rgba(184,132,74,0.24)' }}>
        <Clock size={15} style={{ color: '#B8844A', flexShrink: 0 }} />
        <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: '#8A6614', fontWeight: 700, margin: 0 }}>
          Proof submitted, awaiting review
        </p>
      </div>
    );
  }
  return (
    <>
      {externalPaymentUrl && (
        <>
          <p className="mb-2" style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, lineHeight: 1.6 }}>
            Pay through the conference&apos;s own payment page, then come back and upload your proof.
          </p>
          <a
            href={externalPaymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 mb-3 font-bold text-sm focus:outline-none"
            style={{ border: '1.5px solid var(--gv-border)', color: NEU.ink, fontFamily: OUTFIT, textDecoration: 'none' }}
          >
            Go to payment page
          </a>
        </>
      )}
      {externalPaymentNote && (
        <p className="mb-3" style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {externalPaymentNote}
        </p>
      )}
      <button
        onClick={onUploadProof}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm focus:outline-none"
        style={{ backgroundColor: NEU.forest, color: NEU.gold, fontFamily: OUTFIT, border: 'none', cursor: 'pointer' }}
      >
        <ImageUp size={15} />
        I have paid, upload proof
      </button>
    </>
  );
}

// ── Buy Add-ons modal ────────────────────────────────────────────────────────
// Opt-in selection: checkbox + quantity stepper per active addon, pre-filled
// from the applicant's existing UNPAID addon invoices. Already-purchased
// (settled) addons show read-only. Save reconciles via set_addon_selection —
// paid invoices are never touched by that RPC, so purchased rows are simply
// excluded from the payload entirely.

interface AddonSelection {
  checked: boolean;
  quantity: number;
}

export function AddonsModal({
  open, onClose, addons, invoices, applicationId, accessToken, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  addons: ActiveAddon[];
  invoices: InvoiceRow[];
  applicationId: string;
  accessToken: string | undefined;
  onSaved: () => void;
}) {
  const [selections, setSelections] = useState<Record<string, AddonSelection>>({});
  const [purchased, setPurchased] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Re-seeds from `invoices` every time the modal opens — a state-adjustment-
  // during-render (compared against a `prevOpen` snapshot) rather than a
  // useEffect, same fix as AidRequestModal's page reset: this modal stays
  // mounted across opens (the caller just flips `open`), so an effect here
  // would fire a render late and cascade.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setError('');
      const nextSelections: Record<string, AddonSelection> = {};
      const nextPurchased = new Set<string>();
      for (const addon of addons) {
        const existing = invoices.find(inv => inv.kind === 'addon' && inv.config_id === addon.id);
        if (existing && isInvoiceSettled(existing)) {
          nextPurchased.add(addon.id);
          nextSelections[addon.id] = { checked: true, quantity: existing.quantity || 1 };
        } else {
          nextSelections[addon.id] = { checked: !!existing, quantity: existing?.quantity || 1 };
        }
      }
      setSelections(nextSelections);
      setPurchased(nextPurchased);
    }
  }

  if (!open) return null;

  function toggleChecked(addonId: string) {
    if (purchased.has(addonId)) return;
    setSelections(prev => ({ ...prev, [addonId]: { ...prev[addonId], checked: !prev[addonId]?.checked } }));
  }

  function setQuantity(addonId: string, quantity: number) {
    if (purchased.has(addonId)) return;
    setSelections(prev => ({ ...prev, [addonId]: { ...prev[addonId], quantity: Math.max(1, quantity) } }));
  }

  async function handleSave() {
    if (saving || !accessToken) return;
    setSaving(true);
    setError('');
    const supabase = getAuthedClient(accessToken);
    const p_selections = Object.entries(selections)
      .filter(([addonId, sel]) => sel.checked && !purchased.has(addonId))
      .map(([addonId, sel]) => ({ addon_id: addonId, quantity: sel.quantity }));
    const { data, error: rpcError } = await supabase.rpc('set_addon_selection', {
      p_application_id: applicationId,
      p_selections,
    });
    const result = data as { ok?: boolean; error?: string } | null;
    setSaving(false);
    if (rpcError || !result?.ok) {
      setError((result?.error ? plainOrFallback(result.error, 'Could not save your add-ons. Please try again.') : friendlyError(rpcError, 'Could not save your add-ons. Please try again.')));
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <PayActionPopup
      title="Buy Add-ons"
      line="Optional extras this conference offers. They are added to what you pay."
      onClose={() => { if (!saving) onClose(); }}
      testId="pay-addons"
    >

        {addons.length === 0 ? (
          <p style={{ fontFamily: OUTFIT, fontSize: 13, color: '#6E5F4E' }}>
            This conference hasn&apos;t added any add-ons yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {addons.map(addon => {
              const sel = selections[addon.id] ?? { checked: false, quantity: 1 };
              const isPurchased = purchased.has(addon.id);
              const inputId = `addon-${addon.id}`;
              return (
                <div
                  key={addon.id}
                  className="rounded-xl px-4 py-3"
                  style={{ border: '1px solid var(--gv-border)', backgroundColor: sel.checked || isPurchased ? 'color-mix(in srgb, var(--gv-main) 3%, transparent)' : '#FFFFFF' }}
                >
                  <div className="flex items-start gap-3">
                    {/* 44px tap target around the 18px box. The name/price/description
                        below carry the <label htmlFor>, so tapping any of them toggles
                        the add-on and the checkbox finally has an accessible name.
                        The quantity stepper deliberately sits OUTSIDE that label —
                        a button inside a label also fires the label's toggle. */}
                    <span
                      className="flex items-center justify-center flex-shrink-0"
                      style={{ width: 44, height: 44, marginTop: -12, marginBottom: -12, marginLeft: -14, marginRight: -14 }}
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={sel.checked}
                        disabled={isPurchased}
                        onChange={() => toggleChecked(addon.id)}
                        style={{ width: 18, height: 18, accentColor: 'var(--gv-main)', cursor: isPurchased ? 'default' : 'pointer' }}
                      />
                    </span>
                    <div className="flex-1 min-w-0">
                      <label htmlFor={inputId} className="block" style={{ cursor: isPurchased ? 'default' : 'pointer' }}>
                        <div className="flex items-center justify-between gap-2">
                          <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 13.5, color: 'var(--gv-on-surface)' }}>{addon.label}</p>
                          <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: 'var(--gv-on-surface)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                            {centsToFee(addon.amount_cents, addon.currency)}
                            <span style={{ color: 'var(--gv-muted)', fontWeight: 600 }}> ea.</span>
                          </span>
                        </div>
                        {addon.description && (
                          <p className="mt-0.5" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: 'var(--gv-muted)', lineHeight: 1.5 }}>
                            {addon.description}
                          </p>
                        )}
                      </label>

                      {isPurchased ? (
                        <p className="mt-2 inline-flex items-center gap-1" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, color: '#2A5A3C' }}>
                          Purchased ✓
                        </p>
                      ) : sel.checked && (
                        <div className="mt-2.5 flex items-center gap-2.5">
                          <span style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, color: 'var(--gv-muted)', letterSpacing: '0.06em' }}>
                            QTY
                          </span>
                          {/* 44px tap targets: these were 24px, below the minimum for
                              a finger, on the one flow that takes money. */}
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Fewer ${addon.label}`}
                              onClick={() => setQuantity(addon.id, sel.quantity - 1)}
                              disabled={sel.quantity <= 1}
                              className="flex items-center justify-center rounded-full focus:outline-none"
                              style={{ width: 44, height: 44, border: 'none', background: 'none', color: sel.quantity <= 1 ? 'var(--gv-border)' : 'var(--gv-main)', cursor: sel.quantity <= 1 ? 'default' : 'pointer' }}
                            >
                              <span className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, border: '1px solid var(--gv-border)', backgroundColor: 'var(--gv-surface)' }}>
                                <Minus size={14} />
                              </span>
                            </button>
                            <span style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 800, color: 'var(--gv-on-surface)', minWidth: 20, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                              {sel.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label={`More ${addon.label}`}
                              onClick={() => setQuantity(addon.id, sel.quantity + 1)}
                              className="flex items-center justify-center rounded-full focus:outline-none"
                              style={{ width: 44, height: 44, border: 'none', background: 'none', color: 'var(--gv-main)', cursor: 'pointer' }}
                            >
                              <span className="flex items-center justify-center rounded-full" style={{ width: 28, height: 28, border: '1px solid var(--gv-border)', backgroundColor: 'var(--gv-surface)' }}>
                                <Plus size={14} />
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div><Note tone="red">{error}</Note></div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => { if (!saving) onClose(); }}
            disabled={saving}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
            style={{ border: '1.5px solid var(--gv-border)', color: 'var(--gv-on-surface)', backgroundColor: 'transparent', fontFamily: OUTFIT, cursor: saving ? 'default' : 'pointer' }}
          >
            Cancel
          </button>
          {addons.length > 0 && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
              style={{
                backgroundColor: saving ? 'var(--gv-border)' : 'var(--gv-main)',
                color: saving ? 'var(--gv-muted)' : 'var(--gv-on-main)',
                fontFamily: OUTFIT, cursor: saving ? 'default' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
    </PayActionPopup>
  );
}

// ── Add delegation spots ─────────────────────────────────────────────────────
// Pledges MORE spots for the leader's delegation via add_pledged_spots, which
// materializes each new spot as an owed pledge_spot invoice — no payment
// happens here, the new invoices just appear in the list above (genericInvoices)
// once onAdded triggers a refetch.

export function AddSpotsPanel({
  applicationId, accessToken, onAdded,
}: {
  applicationId: string;
  accessToken: string | undefined;
  onAdded: () => void;
}) {
  // Held as '' while the field is momentarily empty. Clamping to 1 on every
  // keystroke meant backspace-then-type produced "15" when the delegate meant
  // "5": they cleared the field, it snapped back to 1, and their digit landed
  // after it. Normalised on blur instead.
  const [count, setCount] = useState<number | ''>(1);
  const countNum = count === '' ? 0 : count;
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<number | null>(null);

  async function handleAdd() {
    if (adding || !accessToken || countNum < 1) return;
    setAdding(true);
    setError(null);
    setJustAdded(null);
    const supabase = getAuthedClient(accessToken);
    const { data, error: rpcError } = await supabase.rpc('add_pledged_spots', {
      p_application_id: applicationId,
      p_count: countNum,
    });
    const result = data as { ok?: boolean; spots_pledged?: number; error?: string } | null;
    setAdding(false);
    if (rpcError || !result?.ok) {
      setError((result?.error ? plainOrFallback(result.error, 'Could not add spots. Please try again.') : friendlyError(rpcError, 'Could not add spots. Please try again.')));
      return;
    }
    setJustAdded(countNum);
    setCount(1);
    onAdded();
  }

  return (
    <NeuCard style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="flex items-center gap-3">
        <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Users2} size={36} />
        <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 13, color: NEU.ink, margin: 0 }}>Add Delegation Spots</p>
      </div>
      <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted, margin: 0, lineHeight: 1.5 }}>
        Pledge more spots for your delegation. Each becomes a payable invoice above.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={count}
          onChange={e => {
            const raw = e.target.value;
            if (raw === '') { setCount(''); return; }
            const n = parseInt(raw, 10);
            setCount(Number.isNaN(n) ? '' : Math.max(1, n));
          }}
          onBlur={() => { if (count === '') setCount(1); }}
          aria-label="Number of spots to pledge"
          className="rounded-xl text-base sm:text-sm text-center focus:outline-none"
          style={{ width: 64, height: 44, border: 'none', backgroundColor: NEU.base, boxShadow: NEU.inSm, color: NEU.ink, fontFamily: OUTFIT, fontWeight: 700 }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || countNum < 1}
          className="flex-1 rounded-xl text-xs font-bold focus:outline-none"
          style={{
            border: 'none', minHeight: 44,
            backgroundColor: adding || countNum < 1 ? 'var(--gv-border)' : NEU.forest,
            color: adding || countNum < 1 ? 'var(--gv-muted)' : NEU.gold,
            fontFamily: OUTFIT, cursor: adding || countNum < 1 ? 'default' : 'pointer',
          }}
        >
          {adding ? 'Adding…' : 'Add'}
        </button>
      </div>
      {justAdded && !error && (
        <Note tone="green">{`Added ${justAdded} spot${justAdded === 1 ? '' : 's'}. Check the invoices above.`}</Note>
      )}
      {error && <Note tone="red">{error}</Note>}
    </NeuCard>
  );
}

// ── Buy Advisor Tickets modal ────────────────────────────────────────────────
// Priced server-side at the faculty-advisor role's active phase fee, pooled
// per delegation exactly like delegate spots. add_pledged_advisor_spots
// materializes each ticket as an owed advisor_spot invoice — nothing is
// charged here, the new invoices just appear in the generic list once
// onAdded triggers a refetch.

export function AdvisorTicketsModal({
  open, onClose, applicationId, accessToken, advisorRoleConfig, onAdded, summary,
}: {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  accessToken: string | undefined;
  advisorRoleConfig: PayRoleConfig | null;
  onAdded: () => void;
  /** Drawn at the top: the advisor tickets the delegation's leaders have requested (prompt 101). */
  summary?: React.ReactNode;
}) {
  // '' while the field is momentarily empty — see AddSpotsPanel above.
  const [count, setCount] = useState<number | ''>(1);
  const countNum = count === '' ? 0 : count;
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resets every time the modal opens — state-adjustment-during-render, same
  // fix as AddonsModal (this modal stays mounted across opens, the caller
  // just flips `open`).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) { setCount(1); setError(null); }
  }

  if (!open) return null;

  const currency = advisorRoleConfig?.fee_currency ?? 'USD';
  const { amount: fee, phase } = activePhaseFee({
    fee_amount: advisorRoleConfig?.fee_amount ?? 0,
    fee_phases: advisorRoleConfig?.fee_phases ?? null,
  });

  async function handleAdd() {
    if (adding || !accessToken || countNum < 1) return;
    setAdding(true);
    setError(null);
    const supabase = getAuthedClient(accessToken);
    const { data, error: rpcError } = await supabase.rpc('add_pledged_advisor_spots', {
      p_application_id: applicationId,
      p_count: countNum,
    });
    const result = data as { ok?: boolean; error?: string } | null;
    setAdding(false);
    if (rpcError || !result?.ok) {
      setError((result?.error ? plainOrFallback(result.error, 'Could not add advisor tickets. Please try again.') : friendlyError(rpcError, 'Could not add advisor tickets. Please try again.')));
      return;
    }
    onAdded();
    onClose();
  }

  return (
    <PayActionPopup
      title="Buy Advisor Tickets"
      line="Tickets for the faculty advisors travelling with your delegation."
      onClose={() => { if (!adding) onClose(); }}
      testId="pay-advisors"
    >
        {summary}

        <div className="flex items-center gap-3" style={{ padding: '12px 14px', borderRadius: 14, backgroundColor: NEU.base, boxShadow: NEU.inSm }}>
          <NeuIconDisc gradient={NEU_GRADIENTS.amber} icon={GraduationCap} size={38} />
          <div className="flex-1 min-w-0">
            <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14, color: NEU.ink, margin: 0 }}>
              {fee > 0 ? `${centsToFee(Math.round(fee * 100), currency)} each` : 'Free'}
            </p>
            {phase && (
              <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, color: NEU.deepGold, letterSpacing: '0.04em', margin: '2px 0 0 0' }}>
                {phase.label.toUpperCase()} PRICING
              </p>
            )}
          </div>
        </div>

        <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: 'var(--gv-muted)', lineHeight: 1.5, margin: 0 }}>
          Tickets stay with your delegation once purchased, pooled the same way as delegate spots.
        </p>

        <div>
          <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: 'var(--gv-muted)', fontFamily: OUTFIT, letterSpacing: '0.06em' }}>
            HOW MANY TICKETS
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Fewer advisor tickets"
              onClick={() => setCount(c => Math.max(1, (c === '' ? 1 : c) - 1))}
              disabled={countNum <= 1}
              className="flex items-center justify-center rounded-full focus:outline-none"
              style={{ width: 44, height: 44, border: 'none', background: 'none', color: countNum <= 1 ? 'var(--gv-border)' : 'var(--gv-main)', cursor: countNum <= 1 ? 'default' : 'pointer' }}
            >
              <span className="flex items-center justify-center rounded-full" style={{ width: 32, height: 32, border: '1px solid var(--gv-border)', backgroundColor: 'var(--gv-surface)' }}>
                <Minus size={14} />
              </span>
            </button>
            <input
              type="number"
              min={1}
              value={count}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') { setCount(''); return; }
                const n = parseInt(raw, 10);
                setCount(Number.isNaN(n) ? '' : Math.max(1, n));
              }}
              onBlur={() => { if (count === '') setCount(1); }}
              aria-label="Number of advisor tickets"
              className="rounded-xl text-base sm:text-sm text-center focus:outline-none"
              style={{ width: 64, height: 44, border: 'none', backgroundColor: NEU.base, boxShadow: NEU.inSm, color: NEU.ink, fontFamily: OUTFIT, fontWeight: 700 }}
            />
            <button
              type="button"
              aria-label="More advisor tickets"
              onClick={() => setCount(c => (c === '' ? 1 : c + 1))}
              className="flex items-center justify-center rounded-full focus:outline-none"
              style={{ width: 44, height: 44, border: 'none', background: 'none', color: 'var(--gv-main)', cursor: 'pointer' }}
            >
              <span className="flex items-center justify-center rounded-full" style={{ width: 32, height: 32, border: '1px solid var(--gv-border)', backgroundColor: 'var(--gv-surface)' }}>
                <Plus size={14} />
              </span>
            </button>
            {fee > 0 && (
              <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.ink, marginLeft: 'auto' }}>
                {centsToFee(Math.round(fee * countNum * 100), currency)}
              </span>
            )}
          </div>
        </div>

        {error && <Note tone="red">{error}</Note>}

        <div className="flex gap-3">
          <button
            onClick={() => { if (!adding) onClose(); }}
            disabled={adding}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
            style={{ border: '1.5px solid var(--gv-border)', color: 'var(--gv-on-surface)', backgroundColor: 'transparent', fontFamily: OUTFIT, cursor: adding ? 'default' : 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: adding ? 'var(--gv-border)' : 'var(--gv-main)',
              color: adding ? 'var(--gv-muted)' : 'var(--gv-on-main)',
              fontFamily: OUTFIT, cursor: adding ? 'default' : 'pointer',
            }}
          >
            {adding ? 'Adding…' : 'Add tickets'}
          </button>
        </div>
    </PayActionPopup>
  );
}

// ── Manual payment proof modal ───────────────────────────────────────────────
// Opens once a participant on a manual-mode conference says they've already
// paid, for one invoice's own pay path or the combined selected batch alike.
// Uploads a proof image to the private payment-proofs bucket at
// {conferenceId}/{uuid}-{filename}, then creates a pending payment_batches
// row covering every invoice id passed in — create_manual_payment_batch
// validates the caller may pay them and rejects any invoice already
// awaiting review, surfaced here verbatim.

export function ProofUploadModal({
  open, onClose, invoiceIds, conferenceId, accessToken, onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  invoiceIds: string[];
  conferenceId: string;
  accessToken: string | undefined;
  onSubmitted: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) { setFile(null); setPreviewUrl(null); setError(''); }
  }

  if (!open) return null;

  function handlePick(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (f.size > 10 * 1024 * 1024) { setError('Image must be under 10MB.'); return; }
    setError('');
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function handleSubmit() {
    if (submitting || !accessToken || !file || invoiceIds.length === 0) return;
    setSubmitting(true);
    setError('');
    const supabase = getAuthedClient(accessToken);
    const path = safeStorageKey(conferenceId, crypto.randomUUID(), file.name);
    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      setSubmitting(false);
      // The payer is holding a receipt for money they have already sent and
      // cannot hand it over. Nothing about this reaches an error boundary.
      reportBlocked('upload payment proof', uploadError, { conferenceId, invoiceCount: invoiceIds.length });
      // The raw message here is a storage-layer string — "Invalid key: <uuid>/
      // <uuid>-Screenshot ....png" — which tells a payer nothing they can act
      // on and reads like their receipt was rejected. The detail still goes to
      // reportBlocked above, where someone can actually use it.
      setError('Could not upload your proof. Please try again, or send it to the organisers directly.');
      return;
    }
    const { data, error: rpcError } = await supabase.rpc('create_manual_payment_batch', {
      p_invoice_ids: invoiceIds,
      p_proof_path: path,
    });
    const result = data as { ok?: boolean; error?: string } | null;
    setSubmitting(false);
    if (rpcError || !result?.ok) {
      // The proof is in storage but no batch row covers it, so the money is
      // gone and no organizer will ever see a payment to confirm. ONE report
      // for the whole batch — create_manual_payment_batch is a single RPC
      // covering every invoice id, so this can never fire per invoice.
      reportBlocked(
        'confirm manual payment',
        rpcError ?? new Error(result?.error ?? 'rpc returned ok:false'),
        { conferenceId, invoiceCount: invoiceIds.length },
      );
      setError((result?.error ? plainOrFallback(result.error, 'Could not submit your payment. Please try again.') : friendlyError(rpcError, 'Could not submit your payment. Please try again.')));
      return;
    }
    onSubmitted();
  }

  return (
    <ModalOverlay onClose={() => { if (!submitting) onClose(); }}>
      <div
        className="rounded-2xl p-6 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--gv-surface)', border: '1px solid var(--gv-border)', width: 420, maxWidth: 'calc(100vw - 32px)', maxHeight: MODAL_PANEL_MAX_HEIGHT, overflowY: 'auto' }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-black text-lg" style={{ color: 'var(--gv-on-surface)', fontFamily: OUTFIT }}>Upload Payment Proof</p>
          <button
            onClick={() => { if (!submitting) onClose(); }}
            className="flex-shrink-0 focus:outline-none"
            style={{ color: 'var(--gv-muted)', border: 'none', background: 'none', cursor: submitting ? 'default' : 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: '#6E5F4E', lineHeight: 1.6 }}>
          Upload a screenshot or photo of your payment, a receipt or a transfer confirmation works well.
          The organizing team reviews it before your invoice is marked paid.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={e => handlePick(e.target.files?.[0] ?? null)}
          className="hidden"
        />

        {previewUrl ? (
          <div className="relative rounded-xl overflow-hidden" style={{ border: '1px solid var(--gv-border)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Payment proof preview"
              className="w-full block"
              style={{ maxHeight: 280, objectFit: 'contain', backgroundColor: '#F0EDE6' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-2 right-2 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none"
              style={{ backgroundColor: 'color-mix(in srgb, var(--gv-on-bg) 72%, transparent)', color: 'var(--gv-surface)', fontFamily: OUTFIT, border: 'none', cursor: 'pointer' }}
            >
              Change
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl py-8 flex flex-col items-center gap-2 focus:outline-none"
            style={{ border: '1.5px dashed var(--gv-border)', backgroundColor: 'transparent', cursor: 'pointer' }}
          >
            <ImageUp size={22} style={{ color: 'var(--gv-muted)' }} />
            <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: '#6E5F4E' }}>Choose an image</span>
            <span style={{ fontFamily: OUTFIT, fontSize: 10.5, color: 'var(--gv-muted)' }}>JPG or PNG, up to 10MB</span>
          </button>
        )}

        {error && <Note tone="red">{error}</Note>}

        <div className="flex gap-3">
          <button
            onClick={() => { if (!submitting) onClose(); }}
            disabled={submitting}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
            style={{ border: '1.5px solid var(--gv-border)', color: 'var(--gv-on-surface)', backgroundColor: 'transparent', fontFamily: OUTFIT, cursor: submitting ? 'default' : 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !file}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: submitting || !file ? 'var(--gv-border)' : 'var(--gv-main)',
              color: submitting || !file ? 'var(--gv-muted)' : 'var(--gv-on-main)',
              fontFamily: OUTFIT, cursor: submitting || !file ? 'default' : 'pointer',
            }}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Payments panel (participant's own payment_batches history) ─────────────
// The Payments tab: every payment_batches row for this conference the caller
// can see (RLS scopes it to their own), newest first. Settled invoices move
// here entirely once paid — this is the one place their record lives on.
