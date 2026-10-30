'use client';
// Gavelling Crisis: one Front Rooms card. It is the organiser's Live Status room card (src/app/manage/[slug]/live/CommitteeCard.tsx)
// at a smaller size, built from the same pieces and the same model so it reads the same: the emblem straddling the top
// edge, the status rail and status word, the tinted Now Playing panel (flag disc, stage in capitals, the topic, the
// speaker, the scrubber with its two captions, who is waiting as round flags) and the quiet facts row (present, WP, DR,
// chair). Read only; a click opens the room pop-up. When the card is short the small rows drop away (container query on
// the slot), so every room always fits without scrolling. Nothing here writes.

import { useMemo, type CSSProperties } from 'react';
import { FileText, ScrollText, UserRound, Users } from 'lucide-react';
import { LogoDisc } from '@/components/LogoDisc';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { SeatArtProvider } from '@/components/SeatFlag';
import { NEU, NEU_GRADIENTS, OUTFIT } from '@/components/neu';
import { serverNow } from '@/lib/serverClock';
import type { Cabinet } from '@/lib/crisis/types';
import type { LiveCommittee } from '@/app/manage/[slug]/live/LiveModals';
import {
  AMBER_INK, GREEN_INK, SOFT, STATUS_META, cardFacts, firstName, roomStatus, type NowPlaying,
} from '@/app/manage/[slug]/live/cardModel';
import { CARD_BORDER_COLOR, CARD_SHADOW, CARD_SHADOW_HOVER } from '@/app/manage/[slug]/live/tokens';
import { useRoomNow } from './commandRoomLive';

export const ROOM_LOGO = 44;
/** How far the emblem hangs over the card's top edge. The slot reserves this above the card. */
export const ROOM_OVERHANG = 15;

/** CSS for the cards: rows disappear as the slot gets short (container query on the slot), so every room always fits. */
export const ROOM_CARD_CSS = `
.rm-slot { container-type: size; container-name: rm; min-height: 232px; }
@media (min-width: 1100px) { .rm-slot { min-height: 0; } .cmd-rooms-list { flex: 1 1 auto; min-height: 0; } }
@container rm (max-height: 227px) { .rm-foot { display: none !important; } }
@container rm (max-height: 168px) { .rm-next { display: none !important; } }
@container rm (max-height: 140px) { .rm-scrub { display: none !important; } }
@container rm (max-height: 110px) { .rm-topic { display: none !important; } }
.rm-card { transition: box-shadow 260ms cubic-bezier(0.23, 1, 0.32, 1), transform 260ms cubic-bezier(0.23, 1, 0.32, 1); }
.rm-card[data-open]:hover { box-shadow: ${CARD_SHADOW_HOVER} !important; transform: translateY(-2px); }
.rm-card:focus-visible { outline: 2px solid #1B3828; outline-offset: 2px; }
`;

const toneInk = (t: NowPlaying['tone']) => (t === 'live' ? GREEN_INK : t === 'warn' ? AMBER_INK : SOFT);
const toneFill = (t: NowPlaying['tone']): [string, string] => (t === 'warn' ? NEU_GRADIENTS.amber : NEU_GRADIENTS.sage);
const headlineSize = (text: string) => (text.length > 46 ? 14 : text.length > 30 ? 16 : 18);

function Mark({ country, size }: { country: string; size: number }) {
  return (
    <SeatCircleFlag
      country={country}
      size={size}
      decorative
      monogramColors={{ bg: 'rgba(27,56,40,0.07)', fg: NEU.forest }}
      fallback={<UserRound size={Math.round(size * 0.6)} strokeWidth={1.5} style={{ color: NEU.forest }} />}
    />
  );
}

const FLAGS_SHOWN = 8;

function CardInner({ cab, live, placeholder, onOpen }: { cab: Cabinet; live: LiveCommittee | null; placeholder: string; onOpen?: () => void }) {
  const np = useRoomNow(live);
  const status = live ? roomStatus(live, serverNow()) : null;
  const meta = status ? STATUS_META[status] : null;
  const facts = live ? cardFacts(live) : null;
  const chairs = useMemo(() => [...new Set((live?.session?.chairNames ?? []).map((n) => firstName(n)).filter(Boolean))], [live]);
  const title = cab.short_name || cab.name;
  const ink = np ? toneInk(np.tone) : SOFT;
  const [from, to] = np ? toneFill(np.tone) : NEU_GRADIENTS.sage;
  const pct = Math.max(0, Math.min(100, np?.pct ?? 0));
  const started = !!np && np.kind !== 'not-started';

  const label: CSSProperties = { fontFamily: OUTFIT, color: SOFT };

  return (
    <div
      className="rm-card"
      data-open={onOpen ? '' : undefined}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={onOpen ? `Open the ${cab.name} room` : undefined}
      onClick={onOpen}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } : undefined}
      style={{
        position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0,
        background: NEU.surface, borderRadius: 20, border: `1px solid ${CARD_BORDER_COLOR}`, boxShadow: CARD_SHADOW,
        cursor: onOpen ? 'pointer' : 'default', fontFamily: OUTFIT,
      }}
    >
      <LogoDisc
        src={cab.logo_url}
        size={ROOM_LOGO}
        fallbackText={title.slice(0, 3)}
        alt={cab.name}
        style={{ position: 'absolute', insetBlockStart: -ROOM_OVERHANG, insetInlineStart: 16, zIndex: 2 }}
      />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0, overflow: 'hidden', borderRadius: 19 }}>
        <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: meta?.color ?? CARD_BORDER_COLOR }} />

        <div className="flex items-start justify-between" style={{ gap: 8, padding: '7px 12px 0 16px', marginInlineStart: ROOM_LOGO + 6, flex: 'none' }}>
          <b title={cab.name} style={{ fontSize: 17, lineHeight: 1.15, letterSpacing: '-0.015em', color: NEU.ink, overflowWrap: 'anywhere', minWidth: 0 }}>{title}</b>
          {meta && (
            <span className="inline-flex items-center" style={{ gap: 6, flex: 'none', paddingTop: 2 }} title="Whether this room has shown a sign of life recently">
              <span className={meta.pulse ? 'animate-pulse' : undefined} style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, boxShadow: status === 'not-started' ? `inset 0 0 0 1px ${meta.color}` : undefined }} />
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: meta.ink }}>{meta.label}</span>
            </span>
          )}
        </div>

        {/* The Now Playing panel: the one band that carries the room. */}
        <div
          style={{
            margin: '6px 6px 0', flex: '1 1 0', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 6,
            background: 'rgba(27,56,40,0.045)', boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.08)', borderRadius: 14, padding: '8px 10px 8px',
          }}
        >
          {!live || !np ? (
            <p style={{ ...label, margin: 0, fontSize: 13, fontWeight: 600 }}>{placeholder}</p>
          ) : (
            <>
              <div className="flex items-start" style={{ gap: 10, minWidth: 0 }}>
                <span
                  aria-hidden
                  className="flex items-center justify-center"
                  style={{
                    width: 40, height: 40, borderRadius: '50%', flex: 'none', overflow: 'hidden',
                    background: np.flag ? 'transparent' : 'rgba(27,56,40,0.06)', boxShadow: '0 1px 2px rgba(27,56,40,0.10), 0 6px 14px -6px rgba(27,56,40,0.30)',
                  }}
                >
                  {np.flag ? <Mark country={np.flag} size={40} /> : <UserRound size={20} strokeWidth={1.5} style={{ color: np.tone === 'off' ? SOFT : ink }} />}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.075em', textTransform: 'uppercase', lineHeight: 1.25, color: ink, overflowWrap: 'anywhere' }}>{np.context}</p>
                  {np.contextTopic && (
                    <p className="rm-topic" style={{ ...label, margin: '1px 0 0', fontSize: 10.5, fontWeight: 600, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{np.contextTopic}</p>
                  )}
                  <p style={{ margin: '3px 0 0', fontSize: headlineSize(np.headline), fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.012em', color: np.dim ? SOFT : NEU.ink, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}>{np.headline}</p>
                </div>
              </div>

              <div className="rm-scrub" style={{ flex: 'none' }}>
                <div aria-hidden style={{ height: 6, borderRadius: 6, overflow: 'hidden', background: 'rgba(27,56,40,0.08)', boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.06)', opacity: np.pct !== null ? 1 : 0.55 }}>
                  <div style={{ inlineSize: `${np.pct !== null ? pct : 0}%`, height: '100%', borderRadius: 6, background: `linear-gradient(90deg, ${from}, ${to})`, transition: 'inline-size 900ms linear' }} />
                </div>
                <div className="flex items-start justify-between" style={{ gap: 10, marginTop: 4 }}>
                  <span style={{ ...label, fontSize: 11, fontWeight: 600, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{started ? np.left : ''}</span>
                  <b style={{ fontSize: 12, lineHeight: 1.3, textAlign: 'end', fontVariantNumeric: 'tabular-nums', color: np.tone === 'off' ? SOFT : NEU.ink, overflowWrap: 'anywhere' }}>{np.right}</b>
                </div>
              </div>

              {np.next && np.next.names.length > 0 && (
                <div className="rm-next" style={{ flex: 'none' }}>
                  <p style={{ ...label, margin: '0 0 3px', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.3 }}>{np.next.label}</p>
                  <div className="flex flex-wrap items-center" style={{ gap: 4 }}>
                    {np.next.all.slice(0, FLAGS_SHOWN).map((n, i) => (
                      <span key={`${n}-${i}`} style={{ lineHeight: 0 }} title={`${n}, ${i === 0 ? 'next to speak' : `number ${i + 1} in the queue`}`}><Mark country={n} size={18} /></span>
                    ))}
                    {np.next.all.length > FLAGS_SHOWN && (
                      <b style={{ ...label, fontSize: 11, fontVariantNumeric: 'tabular-nums' }} title={np.next.all.slice(FLAGS_SHOWN).join(', ')}>+{np.next.all.length - FLAGS_SHOWN}</b>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* The quiet facts row: icon and number, no pills. */}
        <div className="rm-foot flex items-center flex-wrap" style={{ flex: 'none', gap: '2px 14px', padding: '6px 14px 7px 16px', fontSize: 12, fontWeight: 700, color: SOFT, fontVariantNumeric: 'tabular-nums' }}>
          {facts ? (
            <>
              <span className="inline-flex items-center" style={{ gap: 5 }} title={`${facts.present} of ${facts.total} delegations present`}><Users size={12} strokeWidth={1.5} style={{ color: NEU.forest }} aria-hidden /><b style={{ color: NEU.ink }}>{facts.present}</b>/{facts.total}</span>
              <span className="inline-flex items-center" style={{ gap: 5 }} title="Working papers"><FileText size={12} strokeWidth={1.5} style={{ color: NEU.forest }} aria-hidden /><b style={{ color: facts.wps ? NEU.ink : SOFT }}>{facts.wps}</b> WP</span>
              <span className="inline-flex items-center" style={{ gap: 5 }} title="Draft resolutions"><ScrollText size={12} strokeWidth={1.5} style={{ color: facts.drsPassed ? GREEN_INK : NEU.forest }} aria-hidden /><b style={{ color: facts.drs ? NEU.ink : SOFT }}>{facts.drs}</b> DR</span>
              <span style={{ overflowWrap: 'anywhere', minWidth: 0 }} title="Chairs in the room">{chairs.length ? `Chair: ${chairs.join(', ')}` : 'No chair yet'}</span>
            </>
          ) : <span>No room yet</span>}
        </div>
      </div>
    </div>
  );
}

/** The card for one cabinet's room. `live` is null while the room is still being read, or when no room is linked. */
export default function CrisisRoomCard({ cab, live, placeholder = 'No room linked', onOpen }: {
  cab: Cabinet; live: LiveCommittee | null; placeholder?: string; onOpen?: () => void;
}) {
  const seats = useMemo(() => live?.delegates ?? [], [live]);
  return (
    <SeatArtProvider delegates={seats}>
      <CardInner cab={cab} live={live} placeholder={placeholder} onOpen={onOpen} />
    </SeatArtProvider>
  );
}
