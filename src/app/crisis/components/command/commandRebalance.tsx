'use client';
// Gavelling Crisis: the one plain line at the very bottom of Crisis Command that suggests a rebalance, for example
// "Marco has 11 open. Move the 2 oldest to Peter Zakhar?". It shows only when the load is uneven, and its button does the move
// through crisis_assign_directive. It takes one line of the page, so the dashboard stays on one screen.

import { useMemo, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { assignDirective, crisisError, type CrisisRef } from '@/lib/crisis/api';
import type { Directive, Member } from '@/lib/crisis/types';
import { Btn, CK } from '../../crisisKit';
import { staffLoads, suggestRebalance } from './commandData';

export default function RebalanceLine({ cref, members, directives, onChanged }: {
  cref: CrisisRef; members: Member[]; directives: Directive[] | null; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const tip = useMemo(() => (directives ? suggestRebalance(staffLoads(members, directives)) : null), [members, directives]);
  if (!tip) return null;

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
    <div className="cmd-rebalance flex items-center flex-wrap" style={{ gap: '4px 10px', flex: 'none', marginTop: 8, fontSize: 13, color: CK.ink }}>
      <Lightbulb size={15} strokeWidth={1.5} aria-hidden style={{ flex: 'none', color: CK.goldDeep }} />
      <span style={{ overflowWrap: 'anywhere', minWidth: 0 }}>
        {from} has {tip.from.open.length} open. Move the {n === 1 ? 'oldest' : `${n} oldest`} to {to}?
      </span>
      <Btn size="sm" tone="green" onClick={move} disabled={busy}>{busy ? 'Moving' : `Move ${n === 1 ? 'it' : n} to ${to}`}</Btn>
    </div>
  );
}
