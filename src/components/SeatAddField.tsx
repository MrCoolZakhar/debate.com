'use client';

// ─────────────────────────────────────────────────────────────────────────────
// SeatAddField: the small "add a seat" type box beside the quorum tabs (16 Sep 2026).
//
// Replaces the "+ Add a seat" button and its full-screen picker, in the chair sidebar and in
// the pre-session roll call alike. The owner wanted it inline and small: it sits on the SAME
// row as the quorum tabs (QuorumRings `trailing`), so it costs the list no height.
//
// Type a country (any locale's name, the same matching the old picker used) or any custom
// name. Nothing is suggested on focus or while the field is empty (owner, 17 Sep 2026): the
// list appears only once at least one non-space character is typed. It then opens under the field through Portal at fixed coordinates
// (never clipped by the sidebar's overflow, flipped above near the bottom edge, positions
// converted into #fit-root's scaled space by anchorBox):
//   • Enter adds the highlighted row: the top country match, or the typed name as a custom
//     seat when nothing matches. Arrow keys move the highlight. Escape clears, then closes.
//   • Shift+Enter, or the megaphone on a row, adds it as an observer.
// Every seat is created PRESENT (the parent owns the write: the chair page's
// handleDelegateAdd → addDelegate with status 'present' and the observer flag in the same
// INSERT). A name already on the roster is never offered and never added twice.
//
// The caller renders this only for a chair who can write: never for a Commenter, never on
// an ended session. Not a security boundary (AGENTS.md rule 15).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Megaphone, Plus } from 'lucide-react';
import Portal from '@/components/Portal';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { UnknownSeatIcon } from '@/components/UnknownSeatIcon';
import { anchorBox, place } from '@/components/voting/anchorPosition';
import { UN_COUNTRIES, getCountryDisplayName, matchesCountryQuery, startsWithCountryQuery } from '@/lib/countries';
import { useLanguage, useT } from '@/contexts/LanguageContext';

const OUTFIT = "var(--font-brand), sans-serif";
const LIST_W = 272;
const LIST_MAX_H = 300;

type Option = { kind: 'country'; name: string; code: string } | { kind: 'custom'; name: string };

export default function SeatAddField({
  delegates,
  onAdd,
  large = false,
  locked = null,
}: {
  /** The roster, to leave out seats that already exist. */
  delegates: { country: string }[];
  onAdd: (country: string, options: { observer: boolean }) => void;
  /** The projector-sized pre-session roll call. */
  large?: boolean;
  /** A Commenter: drawn disabled, a press raises the "only the Moderator" notice. Nothing is typed or written. */
  locked?: { reason: string; onAttempt: () => void } | null;
}) {
  const t = useT();
  const { language } = useLanguage();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [announced, setAnnounced] = useState('');
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const existing = useMemo(() => new Set(delegates.map((d) => d.country.trim().toLowerCase())), [delegates]);
  const trimmed = query.trim();
  const rq = trimmed.toLowerCase();

  const options = useMemo<Option[]>(() => {
    const available = UN_COUNTRIES.filter((c) => !existing.has(c.name.toLowerCase()));
    // No suggestions until something is typed.
    if (!rq) return [];
    const matches = available.filter((c) => startsWithCountryQuery(c.name, rq, language))
      .concat(available.filter((c) => !startsWithCountryQuery(c.name, rq, language) && matchesCountryQuery(c.name, rq, language)));
    const out: Option[] = matches.map((c) => ({ kind: 'country', name: c.name, code: c.code }));
    // The custom seat follows the countries it could be confused with, so Enter (top row)
    // and the list agree on what comes first.
    const exact = matches[0] && matches[0].name.toLowerCase() === rq;
    if (trimmed && !existing.has(rq) && !exact) out.push({ kind: 'custom', name: trimmed });
    return out;
  }, [existing, rq, trimmed, language]);

  const changeQuery = (next: string) => {
    setQuery(next);
    setActive(0);
  };
  // `open` = the field wants a list; it is only SHOWN once something is typed.
  const listShown = open && trimmed.length > 0;

  const reposition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const box = anchorBox(el);
    const width = Math.max(LIST_W, box.right - box.left);
    const h = Math.min(LIST_MAX_H, listRef.current?.offsetHeight ?? LIST_MAX_H);
    const p = place(box, width, h, 'start');
    setPos((prev) => (prev && prev.left === p.left && prev.top === p.top && prev.width === width ? prev : { ...p, width }));
  }, []);

  useLayoutEffect(() => {
    if (!listShown) return;
    reposition();
    // The Portal mounts its target one effect later, so measure the list again then.
    const raf = requestAnimationFrame(reposition);
    return () => cancelAnimationFrame(raf);
  }, [listShown, options.length, reposition]);

  useEffect(() => {
    if (!listShown) return;
    const onScroll = () => reposition();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (inputRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [listShown, reposition]);

  // Keep the highlighted row in view while arrowing through the list.
  useEffect(() => {
    if (!listShown) return;
    listRef.current?.querySelector<HTMLElement>(`[data-seat-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, listShown]);

  const commit = (opt: Option | undefined, observer: boolean) => {
    if (!opt) return;
    const name = opt.name.trim();
    if (!name || existing.has(name.toLowerCase())) return;
    onAdd(name, { observer });
    const shown = getCountryDisplayName(name, language);
    setAnnounced(observer ? t('rollcall_add_seat_added_observer', { country: shown }) : t('rollcall_add_seat_added', { country: shown }));
    changeQuery('');
    inputRef.current?.focus();
  };

  const h = large ? 38 : 28;

  if (locked) {
    return (
      <div className="relative w-full" data-tutorial="seat-add" style={{ maxWidth: large ? 300 : undefined }}>
        <button
          type="button"
          aria-disabled
          aria-label={t('rollcall_add_seat_field')}
          title={locked.reason}
          onClick={locked.onAttempt}
          className="w-full flex items-center gap-1.5 rounded-full cursor-not-allowed opacity-60 shadow-[inset_0_0_0_1px_rgba(237,231,216,0.18)] focus:outline-none focus-visible:shadow-[inset_0_0_0_1.5px_rgba(238,217,138,0.65)]"
          style={{ height: h, paddingInline: large ? 12 : 8, backgroundColor: 'rgba(237,231,216,0.08)' }}
        >
          <Plus size={large ? 16 : 13} strokeWidth={3} aria-hidden className="shrink-0" style={{ color: 'rgba(237,231,216,0.7)' }} />
          <span className="flex-1 min-w-0 truncate text-start" style={{ fontFamily: OUTFIT, fontSize: large ? 15 : 12.5, fontWeight: 600, color: 'rgba(237,231,216,0.55)' }}>
            {t('rollcall_add_seat')}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full" data-tutorial="seat-add" style={{ maxWidth: large ? 300 : undefined }}>
      <div
        className="flex items-center gap-1.5 rounded-full cursor-text transition-shadow shadow-[inset_0_0_0_1px_rgba(237,231,216,0.18)] focus-within:shadow-[inset_0_0_0_1.5px_rgba(238,217,138,0.65)]"
        style={{ height: h, paddingInline: large ? 12 : 8, backgroundColor: 'rgba(237,231,216,0.08)' }}
        onClick={() => inputRef.current?.focus()}
      >
        <Plus size={large ? 16 : 13} strokeWidth={3} aria-hidden className="shrink-0" style={{ color: 'rgba(237,231,216,0.7)' }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          role="combobox"
          aria-expanded={listShown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={listShown && options[active] ? `${listId}-${active}` : undefined}
          aria-label={t('rollcall_add_seat_field')}
          title={t('rollcall_add_seat_hint')}
          placeholder={t('rollcall_add_seat')}
          autoComplete="off"
          spellCheck={false}
          onFocus={() => setOpen(true)}
          onChange={(e) => { changeQuery(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { if (!trimmed) return; e.preventDefault(); setOpen(true); setActive((i) => Math.min(options.length - 1, i + 1)); }
            else if (e.key === 'ArrowUp') { if (!trimmed) return; e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
            else if (e.key === 'Enter') {
              e.preventDefault();
              // Nothing typed: nothing is suggested, so Enter adds nothing.
              if (!trimmed) return;
              setOpen(true);
              commit(options[active], e.shiftKey);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              if (query) changeQuery('');
              else { setOpen(false); inputRef.current?.blur(); }
            } else if (e.key === 'Tab') setOpen(false);
          }}
          className="flex-1 min-w-0 bg-transparent focus:outline-none placeholder:text-[rgba(237,231,216,0.55)]"
          style={{ fontFamily: OUTFIT, fontSize: large ? 15 : 12.5, fontWeight: 600, color: '#F4EFE3' }}
        />
      </div>
      <span role="status" aria-live="polite" className="sr-only">{announced}</span>

      {listShown && (
        <Portal>
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={t('rollcall_add_seat')}
            // Pointer down inside keeps focus in the field (no blur, no close).
            onMouseDown={(e) => e.preventDefault()}
            className="fixed z-[80] overflow-y-auto overscroll-contain rounded-2xl py-1.5"
            style={{
              left: pos?.left ?? -9999,
              top: pos?.top ?? -9999,
              width: pos?.width ?? LIST_W,
              maxHeight: LIST_MAX_H,
              backgroundColor: '#FAF8F3',
              boxShadow: '0 12px 32px rgba(27,56,40,0.28), 0 2px 6px rgba(27,56,40,0.16), inset 0 0 0 1px rgba(27,56,40,0.10)',
              fontFamily: OUTFIT,
            }}
          >
            {options.length === 0 ? (
              <p className="m-0 px-4 py-4 text-center text-[13px]" style={{ color: '#6A5A4A' }}>{t('rollcall_add_seat_empty')}</p>
            ) : options.map((opt, i) => {
              const isActive = i === active;
              const label = opt.kind === 'country' ? getCountryDisplayName(opt.name, language) : opt.name;
              return (
                <div
                  key={opt.kind === 'country' ? opt.code : `custom:${opt.name}`}
                  id={`${listId}-${i}`}
                  data-seat-index={i}
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(opt, false)}
                  className="group/opt mx-1.5 flex items-center gap-2.5 rounded-xl ps-2 pe-1 cursor-pointer"
                  style={{ minHeight: 40, backgroundColor: isActive ? 'rgba(27,56,40,0.09)' : 'transparent' }}
                >
                  {opt.kind === 'country'
                    ? <SeatCircleFlag country={opt.name} size={26} decorative ring="rgba(28,20,16,0.14)" />
                    : <span className="shrink-0"><UnknownSeatIcon size={26} /></span>}
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="truncate text-[14px] font-semibold" style={{ color: '#1C1410' }}>{label}</span>
                    {opt.kind === 'custom' && (
                      <span className="truncate text-[11px]" style={{ color: '#6A5A4A' }}>{t('rollcall_add_seat_custom', { name: opt.name })}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => { e.stopPropagation(); commit(opt, true); }}
                    aria-label={`${t('rollcall_add_seat_observer')}: ${label}`}
                    title={t('rollcall_add_seat_observer')}
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-[opacity,background-color] duration-150 hover:bg-[#1B3828] hover:text-[#EED98A] focus:outline-none ${isActive ? 'opacity-100' : 'opacity-0 group-hover/opt:opacity-100 [@media(hover:none)]:opacity-70'}`}
                    style={{ color: '#1B3828' }}
                  >
                    <Megaphone size={15} strokeWidth={2.4} aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        </Portal>
      )}
    </div>
  );
}
