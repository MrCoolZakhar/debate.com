'use client';

/**
 * The veto moment on /voting/[code] (owner, 18 Sep 2026: "a red damage flash right at the
 * moment the vetoing vote is taken", and "a double check before a veto is cast").
 *
 * `VetoFlash` watches the ballot's votes and, when a veto holder's vote BECOMES an Against
 * (with or without rights), flashes the whole screen red and shakes the ballot screen once.
 * It keys on the ballot (document + `startedAt`), so opening a stored vetoed result, a
 * reload, a Back, a rules change or Vote again never flashes: only a vote actually taken
 * does. Because it reads the persisted `vote_state`, every chair device following the vote
 * flashes too, and a device ballot flashes on its reveal (all the choices arrive at once).
 * Switching Against to Against with rights is the same veto and does not flash again.
 *
 * Nothing here is React state: the overlay is a node appended to <body> and animated with
 * the Web Animations API, then removed; the screen reader line is written to a live region.
 * Under prefers-reduced-motion there is no shake and the red only fades in and out.
 *
 * `VetoConfirm` is the double check: "This is a veto. Record it?" with Cancel (focused) and
 * Record the veto. Escape cancels without reaching the dialogs underneath; Tab stays inside.
 */

import { useEffect, useRef } from 'react';
import { ShieldAlert } from 'lucide-react';
import Portal from '@/components/Portal';
import { useT } from '@/contexts/LanguageContext';
import type { DelegateVote, VoteChoice } from '@/lib/voteState';
import type { CommitteeSettings } from '@/lib/settingsStore';
import { holdsVeto, isVetoChoice } from './vetoHolders';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** One red flash over everything, plus a short shake of `shakeSelector` (motion allowed only). */
export function flashVeto(shakeSelector = '.gv-ballot-screen') {
  if (typeof document === 'undefined') return;
  const calm = reducedMotion();
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {
    position: 'fixed', inset: '0', zIndex: '2100', pointerEvents: 'none', opacity: '0',
    background: 'radial-gradient(ellipse at center, rgba(200,24,24,0.18) 0%, rgba(170,16,16,0.42) 62%, rgba(120,8,8,0.72) 100%)',
    boxShadow: 'inset 0 0 0 10px rgba(190,20,20,0.55)',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(layer);
  const remove = () => layer.remove();
  if (typeof layer.animate !== 'function') { setTimeout(remove, 400); return; }
  const fade = layer.animate(
    calm
      ? [{ opacity: 0 }, { opacity: 0.55, offset: 0.25 }, { opacity: 0 }]
      : [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0.35, offset: 0.4 }, { opacity: 0.7, offset: 0.55 }, { opacity: 0 }],
    { duration: calm ? 900 : 760, easing: 'ease-out' },
  );
  fade.onfinish = remove;
  fade.oncancel = remove;
  if (calm) return;
  const screen = document.querySelector<HTMLElement>(shakeSelector);
  screen?.animate(
    [
      { transform: 'translate3d(0,0,0)' },
      { transform: 'translate3d(-10px,2px,0)' },
      { transform: 'translate3d(9px,-2px,0)' },
      { transform: 'translate3d(-7px,1px,0)' },
      { transform: 'translate3d(5px,0,0)' },
      { transform: 'translate3d(-2px,0,0)' },
      { transform: 'translate3d(0,0,0)' },
    ],
    { duration: 420, easing: 'cubic-bezier(0.36,0.07,0.19,0.97)' },
  );
}

export function VetoFlash({ ballotKey, votes, rules }: {
  /** `${documentId}:${vote.startedAt}`, or null when no ballot is on screen. */
  ballotKey: string | null;
  votes: DelegateVote[];
  rules: Pick<CommitteeSettings, 'vetoMode' | 'vetoCountries' | 'p5Delegations'>;
}) {
  const t = useT();
  const prevRef = useRef<{ key: string | null; choices: Map<string, VoteChoice> } | null>(null);
  const liveRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const choices = new Map(votes.map((v) => [v.delegateId, v.choice] as const));
    const prev = prevRef.current;
    prevRef.current = { key: ballotKey, choices };
    // The first look at a ballot is its baseline: nothing already on record flashes.
    if (!prev || !ballotKey || prev.key !== ballotKey) return;
    const vetoTaken = votes.some((v) => isVetoChoice(v.choice)
      && !isVetoChoice(prev.choices.get(v.delegateId))
      && holdsVeto(rules, v.country));
    if (!vetoTaken) return;
    flashVeto();
    if (liveRef.current) liveRef.current.textContent = t('voting_veto_flash_sr');
  }, [ballotKey, votes, rules, t]);

  return <span ref={liveRef} className="sr-only" role="status" aria-live="assertive" />;
}

export function VetoConfirm({ country, onConfirm, onCancel }: {
  country: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);
  const cancelCb = useRef(onCancel);
  useEffect(() => { cancelCb.current = onCancel; }, [onCancel]);

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    // Captured so Escape closes only this question, never a dialog underneath.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelCb.current(); return; }
      if (e.key !== 'Tab' || !boxRef.current) return;
      const items = Array.from(boxRef.current.querySelectorAll<HTMLElement>('button'));
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1];
      const inside = boxRef.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); back?.focus?.({ preventScroll: true }); };
  }, []);

  return (
    <Portal>
      <div className="fixed inset-0 z-[90] flex items-center justify-center px-6" style={{ backgroundColor: 'rgba(28,20,16,0.46)' }} onMouseDown={onCancel}>
        <div
          ref={boxRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="gv-veto-q"
          aria-describedby="gv-veto-d"
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-[22px] px-7 pt-7 pb-6 text-center"
          style={{ backgroundColor: '#FCFAF5', boxShadow: '0 2px 6px rgba(62,36,71,0.18), 0 28px 70px rgba(62,36,71,0.34)' }}
        >
          <span className="mx-auto w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#3E2447', color: '#F3D98A' }} aria-hidden>
            <ShieldAlert size={28} strokeWidth={2.4} />
          </span>
          <h2 id="gv-veto-q" className="mt-4 text-[24px] font-bold leading-tight tracking-[-0.01em]" style={{ color: '#3E2447' }}>
            {t('voting_veto_confirm_title')}
          </h2>
          <p id="gv-veto-d" className="mt-2 text-[15px] leading-snug [text-wrap:balance]" style={{ color: '#4A3F36' }}>
            {t('voting_veto_confirm_body', { country })}
          </p>
          <div className="mt-6 flex gap-3">
            <button
              // Focused on mount through the ref: the Portal renders its children one effect
              // after this component mounts, so an effect here would find no button yet.
              ref={(el) => { if (el && !focusedRef.current) { focusedRef.current = true; el.focus({ preventScroll: true }); } }}
              type="button"
              onClick={onCancel}
              className="flex-1 h-12 rounded-full text-[15px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none"
              style={{ backgroundColor: '#FFFFFF', color: '#1C1410', boxShadow: '0 0 0 1px rgba(27,56,40,0.16), 0 2px 6px rgba(27,56,40,0.08)' }}
            >
              {t('voting_veto_confirm_cancel')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 h-12 rounded-full text-[15px] font-bold inline-flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none"
              style={{ backgroundColor: '#8B2020', color: '#FFFFFF', boxShadow: '0 2px 4px rgba(90,20,20,0.24), 0 10px 22px rgba(139,32,32,0.28)' }}
            >
              <ShieldAlert size={17} strokeWidth={2.5} aria-hidden />
              {t('voting_veto_confirm_yes')}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
