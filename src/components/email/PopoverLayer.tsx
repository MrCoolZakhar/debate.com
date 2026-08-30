'use client';

// The house rule for floating layers (AGENTS.md → UI RULES): a menu, dropdown
// or typeahead must NEVER be clipped by an ancestor's overflow or run off the
// viewport. So it is portaled out of the tree and positioned in FIXED viewport
// coordinates measured from its trigger, repositioned on scroll (capture, so
// scrolling ANY ancestor counts) and on resize, flipped upward when there is
// no room below, and clamped to the window's edges.
//
// Written once here because the email builder floats three of these — the
// "add a filter" menu, the add-a-person typeahead, and the preview-as picker —
// and they must all behave identically.
//
// Placement is written STRAIGHT TO THE NODE'S STYLE rather than held in state:
// a measure-then-setState loop is a render per scroll frame (and trips
// react-hooks/set-state-in-effect). The layer therefore mounts hidden and is
// revealed by the same pass that positions it, so it never paints at 0,0.

import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import Portal from '@/components/Portal';

/** Keep-off-the-edge inset, and the gap between trigger and layer. */
const MARGIN = 8;
const GAP = 6;

export interface PopoverLayerProps {
  /** The trigger. Its rect is what the layer is measured from. */
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  width: number;
  /** The layer's own cap; also what the flip decision is made against. */
  maxHeight?: number;
  /** `start` aligns the layer's left edge to the trigger's, `end` its right. */
  align?: 'start' | 'end';
  children: ReactNode;
}

export default function PopoverLayer({
  anchorRef, open, onClose, width, maxHeight = 280, align = 'start', children,
}: PopoverLayerProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);

  const place = useCallback(() => {
    const trigger = anchorRef.current;
    const layer = layerRef.current;
    if (!trigger || !layer) return;
    const r = trigger.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - GAP - MARGIN;
    const above = r.top - GAP - MARGIN;
    const wantsUp = below < Math.min(maxHeight, 160) && above > below;
    const rawLeft = align === 'end' ? r.right - width : r.left;
    const left = Math.max(MARGIN, Math.min(rawLeft, window.innerWidth - width - MARGIN));

    layer.style.left = `${Math.round(left)}px`;
    if (wantsUp) {
      layer.style.top = 'auto';
      layer.style.bottom = `${Math.round(window.innerHeight - r.top + GAP)}px`;
      layer.style.maxHeight = `${Math.max(120, Math.min(maxHeight, above))}px`;
    } else {
      layer.style.bottom = 'auto';
      layer.style.top = `${Math.round(r.bottom + GAP)}px`;
      layer.style.maxHeight = `${Math.max(120, Math.min(maxHeight, below))}px`;
    }
    layer.style.visibility = 'visible';
  }, [anchorRef, align, width, maxHeight]);

  /** Placement runs the moment the node ATTACHES, not in an effect: `Portal`
   *  renders null on its first pass (it resolves its mount target in its own
   *  effect), so by the time this component's effect fires the layer does not
   *  exist yet and a place() there would measure nothing and leave the layer
   *  hidden forever. */
  const attachLayer = useCallback((el: HTMLDivElement | null) => {
    layerRef.current = el;
    if (el) place();
  }, [place]);

  useEffect(() => {
    if (!open) return;
    place();
    const reposition = () => place();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (layerRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, place, onClose, anchorRef]);

  if (!open) return null;

  return (
    <Portal>
      <div
        ref={attachLayer}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width,
          maxHeight,
          overflowY: 'auto',
          zIndex: 200,
          visibility: 'hidden',
        }}
      >
        {children}
      </div>
    </Portal>
  );
}
