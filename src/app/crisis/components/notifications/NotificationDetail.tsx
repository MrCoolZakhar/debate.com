'use client';
// Gavelling Crisis: what a map notification is about. For a troop move, a reveal or new territory it reads the
// history row the notification came from (crisis_history, newest row up to the notification's time) and shows
// the same still-map pop-up as the History page: where it was, where it is, what changed, then "Open the map".
// If the row cannot be found (an older notification, or the change is no longer visible) it says what the
// notification said and still offers the map.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Map as MapIcon } from 'lucide-react';
import type { CrisisNotification } from '@/lib/crisis/types';
import { crisisHistory, parseChange, type HistoryChange } from '@/lib/crisis/history';
import { timeAgo } from '@/lib/crisis/format';
import { Btn, CK, Skeleton } from '../../crisisKit';
import { crisisBase, useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import CrisisDialog from '../delegate/CrisisDialog';
import { ChangeBody, changeHeading } from '../history/ChangeDialog';
import { useChangeCtx } from '../history/changeKit';

/** The notification kinds that show a picture. */
export const MAP_KINDS: ReadonlyArray<CrisisNotification['kind']> = ['unit', 'reveal', 'territory'];
export const hasMapDetail = (n: CrisisNotification) => MAP_KINDS.includes(n.kind) && !!(n.ref_key || n.ref_id);

export default function NotificationDetail({ n, kindLabel, onClose }: { n: CrisisNotification; kindLabel: string; onClose: () => void }) {
  const { ref } = useCrisis();
  const router = useRouter();
  const ctx = useChangeCtx();
  // A tagged result: the loading state is "the result belongs to another notification", so no effect sets state synchronously.
  const [res, setRes] = useState<{ id: string; change: HistoryChange | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = n.ref_key ?? n.ref_id;
    crisisHistory(ref, { ref: key, until: n.created_at, limit: 5 })
      .then((rows) => {
        if (cancelled) return;
        const change = rows.map(parseChange).find((c): c is HistoryChange => !!c) ?? null;
        setRes({ id: n.id, change });
      })
      .catch(() => { if (!cancelled) setRes({ id: n.id, change: null }); });
    return () => { cancelled = true; };
  }, [ref, n.id, n.ref_key, n.ref_id, n.created_at]);

  const ready = res && res.id === n.id ? res : null;
  const reveal = n.kind === 'reveal';
  const heading = useMemo(() => (ready?.change ? changeHeading(ready.change, ctx, reveal) : null), [ready, ctx, reveal]);
  const openMap = () => { onClose(); router.push(`${crisisBase(ref)}/map`); };

  return (
    <CrisisDialog title={heading?.title ?? n.title} eyebrow={kindLabel} onClose={onClose} width={660}>
      {!ready ? (
        <div className="flex flex-col" style={{ gap: 12 }}><Skeleton h={300} r={18} /><Skeleton h={22} w={260} /><Skeleton h={18} w={180} /></div>
      ) : ready.change ? (
        <ChangeBody change={ready.change} reveal={reveal} onClose={onClose} ctx={ctx} />
      ) : (
        <div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{n.title}</p>
          {n.body && <p style={{ margin: '6px 0 0', fontSize: 14, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{n.body}</p>}
          <p style={{ margin: '6px 0 0', fontSize: 12.5, fontWeight: 600, color: CK.muted }}>{timeAgo(n.created_at)}</p>
          <div className="flex flex-wrap" style={{ gap: 8, marginTop: 18 }}>
            <Btn tone="red" icon={<MapIcon size={16} strokeWidth={1.6} aria-hidden />} onClick={openMap}>Open the map</Btn>
            <Btn tone="ghost" onClick={onClose}>Close</Btn>
          </div>
        </div>
      )}
    </CrisisDialog>
  );
}
