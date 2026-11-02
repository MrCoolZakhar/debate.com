'use client';
// Gavelling Crisis: the frames of the one-by-one reader (DirectiveReader), kept apart so the cards for meeting requests and
// characters that need replacing (InboxExtraCards) wear exactly the same shells as the directive cards: the big front card
// and the smaller cards stepping off to its right, plus the previous / next controls.

import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Directive } from '@/lib/crisis/types';
import { CK } from '../../crisisKit';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import AssignControl from '../command/commandAssign';
import { isStaffRow } from '../command/commandData';
import { StaffPic } from './directiveParts';
import { isOpenStatus } from './directiveKit';

/** How tall each card in the stack is, as a share of the front card's height (shorter, one step at a time). */
export const HEIGHTS = [0.88, 0.77, 0.67, 0.58];
/** The width of the strip each stacked card shows, and the part of its box that hides behind the card before it. */
export const STRIP = 232;
export const HIDDEN = 40;
export const MAX_STACK = HEIGHTS.length;

const iconBtn = { width: 34, height: 34, borderRadius: '50%', border: 0, background: CK.well, color: CK.forest, cursor: 'pointer', flex: 'none' } as const;

/** The arrows and "3 of 12" of the reader's footer. */
export function NavControls({ index, total, onPrev, onNext }: { index: number; total: number; onPrev: () => void; onNext: () => void }) {
  return (
    <span className="inline-flex items-center" style={{ gap: 8 }}>
      <button type="button" onClick={onPrev} disabled={total < 2} aria-label="Previous item" title="Previous (left arrow)"
        className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.94] transition-transform disabled:opacity-40" style={iconBtn}>
        <ChevronLeft size={19} strokeWidth={1.6} />
      </button>
      <span className="inline-flex items-baseline" style={{ gap: 5, whiteSpace: 'nowrap' }}>
        <b style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{index + 1}</b>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>of {total}</span>
      </span>
      <button type="button" onClick={onNext} disabled={total < 2} aria-label="Next item" title="Next (right arrow)"
        className="grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] active:scale-[0.94] transition-transform disabled:opacity-40" style={iconBtn}>
        <ChevronRight size={19} strokeWidth={1.6} />
      </button>
    </span>
  );
}

/**
 * The big front card's shell. `color` is the inset strip on the left (a cabinet directive passes `ring` instead: a 3px frame in the
 * cabinet's colour). Children are its top, its scrolling middle and its footer.
 */
export function FrontShell({ color, ring, tint, label, onActivate, children }: {
  color: string; ring?: boolean; /** A faint wash over the whole card (a cabinet directive). */ tint?: string; label: string; onActivate?: () => void; children: ReactNode;
}) {
  return (
    <article
      className="rd-front"
      aria-label={label}
      onClick={onActivate ? (e) => {
        const t = e.target as HTMLElement;
        if (t.closest('button, a, input, textarea, [role="combobox"], [role="listbox"], [data-no-open]')) return;
        if (window.getSelection()?.toString()) return;
        onActivate();
      } : undefined}
      style={{
        position: 'absolute', left: 0, top: ring ? 32 : 14, bottom: ring ? 10 : 6, width: 'var(--fw)', zIndex: 30, display: 'flex', flexDirection: 'column', cursor: onActivate ? 'pointer' : 'default',
        background: tint ?? CK.card, borderRadius: 24, border: ring ? 'none' : '1px solid rgba(27,56,40,0.14)', fontFamily: CK.font, color: CK.ink,
        boxShadow: ring
          ? `0 0 0 3px ${color}, ${CK.shadow}, 0 22px 44px rgba(58,14,15,0.18)`
          : `${CK.shadow}, 0 22px 44px rgba(58,14,15,0.18), inset 6px 0 0 ${color}`,
      }}
    >
      {children}
    </article>
  );
}

/**
 * A smaller card further back in the stack. It sits BEHIND the card before it; only its right part shows (STRIP wide) and its content
 * starts there. `ring` frames it in `color` (a cabinet directive), `grey` mutes it. `badge` hangs on its top edge.
 */
export function NextShell({ k, fw, grey, ring, tint, padBottom = 14, color, label, onPick, badge, stamp, foot, children }: {
  k: number; fw: number; grey?: boolean; ring?: boolean; /** A faint wash over the whole card (a cabinet directive). */ tint?: string; /** The button's bottom padding. */ padBottom?: number;
  color: string; label: string; onPick: () => void; badge?: ReactNode; stamp?: ReactNode;
  /** A control on the card's bottom row (who is responsible). A sibling of the card's button, never inside it; leave `padBottom` room for it. */
  foot?: ReactNode; children: ReactNode;
}) {
  const pct = HEIGHTS[k - 1];
  const left = fw + (k - 1) * STRIP - HIDDEN;
  const style: CSSProperties = {
    position: 'absolute', left, width: STRIP + HIDDEN, zIndex: 30 - k,
    top: `calc(14px + (100% - 20px) * ${((1 - pct) / 2).toFixed(4)})`, height: `calc((100% - 20px) * ${pct})`,
  };
  return (
    <div className="rd-next" style={style}>
      <div style={{
        position: 'relative', height: '100%', background: tint ?? CK.card, borderRadius: 22, overflow: 'visible', opacity: grey ? 0.62 : 1, filter: grey ? 'grayscale(0.7)' : undefined,
        border: ring ? 'none' : '1px solid rgba(27,56,40,0.14)',
        boxShadow: ring ? `0 0 0 2px ${color}, ${CK.shadowSm}, 0 16px 34px rgba(58,14,15,0.18)` : `${CK.shadowSm}, 0 16px 34px rgba(58,14,15,0.18)`,
      }}>
        {badge}
        {stamp}
        <button type="button" onClick={onPick} aria-label={label}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] transition-transform hover:-translate-y-0.5"
          style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', textAlign: 'left', border: 0, background: 'transparent', cursor: 'pointer', borderRadius: 'inherit', padding: `20px 16px ${padBottom}px ${HIDDEN + 14}px`, fontFamily: CK.font, color: CK.ink, overflow: 'hidden' }}>
          {children}
        </button>
        {foot && (
          <div data-no-open style={{ position: 'absolute', zIndex: 3, left: HIDDEN + 14, right: 14, bottom: 9, display: 'flex', minWidth: 0, pointerEvents: 'none' }}>
            <div style={{ pointerEvents: 'auto', maxWidth: '100%', minWidth: 0 }}>{foot}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Who is responsible for a directive, as a round picture with their name small. On an OPEN directive it is the control that hands the
 * directive to someone else (a Portal list of the backroom; the database moves it, then `onChanged` re-reads). On any other directive it is
 * the same picture and name, read only; nothing at all when nobody is responsible. `ownerId` (the author character's owner) stands in
 * until someone is assigned.
 */
export function ResponsibleFoot({ d, ownerId, openCounts, onChanged }: { d: Directive; ownerId?: string | null; openCounts: Map<string, number>; onChanged: () => void }) {
  const { ref, core } = useCrisis();
  const staff = useMemo(() => core.members.filter(isStaffRow), [core.members]);
  const responsible = d.assigned_member_id ?? ownerId ?? null;
  if (isOpenStatus(d)) {
    return <AssignControl cref={ref} directive={d} staff={staff} openCounts={openCounts} onChanged={onChanged} foot currentId={responsible} />;
  }
  const m = responsible ? core.members.find((x) => x.id === responsible) ?? null : null;
  if (!m) return null;
  return (
    <span className="inline-flex items-center" style={{ gap: 7, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: CK.inkSoft }}>
      <StaffPic member={m} size={28} />
      <span style={{ overflowWrap: 'anywhere' }}>{m.display_name}</span>
    </span>
  );
}
