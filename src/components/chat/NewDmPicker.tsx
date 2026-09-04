'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Portal from '@/components/Portal';
import { NEU, OUTFIT, EASE } from '@/components/neu';
import { getCountryDisplayName, compareCountryNames } from '@/lib/countries';
import { ChatAvatar } from './ChatAvatar';
import { CHAT, portalFrame, type TFn } from './chatTokens';

const PANEL_W = 268;
const MAX_H = 320;
const GAP = 8;

interface Candidate { key: string; label: string; isChair: boolean }

/**
 * "New message to…" picker.
 *
 * BINDING UI RULE: this is rendered through Portal at FIXED viewport coordinates computed
 * from the trigger's getBoundingClientRect(), repositioned on capture-phase scroll and on
 * resize, and flipped near the viewport edges. The previous inline dropdown lived inside the
 * conversation column's overflow-y-auto and was clipped by it. The fix belongs here, never in
 * the ancestor's overflow.
 */
export default function NewDmPicker({
  open,
  triggerRef,
  onClose,
  onPick,
  delegates,
  coChairs,
  language,
  t,
}: {
  open: boolean;
  triggerRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onPick: (key: string) => void;
  /** Country names of selectable delegates. */
  delegates: string[];
  /** Chair names of the other chairs on the dais (Moderator and Commenters alike). */
  coChairs: string[];
  language: string;
  t: TFn;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; maxH: number } | null>(null);
  const [query, setQuery] = useState('');

  // Reposition against the trigger, flipping up / clamping horizontally near the edges.
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Convert into the portal's own coordinate space (FitToScreen scales #fit-root, and a
      // transformed ancestor is the containing block for position:fixed).
      const f = portalFrame();
      const r = {
        left: f.toLocalX(rect.left),
        right: f.toLocalX(rect.right),
        top: f.toLocalY(rect.top),
        bottom: f.toLocalY(rect.bottom),
      };

      const spaceBelow = f.maxY - r.bottom - GAP;
      const spaceAbove = r.top - f.minY - GAP;
      // Open upward when there isn't room below — the trigger sits at the bottom of the
      // conversation column, so this is the normal case.
      const openUp = spaceBelow < Math.min(MAX_H, 220) && spaceAbove > spaceBelow;
      const maxH = Math.max(140, Math.min(MAX_H, openUp ? spaceAbove : spaceBelow));

      let left = r.left;
      if (left + PANEL_W > f.maxX - 8) left = f.maxX - PANEL_W - 8; // flip/clamp at the right edge
      if (left < f.minX + 8) left = f.minX + 8;

      const top = openUp
        ? Math.max(f.minY + 8, r.top - GAP - maxH)
        : Math.min(f.maxY - maxH - 8, r.bottom + GAP);
      setPos({ left, top, maxH });
    };
    place();
    // Capture phase so scrolling ANY ancestor (including the conversation column) repositions.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, triggerRef]);

  // Outside click — the portaled node is not a DOM descendant of the trigger, so both must
  // be excluded explicitly.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, triggerRef]);

  useEffect(() => { if (!open) setQuery(''); }, [open]);

  if (!open || !pos) return null;

  const q = query.trim().toLowerCase();
  const chairItems: Candidate[] = coChairs
    .map((n) => ({ key: n, label: n, isChair: true }))
    .filter((c) => !q || c.label.toLowerCase().includes(q));
  const delegateItems: Candidate[] = delegates
    .slice()
    .sort((a, b) => compareCountryNames(a, b, language))
    .map((n) => ({ key: n, label: getCountryDisplayName(n, language), isChair: false }))
    .filter((c) => !q || c.label.toLowerCase().includes(q) || c.key.toLowerCase().includes(q));

  const all = [...chairItems, ...delegateItems];

  const sectionLabel = (text: string) => (
    <p
      className="px-2 pt-2 pb-1"
      style={{ fontFamily: OUTFIT, fontSize: 9.5, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: NEU.muted }}
    >
      {text}
    </p>
  );

  const row = (c: Candidate) => (
    <button
      key={`${c.isChair ? 'c' : 'd'}-${c.key}`}
      onClick={() => { onPick(c.key); onClose(); }}
      className="w-full text-start focus:outline-none flex items-center gap-2.5"
      style={{
        padding: '7px 9px', borderRadius: 12, border: 'none', background: 'transparent',
        cursor: 'pointer', transition: `background-color 160ms ${EASE}`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = NEU.base; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      {/* Flags in the picker rows — these were text-only before. */}
      <ChatAvatar kind={c.isChair ? 'chair' : 'delegate'} name={c.key} size={18} />
      <span className="truncate" style={{ fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink }}>
        {c.label}
      </span>
      {c.isChair && (
        <span
          className="ms-auto shrink-0"
          style={{
            fontFamily: OUTFIT, fontSize: 8.5, fontWeight: 900, letterSpacing: '0.1em',
            color: NEU.deepGold, padding: '2px 6px', borderRadius: 999,
            backgroundColor: NEU.base, boxShadow: NEU.inSm,
          }}
        >
          {t('chat_chair_tag')}
        </span>
      )}
    </button>
  );

  return (
    <Portal>
      <div
        ref={panelRef}
        role="dialog"
        aria-label={t('chat_new_message')}
        style={{
          position: 'fixed',
          left: pos.left,
          top: pos.top,
          width: PANEL_W,
          maxHeight: pos.maxH,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: NEU.surface,
          borderRadius: 16,
          boxShadow: `${NEU.out}, 0 18px 44px rgba(27,56,40,0.22)`,
          overflow: 'hidden',
        }}
      >
        <div className="shrink-0 px-3 pt-3 pb-2" style={{ borderBottom: `1px solid ${CHAT.hairline}` }}>
          <p style={{ fontFamily: OUTFIT, fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: NEU.ink }}>
            {t('chat_new_message')}
          </p>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && all.length > 0) { onPick(all[0].key); onClose(); } }}
            placeholder="…"
            style={{
              marginTop: 8, width: '100%', padding: '7px 11px', borderRadius: 999,
              backgroundColor: NEU.base, boxShadow: NEU.inSm, border: 'none', outline: 'none',
              fontFamily: OUTFIT, fontSize: 12, color: NEU.ink,
            }}
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-2">
          {all.length === 0 && (
            <p className="px-2 py-6 text-center" style={{ fontFamily: OUTFIT, fontSize: 11.5, color: NEU.muted }}>
              —
            </p>
          )}
          {chairItems.length > 0 && sectionLabel(t('chat_co_chairs'))}
          {chairItems.map(row)}
          {delegateItems.length > 0 && chairItems.length > 0 && sectionLabel(t('chat_delegates'))}
          {delegateItems.map(row)}
        </div>
      </div>
    </Portal>
  );
}
