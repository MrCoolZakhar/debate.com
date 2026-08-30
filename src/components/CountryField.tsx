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
  const [open, setOpen] = useState(false);
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

  const country = getCountryByName(value);
  const flag = country ? getFlagUrl(country.code) : null;

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return UN_COUNTRIES;
    return UN_COUNTRIES.filter(c => c.name.toLowerCase().includes(q));
  }, [value]);

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
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#1B3828'; setOpen(true); }}
          onBlur={(e) => { e.currentTarget.style.borderColor = invalid ? '#8B2020' : '#DDD4C0'; }}
          className="w-full focus:outline-none"
          style={{ ...inputStyle, paddingLeft: '44px', paddingRight: '16px' }}
        />
      </div>

      {open && matches.length > 0 && pos && (
        <Portal>
          <div
            ref={menuRef}
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
            {matches.slice(0, 40).map(c => (
              <button
                key={c.code}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(c.name); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm focus:outline-none"
                style={{ background: 'none', border: 'none', color: '#1C1410', fontFamily: OUTFIT, cursor: 'pointer' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.06)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
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
