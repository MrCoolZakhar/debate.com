'use client';

// ── Background scroll lock, one shared implementation ─────────────────────────
//
// House rule: while a MODAL surface is open (dialog, confirm, drawer, sheet,
// blocking full-screen gate) the page behind it must not scroll. This is the
// single implementation of that — do not hand-roll `document.body.style.overflow`
// in a component again.
//
// It is deliberately NOT for non-modal floating layers (dropdown menus, select
// popovers, typeaheads, tooltips, hover cards). Those are expected to reposition
// on scroll or close — see the PaymentMenu portal pattern in AGENTS.md — and
// freezing the page for a dropdown is a regression, not a fix.
//
// What it handles:
//
//  • iOS Safari. `body { overflow: hidden }` alone does NOT stop the background
//    scrolling on iOS. The reliable technique is to record `window.scrollY`,
//    then pin the body with `position: fixed; top: -scrollY; width: 100%`,
//    restoring both the styles and the exact scroll position on unlock. That
//    also removes the document's scroll range outright, so even a programmatic
//    `window.scrollBy()` behind the dialog cannot move the page.
//
//  • No layout shift. Taking the scrollbar out of flow reflows the page and
//    everything jumps sideways — in-flow content AND any `position: fixed`
//    chrome (the manage header does exactly this). The fix is to keep the
//    gutter rather than compensate for it: when the document had a classic
//    scrollbar, `<html>` is left at `overflow-y: scroll`, so the (now
//    thumbless) track still reserves its width and `clientWidth` never
//    changes. `scrollbar-gutter: stable` was measured and does NOT survive
//    `overflow: hidden`, so it is not used. Anything the browser still shifts
//    is measured after the fact and paid back as body padding; the amount is
//    also published as `--scroll-lock-gap`.
//
//  • Stacking. A confirm opened on top of a drawer must not release the
//    drawer's lock when it closes. Locks are reference counted at module level;
//    only the 0→1 transition applies styles and only the 1→0 transition undoes
//    them, against the scroll position captured by the first locker.
//
//  • Unmount safety. The lock lives in a `useEffect` cleanup, so a modal that
//    disappears without a clean close — route change, error boundary, parent
//    conditionally unmounting it — still releases. A stuck lock leaves the whole
//    app unscrollable, which is far worse than the bug being fixed.
//
//  • SSR safety. Nothing touches `document` during render; all DOM access is
//    inside the effect.

import { useEffect } from 'react';

interface SavedStyles {
  rootOverflow: string;
  rootOverflowY: string;
  rootGap: string;
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  bodyPaddingRight: string;
}

// Module-level so every caller on the page shares one counter, whatever
// component tree they live in.
let lockCount = 0;
let saved: SavedStyles | null = null;
let savedScrollY = 0;

function applyLock() {
  const root = document.documentElement;
  const body = document.body;

  savedScrollY = window.scrollY || root.scrollTop || 0;
  saved = {
    rootOverflow: root.style.overflow,
    rootOverflowY: root.style.overflowY,
    rootGap: root.style.getPropertyValue('--scroll-lock-gap'),
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
    bodyPaddingRight: body.style.paddingRight,
  };

  // Measure the layout width BEFORE anything changes, so any shift the lock
  // causes can be detected and paid back below.
  const widthBefore = root.clientWidth;
  const hadGutter = window.innerWidth - widthBefore > 0;

  if (hadGutter) {
    // A classic scrollbar was taking layout width. Keep its track (it loses
    // its thumb, because a fixed body contributes nothing to scrollable
    // overflow) so the page width is unchanged. `overflow: hidden` here is
    // what used to move everything 6px left, fixed headers included.
    root.style.overflowY = 'scroll';
  } else {
    // Overlay scrollbars (macOS/iOS) or a page that never scrolled: nothing to
    // preserve, and forcing a track would *introduce* a shift.
    root.style.overflow = 'hidden';
  }

  // `position: fixed` is the part that actually holds on iOS Safari, and it
  // removes the document's scroll range so even a programmatic scroll is inert.
  body.style.position = 'fixed';
  body.style.top = `-${savedScrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';

  // Belt and braces: if the browser still narrowed the page, pay the
  // difference back as padding. `* { box-sizing: border-box }` is global, so
  // this shrinks the content box by exactly the width that disappeared.
  const shift = Math.max(0, widthBefore - root.clientWidth);
  if (shift > 0) body.style.paddingRight = `${shift}px`;
  root.style.setProperty('--scroll-lock-gap', `${shift}px`);
}

function releaseLock() {
  const root = document.documentElement;
  const body = document.body;
  const prev = saved;

  root.style.overflow = prev ? prev.rootOverflow : '';
  root.style.overflowY = prev ? prev.rootOverflowY : '';
  if (prev && prev.rootGap) root.style.setProperty('--scroll-lock-gap', prev.rootGap);
  else root.style.removeProperty('--scroll-lock-gap');

  body.style.position = prev ? prev.bodyPosition : '';
  body.style.top = prev ? prev.bodyTop : '';
  body.style.left = prev ? prev.bodyLeft : '';
  body.style.right = prev ? prev.bodyRight : '';
  body.style.width = prev ? prev.bodyWidth : '';
  body.style.paddingRight = prev ? prev.bodyPaddingRight : '';

  saved = null;
  // Undoing `top: -scrollY` leaves the document at 0; put it back exactly.
  window.scrollTo(0, savedScrollY);
}

/**
 * Freeze background page scroll while `active` is true.
 *
 * ```tsx
 * useScrollLock(open);          // inside the modal component
 * useScrollLock(!!openDialogId) // or keyed off whichever dialog is open
 * ```
 *
 * Safe to call unconditionally with `false` — hooks must not be conditional.
 * Safe to nest: N concurrent locks release as one.
 */
export function useScrollLock(active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    if (typeof document === 'undefined') return;

    lockCount += 1;
    if (lockCount === 1) applyLock();

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) releaseLock();
    };

    // Belt and braces: a full-page teardown (bfcache eviction, hard navigation)
    // that skips React cleanup would otherwise persist the inline styles.
    window.addEventListener('pagehide', release);
    return () => {
      window.removeEventListener('pagehide', release);
      release();
    };
  }, [active]);
}

export default useScrollLock;
