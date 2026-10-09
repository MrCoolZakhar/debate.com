'use client';

/**
 * The "choose what to apply for" tiles on the public conference page.
 *
 * One white card per enabled role, the whole card is the button, with a
 * picture that starts inside the card and rises over its top edge (owner,
 * 9 Oct 2026: "icons/images sticking outside of the box from inside to make
 * it come alive"). Presentation only: the caller decides which roles show,
 * whether each is open, the price (publicFees) and what a press does.
 */

import { ArrowRight, CalendarClock, Lock, UserRound, Users, Eye, GraduationCap, Gavel, Newspaper, Siren, IdCard, type LucideIcon } from 'lucide-react';
import { Emoji3D } from '@/components/neu';

export type RoleTileState = 'open' | 'opens-soon' | 'closed';

export interface RoleTile {
  role: string;
  label: string;
  state: RoleTileState;
  /** Price of the current (or opening) fee stage, already formatted. */
  price: string;
  /** "Opens 12 Nov" for an upcoming role. */
  opensLabel?: string | null;
}

/** The picture each role rises with. A local file wins (the 3D gavel), else a
 *  Fluent 3D emoji, else a Lucide glyph if the CDN fails. */
const ROLE_ART: Record<string, { src?: string; emoji?: string; toned?: boolean; fallback: LucideIcon }> = {
  delegate: { emoji: 'Office worker', toned: true, fallback: UserRound },
  'head-delegate': { emoji: 'Crown', fallback: Users },
  chair: { src: '/gavel-3d.webp', fallback: Gavel },
  'faculty-advisor': { emoji: 'Teacher', toned: true, fallback: GraduationCap },
  observer: { emoji: 'Eyes', fallback: Eye },
  crisis: { emoji: 'Police car light', fallback: Siren },
  press: { emoji: 'Newspaper', fallback: Newspaper },
  staff: { emoji: 'Name badge', fallback: IdCard },
  secretariat: { emoji: 'Name badge', fallback: IdCard },
};
const DEFAULT_ART = { emoji: 'Clipboard', fallback: UserRound } as const;

const ART = 64;

function RoleArt({ role }: { role: string }) {
  const art = ROLE_ART[role] ?? DEFAULT_ART;
  if ('src' in art && art.src) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={art.src}
        alt=""
        aria-hidden
        width={ART}
        height={ART}
        draggable={false}
        style={{ width: ART, height: ART, objectFit: 'contain', filter: 'drop-shadow(0 6px 8px rgba(27,56,40,0.28))' }}
      />
    );
  }
  return (
    <Emoji3D
      name={art.emoji ?? 'Clipboard'}
      toned={'toned' in art ? !!art.toned : false}
      size={ART}
      fallback={art.fallback}
      fallbackColor="#1B3828"
      style={{ filter: 'drop-shadow(0 6px 8px rgba(27,56,40,0.28))' }}
    />
  );
}

const TILE_CSS = `
.gv-role-tile{transition:transform 220ms cubic-bezier(.32,.72,0,1),box-shadow 220ms cubic-bezier(.32,.72,0,1)}
.gv-role-tile .gv-role-art{transition:transform 260ms cubic-bezier(.32,.72,0,1)}
.gv-role-tile[data-open="true"]:hover,.gv-role-tile[data-open="true"]:focus-visible{transform:translateY(-3px);box-shadow:0 2px 0 rgba(255,255,255,0.9) inset,0 18px 34px rgba(0,0,0,0.30)}
.gv-role-tile[data-open="true"]:hover .gv-role-art,.gv-role-tile[data-open="true"]:focus-visible .gv-role-art{transform:translateY(-5px) rotate(-5deg) scale(1.05)}
.gv-role-tile[data-open="true"]:active{transform:translateY(-1px) scale(0.98)}
.gv-role-tile:focus-visible{outline:2px solid #EED98A;outline-offset:3px}
@media (prefers-reduced-motion: reduce){
  .gv-role-tile,.gv-role-tile .gv-role-art{transition:none}
  .gv-role-tile[data-open="true"]:hover,.gv-role-tile[data-open="true"]:focus-visible,.gv-role-tile[data-open="true"]:active,
  .gv-role-tile[data-open="true"]:hover .gv-role-art,.gv-role-tile[data-open="true"]:focus-visible .gv-role-art{transform:none}
}
`;

export function RoleApplyCards({ tiles, onPick }: { tiles: RoleTile[]; onPick: (role: string) => void }) {
  const single = tiles.length === 1;
  return (
    <>
      <style>{TILE_CSS}</style>
      {/* Row gap and top margin leave room for the rising pictures. */}
      <ul className="grid grid-cols-2 gap-x-3 gap-y-11 mt-11 list-none p-0 m-0" style={{ marginTop: 44 }}>
        {tiles.map(t => {
          const open = t.state === 'open';
          const stateLine = t.state === 'open'
            ? 'Open now'
            : t.state === 'opens-soon'
              ? (t.opensLabel ?? 'Not yet open')
              : 'Applications closed';
          const StateIcon = t.state === 'open' ? ArrowRight : t.state === 'opens-soon' ? CalendarClock : Lock;
          return (
            <li key={t.role} className={single ? 'col-span-2' : undefined}>
              <button
                type="button"
                className="gv-role-tile relative w-full h-full flex flex-col items-start text-left rounded-[18px] focus:outline-none"
                data-open={open ? 'true' : 'false'}
                disabled={!open}
                aria-label={open ? `Apply as ${t.label}, ${t.price}` : `${t.label}: ${stateLine}`}
                onClick={() => { if (open) onPick(t.role); }}
                style={{
                  padding: '44px 14px 14px 14px',
                  minHeight: 132,
                  border: 'none',
                  backgroundColor: open ? '#FFFFFF' : 'rgba(255,255,255,0.86)',
                  boxShadow: '0 2px 0 rgba(255,255,255,0.9) inset, 0 10px 24px rgba(0,0,0,0.22)',
                  cursor: open ? 'pointer' : 'default',
                }}
              >
                {/* The picture starts inside the card and rises over its top
                    edge; drawn above the card, never clipped by it. */}
                <span
                  className="gv-role-art absolute pointer-events-none"
                  aria-hidden
                  style={{
                    top: -32,
                    left: 10,
                    zIndex: 2,
                    width: ART,
                    height: ART,
                    filter: open ? undefined : 'grayscale(0.55)',
                    opacity: open ? 1 : 0.7,
                  }}
                >
                  <RoleArt role={t.role} />
                </span>
                <span
                  className="block [overflow-wrap:anywhere]"
                  style={{ fontFamily: 'var(--font-brand), sans-serif', fontWeight: 700, fontSize: 15.5, lineHeight: 1.2, color: '#1C1410' }}
                >
                  {t.label}
                </span>
                {t.state !== 'closed' && (
                  <span
                    className="block mt-1"
                    style={{ fontFamily: 'var(--font-brand), sans-serif', fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums', color: '#1B3828' }}
                  >
                    {t.price}
                  </span>
                )}
                <span
                  className="mt-auto pt-2 inline-flex items-center gap-1"
                  style={{
                    fontFamily: 'var(--font-brand), sans-serif',
                    fontWeight: 600,
                    fontSize: 12,
                    color: open ? '#2A6A44' : '#5A4A3C',
                  }}
                >
                  <StateIcon size={13} strokeWidth={2.4} aria-hidden />
                  {stateLine}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
