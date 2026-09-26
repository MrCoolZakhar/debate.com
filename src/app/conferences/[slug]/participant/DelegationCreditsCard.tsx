'use client';

// "Pay for your delegates": the delegation pool a leader (faculty advisor or
// head delegate) funds on the pay page. Credits added here cover the
// applications of that society's delegates, so they never need their own.
// Mounted ONLY for a leader (the pay page gates on leaderApp); a delegate
// never sees pool counts anywhere, and the RPC answers is_leader: false to
// anyone else, in which case this renders nothing.
//
// Reads:  my_delegation_pool(p_society)
// Writes: fund_delegation_pool(p_society, p_quantity)      1..500
//         withdraw_delegation_pool(p_society, p_quantity)  your own unspent only
// Every answer is jsonb with a plain `message` on refusal, shown as returned.
// A short leader (need_credits: N) is sent to the credits pop-up preselected
// at N, and the same quantity is funded again once the purchase completes.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Plus, Users } from 'lucide-react';
import { Emoji3D } from '@/components/neu';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { useCredits, refreshCreditsEverywhere } from '@/hooks/useCredits';
import { openCreditsPopup } from '@/lib/purchasePopup';
import { friendlyError, plainOrFallback, UserFacingError } from '@/lib/friendlyError';
import { SectionCard, OUTFIT } from './shared';

const FUND_MAX = 500;
const MESSAGE_MS = 5000;

interface LeaderPool {
  pool: number;
  mine_unspent: number;
  mine_funded: number;
  balance: number;
  covered_members: number;
}

type PoolAnswer =
  | ({ ok: true; is_leader: true; message?: string } & LeaderPool)
  | { ok: true; is_leader: false; covers?: boolean; mine_unspent?: number; balance?: number }
  | { ok: false; need_credits?: number; balance?: number; message?: string };

function asInt(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback;
}

function leaderPoolOf(a: PoolAnswer): LeaderPool | null {
  if (!a || a.ok !== true || a.is_leader !== true) return null;
  return {
    pool: asInt(a.pool),
    mine_unspent: asInt(a.mine_unspent),
    mine_funded: asInt(a.mine_funded),
    balance: asInt(a.balance),
    covered_members: asInt(a.covered_members),
  };
}

/** The RPC's own `message` when it sent one, shown as returned; else ours. */
function messageOr(a: unknown, fallback: string): string {
  const m = a && typeof a === 'object' && 'message' in a ? (a as { message?: unknown }).message : undefined;
  return typeof m === 'string' && m.length > 0 ? plainOrFallback(m, fallback) : fallback;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

async function authedClient() {
  const client = await getFreshAuthedClient();
  if (!client) throw new UserFacingError('Your session has expired. Refresh the page and sign in again.');
  return client;
}

// ── Stepper ────────────────────────────────────────────────────────────────

function Stepper({
  value, min, max, onChange, disabled, label, compact = false,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  label: string;
  compact?: boolean;
}) {
  const [text, setText] = useState(String(value));
  // Keep the draft in step with a value moved by the buttons or a cap change
  // (adjusted during render, not in an effect).
  const [seenValue, setSeenValue] = useState(value);
  if (seenValue !== value) {
    setSeenValue(value);
    setText(String(value));
  }

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const commitText = () => {
    const n = parseInt(text.replace(/[^0-9]/g, ''), 10);
    const next = Number.isFinite(n) ? clamp(n) : value;
    onChange(next);
    setText(String(next));
  };

  const btn = (kind: 'minus' | 'plus') => {
    const Icon = kind === 'minus' ? Minus : Plus;
    const off = disabled || (kind === 'minus' ? value <= min : value >= max);
    return (
      <button
        type="button"
        aria-label={kind === 'minus' ? `Fewer ${label}` : `More ${label}`}
        disabled={off}
        onClick={() => onChange(clamp(kind === 'minus' ? value - 1 : value + 1))}
        className="flex items-center justify-center flex-shrink-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F3]"
        style={{
          width: 44, height: 44,
          backgroundColor: '#EDE7D8',
          border: '1px solid #DDD4C0',
          color: '#1B3828',
          cursor: off ? 'not-allowed' : 'pointer',
          opacity: off ? 0.45 : 1,
        }}
      >
        <Icon size={18} strokeWidth={2.4} aria-hidden />
      </button>
    );
  };

  return (
    <div className="inline-flex items-center gap-2">
      {btn('minus')}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={label}
        value={text}
        disabled={disabled}
        onChange={e => setText(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
        onBlur={commitText}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitText(); } }}
        className="text-center rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F3]"
        style={{
          width: compact ? 64 : 76, height: 44,
          fontFamily: OUTFIT, fontSize: 17, fontWeight: 800, color: '#1C1410',
          fontVariantNumeric: 'tabular-nums',
          backgroundColor: '#FFFFFF',
          border: '1px solid #DDD4C0',
        }}
      />
      {btn('plus')}
    </div>
  );
}

// ── Card ───────────────────────────────────────────────────────────────────

export default function DelegationCreditsCard({ societyId }: { societyId: string }) {
  const { balance: hookBalance } = useCredits();

  const [pool, setPool] = useState<LeaderPool | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notLeader, setNotLeader] = useState(false);
  // The leader's own balance: the RPC's number, until useCredits reads a
  // newer one (its balance moves after refreshCreditsEverywhere or a purchase).
  const [balanceSnap, setBalanceSnap] = useState<{ rpc: number; hook: number | null } | null>(null);
  const hookBalanceRef = useRef<number | null>(null);
  hookBalanceRef.current = hookBalance;

  const [fundQty, setFundQty] = useState(1);
  const [fundBusy, setFundBusy] = useState(false);
  const [fundOk, setFundOk] = useState<string | null>(null);
  const [fundError, setFundError] = useState<string | null>(null);

  const [backQty, setBackQty] = useState(1);
  const [backBusy, setBackBusy] = useState(false);
  const [backOk, setBackOk] = useState<string | null>(null);
  const [backError, setBackError] = useState<string | null>(null);

  const aliveRef = useRef(true);
  const readSeq = useRef(0);
  const fundBusyRef = useRef(false);
  const backBusyRef = useRef(false);
  // The quantity to fund again once the credits pop-up completes. Consumed
  // exactly once, so a second onComplete (or a reopened pop-up) cannot fund twice.
  const retryQtyRef = useRef<number | null>(null);
  const okTimers = useRef<{ fund?: ReturnType<typeof setTimeout>; back?: ReturnType<typeof setTimeout> }>({});

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (okTimers.current.fund) clearTimeout(okTimers.current.fund);
      if (okTimers.current.back) clearTimeout(okTimers.current.back);
    };
  }, []);

  const noteRpcBalance = useCallback((balance: number) => {
    setBalanceSnap({ rpc: balance, hook: hookBalanceRef.current });
  }, []);

  const applyLeader = useCallback((p: LeaderPool) => {
    setPool(p);
    noteRpcBalance(p.balance);
    setNotLeader(false);
  }, [noteRpcBalance]);

  const readPool = useCallback(async () => {
    const seq = ++readSeq.current;
    setLoading(true);
    setLoadError(null);
    try {
      const client = await authedClient();
      const { data, error } = await client.rpc('my_delegation_pool', { p_society: societyId });
      if (!aliveRef.current || seq !== readSeq.current) return;
      if (error) throw error;
      const answer = data as PoolAnswer;
      const leader = leaderPoolOf(answer);
      if (leader) {
        applyLeader(leader);
      } else if (answer && answer.ok === true) {
        setNotLeader(true);
      } else {
        setLoadError(messageOr(answer,'Your delegation could not be read. Refresh the page to try again.'));
      }
    } catch (e) {
      if (!aliveRef.current || seq !== readSeq.current) return;
      setLoadError(friendlyError(e, 'Your delegation could not be read. Refresh the page to try again.'));
    } finally {
      if (aliveRef.current && seq === readSeq.current) setLoading(false);
    }
  }, [societyId, applyLeader]);

  useEffect(() => { void readPool(); }, [readPool]);

  const flashOk = useCallback((which: 'fund' | 'back', message: string) => {
    const set = which === 'fund' ? setFundOk : setBackOk;
    set(message);
    if (okTimers.current[which]) clearTimeout(okTimers.current[which]);
    okTimers.current[which] = setTimeout(() => { if (aliveRef.current) set(null); }, MESSAGE_MS);
  }, []);

  // The pop-up's onComplete fires later; it calls the latest fund through a ref.
  const fundRef = useRef<((qty: number) => Promise<void>) | null>(null);

  const fund = useCallback(async (qty: number) => {
    if (fundBusyRef.current) return;
    const quantity = Math.min(FUND_MAX, Math.max(1, Math.trunc(qty)));
    fundBusyRef.current = true;
    setFundBusy(true);
    setFundError(null);
    setFundOk(null);
    try {
      const client = await authedClient();
      const { data, error } = await client.rpc('fund_delegation_pool', { p_society: societyId, p_quantity: quantity });
      if (error) throw error;
      if (!aliveRef.current) return;
      const answer = data as PoolAnswer;
      const leader = leaderPoolOf(answer);
      if (leader) {
        applyLeader(leader);
        flashOk('fund', messageOr(answer,`${plural(quantity, 'credit')} added to your delegation`));
        refreshCreditsEverywhere();
        void readPool();
        return;
      }
      if (answer && answer.ok === false && typeof answer.need_credits === 'number' && answer.need_credits > 0) {
        // Short: buy the difference in the pop-up, then fund the same quantity.
        if (typeof answer.balance === 'number') noteRpcBalance(asInt(answer.balance));
        retryQtyRef.current = quantity;
        openCreditsPopup({
          context: 'pay',
          preselect: answer.need_credits,
          onComplete: () => {
            const again = retryQtyRef.current;
            retryQtyRef.current = null;
            if (again === null || !aliveRef.current) return;
            void fundRef.current?.(again);
          },
        });
        return;
      }
      setFundError(messageOr(answer,'Those credits could not be added. Try again in a moment.'));
    } catch (e) {
      if (!aliveRef.current) return;
      setFundError(friendlyError(e, 'Those credits could not be added. Try again in a moment.'));
    } finally {
      fundBusyRef.current = false;
      if (aliveRef.current) setFundBusy(false);
    }
  }, [societyId, applyLeader, noteRpcBalance, flashOk, readPool]);
  fundRef.current = fund;

  const takeBack = useCallback(async (qty: number) => {
    if (backBusyRef.current) return;
    const cap = pool?.mine_unspent ?? 0;
    const quantity = Math.min(cap, Math.max(1, Math.trunc(qty)));
    if (quantity < 1) return;
    backBusyRef.current = true;
    setBackBusy(true);
    setBackError(null);
    setBackOk(null);
    try {
      const client = await authedClient();
      const { data, error } = await client.rpc('withdraw_delegation_pool', { p_society: societyId, p_quantity: quantity });
      if (error) throw error;
      if (!aliveRef.current) return;
      const answer = data as PoolAnswer;
      const leader = leaderPoolOf(answer);
      if (leader) {
        applyLeader(leader);
        flashOk('back', messageOr(answer,`${plural(quantity, 'credit')} are back in your account`));
        refreshCreditsEverywhere();
        void readPool();
        return;
      }
      setBackError(messageOr(answer,'Those credits could not be taken back. Try again in a moment.'));
    } catch (e) {
      if (!aliveRef.current) return;
      setBackError(friendlyError(e, 'Those credits could not be taken back. Try again in a moment.'));
    } finally {
      backBusyRef.current = false;
      if (aliveRef.current) setBackBusy(false);
    }
  }, [societyId, pool?.mine_unspent, applyLeader, flashOk, readPool]);

  // The take-back quantity is kept inside what is actually unspent.
  const unspent = pool?.mine_unspent ?? 0;
  const backQtyShown = Math.min(Math.max(1, unspent), Math.max(1, backQty));

  if (notLeader) return null;

  const eyebrow = (
    <p style={{ fontFamily: OUTFIT, fontWeight: 700, fontSize: 9, letterSpacing: '0.14em', color: '#B6871F', margin: 0 }}>
      PAY FOR YOUR DELEGATES
    </p>
  );

  if (loading && !pool) {
    return (
      <SectionCard>
        {eyebrow}
        <p className="mt-3" style={{ fontFamily: OUTFIT, fontSize: 13, color: '#5A5046', margin: '12px 0 0 0' }} aria-live="polite">
          Reading your delegation
        </p>
      </SectionCard>
    );
  }

  if (!pool) {
    return (
      <SectionCard>
        {eyebrow}
        <p role="alert" style={{ fontFamily: OUTFIT, fontSize: 13, color: '#8B2020', margin: '12px 0 12px 0', lineHeight: 1.5 }}>
          {loadError ?? 'Your delegation could not be read. Refresh the page to try again.'}
        </p>
        <button
          type="button"
          onClick={() => { void readPool(); }}
          className="rounded-xl px-4 font-bold text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F3]"
          style={{ height: 44, backgroundColor: '#FFFFFF', border: '1.5px solid #1C1410', color: '#1C1410', fontFamily: OUTFIT, cursor: 'pointer' }}
        >
          Try again
        </button>
      </SectionCard>
    );
  }

  const shownBalance = balanceSnap
    ? (hookBalance !== null && hookBalance !== balanceSnap.hook ? hookBalance : balanceSnap.rpc)
    : pool.balance;

  return (
    <SectionCard>
      <div className="flex items-start justify-between gap-3">
        {eyebrow}
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EDE7D8' }}
          aria-hidden
        >
          <Emoji3D name="Busts in silhouette" size={24} fallback={Users} fallbackColor="#1B3828" />
        </div>
      </div>

      {/* The pool */}
      <p style={{ fontFamily: OUTFIT, fontSize: 40, fontWeight: 900, color: '#1B3828', margin: '4px 0 0 0', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
        {pool.pool}
      </p>
      <p style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: '#5A5046', margin: '4px 0 0 0' }}>
        {pool.pool === 1 ? 'credit' : 'credits'} in your delegation
      </p>

      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
        <div>
          <p style={{ fontFamily: OUTFIT, fontSize: 18, fontWeight: 800, color: '#1C1410', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            {pool.covered_members}
          </p>
          <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#5A5046', margin: 0 }}>
            {pool.covered_members === 1 ? 'delegate covered so far' : 'delegates covered so far'}
          </p>
        </div>
        <div>
          <p style={{ fontFamily: OUTFIT, fontSize: 18, fontWeight: 800, color: '#1C1410', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            {shownBalance}
          </p>
          <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#5A5046', margin: 0 }}>
            {shownBalance === 1 ? 'credit in your own account' : 'credits in your own account'}
          </p>
        </div>
      </div>

      <p style={{ fontFamily: OUTFIT, fontSize: 13, color: '#5A5046', margin: '16px 0 0 0', lineHeight: 1.55 }}>
        Credits you add here cover your delegates&rsquo; applications, so they never need their own
      </p>

      {/* Add to the pool */}
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <Stepper
          value={fundQty}
          min={1}
          max={FUND_MAX}
          onChange={setFundQty}
          disabled={fundBusy}
          label="credits to add"
        />
        <button
          type="button"
          disabled={fundBusy}
          aria-busy={fundBusy}
          onClick={() => { void fund(fundQty); }}
          className="flex-1 flex items-center justify-center rounded-xl px-5 font-bold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F3]"
          style={{
            minWidth: 200, height: 44,
            backgroundColor: fundBusy ? '#2A5A3C' : '#1B3828',
            color: '#EED98A',
            fontFamily: OUTFIT, border: 'none',
            cursor: fundBusy ? 'wait' : 'pointer',
            opacity: fundBusy ? 0.85 : 1,
          }}
          onMouseEnter={e => { if (!fundBusy) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
          onMouseLeave={e => { if (!fundBusy) (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
        >
          {fundBusy ? 'Adding' : 'Add to delegation'}
        </button>
      </div>
      {fundOk && (
        <p role="status" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: '#2A5A3C', margin: '10px 0 0 0' }}>
          {fundOk}
        </p>
      )}
      {fundError && (
        <p role="alert" style={{ fontFamily: OUTFIT, fontSize: 13, color: '#8B2020', margin: '10px 0 0 0', lineHeight: 1.5 }}>
          {fundError}
        </p>
      )}

      {/* Take back your own unspent contribution */}
      {unspent > 0 && (
        <div className="mt-5 pt-5" style={{ borderTop: '1px solid #DDD4C0' }}>
          <p style={{ fontFamily: OUTFIT, fontSize: 12, color: '#5A5046', margin: '0 0 10px 0' }}>
            {plural(unspent, 'credit')} you added {unspent === 1 ? 'is' : 'are'} still unspent
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Stepper
              value={backQtyShown}
              min={1}
              max={unspent}
              onChange={setBackQty}
              disabled={backBusy}
              label="credits to take back"
              compact
            />
            <button
              type="button"
              disabled={backBusy}
              aria-busy={backBusy}
              onClick={() => { void takeBack(backQtyShown); }}
              className="flex items-center justify-center rounded-xl px-5 font-bold text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F3]"
              style={{
                height: 44,
                backgroundColor: '#FFFFFF',
                border: '1.5px solid #1C1410',
                color: '#1C1410',
                fontFamily: OUTFIT,
                cursor: backBusy ? 'wait' : 'pointer',
                opacity: backBusy ? 0.7 : 1,
              }}
              onMouseEnter={e => { if (!backBusy) (e.currentTarget as HTMLElement).style.backgroundColor = '#EDE7D8'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#FFFFFF'; }}
            >
              {backBusy ? 'Taking back' : 'Take back'}
            </button>
          </div>
          {backOk && (
            <p role="status" style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: '#2A5A3C', margin: '10px 0 0 0' }}>
              {backOk}
            </p>
          )}
          {backError && (
            <p role="alert" style={{ fontFamily: OUTFIT, fontSize: 13, color: '#8B2020', margin: '10px 0 0 0', lineHeight: 1.5 }}>
              {backError}
            </p>
          )}
        </div>
      )}
    </SectionCard>
  );
}
