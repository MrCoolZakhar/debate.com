'use client';

/**
 * "Copy from another role" (12 Oct 2026; owner: copying TO another role could
 * put an empty form over a role that was already set up, by accident).
 *
 * Copying now always runs INTO the role being edited: on its pop-up the
 * organiser picks a source role, and only roles that actually have that thing
 * set up are offered (a price, questions, an application window). The page
 * then asks before it replaces anything ("Replace this role's questions with
 * Delegates' questions?") and writes through its own save helpers.
 *
 * Presentation only. The menu is portaled at fixed coordinates (flipped above
 * near the bottom, clamped on screen) above the role pop-up, so no card can
 * clip it; Escape closes the menu and never the pop-up underneath.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import Portal from '@/components/Portal';
import { F, INK, INK_SOFT, TEXT_LINK, TYPE, TYPE_PX, RoleDisc, TINT_GREEN_BG, rolePlural } from './panelKit';

export interface CopySource {
  role: string;
  /** What would be copied, in a few words: "USD 120 · 2 stages". */
  detail: string;
}

/** "Delegates'" / "Staff's". */
export function rolePossessive(role: string): string {
  const p = rolePlural(role);
  return p.endsWith('s') ? `${p}'` : `${p}'s`;
}

const MENU_W = 280;

export function CopyFromMenu({ what, sources, onPick }: {
  /** "questions", "prices", "dates": names the empty state. */
  what: string;
  sources: CopySource[];
  onPick: (role: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const empty = sources.length === 0;

  const place = useCallback(() => {
    const b = btnRef.current;
    const m = menuRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const h = m?.offsetHeight ?? 60 + sources.length * 58;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - MENU_W - 8);
    const below = r.bottom + 6;
    const top = below + h > window.innerHeight - 8 && r.top - h - 6 > 8 ? r.top - h - 6 : below;
    setPos(prev => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
  }, [sources.length]);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    // Capture phase, so the role pop-up's own Escape (a document listener that
    // honours defaultPrevented) never also closes the pop-up.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      btnRef.current?.focus();
    };
    // Portal mounts its children a render later: measure the real menu then.
    const t = window.setTimeout(() => { place(); menuRef.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true }); }, 20);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  function moveFocus(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('button') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (items.length === 0) return;
    e.preventDefault();
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={empty}
        aria-haspopup="menu"
        aria-expanded={open}
        title={empty ? `No other role has ${what} yet` : undefined}
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 rounded"
        style={{ ...TEXT_LINK, fontSize: TYPE_PX.body, opacity: empty ? 0.45 : 1, cursor: empty ? 'default' : 'pointer', textDecoration: empty ? 'none' : TEXT_LINK.textDecoration }}
      >
        <Copy size={14} strokeWidth={2.4} aria-hidden />
        Copy from another role
      </button>
      {open && (
        <Portal>
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Copy ${what} from`}
            onKeyDown={moveFocus}
            style={{
              position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, zIndex: 60, width: MENU_W,
              background: '#FFFFFF', borderRadius: 16, padding: 6,
              boxShadow: '0 1px 0 rgba(27,56,40,0.08), 0 18px 40px -14px rgba(27,56,40,0.45), inset 0 0 0 1px rgba(27,56,40,0.08)',
            }}
          >
            <p className="px-2.5 pt-1.5 pb-1" style={{ ...TYPE.hint, fontWeight: 700 }}>Copy {what} from</p>
            {sources.map(s => (
              <button
                key={s.role}
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); onPick(s.role); }}
                className="w-full flex items-center gap-2.5 text-left rounded-xl focus:outline-none focus-visible:ring-2 hover:bg-[#FAF8F3]"
                style={{ padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: F }}
              >
                <RoleDisc role={s.role} tint={TINT_GREEN_BG} size={36} />
                <span className="min-w-0">
                  <span className="block" style={{ fontSize: TYPE_PX.body, fontWeight: 700, color: INK, overflowWrap: 'anywhere' }}>{rolePlural(s.role)}</span>
                  <span className="block" style={{ fontSize: TYPE_PX.hint, color: INK_SOFT, overflowWrap: 'anywhere' }}>{s.detail}</span>
                </span>
              </button>
            ))}
          </div>
        </Portal>
      )}
    </>
  );
}
