'use client';

/**
 * Nationality / country typeahead, extracted from the account profile page so
 * sign-up (and anything else that needs a country) uses the exact same control.
 *
 * The menu is rendered through a Portal at fixed viewport coordinates and flips
 * upward near the bottom edge — the app-wide rule that no floating layer may be
 * clipped by an ancestor's overflow (see AGENTS.md → UI RULES).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Globe2 } from 'lucide-react';
import Portal from '@/components/Portal';
import { UN_COUNTRIES, getCountryByName, getFlagUrl } from '@/lib/countries';

const OUTFIT = "'Outfit', sans-serif";

const MENU_MAX_H = 224;

export interface CountryFieldProps {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  /** Applied to the <input>. Callers pass their own surface's input skin. */
  inputStyle?: React.CSSProperties;
  ariaLabel?: string;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
}

export function CountryField({
  value,
  onChange,
  placeholder = 'Start typing a country…',
  inputStyle,
  ariaLabel,
  id,
  invalid,
  describedBy,
}: CountryFieldProps) {
  const listId = `${id ?? 'country'}-listbox`;
  const [open, setOpen] = useState(false);
  // Which row the keyboard is on. -1 = none highlighted yet.
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);

  const place = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    // Flip up only when it is tight below AND roomier above.
    const up = below < MENU_MAX_H + 12 && r.top > below;
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: r.left, width: r.width, up });
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onReflow = () => place();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, place]);

  const shown = useMemo(() => {
    const q = value.trim().toLowerCase();
    return (q ? UN_COUNTRIES.filter(c => c.name.toLowerCase().includes(q)) : UN_COUNTRIES).slice(0, 40);
  }, [value]);

  function choose(name: string) {
    onChange(name);
    setOpen(false);
    setActive(-1);
  }

  const country = getCountryByName(value);
  const flag = country ? getFlagUrl(country.code) : null;

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        {flag ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={flag}
            alt=""
            className="absolute pointer-events-none"
            style={{
              left: '14px', top: '50%', transform: 'translateY(-50%)',
              width: '22px', height: '15px', objectFit: 'cover', borderRadius: '2.5px',
              boxShadow: '0 1px 3px rgba(27,56,40,0.25)',
            }}
          />
        ) : (
          <Globe2
            size={17}
            strokeWidth={2}
            className="absolute pointer-events-none"
            style={{ left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#9A8A78' }}
          />
        )}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoComplete="country-name"
          placeholder={placeholder}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; setOpen(true); }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = invalid ? '#8B2020' : '#DDD4C0';
            // Safe to close here: the rows preventDefault on mousedown, so
            // picking one never blurs the input first. Without this, the open
            // list stayed over whatever field came next and swallowed the
            // first click meant for it.
            setOpen(false);
            setActive(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setOpen(false); setActive(-1); return; }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              if (!open) { setOpen(true); return; }
              const step = e.key === 'ArrowDown' ? 1 : -1;
              setActive(prev => {
                const next = prev + step;
                if (next < 0) return shown.length - 1;
                if (next >= shown.length) return 0;
                return next;
              });
              return;
            }
            if (e.key === 'Enter' && open) {
              // Only intercept Enter when a row is actually highlighted, so it
              // still submits the form otherwise.
              const pick = shown[active] ?? (shown.length === 1 ? shown[0] : null);
              if (pick) { e.preventDefault(); choose(pick.name); }
            }
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="w-full focus:outline-none"
          style={{ ...inputStyle, paddingLeft: '44px', paddingRight: '16px' }}
        />
      </div>

      {open && shown.length > 0 && pos && (
        <Portal>
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            className="rounded-xl overflow-y-auto"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              transform: pos.up ? 'translateY(-100%)' : 'none',
              zIndex: 9999,
              maxHeight: `${MENU_MAX_H}px`,
              backgroundColor: 'rgba(250,248,243,0.98)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid #DDD4C0',
              boxShadow: '0 16px 40px rgba(27,56,40,0.16)',
            }}
          >
            {shown.map((c, i) => (
              <button
                key={c.code}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(c.name)}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm focus:outline-none"
                style={{
                  background: i === active ? 'rgba(27,56,40,0.09)' : 'none',
                  border: 'none', color: '#1C1410', fontFamily: OUTFIT, cursor: 'pointer',
                }}
                onMouseEnter={(e) => { setActive(i); (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = i === active ? 'rgba(27,56,40,0.09)' : 'transparent'; }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getFlagUrl(c.code)}
                  alt=""
                  style={{ width: '20px', height: '14px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }}
                />
                {c.name}
              </button>
            ))}
          </div>
        </Portal>
      )}
    </div>
  );
}

export default CountryField;
