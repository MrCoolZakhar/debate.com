'use client';

// ─────────────────────────────────────────────────────────────────────────────
// SpeakerStrip: the row of flags across the top of the floor (GSL and caucus queue).
//
// Reordering uses POINTER events, not HTML5 drag and drop, so it works the same with a
// mouse, a pen and a finger:
//   - press on a queued flag and move 6px to pick it up (a plain tap never reorders);
//   - the flag follows the pointer (transform only, nothing else moves, so there is no
//     layout jump) and a gold bar shows exactly where it will land;
//   - nothing can be dropped before the speaker holding the floor (#1 stays #1);
//   - release to drop: ONE onReorder call with the new order. A drag that ends where it
//     started writes nothing, and the click that follows a drag is swallowed.
// The dragged row is tracked by delegate id, not by index, so a realtime refresh during a
// drag cannot move the wrong flag; if the dragged delegate disappears the drag is dropped.
// "Sometimes a drag does not move anything" (15 Sep 2026) had three causes, all fixed here:
//   - the drop animated the flag back from where it was released (a 180ms transform
//     transition), so a second press made within that window landed on the neighbour or
//     on empty space. The flag now lands instantly;
//   - pressing the X / grip corner of a flag never started a drag (the X covers the flag's
//     top corner). A press there now arms the drag too; a plain tap still removes;
//   - the pointer was tracked by capture on the flag's own node, which a re-render that
//     replaced the node ended silently. It is tracked on window listeners now.
// Keyboard: each queued flag has a grip button; Arrow Left / Right move it one place.
//
// Removal: every flag has an X (on hover, always visible on touch screens). On the speaker
// holding the floor it calls `onRemoveCurrent`, which the chair page implements as "log
// the speech, pause, clear the floor".
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GripHorizontal, X } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { SeatCircleFlag } from '@/components/CircleFlag';

type Entry = { delegateId: string; country: string };

// Round seat flags (crest, flag, monogram), like the sidebar and the speaker card.
const CHIP_PX = 52;
const PICKUP_PX = 6;
const VISIBLE = 7;

type Drag = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  active: boolean;
  insertAt: number | null;
};

export default function SpeakerStrip({
  list,
  onReorder,
  onRemove,
  onRemoveCurrent,
  lastSpeakerDelegateId,
  currentSpeakerDelegateId,
  isRoomOrderTdT,
  formatName,
}: {
  list: Entry[];
  /** Receives the FULL list in its new order (the current speaker, if listed, stays first). */
  onReorder?: (newList: Entry[]) => void;
  onRemove?: (delegateId: string) => void;
  /** X on the speaker holding the floor. Omitted = no X on that flag. */
  onRemoveCurrent?: () => void;
  lastSpeakerDelegateId?: string | null;
  currentSpeakerDelegateId?: string | null;
  isRoomOrderTdT?: boolean;
  formatName: (country: string) => string;
}) {
  const t = useT();
  const [dragState, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const rowRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);

  const visible = list.slice(0, VISIBLE);
  const overflow = list.length > VISIBLE ? list.length - VISIBLE : 0;
  const currentAtTop = !!currentSpeakerDelegateId && list[0]?.delegateId === currentSpeakerDelegateId;
  const minInsert = currentAtTop ? 1 : 0;

  const setDragBoth = (d: Drag | null) => { dragRef.current = d; setDrag(d); };

  // The dragged delegate left the list (another device removed or called them): the drag
  // is ignored from this render on, and `commit` finds nothing to move on release.
  const drag = dragState && list.some((s) => s.delegateId === dragState.id) ? dragState : null;

  const isRtl = () => (rowRef.current ? getComputedStyle(rowRef.current).direction === 'rtl' : false);

  /** Index in the list WITHOUT the dragged entry where it would land. */
  const insertionIndex = (clientX: number, draggedId: string): number => {
    const rtl = isRtl();
    let count = 0;
    for (const s of visible) {
      if (s.delegateId === draggedId) continue;
      const el = itemRefs.current.get(s.delegateId);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      if (rtl ? clientX < mid : clientX > mid) count++;
    }
    return Math.max(minInsert, count);
  };

  const commit = (draggedId: string, insertAt: number) => {
    if (!onReorder) return;
    const from = list.findIndex((s) => s.delegateId === draggedId);
    if (from < 0) return;
    const without = list.filter((s) => s.delegateId !== draggedId);
    const at = Math.min(Math.max(minInsert, insertAt), without.length);
    if (at === from) return;   // dropped where it was: write nothing
    const next = [...without];
    next.splice(at, 0, list[from]);
    onReorder(next);
  };

  // The pointer is followed on WINDOW listeners, not through element pointer capture. Capture
  // lived on the flag's own node, so anything that replaced that node mid-drag (a realtime
  // refresh re-rendering the queue, the floor switching branch when the speaker changes)
  // silently ended the drag, and a press on the X or grip corner never started one. The
  // listeners read the latest list through refs, so a drop always lands against the list on
  // screen at release, never the one from the press.
  const listLatest = useRef(list);
  const commitLatest = useRef(commit);
  const insertionLatest = useRef(insertionIndex);
  useLayoutEffect(() => {
    listLatest.current = list;
    commitLatest.current = commit;
    insertionLatest.current = insertionIndex;
  });
  const detachRef = useRef<(() => void) | null>(null);
  useEffect(() => () => { detachRef.current?.(); }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (!onReorder || e.button !== 0 || !e.isPrimary) return;
    detachRef.current?.();
    const pointerId = e.pointerId;
    setDragBoth({ id, pointerId, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, active: false, insertAt: null });

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== ev.pointerId) return;
      if (!listLatest.current.some((s) => s.delegateId === d.id)) { finish(true); return; }
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      const active = d.active || Math.hypot(dx, dy) >= PICKUP_PX;
      if (!active) return;
      ev.preventDefault();
      setDragBoth({ ...d, dx, dy, active, insertAt: insertionLatest.current(ev.clientX, d.id) });
    };
    const onUp = (ev: PointerEvent) => {
      if (dragRef.current?.pointerId !== ev.pointerId) return;
      finish(ev.type === 'pointercancel');
    };
    const finish = (cancelled: boolean) => {
      const d = dragRef.current;
      detach();
      setDragBoth(null);
      if (!d?.active) return;
      // The click that follows a real drag is swallowed wherever the pointer was released
      // (on another flag, its X, or the big clock under the strip, which would toggle Start).
      suppressClick.current = true;
      const swallow = (ce: MouseEvent) => { ce.stopPropagation(); ce.preventDefault(); };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => { suppressClick.current = false; window.removeEventListener('click', swallow, { capture: true }); }, 0);
      if (!cancelled && d.insertAt !== null) commitLatest.current(d.id, d.insertAt);
    };
    const detach = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      if (detachRef.current === detach) detachRef.current = null;
    };
    window.addEventListener('pointermove', onMove, { capture: true, passive: false });
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    detachRef.current = detach;
  };

  const moveByKey = (id: string, delta: number) => {
    const from = list.findIndex((s) => s.delegateId === id);
    if (from < 0) return;
    commit(id, from + delta);
  };

  // Where the drop bar goes: before the non-dragged entry whose index (in the list without
  // the dragged one) equals insertAt, or after the last visible flag.
  const withoutVisible = drag?.active ? visible.filter((s) => s.delegateId !== drag.id) : visible;
  const barBeforeId = drag?.active && drag.insertAt !== null && drag.insertAt < withoutVisible.length
    ? withoutVisible[drag.insertAt]?.delegateId ?? null : null;
  const barAtEnd = !!drag?.active && drag.insertAt !== null && drag.insertAt >= withoutVisible.length;
  const lastVisibleId = withoutVisible[withoutVisible.length - 1]?.delegateId ?? null;

  return (
    <div className="flex flex-col items-center w-full mb-1 shrink-0 pt-2" data-tutorial="speakers-queue">
      <div
        ref={rowRef}
        className="flex flex-nowrap items-start gap-3 justify-center min-w-0 px-2"
        onClickCapture={(e) => { if (suppressClick.current) { e.stopPropagation(); e.preventDefault(); } }}
      >
        {visible.map((s, i) => {
          const isCurrent = !!currentSpeakerDelegateId && s.delegateId === currentSpeakerDelegateId;
          const movable = !isCurrent && !!onReorder;
          const dragging = drag?.active && drag.id === s.delegateId;
          const name = formatName(s.country);
          const removeHandler = isCurrent ? onRemoveCurrent : onRemove ? () => onRemove(s.delegateId) : undefined;
          return (
            <div
              key={s.delegateId}
              ref={(el) => { if (el) itemRefs.current.set(s.delegateId, el); else itemRefs.current.delete(s.delegateId); }}
              className={`group relative flex flex-col items-center gap-1 shrink-0 select-none ${movable ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
              style={{
                touchAction: movable ? 'none' : undefined,
                transform: dragging ? `translate(${drag!.dx}px, ${drag!.dy * 0.35}px) scale(1.06)` : undefined,
                zIndex: dragging ? 20 : undefined,
                                filter: dragging ? 'drop-shadow(0 10px 18px rgba(27,56,40,0.28))' : undefined,
              }}
              onDragStart={(e) => e.preventDefault()}
              onPointerDown={movable ? (e) => onPointerDown(e, s.delegateId) : undefined}
            >
              {barBeforeId === s.delegateId && (
                <span aria-hidden className="absolute rounded-full" style={{ insetInlineStart: -8, top: -2, height: 52, width: 4, backgroundColor: '#B6871F', boxShadow: '0 0 0 3px rgba(182,135,31,0.22)' }} />
              )}
              {barAtEnd && lastVisibleId === s.delegateId && (
                <span aria-hidden className="absolute rounded-full" style={{ insetInlineEnd: -8, top: -2, height: 52, width: 4, backgroundColor: '#B6871F', boxShadow: '0 0 0 3px rgba(182,135,31,0.22)' }} />
              )}
              {isRoomOrderTdT ? (
                <div className={`w-14 h-14 rounded-full bg-[#DDD4C0] flex items-center justify-center ${isCurrent ? 'ring-4 ring-[#1B3828]' : ''}`}>
                  <span className="text-2xl font-black" style={{ color: '#1B3828' }}>{i + 2}</span>
                </div>
              ) : (
                <SeatCircleFlag
                  country={s.country}
                  size={CHIP_PX}
                  decorative
                  loading="eager"
                  style={{
                    pointerEvents: 'none',
                    boxShadow: isCurrent
                      ? '0 0 0 3px #EDE7D8, 0 0 0 5.5px #B6871F'
                      : '0 1px 2px rgba(27,56,40,0.10), 0 3px 8px rgba(27,56,40,0.14)',
                  }}
                />
              )}
              {!isRoomOrderTdT && (
                <span className="line-clamp-2 break-words whitespace-normal leading-tight max-w-[80px] text-xs font-semibold text-center" style={{ color: '#1C1410' }}>{name}</span>
              )}
              {isCurrent && <span className="text-sm font-semibold" style={{ color: '#8B5A20' }}>{t('gsl_speaking')}</span>}
              {!isCurrent && i === 0 && <span className="text-xs font-semibold" style={{ color: '#8B5A20' }}>{t('gsl_up_next')}</span>}
              {!isCurrent && lastSpeakerDelegateId && s.delegateId === lastSpeakerDelegateId && i !== 0 && (
                <span className="text-xs font-bold text-[#6A5A4A] bg-[#DDD4C0] px-1.5 py-0.5 rounded">{t('gsl_last')}</span>
              )}
              {movable && !drag?.active && (
                <button
                  type="button"
                  aria-label={t('gsl_move_speaker', { country: name })}
                  title={t('gsl_drag_hint')}
                  onKeyDown={(e) => {
                    const rtl = isRtl();
                    if (e.key === 'ArrowLeft') { e.preventDefault(); moveByKey(s.delegateId, rtl ? 1 : -1); }
                    if (e.key === 'ArrowRight') { e.preventDefault(); moveByKey(s.delegateId, rtl ? -1 : 1); }
                  }}
                  className="absolute -top-2 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 h-4 px-1 rounded-full bg-[#EDE7D8] text-[#6A5A4A] flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] transition-opacity"
                  style={{ pointerEvents: 'auto' }}
                  tabIndex={0}
                >
                  <GripHorizontal size={12} strokeWidth={2.6} aria-hidden />
                </button>
              )}
              {removeHandler && !drag?.active && (
                <button
                  type="button"
                  data-strip-remove
                  onClick={(e) => { e.stopPropagation(); removeHandler(); }}
                  aria-label={isCurrent ? t('speaker_remove_current', { country: name }) : t('gsl_remove_speaker', { country: name })}
                  title={isCurrent ? t('speaker_remove_current', { country: name }) : t('gsl_remove_speaker', { country: name })}
                  className={`absolute -top-2 -end-2 w-6 h-6 rounded-full flex items-center justify-center shadow-sm opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] transition-opacity active:scale-[0.92] ${isCurrent ? 'bg-[#8B2020] text-white' : 'bg-[#EDE7D8] text-[#1C1410] hover:bg-[#8B2020] hover:text-white'}`}
                >
                  <X size={13} strokeWidth={3} aria-hidden />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-center h-10 flex items-start justify-center pt-1">
        {overflow > 0 && (
          <span className="text-xs font-medium tabular-nums" style={{ color: '#6A5A4A' }}>{t('gsl_more_in_queue').replace('{n}', String(overflow))}</span>
        )}
      </div>
    </div>
  );
}
