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

import { useEffect, useState, type ComponentType, type CSSProperties } from 'react';
import { AlertTriangle, FileText, Flag, Mic, Moon, Pause, ScrollText, Timer, Users } from 'lucide-react';
import { loadAdminRoom } from '@/app/admin/liveRoomLoader';
import type { LiveCommittee } from '@/app/manage/[slug]/live/LiveModals';
import { AMBER_INK, GREEN_INK, SOFT, STATUS_META, cardFacts, cardWarnings, nowPlaying, roomStatus, type NowGlyph, type NowPlaying } from '@/app/manage/[slug]/live/cardModel';
import { useNowTick } from '@/app/manage/[slug]/live/PhaseVariants';
import { cabinetTint, CK, Skeleton } from '../../crisisKit';

const REFRESH_MS = 20_000;

const GLYPH: Record<NowGlyph, ComponentType<{ size?: number; strokeWidth?: number; style?: CSSProperties }>> = {
  mic: Mic, timer: Timer, users: Users, ballot: ScrollText, pause: Pause, closed: Flag, dormant: Moon,
};

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
const toneFill = (t: NowPlaying['tone']) => (t === 'warn' ? CK.warn : t === 'live' ? CK.ok : '#9A9086');

/** The dashboard body for one room. Mounted only when the cabinet has a live room (a session id). */
export default function RoomLivePanel({ sessionId, color }: { sessionId: string; color: string }) {
  const { data, failed } = useRoomModel(sessionId);
  const now = useNowTick(true);

  if (!data) {
    return failed
      ? <p style={{ margin: 0, fontSize: 12.5, color: CK.inkSoft }}>Could not read this room. Trying again.</p>
      : <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={18} w="45%" /><Skeleton h={56} r={14} /></div>;
  }

  const status = roomStatus(data, now);
  const meta = STATUS_META[status];
  const np = nowPlaying(data, now);
  const facts = cardFacts(data);
  const warnings = cardWarnings(data, now).slice(0, 2);
  const Glyph = GLYPH[np.glyph] ?? Timer;
  const ink = toneInk(np.tone);
  const bigRight = np.right.length <= 8;

  return (
    <div className="flex flex-col" style={{ gap: 8, flex: 1, minHeight: 0 }}>
      {/* Status word, the roll, and the papers. */}
      <div className="flex items-center flex-wrap" style={{ gap: '3px 14px', fontSize: 12.5, color: CK.inkSoft }}>
        <span className="inline-flex items-center" style={{ gap: 6, fontWeight: 800, color: meta.ink }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, boxShadow: `0 0 0 3px ${cabinetTint(meta.color, 0.22)}`, flex: 'none' }} />
          {meta.label}
        </span>
        <span className="inline-flex items-center" style={{ gap: 5, fontVariantNumeric: 'tabular-nums' }}>
          <Users size={13} strokeWidth={1.5} aria-hidden /><b style={{ color: CK.ink }}>{facts.present}</b> of {facts.total} present
        </span>
        {facts.wps + facts.drs > 0 && (
          <span className="inline-flex items-center" style={{ gap: 5, fontVariantNumeric: 'tabular-nums' }}>
            <FileText size={13} strokeWidth={1.5} aria-hidden />
            <b style={{ color: CK.ink }}>{facts.wps + facts.drs}</b> {facts.wps + facts.drs === 1 ? 'paper' : 'papers'}
            {facts.drsPassed > 0 && <span style={{ color: CK.ok, fontWeight: 700 }}>· {facts.drsPassed} passed</span>}
          </span>
        )}
      </div>

      {/* Now playing: the stage, who has the floor, and the clock. A room nobody opened yet says so once (the status line above). */}
      {status !== 'not-started' && <div style={{ background: CK.well, borderRadius: 16, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 auto', justifyContent: 'center' }}>
        <div className="flex items-center" style={{ gap: 10 }}>
          <span aria-hidden style={{ width: 38, height: 38, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', background: cabinetTint(color, 0.14), color }}>
            <Glyph size={19} strokeWidth={1.5} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: ink, overflowWrap: 'anywhere' }}>{np.context}</span>
            <b style={{ display: 'block', fontSize: 15, lineHeight: 1.2, color: np.dim ? SOFT : CK.ink, overflowWrap: 'anywhere' }}>{np.headline}</b>
            {np.contextTopic && <span style={{ display: 'block', fontSize: 11.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{np.contextTopic}</span>}
          </div>
          <b style={{ flex: 'none', maxWidth: '40%', textAlign: 'right', fontSize: bigRight ? 20 : 12, fontWeight: 800, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums', color: ink, overflowWrap: 'anywhere' }}>{np.right}</b>
        </div>
        <div>
          <span aria-hidden style={{ display: 'block', height: 5, borderRadius: 3, background: 'rgba(110,30,30,0.08)', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${Math.max(0, Math.min(100, np.pct ?? 0))}%`, borderRadius: 3, background: toneFill(np.tone) }} />
          </span>
          <span style={{ display: 'block', marginTop: 3, fontSize: 11.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{np.left}</span>
        </div>
        {np.next && (
          <p style={{ margin: 0, fontSize: 12, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
            <b style={{ color: CK.ink }}>{np.next.label}</b> {np.next.names.slice(0, 5).join(', ')}{np.next.all.length > 5 ? ` and ${np.next.all.length - 5} more` : ''}
          </p>
        )}
      </div>}

      {warnings.map((w) => (
        <p key={w.id} className="flex items-start" style={{ margin: 0, gap: 6, fontSize: 12, fontWeight: 600, color: w.tone === 'red' ? CK.danger : AMBER_INK }}>
          <AlertTriangle size={13} strokeWidth={1.5} aria-hidden style={{ flex: 'none', marginTop: 2 }} />
          <span style={{ overflowWrap: 'anywhere' }}>{w.text}</span>
        </p>
      ))}
    </div>
  );
}
