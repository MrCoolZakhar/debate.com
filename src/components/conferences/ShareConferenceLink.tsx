'use client';

// ── Share your conference link (organiser dashboard, set-up priorities) ─────
//
// Owner, 21 Sep 2026: "add a share link in the priorities with the big share
// icon, especially once it's all set up: then just say they are verified, but
// to share the link everywhere."
//
// Two shapes, one action:
//   ShareLinkRow   one row among the pending priorities while set-up is open.
//   ShareHero      the whole priorities card once every stage is done AND the
//                  conference is verified: one line, the blue check, and the
//                  share action as the protagonist.
//
// The action always COPIES the link first, so "Copied" is always true. On a
// touch device that has the Web Share API it then opens the system share sheet
// as well (a desktop browser that also has navigator.share, macOS Chrome for
// one, gets the copy only: a share sheet over a laptop dashboard is noise).
//
// The link is the vanity /<acronym> when that acronym resolves to THIS
// conference (public, unambiguous; src/lib/vanity.ts decides, with the same
// cached anon read the [slug] route uses), else the canonical
// /conferences/<slug>. No em dashes in this file's copy.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { NEU, OUTFIT } from '@/components/neu';
import VerifiedCheck from '@/components/VerifiedCheck';
import { normalizeVanity, resolveConferenceVanity } from '@/lib/vanity';

type ShareConference = { slug: string; acronym: string | null; full_name: string; is_public: boolean };

/** The URL to share. Starts canonical and upgrades to the vanity path once
 *  the resolver confirms the acronym points at this very conference. */
export function useConferencePublicUrl(conference: ShareConference): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gavelling.com';
  const canonical = `${origin}/conferences/${conference.slug}`;
  const [vanity, setVanity] = useState<{ slug: string; url: string } | null>(null);

  useEffect(() => {
    const key = normalizeVanity(conference.acronym ?? '');
    if (!conference.is_public || !key) return;
    let cancelled = false;
    resolveConferenceVanity(key).then(slug => {
      if (cancelled || slug !== conference.slug) return;
      setVanity({ slug: conference.slug, url: `${window.location.origin}/${key}` });
    });
    return () => { cancelled = true; };
  }, [conference.acronym, conference.slug, conference.is_public]);

  return vanity && vanity.slug === conference.slug && conference.is_public ? vanity.url : canonical;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** Copy, then (touch devices with the Web Share API) open the share sheet. */
function useShareAction(url: string, title: string) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const share = useCallback(async () => {
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2200);
    }
    const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    if (coarse && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
      } catch {
        // Dismissed, or the sheet is unavailable. The link is already copied.
      }
    }
  }, [url, title]);

  return { copied, share };
}

/** Strip the scheme so the line reads as an address, not as code. */
function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

// ── Row among the pending priorities ──────────────────────────────────────

export function ShareLinkRow({ conference }: { conference: ShareConference }) {
  const url = useConferencePublicUrl(conference);
  const { copied, share } = useShareAction(url, conference.full_name);
  return (
    <button
      type="button"
      onClick={() => { void share(); }}
      className="flex items-center w-full text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-transform active:scale-[0.99]"
      style={{
        gap: 10, padding: '5px 10px 5px 6px', borderRadius: 12, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg, rgba(27,56,40,0.07) 0%, rgba(27,56,40,0.02) 100%)',
        boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.12)', fontFamily: OUTFIT, flexShrink: 0,
      }}
      aria-label={copied ? 'Link copied' : `Share your conference link, ${displayUrl(url)}`}
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{ width: 34, height: 34, borderRadius: 999, background: 'linear-gradient(135deg, #1B3828 0%, #2A5A3C 100%)', color: NEU.gold }}
      >
        {copied ? <Check size={18} strokeWidth={2.6} /> : <Share2 size={18} strokeWidth={2.4} />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate" style={{ fontSize: 12, fontWeight: 700, color: NEU.ink }}>
          Share your conference link
        </span>
        <span className="block truncate" title={url} style={{ fontSize: 10.5, color: NEU.inkSoft, marginTop: 1 }}>
          {displayUrl(url)}
        </span>
      </span>
      <span aria-live="polite" className="flex-shrink-0" style={{ fontSize: 11, fontWeight: 800, color: copied ? '#3D7A52' : NEU.forest }}>
        {copied ? 'Copied' : 'Copy'}
      </span>
    </button>
  );
}

// ── The whole card once everything is done and verified ───────────────────

export function ShareHero({ conference }: { conference: ShareConference }) {
  const url = useConferencePublicUrl(conference);
  const { copied, share } = useShareAction(url, conference.full_name);
  return (
    <div className="flex items-center min-w-0" style={{ gap: 12, fontFamily: OUTFIT }}>
      <div className="flex-1 min-w-0">
        <p className="flex items-center gap-1.5 min-w-0" style={{ fontSize: 15, fontWeight: 900, color: NEU.ink, lineHeight: 1.25, margin: 0 }}>
          <VerifiedCheck verified size={18} title="Verified conference" />
          <span className="min-w-0">Verified. Now share your link everywhere.</span>
        </p>
        <p className="truncate" title={url} style={{ fontSize: 11.5, color: NEU.inkSoft, margin: '4px 0 0 24px' }}>
          {displayUrl(url)}
        </p>
      </div>
      {/* Icon first, the word small beneath it (CLAUDE.md section 8). */}
      <button
        type="button"
        onClick={() => { void share(); }}
        className="flex flex-col items-center justify-center flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] transition-transform active:scale-[0.97] gv-lift"
        style={{
          width: 74, height: 70, gap: 3, borderRadius: 18, border: 'none', cursor: 'pointer',
          background: copied ? 'linear-gradient(135deg, #3D7A52 0%, #2A5A3C 100%)' : 'linear-gradient(135deg, #1B3828 0%, #2A5A3C 100%)',
          color: NEU.gold, fontFamily: OUTFIT,
        }}
        aria-label={copied ? 'Link copied' : 'Share your conference link'}
        title="Copies your conference link"
      >
        {copied ? <Check size={30} strokeWidth={2.4} aria-hidden /> : <Share2 size={30} strokeWidth={2.2} aria-hidden />}
        <span aria-live="polite" style={{ fontSize: 11, fontWeight: 800 }}>{copied ? 'Copied' : 'Share'}</span>
      </button>
    </div>
  );
}
