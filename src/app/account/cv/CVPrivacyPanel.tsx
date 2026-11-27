'use client';

// Who can read your MUN CV (24 Sep 2026), behind ONE "Settings" button in the
// CV header's button row (prompt 77; the Public / Private switch is gone).
// Its popover holds three switches, each with one plain line:
//
//   Make my CV private    profiles.cv_private: the whole public page (/cv/[id])
//                         is gone when on
//   Hide my nationality   profiles.cv_hide_nationality
//   Open to team roles    talent_set_open (opt-in, off by default)
//
// plus the link to what visitors see. ?settings=open opens it on load (the
// links on My Applications) and the parameter is then removed in place; a
// TALENT_CHANGED_EVENT (TalentPrompt's Turn on) sets the third switch at once.
//   the eye on each card  mun_cv_entries.is_private, unchanged (CVTimeline.tsx)
//
// All three are enforced in the DATABASE, not here: get_public_cv() honours
// them, and the table's SELECT policy (cv_entry_visible) stops a private entry
// being read straight from the API. The owner, platform admins and the
// organisers of a conference the owner applied to still see everything. The
// page (cv/page.tsx) writes optimistically, counts the rows that landed and
// rolls back on a refusal; this control only shows the state and calls it.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, Flag, ExternalLink, Settings, Briefcase } from 'lucide-react';
import { replaceUrlInPlace } from '@/lib/replaceUrlInPlace';
import Portal from '@/components/Portal';
import { useAuth } from '@/components/AuthProvider';
import { fetchTalentSettings, setTalentOpen } from '@/lib/jobBoard';
import { TALENT_CHANGED_EVENT } from '@/components/TalentPrompt';
import { OUTFIT, T } from '../accountUi';

export interface CvPrivacy {
  cvPrivate: boolean;
  hideNationality: boolean;
}

const POP_W = 320;
const POP_H = 470;

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

  // "Open to team roles" (Job Board prompt 11): opt-in to being found by
  // conferences. Read once per signed-in user, written optimistically through
  // talent_set_open and rolled back with the server's sentence on a refusal.
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [talentOpen, setTalentOpenState] = useState<boolean | null>(null);
  const [talentBusy, setTalentBusy] = useState(false);
  const [talentError, setTalentError] = useState<string | null>(null);
  const talentBusyRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchTalentSettings().then((r) => {
      if (cancelled) return;
      if ('ok' in r) { setTalentError(r.message); return; }
      setTalentOpenState(r.open);
      setTalentError(null);
    });
    return () => { cancelled = true; };
  }, [userId]);

  const changeTalent = useCallback(async (next: boolean) => {
    if (talentBusyRef.current || talentOpen === null) return;
    talentBusyRef.current = true;
    const before = talentOpen;
    setTalentOpenState(next);
    setTalentBusy(true);
    setTalentError(null);
    const r = await setTalentOpen(next);
    talentBusyRef.current = false;
    setTalentBusy(false);
    if (!r.ok) {
      setTalentOpenState(before);
      setTalentError(r.message);
      return;
    }
    setTalentOpenState(r.open);
    try { window.dispatchEvent(new CustomEvent(TALENT_CHANGED_EVENT, { detail: { open: r.open } })); } catch { /* nothing listening */ }
  }, [talentOpen]);

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
    // Measured on the next frame, from a callback rather than the effect body.
    const raf = requestAnimationFrame(place);
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
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, place]);

  // ?settings=open (the links on My Applications): open the panel once, then drop the parameter.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('settings') !== 'open') return;
    url.searchParams.delete('settings');
    replaceUrlInPlace(url.pathname + url.search + url.hash);
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // TalentPrompt's Turn on (or another tab of this page) changed it: show it at once.
  useEffect(() => {
    const onChanged = (e: Event) => {
      const open = (e as CustomEvent<{ open?: unknown }>).detail?.open;
      if (typeof open === 'boolean') { setTalentOpenState(open); setTalentError(null); }
    };
    window.addEventListener(TALENT_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(TALENT_CHANGED_EVENT, onChanged);
  }, []);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="gv-acct-btn2"
      >
        <Settings size={17} strokeWidth={2.2} aria-hidden />
        Settings
      </button>

      {hiddenCount > 0 && !cvPrivate && (
        <span style={{ fontFamily: OUTFIT, fontSize: T.caption + 1, color: '#5A5046' }}>
          <strong style={{ color: '#1C1410', fontVariantNumeric: 'tabular-nums' }}>{hiddenCount}</strong> hidden
        </span>
      )}

      {error && (
        <p role="alert" className="basis-full" style={{ fontFamily: OUTFIT, fontSize: T.caption + 1, fontWeight: 700, color: '#8B2020', margin: 0 }}>
          {error}
        </p>
      )}

      {open && pos && (
        <Portal>
          <div
            ref={popRef}
            role="dialog"
            aria-label="CV settings"
            className="rounded-[18px] p-3"
            style={{
              position: 'fixed', top: pos.top, left: pos.left, width: POP_W, zIndex: 9999,
              backgroundColor: 'rgba(255,255,255,0.97)',
              backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
              boxShadow: '0 0 0 1px rgba(27,56,40,0.08), 0 18px 40px -10px rgba(27,56,40,0.30)',
            }}
          >
            <ToggleRow {...{
              icon: Lock,
              title: 'Make my CV private',
              line: 'Only you, and organisers you apply to, can see it',
              on: cvPrivate,
              disabled: saving,
              onToggle: (next) => onChange({ cvPrivate: next }),
            }} />

            <ToggleRow {...{
              icon: Flag,
              title: 'Hide my nationality',
              line: cvPrivate ? 'Your CV is private, so nothing shows to visitors' : 'Your flag and country stay off your public CV',
              on: hideNationality,
              disabled: saving || cvPrivate,
              dim: cvPrivate,
              onToggle: (next) => onChange({ hideNationality: next }),
            }} />

            <ToggleRow {...{
              icon: Briefcase,
              title: 'Open to team roles',
              line: cvPrivate
                ? 'Make your CV public to be found'
                : 'Conferences can see your chair and secretariat experience and invite you to apply. They never see your email. At most 3 invites a week. You need at least one conference on your MUN CV',
              on: !!talentOpen,
              disabled: saving || cvPrivate || talentBusy || talentOpen === null,
              dim: cvPrivate,
              busy: talentBusy,
              onToggle: (next) => { void changeTalent(next); },
            }} />
            {talentError && (
              <p role="alert" style={{ margin: '0 10px 6px', fontFamily: OUTFIT, fontSize: T.caption, fontWeight: 700, color: '#8B2020', lineHeight: 1.45 }}>
                {talentError}
              </p>
            )}

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
    </>
  );
}

/** One row of the panel: a title, one plain line under it and a switch. */
function ToggleRow(args: {
  icon: typeof Lock; title: string; line: string; on: boolean; disabled: boolean; dim?: boolean;
  busy?: boolean; onToggle: (next: boolean) => void;
}) {
    const Icon = args.icon;
    return (
      <label
        className="flex items-start justify-between gap-3 rounded-[12px]"
        style={{ padding: 10, cursor: args.disabled ? 'default' : 'pointer', opacity: args.dim ? 0.5 : 1 }}
      >
        <span className="flex items-start gap-2.5 min-w-0">
          <Icon size={16} strokeWidth={2.2} style={{ color: '#5C5140', marginTop: 2, flexShrink: 0 }} aria-hidden />
          <span className="min-w-0">
            <span className="block" style={{ fontFamily: OUTFIT, fontSize: T.body, fontWeight: 600, color: '#1C1410' }}>{args.title}</span>
            <span className="block" style={{ marginTop: 3, fontFamily: OUTFIT, fontSize: T.caption, color: '#6E5F4E', lineHeight: 1.45 }}>{args.line}</span>
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="sr-only peer"
          checked={args.on}
          disabled={args.disabled}
          aria-busy={args.busy || undefined}
          onChange={(e) => args.onToggle(e.target.checked)}
        />
        <span
          aria-hidden
          className="relative flex-shrink-0 rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-[#B6871F]"
          style={{ width: 40, height: 24, marginTop: 1, background: args.on ? '#1B3828' : 'rgba(154,138,120,0.45)', transition: 'background-color 180ms ease' }}
        >
          <span
            className="absolute rounded-full"
            style={{ top: 3, left: 3, width: 18, height: 18, background: '#FFFFFF', transform: args.on ? 'translateX(16px)' : 'none', transition: 'transform 180ms cubic-bezier(0.22,1,0.36,1)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
          />
        </span>
      </label>
    );
  }
