'use client';
// Gavelling Crisis: a compact "change the backroomer" control for one directive, used by the rows of Waiting for a Reply.
// A small round picture of who has it opens a list of the backroom (picture, name, how many they have open); a press moves
// the directive (crisis_assign_directive) without opening it. The list is a Portal at fixed coordinates, flipped upward
// near the bottom edge, and scrolls itself.

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import Portal from '@/components/Portal';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { assignDirective, crisisError, type CrisisRef } from '@/lib/crisis/api';
import type { Directive, Member } from '@/lib/crisis/types';
import { Avatar, CK } from '../../crisisKit';
import { StaffPic } from '../directives/directiveParts';

const W = 252;

export default function AssignControl({ cref, directive, staff, openCounts, onChanged }: {
  cref: CrisisRef; directive: Directive; staff: Member[]; openCounts: Map<string, number>; onChanged: () => void;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; maxHeight: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const current = staff.find((m) => m.id === directive.assigned_member_id) ?? null;

  const place = useCallback(() => {
    const b = btn.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const wanted = Math.min(320, 12 + staff.length * 46);
    const up = below < wanted && above > below;
    const maxHeight = Math.max(120, Math.min(wanted, up ? above : below));
    const left = Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8));
    setPos(up ? { bottom: window.innerHeight - r.top + 6, left, maxHeight } : { top: r.bottom + 6, left, maxHeight });
  }, [staff.length]);

  useLayoutEffect(() => {
    if (!pos) return;
    const onResize = () => place();
    const onScroll = (e: Event) => { if (!box.current?.contains(e.target as Node)) setPos(null); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && (box.current?.contains(t) || btn.current?.contains(t))) return;
      setPos(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPos(null); };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pos, place]);

  const pick = async (m: Member) => {
    if (busy) return;
    if (m.id === directive.assigned_member_id) { setPos(null); return; }
    setBusy(true);
    try {
      await assignDirective(cref, directive.id, m.id);
      notifyOk(`Moved to ${m.display_name}`, 'crisis-command');
      setPos(null);
      onChanged();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not move this directive.'), 'crisis-command');
    } finally { setBusy(false); }
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => (pos ? setPos(null) : place())}
        aria-haspopup="listbox"
        aria-expanded={!!pos}
        aria-label={`Change who has this directive. Now ${current ? current.display_name : 'nobody'}`}
        title={current ? `With ${current.display_name}. Change` : 'Nobody has it. Pick someone'}
        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.96] transition-transform"
        style={{ gap: 2, border: 0, cursor: 'pointer', padding: '2px 4px 2px 2px', borderRadius: 999, background: CK.card, boxShadow: `${CK.shadowSm}, inset 0 0 0 1px ${CK.hair}`, color: CK.inkSoft }}
      >
        <StaffPic member={current} size={22} />
        <ChevronDown size={12} strokeWidth={1.8} aria-hidden />
      </button>
      {pos && (
        <Portal>
          <div
            ref={box}
            role="listbox"
            aria-label="Backroom"
            style={{
              position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: W, maxHeight: pos.maxHeight, overflowY: 'auto', zIndex: 300,
              background: CK.card, borderRadius: 16, padding: 6, fontFamily: CK.font, color: CK.ink,
              boxShadow: '0 18px 44px rgba(58,14,15,0.28), 0 0 0 1px rgba(110,30,30,0.1)',
            }}
          >
            {staff.length === 0 && <p style={{ margin: 8, fontSize: 13, color: CK.inkSoft }}>No backroomers yet.</p>}
            {staff.map((m) => {
              const here = m.id === directive.assigned_member_id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={here}
                  disabled={busy}
                  onClick={() => pick(m)}
                  className="flex items-center w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] disabled:opacity-60"
                  style={{ gap: 10, border: 0, cursor: 'pointer', padding: '6px 8px', borderRadius: 10, background: here ? CK.well : 'transparent', fontFamily: CK.font }}
                >
                  <Avatar name={m.display_name} src={m.picture_url} size={30} color={CK.forest2} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: 'block', fontSize: 13.5, color: CK.ink, overflowWrap: 'anywhere', lineHeight: 1.2 }}>{m.display_name}</b>
                    <span style={{ fontSize: 11.5, color: CK.inkSoft }}>{openCounts.get(m.id) ?? 0} open</span>
                  </span>
                  {here && <Check size={15} strokeWidth={1.8} aria-hidden style={{ color: CK.ok, flex: 'none' }} />}
                </button>
              );
            })}
          </div>
        </Portal>
      )}
    </>
  );
}
