'use client';
// Gavelling Crisis map: real full screen for the map. The browser's Fullscreen API is put on the map's own container (the
// toolbar, the map and the side panels all go with it), with the webkit names as a fallback. The state follows the
// browser's own fullscreenchange event, so Escape (which the browser handles itself) and every other way out keep the
// button right. The caller is told after every change so it can resize the map. Writes nothing.

import { useEffect, useRef, useState, type RefObject } from 'react';

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const fsElement = (): Element | null => {
  const d = document as FsDoc;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
};

/** Styles for the container while it is full screen (the ivory page colour behind the map, a little room round it). */
export const FULLSCREEN_CSS = `
.wm-root[data-fs]{background:#EDE7D8;padding:12px 16px;box-sizing:border-box;width:100%;height:100%!important;min-height:0;overflow:auto}
.wm-root[data-fs]:not([data-compact]) .wm-body{min-height:240px}
`;

export interface Fullscreen {
  /** The container is full screen right now. */
  active: boolean;
  /** Enters full screen, or leaves it. Answers false when the browser would not (no support, or it refused). */
  toggle: () => Promise<boolean>;
}

export function useFullscreen(target: RefObject<HTMLElement | null>, onChange?: () => void): Fullscreen {
  const [active, setActive] = useState(false);
  const change = useRef(onChange);
  useEffect(() => { change.current = onChange; });

  useEffect(() => {
    const el = target.current;
    const sync = () => {
      setActive(!!el && fsElement() === el);
      change.current?.();
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
      // Leaving the page while full screen: let the browser out of it.
      if (el && fsElement() === el) {
        const d = document as FsDoc;
        try { void (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.()); } catch { /* already out */ }
      }
    };
  }, [target]);

  // A plain function (not memoised): it reads the ref when pressed.
  const toggle = async () => {
    const el = target.current as FsEl | null;
    if (!el) return false;
    const d = document as FsDoc;
    try {
      if (fsElement()) {
        await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
        return true;
      }
      const ask = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
      if (!ask) return false;
      await ask();
      return true;
    } catch {
      return false;
    }
  };

  return { active, toggle };
}
