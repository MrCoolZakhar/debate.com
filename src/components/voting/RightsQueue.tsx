'use client';

/**
 * RightsQueue: the delegations that voted with rights, in speaking order, on the rights
 * speakers screen of /voting/[code].
 *
 * Owner, 17 Sep 2026: "Enable the rights speakers to be moved around in the queue." The
 * delegations still to speak (after the one speaking now) can be reordered by the Moderator:
 *   - pointer: drag a row (mouse / pen from anywhere on it, touch from its grip). The row
 *     follows the pointer by a direct style.transform write, a gold line marks the slot, and
 *     one `onMove` is issued on release (none when it lands where it started);
 *   - keyboard: ArrowUp / ArrowDown on the focused grip moves it one place.
 * The speaker on the floor and those who already spoke never move, and nothing can be dropped
 * above the floor.
 *
 * It writes nothing itself. `onMove(delegateId, slot)` hands the page the new position among
 * the UPCOMING speakers; the page persists it through `updateVote` (one vote_state write, the
 * seq grows), so every chair device follows the new order.
 *
 * Distances are divided by the list's scale: the ballot screens sit inside FitToScreen, which
 * draws the page inside `scale()`.
 */

import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { getCountryDisplayName } from '@/lib/countries';
import type { DelegateVote } from '@/lib/voteState';

const PICKUP_PX = 5;
/** Click-time clock behind a module helper (the purity lint flags a bare Date.now() in a component). */
const nowMs = () => Date.now();

export interface RightsQueueProps {
  speakers: DelegateVote[];
  /** Index of the delegation speaking now. */
  currentIndex: number;
  hideTally: boolean;
  /** Moderator only; absent = read only. `slot` is the 0-based place among the upcoming speakers. */
  onMove?: (delegateId: string, slot: number) => void;
}

interface Armed {
  id: string;
  pointerId: number;
  startY: number;
  scale: number;
  /** Layout-space centre of every upcoming row except the dragged one, in order. */
  centres: number[];
  /** Layout-space centre of the dragged row at pickup. */
  origin: number;
  fromSlot: number;
  lifted: boolean;
}

export function RightsQueue({ speakers, currentIndex, hideTally, onMove }: RightsQueueProps) {
  const t = useT();
  const { language } = useLanguage();
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const armedRef = useRef<Armed | null>(null);
  const [drag, setDrag] = useState<{ id: string; slot: number } | null>(null);
  const justDraggedRef = useRef(0);

  const upcoming = speakers.slice(currentIndex + 1);
  const canMove = !!onMove && upcoming.length > 1;

  // Window listeners while a pointer is armed: a drag never depends on pointer capture or
  // on the pointer staying over its row.
  const [armedTick, setArmedTick] = useState(0);
  useEffect(() => {
    const a = armedRef.current;
    if (!a) return;
    const el = rowRefs.current.get(a.id);
    const slotAt = (centre: number) => a.centres.filter((c) => c < centre).length;
    const onMoveEvt = (e: PointerEvent) => {
      if (e.pointerId !== a.pointerId) return;
      const dy = (e.clientY - a.startY) / a.scale;
      if (!a.lifted) {
        if (Math.abs(dy) < PICKUP_PX) return;
        a.lifted = true;
        document.body.style.userSelect = 'none';
      }
      e.preventDefault();
      if (el) el.style.transform = `translateY(${dy}px)`;
      const slot = slotAt(a.origin + dy);
      setDrag((prev) => (prev && prev.id === a.id && prev.slot === slot ? prev : { id: a.id, slot }));
    };
    const finish = (e: PointerEvent, cancel: boolean) => {
      if (e.pointerId !== a.pointerId) return;
      const dy = (e.clientY - a.startY) / a.scale;
      if (el) el.style.transform = '';
      document.body.style.userSelect = '';
      armedRef.current = null;
      setDrag(null);
      if (a.lifted) {
        justDraggedRef.current = nowMs();
        const slot = slotAt(a.origin + dy);
        if (!cancel && slot !== a.fromSlot) onMove?.(a.id, slot);
      }
      setArmedTick((n) => n + 1);
    };
    const up = (e: PointerEvent) => finish(e, false);
    const cancel = (e: PointerEvent) => finish(e, true);
    window.addEventListener('pointermove', onMoveEvt, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', onMoveEvt);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (el) el.style.transform = '';
      document.body.style.userSelect = '';
    };
  // Re-armed on every pickup (armedTick moves); the refs carry the rest.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armedTick]);

  const arm = (e: React.PointerEvent, id: string, fromGrip: boolean) => {
    if (!canMove || armedRef.current) return;
    if (e.button !== 0) return;
    if (!fromGrip && e.pointerType === 'touch') return;   // a finger scrolls the list; the grip drags
    const list = listRef.current;
    if (!list) return;
    const box = list.getBoundingClientRect();
    const scale = list.offsetHeight > 0 && box.height > 0 ? box.height / list.offsetHeight : 1;
    const centreOf = (sid: string) => {
      const r = rowRefs.current.get(sid);
      return r ? r.offsetTop + r.offsetHeight / 2 : 0;
    };
    const others = upcoming.filter((s) => s.delegateId !== id);
    armedRef.current = {
      id,
      pointerId: e.pointerId,
      startY: e.clientY,
      scale: scale || 1,
      centres: others.map((s) => centreOf(s.delegateId)),
      origin: centreOf(id),
      fromSlot: upcoming.findIndex((s) => s.delegateId === id),
      lifted: false,
    };
    setArmedTick((n) => n + 1);
  };

  const onGripKey = (e: React.KeyboardEvent, id: string) => {
    if (!onMove) return;
    const from = upcoming.findIndex((s) => s.delegateId === id);
    if (from < 0) return;
    let to = from;
    if (e.key === 'ArrowUp') to = from - 1;
    else if (e.key === 'ArrowDown') to = from + 1;
    else return;
    e.preventDefault();
    if (to < 0 || to >= upcoming.length) return;
    onMove(id, to);
  };

  // Where the gold line goes: before the upcoming row (not counting the dragged one) at `slot`.
  const others = drag ? upcoming.filter((s) => s.delegateId !== drag.id) : [];
  const lineBefore = drag && drag.slot < others.length ? others[drag.slot].delegateId : null;
  const lineAtEnd = !!drag && drag.slot >= others.length;
  const dropLine = (
    <div aria-hidden className="relative h-0">
      <div className="absolute inset-x-3 -top-[3px] h-[3px] rounded-full" style={{ backgroundColor: '#B6871F' }}>
        <span className="absolute -top-[3px] -start-1 w-[9px] h-[9px] rounded-full" style={{ backgroundColor: '#B6871F' }} />
      </div>
    </div>
  );

  return (
    <div
      ref={listRef}
      className="relative min-h-0 overflow-y-auto rounded-[20px] p-2 space-y-1"
      style={{ backgroundColor: '#FAF8F3', boxShadow: '0 0 0 1px rgba(27,56,40,0.07), 0 10px 28px rgba(27,56,40,0.08)' }}
      aria-label={t('voting_stage_rights')}
      role="list"
    >
      {speakers.map((v, absIdx) => {
        const done = absIdx < currentIndex;
        const isCurrent = absIdx === currentIndex;
        const movable = canMove && absIdx > currentIndex;
        const dragging = drag?.id === v.delegateId;
        const name = getCountryDisplayName(v.country, language);
        return (
          <div key={v.delegateId} role="listitem">
            {lineBefore === v.delegateId && dropLine}
            <div
              ref={(el) => { if (el) rowRefs.current.set(v.delegateId, el); else rowRefs.current.delete(v.delegateId); }}
              onPointerDown={movable ? (e) => { if (!(e.target as HTMLElement).closest('button')) arm(e, v.delegateId, false); } : undefined}
              className={`relative flex items-center gap-3 ps-3 pe-1.5 py-2 rounded-2xl ${movable ? 'cursor-grab' : ''} ${dragging ? '' : 'transition-[background-color,opacity] duration-200'}`}
              style={{
                backgroundColor: isCurrent ? '#1B3828' : dragging ? '#FFFFFF' : 'transparent',
                opacity: done ? 0.45 : 1,
                zIndex: dragging ? 5 : undefined,
                boxShadow: dragging ? '0 0 0 1.5px #D9B44A, 0 12px 28px rgba(27,56,40,0.22)' : undefined,
                cursor: dragging ? 'grabbing' : undefined,
                touchAction: movable ? 'pan-y' : undefined,
              }}
            >
              <span className="text-[12px] w-5 font-medium text-end tabular-nums" style={{ color: isCurrent ? 'rgba(238,217,138,0.8)' : '#9A8A78' }}>{absIdx + 1}</span>
              <SeatCircleFlag country={v.country} size={30} decorative ring={!isCurrent} />
              <span className="flex-1 min-w-0 truncate text-[15px] font-medium" style={{ color: isCurrent ? '#FFFFFF' : '#1C1410' }}>{name}</span>
              <span className="text-[12.5px] font-medium shrink-0" style={{
                color: isCurrent ? '#EED98A' : hideTally ? '#6A5A4A' : v.choice === 'for-rights' ? '#2F6B45' : '#8B2020',
              }}>
                {isCurrent ? t('voting_speaking') : hideTally ? t('voting_with_rights_label') : v.choice === 'for-rights' ? t('voting_for_rights_list') : t('voting_against_rights_list')}
              </span>
              {canMove && (
                movable ? (
                  <button
                    type="button"
                    aria-label={t('voting_rights_move', { name })}
                    title={t('voting_rights_move_hint')}
                    onPointerDown={(e) => arm(e, v.delegateId, true)}
                    onKeyDown={(e) => onGripKey(e, v.delegateId)}
                    onClick={(e) => { e.stopPropagation(); if (nowMs() - justDraggedRef.current < 400) e.preventDefault(); }}
                    className="shrink-0 w-8 h-9 rounded-lg flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] hover:bg-[rgba(27,56,40,0.07)]"
                    style={{ color: '#8C7B69', touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
                  >
                    <GripVertical size={17} strokeWidth={2.25} aria-hidden />
                  </button>
                ) : (
                  <span className="shrink-0 w-8" aria-hidden />
                )
              )}
            </div>
          </div>
        );
      })}
      {lineAtEnd && dropLine}
    </div>
  );
}
