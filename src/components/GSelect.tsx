'use client';

/**
 * GSelect: the one dropdown for the whole site. Never use a native <select>.
 *
 * A white rounded field with a chevron opens a white panel of roomy rows, the
 * chosen one marked with a forest check. The API stays close to a native
 * select: `value` + `onChange(value)` (only called when the value changes),
 * `disabled`, `name` (a hidden input carries it for forms), `id` (a
 * `<label htmlFor>` labels the trigger) and `aria-*`.
 *
 * Rules it obeys (AGENTS.md, UI RULES):
 *  - The panel is portaled (`@/components/Portal`) at FIXED coordinates
 *    measured from the trigger, converted into `#fit-root`'s scaled space on
 *    the session pages (`anchorBox`), opened on whichever side has room,
 *    clamped on screen, height-capped and internally scrollable, re-placed on
 *    scroll (capture) and resize. It is never clipped by an ancestor.
 *  - Keyboard: ArrowUp / ArrowDown, Home / End, PageUp / PageDown, Enter or
 *    Space picks, Escape closes, Tab closes, typing jumps to a matching row.
 *    More than 12 options adds a search box (16px on phones so iOS never
 *    zooms). combobox / listbox / option with aria-activedescendant.
 *  - Clicks and presses inside the panel never reach the page underneath
 *    (React bubbles through portals; a document `mousedown` outside-click of
 *    another popover would otherwise close it). The panel also carries
 *    `data-gsel-popover`, so a host popover can treat it as its own.
 *  - Labels wrap, never "…" (CLAUDE.md §8). No per-second work, no writes.
 *
 * Default looks live under `:where(.gv-gsel)`, which has zero specificity, so
 * a caller's own class or inline style always wins. The CSS is one hoisted
 * React 19 <style href precedence> (a hand-inserted <head> node is dropped
 * when React hydrates the document).
 */

import {
  useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode,
} from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import Portal from '@/components/Portal';
import { anchorBox } from '@/components/voting/anchorPosition';

export type GSelectOption<V extends string = string> = {
  value: V;
  /** Plain text: it is what type-to-search and the search box match. */
  label: string;
  /** A smaller second line under the label. */
  hint?: string;
  /** A flag, icon or crest drawn before the label (in the panel and the field). */
  icon?: ReactNode;
  disabled?: boolean;
};

export type GSelectProps<V extends string = string> = {
  value: V;
  onChange: (value: V) => void;
  options: readonly GSelectOption<V>[];
  /** Shown in the field when `value` matches no option. */
  placeholder?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  title?: string;
  /** Field size. `sm` for compact controls, `lg` for big form fields. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: CSSProperties;
  /** Draw only `children`-free trigger content, with none of the default field look. */
  bare?: boolean;
  /** Replaces the label + chevron inside the trigger (an icon button, say). */
  triggerContent?: ReactNode;
  /** Defaults to more than 12 options. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Minimum panel width in px (default 200, or the field's width when wider). */
  panelMinWidth?: number;
  align?: 'start' | 'end';
};

const FONT = 'var(--font-brand), sans-serif';
const INK = '#1C1410';
const INK_SOFT = '#5B4F42';
const FOREST = '#1B3828';
const MUTED_OFF = '#A69886';
const PANEL_MAX_H = 340;
const PANEL_MAX_W = 380;
const ROW_H = 40;
const MARGIN = 8;
const GAP = 6;
const Z = 10050;

const CSS = `
:where(.gv-gsel){display:inline-flex;align-items:center;box-sizing:border-box;width:100%;min-height:40px;padding:6px 10px 6px 12px;border-radius:10px;border:1.5px solid rgba(27,56,40,0.22);background:#FFFFFF;color:${INK};font-family:${FONT};font-size:14px;font-weight:500;line-height:1.25;text-align:start;cursor:pointer;transition:border-color 160ms cubic-bezier(0.22,1,0.36,1),box-shadow 200ms cubic-bezier(0.22,1,0.36,1)}
:where(.gv-gsel[data-size="sm"]){min-height:30px;padding:3px 6px 3px 9px;border-radius:8px;font-size:12.5px;border-width:1px}
:where(.gv-gsel[data-size="lg"]){min-height:48px;padding:8px 12px 8px 14px;border-radius:12px;font-size:15px}
:where(.gv-gsel:hover:not(:disabled)){border-color:rgba(27,56,40,0.4)}
:where(.gv-gsel[aria-expanded="true"]){border-color:${FOREST}}
:where(.gv-gsel:focus-visible){outline:none;border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.13)}
:where(.gv-gsel:disabled){cursor:default;opacity:0.6}
:where(.gv-gsel[aria-invalid="true"]){border-color:#8B2020}
:where(.gv-gsel[data-bare]){display:inline-flex;align-items:center;justify-content:center;min-height:0;padding:0;border:none;background:transparent;color:inherit;font:inherit;width:auto}
.gv-gsel:focus{outline:none}
.gv-gsel-inner{display:flex;align-items:center;gap:8px;width:100%;min-width:0}
.gv-gsel-text{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}
.gv-gsel-chev{flex:0 0 auto;color:${INK_SOFT};transition:transform 180ms cubic-bezier(0.22,1,0.36,1)}
.gv-gsel[aria-expanded="true"] .gv-gsel-chev{transform:rotate(180deg)}
.gv-gsel-panel{position:fixed;box-sizing:border-box;display:flex;flex-direction:column;background:#FFFFFF;border-radius:14px;box-shadow:0 18px 44px rgba(27,56,40,0.18),0 2px 8px rgba(27,56,40,0.08),0 0 0 1px rgba(27,56,40,0.08);font-family:${FONT};color:${INK};overflow:hidden;animation:gv-gsel-in 140ms cubic-bezier(0.22,1,0.36,1)}
@keyframes gv-gsel-in{from{opacity:0;transform:translateY(-3px) scale(0.99)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.gv-gsel-panel{animation:none}.gv-gsel-chev{transition:none}}
.gv-gsel-search{display:flex;align-items:center;gap:8px;margin:6px 6px 2px;padding:0 10px;height:38px;border-radius:10px;background:#F4F0E6;color:${INK_SOFT};flex:0 0 auto}
.gv-gsel-search input{flex:1;min-width:0;border:none;background:transparent;outline:none;font-family:${FONT};font-size:14px;color:${INK}}
@media (max-width: 640px){.gv-gsel-search input{font-size:16px}}
.gv-gsel-list{list-style:none;margin:0;padding:6px;overflow-y:auto;overscroll-behavior:contain;flex:1 1 auto}
.gv-gsel-opt{display:flex;align-items:center;gap:10px;min-height:${ROW_H}px;padding:8px 10px;border-radius:10px;font-size:14px;line-height:1.3;cursor:pointer;user-select:none}
.gv-gsel-opt[data-active="true"]{background:rgba(27,56,40,0.07)}
.gv-gsel-opt[aria-selected="true"]{color:${FOREST};font-weight:600}
.gv-gsel-opt[aria-disabled="true"]{color:${MUTED_OFF};cursor:default}
.gv-gsel-opt-text{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}
.gv-gsel-hint{display:block;font-size:12px;font-weight:400;color:${INK_SOFT};margin-top:1px}
.gv-gsel-opt[aria-disabled="true"] .gv-gsel-hint{color:${MUTED_OFF}}
.gv-gsel-icon{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center}
.gv-gsel-check{flex:0 0 auto;color:${FOREST}}
.gv-gsel-empty{padding:12px 10px;font-size:13.5px;color:${INK_SOFT}}
`;

type Placement = { left: number; width: number; maxHeight: number; top?: number; bottom?: number };

function norm(s: string) {
  return s.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function GSelect<V extends string = string>(props: GSelectProps<V>) {
  const {
    value, onChange, options, placeholder, id, name, disabled, invalid, title,
    size = 'md', className, style, bare, triggerContent, searchPlaceholder,
    panelMinWidth = 200, align = 'start',
  } = props;

  const autoId = useId().replace(/:/g, '');
  const listId = `gsel-list-${autoId}`;
  const optId = (i: number) => `gsel-opt-${autoId}-${i}`;

  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeBuf = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<Placement | null>(null);

  const searchable = props.searchable ?? options.length > 12;
  const selectedIndex = options.findIndex(o => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  // Indexes into `options` that are listed right now (search applied).
  const shown = useMemo(() => {
    const q = norm(query.trim());
    const all = options.map((_, i) => i);
    if (!searchable || !q) return all;
    const starts: number[] = [];
    const contains: number[] = [];
    for (const i of all) {
      const o = options[i];
      const hay = norm(`${o.label} ${o.hint ?? ''}`);
      if (hay.startsWith(q) || hay.split(/\s+/).some(w => w.startsWith(q))) starts.push(i);
      else if (hay.includes(q)) contains.push(i);
    }
    return [...starts, ...contains];
  }, [options, query, searchable]);

  const firstEnabled = useCallback((list: number[]) => list.find(i => !options[i]?.disabled) ?? -1, [options]);

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const box = anchorBox(b);
    const trigW = box.right - box.left;
    const width = Math.min(Math.max(trigW, panelMinWidth), Math.max(PANEL_MAX_W, trigW), box.viewW - MARGIN * 2);
    const rawLeft = align === 'end' ? box.right - width : box.left;
    const left = Math.min(Math.max(MARGIN, rawLeft), Math.max(MARGIN, box.viewW - width - MARGIN));
    const est = Math.min(PANEL_MAX_H, options.length * (ROW_H + 2) + 12 + (searchable ? 46 : 0));
    const below = box.viewH - box.bottom - GAP - MARGIN;
    const above = box.top - GAP - MARGIN;
    const goUp = below < est && above > below;
    const maxHeight = Math.max(120, Math.min(PANEL_MAX_H, goUp ? above : below));
    const next: Placement = goUp
      ? { left, width, maxHeight, bottom: box.viewH - box.top + GAP }
      : { left, width, maxHeight, top: box.bottom + GAP };
    setPos(prev => (prev && prev.left === next.left && prev.width === next.width && prev.maxHeight === next.maxHeight
      && prev.top === next.top && prev.bottom === next.bottom) ? prev : next);
  }, [align, options.length, panelMinWidth, searchable]);

  const openPanel = useCallback((seed?: string) => {
    if (disabled) return;
    setQuery(searchable && seed ? seed : '');
    setActive(selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : firstEnabled(options.map((_, i) => i)));
    setPos(null);
    setOpen(true);
  }, [disabled, firstEnabled, options, searchable, selectedIndex]);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    setQuery('');
    if (refocus) btnRef.current?.focus({ preventScroll: true });
  }, []);

  const choose = useCallback((i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    close(true);
    if (o.value !== value) onChange(o.value);
  }, [close, onChange, options, value]);

  // Place on open, follow scroll and resize, close on an outside press.
  useLayoutEffect(() => {
    if (!open) return;
    place();
    let raf = 0;
    const onMove = (e: Event) => {
      // `resize` targets the window, which is not a Node.
      const t = e.target;
      if (t instanceof Node && panelRef.current?.contains(t)) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(place);
    };
    const onDown = (e: Event) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close(false);
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [open, place, close]);

  // A disabled control never stays open.
  useEffect(() => { if (disabled && open) close(false); }, [disabled, open, close]);

  // Focus the search box the moment it mounts (Portal mounts its children a
  // render after the panel opens, so an effect keyed on `open` would miss it).
  const searchMounted = useCallback((el: HTMLInputElement | null) => {
    searchRef.current = el;
    if (el) el.focus({ preventScroll: true });
  }, []);

  // Keep the active row in view (the list scrolls, never the page).
  useEffect(() => {
    if (!open || active < 0) return;
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!list || !el) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < list.scrollTop + 4) list.scrollTop = Math.max(0, top - 6);
    else if (bottom > list.scrollTop + list.clientHeight - 4) list.scrollTop = bottom - list.clientHeight + 6;
  }, [open, active, pos]);

  // When the search narrows the list, keep the active row on a listed option.
  const activeShown = shown.includes(active) ? active : firstEnabled(shown);

  const move = (delta: number | 'home' | 'end') => {
    const enabled = shown.filter(i => !options[i].disabled);
    if (enabled.length === 0) return;
    if (delta === 'home') { setActive(enabled[0]); return; }
    if (delta === 'end') { setActive(enabled[enabled.length - 1]); return; }
    const at = enabled.indexOf(activeShown);
    const next = at < 0 ? (delta > 0 ? 0 : enabled.length - 1) : Math.min(enabled.length - 1, Math.max(0, at + delta));
    setActive(enabled[next]);
  };

  const typeAhead = (ch: string) => {
    const now = Date.now();
    const buf = now - typeBuf.current.at < 600 ? typeBuf.current.text + ch : ch;
    typeBuf.current = { text: buf, at: now };
    const q = norm(buf);
    const enabled = options.map((_, i) => i).filter(i => !options[i].disabled);
    const from = enabled.indexOf(activeShown);
    const ordered = buf.length === 1 && from >= 0 ? [...enabled.slice(from + 1), ...enabled.slice(0, from + 1)] : enabled;
    const hit = ordered.find(i => norm(options[i].label).startsWith(q));
    if (hit !== undefined) setActive(hit);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const k = e.key;
    if (!open) {
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ' || k === 'Home' || k === 'End') {
        e.preventDefault();
        e.stopPropagation();
        openPanel();
        return;
      }
      if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && k !== ' ') {
        e.preventDefault();
        openPanel(k);
        if (!searchable) typeAhead(k);
      }
      return;
    }
    const inSearch = e.target === searchRef.current;
    switch (k) {
      case 'ArrowDown': e.preventDefault(); move(1); break;
      case 'ArrowUp': e.preventDefault(); move(-1); break;
      case 'PageDown': e.preventDefault(); move(10); break;
      case 'PageUp': e.preventDefault(); move(-10); break;
      case 'Home': if (!inSearch) { e.preventDefault(); move('home'); } break;
      case 'End': if (!inSearch) { e.preventDefault(); move('end'); } break;
      case 'Enter':
        e.preventDefault();
        if (activeShown >= 0) choose(activeShown);
        break;
      case ' ':
        if (!inSearch) { e.preventDefault(); if (activeShown >= 0) choose(activeShown); }
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        close(true);
        break;
      case 'Tab':
        if (inSearch) { e.preventDefault(); close(true); } else close(false);
        break;
      default:
        if (!inSearch && k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          if (searchable) { setQuery(q => q + k); searchRef.current?.focus({ preventScroll: true }); }
          else typeAhead(k);
        }
    }
  };

  // React bubbles events through portals, and other popovers listen for
  // `mousedown` on document: nothing pressed in the panel reaches either.
  const swallow = (e: { stopPropagation: () => void; nativeEvent: Event }) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  const fieldLabel = selected?.label ?? placeholder ?? '';
  const showingPlaceholder = !selected;

  return (
    <>
      {/* React 19 hoists this into <head> once, however many dropdowns render. */}
      <style href="gv-gsel-css" precedence="medium">{CSS}</style>
      <button
        ref={btnRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && !searchable && activeShown >= 0 ? optId(activeShown) : undefined}
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
        aria-describedby={props['aria-describedby']}
        aria-invalid={invalid || undefined}
        title={title ?? (bare ? props['aria-label'] : undefined)}
        disabled={disabled}
        data-size={size}
        data-bare={bare ? '' : undefined}
        className={`gv-gsel${className ? ` ${className}` : ''}`}
        style={style}
        onClick={(e) => { e.stopPropagation(); if (open) close(false); else openPanel(); }}
        onKeyDown={onKeyDown}
      >
        {triggerContent ?? (
          <span className="gv-gsel-inner">
            {selected?.icon && <span className="gv-gsel-icon" aria-hidden>{selected.icon}</span>}
            <span className="gv-gsel-text" style={showingPlaceholder ? { color: INK_SOFT } : undefined}>{fieldLabel}</span>
            <ChevronDown className="gv-gsel-chev" size={size === 'sm' ? 13 : 16} strokeWidth={2.4} aria-hidden />
          </span>
        )}
      </button>
      {name !== undefined && <input type="hidden" name={name} value={value} />}

      {open && pos && (
        <Portal>
          <div
            ref={panelRef}
            data-gsel-popover=""
            className="gv-gsel-panel"
            style={{ left: pos.left, width: pos.width, maxHeight: pos.maxHeight, top: pos.top, bottom: pos.bottom, zIndex: Z }}
            onMouseDown={swallow}
            onPointerDown={swallow}
            onClick={swallow}
            onKeyDown={(e) => { e.stopPropagation(); onKeyDown(e); }}
          >
            {searchable && (
              <label className="gv-gsel-search">
                <Search size={15} strokeWidth={2.4} aria-hidden />
                <input
                  ref={searchMounted}
                  type="text"
                  role="combobox"
                  aria-expanded
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={activeShown >= 0 ? optId(activeShown) : undefined}
                  aria-label={searchPlaceholder ?? 'Search'}
                  placeholder={searchPlaceholder ?? 'Search'}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            )}
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={props['aria-label']}
              aria-labelledby={props['aria-label'] ? undefined : props['aria-labelledby']}
              className="gv-gsel-list"
            >
              {shown.length === 0 && <li className="gv-gsel-empty" role="presentation">No matches</li>}
              {shown.map((i) => {
                const o = options[i];
                const isSel = i === selectedIndex;
                return (
                  <li
                    key={`${o.value}-${i}`}
                    id={optId(i)}
                    data-index={i}
                    role="option"
                    aria-selected={isSel}
                    aria-disabled={o.disabled || undefined}
                    data-active={i === activeShown}
                    className="gv-gsel-opt"
                    onPointerDown={(e) => e.preventDefault()}
                    onMouseDown={(e) => e.preventDefault()}
                    onPointerMove={() => { if (!o.disabled && active !== i) setActive(i); }}
                    onClick={() => choose(i)}
                  >
                    {o.icon && <span className="gv-gsel-icon" aria-hidden>{o.icon}</span>}
                    <span className="gv-gsel-opt-text">
                      {o.label}
                      {o.hint && <span className="gv-gsel-hint">{o.hint}</span>}
                    </span>
                    {isSel && <Check className="gv-gsel-check" size={16} strokeWidth={2.6} aria-hidden />}
                  </li>
                );
              })}
            </ul>
          </div>
        </Portal>
      )}
    </>
  );
}
