'use client';
// Gavelling Crisis: the one simple dialog shell for the delegate page and the news dialog.
// Portal, scrim, Escape closes, focus moves in and comes back, the body scrolls inside, and on a
// phone it fills the screen. A dialog never opens another on top of itself: a second step swaps
// the content and shows a back button (onBack).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { CK, useScrollLock } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import CharacterModal from '../character/CharacterModal';
import { InPlaceCharacterScope, useOpenCharacter } from '../character/CharacterProfileHost';

function Panel({ title, eyebrow, onClose, onBack, children, width, flush, step, quiet }: {
  title: string; eyebrow?: string; onClose: () => void; onBack?: () => void; children: ReactNode; width: number; flush?: boolean; step?: string;
  /** A character profile is showing in place of this dialog: Escape belongs to the profile. */
  quiet?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  const quietRef = useRef(!!quiet);
  useEffect(() => { quietRef.current = !!quiet; });
  useScrollLock();

  useEffect(() => {
    const el = panel.current;
    const before = document.activeElement as HTMLElement | null;
    el?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (quietRef.current) return;
      if (e.key === 'Escape') {
        // A dropdown inside the page closes first.
        if (document.querySelector('[data-crisis-popover]') || e.defaultPrevented) return;
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const nodes = Array.from(el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'))
        .filter((n) => n.offsetParent !== null);
      if (!nodes.length) { e.preventDefault(); return; }
      const first = nodes[0]; const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === el)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      before?.focus?.();
    };
  }, []);

  const iconBtn = {
    border: 0, background: CK.card, borderRadius: 10, width: 36, height: 36, cursor: 'pointer', color: CK.forest, boxShadow: CK.shadowSm,
    display: 'grid', placeItems: 'center', flexShrink: 0,
  } as const;

  return (
    <div className="crisis-dlg-wrap" style={{ position: 'fixed', inset: 0, zIndex: 200, fontFamily: CK.font, display: 'grid', placeItems: 'center' }}>
      <style>{`
        .crisis-dlg-panel { width: min(${width}px, calc(100vw - 32px)); max-height: calc(100dvh - 48px); border-radius: 24px; }
        @media (max-width: 639px) { .crisis-dlg-panel { width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 0; } }
        @keyframes crisis-dlg-in { from { opacity: 0; transform: translateY(12px) scale(0.985); } to { opacity: 1; transform: none; } }
        .crisis-dlg-panel { animation: crisis-dlg-in 200ms cubic-bezier(0.22,1,0.36,1); }
        @media (prefers-reduced-motion: reduce) { .crisis-dlg-panel { animation: none; } }
      `}</style>
      <div aria-hidden onMouseDown={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(58,14,15,0.42)' }} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="crisis-dlg-panel focus:outline-none"
        style={{ position: 'relative', background: CK.surface, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(58,14,15,0.35)' }}
      >
        <div className="flex items-center gap-3" style={{ padding: '12px 14px 12px 16px', borderBottom: `1px solid ${CK.hair}`, background: CK.card }}>
          {onBack && (
            <button type="button" onClick={onBack} aria-label="Back" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={iconBtn}>
              <ArrowLeft size={18} strokeWidth={1.6} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: CK.red, overflowWrap: 'anywhere' }}>{eyebrow}</p>}
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]" style={iconBtn}>
            <X size={18} strokeWidth={1.6} />
          </button>
        </div>
        <div key={step ?? 'main'} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: flush ? 0 : '16px 18px 22px' }}>{children}</div>
      </div>
    </div>
  );
}

export default function CrisisDialog(props: {
  title: string; eyebrow?: string; onClose: () => void; onBack?: () => void; children: ReactNode; width?: number; flush?: boolean;
  /** Change it when the content is swapped for another step, so the body scrolls back to the top. */
  step?: string;
}) {
  // A character name inside this dialog swaps the dialog for that character's profile (a pop-up never opens another on
  // top of itself). The dialog stays mounted, only hidden, so what was typed in it is still there when the profile closes.
  const { core } = useCrisis();
  const openGlobal = useOpenCharacter();
  const [profile, setProfile] = useState<string | null>(null);
  const onOpen = (id: string) => { if (core.characters.some((c) => c.id === id)) setProfile(id); else openGlobal(id); };
  return (
    <>
      <Portal>
        <InPlaceCharacterScope onOpen={onOpen}>
          <div style={profile ? { display: 'none' } : undefined}>
            <Panel title={props.title} eyebrow={props.eyebrow} onClose={props.onClose} onBack={props.onBack} width={props.width ?? 720} flush={props.flush} step={props.step} quiet={!!profile}>
              {props.children}
            </Panel>
          </div>
        </InPlaceCharacterScope>
      </Portal>
      {profile && <CharacterModal key={profile} characterId={profile} onClose={() => setProfile(null)} />}
    </>
  );
}
