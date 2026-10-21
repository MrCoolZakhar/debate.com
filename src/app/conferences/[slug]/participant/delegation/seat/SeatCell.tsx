'use client';

// The Seat cell of the leader's People table (owner, 20 Oct 2026): the
// country's round flag big (56px) with the country's name centred under it,
// wrapping, never cut; beside that block, vertically centred, the committee's
// round emblem smaller (28px) with its acronym, which stays the link that opens
// the committee. Then the seat's small icon buttons (Unallocate, Upload
// position paper, DELEGATIONS_V2_DB only). A seated member's block can be
// dragged onto another person's row (useSeatDrag); a finger drags from the
// grip. A member with no seat shows "Allocate" when there is one to give.

import { useRef } from 'react';
import { Armchair, CircleMinus, FileUp, GripVertical } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { CommitteeDisc, FONT, FOREST, INK, INK_SOFT, STROKE } from '../leaderKit';
import type { PersonRow } from '../PeopleTable';

export type Seat = NonNullable<PersonRow['seat']>;

function IconBtn({ label, onPress, disabled, children }: { label: string; onPress: (el: HTMLButtonElement) => void; disabled?: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); if (ref.current) onPress(ref.current); }}
      className="inline-flex items-center justify-center flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)] hover:bg-[#F1ECE1]"
      style={{ width: 36, height: 36, borderRadius: 9, border: 'none', background: 'transparent', color: INK_SOFT, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1 }}
    >
      {children}
    </button>
  );
}

export default function SeatCell({
  seat, role, draggable, dragging, onDragStart, onOpenCommittee, wasJustDragged,
  onTakeOut, onUpload, onPlace, busy,
}: {
  seat: Seat | null;
  role: PersonRow['role'];
  /** The seat block can be lifted onto another row. */
  draggable: boolean;
  /** This seat is the one being dragged. */
  dragging: boolean;
  onDragStart: (e: React.PointerEvent, fromGrip: boolean) => void;
  /** Opens the committee; when left out the acronym is plain text (the organiser's pop-up). */
  onOpenCommittee?: (committeeId: string) => void;
  wasJustDragged: () => boolean;
  /** Each is offered only when given. */
  onTakeOut?: (anchor: HTMLElement) => void;
  onUpload?: () => void;
  onPlace?: (anchor: HTMLElement) => void;
  busy: boolean;
}) {
  if (!seat) {
    if (onPlace) {
      return (
        <PlaceButton onPlace={onPlace} disabled={busy} />
      );
    }
    return (
      <span style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>
        {role === 'faculty-advisor' ? 'Advisors have no allocation' : 'No allocation yet'}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-0" style={{ opacity: dragging ? 0.45 : 1 }}>
      {draggable && (
        <span
          aria-hidden
          title="Drag onto another person to switch allocations"
          onPointerDown={(e) => onDragStart(e, true)}
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{ width: 20, height: 44, marginLeft: -6, color: 'color-mix(in srgb, var(--gv-main) 35%, transparent)', cursor: 'grab', touchAction: 'none' }}
        >
          <GripVertical size={16} strokeWidth={STROKE} aria-hidden />
        </span>
      )}
      <div
        onPointerDown={draggable ? (e) => onDragStart(e, false) : undefined}
        className="flex items-center gap-3 min-w-0 flex-1"
        style={{ cursor: draggable ? 'grab' : 'default' }}
      >
        {/* The country: flag big, name under it. */}
        <div className="flex flex-col items-center flex-none" style={{ width: 88, gap: 4 }}>
          <CircleFlag code={seat.country_code} logoUrl={seat.seatLogo} label={seat.country_name} size={56} decorative />
          <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 500, color: INK, lineHeight: 1.25, textAlign: 'center', maxWidth: '100%' }}>
            {seat.country_name}
          </span>
        </div>
        {/* The committee: smaller, beside it, centred. */}
        <div className="flex items-center min-w-0" style={{ gap: 7 }}>
          <CommitteeDisc src={seat.emblem} size={28} />
          {seat.committee_id && onOpenCommittee ? (
            <button
              type="button"
              title={seat.committee_full ? `Open ${seat.committee_full}` : 'Open this committee'}
              onClick={(e) => { e.stopPropagation(); if (wasJustDragged()) return; if (seat.committee_id) onOpenCommittee?.(seat.committee_id); }}
              className="text-left [overflow-wrap:anywhere] min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)] rounded"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, color: FOREST, textDecoration: 'underline', textUnderlineOffset: 3, lineHeight: 1.35 }}
            >
              {seat.committee_label}
            </button>
          ) : (
            <span className="[overflow-wrap:anywhere] min-w-0" title={seat.committee_full ?? undefined}
              style={{ fontFamily: FONT, fontSize: 13, fontWeight: seat.committee_id ? 600 : 400, color: seat.committee_id ? INK : INK_SOFT, lineHeight: 1.35 }}>
              {seat.committee_label}
            </span>
          )}
        </div>
      </div>
      {(onTakeOut || onUpload) && (
        <div className="flex items-center flex-none" style={{ gap: 2 }}>
          {onUpload && (
            <IconBtn label="Upload position paper" onPress={() => onUpload()} disabled={busy}>
              <FileUp size={17} strokeWidth={STROKE} aria-hidden />
            </IconBtn>
          )}
          {onTakeOut && (
            <IconBtn label="Unallocate" onPress={onTakeOut} disabled={busy}>
              <CircleMinus size={17} strokeWidth={STROKE} aria-hidden />
            </IconBtn>
          )}
        </div>
      )}
    </div>
  );
}

function PlaceButton({ onPlace, disabled }: { onPlace: (anchor: HTMLElement) => void; disabled: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); if (ref.current) onPlace(ref.current); }}
      className="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)]"
      style={{ minHeight: 40, padding: '0 12px', borderRadius: 10, border: '1px dashed color-mix(in srgb, var(--gv-main) 30%, transparent)', background: 'transparent', color: FOREST, fontFamily: FONT, fontSize: 13.5, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}
    >
      <Armchair size={17} strokeWidth={STROKE} aria-hidden />
      Allocate
    </button>
  );
}
