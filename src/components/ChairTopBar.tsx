'use client';

// ─────────────────────────────────────────────────────────────────────────────
// ChairTopBar primitives: the pieces of the chair console's top bar.
//
// Layout (owned by the chair page, which keeps every handler): the forest sidebar
// runs the full height of the screen, and this ivory bar starts at its inline-end
// edge. There is no product logo. Inline-start: the three primary controls
// (Roll Call, Motions, Documents) as TopBarTab, each an EQUAL share of the space left of
// the icon cluster (flex-1, basis 0) with its label centred, as the tabs were before the
// redesign. Inline-end: the session code (click to present it full screen), then
// small TopBarIconButtons for Chat (with its unread count), Scoreboard and Settings.
//
// Two rows when space is short (18 Sep 2026, owner: "on smaller screens the Roll Call /
// Motions / Documents tabs almost disappear"). `useTopBarTwoRows` measures the room left of
// the icon cluster against what the three labels (and their counts) need at full width;
// when it is short the caller drops the tabs into a second 44px row under the cluster,
// each tab an equal third of the full width, and the header is 88px tall. The icon
// cluster always stays in row one. The chair page passes the taller top to
// NotificationStack (`topPx`), so cards never cover the second row.
//
// No separators and no borders: the active tab is a forest wash plus a gold
// underline, counts are inline pills that never cover the label, and every icon
// button has an accessible name, a tooltip, a 40px hit area and a visible
// keyboard focus ring. Every `data-tutorial` attribute is passed through by the
// caller, so the tutorial spotlights still find their targets.
// ─────────────────────────────────────────────────────────────────────────────

import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';

const OUTFIT = "var(--font-brand), sans-serif";

function CountPill({ n, inverted = false }: { n: number; inverted?: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-full tabular-nums shrink-0"
      style={{
        minWidth: 20, height: 20, padding: '0 6px',
        fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, lineHeight: 1,
        backgroundColor: inverted ? '#EED98A' : '#1B3828',
        color: inverted ? '#1B3828' : '#EED98A',
      }}
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}

export function TopBarTab({
  label,
  active,
  onClick,
  count = 0,
  countLabel,
  tutorial,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  /** Items waiting behind this control (pending motions, submitted documents). */
  count?: number;
  /** Accessible name when a count is shown, e.g. "Motions, 2 new". */
  countLabel?: string;
  tutorial?: string;
}) {
  return (
    <button
      type="button"
      data-tutorial={tutorial}
      data-topbar-tab
      onClick={onClick}
      aria-pressed={active}
      aria-label={count > 0 && countLabel ? countLabel : undefined}
      className="group relative h-full min-w-0 flex-1 basis-0 flex items-center justify-center gap-2 px-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#B6871F] rounded-lg transition-[background-color,color] duration-150 hover:bg-[rgba(27,56,40,0.05)] active:scale-[0.98] motion-reduce:transition-none"
      style={{
        fontFamily: OUTFIT,
        fontSize: 17,
        fontWeight: active ? 800 : 600,
        color: active ? '#1B3828' : '#3A2E26',
        backgroundColor: active ? 'rgba(27,56,40,0.08)' : undefined,
      }}
    >
      <span data-topbar-label className="truncate">{label}</span>
      {count > 0 && <span data-topbar-pill className="inline-flex shrink-0"><CountPill n={count} /></span>}
      <span
        aria-hidden
        className="absolute rounded-full motion-reduce:transition-none"
        style={{
          insetInline: 14, bottom: 5, height: 3,
          backgroundColor: '#B6871F',
          transform: active ? 'scaleX(1)' : 'scaleX(0)',
          transition: 'transform 200ms cubic-bezier(0.22,1,0.36,1)',
        }}
      />
    </button>
  );
}

export function TopBarIconButton({
  label,
  onClick,
  children,
  active = false,
  count = 0,
  tutorial,
}: {
  /** Accessible name and tooltip. Include the count in it when there is one. */
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  /** Small badge on the icon's corner (unread chat). */
  count?: number;
  tutorial?: string;
}) {
  return (
    <button
      type="button"
      data-tutorial={tutorial}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      className="relative shrink-0 inline-flex items-center justify-center rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-[background-color,color] duration-150 hover:bg-[rgba(27,56,40,0.07)] hover:text-[#1B3828] active:scale-[0.96] motion-reduce:transition-none"
      style={{
        width: 40, height: 40,
        color: active ? '#1B3828' : '#5E4E40',
        backgroundColor: active ? 'rgba(27,56,40,0.10)' : undefined,
        lineHeight: 0,
      }}
    >
      {children}
      {count > 0 && (
        <span className="absolute" style={{ top: 2, insetInlineEnd: 0 }}>
          <CountPill n={count} />
        </span>
      )}
    </button>
  );
}

/** Height of one top-bar row in layout px (the header is one or two of these). */
export const TOP_BAR_ROW_PX = 44;

/**
 * True when the three tabs cannot show their full labels beside the icon cluster, i.e. the
 * caller should lay them out in a second row. Measures in layout px (FitToScreen's transform
 * does not affect offsetWidth / scrollWidth): the header's inner width minus the cluster's
 * width, against each tab's label width + count + padding. The answer does not depend on
 * which layout is showing, so it cannot flip-flop. Re-measured by a ResizeObserver on the
 * header and the cluster, and whenever `key` changes (language, counts, whether the tabs are
 * rendered); never per second. State changes only when the answer changes.
 */
export function useTopBarTwoRows(
  headerRef: RefObject<HTMLElement | null>,
  navRef: RefObject<HTMLElement | null>,
  clusterRef: RefObject<HTMLElement | null>,
  key: string,
): boolean {
  const [twoRows, setTwoRows] = useState(false);
  useLayoutEffect(() => {
    const header = headerRef.current;
    const nav = navRef.current;
    const cluster = clusterRef.current;
    const measure = () => {
      let next = false;
      if (header && nav && cluster) {
        const cs = getComputedStyle(header);
        const inner = header.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
        const available = inner - cluster.offsetWidth - 6;
        let needed = 0;
        nav.querySelectorAll<HTMLElement>('[data-topbar-tab]').forEach((tab) => {
          const label = tab.querySelector<HTMLElement>('[data-topbar-label]');
          const pill = tab.querySelector<HTMLElement>('[data-topbar-pill]');
          needed += 32 + (label?.scrollWidth ?? 0) + (pill ? pill.offsetWidth + 8 : 0) + 4;
        });
        next = available < needed;
      }
      setTwoRows((prev) => (prev === next ? prev : next));
    };
    measure();
    if (!header || !cluster) return;
    const ro = new ResizeObserver(measure);
    ro.observe(header);
    ro.observe(cluster);
    return () => ro.disconnect();
  }, [headerRef, navRef, clusterRef, key]);
  return twoRows;
}
