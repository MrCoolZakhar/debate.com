'use client';

/**
 * The "choose what to apply for" rows on the public conference page.
 *
 * One raised white row per enabled role, stacked, the whole row is the
 * button: the role's glyph, its name and a round go key (no price here,
 * owner 12 Oct 2026); a role that is not open says why.
 * No pictures (owner, 12 Oct 2026). Presentation only: the caller decides
 * which roles show, whether each is open, the price (publicFees) and what a
 * press does.
 */

import { ArrowRight, CalendarClock, Lock, UserRound, Users, Eye, GraduationCap, Gavel, Newspaper, Siren, IdCard, type LucideIcon } from 'lucide-react';

/** The role's glyph, as the picker had it before the tiles (a person, a group,
 *  an eye, a cap; a chair is a person holding a gavel). Plain Lucide line
 *  icons in a soft gold disc: no 3D pictures here (owner, 12 Oct 2026). */
const ROLE_GLYPH: Record<string, LucideIcon> = {
  delegate: UserRound,
  'head-delegate': Users,
  'faculty-advisor': GraduationCap,
  observer: Eye,
  press: Newspaper,
  crisis: Siren,
  staff: IdCard,
  secretariat: IdCard,
};

function RoleGlyph({ role, open }: { role: string; open: boolean }) {
  const ink = open ? '#1B3828' : '#8A7A66';
  const Icon = ROLE_GLYPH[role] ?? UserRound;
  return (
    <span
      className="shrink-0 relative inline-flex items-center justify-center rounded-full"
      aria-hidden
      style={{ width: 36, height: 36, background: open ? 'rgba(238,217,138,0.45)' : 'rgba(27,56,40,0.06)' }}
    >
      {role === 'chair' ? (
        <>
          <UserRound size={19} strokeWidth={2.2} style={{ color: ink }} />
          <Gavel size={11} strokeWidth={2.6} style={{ color: ink, position: 'absolute', right: 6, bottom: 6 }} />
        </>
      ) : (
        <Icon size={19} strokeWidth={2.2} style={{ color: ink }} />
      )}
    </span>
  );
}

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

const TILE_CSS = `
.gv-role-tile{transition:transform 200ms cubic-bezier(.32,.72,0,1),box-shadow 200ms cubic-bezier(.32,.72,0,1)}
.gv-role-tile[data-open="true"]:hover,.gv-role-tile[data-open="true"]:focus-visible{transform:translateY(-1px);box-shadow:0 2px 0 rgba(255,255,255,0.9) inset,0 10px 20px rgba(0,0,0,0.24)}
.gv-role-tile[data-open="true"]:hover .gv-role-go,.gv-role-tile[data-open="true"]:focus-visible .gv-role-go{transform:translateX(2px)}
.gv-role-go{transition:transform 200ms cubic-bezier(.32,.72,0,1)}
.gv-role-tile[data-open="true"]:active{transform:scale(0.99)}
.gv-role-tile:focus-visible{outline:2px solid #EED98A;outline-offset:3px}
@media (prefers-reduced-motion: reduce){
  .gv-role-tile,.gv-role-go{transition:none}
  .gv-role-tile[data-open="true"]:hover,.gv-role-tile[data-open="true"]:focus-visible,.gv-role-tile[data-open="true"]:active,
  .gv-role-tile[data-open="true"]:hover .gv-role-go,.gv-role-tile[data-open="true"]:focus-visible .gv-role-go{transform:none}
}
`;

export function RoleApplyCards({ tiles, onPick }: { tiles: RoleTile[]; onPick: (role: string) => void }) {
  return (
    <>
      <style>{TILE_CSS}</style>
      {/* One role per row, stacked (owner, 12 Oct 2026: tiles side by side
          with 3D pictures were "still ugly"; no pictures). */}
      <ul className="flex flex-col gap-2 list-none p-0 m-0">
        {tiles.map(t => {
          const open = t.state === 'open';
          const stateLine = t.state === 'open'
            ? 'Open now'
            : t.state === 'opens-soon'
              ? (t.opensLabel ?? 'Not yet open')
              : 'Applications closed';
          const StateIcon = t.state === 'opens-soon' ? CalendarClock : Lock;
          return (
            <li key={t.role}>
              <button
                type="button"
                className="gv-role-tile w-full flex items-center gap-3 text-left rounded-[12px] focus:outline-none"
                data-open={open ? 'true' : 'false'}
                disabled={!open}
                aria-label={open ? `Apply as ${t.label}, ${t.price}` : `${t.label}: ${stateLine}`}
                onClick={() => { if (open) onPick(t.role); }}
                style={{
                  minHeight: 52,
                  padding: '8px 12px 8px 10px',
                  border: 'none',
                  backgroundColor: open ? '#FFFFFF' : 'rgba(255,255,255,0.78)',
                  boxShadow: '0 2px 0 rgba(255,255,255,0.9) inset, 0 4px 12px rgba(0,0,0,0.18)',
                  cursor: open ? 'pointer' : 'default',
                }}
              >
                <RoleGlyph role={t.role} open={open} />
                <span className="flex-1 min-w-0">
                  <span
                    className="block [overflow-wrap:anywhere]"
                    style={{ fontFamily: 'var(--font-brand), sans-serif', fontWeight: 700, fontSize: 14.5, lineHeight: 1.2, color: open ? '#1C1410' : '#5A4A3C' }}
                  >
                    {t.label}
                  </span>
                  {!open && (
                    <span
                      className="mt-0.5 inline-flex items-center gap-1"
                      style={{ fontFamily: 'var(--font-brand), sans-serif', fontWeight: 600, fontSize: 12, color: '#5A4A3C' }}
                    >
                      <StateIcon size={12} strokeWidth={2.4} aria-hidden />
                      {stateLine}
                    </span>
                  )}
                </span>
                {open && (
                  <span
                    className="gv-role-go shrink-0 inline-flex items-center justify-center rounded-full"
                    aria-hidden
                    style={{ width: 28, height: 28, background: 'linear-gradient(90deg,#1B3828,#2A5A3C)', color: '#FFFFFF' }}
                  >
                    <ArrowRight size={15} strokeWidth={2.6} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
