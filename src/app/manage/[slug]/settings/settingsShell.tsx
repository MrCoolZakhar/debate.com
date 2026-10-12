'use client';

/**
 * Settings as bookmarks (Oct 2026, owner: "too much focused on applications.
 * find how the best platforms do their settings and copy that, perhaps
 * something along the lines of bookmarks").
 *
 * Laid out the way Stripe, Linear and Airbnb's hosting settings are: a sticky
 * list of sections on the left, one clear page per section on the right, and
 * every change saved where it is made. On a narrow screen the list becomes a
 * row of pills across the top.
 *
 *   General        what the conference is: name, dates, place, pictures,
 *                  colours, contact, editions, delete
 *   Partners       linked conferences and sponsor companies
 *   Visibility     who can find it, and what its page shows
 *   Applications   who can apply, the rules for every role, each role's form
 *   Delegations    how schools and societies run themselves
 *   Team           who runs it with you
 *   Payments       a door to Financials, where the money settings live
 *   Awards         blank slate, then presets and custom awards (awardsUi.tsx)
 *
 * The order follows the organiser's own order of thought: what it is, who
 * sees it, who joins (and how in groups), who runs it, then money and the
 * closing ceremony. Payments lives in Financials and is only linked here.
 *
 * Presentation only. Nothing here reads or writes the database.
 */

import type { ReactNode } from 'react';
import {
  Building2, Globe, ClipboardList, School, Users2, CreditCard, Trophy, Handshake, type LucideIcon,
} from 'lucide-react';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS } from '../financials/dashboardKit';
import { F, INK, INK_SOFT, FOREST, ROW_CSS, TINT_GOLD_BG, TINT_GREEN_BG, EmojiDisc } from './panelKit';

/** The sections, in rail order. The key is also the ?tab= value written. */
export type ShellSection = 'general' | 'partners' | 'visibility' | 'applications' | 'delegations' | 'team' | 'payments' | 'awards';

/** Each section's Fluent 3D emoji (`emoji`) with the Lucide glyph it falls
 *  back to (`icon`) if the image cannot load. */
export const SHELL_SECTIONS: { key: ShellSection; label: string; emoji: string; icon: LucideIcon; tint: string }[] = [
  { key: 'general',      label: 'General',      emoji: 'Classical building',          icon: Building2,     tint: TINT_GOLD_BG },
  { key: 'partners',     label: 'Partners',     emoji: 'Handshake',                   icon: Handshake,     tint: TINT_GREEN_BG },
  { key: 'visibility',   label: 'Visibility',   emoji: 'Globe showing europe-africa', icon: Globe,         tint: TINT_GREEN_BG },
  { key: 'applications', label: 'Applications', emoji: 'Inbox tray',                  icon: ClipboardList, tint: TINT_GOLD_BG },
  { key: 'delegations',  label: 'Delegations',  emoji: 'School',                      icon: School,        tint: TINT_GREEN_BG },
  { key: 'team',         label: 'Team',         emoji: 'Busts in silhouette',         icon: Users2,        tint: TINT_GREEN_BG },
  { key: 'payments',     label: 'Payments',     emoji: 'Credit card',                 icon: CreditCard,    tint: TINT_GOLD_BG },
  { key: 'awards',       label: 'Awards',       emoji: 'Trophy',                      icon: Trophy,        tint: TINT_GOLD_BG },
];

export function shellMeta(key: ShellSection) {
  return SHELL_SECTIONS.find(s => s.key === key) ?? SHELL_SECTIONS[0];
}

const SHELL_CSS = `
.gvsh { container-type: inline-size; }
.gvsh-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; align-items: start; }
.gvsh-rail { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 4px 2px 8px; margin: 0 -2px;
  -webkit-mask-image: linear-gradient(90deg, #000 86%, transparent); mask-image: linear-gradient(90deg, #000 86%, transparent); }
.gvsh-rail::-webkit-scrollbar { display: none; }
.gvsh-item { display: inline-flex; align-items: center; gap: 9px; flex-shrink: 0; min-height: 44px; padding: 5px 14px 5px 6px;
  border-radius: 999px; border: none; cursor: pointer; text-align: left; font-family: ${F}; font-size: 14.5px; font-weight: 700;
  color: ${INK}; background: #FFFFFF; box-shadow: 0 1px 0 rgba(27,56,40,0.08), 0 8px 18px -14px rgba(27,56,40,0.45);
  transition: background-color 140ms ease, box-shadow 160ms ease, transform 120ms ease; white-space: nowrap; }
.gvsh-item:hover { background: #FBF8F1; }
.gvsh-item:active { transform: scale(0.98); }
.gvsh-item:focus { outline: none; }
.gvsh-item:focus-visible { outline: 2px solid ${FOREST}; outline-offset: 2px; }
.gvsh-item[aria-current="page"] { background: linear-gradient(90deg, #1B3828 0%, #2A5A3C 100%); color: #FFFFFF; box-shadow: 0 8px 18px -10px rgba(27,56,40,0.7); }
@container (min-width: 860px) {
  .gvsh-grid { grid-template-columns: 226px minmax(0, 1fr); gap: 28px; }
  .gvsh-railbox { position: sticky; top: 80px; }
  .gvsh-rail { flex-direction: column; overflow: visible; padding: 10px; margin: 0; -webkit-mask-image: none; mask-image: none;
    background: #FFFFFF; border-radius: 20px; box-shadow: 0 1px 0 rgba(27,56,40,0.08), 0 18px 40px -32px rgba(27,56,40,0.35); gap: 4px; }
  .gvsh-item { width: 100%; border-radius: 14px; box-shadow: none; background: transparent; padding: 6px 12px 6px 6px; }
  .gvsh-item:hover { background: #FAF8F3; }
  .gvsh-item[aria-current="page"]:hover { background: linear-gradient(90deg, #1B3828 0%, #2A5A3C 100%); }
}
`;

export function SettingsShell({ active, onOpen, title, children }: {
  active: ShellSection;
  onOpen: (key: ShellSection) => void;
  /** The small line over the rail: "Settings" and the conference's name. */
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="gvsh gv-st">
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{ROW_CSS}</style>
      <style>{SHELL_CSS}</style>
      <div className="gvsh-grid">
        <div className="gvsh-railbox min-w-0">
          <p className="px-1 mb-2" style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: INK_SOFT, overflowWrap: 'anywhere' }}>{title}</p>
          <nav aria-label="Settings sections" className="gvsh-rail">
            {SHELL_SECTIONS.map(s => (
              <button
                key={s.key}
                type="button"
                className="gvsh-item"
                aria-current={s.key === active ? 'page' : undefined}
                onClick={() => onOpen(s.key)}
              >
                <EmojiDisc emoji={s.emoji} icon={s.icon} tint={s.tint} size={34} active={s.key === active} />
                {s.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
