'use client';
// Gavelling Crisis: the backroom rebalance suggestion, for example "Marco has 10 open. Move the 5 oldest to Peter Zakhar?".
// It is one row of the Needs Attention card on Crisis Command and appears only when the load is uneven. Its button does
// the move through crisis_assign_directive. Directives someone is writing a reply to are not load and are never moved.

import { useMemo, useState } from 'react';
import { Scale } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { assignDirective, crisisError, type CrisisRef } from '@/lib/crisis/api';
import type { Directive, Member } from '@/lib/crisis/types';
import { Avatar, Btn, CK } from '../../crisisKit';
import { staffLoads, suggestRebalance } from './commandData';

export type RebalanceTip = NonNullable<ReturnType<typeof suggestRebalance>>;

/** The current suggestion, or null when the backroom is balanced (or directives are still loading). */
export function useRebalanceTip(members: Member[], directives: Directive[] | null, now: number): RebalanceTip | null {
  return useMemo(() => (directives ? suggestRebalance(staffLoads(members, directives, now)) : null), [members, directives, now]);
}

export function RebalanceRow({ cref, tip, onChanged }: { cref: CrisisRef; tip: RebalanceTip; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const n = tip.move.length;
  const from = tip.from.member.display_name;
  const to = tip.to.member.display_name;

  const move = async () => {
    if (busy) return;
    setBusy(true);
    let moved = 0;
    try {
      for (const d of tip.move) { await assignDirective(cref, d.id, tip.to.member.id); moved += 1; }
      notifyOk(`Moved ${moved} ${moved === 1 ? 'directive' : 'directives'} to ${to}`, 'crisis-command');
    } catch (e) {
      notifyErr(crisisError(e, moved ? `Moved ${moved}, then could not move the rest.` : 'Could not move those directives.'), 'crisis-command');
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  return (
    <div className="flex items-center" style={{ gap: 10, padding: '8px 0' }}>
      <span aria-hidden style={{ width: 30, height: 30, flex: 'none', display: 'grid', placeItems: 'center', color: CK.goldDeep, background: 'rgba(182,135,31,0.14)', borderRadius: 10 }}>
        <Scale size={17} strokeWidth={1.5} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, color: CK.ink, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
          <b>{from}</b> has {tip.from.open.length} open. Move the {n === 1 ? 'oldest' : `${n} oldest`} to <b>{to}</b>?
        </p>
        <div className="flex items-center" style={{ gap: 8, marginTop: 6 }}>
          <Avatar name={from} src={tip.from.member.picture_url} size={22} color={CK.forest2} />
          <span aria-hidden style={{ color: CK.inkSoft, fontSize: 12 }}>to</span>
          <Avatar name={to} src={tip.to.member.picture_url} size={22} color={CK.forest2} />
          <Btn size="sm" tone="green" onClick={move} disabled={busy} style={{ marginLeft: 'auto' }}>{busy ? 'Moving' : `Move ${n === 1 ? 'it' : n} to ${to}`}</Btn>
        </div>
      </div>
    </div>
  );
}
