'use client';

/**
 * A small note that slides up from the BOTTOM centre of the screen and leaves
 * by itself after about two seconds ("Email copied" on the public conference
 * page; owner, 18 Oct 2026, asked for the bottom, not the usual glass card top
 * right). Self-contained: `showBottomToast(message)` from anywhere, and ONE
 * `<BottomToastHost />` mounted by the page draws it. Writes nothing.
 *
 * Below 1024px it sits above the phone tab bar (MobileTabBar, 62px) and the
 * safe-area inset; from 1024px just above the safe-area inset.
 */

import { useSyncExternalStore } from 'react';
import { CheckCircle2 } from 'lucide-react';
import Portal from '@/components/Portal';

const HIDE_AFTER_MS = 2000;

/** `message` stays after `on` turns false so the note slides out with its
 *  words still on it. */
type ToastState = { id: number; message: string; on: boolean };

let current: ToastState = { id: 0, message: '', on: false };
const EMPTY: ToastState = current;
let seq = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function showBottomToast(message: string) {
  seq += 1;
  current = { id: seq, message, on: true };
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    current = { ...current, on: false };
    hideTimer = null;
    emit();
  }, HIDE_AFTER_MS);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

const TOAST_CSS = `
.gv-bottom-toast{position:fixed;left:50%;z-index:1200;pointer-events:none;
  bottom:calc(env(safe-area-inset-bottom, 0px) + 62px + 16px);
  transform:translate(-50%, 16px);opacity:0;
  transition:transform 240ms cubic-bezier(.32,.72,0,1),opacity 200ms ease}
.gv-bottom-toast[data-on="true"]{transform:translate(-50%, 0);opacity:1}
@media (min-width: 1024px){.gv-bottom-toast{bottom:calc(env(safe-area-inset-bottom, 0px) + 24px)}}
@media (prefers-reduced-motion: reduce){.gv-bottom-toast,.gv-bottom-toast[data-on="true"]{transform:translate(-50%, 0);transition:opacity 150ms ease}}
`;

export function BottomToastHost() {
  const { message: text, on } = useSyncExternalStore(subscribe, () => current, () => EMPTY);

  return (
    <Portal>
      <style>{TOAST_CSS}</style>
      <div
        className="gv-bottom-toast"
        data-on={on ? 'true' : 'false'}
        role="status"
        aria-live="polite"
      >
        {text && (
          <span
            className="inline-flex items-center gap-2"
            style={{
              padding: '10px 16px',
              borderRadius: 9999,
              backgroundColor: 'rgba(255,255,255,0.96)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 10px 28px rgba(27,56,40,0.18), 0 1px 3px rgba(27,56,40,0.10)',
              fontFamily: 'var(--font-brand), sans-serif',
              fontSize: 14,
              fontWeight: 600,
              color: '#1C1410',
              whiteSpace: 'nowrap',
            }}
          >
            <CheckCircle2 size={17} strokeWidth={2.2} aria-hidden style={{ color: '#1B3828' }} />
            {on ? text : <span aria-hidden>{text}</span>}
          </span>
        )}
      </div>
    </Portal>
  );
}
