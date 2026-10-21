'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Gavelling staff → Live committees → one room (owner, 21 Oct 2026: "clicking a
// room opens the same live status the organiser gets").
//
// Not a rebuild: this is the organiser's own recap (manage/[slug]/live
// RecapModal: the floor, stat tiles, Documents, Scoreboard, History,
// Attendance, Awards) fed a LiveCommittee built for this one room by
// ./liveRoomLoader. Read only: "Join as secretariat" is hidden, and Awards is
// hidden on a standalone room (awards are a conference feature).
//
// ONE pop-up at a time. Broadcast and "Open this scoreboard on its own" REPLACE
// the recap (the organiser page's hand-off), and closing them brings the recap
// back, so a pop-up never opens on top of another.
//
// Broadcast: conference rooms work today (platform admins pass
// is_conference_organizer). A standalone room has no conference and the insert
// policy on session_broadcasts requires one, so its tab is drawn disabled until
// ADMIN_STANDALONE_BROADCAST_DB is switched on after
// scratch-admin-live-rooms.sql is applied.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Loader from '@/components/Loader';
import { NEU, OUTFIT } from '@/components/neu';
import { getAwardsConfig } from '@/lib/awards';
import { RecapModal, ModalShell } from '@/app/manage/[slug]/live/LiveModals';
import { FloorDetail } from '@/app/manage/[slug]/live/PhaseVariants';
import { BroadcastComposer, broadcastTargets } from '@/app/manage/[slug]/live/BroadcastComposer';
import { CommitteeScoreboardModal } from '@/app/manage/[slug]/live/CommitteeScoreboardModal';
import { SOFT } from '@/app/manage/[slug]/live/tokens';
import { loadAdminRoom, type AdminRoom } from './liveRoomLoader';

/** Flip to true only once scratch-admin-live-rooms.sql (the platform-admin
 *  INSERT policy on session_broadcasts) is live. */
export const ADMIN_STANDALONE_BROADCAST_DB = false;

const REFRESH_MS = 15_000;

type Mode = 'recap' | 'broadcast' | 'scoreboard';

export default function LiveRoomView({ sessionId, conferenceId, nowPlaying, onClose }: {
  sessionId: string;
  conferenceId: string | null;
  /** The board's own NOW PLAYING panel for this room (speaker, clocks, up next),
   *  drawn above the organiser's phase detail on the Overview tab. */
  nowPlaying: React.ReactNode;
  onClose: () => void;
}) {
  const { session: authSession } = useAuth();
  const [room, setRoom] = useState<AdminRoom | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<Mode>('recap');
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    inFlight.current = true;
    try {
      const next = await loadAdminRoom(sessionId, conferenceId);
      setRoom(next);
      setFailed(false);
    } catch {
      // Keep the last good snapshot; only a first load reports.
      setFailed(true);
    } finally {
      inFlight.current = false;
    }
  }, [sessionId, conferenceId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => { void load(); }, REFRESH_MS);
    const onVis = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  if (!room) {
    return (
      <ModalShell onClose={onClose} label="Live room">
        <div className="flex flex-col items-center gap-3 py-10" style={{ fontFamily: OUTFIT }}>
          {failed ? (
            <>
              <p className="font-black" style={{ color: NEU.ink, fontSize: 15 }}>Could not load this room</p>
              <p style={{ color: SOFT, fontSize: 13 }}>Try again in a moment.</p>
            </>
          ) : (
            <>
              <Loader size={26} />
              <p style={{ color: SOFT, fontSize: 12.5 }}>Reading the room…</p>
            </>
          )}
        </div>
      </ModalShell>
    );
  }

  const { data, conference } = room;
  const standalone = !conferenceId;
  const targets = broadcastTargets([data]);
  const canAddress = targets.length > 0;
  const broadcastReady = canAddress && (!standalone || ADMIN_STANDALONE_BROADCAST_DB) && (standalone || !!conference);

  if (mode === 'broadcast' && broadcastReady) {
    return (
      <BroadcastComposer
        conferenceId={standalone ? null : conference!.id}
        conferenceLabel={standalone ? 'Standalone session' : conference!.label}
        createdBy={authSession?.user?.id ?? null}
        targets={targets}
        onClose={() => setMode('recap')}
        onSent={() => setMode('recap')}
      />
    );
  }

  if (mode === 'scoreboard') {
    return <CommitteeScoreboardModal data={data} onClose={() => setMode('recap')} />;
  }

  return (
    <RecapModal
      data={data}
      conferenceSlug={conference?.slug ?? ''}
      awardsConfig={getAwardsConfig(conference?.awardsConfig ?? null)}
      awardsPublishedAt={conference?.awardsPublishedAt ?? null}
      conferenceEndDate={conference?.endDate ?? null}
      showAwards={!standalone && !!conference}
      showJoin={false}
      onClose={onClose}
      floorDetail={(
        <>
          <div className="mb-5">{nowPlaying}</div>
          <FloorDetail data={data} />
        </>
      )}
      onOpenScoreboard={() => setMode('scoreboard')}
      onBroadcast={broadcastReady ? () => setMode('broadcast') : null}
      broadcastBlockedTitle={canAddress && !broadcastReady ? 'Waiting for the database change' : null}
    />
  );
}
