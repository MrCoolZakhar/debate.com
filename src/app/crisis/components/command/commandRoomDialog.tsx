'use client';
// Gavelling Crisis: the pop-up a Front Rooms tile opens. It is the organiser's live status for that room (the recap with
// Overview, Cabinet Directives, Crisis News, Scoreboard, History and Attendance; commandRecap.tsx), read only, fed by the same
// loader the staff board uses (src/app/admin/liveRoomLoader.ts). Join as chair and Watch only sit at the top of the Overview.
// One pop-up at a time: the scoreboard, a directive or a story REPLACES the recap, and closing it brings the recap back on the
// tab it was opened from. Directives and news are read live (the same lists the chair's Front Room shows).

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Gavel } from 'lucide-react';
import Loader from '@/components/Loader';
import { NEU, OUTFIT } from '@/components/neu';
import { loadAdminRoom, type AdminRoom } from '@/app/admin/liveRoomLoader';
import { ModalShell } from '@/app/manage/[slug]/live/LiveModals';
import { FloorDetail } from '@/app/manage/[slug]/live/PhaseVariants';
import { CommitteeScoreboardModal } from '@/app/manage/[slug]/live/CommitteeScoreboardModal';
import { SOFT } from '@/app/manage/[slug]/live/tokens';
import { listDirectives } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Cabinet, Directive } from '@/lib/crisis/types';
import { CK } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import DirectivePopup from '../directives/DirectivePopup';
import NewsDetailDialog from '../news/NewsDetailDialog';
import { useCrisisNews } from '../news/useCrisisNews';
import CrisisRecap, { type CrisisRecapTab } from './commandRecap';
import { cabinetDirectivesOf } from './cabinetFeeds';
import type { RoomState } from './commandData';
import { LinkBtn } from './commandParts';
import { RoomStagePanel } from './commandRoomLive';

const REFRESH_MS = 15_000;

export default function CommandRoomDialog({ cab, room, conferenceId, onClose }: {
  cab: Cabinet; room: RoomState; conferenceId: string; onClose: () => void;
}) {
  const sessionId = room.sessionId;
  const [full, setFull] = useState<AdminRoom | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<'recap' | 'scoreboard'>('recap');
  const [tab, setTab] = useState<CrisisRecapTab>('overview');
  // A directive or a story opened from the lists: it replaces the recap until closed.
  const [openDirective, setOpenDirective] = useState<string | null>(null);
  const [openNews, setOpenNews] = useState<string | null>(null);
  const inFlight = useRef(false);

  const { ref } = useCrisis();
  const { items: news } = useCrisisNews(ref);
  const [directives, setDirectives] = useState<Directive[] | null>(null);
  const dseq = useRef(0);
  const readDirectives = useCallback(async () => {
    const mine = ++dseq.current;
    try { const d = await listDirectives(ref); if (mine === dseq.current) setDirectives(d); } catch { /* keep what is on screen */ }
  }, [ref]);
  useEffect(() => {
    const t = window.setTimeout(() => { void readDirectives(); }, 0);
    return () => window.clearTimeout(t);
  }, [readDirectives]);
  useCrisisLive(ref.id, ['crisis_directives'], () => { void readDirectives(); });

  const load = useCallback(async () => {
    if (!sessionId || inFlight.current || document.visibilityState !== 'visible') return;
    inFlight.current = true;
    try {
      setFull(await loadAdminRoom(sessionId, conferenceId));
      setFailed(false);
    } catch {
      // Keep the last good snapshot; only a first load reports.
      setFailed(true);
    } finally { inFlight.current = false; }
  }, [sessionId, conferenceId]);

  useEffect(() => {
    const first = window.setTimeout(() => { void load(); }, 0);
    const poll = window.setInterval(() => { void load(); }, REFRESH_MS);
    const onVis = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.clearTimeout(first); window.clearInterval(poll); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  if (!full) {
    return (
      <ModalShell onClose={onClose} label={`${cab.name} committee room`}>
        <div className="flex flex-col items-center gap-3 py-10" style={{ fontFamily: OUTFIT }}>
          {failed ? (
            <>
              <p className="font-black" style={{ color: NEU.ink, fontSize: 15 }}>Could not load this room</p>
              <p style={{ color: SOFT, fontSize: 13 }}>Try again in a moment.</p>
            </>
          ) : (
            <>
              <Loader size={26} />
              <p style={{ color: SOFT, fontSize: 12.5 }}>Reading the room</p>
            </>
          )}
        </div>
      </ModalShell>
    );
  }

  const { data } = full;
  if (mode === 'scoreboard') return <CommitteeScoreboardModal data={data} onClose={() => setMode('recap')} />;

  // Join as chair is the real console; Watch only is the silent, read-only secretariat view.
  const code = room.code;
  const joinCode = code ? (room.chairPassword ? `${code}-${room.chairPassword}` : code) : null;

  const dir = openDirective ? directives?.find((d) => d.id === openDirective) ?? null : null;
  if (dir) {
    const queue = cabinetDirectivesOf(directives, cab.id) ?? [dir];
    return (
      <DirectivePopup
        directive={dir}
        queue={queue.some((d) => d.id === dir.id) ? queue : [dir, ...queue]}
        onSelect={setOpenDirective}
        onClose={() => setOpenDirective(null)}
        onChanged={(what) => { if (what === 'answered') setOpenDirective(null); }}
      />
    );
  }
  const story = openNews ? news?.find((n) => n.id === openNews) ?? null : null;
  if (story) return <NewsDetailDialog n={story} onClose={() => setOpenNews(null)} />;

  return (
    <CrisisRecap
      data={data}
      cabinetId={cab.id}
      tab={tab}
      onTab={setTab}
      directives={directives}
      news={news}
      onClose={onClose}
      onOpenDirective={(d) => setOpenDirective(d.id)}
      onOpenNews={(n) => setOpenNews(n.id)}
      onOpenScoreboard={() => setMode('scoreboard')}
      floorDetail={(
        <>
          {code && joinCode && (
            <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 14 }}>
              <LinkBtn href={`/join?code=${encodeURIComponent(joinCode)}&mode=chair`} newTab tone="red" icon={<Gavel size={13} strokeWidth={1.5} />}>Join as chair</LinkBtn>
              <LinkBtn href={`/chair/${code}?secretariat=1`} newTab title="Read only: you can watch the room but not change anything" icon={<Eye size={13} strokeWidth={1.5} />}>Watch only</LinkBtn>
            </div>
          )}
          <div className="mb-5" style={{ color: CK.ink, fontFamily: CK.font }}><RoomStagePanel live={data} /></div>
          <FloorDetail data={data} />
        </>
      )}
    />
  );
}
