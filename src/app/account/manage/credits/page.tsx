'use client';

// Manage account: Credits and usage. The balance (the same hook the header
// counter reads), Top up through the global credits pop-up, a 30-day usage
// chart drawn as inline SVG, and the ledger as a plain table whose middle
// column is the server's own sentence. Nothing here writes; the pop-up and
// the promo page refresh the balance through refreshCreditsEverywhere().

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Coins } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { useCredits } from '@/hooks/useCredits';
import { openCreditsPopup } from '@/lib/purchasePopup';
import { friendlyError } from '@/lib/friendlyError';
import { Emoji3D } from '@/components/neu';
import { OUTFIT, T, W } from '../../accountUi';
import { PageHead, HelpLine, PrimaryButton, SecondaryButton, formatDay } from '../manageUi';

interface ActivityRow {
  at: string;
  /** Already a plain sentence, written by the server. */
  action: string;
  delta: number;
  kind: string;
}

const PAGE = 50;
const FETCH = 200;
const DAYS = 30;

// Two brand tokens. Spent is the darker series, added the lighter one; the
// legend, the summary sentence and the table beneath carry identity, so the
// chart never depends on color alone.
const SPENT = '#1B3828';
const ADDED = '#B6871F';

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The last 30 days, oldest first, each with what was spent and added. */
function bucketByDay(rows: ActivityRow[]): { key: string; label: string; spent: number; added: number }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: { key: string; label: string; spent: number; added: number }[] = [];
  const index = new Map<string, number>();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = dayKey(d);
    index.set(key, days.length);
    days.push({ key, label: formatDay(d.toISOString()), spent: 0, added: 0 });
  }
  for (const r of rows) {
    const at = new Date(r.at);
    if (!Number.isFinite(at.getTime())) continue;
    const i = index.get(dayKey(at));
    if (i === undefined) continue;
    if (r.delta < 0) days[i].spent += -r.delta;
    else if (r.delta > 0) days[i].added += r.delta;
  }
  return days;
}

function signed(delta: number): string {
  if (delta < 0) return `−${Math.abs(delta)}`;
  if (delta > 0) return `+${delta}`;
  return '0';
}

export default function CreditsPage() {
  const { user } = useAuth();
  const { balance, loading: balanceLoading } = useCredits();

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [fetched, setFetched] = useState(0);
  const [limit, setLimit] = useState(FETCH);
  const [shown, setShown] = useState(PAGE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async (n: number) => {
    if (!user) return;
    setLoading(true);
    try {
      const client = await getFreshAuthedClient();
      if (!client) throw new Error('signed out');
      const { data, error } = await client.rpc('my_credit_activity', { p_limit: n });
      if (error) throw error;
      const list = ((data as ActivityRow[] | null) ?? []).map((r) => ({ ...r, delta: Number(r.delta) || 0 }));
      setRows(list);
      setFetched(n);
      setLoadError('');
    } catch (err) {
      setLoadError(friendlyError(err, 'Could not read your credit history. Refresh the page to try again.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(limit); }, [load, limit]);

  // A purchase or a promo code moves the balance; re-read the ledger with it.
  // The first balance read is skipped: the mount effect above already loaded.
  const seenBalance = useRef<number | null>(null);
  useEffect(() => {
    if (balance === null) return;
    if (seenBalance.current === null) { seenBalance.current = balance; return; }
    if (seenBalance.current === balance) return;
    seenBalance.current = balance;
    void load(limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance]);

  const days = useMemo(() => bucketByDay(rows), [rows]);
  const spent30 = days.reduce((n, d) => n + d.spent, 0);
  const added30 = days.reduce((n, d) => n + d.added, 0);
  const anyActivity = spent30 > 0 || added30 > 0;

  const visible = rows.slice(0, shown);
  // More to show when the loaded set still has rows past the fold, or when
  // the server handed back a full page and might have more behind it.
  const canLoadMore = shown < rows.length || (rows.length >= fetched && rows.length > 0);

  function loadMore() {
    if (shown < rows.length) {
      setShown((s) => s + PAGE);
      return;
    }
    setShown((s) => s + PAGE);
    setLimit((l) => l + FETCH);
  }

  return (
    <div>
      <PageHead title="Credits and usage" lede="One credit is one application. Credits come back to you when an application is turned down." />

      {/* Balance */}
      <section
        className="rounded-[20px] p-6 md:p-8 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8"
        style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0', maxWidth: 640 }}
        aria-live="polite"
      >
        <span className="flex-shrink-0 inline-flex items-center justify-center rounded-2xl" style={{ width: 56, height: 56, backgroundColor: 'rgba(238,217,138,0.28)' }} aria-hidden>
          <Emoji3D name="Money bag" size={32} fallback={Coins} fallbackColor="#1B3828" />
        </span>
        <div className="min-w-0 flex-1">
          <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: T.caption, fontWeight: W.section, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B6871F' }}>
            Your credits
          </p>
          <p
            style={{
              margin: '2px 0 0', fontFamily: OUTFIT, fontWeight: W.title, fontSize: 'clamp(40px, 10vw, 56px)',
              lineHeight: 1, letterSpacing: '-0.02em', color: '#1C1410', fontVariantNumeric: 'tabular-nums',
            }}
          >
            {balance === null ? (balanceLoading ? '…' : '0') : balance}
          </p>
        </div>
        <div className="flex-shrink-0">
          <PrimaryButton onClick={() => openCreditsPopup({ context: 'manage' })}>Top up</PrimaryButton>
        </div>
      </section>

      {/* 30-day usage */}
      <section className="mt-10" style={{ maxWidth: 760 }} aria-labelledby="usage-title">
        <h2 id="usage-title" style={{ margin: 0, fontFamily: OUTFIT, fontWeight: W.section, fontSize: T.section, color: '#1C1410', letterSpacing: '-0.01em' }}>
          Last 30 days
        </h2>
        <p style={{ margin: '6px 0 14px', fontFamily: OUTFIT, fontSize: T.body, color: '#5A5046' }}>
          {loading && rows.length === 0
            ? 'Reading your activity.'
            : anyActivity
              ? `${spent30} spent, ${added30} added in the last 30 days.`
              : 'No activity in the last 30 days.'}
        </p>
        {anyActivity && <UsageChart days={days} />}
      </section>

      {/* History */}
      <section className="mt-10" aria-labelledby="history-title">
        <h2 id="history-title" style={{ margin: '0 0 12px', fontFamily: OUTFIT, fontWeight: W.section, fontSize: T.section, color: '#1C1410', letterSpacing: '-0.01em' }}>
          History
        </h2>

        {loadError && (
          <p role="alert" style={{ margin: '0 0 12px', fontFamily: OUTFIT, fontSize: T.body, color: '#C13515' }}>{loadError}</p>
        )}

        {!loading && rows.length === 0 && !loadError ? (
          <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: T.body, color: '#5A5046' }}>
            Nothing yet. Your first credit shows up here the moment it lands.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[16px]" style={{ border: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse', fontFamily: OUTFIT, fontSize: T.body, color: '#1C1410', minWidth: 420 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #DDD4C0' }}>
                  <th scope="col" className="text-left" style={{ padding: '12px 16px', fontWeight: W.section, fontSize: T.caption, color: '#5A5046', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Date</th>
                  <th scope="col" className="text-left" style={{ padding: '12px 16px', fontWeight: W.section, fontSize: T.caption, color: '#5A5046', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Action</th>
                  <th scope="col" className="text-right" style={{ padding: '12px 16px', fontWeight: W.section, fontSize: T.caption, color: '#5A5046', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Change</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr key={`${r.at}-${i}`} style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(221,212,192,0.6)' }}>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: '#5A5046', verticalAlign: 'top' }}>{formatDay(r.at)}</td>
                    <td style={{ padding: '12px 16px', lineHeight: 1.45, maxWidth: '60ch' }}>{r.action}</td>
                    <td
                      className="text-right"
                      style={{
                        padding: '12px 16px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: W.label,
                        color: r.delta < 0 ? '#1C1410' : r.delta > 0 ? '#2A5A3C' : '#5A5046', verticalAlign: 'top',
                      }}
                    >
                      {signed(r.delta)}
                    </td>
                  </tr>
                ))}
                {loading && rows.length > 0 && (
                  <tr><td colSpan={3} style={{ padding: '12px 16px', color: '#5A5046' }}>Loading more.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {canLoadMore && rows.length >= PAGE && (
          <div className="mt-4">
            <SecondaryButton onClick={loadMore} disabled={loading}>Load more</SecondaryButton>
          </div>
        )}
      </section>

      <HelpLine />
    </div>
  );
}

// ── The chart ────────────────────────────────────────────────────────────────
// Inline SVG, one baseline, two bars per day (spent, then added), 4px rounded
// data-ends, a 2px surface gap between neighbours, a hairline baseline, and a
// hover tooltip per day. The day labels mark the first, the middle and today.

function UsageChart({ days }: { days: { key: string; label: string; spent: number; added: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const W_ = 720;
  const H = 120;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 22;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const slot = W_ / days.length;
  const gap = 2;
  const barW = Math.min(8, (slot - gap * 3) / 2);
  const max = Math.max(1, ...days.map((d) => Math.max(d.spent, d.added)));

  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH;

  const bar = (x: number, v: number, fill: string, key: string) => {
    if (v <= 0) return null;
    const top = y(v);
    const h = Math.max(2, PAD_TOP + plotH - top);
    const r = Math.min(4, h / 2, barW / 2);
    // Rounded at the data end, square at the baseline.
    const d = [
      `M${x},${PAD_TOP + plotH}`,
      `V${top + r}`,
      `Q${x},${top} ${x + r},${top}`,
      `H${x + barW - r}`,
      `Q${x + barW},${top} ${x + barW},${top + r}`,
      `V${PAD_TOP + plotH}`,
      'Z',
    ].join(' ');
    return <path key={key} d={d} fill={fill} />;
  };

  const hovered = hover !== null ? days[hover] : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-2" aria-hidden>
        <span className="inline-flex items-center gap-2" style={{ fontFamily: OUTFIT, fontSize: T.caption, color: '#5A5046' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: SPENT, display: 'inline-block' }} /> Spent
        </span>
        <span className="inline-flex items-center gap-2" style={{ fontFamily: OUTFIT, fontSize: T.caption, color: '#5A5046' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: ADDED, display: 'inline-block' }} /> Added
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W_} ${H}`}
          width="100%"
          height={H}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Credits spent and added per day over the last 30 days. Most in one day: ${max}.`}
          style={{ display: 'block', overflow: 'visible' }}
          onMouseLeave={() => setHover(null)}
        >
          {/* baseline */}
          <line x1={0} x2={W_} y1={PAD_TOP + plotH} y2={PAD_TOP + plotH} stroke="#DDD4C0" strokeWidth={1} shapeRendering="crispEdges" />

          {days.map((d, i) => {
            const x0 = i * slot + (slot - (barW * 2 + gap)) / 2;
            return (
              <g key={d.key}>
                {hover === i && (
                  <rect x={i * slot} y={PAD_TOP} width={slot} height={plotH} fill="rgba(27,56,40,0.06)" />
                )}
                {bar(x0, d.spent, SPENT, `${d.key}-s`)}
                {bar(x0 + barW + gap, d.added, ADDED, `${d.key}-a`)}
                {/* hit target: the whole slot, taller than the marks */}
                <rect
                  x={i * slot} y={0} width={slot} height={H} fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={-1}
                />
              </g>
            );
          })}

          {[0, Math.floor(days.length / 2), days.length - 1].map((i) => (
            <text
              key={`lbl-${i}`}
              x={i * slot + slot / 2}
              y={H - 6}
              textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'}
              style={{ fontFamily: OUTFIT, fontSize: 11, fill: '#5A5046' }}
            >
              {i === days.length - 1 ? 'Today' : days[i].label}
            </text>
          ))}
        </svg>

        {hovered && hover !== null && (
          <div
            role="status"
            className="pointer-events-none absolute rounded-lg px-3 py-2"
            style={{
              top: -8,
              left: `${((hover + 0.5) / days.length) * 100}%`,
              transform: `translate(${hover > days.length * 0.7 ? '-100%' : hover < days.length * 0.3 ? '0' : '-50%'}, -100%)`,
              backgroundColor: '#1C1410',
              color: '#FAF8F3',
              fontFamily: OUTFIT,
              fontSize: T.caption,
              whiteSpace: 'nowrap',
              boxShadow: '0 6px 18px rgba(27,56,40,0.18)',
            }}
          >
            <span style={{ fontWeight: W.section }}>{hovered.label}</span>
            <span style={{ margin: '0 6px', opacity: 0.6 }}>&middot;</span>
            {hovered.spent} spent, {hovered.added} added
          </div>
        )}
      </div>
    </div>
  );
}
