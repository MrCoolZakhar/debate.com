'use client';

// ── Toast ──────────────────────────────────────────────────────────────────
// Floating, matte-glass action-feedback notifications for the conferences
// side. Replaces the old inline flash banner (which shifted the page as it
// appeared/disappeared). A toast is a `position: fixed` overlay portaled to
// #fit-root so it never moves page layout: it slides + fades in at the
// top-right, states the action succinctly, and auto-dismisses after ~2.2s
// (hover pauses the timer). Up to a few stack vertically.
//
// Self-contained imperative helper: a module-level store + <ToastHost/>
// subscriber, so any surface can fire a toast without threading a provider
// through props. `useToast()` returns the stable `toast(kind, msg)` fn; the
// existing `showFlash(kind, msg)` signature maps onto it 1:1.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { NEU } from '@/components/neu';
import Portal from '@/components/Portal';

const OUTFIT = "'Outfit', sans-serif";
const EASE = 'cubic-bezier(0.22,1,0.36,1)';
const DISMISS_MS = 2200;
const ANIM_MS = 240;
const MAX_STACK = 4;

export type ToastKind = 'ok' | 'err';
interface ToastItem {
  id: number;
  kind: ToastKind;
  msg: string;
}

// ── Module-level store ───────────────────────────────────────────────────────
let toasts: ToastItem[] = [];
const EMPTY: ToastItem[] = [];
const listeners = new Set<() => void>();
let seq = 0;

function emit() {
  for (const l of listeners) l();
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
function getSnapshot(): ToastItem[] {
  return toasts;
}

/** Fire a toast. Same argument shape as the old `showFlash(kind, msg)`. */
export function toast(kind: ToastKind, msg: string) {
  seq += 1;
  // Collapse an immediate exact-duplicate (e.g. a double-fire) into one.
  const last = toasts[toasts.length - 1];
  if (last && last.kind === kind && last.msg === msg) return;
  toasts = [...toasts, { id: seq, kind, msg }].slice(-MAX_STACK);
  emit();
}

function removeToast(id: number) {
  toasts = toasts.filter(t => t.id !== id);
  emit();
}

/** Stable accessor for React callers. */
export function useToast() {
  return toast;
}

// ── Single toast card ────────────────────────────────────────────────────────
function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const beginLeave = () => {
    if (leaveRef.current) return;
    setLeaving(true);
    leaveRef.current = setTimeout(() => onDismiss(item.id), ANIM_MS);
  };
  const arm = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(beginLeave, DISMISS_MS);
  };
  const disarm = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    arm();
    return () => {
      cancelAnimationFrame(raf);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (leaveRef.current) clearTimeout(leaveRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ok = item.kind === 'ok';
  const accent = ok ? NEU.green : '#8B2020';
  const Icon = ok ? CheckCircle2 : AlertCircle;
  const visible = shown && !leaving;

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={disarm}
      onMouseLeave={arm}
      className="flex items-center gap-2.5 pointer-events-auto"
      style={{
        minWidth: 240,
        maxWidth: 'min(92vw, 380px)',
        padding: '11px 12px 11px 14px',
        borderRadius: 16,
        // Matte glass: a semi-opaque ivory surface over a soft blur, so the
        // toast reads as its own frosted pane floating above the board.
        backgroundColor: 'rgba(240,235,221,0.72)',
        backdropFilter: 'blur(10px) saturate(1.35)',
        WebkitBackdropFilter: 'blur(10px) saturate(1.35)',
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.5), ${NEU.out}, 0 16px 34px rgba(27,56,40,0.18)`,
        borderLeft: `3px solid ${accent}`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(18px)',
        transition: `opacity ${ANIM_MS}ms ${EASE}, transform ${ANIM_MS}ms ${EASE}`,
      }}
    >
      <Icon size={17} strokeWidth={2.4} style={{ color: accent, flexShrink: 0 }} />
      <span
        className="flex-1 min-w-0"
        style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: NEU.ink, lineHeight: 1.35 }}
      >
        {item.msg}
      </span>
      <button
        onClick={beginLeave}
        aria-label="Dismiss notification"
        className="focus:outline-none flex-shrink-0"
        style={{ color: NEU.muted, lineHeight: 0, background: 'none', border: 'none', cursor: 'pointer' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = NEU.ink; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = NEU.muted; }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Host ─────────────────────────────────────────────────────────────────────
// Mount once per page. Subscribes to the module store and renders the live
// stack through a Portal. Fixed at the top-right; never affects page flow.
export function ToastHost() {
  const items = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  if (items.length === 0) return null;
  return (
    <Portal>
      <div
        className="fixed flex flex-col gap-2 pointer-events-none"
        style={{ top: 20, right: 20, zIndex: 9999, alignItems: 'flex-end' }}
      >
        {items.map(item => (
          <ToastCard key={item.id} item={item} onDismiss={removeToast} />
        ))}
      </div>
    </Portal>
  );
}
