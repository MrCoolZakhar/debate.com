'use client';
// Gavelling Crisis: the pop-up for one map change, opened from a notification or a history row.
// A still map picture (where it was, where it is, an arrow between), what changed in plain lines, the time,
// for staff who made it, and "Open the map". `reveal` shows a unit as it stands now (a "Revealed" notification).
// A pop-up never opens another: "Open the map" leaves the page.

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Map as MapIcon } from 'lucide-react';
import type { HistoryChange } from '@/lib/crisis/history';
import { timeAgo } from '@/lib/crisis/format';
import { Btn, CK } from '../../crisisKit';
import { crisisBase, useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import CrisisDialog from '../delegate/CrisisDialog';
import MapSnapshot from './MapSnapshot';
import { ChangeDisc, PieceLine, describe, snapshotSpec, useChangeCtx, type ChangeCtx } from './changeKit';

/** Titles for a change pop-up (the notification pop-up uses it too, so the header does not jump when the data arrives). */
export function changeHeading(change: HistoryChange, ctx: ChangeCtx, reveal?: boolean): { title: string; eyebrow: string } {
  const d = describe(change, ctx);
  return { title: reveal && change.type === 'unit' ? `Revealed: ${change.name}` : d.title, eyebrow: reveal ? 'Revealed' : d.kindLabel };
}

export function ChangeBody({ change, reveal, onClose, ctx }: { change: HistoryChange; reveal?: boolean; onClose: () => void; ctx: ChangeCtx }) {
  const { ref, staff } = useCrisis();
  const router = useRouter();
  const d = useMemo(() => describe(change, ctx), [change, ctx]);
  const spec = useMemo(() => snapshotSpec(change, ctx, { reveal }), [change, ctx, reveal]);
  const title = changeHeading(change, ctx, reveal).title;
  const at = new Date(change.at);

  return (
    <div>
      <MapSnapshot world={ctx.world} spec={spec} label={title} />
      <div className="flex items-start" style={{ gap: 12, marginTop: 14 }}>
        {reveal ? (
          <span className="flex-shrink-0 grid place-items-center" aria-hidden style={{ width: 38, height: 38, borderRadius: '50%', background: '#5B4A8A', color: '#fff', boxShadow: CK.shadowSm }}><Eye size={19} strokeWidth={1.6} /></span>
        ) : <ChangeDisc d={d} />}
        <div className="min-w-0 flex-1">
          {(reveal || d.lines.length === 0) && <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{reveal ? 'Now on your map' : d.title}</p>}
          {(reveal ? [] : d.lines).map((l, i) => (
            <p key={i} style={{ margin: i ? '4px 0 0' : 0, fontSize: 15 }}><PieceLine pieces={l} ctx={ctx} /></p>
          ))}
          <p style={{ margin: '6px 0 0', fontSize: 12.5, fontWeight: 600, color: CK.muted }} title={at.toLocaleString()}>
            {timeAgo(change.at)}
            {staff && change.by && <> · by <b style={{ color: CK.inkSoft }}>{change.by}</b></>}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap" style={{ gap: 8, marginTop: 18 }}>
        <Btn tone="red" icon={<MapIcon size={16} strokeWidth={1.6} aria-hidden />} onClick={() => { onClose(); router.push(`${crisisBase(ref)}/map`); }}>Open the map</Btn>
        <Btn tone="ghost" onClick={onClose}>Close</Btn>
      </div>
    </div>
  );
}

export default function ChangeDialog({ change, eyebrow, reveal, onClose }: { change: HistoryChange; eyebrow?: string; reveal?: boolean; onClose: () => void }) {
  const ctx = useChangeCtx();
  const h = changeHeading(change, ctx, reveal);
  return (
    <CrisisDialog title={h.title} eyebrow={eyebrow ?? h.eyebrow} onClose={onClose} width={660}>
      <ChangeBody change={change} reveal={reveal} onClose={onClose} ctx={ctx} />
    </CrisisDialog>
  );
}
