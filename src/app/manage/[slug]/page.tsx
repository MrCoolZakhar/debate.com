'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, CheckCircle, MapPin, CreditCard, Building2, FileText, Rocket, Mail,
  Gavel, UsersRound, UserPlus, Wallet, Palette, Flag, TrendingUp, ArrowRight,
} from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { formatFee } from '@/lib/utils';
import {
  NeuCard, NeuInset, NeuIconDisc, NeuStatTile, NeuProgress, NeuRing,
  NeuPill, NeuButton, NeuChecklistRow, NEU, NEU_GRADIENTS, OUTFIT, EASE,
  smoothPath,
} from '@/components/neu';

// ── Publish modal ──────────────────────────────────────────────────────────

function PublishModal({
  conference,
  onClose,
  onPublished,
}: {
  conference: { id: string; full_name: string };
  onClose: () => void;
  onPublished: () => void;
}) {
  const [publishing, setPublishing] = useState(false);
  const { session } = useAuth();

  async function handlePublish() {
    setPublishing(true);
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase
      .from('conferences')
      .update({ is_public: true, status: 'public' })
      .eq('id', conference.id);
    setPublishing(false);
    onPublished();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{ backgroundColor: NEU.surface, boxShadow: NEU.out }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-black text-xl mb-2" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
          Publish Conference?
        </h2>
        <p className="text-sm mb-6" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
          Your conference will appear publicly on gavelling.com/conferences and delegates will be able to apply.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm tracking-widest transition-colors focus:outline-none"
            style={{ border: '1.5px solid #DDD4C0', color: NEU.ink, backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.06em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
          >
            CANCEL
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex-1 rounded-xl py-2.5 font-bold text-sm tracking-widest transition-colors focus:outline-none"
            style={{
              backgroundColor: publishing ? '#DDD4C0' : '#1B3828',
              color: publishing ? NEU.muted : NEU.gold,
              fontFamily: OUTFIT,
              letterSpacing: '0.06em',
            }}
            onMouseEnter={(e) => { if (!publishing) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { if (!publishing) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            {publishing ? 'PUBLISHING...' : 'PUBLISH NOW'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Time-series bucketing ──────────────────────────────────────────────────

interface AppRow {
  submitted_at: string;
  status: string;
  payment_status: string | null;
  role: string;
  society_id: string | null;
}

interface Bucket { t: number; label: string; apps: number; accepted: number; paid: number }

const DAY = 86400000;

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Buckets applications into days (span ≤ 30 days) or weeks.
 * NOTE: there is no paid_at column on applications — paid rows are bucketed
 * by their submitted_at as an approximation of when the revenue arrived.
 */
function buildBuckets(rows: AppRow[]): Bucket[] {
  const times = rows
    .map(r => new Date(r.submitted_at).getTime())
    .filter(t => Number.isFinite(t));
  if (times.length === 0) return [];

  const min = Math.min(...times);
  const max = Math.max(...times);
  const weekly = (max - min) / DAY > 30;
  const step = weekly ? 7 * DAY : DAY;
  const start = startOfDay(min);

  const buckets: Bucket[] = [];
  for (let t = start; t <= max; t += step) {
    buckets.push({
      t,
      label: new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      apps: 0, accepted: 0, paid: 0,
    });
  }

  for (const r of rows) {
    const t = new Date(r.submitted_at).getTime();
    if (!Number.isFinite(t)) continue;
    const i = Math.min(buckets.length - 1, Math.max(0, Math.floor((startOfDay(t) - start) / step)));
    buckets[i].apps += 1;
    if (r.status === 'accepted') buckets[i].accepted += 1;
    if (r.payment_status === 'paid') buckets[i].paid += 1;
  }

  // A lone bucket can't draw a line — pad a zero bucket before it.
  if (buckets.length === 1) {
    const prev = buckets[0].t - step;
    buckets.unshift({
      t: prev,
      label: new Date(prev).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      apps: 0, accepted: 0, paid: 0,
    });
  }
  return buckets;
}

function cumulative(values: number[]): number[] {
  let sum = 0;
  return values.map(v => (sum += v));
}

// ── Growth chart — hand-rolled SVG: gold revenue bars + forest cumulative line ─

function GrowthChart({ buckets, fee, currency }: { buckets: Bucket[]; fee: number; currency: string }) {
  const W = 640, H = 232;
  const padL = 36, padR = 14, padT = 16, padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = buckets.length;
  const slot = plotW / n;

  const cumApps = cumulative(buckets.map(b => b.apps));
  const revenue = buckets.map(b => b.paid * fee);
  const maxCum = Math.max(...cumApps, 1);
  const maxRev = Math.max(...revenue, 1);
  const hasRevenue = revenue.some(v => v > 0);

  const xc = (i: number) => padL + slot * (i + 0.5);
  const yApps = (v: number) => padT + plotH - (v / maxCum) * plotH;
  const yRev = (v: number) => padT + plotH - (v / maxRev) * (plotH * 0.86);

  const barW = Math.min(24, slot * 0.52);
  const baseY = padT + plotH;

  // Rounded-top bar path.
  const bar = (i: number, v: number): string => {
    if (v <= 0) return '';
    const x = xc(i) - barW / 2;
    const top = yRev(v);
    const r = Math.min(barW / 2, Math.max(2, baseY - top));
    return `M ${x} ${baseY} L ${x} ${top + r} Q ${x} ${top} ${x + r} ${top} L ${x + barW - r} ${top} Q ${x + barW} ${top} ${x + barW} ${top + r} L ${x + barW} ${baseY} Z`;
  };

  const linePts = cumApps.map((v, i) => ({ x: xc(i), y: yApps(v) }));
  const lastPt = linePts[linePts.length - 1];

  // 2 horizontal guides (half + max) — no gridline clutter.
  const guides = [0.5, 1].map(f => ({ y: yApps(maxCum * f), v: Math.round(maxCum * f) }));
  const labelEvery = Math.max(1, Math.ceil(n / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Applications and revenue over time">
      {guides.map(g => (
        <g key={g.v}>
          <line x1={padL} x2={W - padR} y1={g.y} y2={g.y} stroke="rgba(27,56,40,0.08)" strokeWidth={1} />
          <text x={padL - 7} y={g.y + 3} textAnchor="end" style={{ fontFamily: OUTFIT, fontSize: 10, fill: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
            {g.v}
          </text>
        </g>
      ))}
      <line x1={padL} x2={W - padR} y1={baseY} y2={baseY} stroke="rgba(27,56,40,0.14)" strokeWidth={1} />

      {/* Revenue bars — alternating gold / deep gold, rounded tops */}
      {hasRevenue && revenue.map((v, i) => (
        v > 0 ? <path key={i} d={bar(i, v)} fill={i % 2 === 0 ? NEU.gold : NEU.deepGold} opacity={i % 2 === 0 ? 0.95 : 0.75} /> : null
      ))}

      {/* Cumulative applications — smooth forest line + emphasised end dot */}
      <path d={smoothPath(linePts)} fill="none" stroke={NEU.forest} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {lastPt && <circle cx={lastPt.x} cy={lastPt.y} r={4} fill={NEU.forest} stroke="#FFFFFF" strokeWidth={2} />}

      {/* X labels */}
      {buckets.map((b, i) => (
        i % labelEvery === 0 ? (
          <text key={b.t} x={xc(i)} y={H - 8} textAnchor="middle" style={{ fontFamily: OUTFIT, fontSize: 10, fill: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
            {b.label}
          </text>
        ) : null
      ))}

      {/* Max revenue tick, right-aligned in gold */}
      {hasRevenue && (
        <text x={W - padR} y={padT + 4} textAnchor="end" style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 700, fill: NEU.deepGold, fontVariantNumeric: 'tabular-nums' }}>
          {formatFee(maxRev, currency)}
        </text>
      )}
    </svg>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11px] font-bold mb-3"
      style={{ color: NEU.muted, fontFamily: OUTFIT, letterSpacing: '0.1em', textTransform: 'uppercase' }}
    >
      {children}
    </p>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: color, flexShrink: 0 }} />
      <span style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 600, color: NEU.muted }}>{label}</span>
    </span>
  );
}

function QuickActionCard({
  icon,
  gradient,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties; strokeWidth?: number }>;
  gradient: [string, string];
  label: string;
  onClick: () => void;
}) {
  return (
    <NeuCard hover onClick={onClick} style={{ padding: '12px 18px', borderRadius: 18 }}>
      <span className="flex items-center gap-3">
        <NeuIconDisc gradient={gradient} icon={icon} size={32} />
        <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.ink }}>{label}</span>
        <ArrowRight size={14} style={{ color: NEU.muted }} />
      </span>
    </NeuCard>
  );
}

// ── Dashboard data shape ───────────────────────────────────────────────────

interface DashData {
  apps: AppRow[];
  allocated: number;
  committees: { id: string; chair_user_ids: string[] | null }[];
  organizerCount: number;
  enabledEmailCount: number;
}

// ── Dashboard home ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { conference, refreshConference } = useManage();
  const { session } = useAuth();
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishBlockMsg, setPublishBlockMsg] = useState('');
  const [dash, setDash] = useState<DashData | null>(null);

  useEffect(() => {
    if (!conference) return;
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const confId = conference.id;
    (async () => {
      const [appsRes, allocRes, committeesRes, orgRes, emailRes] = await Promise.all([
        supabase
          .from('applications')
          .select('submitted_at, status, payment_status, role, society_id')
          .eq('conference_id', confId),
        supabase
          .from('conference_allocations')
          .select('*', { count: 'exact', head: true })
          .eq('conference_id', confId),
        supabase
          .from('conference_committees')
          .select('id, chair_user_ids')
          .eq('conference_id', confId),
        supabase
          .from('conference_organizers')
          .select('*', { count: 'exact', head: true })
          .eq('conference_id', confId),
        supabase
          .from('email_templates')
          .select('*', { count: 'exact', head: true })
          .eq('conference_id', confId)
          .eq('enabled', true),
      ]);
      setDash({
        apps: (appsRes.data ?? []) as AppRow[],
        allocated: allocRes.count ?? 0,
        committees: (committeesRes.data ?? []) as { id: string; chair_user_ids: string[] | null }[],
        organizerCount: orgRes.count ?? 0,
        enabledEmailCount: emailRes.count ?? 0,
      });
    })();
  }, [conference?.id, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (!conference || !dash) {
    return (
      <div className="px-6 md:px-10 py-8 max-w-6xl">
        <div className="mb-6 rounded-[22px] animate-pulse" style={{ height: 64, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-5 mb-6">
          <div className="rounded-[22px] animate-pulse" style={{ height: 460, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
          <div className="flex flex-col gap-5">
            <div className="rounded-[22px] animate-pulse" style={{ height: 180, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
            <div className="grid grid-cols-2 gap-5">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="rounded-[22px] animate-pulse" style={{ height: 122, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-[22px] animate-pulse" style={{ height: 300, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
      </div>
    );
  }

  const slug = conference.slug;
  const confYear = conference.start_date ? new Date(conference.start_date + 'T00:00:00').getFullYear() : null;

  // ── Derived numbers ──────────────────────────────────────────────────────
  const totalApps = dash.apps.length;
  const acceptedApps = dash.apps.filter(a => a.status === 'accepted').length;
  const paidApps = dash.apps.filter(a => a.payment_status === 'paid').length;
  const delegateApps = dash.apps.filter(a => a.role === 'delegate' || a.role === 'head-delegate').length;
  const societies = new Set(dash.apps.map(a => a.society_id).filter(Boolean)).size;
  const committeeCount = dash.committees.length;
  const missingChairs = dash.committees.filter(c => !c.chair_user_ids || c.chair_user_ids.length === 0).length;

  const buckets = buildBuckets(dash.apps);
  const sparkTotal = cumulative(buckets.map(b => b.apps));
  const sparkAccepted = cumulative(buckets.map(b => b.accepted));
  const sparkPaid = cumulative(buckets.map(b => b.paid));
  const lastBucketApps = buckets.length > 0 ? buckets[buckets.length - 1].apps : 0;
  const fee = conference.fee_amount ?? 0;
  const totalRevenue = paidApps * fee;

  // ── Set-up priorities: 8 detection checks, in journey order ──────────────
  const checklist = [
    {
      key: 'email',
      icon: Mail,
      gradient: NEU_GRADIENTS.gold,
      title: 'Design an email',
      sub: 'Set up an automated email template for applicants.',
      done: dash.enabledEmailCount > 0,
      onClick: () => router.push(`/manage/${slug}/communications`),
    },
    {
      key: 'page',
      icon: Palette,
      gradient: NEU_GRADIENTS.amber,
      title: 'Set up your conference page',
      sub: 'Add a banner and a description delegates will see.',
      done: !!conference.banner_url && !!conference.description?.trim(),
      onClick: () => router.push(`/manage/${slug}/settings`),
    },
    {
      key: 'committees',
      icon: Building2,
      gradient: NEU_GRADIENTS.forest,
      title: 'Add committees',
      sub: committeeCount > 0 ? `${committeeCount} committee${committeeCount === 1 ? '' : 's'} created.` : 'Create committees and their topics.',
      done: committeeCount > 0,
      onClick: () => router.push(`/manage/${slug}/committees`),
    },
    {
      key: 'chairs',
      icon: Gavel,
      gradient: NEU_GRADIENTS.gold,
      title: 'Add chairs or recruit',
      sub: committeeCount === 0
        ? 'Add committees first, then staff each dais.'
        : missingChairs > 0
          ? `${missingChairs} committee${missingChairs === 1 ? '' : 's'} missing chairs.`
          : 'Every committee has a chair.',
      done: committeeCount > 0 && missingChairs === 0,
      onClick: () => router.push(`/manage/${slug}/assignment`),
      action: (
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/manage/${slug}/jobs`); }}
          className="focus:outline-none"
          style={{
            fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
            color: NEU.deepGold, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
          }}
        >
          RECRUIT
        </button>
      ),
    },
    {
      key: 'secretariat',
      icon: UsersRound,
      gradient: NEU_GRADIENTS.sage,
      title: 'Add your secretariat',
      sub: 'Invite co-organizers and grant them access.',
      done: dash.organizerCount > 1,
      onClick: () => router.push(`/manage/${slug}/settings`),
    },
    {
      key: 'delegate',
      icon: UserPlus,
      gradient: NEU_GRADIENTS.green,
      title: 'Get your first delegate',
      sub: delegateApps > 0 ? `${delegateApps} delegate application${delegateApps === 1 ? '' : 's'} received.` : 'Share your page and receive an application.',
      done: delegateApps > 0,
      onClick: () => router.push(`/manage/${slug}/applications`),
    },
    {
      key: 'financials',
      icon: Wallet,
      gradient: NEU_GRADIENTS.amber,
      title: 'Add financial information',
      // fee_amount === 0 is a deliberate free conference — any non-null fee counts as configured.
      done: conference.fee_amount !== null || !!conference.stripe_account_id,
      sub: 'Set your delegate fee or connect Stripe.',
      onClick: () => router.push(`/manage/${slug}/financials`),
    },
    {
      key: 'publish',
      icon: Rocket,
      gradient: NEU_GRADIENTS.forest,
      title: 'Launch delegate registrations',
      sub: conference.is_public ? 'Your conference is live.' : 'Publish your conference to gavelling.com.',
      done: conference.is_public,
      onClick: handlePublishClick,
    },
  ];
  const doneCount = checklist.filter(c => c.done).length;

  function handlePublishClick() {
    if (committeeCount === 0) {
      setPublishBlockMsg('Add at least one committee before publishing.');
      setTimeout(() => setPublishBlockMsg(''), 3000);
      return;
    }
    setShowPublishModal(true);
  }

  async function handlePublished() {
    await refreshConference();
    setShowPublishModal(false);
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl" style={{ fontFamily: OUTFIT }}>

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
        <div className="flex items-center gap-4 min-w-0">
          {conference.logo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={conference.logo_url}
              alt={conference.acronym}
              className="flex-shrink-0"
              style={{ width: 46, height: 46, objectFit: 'contain', filter: 'drop-shadow(0 3px 8px rgba(27,56,40,0.25))' }}
            />
          ) : (
            <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Building2} size={46} iconColor={NEU.gold} />
          )}
          <div className="min-w-0">
            <p style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: NEU.deepGold }}>
              {conference.acronym}{confYear ? ` · ${confYear}` : ''} — DASHBOARD
            </p>
            <h1 className="font-black truncate" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 24, lineHeight: 1.15, marginTop: 1 }}>
              {conference.full_name}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NeuPill active={conference.is_public} gradient={NEU_GRADIENTS.green}>
            <span style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: conference.is_public ? '#FFFFFF' : NEU.amber, flexShrink: 0 }} />
            {conference.is_public ? 'LIVE' : 'DRAFT'}
          </NeuPill>
          {!conference.is_public && (
            <NeuButton gradient={NEU_GRADIENTS.forest} icon={Rocket} onClick={handlePublishClick}>
              PUBLISH
            </NeuButton>
          )}
        </div>
      </div>

      {/* ── Priority checklist (left, tall) + delegates / numbers (right) ── */}
      <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-5 items-start mb-6">

        {/* Set-up priorities */}
        <NeuCard style={{ padding: '22px 22px 18px' }}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 900, color: NEU.ink }}>Set-up priorities</h2>
              <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.muted, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                {doneCount} of {checklist.length} done{doneCount === checklist.length ? ' — you are all set.' : ''}
              </p>
            </div>
            <NeuRing value={doneCount} max={checklist.length} size={72} strokeWidth={8} gradient={NEU_GRADIENTS.gold}>
              <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 17, color: NEU.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {doneCount}<span style={{ fontSize: 11, color: NEU.muted }}>/{checklist.length}</span>
              </span>
            </NeuRing>
          </div>

          <NeuProgress value={doneCount} max={checklist.length} gradient={NEU_GRADIENTS.gold} thumb style={{ marginBottom: 18 }} />

          <div className="flex flex-col gap-2.5">
            {checklist.map(item => (
              <NeuChecklistRow
                key={item.key}
                done={item.done}
                icon={item.icon}
                gradient={item.gradient}
                title={item.title}
                sub={item.sub}
                action={'action' in item ? item.action : undefined}
                onClick={item.onClick}
              />
            ))}
          </div>
          {publishBlockMsg && (
            <p className="text-xs mt-3" style={{ color: NEU.amber, fontFamily: OUTFIT, fontWeight: 700 }}>{publishBlockMsg}</p>
          )}
        </NeuCard>

        {/* Right column: delegates card + raw numbers */}
        <div className="flex flex-col gap-5">

          {/* Delegates — allocation state + pipeline */}
          <NeuCard style={{ padding: '20px 22px' }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 900, color: NEU.ink }}>Delegates</h2>
              <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, color: NEU.forest, fontVariantNumeric: 'tabular-nums' }}>
                {dash.allocated} / {acceptedApps} <span style={{ fontWeight: 600, color: NEU.muted }}>allocated</span>
              </span>
            </div>
            <NeuProgress value={dash.allocated} max={acceptedApps} gradient={NEU_GRADIENTS.forest} thumb style={{ marginBottom: 16 }} />

            {/* Pipeline: submitted → accepted → paid → allocated */}
            <NeuInset small style={{ padding: '12px 8px' }}>
              <div className="grid grid-cols-4">
                {[
                  { n: totalApps, label: 'Submitted' },
                  { n: acceptedApps, label: 'Accepted' },
                  { n: paidApps, label: 'Paid' },
                  { n: dash.allocated, label: 'Allocated' },
                ].map((s, i) => (
                  <div
                    key={s.label}
                    className="text-center"
                    style={i > 0 ? { borderLeft: '1px solid rgba(27,56,40,0.1)' } : undefined}
                  >
                    <p style={{ fontFamily: OUTFIT, fontSize: 18, fontWeight: 900, color: NEU.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                      {s.n}
                    </p>
                    <p style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 700, color: NEU.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </NeuInset>
          </NeuCard>

          {/* Raw numbers — vibrant discs + sparklines */}
          <div className="grid grid-cols-2 gap-5">
            <NeuStatTile
              icon={Users}
              gradient={NEU_GRADIENTS.forest}
              value={totalApps}
              label="Total applications"
              spark={sparkTotal}
              delta={lastBucketApps > 0 ? `+${lastBucketApps}` : undefined}
            />
            <NeuStatTile icon={CheckCircle} gradient={NEU_GRADIENTS.green} value={acceptedApps} label="Accepted" spark={sparkAccepted} />
            <NeuStatTile icon={CreditCard} gradient={NEU_GRADIENTS.gold} value={paidApps} label="Paid" spark={sparkPaid} />
            <NeuStatTile icon={MapPin} gradient={NEU_GRADIENTS.amber} value={dash.allocated} label="Allocated" />
          </div>
        </div>
      </div>

      {/* ── Growth graphs row ── */}
      <div className="grid md:grid-cols-[1fr_220px] gap-5 items-start mb-6">
        <NeuCard style={{ padding: '20px 22px' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 900, color: NEU.ink }}>Growth</h2>
            <div className="flex items-center gap-4">
              <LegendDot color={NEU.forest} label="Applications (cumulative)" />
              <LegendDot color={NEU.deepGold} label="Revenue" />
              {totalRevenue > 0 && (
                <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 900, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>
                  {formatFee(totalRevenue, conference.fee_currency)}
                </span>
              )}
            </div>
          </div>

          {buckets.length === 0 ? (
            <NeuInset className="flex flex-col items-center justify-center text-center" style={{ padding: '44px 20px' }}>
              <TrendingUp size={26} style={{ color: NEU.muted, opacity: 0.7 }} />
              <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.ink, marginTop: 10 }}>No applications yet</p>
              <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted, marginTop: 3, maxWidth: 300 }}>
                Once delegates start applying, your application and revenue growth will chart here.
              </p>
            </NeuInset>
          ) : (
            <NeuInset style={{ padding: '14px 12px 8px' }}>
              <GrowthChart buckets={buckets} fee={fee} currency={conference.fee_currency} />
            </NeuInset>
          )}
        </NeuCard>

        <div className="flex flex-col gap-5">
          <NeuStatTile icon={Flag} gradient={NEU_GRADIENTS.sage} value={societies} label="Delegations" />
          <NeuStatTile icon={FileText} gradient={NEU_GRADIENTS.forest} value={committeeCount} label="Committees" />
        </div>
      </div>

      {/* ── Quick actions — the one saturated accent card ── */}
      {conference.is_public ? (
        <div
          className="rounded-[22px] p-6"
          style={{
            background: 'linear-gradient(135deg, #16301F 0%, #1B3828 46%, #2A5A3C 100%)',
            boxShadow: NEU.out,
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 style={{ fontFamily: OUTFIT, fontSize: 16, fontWeight: 900, color: NEU.gold }}>Quick actions</h2>
              <p style={{ fontFamily: OUTFIT, fontSize: 12, color: 'rgba(237,231,216,0.62)', marginTop: 2 }}>
                Your conference is live — keep the momentum going.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'ADD COMMITTEE', icon: Building2, href: `/manage/${slug}/committees` },
                { label: 'VIEW APPLICATIONS', icon: Users, href: `/manage/${slug}/applications` },
                { label: 'EMAIL DELEGATES', icon: Mail, href: `/manage/${slug}/communications` },
              ].map(a => {
                const AIcon = a.icon;
                return (
                  <button
                    key={a.label}
                    onClick={() => router.push(a.href)}
                    className="inline-flex items-center gap-2 focus:outline-none"
                    style={{
                      padding: '10px 18px', borderRadius: 999,
                      backgroundColor: 'rgba(238,217,138,0.13)',
                      border: '1px solid rgba(238,217,138,0.3)',
                      color: NEU.gold, fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.05em',
                      cursor: 'pointer', transition: `background-color 200ms ${EASE}`,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(238,217,138,0.24)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(238,217,138,0.13)'; }}
                  >
                    <AIcon size={14} />
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Launch CTA — the saturated accent card while unpublished */}
          <div
            className="rounded-[22px] p-6 mb-5"
            style={{
              background: 'linear-gradient(135deg, #16301F 0%, #1B3828 46%, #2A5A3C 100%)',
              boxShadow: NEU.out,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              className="pointer-events-none absolute"
              style={{ top: -110, right: -70, width: 320, height: 320, borderRadius: 9999, background: 'radial-gradient(circle, rgba(238,217,138,0.2), transparent 66%)' }}
            />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <NeuIconDisc gradient={NEU_GRADIENTS.gold} icon={Rocket} size={44} iconColor={NEU.forest} />
                <div className="min-w-0">
                  <h2 style={{ fontFamily: OUTFIT, fontSize: 17, fontWeight: 900, color: NEU.gold }}>Launch delegate registrations</h2>
                  <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: 'rgba(237,231,216,0.62)', marginTop: 2 }}>
                    Your conference is still private. Publish it to appear on gavelling.com and start receiving applications.
                  </p>
                </div>
              </div>
              <NeuButton gradient={NEU_GRADIENTS.gold} icon={Rocket} onClick={handlePublishClick}>
                PUBLISH CONFERENCE
              </NeuButton>
            </div>
          </div>

          {/* Quiet extruded quick actions below the accent card */}
          <div>
            <SectionLabel>Quick actions</SectionLabel>
            <div className="flex flex-wrap gap-4">
              <QuickActionCard icon={Building2} gradient={NEU_GRADIENTS.forest} label="Add committee" onClick={() => router.push(`/manage/${slug}/committees`)} />
              <QuickActionCard icon={Users} gradient={NEU_GRADIENTS.sage} label="View applications" onClick={() => router.push(`/manage/${slug}/applications`)} />
              <QuickActionCard icon={Mail} gradient={NEU_GRADIENTS.gold} label="Email delegates" onClick={() => router.push(`/manage/${slug}/communications`)} />
            </div>
          </div>
        </>
      )}

      {showPublishModal && (
        <PublishModal
          conference={conference}
          onClose={() => setShowPublishModal(false)}
          onPublished={handlePublished}
        />
      )}
    </div>
  );
}
