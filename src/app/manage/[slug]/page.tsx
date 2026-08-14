'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2, Rocket, Mail, Gavel, UsersRound, UserPlus, Wallet, Palette,
  TrendingUp, Inbox, Globe2, CheckCircle2, AlertCircle, ArrowRight,
  Activity, UserRoundCheck, MapPin, RotateCcw,
} from 'lucide-react';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { formatFee } from '@/lib/utils';
import { LogoDisc } from '@/components/LogoDisc';
import {
  NeuCard, NeuInset, NeuIconDisc, NeuStatTile, NeuProgress, NeuRing,
  NeuPill, NeuButton, NeuChecklistRow, Emoji3D, NEU, NEU_GRADIENTS, OUTFIT, EASE,
} from '@/components/neu';
import Portal from '@/components/Portal';
import DecorativeBleed from '@/components/DecorativeBleed';
import ParticipantsChart, { toCumulativeSeries } from '@/components/conferences/ParticipantsChart';
import ApplicantsDial from '@/components/conferences/ApplicantsDial';
import { conferencePaymentsReady, paymentGateBlocks, paymentGateMessage } from '@/lib/payments';
import { hasExploredEmails } from '@/lib/emailsExplored';

const RED = '#A8442F';

// ── Publish modal ──────────────────────────────────────────────────────────

function PublishModal({
  conference,
  onClose,
  onPublished,
}: {
  conference: { id: string; slug: string; full_name: string };
  onClose: () => void;
  onPublished: () => void;
}) {
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const { session } = useAuth();

  async function handlePublish() {
    setPublishing(true);
    setPublishError('');
    if (!session) { setPublishing(false); return; }
    const supabase = getAuthedClient(session.access_token);
    const { error } = await supabase
      .from('conferences')
      .update({ is_public: true, status: 'public' })
      .eq('id', conference.id);
    if (error) {
      setPublishing(false);
      setPublishError(error.message);
      return;
    }
    // Fire-and-forget: ping search engines (IndexNow) so the newly public
    // conference page gets crawled right away.
    void fetch('/api/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: conference.slug }),
    }).catch(() => {});
    setPublishing(false);
    onPublished();
  }

  return (
    <Portal><div
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
        {publishError && (
          <p className="text-sm mb-4" style={{ color: RED, fontFamily: OUTFIT }}>{publishError}</p>
        )}
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
    </div></Portal>
  );
}

// ── First-delegate share modal ─────────────────────────────────────────────
// House recipe for "Get your first delegate": copy the public conference
// link, plus an Instagram-story prompt with a pre-written caption.

function ShareModal({
  conference,
  onClose,
}: {
  conference: { slug: string; full_name: string; acronym: string };
  onClose: () => void;
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gavelling.com';
  const publicUrl = `${origin}/conferences/${conference.slug}`;
  const caption = `Applications for ${conference.full_name} are open! Apply as a delegate here ↓\n${publicUrl}`;

  async function copy(text: string, setFlag: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API unavailable (http / permissions), fall back silently.
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setFlag(true);
    setTimeout(() => setFlag(false), 2000);
  }

  return (
    <Portal><div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-7"
        style={{ backgroundColor: NEU.surface, boxShadow: NEU.out }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-1.5">
          <Emoji3D name="Megaphone" size={30} fallback={UserPlus} fallbackColor={NEU.forest} />
          <h2 className="font-black text-xl" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
            Get your first delegate
          </h2>
        </div>
        <p className="text-sm mb-5" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
          Share your conference page. Anyone who opens it can apply as a delegate.
        </p>

        {/* Public link + copy */}
        <p style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: NEU.deepGold, marginBottom: 6 }}>
          YOUR PUBLIC LINK
        </p>
        <div className="flex items-center gap-2 mb-5">
          <NeuInset className="flex-1 min-w-0" style={{ padding: '9px 12px', borderRadius: 12 }}>
            <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, color: NEU.ink }}>
              {publicUrl}
            </p>
          </NeuInset>
          <button
            onClick={() => copy(publicUrl, setCopiedLink)}
            className="flex-shrink-0 rounded-xl py-2.5 px-4 font-bold text-xs tracking-widest transition-colors focus:outline-none"
            style={{
              backgroundColor: copiedLink ? '#3D7A52' : '#1B3828',
              color: NEU.gold, fontFamily: OUTFIT, letterSpacing: '0.06em',
              border: 'none', cursor: 'pointer',
            }}
            onMouseEnter={(e) => { if (!copiedLink) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
            onMouseLeave={(e) => { if (!copiedLink) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
          >
            {copiedLink ? 'COPIED ✓' : 'COPY'}
          </button>
        </div>

        {/* Instagram story prompt */}
        <div className="rounded-xl p-4 mb-5" style={{ border: '1.5px solid rgba(182,135,31,0.35)', backgroundColor: 'rgba(238,217,138,0.14)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Emoji3D name="Camera with flash" size={20} fallback={ArrowRight} fallbackColor={NEU.deepGold} />
            <p style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 900, letterSpacing: '0.08em', color: NEU.ink }}>
              SHARE TO YOUR STORY
            </p>
          </div>
          <p
            className="rounded-lg p-2.5 mb-2.5"
            style={{
              fontFamily: OUTFIT, fontSize: 12, color: NEU.ink, lineHeight: 1.45,
              backgroundColor: 'rgba(255,255,255,0.55)', whiteSpace: 'pre-line', wordBreak: 'break-word',
            }}
          >
            {caption}
          </p>
          <div className="flex items-center justify-between gap-3">
            <p style={{ fontFamily: OUTFIT, fontSize: 10.5, color: NEU.muted, lineHeight: 1.4 }}>
              Paste the link into your story&apos;s link sticker.
            </p>
            <button
              onClick={() => copy(caption, setCopiedCaption)}
              className="flex-shrink-0 rounded-xl py-2 px-3.5 font-bold text-xs tracking-widest transition-colors focus:outline-none"
              style={{
                backgroundColor: 'transparent',
                color: copiedCaption ? '#3D7A52' : NEU.deepGold,
                border: `1.5px solid ${copiedCaption ? '#3D7A52' : 'rgba(182,135,31,0.5)'}`,
                fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: 'pointer',
              }}
            >
              {copiedCaption ? 'CAPTION COPIED ✓' : 'COPY CAPTION'}
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl py-2.5 font-bold text-sm tracking-widest transition-colors focus:outline-none"
          style={{ border: '1.5px solid #DDD4C0', color: NEU.ink, backgroundColor: 'transparent', fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: 'pointer' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1B3828'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#DDD4C0'; }}
        >
          DONE
        </button>
      </div>
    </div></Portal>
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

type RangeKey = '24H' | '7D' | '30D' | 'ALL';
const RANGE_KEYS: RangeKey[] = ['24H', '7D', '30D', 'ALL'];
const RANGE_PREV_LABEL: Record<RangeKey, string> = {
  '24H': 'previous 24 h', '7D': 'previous 7 days', '30D': 'previous 30 days', 'ALL': '',
};

interface Bucket { t: number; label: string; tip: string; apps: number; paid: number }

const DAY = 86400000;
const HOUR = 3600000;

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function floorHour(t: number): number {
  const d = new Date(t);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

/**
 * Buckets applications for the selected range: 24H → hourly, 7D/30D → daily,
 * ALL → weekly from the first application.
 * NOTE: there is no paid_at column on applications, paid rows are bucketed
 * by their submitted_at as an approximation of when the revenue arrived.
 * Also counts paid rows in the previous equivalent window for the delta
 * caption (null for ALL, there is no previous period to compare against).
 */
function bucketize(rows: AppRow[], range: RangeKey): { buckets: Bucket[]; prevPaid: number | null } {
  const now = Date.now();
  let start: number, step: number, count: number;
  if (range === '24H') {
    step = HOUR; count = 24; start = floorHour(now) - 23 * HOUR;
  } else if (range === '7D') {
    step = DAY; count = 7; start = startOfDay(now) - 6 * DAY;
  } else if (range === '30D') {
    step = DAY; count = 30; start = startOfDay(now) - 29 * DAY;
  } else {
    step = 7 * DAY;
    const times = rows.map(r => new Date(r.submitted_at).getTime()).filter(t => Number.isFinite(t));
    start = startOfDay(times.length > 0 ? Math.min(...times) : now);
    count = Math.max(2, Math.floor((now - start) / step) + 1);
  }

  const fmtAxis = (t: number) => range === '24H'
    ? new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const fmtTip = (t: number) => range === '24H'
    ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : range === 'ALL'
      ? `Week of ${new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  const buckets: Bucket[] = Array.from({ length: count }, (_, i) => ({
    t: start + i * step,
    label: fmtAxis(start + i * step),
    tip: fmtTip(start + i * step),
    apps: 0, paid: 0,
  }));

  let prevPaid: number | null = range === 'ALL' ? null : 0;
  const prevStart = start - count * step;
  for (const r of rows) {
    const t = new Date(r.submitted_at).getTime();
    if (!Number.isFinite(t)) continue;
    if (t < start) {
      if (prevPaid !== null && t >= prevStart && r.payment_status === 'paid') prevPaid += 1;
      continue;
    }
    const i = Math.min(count - 1, Math.floor((t - start) / step));
    buckets[i].apps += 1;
    if (r.payment_status === 'paid') buckets[i].paid += 1;
  }
  return { buckets, prevPaid };
}

// ── Revenue chart, interactive SVG: gold revenue bars only ────────────────
// Range tabs (24H/7D/30D/ALL), pointer-snapping hover with vertical guide +
// neumorphic revenue tooltip, gold peak marker, header shows range revenue +
// delta vs the previous equivalent period. Hand-rolled, no chart libs.

function RevenueChart({
  rows,
  fee,
  currency,
  financialsHref,
}: {
  rows: AppRow[];
  fee: number;
  currency: string;
  financialsHref: string;
}) {
  const [range, setRange] = useState<RangeKey>('7D');
  const [hoverI, setHoverI] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState({ w: 680, h: 240 });

  // Measure the plot area so the SVG renders at exact pixel size, keeps
  // text unscaled and makes pointer → bucket math exact.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      if (r.width > 40 && r.height > 40) setDims({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { buckets, prevPaid } = useMemo(() => bucketize(rows, range), [rows, range]);

  const revenue = buckets.map(b => b.paid * fee);
  const appsTotal = buckets.reduce((a, b) => a + b.apps, 0);
  const totalRev = revenue.reduce((a, b) => a + b, 0);
  const prevRev = prevPaid === null ? null : prevPaid * fee;
  const delta = prevRev === null ? null : totalRev - prevRev;

  const { w: W, h: H } = dims;
  const padL = 46, padR = 12, padT = 18, padB = 20;
  const plotW = Math.max(40, W - padL - padR);
  const plotH = Math.max(40, H - padT - padB);
  const n = buckets.length;
  const slot = plotW / n;

  const maxRev = Math.max(...revenue, 1);
  const hasRevenue = revenue.some(v => v > 0);

  const xc = (i: number) => padL + slot * (i + 0.5);
  const yRev = (v: number) => padT + plotH - (v / maxRev) * (plotH * 0.88);
  const baseY = padT + plotH;

  // Dense, serious bars: ~74% of the slot (≈35% gap→bar ratio).
  const barW = Math.min(44, slot * 0.74);

  // Rounded-top bar path (width parameterised so the hovered bar can grow).
  const bar = (i: number, v: number, w: number): string => {
    if (v <= 0) return '';
    const x = xc(i) - w / 2;
    const top = yRev(v);
    const r = Math.min(w / 2, Math.max(2, baseY - top));
    return `M ${x} ${baseY} L ${x} ${top + r} Q ${x} ${top} ${x + r} ${top} L ${x + w - r} ${top} Q ${x + w} ${top} ${x + w} ${top + r} L ${x + w} ${baseY} Z`;
  };

  // Peak-revenue bucket → gold dot + tiny label.
  let peakI = -1;
  for (let i = 0; i < revenue.length; i++) {
    if (revenue[i] > 0 && (peakI === -1 || revenue[i] > revenue[peakI])) peakI = i;
  }

  const guides = hasRevenue
    ? [0.5, 1].map(f => ({ y: yRev(maxRev * f), v: formatFee(Math.round(maxRev * f), currency) }))
    : [];
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(4, Math.floor(plotW / 68))));

  // Snap pointer x to the nearest bucket.
  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const i = Math.round((x - padL) / slot - 0.5);
    setHoverI(Math.max(0, Math.min(n - 1, i)));
  }

  const gid = 'rev-bar-grad';

  return (
    <div className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
      {/* Header, links to financials */}
      <div className="flex items-center justify-between gap-3 flex-shrink-0" style={{ marginBottom: 10 }}>
        <Link
          href={financialsHref}
          className="flex items-center gap-3 min-w-0 transition-opacity hover:opacity-75"
          style={{ textDecoration: 'none', cursor: 'pointer' }}
        >
          <NeuIconDisc gradient={NEU_GRADIENTS.gold} emoji="Chart increasing" icon={TrendingUp} size={36} />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2.5">
              <span style={{ fontFamily: OUTFIT, fontSize: 14, fontWeight: 900, color: NEU.ink }}>Revenue</span>
              <span style={{ fontFamily: OUTFIT, fontSize: 20, fontWeight: 900, color: NEU.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {formatFee(totalRev, currency)}
              </span>
            </div>
            {delta !== null ? (
              <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, color: delta >= 0 ? NEU.green : RED, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                {delta >= 0 ? '▲' : '▼'} {formatFee(Math.abs(delta), currency)} vs {RANGE_PREV_LABEL[range]}
              </p>
            ) : (
              <p style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 600, color: NEU.muted, marginTop: 1 }}>
                All time · {appsTotal} application{appsTotal === 1 ? '' : 's'}
              </p>
            )}
          </div>
        </Link>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5">
            {RANGE_KEYS.map(k => (
              <NeuPill key={k} active={range === k} gradient={NEU_GRADIENTS.forest} onClick={() => { setRange(k); setHoverI(null); }}>
                {k}
              </NeuPill>
            ))}
          </span>
        </div>
      </div>

      {/* Plot */}
      <NeuInset style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <div ref={wrapRef} style={{ position: 'absolute', inset: 8 }}>
          {rows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <TrendingUp size={24} style={{ color: NEU.muted, opacity: 0.7 }} />
              <p style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink, marginTop: 8 }}>No applications yet</p>
              <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, marginTop: 2, maxWidth: 300 }}>
                Once delegates start applying, your application and revenue growth will chart here.
              </p>
            </div>
          ) : (
            <>
              <svg
                width={W}
                height={H}
                onPointerMove={handleMove}
                onPointerLeave={() => setHoverI(null)}
                style={{ display: 'block', touchAction: 'none' }}
                role="img"
                aria-label="Revenue over time"
              >
                <defs>
                  <linearGradient id={gid} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={NEU.gold} />
                    <stop offset="100%" stopColor={NEU.deepGold} />
                  </linearGradient>
                </defs>

                {guides.map((g, gi) => (
                  <g key={gi}>
                    <line x1={padL} x2={W - padR} y1={g.y} y2={g.y} stroke="rgba(27,56,40,0.08)" strokeWidth={1} />
                    <text x={padL - 7} y={g.y + 3} textAnchor="end" style={{ fontFamily: OUTFIT, fontSize: 10, fill: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
                      {g.v}
                    </text>
                  </g>
                ))}
                <line x1={padL} x2={W - padR} y1={baseY} y2={baseY} stroke="rgba(27,56,40,0.14)" strokeWidth={1} />

                {/* Hover guide */}
                {hoverI !== null && (
                  <line x1={xc(hoverI)} x2={xc(hoverI)} y1={padT} y2={baseY} stroke="rgba(27,56,40,0.28)" strokeWidth={1} strokeDasharray="3 3" />
                )}

                {/* Revenue bars, gold gradient, rounded tops; hovered bar grows */}
                {hasRevenue && revenue.map((v, i) => (
                  v > 0 ? (
                    <path
                      key={i}
                      d={bar(i, v, hoverI === i ? barW + 4 : barW)}
                      fill={`url(#${gid})`}
                      opacity={hoverI === null ? 0.9 : hoverI === i ? 1 : 0.55}
                      style={{ transition: `opacity 160ms ${EASE}` }}
                    />
                  ) : null
                ))}

                {/* Peak-revenue marker, gold dot + tiny label */}
                {peakI >= 0 && (
                  <g>
                    <circle cx={xc(peakI)} cy={yRev(revenue[peakI]) - 7} r={3.5} fill={NEU.deepGold} stroke="#FFFFFF" strokeWidth={1.5} />
                    <text
                      x={Math.max(padL + 24, Math.min(W - padR - 24, xc(peakI)))}
                      y={Math.max(10, yRev(revenue[peakI]) - 15)}
                      textAnchor="middle"
                      style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, fill: NEU.deepGold, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatFee(revenue[peakI], currency)}
                    </text>
                  </g>
                )}

                {/* X labels */}
                {buckets.map((b, i) => (
                  i % labelEvery === 0 ? (
                    <text key={b.t} x={xc(i)} y={H - 6} textAnchor="middle" style={{ fontFamily: OUTFIT, fontSize: 10, fill: hoverI === i ? NEU.forest : NEU.muted, fontWeight: hoverI === i ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>
                      {b.label}
                    </text>
                  ) : null
                ))}
              </svg>

              {/* No-activity note over an empty range */}
              {!hasRevenue && (
                <p
                  className="absolute inset-x-0 text-center pointer-events-none"
                  style={{ top: '38%', fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 600, color: NEU.muted }}
                >
                  No activity in this range
                </p>
              )}

              {/* Neumorphic hover tooltip, revenue only */}
              {hoverI !== null && hasRevenue && (
                <div
                  className="pointer-events-none"
                  style={{
                    position: 'absolute',
                    left: Math.max(78, Math.min(W - 78, xc(hoverI))),
                    top: 6,
                    transform: 'translateX(-50%)',
                    backgroundColor: NEU.surface,
                    boxShadow: NEU.outSm,
                    borderRadius: 12,
                    padding: '6px 11px',
                    whiteSpace: 'nowrap',
                    zIndex: 5,
                  }}
                >
                  <p style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 800, color: NEU.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {buckets[hoverI].tip}
                  </p>
                  <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 900, color: NEU.deepGold, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                    {formatFee(revenue[hoverI], currency)}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </NeuInset>
    </div>
  );
}

// ── Unallocated-delegates alert tile ───────────────────────────────────────
// Amber alarm while accepted delegates await committee allocation; calm
// green once everyone is placed. Links straight to the assignment board.

function UnallocatedTile({ count, href }: { count: number; href: string }) {
  const [hovered, setHovered] = useState(false);
  const ok = count === 0;
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col"
      style={{
        textDecoration: 'none',
        minWidth: 0,
        justifyContent: 'space-between',
        padding: '13px 15px',
        borderRadius: 22,
        backgroundColor: NEU.surface,
        backgroundImage: ok
          ? 'linear-gradient(rgba(61,122,82,0.10), rgba(61,122,82,0.10))'
          : 'linear-gradient(rgba(184,132,74,0.12), rgba(184,132,74,0.12))',
        border: ok ? '1.5px solid rgba(61,122,82,0.35)' : '1.5px solid rgba(184,132,74,0.4)',
        boxShadow: hovered ? NEU.outHover : NEU.out,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: `box-shadow 260ms ${EASE}, transform 260ms ${EASE}`,
        cursor: 'pointer',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <Emoji3D
          name={ok ? 'Check mark button' : 'Red exclamation mark'}
          size={32}
          fallback={ok ? CheckCircle2 : AlertCircle}
          fallbackColor={ok ? NEU.green : NEU.amber}
        />
        <ArrowRight size={13} style={{ color: ok ? NEU.green : NEU.amber, opacity: hovered ? 1 : 0.6, transform: hovered ? 'translateX(2px)' : 'none', transition: `transform 200ms ${EASE}` }} />
      </div>
      {ok ? (
        <div>
          <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 800, color: NEU.green, lineHeight: 1.2 }}>
            All delegates allocated
          </p>
          <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 600, color: NEU.muted, marginTop: 3 }}>
            Nothing waiting for assignment
          </p>
        </div>
      ) : (
        <div>
          <p style={{ fontFamily: OUTFIT, fontSize: 27, fontWeight: 900, color: NEU.amber, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {count}
          </p>
          <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 700, color: '#8A5A2E', marginTop: 4 }}>
            Unallocated delegates
          </p>
        </div>
      )}
    </Link>
  );
}

// ── Pipeline cell, links each stage to its fix ────────────────────────────

function PipelineCell({ n, label, href, first }: { n: number; label: string; href: string; first?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="text-center flex flex-col justify-center min-w-0"
      style={{
        textDecoration: 'none',
        borderLeft: first ? undefined : '1px solid rgba(27,56,40,0.1)',
        backgroundColor: hovered ? 'rgba(27,56,40,0.06)' : 'transparent',
        borderRadius: 8,
        padding: '4px 2px',
        cursor: 'pointer',
        transition: `background-color 160ms ${EASE}`,
      }}
    >
      <p style={{ fontFamily: OUTFIT, fontSize: 16, fontWeight: 900, color: hovered ? NEU.forest : NEU.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {n}
      </p>
      <p className="truncate" style={{ fontFamily: OUTFIT, fontSize: 8.5, fontWeight: 700, color: NEU.muted, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 3 }}>
        {label}
      </p>
    </Link>
  );
}

// ── Dashboard data shape ───────────────────────────────────────────────────

interface DashData {
  apps: AppRow[];
  allocated: number;
  /**
   * `conference_allocations.created_at` for every allocation, newest or oldest
   * order irrelevant. The dashboard used to take a head-only COUNT here, which
   * is enough for a tile but gives the Assigned series no timestamps to plot —
   * ParticipantsChart needs the actual instants. `allocated` is now derived
   * from this array's length, so the two can never disagree.
   */
  allocatedAt: (string | null)[];
  committees: { id: string; chair_user_ids: string[] | null; committee_country_slots?: { delegation_size: number | null }[] | null }[];
  organizerCount: number;
  enabledEmailCount: number;
  /**
   * Committee ids with a still-pending chair invite. A dais with an invite out
   * counts as staffed for the set-up checklist — the organiser has done their
   * part; the rest is up to the invitee.
   */
  pendingChairInviteCommitteeIds: string[];
  /** Pending co-organizer invites — one is enough to clear the secretariat row. */
  pendingOrganizerInvites: number;
}

// ── Recent activity feed ───────────────────────────────────────────────────
// The dashboard above shows the STATE of the conference (how many accepted,
// paid, allocated). This bottom strip shows its MOMENTUM: a live "what just
// happened" timeline built from the timestamps that already exist on
// applications (submitted / paid / checked-in / resubmitted) and allocations.

type ActivityKind = 'application' | 'payment' | 'checkin' | 'resubmit' | 'allocation';

interface ActivityEvent {
  key: string;
  ts: number;
  kind: ActivityKind;
  name: string;
  detail?: string;
}

const ACTIVITY_META: Record<ActivityKind, { icon: typeof Inbox; gradient: [string, string]; verb: string }> = {
  application: { icon: Inbox,          gradient: NEU_GRADIENTS.forest, verb: 'applied' },
  payment:     { icon: Wallet,         gradient: NEU_GRADIENTS.green,  verb: 'paid' },
  checkin:     { icon: UserRoundCheck, gradient: NEU_GRADIENTS.sage,   verb: 'checked in' },
  resubmit:    { icon: RotateCcw,      gradient: NEU_GRADIENTS.amber,  verb: 'resubmitted' },
  allocation:  { icon: MapPin,         gradient: NEU_GRADIENTS.gold,   verb: 'allocated' },
};

/** Compact relative time: "just now", "5m", "3h", "2d", "3w". */
function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.round(d / 7)}w ago`;
}

function roleWord(role: string): string {
  const map: Record<string, string> = {
    delegate: 'Delegate', 'head-delegate': 'Head delegate', chair: 'Chair',
    'faculty-advisor': 'Faculty advisor', observer: 'Observer',
  };
  return map[role] ?? 'Delegate';
}

function ActivityLine({ ev, now }: { ev: ActivityEvent; now: number }) {
  const meta = ACTIVITY_META[ev.kind];
  const label =
    ev.kind === 'application' ? <>New {ev.detail ?? 'delegate'} application from <b style={{ color: NEU.ink }}>{ev.name}</b></>
    : ev.kind === 'payment'   ? <>Payment received{ev.detail ? ` — ${ev.detail}` : ''} from <b style={{ color: NEU.ink }}>{ev.name}</b></>
    : ev.kind === 'checkin'   ? <><b style={{ color: NEU.ink }}>{ev.name}</b> checked in</>
    : ev.kind === 'resubmit'  ? <><b style={{ color: NEU.ink }}>{ev.name}</b> edited and resubmitted their application</>
    :                           <><b style={{ color: NEU.ink }}>{ev.name}</b> allocated{ev.detail ? ` to ${ev.detail}` : ''}</>;
  return (
    <div className="flex items-center gap-3">
      <NeuIconDisc gradient={meta.gradient} icon={meta.icon} size={30} />
      <p className="flex-1 min-w-0 truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted }}>
        {label}
      </p>
      <span className="flex-shrink-0" style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 700, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>
        {timeAgo(ev.ts, now)}
      </span>
    </div>
  );
}

function RecentActivity({ events, now }: { events: ActivityEvent[]; now: number }) {
  return (
    <NeuCard className="flex flex-col" style={{ padding: '15px 18px 16px', gap: 12 }}>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Activity size={15} strokeWidth={2.4} style={{ color: NEU.deepGold }} />
        <h2 style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: NEU.deepGold }}>
          Recent activity
        </h2>
      </div>
      {events.length === 0 ? (
        <p style={{ fontFamily: OUTFIT, fontSize: 12.5, color: NEU.muted }}>
          Activity will appear here as delegates apply, pay, get allocated, and check in.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {events.map(ev => <ActivityLine key={ev.key} ev={ev} now={now} />)}
        </div>
      )}
    </NeuCard>
  );
}

// ── Dashboard home, single-viewport neumorphic grid, no scroll ────────────

export default function DashboardPage() {
  const router = useRouter();
  const { conference, refreshConferenceQuiet } = useManage();
  const { session } = useAuth();
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [publishBlockMsg, setPublishBlockMsg] = useState('');
  const [dash, setDash] = useState<DashData | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  // `now` starts at 0 (same on server + client, no hydration mismatch) and is
  // set on mount, then ticked every minute so relative times stay fresh.
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  // Success toast for a redirect from /invites/organizer/[token] after
  // accepting, read via window.location rather than useSearchParams so this
  // stays a plain client-side effect (matches the pattern used for the
  // account-deletion and password-reset homepage toasts).
  const [orgInviteToast, setOrgInviteToast] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('organizerInvite') !== 'accepted') return;
    setOrgInviteToast(true);
    const url = new URL(window.location.href);
    url.searchParams.delete('organizerInvite');
    window.history.replaceState({}, '', url.toString());
    const t = setTimeout(() => setOrgInviteToast(false), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!conference) return;
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const confId = conference.id;
    (async () => {
      const [appsRes, allocRes, committeesRes, orgRes, emailRes, chairInvRes, orgInvRes] = await Promise.all([
        supabase
          .from('applications')
          .select('submitted_at, status, payment_status, role, society_id')
          .eq('conference_id', confId),
        // created_at, not a head-only count: the Assigned series on
        // ParticipantsChart is plotted from these instants. The count the
        // tiles use is just this array's length.
        supabase
          .from('conference_allocations')
          .select('created_at')
          .eq('conference_id', confId),
        supabase
          .from('conference_committees')
          // committee_country_slots gives the SEAT count: a double-delegation
          // country seats two delegates, so capacity is the sum of
          // delegation_size, never a count of country rows.
          .select('id, chair_user_ids, committee_country_slots(delegation_size)')
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
        // Chair invites that are still out: their committee counts as staffed
        // for the "Invite chairs" checklist row. Only the committee id is
        // needed — never the invitee's email.
        supabase
          .from('conference_chair_invites')
          .select('committee_id')
          .eq('conference_id', confId)
          .eq('status', 'pending'),
        supabase
          .from('conference_organizer_invites')
          .select('*', { count: 'exact', head: true })
          .eq('conference_id', confId)
          .eq('status', 'pending'),
      ]);
      const allocRows = (allocRes.data ?? []) as { created_at: string | null }[];
      setDash({
        apps: (appsRes.data ?? []) as AppRow[],
        allocated: allocRows.length,
        allocatedAt: allocRows.map(r => r.created_at),
        committees: (committeesRes.data ?? []) as { id: string; chair_user_ids: string[] | null }[],
        organizerCount: orgRes.count ?? 0,
        enabledEmailCount: emailRes.count ?? 0,
        pendingChairInviteCommitteeIds: ((chairInvRes.data ?? []) as { committee_id: string | null }[])
          .map(r => r.committee_id)
          .filter((id): id is string => !!id),
        pendingOrganizerInvites: orgInvRes.count ?? 0,
      });
    })();
  }, [conference?.id, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Explore emails" is the one checklist item that is NOT a function of the
  // database: it is ticked once this browser has visited the communications
  // page (flag written there, see src/lib/emailsExplored.ts). Read in an effect,
  // never during render, so the server-rendered markup still matches.
  const [emailsExplored, setEmailsExplored] = useState(false);
  useEffect(() => {
    if (!conference) return;
    // localStorage is an external store; it can only be read after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmailsExplored(hasExploredEmails(conference.id));
  }, [conference?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recent-activity feed: recent applications + allocations, expanded into
  // per-timestamp events (submitted / paid / checked-in / resubmitted /
  // allocated), merged newest-first.
  useEffect(() => {
    if (!conference || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const confId = conference.id;
    const currency = conference.fee_currency;
    let cancelled = false;
    (async () => {
      const [appsRes, allocRes] = await Promise.all([
        supabase
          .from('applications')
          .select('id, role, submitted_at, paid_at, paid_amount, amount_paid, checked_in_at, resubmitted_at, invited_name, profiles(display_name)')
          .eq('conference_id', confId)
          .order('submitted_at', { ascending: false })
          .limit(25),
        supabase
          .from('conference_allocations')
          .select('id, created_at, country_name, conference_committees:conference_committee_id(name, abbreviation), profiles:user_id(display_name), societies:society_id(name)')
          .eq('conference_id', confId)
          .order('created_at', { ascending: false })
          .limit(15),
      ]);
      if (cancelled) return;
      const evs: ActivityEvent[] = [];
      type ActApp = { id: string; role: string; submitted_at: string | null; paid_at: string | null; paid_amount: number | null; amount_paid: number | null; checked_in_at: string | null; resubmitted_at: string | null; invited_name: string | null; profiles: { display_name: string } | null };
      for (const a of (appsRes.data ?? []) as unknown as ActApp[]) {
        const name = a.profiles?.display_name ?? a.invited_name ?? 'Someone';
        if (a.submitted_at) evs.push({ key: `sub-${a.id}`, ts: new Date(a.submitted_at).getTime(), kind: 'application', name, detail: roleWord(a.role).toLowerCase() });
        if (a.paid_at) {
          const amt = a.paid_amount ?? a.amount_paid;
          evs.push({ key: `pay-${a.id}`, ts: new Date(a.paid_at).getTime(), kind: 'payment', name, detail: amt != null ? formatFee(Number(amt), currency) : undefined });
        }
        if (a.checked_in_at) evs.push({ key: `chk-${a.id}`, ts: new Date(a.checked_in_at).getTime(), kind: 'checkin', name });
        if (a.resubmitted_at) evs.push({ key: `res-${a.id}`, ts: new Date(a.resubmitted_at).getTime(), kind: 'resubmit', name });
      }
      type ActAlloc = { id: string; created_at: string | null; country_name: string | null; conference_committees: { name: string; abbreviation: string | null } | null; profiles: { display_name: string } | null; societies: { name: string } | null };
      for (const al of (allocRes.data ?? []) as unknown as ActAlloc[]) {
        if (!al.created_at) continue;
        const who = al.profiles?.display_name ?? al.societies?.name ?? 'A delegation';
        const committee = al.conference_committees?.abbreviation ?? al.conference_committees?.name;
        const detail = [al.country_name, committee].filter(Boolean).join(' · ') || undefined;
        evs.push({ key: `alloc-${al.id}`, ts: new Date(al.created_at).getTime(), kind: 'allocation', name: who, detail });
      }
      evs.sort((x, y) => y.ts - x.ts);
      setActivity(evs.slice(0, 8));
    })();
    return () => { cancelled = true; };
  }, [conference?.id, session?.access_token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cumulative funnel series for ParticipantsChart. Rolled here (before the
  // loading return, so hook order never changes) and only when the fetched
  // data actually changes — the roll is O(rows x buckets).
  const participantSeries = useMemo(
    () => (dash ? toCumulativeSeries(dash.apps, dash.allocatedAt) : []),
    [dash],
  );

  // ── Loading skeleton, mirrors the fixed one-viewport grid ───────────────
  if (!conference || !dash) {
    return (
      <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 56px)', padding: '14px 20px 20px' }}>
        <div className="rounded-[22px] animate-pulse flex-shrink-0" style={{ height: 48, backgroundColor: NEU.surface, boxShadow: NEU.out, marginBottom: 12 }} />
        <div className="flex flex-col xl:flex-row" style={{ alignItems: 'stretch', gap: 14 }}>
          <div className="rounded-[22px] animate-pulse w-full xl:basis-[32%] xl:shrink-0 xl:min-w-[300px]" style={{ height: 450, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
          <div className="flex flex-col" style={{ flex: 1, minWidth: 0, gap: 14 }}>
            <div className="rounded-[22px] animate-pulse flex-shrink-0" style={{ height: 202, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
            <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-3 h-auto xl:h-[166px] xl:[grid-template-columns:minmax(0,1.15fr)_minmax(0,1.7fr)_repeat(3,minmax(0,1fr))]" style={{ gap: 14 }}>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="rounded-[22px] animate-pulse" style={{ backgroundColor: NEU.surface, boxShadow: NEU.out }} />
              ))}
            </div>
            <div className="rounded-[22px] animate-pulse flex-shrink-0" style={{ height: 300, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
            <div className="rounded-[22px] animate-pulse flex-shrink-0" style={{ height: 214, backgroundColor: NEU.surface, boxShadow: NEU.out }} />
          </div>
        </div>
      </div>
    );
  }

  const slug = conference.slug;
  const confYear = conference.start_date ? new Date(conference.start_date + 'T00:00:00').getFullYear() : null;

  // ── Derived numbers ──────────────────────────────────────────────────────
  const totalApps = dash.apps.length;
  // Accepted = accepted-or-beyond. Allocating flips an application's status to
  // 'assigned' (and check-in to 'checked-in'), so a naive status === 'accepted'
  // count would exclude everyone already allocated and read *lower* than the
  // allocated number — an impossibility, since Allocated ⊆ Accepted. Counting
  // all three states keeps Allocated a true subset of Accepted.
  const acceptedApps = dash.apps.filter(
    a => a.status === 'accepted' || a.status === 'assigned' || a.status === 'checked-in'
  ).length;
  const paidApps = dash.apps.filter(a => a.payment_status === 'paid').length;
  const delegateApps = dash.apps.filter(a => a.role === 'delegate' || a.role === 'head-delegate').length;
  const societies = new Set(dash.apps.map(a => a.society_id).filter(Boolean)).size;
  const committeeCount = dash.committees.length;
  // A dais counts as handled once a chair is ASSIGNED (chair_user_ids) or
  // INVITED (a pending conference_chair_invites row). Chasing an organiser about
  // a committee whose invite is already sitting in someone's inbox is noise.
  const invitedChairCommittees = new Set(dash.pendingChairInviteCommitteeIds);
  const committeesNeedingChairs = dash.committees.filter(
    c => (!c.chair_user_ids || c.chair_user_ids.length === 0) && !invitedChairCommittees.has(c.id)
  ).length;
  // Seats delegates can actually occupy, vs how many the organiser says they
  // expect. 3 committees x 20 seats does not host 150 people.
  const seatCapacity = dash.committees.reduce(
    (sum, c) => sum + (c.committee_country_slots ?? []).reduce((n, s) => n + (s.delegation_size ?? 1), 0),
    0,
  );
  const expectedDelegates = conference.expected_delegates ?? 0;
  // Seats only need to cover 70% of the expected head count before we stop
  // flagging it: expected_delegates is an early guess, committees get added
  // over months, and demanding 100% meant this row nagged conferences that were
  // in perfectly good shape. The same 0.70 lives in conference_setup_status()
  // (which drives the nudge emails) and in admin/ConferencesTab isShortOnSeats
  // — change all three together or they will contradict each other again.
  const SEAT_COVERAGE = 0.70;
  const requiredSeats = expectedDelegates > 0 ? Math.ceil(expectedDelegates * SEAT_COVERAGE) : 0;
  const seatShortfall = expectedDelegates > 0 ? Math.max(0, requiredSeats - seatCapacity) : 0;
  // Allocated (dash.allocated = conference_allocations rows) is now always a
  // subset of Accepted, so unallocated = accepted − allocated is non-negative;
  // the Math.max stays purely as a defensive floor against transient races.
  const allocated = Math.min(dash.allocated, acceptedApps);
  const unallocated = Math.max(0, acceptedApps - allocated);
  const fee = conference.fee_amount ?? 0;

  // Funnel rings, outermost → innermost. Every value is an existing derived
  // const, so the dial can never contradict the pipeline cells or the stat
  // tiles beside it. Total ⊇ Accepted ⊇ Assigned holds by construction
  // (acceptedApps counts accepted/assigned/checked-in, and `allocated` is
  // already Math.min'd against it). Paid is a subset of Total but NOT of
  // Assigned — a delegate can pay before a committee seat is picked for them
  // — which is exactly why it is a separate ring rather than a stacked slice.
  const dialStages = [
    { key: 'total', label: 'Applications', value: totalApps },
    { key: 'accepted', label: 'Accepted', value: acceptedApps },
    { key: 'assigned', label: 'Assigned', value: allocated },
    { key: 'paid', label: 'Paid', value: paidApps },
  ];

  // ── Set-up priorities: 8 detection checks, in journey order ──────────────
  // Base order = the natural build journey (page → committees → chairs → email →
  // secretariat → financials → delegate → launch). Pending-first sort runs on top
  // of this and breaks ties by this order (see sortedChecklist).
  const checklist = [
    {
      key: 'page',
      icon: Palette,
      emoji: 'Artist palette',
      gradient: NEU_GRADIENTS.amber,
      title: 'Set up your conference page',
      sub: 'Add a banner and a description delegates will see.',
      done: !!conference.banner_url && !!conference.description?.trim(),
      onClick: () => router.push(`/manage/${slug}/settings?tab=conference`),
    },
    {
      key: 'committees',
      icon: Building2,
      emoji: 'Classical building',
      gradient: NEU_GRADIENTS.forest,
      title: 'Add committees',
      sub: committeeCount === 0
        ? 'Create committees and their topics.'
        : seatShortfall > 0
          // Only ever shown below 70% coverage, so the gap quoted is the gap to
          // that bar, not to the full expected head count.
          ? `Only ${seatCapacity} seats for ${expectedDelegates} expected delegates — ${seatShortfall} more covers most of them.`
          : `${committeeCount} committee${committeeCount === 1 ? '' : 's'}, ${seatCapacity} seats.`,
      done: committeeCount > 0 && seatShortfall === 0,
      onClick: () => router.push(`/manage/${slug}/committees`),
    },
    {
      key: 'chairs',
      icon: Gavel,
      emoji: 'Balance scale',
      gradient: NEU_GRADIENTS.gold,
      title: 'Invite chairs',
      sub: committeeCount === 0
        ? 'Add committees first, then invite a chair to each dais.'
        : committeesNeedingChairs > 0
          ? `${committeesNeedingChairs} committee${committeesNeedingChairs === 1 ? '' : 's'} with nobody on the dais yet.`
          : 'Every committee has a chair assigned or invited.',
      done: committeeCount > 0 && committeesNeedingChairs === 0,
      // Committees, not assignment: inviting a chair starts from the committee
      // you are staffing.
      onClick: () => router.push(`/manage/${slug}/committees`),
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
      key: 'email',
      icon: Mail,
      emoji: 'Envelope',
      gradient: NEU_GRADIENTS.gold,
      title: 'Explore emails',
      sub: 'See what you can send applicants automatically.',
      // INTENTIONALLY CLIENT-LOCAL: ticked by visiting the communications page,
      // recorded in localStorage (src/lib/emailsExplored.ts). This is the only
      // checklist item the server-side mirror conference_setup_status() cannot
      // reproduce — a nudge email cannot read a browser's localStorage — so the
      // SQL keeps this item on `enabled_email_count > 0`. The divergence is
      // deliberate and documented in both places.
      done: emailsExplored,
      onClick: () => router.push(`/manage/${slug}/communications`),
    },
    {
      key: 'secretariat',
      icon: UsersRound,
      // "Handshake" reads instantly as bringing co-organizers on board, the
      // grey "Busts in silhouette" 3D asset was muddy on its tinted seat.
      emoji: 'Handshake',
      gradient: NEU_GRADIENTS.sage,
      title: 'Add your secretariat',
      sub: dash.organizerCount > 1
        ? `${dash.organizerCount} organizers on the team.`
        : dash.pendingOrganizerInvites > 0
          ? 'Invite sent — waiting for them to accept.'
          : 'Invite co-organizers and grant them access.',
      // One invite out is enough: the organiser has done the part they control,
      // and accepting is not theirs to do.
      done: dash.organizerCount > 1 || dash.pendingOrganizerInvites > 0,
      onClick: () => router.push(`/manage/${slug}/settings?tab=organizers`),
    },
    {
      key: 'financials',
      icon: Wallet,
      emoji: 'Money bag',
      gradient: NEU_GRADIENTS.amber,
      title: 'Add financial information',
      // Mirrors conference_payments_ready: a non-null fee_amount alone was
      // never a real signal (the creation page always writes one), this row
      // only clears once delegates actually have somewhere to pay.
      done: conferencePaymentsReady(conference),
      sub: 'Choose how you get paid so delegates can actually pay you.',
      onClick: () => router.push(`/manage/${slug}/financials/settings`),
    },
    {
      key: 'delegate',
      icon: UserPlus,
      emoji: 'Graduation cap',
      gradient: NEU_GRADIENTS.green,
      title: 'Get your first delegate',
      sub: delegateApps > 0 ? `${delegateApps} delegate application${delegateApps === 1 ? '' : 's'} received.` : 'Share your page and receive an application.',
      done: delegateApps > 0,
      // Pending: open the share popup (link + story recipe), no deep link.
      // Done: jump to the applications that came in.
      onClick: delegateApps > 0
        ? () => router.push(`/manage/${slug}/applications`)
        : () => setShowShareModal(true),
    },
    {
      // Compact publish CTA lives here as the checklist's launch row, the
      // big accent quick-actions card was removed with the one-page layout.
      key: 'publish',
      icon: Rocket,
      emoji: 'Rocket',
      gradient: NEU_GRADIENTS.forest,
      title: 'Launch delegate registrations',
      sub: conference.is_public ? 'Your conference is live.' : 'Publish your conference to gavelling.com.',
      done: conference.is_public,
      onClick: handlePublishClick,
    },
  ];
  const doneCount = checklist.filter(c => c.done).length;
  // Pending items first; done items sink to the bottom (stable sort keeps journey order within each group).
  const sortedChecklist = [...checklist].sort((a, b) => Number(a.done) - Number(b.done));

  function handlePublishClick() {
    if (committeeCount === 0) {
      setPublishBlockMsg('Add at least one committee before publishing.');
      setTimeout(() => setPublishBlockMsg(''), 3000);
      return;
    }
    if (conference && paymentGateBlocks(conference)) {
      setPublishBlockMsg(paymentGateMessage(conference));
      // Longer timeout than the committee check above: this is a longer
      // sentence and needs more time to actually be read.
      setTimeout(() => setPublishBlockMsg(''), 6000);
      return;
    }
    setShowPublishModal(true);
  }

  async function handlePublished() {
    // Quiet: swaps the conference row in without flipping the layout's
    // full-screen loading flag, no reason to unmount this page (and lose
    // the just-closed modal state) for a routine post-write confirmation.
    await refreshConferenceQuiet();
    setShowPublishModal(false);
  }

  return (
    <div
      className="relative flex flex-col"
      style={{ minHeight: 'calc(100vh - 56px)', padding: '14px 20px 20px', fontFamily: OUTFIT, isolation: 'isolate', overflowX: 'clip' }}
    >
      {/* Decorative bleed — faded organiser glyphs off the dashboard edges,
          tucked behind the content (zIndex -1). */}
      <DecorativeBleed
        zIndex={-1}
        items={[
          { Icon: Gavel, size: 170, top: '-30px', right: '-40px', opacity: 0.045, rotate: -12 },
          { Icon: UsersRound, size: 150, bottom: '-42px', left: '-38px', opacity: 0.04 },
          { Icon: Globe2, size: 110, top: '55%', right: '-24px', opacity: 0.035 },
        ]}
      />

      {orgInviteToast && (
        <div
          className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 mb-3 flex-shrink-0"
          style={{ backgroundColor: 'rgba(61,122,82,0.10)', border: '1px solid rgba(61,122,82,0.35)' }}
        >
          <CheckCircle2 size={14} style={{ color: '#3D7A52', flexShrink: 0 }} />
          <p className="text-sm" style={{ color: '#1B3828', fontFamily: OUTFIT, fontWeight: 600 }}>
            Invite accepted. You&apos;re now part of the organizing team.
          </p>
        </div>
      )}

      {/* ── Header, compact single row ── */}
      <div className="flex items-center justify-between gap-4 flex-shrink-0" style={{ marginBottom: 12 }}>
        <div className="flex items-center gap-3 min-w-0">
          <LogoDisc
            src={conference.logo_url}
            alt={conference.acronym}
            size={38}
            fallbackText={conference.acronym.slice(0, 2)}
          />
          <div className="min-w-0">
            <p style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', color: NEU.deepGold }}>
              {conference.acronym}{confYear ? ` · ${confYear}` : ''} · DASHBOARD
            </p>
            <h1 className="font-black truncate" style={{ color: NEU.ink, fontFamily: OUTFIT, fontSize: 18, lineHeight: 1.15, marginTop: 1 }}>
              {conference.full_name}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <NeuPill active={conference.is_public} gradient={NEU_GRADIENTS.green}>
            <span style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: conference.is_public ? '#FFFFFF' : NEU.amber, flexShrink: 0 }} />
            {conference.is_public ? 'LIVE' : 'DRAFT'}
          </NeuPill>
          {!conference.is_public && (
            <NeuButton gradient={NEU_GRADIENTS.forest} icon={Rocket} onClick={handlePublishClick} style={{ padding: '8px 16px', fontSize: 12 }}>
              PUBLISH
            </NeuButton>
          )}
        </div>
      </div>

      {/* ── Main layout, flex, not a stretched grid. Both columns are
          content-sized (items-start at xl, NOT stretch): each card ends at its
          own last row rather than growing a hole underneath when the other
          column runs taller — snug beats stretched-with-holes, and the right
          column is now the taller of the two. Below xl the columns stack and
          must still stretch to full width, hence items-stretch as the base.
          The priorities card keeps the top-left corner in both directions:
          it is first in the DOM, so nothing added to the right column can
          push it down the page. ── */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-start" style={{ gap: 14 }}>

        {/* Set-up priorities, left column, content-sized, pending first */}
        <NeuCard className="flex flex-col w-full xl:basis-[32%] xl:shrink-0 xl:min-w-[300px]" style={{ padding: '14px 15px 11px' }}>
          <div className="flex items-center justify-between gap-3 flex-shrink-0" style={{ marginBottom: 9 }}>
            <div className="min-w-0">
              <h2 style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 900, color: NEU.ink }}>Set-up priorities</h2>
              <p style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
                {doneCount} of {checklist.length} done{doneCount === checklist.length ? '. You are all set.' : ''}
              </p>
            </div>
            <NeuRing value={doneCount} max={checklist.length} size={50} strokeWidth={7} gradient={NEU_GRADIENTS.gold}>
              <span style={{ fontFamily: OUTFIT, fontWeight: 900, fontSize: 13, color: NEU.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {doneCount}<span style={{ fontSize: 9, color: NEU.muted }}>/{checklist.length}</span>
              </span>
            </NeuRing>
          </div>

          <NeuProgress value={doneCount} max={checklist.length} gradient={NEU_GRADIENTS.gold} thumb height={9} style={{ marginBottom: 10, flexShrink: 0 }} />

          {/* Natural-height snug stack, the card ends exactly at the last row,
              no leftover void below (rows sink done items to the bottom). */}
          <div className="flex flex-col" style={{ gap: 5 }}>
            {sortedChecklist.map(item => (
              <NeuChecklistRow
                key={item.key}
                done={item.done}
                icon={item.icon}
                emoji={item.emoji}
                gradient={item.gradient}
                title={item.title}
                sub={item.sub}
                action={'action' in item ? item.action : undefined}
                onClick={item.onClick}
                dense
              />
            ))}
          </div>
          {publishBlockMsg && (
            <p className="flex-shrink-0" style={{ fontSize: 11, marginTop: 7, color: NEU.amber, fontFamily: OUTFIT, fontWeight: 700 }}>{publishBlockMsg}</p>
          )}
        </NeuCard>

        {/* Right column: dial → stat tiles → participants → revenue */}
        <div className="flex flex-col" style={{ flex: 1, minWidth: 0, gap: 14 }}>

        {/* Applicants against target — the headline read of the whole funnel,
            so it sits first in the right column. It is deliberately NOT in the
            left column: the priorities checklist must keep the top-left corner
            on a 1280x800 laptop, and nothing added here can move it. */}
        <NeuCard className="flex-shrink-0" style={{ padding: '15px 18px' }}>
          <div className="flex items-center flex-wrap" style={{ gap: 22 }}>
            <ApplicantsDial stages={dialStages} expected={expectedDelegates} size={172} />
            <div className="min-w-0" style={{ flex: 1, minWidth: 180 }}>
              <h2 style={{ fontFamily: OUTFIT, fontSize: 15, fontWeight: 900, color: NEU.ink }}>
                Applicants against target
              </h2>
              <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted, marginTop: 3, lineHeight: 1.45 }}>
                {expectedDelegates > 0
                  ? `Each ring is measured against the ${expectedDelegates} delegates you expect. The stages nest — every paid delegate is also counted in the ring outside it.`
                  : 'Set an expected delegate count in your conference settings and each ring gets a target to fill.'}
              </p>
              <Link
                href={expectedDelegates > 0 ? `/manage/${slug}/applications` : `/manage/${slug}/settings?tab=conference`}
                className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-70"
                style={{
                  fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em',
                  color: NEU.deepGold, textDecoration: 'none', marginTop: 8,
                }}
              >
                {expectedDelegates > 0 ? 'REVIEW APPLICATIONS' : 'SET AN EXPECTED HEAD COUNT'}
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </NeuCard>

        {/* Stat-tile row: unallocated alert + delegates pipeline + stat tiles.
            Firm height so the charts below land clearly taller; each card
            fills it via space-between rather than floating a void. */}
        <div
          className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-3 h-auto xl:h-[166px] xl:[grid-template-columns:minmax(0,1.15fr)_minmax(0,1.7fr)_repeat(3,minmax(0,1fr))]"
          style={{ gap: 14 }}
        >
          <UnallocatedTile count={unallocated} href={`/manage/${slug}/assignment`} />

          {/* Delegates pipeline, each stage links to its fix. Content spreads
              top-to-bottom (space-between) so it fills the firm row height. */}
          <NeuCard className="flex flex-col" style={{ padding: '13px 15px', minWidth: 0, justifyContent: 'space-between' }}>
            <div className="flex items-center justify-between gap-2 flex-shrink-0">
              <h2 className="truncate" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 900, color: NEU.ink }}>Delegates</h2>
              <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 10.5, fontWeight: 800, color: NEU.forest, fontVariantNumeric: 'tabular-nums' }}>
                {allocated}/{acceptedApps} <span style={{ fontWeight: 600, color: NEU.muted }}>allocated</span>
              </span>
            </div>
            <NeuProgress value={allocated} max={acceptedApps} gradient={NEU_GRADIENTS.forest} height={8} style={{ flexShrink: 0 }} />
            <div className="grid grid-cols-4">
              <PipelineCell n={totalApps} label="Submitted" href={`/manage/${slug}/applications`} first />
              <PipelineCell n={acceptedApps} label="Accepted" href={`/manage/${slug}/applications`} />
              <PipelineCell n={paidApps} label="Paid" href={`/manage/${slug}/financials`} />
              <PipelineCell n={allocated} label="Allocated" href={`/manage/${slug}/assignment`} />
            </div>
          </NeuCard>

          <NeuStatTile
            emoji="Inbox tray"
            icon={Inbox}
            gradient={NEU_GRADIENTS.forest}
            value={totalApps}
            label="Applications"
            href={`/manage/${slug}/applications`}
          />
          <NeuStatTile
            emoji="Check mark button"
            icon={CheckCircle2}
            gradient={NEU_GRADIENTS.green}
            value={acceptedApps}
            label="Accepted"
            href={`/manage/${slug}/applications`}
          />
          <NeuStatTile
            emoji="Globe showing europe-africa"
            icon={Globe2}
            gradient={NEU_GRADIENTS.sage}
            value={societies}
            label="Delegations"
            href={`/manage/${slug}/applications`}
          />
        </div>

        {/* Participants over time, full right width. It needs the whole column:
            the SVG is a scaled viewBox, so squeezing it sideways shrinks the
            axis type with it. Self-sizing (fixed aspect), hence no flex:1. */}
        <NeuCard className="flex flex-col flex-shrink-0" style={{ padding: '13px 16px 12px' }}>
          <ParticipantsChart points={participantSeries} />
        </NeuCard>

        {/* Revenue kept as a second, shorter chart. ParticipantsChart answers
            "how many people", never "how much money", and this is the only
            revenue-over-time surface on the dashboard — dropping it would have
            silently removed the organiser's takings graph and the header link
            into /financials. Explicit height because this chart measures its
            own box (ResizeObserver) and would collapse in an auto-height card. */}
        <NeuCard className="flex flex-col flex-shrink-0" style={{ height: 214, padding: '13px 16px 11px' }}>
          <RevenueChart
            rows={dash.apps}
            fee={fee}
            currency={conference.fee_currency}
            financialsHref={`/manage/${slug}/financials`}
          />
        </NeuCard>

        </div>
      </div>

      {/* Recent activity, full-width momentum feed below the one-viewport grid */}
      <div style={{ marginTop: 14, flexShrink: 0 }}>
        <RecentActivity events={activity} now={now} />
      </div>

      {showPublishModal && (
        <PublishModal
          conference={conference}
          onClose={() => setShowPublishModal(false)}
          onPublished={handlePublished}
        />
      )}

      {showShareModal && (
        <ShareModal
          conference={conference}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
