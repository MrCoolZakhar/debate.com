'use client';

/**
 * The CREATE chooser behind the nav's CREATE item (25 Sep 2026).
 *
 * Two big rows, "Create a session" (/create: a committee room, free, no
 * account) and "Create a conference" (/conferences/new: applications,
 * allocations, every committee, free for organisers). On desktop it is a small
 * popover under the CREATE item, portaled to document.body at fixed
 * coordinates from the trigger's rect, clamped inside the viewport. On a phone
 * (743px and narrower) it is a bottom sheet with a backdrop. It closes on an
 * outside click, Escape, and a route change, and hands focus back to the
 * trigger.
 *
 * `CreateOptions` is the two rows on their own, so the hamburger sheet can
 * open them inline under its CREATE row without stacking a sheet on a sheet.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Gavel, Globe } from 'lucide-react';
import { Emoji3D } from '@/components/neu';
import type { Language } from '@/lib/translations';

const FONT = "var(--font-brand), sans-serif";
const PHONE_QUERY = '(max-width: 743px)';
const POPOVER_WIDTH = 400;
const EDGE = 12;

// Labels in the four languages, read from the same `useLanguage()` value the
// nav uses. No full stops on the lines (owner).
const LABELS: Record<Language, {
  title: string;
  session: string;
  sessionLine: string;
  conference: string;
  conferenceLine: string;
  close: string;
}> = {
  en: {
    title: 'Create',
    session: 'Create a session',
    sessionLine: 'A committee room in seconds, free, no account',
    conference: 'Create a conference',
    conferenceLine: 'Applications, allocations and every committee, free for organizers',
    close: 'Close',
  },
  es: {
    title: 'Crear',
    session: 'Crear una sesión',
    sessionLine: 'Una sala de comité en segundos, gratis, sin cuenta',
    conference: 'Crear una conferencia',
    conferenceLine: 'Solicitudes, asignaciones y todos los comités, gratis para organizadores',
    close: 'Cerrar',
  },
  fr: {
    title: 'Créer',
    session: 'Créer une session',
    sessionLine: 'Une salle de comité en quelques secondes, gratuit, sans compte',
    conference: 'Créer une conférence',
    conferenceLine: 'Candidatures, attributions et tous les comités, gratuit pour les organisateurs',
    close: 'Fermer',
  },
  ar: {
    title: 'إنشاء',
    session: 'إنشاء جلسة',
    sessionLine: 'قاعة لجنة في ثوانٍ، مجاناً، بدون حساب',
    conference: 'إنشاء مؤتمر',
    conferenceLine: 'الطلبات والتوزيعات وكل اللجان، مجاناً للمنظمين',
    close: 'إغلاق',
  },
};

export function createChooserLabels(language: Language) {
  return LABELS[language] ?? LABELS.en;
}

type OptionRowProps = {
  href: string;
  emoji: string;
  fallback: typeof Gavel;
  title: string;
  line: string;
  rtl: boolean;
  onNavigate?: () => void;
  autoFocus?: boolean;
};

function OptionRow({ href, emoji, fallback, title, line, rtl, onNavigate, autoFocus }: OptionRowProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  const Chevron = rtl ? ChevronLeft : ChevronRight;
  return (
    <Link
      ref={ref}
      href={href}
      onClick={onNavigate}
      className="group flex w-full items-center gap-3.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F3]"
      style={{
        minHeight: 64,
        padding: '12px 12px 12px 14px',
        textDecoration: 'none',
        color: '#1C1410',
        backgroundColor: 'transparent',
        transition: 'background-color 150ms ease',
        textAlign: 'start',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.07)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{ width: 48, height: 48, backgroundColor: 'rgba(27,56,40,0.06)' }}
      >
        <Emoji3D name={emoji} size={36} fallback={fallback} fallbackColor="#1B3828" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 }}>
        <span style={{ fontFamily: FONT, fontSize: 17, fontWeight: 700, lineHeight: 1.2, color: '#1C1410' }}>
          {title}
        </span>
        <span style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 500, lineHeight: 1.35, color: '#5A5046' }}>
          {line}
        </span>
      </span>
      <Chevron
        aria-hidden
        size={20}
        strokeWidth={2.2}
        className="shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
        style={{ color: '#1B3828' }}
      />
    </Link>
  );
}

/** The two rows on their own (the hamburger sheet renders them inline). */
export function CreateOptions({
  language,
  onNavigate,
  autoFocus = false,
}: {
  language: Language;
  onNavigate?: () => void;
  autoFocus?: boolean;
}) {
  const L = createChooserLabels(language);
  const rtl = language === 'ar';
  return (
    <div className="flex flex-col" style={{ gap: 2 }} dir={rtl ? 'rtl' : undefined}>
      <OptionRow
        href="/create"
        emoji="Classical building"
        fallback={Gavel}
        title={L.session}
        line={L.sessionLine}
        rtl={rtl}
        onNavigate={onNavigate}
        autoFocus={autoFocus}
      />
      <OptionRow
        href="/conferences/new"
        emoji="Globe with meridians"
        fallback={Globe}
        title={L.conference}
        line={L.conferenceLine}
        rtl={rtl}
        onNavigate={onNavigate}
      />
    </div>
  );
}

export default function CreateChooser({
  open,
  onClose,
  anchorRef,
  language,
}: {
  open: boolean;
  onClose: () => void;
  /** The CREATE item; the popover hangs under it and focus returns to it. */
  anchorRef: RefObject<HTMLElement | null>;
  language: Language;
}) {
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [phone, setPhone] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const L = createChooserLabels(language);
  const rtl = language === 'ar';

  useEffect(() => { setMounted(true); }, []);

  // Popover or bottom sheet: decided by the viewport, re-decided on resize.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(PHONE_QUERY);
    const apply = () => setPhone(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Route change closes it (a Link inside already calls onClose, but Back /
  // Forward and links elsewhere do not).
  const openedAt = useRef<string | null>(null);
  useEffect(() => {
    if (!open) { openedAt.current = null; return; }
    if (openedAt.current === null) { openedAt.current = pathname; return; }
    if (pathname !== openedAt.current) onClose();
  }, [open, pathname, onClose]);

  // Position under the trigger, centred on it, clamped to the viewport.
  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - EDGE * 2);
    const left = Math.max(EDGE, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - EDGE));
    setPos({ top: Math.round(r.bottom + 8), left: Math.round(left) });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open || phone) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, phone, place]);

  // Escape and outside click. The trigger itself is excluded so its own
  // toggle does not close and reopen in one press.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open, onClose, anchorRef]);

  // Focus returns to the trigger when the chooser closes.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) { wasOpen.current = true; return; }
    if (wasOpen.current) {
      wasOpen.current = false;
      anchorRef.current?.focus({ preventScroll: true });
    }
  }, [open, anchorRef]);

  if (!open || !mounted) return null;

  const panelBase: CSSProperties = {
    backgroundColor: '#FAF8F3',
    border: '1px solid #DDD4C0',
    boxShadow: '0 16px 48px rgba(27,56,40,0.18), 0 2px 8px rgba(27,56,40,0.08)',
    fontFamily: FONT,
  };

  if (phone) {
    return createPortal(
      <div className="fixed inset-0" style={{ zIndex: 60 }} dir={rtl ? 'rtl' : undefined}>
        <button
          type="button"
          aria-label={L.close}
          onClick={onClose}
          className="absolute inset-0 w-full focus:outline-none"
          style={{ backgroundColor: 'rgba(28,20,16,0.45)', border: 'none', cursor: 'pointer' }}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={L.title}
          className="absolute inset-x-0 bottom-0"
          style={{
            ...panelBase,
            borderRadius: '20px 20px 0 0',
            borderBottom: 'none',
            padding: '10px 12px calc(16px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div aria-hidden className="mx-auto mb-3 rounded-full" style={{ width: 40, height: 4, backgroundColor: 'rgba(27,56,40,0.22)' }} />
          <p
            className="px-3 pb-2"
            style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5046', margin: 0 }}
          >
            {L.title}
          </p>
          <CreateOptions language={language} onNavigate={onClose} autoFocus />
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={L.title}
      dir={rtl ? 'rtl' : undefined}
      className="fixed"
      style={{
        ...panelBase,
        top: pos?.top ?? 80,
        left: pos?.left ?? EDGE,
        width: Math.min(POPOVER_WIDTH, typeof window !== 'undefined' ? window.innerWidth - EDGE * 2 : POPOVER_WIDTH),
        borderRadius: 18,
        padding: 8,
        zIndex: 60,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      <CreateOptions language={language} onNavigate={onClose} autoFocus />
    </div>,
    document.body,
  );
}
