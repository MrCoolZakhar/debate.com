'use client';

// Manage account, the credits part (one page since 26 Sep 2026, see
// ManageAccount.tsx). The balance (the same hook the header
// counter reads) with Top up through the global credits pop-up, the three
// figures that matter as big numbers floating over the hero, a 30-day usage chart that is ALWAYS
// drawn (an empty month draws the empty-state chart), and the ledger as a
// plain table whose middle column is the server's own sentence. Nothing here
// writes; the pop-up and the promo page refresh the balance through
// refreshCreditsEverywhere().

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Coins } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { useCredits } from '@/hooks/useCredits';
import { openCreditsPopup } from '@/lib/purchasePopup';
import { friendlyError } from '@/lib/friendlyError';
import { Emoji3D } from '@/components/neu';
import { OUTFIT, T, W } from '../accountUi';
import {
  PrimaryButton, SecondaryButton, WhiteCard, Eyebrow, formatDay,
  FOREST, DEEP_GOLD, GOLD, IVORY, INK, INK_SOFT, RULE, FOREST_MID,
} from './manageUi';
import { HeroOverlap } from '../accountShell';

interface ActivityRow {
  at: string;
  /** Already a plain sentence, written by the server. */
  action: string;
  delta: number;
  kind: string;
}

const PAGE = 50;
// One read serves the ledger, the chart and the year figures.
const FETCH = 500;
const DAYS = 30;

// Two brand tokens. Spent is the darker series, added the gold one; the
// legend and the table beneath carry identity, so the chart never depends
// on colour alone.
const SPENT = FOREST;
const ADDED = DEEP_GOLD;

type Day = { key: string; label: string; spent: number; added: number };

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The last 30 days, oldest first, each with what was spent and added. */
function bucketByDay(rows: ActivityRow[]): Day[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: Day[] = [];
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

/** Credits taken since 1 January this year: negative deltas, pool rows left out. */
function usedThisYear(rows: ActivityRow[]): number {
  const jan1 = new Date(new Date().getFullYear(), 0, 1).getTime();
  let n = 0;
  for (const r of rows) {
    if (r.delta >= 0 || r.kind === 'pool') continue;
    const at = new Date(r.at).getTime();
    if (!Number.isFinite(at) || at < jan1) continue;
    n += -r.delta;
  }
  return n;
}

/** Applications that cost nothing: a zero delta and the server's word "covered". */
function coveredForFree(rows: ActivityRow[]): number {
  return rows.filter((r) => r.delta === 0 && /covered/i.test(r.action)).length;
}

function signed(delta: number): string {
  if (delta < 0) return `−${Math.abs(delta)}`;
  if (delta > 0) return `+${delta}`;
  return '0';
}

/** The credits half of Manage account, with slots for the plan card (beside
 *  the balance) and the promo card (beside the chart). */
export default function CreditsSection({ plan, promo }: { plan: React.ReactNode; promo: React.ReactNode }) {
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
  const yearUsed = useMemo(() => usedThisYear(rows), [rows]);
  const covered = useMemo(() => coveredForFree(rows), [rows]);

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

  const balanceText = balance === null ? (balanceLoading ? '…' : '0') : String(balance);
  const held = balance ?? 0;

  return (
    <>
      <HeroOverlap>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5 items-start">
          {/* ── Credits: the balance as a big number, Top up, three figures ── */}
          <WhiteCard id="credits" className="lg:col-span-7" style={{ scrollMarginTop: 96 }}>
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex items-center gap-4 min-w-0">
                <span className="flex-shrink-0 inline-flex items-center justify-center rounded-2xl" style={{ width: 60, height: 60, background: 'linear-gradient(135deg, rgba(238,217,138,0.5), rgba(238,217,138,0.22))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 3px 8px -3px rgba(27,56,40,0.22)' }} aria-hidden>
                  <Emoji3D name="Money bag" size={38} fallback={Coins} fallbackColor={FOREST} />
                </span>
                <div className="min-w-0" aria-live="polite">
                  <Eyebrow>Your credits</Eyebrow>
                  <p className="flex items-baseline gap-2" style={{ margin: '2px 0 0' }}>
                    <span
                      style={{
                        fontFamily: OUTFIT, fontWeight: W.title, fontSize: 'clamp(46px, 9vw, 64px)',
                        lineHeight: 1, letterSpacing: '-0.04em', color: FOREST, fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {balanceText}
                    </span>
                    <span style={{ fontFamily: OUTFIT, fontWeight: W.label, fontSize: 18, color: INK }}>{held === 1 ? 'credit' : 'credits'}</span>
                  </p>
                </div>
              </div>
              <PrimaryButton onClick={() => openCreditsPopup({ context: 'manage' })}>Top up</PrimaryButton>
            </div>

            {/* The three figures: a big number with its word beside it */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-6">
              <SmallFigure value={held} word="held" note="Now" />
              <SmallFigure value={yearUsed} word="used" note={`In ${new Date().getFullYear()}`} />
              <SmallFigure value={covered} word="free" note="Covered for you" />
            </div>
          </WhiteCard>

          {/* ── The plan ── */}
          <div className="lg:col-span-5">{plan}</div>
        </div>
      </HeroOverlap>

      <div className="px-2 sm:px-4 md:px-6 mt-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5 items-start">
          {/* 30-day usage: always drawn */}
          <WhiteCard className="lg:col-span-8" aria-labelledby="usage-title" style={{ padding: '22px 22px 16px' }}>
            <h2 id="usage-title" style={{ margin: '0 0 12px', fontFamily: OUTFIT, fontWeight: W.title, fontSize: T.section, color: INK, letterSpacing: '-0.01em' }}>
              Last 30 Days
            </h2>
            <UsageChart days={days} empty={!anyActivity} spent={spent30} added={added30} />
          </WhiteCard>

          {/* Promo code */}
          <div className="lg:col-span-4">{promo}</div>
        </div>

        {/* History */}
        <section className="mt-8" aria-labelledby="history-title">
          <h2 id="history-title" style={{ margin: '0 0 12px', fontFamily: OUTFIT, fontWeight: W.title, fontSize: T.section, color: INK, letterSpacing: '-0.01em' }}>
            History
          </h2>

          {loadError && (
            <p role="alert" style={{ margin: '0 0 12px', fontFamily: OUTFIT, fontSize: T.body, color: '#C13515' }}>{loadError}</p>
          )}

          {!loading && rows.length === 0 && !loadError ? (
            <p style={{ margin: 0, fontFamily: OUTFIT, fontSize: T.body, color: INK_SOFT }}>
              Nothing yet
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[20px]" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 0 0 1px rgba(27,56,40,0.07), 8px 12px 28px -6px rgba(27,56,40,0.14)' }}>
              <table className="w-full" style={{ borderCollapse: 'collapse', fontFamily: OUTFIT, fontSize: T.body, color: INK, minWidth: 420 }}>
                <thead>
                  <tr style={{ backgroundColor: IVORY, borderBottom: `1px solid ${RULE}` }}>
                    <th scope="col" className="text-left" style={{ padding: '12px 16px', fontWeight: W.section, fontSize: T.caption, color: DEEP_GOLD, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Date</th>
                    <th scope="col" className="text-left" style={{ padding: '12px 16px', fontWeight: W.section, fontSize: T.caption, color: DEEP_GOLD, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Action</th>
                    <th scope="col" className="text-right" style={{ padding: '12px 16px', fontWeight: W.section, fontSize: T.caption, color: DEEP_GOLD, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => (
                    <tr key={`${r.at}-${i}`} style={{ borderTop: i === 0 ? 'none' : `1px solid rgba(221,212,192,0.6)` }}>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: INK_SOFT, verticalAlign: 'top', fontVariantNumeric: 'tabular-nums' }}>{formatDay(r.at)}</td>
                      <td style={{ padding: '12px 16px', lineHeight: 1.45, maxWidth: '60ch' }}>{r.action}</td>
                      <td
                        className="text-right"
                        style={{
                          padding: '12px 16px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: W.section,
                          color: r.delta < 0 ? INK : r.delta > 0 ? FOREST_MID : INK_SOFT, verticalAlign: 'top',
                        }}
                      >
                        {signed(r.delta)}
                      </td>
                    </tr>
                  ))}
                  {loading && rows.length > 0 && (
                    <tr><td colSpan={3} style={{ padding: '12px 16px', color: INK_SOFT }}>Loading more</td></tr>
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
      </div>
    </>
  );
}

/** One of the three credit figures: the number big, its word beside it. */
function SmallFigure({ value, word, note }: { value: number; word: string; note: string }) {
  return (
    <div className="rounded-[16px] px-3 py-3 sm:px-4" style={{ backgroundColor: 'rgba(27,56,40,0.035)', minWidth: 0 }}>
      <p className="flex flex-wrap items-baseline gap-x-1.5" style={{ margin: 0 }}>
        <span style={{ fontFamily: OUTFIT, fontWeight: W.title, fontSize: 'clamp(24px, 4vw, 32px)', lineHeight: 1, letterSpacing: '-0.03em', color: FOREST, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        <span style={{ fontFamily: OUTFIT, fontWeight: W.label, fontSize: T.body, color: INK }}>{word}</span>
      </p>
      <p style={{ margin: '4px 0 0', fontFamily: OUTFIT, fontSize: T.caption, color: INK_SOFT }}>{note}</p>
    </div>
  );
}

// ── The chart ────────────────────────────────────────────────────────────────
// Inline SVG, one baseline, two bars per day (spent, then added), 4px rounded
// data-ends, a 2px surface gap between neighbours, a hairline baseline, faint
// day ticks, and a hover tooltip per day. The day labels mark the first, the
// middle and today. With no activity the same frame is drawn with a flat
// baseline and a quiet sentence in the plot area; the chart is never hidden.

function UsageChart({ days, empty, spent, added }: { days: Day[]; empty: boolean; spent: number; added: number }) {
  const [hover, setHover] = useState<number | null>(null);

  const W_ = 720;
  const H = 132;
  const PAD_TOP = 10;
  const PAD_BOTTOM = 24;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const baseY = PAD_TOP + plotH;
  const slot = W_ / days.length;
  const gap = 2;
  const barW = Math.min(8, (slot - gap * 3) / 2);
  const max = Math.max(1, ...days.map((d) => Math.max(d.spent, d.added)));

  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH;

  const bar = (x: number, v: number, fill: string, key: string) => {
    if (v <= 0) return null;
    const top = y(v);
    const h = Math.max(2, baseY - top);
    const r = Math.min(4, h / 2, barW / 2);
    // Rounded at the data end, square at the baseline.
    const d = [
      `M${x},${baseY}`,
      `V${top + r}`,
      `Q${x},${top} ${x + r},${top}`,
      `H${x + barW - r}`,
      `Q${x + barW},${top} ${x + barW},${top + r}`,
      `V${baseY}`,
      'Z',
    ].join(' ');
    return <path key={key} d={d} fill={fill} />;
  };

  const hovered = !empty && hover !== null ? days[hover] : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-2" aria-hidden>
        <span className="inline-flex items-center gap-2" style={{ fontFamily: OUTFIT, fontSize: T.caption, fontWeight: W.label, color: INK_SOFT }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: SPENT, display: 'inline-block' }} />
          Spent <span style={{ color: INK, fontVariantNumeric: 'tabular-nums' }}>{spent}</span>
        </span>
        <span className="inline-flex items-center gap-2" style={{ fontFamily: OUTFIT, fontSize: T.caption, fontWeight: W.label, color: INK_SOFT }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: ADDED, display: 'inline-block' }} />
          Added <span style={{ color: INK, fontVariantNumeric: 'tabular-nums' }}>{added}</span>
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W_} ${H}`}
          width="100%"
          height={H}
          preserveAspectRatio="none"
          role="img"
          aria-label={empty
            ? 'No credits spent or added in the last 30 days'
            : `Credits spent and added per day over the last 30 days. Most in one day: ${max}`}
          style={{ display: 'block', overflow: 'visible' }}
          onMouseLeave={() => setHover(null)}
        >
          {/* faint day ticks on the baseline */}
          {days.map((d, i) => (
            <line
              key={`tick-${d.key}`}
              x1={i * slot + slot / 2} x2={i * slot + slot / 2}
              y1={baseY} y2={baseY + 4}
              stroke={RULE} strokeWidth={1} shapeRendering="crispEdges"
            />
          ))}

          {/* baseline */}
          <line x1={0} x2={W_} y1={baseY} y2={baseY} stroke={empty ? RULE : FOREST} strokeOpacity={empty ? 1 : 0.35} strokeWidth={1} shapeRendering="crispEdges" />

          {!empty && days.map((d, i) => {
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
              y={H - 4}
              textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'}
              style={{ fontFamily: OUTFIT, fontSize: 11, fill: INK_SOFT }}
            >
              {i === days.length - 1 ? 'Today' : days[i].label}
            </text>
          ))}
        </svg>

        {/* The empty-state sentence sits in the plot area, above the baseline,
            as HTML so preserveAspectRatio="none" cannot stretch its letters. */}
        {empty && (
          <p
            className="pointer-events-none absolute left-0 right-0 text-center"
            style={{
              top: PAD_TOP + plotH / 2 - 12, margin: 0,
              fontFamily: OUTFIT, fontSize: T.body, fontWeight: W.label, color: INK_SOFT,
            }}
          >
            No activity in the last 30 days
          </p>
        )}

        {hovered && hover !== null && (
          <div
            role="status"
            className="pointer-events-none absolute rounded-lg px-3 py-2"
            style={{
              top: -8,
              left: `${((hover + 0.5) / days.length) * 100}%`,
              transform: `translate(${hover > days.length * 0.7 ? '-100%' : hover < days.length * 0.3 ? '0' : '-50%'}, -100%)`,
              backgroundColor: FOREST,
              color: IVORY,
              fontFamily: OUTFIT,
              fontSize: T.caption,
              whiteSpace: 'nowrap',
              boxShadow: '0 6px 18px rgba(27,56,40,0.18)',
            }}
          >
            <span style={{ fontWeight: W.section, color: GOLD }}>{hovered.label}</span>
            <span style={{ margin: '0 6px', opacity: 0.6 }}>&middot;</span>
            {hovered.spent} spent, {hovered.added} added
          </div>
        )}
      </div>
    </div>
  );
}
