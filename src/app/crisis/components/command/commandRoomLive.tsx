'use client';
// Gavelling Crisis: the semi-live dashboard inside a Front Rooms card.
//
// It REUSES the organiser's Live Status model instead of re-deriving a room:
//   loadAdminRoom (src/app/admin/liveRoomLoader.ts)   builds the organiser's LiveCommittee for one session id (anon reads of the
//                                                     committee, speaker, delegates, lists, documents and ledger);
//   roomStatus / STATUS_META / nowPlaying / cardFacts / cardWarnings (manage/[slug]/live/cardModel.ts)
//                                                     the status word, the "now playing" panel (stage, speaker, caucus or speech
//                                                     clock derived from the persisted anchors, up next), the roll and papers, warnings;
//   useNowTick (manage/[slug]/live/PhaseVariants.tsx)  the one shared 1 s clock, so countdowns move without any write.
// Read only. The room is re-read every 20 s while the tab is visible, like the organiser's live page.

import { useEffect, useState } from 'react';
import { AlertTriangle, Users } from 'lucide-react';
import { loadAdminRoom } from '@/app/admin/liveRoomLoader';
import type { LiveCommittee } from '@/app/manage/[slug]/live/LiveModals';
import { AMBER_INK, GREEN_INK, SOFT, STATUS_META, cardFacts, cardWarnings, nowPlaying, roomStatus, type NowPlaying } from '@/app/manage/[slug]/live/cardModel';
import { useNowTick } from '@/app/manage/[slug]/live/PhaseVariants';
import { cabinetTint, CK, Skeleton } from '../../crisisKit';

const REFRESH_MS = 20_000;

/** Reads one room through the organiser model, every 20 s while the tab is visible. A failed re-read keeps what is on screen. */
function useRoomModel(sessionId: string): { data: LiveCommittee | null; failed: boolean } {
  const [data, setData] = useState<LiveCommittee | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    const load = async () => {
      if (inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        const room = await loadAdminRoom(sessionId, null);
        if (alive) { setData(room.data); setFailed(false); }
      } catch {
        if (alive) setFailed(true);
      } finally {
        inFlight = false;
      }
    };
    const first = window.setTimeout(() => { void load(); }, 0);
    const poll = window.setInterval(() => { void load(); }, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; window.clearTimeout(first); window.clearInterval(poll); document.removeEventListener('visibilitychange', onVisible); };
  }, [sessionId]);

  return { data, failed };
}

const toneInk = (t: NowPlaying['tone']) => (t === 'live' ? GREEN_INK : t === 'warn' ? AMBER_INK : SOFT);

/** The room's live status in two short lines: status word and who is present, then who has the floor (or "Not started"). */
export default function RoomLivePanel({ sessionId }: { sessionId: string }) {
  const { data, failed } = useRoomModel(sessionId);
  const now = useNowTick(true);

  if (!data) {
    return failed
      ? <p style={{ margin: 0, fontSize: 12.5, color: CK.inkSoft }}>Could not read this room. Trying again.</p>
      : <Skeleton h={34} w="70%" />;
  }

  const status = roomStatus(data, now);
  const meta = STATUS_META[status];
  const np = nowPlaying(data, now);
  const facts = cardFacts(data);
  const warning = cardWarnings(data, now)[0];
  const ink = toneInk(np.tone);
  const started = status !== 'not-started';

  return (
    <div className="flex flex-col" style={{ gap: 3 }}>
      <div className="flex items-center flex-wrap" style={{ gap: '2px 12px', fontSize: 12.5, color: CK.inkSoft }}>
        <span className="inline-flex items-center" style={{ gap: 6, fontWeight: 800, color: meta.ink }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, boxShadow: `0 0 0 3px ${cabinetTint(meta.color, 0.22)}`, flex: 'none' }} />
          {meta.label}
        </span>
        <span className="inline-flex items-center" style={{ gap: 5, fontVariantNumeric: 'tabular-nums' }}>
          <Users size={13} strokeWidth={1.5} aria-hidden /><b style={{ color: CK.ink }}>{facts.present}</b> of {facts.total} present
        </span>
      </div>
      <p className="flex items-baseline justify-between" style={{ margin: 0, gap: 8, fontSize: 12.5, color: CK.inkSoft }}>
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {started ? <><span style={{ color: ink, fontWeight: 700 }}>{np.context}</span> <b style={{ color: np.dim ? SOFT : CK.ink }}>{np.headline}</b></> : 'Not started'}
        </span>
        {started && <b style={{ flex: 'none', fontVariantNumeric: 'tabular-nums', color: ink }}>{np.right}</b>}
      </p>
      {warning && (
        <p className="flex items-start" style={{ margin: 0, gap: 6, fontSize: 12, fontWeight: 600, color: warning.tone === 'red' ? CK.danger : AMBER_INK }}>
          <AlertTriangle size={13} strokeWidth={1.5} aria-hidden style={{ flex: 'none', marginTop: 2 }} />
          <span style={{ overflowWrap: 'anywhere' }}>{warning.text}</span>
        </p>
      )}
    </div>
  );
}
