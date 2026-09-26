'use client';

// Who can read your MUN CV (24 Sep 2026), as ONE small control at the top of
// the CV page (26 Sep 2026, owner: "the who can see your CV setting is just too
// large, just add it as a small smart toggle at the top").
//
//   Public | Private      profiles.cv_private: the whole public page (/cv/[id])
//                         is gone when Private
//   the gear disc         a small popover holding "Show my nationality"
//                         (profiles.cv_hide_nationality) and the link to what
//                         visitors see
//   the eye on each card  mun_cv_entries.is_private, unchanged (CVTimeline.tsx)
//
// All three are enforced in the DATABASE, not here: get_public_cv() honours
// them, and the table's SELECT policy (cv_entry_visible) stops a private entry
// being read straight from the API. The owner, platform admins and the
// organisers of a conference the owner applied to still see everything. The
// page (cv/page.tsx) writes optimistically, counts the rows that landed and
// rolls back on a refusal; this control only shows the state and calls it.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Globe2, Lock, Flag, ExternalLink, Settings2 } from 'lucide-react';
import Portal from '@/components/Portal';
import { OUTFIT, T } from '../accountUi';

export interface CvPrivacy {
  cvPrivate: boolean;
  hideNationality: boolean;
}

const POP_W = 280;
const POP_H = 170;

export default function CVPrivacyPanel({
  value,
  onChange,
  saving,
  error,
  publicHref,
  hiddenCount,
}: {
  value: CvPrivacy;
  onChange: (next: Partial<CvPrivacy>) => void;
  saving: boolean;
  error: string | null;
  publicHref: string | null;
  hiddenCount: number;
}) {
  const { cvPrivate, hideNationality } = value;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = r.left;
    if (left + POP_W > vw - 10) left = vw - 10 - POP_W;
    if (left < 10) left = 10;
    const below = r.bottom + 8;
    const up = below + POP_H > vh - 10 && r.top - POP_H - 8 > 10;
    setPos({ top: up ? r.top - POP_H - 8 : below, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onReflow = () => place();
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, place]);

  const segment = (isPrivate: boolean) => {
    const on = cvPrivate === isPrivate;
    const Icon = isPrivate ? Lock : Globe2;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        disabled={saving}
        onClick={() => { if (!on) onChange({ cvPrivate: isPrivate }); }}
        title={isPrivate ? 'Only you, and organisers you apply to' : 'Anyone with the link'}
        className="relative z-[1] inline-flex items-center justify-center gap-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
        style={{
          padding: '0 14px', minHeight: 36, border: 'none', background: 'transparent',
          fontFamily: OUTFIT, fontSize: T.body, fontWeight: on ? 800 : 600,
          color: on ? '#1B3828' : '#5A5046', cursor: saving ? 'default' : 'pointer',
          transition: 'color 180ms ease',
        }}
      >
        <Icon size={15} strokeWidth={2.2} fill={on ? 'rgba(238,217,138,0.7)' : 'none'} aria-hidden />
        {isPrivate ? 'Private' : 'Public'}
      </button>
    );
  };

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span style={{ fontFamily: OUTFIT, fontSize: T.body, fontWeight: 600, color: '#5A5046' }}>Your CV is</span>
        <div
          role="radiogroup"
          aria-label="Who can see your CV"
          className="relative inline-flex items-center rounded-full p-1"
          style={{ backgroundColor: 'rgba(27,56,40,0.05)', boxShadow: 'inset 2px 2px 5px rgba(27,56,40,0.10), inset -2px -2px 5px rgba(255,255,255,0.8)' }}
        >
          {/* the raised white thumb slides under the chosen side */}
          <span
            aria-hidden
            className="absolute rounded-full"
            style={{
              top: 4, bottom: 4, left: 4, width: 'calc(50% - 4px)',
              transform: cvPrivate ? 'translateX(100%)' : 'translateX(0)',
              background: 'linear-gradient(180deg, #FFFFFF, #F8F4EB)',
              boxShadow: 'inset 0 1px 0 #FFFFFF, 0 0 0 1px rgba(27,56,40,0.10), 0 4px 10px -4px rgba(27,56,40,0.35)',
              transition: 'transform 220ms cubic-bezier(0.22,1,0.36,1)',
            }}
          />
          <span className="relative grid grid-cols-2">
            {segment(false)}
            {segment(true)}
          </span>
        </div>

        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="More privacy settings"
          title="More privacy settings"
          className="gv-acct-rim"
          style={{ width: 36, height: 36 }}
        >
          <Settings2 size={16} strokeWidth={2.2} aria-hidden />
        </button>

        {hiddenCount > 0 && !cvPrivate && (
          <span style={{ fontFamily: OUTFIT, fontSize: T.caption + 1, color: '#5A5046' }}>
            <strong style={{ color: '#1C1410', fontVariantNumeric: 'tabular-nums' }}>{hiddenCount}</strong> hidden
          </span>
        )}
      </div>

      {error && (
        <p role="alert" style={{ fontFamily: OUTFIT, fontSize: T.caption + 1, fontWeight: 700, color: '#8B2020', margin: '8px 0 0' }}>
          {error}
        </p>
      )}

      {open && pos && (
        <Portal>
          <div
            ref={popRef}
            role="dialog"
            aria-label="Privacy settings"
            className="rounded-[18px] p-3"
            style={{
              position: 'fixed', top: pos.top, left: pos.left, width: POP_W, zIndex: 9999,
              backgroundColor: 'rgba(255,255,255,0.97)',
              backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
              boxShadow: '0 0 0 1px rgba(27,56,40,0.08), 0 18px 40px -10px rgba(27,56,40,0.30)',
            }}
          >
            <label
              className="flex items-center justify-between gap-3 rounded-[12px]"
              style={{ padding: 10, cursor: saving || cvPrivate ? 'default' : 'pointer', opacity: cvPrivate ? 0.5 : 1 }}
              title={cvPrivate ? 'Your CV is private, so nothing shows to visitors' : undefined}
            >
              <span className="inline-flex items-center gap-2.5" style={{ fontFamily: OUTFIT, fontSize: T.body, fontWeight: 600, color: '#1C1410' }}>
                <Flag size={16} strokeWidth={2.2} style={{ color: '#5C5140' }} aria-hidden />
                Show my nationality
              </span>
              <input
                type="checkbox"
                role="switch"
                className="sr-only peer"
                checked={!hideNationality}
                disabled={saving || cvPrivate}
                onChange={(e) => onChange({ hideNationality: !e.target.checked })}
              />
              <span
                aria-hidden
                className="relative flex-shrink-0 rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-[#B6871F]"
                style={{ width: 40, height: 24, background: hideNationality ? 'rgba(154,138,120,0.45)' : '#1B3828', transition: 'background-color 180ms ease' }}
              >
                <span
                  className="absolute rounded-full"
                  style={{ top: 3, left: 3, width: 18, height: 18, background: '#FFFFFF', transform: hideNationality ? 'none' : 'translateX(16px)', transition: 'transform 180ms cubic-bezier(0.22,1,0.36,1)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
                />
              </span>
            </label>

            {!cvPrivate && publicHref && (
              <a
                href={publicHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                style={{ padding: 10, fontFamily: OUTFIT, fontSize: T.body, fontWeight: 700, color: '#1B3828', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                <ExternalLink size={15} strokeWidth={2.2} aria-hidden />
                See what visitors see
              </a>
            )}

            <p style={{ margin: '4px 10px 6px', fontFamily: OUTFIT, fontSize: T.caption, color: '#6E5F4E', lineHeight: 1.45 }}>
              Hide one conference with the eye on its card
            </p>
          </div>
        </Portal>
      )}
    </div>
  );
}
