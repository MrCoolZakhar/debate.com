'use client';
// Gavelling Crisis: a multi-select dropdown. The trigger shows the chosen items (icon and word);
// the list is a Portal popover at fixed coordinates, flipped upward near the bottom, never clipped.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import Portal from '@/components/Portal';
import { Avatar, CK, fieldStyle } from '../../crisisKit';

export interface MultiOption {
  value: string; label: string; icon?: ReactNode; group?: string;
  /** A person: shown as a round picture (or initials) beside the name. `name` is the short name, `label` the full line. */
  person?: { name: string; title?: string | null; picture_url?: string | null };
}

interface Pos { left: number; width: number; top?: number; bottom?: number; maxHeight: number }

export default function MultiSelect({ id, ariaLabel, options, value, onChange, placeholder, searchable, emptyText }: {
  id?: string;
  ariaLabel: string;
  options: MultiOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  searchable?: boolean;
  emptyText?: string;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [q, setQ] = useState('');

  const place = useCallback(() => {
    const el = trigger.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 240 && above > below;
    const width = Math.min(Math.max(r.width, 260), window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setPos(up
      ? { left, width, bottom: window.innerHeight - r.top + 6, maxHeight: Math.min(360, above - 6) }
      : { left, width, top: r.bottom + 6, maxHeight: Math.min(360, below - 6) });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (trigger.current?.contains(t) || pop.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); trigger.current?.focus(); }
    };
    const ro = typeof ResizeObserver !== 'undefined' && trigger.current ? new ResizeObserver(onScroll) : null;
    if (ro && trigger.current) ro.observe(trigger.current);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      ro?.disconnect();
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, place]);

  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const chosen = value.map((v) => byValue.get(v)).filter((o): o is MultiOption => !!o);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  }, [options, q]);
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => { setQ(''); if (!open) place(); setOpen((o) => !o); }}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828] flex items-center justify-between gap-2"
        style={{ ...fieldStyle, cursor: 'pointer', textAlign: 'left', minHeight: 44 }}
      >
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
          {chosen.length === 0 ? (
            <span style={{ color: CK.muted }}>{placeholder}</span>
          ) : chosen.some((o) => o.person) ? (
            <>
              <span className="inline-flex items-center flex-shrink-0" aria-hidden>
                {chosen.map((o, i) => (
                  <Avatar key={o.value} name={o.person?.name ?? o.label} src={o.person?.picture_url} size={28} style={{ marginLeft: i === 0 ? 0 : -9, boxShadow: '0 0 0 2px #fff' }} />
                ))}
              </span>
              <span style={{ fontWeight: 700, color: CK.forest, overflowWrap: 'anywhere', fontSize: 13.5 }}>
                {chosen.map((o) => o.person?.name ?? o.label).join(', ')}
              </span>
            </>
          ) : chosen.map((o) => (
            <span key={o.value} className="inline-flex items-center gap-1.5" style={{ fontWeight: 700, color: CK.forest, overflowWrap: 'anywhere' }}>
              {o.icon}{o.label}
            </span>
          ))}
        </span>
        <ChevronDown size={17} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0, color: CK.muted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease' }} />
      </button>
      {open && pos && (
        <Portal>
          <div
            ref={pop}
            data-crisis-popover
            role="group"
            aria-label={ariaLabel}
            style={{
              position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight, zIndex: 10050,
              background: CK.card, borderRadius: 16, boxShadow: '0 16px 40px rgba(58,14,15,0.28), 0 0 0 1px rgba(110,30,30,0.1)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: CK.font,
            }}
          >
            {searchable && (
              <div className="flex items-center gap-2" style={{ padding: '8px 10px', borderBottom: `1px solid ${CK.hair}` }}>
                <Search size={15} strokeWidth={1.5} aria-hidden style={{ color: CK.muted, flexShrink: 0 }} />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search"
                  placeholder="Search"
                  className="focus:outline-none"
                  style={{ border: 0, background: 'transparent', width: '100%', fontSize: 14, fontFamily: CK.font, color: CK.ink }}
                />
              </div>
            )}
            <div style={{ overflowY: 'auto', padding: 6 }}>
              {shown.length === 0 && <p style={{ margin: 0, padding: '10px 10px', fontSize: 13.5, color: CK.muted }}>{emptyText ?? 'Nothing to pick.'}</p>}
              {shown.map((o, i) => {
                const on = value.includes(o.value);
                const header = o.group && o.group !== shown[i - 1]?.group ? o.group : null;
                return (
                  <div key={o.value}>
                    {header && <p style={{ margin: '6px 8px 2px', fontSize: 12, fontWeight: 700, color: CK.muted, overflowWrap: 'anywhere' }}>{header}</p>}
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(o.value)}
                      className="flex items-center gap-2.5 w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                      style={{ border: 0, borderRadius: 10, padding: '8px 10px', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 600, fontFamily: CK.font, background: on ? CK.well : 'transparent', color: CK.ink }}
                    >
                      <span aria-hidden className="grid place-items-center flex-shrink-0" style={{ width: 20, height: 20, borderRadius: 6, background: on ? CK.greenBtn : CK.card, boxShadow: on ? CK.shadowSm : `inset 0 0 0 1px ${CK.hair}`, color: '#fff' }}>
                        {on && <Check size={13} strokeWidth={2.2} />}
                      </span>
                      {o.icon && <span style={{ color: CK.red, lineHeight: 0 }}>{o.icon}</span>}
                      {o.person ? (
                        <>
                          <Avatar name={o.person.name} src={o.person.picture_url} size={34} />
                          <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>
                            <span style={{ display: 'block', fontWeight: 700, lineHeight: 1.2 }}>{o.person.name}</span>
                            {o.person.title && <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: CK.inkSoft, lineHeight: 1.25 }}>{o.person.title}</span>}
                          </span>
                        </>
                      ) : (
                        <span style={{ overflowWrap: 'anywhere' }}>{o.label}</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
