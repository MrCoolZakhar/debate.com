'use client';

// "Your email packs" under the Emails card's meter (25 Sep 2026):
// email_packs(p_conf), newest first. Each row: the pack ("500 emails" or
// "Unlimited"), its credits, the date and who bought it. An unused pack
// (refundable) can be taken back with refund_email_pack: the credits return
// to Conference credits, to whoever paid them. A taken-back pack says so.

import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from '@/lib/friendlyError';
import { notifyOk } from '@/lib/appNotify';
import { OUTFIT } from '@/components/neu';
import { authedClient, messageOf, type StoreAnswer } from './storeApi';
import { DANGER, INK, INK_SOFT } from './storeKit';

interface EmailPack {
  id: string;
  pack: string;
  credits: number;
  bought_at: string;
  bought_by: string | null;
  refunded_at: string | null;
  refundable: boolean;
}

function packLabel(pack: string): string {
  if (pack === 'unlimited') return 'Unlimited';
  const n = parseInt(pack, 10);
  return Number.isFinite(n) ? `${n.toLocaleString('en-US')} emails` : pack;
}

export default function EmailPacks({ conferenceId, refreshKey, onChanged }: {
  conferenceId: string;
  /** Bumped by the page after a purchase, so a new pack shows at once. */
  refreshKey: number;
  /** A pack was taken back: re-read the Store and the allowance. */
  onChanged: (a: StoreAnswer) => void;
}) {
  const [packs, setPacks] = useState<EmailPack[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<{ id: string; text: string } | null>(null);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const client = await authedClient();
      const { data, error } = await client.rpc('email_packs', { p_conf: conferenceId });
      if (error) throw error;
      setPacks(Array.isArray(data) ? (data as EmailPack[]) : []);
    } catch {
      setPacks([]);
    }
  }, [conferenceId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  async function takeBack(id: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(id);
    setErr(null);
    try {
      const client = await authedClient();
      const { data, error } = await client.rpc('refund_email_pack', { p_conf: conferenceId, p_ledger_id: id });
      if (error) throw error;
      const a = (data ?? {}) as StoreAnswer;
      if (a.ok !== true) {
        setErr({ id, text: messageOf(a, 'This pack could not be taken back.') });
        return;
      }
      notifyOk(messageOf(a, 'The credits are back in Conference credits.'), 'store');
      setConfirmId(null);
      await load();
      onChanged(a);
    } catch (e) {
      setErr({ id, text: friendlyError(e, 'This pack could not be taken back.') });
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  }

  if (!packs || packs.length === 0) return null;

  return (
    <div className="mb-4">
      <p style={{ margin: '0 0 6px', fontFamily: OUTFIT, fontSize: 12, fontWeight: 700, color: INK_SOFT }}>Your email packs</p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {packs.map(p => (
          <li key={p.id} style={{ fontFamily: OUTFIT, fontSize: 13, color: INK, borderRadius: 10, background: '#FAF8F3', padding: '8px 10px' }}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span style={{ fontWeight: 700 }}>
                {packLabel(p.pack)} <span style={{ fontWeight: 500, color: INK_SOFT }}>· {p.credits} {p.credits === 1 ? 'credit' : 'credits'}</span>
              </span>
              <span style={{ fontSize: 12, color: INK_SOFT }}>
                {new Date(p.bought_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                {p.bought_by ? ` · ${p.bought_by}` : ''}
              </span>
            </div>
            {p.refunded_at ? (
              <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 600, color: INK_SOFT }}>Taken back</p>
            ) : p.refundable ? (
              confirmId === p.id ? (
                <div className="mt-2">
                  <p style={{ margin: '0 0 6px', fontSize: 12.5, color: INK }}>Take back this pack? The credits return to Conference credits.</p>
                  <div className="flex gap-2">
                    <button type="button" className="gv-st-btn gv-st-outline" style={{ minHeight: 34, padding: '0 12px', fontSize: 12.5 }} disabled={busyId === p.id} onClick={() => { void takeBack(p.id); }}>
                      {busyId === p.id ? 'Taking back…' : 'Take back'}
                    </button>
                    <button type="button" className="gv-st-link" style={{ fontSize: 12.5 }} onClick={() => setConfirmId(null)}>Keep it</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="gv-st-link" style={{ marginTop: 4, fontSize: 12.5, color: INK_SOFT }} onClick={() => { setConfirmId(p.id); setErr(null); }}>
                  Take back
                </button>
              )
            ) : null}
            {err?.id === p.id ? <p className="gv-st-err" role="alert" style={{ color: DANGER }}>{err.text}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
