'use client';
// Gavelling Crisis: "Waiting for a Reply" on Crisis Command, and the right-side drawer that opens a directive.

import { useEffect, useMemo, useRef } from 'react';
import { Hourglass, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { dirNumber } from '@/lib/crisis/format';
import type { Directive } from '@/lib/crisis/types';
import { Card, CardTitle, CK, Skeleton, cabinetTint, waitLabel, waitSeverity } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import DirectiveDetail from '../directives/DirectiveDetail';
import { buildNames, isOpenStatus, lastAnsweredByAuthor, sortDirectives } from '../directives/directiveKit';
import QueueRow, { WAIT_COLOR } from '../directives/QueueRow';
import { EmptyLine, LinkBtn } from './commandParts';

export function WaitingCard({ directives, base, now, onOpen }: {
  directives: Directive[] | null; base: string; now: number; onOpen: (d: Directive) => void;
}) {
  const { core, settings } = useCrisis();
  const names = useMemo(() => buildNames(core.cabinets, core.characters, core.members), [core]);

  const { open, clarify, top, oldest } = useMemo(() => {
    const all = directives ?? [];
    const openList = all.filter(isOpenStatus);
    const sorted = sortDirectives(openList, settings.queueOrder, 'open', lastAnsweredByAuthor(all));
    const oldestMs = openList.length ? Math.min(...openList.map((d) => new Date(d.waiting_since).getTime())) : null;
    return { open: openList.length, clarify: all.filter((d) => d.status === 'clarify').length, top: sorted.slice(0, 6), oldest: oldestMs };
  }, [directives, settings.queueOrder]);

  const oldestIso = oldest ? new Date(oldest).toISOString() : null;
  const oldestSev = waitSeverity(oldestIso, now);

  return (
    <Card warm>
      <CardTitle icon={<Hourglass size={17} strokeWidth={1.5} />} sub="Fairest first: longest wait, then who heard back least recently">Waiting for a Reply</CardTitle>
      {directives === null ? (
        <div className="flex flex-col" style={{ gap: 8 }}><Skeleton h={30} w="60%" /><Skeleton h={58} /><Skeleton h={58} /><Skeleton h={58} /></div>
      ) : (
        <>
          <div className="flex items-baseline flex-wrap" style={{ gap: '4px 8px' }}>
            <b style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: CK.ink }}>{open}</b>
            <span style={{ fontSize: 13, fontWeight: 600, color: CK.inkSoft }}>{open === 1 ? 'directive open' : 'directives open'}</span>
            {oldestIso && (
              <span style={{ marginLeft: 'auto', fontSize: 12, color: CK.inkSoft }}>
                Oldest <b style={{ color: WAIT_COLOR[oldestSev], fontVariantNumeric: 'tabular-nums' }}>{waitLabel(oldestIso, now)}</b>
              </span>
            )}
          </div>
          {clarify > 0 && (
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: CK.inkSoft }}>
              <b style={{ color: CK.ink, fontVariantNumeric: 'tabular-nums' }}>{clarify}</b> {clarify === 1 ? 'more is' : 'more are'} waiting for a delegate to add detail
            </p>
          )}
          {top.length === 0 ? <EmptyLine>Every directive has an answer.</EmptyLine> : (
            <div className="flex flex-col" style={{ gap: 2, marginTop: 4 }}>
              {top.map((d) => (
                <QueueRow key={d.id} d={d} names={names} sev={waitSeverity(d.waiting_since, now)} whenLabel={waitLabel(d.waiting_since, now)} onOpen={() => onOpen(d)} compact />
              ))}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <LinkBtn href={`${base}/directives`} style={{ width: '100%', justifyContent: 'center' }}>
              {open > top.length ? `See all ${open} in Directives` : 'See all in Directives'}
            </LinkBtn>
          </div>
        </>
      )}
    </Card>
  );
}

/** A directive in a right-side drawer. Escape and the scrim close it. */
export function DirectiveDrawer({ directive, onClose }: { directive: Directive; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') {
        // A pop-up opened from the drawer (the "+" actions, a character) closes first.
        if (document.querySelector('[aria-modal="true"]') || e.defaultPrevented) return;
        e.stopPropagation(); onClose();
      } };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Portal>
      <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
        <div onClick={onClose} aria-hidden style={{ position: 'absolute', inset: 0, background: cabinetTint(CK.redDeep, 0.4) }} />
        <aside
          role="dialog"
          aria-label={`Directive ${dirNumber(directive)}`}
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(560px, 100vw)', background: CK.page, boxShadow: '-14px 0 40px rgba(58,14,15,0.28)',
            display: 'flex', flexDirection: 'column', animation: 'cmd-drawer-in 220ms cubic-bezier(0.22,1,0.36,1)', fontFamily: CK.font, color: CK.ink,
          }}
        >
          <div className="flex items-center justify-end" style={{ padding: '10px 12px 0' }}>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.97] transition-transform"
              style={{ border: 0, borderRadius: 9, padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: CK.card, color: CK.forest, boxShadow: `inset 0 0 0 1px ${CK.hair}`, fontFamily: CK.font }}
            >
              <X size={14} strokeWidth={1.5} />
              Close
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 20px' }}>
            <DirectiveDetail directive={directive} onChanged={(what) => { if (what === 'answered') onClose(); }} />
          </div>
        </aside>
        <style>{'@keyframes cmd-drawer-in { from { transform: translateX(32px); opacity: 0; } to { transform: none; opacity: 1; } } @media (prefers-reduced-motion: reduce) { aside[aria-label^="Directive"] { animation: none !important; } }'}</style>
      </div>
    </Portal>
  );
}
