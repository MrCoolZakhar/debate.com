'use client';

/**
 * Settings, with the sections as tabs across the top (12 Oct 2026; owner: "I
 * think the tab should be up at the very top between switching in tabs in
 * settings"). It replaced the sticky left rail of 11 Oct 2026.
 *
 * The page header ("Conference Settings", the conference's name beneath), then
 * one row of tabs, each a Fluent 3D emoji with its word, sticky under the
 * manage top bar while the page scrolls. The active tab is a raised white pill
 * with a forest underline. Under the tabs, one section at a time across the
 * full width; every change is saved where it is made.
 *
 *   General        what the conference is: name, dates, place, about,
 *                  pictures, visibility (public on Explore, what the page
 *                  shows; its own tab until 12 Oct 2026), colours, contact,
 *                  editions, delete
 *   Applications   who can apply, the rules for every role, each role's form
 *   Delegations    how schools and societies run themselves
 *   Partners       linked conferences and sponsor companies
 *   Team           who runs it with you
 *   Payments       a door to Financials, where the money settings live
 *   Awards         set-up, then review and publish (awardsUi.tsx)
 *
 * The sticky bar has no tint of its own: it is drawn on the manage page's own
 * ivory ground (bled to the edges, so it is invisible at rest) and fades out at
 * its lower edge, so cards scroll under it without a rectangle appearing
 * (CLAUDE.md §8, "No random rectangles"). On a narrow screen the row scrolls
 * sideways with a fade on the edge that has more; labels are never cut.
 *
 * Presentation only. Nothing here reads or writes the database.
 */

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  Building2, ClipboardList, School, Users2, CreditCard, Trophy, Handshake, type LucideIcon,
} from 'lucide-react';
import { STORE_CSS } from '../store/storeKit';
import { DASH_CSS } from '../financials/dashboardKit';
import { GoldWord } from '@/components/BrandHeading';
import { F, INK, INK_SOFT, FOREST, ROW_CSS, TINT_GOLD_BG, TINT_GREEN_BG, EmojiDisc, TYPE_PX } from './panelKit';

/** The sections, in tab order. The key is also the ?tab= value written. */
export type ShellSection = 'general' | 'applications' | 'delegations' | 'partners' | 'team' | 'payments' | 'awards';

/** Each section's Fluent 3D emoji (`emoji`) with the Lucide glyph it falls
 *  back to (`icon`) if the image cannot load. */
export const SHELL_SECTIONS: { key: ShellSection; label: string; emoji: string; icon: LucideIcon; tint: string }[] = [
  { key: 'general',      label: 'General',      emoji: 'Classical building',          icon: Building2,     tint: TINT_GOLD_BG },
  { key: 'applications', label: 'Applications', emoji: 'Inbox tray',                  icon: ClipboardList, tint: TINT_GOLD_BG },
  { key: 'delegations',  label: 'Delegations',  emoji: 'School',                      icon: School,        tint: TINT_GREEN_BG },
  { key: 'partners',     label: 'Partners',     emoji: 'Handshake',                   icon: Handshake,     tint: TINT_GREEN_BG },
  { key: 'team',         label: 'Team',         emoji: 'Busts in silhouette',         icon: Users2,        tint: TINT_GREEN_BG },
  { key: 'payments',     label: 'Payments',     emoji: 'Credit card',                 icon: CreditCard,    tint: TINT_GOLD_BG },
  { key: 'awards',       label: 'Awards',       emoji: 'Trophy',                      icon: Trophy,        tint: TINT_GOLD_BG },
];

export function shellMeta(key: ShellSection) {
  return SHELL_SECTIONS.find(s => s.key === key) ?? SHELL_SECTIONS[0];
}

/** The manage layout's fixed top bar is 56px tall; the tabs stick under it. */
const MANAGE_BAR_PX = 56;
const GROUND = '#EDE7D8';

const SHELL_CSS = `
.gvsh { container-type: inline-size; }
.gvsh-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 6px 18px; flex-wrap: wrap; margin: 0 0 14px; }
.gvsh-h1 { margin: 0; font-family: ${F}; font-weight: 900; font-size: ${TYPE_PX.page}; letter-spacing: -0.025em; line-height: 1.05; color: ${INK}; }
.gvsh-conf { margin: 6px 0 0; font-family: ${F}; font-size: ${TYPE_PX.body}; font-weight: 600; color: ${INK_SOFT}; line-height: 1.35; overflow-wrap: anywhere; }
/* Buttons and segments a size down across Settings (owner, 12 Oct 2026: "some
   buttons are way too big in there and makes the section unnecessarily too
   big"): 38px buttons, 40px segments, less padding. */
.gvsh .gv-st-btn { min-height: 38px; padding: 0 14px; font-size: 14px; border-radius: 11px; gap: 7px; }
.gvsh .gv-fd-seg button { min-height: 40px; }
/* The sticky bar: the page's own ground, bled sideways so cards never show at
   its ends, and a short fade at its lower edge instead of a hard line. */
.gvsh-bar { position: sticky; top: ${MANAGE_BAR_PX}px; z-index: 20; margin: 0 0 18px; padding: 8px 0 6px; }
.gvsh-bar::before { content: ""; position: absolute; z-index: -1; top: 0; bottom: 0; left: -100vmax; right: -100vmax; pointer-events: none; background: ${GROUND}; }
.gvsh-bar::after { content: ""; position: absolute; left: -100vmax; right: -100vmax; top: 100%; height: 16px; pointer-events: none;
  background: linear-gradient(180deg, ${GROUND} 0%, rgba(237,231,216,0) 100%); }
.gvsh-tabs { display: flex; gap: 6px; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; padding: 4px; margin: -4px;
  --fs: 0px; --fe: 0px;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 var(--fs), #000 calc(100% - var(--fe)), transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 var(--fs), #000 calc(100% - var(--fe)), transparent 100%); }
.gvsh-tabs::-webkit-scrollbar { display: none; }
.gvsh-tab { position: relative; display: inline-flex; align-items: center; gap: 9px; flex-shrink: 0; min-height: 44px; padding: 5px 15px 5px 6px;
  border-radius: 15px; border: none; cursor: pointer; white-space: nowrap; font-family: ${F}; font-size: ${TYPE_PX.label}; font-weight: 600;
  color: ${INK_SOFT}; background: transparent; transition: background-color 140ms ease, box-shadow 160ms ease, color 140ms ease, transform 120ms ease; }
.gvsh-tab:hover { background: rgba(255,255,255,0.6); color: ${INK}; }
.gvsh-tab:active { transform: scale(0.98); }
.gvsh-tab:focus { outline: none; }
.gvsh-tab:focus-visible { outline: 2px solid ${FOREST}; outline-offset: 2px; }
.gvsh-tab[aria-current="page"] { background: #FFFFFF; color: ${FOREST}; font-weight: 800;
  box-shadow: 0 1px 0 rgba(27,56,40,0.08), 0 10px 22px -14px rgba(27,56,40,0.5); }
.gvsh-tab[aria-current="page"]::after { content: ""; position: absolute; left: 16px; right: 16px; bottom: 5px; height: 3px; border-radius: 3px;
  background: linear-gradient(90deg, #1B3828 0%, #2A5A3C 100%); }
@media (prefers-reduced-motion: reduce) { .gvsh-tab { transition: none; } }
`;

export function SettingsShell({ active, onOpen, conferenceName, children }: {
  active: ShellSection;
  onOpen: (key: ShellSection) => void;
  /** The conference's name, the small line under the page title. */
  conferenceName: ReactNode;
  children: ReactNode;
}) {
  const tabsRef = useRef<HTMLDivElement | null>(null);

  // The edge fades follow the scroll position, written straight to the node
  // (never state): a fade only on an edge with more tabs beyond it.
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const rtl = getComputedStyle(el).direction === 'rtl';
      const pos = Math.abs(el.scrollLeft);
      const atStart = pos <= 1;
      const atEnd = pos >= max - 1;
      const startPx = max <= 1 || atStart ? '0px' : '28px';
      const endPx = max <= 1 || atEnd ? '0px' : '28px';
      el.style.setProperty('--fs', rtl ? endPx : startPx);
      el.style.setProperty('--fe', rtl ? startPx : endPx);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, []);

  // Keep the active tab in view on a narrow screen (a deep link to Awards on a
  // phone). Scrolls the tab row only, never the page.
  useLayoutEffect(() => {
    const el = tabsRef.current;
    const tab = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !tab) return;
    const left = tab.offsetLeft - el.offsetLeft;
    const right = left + tab.offsetWidth;
    if (left < el.scrollLeft + 8) el.scrollLeft = Math.max(0, left - 24);
    else if (right > el.scrollLeft + el.clientWidth - 8) el.scrollLeft = right - el.clientWidth + 24;
  }, [active]);

  return (
    <div className="gvsh gv-st">
      <style>{STORE_CSS}</style>
      <style>{DASH_CSS}</style>
      <style>{ROW_CSS}</style>
      <style>{SHELL_CSS}</style>
      <header className="gvsh-head">
        <div className="min-w-0">
          <h1 className="gvsh-h1">Conference <GoldWord tone="light">Settings</GoldWord></h1>
          <p className="gvsh-conf">{conferenceName}</p>
        </div>
      </header>
      <div className="gvsh-bar">
        <nav aria-label="Settings sections" className="gvsh-tabs" ref={tabsRef}>
          {SHELL_SECTIONS.map(s => {
            const on = s.key === active;
            return (
              <button
                key={s.key}
                type="button"
                className="gvsh-tab"
                aria-current={on ? 'page' : undefined}
                onClick={() => onOpen(s.key)}
              >
                <EmojiDisc emoji={s.emoji} icon={s.icon} tint={s.tint} size={32} />
                {s.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
