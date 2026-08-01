'use client';

// Participant payment page, neumorphic (src/components/neu.tsx), reached
// from the "YOUR APPLICATION" card's PAY AND REQUEST AID button once an
// application is submitted (payable pre-acceptance for the app fee — see
// ConferenceDetailClient). LEFT column is the real invoices list synced from
// sync_participant_invoices (role_fee/app_fee/addon/pledge_spot). role_fee
// keeps its own rich voucher panel (its dedicated PAY button still goes
// through the invoiceId checkout, the only path that applies a
// freshly-typed voucher code) and, when waived (covered by the delegation),
// renders as a covered notice with no pay affordance; role_fee is ALSO
// selectable for the combined "Pay Selected" flow, which charges via
// create-checkout's invoiceIds path — that path recomputes role_fee's
// aid/voucher server-side at charge time (v16), so a combined payment never
// overcharges an aid/voucher recipient, it just can't pick up a voucher
// typed but never submitted through the panel's own button. app_fee/addon/
// pledge_spot are generic cards, each individually payable via the
// invoiceId path (payInvoiceCheckout) or selectable into the combined
// batch — pledge_spot cards are owned by the delegation leader (own
// application_id), materialized by add_pledged_spots. RIGHT column action
// buttons are always visible now — unavailable ones dim and explain why on
// click, instead of disappearing. "Add Delegation Spots" lets a leader
// pledge more spots (add_pledged_spots), which materialize as new
// pledge_spot invoices in the list above rather than being paid inline.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ChevronDown, ChevronUp, Clock, Coins, CreditCard, GraduationCap, HandCoins, ImageUp, Loader2,
  Lock, Mail, Minus, Plus, Receipt, ShoppingBag, Users2, Wallet, X,
} from 'lucide-react';
import SiteNav from '@/components/SiteNav';
import Portal from '@/components/Portal';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { formatFee } from '@/lib/utils';
import { activePhaseFee, type FeePhase } from '@/lib/finance';
import { payInvoiceCheckout, payInvoicesCheckout } from '@/lib/payments';
import { normalizeBlocks, type FormBlock } from '@/lib/customQuestions';
import {
  type InvoiceRow, invoiceLabel, invoiceDueCents, centsToFee, isInvoicePayable, isInvoiceSettled,
} from '@/lib/invoices';
import { ModalOverlay } from '@/components/CommitteeEditorModal';
import {
  NEU, NEU_GRADIENTS, OUTFIT, EASE, NeuCard, NeuIconDisc, type NeuGradient,
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
}

interface AidRequestRow {
  status: 'pending' | 'approved' | 'denied';
  granted_amount: number | null;
}

interface ActiveAddon {
  id: string;
  label: string;
  description: string | null;
  amount_cents: number;
  currency: string;
}

// ── Payment batches (Payments history + awaiting-review tracking) ──────────

interface PaymentBatchLineItem {
  id: string;
  invoice_id: string;
  amount_cents: number;
  currency: string;
  invoice: { kind: string; label: string | null } | { kind: string; label: string | null }[] | null;
}

interface PaymentBatchRow {
  id: string;
  method: 'stripe' | 'manual' | 'organizer';
  status: 'pending' | 'paid' | 'rejected';
  total_cents: number;
  currency: string;
  proof_path: string | null;
  proof_uploaded_at: string | null;
  paid_at: string | null;
  created_at: string;
  payments: PaymentBatchLineItem[];
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

// Shown wherever a delegate reaches a payable invoice but the organizer's
// financial setup isn't ready yet — grandfathered conferences may never
// finish this, so the copy points the delegate at the organizer rather than
// asking them to wait for something that might not arrive.
function PaymentsNotSetUp({ contactEmail }: { contactEmail: string | null }) {
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

function ActionRow({
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

// ── Page ───────────────────────────────────────────────────────────────────

export default function PayPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { user, session, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [conference, setConference] = useState<PayConference | null>(null);
  const [application, setApplication] = useState<PayApplication | null>(null);
  // The user's own application with delegation-leader capabilities (adding
  // spots, buying credits, delegation-wide invoices), independent of which
  // application won the status-priority pick for `application` (primary) —
  // a user can hold both a delegate application AND a head-delegate/advisor
  // application at the same conference, and primary can land on either one.
  const [leaderApp, setLeaderApp] = useState<PayApplication | null>(null);
  const [allApps, setAllApps] = useState<PayApplication[]>([]);
  const [roleConfigs, setRoleConfigs] = useState<PayRoleConfig[]>([]);
  const [aidRequest, setAidRequest] = useState<AidRequestRow | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [configDescriptions, setConfigDescriptions] = useState<Record<string, string>>({});
  const [activeAddons, setActiveAddons] = useState<ActiveAddon[]>([]);
  const [paymentBatches, setPaymentBatches] = useState<PaymentBatchRow[]>([]);

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

  const INVOICE_SELECT = 'id, conference_id, kind, label, amount_cents, amount_paid_cents, currency, status, gates_acceptance, payable_before_acceptance, application_id, society_id, config_id, aid_applied_cents, quantity, created_at';

  async function fetchInvoices(
    apps: PayApplication[],
    primary: PayApplication,
    leader: PayApplication | null,
    conferenceId: string,
    accessToken: string
  ): Promise<InvoiceRow[]> {
    const supabase = getAuthedClient(accessToken);
    // sync_participant_invoices creates whatever this application newly owes
    // (registration once payable, the conference application fee, active
    // add-ons) — safe to call every load, it's a no-op once rows exist.
    // Also synced for leaderApp when it differs from primary, so a dual-role
    // user's pledge_spot invoices (owed by their leader application) still
    // materialize even when a different application won the primary pick.
    await supabase.rpc('sync_participant_invoices', { p_application_id: primary.id });
    if (leader && leader.id !== primary.id) {
      await supabase.rpc('sync_participant_invoices', { p_application_id: leader.id });
    }

    // Two independent queries — every one of the user's applications at this
    // conference, plus the delegation's society-owned invoices when they
    // lead one — merged and deduped by id, since a pledge_spot invoice on
    // the leader's own application_id matches both queries at once.
    const [byAppRes, bySocietyRes] = await Promise.all([
      supabase
        .from('invoices')
        .select(INVOICE_SELECT)
        .eq('conference_id', conferenceId)
        .in('application_id', apps.map(a => a.id))
        .neq('status', 'void')
        .order('created_at', { ascending: true }),
      leader?.society_id
        ? supabase
            .from('invoices')
            .select(INVOICE_SELECT)
            .eq('conference_id', conferenceId)
            .eq('society_id', leader.society_id)
            .neq('status', 'void')
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [] as InvoiceRow[] }),
    ]);

    const merged = new Map<string, InvoiceRow>();
    for (const row of ((byAppRes.data ?? []) as InvoiceRow[])) merged.set(row.id, row);
    for (const row of ((bySocietyRes.data ?? []) as InvoiceRow[])) merged.set(row.id, row);
    return Array.from(merged.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async function fetchConfigDescriptions(accessToken: string, invs: InvoiceRow[]): Promise<Record<string, string>> {
    const supabase = getAuthedClient(accessToken);
    // Descriptions live on the config row (application_surcharges / addons),
    // not on the invoice itself — batch-fetch by kind.
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
    const descMap: Record<string, string> = {};
    for (const row of ((surchargeRes.data ?? []) as { id: string; description: string | null }[])) {
      if (row.description) descMap[row.id] = row.description;
    }
    for (const row of ((addonRes.data ?? []) as { id: string; description: string | null }[])) {
      if (row.description) descMap[row.id] = row.description;
    }
    return descMap;
  }

  // RLS scopes payment_batches/payments to the caller's own rows, so this is
  // implicitly "my payment history for this conference" — every method
  // (stripe/manual/organizer), newest first. Feeds both the Payments tab and
  // the awaiting-review set that hides an invoice's pay affordance while its
  // manual proof is under review.
  async function fetchPaymentBatches(conferenceId: string, accessToken: string): Promise<PaymentBatchRow[]> {
    const supabase = getAuthedClient(accessToken);
    const { data } = await supabase
      .from('payment_batches')
      .select(`
        id, method, status, total_cents, currency, proof_path, proof_uploaded_at, paid_at, created_at,
        payments (id, invoice_id, amount_cents, currency, invoice:invoices (kind, label))
      `)
      .eq('conference_id', conferenceId)
      .order('created_at', { ascending: false });
    return (data ?? []) as unknown as PaymentBatchRow[];
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
      // Any non-rejected/withdrawn application of this user's that actually
      // leads a delegation — separate from `primary`, since primary is
      // picked by status priority alone and can land on a non-leader
      // application even when the user also holds a leader one.
      const leader = apps.find(a =>
        a.status !== 'rejected' && a.status !== 'withdrawn'
        && (a.role === 'head-delegate' || a.role === 'faculty-advisor')
        && !!a.society_id
      ) ?? null;
      setApplication(primary);
      setLeaderApp(leader);
      setAllApps(apps);

      const [roleConfigsRes, addonsRes] = await Promise.all([
        supabase
          .from('application_role_configs')
          .select('role, fee_amount, fee_currency, fee_phases, payment_timing')
          .eq('conference_id', conf.id),
        supabase
          .from('addons')
          .select('id, label, description, amount_cents, currency')
          .eq('conference_id', conf.id)
          .eq('active', true),
      ]);
      if (cancelled) return;
      setRoleConfigs((roleConfigsRes.data as PayRoleConfig[]) ?? []);
      setActiveAddons((addonsRes.data as ActiveAddon[]) ?? []);

      if (primary) {
        const [aid, invs, batches] = await Promise.all([
          fetchAidRequest(primary.id, session.access_token),
          fetchInvoices(apps, primary, leader, conf.id, session.access_token),
          fetchPaymentBatches(conf.id, session.access_token),
        ]);
        if (cancelled) return;
        setAidRequest(aid);
        setInvoices(invs);
        setPaymentBatches(batches);
        setConfigDescriptions(await fetchConfigDescriptions(session.access_token, invs));
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

  // Refetches both invoices and payment batches together — every mutation
  // that changes one (a spot/ticket pledge, a voucher, a submitted proof)
  // can affect the other's derived view (awaiting-review chips, new invoice
  // rows), so callers never have to remember to refresh both separately.
  async function refetchInvoices() {
    if (!application || !conference || !session) return;
    const [invs, batches] = await Promise.all([
      fetchInvoices(allApps, application, leaderApp, conference.id, session.access_token),
      fetchPaymentBatches(conference.id, session.access_token),
    ]);
    setInvoices(invs);
    setPaymentBatches(batches);
    setConfigDescriptions(await fetchConfigDescriptions(session.access_token, invs));
  }

  function removeInvoiceLocally(invoiceId: string) {
    setInvoices(prev => prev.filter(i => i.id !== invoiceId));
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: NEU.base }}>
      <SiteNav />
      <div className="flex-1 w-full max-w-[900px] mx-auto px-6 py-10">
        <Link
          href={`/conferences/${slug}/role`}
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
              leaderApp={leaderApp}
              allApps={allApps}
              roleConfig={roleConfigs.find(rc => rc.role === application.role) ?? null}
              delegateRoleConfig={roleConfigs.find(rc => rc.role === 'delegate') ?? null}
              advisorRoleConfig={roleConfigs.find(rc => rc.role === 'faculty-advisor') ?? null}
              aidRequest={aidRequest}
              onAidSubmitted={refetchAid}
              invoices={invoices}
              configDescriptions={configDescriptions}
              activeAddons={activeAddons}
              paymentBatches={paymentBatches}
              onInvoicesChanged={refetchInvoices}
              onInvoiceRemoved={removeInvoiceLocally}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ── Manual payment action, shared by every manual-mode pay surface ─────────
// A manual-mode invoice (or the combined selected batch) either already has
// a proof under review — a quiet status chip, nothing to click — or it
// doesn't, in which case "I HAVE PAID, UPLOAD PROOF" is the one primary
// action; the organizing team's own payment page (when they've set one) is
// secondary guidance above it, not the dead end it used to be.

function ManualPayAction({
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
        <a
          href={externalPaymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 mb-3 font-bold text-sm focus:outline-none"
          style={{ border: '1.5px solid #DDD4C0', color: NEU.ink, fontFamily: OUTFIT, letterSpacing: '0.06em', textDecoration: 'none' }}
        >
          VIEW PAYMENT INSTRUCTIONS
        </a>
      )}
      {externalPaymentNote && (
        <p className="mb-3" style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {externalPaymentNote}
        </p>
      )}
      <button
        onClick={onUploadProof}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm focus:outline-none"
        style={{ backgroundColor: NEU.forest, color: NEU.gold, fontFamily: OUTFIT, letterSpacing: '0.06em', border: 'none', cursor: 'pointer' }}
      >
        <ImageUp size={15} />
        I HAVE PAID, UPLOAD PROOF
      </button>
    </>
  );
}

// ── Remove pledge action, a quiet text trigger + portaled confirm popover ──
// Undoes a misclick (pledged 9 spots instead of 8) before any money moves.
// Portaled at fixed viewport coordinates from the trigger's own rect so the
// card's rounded-corner overflow:hidden can never clip it (mirrors
// PaymentMenu's pattern in manage/[slug]/applications/page.tsx).

function RemovePledgeAction({
  message, onConfirm,
}: {
  message: string;
  onConfirm: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const POP_W = 252;

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.right - POP_W, window.innerWidth - POP_W - 8));
    setPos({ top: r.bottom + 6, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, place]);

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    setError('');
    const result = await onConfirm();
    if (!result.ok) {
      setBusy(false);
      setError(result.error || 'Could not remove this. Please try again.');
      return;
    }
    setBusy(false);
    setOpen(false);
  }

  return (
    <span onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setError(''); setOpen(o => !o); }}
        className="text-xs font-semibold focus:outline-none hover:underline flex-shrink-0"
        style={{ color: '#9A8A78', fontFamily: OUTFIT, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        REMOVE
      </button>
      {open && pos && (
        <Portal>
          <div
            ref={popRef}
            className="rounded-xl p-3.5"
            style={{
              position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: POP_W,
              backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', boxShadow: NEU.out,
              animation: `neuPopIn 160ms ${EASE}`,
            }}
          >
            <style>{'@keyframes neuPopIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }'}</style>
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: '#1C1410', lineHeight: 1.5, margin: 0 }}>{message}</p>
            {error && (
              <p className="mt-2" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: '#8B2020', lineHeight: 1.45 }}>{error}</p>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="flex-1 rounded-lg py-1.5 text-xs font-bold focus:outline-none"
                style={{ border: '1px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT, cursor: busy ? 'default' : 'pointer' }}
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirm}
                disabled={busy}
                className="flex-1 rounded-lg py-1.5 text-xs font-bold focus:outline-none"
                style={{ border: 'none', color: '#FFFFFF', backgroundColor: busy ? '#C89494' : '#8B2020', fontFamily: OUTFIT, cursor: busy ? 'default' : 'pointer' }}
              >
                {busy ? '…' : 'REMOVE'}
              </button>
            </div>
          </div>
        </Portal>
      )}
    </span>
  );
}

// ── Generic invoice card (app_fee / addon) ──────────────────────────────────

function GenericInvoiceCard({
  inv, application, description, paymentsEnabled, manualActive, externalPaymentUrl, externalPaymentNote, contactEmail,
  awaitingReview, onUploadProof, canRemovePledge, onRemovePledge, expanded, onToggleExpand, selected, onToggleSelect, onPay, paying, payError, labelOverride,
}: {
  inv: InvoiceRow;
  /** The invoice's OWNING application (whichever of the user's applications
   *  this row's application_id points at) — not necessarily the page's
   *  primary application, so payability (accepted/assigned/etc.) is judged
   *  against the right application's own status. */
  application: PayApplication;
  description?: string;
  paymentsEnabled: boolean;
  manualActive: boolean;
  externalPaymentUrl: string | null;
  externalPaymentNote: string | null;
  contactEmail: string | null;
  /** This invoice belongs to a currently-pending manual payment batch. */
  awaitingReview: boolean;
  onUploadProof: () => void;
  /** True for an open, unpaid, aid-free pledge_spot/advisor_spot invoice —
   *  undoes a misclick (pledged 9 instead of 8) before any money moves. */
  canRemovePledge: boolean;
  onRemovePledge: () => Promise<{ ok: boolean; error?: string }>;
  expanded: boolean;
  onToggleExpand: () => void;
  selected: boolean;
  onToggleSelect: () => void;
  onPay: () => void;
  paying: boolean;
  payError: string | null;
  /** Overrides invoiceLabel(inv) — used for another application's role_fee
   *  invoice, labeled "{Role label} fee" so it reads distinctly from
   *  role_fee's generic "Registration" fallback. */
  labelOverride?: string;
}) {
  const payable = isInvoicePayable(inv, application.status);
  const settled = isInvoiceSettled(inv);
  const due = invoiceDueCents(inv);
  const badge = invoiceBadge(inv);
  const label = (labelOverride ?? invoiceLabel(inv)) + (inv.quantity > 1 ? ` ×${inv.quantity}` : '');

  if (!payable) {
    return (
      <NeuCard style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, opacity: 0.6 }}>
        <NeuIconDisc gradient={NEU_GRADIENTS.sage} icon={Lock} size={38} />
        <div className="flex-1 min-w-0">
          <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14, color: NEU.ink, margin: 0 }}>{label}</p>
          <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, margin: '2px 0 0 0' }}>
            Payment becomes available once your application is accepted.
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
        {!settled && !awaitingReview && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="flex-shrink-0"
            style={{ width: 16, height: 16, accentColor: NEU.forest, cursor: 'pointer' }}
            aria-label={`Select ${label}`}
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
                  {label}
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
        {canRemovePledge && (
          <RemovePledgeAction
            message={inv.kind === 'advisor_spot' ? 'Remove this advisor ticket? Its invoice will be cancelled.' : 'Remove this spot? Its invoice will be cancelled.'}
            onConfirm={onRemovePledge}
          />
        )}
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
            ) : manualActive ? (
              <ManualPayAction
                awaitingReview={awaitingReview}
                externalPaymentUrl={externalPaymentUrl}
                externalPaymentNote={externalPaymentNote}
                onUploadProof={onUploadProof}
              />
            ) : !paymentsEnabled ? (
              <PaymentsNotSetUp contactEmail={contactEmail} />
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

function AddonsModal({
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
      setError(result?.error || rpcError?.message || 'Could not save your add-ons. Please try again.');
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <ModalOverlay onClose={() => { if (!saving) onClose(); }}>
      <div
        className="rounded-2xl p-6 flex flex-col gap-4"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 460, maxWidth: 'calc(100vw - 32px)', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-black text-lg" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Buy Add-ons</p>
          <button
            onClick={() => { if (!saving) onClose(); }}
            className="flex-shrink-0 focus:outline-none"
            style={{ color: '#9A8A78', border: 'none', background: 'none', cursor: saving ? 'default' : 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {addons.length === 0 ? (
          <p style={{ fontFamily: OUTFIT, fontSize: 13, color: '#6E5F4E' }}>
            This conference hasn&apos;t added any add-ons yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {addons.map(addon => {
              const sel = selections[addon.id] ?? { checked: false, quantity: 1 };
              const isPurchased = purchased.has(addon.id);
              return (
                <div
                  key={addon.id}
                  className="rounded-xl px-4 py-3"
                  style={{ border: '1px solid #DDD4C0', backgroundColor: sel.checked || isPurchased ? 'rgba(27,56,40,0.03)' : '#FFFFFF' }}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={sel.checked}
                      disabled={isPurchased}
                      onChange={() => toggleChecked(addon.id)}
                      className="flex-shrink-0 mt-0.5"
                      style={{ width: 16, height: 16, accentColor: '#1B3828', cursor: isPurchased ? 'default' : 'pointer' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 13.5, color: '#1C1410' }}>{addon.label}</p>
                        <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: '#1C1410', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                          {centsToFee(addon.amount_cents, addon.currency)}
                          <span style={{ color: '#9A8A78', fontWeight: 600 }}> ea.</span>
                        </span>
                      </div>
                      {addon.description && (
                        <p className="mt-0.5" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: '#9A8A78', lineHeight: 1.5 }}>
                          {addon.description}
                        </p>
                      )}

                      {isPurchased ? (
                        <p className="mt-2 inline-flex items-center gap-1" style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, color: '#2A5A3C' }}>
                          Purchased ✓
                        </p>
                      ) : sel.checked && (
                        <div className="mt-2.5 flex items-center gap-2.5">
                          <span style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, color: '#9A8A78', letterSpacing: '0.06em' }}>
                            QTY
                          </span>
                          <div className="inline-flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => setQuantity(addon.id, sel.quantity - 1)}
                              disabled={sel.quantity <= 1}
                              className="flex items-center justify-center rounded-full focus:outline-none"
                              style={{ width: 24, height: 24, border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: sel.quantity <= 1 ? '#DDD4C0' : '#1B3828', cursor: sel.quantity <= 1 ? 'default' : 'pointer' }}
                            >
                              <Minus size={12} />
                            </button>
                            <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: '#1C1410', minWidth: 16, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                              {sel.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => setQuantity(addon.id, sel.quantity + 1)}
                              className="flex items-center justify-center rounded-full focus:outline-none"
                              style={{ width: 24, height: 24, border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1B3828', cursor: 'pointer' }}
                            >
                              <Plus size={12} />
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
            style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: saving ? 'default' : 'pointer' }}
          >
            CANCEL
          </button>
          {addons.length > 0 && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
              style={{
                backgroundColor: saving ? '#DDD4C0' : '#1B3828',
                color: saving ? '#9A8A78' : '#EED98A',
                fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: saving ? 'default' : 'pointer',
              }}
            >
              {saving ? 'SAVING…' : 'SAVE'}
            </button>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Add delegation spots ─────────────────────────────────────────────────────
// Pledges MORE spots for the leader's delegation via add_pledged_spots, which
// materializes each new spot as an owed pledge_spot invoice — no payment
// happens here, the new invoices just appear in the list above (genericInvoices)
// once onAdded triggers a refetch.

function AddSpotsPanel({
  applicationId, accessToken, onAdded,
}: {
  applicationId: string;
  accessToken: string | undefined;
  onAdded: () => void;
}) {
  const [count, setCount] = useState(1);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<number | null>(null);

  async function handleAdd() {
    if (adding || !accessToken || count < 1) return;
    setAdding(true);
    setError(null);
    setJustAdded(null);
    const supabase = getAuthedClient(accessToken);
    const { data, error: rpcError } = await supabase.rpc('add_pledged_spots', {
      p_application_id: applicationId,
      p_count: count,
    });
    const result = data as { ok?: boolean; spots_pledged?: number; error?: string } | null;
    setAdding(false);
    if (rpcError || !result?.ok) {
      setError(result?.error || rpcError?.message || 'Could not add spots. Please try again.');
      return;
    }
    setJustAdded(count);
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
        Pledge more spots for your delegation — each becomes a payable invoice above.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={count}
          onChange={e => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className="rounded-xl px-3 py-2 text-sm text-center focus:outline-none"
          style={{ width: 64, border: 'none', backgroundColor: NEU.base, boxShadow: NEU.inSm, color: NEU.ink, fontFamily: OUTFIT, fontWeight: 700 }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding}
          className="flex-1 rounded-xl py-2.5 text-xs font-bold focus:outline-none"
          style={{
            border: 'none', backgroundColor: adding ? '#DDD4C0' : NEU.forest,
            color: adding ? '#9A8A78' : NEU.gold,
            fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: adding ? 'default' : 'pointer',
          }}
        >
          {adding ? 'ADDING…' : 'ADD'}
        </button>
      </div>
      {justAdded && !error && (
        <Note tone="green">{`Added ${justAdded} spot${justAdded === 1 ? '' : 's'} — check the invoices above.`}</Note>
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

function AdvisorTicketsModal({
  open, onClose, applicationId, accessToken, advisorRoleConfig, onAdded,
}: {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  accessToken: string | undefined;
  advisorRoleConfig: PayRoleConfig | null;
  onAdded: () => void;
}) {
  const [count, setCount] = useState(1);
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
    if (adding || !accessToken || count < 1) return;
    setAdding(true);
    setError(null);
    const supabase = getAuthedClient(accessToken);
    const { data, error: rpcError } = await supabase.rpc('add_pledged_advisor_spots', {
      p_application_id: applicationId,
      p_count: count,
    });
    const result = data as { ok?: boolean; error?: string } | null;
    setAdding(false);
    if (rpcError || !result?.ok) {
      setError(result?.error || rpcError?.message || 'Could not add advisor tickets. Please try again.');
      return;
    }
    onAdded();
    onClose();
  }

  return (
    <ModalOverlay onClose={() => { if (!adding) onClose(); }}>
      <div
        className="rounded-2xl p-6 flex flex-col gap-4"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 400, maxWidth: 'calc(100vw - 32px)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-black text-lg" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Buy Advisor Tickets</p>
          <button
            onClick={() => { if (!adding) onClose(); }}
            className="flex-shrink-0 focus:outline-none"
            style={{ color: '#9A8A78', border: 'none', background: 'none', cursor: adding ? 'default' : 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

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

        <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: '#9A8A78', lineHeight: 1.5, margin: 0 }}>
          Tickets stay with your delegation once purchased, pooled the same way as delegate spots.
        </p>

        <div>
          <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: '#9A8A78', fontFamily: OUTFIT, letterSpacing: '0.06em' }}>
            HOW MANY TICKETS
          </label>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setCount(c => Math.max(1, c - 1))}
              disabled={count <= 1}
              className="flex items-center justify-center rounded-full focus:outline-none"
              style={{ width: 32, height: 32, border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: count <= 1 ? '#DDD4C0' : '#1B3828', cursor: count <= 1 ? 'default' : 'pointer' }}
            >
              <Minus size={14} />
            </button>
            <input
              type="number"
              min={1}
              value={count}
              onChange={e => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="rounded-xl px-3 py-2 text-sm text-center focus:outline-none"
              style={{ width: 64, border: 'none', backgroundColor: NEU.base, boxShadow: NEU.inSm, color: NEU.ink, fontFamily: OUTFIT, fontWeight: 700 }}
            />
            <button
              type="button"
              onClick={() => setCount(c => c + 1)}
              className="flex items-center justify-center rounded-full focus:outline-none"
              style={{ width: 32, height: 32, border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3', color: '#1B3828', cursor: 'pointer' }}
            >
              <Plus size={14} />
            </button>
            {fee > 0 && (
              <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.ink, marginLeft: 'auto' }}>
                {centsToFee(Math.round(fee * count * 100), currency)}
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
            style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: adding ? 'default' : 'pointer' }}
          >
            CANCEL
          </button>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: adding ? '#DDD4C0' : '#1B3828',
              color: adding ? '#9A8A78' : '#EED98A',
              fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: adding ? 'default' : 'pointer',
            }}
          >
            {adding ? 'ADDING…' : 'ADD TICKETS'}
          </button>
        </div>
      </div>
    </ModalOverlay>
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

function ProofUploadModal({
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
    const path = `${conferenceId}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      setSubmitting(false);
      setError(uploadError.message || 'Could not upload your proof. Please try again.');
      return;
    }
    const { data, error: rpcError } = await supabase.rpc('create_manual_payment_batch', {
      p_invoice_ids: invoiceIds,
      p_proof_path: path,
    });
    const result = data as { ok?: boolean; error?: string } | null;
    setSubmitting(false);
    if (rpcError || !result?.ok) {
      setError(result?.error || rpcError?.message || 'Could not submit your payment. Please try again.');
      return;
    }
    onSubmitted();
  }

  return (
    <ModalOverlay onClose={() => { if (!submitting) onClose(); }}>
      <div
        className="rounded-2xl p-6 flex flex-col gap-4"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', width: 420, maxWidth: 'calc(100vw - 32px)', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-black text-lg" style={{ color: '#1C1410', fontFamily: OUTFIT }}>Upload Payment Proof</p>
          <button
            onClick={() => { if (!submitting) onClose(); }}
            className="flex-shrink-0 focus:outline-none"
            style={{ color: '#9A8A78', border: 'none', background: 'none', cursor: submitting ? 'default' : 'pointer' }}
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
          <div className="relative rounded-xl overflow-hidden" style={{ border: '1px solid #DDD4C0' }}>
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
              style={{ backgroundColor: 'rgba(28,20,16,0.72)', color: '#FAF8F3', fontFamily: OUTFIT, border: 'none', cursor: 'pointer' }}
            >
              CHANGE
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl py-8 flex flex-col items-center gap-2 focus:outline-none"
            style={{ border: '1.5px dashed #DDD4C0', backgroundColor: 'transparent', cursor: 'pointer' }}
          >
            <ImageUp size={22} style={{ color: '#9A8A78' }} />
            <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: '#6E5F4E' }}>Choose an image</span>
            <span style={{ fontFamily: OUTFIT, fontSize: 10.5, color: '#9A8A78' }}>JPG or PNG, up to 10MB</span>
          </button>
        )}

        {error && <Note tone="red">{error}</Note>}

        <div className="flex gap-3">
          <button
            onClick={() => { if (!submitting) onClose(); }}
            disabled={submitting}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
            style={{ border: '1.5px solid #DDD4C0', color: '#1C1410', backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: submitting ? 'default' : 'pointer' }}
          >
            CANCEL
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !file}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: submitting || !file ? '#DDD4C0' : '#1B3828',
              color: submitting || !file ? '#9A8A78' : '#EED98A',
              fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: submitting || !file ? 'default' : 'pointer',
            }}
          >
            {submitting ? 'SUBMITTING…' : 'SUBMIT'}
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

const BATCH_METHOD_LABEL: Record<string, string> = {
  stripe: 'Card via Stripe',
  manual: 'Manual with proof',
  organizer: 'Recorded by organizers',
};

const BATCH_STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: 'rgba(184,132,74,0.16)', color: '#8A6614', label: 'AWAITING REVIEW' },
  paid: { bg: 'rgba(61,122,82,0.13)', color: '#2A5A3C', label: 'PAID' },
  rejected: { bg: 'rgba(139,32,32,0.1)', color: '#8B2020', label: 'REJECTED' },
};

function BatchStatusPill({ status }: { status: string }) {
  const s = BATCH_STATUS_STYLES[status] ?? BATCH_STATUS_STYLES.pending;
  return (
    <span
      className="px-2.5 py-1 rounded-full flex-shrink-0"
      style={{ backgroundColor: s.bg, color: s.color, fontSize: 10, fontFamily: OUTFIT, fontWeight: 800, letterSpacing: '0.06em' }}
    >
      {s.label}
    </span>
  );
}

function PaymentsPanel({
  batches, expandedIds, onToggleExpand,
}: {
  batches: PaymentBatchRow[];
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
}) {
  if (batches.length === 0) {
    return (
      <NeuCard style={{ padding: '24px', textAlign: 'center' }}>
        <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted }}>
          No payments recorded yet.
        </p>
      </NeuCard>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {batches.map(batch => {
        const expanded = expandedIds.has(batch.id);
        const items = batch.payments ?? [];
        return (
          <NeuCard key={batch.id} style={{ padding: 0, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => onToggleExpand(batch.id)}
              className="w-full flex items-center gap-3 focus:outline-none"
              style={{ padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <NeuIconDisc
                gradient={batch.method === 'stripe' ? NEU_GRADIENTS.forest : NEU_GRADIENTS.amber}
                icon={batch.method === 'stripe' ? CreditCard : Receipt}
                size={38}
              />
              <div className="flex-1 min-w-0">
                <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 13.5, color: NEU.ink, margin: 0 }}>
                  {BATCH_METHOD_LABEL[batch.method] ?? batch.method}
                </p>
                <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, margin: '2px 0 0 0' }}>
                  {new Date(batch.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 900, color: NEU.ink, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {centsToFee(batch.total_cents, batch.currency)}
              </span>
              <BatchStatusPill status={batch.status} />
              {expanded ? <ChevronUp size={16} style={{ color: NEU.muted, flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: NEU.muted, flexShrink: 0 }} />}
            </button>

            {expanded && (
              <div style={{ padding: '0 18px 16px 18px', borderTop: '1px solid rgba(27,56,40,0.08)' }}>
                <div className="pt-3 flex flex-col gap-2">
                  {items.map(item => {
                    const inv = Array.isArray(item.invoice) ? item.invoice[0] : item.invoice;
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-3">
                        <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.ink }}>
                          {inv ? invoiceLabel(inv) : 'Invoice'}
                        </span>
                        <span style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
                          {centsToFee(item.amount_cents, item.currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </NeuCard>
        );
      })}
    </div>
  );
}

// ── Invoice + actions (only mounted once real data is loaded, so its money
// math hooks initialize against real values) ────────────────────────────────

function PayInvoiceAndActions({
  conference, application, leaderApp, allApps, roleConfig, delegateRoleConfig, advisorRoleConfig, aidRequest, onAidSubmitted, invoices, configDescriptions,
  activeAddons, paymentBatches, onInvoicesChanged, onInvoiceRemoved,
}: {
  conference: PayConference;
  application: PayApplication;
  leaderApp: PayApplication | null;
  /** Every application the signed-in user holds at this conference — used
   *  strictly to look up the OWNING application of another application's
   *  role_fee invoice (role label + status), never to source a field of the
   *  primary role-fee card itself. */
  allApps: PayApplication[];
  roleConfig: PayRoleConfig | null;
  delegateRoleConfig: PayRoleConfig | null;
  advisorRoleConfig: PayRoleConfig | null;
  aidRequest: AidRequestRow | null;
  onAidSubmitted: () => void;
  invoices: InvoiceRow[];
  configDescriptions: Record<string, string>;
  activeAddons: ActiveAddon[];
  paymentBatches: PaymentBatchRow[];
  onInvoicesChanged: () => void;
  /** Removes one invoice from local state immediately (a removed pledge
   *  should vanish from the list right away, not wait on a round trip). */
  onInvoiceRemoved: (invoiceId: string) => void;
}) {
  const { session } = useAuth();
  const aidBlocks: FormBlock[] = normalizeBlocks(conference.aid_questions);
  const currency = roleConfig?.fee_currency ?? conference.fee_currency;
  const { amount: resolvedFee, phase } = activePhaseFee({ fee_amount: roleConfig?.fee_amount ?? 0, fee_phases: roleConfig?.fee_phases ?? null });
  const fee = resolvedFee ?? 0;
  const grantedAmount = aidRequest?.status === 'approved' ? (aidRequest.granted_amount ?? 0) : 0;

  // The registration invoice, when it exists — its amount_cents is now ALWAYS
  // the net owed (fee − aid − voucher), auto-saved server-side the moment a
  // voucher is applied/removed (apply_voucher), so it's the source of truth
  // for Total/due rather than a live fee-minus-aid computation. Before it
  // exists (not yet payable/synced), fall back to fee − aid with no voucher.
  // Bound to primary specifically (application_id match) — invoices now also
  // covers a dual-role leaderApp's own rows, which can include its own
  // role_fee invoice, so kind alone is no longer a unique-enough filter.
  const roleFeeInvoice = invoices.find(inv => inv.kind === 'role_fee' && inv.application_id === application.id);
  // Every OTHER application's own role_fee invoice never feeds a single
  // field of the primary card above — it renders as its own card in the
  // generic list instead (see genericInvoices below), keyed by its actual
  // owning application so its role label and payability are its own.
  const appById = new Map(allApps.map(a => [a.id, a] as const));
  const preVoucherCents = Math.round(Math.max(0, fee - grantedAmount) * 100);
  const netCents = roleFeeInvoice ? roleFeeInvoice.amount_cents : preVoucherCents;
  const dueCents = roleFeeInvoice ? invoiceDueCents(roleFeeInvoice) : Math.max(0, netCents - Math.round(application.amount_paid * 100));
  const voucherDiscountCents = Math.max(0, preVoucherCents - netCents);
  const badge = roleFeeInvoice ? invoiceBadge(roleFeeInvoice) : deriveBadge(application.payment_status, application.amount_paid);
  const owesSomething = badge === 'UNPAID' || badge === 'PARTIAL';
  // Every invoice id currently sitting in a pending (awaiting-review) manual
  // payment batch — hides the pay affordance and selection checkbox in favor
  // of a quiet status chip, everywhere an invoice can render.
  const pendingProofInvoiceIds = new Set(
    paymentBatches.filter(b => b.status === 'pending').flatMap(b => b.payments.map(p => p.invoice_id))
  );
  const roleFeeAwaitingReview = !!roleFeeInvoice && pendingProofInvoiceIds.has(roleFeeInvoice.id);
  const roleFeeSelectable = !!roleFeeInvoice && !isInvoiceSettled(roleFeeInvoice) && dueCents > 0 && !roleFeeAwaitingReview;
  const isCovered = roleFeeInvoice?.status === 'waived';
  const gateState = getGateState(roleConfig?.payment_timing ?? 'anytime', application.status, application.payment_status);
  const payableNow = gateState !== 'under_review';
  const paymentsEnabled = conference.payment_method === 'stripe' && conference.connect_onboarding_status === 'complete';
  const externalPaymentUrl = conference.payment_method === 'manual' ? conference.external_payment_url : null;
  const manualActive = conference.payment_method === 'manual';
  // Gated on leaderApp, not primary — a dual-role user's primary application
  // can be a plain delegate app even while they lead a delegation through a
  // separate head-delegate/advisor application.
  const canBuyDelegationStuff = leaderApp !== null;

  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherApplying, setVoucherApplying] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [stubMessage, setStubMessage] = useState<string | null>(null);
  const [aidModalOpen, setAidModalOpen] = useState(false);
  const [addonsModalOpen, setAddonsModalOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [spotsOpen, setSpotsOpen] = useState(false);
  const [advisorModalOpen, setAdvisorModalOpen] = useState(false);
  // Left column: Current Invoices (what's owed or awaiting review) vs
  // Payments (the full payment_batches history, every method). Settled
  // invoices never appear in the invoices list any more — once paid, they
  // only live in Payments.
  const [leftTab, setLeftTab] = useState<'invoices' | 'payments'>('invoices');
  const [expandedBatchIds, setExpandedBatchIds] = useState<Set<string>>(new Set());
  // Set (not null) to open the proof-upload modal for exactly these invoice
  // ids — a single invoice's own pay path, or the combined selected batch.
  const [proofModalIds, setProofModalIds] = useState<string[] | null>(null);

  // Generic invoice cards — app_fee, addon, pledge_spot (owed delegation
  // spots, materialized by add_pledged_spots), advisor_spot (owed advisor
  // tickets, materialized by add_pledged_advisor_spots), plus any OTHER
  // application's role_fee invoice (the primary card above only ever shows
  // its own). All are individually payable or selectable into the combined
  // "Pay Selected" batch. Settled invoices are excluded — they've moved to
  // the Payments tab, they don't linger here.
  const genericInvoices = invoices.filter(inv =>
    inv.status !== 'settled'
    && (inv.kind === 'app_fee' || inv.kind === 'addon' || inv.kind === 'pledge_spot' || inv.kind === 'advisor_spot'
      || (inv.kind === 'role_fee' && inv.application_id !== application.id))
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [genericPayingId, setGenericPayingId] = useState<string | null>(null);
  const [genericPayError, setGenericPayError] = useState<Record<string, string>>({});
  const [selectedPaying, setSelectedPaying] = useState(false);
  const [selectedPayError, setSelectedPayError] = useState<string | null>(null);

  function toggleExpandedBatch(id: string) {
    setExpandedBatchIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleProofSubmitted() {
    setProofModalIds(null);
    await onInvoicesChanged();
  }

  // Undoes a misclick (pledged 9 spots instead of 8) before any money moves.
  // Removes the row from local state immediately on success, then refetches
  // so the count/list stay reconciled against the server.
  async function handleRemovePledge(invoiceId: string): Promise<{ ok: boolean; error?: string }> {
    if (!session) return { ok: false, error: 'Session expired. Please sign in again.' };
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.rpc('remove_pledged_spot_invoice', { p_invoice_id: invoiceId });
    const result = data as { ok?: boolean; error?: string } | null;
    if (error || !result?.ok) {
      return { ok: false, error: result?.error || error?.message || 'Could not remove this. Please try again.' };
    }
    onInvoiceRemoved(invoiceId);
    onInvoicesChanged();
    return { ok: true };
  }

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

  // Registration is paid in full, net of aid/voucher — no partial-amount
  // selector. Vouchers apply upfront (apply_voucher, below) and re-net the
  // invoice immediately, so by the time this fires the invoice's own
  // amount_cents is already correct — same invoiceId checkout path as any
  // other card.
  async function handlePay() {
    if (paying || dueCents <= 0 || !session || !roleFeeInvoice) return;
    setPaying(true);
    setPayError(null);
    const result = await payInvoiceCheckout({ invoiceId: roleFeeInvoice.id, accessToken: session.access_token });
    if (result.status === 'redirect' && result.redirectUrl) {
      window.location.assign(result.redirectUrl);
      return;
    }
    setPaying(false);
    if (result.status === 'error') setPayError(result.message ?? 'Something went wrong. Please try again.');
  }

  // Applies (or, with an empty code, removes) a registration voucher upfront
  // — apply_voucher stamps the role_fee invoice and re-nets its amount_cents
  // immediately, so a re-fetch is all that's needed to show the new Total.
  // Unstackable: a new code replaces whatever was applied before.
  async function applyVoucher(code: string) {
    if (voucherApplying || !session) return;
    setVoucherApplying(true);
    setVoucherError(null);
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase.rpc('apply_voucher', {
      p_application_id: application.id,
      p_code: code,
    });
    const result = data as { ok?: boolean; error?: string } | null;
    setVoucherApplying(false);
    if (error || !result?.ok) {
      setVoucherError(result?.error || error?.message || 'Could not apply that code. Please try again.');
      return;
    }
    if (!code) setVoucherCode('');
    await onInvoicesChanged();
  }

  // Any generic (app_fee/addon) invoice pays through create-checkout's
  // invoiceId path — its amount_cents is already final (config-set).
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

  // Selected invoices, including the registration invoice when checked — the
  // Total row and combined payment both work off this same set.
  const selectedInvoices = invoices.filter(inv => selectedIds.has(inv.id) && !isInvoiceSettled(inv));
  const selectedTotalCents = selectedInvoices.reduce((sum, inv) => sum + invoiceDueCents(inv), 0);

  // Pays every selected, still-owed invoice in ONE Stripe Checkout session.
  // Every invoice's amount_cents (role_fee included, now that apply_voucher
  // keeps it net) is already correct — no server-side recompute needed.
  async function handlePaySelected() {
    if (selectedPaying || !session || selectedInvoices.length === 0) return;
    setSelectedPaying(true);
    setSelectedPayError(null);
    const result = await payInvoicesCheckout({
      invoiceIds: selectedInvoices.map(inv => inv.id),
      accessToken: session.access_token,
    });
    if (result.status === 'redirect' && result.redirectUrl) {
      window.location.assign(result.redirectUrl);
      return;
    }
    setSelectedPaying(false);
    if (result.status === 'error') setSelectedPayError(result.message ?? 'Something went wrong. Please try again.');
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
      {/* LEFT — Current Invoices / Payments */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 mb-1">
          <button
            type="button"
            onClick={() => setLeftTab('invoices')}
            className="rounded-full px-4 py-1.5 text-xs font-bold focus:outline-none transition-colors"
            style={{
              border: leftTab === 'invoices' ? `1.5px solid ${NEU.forest}` : '1.5px solid #DDD4C0',
              backgroundColor: leftTab === 'invoices' ? 'rgba(27,56,40,0.06)' : 'transparent',
              color: leftTab === 'invoices' ? NEU.forest : NEU.muted,
              fontFamily: OUTFIT, letterSpacing: '0.04em', cursor: 'pointer',
            }}
          >
            CURRENT INVOICES
          </button>
          <button
            type="button"
            onClick={() => setLeftTab('payments')}
            className="rounded-full px-4 py-1.5 text-xs font-bold focus:outline-none transition-colors"
            style={{
              border: leftTab === 'payments' ? `1.5px solid ${NEU.forest}` : '1.5px solid #DDD4C0',
              backgroundColor: leftTab === 'payments' ? 'rgba(27,56,40,0.06)' : 'transparent',
              color: leftTab === 'payments' ? NEU.forest : NEU.muted,
              fontFamily: OUTFIT, letterSpacing: '0.04em', cursor: 'pointer',
            }}
          >
            PAYMENTS{paymentBatches.length > 0 ? ` (${paymentBatches.length})` : ''}
          </button>
        </div>

        {leftTab === 'payments' ? (
          <PaymentsPanel
            batches={paymentBatches}
            expandedIds={expandedBatchIds}
            onToggleExpand={toggleExpandedBatch}
          />
        ) : (
        <>
        {/* Registration fee — its own panel. Paid in full, net of aid/voucher
            (no partial amounts); the voucher box applies upfront via
            apply_voucher rather than at checkout. Header checkbox lets it
            join the combined "Pay Selected" batch too. Hidden once actually
            settled (paid) — that history now lives in the Payments tab;
            waived stays visible since there's nothing to reconcile there. */}
        {fee > 0 && roleFeeInvoice?.status !== 'settled' && (
          <NeuCard style={{ padding: 0, overflow: 'hidden' }}>
            <div className="w-full flex items-center gap-3" style={{ padding: '18px 20px' }}>
              {roleFeeSelectable && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(roleFeeInvoice!.id)}
                  onChange={() => toggleSelected(roleFeeInvoice!.id)}
                  className="flex-shrink-0"
                  style={{ width: 16, height: 16, accentColor: NEU.forest, cursor: 'pointer' }}
                  aria-label="Select registration fee"
                />
              )}
              <button
                type="button"
                onClick={() => setInvoiceOpen(v => !v)}
                className="flex-1 flex items-center justify-between gap-3 min-w-0 focus:outline-none"
                style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Wallet} size={40} />
                  <div className="min-w-0">
                    <p style={{ fontFamily: OUTFIT, fontWeight: 800, fontSize: 14.5, color: NEU.ink, margin: 0 }}>
                      {roleLabel(application.role)} fee
                    </p>
                    <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted, margin: '2px 0 0 0' }}>
                      {isCovered
                        ? `${invoiceLabel(roleFeeInvoice!)} · ${centsToFee(0, currency)}`
                        : fee > 0 ? `${formatFee(fee, currency)} · balance due ${centsToFee(dueCents, currency)}` : 'Free'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <BadgePill badge={badge} />
                  {invoiceOpen ? <ChevronUp size={16} style={{ color: NEU.muted }} /> : <ChevronDown size={16} style={{ color: NEU.muted }} />}
                </div>
              </button>
            </div>

            {invoiceOpen && (
              <div style={{ padding: '0 20px 20px 20px', borderTop: '1px solid rgba(27,56,40,0.08)' }}>
                {isCovered ? (
                  <div className="pt-4">
                    <div className="flex items-center justify-between pb-4">
                      <span style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.ink, fontWeight: 800 }}>{invoiceLabel(roleFeeInvoice!)}</span>
                      <span style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.ink, fontWeight: 800 }}>{centsToFee(0, currency)}</span>
                    </div>
                    <Note tone="green">Nothing to pay — this spot is covered.</Note>
                  </div>
                ) : (
                <>
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
                  {voucherDiscountCents > 0 && (
                    <div className="flex items-center justify-between">
                      <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted }}>− Voucher</span>
                      <span style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.green, fontWeight: 600 }}>−{centsToFee(voucherDiscountCents, currency)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1.5 mt-0.5" style={{ borderTop: '1px dashed rgba(27,56,40,0.16)' }}>
                    <span style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.ink, fontWeight: 800 }}>Total</span>
                    <span style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.ink, fontWeight: 800 }}>{centsToFee(netCents, currency)}</span>
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

                {/* Voucher — always available (manual or Stripe), applies
                    upfront via apply_voucher rather than at checkout. */}
                <div className="mb-4">
                  {!voucherOpen && voucherDiscountCents === 0 ? (
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
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={voucherCode}
                          onChange={e => setVoucherCode(e.target.value)}
                          placeholder="e.g. EARLYBIRD10"
                          className="flex-1 rounded-xl px-3.5 py-2.5 text-sm uppercase focus:outline-none"
                          style={{ border: 'none', backgroundColor: NEU.base, boxShadow: NEU.inSm, color: NEU.ink, fontFamily: OUTFIT }}
                        />
                        <button
                          type="button"
                          onClick={() => applyVoucher(voucherCode.trim())}
                          disabled={voucherApplying || !voucherCode.trim()}
                          className="rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none"
                          style={{
                            border: 'none', backgroundColor: voucherApplying || !voucherCode.trim() ? '#DDD4C0' : NEU.forest,
                            color: voucherApplying || !voucherCode.trim() ? '#9A8A78' : NEU.gold,
                            fontFamily: OUTFIT, whiteSpace: 'nowrap', cursor: voucherApplying || !voucherCode.trim() ? 'default' : 'pointer',
                          }}
                        >
                          {voucherApplying ? '...' : 'APPLY'}
                        </button>
                      </div>
                      {voucherDiscountCents > 0 ? (
                        <div className="flex items-center justify-between mt-1.5">
                          <span style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.green, fontWeight: 700 }}>
                            Voucher applied: −{centsToFee(voucherDiscountCents, currency)}
                          </span>
                          <button
                            type="button"
                            onClick={() => applyVoucher('')}
                            disabled={voucherApplying}
                            className="text-xs font-bold focus:outline-none"
                            style={{ color: '#8B2020', fontFamily: OUTFIT, textDecoration: 'underline', textUnderlineOffset: 3, background: 'none', border: 'none', cursor: voucherApplying ? 'default' : 'pointer', padding: 0 }}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <p className="mt-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted }}>
                          Applied immediately, before you check out.
                        </p>
                      )}
                      {voucherError && (
                        <p className="mt-1.5" style={{ fontFamily: OUTFIT, fontSize: 11, color: '#8B2020' }}>{voucherError}</p>
                      )}
                    </div>
                  )}
                </div>

                {!payableNow ? (
                  <Note tone="amber">Payment becomes available once your application is accepted.</Note>
                ) : fee === 0 ? (
                  <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted }}>
                    There&apos;s no fee for this role, nothing to pay.
                  </p>
                ) : owesSomething && manualActive ? (
                  <ManualPayAction
                    awaitingReview={roleFeeAwaitingReview}
                    externalPaymentUrl={externalPaymentUrl}
                    externalPaymentNote={conference.external_payment_note}
                    onUploadProof={() => setProofModalIds([roleFeeInvoice!.id])}
                  />
                ) : owesSomething && !paymentsEnabled ? (
                  <PaymentsNotSetUp contactEmail={conference.contact_email} />
                ) : owesSomething ? (
                  <>
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
                      {paying ? 'OPENING CHECKOUT...' : `PAY ${centsToFee(dueCents, currency)}`}
                    </button>
                  </>
                ) : (
                  <Note tone="green">Paid in full. Thank you!</Note>
                )}
                </>
                )}
              </div>
            )}
          </NeuCard>
        )}

        {/* Conference application fee + add-ons + any other application's
            role_fee — generic invoice cards */}
        {genericInvoices.map(inv => {
          const owner = inv.kind === 'role_fee' ? (appById.get(inv.application_id ?? '') ?? application) : application;
          return (
            <GenericInvoiceCard
              key={inv.id}
              inv={inv}
              application={owner}
              labelOverride={inv.kind === 'role_fee' ? `${roleLabel(owner.role)} fee` : undefined}
              description={inv.config_id ? configDescriptions[inv.config_id] : undefined}
              paymentsEnabled={paymentsEnabled}
              manualActive={manualActive}
              externalPaymentUrl={externalPaymentUrl}
              externalPaymentNote={conference.external_payment_note}
              contactEmail={conference.contact_email}
              awaitingReview={pendingProofInvoiceIds.has(inv.id)}
              onUploadProof={() => setProofModalIds([inv.id])}
              canRemovePledge={
                (inv.kind === 'pledge_spot' || inv.kind === 'advisor_spot')
                && inv.status === 'open' && inv.aid_applied_cents === 0 && !pendingProofInvoiceIds.has(inv.id)
              }
              onRemovePledge={() => handleRemovePledge(inv.id)}
              expanded={expandedIds.has(inv.id)}
              onToggleExpand={() => toggleExpanded(inv.id)}
              selected={selectedIds.has(inv.id)}
              onToggleSelect={() => toggleSelected(inv.id)}
              onPay={() => handlePayInvoice(inv.id)}
              paying={genericPayingId === inv.id}
              payError={genericPayError[inv.id] || null}
            />
          );
        })}

        {fee <= 0 && genericInvoices.length === 0 && (
          <NeuCard style={{ padding: '24px', textAlign: 'center' }}>
            <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted }}>
              Nothing to pay right now.
            </p>
          </NeuCard>
        )}

        {/* Total + Pay Selected — below the list, only while something's picked */}
        {selectedInvoices.length > 0 && (
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex items-center justify-between px-1">
              <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.ink }}>
                Total ({selectedInvoices.length} selected)
              </span>
              <span style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 900, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
                {centsToFee(selectedTotalCents, currency)}
              </span>
            </div>

            {manualActive ? (
              <ManualPayAction
                awaitingReview={false}
                externalPaymentUrl={externalPaymentUrl}
                externalPaymentNote={conference.external_payment_note}
                onUploadProof={() => setProofModalIds(selectedInvoices.map(inv => inv.id))}
              />
            ) : !paymentsEnabled ? (
              <PaymentsNotSetUp contactEmail={conference.contact_email} />
            ) : (
              <>
                {selectedPayError && <Note tone="red">{selectedPayError}</Note>}
                <button
                  onClick={handlePaySelected}
                  disabled={selectedPaying}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm focus:outline-none transition-colors"
                  style={{
                    backgroundColor: selectedPaying ? '#DDD4C0' : NEU.forest,
                    color: selectedPaying ? '#9A8A78' : NEU.gold,
                    fontFamily: OUTFIT, letterSpacing: '0.06em', border: 'none', cursor: selectedPaying ? 'default' : 'pointer',
                  }}
                >
                  <CreditCard size={15} />
                  {selectedPaying ? 'OPENING CHECKOUT...' : `PAY SELECTED (${selectedInvoices.length})`}
                </button>
              </>
            )}
          </div>
        )}
        </>
        )}
      </div>

      {/* RIGHT — action buttons, always visible; unavailable ones dim and
          explain why on click instead of disappearing. */}
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

        <ActionRow
          icon={ShoppingBag}
          gradient={NEU_GRADIENTS.sage}
          title="Buy Add-ons"
          subtitle={activeAddons.length > 0 ? 'Optional extras' : 'None available'}
          dimmed={activeAddons.length === 0}
          onClick={() => {
            if (activeAddons.length === 0) { setStubMessage("This conference hasn't added any add-ons yet."); return; }
            setAddonsModalOpen(true);
          }}
        />

        <ActionRow
          icon={Users2}
          gradient={NEU_GRADIENTS.forest}
          title="Add Delegation Spots"
          subtitle={canBuyDelegationStuff ? (spotsOpen ? 'Hide' : 'Pledge more spots') : 'Delegation leaders only'}
          dimmed={!canBuyDelegationStuff}
          onClick={() => {
            if (!canBuyDelegationStuff) { setStubMessage('Only delegation leaders can add spots or credits.'); return; }
            setSpotsOpen(v => !v);
          }}
        />
        {canBuyDelegationStuff && leaderApp && spotsOpen && (
          <>
            <AddSpotsPanel
              applicationId={leaderApp.id}
              accessToken={session?.access_token}
              onAdded={onInvoicesChanged}
            />
            <PledgeInvoicingCard
              applicationId={leaderApp.id}
              societyId={leaderApp.society_id as string}
              currency={delegateRoleConfig?.fee_currency ?? currency}
              financialAidEnabled={conference.financial_aid_enabled}
              aidBlocks={aidBlocks}
              aidIntro={conference.aid_intro}
            />
          </>
        )}

        <ActionRow
          icon={GraduationCap}
          gradient={NEU_GRADIENTS.amber}
          title="Buy Advisor Tickets"
          subtitle={canBuyDelegationStuff ? 'Pledge tickets for your advisors' : 'Delegation leaders only'}
          dimmed={!canBuyDelegationStuff}
          onClick={() => {
            if (!canBuyDelegationStuff) { setStubMessage('Only delegation leaders can add spots or tickets.'); return; }
            setAdvisorModalOpen(true);
          }}
        />

        <ActionRow
          icon={Coins}
          gradient={NEU_GRADIENTS.gold}
          title="Buy Delegation Credits"
          subtitle={canBuyDelegationStuff ? (creditsOpen ? 'Hide' : 'Fund your delegation pool') : 'Delegation leaders only'}
          dimmed={!canBuyDelegationStuff}
          onClick={() => {
            if (!canBuyDelegationStuff) { setStubMessage('Only delegation leaders can buy spots or credits.'); return; }
            setCreditsOpen(v => !v);
          }}
        />
        {canBuyDelegationStuff && leaderApp && creditsOpen && <DelegationCreditsCard societyId={leaderApp.society_id as string} />}
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

      <AddonsModal
        open={addonsModalOpen}
        onClose={() => setAddonsModalOpen(false)}
        addons={activeAddons}
        invoices={invoices}
        applicationId={application.id}
        accessToken={session?.access_token}
        onSaved={onInvoicesChanged}
      />

      {canBuyDelegationStuff && leaderApp && (
        <AdvisorTicketsModal
          open={advisorModalOpen}
          onClose={() => setAdvisorModalOpen(false)}
          applicationId={leaderApp.id}
          accessToken={session?.access_token}
          advisorRoleConfig={advisorRoleConfig}
          onAdded={onInvoicesChanged}
        />
      )}

      <ProofUploadModal
        open={proofModalIds !== null}
        onClose={() => setProofModalIds(null)}
        invoiceIds={proofModalIds ?? []}
        conferenceId={conference.id}
        accessToken={session?.access_token}
        onSubmitted={handleProofSubmitted}
      />
    </div>
  );
}
