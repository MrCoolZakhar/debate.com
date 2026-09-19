'use client';

/**
 * "Request a language": opened from every sessions language picker (the
 * top-of-page switchers on /create, /delegate, /join and /sessions, and
 * Settings → language). Language + email + a Rules of Procedure file, then a
 * thank-you state. Storage and the team email: src/lib/languageRequests.ts.
 *
 * Rendered through Portal at fixed coordinates, so it is never clipped. Keys
 * are handled in the CAPTURE phase and stopped there, so Escape closes only
 * this dialog and never the Settings GrowDialog underneath, and Tab stays in
 * here (a GrowDialog focus trap ignores a key whose default was prevented).
 */

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { CheckCircle2, FileText, Languages, Paperclip, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  LANGUAGE_REQUEST_ACCEPT,
  LANGUAGE_REQUEST_MAX_BYTES,
  isValidEmail,
  languageRequestFileType,
  submitLanguageRequest,
} from '@/lib/languageRequests';

const OUTFIT = "'Outfit', sans-serif";
const C = {
  page: '#EDE7D8',
  surface: '#F7F3E8',
  forest: '#1B3828',
  gold: '#EED98A',
  goldDeep: '#B6871F',
  ink: '#1C1410',
  inkSoft: '#5B4E40',
  line: 'rgba(27,56,40,0.16)',
  danger: '#8B2020',
};

type ErrKey =
  | 'lang_request_err_language'
  | 'lang_request_err_email'
  | 'lang_request_err_file'
  | 'lang_request_err_file_type'
  | 'lang_request_err_file_size'
  | 'lang_request_err_rate'
  | 'lang_request_err_generic';

export default function LanguageRequestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <LanguageRequestPanel onClose={onClose} />;
}

function LanguageRequestPanel({ onClose }: { onClose: () => void }) {
  const { t, language } = useLanguage();
  const pathname = usePathname();
  const titleId = useId();
  const introId = useId();
  const [lang, setLang] = useState('');
  const [email, setEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<ErrKey | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ language: string; email: string } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Focus in on open, back to the opener on close.
  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    const id = requestAnimationFrame(() => firstRef.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(id);
      const opener = openerRef.current;
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  // Escape and Tab, captured so nothing underneath sees them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([type="hidden"]), a[href]'))
        .filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      e.stopPropagation();
      if (!active || !panel.contains(active)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const pickFile = (f: File | null) => {
    setError(null);
    if (!f) { setFile(null); return; }
    if (!languageRequestFileType(f)) { setFile(null); setError('lang_request_err_file_type'); return; }
    if (f.size > LANGUAGE_REQUEST_MAX_BYTES) { setFile(null); setError('lang_request_err_file_size'); return; }
    setFile(f);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (!lang.trim()) { setError('lang_request_err_language'); return; }
    if (!isValidEmail(email)) { setError('lang_request_err_email'); return; }
    if (!file) { setError('lang_request_err_file'); return; }
    setError(null);
    setSending(true);
    const res = await submitLanguageRequest({ language: lang, email, file, locale: language, page: pathname ?? '' });
    setSending(false);
    if (res === 'ok') setDone({ language: lang.trim(), email: email.trim() });
    else setError(res === 'rate_limited' ? 'lang_request_err_rate' : 'lang_request_err_generic');
  };

  const field: React.CSSProperties = {
    width: '100%', height: 44, borderRadius: 12, padding: '0 14px', fontFamily: OUTFIT, fontSize: 16,
    color: C.ink, backgroundColor: '#FFFDF8', border: `1px solid ${C.line}`, outline: 'none',
  };
  const label: React.CSSProperties = { fontFamily: OUTFIT, fontSize: 13, fontWeight: 600, color: C.forest, display: 'block', marginBottom: 6 };

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: 2100, backgroundColor: 'rgba(16,28,20,0.46)' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={done ? undefined : introId}
          className="relative w-full max-w-[440px] max-h-full overflow-y-auto rounded-[22px]"
          style={{ backgroundColor: C.surface, boxShadow: '0 24px 60px rgba(27,56,40,0.28), 0 2px 6px rgba(27,56,40,0.12)', fontFamily: OUTFIT }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={t('lang_request_close')}
            title={t('lang_request_close')}
            className="absolute top-3 end-3 flex h-9 w-9 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2"
            style={{ color: C.inkSoft, backgroundColor: 'rgba(27,56,40,0.06)' }}
          >
            <X size={18} strokeWidth={2.2} />
          </button>

          {done ? (
            <div className="px-6 pb-6 pt-8 text-center" role="status">
              <CheckCircle2 size={44} strokeWidth={1.8} className="mx-auto" style={{ color: C.forest }} aria-hidden />
              <h2 id={titleId} className="mt-3" style={{ fontSize: 22, fontWeight: 700, color: C.ink }}>{t('lang_request_thanks_title')}</h2>
              <p className="mt-2" style={{ fontSize: 14.5, lineHeight: 1.5, color: C.inkSoft, textWrap: 'pretty' }}>
                {t('lang_request_thanks_body', { language: done.language, email: done.email })}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 h-11 w-full rounded-xl focus:outline-none focus-visible:ring-2"
                style={{ backgroundColor: C.forest, color: C.gold, fontWeight: 700, fontSize: 15 }}
              >
                {t('lang_request_done')}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="px-6 pb-6 pt-6">
              <div className="flex items-center gap-2.5 pe-10">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: C.forest, color: C.gold }} aria-hidden>
                  <Languages size={18} strokeWidth={2.2} />
                </span>
                <h2 id={titleId} style={{ fontSize: 21, fontWeight: 700, color: C.ink }}>{t('lang_request_title')}</h2>
              </div>
              <p id={introId} className="mt-3" style={{ fontSize: 14, lineHeight: 1.55, color: C.inkSoft, textWrap: 'pretty' }}>
                {t('lang_request_intro')}
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor={`${titleId}-lang`} style={label}>{t('lang_request_language')}</label>
                  <input
                    ref={firstRef}
                    id={`${titleId}-lang`}
                    type="text"
                    value={lang}
                    maxLength={80}
                    autoComplete="off"
                    placeholder={t('lang_request_language_ph')}
                    onChange={(e) => { setLang(e.target.value); if (error === 'lang_request_err_language') setError(null); }}
                    style={field}
                  />
                </div>
                <div>
                  <label htmlFor={`${titleId}-email`} style={label}>{t('lang_request_email')}</label>
                  <input
                    id={`${titleId}-email`}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    dir="ltr"
                    value={email}
                    maxLength={254}
                    placeholder={t('lang_request_email_ph')}
                    onChange={(e) => { setEmail(e.target.value); if (error === 'lang_request_err_email') setError(null); }}
                    style={field}
                  />
                </div>
                <div>
                  <span style={label} id={`${titleId}-file-label`}>{t('lang_request_file')}</span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={LANGUAGE_REQUEST_ACCEPT}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    onChange={(e) => { pickFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
                  />
                  {file ? (
                    <div className="flex items-center gap-2.5 rounded-xl px-3" style={{ height: 48, backgroundColor: '#FFFDF8', border: `1px solid ${C.line}` }}>
                      <FileText size={18} strokeWidth={2} style={{ color: C.forest }} aria-hidden />
                      <span className="flex-1 truncate" style={{ fontSize: 14, color: C.ink }} title={file.name}>{file.name}</span>
                      <button
                        type="button"
                        onClick={() => pickFile(null)}
                        aria-label={t('lang_request_file_remove')}
                        title={t('lang_request_file_remove')}
                        className="flex h-8 w-8 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2"
                        style={{ color: C.inkSoft }}
                      >
                        <X size={16} strokeWidth={2.2} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      aria-describedby={`${titleId}-file-hint`}
                      aria-labelledby={`${titleId}-file-label ${titleId}-file-choose`}
                      className="flex w-full items-center justify-center gap-2 rounded-xl focus:outline-none focus-visible:ring-2"
                      style={{ height: 48, border: `1.5px dashed ${C.line}`, color: C.forest, backgroundColor: 'rgba(27,56,40,0.03)', fontSize: 14, fontWeight: 600 }}
                    >
                      <Paperclip size={16} strokeWidth={2.2} aria-hidden />
                      <span id={`${titleId}-file-choose`}>{t('lang_request_file_choose')}</span>
                    </button>
                  )}
                  <p id={`${titleId}-file-hint`} className="mt-1.5" style={{ fontSize: 12, color: C.inkSoft }}>{t('lang_request_file_hint')}</p>
                </div>
              </div>

              <p role="alert" className="mt-3" style={{ minHeight: 20, fontSize: 13, fontWeight: 600, color: C.danger }}>
                {error ? t(error) : ''}
              </p>

              <div className="mt-2 flex gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-11 flex-1 rounded-xl focus:outline-none focus-visible:ring-2"
                  style={{ backgroundColor: 'rgba(27,56,40,0.07)', color: C.forest, fontWeight: 600, fontSize: 15 }}
                >
                  {t('lang_request_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="h-11 flex-[1.4] rounded-xl focus:outline-none focus-visible:ring-2 disabled:opacity-70"
                  style={{ backgroundColor: C.forest, color: C.gold, fontWeight: 700, fontSize: 15 }}
                >
                  {sending ? t('lang_request_sending') : t('lang_request_submit')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Portal>
  );
}
