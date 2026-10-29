'use client';
// Gavelling Crisis: what a Front Rooms tile and the room pop-up say about a live room.
//
// It REUSES the organiser's Live Status model instead of re-deriving a room (src/app/manage/[slug]/live/cardModel.ts):
//   nowPlaying(lc, now)   the stage ("Moderated caucus"), its topic, who has the floor, the clock (speaker or caucus,
//                         derived from the persisted anchors) and who speaks next;
//   cardFacts / presence  who is present;
//   useNowTick            the one shared 1 s tick, so countdowns move without any write.
// The clock reads the DATABASE clock (serverNow, src/lib/serverClock.ts) at each tick. Nothing here writes.

import { useEffect } from 'react';
import { Users } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { ensureServerClock, serverNow } from '@/lib/serverClock';
import type { LiveCommittee } from '@/app/manage/[slug]/live/LiveModals';
import { AMBER_INK, GREEN_INK, SOFT, cardFacts, nowPlaying, type NowPlaying } from '@/app/manage/[slug]/live/cardModel';
import { useNowTick } from '@/app/manage/[slug]/live/PhaseVariants';
import { CK } from '../../crisisKit';

const toneInk = (t: NowPlaying['tone']) => (t === 'live' ? GREEN_INK : t === 'warn' ? AMBER_INK : SOFT);
const toneDot = (t: NowPlaying['tone']) => (t === 'live' ? '#3D7A52' : t === 'warn' ? '#B6871F' : '#9A9084');

/** The room's NowPlaying, recomputed every second from the stored anchors against the database clock. */
export function useRoomNow(live: LiveCommittee | null): NowPlaying | null {
  useEffect(() => { ensureServerClock(); }, []);
  const tick = useNowTick(true);
  void tick; // the tick only forces a re-render; the time itself is the database's
  return live ? nowPlaying(live, serverNow()) : null;
}

const nextText = (np: NowPlaying): string | null => {
  if (!np.next || np.next.names.length === 0) return null;
  return `${np.next.names.join(', ')}${np.next.more > 0 ? ` +${np.next.more}` : ''}`;
};

export const stageText = (np: NowPlaying): string => `${np.context}${np.contextTopic ? `: ${np.contextTopic}` : ''}`;

/** CSS for the tile: rows disappear as the tile gets short, so every room always fits (container query on the slot). */
export const ROOM_TILE_CSS = `
.rm-slot { container-type: size; container-name: rm; min-height: 112px; }
@media (min-width: 1100px) { .rm-slot { min-height: 0; } .cmd-rooms-list { flex: 1 1 0; min-height: 0; } }
@container rm (max-height: 98px) { .rm-next { display: none !important; } }
@container rm (max-height: 80px) { .rm-topic { display: none !important; } }
@container rm (max-height: 62px) { .rm-stage { display: none !important; } }
`;

/** The body of one tile, beside the emblem: name and who is present, the stage and topic, who has the floor and the clock, who is next. */
export function RoomTileBody({ name, color, live, placeholder = 'No room linked' }: { name: string; color: string; live: LiveCommittee | null; placeholder?: string }) {
  const np = useRoomNow(live);
  const facts = live ? cardFacts(live) : null;
  const started = !!np && np.kind !== 'not-started';
  const next = np ? nextText(np) : null;
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, fontSize: 12.5, color: CK.inkSoft, lineHeight: 1.3 }}>
      <span className="flex items-center justify-between" style={{ gap: 8 }}>
        <b style={{ fontSize: 14, color, overflowWrap: 'anywhere', minWidth: 0 }}>{name}</b>
        {facts && (
          <span className="inline-flex items-center" style={{ gap: 4, flex: 'none', fontVariantNumeric: 'tabular-nums', fontSize: 12 }} title="Present in the room">
            <Users size={12} strokeWidth={1.5} aria-hidden /><b style={{ color: CK.ink }}>{facts.present}</b> of {facts.total}
          </span>
        )}
      </span>
      {!live || !np ? (
        <span style={{ color: CK.inkSoft }}>{placeholder}</span>
      ) : (
        <>
          <span className="rm-stage flex items-start" style={{ gap: 6 }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: toneDot(np.tone), flex: 'none', marginTop: 5 }} />
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }} title={stageText(np)}>
              <b style={{ color: toneInk(np.tone) }}>{np.context}</b>
              {np.contextTopic && <span className="rm-topic">{': '}<span style={{ color: CK.ink }}>{np.contextTopic}</span></span>}
            </span>
          </span>
          <span className="flex items-center justify-between" style={{ gap: 8 }}>
            <span className="inline-flex items-center" style={{ gap: 6, minWidth: 0, overflowWrap: 'anywhere' }}>
              {started && np.flag && <CircleFlag country={np.flag} size={16} decorative />}
              <b style={{ color: np.dim ? SOFT : CK.ink }}>{started ? np.headline : 'Not started'}</b>
            </span>
            {started && <b style={{ flex: 'none', fontVariantNumeric: 'tabular-nums', color: toneInk(np.tone) }}>{np.right}</b>}
          </span>
          {next && (
            <span className="rm-next" style={{ overflowWrap: 'anywhere', fontSize: 12 }} title={np.next ? np.next.all.join(', ') : undefined}>
              <span style={{ fontWeight: 700 }}>Next: </span>{next}
            </span>
          )}
        </>
      )}
    </span>
  );
}

/** The larger version at the top of the room pop-up (the organiser's NOW PLAYING panel, in crisis colours). */
export function RoomStagePanel({ live }: { live: LiveCommittee }) {
  const np = useRoomNow(live);
  if (!np) return null;
  const started = np.kind !== 'not-started';
  return (
    <div style={{ background: CK.well, borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p className="flex items-start" style={{ margin: 0, gap: 8, fontSize: 14, color: CK.inkSoft }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: toneDot(np.tone), flex: 'none', marginTop: 5 }} />
        <span style={{ overflowWrap: 'anywhere' }}><b style={{ color: toneInk(np.tone) }}>{np.context}</b>{np.contextTopic && <>{': '}<b style={{ color: CK.ink }}>{np.contextTopic}</b></>}</span>
      </p>
      <div className="flex items-center justify-between" style={{ gap: 10 }}>
        <span className="inline-flex items-center" style={{ gap: 8, minWidth: 0 }}>
          {started && np.flag && <CircleFlag country={np.flag} size={30} decorative />}
          <b style={{ fontSize: 19, color: np.dim ? SOFT : CK.ink, overflowWrap: 'anywhere' }}>{np.headline}</b>
        </span>
        {started && <b style={{ flex: 'none', fontSize: 24, fontVariantNumeric: 'tabular-nums', color: toneInk(np.tone) }}>{np.right}</b>}
      </div>
      {started && np.pct !== null && (
        <div aria-hidden style={{ height: 5, borderRadius: 3, background: 'rgba(27,56,40,0.1)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(0, Math.min(100, np.pct))}%`, height: '100%', background: toneDot(np.tone), borderRadius: 3 }} />
        </div>
      )}
      {started && np.left && <p style={{ margin: 0, fontSize: 12.5, color: CK.inkSoft }}>{np.left}</p>}
      {np.next && np.next.names.length > 0 && (
        <p className="flex flex-wrap items-center" style={{ margin: '2px 0 0', gap: '4px 8px', fontSize: 12.5, color: CK.inkSoft }}>
          <b>{np.next.label}:</b>
          {np.next.all.map((n, i) => (
            <span key={`${n}:${i}`} className="inline-flex items-center" style={{ gap: 4 }}>
              <CircleFlag country={n} size={16} decorative /><span style={{ color: CK.ink, fontWeight: 600 }}>{n}</span>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
