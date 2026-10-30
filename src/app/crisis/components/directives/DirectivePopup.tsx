'use client';
// Gavelling Crisis: a directive opened in the backroom: the main pop-up (DirectiveMain: title, character with the
// facts and who is responsible beside them, the text at a normal reading size, the composer) with "What happens
// when you send" docked beside it (a plus adds cards for resources, unit moves, borders, characters, news; a small
// recap of the changes sits at the bottom; an internal note is added at the top). Both are the same height and
// scroll on their own. When the caller passes a queue the top band has previous / next arrows and "3 of 12"
// (also the left and right arrow keys); there is no rail of other directives. A unit move or a border opens the
// map FULL SIZE in place of the whole pop-up (MapFullView) with a Back button, because a pop-up never opens
// another on top of itself. On a screen narrower than 1000px the side panel is a second step reached by a button.
// Nothing is applied until Send reply: not the outcome, not the text, not a single change.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ArrowLeft, Send, Zap } from 'lucide-react';
import Portal from '@/components/Portal';
import type { Directive } from '@/lib/crisis/types';
import { Btn, CK, useScrollLock } from '../../crisisKit';
import CharacterModal from '../character/CharacterModal';
import { InPlaceCharacterScope } from '../character/CharacterProfileHost';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { authorName, buildNames } from './directiveKit';
import DirectiveMain, { EffectsStepButton } from './DirectiveMain';
import { DirectiveNav } from './DirectiveNav';
import EffectsPanel from './EffectsPanel';
import EffectsRecap from './EffectsRecap';
import InternalNote from './InternalNote';
import MapFullView from './MapFullView';
import type { MapRequest } from './effectCards';
import { countChanges } from './replyDraft';
import { useDirectiveReply } from './useDirectiveReply';
import { useEffectsEnv } from './useEffectsEnv';

export interface DirectivePopupProps {
  directive: Directive;
  onClose: () => void;
  /** Called after this person claimed, handed over or answered. */
  onChanged?: (what: 'claimed' | 'assigned' | 'answered') => void;
  /** Bump to re-read the notes (the inbox does it on a live ping). */
  notesVersion?: number;
  /**
   * The queue the previous / next arrows move through, in the order the caller shows it. Without it the
   * pop-up shows just this directive and no arrows.
   */
  queue?: Directive[];
  /** Called when the reader brings another directive to the front (so the caller can follow). */
  onSelect?: (id: string) => void;
}

const NARROW = '(max-width: 999px)';
function useNarrow(): boolean {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(NARROW); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}

/** What the open pop-up tells the keys: while the big map is shown, Escape goes back to the directive and the arrows stay out. */
interface PopupGuard { mapOpen: boolean; closeMap: () => void }

const newer = (a: Directive, b: Directive) => new Date(a.updated_at).getTime() > new Date(b.updated_at).getTime();

/** True when an arrow key press belongs to something the person is typing into or choosing from. */
function typingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.getAttribute('role') === 'combobox' || !!el.closest('[role="listbox"]');
}

export default function DirectivePopup(props: DirectivePopupProps) {
  const { onClose, onSelect, queue } = props;
  const { staff } = useCrisis();

  const list = useMemo<Directive[]>(() => queue ?? [], [queue]);

  // The directive in front. It follows the caller's directive when that changes (a notification link),
  // and takes a newer copy of itself from the caller or the queue.
  const [shown, setShown] = useState<Directive>(props.directive);
  const [propId, setPropId] = useState(props.directive.id);
  if (props.directive.id !== propId) {
    setPropId(props.directive.id);
    setShown(props.directive);
  } else {
    const fromList = list.find((x) => x.id === shown.id);
    const fresh = props.directive.id === shown.id && (!fromList || newer(props.directive, fromList)) ? props.directive : fromList;
    if (fresh && newer(fresh, shown)) setShown(fresh);
  }

  const index = list.findIndex((x) => x.id === shown.id);
  const select = useCallback((d: Directive) => { setShown(d); onSelect?.(d.id); }, [onSelect]);
  const step = useCallback((delta: 1 | -1) => {
    if (list.length === 0) return;
    const at = index < 0 ? (delta > 0 ? 0 : list.length - 1) : (index + delta + list.length) % list.length;
    if (list[at] && list[at].id !== shown.id) select(list[at]);
  }, [list, index, shown.id, select]);

  const guard = useRef<PopupGuard>({ mapOpen: false, closeMap: () => {} });
  // A character's profile opened from a name in here: it takes the place of the whole pop-up (never on top of it).
  const [profileId, setProfileId] = useState<string | null>(null);
  const profileRef = useRef(profileId);
  useEffect(() => { profileRef.current = profileId; });
  useScrollLock();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const stepRef = useRef(step);
  useEffect(() => { closeRef.current = onClose; stepRef.current = step; });

  useEffect(() => {
    const el = panel.current;
    const before = document.activeElement as HTMLElement | null;
    el?.focus();
    const onKey = (e: KeyboardEvent) => {
      // The profile has the keys while it is shown.
      if (profileRef.current) return;
      if (e.key === 'Escape') {
        // A dropdown inside the page closes first.
        if (document.querySelector('[data-crisis-popover], [data-gsel-popover]') || e.defaultPrevented) return;
        if (guard.current.mapOpen) { guard.current.closeMap(); return; }
        closeRef.current();
        return;
      }
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !guard.current.mapOpen && !e.defaultPrevented && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey
        && !typingTarget(e.target) && !document.querySelector('[data-gsel-popover]')) {
        e.preventDefault();
        stepRef.current(e.key === 'ArrowRight' ? 1 : -1);
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

  if (!staff) return null;

  return (
    <InPlaceCharacterScope onOpen={setProfileId}>
    <Portal>
      <div className="dp-wrap" style={{ fontFamily: CK.font, color: CK.ink, display: profileId ? 'none' : undefined }}>
        <style>{`
          .dp-wrap { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; --dp-r: 24px; --dp-badge-top: -9px; --dp-pt: 16px; }
          .dp-row { position: relative; display: flex; gap: 12px; width: min(1380px, calc(100vw - 32px)); height: min(860px, calc(100dvh - 48px)); }
          .dp-main { position: relative; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; background: ${CK.surface}; border-radius: var(--dp-r); box-shadow: 0 24px 60px rgba(58,14,15,0.35); }
          .dp-side { flex: 0 0 clamp(380px, 34%, 460px); }
          @keyframes dp-in { from { opacity: 0; transform: translateY(12px) scale(0.985); } to { opacity: 1; transform: none; } }
          @keyframes dp-swap { from { opacity: 0; transform: translateX(14px) scale(0.99); } to { opacity: 1; transform: none; } }
          .dp-row { animation: dp-in 200ms cubic-bezier(0.22,1,0.36,1); }
          .dp-swap { display: contents; }
          .dp-swap > .dp-main, .dp-swap > .dp-side { animation: dp-swap 200ms cubic-bezier(0.22,1,0.36,1); }
          @media (max-width: 1239px) {
            .dp-row { width: min(1160px, calc(100vw - 32px)); }
          }
          @media (max-width: 999px) {
            .dp-row { width: min(720px, calc(100vw - 32px)); }
            .dp-side { flex: 1 1 0; }
          }
          @media (max-width: 639px) {
            .dp-wrap { --dp-r: 0px; --dp-badge-top: 8px; --dp-pt: 38px; }
            .dp-row { width: 100vw; height: 100dvh; }
          }
          @media (prefers-reduced-motion: reduce) { .dp-row, .dp-swap > .dp-main, .dp-swap > .dp-side { animation: none; } }
        `}</style>
        <div aria-hidden onMouseDown={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(42,10,12,0.58)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />
        <div className="dp-row" ref={panel} role="dialog" aria-modal="true" aria-label={`Directive ${shown.title}`} tabIndex={-1} style={{ outline: 'none' }}>
          <PopupBody
            key={shown.id}
            directive={shown}
            onClose={onClose}
            onChanged={props.onChanged}
            notesVersion={props.notesVersion}
            onMapState={(open, close) => { guard.current = { mapOpen: open, closeMap: close }; }}
            nav={queue ? <DirectiveNav index={index} total={list.length} onPrev={() => step(-1)} onNext={() => step(1)} /> : undefined}
          />
        </div>
      </div>
    </Portal>
    {/* The profile in place of the pop-up. The pop-up stays mounted (hidden) so the reply is exactly as it was; closing the profile comes back to it. */}
    {profileId && <CharacterModal key={profileId} characterId={profileId} onClose={() => setProfileId(null)} />}
    </InPlaceCharacterScope>
  );
}

/** The main panel and the changes panel of ONE directive. Keyed by the directive, so each has its own reply. */
function PopupBody({ directive: d, onClose, onChanged, notesVersion = 0, nav, onMapState }: {
  directive: Directive;
  onClose: () => void;
  onChanged?: DirectivePopupProps['onChanged'];
  notesVersion?: number;
  nav?: ReactNode;
  /** Tells the pop-up whether the big map is open, and how to leave it. */
  onMapState: (open: boolean, close: () => void) => void;
}) {
  const { ref, core, director, settings } = useCrisis();
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
  /** The big map, shown in place of the whole pop-up while it is set. */
  const [mapReq, setMapReq] = useState<MapRequest | null>(null);
  const [noteTick, setNoteTick] = useState(0);

  const env = useEffectsEnv({
    crisisRef: ref, powers, effects: reply.effects, setEffects: reply.setEffects,
    authorCharacterId: d.author_character_id, cabinetId: d.cabinet_id ?? character?.cabinet_id ?? null, openMap: setMapReq,
  });

  // Tell the keys about the map: Escape goes back to the directive, the arrows do not move to another one.
  useEffect(() => {
    onMapState(!!mapReq, () => setMapReq(null));
    return () => onMapState(false, () => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReq]);

  const changeCount = countChanges(reply.effects);
  // The changes only matter while a reply is being written; an answered directive keeps just the internal note.
  const showForm = d.status !== 'answered' || reply.editing;
  const showMain = !narrow || step === 'main';
  const showSide = !narrow || step === 'effects';

  const sidePanel = (
    <aside
      aria-label={showForm ? 'What happens when you send' : 'Internal note'}
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
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: CK.ink, overflowWrap: 'anywhere' }}>{showForm ? 'What Happens When You Send' : 'Internal Note'}</h2>
      </div>
      {showForm ? (
        <>
          <InternalNote crisisRef={ref} directiveId={d.id} onAdded={() => setNoteTick((v) => v + 1)} />
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 14px 18px' }}>
            <EffectsPanel env={env} />
          </div>
          <EffectsRecap env={env} />
        </>
      ) : (
        <InternalNote crisisRef={ref} directiveId={d.id} onAdded={() => setNoteTick((v) => v + 1)} fill />
      )}
      {narrow && showForm && (
        <div className="flex items-center justify-between" style={{ flex: 'none', gap: 8, padding: '10px 16px 12px', background: CK.card, boxShadow: `0 -1px 0 ${CK.hair}` }}>
          <Btn tone="ghost" icon={<ArrowLeft size={15} strokeWidth={1.5} />} onClick={() => setStep('main')}>Back</Btn>
          <Btn tone="green" icon={<Send size={15} strokeWidth={1.5} />} onClick={reply.send} disabled={!reply.canSend}>{reply.busy ? 'Sending' : 'Send reply'}</Btn>
        </div>
      )}
    </aside>
  );

  return (
    <div className="dp-swap">
      {/* Kept mounted (hidden) while the big map is shown, so the reply and the scroll are exactly as they were. */}
      <div className="dp-swap" style={{ display: mapReq ? 'none' : 'contents' }}>
        {showMain && (
          <div className="dp-main">
            <DirectiveMain
              directive={d}
              reply={reply}
              notesVersion={notesVersion + noteTick}
              onChanged={onChanged}
              onClose={onClose}
              nav={nav}
              effectsButton={narrow ? <EffectsStepButton count={changeCount} label={showForm ? undefined : 'Internal note'} onClick={() => setStep('effects')} /> : undefined}
            />
          </div>
        )}
        {showSide && sidePanel}
      </div>
      {mapReq && <MapFullView env={env} req={mapReq} onBack={() => setMapReq(null)} />}
    </div>
  );
}
