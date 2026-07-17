'use client';

// Participant payment page, neumorphic (src/components/neu.tsx), reached
// from the "YOUR APPLICATION" card's PAY AND REQUEST AID button once an
// application is submitted (payable pre-acceptance for the app fee — see
// ConferenceDetailClient). LEFT column is the real invoices list synced from
// sync_participant_invoices (role_fee/app_fee/addon; pledge_spot stays out —
// it has its own dedicated "Buy Delegation Spots" flow on the right, unchanged).
// role_fee keeps its own rich voucher/partial-amount panel (the same
// applicationId+kind checkout as before — it's the only kind whose charge
// needs a live aid/voucher recompute the invoiceId path doesn't do); app_fee
// and addon are generic cards paid via create-checkout's invoiceId path
// (payInvoiceCheckout). RIGHT column is unchanged financial aid + leader-gated
// delegation credits/spots actions.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ChevronDown, ChevronUp, Coins, CreditCard, HandCoins, Loader2,
  Lock, Mail, Receipt, Users2, Wallet,
} from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { formatFee, formatFeeAmount } from '@/lib/utils';
import { activePhaseFee, type FeePhase } from '@/lib/finance';
import { createCheckout, payInvoiceCheckout } from '@/lib/payments';
import { normalizeBlocks, type FormBlock } from '@/lib/customQuestions';
import {
  type InvoiceRow, invoiceLabel, invoiceDueCents, centsToFee, isInvoicePayable, isInvoiceSettled,
} from '@/lib/invoices';
import { ModalOverlay } from '@/components/CommitteeEditorModal';
import {
  NEU, NEU_GRADIENTS, OUTFIT, NeuCard, NeuIconDisc, type NeuGradient,
} from '@/components/neu';
import { getGateState, roleLabel, statusPriority } from '../participant/shared';
import AidRequestModal from '../participant/AidRequestModal';
import DelegationCreditsCard from '../participant/DelegationCreditsCard';
import PledgeInvoicingCard from '../participant/PledgeInvoicingCard';

// ── Types ──────────────────────────────────────────────────────────────────

interface PayConference {
  id: string;
  full_name: string;
  fee_currency: string;
  contact_email: string | null;
  payment_method: string | null;
  connect_onboarding_status: string;
  external_payment_url: string | null;
  external_payment_note: string | null;
  financial_aid_enabled: boolean;
  aid_questions: unknown[];
  aid_intro: string | null;
}

interface PayApplication {
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

interface PayRoleConfig {
  role: string;
  fee_amount: number | null;
  fee_currency: string | null;
  fee_phases: FeePhase[] | null;
  payment_timing: string;
  allow_partial_payments: boolean;
}

interface AidRequestRow {
  status: 'pending' | 'approved' | 'denied';
  granted_amount: number | null;
}

type Badge = 'PAID' | 'WAIVED' | 'PARTIAL' | 'UNPAID' | 'REFUNDED';

const BADGE_STYLES: Record<Badge, { bg: string; color: string }> = {
  PAID: { bg: 'rgba(61,122,82,0.13)', color: '#2A5A3C' },
  WAIVED: { bg: 'rgba(154,138,120,0.16)', color: '#6B5E4E' },
  PARTIAL: { bg: 'rgba(238,217,138,0.35)', color: '#8A6614' },
  UNPAID: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020' },
  REFUNDED: { bg: 'rgba(154,138,120,0.16)', color: '#6B5E4E' },
};

function deriveBadge(paymentStatus: string, amountPaid: number): Badge {
  if (paymentStatus === 'paid') return 'PAID';
  if (paymentStatus === 'waived') return 'WAIVED';
  if (paymentStatus === 'refunded') return 'REFUNDED';
  return amountPaid > 0 ? 'PARTIAL' : 'UNPAID';
}

function invoiceBadge(inv: InvoiceRow): Badge {
  if (inv.status === 'settled') return 'PAID';
  if (inv.status === 'waived') return 'WAIVED';
  if (inv.status === 'partial') return 'PARTIAL';
  return 'UNPAID';
}

// ── Small shared pieces ──────────────────────────────────────────────────────

const eyebrowStyle: React.CSSProperties = {
  fontFamily: OUTFIT, fontWeight: 700, fontSize: 10, letterSpacing: '0.14em', color: NEU.deepGold, textTransform: 'uppercase',
};

function BadgePill({ badge }: { badge: Badge }) {
  return (
    <span
      className="px-2.5 py-1 rounded-full flex-shrink-0"
      style={{ ...BADGE_STYLES[badge], fontSize: 10, fontFamily: OUTFIT, fontWeight: 700, letterSpacing: '0.08em' }}
    >
      {badge}
    </span>
  );
}

const NOTE_TONES = {
  amber: { color: '#B8844A', bg: 'rgba(184,132,74,0.1)', border: 'rgba(184,132,74,0.24)' },
  green: { color: '#2A5A3C', bg: 'rgba(61,122,82,0.1)', border: 'rgba(61,122,82,0.24)' },
  muted: { color: '#6E5F4E', bg: 'rgba(154,138,120,0.1)', border: 'rgba(154,138,120,0.24)' },
  red: { color: '#8B2020', bg: 'rgba(139,32,32,0.08)', border: 'rgba(139,32,32,0.22)' },
} as const;

function Note({ tone, children }: { tone: keyof typeof NOTE_TONES; children: React.ReactNode }) {
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

type ActionIcon = React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;

function ActionRow({
  icon: Icon, gradient, title, subtitle, disabled = false, onClick,
}: {
  icon: ActionIcon;
  gradient: NeuGradient;
  title: string;
  subtitle?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <NeuCard
      hover={!disabled}
      onClick={disabled ? undefined : onClick}
      style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, opacity: disabled ? 0.55 : 1 }}
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

// ── Page ───────────────────────────────────────────────────────────────────

export default function PayPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { user, session, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [conference, setConference] = useState<PayConference | null>(null);
  const [application, setApplication] = useState<PayApplication | null>(null);
  const [roleConfigs, setRoleConfigs] = useState<PayRoleConfig[]>([]);
  const [aidRequest, setAidRequest] = useState<AidRequestRow | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [configDescriptions, setConfigDescriptions] = useState<Record<string, string>>({});

  async function fetchAidRequest(applicationId: string, accessToken: string): Promise<AidRequestRow | null> {
    const { data } = await getAuthedClient(accessToken)
      .from('financial_aid_requests')
      .select('status, granted_amount')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as AidRequestRow | null) ?? null;
  }

  async function fetchInvoices(app: PayApplication, conferenceId: string, accessToken: string): Promise<InvoiceRow[]> {
    const supabase = getAuthedClient(accessToken);
    // sync_participant_invoices creates whatever this application newly owes
    // (registration once payable, the conference application fee, active
    // add-ons) — safe to call every load, it's a no-op once rows exist.
    await supabase.rpc('sync_participant_invoices', { p_application_id: app.id });

    const isLeader = app.role === 'head-delegate' || app.role === 'faculty-advisor';
    const orFilter = isLeader && app.society_id
      ? `application_id.eq.${app.id},society_id.eq.${app.society_id}`
      : `application_id.eq.${app.id}`;
    const { data } = await supabase
      .from('invoices')
      .select('id, conference_id, kind, label, amount_cents, amount_paid_cents, currency, status, gates_acceptance, payable_before_acceptance, application_id, society_id, config_id, aid_applied_cents, created_at')
      .eq('conference_id', conferenceId)
      .or(orFilter)
      .neq('status', 'void')
      .order('created_at', { ascending: true });
    return (data ?? []) as InvoiceRow[];
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = getAuthedClient(session.access_token);

      const { data: confData } = await supabase
        .from('conferences')
        .select(`
          id, full_name, fee_currency, contact_email,
          payment_method, connect_onboarding_status, external_payment_url, external_payment_note,
          financial_aid_enabled, aid_questions, aid_intro
        `)
        .eq('slug', slug)
        .single();
      if (cancelled) return;
      if (!confData) { setLoading(false); return; }
      const conf = confData as PayConference;
      setConference(conf);

      const { data: appsData } = await supabase
        .from('applications')
        .select('id, role, status, payment_status, amount_paid, society_id, pledge_type, spots_pledged, pledge_confirmed_at')
        .eq('conference_id', conf.id)
        .eq('user_id', user.id);
      if (cancelled) return;
      const apps = (appsData ?? []) as PayApplication[];
      const primary = apps.length > 0
        ? [...apps].sort((a, b) => statusPriority(a.status) - statusPriority(b.status))[0]
        : null;
      setApplication(primary);

      const { data: roleConfigsData } = await supabase
        .from('application_role_configs')
        .select('role, fee_amount, fee_currency, fee_phases, payment_timing, allow_partial_payments')
        .eq('conference_id', conf.id);
      if (cancelled) return;
      setRoleConfigs((roleConfigsData as PayRoleConfig[]) ?? []);

      if (primary) {
        const [aid, invs] = await Promise.all([
          fetchAidRequest(primary.id, session.access_token),
          fetchInvoices(primary, conf.id, session.access_token),
        ]);
        if (cancelled) return;
        setAidRequest(aid);
        setInvoices(invs);

        // Descriptions live on the config row (application_surcharges /
        // addons), not on the invoice itself — batch-fetch by kind.
        const surchargeIds = Array.from(new Set(invs.filter(i => i.kind === 'app_fee' && i.config_id).map(i => i.config_id!)));
        const addonIds = Array.from(new Set(invs.filter(i => i.kind === 'addon' && i.config_id).map(i => i.config_id!)));
        const [surchargeRes, addonRes] = await Promise.all([
          surchargeIds.length > 0
            ? supabase.from('application_surcharges').select('id, description').in('id', surchargeIds)
            : Promise.resolve({ data: [] }),
          addonIds.length > 0
            ? supabase.from('addons').select('id, description').in('id', addonIds)
            : Promise.resolve({ data: [] }),
        ]);
        if (cancelled) return;
        const descMap: Record<string, string> = {};
        for (const row of ((surchargeRes.data ?? []) as { id: string; description: string | null }[])) {
          if (row.description) descMap[row.id] = row.description;
        }
        for (const row of ((addonRes.data ?? []) as { id: string; description: string | null }[])) {
          if (row.description) descMap[row.id] = row.description;
        }
        setConfigDescriptions(descMap);
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, authLoading, user?.id, session?.access_token]);

  async function refetchAid() {
    if (!application || !session) return;
    setAidRequest(await fetchAidRequest(application.id, session.access_token));
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: NEU.base }}>
      <SiteNav />
      <div className="flex-1 w-full max-w-[900px] mx-auto px-6 py-10">
        <Link
          href={`/conferences/${slug}?tab=participant`}
          className="inline-flex items-center gap-1.5 mb-6 focus:outline-none"
          style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: NEU.muted, textDecoration: 'none' }}
        >
          <ArrowLeft size={14} strokeWidth={2.4} />
          Back to conference
        </Link>

        {authLoading || loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={26} className="animate-spin" style={{ color: NEU.muted }} />
          </div>
        ) : !user ? (
          <NeuCard style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 15, color: NEU.ink }}>Sign in to continue</p>
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted, marginTop: 6 }}>
              You need to be signed in to pay or request financial aid.
            </p>
            <Link
              href={`/auth/signin?next=${encodeURIComponent(`/conferences/${slug}/pay`)}`}
              className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 mt-4 font-bold text-sm focus:outline-none"
              style={{ backgroundColor: NEU.forest, color: NEU.gold, fontFamily: OUTFIT, letterSpacing: '0.06em', textDecoration: 'none' }}
            >
              SIGN IN
            </Link>
          </NeuCard>
        ) : !conference ? (
          <NeuCard style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 15, color: NEU.ink }}>Conference not found</p>
          </NeuCard>
        ) : !application ? (
          <NeuCard style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 15, color: NEU.ink }}>No application on file</p>
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted, marginTop: 6 }}>
              You need an application to this conference before you can pay.
            </p>
          </NeuCard>
        ) : application.status === 'rejected' || application.status === 'withdrawn' ? (
          <NeuCard style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 15, color: NEU.ink }}>Nothing to pay</p>
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted, marginTop: 6 }}>
              This application isn&apos;t eligible for payment.
            </p>
          </NeuCard>
        ) : (
          <>
            <p style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 22, color: NEU.ink, margin: '0 0 2px 0' }}>
              Pay &amp; Financial Aid
            </p>
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted, margin: '0 0 24px 0' }}>
              {conference.full_name}
            </p>
            <PayInvoiceAndActions
              conference={conference}
              application={application}
              roleConfig={roleConfigs.find(rc => rc.role === application.role) ?? null}
              delegateRoleConfig={roleConfigs.find(rc => rc.role === 'delegate') ?? null}
              aidRequest={aidRequest}
              onAidSubmitted={refetchAid}
              invoices={invoices}
              configDescriptions={configDescriptions}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ── Generic invoice card (app_fee / addon) ──────────────────────────────────

function GenericInvoiceCard({
  inv, application, description, paymentsEnabled, manualActive, externalPaymentUrl, externalPaymentNote,
  expanded, onToggleExpand, selected, onToggleSelect, onPay, paying, payError,
}: {
  inv: InvoiceRow;
  application: PayApplication;
  description?: string;
  paymentsEnabled: boolean;
  manualActive: boolean;
  externalPaymentUrl: string | null;
  externalPaymentNote: string | null;
  expanded: boolean;
  onToggleExpand: () => void;
  selected: boolean;
  onToggleSelect: () => void;
  onPay: () => void;
  paying: boolean;
  payError: string | null;
}) {
  const payable = isInvoicePayable(inv, application.status);
  const settled = isInvoiceSettled(inv);
  const due = invoiceDueCents(inv);
  const badge = invoiceBadge(inv);

  if (!payable) {
    return (
      <NeuCard style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, opacity: 0.6 }}>
        <NeuIconDisc gradient={NEU_GRADIENTS.sage} icon={Lock} size={38} />
        <div className="flex-1 min-w-0">
          <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14, color: NEU.ink, margin: 0 }}>{invoiceLabel(inv)}</p>
          <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, margin: '2px 0 0 0' }}>
            Available once you&apos;re accepted
          </p>
        </div>
        <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
          {centsToFee(inv.amount_cents, inv.currency)}
        </span>
      </NeuCard>
    );
  }

  return (
    <NeuCard style={{ padding: 0, overflow: 'hidden' }}>
      <div className="w-full flex items-center gap-3" style={{ padding: '16px 18px' }}>
        {!settled && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="flex-shrink-0"
            style={{ width: 16, height: 16, accentColor: NEU.forest, cursor: 'pointer' }}
            aria-label={`Select ${invoiceLabel(inv)}`}
          />
        )}
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-1 flex items-center justify-between gap-3 min-w-0 focus:outline-none"
          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <NeuIconDisc gradient={inv.kind === 'addon' ? NEU_GRADIENTS.sage : NEU_GRADIENTS.forest} icon={Receipt} size={38} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14, color: NEU.ink, margin: 0 }}>
                  {invoiceLabel(inv)}
                </p>
                {inv.kind === 'addon' && (
                  <span
                    className="px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: 'rgba(154,138,120,0.14)', color: '#6B5E4E', fontSize: 9, fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.06em' }}
                  >
                    OPTIONAL
                  </span>
                )}
              </div>
              <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted, margin: '2px 0 0 0' }}>
                {centsToFee(inv.amount_cents, inv.currency)}
                {inv.status === 'partial' && ` · balance due ${centsToFee(due, inv.currency)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <BadgePill badge={badge} />
            {expanded ? <ChevronUp size={16} style={{ color: NEU.muted }} /> : <ChevronDown size={16} style={{ color: NEU.muted }} />}
          </div>
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '0 18px 18px 18px', borderTop: '1px solid rgba(27,56,40,0.08)' }}>
          <div className="pt-4">
            {description && (
              <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted, lineHeight: 1.6, marginBottom: 14 }}>
                {description}
              </p>
            )}

            {settled ? (
              <Note tone="green">{inv.status === 'waived' ? 'Waived.' : 'Paid in full. Thank you!'}</Note>
            ) : manualActive && externalPaymentUrl ? (
              <>
                <a
                  href={externalPaymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm focus:outline-none"
                  style={{ backgroundColor: NEU.forest, color: NEU.gold, fontFamily: OUTFIT, letterSpacing: '0.06em', border: 'none', textDecoration: 'none' }}
                >
                  <CreditCard size={15} />
                  PAY VIA THE ORGANIZING TEAM&apos;S PAYMENT PAGE
                </a>
                {externalPaymentNote && (
                  <p className="mt-3" style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {externalPaymentNote}
                  </p>
                )}
                <p className="mt-3" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, lineHeight: 1.5 }}>
                  After you pay, the organizing team will confirm your payment here.
                </p>
              </>
            ) : manualActive ? (
              <>
                {externalPaymentNote && (
                  <p className="mb-3" style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {externalPaymentNote}
                  </p>
                )}
                <Note tone="amber">The organizing team collects this directly and will confirm your payment here.</Note>
              </>
            ) : !paymentsEnabled ? (
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(184,132,74,0.1)', border: '1px solid rgba(184,132,74,0.24)' }}>
                <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: '#B8844A' }}>Payments coming soon</p>
                <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, marginTop: 4, lineHeight: 1.6 }}>
                  The organizing team is finishing payment setup — you&apos;ll be able to pay here shortly.
                </p>
              </div>
            ) : (
              <>
                {payError && (
                  <div className="mb-3"><Note tone="red">{payError}</Note></div>
                )}
                <button
                  onClick={onPay}
                  disabled={paying}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm focus:outline-none transition-colors"
                  style={{
                    backgroundColor: paying ? '#DDD4C0' : NEU.forest,
                    color: paying ? '#9A8A78' : NEU.gold,
                    fontFamily: OUTFIT, letterSpacing: '0.06em', border: 'none', cursor: paying ? 'default' : 'pointer',
                  }}
                >
                  <CreditCard size={15} />
                  {paying ? 'OPENING CHECKOUT...' : `PAY ${centsToFee(due, inv.currency)}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </NeuCard>
  );
}

// ── Invoice + actions (only mounted once real data is loaded, so its money
// math hooks initialize against real values) ────────────────────────────────

function PayInvoiceAndActions({
  conference, application, roleConfig, delegateRoleConfig, aidRequest, onAidSubmitted, invoices, configDescriptions,
}: {
  conference: PayConference;
  application: PayApplication;
  roleConfig: PayRoleConfig | null;
  delegateRoleConfig: PayRoleConfig | null;
  aidRequest: AidRequestRow | null;
  onAidSubmitted: () => void;
  invoices: InvoiceRow[];
  configDescriptions: Record<string, string>;
}) {
  const { session } = useAuth();
  const aidBlocks: FormBlock[] = normalizeBlocks(conference.aid_questions);
  const currency = roleConfig?.fee_currency ?? conference.fee_currency;
  const { amount: resolvedFee, phase } = activePhaseFee({ fee_amount: roleConfig?.fee_amount ?? 0, fee_phases: roleConfig?.fee_phases ?? null });
  const fee = resolvedFee ?? 0;
  const grantedAmount = aidRequest?.status === 'approved' ? (aidRequest.granted_amount ?? 0) : 0;
  const effectiveFee = Math.max(0, fee - grantedAmount);
  const remaining = Math.max(0, effectiveFee - application.amount_paid);
  const badge = deriveBadge(application.payment_status, application.amount_paid);
  const owesSomething = badge === 'UNPAID' || badge === 'PARTIAL';
  const allowPartial = roleConfig?.allow_partial_payments ?? false;
  const showAmountSelector = allowPartial && owesSomething && remaining > 0;
  const gateState = getGateState(roleConfig?.payment_timing ?? 'anytime', application.status, application.payment_status);
  const payableNow = gateState !== 'under_review';
  const paymentsEnabled = conference.payment_method === 'stripe' && conference.connect_onboarding_status === 'complete';
  const externalPaymentUrl = conference.payment_method === 'manual' ? conference.external_payment_url : null;
  const manualActive = conference.payment_method === 'manual';
  const canBuyDelegationStuff = (application.role === 'head-delegate' || application.role === 'faculty-advisor') && !!application.society_id;

  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>(() => formatFeeAmount(remaining));
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [stubMessage, setStubMessage] = useState<string | null>(null);
  const [aidModalOpen, setAidModalOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [spotsOpen, setSpotsOpen] = useState(false);

  // Generic (app_fee / addon) invoice cards — role_fee and pledge_spot render
  // through their own dedicated panels below/right, never as generic cards.
  const genericInvoices = invoices.filter(inv => inv.kind === 'app_fee' || inv.kind === 'addon');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [genericPayingId, setGenericPayingId] = useState<string | null>(null);
  const [genericPayError, setGenericPayError] = useState<Record<string, string>>({});

  function toggleExpanded(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const amountToCharge = showAmountSelector ? Math.min(Math.max(parseFloat(customAmount) || 1, 1), Math.max(remaining, 1)) : remaining;

  async function handlePay() {
    if (paying || amountToCharge <= 0 || !session) return;
    setPaying(true);
    setPayError(null);
    const result = await createCheckout({
      applicationId: application.id,
      conferenceId: conference.id,
      accessToken: session.access_token,
      kind: 'role_fee',
      ...(showAmountSelector ? { amount: amountToCharge } : {}),
      ...(voucherCode.trim() ? { voucherCode: voucherCode.trim().toUpperCase() } : {}),
      feeAmount: fee,
      feeCurrency: currency,
    });
    if (result.status === 'redirect' && result.redirectUrl) {
      window.location.assign(result.redirectUrl);
      return;
    }
    setPaying(false);
    if (result.status === 'error') setPayError(result.message ?? 'Something went wrong. Please try again.');
    else setStubMessage(result.message ?? null);
  }

  // Any invoice kind other than role_fee pays through create-checkout's
  // invoiceId path — its amount_cents is already final (config-set, no
  // aid/voucher recompute needed the way role_fee's does).
  async function handlePayInvoice(invoiceId: string) {
    if (genericPayingId || !session) return;
    setGenericPayingId(invoiceId);
    setGenericPayError(prev => ({ ...prev, [invoiceId]: '' }));
    const result = await payInvoiceCheckout({ invoiceId, accessToken: session.access_token });
    if (result.status === 'redirect' && result.redirectUrl) {
      window.location.assign(result.redirectUrl);
      return;
    }
    setGenericPayingId(null);
    if (result.status === 'error') {
      setGenericPayError(prev => ({ ...prev, [invoiceId]: result.message ?? 'Something went wrong. Please try again.' }));
    }
  }

  // "Pay selected" charges the first selected, still-owed invoice — Stripe
  // Checkout is one redirect per session, so multi-invoice checkout isn't
  // possible here; picking the first keeps this predictable and simple.
  function handlePaySelected() {
    const first = genericInvoices.find(inv => selectedIds.has(inv.id) && !isInvoiceSettled(inv));
    if (first) void handlePayInvoice(first.id);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
      {/* LEFT — Current Invoices */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p style={eyebrowStyle}>Current Invoices</p>
          {selectedIds.size > 0 && (
            <button
              onClick={handlePaySelected}
              disabled={genericPayingId !== null}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 focus:outline-none"
              style={{
                backgroundColor: NEU.forest, color: NEU.gold, border: 'none',
                fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
                cursor: genericPayingId !== null ? 'default' : 'pointer', opacity: genericPayingId !== null ? 0.7 : 1,
              }}
            >
              <CreditCard size={13} />
              PAY SELECTED ({selectedIds.size})
            </button>
          )}
        </div>

        {/* Registration fee — its own panel (voucher + partial-amount UI),
            same live aid/voucher computation as before. */}
        {fee > 0 && (
          <NeuCard style={{ padding: 0, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setInvoiceOpen(v => !v)}
              className="w-full flex items-center justify-between gap-3 focus:outline-none"
              style={{ padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Wallet} size={40} />
                <div className="min-w-0">
                  <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14.5, color: NEU.ink, margin: 0 }}>
                    {roleLabel(application.role)} fee
                  </p>
                  <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted, margin: '2px 0 0 0' }}>
                    {fee > 0 ? `${formatFee(fee, currency)} · balance due ${formatFee(remaining, currency)}` : 'Free'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <BadgePill badge={badge} />
                {invoiceOpen ? <ChevronUp size={16} style={{ color: NEU.muted }} /> : <ChevronDown size={16} style={{ color: NEU.muted }} />}
              </div>
            </button>

            {invoiceOpen && (
              <div style={{ padding: '0 20px 20px 20px', borderTop: '1px solid rgba(27,56,40,0.08)' }}>
                <div className="pt-4 flex flex-col gap-1.5 mb-4">
                  <div className="flex items-center justify-between">
                    <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted }}>Fee</span>
                    <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink, fontWeight: 600 }}>{formatFee(fee, currency)}</span>
                  </div>
                  {grantedAmount > 0 && (
                    <div className="flex items-center justify-between">
                      <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted }}>− Financial aid</span>
                      <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.green, fontWeight: 600 }}>−{formatFee(grantedAmount, currency)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1.5 mt-0.5" style={{ borderTop: '1px dashed rgba(27,56,40,0.16)' }}>
                    <span style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.ink, fontWeight: 800 }}>Total</span>
                    <span style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.ink, fontWeight: 800 }}>{formatFee(effectiveFee, currency)}</span>
                  </div>
                  {fee > 0 && phase && (
                    <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, color: NEU.deepGold, letterSpacing: '0.04em', margin: '2px 0 0 0' }}>
                      {phase.label.toUpperCase()} PRICING
                    </p>
                  )}
                </div>

                {aidRequest?.status === 'pending' && (
                  <div className="mb-3"><Note tone="amber">Your financial aid request is under review.</Note></div>
                )}
                {aidRequest?.status === 'denied' && (
                  <div className="mb-3"><Note tone="muted">Your financial aid request was not approved. The standard fee applies.</Note></div>
                )}

                {!payableNow ? (
                  <Note tone="amber">Payment becomes available once your application is accepted.</Note>
                ) : fee === 0 ? (
                  <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted }}>
                    There&apos;s no fee for this role, nothing to pay.
                  </p>
                ) : owesSomething && manualActive && externalPaymentUrl ? (
                  <>
                    <a
                      href={externalPaymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm focus:outline-none"
                      style={{ backgroundColor: NEU.forest, color: NEU.gold, fontFamily: OUTFIT, letterSpacing: '0.06em', border: 'none', textDecoration: 'none' }}
                    >
                      <CreditCard size={15} />
                      PAY VIA THE ORGANIZING TEAM&apos;S PAYMENT PAGE
                    </a>
                    {conference.external_payment_note && (
                      <p className="mt-3" style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {conference.external_payment_note}
                      </p>
                    )}
                    <p className="mt-3" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, lineHeight: 1.5 }}>
                      After you pay, the organizing team will confirm your payment here.
                    </p>
                  </>
                ) : owesSomething && manualActive ? (
                  <>
                    {conference.external_payment_note && (
                      <p className="mb-3" style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {conference.external_payment_note}
                      </p>
                    )}
                    <Note tone="amber">The organizing team collects this fee directly and will confirm your payment here.</Note>
                  </>
                ) : owesSomething && !paymentsEnabled ? (
                  <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(184,132,74,0.1)', border: '1px solid rgba(184,132,74,0.24)' }}>
                    <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: '#B8844A' }}>Payments coming soon</p>
                    <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, marginTop: 4, lineHeight: 1.6 }}>
                      The organizing team is finishing payment setup — you&apos;ll be able to pay here shortly.
                    </p>
                  </div>
                ) : owesSomething ? (
                  <>
                    {showAmountSelector && (
                      <div className="mb-4">
                        <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.06em' }}>
                          AMOUNT TO PAY
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={remaining}
                            step="0.01"
                            value={customAmount}
                            onChange={e => setCustomAmount(e.target.value)}
                            onBlur={() => setCustomAmount(formatFeeAmount(amountToCharge))}
                            className="flex-1 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
                            style={{ border: 'none', backgroundColor: NEU.base, boxShadow: NEU.inSm, color: NEU.ink, fontFamily: OUTFIT }}
                          />
                          <button
                            type="button"
                            onClick={() => setCustomAmount(formatFeeAmount(remaining))}
                            className="rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none"
                            style={{ border: `1px solid ${NEU.muted}55`, color: NEU.forest, backgroundColor: 'transparent', fontFamily: OUTFIT, whiteSpace: 'nowrap' }}
                          >
                            FULL AMOUNT
                          </button>
                        </div>
                        <p className="mt-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted }}>
                          Pay any amount from 1 up to the remaining balance.
                        </p>
                      </div>
                    )}

                    <div className="mb-4">
                      {!voucherOpen ? (
                        <button
                          type="button"
                          onClick={() => setVoucherOpen(true)}
                          className="text-xs font-bold focus:outline-none"
                          style={{ color: NEU.forest, fontFamily: OUTFIT, textDecoration: 'underline', textUnderlineOffset: 3, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          Have a voucher?
                        </button>
                      ) : (
                        <div>
                          <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.06em' }}>
                            VOUCHER CODE
                          </label>
                          <input
                            type="text"
                            value={voucherCode}
                            onChange={e => setVoucherCode(e.target.value)}
                            placeholder="e.g. EARLYBIRD10"
                            className="w-full rounded-xl px-3.5 py-2.5 text-sm uppercase focus:outline-none"
                            style={{ border: 'none', backgroundColor: NEU.base, boxShadow: NEU.inSm, color: NEU.ink, fontFamily: OUTFIT }}
                          />
                          <p className="mt-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted }}>
                            Checked and applied when you continue to checkout.
                          </p>
                        </div>
                      )}
                    </div>

                    {payError && (
                      <div className="mb-3"><Note tone="red">{payError}</Note></div>
                    )}

                    <button
                      onClick={handlePay}
                      disabled={paying}
                      className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm focus:outline-none transition-colors"
                      style={{
                        backgroundColor: paying ? '#DDD4C0' : NEU.forest,
                        color: paying ? '#9A8A78' : NEU.gold,
                        fontFamily: OUTFIT, letterSpacing: '0.06em', border: 'none', cursor: paying ? 'default' : 'pointer',
                      }}
                    >
                      <CreditCard size={15} />
                      {paying ? 'OPENING CHECKOUT...' : `PAY ${formatFee(amountToCharge, currency)}`}
                    </button>
                  </>
                ) : (
                  <Note tone="green">Paid in full. Thank you!</Note>
                )}
              </div>
            )}
          </NeuCard>
        )}

        {/* Conference application fee + add-ons — generic invoice cards */}
        {genericInvoices.map(inv => (
          <GenericInvoiceCard
            key={inv.id}
            inv={inv}
            application={application}
            description={inv.config_id ? configDescriptions[inv.config_id] : undefined}
            paymentsEnabled={paymentsEnabled}
            manualActive={manualActive}
            externalPaymentUrl={externalPaymentUrl}
            externalPaymentNote={conference.external_payment_note}
            expanded={expandedIds.has(inv.id)}
            onToggleExpand={() => toggleExpanded(inv.id)}
            selected={selectedIds.has(inv.id)}
            onToggleSelect={() => toggleSelected(inv.id)}
            onPay={() => handlePayInvoice(inv.id)}
            paying={genericPayingId === inv.id}
            payError={genericPayError[inv.id] || null}
          />
        ))}

        {fee <= 0 && genericInvoices.length === 0 && (
          <NeuCard style={{ padding: '24px', textAlign: 'center' }}>
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted }}>
              Nothing to pay right now.
            </p>
          </NeuCard>
        )}
      </div>

      {/* RIGHT — action buttons */}
      <div className="flex flex-col gap-3">
        {conference.financial_aid_enabled && (
          !aidRequest ? (
            <ActionRow
              icon={HandCoins}
              gradient={NEU_GRADIENTS.amber}
              title="Apply for Financial Aid"
              subtitle="Request a reduced fee"
              onClick={() => setAidModalOpen(true)}
            />
          ) : (
            <NeuCard style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="flex items-center gap-3">
                <NeuIconDisc gradient={NEU_GRADIENTS.amber} icon={HandCoins} size={36} />
                <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 13, color: NEU.ink, margin: 0 }}>Financial Aid</p>
              </div>
              {aidRequest.status === 'pending' && <Note tone="amber">Your request is under review.</Note>}
              {aidRequest.status === 'approved' && (
                <Note tone="green">Approved — {formatFee(aidRequest.granted_amount ?? 0, currency)} applied.</Note>
              )}
              {aidRequest.status === 'denied' && <Note tone="muted">Not approved this time.</Note>}
            </NeuCard>
          )
        )}

        {canBuyDelegationStuff && (
          <>
            <ActionRow
              icon={Users2}
              gradient={NEU_GRADIENTS.forest}
              title="Buy Delegation Spots"
              subtitle={spotsOpen ? 'Hide' : 'Pay for pledged spots'}
              onClick={() => setSpotsOpen(v => !v)}
            />
            {spotsOpen && (
              <PledgeInvoicingCard
                applicationId={application.id}
                conferenceId={conference.id}
                societyId={application.society_id as string}
                amountPaid={application.amount_paid}
                pledgeType={application.pledge_type}
                spotsPledged={application.spots_pledged}
                pledgeConfirmedAt={application.pledge_confirmed_at}
                delegateFeeAmount={delegateRoleConfig?.fee_amount ?? null}
                delegateFeeCurrency={delegateRoleConfig?.fee_currency ?? null}
                contactEmail={conference.contact_email}
                paymentsEnabled={paymentsEnabled}
                externalPaymentUrl={externalPaymentUrl}
                externalPaymentNote={conference.external_payment_note}
                manualActive={manualActive}
                financialAidEnabled={conference.financial_aid_enabled}
                aidBlocks={aidBlocks}
                aidIntro={conference.aid_intro}
              />
            )}

            <ActionRow
              icon={Coins}
              gradient={NEU_GRADIENTS.gold}
              title="Buy Delegation Credits"
              subtitle={creditsOpen ? 'Hide' : 'Fund your delegation pool'}
              onClick={() => setCreditsOpen(v => !v)}
            />
            {creditsOpen && <DelegationCreditsCard societyId={application.society_id as string} />}
          </>
        )}
      </div>

      {stubMessage && (
        <ModalOverlay onClose={() => setStubMessage(null)}>
          <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 380, maxWidth: 'calc(100vw - 32px)' }}>
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 44, height: 44, borderRadius: '9999px', backgroundColor: 'rgba(184,132,74,0.14)', border: '1px solid rgba(184,132,74,0.3)' }}
            >
              <CreditCard size={19} style={{ color: '#B8844A' }} />
            </div>
            <p className="text-sm" style={{ color: '#1C1410', fontFamily: OUTFIT, lineHeight: 1.6 }}>
              {stubMessage}
            </p>
            {conference.contact_email && (
              <a
                href={`mailto:${conference.contact_email}`}
                className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none"
                style={{ border: '1px solid #DDD4C0', color: '#1B3828', backgroundColor: 'rgba(27,56,40,0.04)', fontFamily: OUTFIT, textDecoration: 'none' }}
              >
                <Mail size={14} />
                {conference.contact_email}
              </a>
            )}
            <button
              onClick={() => setStubMessage(null)}
              className="rounded-xl py-2.5 font-bold text-sm focus:outline-none"
              style={{ backgroundColor: '#1B3828', color: '#EED98A', fontFamily: OUTFIT }}
            >
              GOT IT
            </button>
          </div>
        </ModalOverlay>
      )}

      <AidRequestModal
        applicationId={application.id}
        conferenceId={conference.id}
        aidBlocks={aidBlocks}
        aidIntro={conference.aid_intro}
        currency={currency}
        open={aidModalOpen}
        onClose={() => setAidModalOpen(false)}
        onSubmitted={onAidSubmitted}
      />
    </div>
  );
}
