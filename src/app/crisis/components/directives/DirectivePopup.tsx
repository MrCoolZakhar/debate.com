'use client';
// Gavelling Crisis: a directive opened in the backroom, as a ONE-BY-ONE reader: the directive in front
// is read big (DirectiveMain: title, facts and who is responsible at the top, the text large), the other
// directives of the same queue wait on the right as a blurred, smaller stack (DirectiveRail), and
// clicking one, the arrows in the top band or the left and right arrow keys bring another to the front.
// Docked beside the main pop-up is "What happens when you send" (a plus adds cards for resources, unit
// moves, borders, characters, news). Both are the same height and scroll on their own. On a screen
// narrower than 1000px the side panel is a second step reached by a button, with a back button, never a
// pop-up on a pop-up. A pop-up never opens another on top of itself, so nothing in here opens one.
// Nothing is applied until Send reply: not the outcome, not the text, not a single change.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ArrowLeft, Send, Zap } from 'lucide-react';
import Portal from '@/components/Portal';
import { notifyErr } from '@/lib/appNotify';
import { crisisError, listDirectives } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { Directive } from '@/lib/crisis/types';
import { Btn, CK } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { authorName, buildNames, isOpenStatus, lastAnsweredByAuthor, sortDirectives } from './directiveKit';
import DirectiveMain, { EffectsStepButton } from './DirectiveMain';
import DirectiveRail, { DirectiveNav } from './DirectiveRail';
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
  /**
   * The queue the reader moves through, in the order the caller shows it. Without it the pop-up reads
   * the open directives itself (in the crisis's queue order) and keeps them live.
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

const newer = (a: Directive, b: Directive) => new Date(a.updated_at).getTime() > new Date(b.updated_at).getTime();

/** True when an arrow key press belongs to something the person is typing into or choosing from. */
function typingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.getAttribute('role') === 'combobox' || !!el.closest('[role="listbox"]');
}

export default function DirectivePopup(props: DirectivePopupProps) {
  const { onClose, onSelect, queue } = props;
  const { ref, core, staff, settings } = useCrisis();
  const names = useMemo(() => buildNames(core.cabinets, core.characters, core.members), [core]);

  // The queue: the caller's, else the open directives read here.
  const [own, setOwn] = useState<Directive[] | null>(null);
  const selfLoad = staff && !queue;
  const loadOwn = useCallback(async () => {
    try { setOwn(await listDirectives(ref)); }
    catch (e) { notifyErr(crisisError(e, 'Could not refresh the directives.'), 'crisis-directives-refresh'); }
  }, [ref]);
  useEffect(() => {
    if (!selfLoad) return;
    let cancelled = false;
    listDirectives(ref).then((rows) => { if (!cancelled) setOwn(rows); }).catch(() => { /* the reader works with the one directive */ });
    return () => { cancelled = true; };
  }, [selfLoad, ref]);
  useCrisisLive(selfLoad ? ref.id : null, ['crisis_directives'], () => { void loadOwn(); });

  const list = useMemo<Directive[]>(() => {
    if (queue) return queue;
    const all = (own ?? []).filter((d) => d.status !== 'withdrawn');
    return sortDirectives(all.filter(isOpenStatus), settings.queueOrder, 'open', lastAnsweredByAuthor(all));
  }, [queue, own, settings.queueOrder]);

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

  // The rail: everything else in the queue, starting with what comes next.
  const railItems = useMemo(() => {
    if (index < 0) return list.filter((x) => x.id !== shown.id);
    return [...list.slice(index + 1), ...list.slice(0, index)];
  }, [list, index, shown.id]);

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
        if (document.querySelector('[data-crisis-popover], [data-gsel-popover]') || e.defaultPrevented) return;
        closeRef.current();
        return;
      }
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.defaultPrevented && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey
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
      document.body.style.overflow = prevOverflow;
      before?.focus?.();
    };
  }, []);

  if (!staff) return null;

  return (
    <Portal>
      <div className="dp-wrap" style={{ fontFamily: CK.font, color: CK.ink }}>
        <style>{`
          .dp-wrap { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; --dp-r: 24px; --dp-badge-top: -9px; --dp-pt: 16px; }
          .dp-row { position: relative; display: flex; gap: 12px; width: min(1380px, calc(100vw - 32px)); height: min(860px, calc(100dvh - 48px)); }
          .dp-main { position: relative; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; background: ${CK.surface}; border-radius: var(--dp-r); box-shadow: 0 24px 60px rgba(58,14,15,0.35); }
          .dp-side { flex: 0 0 clamp(380px, 34%, 460px); }
          .dp-rail { flex: 0 0 clamp(150px, 12vw, 190px); min-width: 0; display: flex; flex-direction: column; min-height: 0; }
          .dp-rail-list { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: none; }
          .dp-rail-list::-webkit-scrollbar { display: none; }
          .dp-rail-card { display: block; width: 100%; border: 0; cursor: pointer; font-family: ${CK.font}; background: ${CK.card}; border-radius: 16px; padding: 14px 12px 11px;
            box-shadow: 0 10px 26px rgba(58,14,15,0.28); filter: blur(var(--blur, 1.4px)); opacity: var(--fade, 0.85); transform: scale(0.94); transform-origin: center;
            transition: filter 160ms, opacity 160ms, transform 160ms; }
          .dp-rail-card:hover, .dp-rail-card:focus-visible { filter: none; opacity: 1; transform: scale(0.99); }
          @keyframes dp-in { from { opacity: 0; transform: translateY(12px) scale(0.985); } to { opacity: 1; transform: none; } }
          @keyframes dp-swap { from { opacity: 0; transform: translateX(14px) scale(0.99); } to { opacity: 1; transform: none; } }
          .dp-row { animation: dp-in 200ms cubic-bezier(0.22,1,0.36,1); }
          .dp-swap { display: contents; }
          .dp-swap > .dp-main, .dp-swap > .dp-side { animation: dp-swap 200ms cubic-bezier(0.22,1,0.36,1); }
          @media (max-width: 1239px) {
            .dp-rail { display: none; }
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
          @media (prefers-reduced-motion: reduce) { .dp-row, .dp-swap > .dp-main, .dp-swap > .dp-side { animation: none; } .dp-rail-card { transition: none; } }
        `}</style>
        <div aria-hidden onMouseDown={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(42,10,12,0.58)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />
        <div className="dp-row" ref={panel} role="dialog" aria-modal="true" aria-label={`Directive ${shown.title}`} tabIndex={-1} style={{ outline: 'none' }}>
          <PopupBody
            key={shown.id}
            directive={shown}
            onClose={onClose}
            onChanged={props.onChanged}
            notesVersion={props.notesVersion}
            nav={<DirectiveNav index={index} total={list.length} onPrev={() => step(-1)} onNext={() => step(1)} />}
          />
          <DirectiveRail items={railItems} names={names} onPick={select} />
        </div>
      </div>
    </Portal>
  );
}

/** The main panel and the changes panel of ONE directive. Keyed by the directive, so each has its own reply. */
function PopupBody({ directive: d, onClose, onChanged, notesVersion, nav }: {
  directive: Directive;
  onClose: () => void;
  onChanged?: DirectivePopupProps['onChanged'];
  notesVersion?: number;
  nav: ReactNode;
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
  const canPublishNews = director || (!settings.newsNeedsApproval && settings.backroomPowers.news);
  const reply = useDirectiveReply(ref, d, who, powers, () => onChanged?.('answered'), canPublishNews);
  const narrow = useNarrow();
  const [step, setStep] = useState<'main' | 'effects'>('main');

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
    <div className="dp-swap">
      {showMain && (
        <div className="dp-main">
          <DirectiveMain
            directive={d}
            reply={reply}
            notesVersion={notesVersion}
            onChanged={onChanged}
            onClose={onClose}
            nav={nav}
            effectsButton={narrow && showForm ? <EffectsStepButton count={changeCount} onClick={() => setStep('effects')} /> : undefined}
          />
        </div>
      )}
      {showSide && sidePanel}
    </div>
  );
}
