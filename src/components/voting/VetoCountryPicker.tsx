'use client';

/**
 * VetoCountryPicker — the custom veto holders, as removable chips plus a "+" button.
 *
 * The "+" opens a searchable list of the committee's delegations through `Portal`
 * at fixed coordinates (never clipped, flipped near the edges, repositioned on
 * scroll and resize). Picking one calls `onChange` with the next list; the voting
 * page persists it as ONE key-level patch of `vetoCountries` (AGENTS.md rule 12).
 *
 * Entries are stored exactly as the roster spells them (`Delegate.country`), the
 * same thing SettingsPanel's checkbox list compares against. Matching for the vote
 * itself is by country identity (`vetoEntryMatches`), so an entry typed elsewhere
 * as "USA" is still recognised as the seat "United States" and never offered twice.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { SeatCircleFlag } from '@/components/CircleFlag';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { getCountryDisplayName, compareCountryNames, fold, matchesCountryQuery } from '@/lib/countries';
import { anchorBox, place } from '@/components/voting/anchorPosition';
import { vetoEntryMatches } from '@/lib/vetoMatch';
import type { Delegate } from '@/lib/types';

type Tone = 'light' | 'dark';

const PALETTE: Record<Tone, {
  chipBg: string; chipFg: string; chipRing: string; warnBg: string; warnFg: string;
  addBg: string; addFg: string; addRing: string; muted: string;
}> = {
  light: {
    chipBg: '#FAF8F3', chipFg: '#1C1410', chipRing: 'rgba(27,56,40,0.14)',
    warnBg: 'rgba(182,135,31,0.14)', warnFg: '#6A4A0A',
    addBg: '#1B3828', addFg: '#EED98A', addRing: 'rgba(27,56,40,0.2)', muted: '#6A5A4A',
  },
  dark: {
    chipBg: 'rgba(255,255,255,0.10)', chipFg: '#FFFFFF', chipRing: 'rgba(255,255,255,0.14)',
    warnBg: 'rgba(182,135,31,0.22)', warnFg: '#EED98A',
    addBg: '#EDE7D8', addFg: '#1B3828', addRing: 'rgba(0,0,0,0.2)', muted: 'rgba(255,255,255,0.55)',
  },
};

export interface VetoCountryPickerProps {
  /** The veto list in force, as stored. */
  selected: string[];
  /** Delegations that can hold a veto (non-observers on the roster). */
  roster: Delegate[];
  onChange: (next: string[]) => void;
  /** No "+" and no remove buttons: the list is shown, not edited (P5, a Commenter). */
  readOnly?: boolean;
  tone?: Tone;
  /** Chip and text size. `lg` is the projector-sized pre-vote screen. */
  size?: 'md' | 'lg';
  /** `list`: one large row per veto holder, stacked vertically, with a full-width add row
   *  (the roll call's Veto drawer, owner 17 Sep 2026: "vertical and bigger, more important").
   *  `chips` (default): the compact wrap of chips. */
  layout?: 'chips' | 'list';
}

export function VetoCountryPicker({
  selected, roster, onChange, readOnly = false, tone = 'light', size = 'md', layout = 'chips',
}: VetoCountryPickerProps) {
  const t = useT();
  const { language } = useLanguage();
  const c = PALETTE[tone];
  const lg = size === 'lg';
  const rtl = language === 'ar';

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();
  const W = 300;
  const H = 340;

  const seatFor = (entry: string) => roster.find((d) => vetoEntryMatches(entry, d.country)) ?? null;

  const available = roster
    .filter((d) => !selected.some((entry) => vetoEntryMatches(entry, d.country)))
    .sort((a, b) => compareCountryNames(a.country, b.country, language));
  const q = fold(query);
  // Alias-aware for countries ("uk", "drc"), plain folded substring for anything else
  // on the roster (a crisis cabinet post, a corporation).
  const matches = q
    ? available.filter((d) => matchesCountryQuery(d.country, query, language) || fold(d.country).includes(q))
    : available;

  const reposition = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    setPos(place(anchorBox(el), W, H, rtl ? 'end' : 'start'));
  }, [rtl]);

  useEffect(() => {
    if (!open) return;
    reposition();
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, reposition]);

  const close = () => { setOpen(false); setQuery(''); setActive(0); btnRef.current?.focus(); };
  const add = (d: Delegate) => {
    onChange([...selected, d.country]);
    requestAnimationFrame(reposition);   // the "+" moves as chips are added
    setQuery('');
    setActive(0);
    inputRef.current?.focus();
  };
  const remove = (entry: string) => onChange(selected.filter((e) => e !== entry));

  const popover = open && pos && (
        <Portal>
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t('voting_veto_add')}
            dir={rtl ? 'rtl' : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.stopPropagation(); close(); }
            }}
            className="gv-veto-pop rounded-2xl overflow-hidden flex flex-col"
            style={{
              position: 'fixed', top: pos.top, left: pos.left, width: W, maxHeight: H, zIndex: 10000,
              backgroundColor: '#FAF8F3',
              boxShadow: '0 0 0 1px rgba(27,56,40,0.12), 0 8px 24px rgba(27,56,40,0.18), 0 24px 56px rgba(27,56,40,0.16)',
            }}
          >
            <style>{`@keyframes gvVetoPop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}.gv-veto-pop{animation:gvVetoPop 160ms cubic-bezier(0.2,0,0,1)}@media (prefers-reduced-motion: reduce){.gv-veto-pop{animation:none}}`}</style>
            <div className="p-2 shrink-0">
              <label className="flex items-center gap-2 rounded-xl px-3 h-10" style={{ backgroundColor: '#EDE7D8' }}>
                <Search size={16} className="shrink-0" style={{ color: '#6A5A4A' }} aria-hidden />
                <input
                  ref={inputRef}
                  // Mounted only once the portal target and position exist, so autoFocus is
                  // the moment the field is really there (an effect on `open` runs too early).
                  autoFocus
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, Math.max(0, matches.length - 1))); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
                    else if (e.key === 'Enter') { e.preventDefault(); const d = matches[active]; if (d) add(d); }
                  }}
                  placeholder={t('voting_veto_search')}
                  aria-label={t('voting_veto_search')}
                  aria-controls={listId}
                  aria-activedescendant={matches[active] ? `${listId}-${matches[active].id}` : undefined}
                  className="flex-1 min-w-0 bg-transparent text-[14px] font-medium focus:outline-none"
                  style={{ color: '#1C1410' }}
                />
              </label>
            </div>
            <ul id={listId} role="listbox" className="flex-1 overflow-y-auto px-1.5 pb-1.5">
              {matches.length === 0 ? (
                <li className="px-3 py-4 text-[13px] text-center" style={{ color: '#6A5A4A' }}>
                  {available.length === 0 ? t('voting_veto_all_added') : t('voting_veto_no_matches')}
                </li>
              ) : matches.map((d, i) => (
                <li
                  key={d.id}
                  id={`${listId}-${d.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => add(d)}
                  className="flex items-center gap-2.5 px-2.5 min-h-10 py-1.5 rounded-lg cursor-pointer text-[14px] font-semibold"
                  style={{ backgroundColor: i === active ? 'rgba(27,56,40,0.08)' : 'transparent', color: '#1C1410' }}
                >
                  <SeatCircleFlag seat={d} size={24} decorative />
                  <span className="flex-1 min-w-0 truncate">{getCountryDisplayName(d.country, language)}</span>
                  <Plus size={14} className="shrink-0 opacity-50" aria-hidden />
                </li>
              ))}
            </ul>
          </div>
        </Portal>
      );

  if (layout === 'list') {
    return (
      <div className="flex flex-col gap-2" role="list" aria-label={t('voting_rules_veto_info_title')}>
        {selected.map((entry) => {
          const seat = seatFor(entry);
          const name = getCountryDisplayName(seat?.country ?? entry, language);
          return (
            <div
              key={entry}
              role="listitem"
              className="flex items-center gap-3.5 rounded-2xl ps-2.5 pe-2 min-h-[68px] py-2"
              style={{
                backgroundColor: seat ? '#FCFAF5' : c.warnBg,
                boxShadow: seat ? '0 0 0 1px rgba(27,56,40,0.10), 0 1px 2px rgba(27,56,40,0.06), 0 6px 14px rgba(27,56,40,0.06)' : 'none',
              }}
            >
              <SeatCircleFlag
                seat={seat ?? { country: entry }}
                size={48}
                decorative
                style={{ boxShadow: '0 1px 2px rgba(27,56,40,0.22), 0 3px 8px rgba(27,56,40,0.16)' }}
              />
              <span className="flex-1 min-w-0">
                <span className="block truncate text-[18px] font-semibold leading-tight" style={{ color: seat ? '#1C1410' : c.warnFg }}>{name}</span>
                {!seat && <span className="block text-[12.5px] font-semibold mt-0.5" style={{ color: c.warnFg }}>{t('voting_veto_not_seated')}</span>}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => remove(entry)}
                  aria-label={t('voting_veto_remove', { name })}
                  title={t('voting_veto_remove', { name })}
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] hover:bg-[rgba(27,56,40,0.08)] transition-[background-color,transform] duration-150 active:scale-[0.96] motion-reduce:transition-none"
                  style={{ color: '#6A5A4A' }}
                >
                  <X size={18} strokeWidth={2.4} aria-hidden />
                </button>
              )}
            </div>
          );
        })}
        {selected.length === 0 && (
          <p className="text-[14px] leading-snug px-1 py-2" style={{ color: c.muted }}>
            {readOnly ? t('voting_veto_none_seated') : t('voting_veto_custom_empty')}
          </p>
        )}
        {!readOnly && (
          <button
            ref={btnRef}
            type="button"
            onClick={() => (open ? close() : setOpen(true))}
            aria-haspopup="listbox"
            aria-expanded={open}
            className="flex items-center gap-3 ps-2.5 pe-4 min-h-[60px] rounded-2xl text-[15px] font-semibold text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] hover:bg-[rgba(27,56,40,0.05)] transition-[background-color,transform] duration-150 active:scale-[0.98] motion-reduce:transition-none"
            style={{ color: '#1B3828', boxShadow: 'inset 0 0 0 1.5px rgba(27,56,40,0.22)' }}
          >
            <span className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: c.addBg, color: c.addFg }} aria-hidden>
              <Plus size={20} strokeWidth={2.75} />
            </span>
            {t('voting_veto_add')}
          </button>
        )}
        {popover}
      </div>
    );
  }

  const flagSize = lg ? 28 : 20;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {selected.map((entry) => {
        const seat = seatFor(entry);
        const name = getCountryDisplayName(seat?.country ?? entry, language);
        return (
          <span
            key={entry}
            className={`inline-flex items-center gap-2 rounded-full ${lg ? 'ps-1.5 pe-2 py-1.5 text-[15px]' : 'ps-1 pe-1.5 py-1 text-[12px]'} font-semibold max-w-full`}
            style={{
              backgroundColor: seat ? c.chipBg : c.warnBg,
              color: seat ? c.chipFg : c.warnFg,
              boxShadow: `0 0 0 1px ${c.chipRing}`,
            }}
            title={seat ? undefined : t('voting_veto_not_seated')}
          >
            <SeatCircleFlag seat={seat ?? { country: entry }} size={flagSize} decorative ring={tone === 'light'} />
            <span className="truncate">{name}</span>
            {!seat && <span className={`${lg ? 'text-[12px]' : 'text-[10px]'} font-bold opacity-80 whitespace-nowrap`}>{t('voting_veto_not_seated')}</span>}
            {!readOnly && (
              <button
                type="button"
                onClick={() => remove(entry)}
                aria-label={t('voting_veto_remove', { name })}
                className={`relative shrink-0 rounded-full flex items-center justify-center ${lg ? 'w-7 h-7' : 'w-5 h-5'} opacity-60 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-[opacity,transform] duration-150 active:scale-[0.96] motion-reduce:transition-none after:absolute after:-inset-2 after:content-['']`}
              >
                <X size={lg ? 16 : 12} strokeWidth={2.5} aria-hidden />
              </button>
            )}
          </span>
        );
      })}

      {selected.length === 0 && (
        <span className={`${lg ? 'text-[15px]' : 'text-[11px]'} leading-snug`} style={{ color: c.muted }}>
          {readOnly ? t('voting_veto_none_seated') : t('voting_veto_custom_empty')}
        </span>
      )}

      {!readOnly && (
        <button
          ref={btnRef}
          type="button"
          onClick={() => (open ? close() : setOpen(true))}
          aria-label={t('voting_veto_add')}
          title={t('voting_veto_add')}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`shrink-0 rounded-full flex items-center justify-center ${lg ? 'w-11 h-11' : 'w-8 h-8'} focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none`}
          style={{ backgroundColor: c.addBg, color: c.addFg, boxShadow: `0 1px 2px ${c.addRing}, 0 4px 12px ${c.addRing}` }}
        >
          <Plus size={lg ? 22 : 16} strokeWidth={2.75} aria-hidden />
        </button>
      )}

      {popover}
    </div>
  );
}
