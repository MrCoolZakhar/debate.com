'use client';
// Gavelling Crisis: a directive opened in the backroom, as a pop-up shaped like the organiser's
// committee editor: the MAIN pop-up (a chat: the directive, the notes, and the composer with the
// outcome) with a SIDE panel docked right next to it, "What happens when you send" (it starts empty;
// a plus adds cards for resources, unit moves, borders, characters, news). Both are the same height
// and scroll on their own. On a screen narrower than 1000px the
// side panel is a second step reached by a button, with a back button, never a pop-up on a pop-up.
// A pop-up never opens another on top of itself, so nothing in here opens one.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, Send, Zap } from 'lucide-react';
import Portal from '@/components/Portal';
import type { Directive } from '@/lib/crisis/types';
import { Btn, CK } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { authorName, buildNames } from './directiveKit';
import DirectiveMain, { EffectsStepButton } from './DirectiveMain';
import EffectsPanel from './EffectsPanel';
import { countChanges } from './replyDraft';
import { useDirectiveReply } from './useDirectiveReply';

export interface DirectivePopupProps {
  directive: Directive;
  onClose: () => void;
  /** Called after this person claimed, handed over or answered. */
  onChanged?: (what: 'claimed' | 'assigned' | 'answered') => void;
  /** Bump to re-read the notes (the inbox does it on a live ping). */
  notesVersion?: number;
}

const NARROW = '(max-width: 999px)';
function useNarrow(): boolean {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(NARROW); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}

export default function DirectivePopup(props: DirectivePopupProps) {
  // One fresh state per directive.
  return <PopupInner key={props.directive.id} {...props} />;
}

function PopupInner({ directive: d, onClose, onChanged, notesVersion }: DirectivePopupProps) {
  const { ref, core, director, settings, staff } = useCrisis();
  const names = useMemo(() => buildNames(core.cabinets, core.characters, core.members), [core]);
  const who = authorName(d, names);
  const character = d.author_character_id ? names.characters.get(d.author_character_id) : undefined;
  const powers = useMemo(() => ({
    resources: director || settings.backroomPowers.resources,
    units: director || settings.backroomPowers.units,
    map: director || settings.backroomPowers.map,
  }), [director, settings.backroomPowers]);
  const reply = useDirectiveReply(ref, d, who, powers, () => onChanged?.('answered'));
  const narrow = useNarrow();
  const [step, setStep] = useState<'main' | 'effects'>('main');
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const stepRef = useRef(step);
  useEffect(() => { closeRef.current = onClose; stepRef.current = step; });

  useEffect(() => {
    const el = panel.current;
    const before = document.activeElement as HTMLElement | null;
    el?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
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
      document.body.style.overflow = prevOverflow;
      before?.focus?.();
    };
  }, []);

  if (!staff) return null;

  const changeCount = countChanges(reply.effects);
  // The changes only matter while a reply is being written.
  const showForm = d.status !== 'answered' || reply.editing;
  const shownStep = showForm ? step : 'main';
  const showMain = !narrow || shownStep === 'main';
  const showSide = showForm && (!narrow || shownStep === 'effects');

  const sidePanel = (
    <aside
      aria-label="What happens when you send"
      className="dp-side flex flex-col"
      style={{ background: CK.surface, borderRadius: 'var(--dp-r)', overflow: 'hidden', boxShadow: '0 24px 60px rgba(58,14,15,0.35)', minWidth: 0 }}
    >
      <div className="flex items-center" style={{ flex: 'none', gap: 10, padding: '14px 16px', background: CK.card, boxShadow: `0 1px 0 ${CK.hair}` }}>
        {narrow && (
          <button type="button" onClick={() => setStep('main')} aria-label="Back to the directive" title="Back to the directive"
            className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
            style={{ width: 36, height: 36, border: 0, borderRadius: 10, background: CK.card, boxShadow: CK.shadowSm, color: CK.forest, cursor: 'pointer', flex: 'none' }}>
            <ArrowLeft size={18} strokeWidth={1.6} />
          </button>
        )}
        <Zap size={19} strokeWidth={1.5} aria-hidden style={{ color: CK.red, flex: 'none' }} />
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>What Happens When You Send</h2>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 14px 18px' }}>
        <EffectsPanel
          crisisRef={ref}
          authorCharacterId={d.author_character_id}
          cabinetId={d.cabinet_id ?? character?.cabinet_id ?? null}
          powers={powers}
          effects={reply.effects}
          setEffects={reply.setEffects}
        />
      </div>
      {narrow && showForm && (
        <div className="flex items-center justify-between" style={{ flex: 'none', gap: 8, padding: '10px 16px 12px', background: CK.card, boxShadow: `0 -1px 0 ${CK.hair}` }}>
          <Btn tone="ghost" icon={<ArrowLeft size={15} strokeWidth={1.5} />} onClick={() => setStep('main')}>Back</Btn>
          <Btn tone="green" icon={<Send size={15} strokeWidth={1.5} />} onClick={reply.send} disabled={!reply.canSend}>{reply.busy ? 'Sending' : 'Send reply'}</Btn>
        </div>
      )}
    </aside>
  );

  return (
    <Portal>
      <div className="dp-wrap" style={{ fontFamily: CK.font, color: CK.ink }}>
        <style>{`
          .dp-wrap { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; --dp-r: 24px; --dp-badge-top: -9px; --dp-pt: 16px; }
          .dp-row { position: relative; display: flex; gap: 12px; width: min(1160px, calc(100vw - 32px)); height: min(860px, calc(100dvh - 48px)); }
          .dp-main { position: relative; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; background: ${CK.surface}; border-radius: var(--dp-r); box-shadow: 0 24px 60px rgba(58,14,15,0.35); }
          .dp-side { flex: 0 0 clamp(380px, 38%, 460px); }
          @keyframes dp-in { from { opacity: 0; transform: translateY(12px) scale(0.985); } to { opacity: 1; transform: none; } }
          .dp-row { animation: dp-in 200ms cubic-bezier(0.22,1,0.36,1); }
          @media (max-width: 999px) {
            .dp-row { width: min(720px, calc(100vw - 32px)); }
            .dp-side { flex: 1 1 0; }
          }
          @media (max-width: 639px) {
            .dp-wrap { --dp-r: 0px; --dp-badge-top: 8px; --dp-pt: 38px; }
            .dp-row { width: 100vw; height: 100dvh; }
          }
          @media (prefers-reduced-motion: reduce) { .dp-row { animation: none; } }
        `}</style>
        <div aria-hidden onMouseDown={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(58,14,15,0.42)' }} />
        <div className="dp-row" ref={panel} role="dialog" aria-modal="true" aria-label={`Directive ${d.title}`} tabIndex={-1} style={{ outline: 'none' }}>
          {showMain && (
            <div className="dp-main">
              <DirectiveMain
                directive={d}
                reply={reply}
                notesVersion={notesVersion}
                onChanged={onChanged}
                onClose={onClose}
                effectsButton={narrow && showForm ? <EffectsStepButton count={changeCount} onClick={() => setStep('effects')} /> : undefined}
              />
            </div>
          )}
          {showSide && sidePanel}
        </div>
      </div>
    </Portal>
  );
}
