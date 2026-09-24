'use client';

/**
 * Compact globe language menu for sessions pages that have no picker of their
 * own (the join page). Same shape as the /create menu, plus "Request a
 * language" (LanguageRequestDialog).
 */

import { useEffect, useRef, useState } from 'react';
import { Check, Globe, Languages } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Language } from '@/lib/translations';
import LanguageRequestDialog from '@/components/LanguageRequestDialog';

const OUTFIT = "var(--font-brand), sans-serif";

export default function SessionLanguageMenu() {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const langs: [Language, string][] = [['en', t('settings_english')], ['es', t('settings_spanish')], ['fr', t('settings_french')], ['ar', 'العربية']];

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('settings_language')}
        className="flex h-10 items-center gap-1.5 rounded-xl px-3 transition-[background-color,transform] duration-150 hover:bg-[#1B3828]/[0.08] active:scale-[0.96] focus:outline-none"
        style={{ backgroundColor: open ? 'rgba(27,56,40,0.08)' : undefined, color: '#1B3828' }}
      >
        <Globe size={15} strokeWidth={2} />
        <span style={{ fontFamily: OUTFIT, fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: '#5B4E40' }}>{language.toUpperCase()}</span>
      </button>
      {open && (
        <div role="menu" className="absolute end-0 top-full z-50 mt-2 overflow-hidden rounded-2xl p-1" style={{ backgroundColor: '#F7F3E8', boxShadow: '0 12px 32px rgba(27,56,40,0.16), inset 0 0 0 1px rgba(27,56,40,0.08)', minWidth: 180 }}>
          {langs.map(([code, label]) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={language === code}
              onClick={() => { setLanguage(code); setOpen(false); }}
              className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-start transition-colors hover:bg-[#1B3828]/[0.05] focus:outline-none"
              style={{ fontFamily: OUTFIT, color: language === code ? '#1B3828' : '#5B4E40', fontWeight: language === code ? 800 : 600, fontSize: 13, backgroundColor: language === code ? 'rgba(27,56,40,0.07)' : undefined }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: '#8A7B68', width: 20 }}>{code.toUpperCase()}</span>
              <span>{label}</span>
              {language === code && <Check size={14} strokeWidth={2.6} className="ms-auto" style={{ color: '#B6871F' }} />}
            </button>
          ))}
          <div className="my-1 h-px" style={{ backgroundColor: 'rgba(27,56,40,0.1)' }} />
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); setRequestOpen(true); }}
            className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-start transition-colors hover:bg-[#1B3828]/[0.05] focus:outline-none"
            style={{ fontFamily: OUTFIT, color: '#1B3828', fontWeight: 700, fontSize: 13 }}
          >
            <Languages size={14} strokeWidth={2.2} style={{ width: 20 }} aria-hidden />
            <span>{t('lang_request_open')}</span>
          </button>
        </div>
      )}
      <LanguageRequestDialog open={requestOpen} onClose={() => setRequestOpen(false)} />
    </div>
  );
}
