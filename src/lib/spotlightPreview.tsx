'use client';

/**
 * "Preview Spotlight" (prompt 128, 16 Oct 2026). The Store's Spotlight pop-up
 * opens the REAL homepage or Explore in a new tab with ?spotlight_preview=
 * {conference id}; the page then draws that conference's Spotlight as it will
 * look to visitors, for the people who manage it only.
 *
 * - Who: a signed-in user who manages the conference, the same check as the
 *   manage layout (organizer_id, a conference_organizers row, or a platform
 *   admin). For anyone else, or signed out, the flag does nothing.
 * - Records NOTHING: the preview row has no booking id, the pages skip every
 *   recordSpotlightView / recordSpotlightClick and never claim the
 *   once-per-visit pop-up keys while a preview is checking or shown.
 * - The description typed in the Store's step 2 travels in localStorage
 *   (one key per conference) and is read once here.
 * - Close preview removes the flag (history.replaceState) and hides it.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Eye, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import type { FeaturedRow, SpotlightPlacement } from '@/lib/spotlight';

export const SPOTLIGHT_PREVIEW_PARAM = 'spotlight_preview';
export const PREVIEW_CLICK_HINT = 'Visitors can click this';

const NAMES: Record<SpotlightPlacement, string> = { homepage: 'Homepage', explore: 'Explore', region: 'Region', country: 'Country' };

function descKey(conferenceId: string) {
  return `gv-spotlight-preview-${conferenceId}`;
}

/** The Store side: remembers the typed description for the preview tab. */
export function storePreviewDescription(conferenceId: string, description: string) {
  try {
    const d = description.trim();
    if (d) localStorage.setItem(descKey(conferenceId), d);
    else localStorage.removeItem(descKey(conferenceId));
  } catch { /* storage blocked: the preview simply shows no description */ }
}

function readPreviewDescription(conferenceId: string): string | null {
  try {
    const d = localStorage.getItem(descKey(conferenceId));
    return d && d.trim() ? d.trim() : null;
  } catch {
    return null;
  }
}

/** The page the preview opens for a placement (a new tab). */
export function spotlightPreviewHref(
  placement: SpotlightPlacement,
  conferenceId: string,
  opts: { continent?: string | null; country?: string | null },
): string {
  const flag = `${SPOTLIGHT_PREVIEW_PARAM}=${encodeURIComponent(conferenceId)}`;
  if (placement === 'homepage') return `/?${flag}`;
  if (placement === 'region' && opts.continent) return `/conferences/explore?continent=${encodeURIComponent(opts.continent)}&${flag}`;
  if (placement === 'country' && opts.country?.trim()) return `/conferences/explore?country=${encodeURIComponent(opts.country.trim())}&${flag}`;
  return `/conferences/explore?${flag}`;
}

/** The flag in the address bar now, read synchronously (no render needed). */
export function previewFlagInUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = new URL(window.location.href).searchParams.get(SPOTLIGHT_PREVIEW_PARAM);
    return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
  } catch {
    return null;
  }
}

export interface PreviewConference {
  id: string;
  slug: string;
  acronym: string;
  full_name: string;
  banner_url: string | null;
  logo_url: string | null;
  city: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  format: string | null;
}

export interface SpotlightPreview {
  conference: PreviewConference;
  description: string | null;
  /** The saved Region / Country pop-up content, when the conference has such a purchase. */
  pitch: string | null;
  highlights: string[];
}

/**
 * 'none': no flag in the URL. 'checking': a flag, still deciding. 'denied':
 * a flag the viewer may not use (the page is exactly as today). 'active': the
 * preview is shown.
 */
export type PreviewStatus = 'none' | 'checking' | 'denied' | 'active';

export function useSpotlightPreview(placement: SpotlightPlacement): {
  status: PreviewStatus;
  preview: SpotlightPreview | null;
  close: () => void;
} {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  // Read once, on the client, at mount (the server render never has it).
  const [flag, setFlag] = useState<string | null>(null);
  const [flagRead, setFlagRead] = useState(false);
  const [state, setState] = useState<{ status: PreviewStatus; preview: SpotlightPreview | null }>({ status: 'none', preview: null });

  useEffect(() => {
    setFlag(previewFlagInUrl());
    setFlagRead(true);
  }, []);

  useEffect(() => {
    if (!flagRead) return;
    if (!flag) { setState({ status: 'none', preview: null }); return; }
    if (authLoading) { setState({ status: 'checking', preview: null }); return; }
    if (!userId) { setState({ status: 'denied', preview: null }); return; }
    let alive = true;
    setState({ status: 'checking', preview: null });
    (async () => {
      try {
        const c = await getFreshAuthedClient();
        if (!c) throw new Error('no client');
        const { data: conf } = await c
          .from('conferences')
          .select('id, slug, acronym, full_name, banner_url, logo_url, city, country, start_date, end_date, format, organizer_id')
          .eq('id', flag)
          .maybeSingle();
        if (!conf) throw new Error('not found');
        const row = conf as PreviewConference & { organizer_id: string | null };
        let allowed = row.organizer_id === userId;
        if (!allowed) {
          const { data: org } = await c.from('conference_organizers').select('user_id').eq('user_id', userId).eq('conference_id', row.id).maybeSingle();
          allowed = !!org;
        }
        if (!allowed) {
          const { data: staff } = await c.rpc('is_platform_admin');
          allowed = staff === true;
        }
        if (!allowed) throw new Error('denied');

        let pitch: string | null = null;
        let highlights: string[] = [];
        if (placement === 'region' || placement === 'country') {
          const { data: mine } = await c.rpc('my_spotlights', { p_conf: row.id });
          type P = { status?: string; pitch?: string | null; highlights?: string[] | null; bookings?: { placement: string }[] | null };
          const list = Array.isArray(mine) ? (mine as P[]) : [];
          const own = list
            .filter(p => p.status !== 'cancelled' && (p.bookings ?? []).some(b => b.placement === placement))
            .find(p => (p.pitch ?? '').trim() || (p.highlights ?? []).some(h => (h ?? '').trim()));
          if (own) {
            pitch = (own.pitch ?? '').trim() || null;
            highlights = (own.highlights ?? []).map(h => (h ?? '').trim()).filter(Boolean).slice(0, 3);
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { organizer_id: _o, ...conference } = row;
        if (alive) setState({ status: 'active', preview: { conference, description: readPreviewDescription(row.id), pitch, highlights } });
      } catch {
        if (alive) setState({ status: 'denied', preview: null });
      }
    })();
    return () => { alive = false; };
  }, [flag, flagRead, authLoading, userId, placement]);

  const close = useCallback(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete(SPOTLIGHT_PREVIEW_PARAM);
      window.history.replaceState(window.history.state, '', url.pathname + (url.search || '') + url.hash);
    } catch { /* the URL stays; the preview still hides */ }
    setFlag(null);
    setState({ status: 'none', preview: null });
  }, []);

  // Before the flag is read on the client, a flag in the URL counts as checking,
  // so nothing is recorded or claimed in the first render.
  const status: PreviewStatus = !flagRead ? (previewFlagInUrl() ? 'checking' : 'none') : state.status;
  return { status, preview: status === 'active' ? state.preview : null, close };
}

/** The row the public components draw: no booking, so nothing can be recorded. */
export function previewFeaturedRow(p: SpotlightPreview): FeaturedRow {
  const c = p.conference;
  return {
    conference_id: c.id, slug: c.slug, acronym: c.acronym, full_name: c.full_name,
    banner_url: c.banner_url, logo_url: c.logo_url, city: c.city, country: c.country,
    start_date: c.start_date, end_date: c.end_date, description: p.description,
    booking_id: null, is_spotlight: true,
  };
}

/** The fixed bar at the top of the previewed page. */
export function SpotlightPreviewBar({ placement, preview, onClose }: {
  placement: SpotlightPlacement;
  preview: SpotlightPreview;
  onClose: () => void;
}) {
  const acronym = (preview.conference.acronym || preview.conference.full_name || '').trim();
  return (
    <div className="gv-spv-bar" role="status">
      <style>{BAR_CSS}</style>
      <span className="gv-spv-icon" aria-hidden><Eye size={16} strokeWidth={2.4} /></span>
      <p className="gv-spv-text">Preview: this is how visitors see {acronym}&apos;s {NAMES[placement]} Spotlight</p>
      <button type="button" className="gv-spv-close" onClick={onClose}>
        <X size={14} strokeWidth={2.6} aria-hidden />
        Close preview
      </button>
    </div>
  );
}

const BAR_CSS = `
.gv-spv-bar{position:fixed;top:calc(10px + env(safe-area-inset-top, 0px));left:50%;transform:translateX(-50%);z-index:1200;display:flex;align-items:center;gap:10px;max-width:calc(100vw - 24px);padding:8px 8px 8px 14px;border-radius:999px;background:#FFFFFF;box-shadow:0 0 0 1.5px rgba(184,140,40,0.55),0 14px 34px -12px rgba(27,56,40,0.45);font-family:var(--font-brand),sans-serif;color:#1C1410}
.gv-spv-icon{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;background:#EED98A;color:#1B3828;flex-shrink:0}
.gv-spv-text{margin:0;font-size:14px;font-weight:600;line-height:1.3;overflow-wrap:anywhere}
.gv-spv-close{display:inline-flex;align-items:center;gap:6px;flex-shrink:0;min-height:36px;padding:0 14px;border:none;border-radius:999px;background:linear-gradient(90deg,#1B3828 0%,#2A5A3C 100%);color:#FFFFFF;font-family:inherit;font-size:13.5px;font-weight:700;cursor:pointer}
.gv-spv-close:focus{outline:none}
.gv-spv-close:focus-visible{outline:2px solid #1B3828;outline-offset:2px}
@media (max-width:600px){
  .gv-spv-bar{top:calc(8px + env(safe-area-inset-top, 0px));border-radius:18px;align-items:flex-start;flex-wrap:wrap;padding:10px 10px 10px 12px}
  .gv-spv-text{flex:1 1 180px;font-size:13px}
}
`;

/**
 * The site's own tooltip on a previewed card or button (prompt 140; it was a
 * native `title`, slow and not part of the site). Shown at once on hover and on
 * keyboard focus inside it, above the element, kept on screen. Clicking still
 * does nothing in a preview (the caller's markup decides that).
 */
export function PreviewHint({ text = PREVIEW_CLICK_HINT, children, className, style, disabled = false }: {
  text?: string;
  /** Not a preview: draws the children with no tooltip. */
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const show = useCallback(() => {
    const el = ref.current;
    if (!el || disabled) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(220, window.innerWidth - 20);
    const left = Math.max(10, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 10));
    const above = r.top > 60;
    setPos({ top: above ? r.top - 8 : r.bottom + 8, left, above });
  }, [disabled]);
  useEffect(() => {
    if (!pos) return;
    const hide = () => setPos(null);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => { window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide); };
  }, [pos]);
  return (
    <span
      ref={ref}
      className={className}
      style={{ display: 'inline-block', ...style }}
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
      onFocus={show}
      onBlur={() => setPos(null)}
    >
      {children}
      {pos && (
        <Portal>
          <span
            role="tooltip"
            style={{
              position: 'fixed', zIndex: 9600, top: pos.top, left: pos.left, width: Math.min(220, window.innerWidth - 20),
              transform: pos.above ? 'translateY(-100%)' : undefined,
              padding: '9px 12px', borderRadius: 12, background: '#F0EBDD',
              boxShadow: '0 10px 26px -12px rgba(27,56,40,0.45), 0 1px 0 rgba(27,56,40,0.08)',
              fontFamily: 'var(--font-brand), sans-serif', fontSize: 13, fontWeight: 600, lineHeight: 1.45,
              color: '#5B4F42', textAlign: 'center', pointerEvents: 'none',
            }}
          >
            {text}
          </span>
        </Portal>
      )}
    </span>
  );
}

