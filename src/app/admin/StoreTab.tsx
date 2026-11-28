'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Gavelling staff → Store (prompt 94, 28 Nov 2026). The Store at a glance:
// the sale, visits to /store, /store/credits, /games and /jobs, credits sold,
// new Unlimited plans, what credits were spent on, MUNillion and the waitlist.
// One RPC, admin_store_stats(p_days), gated in the database on
// is_platform_admin(). Days are UTC days, today included (p_days 1 = today).
// Raw errors are kept on purpose here (/admin). In TrafficTab's manner and
// with its pieces (Section, StatStrip, DayChart).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { BarChart3, Clock, Coins, Compass, Gamepad2, Infinity as InfinityIcon, ListChecks, RefreshCw, ShoppingBag, Wallet } from 'lucide-react';
import Loader from '@/components/Loader';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { NEU, NEU_GRADIENTS, OUTFIT } from '@/components/neu';
import { int, NUM } from './staffBits';
import { DayChart, Section, StatStrip } from './TrafficTab';

interface StoreStats {
  ok: boolean;
  days: number;
  sale: { key: string; title: string; starts_at: string; ends_at: string } | null;
  views: { store: number; credits_page: number; games: number; jobs: number };
  credits: { purchases: number; credits_bought: number; buyers: number; sale_free_credits: number };
  unlimited: { yearly: number; monthly: number; trials: number };
  job_promotions: { count: number; credits: number };
  store: { spotlight_credits: number; email_credits: number; sponsorship_added: number; guide_unlocks: number };
  waitlist: { item: string; people: number }[];
  munillion: { plays: number; finished: number; players: number; signed_in: number };
  by_day: { day: string; credits_bought: number; purchases: number; plays: number }[];
}

type Days = 1 | 7 | 30;
const WINDOWS: { d: Days; label: string }[] = [
  { d: 1, label: 'Today' },
  { d: 7, label: '7 days' },
  { d: 30, label: '30 days' },
];

const WAITLIST_NAMES: Record<string, string> = {
  mun_archive: 'Archive',
  gift_credits: 'Gift credits',
  social_feature: 'Social media feature',
  email_feature: 'Email feature',
  external_applications: 'External applications',
};

/** "Wednesday 2 December", the UTC day. */
function utcDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

export default function StoreTab() {
  const { user, session, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [days, setDays] = useState<Days>(1);
  const [tick, setTick] = useState(0);
  const [s, setS] = useState<StoreStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading || !userId || !session) return;
    let alive = true;
    // The token is read here, at call time; the effect is keyed on the user id.
    const supabase = getAuthedClient(session.access_token);
    void Promise.resolve().then(() => { if (alive) setBusy(true); });
    void supabase.rpc('admin_store_stats', { p_days: days }).then(({ data, error: e }) => {
      if (!alive) return;
      setBusy(false);
      if (e) { setError(e.message); return; }
      const d = data as StoreStats;
      if (!d?.ok) { setError('not authorised'); return; }
      setError(null);
      setS(d);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userId, days, tick]);

  if (error) return <p style={{ fontFamily: OUTFIT, color: '#8B2020', fontSize: 13 }}>{error}</p>;
  if (!s) return <div className="py-16 flex justify-center"><Loader /></div>;

  const windowWord = days === 1 ? 'today (UTC)' : `in ${days} days`;
  const ended = s.sale ? Date.parse(s.sale.ends_at) <= Date.now() : false;
  const creditsByDay = s.by_day.map((d) => ({ day: d.day, views: d.credits_bought }));
  const playsByDay = s.by_day.map((d) => ({ day: d.day, views: d.plays }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div role="radiogroup" aria-label="Window" className="inline-flex gap-1">
          {WINDOWS.map(({ d, label }) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={days === d}
              onClick={() => setDays(d)}
              className="focus:outline-none"
              style={{
                fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                backgroundColor: days === d ? NEU.forest : 'rgba(27,56,40,0.08)', color: days === d ? NEU.gold : NEU.ink,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setTick((n) => n + 1)}
          disabled={busy}
          aria-label="Refresh"
          className="focus:outline-none inline-flex items-center gap-1.5"
          style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, padding: '6px 12px', borderRadius: 999, border: 'none', cursor: busy ? 'default' : 'pointer', backgroundColor: 'rgba(27,56,40,0.08)', color: NEU.ink }}
        >
          <RefreshCw size={13} className={busy ? 'animate-spin' : undefined} aria-hidden />
          Refresh
        </button>
        <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft, margin: 0 }}>
          UTC days, today included.
        </p>
      </div>

      <Section icon={Clock} gradient={NEU_GRADIENTS.gold} title="Sale" kicker="Starts and ends come from store_sales">
        {s.sale ? (
          <p style={{ fontFamily: OUTFIT, fontSize: 15, color: NEU.ink, margin: 0 }}>
            <strong style={{ fontWeight: 900 }}>{s.sale.title || s.sale.key}</strong>
            <span style={{ color: NEU.inkSoft }}> · {ended ? 'Ended' : `Ends ${utcDay(s.sale.ends_at)} UTC`}</span>
          </p>
        ) : (
          <p style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft, margin: 0 }}>No sale row.</p>
        )}
      </Section>

      <Section icon={Compass} gradient={NEU_GRADIENTS.sage} title="Visits" kicker={windowWord}>
        <StatStrip items={[
          { label: 'Store', value: int(s.views.store) },
          { label: 'Credits and Unlimited', value: int(s.views.credits_page) },
          { label: 'Games', value: int(s.views.games) },
          { label: 'Job Board', value: int(s.views.jobs) },
        ]} />
        <p style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.inkSoft, marginTop: 8 }}>
          Counted since 28 Nov 2026. Before that these pages were counted as Other.
        </p>
      </Section>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
        <Section icon={Coins} gradient={NEU_GRADIENTS.forest} title="Credits" kicker={windowWord}>
          <StatStrip items={[
            { label: 'Purchases', value: int(s.credits.purchases) },
            { label: 'Credits bought', value: int(s.credits.credits_bought) },
            { label: 'Buyers', value: int(s.credits.buyers) },
            { label: 'Free sale credits', value: int(s.credits.sale_free_credits) },
          ]} />
        </Section>
        <Section icon={InfinityIcon} gradient={NEU_GRADIENTS.amber} title="Unlimited" kicker={windowWord}>
          <StatStrip items={[
            { label: 'New yearly', value: int(s.unlimited.yearly) },
            { label: 'New monthly', value: int(s.unlimited.monthly) },
            { label: 'New trials', value: int(s.unlimited.trials) },
          ]} />
        </Section>
      </div>

      <Section icon={Wallet} gradient={NEU_GRADIENTS.forest} title="Spending" kicker="Credits, not money">
        <StatStrip items={[
          { label: 'Job Board promotions', value: int(s.job_promotions.count) },
          { label: 'Promotion credits', value: int(s.job_promotions.credits) },
          { label: 'Spotlight credits', value: int(s.store.spotlight_credits) },
          { label: 'Email credits', value: int(s.store.email_credits) },
          { label: 'Sponsorship added', value: int(s.store.sponsorship_added) },
          { label: 'Guide unlocks', value: int(s.store.guide_unlocks) },
        ]} />
      </Section>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
        <Section icon={Gamepad2} gradient={NEU_GRADIENTS.sage} title="MUNillion" kicker={windowWord}>
          <StatStrip items={[
            { label: 'Plays', value: int(s.munillion.plays) },
            { label: 'Finished', value: int(s.munillion.finished) },
            { label: 'Players', value: int(s.munillion.players) },
            { label: 'Signed in', value: int(s.munillion.signed_in) },
          ]} />
        </Section>
        <Section icon={ListChecks} gradient={NEU_GRADIENTS.gold} title="Waitlist" kicker="Everyone on it so far">
          {s.waitlist.length === 0 ? (
            <p style={{ fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}>Nobody on a waitlist yet.</p>
          ) : (
            <div className="flex flex-col" style={{ gap: 6 }}>
              {s.waitlist.map((w) => (
                <div key={w.item} className="flex items-baseline justify-between gap-3" style={{ borderTop: '1px solid rgba(27,56,40,0.09)', paddingTop: 6 }}>
                  <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.ink, overflowWrap: 'anywhere' }}>{WAITLIST_NAMES[w.item] ?? w.item}</span>
                  <span style={{ fontFamily: OUTFIT, fontSize: 13, color: NEU.inkSoft }}>
                    <strong style={{ fontSize: 17, fontWeight: 900, color: NEU.ink, ...NUM }}>{int(w.people)}</strong> {w.people === 1 ? 'person' : 'people'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {days > 1 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
          <Section icon={ShoppingBag} gradient={NEU_GRADIENTS.forest} title="Credits bought per day">
            <DayChart points={creditsByDay} days={days} label="Credits bought" unit="credits" />
          </Section>
          <Section icon={BarChart3} gradient={NEU_GRADIENTS.sage} title="MUNillion plays per day">
            <DayChart points={playsByDay} days={days} label="MUNillion plays" unit="plays" />
          </Section>
        </div>
      )}
    </div>
  );
}
